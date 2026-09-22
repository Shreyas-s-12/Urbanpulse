import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = new Set(['/', '/signin', '/signup', '/welcome', '/login', '/create-account', '/get-started']);

const GUEST_ACCESSIBLE_ROUTES = new Set([
  '/overview',
  '/updates',
  '/analytics',
  '/simulate',
  '/georag',
  '/crisisrag',
  '/aquarag',
  '/research',
  '/settings',
  '/routes',
  '/urban-condition',
  '/agent',
  '/copilot',
  '/map',
  '/command',
  '/events',
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('urbanpulse_session')?.value;

  // Never intercept root landing page
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Allow public authentication routes
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // Allow guest-accessible routes
  if (GUEST_ACCESSIBLE_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // Routes explicitly requiring registered user authentication
  if (!sessionCookie) {
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('next', pathname);
    signInUrl.searchParams.set('message', 'Authentication required for this resource.');
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes, proxy rewrites)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - images (public assets)
     * - favicon.ico (favicon)
     */
    '/((?!api|_next/static|_next/image|images|favicon.ico).*)',
  ],
};
