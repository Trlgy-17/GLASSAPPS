import { PriceBookData, PriceBookDataAdmin, SkuKatalog } from '@/types/pricing';
// Generator helper untuk katalog SKU Putra Glass 2026
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

// 1. Standar 30x45, 40x60, 50x80 (Sandblast & No Sandblast)
STANDARD_SHAPES_30_40_50.forEach((bentuk) => {
  // Sandblast TC (570k / 650k / 765k)
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-30x45-SB-TC`, nama: `${bentuk} 30×45 SB TC`, bentuk_kode: bentuk, panjang_mm: 450, lebar_mm: 300, sandblast: true, kontrol: 'touchscreen', harga_tetap: 570_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-SB-TC`, nama: `${bentuk} 40×60 SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: true, kontrol: 'touchscreen', harga_tetap: 650_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-SB-TC`, nama: `${bentuk} 50×80 SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: true, kontrol: 'touchscreen', harga_tetap: 765_000 }
  );

  // Sandblast ST (660k / 755k / 890k)
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-30x45-SB-ST`, nama: `${bentuk} 30×45 SB ST`, bentuk_kode: bentuk, panjang_mm: 450, lebar_mm: 300, sandblast: true, kontrol: 'sensor', harga_tetap: 660_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-SB-ST`, nama: `${bentuk} 40×60 SB ST`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: true, kontrol: 'sensor', harga_tetap: 755_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-SB-ST`, nama: `${bentuk} 50×80 SB ST`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: true, kontrol: 'sensor', harga_tetap: 890_000 }
  );

  // Sandblast BT (750k / 850k / 950k)
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-30x45-SB-BT`, nama: `${bentuk} 30×45 SB BT`, bentuk_kode: bentuk, panjang_mm: 450, lebar_mm: 300, sandblast: true, kontrol: 'baterai', harga_tetap: 750_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-SB-BT`, nama: `${bentuk} 40×60 SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: true, kontrol: 'baterai', harga_tetap: 850_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-SB-BT`, nama: `${bentuk} 50×80 SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: true, kontrol: 'baterai', harga_tetap: 950_000 }
  );

  // No Sandblast (NS) TC (530k / 600k / 700k)
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-30x45-NOSB-TC`, nama: `${bentuk} 30×45 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 450, lebar_mm: 300, sandblast: false, kontrol: 'touchscreen', harga_tetap: 530_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-NOSB-TC`, nama: `${bentuk} 40×60 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: false, kontrol: 'touchscreen', harga_tetap: 600_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-NOSB-TC`, nama: `${bentuk} 50×80 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: false, kontrol: 'touchscreen', harga_tetap: 700_000 }
  );

  // No Sandblast (NS) BT (720k / 800k / 900k)
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-30x45-NOSB-BT`, nama: `${bentuk} 30×45 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 450, lebar_mm: 300, sandblast: false, kontrol: 'baterai', harga_tetap: 720_000 },
    { kode_sku: `${bentuk.toUpperCase()}-40x60-NOSB-BT`, nama: `${bentuk} 40×60 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 400, sandblast: false, kontrol: 'baterai', harga_tetap: 800_000 },
    { kode_sku: `${bentuk.toUpperCase()}-50x80-NOSB-BT`, nama: `${bentuk} 50×80 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 500, sandblast: false, kontrol: 'baterai', harga_tetap: 900_000 }
  );
});

// 2. Round, Round Leaf, Hex (Diameter 40, 60, 80 cm)
['round', 'round_leaf', 'hex'].forEach((bentuk) => {
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-D40-SB-TC`, nama: `${bentuk} D40 SB TC`, bentuk_kode: bentuk, panjang_mm: 400, lebar_mm: 400, sandblast: true, kontrol: 'touchscreen', harga_tetap: 550_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D60-SB-TC`, nama: `${bentuk} D60 SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 600, sandblast: true, kontrol: 'touchscreen', harga_tetap: 685_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D80-SB-TC`, nama: `${bentuk} D80 SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 800, sandblast: true, kontrol: 'touchscreen', harga_tetap: 860_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D40-SB-BT`, nama: `${bentuk} D40 SB BT`, bentuk_kode: bentuk, panjang_mm: 400, lebar_mm: 400, sandblast: true, kontrol: 'baterai', harga_tetap: 800_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D60-SB-BT`, nama: `${bentuk} D60 SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 600, sandblast: true, kontrol: 'baterai', harga_tetap: 890_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D80-SB-BT`, nama: `${bentuk} D80 SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 800, sandblast: true, kontrol: 'baterai', harga_tetap: 1_050_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D40-NOSB-TC`, nama: `${bentuk} D40 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 400, lebar_mm: 400, sandblast: false, kontrol: 'touchscreen', harga_tetap: 525_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D60-NOSB-TC`, nama: `${bentuk} D60 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 600, sandblast: false, kontrol: 'touchscreen', harga_tetap: 650_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D80-NOSB-TC`, nama: `${bentuk} D80 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 800, sandblast: false, kontrol: 'touchscreen', harga_tetap: 830_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D40-NOSB-BT`, nama: `${bentuk} D40 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 400, lebar_mm: 400, sandblast: false, kontrol: 'baterai', harga_tetap: 750_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D60-NOSB-BT`, nama: `${bentuk} D60 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 600, sandblast: false, kontrol: 'baterai', harga_tetap: 860_000 },
    { kode_sku: `${bentuk.toUpperCase()}-D80-NOSB-BT`, nama: `${bentuk} D80 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 800, sandblast: false, kontrol: 'baterai', harga_tetap: 1_025_000 }
  );
});

