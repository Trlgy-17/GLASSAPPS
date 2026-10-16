import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { HitungPenawaranOutput, PriceBookData } from '@/types/pricing';
import { registerFonts } from './fonts';
import { logoMarkBase64 } from './logo-base64';

registerFonts();

const styles = StyleSheet.create({
  page: {
    width: '100%',
    height: '100%',
    paddingTop: 31,
    paddingHorizontal: 45,
    paddingBottom: 25,
    fontSize: 8.4,
    fontFamily: 'PlusJakartaSans',
    color: '#1B2233',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  stripeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6.2,
    flexDirection: 'row',
  },
  stripeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4.0,
    flexDirection: 'row',
  },
  stripeGrey: {
    flex: 1,
    backgroundColor: '#A6A6A6',
  },
  stripeNavy: {
    flex: 1,
    backgroundColor: '#253254',
  },
  stripeSteel: {
    flex: 1,
    backgroundColor: '#BFCBD9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 35,
    height: 35,
  },
  brandName: {
    fontSize: 15.5,
    fontWeight: 800,
    letterSpacing: 0.8,
    color: '#275087',
    lineHeight: 1,
  },
  brandTag: {
    fontSize: 7.2,
    color: '#6B7385',
    marginTop: 4,
    letterSpacing: 0.1,
  },
  docBox: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontSize: 19,
    fontWeight: 400,
    color: '#253254',
    lineHeight: 1,
  },
  docNo: {
    marginTop: 6,
    fontSize: 8.4,
    fontWeight: 700,
    color: '#275087',
  },
  label: {
    fontSize: 6.6,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#98A0B0',
  },
  metaBand: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E3E7EE',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E7EE',
    flexDirection: 'row',
  },
  metaCol1: {
    width: '40%',
    paddingVertical: 10,
    paddingRight: 12,
  },
  metaCol2: {
    width: '30%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#E3E7EE',
  },
  metaCol3: {
    width: '30%',
    paddingVertical: 10,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#E3E7EE',
  },
  metaValue: {
    marginTop: 3,
    fontWeight: 600,
    fontSize: 9,
    color: '#1B2233',
  },
  metaSub: {
    marginTop: 2,
    fontSize: 7.8,
    color: '#6B7385',
  },
  table: {
    marginTop: 18,
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.4,
    borderBottomColor: '#253254',
    paddingBottom: 6,
  },
  colNum: {
    width: '6%',
  },
  colItem: {
    width: '54%',
  },
  colCalc: {
    width: '22%',
  },
  colAmt: {
    width: '18%',
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E7EE',
    paddingVertical: 9,
    alignItems: 'flex-start',
  },
  itemTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: '#1B2233',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  chip: {
    backgroundColor: '#F2F5F9',
    borderRadius: 8,
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    fontSize: 6.8,
    fontWeight: 500,
    color: '#3B4560',
  },
  calcText: {
    fontSize: 8.4,
    color: '#6B7385',
  },
  amtText: {
    fontSize: 9,
    fontWeight: 700,
    color: '#1B2233',
    textAlign: 'right',
  },
  sumWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  payBox: {
    width: '45%',
    backgroundColor: '#F2F5F9',
    borderRadius: 8,
    padding: 12,
    alignSelf: 'flex-start',
  },
  bankText: {
    marginTop: 5,
    fontSize: 9.4,
    fontWeight: 700,
    color: '#253254',
  },
  anText: {
    marginTop: 2,
    fontSize: 7.8,
    color: '#6B7385',
  },
  payNote: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8EEF5',
    fontSize: 7.4,
    color: '#6B7385',
    lineHeight: 1.35,
  },
  rowsBox: {
    width: '51%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    fontSize: 8.4,
    color: '#6B7385',
  },
  summaryRowBold: {
    color: '#1B2233',
    fontWeight: 600,
  },
  totalRow: {
    marginTop: 5,
    paddingTop: 7,
    borderTopWidth: 1.4,
    borderTopColor: '#253254',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: {
    fontWeight: 700,
    color: '#253254',
    fontSize: 8.4,
    letterSpacing: 0.4,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: 800,
    color: '#253254',
    letterSpacing: -0.2,
  },
  splitBox: {
    marginTop: 9,
    flexDirection: 'row',
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E3E7EE',
  },
  splitDp: {
    width: '50%',
    backgroundColor: '#253254',
    padding: 8,
  },
  splitLunas: {
    width: '50%',
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  splitValDp: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: 800,
    color: '#FFFFFF',
  },
  splitValLunas: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: 800,
    color: '#253254',
  },
  splitSubDp: {
    marginTop: 2,
    fontSize: 6.9,
    color: '#BFCBD9',
  },
  splitSubLunas: {
    marginTop: 2,
    fontSize: 6.9,
    color: '#6B7385',
  },
  processSection: {
    marginTop: 18,
  },
  timelineWrapper: {
    position: 'relative',
    marginTop: 8,
  },
  timelineLine: {
    position: 'absolute',
    left: 12,
    right: 20,
    top: 9,
    height: 1,
    backgroundColor: '#BFCBD9',
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItem: {
    width: '23%',
    paddingRight: 4,
  },
  dotActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#253254',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInactive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.4,
    borderColor: '#253254',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotTextActive: {
    color: '#FFFFFF',
    fontSize: 7.6,
    fontWeight: 800,
  },
  dotTextInactive: {
    color: '#253254',
    fontSize: 7.6,
    fontWeight: 800,
  },
  stepTitle: {
    marginTop: 6,
    fontSize: 8.4,
    fontWeight: 700,
    color: '#1B2233',
  },
  stepDesc: {
    marginTop: 2,
    fontSize: 7.3,
    color: '#6B7385',
    lineHeight: 1.35,
  },
  warrantyBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E3E7EE',
    borderLeftWidth: 4,
    borderLeftColor: '#275087',
    borderRadius: 7,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  warrantyLeft: {
    width: '60%',
  },
  warrantyTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: '#253254',
  },
  warrantyDesc: {
    marginTop: 3,
    fontSize: 7.5,
    color: '#6B7385',
    lineHeight: 1.35,
  },
  warrantyRight: {
    width: '38%',
    gap: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F5F9',
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  pillBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#275087',
    marginRight: 5,
  },
  pillText: {
    fontSize: 7.2,
    fontWeight: 600,
    color: '#3B4560',
  },
  footer: {
    position: 'absolute',
    left: 45,
    right: 45,
    bottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#E3E7EE',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    fontSize: 7.2,
    color: '#6B7385',
  },
  footerBold: {
    fontWeight: 700,
    color: '#1B2233',
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
}

