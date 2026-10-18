import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { CompanySettings, DEFAULT_SETTINGS } from '@/types/settings';
import { getCompanySettings } from '@/lib/settings/get-settings';

export async function GET() {
  const settings = await getCompanySettings();
  return NextResponse.json({ settings });
}

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

  const { data: userData } = await adminClient
    .from('users')
    .select('peran')
    .eq('id', user.id)
    .single();

  if (userData?.peran !== 'admin') {
    return NextResponse.json(
      { error: 'Hanya admin yang boleh mengubah pengaturan (owner bersifat read-only)' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const {
    alamat_workshop,
    maps_url,
    bank,
    no_rekening,
    nama_rekening,
    whatsapp,
    instagram,
    tiktok,
    catatan_perubahan,
  } = body;

  // 1. Validasi maps_url harus diawali https://
  if (!maps_url || typeof maps_url !== 'string' || !maps_url.trim().startsWith('https://')) {
    return NextResponse.json(
      { error: 'maps_url harus diawali dengan https://' },
      { status: 400 }
    );
  }

  // 2. Validasi no_rekening hanya angka
  const cleanNoRek = String(no_rekening || '').trim().replace(/\s/g, '');
  if (!cleanNoRek || !/^\d+$/.test(cleanNoRek)) {
    return NextResponse.json(
      { error: 'no_rekening hanya boleh berisi angka' },
      { status: 400 }
    );
  }

  // 3. Validasi whatsapp format +62
  const trimmedWa = String(whatsapp || '').trim();
  if (!trimmedWa.startsWith('+62')) {
    return NextResponse.json(
      { error: 'Nomor WhatsApp harus diawali dengan format +62' },
      { status: 400 }
    );
  }
  const digitsOnly = trimmedWa.replace(/\D/g, '');
  if (digitsOnly.length < 9) {
    return NextResponse.json(
      { error: 'Nomor WhatsApp tidak valid (terlalu pendek)' },
      { status: 400 }
    );
  }

  // 4. Validasi field wajib lainnya
  if (!alamat_workshop?.trim()) {
    return NextResponse.json({ error: 'alamat_workshop wajib diisi' }, { status: 400 });
  }
  if (!bank?.trim()) {
    return NextResponse.json({ error: 'bank wajib diisi' }, { status: 400 });
  }
  if (!nama_rekening?.trim()) {
    return NextResponse.json({ error: 'nama_rekening wajib diisi' }, { status: 400 });
  }

  // Ambil pengaturan saat ini untuk audit_log
  const { data: currentSettings } = await adminClient
    .from('settings')
    .select('*')
    .eq('id', 'general')
    .single();

  const newSettings: CompanySettings = {
    id: 'general',
    alamat_workshop: alamat_workshop.trim(),
    maps_url: maps_url.trim(),
    bank: bank.trim(),
    no_rekening: cleanNoRek,
    nama_rekening: nama_rekening.trim(),
    whatsapp: trimmedWa,
    instagram: (instagram || '').trim().replace(/^@/, ''),
    tiktok: (tiktok || '').trim().replace(/^@/, ''),
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const { data: updated, error: upsertErr } = await adminClient
    .from('settings')
    .upsert(newSettings)
    .select()
    .single();

  if (upsertErr) {
    console.error('[api/settings]', upsertErr.message);
    return NextResponse.json({ error: 'Terjadi kesalahan di server. Coba lagi sebentar lagi.' }, { status: 500 });
  }

  revalidateTag('company_settings');

  // Catat perubahan di audit_log
  await adminClient.from('audit_log').insert({
    aktor: user.id,
    aksi: 'UPDATE_SETTINGS',
    objek: 'settings:general',
    sebelum: currentSettings || DEFAULT_SETTINGS,
    sesudah: newSettings,
    alasan: catatan_perubahan || 'Pembaruan data kontak, workshop, dan rekening oleh admin',
  });

  return NextResponse.json({ success: true, settings: updated });
}