// 3. Blunt Square & Wide Blunt Square (70x50, 80x60)
['blunt_square', 'wide_blunt_square'].forEach((bentuk) => {
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-70x50-SB-TC`, nama: `${bentuk} 70×50 SB TC`, bentuk_kode: bentuk, panjang_mm: 700, lebar_mm: 500, sandblast: true, kontrol: 'touchscreen', harga_tetap: 750_000 },
    { kode_sku: `${bentuk.toUpperCase()}-80x60-SB-TC`, nama: `${bentuk} 80×60 SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 600, sandblast: true, kontrol: 'touchscreen', harga_tetap: 820_000 },
    { kode_sku: `${bentuk.toUpperCase()}-70x50-SB-BT`, nama: `${bentuk} 70×50 SB BT`, bentuk_kode: bentuk, panjang_mm: 700, lebar_mm: 500, sandblast: true, kontrol: 'baterai', harga_tetap: 900_000 },
    { kode_sku: `${bentuk.toUpperCase()}-80x60-SB-BT`, nama: `${bentuk} 80×60 SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 600, sandblast: true, kontrol: 'baterai', harga_tetap: 980_000 },
    { kode_sku: `${bentuk.toUpperCase()}-70x50-NOSB-TC`, nama: `${bentuk} 70×50 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 700, lebar_mm: 500, sandblast: false, kontrol: 'touchscreen', harga_tetap: 670_000 },
    { kode_sku: `${bentuk.toUpperCase()}-80x60-NOSB-TC`, nama: `${bentuk} 80×60 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 600, sandblast: false, kontrol: 'touchscreen', harga_tetap: 755_000 },
    { kode_sku: `${bentuk.toUpperCase()}-70x50-NOSB-BT`, nama: `${bentuk} 70×50 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 700, lebar_mm: 500, sandblast: false, kontrol: 'baterai', harga_tetap: 850_000 },
    { kode_sku: `${bentuk.toUpperCase()}-80x60-NOSB-BT`, nama: `${bentuk} 80×60 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 600, sandblast: false, kontrol: 'baterai', harga_tetap: 950_000 }
  );
});

// 4. Half Egg (60x50, 80x70)
generatedSkus.push(
  { kode_sku: 'HALF_EGG-60x50-SB-TC', nama: 'Half Egg 60×50 SB TC', bentuk_kode: 'half_egg', panjang_mm: 600, lebar_mm: 500, sandblast: true, kontrol: 'touchscreen', harga_tetap: 680_000 },
  { kode_sku: 'HALF_EGG-80x70-SB-TC', nama: 'Half Egg 80×70 SB TC', bentuk_kode: 'half_egg', panjang_mm: 800, lebar_mm: 700, sandblast: true, kontrol: 'touchscreen', harga_tetap: 830_000 },
  { kode_sku: 'HALF_EGG-60x50-SB-BT', nama: 'Half Egg 60×50 SB BT', bentuk_kode: 'half_egg', panjang_mm: 600, lebar_mm: 500, sandblast: true, kontrol: 'baterai', harga_tetap: 880_000 },
  { kode_sku: 'HALF_EGG-80x70-SB-BT', nama: 'Half Egg 80×70 SB BT', bentuk_kode: 'half_egg', panjang_mm: 800, lebar_mm: 700, sandblast: true, kontrol: 'baterai', harga_tetap: 1_030_000 },
  { kode_sku: 'HALF_EGG-60x50-NOSB-TC', nama: 'Half Egg 60×50 No-SB TC', bentuk_kode: 'half_egg', panjang_mm: 600, lebar_mm: 500, sandblast: false, kontrol: 'touchscreen', harga_tetap: 620_000 },
  { kode_sku: 'HALF_EGG-80x70-NOSB-TC', nama: 'Half Egg 80×70 No-SB TC', bentuk_kode: 'half_egg', panjang_mm: 800, lebar_mm: 700, sandblast: false, kontrol: 'touchscreen', harga_tetap: 800_000 },
  { kode_sku: 'HALF_EGG-60x50-NOSB-BT', nama: 'Half Egg 60×50 No-SB BT', bentuk_kode: 'half_egg', panjang_mm: 600, lebar_mm: 500, sandblast: false, kontrol: 'baterai', harga_tetap: 840_000 },
  { kode_sku: 'HALF_EGG-80x70-NOSB-BT', nama: 'Half Egg 80×70 No-SB BT', bentuk_kode: 'half_egg', panjang_mm: 800, lebar_mm: 700, sandblast: false, kontrol: 'baterai', harga_tetap: 1_000_000 }
);

// 5. Half Moon & Wide Half Moon (60x30, 80x40, 100x50)
['half_moon', 'wide_half_moon'].forEach((bentuk) => {
  generatedSkus.push(
    { kode_sku: `${bentuk.toUpperCase()}-60x30-SB-TC`, nama: `${bentuk} 60×30 SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 300, sandblast: true, kontrol: 'touchscreen', harga_tetap: 600_000 },
    { kode_sku: `${bentuk.toUpperCase()}-80x40-SB-TC`, nama: `${bentuk} 80×40 SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 400, sandblast: true, kontrol: 'touchscreen', harga_tetap: 700_000 },
    { kode_sku: `${bentuk.toUpperCase()}-100x50-SB-TC`, nama: `${bentuk} 100×50 SB TC`, bentuk_kode: bentuk, panjang_mm: 1000, lebar_mm: 500, sandblast: true, kontrol: 'touchscreen', harga_tetap: 900_000 },
    { kode_sku: `${bentuk.toUpperCase()}-60x30-SB-BT`, nama: `${bentuk} 60×30 SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 300, sandblast: true, kontrol: 'baterai', harga_tetap: 800_000 },
    { kode_sku: `${bentuk.toUpperCase()}-80x40-SB-BT`, nama: `${bentuk} 80×40 SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 400, sandblast: true, kontrol: 'baterai', harga_tetap: 880_000 },
    { kode_sku: `${bentuk.toUpperCase()}-100x50-SB-BT`, nama: `${bentuk} 100×50 SB BT`, bentuk_kode: bentuk, panjang_mm: 1000, lebar_mm: 500, sandblast: true, kontrol: 'baterai', harga_tetap: 1_080_000 },
    { kode_sku: `${bentuk.toUpperCase()}-60x30-NOSB-TC`, nama: `${bentuk} 60×30 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 300, sandblast: false, kontrol: 'touchscreen', harga_tetap: 550_000 },
    { kode_sku: `${bentuk.toUpperCase()}-80x40-NOSB-TC`, nama: `${bentuk} 80×40 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 400, sandblast: false, kontrol: 'touchscreen', harga_tetap: 650_000 },
    { kode_sku: `${bentuk.toUpperCase()}-100x50-NOSB-TC`, nama: `${bentuk} 100×50 No-SB TC`, bentuk_kode: bentuk, panjang_mm: 1000, lebar_mm: 500, sandblast: false, kontrol: 'touchscreen', harga_tetap: 880_000 },
    { kode_sku: `${bentuk.toUpperCase()}-60x30-NOSB-BT`, nama: `${bentuk} 60×30 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 600, lebar_mm: 300, sandblast: false, kontrol: 'baterai', harga_tetap: 750_000 },
    { kode_sku: `${bentuk.toUpperCase()}-80x40-NOSB-BT`, nama: `${bentuk} 80×40 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 800, lebar_mm: 400, sandblast: false, kontrol: 'baterai', harga_tetap: 850_000 },
    { kode_sku: `${bentuk.toUpperCase()}-100x50-NOSB-BT`, nama: `${bentuk} 100×50 No-SB BT`, bentuk_kode: bentuk, panjang_mm: 1000, lebar_mm: 500, sandblast: false, kontrol: 'baterai', harga_tetap: 1_050_000 }
  );
});

export const defaultPriceBookV1: PriceBookData = {
  versi: 1,
  aktif: true,
  catatan_perubahan: 'Buku harga awal V1 (Aturan Ongkir 50%)',

  tarif_m2: {
    premium_b2c: 1_750_000,
    touchscreen_baterai_m2: 1_850_000,
    premium_b2b_list: 1_750_000,
    premium_b2b_net_owner: 1_350_000,
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
    { kode: 'rectangle', label: 'Rectangle', boleh_aluminium: true },
    { kode: 'wide_rectangle', label: 'Wide Rectangle', boleh_aluminium: true },
    { kode: 'blunt_square', label: 'Blunt Square', boleh_aluminium: true },
    { kode: 'wide_blunt_square', label: 'Wide Blunt Square', boleh_aluminium: true },
    { kode: 'capsule', label: 'Capsule', boleh_aluminium: false },
    { kode: 'wide_capsule', label: 'Wide Capsule', boleh_aluminium: false },
    { kode: 'oval', label: 'Oval', boleh_aluminium: false },
    { kode: 'wide_oval', label: 'Wide Oval', boleh_aluminium: false },
    { kode: 'round', label: 'Round / Lingkaran', boleh_aluminium: false },
    { kode: 'half_moon', label: 'Half Moon', boleh_aluminium: false },
    { kode: 'wide_half_moon', label: 'Wide Half Moon', boleh_aluminium: false },
    { kode: 'half_egg', label: 'Half Egg', boleh_aluminium: false },
    { kode: 'leaf', label: 'Leaf', boleh_aluminium: false },
    { kode: 'wide_leaf', label: 'Wide Leaf', boleh_aluminium: false },
    { kode: 'round_leaf', label: 'Round Leaf', boleh_aluminium: false },
    { kode: 'hex', label: 'Hexagon', boleh_aluminium: false },
    { kode: 'long_hex', label: 'Long Hex', boleh_aluminium: false },
    { kode: 'wide_long_hex', label: 'Wide Long Hex', boleh_aluminium: false },
    { kode: 'custom', label: 'Custom Bebas', boleh_aluminium: false },
  ],

  add_on: {
    touchscreen_baterai: {
      label: 'Touchscreen + Baterai',
      harga: 150_000,
      basis: 'unit',
    },
    sensor: {
      label: 'Sensor Tangan',
      harga: 100_000,
      basis: 'unit',
    },
    sensor_baterai: {
      label: 'Sensor Tangan + Baterai',
      harga: 250_000,
      basis: 'unit',
    },
    antifog: {
      label: 'Antifog Pad',
      harga: 200_000,
      basis: 'unit',
    },
    frame_hpl: {
      label: 'Frame HPL',
      harga: 200_000,
      basis: 'unit',
    },
    frame_aluminium: {
      label: 'Frame Aluminium',
      harga: 400_000,
      basis: 'unit',
    },
  },

  logistik: {
    kirim_bandung: {
      list: 750_000,
      batas_admin: 500_000,
      batas_owner: 375_000, // Ongkir maks dibagi 2 (50%)
    },
    kirim_luar_kota: {
      list: 1_300_000,
      batas_admin: 1_150_000,
      batas_owner: 650_000, // Ongkir maks dibagi 2 (50%)
      skema_50_aktif: true,
    },
    pasang_bandung: {
      list: 800_000,
      batas_admin: 500_000,
      batas_owner: 300_000,
    },
    pasang_luar_kota: {
      list: 1_300_000,
      batas_admin: 1_000_000,
      batas_owner: 800_000,
    },
    kota_dalam_kota: [
      'bandung',
      'kota bandung',
      'kabupaten bandung',
      'kab. bandung',
      'cimahi',
      'bandung barat',
    ],
    // SISTEM VOLUMETRIK & TARIF J&T CARGO JAWA BARAT (FastTrack & MaxTrack)
    tarif_per_kg_dalam_kota: 2500, // Rp2.500/kg (J&T Cargo Jabar/Bandung Raya)
    tarif_per_kg_luar_kota: 3000,  // Rp3.000/kg (J&T Cargo FastTrack DKI Jakarta/Banten)
    divisor_volumetrik: 5000,      // Divisor standar volumetrik kargo (5000)
    min_berat_kg: 11,              // Berat minimal penagihan FastTrack (11 kg)
    persen_asuransi: 0.002,        // Premi asuransi 0.2% (0.002) dari nilai barang
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


