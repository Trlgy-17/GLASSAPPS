import ExcelJS from 'exceljs';

/**
 * Pembuat file Excel (.xlsx) berdesain modern untuk daftar penawaran Putra Glass.
 *
 * Helper ini MURNI: menerima baris yang sudah diratakan + metadata, lalu
 * mengembalikan buffer .xlsx. Tidak menyentuh database/jaringan, supaya mudah
 * diuji. Semua pengambilan data & otorisasi dikerjakan di API route.
 *
 * Catatan privasi: kolom di sini hanya yang memang dilihat klien/bisnis
 * (nomor, status, kanal, nama, kota, no WA, admin, total nilai, tanggal).
 * TIDAK ada ongkir net, batas potongan, atau angka internal lainnya.
 */

export interface PenawaranExportRow {
  nomor: string;
  tanggal: string | null; // ISO created_at
  status: string;
  kanal: string | null;
  namaKlien: string | null;
  kota: string | null;
  noWa: string | null;
  adminPembuat: string | null;
  totalNilai: number;
  berlakuSampai: string | null; // ISO date
  tglDeal: string | null; // ISO
  alasanBatal: string | null;
}

export interface PenawaranExportMeta {
  perusahaan: string;
  periodeNama: string; // "Periode Oktober 2026" atau "Semua periode"
  dieksporOleh: string;
  statusFilter?: string; // label filter status aktif
}

const STATUS_LABEL: Record<string, string> = {
  draf: 'Draf',
  terkirim: 'Terkirim',
  nego: 'Nego',
  deal: 'Deal',
  lunas: 'Lunas',
  batal: 'Batal',
  kadaluwarsa: 'Kadaluwarsa',
  dihapus: 'Dihapus',
};

// Warna isi + teks untuk tiap status (ARGB)
const STATUS_STYLE: Record<string, { fill: string; font: string }> = {
  draf: { fill: 'FFE8EBF0', font: 'FF4A5568' },
  terkirim: { fill: 'FFDCE9FB', font: 'FF1D4ED8' },
  nego: { fill: 'FFFCEFCB', font: 'FF92600A' },
  deal: { fill: 'FFD6F0E0', font: 'FF156B3D' },
  lunas: { fill: 'FFBFE6CE', font: 'FF0B4B2A' },
  batal: { fill: 'FFF9D9D9', font: 'FF9B2222' },
  kadaluwarsa: { fill: 'FFE2E5EA', font: 'FF6B7280' },
  dihapus: { fill: 'FFEDE0E0', font: 'FF8A5A5A' },
};

// Palet brand Putra Glass
const NAVY = 'FF141C33';
const NAVY_SOFT = 'FF27324F';
const ACCENT = 'FF9CCFC2';
const INK = 'FF1F2733';
const ZEBRA = 'FFF5F7FA';
const BORDER = 'FFD9DEE7';

const TZ = 'Asia/Jakarta';

function fmtTanggal(iso: string | null, withTime = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }
    : { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ };
  return new Intl.DateTimeFormat('id-ID', opts).format(d);
}

const COLUMNS: { header: string; width: number; key: string }[] = [
  { header: 'No.', width: 5, key: 'idx' },
  { header: 'Nomor Penawaran', width: 20, key: 'nomor' },
  { header: 'Tanggal Dibuat', width: 15, key: 'tanggal' },
  { header: 'Status', width: 13, key: 'status' },
  { header: 'Kanal', width: 12, key: 'kanal' },
  { header: 'Nama Klien', width: 22, key: 'nama' },
  { header: 'Kota', width: 14, key: 'kota' },
  { header: 'No. WhatsApp', width: 18, key: 'wa' },
  { header: 'Admin Pembuat', width: 18, key: 'admin' },
  { header: 'Total Nilai', width: 16, key: 'total' },
  { header: 'Berlaku Sampai', width: 15, key: 'valid' },
  { header: 'Tgl Deal', width: 15, key: 'deal' },
  { header: 'Alasan Batal', width: 18, key: 'batal' },
];

const LAST_COL = COLUMNS.length; // 13
const TOTAL_COL = 10; // kolom "Total Nilai"

