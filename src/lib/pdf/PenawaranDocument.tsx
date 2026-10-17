import 'server-only';
import React from 'react';
import { Document, Page, Text, View, Image, Link, StyleSheet } from '@react-pdf/renderer';
import { HitungPenawaranOutput, PriceBookData } from '@/types/pricing';
import { CompanySettings, DEFAULT_SETTINGS } from '@/types/settings';
import { registerFonts } from './fonts';
import { logoMarkBase64 } from './logo-base64';

registerFonts();

// Palet warna resmi Putra Glass
const COLORS = {
  navy: '#253254',
  navyDark: '#1C2742',
  blue: '#275087',
  steel: '#BFCBD9',
  grey: '#A6A6A6',
  ink: '#1B2233',
  muted: '#5F6879',
  faint: '#8D96A8',
  line: '#E3E7EE',
  tint: '#F3F6FA',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: {
    width: '100%',
    height: '100%',
    paddingTop: 20,
    paddingHorizontal: 28,
    paddingBottom: 112,
    fontSize: 8.2,
    fontFamily: 'PlusJakartaSans',
    color: COLORS.ink,
    backgroundColor: COLORS.white,
    position: 'relative',
  },
  // Garis 4 warna dekoratif
  stripe4Color: {
    height: 2.4,
    flexDirection: 'row',
    marginTop: 8,
    borderRadius: 1,
    overflow: 'hidden',
  },
  stripeNavy: { flex: 1, backgroundColor: COLORS.navy },
  stripeBlue: { flex: 1, backgroundColor: COLORS.blue },
  stripeSteel: { flex: 1, backgroundColor: COLORS.steel },
  stripeGrey: { flex: 1, backgroundColor: COLORS.grey },

  // Header Dokumen Halaman 1
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  logo: {
    width: 34,
    height: 34,
  },
  brandName: {
    fontSize: 15.5,
    fontWeight: 800,
    letterSpacing: 1.2,
    color: COLORS.blue,
    lineHeight: 1,
  },
  brandTag: {
    fontSize: 7.2,
    color: COLORS.muted,
    marginTop: 3.5,
    letterSpacing: 0.1,
  },
  docBox: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontSize: 21,
    fontWeight: 800,
    color: COLORS.navy,
    lineHeight: 1,
  },
  pillNoWrap: {
    marginTop: 4,
    backgroundColor: COLORS.tint,
    borderWidth: 0.8,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  pillNoText: {
    fontSize: 8.4,
    fontWeight: 700,
    color: COLORS.blue,
  },

  // Header Ringkas Halaman 2
  headerPage2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
  },
  headerPage2Text: {
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.navy,
  },

  // 3 Kartu Tint
  metaCardsRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 7,
  },
  metaCard: {
    flex: 1,
    backgroundColor: COLORS.tint,
    borderWidth: 0.8,
    borderColor: COLORS.line,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 7.5,
  },
  metaCardLabel: {
    fontSize: 6.3,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.faint,
  },
  metaCardValue: {
    marginTop: 2,
    fontSize: 8.6,
    fontWeight: 700,
    color: COLORS.ink,
  },
  metaCardSub: {
    marginTop: 1.5,
    fontSize: 7.2,
    color: COLORS.muted,
  },

  // Tabel Item
  table: {
    marginTop: 7,
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.4,
    borderBottomColor: COLORS.navy,
    paddingBottom: 4.5,
    alignItems: 'center',
  },
  colNum: {
    width: '6%',
  },
  colItem: {
    width: '52%',
  },
  colCalc: {
    width: '24%',
  },
  colAmt: {
    width: '18%',
    textAlign: 'right',
  },
  thLabel: {
    fontSize: 6.6,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.faint,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: COLORS.line,
    paddingVertical: 5.5,
    alignItems: 'flex-start',
  },
  itemTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    color: COLORS.ink,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 2.5,
  },
  chip: {
    backgroundColor: COLORS.tint,
    borderWidth: 0.6,
    borderColor: COLORS.line,
    borderRadius: 6,
    paddingVertical: 1,
    paddingHorizontal: 4.5,
    fontSize: 6.4,
    fontWeight: 600,
    color: COLORS.blue,
  },
  calcText: {
    fontSize: 7.8,
    color: COLORS.muted,
  },
  amtText: {
    fontSize: 8.6,
    fontWeight: 700,
    color: COLORS.ink,
    textAlign: 'right',
  },

  // Dua Kolom Ringkasan
  sumWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
    gap: 9,
  },
  leftColCard: {
    width: '46%',
    backgroundColor: COLORS.tint,
    borderWidth: 0.8,
    borderColor: COLORS.line,
    borderRadius: 6,
    padding: 7,
    alignSelf: 'flex-start',
  },
  payTitle: {
    fontSize: 6.4,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: COLORS.faint,
    textTransform: 'uppercase',
  },
  bankBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  bankBadge: {
    backgroundColor: COLORS.blue,
    color: COLORS.white,
    fontSize: 7,
    fontWeight: 800,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    borderRadius: 3,
  },
  bankRekening: {
    fontSize: 13,
    fontWeight: 800,
    color: COLORS.navy,
  },
  bankAn: {
    marginTop: 2,
    fontSize: 7.4,
    color: COLORS.muted,
  },
  payNote: {
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 0.8,
    borderTopColor: COLORS.line,
    fontSize: 7,
    color: COLORS.muted,
    lineHeight: 1.3,
  },

  rightColBox: {
    width: '51%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    fontSize: 7.9,
    color: COLORS.muted,
  },
  summaryRowBold: {
    color: COLORS.ink,
    fontWeight: 600,
  },
  totalRow: {
    marginTop: 3,
    paddingTop: 4.5,
    borderTopWidth: 1.4,
    borderTopColor: COLORS.navy,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: {
    fontWeight: 700,
    color: COLORS.navy,
    fontSize: 8.5,
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 800,
    color: COLORS.navy,
    letterSpacing: -0.2,
  },

  // Split DP & Pelunasan
  splitBox: {
    marginTop: 5,
    flexDirection: 'row',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 0.8,
    borderColor: COLORS.line,
  },
  splitDp: {
    flex: 1,
    backgroundColor: COLORS.navy,
    padding: 5.5,
  },
  splitLunas: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 5.5,
  },
  splitLabelDp: {
    fontSize: 6.4,
    fontWeight: 700,
    color: COLORS.steel,
  },
  splitLabelLunas: {
    fontSize: 6.4,
    fontWeight: 700,
    color: COLORS.faint,
  },
  splitValDp: {
    marginTop: 1.5,
    fontSize: 9.8,
    fontWeight: 800,
    color: COLORS.white,
  },
  splitValLunas: {
    marginTop: 1.5,
    fontSize: 9.8,
    fontWeight: 800,
    color: COLORS.navy,
  },
  splitSubDp: {
    marginTop: 1,
    fontSize: 6.3,
    color: COLORS.steel,
  },
  splitSubLunas: {
    marginTop: 1,
    fontSize: 6.3,
    color: COLORS.muted,
  },

  // Alur Pemesanan 4 Langkah
  processSection: {
    marginTop: 7,
  },
  sectionTitleLabel: {
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.faint,
  },
  timelineWrapper: {
    position: 'relative',
    marginTop: 5,
  },
  timelineLine: {
    position: 'absolute',
    left: 12,
    right: 20,
    top: 7,
    height: 1,
    backgroundColor: COLORS.steel,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItem: {
    width: '23%',
    paddingRight: 2,
  },
  dotActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInactive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.white,
    borderWidth: 1.2,
    borderColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotTextActive: {
    color: COLORS.white,
    fontSize: 6.8,
    fontWeight: 800,
  },
  dotTextInactive: {
    color: COLORS.navy,
    fontSize: 6.8,
    fontWeight: 800,
  },
  stepTitle: {
    marginTop: 3,
    fontSize: 7.6,
    fontWeight: 700,
    color: COLORS.ink,
  },
  stepDesc: {
    marginTop: 1,
    fontSize: 6.7,
    color: COLORS.muted,
    lineHeight: 1.25,
  },

  // 3 Kotak Garansi
  warrantyRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 7,
  },
  warrantyBox: {
    flex: 1,
    backgroundColor: COLORS.tint,
    borderWidth: 0.8,
    borderColor: COLORS.line,
    borderRadius: 5,
    padding: 5.5,
  },
  warrantyTitle: {
    fontSize: 7.4,
    fontWeight: 700,
    color: COLORS.navy,
  },
  warrantyDesc: {
    marginTop: 2,
    fontSize: 6.6,
    color: COLORS.muted,
    lineHeight: 1.25,
  },

  // Pita Bawah Navy Gelap (tinggi ±38 mm / 106 pt, menempel di dasar halaman)
  bottomBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 104,
    backgroundColor: COLORS.navyDark,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 28,
  },
  bottomBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  qrContainer: {
    width: 68,
    height: 68,
    backgroundColor: COLORS.white,
    borderRadius: 4,
    padding: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 65,
    height: 65,
  },
  workshopCol: {
    flex: 1,
  },
  bannerColTitle: {
    fontSize: 6.8,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: COLORS.steel,
    textTransform: 'uppercase',
  },
  workshopText: {
    fontSize: 6.8,
    color: COLORS.white,
    lineHeight: 1.25,
    marginTop: 2,
  },
  workshopSubText: {
    fontSize: 6.2,
    color: COLORS.faint,
    marginTop: 3,
  },
  contactCol: {
    width: '32%',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    fontSize: 6.7,
  },
  contactLabel: {
    color: COLORS.steel,
    width: 48,
    fontSize: 6.5,
  },
  contactLink: {
    color: COLORS.white,
    fontSize: 6.7,
    fontWeight: 600,
    textDecoration: 'none',
  },
  contactLinkSub: {
    color: COLORS.steel,
    fontSize: 6.7,
    textDecoration: 'none',
  },
  bannerFooterBar: {
    borderTopWidth: 0.6,
    borderTopColor: COLORS.blue,
    paddingTop: 3.5,
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerFooterText: {
    fontSize: 6.4,
    color: COLORS.steel,
  },
});

