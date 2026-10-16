'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  validateRupiahInDraft,
  validateMarketplaceGuards,
  validateForbiddenPhrases,
  detectBrokenSentence,
} from '@/lib/ai/validator';
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
  const isProEnvEnabled = process.env.NEXT_PUBLIC_GEMINI_PRO_ENABLED === 'true';

  // Input & Upload State
  const [images, setImages] = useState<ScreenshotItem[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [kanal, setKanal] = useState('whatsapp');
  const [modeTeliti, setModeTeliti] = useState(false);

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
  const [customRevisiText, setCustomRevisiText] = useState('');
  const [revisiSeconds, setRevisiSeconds] = useState(0);
  const revisiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [revisiElapsed, setRevisiElapsed] = useState<number | null>(null);

  // Riwayat Versi Draf untuk Undo
  const [draftHistory, setDraftHistory] = useState<DraftReplyOutput[]>([]);

  // Browser-side timing
  const [browserTtftSeconds, setBrowserTtftSeconds] = useState<number | null>(null);
  const [browserTotalSeconds, setBrowserTotalSeconds] = useState<number | null>(null);

  // Kasus Terakhir
  const [kasusTerakhirList, setKasusTerakhirList] = useState<KasusTerakhirItem[]>([]);

  // UI Interactive States
  const [isEditingExtraction, setIsEditingExtraction] = useState(false);
  const [editingBubbleIdx, setEditingBubbleIdx] = useState<number | null>(null);
  const [copiedBubbleIdx, setCopiedBubbleIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showConfirmSent, setShowConfirmSent] = useState(false);
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Muat 5 Kasus Terakhir & Pulihkan draf input admin dari sessionStorage jika ada
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('balas_chat_draft_input');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.pastedText) setPastedText(parsed.pastedText);
        if (parsed.kanal) setKanal(parsed.kanal);
      }
    } catch (e) {
      console.warn('Gagal memulihkan draf input:', e);
    }

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

  // Simpan input admin ke sessionStorage secara otomatis agar tidak hilang saat refresh
  useEffect(() => {
    try {
      if (pastedText.trim()) {
        sessionStorage.setItem(
          'balas_chat_draft_input',
          JSON.stringify({ pastedText, kanal })
        );
      } else {
        sessionStorage.removeItem('balas_chat_draft_input');
      }
    } catch (e) {
      console.warn('Gagal menyimpan draf input:', e);
    }
  }, [pastedText, kanal]);

  // Helper kompresi gambar
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
      setFinalElapsed(null);

      setElapsedSeconds(0);
      const t0 = Date.now();
      clearInterval(stopwatchIntervalRef.current || undefined);
      stopwatchIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.round((Date.now() - t0) / 100) / 10);
      }, 100);

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
            klien_lanjutan: klienLanjutan,
          }),
        });

        clearTimeout(hitungTimer);
        clearTimeout(drafTimer);
        clearInterval(stopwatchIntervalRef.current || undefined);
        const totalDurationSec = Math.round((Date.now() - t0) / 100) / 10;
        const json = await res.json();
        const ttftSec = json.durasi?.ttft_ms
          ? Math.round(json.durasi.ttft_ms / 100) / 10
          : Math.round(totalDurationSec * 0.4 * 10) / 10;

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
          setFriendlyError(
            json.error || 'Server AI sedang sibuk. Screenshot & catatan tetap tersimpan, klik Coba Lagi.'
          );
        }
      } catch {
        clearTimeout(hitungTimer);
        clearTimeout(drafTimer);
        clearInterval(stopwatchIntervalRef.current || undefined);
        setFriendlyError(
          'Server AI sedang sibuk. Screenshot & catatan tetap tersimpan, klik Coba Lagi.'
        );
      } finally {
        setIsProcessing(false);
        setCurrentStep('idle');
      }
    },
    [images, pastedText, kanal, modeTeliti]
  );

  // Eksekusi Revisi Kilat 1-Panggilan
  const runRevisi = async (instruksi: string) => {
    if (!draftResult || isRevising) return;
    const currentBubbles = draftResult.draf?.[activeDraftIdx]?.bubbles || [];
    if (currentBubbles.length === 0) return;

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
      setIsRevising(false);
    }
  };

  // Tangani Paste (Ctrl+V)
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
      let hasNonImage = false;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) newImages.push(file);
        } else if (item.kind === 'file' && item.type.indexOf('image') === -1) {
          hasNonImage = true;
        } else if (item.type === 'text/plain') {
          item.getAsString((s) => {
            if (s && s.trim()) textPasted = s;
          });
        }
      }

      if (hasNonImage) {
        alert('Hanya berkas gambar (screenshot) yang diperbolehkan');
        return;
      }

      if (newImages.length > 0) {
        if (images.length + newImages.length > 5) {
          alert('Maksimal 5 screenshot per permintaan');
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

  const handleCopyAll = useCallback(() => {
    if (!draftResult?.draf?.[activeDraftIdx]?.bubbles) return;
    if (draftResult.angka_tidak_terverifikasi) return;
    const fullText = draftResult.draf[activeDraftIdx].bubbles.join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setShowConfirmSent(true);
    setTimeout(() => setCopiedAll(false), 2500);
  }, [draftResult, activeDraftIdx]);

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
            handleCopyAll();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftResult, activeDraftIdx, pastedText, images, runPipeline, handleCopyAll]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    // Tolak jika ada berkas bukan gambar
    const nonImage = files.find((f) => !f.type.startsWith('image/'));
    if (nonImage) {
      alert(`Berkas "${nonImage.name}" bukan gambar. Hanya berkas gambar yang diperbolehkan.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Tolak jika total gambar melebihi 5
    if (images.length + files.length > 5) {
      alert('Maksimal 5 screenshot per permintaan');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const resized = await Promise.all(files.map(resizeImage));
    const updated = [...images, ...resized].slice(0, 5);
    setImages(updated);
    if (fileInputRef.current) fileInputRef.current.value = '';
    clearTimeout(debounceTimerRef.current || undefined);
    debounceTimerRef.current = setTimeout(() => {
      runPipeline(updated, pastedText);
    }, 500);
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleCopyBubble = (text: string, idx: number) => {
    if (draftResult?.angka_tidak_terverifikasi) return;
    navigator.clipboard.writeText(text);
    setCopiedBubbleIdx(idx);
    setShowConfirmSent(true);
    setTimeout(() => setCopiedBubbleIdx(null), 2500);
  };

  const handleUpdateBubbleText = (newText: string, bIdx: number) => {
    if (!draftResult?.draf?.[activeDraftIdx]?.bubbles) return;
    const updatedBubbles = [...draftResult.draf[activeDraftIdx].bubbles];
    updatedBubbles[bIdx] = newText;

    const calculatedNumbers = draftResult.angka_dipakai || [];
    const rupVal = validateRupiahInDraft(updatedBubbles, calculatedNumbers, calculatedNumbers);
    const mktVal = validateMarketplaceGuards(kanal, updatedBubbles);
    const forbVal = validateForbiddenPhrases(updatedBubbles);
    const sentVal = detectBrokenSentence(updatedBubbles);

    const isInvalid = !rupVal.valid || !mktVal.valid || !forbVal.valid || sentVal.isBroken;

    setDraftResult({
      ...draftResult,
      draf: draftResult.draf.map((d, dIdx) =>
        dIdx === activeDraftIdx ? { ...d, bubbles: updatedBubbles } : d
      ),
      angka_tidak_terverifikasi: isInvalid,
      error_validasi_angka: rupVal.errors,
      pelanggaran_marketplace: mktVal.errors,
      frasa_terlarang_ditemukan: forbVal.errors,
    });
  };


  const handleTandaiTerkirim = async () => {
    setIsMarkingSent(true);
    try {
      const res = await fetch('/api/balas/terkirim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: klienLanjutan ? undefined : undefined,
          nama_klien: extraction?.nama_klien || 'Klien Chat',
          kota: extraction?.kota || 'Bandung',
          kanal: kanal,
          balasan_text: draftResult?.draf?.[activeDraftIdx]?.bubbles?.join('\n\n') || '',
          spesifikasi: extraction?.items?.[0] || {},
          total_penawaran: draftResult?.angka_dipakai?.[0] || 0,
        }),
      });

      if (res.ok) {
        setSentSuccess(true);
        setShowConfirmSent(false);
        try { sessionStorage.removeItem('balas_chat_draft_input'); } catch {}
      }
    } catch (err) {
      console.warn('Gagal mencatat status terkirim:', err);
    } finally {
      setIsMarkingSent(false);
    }
  };

  const handleBuatPenawaranPDF = () => {
    if (!extraction) {
      router.push('/penawaran/baru');
      return;
    }
    const item = extraction.items?.[0];
    const params = new URLSearchParams({
      nama: extraction.nama_klien || '',
      kota: extraction.kota || '',
      kanal: kanal,
      bentuk: item?.bentuk || 'rectangle',
      panjang: item?.ukuran_1_cm?.toString() || '60',
      lebar: item?.ukuran_2_cm?.toString() || '80',
      lampu: item?.lampu || '3_warna',
      kontrol: item?.kontrol || 'touchscreen',
      frame: item?.frame || 'tanpa',
      antifog: item?.antifog ? 'true' : 'false',
    });
    router.push(`/penawaran/baru?${params.toString()}`);
  };

  const handleChatBaru = () => {
    try { sessionStorage.removeItem('balas_chat_draft_input'); } catch {}
    setImages([]);
    setPastedText('');
    setExtraction(null);
    setDraftResult(null);
    setDraftHistory([]);
    setFriendlyError(null);
    setShowConfirmSent(false);
    setSentSuccess(false);
    setActualModel(null);
    setFinalElapsed(null);
    setRevisiElapsed(null);
    setBrowserTtftSeconds(null);
    setBrowserTotalSeconds(null);
  };

  const handlePilihKasusLanjutan = (k: KasusTerakhirItem) => {
    setPastedText(`Lanjutkan pembicaraan dengan ${k.nama_klien} (${k.nomor})`);
    setKlienLanjutan({
      nomor: k.nomor,
      total: k.total_nilai,
      tanggal: k.tanggal,
      nama: k.nama_klien,
    });
    setKanal(k.spesifikasi?.kanal || 'whatsapp');
    if (k.spesifikasi) {
      setExtraction({
        nama_klien: k.nama_klien,
        platform: k.spesifikasi.kanal || 'whatsapp',
        pesan: [],
        waktu_pesan_terakhir_klien: null,
        kota: k.kota,
        zona: k.zona,
        items: [
          {
            bentuk: k.spesifikasi.bentuk || 'rectangle',
            ukuran_1_cm: k.spesifikasi.panjang_cm || 60,
            ukuran_2_cm: k.spesifikasi.lebar_cm || 80,
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

  const lastClientMessage = useMemo(() => {
    if (!pastedText.trim() && (!extraction?.pesan || extraction.pesan.length === 0)) {
      return null;
    }
    if (extraction?.pesan && extraction.pesan.length > 0) {
      const last = extraction.pesan[extraction.pesan.length - 1];
      return last?.teks || null;
    }
    return pastedText.slice(0, 160);
  }, [pastedText, extraction]);

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Header Halaman (30px/800) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-[30px] font-extrabold text-ink leading-tight flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-accent" />
            <span>Balas Chat Otomatis</span>
          </h1>
          <p className="text-muted text-sm mt-1">
            Tekan <kbd className="px-2 py-0.5 bg-surface border border-line rounded-md text-xs font-semibold text-ink">Ctrl+V</kbd> di mana saja untuk tempel screenshot &amp; mulai otomatis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isProEnvEnabled && (
            <button
              type="button"
              onClick={() => setModeTeliti(!modeTeliti)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer border ${
                modeTeliti
                  ? 'bg-tint text-accent border-accent'
                  : 'bg-surface text-muted border-line hover:bg-raised'
              }`}
            >
              <Sparkle className="w-4 h-4 text-accent" />
              <span>Mode Teliti {modeTeliti ? '(Aktif)' : ''}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleChatBaru}
            className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold bg-surface border border-line text-ink hover:bg-raised flex items-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Chat Baru</span>
          </button>
        </div>
      </div>

      {/* Banner Pesan Error Ramah (Jika AI Sibuk) */}
      {friendlyError && (
        <div className="p-4 bg-warn-bg border border-warn/30 rounded-[18px] text-warn text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-none">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-warn shrink-0" />
            <span>{friendlyError}</span>
          </div>
          <button
            onClick={() => runPipeline()}
            className="min-h-[44px] px-5 py-2 bg-rail hover:opacity-90 text-white rounded-xl font-bold text-sm shrink-0 cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Banner Klien Lanjutan */}
      {klienLanjutan && (
        <div className="p-4 bg-tint/60 border border-line rounded-[18px] text-ink text-sm flex items-center justify-between shadow-none">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-accent shrink-0" />
            <span>
              Lanjutan percakapan dengan <strong className="font-bold text-accent">{klienLanjutan.nama}</strong> (penawaran {klienLanjutan.nomor} senilai {formatRupiah(klienLanjutan.total)}, {klienLanjutan.tanggal})
            </span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-surface border border-line rounded-lg text-muted">
            Riwayat Tersambung
          </span>
        </div>
      )}

      {/* Rekomendasi Kasus Lanjutan */}
      {kasusTerakhirList.length > 0 && !extraction && images.length === 0 && !pastedText && (
        <div className="p-4 bg-surface border border-line rounded-[18px] space-y-2.5 shadow-none">
          <span className="text-xs font-bold text-muted block">
            Lanjutkan percakapan dari penawaran terakhir:
          </span>
          <div className="flex flex-wrap gap-2">
            {kasusTerakhirList.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => handlePilihKasusLanjutan(k)}
                className="min-h-[44px] px-3.5 py-2 bg-raised hover:bg-tint text-ink border border-line rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                <span>{k.nama_klien}</span>
                <span className="text-muted">({k.nomor} · {formatRupiah(k.total_nilai)})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Indikator Progres Bertahap + Stopwatch Timer */}
      {isProcessing && (
        <div className="p-4 bg-surface rounded-[18px] border border-line flex items-center justify-between text-sm font-medium text-ink shadow-none">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <span className={currentStep === 'ekstrak' ? 'font-bold text-accent' : 'text-ok font-semibold'}>
              Membaca chat {currentStep !== 'ekstrak' ? '✓' : '…'}
            </span>
            <span className="text-muted">→</span>
            <span className={currentStep === 'hitung' ? 'font-bold text-accent' : currentStep === 'draf' ? 'text-ok font-semibold' : 'text-muted'}>
              Menghitung harga {currentStep === 'draf' ? '✓' : currentStep === 'hitung' ? '…' : ''}
            </span>
            <span className="text-muted">→</span>
            <span className={currentStep === 'draf' ? 'font-bold text-accent' : 'text-muted'}>
              Menyusun balasan…
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs tabular-nums text-muted">
            <Clock className="w-4 h-4 text-accent" />
            <span className="font-bold text-ink">{elapsedSeconds.toFixed(1).replace('.', ',')} dtk</span>
          </div>
        </div>
      )}

      {/* Layout 2 Kolom: Kiri (Catatan & Screenshot 35%) | Kanan (Panel Cermin LED 65%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KOLOM KIRI (Panel Radius 18-20px) */}
        <div className="lg:col-span-5 bg-surface p-4 sm:p-6 rounded-[20px] border border-line shadow-none space-y-5 max-w-full overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-ink">Screenshot &amp; Catatan</h2>
            <span className="text-xs text-muted font-medium">{images.length}/5 gambar</span>
          </div>

          {/* Area Tempel Screenshot */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-line rounded-[18px] p-6 text-center hover:border-accent/40 bg-raised transition cursor-pointer space-y-2 select-none"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*"
              className="hidden"
            />
            <div className="w-10 h-10 mx-auto rounded-full bg-tint flex items-center justify-center text-accent">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                Tempel screenshot (<kbd className="font-mono text-xs">Ctrl+V</kbd>)
              </p>
              <p className="text-xs text-muted mt-0.5">atau klik untuk memilih file</p>
            </div>
            <p className="text-[11px] text-warn font-medium pt-1">
              Potong bagian atas (nama &amp; nomor klien) sebelum menempel.
            </p>
          </div>

          {/* Thumbnail Gambar */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {images.map((img, i) => (
                <div key={i} className="relative group w-16 h-16 rounded-xl border border-line overflow-hidden bg-raised">
                  <img src={img.previewUrl} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(i);
                    }}
                    className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    title="Hapus gambar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea Pesan Manual */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted block">
              Catatan / Teks Chat Manual:
            </label>
            <textarea
              ref={textareaRef}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Ketik atau tempel teks (Enter = baris baru, Ctrl+Enter = Buat Draf)..."
              rows={4}
              className="w-full p-3.5 bg-raised border border-line rounded-xl text-ink text-[15px] focus:outline-none focus:border-accent transition resize-none placeholder:text-muted/60"
            />
          </div>

          {/* Kanal Selector & Tombol Buat Draf */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-muted font-medium">Kanal Chat:</span>
              <div className="flex flex-wrap gap-1.5">
                {['whatsapp', 'instagram', 'tiktok', 'shopee'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setKanal(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                      kanal === p
                        ? 'bg-accent text-accent-ink border-accent'
                        : 'bg-raised text-muted border-line hover:bg-tint'
                    }`}
                  >
                    {p === 'whatsapp' ? 'WhatsApp' : p === 'instagram' ? 'Instagram' : p === 'tiktok' ? 'TikTok' : 'Shopee'}
                  </button>
                ))}
              </div>
            </div>
            {(kanal === 'shopee' || kanal === 'tiktok') && (
              <div className="p-2.5 bg-tint border border-line rounded-xl text-xs text-ink flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-accent shrink-0" />
                <span>
                  Guardrail Marketplace Aktif: Draf otomatis memblokir nomor WA, rekening bank, dan ajakan transaksi luar.
                </span>
              </div>
            )}

            <button
              type="button"
              id="btn-buat-draf"
              onClick={() => runPipeline()}
              disabled={isProcessing || (images.length === 0 && !pastedText.trim() && !extraction)}
              className="w-full min-h-[44px] bg-accent text-accent-ink rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition cursor-pointer shadow-none focus-visible:outline-2 focus-visible:outline-accent"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Buat Draf</span>
            </button>
          </div>
        </div>

        {/* KOLOM KANAN: PANEL DRAF = "CERMIN LED" */}
        <div className="lg:col-span-7 cermin-led-panel p-4 sm:p-6 md:p-8 space-y-6 max-w-full overflow-hidden">
          {/* Garis LED 2px di tepi atas dengan Glow */}
          <div className={`led-line ${isProcessing ? 'led-pulse' : ''}`} />

          {!draftResult ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-tint flex items-center justify-center text-accent">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="text-[17px] font-bold text-ink">Area Draf Balasan</p>
              <p className="text-sm text-muted max-w-sm mx-auto">
                Tempel screenshot chat klien (<kbd className="font-mono text-xs">Ctrl+V</kbd>) atau ketik pesan manual untuk melihat draf balasan.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Header: Angka Terverifikasi + Model + Durasi */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-ok shadow-[0_0_6px_var(--ok)]" />
                  <span className="text-sm font-bold text-ink">Angka terverifikasi</span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {draftHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const [prev, ...rest] = draftHistory;
                        if (prev) {
                          setDraftResult(prev);
                          setDraftHistory(rest);
                          setActiveDraftIdx(0);
                        }
                      }}
                      className="min-h-[44px] px-3 py-1.5 bg-warn-bg text-warn border border-warn/30 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title="Undo ke draf sebelum revisi terakhir"
                    >
                      <Undo2 className="w-4 h-4" />
                      <span>Urungkan (versi {draftHistory.length})</span>
                    </button>
                  )}

                  <span className="text-xs text-muted font-medium">
                    {draftResult.model_used || actualModel || 'gemini-3.5-flash-lite'}
                  </span>

                  {revisiElapsed !== null ? (
                    <span className="text-xs font-bold tabular-nums px-2.5 py-1 bg-tint text-accent rounded-lg">
                      ⏱️ {revisiElapsed.toFixed(1).replace('.', ',')}s (revisi)
                    </span>
                  ) : browserTotalSeconds !== null ? (
                    <span className="text-xs font-bold tabular-nums px-2.5 py-1 bg-ok-bg text-ok rounded-lg">
                      ⏱️ {browserTtftSeconds?.toFixed(1).replace('.', ',')}s (teks 1) · {browserTotalSeconds.toFixed(1).replace('.', ',')}s (lengkap)
                    </span>
                  ) : finalElapsed !== null ? (
                    <span className="text-xs font-bold tabular-nums px-2.5 py-1 bg-ok-bg text-ok rounded-lg">
                      ⏱️ {finalElapsed.toFixed(1).replace('.', ',')}s
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Kotak Data Hasil Baca (Klien, Kota, Kebutuhan, Kanal + Ubah data) */}
              {extraction && (
                <div className="p-4 bg-raised border border-line rounded-[18px] text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-ink">
                      <span className="font-bold">{extraction.nama_klien || 'Klien'}</span>
                      <span className="text-muted">·</span>
                      <span>{extraction.kota || 'Kota belum disebut'}</span>
                      <span className="text-muted">·</span>
                      <span>{extraction.items?.[0] ? `${extraction.items[0].bentuk || 'Cermin'} ${extraction.items[0].ukuran_1_cm || 60}×${extraction.items[0].ukuran_2_cm || 80} cm` : 'Cermin LED'}</span>
                      <span className="text-muted">·</span>
                      <span className="capitalize text-muted">{kanal}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsEditingExtraction(!isEditingExtraction)}
                      className="min-h-[44px] px-3 py-1.5 text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEditingExtraction ? 'Tutup form' : 'Ubah data'}</span>
                    </button>
                  </div>

                  {/* Form Ubah Data jika dibuka */}
                  {isEditingExtraction && (
                    <div className="pt-3 border-t border-line space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-muted mb-1">Nama Klien</label>
                          <input
                            type="text"
                            value={extraction.nama_klien || ''}
                            onChange={(e) => setExtraction({ ...extraction, nama_klien: e.target.value })}
                            className="w-full text-xs p-2 bg-surface border border-line rounded-lg text-ink"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted mb-1">Kota</label>
                          <input
                            type="text"
                            value={extraction.kota || ''}
                            onChange={(e) => setExtraction({ ...extraction, kota: e.target.value })}
                            className="w-full text-xs p-2 bg-surface border border-line rounded-lg text-ink"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted mb-1">Kanal</label>
                          <select
                            value={kanal}
                            onChange={(e) => setKanal(e.target.value)}
                            className="w-full text-xs p-2 bg-surface border border-line rounded-lg text-ink"
                          >
                            <option value="whatsapp">WhatsApp</option>
                            <option value="instagram">Instagram</option>
                            <option value="tiktok">TikTok</option>
                            <option value="shopee">Shopee</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => runPipeline(undefined, undefined, undefined, extraction)}
                          className="min-h-[44px] px-4 py-2 bg-accent text-accent-ink rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Hitung &amp; Buat Ulang Draf
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Peringatan Merah: Angka Berbeda dari Snapshot Penawaran Tersimpan */}
              {draftResult.discrepancy_warning && (
                <div className="p-4 bg-warn-bg border border-warn text-warn rounded-[18px] text-sm flex items-center gap-2.5 font-bold shadow-none">
                  <AlertTriangle className="w-5 h-5 text-warn shrink-0" />
                  <span>Angka di percakapan berbeda dengan penawaran tersimpan. Cek rincian sebelum mengirim.</span>
                </div>
              )}

              {/* Peringatan Kuning: Nomor Rekening Belum Diatur */}
              {draftResult.rekening_kosong && (
                <div className="p-4 bg-[#FFF9E6] dark:bg-[#2A2312] border border-[#E3A857] text-[#9A6700] dark:text-[#F3C474] rounded-[18px] text-sm flex items-center justify-between gap-3 shadow-none">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-[#E3A857] shrink-0" />
                    <span className="font-semibold">Nomor rekening belum diatur di Pengaturan. Kirim rekening manual ke klien.</span>
                  </div>
                  <Link href="/pengaturan/buku-harga" className="text-xs font-bold underline hover:opacity-80 shrink-0">
                    Atur Sekarang
                  </Link>
                </div>
              )}

              {/* Peringatan Kuning: Permintaan Memerlukan Persetujuan Owner */}
              {draftResult.perlu_owner && (
                <div className="p-4 bg-[#FFF9E6] dark:bg-[#2A2312] border border-[#E3A857] text-[#9A6700] dark:text-[#F3C474] rounded-[18px] text-sm flex items-center justify-between gap-3 shadow-none">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-[#E3A857] shrink-0" />
                    <span className="font-semibold">
                      {draftResult.alasan_perlu_owner?.toLowerCase().includes('ongkir')
                        ? `Klien minta ongkir dibagi dua. Boleh disetujui, maksimal 50% (klien bayar minimal ${formatRupiah(extraction?.kota && /bandung|cimahi/i.test(extraction.kota) ? 375000 : 650000)}).`
                        : draftResult.alasan_perlu_owner?.toLowerCase().includes('potongan') || draftResult.alasan_perlu_owner?.toLowerCase().includes('diskon')
                        ? 'Klien minta potongan harga. Tanya owner dulu sebelum menjawab.'
                        : 'Klien meminta negosiasi khusus. Tanya owner dulu sebelum menjawab.'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 bg-[#E3A857]/20 rounded-lg shrink-0">
                    Terkunci
                  </span>
                </div>
              )}

              {/* Peringatan Merah: Angka Tidak Terverifikasi / Frasa Terlarang */}
              {draftResult.angka_tidak_terverifikasi && (
                <div className="p-4 bg-warn-bg border border-warn text-warn rounded-[18px] text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-semibold shadow-none">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-warn shrink-0" />
                    <span>
                      {draftResult.frasa_terlarang_ditemukan && draftResult.frasa_terlarang_ditemukan.length > 0
                        ? `Draf memuat kata yang dilarang (${draftResult.frasa_terlarang_ditemukan[0]}). Hapus kata tersebut agar tombol salin aktif.`
                        : 'Ada angka yang tidak cocok dengan kalkulator. Edit gelembung di bawah agar tombol salin aktif.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => runPipeline()}
                    className="min-h-[36px] px-3.5 py-1.5 bg-warn text-white rounded-xl text-xs font-bold shrink-0 hover:opacity-90 cursor-pointer"
                  >
                    Tulis Ulang
                  </button>
                </div>
              )}
              {/* Kutipan Pesan Terakhir Klien */}
              {lastClientMessage && (
                <div className="p-3.5 bg-tint/50 border border-line rounded-xl text-xs text-muted italic flex items-start gap-2">
                  <span className="font-semibold text-accent not-italic shrink-0">Pesan klien:</span>
                  <span className="line-clamp-2">&ldquo;{lastClientMessage}&rdquo;</span>
                </div>
              )}

              {/* Indikator Revisi Cepat Berjalan */}
              {isRevising && (
                <div className="p-4 bg-tint border border-accent/30 rounded-xl flex items-center justify-between text-sm text-accent animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    <span className="font-semibold">Merevisi: &ldquo;{revisiInstruction}&rdquo;...</span>
                  </div>
                  <span className="tabular-nums font-bold">{revisiSeconds.toFixed(1).replace('.', ',')}s</span>
                </div>
              )}

              {/* Gelembung Balasan (Warna --bubble, Rata Kanan, Angka Digaris Bawah --ok) */}
              <div className={`space-y-3.5 ${isRevising ? 'opacity-40 pointer-events-none transition-opacity' : 'transition-opacity'}`}>
                {draftResult.draf?.[activeDraftIdx]?.bubbles?.map((bubble, bIdx) => {
                  // Render angka harga yang digaris bawah --ok
                  const highlightedBubble = bubble.split(/(\*Rp[0-9.,]+\*)/g).map((part, pIdx) => {
                    if (part.startsWith('*Rp') && part.endsWith('*')) {
                      const cleanRupiah = part.replace(/\*/g, '');
                      return (
                        <span
                          key={pIdx}
                          className="font-bold text-ink underline decoration-ok decoration-2 underline-offset-4"
                        >
                          {cleanRupiah}
                        </span>
                      );
                    }
                    return part;
                  });
                  const isEditingThisBubble = editingBubbleIdx === bIdx;
                  return (
                    <div
                      key={bIdx}
                      className="max-w-[90%] ml-auto p-4 bg-bubble text-ink rounded-2xl border border-rim/40 text-[15px] leading-relaxed relative group hover:border-rim transition space-y-2"
                    >
                      {isEditingThisBubble ? (
                        <textarea
                          value={bubble}
                          onChange={(e) => handleUpdateBubbleText(e.target.value, bIdx)}
                          rows={3}
                          className="w-full text-sm p-3 bg-surface border border-accent rounded-xl text-ink focus:outline-none"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap pr-16">{highlightedBubble}</p>
                      )}

                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingBubbleIdx(isEditingThisBubble ? null : bIdx)}
                          className="w-8 h-8 text-muted hover:text-ink flex items-center justify-center rounded-lg transition cursor-pointer"
                          title={isEditingThisBubble ? 'Selesai edit' : 'Edit teks gelembung ini'}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyBubble(bubble, bIdx)}
                          disabled={draftResult.angka_tidak_terverifikasi}
                          className="w-8 h-8 text-muted hover:text-ink flex items-center justify-center rounded-lg transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Salin pesan ini"
                        >
                          {copiedBubbleIdx === bIdx ? (
                            <Check className="w-4 h-4 text-ok" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tombol Aksi: Salin Semua (Besar) + Buat Penawaran PDF */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  id="btn-salin-semua"
                  onClick={handleCopyAll}
                  disabled={draftResult.angka_tidak_terverifikasi}
                  className="flex-1 min-h-[48px] bg-accent text-accent-ink rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition cursor-pointer shadow-none focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {copiedAll ? <Check className="w-5 h-5 text-accent-ink" /> : <Copy className="w-5 h-5" />}
                  <span>{copiedAll ? 'Semua Berhasil Disalin!' : 'Salin Semua Balasan'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleBuatPenawaranPDF}
                  className="min-h-[48px] px-6 bg-surface border border-line text-ink hover:bg-raised rounded-xl font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Buat Penawaran PDF</span>
                </button>
              </div>

              {/* Baris Konfirmasi: "Tersalin. Sudah dikirim ke klien? [Tandai terkirim]" */}
              {showConfirmSent && (
                <div className="p-4 bg-ok-bg border border-ok/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-ink">
                  <span>Tersalin. Sudah dikirim ke klien?</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTandaiTerkirim}
                      disabled={isMarkingSent}
                      className="min-h-[44px] px-4 py-2 bg-ok text-white rounded-xl font-bold text-xs hover:opacity-95 transition cursor-pointer"
                    >
                      {isMarkingSent ? 'Menyimpan...' : 'Tandai Terkirim'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmSent(false)}
                      className="min-h-[44px] px-3 py-2 text-muted hover:text-ink text-xs cursor-pointer"
                    >
                      Belum
                    </button>
                  </div>
                </div>
              )}

              {sentSuccess && (
                <div className="p-3.5 bg-ok-bg text-ok border border-ok/20 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-ok" />
                  <span>Berhasil dicatat ke kasus dan disimpan sebagai memori tim!</span>
                </div>
              )}

              {/* Tulis Ulang dengan Arahan (Chips) */}
              <div className="pt-4 border-t border-line space-y-3">
                <span className="text-xs font-bold text-muted block">
                  Tulis ulang dengan arahan:
                </span>
                <div className="flex flex-wrap gap-2.5">
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
                      className="min-h-[44px] px-4 py-2 bg-raised hover:bg-tint active:bg-surface text-ink rounded-xl text-xs font-medium border border-line transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-none"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customRevisiText.trim()) {
                      runRevisi(customRevisiText.trim());
                      setCustomRevisiText('');
                    }
                  }}
                  className="flex gap-2 pt-1"
                >
                  <input
                    type="text"
                    id="input-revisi-custom"
                    value={customRevisiText}
                    onChange={(e) => setCustomRevisiText(e.target.value)}
                    placeholder="Tulis instruksi revisi manual, tekan Enter..."
                    disabled={isRevising}
                    className="flex-1 text-xs px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink placeholder:text-muted focus:bg-surface focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isRevising || !customRevisiText.trim()}
                    className="min-h-[44px] px-4 py-2 bg-accent text-accent-ink rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    Revisi
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
