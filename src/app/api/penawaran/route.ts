import { NextRequest, NextResponse, after } from 'next/server';
import React from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { defaultPriceBookV1 } from '@/lib/pricing/default-price-book';
import { hitungPenawaran } from '@/lib/pricing/pricing';
import { PenawaranDocument } from '@/lib/pdf/PenawaranDocument';
import { getCompanySettings } from '@/lib/settings/get-settings';
import { generateQrPngDataUrl } from '@/lib/pdf/qr-helper';
import { renderToBuffer, DocumentProps } from '@react-pdf/renderer';
import { getPeriode } from '@/lib/closing-period';
import { setCachedPdf } from '@/lib/pdf/pdf-cache';
export async function POST(req: NextRequest) {
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

  // 1. Ambil peran user
  const { data: userData } = await adminClient
    .from('users')
    .select('peran')
    .eq('id', user.id)
    .single();

  const userRole = userData?.peran || 'admin';
  if (userRole !== 'admin') {
    return NextResponse.json(
      { error: 'Hanya admin yang boleh membuat penawaran (owner bersifat read-only)' },
      { status: 403 }
    );
  }
  // 2. Ambil buku harga aktif
  const { data: pbRow } = await adminClient
    .from('price_books')
    .select('*')
    .eq('aktif', true)
    .single();

  const priceBook = pbRow?.data_json || defaultPriceBookV1;
  const priceBookId = pbRow?.id || '00000000-0000-0000-0000-000000000001';

  const body = await req.json();
  const { lead_id, penawaran_input, nama_klien, kota_klien, kode_wilayah, kanal, is_unduh_pdf, is_test } = body;
  const isTestQuote = Boolean(is_test || (nama_klien && String(nama_klien).startsWith('[TES]')));
  const initialStatus = is_unduh_pdf ? 'terkirim' : 'draf';
  const terkirimAt = is_unduh_pdf ? new Date().toISOString() : null;

  const rawInput = penawaran_input || {
    segmen: body.segmen || 'B2C',
    zona: body.zona || 'dalam_kota',
    perlu_pasang: Boolean(body.perlu_pasang),
    ongkir_deal: body.ongkir_deal,
    ongkir_aktual: body.ongkir_aktual,
    alasan_potongan_ongkir: body.alasan_ongkir,
    pasang_deal: body.pasang_deal,
    konfirmasi_owner: {
      pasang: body.alasan_pasang ? { sudah_dikonfirmasi: true, alasan: body.alasan_pasang } : undefined,
    },
    items: body.items,
  };

  // Resolusi lead_id: buat lead baru jika belum ada
  let resolvedLeadId = lead_id;
  if (!resolvedLeadId) {
    const clientName = (nama_klien || 'Klien Putra Glass').trim();
    const clientCity = (kota_klien || 'Bandung').trim();
    const { data: newLead, error: leadErr } = await adminClient
      .from('leads')
      .insert({
        brand_id: 'putraglass',
        nama: clientName,
        kota: clientCity,
        zona: rawInput.zona || 'dalam_kota',
        segmen: rawInput.segmen || 'B2C',
        status: 'prospek',
      })
      .select('id')
      .single();

    if (leadErr || !newLead) {
      return NextResponse.json({ error: 'Gagal membuat data kontak lead klien' }, { status: 500 });
    }
    resolvedLeadId = newLead.id;
  }

  // 3. Kalkulasi via Pricing Engine Tunggal (Validasi Server: di bawah batas admin wajib konfirmasi + alasan)
  let kalkulasi;
  try {
    kalkulasi = hitungPenawaran(
      {
        ...rawInput,
        user_role: userRole,
      },
      priceBook
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 422 });
  }

  if (!kalkulasi.is_valid_untuk_pdf || kalkulasi.errors.length > 0) {
    return NextResponse.json(
      { error: kalkulasi.errors[0] || 'Penawaran belum sah untuk disimpan atau diunduh' },
      { status: 422 }
    );
  }
  // 5. Generate Nomor Penawaran atomic via DB function
  // Data tes WAJIB menggunakan sequence terpisah (TES-) agar tidak memakan sequence asli PG-Q-
  let quoteNumber: string;
  const isTestRequest =
    Boolean(body.is_test) ||
    Boolean(rawInput.is_test) ||
    (nama_klien && String(nama_klien).includes('[TES]')) ||
    (nama_klien && String(nama_klien).toLowerCase().includes('test'));

  if (isTestRequest) {
    const { data: testNomor } = await adminClient.rpc('generate_nomor_penawaran_test');
    quoteNumber = testNomor || `TES-${Date.now().toString().slice(-8)}`;
  } else {
    const { data: nomor } = await adminClient.rpc('generate_nomor_penawaran');
    quoteNumber = nomor || `PG-Q-TEMP-${Date.now().toString().slice(-4)}`;
  }
  const pdfPath = `${quoteNumber}.pdf`;
  const validUntilDate = new Date(Date.now() + (priceBook.dokumen_pdf?.masa_berlaku_hari || 7) * 86400000);
  const { data: savedPenawaran, error: saveErr } = await adminClient
    .from('penawaran')
    .insert({
      nomor: quoteNumber,
      lead_id: resolvedLeadId,
      price_book_id: priceBookId,
      items_json: kalkulasi.items,
      ringkasan_json: {
        total_unit: kalkulasi.total_unit,
        subtotal_cermin: kalkulasi.subtotal_cermin,
        ongkir: {
          list: kalkulasi.ongkir.list,
          deal: kalkulasi.ongkir.deal,
          potongan: kalkulasi.ongkir.potongan,
          status: kalkulasi.ongkir.status,
          alasan: kalkulasi.ongkir.alasan,
          di_bawah_net: kalkulasi.ongkir.di_bawah_net,
        },
        pasang: {
          list: kalkulasi.pasang.list,
          deal: kalkulasi.pasang.deal,
          potongan: kalkulasi.pasang.potongan,
          status: kalkulasi.pasang.status,
          alasan: kalkulasi.pasang.alasan,
        },
        total: kalkulasi.total,
        dp_50: kalkulasi.dp_50,
        pelunasan: kalkulasi.pelunasan,
        kota_klien: (kota_klien || 'Bandung').trim(),
        kode_wilayah: kode_wilayah || penawaran_input?.kode_wilayah || null,
        ...(isTestQuote ? { is_test: true } : {}),
      },
      status: initialStatus,
      kanal: kanal || 'whatsapp',
      deal_at: null,
      terkirim_at: terkirimAt,
      alasan_batal: null,
      total_nilai: kalkulasi.total,
      valid_until: validUntilDate.toISOString().split('T')[0],
      pdf_path: pdfPath,
      created_by: user.id,
    })
    .select()
    .single();

  if (saveErr) {
    return NextResponse.json({ error: saveErr.message }, { status: 500 });
  }

  // Catat riwayat status log
  await adminClient.from('penawaran_status_log').insert({
    penawaran_id: savedPenawaran.id,
    dari: 'baru',
    ke: initialStatus,
    alasan: is_unduh_pdf ? 'Unduh PDF otomatis menandai terkirim' : 'Simpan draf awal',
    oleh: user.id,
  });
  if (kalkulasi.ongkir.potongan > 0) {
    await adminClient.from('audit_log').insert({
      aktor: user.id,
      aksi: 'KONFIRMASI_POTONGAN',
      objek: `penawaran:${quoteNumber}:ongkir`,
      sebelum: { nilai_list: kalkulasi.ongkir.list },
      sesudah: { nilai_deal: kalkulasi.ongkir.deal },
      alasan: `${kalkulasi.ongkir.di_bawah_net ? '[DI BAWAH NET] ' : ''}${kalkulasi.ongkir.alasan || 'Potongan ongkir wewenang admin'}`,
    });
  }

  if (kalkulasi.pasang.dikonfirmasi_owner) {
    await adminClient.from('audit_log').insert({
      aktor: user.id,
      aksi: 'KONFIRMASI_POTONGAN',
      objek: `penawaran:${quoteNumber}:pasang`,
      sebelum: { nilai_list: kalkulasi.pasang.list },
      sesudah: { nilai_deal: kalkulasi.pasang.deal },
      alasan: kalkulasi.pasang.alasan || 'Konfirmasi langsung owner',
    });
  }

  // Render Dokumen PDF di Latar Belakang (after) & upload ke storage
  const todayStr = new Date().toLocaleDateString('id-ID');
  const validUntilStr = validUntilDate.toLocaleDateString('id-ID');
  after(async () => {
    try {
      const [companySettings, creatorUserRes] = await Promise.all([
        getCompanySettings(),
        adminClient.from('users').select('nama').eq('id', user.id).single(),
      ]);
      const qrDataUrl = await generateQrPngDataUrl(companySettings.maps_url);
      const namaAdmin = creatorUserRes.data?.nama || 'Admin Putra Glass';

      const pdfDoc = React.createElement(PenawaranDocument, {
        nomor: quoteNumber,
        tanggal: todayStr,
        berlakuSampai: validUntilStr,
        namaKlien: nama_klien || 'Klien Putra Glass',
        kotaKlien: kota_klien || 'Bandung',
        kalkulasi: kalkulasi,
        config: priceBook,
        settings: companySettings,
        qrDataUrl: qrDataUrl,
        kanal: kanal || 'whatsapp',
        namaAdmin: namaAdmin,
      });

      const pdfBuffer = await renderToBuffer(pdfDoc as unknown as React.ReactElement<DocumentProps>);
      setCachedPdf(savedPenawaran.id, Buffer.from(pdfBuffer));
      setCachedPdf(quoteNumber, Buffer.from(pdfBuffer));
      await adminClient.storage
        .from('penawaran-pdf')
        .upload(pdfPath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });
    } catch (bgErr) {
      console.error('[Background PDF Render Error]:', bgErr);
    }
  });

  // 10. Tautan PDF lewat domain aplikasi sendiri (tanpa signed URL eksternal)
  return NextResponse.json({
    success: true,
    penawaran: savedPenawaran,
    pdf_url: `/api/penawaran/${savedPenawaran.id}/pdf`,
    pdf_download_url: `/api/penawaran/${savedPenawaran.id}/pdf?download=true`,
  });
}

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
    .select('peran, nama')
    .eq('id', user.id)
    .single();

  const userRole = userData?.peran || 'admin';

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
  const search = searchParams.get('search')?.trim() || '';
  const status = searchParams.get('status')?.trim() || '';
  const periodeParam = searchParams.get('periode')?.trim();
  const followupOnly = searchParams.get('followup_only') === 'true';
  const includeTest = searchParams.get('include_test') === 'true';

  const currentPeriod = getPeriode();
  let activePeriod = currentPeriod;
  if (periodeParam && periodeParam !== 'all') {
    activePeriod = getPeriode(`${periodeParam}-10`);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = adminClient
    .from('penawaran')
    .select(
      'id, nomor, status, kanal, total_nilai, ringkasan_json, valid_until, created_at, updated_at, deal_at, alasan_batal, deleted_at, deleted_by, delete_reason, created_by, leads!inner(nama, kota, no_wa), users:created_by(id, nama, email)',
      { count: 'exact' }
    );

  if (!includeTest) {
    query = query.not('leads.nama', 'ilike', '[TES]%').not('nomor', 'ilike', '%TEST%');
  }

  // Filter soft delete
  if (status === 'dihapus') {
    if (userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Hanya owner yang dapat melihat daftar penawaran yang dihapus' },
        { status: 403 }
      );
    }
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }

  // Filter status biasa
  if (status && status !== 'all' && status !== 'dihapus') {
    query = query.eq('status', status);
  }

  // Filter follow-up (> 2 hari tanpa update)
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
  if (followupOnly) {
    query = query.eq('status', 'terkirim').lte('updated_at', twoDaysAgo);
  }

  // Filter periode
  if (periodeParam !== 'all') {
    query = query
      .gte('created_at', activePeriod.startDateIso)
      .lte('created_at', activePeriod.endDateIso);
  }

  if (search) {
    query = query.ilike('nomor', `%${search}%`);
  }

  const { data: list, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Hitung Ringkasan Kartu untuk periode aktif
  let cardsQuery = adminClient
    .from('penawaran')
    .select('id, status, total_nilai, updated_at, created_at, deal_at, valid_until, leads!inner(nama)')
    .is('deleted_at', null);

  if (!includeTest) {
    cardsQuery = cardsQuery.not('leads.nama', 'ilike', '[TES]%').not('nomor', 'ilike', '%TEST%');
  }
  if (userRole === 'admin') {
    cardsQuery = cardsQuery.eq('created_by', user.id);
  }
  if (periodeParam !== 'all') {
    cardsQuery = cardsQuery
      .gte('created_at', activePeriod.startDateIso)
      .lte('created_at', activePeriod.endDateIso);
  }

  const { data: cardsData } = await cardsQuery;
  const cData = cardsData || [];

  let terkirimCount = 0;
  let dealCount = 0;
  let dealNilai = 0;
  let batalCount = 0;
  let kadaluwarsaCount = 0;
  let perluFollowupCount = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  for (const item of cData) {
    const s = item.status;
    const isKadaluwarsa = s === 'kadaluwarsa' || (['draf', 'terkirim', 'nego'].includes(s) && item.valid_until < todayStr);

    if (s === 'terkirim' || s === 'nego') {
      terkirimCount += 1;
    }
    if (s === 'deal' || s === 'lunas') {
      dealCount += 1;
      dealNilai += Number(item.total_nilai || 0);
    }
    if (s === 'batal') {
      batalCount += 1;
    }
    if (isKadaluwarsa) {
      kadaluwarsaCount += 1;
    }
    if (s === 'terkirim' && item.updated_at && item.updated_at <= twoDaysAgo) {
      perluFollowupCount += 1;
    }
  }

  const denominator = dealCount + batalCount + kadaluwarsaCount;
  const closingRate = denominator > 0 ? Math.round((dealCount / denominator) * 1000) / 10 : 0;

  return NextResponse.json({
    penawaran: list || [],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
    periode_aktif: activePeriod.key,
    periode_nama: activePeriod.nama,
    ringkasan_kartu: {
      terkirim_count: terkirimCount,
      deal_count: dealCount,
      deal_nilai: dealNilai,
      closing_rate: closingRate,
      perlu_followup_count: perluFollowupCount,
    },
    user_role: userRole,
    user_id: user.id,
    user_nama: userData?.nama || 'Admin',
  });
}

