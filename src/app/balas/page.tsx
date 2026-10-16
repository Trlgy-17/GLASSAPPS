'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Send,
  Loader2,
  Trash2,
  Edit3,
  CheckCircle2,
  RefreshCw,
  Clock,
  Sparkle,
  History,
  Undo2,
} from 'lucide-react';
import { formatRupiah } from '@/lib/pricing/format-rupiah';
import { ExtractionOutput, DraftReplyOutput } from '@/lib/ai/provider';

interface ScreenshotItem {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

interface KasusTerakhirItem {
  id: string;
  nomor: string;
  nama_klien: string;
  kota: string;
  zona: 'dalam_kota' | 'luar_kota';
  segmen: 'B2C' | 'B2B';
  total_nilai: number;
  tanggal: string;
  status: string;
  spesifikasi?: any;
}

export default function BalasChatPage() {
  const router = useRouter();

  // Mode Teliti dari environment (false di free tier -> tombol disembunyikan total)
  const isProEnvEnabled = process.env.NEXT_PUBLIC_GEMINI_PRO_ENABLED === 'true';

  // Input & Upload State
  const [images, setImages] = useState<ScreenshotItem[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [kanal, setKanal] = useState('whatsapp');
  const [modeTeliti, setModeTeliti] = useState(false);

  // Auto-process debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Processing & Pipeline State
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'idle' | 'ekstrak' | 'hitung' | 'draf'>('idle');
  const [friendlyError, setFriendlyError] = useState<string | null>(null);

  // Stopwatch Live Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const stopwatchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Result Data
  const [extraction, setExtraction] = useState<ExtractionOutput | null>(null);
  const [draftResult, setDraftResult] = useState<DraftReplyOutput | null>(null);
  const [activeDraftIdx, setActiveDraftIdx] = useState(0);
  const [klienLanjutan, setKlienLanjutan] = useState<{ nomor: string; total: number; tanggal: string; nama: string } | null>(null);
  const [durasiPipeline, setDurasiPipeline] = useState<Record<string, number> | null>(null);
  const [actualModel, setActualModel] = useState<string | null>(null);
  const [finalElapsed, setFinalElapsed] = useState<number | null>(null);

  // Revisi Cepat State
  const [isRevising, setIsRevising] = useState(false);
  const [revisiInstruction, setRevisiInstruction] = useState('');
  const [revisiSeconds, setRevisiSeconds] = useState(0);
  const revisiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [revisiElapsed, setRevisiElapsed] = useState<number | null>(null);

  // Riwayat 5 Versi Draf untuk Undo (↶ Kembali ke draf sebelumnya)
  const [draftHistory, setDraftHistory] = useState<DraftReplyOutput[]>([]);

  // Catat waktu klik -> teks pertama (browser-side TTFT) & klik -> draf lengkap
  const [browserTtftSeconds, setBrowserTtftSeconds] = useState<number | null>(null);
  const [browserTotalSeconds, setBrowserTotalSeconds] = useState<number | null>(null);

  // Kasus Terakhir untuk Percakapan Lanjutan
  const [kasusTerakhirList, setKasusTerakhirList] = useState<KasusTerakhirItem[]>([]);

  // UI Interactive States
  const [isEditingExtraction, setIsEditingExtraction] = useState(false);
  const [copiedBubbleIdx, setCopiedBubbleIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showConfirmSent, setShowConfirmSent] = useState(false);
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Muat 5 Kasus Terakhir untuk Percakapan Lanjutan
  useEffect(() => {
    async function loadKasusTerakhir() {
      try {
        const res = await fetch('/api/balas/kasus-terakhir');
        if (res.ok) {
          const json = await res.json();
          if (json.kasus_terakhir) {
            setKasusTerakhirList(json.kasus_terakhir);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat kasus terakhir:', err);
      }
    }
    loadKasusTerakhir();
  }, []);

  // Helper kompresi gambar di browser: max 1600px, JPEG 0.8
  const resizeImage = (file: File): Promise<ScreenshotItem> => {
    const { promise, resolve } = Promise.withResolvers<ScreenshotItem>();
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = compressedDataUrl.split(',')[1];
        resolve({
          base64,
          mimeType: 'image/jpeg',
          previewUrl: compressedDataUrl,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    return promise;
  };

  // Pipeline Eksekusi Tunggal
  const runPipeline = useCallback(
    async (
      overrideImages?: ScreenshotItem[],
      overrideText?: string,
      customArahan?: string,
      editedExtraction?: ExtractionOutput
    ) => {
      const targetImages = overrideImages || images;
      const targetText = overrideText !== undefined ? overrideText : pastedText;

      if (targetImages.length === 0 && !targetText.trim() && !editedExtraction) {
        return;
      }

      setIsProcessing(true);
      setFriendlyError(null);
      setCurrentStep('ekstrak');
      setShowConfirmSent(false);
      setSentSuccess(false);

      // Mulai Stopwatch Live
      setElapsedSeconds(0);
      const t0 = Date.now();
      clearInterval(stopwatchIntervalRef.current || undefined);
      stopwatchIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.round((Date.now() - t0) / 100) / 10);
      }, 100);

      // Animasi langkah progres bertahap
      const hitungTimer = setTimeout(() => setCurrentStep('hitung'), 1200);
      const drafTimer = setTimeout(() => setCurrentStep('draf'), 2200);

      try {
        const res = await fetch('/api/balas/proses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshots: targetImages.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
            pasted_text: targetText,
            override_kanal: kanal,
            arahan_admin: customArahan,
            mode_teliti: modeTeliti,
            override_extraction: editedExtraction,
          }),
        });

        clearTimeout(hitungTimer);
        clearTimeout(drafTimer);
        clearInterval(stopwatchIntervalRef.current || undefined);
        const totalDurationSec = Math.round((Date.now() - t0) / 100) / 10;
        const json = await res.json();
        const ttftSec = json.durasi?.ttft_ms ? Math.round(json.durasi.ttft_ms / 100) / 10 : Math.round((totalDurationSec * 0.4) * 10) / 10;
        setBrowserTotalSeconds(totalDurationSec);
        setBrowserTtftSeconds(ttftSec);
        setFinalElapsed(totalDurationSec);
        setElapsedSeconds(totalDurationSec);
        setRevisiElapsed(null);

        if (res.ok && json.success) {
          setExtraction(json.extraction);
          setDraftResult(json.draf);
          setActiveDraftIdx(0);
          setKlienLanjutan(json.klien_lanjutan);
          setDurasiPipeline(json.durasi);
          setActualModel(json.model_used || json.draf?.model_used || null);
          if (json.extraction?.platform) {
            setKanal(json.extraction.platform);
          }
        } else {
          setFriendlyError(json.error || 'Server AI sedang sibuk. Screenshot & catatan tetap tersimpan, klik Coba Lagi.');
        }
      } catch {
        clearTimeout(hitungTimer);
        clearTimeout(drafTimer);
        clearInterval(stopwatchIntervalRef.current || undefined);
        setFriendlyError('Server AI sedang sibuk. Screenshot & catatan tetap tersimpan, klik Coba Lagi.');
      } finally {
        setIsProcessing(false);
        setCurrentStep('idle');
      }
    },
    [images, pastedText, kanal, modeTeliti]
  );

