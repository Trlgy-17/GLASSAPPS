/**
 * Modul Periode Closing Bulanan (Tanggal 26 s/d 25 Asia/Jakarta)
 *
 * Aturan Bisnis:
 * - Periode = Tanggal 26 bulan lalu s/d tanggal 25 bulan berjalan (pukul 23:59:59.999 WIB).
 * - Mulai tanggal 26 otomatis masuk periode baru.
 *   Contoh: 26 Okt–25 Nov 2026 = "Periode November 2026"
 *   Contoh: 26 Des 2026–25 Jan 2027 = "Periode Januari 2027"
 */

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const NAMA_BULAN_PENDEK = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agt',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export interface ClosingPeriod {
  key: string; // Format: "YYYY-MM", misal "2026-11"
  nama: string; // "Periode November 2026"
  bulanNama: string; // "November"
  bulanIndex: number; // 1-12
  tahun: number; // 2026
  startDate: Date; // 26 bulan lalu 00:00:00 WIB (UTC Date)
  endDate: Date; // 25 bulan ini 23:59:59.999 WIB (UTC Date)
  startDateIso: string;
  endDateIso: string;
  closingDateStr: string; // "25 Nov"
  sisaHari: number; // Hari tersisa s/d closing
  labelSidebar: string; // "Periode November · closing 25 Nov · 8 hari lagi"
}

/**
 * Konversi Date ke komponen waktu lokal Asia/Jakarta (UTC+7)
 */
function toJakartaTime(d: Date) {
  // Offset Jakarta selalu UTC+7 tanpa DST
  const ms = d.getTime() + 7 * 3600000;
  const j = new Date(ms);
  return {
    year: j.getUTCFullYear(),
    month: j.getUTCMonth(), // 0-11
    date: j.getUTCDate(), // 1-31
    hour: j.getUTCHours(),
    minute: j.getUTCMinutes(),
    second: j.getUTCSeconds(),
    ms: j.getUTCMilliseconds(),
  };
}

/**
 * Buat Date UTC dari tanggal/jam WIB (UTC+7)
 */
function createWibDate(year: number, month: number, date: number, hour = 0, minute = 0, second = 0, ms = 0): Date {
  return new Date(Date.UTC(year, month, date, hour - 7, minute, second, ms));
}

/**
 * Ambil informasi periode closing dari suatu tanggal
 */
export function getPeriode(inputDate?: Date | string | number): ClosingPeriod {
  const d = inputDate ? new Date(inputDate) : new Date();
  const jt = toJakartaTime(d);

  // Jika tanggal >= 26, periode target adalah bulan depan
  let targetYear = jt.year;
  let targetMonth = jt.month; // 0-11

  if (jt.date >= 26) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  // Bulan awal periode adalah 1 bulan sebelum targetMonth
  let prevYear = targetYear;
  let prevMonth = targetMonth - 1;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear -= 1;
  }

  // Rentang waktu:
  // Mulai: 26 prevMonth prevYear 00:00:00.000 WIB
  // Selesai: 25 targetMonth targetYear 23:59:59.999 WIB
  const startDate = createWibDate(prevYear, prevMonth, 26, 0, 0, 0, 0);
  const endDate = createWibDate(targetYear, targetMonth, 25, 23, 59, 59, 999);

  const bulanNama = NAMA_BULAN[targetMonth];
  const bulanPendek = NAMA_BULAN_PENDEK[targetMonth];
  const bulanNumberStr = String(targetMonth + 1).padStart(2, '0');
  const key = `${targetYear}-${bulanNumberStr}`;
  const nama = `Periode ${bulanNama} ${targetYear}`;
  const closingDateStr = `25 ${bulanPendek}`;

  // Hitung sisa hari dari waktu d menuju endDate
  const diffMs = endDate.getTime() - d.getTime();
  const sisaHari = Math.max(0, Math.ceil(diffMs / (24 * 3600 * 1000)));

  const labelSidebar =
    sisaHari === 0
      ? `Periode ${bulanNama} · closing hari ini`
      : `Periode ${bulanNama} · closing ${closingDateStr} · ${sisaHari} hari lagi`;

  return {
    key,
    nama,
    bulanNama,
    bulanIndex: targetMonth + 1,
    tahun: targetYear,
    startDate,
    endDate,
    startDateIso: startDate.toISOString(),
    endDateIso: endDate.toISOString(),
    closingDateStr,
    sisaHari,
    labelSidebar,
  };
}

/**
 * Daftar opsi periode untuk dropdown (periode berjalan + n periode sebelumnya)
 */
export function getAvailablePeriods(count = 12, referenceDate?: Date): ClosingPeriod[] {
  const current = getPeriode(referenceDate);
  const periods: ClosingPeriod[] = [current];

  let y = current.tahun;
  let m = current.bulanIndex - 1; // 0-11

  for (let i = 1; i < count; i++) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    // Ambil tanggal 10 pada bulan target tersebut untuk mendapatkan periodenya
    const sampleDate = createWibDate(y, m, 10, 12, 0, 0);
    periods.push(getPeriode(sampleDate));
  }

  return periods;
}
