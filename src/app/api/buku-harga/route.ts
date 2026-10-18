import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { defaultPriceBookV1 } from '@/lib/pricing/default-price-book';
import { PriceBookData, PriceBookDataAdmin } from '@/types/pricing';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminClient = createAdminClient();

  // Ambil buku harga aktif
  const { data: activeRow } = await adminClient
    .from('price_books')
    .select('*')
    .eq('aktif', true)
    .single();

  const priceBook: PriceBookData = activeRow?.data_json || defaultPriceBookV1;

  // Cek peran user
  let userRole: 'owner' | 'admin' = 'admin';
  if (user) {
    const { data: userData } = await adminClient
      .from('users')
      .select('peran')
      .eq('id', user.id)
      .single();
    if (userData?.peran === 'owner') {
      userRole = 'owner';
    }
  }

  // Jika owner: kirim lengkap + data potongan minggu ini dari audit_log
  if (userRole === 'owner') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: potonganRows } = await adminClient
      .from('audit_log')
      .select('id, aktor, aksi, objek, sebelum, sesudah, alasan, created_at, users:aktor(nama, email)')
      .eq('aksi', 'KONFIRMASI_POTONGAN')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      role: 'owner',
      price_book: priceBook,
      potongan_minggu_ini: potonganRows || [],
    });
  }

  // Jika admin: BUANG batas_owner dan premium_b2b_net_owner demi keamanan
  const { premium_b2b_net_owner, ...safeTarifM2 } = priceBook.tarif_m2;

  const safeLogistik = {
    kirim_bandung: {
      list: priceBook.logistik.kirim_bandung.list,
    },
    kirim_luar_kota: {
      list: priceBook.logistik.kirim_luar_kota.list,
      skema_50_aktif: priceBook.logistik.kirim_luar_kota.skema_50_aktif,
    },
    pasang_bandung: {
      list: priceBook.logistik.pasang_bandung.list,
    },
    pasang_luar_kota: {
      list: priceBook.logistik.pasang_luar_kota.list,
    },
    kota_dalam_kota: priceBook.logistik.kota_dalam_kota,
  };

  const adminPriceBook: PriceBookDataAdmin = {
    ...priceBook,
    tarif_m2: safeTarifM2,
    logistik: safeLogistik,
  };

  return NextResponse.json({
    role: 'admin',
    price_book: adminPriceBook,
  });
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
      { error: 'Hanya admin yang boleh membuat/mengubah buku harga (owner bersifat read-only)' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { data_json, aktifkan_sekarang, catatan_perubahan } = body;

  // Dapatkan versi tertinggi saat ini
  const { data: latest } = await adminClient
    .from('price_books')
    .select('versi')
    .order('versi', { ascending: false })
    .limit(1)
    .single();

  const newVersi = (latest?.versi || 0) + 1;
  const newBookData: PriceBookData = {
    ...data_json,
    versi: newVersi,
    catatan_perubahan: catatan_perubahan || `Versi ${newVersi}`,
  };

  const { data: inserted, error: insertErr } = await adminClient
    .from('price_books')
    .insert({
      versi: newVersi,
      aktif: false,
      data_json: newBookData,
      dibuat_oleh: user.id,
    })
    .select()
    .single();

  if (insertErr) {
    console.error('[api/buku-harga]', insertErr.message);
    return NextResponse.json({ error: 'Terjadi kesalahan di server. Coba lagi sebentar lagi.' }, { status: 500 });
  }

  // Jika langsung diaktifkan, panggil fungsi activate_price_book dalam satu transaksi aman
  if (aktifkan_sekarang) {
    await adminClient.rpc('activate_price_book', { p_versi: newVersi });
    revalidateTag('price_book_active');
  }

  // Rekam ke audit_log dengan snapshot sebelum & sesudah
  const { data: previousActive } = await adminClient
    .from('price_books')
    .select('data_json')
    .eq('aktif', true)
    .single();

  await adminClient.from('audit_log').insert({
    aktor: user.id,
    aksi: 'CREATE_PRICE_BOOK',
    objek: `price_books:v${newVersi}`,
    sebelum: previousActive?.data_json || null,
    sesudah: newBookData,
    alasan: catatan_perubahan || 'Pembaruan buku harga oleh admin',
  });
  return NextResponse.json({ success: true, price_book: inserted });
}