export async function DELETE(req: NextRequest) {
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

  // 1. Role check: Owner read-only -> 403 Forbidden
  const { data: userData } = await adminClient
    .from('users')
    .select('peran, nama')
    .eq('id', user.id)
    .single();

  if (userData?.peran !== 'admin') {
    return NextResponse.json(
      { error: 'Owner tidak diizinkan menghapus penawaran (bersifat read-only)' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const alasan = body.alasan?.trim();
  const catatan = body.catatan?.trim();
  const rawIds = body.ids || (body.id ? [body.id] : []);
  const ids: string[] = Array.isArray(rawIds) ? rawIds.filter(Boolean) : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ID penawaran belum dipilih' }, { status: 400 });
  }

  if (alasan !== 'Demo / percobaan' && alasan !== 'Salah input') {
    return NextResponse.json(
      { error: 'Alasan hapus wajib dipilih: "Demo / percobaan" atau "Salah input"' },
      { status: 400 }
    );
  }

  const fullReason = catatan ? `${alasan}: ${catatan}` : alasan;

  // 2. Fetch targets to validate ownership and status
  const { data: targets, error: fetchErr } = await adminClient
    .from('penawaran')
    .select('id, nomor, status, created_by, total_nilai, deleted_at')
    .in('id', ids);

  if (fetchErr || !targets || targets.length === 0) {
    return NextResponse.json({ error: 'Penawaran tidak ditemukan' }, { status: 404 });
  }

  // Validasi per baris
  for (const t of targets) {
    if (t.created_by !== user.id) {
      return NextResponse.json(
        {
          error: `Penawaran ${t.nomor} dibuat oleh admin lain. Anda hanya dapat menghapus penawaran milik sendiri.`,
        },
        { status: 403 }
      );
    }

    if (t.status === 'deal' || t.status === 'lunas') {
      return NextResponse.json(
        {
          error: `Penawaran ${t.nomor} berstatus ${t.status} (Deal). Penawaran deal tidak dapat dihapus agar omzet dasbor tidak berubah. Ubah status terlebih dahulu jika salah input.`,
        },
        { status: 403 }
      );
    }
  }

  const validIds = targets.filter((t) => !t.deleted_at).map((t) => t.id);
  const nowIso = new Date().toISOString();

  // 3. Soft Delete: update deleted_at, deleted_by, delete_reason
  const { error: updErr } = await adminClient
    .from('penawaran')
    .update({
      deleted_at: nowIso,
      deleted_by: user.id,
      delete_reason: fullReason,
    })
    .in('id', validIds);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // 4. Catat di audit_log dan penawaran_status_log
  for (const t of targets) {
    if (validIds.includes(t.id)) {
      await adminClient.from('audit_log').insert({
        aktor: user.id,
        aksi: 'HAPUS_PENAWARAN',
        objek: t.nomor,
        alasan: fullReason,
        sebelum: { status: t.status, total: t.total_nilai },
        sesudah: { deleted_at: nowIso, deleted_by: user.id, delete_reason: fullReason },
      });

      await adminClient.from('penawaran_status_log').insert({
        penawaran_id: t.id,
        dari: t.status,
        ke: 'dihapus',
        alasan: fullReason,
        oleh: user.id,
      });
    }
  }

  return NextResponse.json({
    success: true,
    count: validIds.length,
    message: `${validIds.length} penawaran berhasil dihapus.`,
  });
}
