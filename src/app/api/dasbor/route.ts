import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getPeriode } from '@/lib/closing-period';
import { toPeran, PESAN_AKUN_TIDAK_TERDAFTAR } from '@/lib/auth/peran';
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

  const userRole = toPeran(userData?.peran);
  if (!userRole) {
    return NextResponse.json({ error: PESAN_AKUN_TIDAK_TERDAFTAR }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const periode = searchParams.get('periode') || 'bulan_ini';
  const kanal = searchParams.get('kanal') || null;
  const adminId = searchParams.get('admin_id') || null;

  // Tentukan rentang tanggal berbasis periode closing (tanggal 26 s/d 25 Asia/Jakarta)
  let startDate: Date;
  let endDate: Date;
  let periodeNama = '';

  const customStart = searchParams.get('start_date');
  const customEnd = searchParams.get('end_date');
  if (customStart && customEnd) {
    startDate = new Date(`${customStart}T00:00:00.000+07:00`);
    endDate = new Date(`${customEnd}T23:59:59.999+07:00`);
    periodeNama = 'Custom';
  } else if (periode === 'all') {
    startDate = new Date('2020-01-01T00:00:00.000Z');
    endDate = new Date('2030-12-31T23:59:59.999Z');
    periodeNama = 'Semua Periode';
  } else if (/^\d{4}-\d{2}$/.test(periode)) {
    const p = getPeriode(`${periode}-10`);
    startDate = p.startDate;
    endDate = p.endDate;
    periodeNama = p.nama;
  } else if (periode === 'bulan_lalu') {
    const cur = getPeriode();
    const p = getPeriode(new Date(cur.startDate.getTime() - 2 * 86400000));
    startDate = p.startDate;
    endDate = p.endDate;
    periodeNama = p.nama;
  } else {
    // Default: periode closing berjalan
    const p = getPeriode();
    startDate = p.startDate;
    endDate = p.endDate;
    periodeNama = p.nama;
  }
  // 1. Panggil fungsi database get_owner_dashboard_summary (dihitung di PostgreSQL)
  const { data: summary, error: sumErr } = await adminClient.rpc('get_owner_dashboard_summary', {
    p_start_date: startDate.toISOString(),
    p_end_date: endDate.toISOString(),
    p_kanal: kanal,
    p_admin_id: adminId,
  });

  if (sumErr) {
    console.error('[api/dasbor]', sumErr.message);
    return NextResponse.json({ error: 'Terjadi kesalahan di server. Coba lagi sebentar lagi.' }, { status: 500 });
  }

  // 2. Ambil daftar perlu follow-up (terkirim/nego >= 3 hari tanpa perubahan)
  const { data: followUpList, error: fuErr } = await adminClient.rpc('get_quotes_need_followup');
  const cleanFollowUpList = (followUpList || []).filter((item: Record<string, unknown>) => {
    const nama = String(item.nama_klien || '').toLowerCase();
    const nomor = String(item.nomor || '').toLowerCase();
    return !nama.startsWith('[tes]') && !nama.includes('test') && !nomor.includes('test');
  });

  // 3. Ambil grafik mingguan (8 minggu terakhir)
  const { data: chartData, error: chartErr } = await adminClient.rpc('get_weekly_quote_chart');

  // 4. Potongan minggu ini dari audit_log
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: rawPotonganRows } = await adminClient
    .from('audit_log')
    .select('id, aktor, aksi, objek, sebelum, sesudah, alasan, created_at, users:aktor(nama, email)')
    .eq('aksi', 'KONFIRMASI_POTONGAN')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false });

  const cleanPotonganRows = (rawPotonganRows || []).filter((r: { alasan?: string; objek?: string }) => {
    const alasan = String(r.alasan || '').toLowerCase();
    const objek = String(r.objek || '').toLowerCase();
    return !alasan.includes('e2e test') && !alasan.includes('test') && !alasan.includes('uji') && !objek.includes('test');
  });

  const quoteNumbers = cleanPotonganRows
    .map((r: { objek?: string }) => r.objek?.split(':')[1])
    .filter((n): n is string => Boolean(n));

  const quoteMap = new Map<string, Record<string, unknown>>();
  if (quoteNumbers.length > 0) {
    const { data: linkedQuotes } = await adminClient
      .from('penawaran')
      .select('id, nomor, total_nilai, status, valid_until, created_at, ringkasan_json, items_json, leads!inner(nama, kota), users:created_by(nama)')
      .in('nomor', quoteNumbers);

    for (const q of (linkedQuotes || []) as Array<Record<string, unknown>>) {
      if (typeof q.nomor === 'string') {
        quoteMap.set(q.nomor, q);
      }
    }
  }

  const enrichedPotongan = cleanPotonganRows.map((r) => {
    const quoteNo = r.objek?.split(':')[1] || '';
    const q = quoteMap.get(quoteNo);
    let namaKlien = 'Klien';
    let kota = '';
    if (q && 'leads' in q && q.leads && typeof q.leads === 'object') {
      if ('nama' in q.leads && typeof q.leads.nama === 'string') namaKlien = q.leads.nama;
      if ('kota' in q.leads && typeof q.leads.kota === 'string') kota = q.leads.kota;
    }
    const jenis = r.objek?.includes('ongkir') ? 'Ongkir' : 'Pemasangan';
    let listVal = 0;
    if (r.sebelum && typeof r.sebelum === 'object' && 'nilai_list' in r.sebelum) {
      listVal = Number(r.sebelum.nilai_list) || 0;
    }
    let dealVal = 0;
    if (r.sesudah && typeof r.sesudah === 'object' && 'nilai_deal' in r.sesudah) {
      dealVal = Number(r.sesudah.nilai_deal) || 0;
    }
    const selisih = Math.max(0, listVal - dealVal);

    const isBagiDua = listVal > 0 && dealVal === Math.round(listVal * 0.5);
    const keteranganDeal = isBagiDua ? 'dibagi dua' : `potongan Rp${selisih.toLocaleString('id-ID')}`;

    const cleanAlasan = String(r.alasan || '')
      .replace(/^\[DI BAWAH NET\]\s*/i, '')
      .trim();

    const isDiBawahNet =
      String(r.alasan || '').includes('[DI BAWAH NET]') ||
      (listVal === 1300000 && dealVal < 1150000) ||
      (listVal === 750000 && dealVal < 500000);

    let adminNama = 'Admin';
    if (r.users) {
      if (Array.isArray(r.users) && r.users.length > 0 && typeof r.users[0] === 'object' && r.users[0] && 'nama' in r.users[0]) {
        adminNama = String(r.users[0].nama || 'Admin');
      } else if (typeof r.users === 'object' && 'nama' in r.users) {
        adminNama = String(r.users.nama || 'Admin');
      }
    }
    return {
      id: r.id,
      penawaran_id: q?.id || null,
      nomor: quoteNo,
      nama_klien: namaKlien,
      kota,
      jenis,
      nilai_list: listVal,
      nilai_deal: dealVal,
      selisih,
      keterangan_deal: keteranganDeal,
      ringkasan_baris: `${jenis} ${namaKlien} (${quoteNo}): Rp${listVal.toLocaleString('id-ID')} → Rp${dealVal.toLocaleString('id-ID')}, ${keteranganDeal}`,
      alasan: cleanAlasan,
      di_bawah_net: isDiBawahNet,
      tanggal: new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      admin_nama: adminNama,
      penawaran: q || null,
    };
  });

  // 5. Daftar Admin untuk Filter
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
    follow_up: cleanFollowUpList,
    chart: chartData || [],
    potongan_minggu_ini: enrichedPotongan,
    admins: admins || [],
  });
}
