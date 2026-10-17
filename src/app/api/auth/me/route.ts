import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('users')
      .select('nama, peran')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        nama: profile?.nama || user.email?.split('@')[0] || 'Pengguna',
        peran: profile?.peran || 'admin',
      },
    }, { status: 200 });
  } catch (err) {
    console.warn('Gagal memuat user di /api/auth/me:', err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
