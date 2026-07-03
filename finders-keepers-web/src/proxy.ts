import { NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept the maintenance page itself or static assets
  if (
    pathname.startsWith('/maintenance') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
    const res = await fetch(`${apiUrl}/settings/public`, {
      next: { revalidate: 30 },
    });

    if (res.ok) {
      const settings = await res.json();
      if (settings.maintenanceMode === true) {
        return NextResponse.redirect(new URL('/maintenance', request.url));
      }
    }
  } catch {
    // If API is unreachable, let the request through
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
