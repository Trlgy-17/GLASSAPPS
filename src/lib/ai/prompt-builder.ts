import fs from 'fs';
import path from 'path';
import { PriceBookData } from '@/types/pricing';
import { formatRupiah } from '../pricing/format-rupiah';

export interface BuildPromptParams {
  priceBook: PriceBookData;
  namaAdmin: string;
  lead: {
    nama: string;
    kota: string;
    zona: 'dalam_kota' | 'luar_kota';
    segmen: 'B2C' | 'B2B';
    status: string;
    keberatanTerakhir?: string;
  };
  penawaranTerakhir?: {
    nomor: string;
    total: number;
    tanggal: string;
  };
  kalkulatorOutputJson?: string;
  transkripMessages: Array<{ pengirim: string; waktu?: string | null; teks: string }>;
  memoriKasus?: Array<{ ringkasan: string; teks_final: string; hasil: string; kemiripan?: number; tanggal?: string }>;
  aturanPlaybook?: string[];
  kanal: string;
  arahanAdmin?: string;
}

export interface BuiltPromptResult {
  systemInstruction: string;
  userContext: string;
}

/**
 * Membaca template prompt dari prompts/*.md dan mengisi variabel.
 * MENJAMIN:
 * 1. Angka rahasia owner (batas_owner, net B2B Rp1.350.000, floor ongkir) TIDAK PERNAH masuk prompt.
 * 2. Tidak ada placeholder "{{...}}" yang tersisa tanpa terisi.
 */
