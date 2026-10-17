import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PenawaranDocument } from '@/lib/pdf/PenawaranDocument';
import { defaultPriceBookV1 } from '@/lib/pricing/default-price-book';
import { getCompanySettings } from '@/lib/settings/get-settings';
import { generateQrPngDataUrl } from '@/lib/pdf/qr-helper';
import { renderToBuffer, DocumentProps } from '@react-pdf/renderer';

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

    // Ambil data user untuk cek peran
    const { data: userProfile } = await adminClient
      .from('users')
      .select('peran')
      .eq('id', user.id)
      .single();

    const userRole = userProfile?.peran || 'admin';

    // Ambil data penawaran lengkap
    const { data: penawaran, error: penErr } = await adminClient
      .from('penawaran')
      .select('*, leads!inner(nama, kota), price_books(data_json), users:created_by(nama)')
      .eq('id', id)
      .single();

    if (penErr || !penawaran) {
      return NextResponse.json({ error: 'Penawaran tidak ditemukan' }, { status: 404 });
    }

    // Otorisasi: Role Owner boleh lihat semua. Role Admin boleh lihat penawaran yang dibuatnya atau operasional
    if (userRole !== 'owner' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const isDownload =
      searchParams.get('download') === 'true' ||
      searchParams.get('mode') === 'download' ||
      searchParams.get('action') === 'download';

    const safeNumber = penawaran.nomor || 'PENAWARAN';
    const filename = `${safeNumber}.pdf`;
    const disposition = isDownload
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    let pdfBuffer: Buffer | null = null;

    // 1. Coba unduh dari private bucket Storage di server
    if (penawaran.pdf_path) {
      const { data: storageBlob, error: downloadErr } = await adminClient.storage
        .from('penawaran-pdf')
        .download(penawaran.pdf_path);

      if (!downloadErr && storageBlob) {
        const ab = await storageBlob.arrayBuffer();
        pdfBuffer = Buffer.from(ab);
      }
    }

    // 2. Jika file belum ada di storage, render ulang on-the-fly deterministik
    if (!pdfBuffer) {
      const priceBook = penawaran.price_books?.data_json || defaultPriceBookV1;
      const settings = await getCompanySettings();
      const qrDataUrl = await generateQrPngDataUrl(settings.maps_url);

      const items = penawaran.items_json || [];
      const ringkasan = penawaran.ringkasan_json || {};

      const kalkulasiObj = {
        items: items,
        total_unit: ringkasan.total_unit || 1,
        subtotal_cermin: ringkasan.subtotal_cermin || penawaran.total_nilai || 0,
        ongkir: ringkasan.ongkir || { list: 0, deal: 0, potongan: 0, status: 'ok', perlu_alasan: false, perlu_konfirmasi: false, dikonfirmasi_owner: false },
        pasang: ringkasan.pasang || { list: 0, deal: 0, potongan: 0, status: 'ok', batas_admin: 0, perlu_konfirmasi: false, dikonfirmasi_owner: false },
        total: penawaran.total_nilai || 0,
        dp_50: penawaran.dp_50 || Math.ceil((penawaran.total_nilai || 0) / 2000) * 1000,
        pelunasan: penawaran.pelunasan || (penawaran.total_nilai || 0) - (penawaran.dp_50 || 0),
        perlu_konfirmasi_owner: false,
        is_valid_untuk_pdf: true,
        errors: [],
      };

      const todayStr = new Date(penawaran.created_at || Date.now()).toLocaleDateString('id-ID');
      const validUntilStr = new Date(penawaran.valid_until || Date.now()).toLocaleDateString('id-ID');

      const pdfDoc = React.createElement(PenawaranDocument, {
        nomor: penawaran.nomor,
        tanggal: todayStr,
        berlakuSampai: validUntilStr,
        namaKlien: penawaran.leads?.nama || 'Klien Putra Glass',
        kotaKlien: penawaran.leads?.kota || 'Bandung',
        kalkulasi: kalkulasiObj,
        config: priceBook,
        settings,
        qrDataUrl,
        kanal: penawaran.kanal || 'whatsapp',
        namaAdmin: penawaran.users?.nama || 'Admin Putra Glass',
      });

      pdfBuffer = await renderToBuffer(pdfDoc as unknown as React.ReactElement<DocumentProps>);

      // Simpan ke storage untuk akses berikutnya
      const savePath = penawaran.pdf_path || `${penawaran.nomor}.pdf`;
      await adminClient.storage
        .from('penawaran-pdf')
        .upload(savePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

      if (!penawaran.pdf_path) {
        await adminClient
          .from('penawaran')
          .update({ pdf_path: savePath })
          .eq('id', id);
      }
    }
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error serving PDF via application domain:', message);
    return NextResponse.json({ error: 'Gagal memproses dokumen PDF' }, { status: 500 });
  }
}
