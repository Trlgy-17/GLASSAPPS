import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildPenawaranWorkbook, PenawaranExportRow } from './penawaran-export';

const sampleRows: PenawaranExportRow[] = [
  {
    nomor: 'PG-2026-001',
    tanggal: '2026-10-05T03:00:00.000Z',
    status: 'deal',
    kanal: 'WhatsApp',
    namaKlien: 'Budi',
    kota: 'Bandung',
    noWa: '6281200000001',
    adminPembuat: 'Admin Satu',
    totalNilai: 1505000,
    berlakuSampai: '2026-10-12',
    tglDeal: '2026-10-06T04:00:00.000Z',
    alasanBatal: null,
  },
  {
    nomor: 'PG-2026-002',
    tanggal: '2026-10-07T03:00:00.000Z',
    status: 'batal',
    kanal: 'Instagram',
    namaKlien: 'Sari',
    kota: 'Cimahi',
    noWa: '6281200000002',
    adminPembuat: 'Admin Dua',
    totalNilai: 840000,
    berlakuSampai: '2026-10-14',
    tglDeal: null,
    alasanBatal: 'harga',
  },
];

async function loadBuilt(rows: PenawaranExportRow[]) {
  const buffer = await buildPenawaranWorkbook(rows, {
    perusahaan: 'Putra Glass',
    periodeNama: 'Periode Oktober 2026',
    dieksporOleh: 'Owner Tes',
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  return wb.getWorksheet('Penawaran')!;
}

describe('buildPenawaranWorkbook', () => {
  it('membuat sheet Penawaran dengan header tabel yang benar', async () => {
    const ws = await loadBuilt(sampleRows);
    expect(ws).toBeTruthy();
    const header = ws.getRow(6);
    expect(header.getCell(2).value).toBe('Nomor Penawaran');
    expect(header.getCell(4).value).toBe('Status');
    expect(header.getCell(10).value).toBe('Total Nilai');
  });

  it('menulis setiap penawaran sebagai satu baris dengan label status', async () => {
    const ws = await loadBuilt(sampleRows);
    expect(ws.getRow(7).getCell(2).value).toBe('PG-2026-001');
    expect(ws.getRow(7).getCell(4).value).toBe('Deal');
    expect(ws.getRow(7).getCell(10).value).toBe(1505000);
    expect(ws.getRow(8).getCell(4).value).toBe('Batal');
  });

  it('kolom total memakai format Rupiah', async () => {
    const ws = await loadBuilt(sampleRows);
    expect(ws.getRow(7).getCell(10).numFmt).toContain('Rp');
  });

  it('baris total menjumlahkan semua nilai', async () => {
    const ws = await loadBuilt(sampleRows);
    const totalRow = ws.getRow(6 + 1 + sampleRows.length); // setelah header + data
    expect(totalRow.getCell(10).value).toBe(1505000 + 840000);
  });

  it('aman untuk daftar kosong', async () => {
    const ws = await loadBuilt([]);
    expect(ws.getRow(6).getCell(2).value).toBe('Nomor Penawaran');
    const totalRow = ws.getRow(7);
    expect(totalRow.getCell(10).value).toBe(0);
  });
});