function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function buildPenawaranWorkbook(
  rows: PenawaranExportRow[],
  meta: PenawaranExportMeta
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.perusahaan;
  wb.created = new Date();
  const ws = wb.addWorksheet('Penawaran', {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  COLUMNS.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
  });

  const lastLetter = colLetter(LAST_COL);

  // ---- Baris 1: Judul brand ----
  ws.mergeCells(`A1:${lastLetter}1`);
  const title = ws.getCell('A1');
  title.value = `${meta.perusahaan.toUpperCase()}  —  Daftar Penawaran`;
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  ws.getRow(1).height = 30;

  // ---- Baris 2: Metadata ----
  ws.mergeCells(`A2:${lastLetter}2`);
  const sub = ws.getCell('A2');
  const filterTxt = meta.statusFilter && meta.statusFilter !== 'all' ? ` · Status: ${meta.statusFilter}` : '';
  sub.value = `${meta.periodeNama}${filterTxt}  ·  Diekspor ${fmtTanggal(new Date().toISOString(), true)} WIB oleh ${meta.dieksporOleh}`;
  sub.font = { name: 'Calibri', size: 10, color: { argb: 'FFE6ECF4' } };
  sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_SOFT } };
  ws.getRow(2).height = 20;

  // ---- Baris 4-5: KPI ringkas ----
  const jumlah = rows.length;
  const totalSemua = rows.reduce((s, r) => s + (r.totalNilai || 0), 0);
  const dealRows = rows.filter((r) => r.status === 'deal' || r.status === 'lunas');
  const dealNilai = dealRows.reduce((s, r) => s + (r.totalNilai || 0), 0);
  const basisClosing = rows.filter((r) =>
    ['deal', 'lunas', 'batal', 'kadaluwarsa'].includes(r.status)
  ).length;
  const closingRate = basisClosing > 0 ? Math.round((dealRows.length / basisClosing) * 100) : 0;

  const kpis: { label: string; value: string }[] = [
    { label: 'Jumlah Penawaran', value: String(jumlah) },
    { label: 'Total Nilai', value: 'Rp ' + totalSemua.toLocaleString('id-ID') },
    { label: 'Deal', value: `${dealRows.length}  (Rp ${dealNilai.toLocaleString('id-ID')})` },
    { label: 'Closing Rate', value: `${closingRate}%` },
  ];

  // Setiap KPI menempati 3 kolom (label di baris 4, nilai di baris 5)
  const span = 3;
  kpis.forEach((kpi, i) => {
    const start = 1 + i * span;
    if (start + span - 1 > LAST_COL) return;
    const l1 = colLetter(start);
    const l2 = colLetter(start + span - 1);
    ws.mergeCells(`${l1}4:${l2}4`);
    ws.mergeCells(`${l1}5:${l2}5`);
    const labelCell = ws.getCell(`${l1}4`);
    labelCell.value = kpi.label.toUpperCase();
    labelCell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: 'FF6B7280' } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3F8' } };
    const valCell = ws.getCell(`${l1}5`);
    valCell.value = kpi.value;
    valCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: INK } };
    valCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3F8' } };
    // garis aksen bawah
    valCell.border = { bottom: { style: 'thick', color: { argb: ACCENT } } };
  });
  ws.getRow(4).height = 15;
  ws.getRow(5).height = 22;

  // ---- Baris 6: Header tabel ----
  const headerRowIdx = 6;
  const headerRow = ws.getRow(headerRowIdx);
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: c.key === 'total' ? 'right' : c.key === 'idx' ? 'center' : 'left',
      indent: c.key === 'idx' || c.key === 'total' ? 0 : 1,
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: ACCENT } },
    };
  });
  headerRow.height = 22;

  // ---- Baris data ----
  rows.forEach((r, i) => {
    const rowIdx = headerRowIdx + 1 + i;
    const row = ws.getRow(rowIdx);
    const zebra = i % 2 === 1;

    const values = [
      i + 1,
      r.nomor || '',
      fmtTanggal(r.tanggal),
      STATUS_LABEL[r.status] || r.status,
      r.kanal || '',
      r.namaKlien || '',
      r.kota || '',
      r.noWa || '',
      r.adminPembuat || '',
      r.totalNilai || 0,
      fmtTanggal(r.berlakuSampai),
      fmtTanggal(r.tglDeal),
      r.alasanBatal || '',
    ];

    values.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.font = { name: 'Calibri', size: 10, color: { argb: INK } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: ci + 1 === TOTAL_COL ? 'right' : ci === 0 ? 'center' : 'left',
        indent: ci === 0 || ci + 1 === TOTAL_COL ? 0 : 1,
      };
      if (zebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
      }
      cell.border = { bottom: { style: 'hair', color: { argb: BORDER } } };
    });

    // Kolom total: format Rupiah
    const totalCell = row.getCell(TOTAL_COL);
    totalCell.numFmt = '"Rp"#,##0';
    totalCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: INK } };

    // Kolom status: chip berwarna
    const st = STATUS_STYLE[r.status];
    if (st) {
      const sc = row.getCell(4);
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.fill } };
      sc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: st.font } };
      sc.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    row.height = 19;
  });

  // ---- Baris total ----
  const totalRowIdx = headerRowIdx + 1 + rows.length;
  const totalRow = ws.getRow(totalRowIdx);
  const labelCell = totalRow.getCell(1);
  ws.mergeCells(`${colLetter(1)}${totalRowIdx}:${colLetter(TOTAL_COL - 1)}${totalRowIdx}`);
  labelCell.value = `TOTAL  (${jumlah} penawaran)`;
  labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  labelCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
  labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_SOFT } };

  const totalValCell = totalRow.getCell(TOTAL_COL);
  totalValCell.value = totalSemua;
  totalValCell.numFmt = '"Rp"#,##0';
  totalValCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  totalValCell.alignment = { vertical: 'middle', horizontal: 'right' };
  totalValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };

  // sisa kolom setelah total pada baris total: beri warna senada
  for (let c = TOTAL_COL + 1; c <= LAST_COL; c++) {
    totalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_SOFT } };
  }
  totalRow.height = 22;

  // Auto-filter pada header tabel
  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx, column: LAST_COL },
  };

  return wb.xlsx.writeBuffer();
}

export { STATUS_LABEL };
