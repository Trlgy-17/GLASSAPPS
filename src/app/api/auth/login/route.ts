import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Email atau password salah.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authErr) {
      const msg = authErr.message?.toLowerCase() || '';
      let friendlyError = 'Email atau password salah.';

      if (
        msg.includes('rate limit') ||
        msg.includes('too many') ||
        authErr.status === 429
      ) {
        friendlyError = 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.';
      } else if (
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('connection') ||
        msg.includes('enotfound') ||
        msg.includes('econnrefused')
      ) {
        friendlyError = 'Tidak bisa terhubung ke server. Cek internet lalu coba lagi.';
      }

      return NextResponse.json({ error: friendlyError }, { status: 401 });
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Email atau password salah.' },
        { status: 401 }
      );
    }

    // Ambil profil user untuk menentukan tujuan redirect
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('users')
      .select('peran')
      .eq('id', authData.user.id)
      .single();

    const peran = profile?.peran || 'admin';
    const redirectTo = peran === 'owner' ? '/dasbor' : '/balas';

    return NextResponse.json({
      success: true,
      peran,
      redirectTo,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Server login error:', errMsg);
    return NextResponse.json(
      { error: 'Tidak bisa terhubung ke server. Cek internet lalu coba lagi.' },
      { status: 500 }
    );
  }
}
