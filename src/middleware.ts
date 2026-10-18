import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { verifySupabaseJwt, VerifiedJwtClaims } from '@/lib/auth/jwt-verifier';
import { toPeran, PESAN_AKUN_TIDAK_TERDAFTAR } from '@/lib/auth/peran';

interface JwtClaims {
  exp?: number;
  sub?: string;
  email?: string;
  peran?: string;
}

/**
 * Ekstraksi token dari cookie sesi Supabase SSR
 */
function extractTokenString(request: NextRequest): string {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  const allCookies = request.cookies.getAll();
  for (const c of allCookies) {
    if (c.name.includes('-auth-token')) {
      if (c.value.startsWith('base64-')) {
        try {
          const raw = Buffer.from(c.value.replace('base64-', ''), 'base64').toString('utf8');
          const json = JSON.parse(raw);
          if (json.access_token && typeof json.access_token === 'string') {
            return json.access_token;
          }
        } catch {}
      } else {
        try {
          const json = JSON.parse(c.value);
          if (json.access_token && typeof json.access_token === 'string') {
            return json.access_token;
          }
        } catch {}
      }
    }
  }
  return '';
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Lewati static assets, fonts, gambar, dan favicon.
  // Catatan: hanya file ber-ekstensi di luar /api yang dilewati; dulu `includes('.')`
  // membuat path apa pun yang mengandung titik lolos dari pengecekan login.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/fonts') ||
    (!pathname.startsWith('/api') && /\.[a-z0-9]{2,5}$/i.test(pathname)) ||
    pathname === '/favicon.ico' ||
    pathname === '/logo-mark.png'
  ) {
    return NextResponse.next();
  }

  // Lewati endpoint auth (login, logout, me)
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const tokenStr = extractTokenString(request);
  let claims: VerifiedJwtClaims | null = null;

  // 1. Verifikasi tanda tangan kriptografis token terhadap Supabase JWKS
  if (tokenStr) {
    try {
      claims = await verifySupabaseJwt(tokenStr);
    } catch {
      // Tanda tangan palsu, payload dimanipulasi, atau token kedaluwarsa -> ditolak!
      claims = null;
    }
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Jika token tidak ada, palsu, atau sudah kedaluwarsa
  if (!claims || !claims.exp || claims.exp <= nowSec) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Token tidak valid atau kedaluwarsa' }, { status: 401 });
    }
    if (pathname === '/login') {
      return response;
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirectTo', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 2. Token hampir habis (< 300 detik tersisa): panggil Supabase server untuk refresh sesi
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
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Sesi berakhir' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
    userSub = user.id;
  }

  // 3. Resolusi peran (Periksa cookie pg_role -> metadata -> database jika belum tersimpan)
  // user_metadata TIDAK dipakai: nilainya bisa diubah sendiri oleh pengguna lewat Supabase Auth.
  // Cookie pg_role hanya untuk mengarahkan halaman; setiap API tetap mengecek peran ke database.
  let peran: string | null = toPeran(request.cookies.get('pg_role')?.value);
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

    const resolvedPeran = toPeran(profile?.peran);
    if (!resolvedPeran) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: PESAN_AKUN_TIDAK_TERDAFTAR }, { status: 403 });
      }
      if (pathname === '/login') return response;
      return NextResponse.redirect(new URL('/login', request.url));
    }
    peran = resolvedPeran;
    response.cookies.set('pg_role', resolvedPeran, {
      path: '/',
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
