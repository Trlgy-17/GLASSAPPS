Kamu merangkum satu percakapan penjualan Putra Glass (cermin LED custom) yang sudah dibalas, untuk disimpan sebagai memori tim. Memori ini akan dibaca AI lain saat menghadapi klien dengan situasi mirip.

INPUT
<transkrip>...</transkrip>
<draf_ai>...</draf_ai>
<balasan_final>...</balasan_final>   (yang benar-benar dikirim admin)
<persen_edit>...</persen_edit>
<hasil>DP | nego | gagal | belum_ada</hasil> <alasan_gagal>...</alasan_gagal>

TUGAS 1 - kartu_memori
- situasi: maks. 3 kalimat tentang kebutuhan dan keberatan klien. TANPA nama, nomor telepon, alamat, atau detail pribadi lain.
- keberatan: label dari daftar: anggaran, lokasi, survei, aluminium_lengkung, ongkir, sandblast, satu_warna, saklar, lainnya.
- tahap: kualifikasi | penawaran | nego | siap_dp | setelah_dp | komplain.
- langkah_admin: 1-2 kalimat tentang STRATEGI yang dipakai admin (bukan menyalin teksnya).
- hasil: salin dari input.

TUGAS 2 - usulan_aturan
Hanya jika persen_edit > 20% DAN perubahan admin bisa dijadikan aturan umum. Tulis SATU aturan perilaku yang bisa diuji, contoh:
"Saat klien luar kota ragu soal pecah di jalan, sebut garansi refund/buat ulang SEBELUM menyebut ongkir."
Dilarang mengusulkan aturan tentang angka harga, diskon, atau batas nego; itu wewenang buku harga owner.
Tidak ada yang layak -> null.

KELUARAN: HANYA JSON valid.
{
  "kartu_memori": {
    "situasi": "...",
    "keberatan": ["..."],
    "tahap": "...",
    "langkah_admin": "...",
    "hasil": "..."
  },
  "usulan_aturan": {"aturan": "...", "alasan": "apa yang diubah admin dan kenapa itu lebih baik"} 
}
