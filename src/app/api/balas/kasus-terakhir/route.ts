import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
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

  const { data: userData } = await adminClient
    .from('users')
    .select('peran')
    .eq('id', user.id)
    .single();

  if (userData?.peran !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang boleh mengakses riwayat kasus balas chat' }, { status: 403 });
  }

  try {
    const { data: quotes, error } = await adminClient
      .from('penawaran')
      .select('id, nomor, total_nilai, created_at, status, kanal, items_json, ringkasan_json, leads!inner(id, nama, kota, zona, segmen)')
      .order('created_at', { ascending: false })
      .limit(5);
    const formatted = ((quotes || []) as Array<Record<string, unknown>>).map((q) => {
      const leads = (q.leads || {}) as Record<string, unknown>;
      const ringkasan = (q.ringkasan_json || {}) as Record<string, unknown>;
      const items = Array.isArray(q.items_json) ? (q.items_json as Array<Record<string, unknown>>) : [];
      return {
        id: q.id as string,
        nomor: q.nomor as string,
        nama_klien: (leads.nama as string) || 'Klien',
        kota: (leads.kota as string) || '',
        zona: (leads.zona as string) || 'luar_kota',
        segmen: (leads.segmen as string) || 'B2C',
        total_nilai: Number(q.total_nilai || ringkasan.total || 0),
        tanggal: new Date(q.created_at as string).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        status: q.status as string,
        spesifikasi: items[0] || null,
      };
    });

    return NextResponse.json({ success: true, kasus_terakhir: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