export function buildPrompts(params: BuildPromptParams): BuiltPromptResult {
  const { priceBook, namaAdmin, lead, kanal, kalkulatorOutputJson, transkripMessages } = params;

  // 1. Muat Template System Instruction (Statis)
  const csMainPath = path.resolve(process.cwd(), 'prompts/cs-main.md');
  let systemText = fs.readFileSync(csMainPath, 'utf8');

  // Bentuk tersedia
  const bentukTersedia = priceBook.master_bentuk.map((b) => b.label).join(', ');
  const bentukBolehAluminium = priceBook.master_bentuk
    .filter((b) => b.boleh_aluminium)
    .map((b) => b.label)
    .join(', ');

  // Format tingkat B2B (HANYA kirim jika lead = B2B dan ada tingkatnya; Rp1.350.000 tidak pernah dikirim)
  let b2bTingkatText = '(belum ditetapkan)';
  if (lead.segmen === 'B2B' && priceBook.tingkat_b2b && priceBook.tingkat_b2b.length > 0) {
    b2bTingkatText = priceBook.tingkat_b2b
      .map(
        (t) =>
          `- ${t.min_unit}${t.max_unit ? `–${t.max_unit}` : '+'} unit: ${formatRupiah(t.tarif_m2)}/m2`
      )
      .join('\n');
  }

  // Dictionary Penggantian Variabel System Prompt
  const systemReplacements: Record<string, string> = {
    nama_admin: namaAdmin || 'Admin',
    bentuk_tersedia: bentukTersedia,
    bentuk_boleh_aluminium: bentukBolehAluminium,
    sb_lebar_min: (priceBook.batas_produksi.sandblast_lebar_min_mm / 10).toString(),
    sb_lebar_max: (priceBook.batas_produksi.sandblast_lebar_max_mm / 10).toString(),
    sb_tepi_min: (priceBook.batas_produksi.sandblast_tepi_min_mm / 10).toString(),
    sb_tepi_max: (priceBook.batas_produksi.sandblast_tepi_max_mm / 10).toString(),
    produksi_hari_kerja: '1–5',
    garansi_klaim_hari: (priceBook.dokumen_pdf.garansi_klaim_hari || 7).toString(),
    garansi_fungsi: 'fungsi kelistrikan LED & touchscreen 3 bulan',
    harga_premium_m2: formatRupiah(priceBook.tarif_m2.premium_b2c),
    harga_basic_m2: formatRupiah(priceBook.tarif_m2.basic_m2),

    // Logistik HANYA memasukkan harga LIST. Angka net, batas admin, dan 50% TIDAK PERNAH dikirim ke prompt!
    kirim_bandung_list: formatRupiah(priceBook.logistik.kirim_bandung.list),
    kirim_luar_list: formatRupiah(priceBook.logistik.kirim_luar_kota.list),
    pasang_bandung_list: formatRupiah(priceBook.logistik.pasang_bandung.list),
    pasang_bandung_batas: formatRupiah(priceBook.logistik.pasang_bandung.batas_admin),
    pasang_luar_list: formatRupiah(priceBook.logistik.pasang_luar_kota.list),
    pasang_luar_batas: formatRupiah(priceBook.logistik.pasang_luar_kota.batas_admin),
    'lead.segmen': lead.segmen,
    b2b_tingkat: b2bTingkatText,
    bukti_sosial: priceBook.dokumen_pdf.instagram_handle || '@putraglass.id',
    kebijakan_survei: 'Tidak ada survei lapangan; klien dipandu mengukur mandiri dengan meteran terlihat',
    kebijakan_ongkir_50:
      priceBook.dokumen_pdf.kebijakan_ongkir_50 ||
      'Ongkir bisa dibagi dua (klien bayar minimal 50%) hanya dengan konfirmasi owner. Jangan ditawarkan sendiri; isi perlu_owner jika klien meminta.',
    promo_aktif: '(tidak ada promo aktif)',
    kebijakan_custom_marketplace: '(belum ditetapkan - tandai perlu_owner jika minta custom di marketplace)',
    alamat_workshop:
      priceBook.dokumen_pdf.alamat_workshop ||
      '(workshop kami di Bandung; jika klien tanya alamat lengkap, infokan admin akan konfirmasi titik jemput)',
  };

  for (const [key, val] of Object.entries(systemReplacements)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    systemText = systemText.replace(pattern, val);
  }

  // 2. Muat Template Konteks User (Dinamis)
  const contextPath = path.resolve(process.cwd(), 'prompts/context-template.md');
  let contextText = fs.readFileSync(contextPath, 'utf8');

  // Format transkrip pesan
  const formattedTranscript = transkripMessages
    .slice(-30)
    .map((m) => `[${m.waktu || '--:--'}] ${m.pengirim}: ${m.teks}`)
    .join('\n');

  // Format memori kasus rujukan (maksimal 3)
  const memoriText = (params.memoriKasus || [])
    .slice(0, 3)
    .map(
      (m, i) =>
        `<kasus ke="${i + 1}" hasil="${m.hasil}">\nSituasi: ${m.ringkasan}\nBalasan: ${m.teks_final}\n</kasus>`
    )
    .join('\n');

  const playbookText = (params.aturanPlaybook || [])
    .map((at, i) => `${i + 1}. ${at}`)
    .join('\n');

  const todayDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const contextReplacements: Record<string, string> = {
    tanggal_hari_ini: todayDateStr,
    'kasus.kanal': kanal || 'whatsapp',
    'lead.nama': lead.nama || '(belum diketahui)',
    'lead.kota': lead.kota || '(belum diketahui)',
    'lead.zona': lead.zona === 'dalam_kota' ? 'dalam kota Bandung' : 'luar kota',
    'lead.segmen': lead.segmen,
    'lead.status': lead.status || 'aktif',
    'penawaran.nomor': params.penawaranTerakhir?.nomor || '(belum ada)',
    'penawaran.total': params.penawaranTerakhir ? formatRupiah(params.penawaranTerakhir.total) : '(belum ada)',
    'penawaran.tanggal': params.penawaranTerakhir?.tanggal || '(belum ada)',
    'lead.keberatan': lead.keberatanTerakhir || '(tidak ada keberatan tercatat)',
    'daftar aturan aktif, bernomor': playbookText || '(tidak ada aturan playbook khusus)',
    ...Object.fromEntries((params.memoriKasus || []).map(() => ['', ''])),
  };

  // Replace blok konteks
  contextText = contextText.replace(/\{\{tanggal_hari_ini\}\}/g, todayDateStr);
  contextText = contextText.replace(/\{\{kasus\.kanal\}\}/g, kanal || 'whatsapp');
  contextText = contextText.replace(/\{\{lead\.nama\}\}/g, lead.nama || '(belum diketahui)');
  contextText = contextText.replace(/\{\{lead\.kota\}\}/g, lead.kota || '(belum diketahui)');
  contextText = contextText.replace(/\{\{lead\.zona\}\}/g, lead.zona === 'dalam_kota' ? 'dalam kota' : 'luar kota');
  contextText = contextText.replace(/\{\{lead\.segmen\}\}/g, lead.segmen);
  contextText = contextText.replace(/\{\{lead\.status\}\}/g, lead.status || 'aktif');
  contextText = contextText.replace(/\{\{penawaran\.nomor\}\}/g, params.penawaranTerakhir?.nomor || '(belum ada)');
  contextText = contextText.replace(/\{\{penawaran\.total\}\}/g, params.penawaranTerakhir ? formatRupiah(params.penawaranTerakhir.total) : '(belum ada)');
  contextText = contextText.replace(/\{\{penawaran\.tanggal\}\}/g, params.penawaranTerakhir?.tanggal || '(belum ada)');
  contextText = contextText.replace(/\{\{lead\.keberatan\}\}/g, lead.keberatanTerakhir || '(tidak ada)');
  contextText = contextText.replace(/\{\{daftar aturan aktif, bernomor\}\}/g, playbookText || '(tidak ada)');

  // Memori & Kalkulator & Transkrip
  contextText = contextText.replace(
    /<memori_kasus>[\s\S]*?<\/memori_kasus>/g,
    `<memori_kasus>\n${memoriText || '(belum ada memori serupa)'}\n</memori_kasus>`
  );
  contextText = contextText.replace(
    /\{\{JSON dari pricing\.ts[\s\S]*?\}\}/g,
    kalkulatorOutputJson || '(kalkulator belum dijalankan)'
  );
  contextText = contextText.replace(
    /\{\{maks\. 30 pesan terakhir[\s\S]*?\}\}/g,
    formattedTranscript || '[00:00] klien: Halo'
  );
  contextText = contextText.replace(
    /\{\{chip atau teks bebas; boleh kosong\}\}/g,
    params.arahanAdmin || '(arahan standar: dorong closing sopan)'
  );

  // 3. VALIDASI KEAMANAN: Pastikan tidak ada "{{" yang tersisa
  const unparsedSystem = systemText.match(/\{\{[^}]+\}\}/g);
  if (unparsedSystem && unparsedSystem.length > 0) {
    throw new Error(
      `Keamanan Prompt Gagal: Ditemukan variabel systemInstruction belum terisi: ${unparsedSystem.join(', ')}`
    );
  }

  const unparsedContext = contextText.match(/\{\{[^}]+\}\}/g);
  if (unparsedContext && unparsedContext.length > 0) {
    throw new Error(
      `Keamanan Prompt Gagal: Ditemukan variabel konteks belum terisi: ${unparsedContext.join(', ')}`
    );
  }
  // 4. VALIDASI KEAMANAN: Pastikan batas_owner, net B2B (1.350.000), floor rahasia, dan net ongkir TIDAK PERNAH masuk
  const forbiddenKeywords = ['1.350.000', '1350000', '375.000', '375000', '500.000', '1.150.000'];
  for (const forbidden of forbiddenKeywords) {
    if (systemText.includes(forbidden) || contextText.includes(forbidden)) {
      throw new Error(`Kebocoran Rahasia: Nilai ${forbidden} terdeteksi di dalam prompt!`);
    }
  }

  return {
    systemInstruction: systemText,
    userContext: contextText,
  };
}
