'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export type AuthMode = 'user' | 'guest' | 'unauthenticated';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  oauth_provider?: string | null;
  created_at?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  mode: AuthMode;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
  loginGuest: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<AuthMode>('unauthenticated');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const clearError = () => setError(null);

  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          setMode('user');
        } else if (data.mode === 'guest') {
          setUser(null);
          setMode('guest');
        } else {
          setUser(null);
          setMode('unauthenticated');
        }
      } else {
        setUser(null);
        setMode('unauthenticated');
      }
    } catch (err) {
      // Backend may be offline or initializing; fail gracefully
      console.warn('[AuthContext] Session check warning:', err);
      setUser(null);
      setMode('unauthenticated');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = data.detail || 'Sign in failed. Please check your credentials.';
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      setUser(data.user);
      setMode('user');
      return { success: true };
    } catch (err) {
      const errMsg = 'Network or backend service unavailable. Please try again.';
      setError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = data.detail || 'Sign up failed. Please check your details.';
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      return { success: true };
    } catch (err) {
      const errMsg = 'Network or backend service unavailable. Please try again.';
      setError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const loginGuest = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);
      await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      }).catch((err) => {
        console.warn('[AuthContext] Guest session endpoint notice:', err);
      });
      setUser(null);
      setMode('guest');
      return { success: true };
    } catch {
      setUser(null);
      setMode('guest');
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.warn('[AuthContext] Logout fetch warning:', err);
    } finally {
      setUser(null);
      setMode('unauthenticated');
      setIsLoading(false);
      router.push('/signin');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && mode === 'user',
        isGuest: mode === 'guest',
        mode,
        isLoading,
        error,
        login,
        signup,
        loginGuest,
        logout,
        checkSession,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
