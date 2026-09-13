import { ResolvedLocation } from '@shared/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== 'undefined' ? '/api/v1' : 'http://127.0.0.1:8000/api/v1');

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const primaryUrl = API_BASE_URL.replace(/\/+$/, '') + cleanEndpoint;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Build fallback URLs for network resilience across localhost/127.0.0.1/proxy
  const candidateUrls = [primaryUrl];
  if (primaryUrl.includes('localhost:8000')) {
    candidateUrls.push(primaryUrl.replace('localhost:8000', '127.0.0.1:8000'));
  } else if (primaryUrl.includes('127.0.0.1:8000')) {
    candidateUrls.push(primaryUrl.replace('127.0.0.1:8000', 'localhost:8000'));
  }
  if (typeof window !== 'undefined' && !primaryUrl.startsWith('/api/v1')) {
    candidateUrls.push('/api/v1' + cleanEndpoint);
  }

  let lastError: any = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        ...options,
        headers,
      });

      if (!res.ok) {
        let errBody: any;
        try {
          errBody = await res.json();
        } catch {
          errBody = await res.text();
        }
        const detailMessage =
          typeof errBody === 'object' && errBody?.detail
            ? errBody.detail
            : typeof errBody === 'string' && errBody.trim()
            ? errBody
            : `API call failed: ${res.status} ${res.statusText}`;

        throw new ApiError(detailMessage, res.status, errBody);
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ApiError) {
        // If it's an HTTP error with a response status, don't retry alternative hostnames
        throw err;
      }
      lastError = err;
      // Continue loop to try fallback URL if it was a network failure (e.g. Failed to fetch)
    }
  }

  throw new ApiError(
    (lastError as Error)?.message || 'Network request failed. Ensure backend service is active.',
    0
  );
}

export const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, any>) => {
    let url = endpoint;
    if (params) {
      const sp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) sp.append(k, String(v));
      });
      const qs = sp.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    return apiFetch<T>(url, { method: 'GET' });
  },

  post: <T>(endpoint: string, body: any) => {
    return apiFetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
