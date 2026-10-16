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

  // Tentukan rentang tanggal berbasis zona waktu Asia/Jakarta (WIB, UTC+7)
  const { startDate, endDate } = getWibDateRange(
    periode,
    searchParams.get('start_date'),
    searchParams.get('end_date')
  );
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
    .select('id, aktor, aksi, objek, alasan, created_at, users:aktor(nama, email)')
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

function getWibDateRange(
  periode: string,
  customStart?: string | null,
  customEnd?: string | null
): { startDate: Date; endDate: Date } {
  const now = new Date();
  const wibFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });

  const parts = wibFormatter.formatToParts(now);
  const partMap: Record<string, number> = {};
  for (const p of parts) {
    partMap[p.type] = Number(p.value);
  }
  const curYear = partMap.year || 2026;
  const curMonth = partMap.month || 10;
  const curDay = partMap.day || 16;

  if (periode === 'minggu_ini') {
    const wibDayOfWeek = new Date(`${curYear}-${String(curMonth).padStart(2, '0')}-${String(curDay).padStart(2, '0')}T12:00:00+07:00`).getDay() || 7;
    const mondayDay = curDay - wibDayOfWeek + 1;
    const startStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(Math.max(1, mondayDay)).padStart(2, '0')}T00:00:00.000+07:00`;
    const endStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(curDay).padStart(2, '0')}T23:59:59.999+07:00`;
    return { startDate: new Date(startStr), endDate: new Date(endStr) };
  } else if (periode === 'bulan_lalu') {
    const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
    const prevYear = curMonth === 1 ? curYear - 1 : curYear;
    const lastDayPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
    const startStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01T00:00:00.000+07:00`;
    const endStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDayPrevMonth).padStart(2, '0')}T23:59:59.999+07:00`;
    return { startDate: new Date(startStr), endDate: new Date(endStr) };
  } else if (periode === 'custom' && customStart && customEnd) {
    const startStr = `${customStart}T00:00:00.000+07:00`;
    const endStr = `${customEnd}T23:59:59.999+07:00`;
    return { startDate: new Date(startStr), endDate: new Date(endStr) };
  } else {
    // bulan_ini (default)
    const lastDayThisMonth = new Date(curYear, curMonth, 0).getDate();
    const startStr = `${curYear}-${String(curMonth).padStart(2, '0')}-01T00:00:00.000+07:00`;
    const endStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(lastDayThisMonth).padStart(2, '0')}T23:59:59.999+07:00`;
    return { startDate: new Date(startStr), endDate: new Date(endStr) };
  }
}
