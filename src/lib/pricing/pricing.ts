import {
  PriceBookData,
  PriceBookDataAdmin,
  PenawaranInput,
  HitungPenawaranOutput,
  HitungItemOutput,
  CerminItemInput,
  VarianCermin,
  AddOnConfig,
} from '@/types/pricing';

/**
 * Mesin kalkulasi harga Putra Glass (Single Source of Truth)
 * - Zero-float: semua perhitungan uang berada di domain integer Rupiah
 * - Dimensi ukuran disimpan dalam integer milimeter (mm)
 * - Potongan hanya bisa melalui deal ongkir/pasang atau tingkat B2B (tanpa diskon bebas)
 */
export function hitungPenawaran(
  input: PenawaranInput,
  config: PriceBookData | PriceBookDataAdmin
): HitungPenawaranOutput {
  if (!input.items || input.items.length === 0) {
    throw new Error('Penawaran harus memiliki setidaknya satu item cermin');
  }

  // 1. Hitung total unit cermin dalam seluruh penawaran
  const totalUnit = input.items.reduce((acc, it) => {
    if (it.qty <= 0 || !Number.isInteger(it.qty)) {
      throw new Error(`Kuantitas item harus berupa bilangan bulat positif (diterima: ${it.qty})`);
    }
    return acc + it.qty;
  }, 0);

  // 2. Evaluasi setiap item cermin
  const itemsOutput: HitungItemOutput[] = input.items.map((item, index) =>
    hitungSingleItem(item, index, totalUnit, input, config)
  );

  const subtotalCermin = itemsOutput.reduce((acc, it) => acc + it.subtotal_item, 0);

  const errors: string[] = [];
  let isValidUntukPdf = true;

  // 3. Evaluasi Pengiriman (Ongkir)
  const isDalamKota = input.zona === 'dalam_kota';
  const batasKirim = isDalamKota
    ? config.logistik.kirim_bandung
    : config.logistik.kirim_luar_kota;
  const batasKirimFloor = Math.round(batasKirim.list * 0.5);

  const ongkirList = batasKirim.list;
  let ongkirDeal = input.ongkir_deal !== undefined ? input.ongkir_deal : ongkirList;
  const potonganOngkir = Math.max(0, ongkirList - ongkirDeal);

  let ongkirStatus: 'ok' | 'warning_kuning' | 'error_merah' = 'ok';
  let ongkirPesan: string | undefined;
  let ongkirPerluKonfirmasi = false;
  let ongkirDikonfirmasiOwner = false;
  let ongkirAlasan: string | undefined;

  if (ongkirDeal < batasKirimFloor) {
    ongkirStatus = 'error_merah';
    ongkirPesan = `Minimal Rp${batasKirimFloor.toLocaleString('id-ID')} (ongkir maks. dibagi 2)`;
    isValidUntukPdf = false;
    errors.push(`Ongkir deal (Rp${ongkirDeal.toLocaleString('id-ID')}) di bawah batas minimum (Rp${batasKirimFloor.toLocaleString('id-ID')})`);
  } else if (ongkirDeal < batasKirim.batas_admin) {
    const kf = input.konfirmasi_owner?.ongkir;
    if (kf?.sudah_dikonfirmasi && kf.alasan && kf.alasan.trim().length > 0) {
      ongkirStatus = 'ok';
      ongkirDikonfirmasiOwner = true;
      ongkirAlasan = kf.alasan.trim();
    } else {
      ongkirStatus = 'warning_kuning';
      ongkirPesan = 'Di bawah batas admin. Konfirmasi owner?';
      ongkirPerluKonfirmasi = true;
      isValidUntukPdf = false;
      errors.push(`Ongkir deal (Rp${ongkirDeal.toLocaleString('id-ID')}) di bawah batas admin dan memerlukan konfirmasi owner serta alasan wajib diisi`);
    }
  } else if (ongkirDeal === batasKirim.batas_admin && input.konfirmasi_owner?.ongkir?.sudah_dikonfirmasi) {
    ongkirDikonfirmasiOwner = true;
    ongkirAlasan = input.konfirmasi_owner.ongkir.alasan?.trim();
  }
  // 4. Evaluasi Pemasangan
  let pasangList = 0;
  let pasangDeal = 0;
  let potonganPasang = 0;
  let pasangStatus: 'ok' | 'warning_kuning' | 'error_merah' = 'ok';
  let pasangPesan: string | undefined;
  let pasangPerluKonfirmasi = false;
  let pasangDikonfirmasiOwner = false;
  let pasangAlasan: string | undefined;
  let batasPasangFloor = 0;

  if (input.perlu_pasang) {
    const batasPasang = isDalamKota
      ? config.logistik.pasang_bandung
      : config.logistik.pasang_luar_kota;

    pasangList = batasPasang.list;
    pasangDeal = input.pasang_deal !== undefined ? input.pasang_deal : pasangList;
    potonganPasang = Math.max(0, pasangList - pasangDeal);
    batasPasangFloor = isDalamKota ? 300000 : 800000;

    if (pasangDeal < batasPasangFloor) {
      pasangStatus = 'error_merah';
      pasangPesan = `Minimal Rp${batasPasangFloor.toLocaleString('id-ID')}`;
      isValidUntukPdf = false;
      errors.push(`Pasang deal (Rp${pasangDeal.toLocaleString('id-ID')}) di bawah batas minimum (Rp${batasPasangFloor.toLocaleString('id-ID')})`);
    } else if (pasangDeal < batasPasang.batas_admin) {
      const kf = input.konfirmasi_owner?.pasang;
      if (kf?.sudah_dikonfirmasi && kf.alasan && kf.alasan.trim().length > 0) {
        pasangStatus = 'ok';
        pasangDikonfirmasiOwner = true;
        pasangAlasan = kf.alasan.trim();
      } else {
        pasangStatus = 'warning_kuning';
        pasangPesan = 'Di bawah batas admin. Konfirmasi owner?';
        pasangPerluKonfirmasi = true;
        isValidUntukPdf = false;
        errors.push(`Pasang deal (Rp${pasangDeal.toLocaleString('id-ID')}) di bawah batas admin dan memerlukan konfirmasi owner serta alasan wajib diisi`);
      }
    } else if (pasangDeal === batasPasang.batas_admin && input.konfirmasi_owner?.pasang?.sudah_dikonfirmasi) {
      pasangDikonfirmasiOwner = true;
      pasangAlasan = input.konfirmasi_owner.pasang.alasan?.trim();
    }
  }

  // 5. Total Akhir, DP 50%, dan Pelunasan (Zero-Float)
  const total = subtotalCermin + ongkirDeal + pasangDeal;

  const kelipatanDp = config.pembulatan.dp_kelipatan; // 1000
  // Rumus DP: ceil(total / (2 * kelipatan_dp)) * kelipatan_dp
  const dp50 = Math.ceil(total / (2 * kelipatanDp)) * kelipatanDp;
  const pelunasan = total - dp50;

  return {
    items: itemsOutput,
    total_unit: totalUnit,
    subtotal_cermin: subtotalCermin,
    ongkir: {
      list: ongkirList,
      deal: ongkirDeal,
      potongan: potonganOngkir,
      status: ongkirStatus,
      pesan: ongkirPesan,
      batas_admin: batasKirim.batas_admin,
      batas_floor: batasKirimFloor,
      ...(typeof window === 'undefined' ? { batas_owner: batasKirimFloor } : {}),
      perlu_konfirmasi: ongkirPerluKonfirmasi,
      dikonfirmasi_owner: ongkirDikonfirmasiOwner,
      alasan: ongkirAlasan,
    },
    pasang: {
      list: pasangList,
      deal: pasangDeal,
      potongan: potonganPasang,
      status: pasangStatus,
      pesan: pasangPesan,
      batas_admin: input.perlu_pasang ? (isDalamKota ? config.logistik.pasang_bandung.batas_admin : config.logistik.pasang_luar_kota.batas_admin) : 0,
      batas_floor: input.perlu_pasang ? batasPasangFloor : 0,
      ...(typeof window === 'undefined' ? { batas_owner: input.perlu_pasang ? batasPasangFloor : 0 } : {}),
      perlu_konfirmasi: pasangPerluKonfirmasi,
      dikonfirmasi_owner: pasangDikonfirmasiOwner,
      alasan: pasangAlasan,
    },
    total,
    dp_50: dp50,
    pelunasan,
    perlu_konfirmasi_owner: ongkirPerluKonfirmasi || pasangPerluKonfirmasi,
    is_valid_untuk_pdf: isValidUntukPdf,
    errors,
  };
}

