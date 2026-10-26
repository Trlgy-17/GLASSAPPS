import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { toPeran } from '@/lib/auth/peran';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    let user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const { data: tokenUser } = await adminClient.auth.getUser(token);
        user = tokenUser.user;
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [userProfileRes, penawaranRes] = await Promise.all([
      adminClient.from('users').select('peran').eq('id', user.id).single(),
      adminClient
        .from('penawaran')
        .select('*, leads(id, nama, kota, no_wa, zona, segmen), users:created_by(id, nama, email)')
        .eq('id', id)
        .single(),
    ]);

    const userRole = toPeran(userProfileRes.data?.peran);
    const penawaran = penawaranRes.data;

    if (!penawaran) {
      return NextResponse.json({ error: 'Penawaran tidak ditemukan' }, { status: 404 });
    }

    if (userRole !== 'owner' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, penawaran });
  } catch (err: unknown) {
    console.error('[api/penawaran/[id]]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
