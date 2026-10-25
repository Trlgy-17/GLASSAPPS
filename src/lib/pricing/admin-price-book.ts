import { PriceBookDataAdmin, SkuKatalog } from '@/types/pricing';

const STANDARD_SHAPES_30_40_50 = [
  'rectangle',
  'wide_rectangle',
  'capsule',
  'wide_capsule',
  'oval',
  'wide_oval',
  'leaf',
  'wide_leaf',
  'long_hex',
  'wide_long_hex',
];

const generatedSkus: SkuKatalog[] = [];

STANDARD_SHAPES_30_40_50.forEach((bentuk) => {
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-30x45-SB-TC`, nama: `${bentuk} 30×45 SB TC`, bentuk_kode: bentuk, panjang_mm: 450, lebar_mm: 300, sandblast: true, kontrol: 'touchscreen', harga_tetap: 570_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-SB-TC`, nama: `${bentuk} 40×60 SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: true, kontrol: 'touchscreen', harga_tetap: 650_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-SB-TC`, nama: `${bentuk} 50×80 SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: true, kontrol: 'touchscreen', harga_tetap: 765_000 },
    { kode_sku: `${bentuk.toUpperCase()}-30x45-SB-ST`, nama: `${bentuk} 30×45 SB ST`, bentuk_kode: bentuk, panjang_mm: 450, lebar_mm: 300, sandblast: true, kontrol: 'sensor', harga_tetap: 660_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-SB-ST`, nama: `${bentuk} 40×60 SB ST`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: true, kontrol: 'sensor', harga_tetap: 755_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-SB-ST`, nama: `${bentuk} 50×80 SB ST`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: true, kontrol: 'sensor', harga_tetap: 890_000 },
    { kode_sku: `${bentuk.toUpperCase()}-30x45-SB-BT`, nama: `${bentuk} 30×45 SB BT`, bentuk_kode: bentuk, panjang_mm: 450, lebar_mm: 300, sandblast: true, kontrol: 'baterai', harga_tetap: 750_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-SB-BT`, nama: `${bentuk} 40×60 SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: true, kontrol: 'baterai', harga_tetap: 850_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-SB-BT`, nama: `${bentuk} 50×80 SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: true, kontrol: 'baterai', harga_tetap: 950_000 },
    { kode_sku: `${bentuk.toUpperCase()}-30x45-NOSB-TC`, nama: `${bentuk} 30×45 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 450, lebar_mm: 300, sandblast: false, kontrol: 'touchscreen', harga_tetap: 530_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-NOSB-TC`, nama: `${bentuk} 40×60 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: false, kontrol: 'touchscreen', harga_tetap: 600_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-NOSB-TC`, nama: `${bentuk} 50×80 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: false, kontrol: 'touchscreen', harga_tetap: 700_000 },
    { kode_sku: `${bentuk.toUpperCase()}-30x45-NOSB-BT`, nama: `${bentuk} 30×45 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 450, lebar_mm: 300, sandblast: false, kontrol: 'baterai', harga_tetap: 720_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-NOSB-BT`, nama: `${bentuk} 40×60 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: false, kontrol: 'baterai', harga_tetap: 800_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-NOSB-BT`, nama: `${bentuk} 50×80 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: false, kontrol: 'baterai', harga_tetap: 900_000 }
  );
});

['round', 'round_leaf', 'hex'].forEach((bentuk) => {
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-D40-SB-TC`, nama: `${bentuk} D40 SB TC`, bentuk_kode: bentuk, panjang_mm: 400, lebar_mm: 400, sandblast: true, kontrol: 'touchscreen', harga_tetap: 550_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D60-SB-TC`, nama: `${bentuk} D60 SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 600, sandblast: true, kontrol: 'touchscreen', harga_tetap: 685_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D80-SB-TC`, nama: `${bentuk} D80 SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 800, sandblast: true, kontrol: 'touchscreen', harga_tetap: 860_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D40-SB-BT`, nama: `${bentuk} D40 SB BT`, bentuk_kode: bentuk, panjang_mm: 400, lebar_mm: 400, sandblast: true, kontrol: 'baterai', harga_tetap: 800_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D60-SB-BT`, nama: `${bentuk} D60 SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 600, sandblast: true, kontrol: 'baterai', harga_tetap: 900_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D80-SB-BT`, nama: `${bentuk} D80 SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 800, sandblast: true, kontrol: 'baterai', harga_tetap: 1_000_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D40-NOSB-TC`, nama: `${bentuk} D40 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 400, lebar_mm: 400, sandblast: false, kontrol: 'touchscreen', harga_tetap: 520_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D60-NOSB-TC`, nama: `${bentuk} D60 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 600, sandblast: false, kontrol: 'touchscreen', harga_tetap: 630_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D80-NOSB-TC`, nama: `${bentuk} D80 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 800, sandblast: false, kontrol: 'touchscreen', harga_tetap: 790_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D40-NOSB-BT`, nama: `${bentuk} D40 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 400, lebar_mm: 400, sandblast: false, kontrol: 'baterai', harga_tetap: 770_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D60-NOSB-BT`, nama: `${bentuk} D60 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 600, sandblast: false, kontrol: 'baterai', harga_tetap: 850_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D80-NOSB-BT`, nama: `${bentuk} D80 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 800, sandblast: false, kontrol: 'baterai', harga_tetap: 930_000 }
  );
});

['arch', 'half_arch_left', 'half_arch_right'].forEach((bentuk) => {
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-40x60-SB-TC`, nama: `${bentuk} 40×60 SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: true, kontrol: 'touchscreen', harga_tetap: 660_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-SB-TC`, nama: `${bentuk} 50×80 SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: true, kontrol: 'touchscreen', harga_tetap: 785_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-SB-BT`, nama: `${bentuk} 40×60 SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: true, kontrol: 'baterai', harga_tetap: 860_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-SB-BT`, nama: `${bentuk} 50×80 SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: true, kontrol: 'baterai', harga_tetap: 970_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-NOSB-TC`, nama: `${bentuk} 40×60 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: false, kontrol: 'touchscreen', harga_tetap: 610_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-NOSB-TC`, nama: `${bentuk} 50×80 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: false, kontrol: 'touchscreen', harga_tetap: 710_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-NOSB-BT`, nama: `${bentuk} 40×60 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: false, kontrol: 'baterai', harga_tetap: 810_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-NOSB-BT`, nama: `${bentuk} 50×80 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: false, kontrol: 'baterai', harga_tetap: 910_000 }
  );
});

export const defaultAdminPriceBookV1: PriceBookDataAdmin = {
  versi: 1,
  aktif: true,
  catatan_perubahan: 'Buku harga awal V1 (Admin Safe)',
  tarif_m2: {
    premium_b2c: 1_750_000,
    premium_b2b_list: 1_750_000,
    basic_m2: 1_550_000,
  },
  pembulatan: {
    cermin_kelipatan: 5_000,
    dp_kelipatan: 1_000,
    harga_minimum_custom: 650_000,
  },
  batas_produksi: {
    min_dimensi_mm: 150,
    max_dimensi_mm: 3000,
    sandblast_lebar_min_mm: 20,
    sandblast_lebar_max_mm: 50,
    sandblast_tepi_min_mm: 10,
    sandblast_tepi_max_mm: 50,
  },
  master_bentuk: [
    { kode: 'rectangle', label: 'Persegi / Kotak', boleh_aluminium: true },
    { kode: 'wide_rectangle', label: 'Persegi Lebar', boleh_aluminium: true },
    { kode: 'round', label: 'Bulat (Circle)', boleh_aluminium: false },
    { kode: 'arch', label: 'Arch (Kubah)', boleh_aluminium: false },
    { kode: 'half_arch_left', label: 'Half Arch Kiri', boleh_aluminium: false },
    { kode: 'half_arch_right', label: 'Half Arch Kanan', boleh_aluminium: false },
    { kode: 'capsule', label: 'Kapsul', boleh_aluminium: false },
    { kode: 'wide_capsule', label: 'Kapsul Lebar', boleh_aluminium: false },
    { kode: 'oval', label: 'Oval (Telur)', boleh_aluminium: false },
    { kode: 'wide_oval', label: 'Oval Lebar', boleh_aluminium: false },
    { kode: 'leaf', label: 'Daun (Leaf)', boleh_aluminium: false },
    { kode: 'wide_leaf', label: 'Daun Lebar', boleh_aluminium: false },
    { kode: 'hex', label: 'Hexagon (Segi Enam)', boleh_aluminium: false },
    { kode: 'long_hex', label: 'Long Hexagon', boleh_aluminium: false },
    { kode: 'wide_long_hex', label: 'Long Hexagon Lebar', boleh_aluminium: false },
    { kode: 'round_leaf', label: 'Round Leaf', boleh_aluminium: false },
    { kode: 'custom', label: 'Custom Bebas (Asimetris)', boleh_aluminium: false },
  ],
  add_on: {
    touchscreen_baterai: { label: 'Touchscreen + Modul Baterai Type-C', harga: 200_000, basis: 'unit' },
    sensor: { label: 'Sensor Gerak Tangan', harga: 150_000, basis: 'unit' },
    sensor_baterai: { label: 'Sensor Tangan + Modul Baterai Type-C', harga: 250_000, basis: 'unit' },
    antifog: { label: 'Antifog Pad', harga: 200_000, basis: 'unit' },
    frame_hpl: { label: 'Frame HPL', harga: 200_000, basis: 'unit' },
    frame_aluminium: { label: 'Frame Aluminium', harga: 400_000, basis: 'unit' },
  },
  logistik: {
    kirim_bandung: { list: 750_000 },
    kirim_luar_kota: { list: 1_300_000, skema_50_aktif: true },
    pasang_bandung: { list: 800_000 },
    pasang_luar_kota: { list: 1_300_000 },
    kota_dalam_kota: ['bandung', 'kota bandung', 'kabupaten bandung', 'kab. bandung', 'cimahi', 'bandung barat'],
    // SISTEM VOLUMETRIK ALA J&T CARGO (Wajib diisi & disesuaikan oleh Owner)
    tarif_per_kg_dalam_kota: 25_000,
    tarif_per_kg_luar_kota: 50_000,
    divisor_volumetrik: 5000,
    min_berat_kg: 1,
    persen_asuransi: 0.002,
  },
  tingkat_b2b: [],
  sku_katalog: generatedSkus,
  dokumen_pdf: {
    masa_berlaku_hari: 7,
    garansi_klaim_hari: 7,
    garansi_fungsi_hari: 90,
    bank_nama: '[belum diisi]',
    bank_nomor: '[belum diisi]',
    bank_atas_nama: '[belum diisi]',
    kontak_wa_resmi: '[belum diisi]',
    instagram_handle: '@putraglass.id',
    nama_admin: '[belum diisi]',
    kebijakan_ongkir_50: 'Ongkir bisa dibagi dua (klien bayar minimal 50%) hanya dengan konfirmasi owner. Jangan ditawarkan sendiri; isi perlu_owner jika klien meminta.',
  },
};
