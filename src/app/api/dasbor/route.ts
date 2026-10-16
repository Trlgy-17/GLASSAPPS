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

  // Cek peran user
  const { data: userData } = await adminClient
    .from('users')
    .select('peran')
    .eq('id', user.id)
    .single();

  const userRole = userData?.peran || 'admin';

  const { searchParams } = new URL(req.url);
  const periode = searchParams.get('periode') || 'bulan_ini';
  const kanal = searchParams.get('kanal') || null;
  const adminId = searchParams.get('admin_id') || null;

  // Tentukan rentang tanggal
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  if (periode === 'minggu_ini') {
    const day = now.getDay() || 7; // 1 = senin
    startDate.setDate(now.getDate() - day + 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (periode === 'bulan_lalu') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (periode === 'custom') {
    const s = searchParams.get('start_date');
    const e = searchParams.get('end_date');
    startDate = s ? new Date(s) : new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = e ? new Date(e) : new Date();
  } else {
    // bulan_ini (default)
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  // 1. Panggil fungsi database get_owner_dashboard_summary (dihitung di PostgreSQL)
  const { data: summary, error: sumErr } = await adminClient.rpc('get_owner_dashboard_summary', {
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
    p_kanal: kanal,
    p_admin_id: adminId,
  });

  if (sumErr) {
    return NextResponse.json({ error: sumErr.message }, { status: 500 });
  }

  // 2. Ambil daftar perlu follow-up (terkirim/nego >= 3 hari tanpa perubahan)
  const { data: followUpList, error: fuErr } = await adminClient.rpc('get_quotes_need_followup');

  // 3. Ambil grafik mingguan (8 minggu terakhir)
  const { data: chartData, error: chartErr } = await adminClient.rpc('get_weekly_quote_chart');

  // 4. Potongan minggu ini dari audit_log
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: potonganRows } = await adminClient
    .from('audit_log')
    .select('id, aktor, aksi, objek, sebelum, sesudah, alasan, created_at, users:aktor(nama, email)')
    .eq('aksi', 'KONFIRMASI_POTONGAN')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false });

  // 5. Perubahan harga terakhir dari audit_log
  const { data: priceBookLogs } = await adminClient
    .from('audit_log')
    .select('id, aktor, aksi, objek, sebelum, sesudah, alasan, created_at, users:aktor(nama, email)')
    .eq('aksi', 'CREATE_PRICE_BOOK')
    .order('created_at', { ascending: false })
    .limit(5);
  // 6. Daftar Admin untuk Filter
  const { data: admins } = await adminClient
    .from('users')
    .select('id, nama, email')
    .eq('peran', 'admin');

  return NextResponse.json({
    role: userRole,
    periode,
    rentang: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    summary,
    follow_up: followUpList || [],
    chart: chartData || [],
    potongan_minggu_ini: potonganRows || [],
    perubahan_harga_terakhir: priceBookLogs || [],
    admins: admins || [],
  });
}
