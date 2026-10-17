import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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
    return response;
  }

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
          response = NextResponse.next({
            request,
          });
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

  // 1. Jika belum login dan bukan /login -> redirect ke /login
  if (!user) {
    if (pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  // 2. Ambil peran user dari tabel users
  const { data: profile } = await supabase
    .from('users')
    .select('peran')
    .eq('id', user.id)
    .single();

  const peran = profile?.peran || 'admin';

  // Halaman operasional admin yang DILARANG untuk owner:
  // /balas, /kalkulator, /penawaran/baru, /penawaran/[id]/edit, /pengaturan
  const isAdminOnlyPage =
    pathname.startsWith('/balas') ||
    pathname.startsWith('/kalkulator') ||
    pathname.startsWith('/penawaran/baru') ||
    pathname.startsWith('/pengaturan') ||
    /^\/penawaran\/[^/]+\/edit/.test(pathname);

  if (peran === 'owner') {
    // Owner mencoba buka halaman admin -> redirect ke /dasbor
    if (isAdminOnlyPage) {
      return NextResponse.redirect(new URL('/dasbor', request.url));
    }
    // Jika owner buka root / atau /login -> arahkan ke /dasbor
    if (pathname === '/' || pathname === '/login') {
      return NextResponse.redirect(new URL('/dasbor', request.url));
    }
  } else if (peran === 'admin') {
    // Admin mencoba buka /dasbor -> arahkan ke /balas
    if (pathname === '/dasbor') {
      return NextResponse.redirect(new URL('/balas', request.url));
    }
    // Jika admin buka root / atau /login -> arahkan ke /balas
    if (pathname === '/' || pathname === '/login') {
      return NextResponse.redirect(new URL('/balas', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
