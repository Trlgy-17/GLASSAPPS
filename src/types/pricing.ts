/**
 * Tipe data & antarmuka untuk mesin harga (pricing engine) Putra Glass
 * Semua nilai uang adalah integer Rupiah (zero-float).
 * Semua ukuran dimensi fisik disimpan dalam milimeter integer (mm).
 */

export type UserRole = 'owner' | 'admin';
export type ClientSegment = 'B2C' | 'B2B';
export type VarianCermin = 'premium' | 'basic';
export type KontrolSku = 'touchscreen' | 'sensor' | 'baterai';
export type AddOnBasis = 'unit' | 'm2' | 'keliling';

export interface MasterBentuk {
  kode: string;
  label: string;
  boleh_aluminium: boolean;
}

export interface SkuKatalog {
  kode_sku: string;
  nama: string;
  bentuk_kode: string;
  panjang_mm: number;
  lebar_mm: number;
  sandblast: boolean;
  kontrol: KontrolSku;
  harga_tetap: number; // Integer Rupiah
}

export interface TingkatB2B {
  min_unit: number;
  max_unit: number | null;
  tarif_m2: number;
  wewenang: 'admin' | 'owner';
}

export interface AddOnConfig {
  label: string;
  harga: number; // Integer Rupiah
  basis: AddOnBasis;
}

export interface BatasLogistik {
  list: number;
  batas_admin: number;
  batas_owner?: number;
}

export interface PriceBookData {
  versi: number;
  aktif: boolean;
  catatan_perubahan?: string;

  tarif_m2: {
    premium_b2c: number;           // Rp1.750.000
    premium_b2b_list: number;      // Rp1.750.000
    premium_b2b_net_owner: number; // Rp1.350.000 (batas mutlak owner)
    basic_m2: number;              // Rp1.550.000
  };

  pembulatan: {
    cermin_kelipatan: number;      // Rp5.000
    dp_kelipatan: number;          // Rp1.000
    harga_minimum_custom: number;  // Rp650.000 (HANYA custom)
  };

  batas_produksi: {
    min_dimensi_mm: number;        // 150 mm (15 cm)
    max_dimensi_mm: number;        // 3000 mm (300 cm)
    sandblast_lebar_min_mm: number;// 20 mm (2 cm)
    sandblast_lebar_max_mm: number;// 50 mm (5 cm)
    sandblast_tepi_min_mm: number; // 10 mm (1 cm)
    sandblast_tepi_max_mm: number; // 50 mm (5 cm)
  };

  master_bentuk: MasterBentuk[];

  add_on: Record<string, AddOnConfig>;

  logistik: {
    kirim_bandung: BatasLogistik;
    kirim_luar_kota: BatasLogistik & { skema_50_aktif: boolean };
    pasang_bandung: BatasLogistik;
    pasang_luar_kota: BatasLogistik;
    kota_dalam_kota: string[];
  };

  tingkat_b2b: TingkatB2B[];

  sku_katalog: SkuKatalog[];

  dokumen_pdf: {
    masa_berlaku_hari: number;
    garansi_klaim_hari: number;
    garansi_fungsi_hari: number;
    bank_nama: string;
    bank_nomor: string;
    bank_atas_nama: string;
    kontak_wa_resmi: string;
    instagram_handle: string;
    nama_admin?: string;
    kebijakan_ongkir_50?: string;
    alamat_workshop?: string;
  };
}

/**
 * Filtered PriceBookData untuk peran Admin (batas owner dihapus demi keamanan)
 */
export type PriceBookDataAdmin = Omit<PriceBookData, 'tarif_m2' | 'logistik'> & {
  tarif_m2: Omit<PriceBookData['tarif_m2'], 'premium_b2b_net_owner'>;
  logistik: {
    kirim_bandung: Omit<BatasLogistik, 'batas_owner'>;
    kirim_luar_kota: Omit<BatasLogistik, 'batas_owner'> & { skema_50_aktif: boolean };
    pasang_bandung: Omit<BatasLogistik, 'batas_owner'>;
    pasang_luar_kota: Omit<BatasLogistik, 'batas_owner'>;
    kota_dalam_kota: string[];
  };
};

export interface CerminItemInput {
  id?: string;
  bentuk_kode: string;
  panjang_mm: number; // Integer milimeter
  lebar_mm: number;   // Integer milimeter
  lampu?: '3_warna' | '1_warna';
  kontrol?: 'touchscreen' | 'touchscreen_baterai' | 'sensor' | 'sensor_baterai' | 'saklar' | 'baterai';
  frame?: 'tanpa' | 'hpl' | 'aluminium';
  antifog?: boolean;
  sandblast?: {
    pakai: boolean;
    lebar_mm?: number;
    jarak_tepi_mm?: number;
  };
  add_ons_lain?: string[];
  qty: number;
}

export interface KonfirmasiOwner {
  sudah_dikonfirmasi: boolean;
  alasan: string;
}

export interface PenawaranInput {
  items: CerminItemInput[];
  zona: 'dalam_kota' | 'luar_kota';
  perlu_pasang: boolean;
  ongkir_deal?: number;
  pasang_deal?: number;
  segmen: ClientSegment;
  user_role?: UserRole;
  tarif_cermin_b2b_deal?: number;
  konfirmasi_owner?: {
    ongkir?: KonfirmasiOwner;
    pasang?: KonfirmasiOwner;
    cermin_b2b?: KonfirmasiOwner;
  };
}

export interface HitungItemOutput {
  is_sku: boolean;
  sku_kode?: string;
  varian: VarianCermin;
  panjang_mm: number;
  lebar_mm: number;
  luas_m2_display: number; // untuk tampilan/PDF (misal 0.48)
  tarif_m2_dipakai: number;
  harga_cermin_raw: number;
  harga_cermin: number; // setelah minimum jika custom
  add_on_breakdown: Array<{
    kode: string;
    label: string;
    harga_satuan: number;
    total: number;
  }>;
  harga_satuan_item: number;
  qty: number;
  subtotal_item: number;
  errors?: string[];
}

export interface HitungPenawaranOutput {
  items: HitungItemOutput[];
  total_unit: number;
  subtotal_cermin: number;
  ongkir: {
    list: number;
    deal: number;
    potongan: number;
    status: 'ok' | 'warning_kuning' | 'error_merah';
    pesan?: string;
    batas_admin: number;
    batas_floor?: number;
    batas_owner?: number;
    perlu_konfirmasi: boolean;
    dikonfirmasi_owner: boolean;
    alasan?: string;
  };
  pasang: {
    list: number;
    deal: number;
    potongan: number;
    status: 'ok' | 'warning_kuning' | 'error_merah';
    pesan?: string;
    batas_admin: number;
    batas_floor?: number;
    batas_owner?: number;
    perlu_konfirmasi: boolean;
    dikonfirmasi_owner: boolean;
    alasan?: string;
  };
  total: number;
  dp_50: number;
  pelunasan: number;
  perlu_konfirmasi_owner: boolean;
  is_valid_untuk_pdf: boolean;
  errors: string[];
}
