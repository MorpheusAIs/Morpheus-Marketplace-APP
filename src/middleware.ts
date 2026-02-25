import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAINTENANCE_PATH = '/maintenance';

export function middleware(request: NextRequest) {
  const isMaintenanceMode = process.env.IS_MAINTENANCE_MODE === 'true';

  if (!isMaintenanceMode) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow the maintenance page itself and all Next.js internals through
  if (
    pathname === MAINTENANCE_PATH ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images/')
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = MAINTENANCE_PATH;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