export const PenawaranDocument: React.FC<PenawaranPdfProps> = ({
  nomor,
  tanggal,
  berlakuSampai,
  namaKlien,
  kotaKlien,
  kalkulasi,
  config,
}) => {
  // Format mata uang: Rp1.750.000 (tanpa spasi)
  const formatRp = (val: number) => `Rp${val.toLocaleString('id-ID')}`;

  // Ambil data rekening & kontak dari dokumen_pdf di buku harga
  const docPdf = config.dokumen_pdf || {
    bank_nama: '[belum diisi]',
    bank_nomor: '[belum diisi]',
    bank_atas_nama: '[belum diisi]',
    kontak_wa_resmi: '[belum diisi]',
    instagram_handle: '@putraglass.id',
    nama_admin: '[belum diisi]',
    garansi_klaim_hari: 7,
  };

  // Flatten tabel item & add-on sesuai penawaran.html
  // Baris pertama: cermin, baris selanjutnya: add-on per unit
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
    const bentukLabel = item.is_sku
      ? item.sku_kode
      : `Cermin LED ${item.varian === 'premium' ? 'Premium' : 'Basic'} · ${pCm} × ${lCm} cm`;

    // Chips default spesifikasi cermin
    const cerminChips: string[] = [];
    if (item.varian === 'premium') {
      cerminChips.push('LED 3 warna', 'Touchscreen');
    } else {
      cerminChips.push('LED 1 warna / Saklar');
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

    // Baris terpisah untuk add-on
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
        addonChips.push('Tidak berembun setelah mandi');
      }
      if (addon.kode === 'frame_hpl') {
        addonChips.push('Finishing HPL elegan');
      }
      if (addon.kode === 'frame_aluminium') {
        addonChips.push('Frame aluminium kokoh');
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

  return (
    <Document title={`Penawaran Putra Glass ${nomor}`}>
      <Page size="A4" style={styles.page}>
        {/* Garis Hiasan Atas */}
        <View style={styles.stripeTop} fixed>
          <View style={styles.stripeGrey} />
          <View style={styles.stripeNavy} />
          <View style={styles.stripeSteel} />
        </View>

        {/* Header Dokumen */}
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
            <Text style={styles.docNo}>{nomor}</Text>
          </View>
        </View>

        {/* Meta Band (3 Kolom) */}
        <View style={styles.metaBand}>
          <View style={styles.metaCol1}>
            <Text style={styles.label}>DITUJUKAN KEPADA</Text>
            <Text style={styles.metaValue}>{namaKlien || 'Klien Putra Glass'}</Text>
            <Text style={styles.metaSub}>
              {kotaKlien || 'Bandung'} · {kalkulasi.ongkir.list > 750000 ? 'Luar kota' : 'Dalam kota'}
            </Text>
          </View>
          <View style={styles.metaCol2}>
            <Text style={styles.label}>TANGGAL</Text>
            <Text style={styles.metaValue}>{tanggal}</Text>
            <Text style={styles.metaSub}>Berlaku hingga {berlakuSampai}</Text>
          </View>
          <View style={styles.metaCol3}>
            <Text style={styles.label}>PRODUKSI</Text>
            <Text style={styles.metaValue}>1–5 hari kerja</Text>
            <Text style={styles.metaSub}>
              {kalkulasi.total_unit} unit · setelah DP diterima
            </Text>
          </View>
        </View>

        {/* Tabel Item & Spesifikasi */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.label, styles.colNum]}>#</Text>
            <Text style={[styles.label, styles.colItem]}>ITEM &amp; SPESIFIKASI</Text>
            <Text style={[styles.label, styles.colCalc]}>PERHITUNGAN</Text>
            <Text style={[styles.label, styles.colAmt]}>JUMLAH</Text>
          </View>

          {tableRows.map((r, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.colNum, { color: '#98A0B0', fontWeight: 600 }]}>{r.num}</Text>
              <View style={styles.colItem}>
                <Text style={styles.itemTitle}>{r.title}</Text>
                {r.chips.length > 0 && (
                  <View style={styles.chipsWrap}>
                    {r.chips.map((c, cIdx) => (
                      <Text key={cIdx} style={styles.chip}>{c}</Text>
                    ))}
                  </View>
                )}
              </View>
              <Text style={[styles.colCalc, styles.calcText]}>{r.calc}</Text>
              <Text style={[styles.colAmt, styles.amtText]}>{r.amt}</Text>
            </View>
          ))}
        </View>

        {/* Ringkasan Biaya & Pembayaran */}
        <View style={styles.sumWrap}>
          {/* Kotak Rekening Kiri */}
          <View style={styles.payBox}>
            <Text style={styles.label}>PEMBAYARAN KE</Text>
            <Text style={styles.bankText}>
              {docPdf.bank_nama} · {docPdf.bank_nomor}
            </Text>
            <Text style={styles.anText}>a.n. {docPdf.bank_atas_nama}</Text>
            <Text style={styles.payNote}>
              Kirim bukti transfer DP ke WhatsApp {docPdf.kontak_wa_resmi}. Pesanan masuk antrean produksi setelah DP diterima.
            </Text>
          </View>

          {/* Kolom Angka Kanan */}
          <View style={styles.rowsBox}>
            <View style={styles.summaryRow}>
              <Text>Subtotal produksi</Text>
              <Text style={styles.summaryRowBold}>{formatRp(kalkulasi.subtotal_cermin)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>
                Ongkos kirim · {kalkulasi.ongkir.list > 750000 ? 'luar kota, packing kayu' : 'dalam kota Bandung'}
              </Text>
              <Text style={styles.summaryRowBold}>{formatRp(kalkulasi.ongkir.deal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>Jasa pemasangan</Text>
              <Text style={styles.summaryRowBold}>
                {kalkulasi.pasang.deal > 0 ? formatRp(kalkulasi.pasang.deal) : 'Tidak termasuk'}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>{formatRp(kalkulasi.total)}</Text>
            </View>

            {/* Split DP & Pelunasan */}
            <View style={styles.splitBox}>
              <View style={styles.splitDp}>
                <Text style={[styles.label, { color: '#BFCBD9' }]}>DP 50%</Text>
                <Text style={styles.splitValDp}>{formatRp(kalkulasi.dp_50)}</Text>
                <Text style={styles.splitSubDp}>untuk mulai produksi</Text>
              </View>
              <View style={styles.splitLunas}>
                <Text style={styles.label}>PELUNASAN</Text>
                <Text style={styles.splitValLunas}>{formatRp(kalkulasi.pelunasan)}</Text>
                <Text style={styles.splitSubLunas}>sebelum barang dikirim</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Alur Pemesanan 4 Langkah */}
        <View style={styles.processSection}>
          <Text style={styles.label}>ALUR PEMESANAN</Text>
          <View style={styles.timelineWrapper}>
            <View style={styles.timelineLine} />
            <View style={styles.stepsRow}>
              <View style={styles.stepItem}>
                <View style={styles.dotActive}>
                  <Text style={styles.dotTextActive}>1</Text>
                </View>
                <Text style={styles.stepTitle}>DP 50%</Text>
                <Text style={styles.stepDesc}>Tanda jadi. Pesanan masuk antrean produksi.</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.dotInactive}>
                  <Text style={styles.dotTextInactive}>2</Text>
                </View>
                <Text style={styles.stepTitle}>Produksi 1–5 hari</Text>
                <Text style={styles.stepDesc}>Foto &amp; video dikirim saat cermin dikerjakan.</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.dotInactive}>
                  <Text style={styles.dotTextInactive}>3</Text>
                </View>
                <Text style={styles.stepTitle}>Pelunasan &amp; kirim</Text>
                <Text style={styles.stepDesc}>Foto produk + packing kayu, lunas, lalu foto resi.</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.dotInactive}>
                  <Text style={styles.dotTextInactive}>4</Text>
                </View>
                <Text style={styles.stepTitle}>Garansi {docPdf.garansi_klaim_hari || 7} hari</Text>
                <Text style={styles.stepDesc}>Berlaku sejak barang sampai.</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Kotak Garansi */}
        <View style={styles.warrantyBox}>
          <View style={styles.warrantyLeft}>
            <Text style={styles.warrantyTitle}>
              Garansi 7 hari pecah/tidak sesuai · fungsi LED &amp; touchscreen 3 bulan
            </Text>
            <Text style={styles.warrantyDesc}>
              Untuk cermin pecah/retak di perjalanan, LED atau touchscreen mati, dan produk tidak sesuai pesanan. Ongkir ditanggung pembeli.
            </Text>
          </View>
          <View style={styles.warrantyRight}>
            <View style={styles.pill}>
              <View style={styles.pillBullet} />
              <Text style={styles.pillText}>Video unboxing utuh tanpa potong</Text>
            </View>
            <View style={styles.pill}>
              <View style={styles.pillBullet} />
              <Text style={styles.pillText}>Foto resi pengiriman</Text>
            </View>
            <View style={styles.pill}>
              <View style={styles.pillBullet} />
              <Text style={styles.pillText}>Lapor maks. {docPdf.garansi_klaim_hari || 7} hari setelah sampai</Text>
            </View>
          </View>
        </View>

        {/* Footer Dokumen */}
        <View style={styles.footer} fixed>
          <View>
            <Text>
              <Text style={styles.footerBold}>Putra Glass</Text> · Bandung · IG {docPdf.instagram_handle} · WA {docPdf.kontak_wa_resmi}
            </Text>
            <Text style={{ marginTop: 2 }}>
              Disiapkan oleh <Text style={styles.footerBold}>{docPdf.nama_admin || '[Nama Admin]'}</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text>
              Penawaran berlaku hingga <Text style={styles.footerBold}>{berlakuSampai}</Text>
            </Text>
            <Text style={{ marginTop: 2 }}>Hal. 1 / 1</Text>
          </View>
        </View>

        {/* Garis Hiasan Bawah */}
        <View style={styles.stripeBottom} fixed>
          <View style={styles.stripeGrey} />
          <View style={styles.stripeNavy} />
          <View style={styles.stripeSteel} />
        </View>
      </Page>
    </Document>
  );
};