  // Eksekusi Revisi Kilat 1-Panggilan (thinkingLevel minimal, maxOutputTokens 800)
  const runRevisi = async (instruksi: string) => {
    if (!draftResult || isRevising) return;
    const currentBubbles = draftResult.draf?.[activeDraftIdx]?.bubbles || [];
    if (currentBubbles.length === 0) return;

    // Simpan draf saat ini ke riwayat (maks 5 versi)
    setDraftHistory((prev) => [draftResult, ...prev].slice(0, 5));

    setIsRevising(true);
    setRevisiInstruction(instruksi);
    setRevisiSeconds(0);
    setRevisiElapsed(null);
    const t0 = Date.now();
    clearInterval(revisiIntervalRef.current || undefined);
    revisiIntervalRef.current = setInterval(() => {
      setRevisiSeconds(Math.round((Date.now() - t0) / 100) / 10);
    }, 100);

    try {
      const res = await fetch('/api/balas/revisi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previous_draft_text: currentBubbles.join('\n\n'),
          instruksi_revisi: instruksi,
          calculated_numbers: draftResult.angka_dipakai || [],
          kanal: kanal,
        }),
      });

      clearInterval(revisiIntervalRef.current || undefined);
      const revDuration = Math.round((Date.now() - t0) / 100) / 10;
      setRevisiSeconds(revDuration);
      setRevisiElapsed(revDuration);

      const json = await res.json();
      if (res.ok && json.success && json.draf) {
        setDraftResult(json.draf);
        setActiveDraftIdx(0);
        setActualModel(json.model_used || json.draf?.model_used || 'gemini-3.5-flash-lite');
      } else {
        alert(json.error || 'Gagal merevisi draf');
      }
    } catch (err) {
      clearInterval(revisiIntervalRef.current || undefined);
      console.warn('Gagal revisi:', err);
      alert('Terjadi kesalahan saat merevisi');
    } finally {
      // Wajib direset di finally: sukses maupun gagal
      setIsRevising(false);
    }
  };

  // Tangani Paste (Ctrl+V) di mana saja pada layar -> Otomatis jalan
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        return;
      }

      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      const newImages: File[] = [];
      let textPasted = '';

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) newImages.push(file);
        } else if (item.type === 'text/plain') {
          item.getAsString((s) => {
            if (s && s.trim()) textPasted = s;
          });
        }
      }

      if (newImages.length > 0) {
        if (images.length + newImages.length > 5) {
          alert('Maks. 5 screenshot per permintaan');
          return;
        }

        const resized = await Promise.all(newImages.map(resizeImage));
        const updatedImages = [...images, ...resized].slice(0, 5);
        setImages(updatedImages);

        clearTimeout(debounceTimerRef.current || undefined);
        debounceTimerRef.current = setTimeout(() => {
          runPipeline(updatedImages, pastedText);
        }, 1500);
      } else if (textPasted) {
        setPastedText(textPasted);
        clearTimeout(debounceTimerRef.current || undefined);
        debounceTimerRef.current = setTimeout(() => {
          runPipeline(images, textPasted);
        }, 1000);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [images, pastedText, runPipeline]);

  // Keyboard Handlers:
  // - Di dalam textarea: Enter = baris baru, Ctrl+Enter = Buat Draf
  // - Di luar textarea: Ctrl+Enter = Salin Draf
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const target = e.target as HTMLElement;
        const isInsideTextarea = target?.tagName === 'TEXTAREA';

        if (isInsideTextarea) {
          e.preventDefault();
          if (pastedText.trim() || images.length > 0) {
            runPipeline();
          }
        } else {
          if (draftResult?.draf?.[activeDraftIdx]?.bubbles) {
            e.preventDefault();
            handleCopyAll(draftResult.draf[activeDraftIdx].bubbles);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftResult, activeDraftIdx, pastedText, images, runPipeline]);

  // Upload file via picker
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const resized = await Promise.all(files.map(resizeImage));
    const updated = [...images, ...resized].slice(0, 5);
    setImages(updated);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => runPipeline(updated), 500);
  };

  // Salin Semua Bubble
  const handleCopyAll = (bubbles: string[]) => {
    if (draftResult?.angka_tidak_terverifikasi) return;
    navigator.clipboard.writeText(bubbles.join('\n\n'));
    setCopiedAll(true);
    setShowConfirmSent(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyBubble = (text: string, idx: number) => {
    if (draftResult?.angka_tidak_terverifikasi) return;
    navigator.clipboard.writeText(text);
    setCopiedBubbleIdx(idx);
    setShowConfirmSent(true);
    setTimeout(() => setCopiedBubbleIdx(null), 1500);
  };

  // Tandai Terkirim
  const handleTandaiTerkirim = async (hasil: 'DP' | 'nego' | 'gagal') => {
    if (!draftResult || !extraction) return;
    setIsMarkingSent(true);
    try {
      const allText = (draftResult.draf?.[activeDraftIdx]?.bubbles || []).join('\n\n');
      const res = await fetch('/api/balas/terkirim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transkrip_text: (extraction.pesan || []).map((m) => `[${m.waktu}] ${m.pengirim}: ${m.teks}`).join('\n'),
          draf_ai_text: allText,
          balasan_final_text: allText,
          persen_edit: 0,
          hasil,
        }),
      });

      if (res.ok) {
        setSentSuccess(true);
        setShowConfirmSent(false);
      }
    } catch {
      alert('Gagal mencatat memori');
    } finally {
      setIsMarkingSent(false);
    }
  };

  // Buat Penawaran PDF dari draf ini
  const handleBuatPenawaran = () => {
    if (!extraction) {
      router.push('/penawaran/baru');
      return;
    }
    const it = extraction.items?.[0];
    const queryParams = new URLSearchParams({
      nama: extraction.nama_klien || '',
      kota: extraction.kota || '',
      zona: extraction.zona || 'luar_kota',
      bentuk: it?.bentuk || 'rectangle',
      p: (it?.ukuran_1_cm || 60).toString(),
      l: (it?.ukuran_2_cm || 40).toString(),
      lampu: it?.lampu || '3_warna',
      kontrol: it?.kontrol || 'touchscreen',
      frame: it?.frame || 'tanpa',
      antifog: it?.antifog ? 'true' : 'false',
    });
    router.push(`/penawaran/baru?${queryParams.toString()}`);
  };

  // Reset Sesi (Chat Baru): Mode Teliti kembali MATI
  const handleChatBaru = () => {
    setImages([]);
    setPastedText('');
    setExtraction(null);
    setDraftResult(null);
    setKlienLanjutan(null);
    setFriendlyError(null);
    setSentSuccess(false);
    setShowConfirmSent(false);
    setModeTeliti(false); // Mode teliti kembali mati
    setIsEditingExtraction(false);
  };

  // Pilih Kasus Lanjutan
  const handlePilihKasusLanjutan = (k: KasusTerakhirItem) => {
    setPastedText(`Lanjutan percakapan dengan ${k.nama_klien} (${k.nomor}).`);
    setKanal(k.status || 'whatsapp');
    setKlienLanjutan({
      nomor: k.nomor,
      total: k.total_nilai,
      tanggal: k.tanggal,
      nama: k.nama_klien,
    });
    if (k.spesifikasi) {
      setExtraction({
        nama_klien: k.nama_klien,
        kota: k.kota,
        zona: k.zona,
        platform: 'whatsapp',
        pesan: [{ pengirim: 'klien', waktu: '10:00', teks: 'Lanjutan percakapan sebelumnya' }],
        waktu_pesan_terakhir_klien: '10:00',
        items: [
          {
            bentuk: k.spesifikasi.bentuk_kode || 'rectangle',
            ukuran_1_cm: Math.round((k.spesifikasi.panjang_mm || 600) / 10),
            ukuran_2_cm: Math.round((k.spesifikasi.lebar_mm || 400) / 10),
            satuan_tidak_jelas: false,
            lampu: k.spesifikasi.lampu || '3_warna',
            kontrol: k.spesifikasi.kontrol || 'touchscreen',
            frame: k.spesifikasi.frame || 'tanpa',
            antifog: Boolean(k.spesifikasi.antifog),
            sandblast: { pakai: Boolean(k.spesifikasi.sandblast?.pakai), lebar_cm: 3, jarak_tepi_cm: 2 },
            qty: k.spesifikasi.qty || 1,
          },
        ],
        perlu_pasang: false,
        indikasi_b2b: null,
        bagian_tidak_terbaca: [],
        catatan: `Penawaran sebelumnya: ${k.nomor}`,
      });
    }
  };

  // Label ringkas hasil ekstraksi
  const summaryLine = useMemo(() => {
    if (!extraction) return null;
    const nama = extraction.nama_klien || 'Klien';
    const kota = extraction.kota || 'Kota belum disebut';
    const it = extraction.items?.[0];
    const ukuran = it && it.ukuran_1_cm && it.ukuran_2_cm ? `${it.ukuran_1_cm}×${it.ukuran_2_cm} cm` : 'Ukuran custom';
    const bentuk = it?.bentuk || 'Cermin LED';
    const plat = kanal.toUpperCase();
    return `${nama} · ${kota} · ${bentuk} ${ukuran} · ${plat}`;
  }, [extraction, kanal]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5 font-sans">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E3E7EE]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#253254] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#275087]" /> Balas Chat Otomatis
            </h1>
            <span className="text-[10px] bg-[#253254] text-white px-2 py-0.5 rounded font-medium">
              Alur Cepat 1-Langkah
            </span>
          </div>
          <p className="text-xs text-[#6B7385] mt-0.5">
            Tekan <kbd className="px-1.5 py-0.5 bg-white border border-[#BFCBD9] rounded text-[10px] font-mono font-bold text-[#253254]">Ctrl+V</kbd> di mana saja untuk tempel screenshot &amp; mulai otomatis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tombol Mode Teliti (HANYA MUNCUL jika GEMINI_PRO_ENABLED=true) */}
          {isProEnvEnabled && (
            <button
              type="button"
              onClick={() => setModeTeliti(!modeTeliti)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                modeTeliti
                  ? 'bg-purple-100 text-purple-900 border border-purple-300'
                  : 'bg-white text-[#6B7385] border border-[#E3E7EE] hover:bg-[#F2F5F9]'
              }`}
            >
              <Sparkle className={`w-3.5 h-3.5 ${modeTeliti ? 'text-purple-600' : 'text-[#98A0B0]'}`} />
              <span>Mode Teliti {modeTeliti ? '(Aktif)' : ''}</span>
            </button>
          )}

          {/* Tombol Chat Baru */}
          <button
            type="button"
            onClick={handleChatBaru}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[#E3E7EE] text-[#253254] hover:bg-[#F2F5F9] flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Chat Baru</span>
          </button>
        </div>
      </div>

      {/* Banner Pesan Error Ramah (Jika AI Sibuk) */}
      {friendlyError && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{friendlyError}</span>
          </div>
          <button
            onClick={() => runPipeline()}
            className="px-4 py-1.5 bg-[#253254] hover:bg-[#1f2845] text-white rounded font-bold text-xs shrink-0 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Banner Klien Lanjutan */}
      {klienLanjutan && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Lanjutan percakapan dengan <strong>{klienLanjutan.nama}</strong> (penawaran {klienLanjutan.nomor} senilai {formatRupiah(klienLanjutan.total)}, {klienLanjutan.tanggal})
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded">
            Riwayat Tersambung
          </span>
        </div>
      )}

      {/* Pilihan Kasus Terakhir (Jika Belum Menempel Screenshot) */}
      {kasusTerakhirList.length > 0 && !extraction && images.length === 0 && !pastedText && (
        <div className="p-3.5 bg-white border border-[#E3E7EE] rounded-xl space-y-2 text-xs shadow-sm">
          <span className="text-[11px] font-bold text-[#6B7385] uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-[#275087]" />
            Lanjutkan Kasus Terakhir (5 Kasus Terbaru):
          </span>
          <div className="flex flex-wrap gap-2">
            {kasusTerakhirList.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => handlePilihKasusLanjutan(k)}
                className="px-3 py-1.5 bg-[#F2F5F9] hover:bg-[#E8EEF5] text-[#253254] rounded-lg text-xs font-medium border border-[#E3E7EE] transition cursor-pointer"
              >
                {k.nama_klien} ({k.nomor} · {formatRupiah(k.total_nilai)})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Indikator Progres Bertahap + Stopwatch Timer */}
      {isProcessing && (
        <div className="p-3 bg-[#F2F5F9] rounded-xl border border-[#E3E7EE] flex items-center justify-between text-xs font-medium text-[#253254] shadow-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#275087]" />
            <span className={currentStep === 'ekstrak' ? 'font-bold text-[#275087]' : 'text-emerald-700'}>
              Membaca chat {currentStep !== 'ekstrak' ? '✓' : '…'}
            </span>
            <span className="text-[#98A0B0]">→</span>
            <span className={currentStep === 'hitung' ? 'font-bold text-[#275087]' : currentStep === 'draf' ? 'text-emerald-700' : 'text-[#98A0B0]'}>
              Menghitung harga {currentStep === 'draf' ? '✓' : currentStep === 'hitung' ? '…' : ''}
            </span>
            <span className="text-[#98A0B0]">→</span>
            <span className={currentStep === 'draf' ? 'font-bold text-[#275087]' : 'text-[#98A0B0]'}>
              Menyusun balasan…
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] tabular-nums font-mono text-[#6B7385]">
            <Clock className="w-3.5 h-3.5 text-[#275087]" />
            <span>{elapsedSeconds.toFixed(1).replace('.', ',')} dtk</span>
            <span className="bg-white border border-[#E3E7EE] px-1.5 py-0.5 rounded text-[10px]">
              {modeTeliti ? 'gemini-4-argon' : 'auto-racing'}
            </span>
          </div>
        </div>
      )}

      {/* Layout 2 Kolom: Kiri (Screenshot + Catatan 35%) | Kanan (DRAF Area Utama 65%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KOLOM KIRI (4 / 12) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-[#E3E7EE] shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#F2F5F9]">
            <h2 className="text-xs font-bold text-[#253254] uppercase tracking-wider">
              Screenshot &amp; Catatan
            </h2>
            <span className="text-[11px] text-[#6B7385] tabular-nums font-mono">{images.length}/5 gambar</span>
          </div>

          {/* Area Tempel / Drop */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#BFCBD9] hover:border-[#275087] rounded-xl p-5 text-center cursor-pointer transition bg-[#F2F5F9]/40 hover:bg-[#F2F5F9]"
          >
            <Upload className="w-6 h-6 mx-auto text-[#98A0B0] mb-1.5" />
            <p className="text-xs font-bold text-[#253254]">Tempel screenshot (Ctrl+V)</p>
            <p className="text-[10px] text-[#6B7385] mt-0.5">atau klik untuk memilih file</p>
            <p className="text-[10px] text-amber-800 mt-2 font-medium bg-amber-50 py-1 px-2 rounded inline-block">
              Potong bagian atas (nama &amp; nomor klien) sebelum menempel.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Thumbnail Strip */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative rounded-lg border border-[#E3E7EE] overflow-hidden group">
                  <img src={img.previewUrl} alt={`Upload ${i + 1}`} className="w-full h-16 object-cover" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setImages((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded p-0.5 text-[10px]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Catatan / Teks Chat Manual */}
          <div>
            <label className="block text-[11px] font-semibold text-[#6B7385] mb-1">
              Catatan / Teks Chat Manual
            </label>
            <textarea
              ref={textareaRef}
              rows={3}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Ketik atau tempel teks (Enter = baris baru, Ctrl+Enter = Buat Draf)..."
              className="w-full text-xs p-2.5 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none"
            />

            {/* Tombol Buat Draf (Mode Teks Manual) */}
            <button
              type="button"
              id="btn-buat-draf-manual"
              onClick={() => runPipeline()}
              disabled={isProcessing || (!pastedText.trim() && images.length === 0)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#275087] hover:bg-[#1f4270] text-white rounded-lg text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Buat Draf</span>
            </button>
          </div>
        </div>

        {/* KOLOM KANAN (8 / 12) - DRAF AREA UTAMA */}
        <div className="lg:col-span-8 bg-white p-6 rounded-xl border border-[#E3E7EE] shadow-sm space-y-4">
          {/* Baris Ringkas Hasil Ekstraksi (1 Baris + Tombol Ubah) */}
          {summaryLine && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#F2F5F9] border border-[#E3E7EE] rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-[#253254]">{summaryLine}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingExtraction(!isEditingExtraction)}
                className="text-[11px] font-bold text-[#275087] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                {isEditingExtraction ? 'Tutup form' : '✎ ubah'}
              </button>
            </div>
          )}

          {/* Form Editable Ekstraksi (Collapsible) */}
          {isEditingExtraction && extraction && (
            <div className="p-4 bg-white border border-[#E3E7EE] rounded-xl space-y-3 text-xs shadow-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[#6B7385] mb-1">Nama Klien</label>
                  <input
                    type="text"
                    value={extraction.nama_klien || ''}
                    onChange={(e) => setExtraction({ ...extraction, nama_klien: e.target.value })}
                    className="w-full text-xs p-1.5 border border-[#E3E7EE] rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6B7385] mb-1">Kota</label>
                  <input
                    type="text"
                    value={extraction.kota || ''}
                    onChange={(e) => setExtraction({ ...extraction, kota: e.target.value })}
                    className="w-full text-xs p-1.5 border border-[#E3E7EE] rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6B7385] mb-1">Kanal</label>
                  <select
                    value={kanal}
                    onChange={(e) => setKanal(e.target.value)}
                    className="w-full text-xs p-1.5 border border-[#E3E7EE] rounded"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="shopee">Shopee</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => runPipeline(undefined, undefined, undefined, extraction)}
                  className="px-3.5 py-1.5 bg-[#253254] text-white rounded font-bold text-xs cursor-pointer"
                >
                  Buat Ulang Draf
                </button>
              </div>
            </div>
          )}

          {/* DRAF CONTENT */}
          {!draftResult ? (
            <div className="py-20 text-center space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-[#BFCBD9]" />
              <p className="text-sm font-semibold text-[#253254]">Area Draf Balasan</p>
              <p className="text-xs text-[#6B7385]">
                Tempel screenshot chat klien (Ctrl+V) atau ketik pesan manual untuk melihat draf balasan.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header Draf: Strategi Tabs & Model Digunakan */}
              <div className="flex items-center justify-between border-b border-[#F2F5F9] pb-3">
                <div className="flex gap-2">
                  {draftResult.draf?.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveDraftIdx(i)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        activeDraftIdx === i ? 'bg-[#253254] text-white' : 'bg-[#F2F5F9] text-[#6B7385] hover:bg-[#E3E7EE]'
                      }`}
                    >
                      {d.label || `Versi ${i + 1}`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {draftHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const [prevDraft, ...rest] = draftHistory;
                        if (prevDraft) {
                          setDraftResult(prevDraft);
                          setDraftHistory(rest);
                          setActiveDraftIdx(0);
                        }
                      }}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-sm"
                      title="Undo ke draf sebelum revisi terakhir"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>↶ Kembali ke draf sebelumnya ({draftHistory.length})</span>
                    </button>
                  )}
                  {draftResult.is_fallback ? (
                    <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                      dibuat dengan model cadangan ({draftResult.model_used || actualModel})
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">
                      model: {draftResult.model_used || actualModel || 'gemini-3.8-flash'}
                    </span>
                  )}
                  {revisiElapsed !== null ? (
                    <span className="text-[10px] text-blue-900 font-bold tabular-nums font-mono bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      ⏱️ {revisiElapsed.toFixed(1).replace('.', ',')}s (revisi)
                    </span>
                  ) : browserTotalSeconds !== null ? (
                    <span className="text-[10px] text-[#253254] font-bold tabular-nums font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                      ⏱️ {browserTtftSeconds?.toFixed(1).replace('.', ',')}s (teks 1) · {browserTotalSeconds.toFixed(1).replace('.', ',')}s (lengkap)
                    </span>
                  ) : finalElapsed !== null ? (
                    <span className="text-[10px] text-[#253254] font-bold tabular-nums font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                      ⏱️ {finalElapsed.toFixed(1).replace('.', ',')}s
                    </span>
                  ) : durasiPipeline ? (
                    <span className="text-[10px] text-[#6B7385] tabular-nums font-mono">
                      {Math.round(durasiPipeline.total_ms / 100) / 10}s
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Banner Peringatan Keamanan AI jika ada */}
              {draftResult.angka_tidak_terverifikasi && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span>Angka Tidak Terverifikasi (Tombol Salin Dinonaktifkan)</span>
                  </div>
                  {draftResult.error_validasi_angka?.map((err, i) => (
                    <p key={i} className="text-[11px]">• {err}</p>
                  ))}
                </div>
              )}

              {draftResult.perlu_owner && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Konfirmasi Owner Dulu:</span>
                    <p className="text-[11px] mt-0.5">{draftResult.alasan_perlu_owner || 'Permintaan memerlukan konfirmasi owner.'}</p>
                  </div>
                </div>
              )}

              {/* Indikator Revisi Cepat Berjalan */}
              {isRevising && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-[#275087] animate-pulse">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#275087]" />
                    <span className="font-semibold">Merevisi draf: &ldquo;{revisiInstruction}&rdquo;...</span>
                  </div>
                  <span className="font-mono tabular-nums font-bold">{revisiSeconds.toFixed(1).replace('.', ',')}s</span>
                </div>
              )}

              {/* Chat Bubbles */}
              <div className={isRevising ? 'space-y-3 opacity-40 pointer-events-none transition-opacity' : 'space-y-3 transition-opacity'}>
                {draftResult.draf?.[activeDraftIdx]?.bubbles?.map((bubble, bIdx) => (
                  <div
                    key={bIdx}
                    className="p-4 bg-[#F2F5F9] rounded-2xl border border-[#E3E7EE] text-sm relative group hover:border-[#BFCBD9] transition"
                  >
                    <p className="whitespace-pre-wrap text-[#1B2233] pr-8 leading-relaxed font-sans">{bubble}</p>
                    <button
                      onClick={() => handleCopyBubble(bubble, bIdx)}
                      disabled={draftResult.angka_tidak_terverifikasi}
                      className="absolute top-3 right-3 text-[#98A0B0] hover:text-[#253254] p-1 rounded transition cursor-pointer"
                      title="Salin bubble ini"
                    >
                      {copiedBubbleIdx === bIdx ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {/* Tombol Utama Salin (Besar) & Buat Penawaran */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  id="btn-salin-utama"
                  onClick={() => handleCopyAll(draftResult.draf?.[activeDraftIdx]?.bubbles || [])}
                  disabled={draftResult.angka_tidak_terverifikasi}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#253254] hover:bg-[#1f2845] text-white font-bold text-sm py-3 rounded-xl shadow-md disabled:opacity-40 transition cursor-pointer"
                >
                  {copiedAll ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  <span>{copiedAll ? 'Draf Berhasil Disalin!' : 'Salin Draf (Ctrl+Enter)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleBuatPenawaran}
                  className="px-5 py-3 bg-white border border-[#BFCBD9] hover:bg-[#F2F5F9] text-[#253254] font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-[#275087]" />
                  <span>Buat Penawaran PDF</span>
                </button>
              </div>

              {/* Banner Setelah Salin: Konfirmasi Pengiriman & Memori */}
              {showConfirmSent && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Sudah dikirim ke klien?</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTandaiTerkirim('DP')}
                      disabled={isMarkingSent}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer"
                    >
                      {isMarkingSent ? 'Menyimpan...' : 'Ya, Tandai Terkirim'}
                    </button>
                    <button
                      onClick={() => setShowConfirmSent(false)}
                      className="px-2.5 py-1.5 text-[#6B7385] hover:text-[#1B2233] cursor-pointer"
                    >
                      Belum
                    </button>
                  </div>
                </div>
              )}

              {sentSuccess && (
                <div className="p-3 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Berhasil dicatat ke kasus dan disimpan sebagai memori tim!</span>
                </div>
              )}

              {/* Chip Revisi Cepat (Di Bawah Draf) */}
              <div className="pt-4 border-t border-[#E3E7EE] space-y-2">
                <span className="text-[11px] font-bold text-[#6B7385] uppercase tracking-wider block">
                  Revisi Cepat (1 Klik = Tulis Ulang Draf):
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Dorong DP', text: 'Dorong komitmen DP hari ini dengan sopan' },
                    { label: 'Edukasi Nilai Dulu', text: 'Jelaskan kualitas kaca 5mm dan bevel 10mm sebelum sebut harga' },
                    { label: 'Lebih Singkat', text: 'Buat pesan sangat singkat dan padat 1-2 bubble' },
                    { label: 'Tawarkan Opsi Hemat', text: 'Tawarkan ukuran sedikit lebih kecil atau varian Basic' },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      disabled={isRevising}
                      onClick={() => runRevisi(chip.text)}
                      className="px-3 py-1.5 bg-[#F2F5F9] hover:bg-[#E3E7EE] active:bg-[#D5DCE5] text-[#253254] rounded-lg text-xs font-medium border border-[#E3E7EE] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-1.5"
                    >
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