/**
 * Kalkulasi harga untuk 1 baris item cermin
 */
function hitungSingleItem(
  item: CerminItemInput,
  index: number,
  totalUnitInPenawaran: number,
  penawaranInput: PenawaranInput,
  config: PriceBookData | PriceBookDataAdmin
): HitungItemOutput {
  const segmen = penawaranInput.segmen;
  // Validasi Dimensi
  const { panjang_mm, lebar_mm } = item;
  if (!panjang_mm || !lebar_mm || panjang_mm <= 0 || lebar_mm <= 0) {
    throw new Error(
      `Item #${index + 1}: Ukuran panjang (${panjang_mm} mm) dan lebar (${lebar_mm} mm) harus lebih besar dari 0`
    );
  }

  if (
    panjang_mm < config.batas_produksi.min_dimensi_mm ||
    lebar_mm < config.batas_produksi.min_dimensi_mm
  ) {
    throw new Error(
      `Item #${index + 1}: Dimensi minimal produksi adalah ${config.batas_produksi.min_dimensi_mm} mm (${config.batas_produksi.min_dimensi_mm / 10} cm)`
    );
  }

  if (
    panjang_mm > config.batas_produksi.max_dimensi_mm ||
    lebar_mm > config.batas_produksi.max_dimensi_mm
  ) {
    throw new Error(
      `Item #${index + 1}: Dimensi maksimal produksi adalah ${config.batas_produksi.max_dimensi_mm} mm (${config.batas_produksi.max_dimensi_mm / 10} cm)`
    );
  }

  // Validasi Master Bentuk
  const shape = config.master_bentuk.find((b) => b.kode.toLowerCase() === item.bentuk_kode.toLowerCase());
  if (!shape) {
    throw new Error(`Item #${index + 1}: Bentuk '${item.bentuk_kode}' tidak terdaftar di master bentuk`);
  }

  // Validasi Frame Aluminium
  if (item.frame === 'aluminium' && !shape.boleh_aluminium) {
    throw new Error(
      `Item #${index + 1}: Frame aluminium hanya tersedia untuk bentuk persegi/persegi panjang bersudut siku, tidak tersedia untuk bentuk ${shape.label}`
    );
  }

  // Validasi Sandblast
  if (item.sandblast?.pakai) {
    if (item.sandblast.lebar_mm !== undefined) {
      if (
        item.sandblast.lebar_mm < config.batas_produksi.sandblast_lebar_min_mm ||
        item.sandblast.lebar_mm > config.batas_produksi.sandblast_lebar_max_mm
      ) {
        throw new Error(
          `Item #${index + 1}: Lebar sandblast (${item.sandblast.lebar_mm / 10} cm) harus berada dalam rentang ${config.batas_produksi.sandblast_lebar_min_mm / 10}–${config.batas_produksi.sandblast_lebar_max_mm / 10} cm`
        );
      }
    }
    if (item.sandblast.jarak_tepi_mm !== undefined) {
      if (
        item.sandblast.jarak_tepi_mm < config.batas_produksi.sandblast_tepi_min_mm ||
        item.sandblast.jarak_tepi_mm > config.batas_produksi.sandblast_tepi_max_mm
      ) {
        throw new Error(
          `Item #${index + 1}: Jarak tepi sandblast (${item.sandblast.jarak_tepi_mm / 10} cm) harus berada dalam rentang ${config.batas_produksi.sandblast_tepi_min_mm / 10}–${config.batas_produksi.sandblast_tepi_max_mm / 10} cm`
        );
      }
    }
  }

  // Penentuan Varian (Basic jika lampu 1 warna atau saklar)
  const varian: VarianCermin =
    item.lampu === '1_warna' || item.kontrol === 'saklar' ? 'basic' : 'premium';

  // Cek Pencocokan SKU Katalog
  const pakaiSandblast = Boolean(item.sandblast?.pakai);
  const matchedSku = config.sku_katalog.find((sku) => {
    if (sku.bentuk_kode.toLowerCase() !== item.bentuk_kode.toLowerCase()) return false;
    const dimensiCocok =
      (sku.panjang_mm === item.panjang_mm && sku.lebar_mm === item.lebar_mm) ||
      (sku.panjang_mm === item.lebar_mm && sku.lebar_mm === item.panjang_mm);
    if (!dimensiCocok) return false;
    if (sku.sandblast !== pakaiSandblast) return false;
    if (sku.kontrol === 'touchscreen') return !item.kontrol || item.kontrol === 'touchscreen';
    if (sku.kontrol === 'sensor') return item.kontrol === 'sensor';
    if (sku.kontrol === 'baterai') return item.kontrol === 'baterai' || item.kontrol === 'touchscreen_baterai';
    return false;
  });
  let isSku = false;
  let skuKode: string | undefined;
  let tarifM2Dipakai = 0;
  let hargaCerminRaw = 0;
  let hargaCermin = 0;

  if (matchedSku) {
    isSku = true;
    skuKode = matchedSku.kode_sku;
    hargaCermin = matchedSku.harga_tetap;
    hargaCerminRaw = matchedSku.harga_tetap;
    tarifM2Dipakai = 0;
  } else {
    // Mode Custom: Hitung per m2
    isSku = false;

    if (varian === 'basic') {
      tarifM2Dipakai = config.tarif_m2.basic_m2;
    } else {
      if (segmen === 'B2B') {
        if (penawaranInput.tarif_cermin_b2b_deal !== undefined) {
          const dealTarif = penawaranInput.tarif_cermin_b2b_deal;
          const netOwner =
            'premium_b2b_net_owner' in config.tarif_m2 &&
            typeof (config.tarif_m2 as Record<string, unknown>).premium_b2b_net_owner === 'number'
              ? ((config.tarif_m2 as Record<string, unknown>).premium_b2b_net_owner as number)
              : 0;
          if (netOwner > 0 && dealTarif < netOwner) {
            throw new Error(
              `Tarif cermin B2B (Rp${dealTarif.toLocaleString('id-ID')}) berada di bawah batas mutlak owner`
            );
          }
          if (dealTarif < config.tarif_m2.premium_b2b_list) {
            const kf = penawaranInput.konfirmasi_owner?.cermin_b2b;
            if (!kf?.sudah_dikonfirmasi || !kf?.alasan || kf.alasan.trim().length === 0) {
              throw new Error(
                `Tarif cermin B2B (Rp${dealTarif.toLocaleString('id-ID')}) di bawah harga list dan memerlukan konfirmasi owner serta alasan wajib diisi`
              );
            }
          }
          tarifM2Dipakai = dealTarif;
        } else {
          const matchingTier = config.tingkat_b2b?.find((t) =>
            t.max_unit === null
              ? totalUnitInPenawaran >= t.min_unit
              : totalUnitInPenawaran >= t.min_unit && totalUnitInPenawaran <= t.max_unit
          );
          tarifM2Dipakai = matchingTier ? matchingTier.tarif_m2 : config.tarif_m2.premium_b2b_list;
        }
      } else {
        tarifM2Dipakai = config.tarif_m2.premium_b2c;
      }
    }

    // Luas dalam mm2
    const luasMm2 = panjang_mm * lebar_mm;
    const kelipatanCermin = config.pembulatan.cermin_kelipatan; // 5000
    // Pembagi = 1.000.000 (konversi mm2 ke m2) * kelipatanCermin
    const pembagi = 1_000_000 * kelipatanCermin; // 5.000.000.000

    // ceil((panjang_mm * lebar_mm * tarif_m2) / 5.000.000.000) * 5.000
    hargaCerminRaw = Math.ceil((luasMm2 * tarifM2Dipakai) / pembagi) * kelipatanCermin;

    // Guardrail harga minimum (HANYA custom, tidak untuk SKU)
    hargaCermin = Math.max(hargaCerminRaw, config.pembulatan.harga_minimum_custom);
  }

  // Hitung Add-On
  const addOnBreakdown: HitungItemOutput['add_on_breakdown'] = [];

  // Kontrol Add-on
  if ((item.kontrol === 'touchscreen_baterai' || item.kontrol === 'baterai') && !isSku) {
    addOnBreakdown.push(resolveAddOn('touchscreen_baterai', panjang_mm, lebar_mm, config));
  } else if (item.kontrol === 'sensor') {
    // Bila SKU sudah meng-cover kontrol, jangan dobel
    if (!isSku) {
      addOnBreakdown.push(resolveAddOn('sensor', panjang_mm, lebar_mm, config));
    }
  } else if (item.kontrol === 'sensor_baterai') {
    addOnBreakdown.push(resolveAddOn('sensor_baterai', panjang_mm, lebar_mm, config));
  }

  // Antifog
  if (item.antifog) {
    addOnBreakdown.push(resolveAddOn('antifog', panjang_mm, lebar_mm, config));
  }

  // Frame
  if (item.frame === 'hpl') {
    addOnBreakdown.push(resolveAddOn('frame_hpl', panjang_mm, lebar_mm, config));
  } else if (item.frame === 'aluminium') {
    addOnBreakdown.push(resolveAddOn('frame_aluminium', panjang_mm, lebar_mm, config));
  }

  // Add-on Lainnya (mis. custom logo/gambar)
  if (item.add_ons_lain && item.add_ons_lain.length > 0) {
    for (const addonKey of item.add_ons_lain) {
      addOnBreakdown.push(resolveAddOn(addonKey, panjang_mm, lebar_mm, config));
    }
  }

  const totalAddonPerUnit = addOnBreakdown.reduce((acc, a) => acc + a.total, 0);
  const hargaSatuanItem = hargaCermin + totalAddonPerUnit;
  const subtotalItem = hargaSatuanItem * item.qty;

  const luasM2Display = Number(((panjang_mm * lebar_mm) / 1_000_000).toFixed(4));

  return {
    is_sku: isSku,
    sku_kode: skuKode,
    varian,
    panjang_mm,
    lebar_mm,
    luas_m2_display: luasM2Display,
    tarif_m2_dipakai: tarifM2Dipakai,
    harga_cermin_raw: hargaCerminRaw,
    harga_cermin: hargaCermin,
    add_on_breakdown: addOnBreakdown,
    harga_satuan_item: hargaSatuanItem,
    qty: item.qty,
    subtotal_item: subtotalItem,
  };
}


/**
 * Mengambil dan menghitung nilai add-on
 */
function resolveAddOn(
  addonKey: string,
  panjang_mm: number,
  lebar_mm: number,
  config: PriceBookData | PriceBookDataAdmin
) {
  const addonCfg: AddOnConfig | undefined = config.add_on[addonKey];
  if (!addonCfg) {
    throw new Error(
      `perlu_owner: Add-on '${addonKey}' tidak memiliki konfigurasi harga di buku harga`
    );
  }

  let total = 0;
  if (addonCfg.basis === 'unit') {
    total = addonCfg.harga;
  } else if (addonCfg.basis === 'm2') {
    const luasMm2 = panjang_mm * lebar_mm;
    total = Math.ceil((luasMm2 * addonCfg.harga) / 1_000_000);
  } else if (addonCfg.basis === 'keliling') {
    const kelilingMm = 2 * (panjang_mm + lebar_mm);
    total = Math.ceil((kelilingMm * addonCfg.harga) / 1_000);
  }

  return {
    kode: addonKey,
    label: addonCfg.label,
    harga_satuan: addonCfg.harga,
    total,
  };
}
