import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super-secret-random-key-change-in-production'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NextUrl.pathname already has basePath stripped.
  // So /dashboard/login becomes /login.
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isAuthApi = pathname.startsWith('/api/auth');

  if (isAuthApi) {
    return NextResponse.next();
  }

  const token = request.cookies.get('session')?.value;
  let hasValidSession = false;

  if (token) {
    try {
      await jwtVerify(token, SECRET_KEY);
      hasValidSession = true;
    } catch (e) {
      hasValidSession = false;
    }
  }

  if (isAuthPage) {
    if (hasValidSession) {
      // Redirect to projects page if already authenticated
      return NextResponse.redirect(new URL('/dashboard/projects', request.url));
    }
    return NextResponse.next();
  }

  if (!hasValidSession) {
    // Redirect to login page if unauthenticated
    return NextResponse.redirect(new URL('/dashboard/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all dashboard paths, but exclude API endpoints that are not part of auth, static files, etc.
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/mock (gateway mock requests handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/mock|_next/static|_next/image|favicon.ico).*)',
  ],
};
