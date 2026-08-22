import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const GATHER_HOST = 'gather.bf2.top';
const PRIMARY_HOST = 'bf2.top';

const getHostname = (request: NextRequest) =>
  (request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.hostname)
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase();

export async function middleware(request: NextRequest) {
  const hostname = getHostname(request);
  const { pathname } = request.nextUrl;

  // Keep the old public URL working once this version reaches bf2.top.
  if (
    hostname === PRIMARY_HOST &&
    (pathname === '/gather' || pathname.startsWith('/gather/'))
  ) {
    const destination = request.nextUrl.clone();
    destination.protocol = 'https:';
    destination.host = GATHER_HOST;
    destination.pathname = pathname === '/gather' ? '/' : pathname;
    return NextResponse.redirect(destination, 308);
  }

  const sessionResponse = await updateSession(request);

  // Serve the gather page at the custom domain root without exposing /gather.
  if (hostname === GATHER_HOST && pathname === '/') {
    const destination = request.nextUrl.clone();
    destination.pathname = '/gather';
    const rewriteResponse = NextResponse.rewrite(destination);

    sessionResponse.cookies
      .getAll()
      .forEach((cookie) => rewriteResponse.cookies.set(cookie));

    return rewriteResponse;
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
