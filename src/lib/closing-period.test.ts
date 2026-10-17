import { describe, it, expect } from 'vitest';
import { getPeriode, getAvailablePeriods } from './closing-period';

describe('Closing Period (Tanggal 26 s/d 25 Asia/Jakarta)', () => {
  it('Batas 25 Oktober 2026 jam 23:59:59 WIB masuk Periode Oktober 2026', () => {
    // 25 Okt 2026 23:59:59 WIB = 25 Okt 2026 16:59:59 UTC
    const date = new Date('2026-10-25T16:59:59.000Z');
    const p = getPeriode(date);

    expect(p.key).toBe('2026-10');
    expect(p.nama).toBe('Periode Oktober 2026');
    expect(p.bulanNama).toBe('Oktober');
    expect(p.tahun).toBe(2026);
    expect(p.closingDateStr).toBe('25 Okt');
    // Start date: 26 Sep 2026 00:00 WIB = 25 Sep 2026 17:00 UTC
    expect(p.startDate.toISOString()).toBe('2026-09-25T17:00:00.000Z');
    // End date: 25 Okt 2026 23:59:59.999 WIB = 25 Okt 2026 16:59:59.999 UTC
    expect(p.endDate.toISOString()).toBe('2026-10-25T16:59:59.999Z');
  });

  it('Batas 26 Oktober 2026 jam 00:00:00 WIB otomatis masuk Periode November 2026', () => {
    // 26 Okt 2026 00:00:00 WIB = 25 Okt 2026 17:00:00 UTC
    const date = new Date('2026-10-25T17:00:00.000Z');
    const p = getPeriode(date);

    expect(p.key).toBe('2026-11');
    expect(p.nama).toBe('Periode November 2026');
    expect(p.bulanNama).toBe('November');
    expect(p.tahun).toBe(2026);
    expect(p.closingDateStr).toBe('25 Nov');
    // Start date: 26 Okt 2026 00:00 WIB = 25 Okt 2026 17:00 UTC
    expect(p.startDate.toISOString()).toBe('2026-10-25T17:00:00.000Z');
    // End date: 25 Nov 2026 23:59:59.999 WIB = 25 Nov 2026 16:59:59.999 UTC
    expect(p.endDate.toISOString()).toBe('2026-11-25T16:59:59.999Z');
  });

  it('Pergantian tahun: 26 Desember 2026 jam 00:00:00 WIB masuk Periode Januari 2027', () => {
    // 26 Des 2026 00:00:00 WIB = 25 Des 2026 17:00:00 UTC
    const date = new Date('2026-12-25T17:00:00.000Z');
    const p = getPeriode(date);

    expect(p.key).toBe('2027-01');
    expect(p.nama).toBe('Periode Januari 2027');
    expect(p.bulanNama).toBe('Januari');
    expect(p.tahun).toBe(2027);
    expect(p.closingDateStr).toBe('25 Jan');
    // Start date: 26 Des 2026 00:00 WIB = 25 Des 2026 17:00 UTC
    expect(p.startDate.toISOString()).toBe('2026-12-25T17:00:00.000Z');
    // End date: 25 Jan 2027 23:59:59.999 WIB = 25 Jan 2027 16:59:59.999 UTC
    expect(p.endDate.toISOString()).toBe('2027-01-25T16:59:59.999Z');
  });

  it('Batas 25 Januari 2027 jam 23:59:59 WIB tetap Periode Januari 2027', () => {
    // 25 Jan 2027 23:59:59 WIB = 25 Jan 2027 16:59:59 UTC
    const date = new Date('2027-01-25T16:59:59.000Z');
    const p = getPeriode(date);

    expect(p.key).toBe('2027-01');
    expect(p.nama).toBe('Periode Januari 2027');
    expect(p.tahun).toBe(2027);
  });

  it('Format teks sidebar: contoh 17 November 2026 jam 12:00 WIB', () => {
    // 17 Nov 2026 12:00 WIB = 17 Nov 2026 05:00 UTC
    // Closing 25 Nov 23:59:59.999 WIB -> selisih 8 hari (18, 19, 20, 21, 22, 23, 24, 25)
    const date = new Date('2026-11-17T05:00:00.000Z');
    const p = getPeriode(date);

    expect(p.key).toBe('2026-11');
    expect(p.sisaHari).toBe(9); // Math.ceil((25 Nov 23:59:59 - 17 Nov 12:00) / 1d) = 9
    expect(p.labelSidebar).toContain('Periode November · closing 25 Nov');
  });

  it('getAvailablePeriods menghasilkan urutan mundur yang konsisten', () => {
    const ref = new Date('2026-10-18T10:00:00.000Z');
    const list = getAvailablePeriods(4, ref);

    expect(list.length).toBe(4);
    expect(list[0].key).toBe('2026-10'); // Periode Oktober 2026
    expect(list[1].key).toBe('2026-09'); // Periode September 2026
    expect(list[2].key).toBe('2026-08'); // Periode Agustus 2026
    expect(list[3].key).toBe('2026-07'); // Periode Juli 2026
  });
});
