import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { deleteCachedPdf } from '@/lib/pdf/pdf-cache';
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Support session cookie or Bearer token
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

  // Cek peran user: OWNER DITOLAK
  const { data: userData } = await adminClient
    .from('users')
    .select('peran')
    .eq('id', user.id)
    .single();

  if (userData?.peran !== 'admin') {
    return NextResponse.json(
      { error: 'Hanya admin yang boleh mengubah status penawaran (owner bersifat read-only)' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { status, alasan_batal, deal_at, alasan_log, nilai_nego, catatan_nego, tipe_nego } = body;

  const validStatuses = ['draf', 'terkirim', 'nego', 'deal', 'lunas', 'batal', 'kadaluwarsa'];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Status penawaran tidak valid' }, { status: 400 });
  }

  // Validasi aturan khusus status
  if (status === 'deal' && !deal_at) {
    return NextResponse.json({ error: 'Status deal wajib menyertakan tanggal DP (deal_at)' }, { status: 400 });
  }

  const validAlasanBatal = [
    'harga',
    'ongkir',
    'lokasi',
    'waktu produksi',
    'menghilang',
    'pilih toko lain',
    'lainnya',
  ];

  if (status === 'batal') {
    if (!alasan_batal || !validAlasanBatal.includes(alasan_batal)) {
      return NextResponse.json(
        { error: 'Status batal wajib memilih alasan yang sah: ' + validAlasanBatal.join(', ') },
        { status: 400 }
      );
    }
  }

  // Ambil penawaran saat ini untuk mencatat 'dari'
  const { data: currentQuote, error: fetchErr } = await adminClient
    .from('penawaran')
    .select('status, terkirim_at, total_nilai, ringkasan_json, nomor')
    .eq('id', id)
    .single();

  if (fetchErr || !currentQuote) {
    return NextResponse.json({ error: 'Penawaran tidak ditemukan' }, { status: 404 });
  }

  const oldStatus = currentQuote.status;
  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'deal') {
    updatePayload.deal_at = deal_at || new Date().toISOString();
  }
  if (status === 'terkirim' && !currentQuote.terkirim_at) {
    updatePayload.terkirim_at = new Date().toISOString();
  }
  if (status === 'batal') {
    updatePayload.alasan_batal = alasan_batal;
  }
  if (status === 'nego' && typeof nilai_nego === 'number' && nilai_nego > 0) {
    const nilaiLama = Number(currentQuote.total_nilai || 0);
    const newDp50 = Math.ceil(nilai_nego / 2000) * 1000;
    const newPelunasan = nilai_nego - newDp50;
    const currentRingkasan = (currentQuote.ringkasan_json as Record<string, unknown>) || {};

    updatePayload.total_nilai = nilai_nego;
    updatePayload.ringkasan_json = {
      ...currentRingkasan,
      total: nilai_nego,
      dp_50: newDp50,
      pelunasan: newPelunasan,
      nego: {
        nilai_sebelum_nego: nilaiLama,
        nilai_nego,
        selisih: nilaiLama - nilai_nego,
        tipe_nego: tipe_nego || 'total',
        catatan_nego: catatan_nego || '',
        tanggal_nego: new Date().toISOString(),
      },
    };

    deleteCachedPdf(id);
    if (currentQuote.nomor) {
      deleteCachedPdf(currentQuote.nomor);
      await adminClient.storage.from('penawaran-pdf').remove([`${currentQuote.nomor}.pdf`]).catch(() => {});
    }
  }

  const { data: updated, error: updErr } = await adminClient
    .from('penawaran')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (updErr) {
    console.error('[api/penawaran/[id]/status]', updErr.message);
    return NextResponse.json({ error: 'Terjadi kesalahan di server. Coba lagi sebentar lagi.' }, { status: 500 });
  }

  // Catat ke penawaran_status_log
  await adminClient.from('penawaran_status_log').insert({
    penawaran_id: id,
    dari: oldStatus,
    ke: status,
    alasan:
      catatan_nego ||
      alasan_log ||
      (status === 'batal'
        ? `Batal: ${alasan_batal}`
        : status === 'nego'
        ? `Nego: ${nilai_nego ? `Penyesuaian nilai ke Rp${Number(nilai_nego).toLocaleString('id-ID')}` : 'Negosiasi klien'}`
        : `Perubahan status ke ${status}`),
    oleh: user.id,
  });

  if (oldStatus === 'deal' || oldStatus === 'lunas') {
    await adminClient.from('audit_log').insert({
      aktor: user.id,
      aksi: 'UBAH_STATUS_DARI_DEAL',
      objek: (updated as { nomor?: string })?.nomor || id,
      alasan: alasan_log || `Koreksi status dari ${oldStatus} ke ${status}`,
      sebelum: { status: oldStatus },
      sesudah: { status },
    });
  }

  return NextResponse.json({ success: true, penawaran: updated });
}
