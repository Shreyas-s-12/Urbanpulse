/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '',
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api/v1',
    NEXT_PUBLIC_WS_BASE_URL:
      process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://127.0.0.1:8000/api/v1/ws',
  },
  async redirects() {
    return [
      {
        source: '/command',
        destination: '/overview',
        permanent: false,
      },
      {
        source: '/map',
        destination: '/overview',
        permanent: false,
      },
      {
        source: '/events',
        destination: '/updates',
        permanent: false,
      },
      {
        source: '/pulsewire',
        destination: '/updates',
        permanent: false,
      },
      {
        source: '/intelligence',
        destination: '/analytics',
        permanent: false,
      },
      {
        source: '/urban-condition',
        destination: '/analytics',
        permanent: false,
      },
      {
        source: '/copilot',
        destination: '/simulate',
        permanent: false,
      },
      {
        source: '/agent',
        destination: '/simulate',
        permanent: false,
      },
      {
        source: '/scenario',
        destination: '/simulate',
        permanent: false,
      },
      {
        source: '/research-mode',
        destination: '/research',
        permanent: false,
      },
      {
        source: '/login',
        destination: '/signin',
        permanent: false,
      },
      {
        source: '/create-account',
        destination: '/signup',
        permanent: false,
      },
      {
        source: '/get-started',
        destination: '/signup',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://127.0.0.1:8000/api/v1/:path*',
      },
      {
        source: '/api/auth/:path*',
        destination: 'http://127.0.0.1:8000/api/auth/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
