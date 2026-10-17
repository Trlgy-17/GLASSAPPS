import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

interface JwtClaims {
  exp: number;
  sub: string;
  email?: string;
  peran?: string;
}

/**
 * Ekstraksi klaim JWT secara lokal dari cookie sesi Supabase
 * Menghilangkan round-trip remote HTTP pada setiap request halaman.
 */
function extractJwtClaims(request: NextRequest): JwtClaims | null {
  const allCookies = request.cookies.getAll();
  let tokenStr = '';

  for (const c of allCookies) {
    if (c.name.includes('-auth-token')) {
      if (c.value.startsWith('base64-')) {
        try {
          const raw = Buffer.from(c.value.replace('base64-', ''), 'base64').toString('utf8');
          const json = JSON.parse(raw);
          if (json.access_token && typeof json.access_token === 'string') {
            tokenStr = json.access_token;
            break;
          }
        } catch {}
      } else {
        try {
          const json = JSON.parse(c.value);
          if (json.access_token && typeof json.access_token === 'string') {
            tokenStr = json.access_token;
            break;
          }
        } catch {}
      }
    }
  }

  if (!tokenStr) return null;

  try {
    const parts = tokenStr.split('.');
    if (parts.length < 2) return null;
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== 'object' || typeof payload.exp !== 'number' || typeof payload.sub !== 'string') {
      return null;
    }
    return {
      exp: payload.exp,
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      peran:
        payload.user_metadata && typeof payload.user_metadata === 'object' && 'peran' in payload.user_metadata
          ? String(payload.user_metadata.peran)
          : undefined,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Lewati static assets, fonts, gambar, dan API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/fonts') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo-mark.png'
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const claims = extractJwtClaims(request);
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Jika token tidak ada atau sudah kadaluwarsa
  if (!claims || claims.exp <= nowSec) {
    if (pathname === '/login') {
      return response;
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirectTo', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 2. Token hampir habis (< 300 detik tersisa): panggil server Supabase untuk refresh sesi
  let userSub = claims.sub;
  if (claims.exp - nowSec < 300) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (pathname === '/login') return response;
      return NextResponse.redirect(new URL('/login', request.url));
    }
    userSub = user.id;
  }

  // 3. Resolusi peran (Periksa cookie pg_role -> metadata -> database jika belum tersimpan)
  let peran = request.cookies.get('pg_role')?.value || claims.peran;
  if (!peran) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const { data: profile } = await supabase
      .from('users')
      .select('peran')
      .eq('id', userSub)
      .single();

    const resolvedPeran: string = profile?.peran || 'admin';
    peran = resolvedPeran;
    response.cookies.set('pg_role', resolvedPeran, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  // 4. Halaman operasional admin yang DILARANG untuk owner:
  const isAdminOnlyPage =
    pathname.startsWith('/balas') ||
    pathname.startsWith('/kalkulator') ||
    pathname.startsWith('/penawaran/baru') ||
    pathname.startsWith('/pengaturan') ||
    /^\/penawaran\/[^/]+\/edit/.test(pathname);

  if (peran === 'owner') {
    if (isAdminOnlyPage) {
      return NextResponse.redirect(new URL('/dasbor', request.url));
    }
    if (pathname === '/' || pathname === '/login') {
      return NextResponse.redirect(new URL('/dasbor', request.url));
    }
  } else if (peran === 'admin') {
    if (pathname === '/dasbor') {
      return NextResponse.redirect(new URL('/balas', request.url));
    }
    if (pathname === '/' || pathname === '/login') {
      return NextResponse.redirect(new URL('/balas', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
