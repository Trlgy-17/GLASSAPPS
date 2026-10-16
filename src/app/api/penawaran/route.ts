import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hitungPenawaran } from '@/lib/pricing/pricing';
import { defaultPriceBookV1 } from '@/lib/pricing/default-price-book';
import { PenawaranDocument } from '@/lib/pdf/PenawaranDocument';
import { renderToBuffer, DocumentProps } from '@react-pdf/renderer';

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
  const { lead_id, penawaran_input, nama_klien, kota_klien, kanal, is_unduh_pdf } = body;
  const initialStatus = is_unduh_pdf ? 'terkirim' : 'draf';
  const terkirimAt = is_unduh_pdf ? new Date().toISOString() : null;

  const rawInput = penawaran_input || {
    segmen: body.segmen || 'B2C',
    zona: body.zona || 'dalam_kota',
    perlu_pasang: Boolean(body.perlu_pasang),
    ongkir_deal: body.ongkir_deal,
    pasang_deal: body.pasang_deal,
    konfirmasi_owner: {
      ongkir: body.alasan_ongkir ? { sudah_dikonfirmasi: true, alasan: body.alasan_ongkir } : undefined,
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
  const { data: nomor, error: noErr } = await adminClient.rpc('generate_nomor_penawaran');
  const quoteNumber = nomor || `PG-Q-TEMP-${Date.now().toString().slice(-4)}`;

  // 6. Generate Dokumen PDF deterministik
  const todayStr = new Date().toLocaleDateString('id-ID');
  const validUntilDate = new Date(Date.now() + (priceBook.dokumen_pdf?.masa_berlaku_hari || 7) * 86400000);
  const validUntilStr = validUntilDate.toLocaleDateString('id-ID');
  const pdfDoc = React.createElement(PenawaranDocument, {
    nomor: quoteNumber,
    tanggal: todayStr,
    berlakuSampai: validUntilStr,
    namaKlien: nama_klien || 'Klien Putra Glass',
    kotaKlien: kota_klien || 'Bandung',
    kalkulasi: kalkulasi,
    config: priceBook,
  });

  const pdfBuffer = await renderToBuffer(pdfDoc as unknown as React.ReactElement<DocumentProps>);
  const pdfPath = `${quoteNumber}.pdf`;

  // 7. Simpan file PDF ke private bucket storage
  await adminClient.storage
    .from('penawaran-pdf')
    .upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  // 8. Simpan baris Penawaran terkunci (Snapshot)
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
        ongkir: kalkulasi.ongkir,
        pasang: kalkulasi.pasang,
        total: kalkulasi.total,
        dp_50: kalkulasi.dp_50,
        pelunasan: kalkulasi.pelunasan,
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
  if (kalkulasi.ongkir.dikonfirmasi_owner) {
    await adminClient.from('audit_log').insert({
      aktor: user.id,
      aksi: 'KONFIRMASI_POTONGAN',
      objek: `penawaran:${quoteNumber}:ongkir`,
      sebelum: { nilai_list: kalkulasi.ongkir.list },
      sesudah: { nilai_deal: kalkulasi.ongkir.deal },
      alasan: kalkulasi.ongkir.alasan || 'Konfirmasi langsung owner',
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

  // 10. Buat Signed URL berumur pendek untuk unduh PDF
  const { data: signedUrlData } = await adminClient.storage
    .from('penawaran-pdf')
    .createSignedUrl(pdfPath, 3600);

  return NextResponse.json({
    success: true,
    penawaran: savedPenawaran,
    pdf_url: signedUrlData?.signedUrl,
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

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '25', 10)));
  const search = searchParams.get('search')?.trim() || '';
  const status = searchParams.get('status')?.trim() || '';

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = adminClient
    .from('penawaran')
    .select('*, leads(nama, kota, no_wa)', { count: 'exact' });

  if (status && status !== 'all') {
    query = query.eq('status', status);
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

  return NextResponse.json({
    penawaran: list || [],
    total: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  });
}
