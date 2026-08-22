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
    // Hand the request on as well as the cookies. updateSession() may have just
    // refreshed the session, which rotates the refresh token: the replacement
    // is recorded on `request` for whatever renders next, and on the response
    // for the browser. Rewriting without the request renders the page from the
    // pre-refresh cookies, whose refresh token supabase has already retired, so
    // every render reports no session and signing in appears to do nothing.
    const rewriteResponse = NextResponse.rewrite(destination, { request });

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
