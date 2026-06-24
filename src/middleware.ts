import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';

const SUPPORTED = ['en', 'fr'] as const;

function withDebug(res: NextResponse, mark: string) {
  res.headers.set('x-middleware', mark);
  return res;
}

export function middleware(req: NextRequest) {
  const {pathname} = req.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return withDebug(NextResponse.next(), 'skipped');
  }

  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/fr';
    return withDebug(NextResponse.redirect(url), 'root-redirect');
  }

  const seg = pathname.split('/')[1];
  if (!SUPPORTED.includes(seg as any)) {
    const url = req.nextUrl.clone();
    url.pathname = `/fr${pathname}`;
    return withDebug(NextResponse.redirect(url), 'prefix-redirect');
  }

  return withDebug(NextResponse.next(), 'pass');
}

export const config = { matcher: ['/', '/((?!_next|api|.*\\..*).*)'] };