export interface PenawaranPdfProps {
  nomor: string;
  tanggal: string;
  berlakuSampai: string;
  namaKlien: string;
  kotaKlien: string;
  kalkulasi: HitungPenawaranOutput;
  config: PriceBookData;
  settings?: CompanySettings;
  qrDataUrl?: string;
  kanal?: string;
  namaAdmin?: string;
}

export const PenawaranDocument: React.FC<PenawaranPdfProps> = ({
  nomor,
  tanggal,
  berlakuSampai,
  namaKlien,
  kotaKlien,
  kalkulasi,
  config,
  settings: propSettings,
  qrDataUrl,
  kanal = 'whatsapp',
  namaAdmin,
}) => {
  const formatRp = (val: number) => `Rp${val.toLocaleString('id-ID')}`;

  // Ambil data settings kontak (fallback ke config.dokumen_pdf jika propSettings tidak ada)
  const settings: CompanySettings = propSettings || {
    alamat_workshop:
      config.dokumen_pdf.alamat_workshop ||
      DEFAULT_SETTINGS.alamat_workshop,
    maps_url: DEFAULT_SETTINGS.maps_url,
    bank: config.dokumen_pdf.bank_nama || DEFAULT_SETTINGS.bank,
    no_rekening: config.dokumen_pdf.bank_nomor || DEFAULT_SETTINGS.no_rekening,
    nama_rekening: config.dokumen_pdf.bank_atas_nama || DEFAULT_SETTINGS.nama_rekening,
    whatsapp: config.dokumen_pdf.kontak_wa_resmi || DEFAULT_SETTINGS.whatsapp,
    instagram: (config.dokumen_pdf.instagram_handle || DEFAULT_SETTINGS.instagram).replace(/^@/, ''),
    tiktok: DEFAULT_SETTINGS.tiktok,
  };

  const adminName =
    namaAdmin || config.dokumen_pdf.nama_admin || 'Admin Putra Glass';

  // Deteksi varian Marketplace (Shopee / TikTok)
  const isMarketplace =
    kanal.toLowerCase().includes('shopee') ||
    kanal.toLowerCase().includes('tiktok');

  // Bersihkan handle medsos dan buat link wa.me otomatis
  const cleanWaDigits = settings.whatsapp.replace(/\D/g, '');
  const waLink = `https://wa.me/${cleanWaDigits}`;
  const cleanIg = settings.instagram.replace(/^@/, '');
  const cleanTiktok = settings.tiktok.replace(/^@/, '');
  const shortMapsUrl = settings.maps_url.replace(/^https?:\/\//, '');

  // Flatten tabel item & add-on sesuai penawaran.html
  const tableRows: Array<{
    num: string;
    title: string;
    chips: string[];
    calc: string;
    amt: string;
  }> = [];

  let rowCounter = 1;

  kalkulasi.items.forEach((item) => {
    const pCm = item.panjang_mm / 10;
    const lCm = item.lebar_mm / 10;
    const bentukDef = config.master_bentuk.find(
      (b) =>
        b.kode.toLowerCase() ===
        (item.sku_kode?.split('-')[0]?.toLowerCase() || '')
    );
    const bentukLabel = item.is_sku
      ? `Cermin LED Katalog (${item.sku_kode}) · ${bentukDef?.label || 'Standar'} ${pCm} × ${lCm} cm`
      : `Cermin LED ${item.varian === 'premium' ? 'Premium' : 'Basic'} · ${pCm} × ${lCm} cm`;

    const cerminChips: string[] = [];
    if (item.is_sku) {
      if (item.sku_kode?.includes('-ST')) cerminChips.push('Sensor Tangan (ST)');
      else if (item.sku_kode?.includes('-BT')) cerminChips.push('Baterai Cas (BT)');
      else cerminChips.push('Touchscreen (TC)');
      if (item.sku_kode?.includes('-SB-')) cerminChips.push('Sandblast');
    } else {
      if (item.varian === 'premium') {
        cerminChips.push('LED 3 warna', 'Touchscreen');
      } else {
        cerminChips.push('LED 1 warna / Saklar');
      }
    }
    cerminChips.push('Bevel 10 mm', 'Kaca 5 mm');
    const numStr = String(rowCounter++).padStart(2, '0');
    tableRows.push({
      num: numStr,
      title: bentukLabel || `Cermin ${pCm} × ${lCm} cm`,
      chips: cerminChips,
      calc: item.is_sku
        ? `${item.qty} unit × ${formatRp(item.harga_cermin)}`
        : `${item.luas_m2_display.toString().replace('.', ',')} m² × ${formatRp(item.tarif_m2_dipakai)}`,
      amt: formatRp(item.harga_cermin * item.qty),
    });

    item.add_on_breakdown.forEach((addon) => {
      const addonNumStr = String(rowCounter++).padStart(2, '0');
      const addonChips: string[] = [];
      if (addon.kode === 'sensor_baterai' || addon.kode === 'sensor') {
        addonChips.push('Pengganti touchscreen kabel');
      }
      if (addon.kode.includes('baterai')) {
        addonChips.push('Cas Type-C');
      }
      if (addon.kode === 'antifog') {
        addonChips.push('Anti embun');
      }
      if (addon.kode === 'frame_hpl') {
        addonChips.push('Frame HPL');
      }
      if (addon.kode === 'frame_aluminium') {
        addonChips.push('Frame Aluminium');
      }

      tableRows.push({
        num: addonNumStr,
        title: addon.label,
        chips: addonChips,
        calc: `${item.qty} unit × ${formatRp(addon.harga_satuan)}`,
        amt: formatRp(addon.total * item.qty),
      });
    });
  });

  // Tentukan label dinamis ongkir sesuai jenis
  let ongkirLabel = 'Ongkos kirim (dalam kota Bandung)';
  if (kalkulasi.ongkir.deal === 0 || kalkulasi.ongkir.list === 0) {
    ongkirLabel = 'Ongkos kirim (ambil sendiri)';
  } else if (
    kalkulasi.ongkir.dikonfirmasi_owner ||
    (kalkulasi.ongkir.deal > 0 && kalkulasi.ongkir.deal <= Math.round(kalkulasi.ongkir.list / 2)) ||
    kalkulasi.ongkir.deal < kalkulasi.ongkir.list
  ) {
    ongkirLabel = 'Ongkos kirim (ongkir dibagi dua)';
  } else if (kalkulasi.ongkir.list > 750000) {
    ongkirLabel = 'Ongkos kirim (luar kota, packing kayu)';
  }

  // Tentukan apakah 1 halaman atau 2 halaman
  // Jika rows > 5, bagi ke 2 halaman agar tidak ada teks yang bertumpuk atau terpotong
  const isMultiPage = tableRows.length > 5;
  const page1Rows = isMultiPage ? tableRows.slice(0, 7) : tableRows;
  const page2Rows = isMultiPage ? tableRows.slice(7) : [];

  // Komponen Tabel
  const renderTable = (rows: typeof tableRows) => (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.thLabel, styles.colNum]}>#</Text>
        <Text style={[styles.thLabel, styles.colItem]}>ITEM &amp; SPESIFIKASI</Text>
        <Text style={[styles.thLabel, styles.colCalc]}>PERHITUNGAN</Text>
        <Text style={[styles.thLabel, styles.colAmt]}>JUMLAH</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={[styles.colNum, { color: COLORS.faint, fontWeight: 700 }]}>
            {r.num}
          </Text>
          <View style={styles.colItem}>
            <Text style={styles.itemTitle}>{r.title}</Text>
            {r.chips.length > 0 && (
              <View style={styles.chipsWrap}>
                {r.chips.map((c, cIdx) => (
                  <Text key={cIdx} style={styles.chip}>
                    {c}
                  </Text>
                ))}
              </View>
            )}
          </View>
          <Text style={[styles.colCalc, styles.calcText]}>{r.calc}</Text>
          <Text style={[styles.colAmt, styles.amtText]}>{r.amt}</Text>
        </View>
      ))}
    </View>
  );

  // Komponen Ringkasan, Alur, & Garansi
  const renderSummaryAndFooterContent = () => (
    <View>
      {/* Dua Kolom */}
      <View style={styles.sumWrap}>
        {/* Kolom Kiri: Transfer Bank atau Marketplace */}
        <View style={styles.leftColCard}>
          {isMarketplace ? (
            <View>
              <Text style={styles.payTitle}>PEMBAYARAN PESANAN</Text>
              <Text
                style={{
                  fontSize: 8.8,
                  fontWeight: 700,
                  color: COLORS.navy,
                  marginTop: 3,
                }}
              >
                Pembayaran melalui platform marketplace
              </Text>
              <Text
                style={{
                  fontSize: 7.2,
                  color: COLORS.muted,
                  marginTop: 3.5,
                  lineHeight: 1.3,
                }}
              >
                Seluruh transaksi dan pembayaran diproses resmi melalui platform marketplace terkait demi kenyamanan dan keamanan transaksi.
              </Text>
            </View>
          ) : (
            <View>
              <Text style={styles.payTitle}>TRANSFER PEMBAYARAN KE</Text>
              <View style={styles.bankBadgeRow}>
                <Text style={styles.bankBadge}>{settings.bank}</Text>
                <Text style={styles.bankRekening}>{settings.no_rekening}</Text>
              </View>
              <Text style={styles.bankAn}>a.n. {settings.nama_rekening}</Text>
              <Text style={styles.payNote}>
                Kirim bukti transfer DP ke WhatsApp {settings.whatsapp}. Pesanan masuk antrean produksi setelah DP diterima.
              </Text>
            </View>
          )}
        </View>

        {/* Kolom Kanan: Rincian Biaya */}
        <View style={styles.rightColBox}>
          <View style={styles.summaryRow}>
            <Text>Subtotal produksi</Text>
            <Text style={styles.summaryRowBold}>
              {formatRp(kalkulasi.subtotal_cermin)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>{ongkirLabel}</Text>
            <Text style={styles.summaryRowBold}>
              {formatRp(kalkulasi.ongkir.deal)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Jasa pemasangan</Text>
            <Text style={styles.summaryRowBold}>
              {kalkulasi.pasang.deal > 0
                ? formatRp(kalkulasi.pasang.deal)
                : 'Tidak termasuk'}
            </Text>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{formatRp(kalkulasi.total)}</Text>
          </View>

          {/* Kotak DP 50% & Pelunasan */}
          <View style={styles.splitBox}>
            <View style={styles.splitDp}>
              <Text style={styles.splitLabelDp}>DP 50%</Text>
              <Text style={styles.splitValDp}>{formatRp(kalkulasi.dp_50)}</Text>
              <Text style={styles.splitSubDp}>untuk mulai produksi</Text>
            </View>
            <View style={styles.splitLunas}>
              <Text style={styles.splitLabelLunas}>PELUNASAN</Text>
              <Text style={styles.splitValLunas}>
                {formatRp(kalkulasi.pelunasan)}
              </Text>
              <Text style={styles.splitSubLunas}>sebelum barang dikirim</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Alur Pemesanan 4 Langkah */}
      <View style={styles.processSection}>
        <Text style={styles.sectionTitleLabel}>ALUR PEMESANAN</Text>
        <View style={styles.timelineWrapper}>
          <View style={styles.timelineLine} />
          <View style={styles.stepsRow}>
            <View style={styles.stepItem}>
              <View style={styles.dotActive}>
                <Text style={styles.dotTextActive}>1</Text>
              </View>
              <Text style={styles.stepTitle}>DP 50%</Text>
              <Text style={styles.stepDesc}>Tanda jadi. Pesanan masuk produksi.</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.dotInactive}>
                <Text style={styles.dotTextInactive}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Produksi 1–5 hari</Text>
              <Text style={styles.stepDesc}>Foto &amp; video dikirim saat pengerjaan.</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.dotInactive}>
                <Text style={styles.dotTextInactive}>3</Text>
              </View>
              <Text style={styles.stepTitle}>Pelunasan &amp; kirim</Text>
              <Text style={styles.stepDesc}>Foto packing kayu, lunas, lalu resi.</Text>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.dotInactive}>
                <Text style={styles.dotTextInactive}>4</Text>
              </View>
              <Text style={styles.stepTitle}>Garansi 7 hari</Text>
              <Text style={styles.stepDesc}>Berlaku sejak barang sampai.</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 3 Kotak Garansi */}
      <View style={styles.warrantyRow}>
        <View style={styles.warrantyBox}>
          <Text style={styles.warrantyTitle}>Garansi pengiriman 7 hari</Text>
          <Text style={styles.warrantyDesc}>
            Pecah atau retak di perjalanan, atau tidak sesuai pesanan. Cermin diganti baru.
          </Text>
        </View>
        <View style={styles.warrantyBox}>
          <Text style={styles.warrantyTitle}>Garansi fungsi 3 bulan</Text>
          <Text style={styles.warrantyDesc}>
            LED dan touchscreen/sensor, berlaku diambil sendiri maupun dikirim.
          </Text>
        </View>
        <View style={styles.warrantyBox}>
          <Text style={styles.warrantyTitle}>Syarat klaim</Text>
          <Text style={styles.warrantyDesc}>
            • Video unboxing utuh tanpa potong{'\n'}• Foto resi pengiriman{'\n'}• Lapor maks. 7 hari setelah sampai
          </Text>
        </View>
      </View>
    </View>
  );

  // Pita Bawah Navy Gelap (tinggi ±38 mm / 104 pt, menempel di dasar halaman)
  const renderBottomBanner = (pageNumber: number, totalPages: number) => (
    <View style={styles.bottomBanner}>
      <View style={styles.bottomBannerContent}>
        {isMarketplace ? (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: 800, color: COLORS.white }}>
              Putra Glass Official Store
            </Text>
            <Text
              style={{
                fontSize: 7.2,
                color: COLORS.steel,
                marginTop: 2,
                lineHeight: 1.3,
              }}
            >
              Pesanan diproses resmi sesuai ketentuan marketplace terkait demi kenyamanan berbelanja.
            </Text>
          </View>
        ) : (
          <>
            {/* QR Code 23 mm di atas kotak putih */}
            <View style={styles.qrContainer}>
              {qrDataUrl ? (
                <Link src={settings.maps_url}>
                  <Image src={qrDataUrl} style={styles.qrImage} />
                </Link>
              ) : (
                <View
                  style={[
                    styles.qrImage,
                    {
                      backgroundColor: COLORS.tint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <Text style={{ fontSize: 6, color: COLORS.navy }}>QR MAPS</Text>
                </View>
              )}
            </View>

            {/* Alamat Workshop */}
            <View style={styles.workshopCol}>
              <Text style={styles.bannerColTitle}>WORKSHOP</Text>
              <Link
                src={settings.maps_url}
                style={{ textDecoration: 'none' }}
              >
                <Text style={styles.workshopText}>{settings.alamat_workshop}</Text>
              </Link>
              <Text style={styles.workshopSubText}>
                Scan QR di samping untuk petunjuk arah, atau buka:{' '}
                <Link
                  src={settings.maps_url}
                  style={{ color: COLORS.steel, textDecoration: 'none' }}
                >
                  {shortMapsUrl}
                </Link>
              </Text>
            </View>

            {/* Kontak Resmi */}
            <View style={styles.contactCol}>
              <Text style={styles.bannerColTitle}>HUBUNGI KAMI</Text>
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>WhatsApp</Text>
                <Link src={waLink} style={styles.contactLink}>
                  {settings.whatsapp}
                </Link>
              </View>
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>Instagram</Text>
                <Link
                  src={`https://instagram.com/${cleanIg}`}
                  style={styles.contactLinkSub}
                >
                  @{cleanIg}
                </Link>
              </View>
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>TikTok</Text>
                <Link
                  src={`https://tiktok.com/@${cleanTiktok}`}
                  style={styles.contactLinkSub}
                >
                  @{cleanTiktok}
                </Link>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Baris Paling Bawah: Admin & Masa Berlaku */}
      <View style={styles.bannerFooterBar}>
        <Text style={styles.bannerFooterText}>
          Disiapkan oleh {adminName} · Putra Glass
        </Text>
        <Text style={styles.bannerFooterText}>
          Penawaran berlaku hingga {berlakuSampai} · Hal. {pageNumber} / {totalPages}
        </Text>
      </View>
    </View>
  );

  return (
    <Document title={`Penawaran Putra Glass ${nomor}`}>
      {/* Halaman 1 */}
      <Page size="A4" style={styles.page}>
        {/* Header Dokumen Halaman 1 */}
        <View style={styles.header}>
          <View style={styles.brandBox}>
            <Image src={logoMarkBase64} style={styles.logo} />
            <View>
              <Text style={styles.brandName}>PUTRA GLASS</Text>
              <Text style={styles.brandTag}>
                Elegan Berkualitas dan Teruji · Cermin LED Custom, Bandung
              </Text>
            </View>
          </View>
          <View style={styles.docBox}>
            <Text style={styles.docTitle}>Penawaran Harga</Text>
            <View style={styles.pillNoWrap}>
              <Text style={styles.pillNoText}>{nomor}</Text>
            </View>
          </View>
        </View>

        {/* Garis 4 Warna */}
        <View style={styles.stripe4Color}>
          <View style={styles.stripeNavy} />
          <View style={styles.stripeBlue} />
          <View style={styles.stripeSteel} />
          <View style={styles.stripeGrey} />
        </View>

        {/* 3 Kartu Tint */}
        <View style={styles.metaCardsRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaCardLabel}>DITUJUKAN KEPADA</Text>
            <Text style={styles.metaCardValue}>{namaKlien || 'Klien Putra Glass'}</Text>
            <Text style={styles.metaCardSub}>
              {kotaKlien || 'Bandung'} ·{' '}
              {kalkulasi.ongkir.list > 750000 ? 'Luar kota' : 'Dalam kota'}
            </Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaCardLabel}>TANGGAL PENAWARAN</Text>
            <Text style={styles.metaCardValue}>{tanggal}</Text>
            <Text style={styles.metaCardSub}>Berlaku hingga {berlakuSampai}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaCardLabel}>ESTIMASI PRODUKSI</Text>
            <Text style={styles.metaCardValue}>1–5 hari kerja</Text>
            <Text style={styles.metaCardSub}>
              {kalkulasi.total_unit} unit · setelah DP diterima
            </Text>
          </View>
        </View>

        {/* Tabel Item (Halaman 1) */}
        {renderTable(page1Rows)}

        {/* Jika 1 Halaman: Langsung render ringkasan & pita bawah di sini */}
        {!isMultiPage && (
          <>
            {renderSummaryAndFooterContent()}
            {renderBottomBanner(1, 1)}
          </>
        )}

        {/* Jika Multi-Page: Footer halaman 1 */}
        {isMultiPage && (
          <View
            style={{
              position: 'absolute',
              bottom: 25,
              left: 28,
              right: 28,
              borderTopWidth: 0.8,
              borderTopColor: COLORS.line,
              paddingTop: 6,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 7, color: COLORS.muted }}>
              Penawaran berlanjut ke Halaman 2 · Disiapkan oleh {adminName}
            </Text>
            <Text style={{ fontSize: 7, color: COLORS.muted }}>Hal. 1 / 2</Text>
          </View>
        )}
      </Page>

      {/* Halaman 2 (Hanya jika multi-page) */}
      {isMultiPage && (
        <Page size="A4" style={styles.page}>
          {/* Header Ringkas Halaman 2 */}
          <View style={styles.headerPage2}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Image src={logoMarkBase64} style={{ width: 18, height: 18 }} />
              <Text style={styles.headerPage2Text}>PUTRA GLASS</Text>
            </View>
            <Text style={{ fontSize: 7.5, color: COLORS.muted }}>
              Lanjutan Penawaran · <Text style={{ fontWeight: 700, color: COLORS.navy }}>{nomor}</Text>
            </Text>
          </View>

          {/* Garis 4 Warna Tipis */}
          <View style={[styles.stripe4Color, { marginTop: 2, marginBottom: 6 }]}>
            <View style={styles.stripeNavy} />
            <View style={styles.stripeBlue} />
            <View style={styles.stripeSteel} />
            <View style={styles.stripeGrey} />
          </View>

          {/* Sisa Tabel Item (Halaman 2) */}
          {renderTable(page2Rows)}

          {/* Ringkasan, Alur, & Garansi */}
          {renderSummaryAndFooterContent()}

          {/* Pita Bawah Navy Gelap di Halaman Terakhir */}
          {renderBottomBanner(2, 2)}
        </Page>
      )}
    </Document>
  );
};
