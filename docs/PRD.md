# PRD & System Prompt — Putra Glass CS Assistant

Oct 16, 2026 · @MKI

Web app internal untuk admin Putra Glass: tempel screenshot chat klien → AI menyusun balasan siap kirim yang patuh harga, aturan nego, dan gaya closing brand; isi ukuran → kalkulator menghasilkan penawaran PDF bermerek.

System prompt siap salin untuk developer ada di tab System Prompt.

## 1. Masalah

Admin Putra Glass menjawab setiap chat cermin LED custom secara manual: membaca chat, menghitung luas × harga per m² + add-on + ongkir + pasang, mengetik penawaran, lalu menangani nego satu per satu. Akibatnya ada empat kebocoran:

- **Respons lambat.** Klien yang membandingkan beberapa toko kaca cenderung memilih yang lebih dulu menjawab dengan harga jelas. Hitung manual memakan menit di setiap chat.
- **Jawaban tidak konsisten.** Harga, garansi, dan ongkir ada di tiga sumber yang saling bertentangan: katalog 2026 (Rp1.330.000/m², garansi 2 minggu, gratis ongkir Bandung), knowledge base admin (Rp1.750.000/m², garansi 7 hari dan 3 bulan, jasa kirim dalam kota Rp750.000), dan batas nego yang hanya diingat admin.
- **Diskon keluar terlalu cepat.** Batas harga ongkir dan pasang tidak tertulis sebagai aturan, sehingga potongan diberikan tanpa imbal balik seperti DP hari itu.
- **Ilmu closing tidak terkumpul.** Balasan yang berhasil closing tenggelam di riwayat WhatsApp; admin baru mulai dari nol.

Delapan keberatan berulang yang harus dijawab rapi: anggaran, lokasi jauh, permintaan survei, frame aluminium untuk bentuk lengkung, ongkir, ukuran sandblast custom, permintaan 1 warna lampu, dan permintaan saklar.

### Data penjualan Juli–Oktober 2026

WhatsApp, kanal utama app ini, hanya 25% order tetapi 43% omzet: rata-rata Rp1.506.314 per unit, lebih dari dua kali Live TikTok. Sumber: rekap 407 order (No. 1–407); Oktober baru sebagian.

| Kanal | Order | Omzet | % omzet | Rata-rata per unit | Isi pesanan |
| --- | --- | --- | --- | --- | --- |
| Live TikTok | 234 | Rp152,6 jt | 42,7% | Rp696.590 | 100% ukuran katalog |
| WhatsApp | 102 | Rp152,1 jt | 42,6% | Rp1.506.314 | 97% custom / non-katalog |
| Toko TikTok | 47 | Rp28,7 jt | 8,0% | Rp700.610 | 100% ukuran katalog |
| Shopee | 24 | Rp23,6 jt | 6,6% | Rp983.435 | 61% custom |
| **Total** | **407** | **Rp357,0 jt** | 100% | Rp927.320 | 385 unit |

- **Omzet Juli–September rata-rata Rp108,6 jt/bulan** (puncak Agustus Rp144,2 jt). WhatsApp rata-rata 28 order/bulan.
- **Ukuran katalog terjual di harga katalog.** Capsule 60 × 40 sandblast: median Rp650.000 dari 50 order; Capsule 80 × 50: Rp765.000 dari 39 order. Angka di bawahnya berasal dari potongan platform.
- **Harga custom per m² sudah naik ke harga baru.** 77 order custom LED ≥ 0,5 m²: median Rp1.555.556 (Juli), Rp1.562.500 (Agustus), Rp1.688.152 (September), Rp1.750.000 (Oktober).
- **25% omzet WhatsApp dari Bandung raya**, jadi harga kirim/pasang dalam kota tetap sering dipakai. Tangerang dan Jakarta Utara menyumbang Rp53,0 jt, termasuk ukuran proyek seperti Ø166 cm dan 238 × 107 cm — polanya mirip klien B2B.
- **Ada produk di luar knowledge base:** tambahan gambar/logo/nama (4 order), frame, LED COB, cermin bevel tanpa LED (7 order), kaca polos + jasa pasang. Buku harga harus menampungnya (pertanyaan #21).
- **Yang belum tercatat:** jumlah lead dan waktu respons, jadi closing rate belum bisa dihitung. Rekap manual juga rawan salah: 22 order ber-qty 0 (21 dari TikTok) dan typo ukuran "1001,1 × 125 cm".

## 2. Tujuan & Bukan Tujuan

V1 berhasil kalau admin menjawab lebih cepat, angka selalu benar, dan nego terkendali. Target angkanya ada di bagian 9.

1. **Draf balasan siap kirim ≤ 30 detik** setelah admin menempel screenshot.
2. **Penawaran PDF jadi ≤ 60 detik dengan 0 kesalahan harga.** Angka selalu dihitung satu mesin harga (kode), tidak pernah oleh AI.
3. **Satu sumber kebenaran.** Harga, garansi, dan aturan nego diatur owner di satu halaman; semua admin dan AI membaca dari situ.
4. **Diskon hanya lewat tangga nego**, ditukar dengan komitmen (mis. DP hari itu), dan tidak pernah di bawah batas.
5. **AI makin tajam tiap minggu.** Setiap balasan terkirim + hasilnya (DP / gagal) jadi memori, sehingga draf minggu ke-6 lebih sedikit diedit daripada minggu ke-1.

"Closing 1M/bulan" dipakai sebagai standar kemampuan persona AI, bukan target sistem. Sebagai pembanding, omzet Juli–September rata-rata Rp108,6 jt/bulan; target bisnis dihitung dari baseline itu.

| Bukan tujuan v1 | Alasan |
| --- | --- |
| AI mengirim pesan langsung ke WhatsApp klien | Admin tetap penjaga terakhir. WhatsApp Business Platform butuh verifikasi Meta dan berbayar; API tidak resmi berisiko nomor diblokir. Masuk P2. |
| CRM penuh (pipeline board, broadcast, reminder otomatis) | Masalah utamanya kecepatan dan konsistensi jawaban. Status lead sederhana cukup untuk v1. |
| Fine-tuning model | Data baru ratusan percakapan. Memori berbasis retrieval bisa diperbarui seketika, diaudit, dan dihapus. |
| Invoice pajak dan pencatatan pembayaran | PDF v1 adalah penawaran. Bukti DP tetap dicek manual di mutasi rekening. |
| Konten Instagram / iklan | Lingkup lain; app ini fokus ke percakapan yang sudah masuk. |

## 3. Pengguna & User Stories

Dua peran: **Admin CS** memproses chat WhatsApp/DM Instagram setiap hari (HP + laptop); **Owner** mengatur harga, batas nego, knowledge base, dan menyetujui apa yang dipelajari AI.

**Admin CS** (urut prioritas)

1. Sebagai admin, saya ingin menempel satu atau beberapa screenshot chat dan langsung mendapat draf balasan, supaya klien dijawab dalam hitungan detik.
2. Sebagai admin, saya ingin draf dipecah per bubble WhatsApp dengan tombol salin per bubble, supaya bisa langsung ditempel tanpa merapikan format.
3. Sebagai admin, saya ingin ukuran dan opsi yang disebut klien otomatis masuk ke kalkulator, supaya tidak mengetik ulang.
4. Sebagai admin, saya ingin mengunduh atau membagikan PDF penawaran yang rapi, supaya klien melihat rincian harga dan alur pemesanan dalam satu file.
5. Sebagai admin, saya ingin melihat batas nego di panel internal (tidak pernah di teks balasan), supaya bisa nego tanpa kebablasan.
6. Sebagai admin, saya ingin meminta ulang draf dengan arahan singkat ("lebih singkat", "dorong DP"), supaya tidak menulis ulang sendiri.
7. Sebagai admin, saya ingin melanjutkan percakapan klien lama dan AI ingat ukuran serta penawaran sebelumnya, supaya klien tidak ditanya dua kali.
8. Sebagai admin, saya ingin menandai hasil percakapan (DP / masih nego / gagal + alasan), supaya AI belajar dari yang berhasil.
9. *Kasus tepi:* kalau screenshot buram atau terpotong, saya ingin AI menyebut bagian yang tidak terbaca dan saya bisa mengoreksi transkripnya, supaya draf tidak dibangun dari salah baca.
10. *Kasus tepi:* kalau klien minta hal di luar aturan (aluminium bentuk lengkung, sandblast 8 cm, harga di bawah batas), saya ingin draf menawarkan alternatif terdekat dan menandai "perlu keputusan owner", supaya tidak ada janji yang tidak bisa dipenuhi.
11. *Kasus tepi:* kalau klien komplain atau klaim garansi, saya ingin draf mengikuti syarat klaim (video unboxing utuh, foto resi, maks. 7 hari), supaya penanganan konsisten.

**Owner**

1. Sebagai owner, saya ingin mengubah harga, add-on, dan batas nego di satu halaman tanpa developer, supaya AI dan kalkulator langsung memakai angka baru.
2. Sebagai owner, saya ingin hanya saya yang bisa menyetujui harga di bawah batas admin, supaya margin terlindungi.
3. Sebagai owner, saya ingin penawaran lama tetap memakai harga saat dibuat, supaya PDF yang sudah dikirim tidak berubah.
4. Sebagai owner, saya ingin menyetujui atau menolak aturan playbook yang diusulkan AI dari editan admin, supaya memori tidak mempelajari kebiasaan buruk.
5. Sebagai owner, saya ingin melihat closing rate dan rata-rata diskon per minggu, supaya tahu apakah AI menaikkan penjualan atau hanya menaikkan diskon.
6. Sebagai owner, saya ingin klien B2B (desainer, kontraktor, proyek) punya ruang nego sampai harga net tanpa angka itu terlihat oleh klien B2C, supaya bisa memenangkan proyek tanpa merusak harga eceran.

## 4. Alur Kerja

Dua alur, satu sumber angka. AI menyiapkan kata-kata dan spesifikasi; mesin harga menghitung; admin memutuskan apa yang terkirim. Hanya balasan yang ditandai Terkirim yang kembali sebagai memori.

&#91;embedded content: alur kerja · balas chat dan penawaran berbagi satu mesin harga\]

Spesifikasi hasil ekstraksi langsung mengisi kalkulator, sehingga admin tidak mengetik ukuran dua kali.

## 5. Kebutuhan (P0 / P1 / P2)

P0 = tidak rilis tanpa ini. Empat modul: A. Balas Chat, B. Kalkulator & PDF, C. Memori, D. Pengaturan & Akses. Kotak centang = acceptance criteria yang diuji QA.

### A. Balas Chat — P0

**A1. Input.** Tempel (Ctrl/Cmd+V) di mana saja pada layar Balas, drag-and-drop, pilih file, atau tempel teks chat. Maks. 8 gambar per permintaan, urutan bisa digeser. Gambar dikecilkan di browser ke sisi terpanjang 1.600 px sebelum upload.

- [ ] Screenshot dari clipboard tampil sebagai thumbnail < 1 detik.
- [ ] Gambar ke-9 ditolak dengan pesan "Maks. 8 screenshot per balasan".
- [ ] Teks dan screenshot bisa dicampur dalam satu permintaan.

**A2. Ekstraksi.** AI membaca screenshot menjadi transkrip berurutan (klien/admin), kanal (WhatsApp, Instagram, TikTok, Shopee), nama, kota, dan spesifikasi: bentuk, ukuran cm, lampu, kontrol, frame, antifog, sandblast, qty, perlu pasang.

- [ ] "Kak 60x80 yg sensor + baterai ke Surabaya brp?" → item 60 × 80 cm, kontrol sensor + baterai, kota Surabaya (luar kota).
- [ ] Bagian yang tidak terbaca ditulis `[tidak terbaca]`, tidak ditebak.
- [ ] Admin bisa mengedit transkrip; "Buat ulang draf" memakai transkrip yang sudah dikoreksi.

**A3. Draf balasan.** Dua versi dengan pendekatan berbeda (mis. "Dorong DP" vs "Edukasi dulu"), masing-masing 1–4 bubble WhatsApp, tombol salin per bubble dan "Salin semua". Panel internal di sampingnya: ringkasan situasi, tahap funnel, keberatan terdeteksi, data yang kurang, batas nego, langkah berikutnya, bendera "perlu owner".

- [ ] Setiap angka rupiah di draf sama persis dengan output mesin harga. Server memeriksa ulang; angka yang tidak cocok membuat draf ditandai merah dan salin butuh konfirmasi.
- [ ] Harga batas bawah tidak pernah muncul di draf kecuali tangga nego mengizinkan di tahap itu.
- [ ] Format WhatsApp (`*tebal*` seperlunya), tanpa heading atau bullet markdown.
- [ ] Tempel → draf tampil: p95 ≤ 30 detik.

**A4. Arahan cepat.** Chip "Lebih singkat", "Lebih hangat", "Dorong DP", "Tawarkan opsi hemat", plus kolom arahan bebas.

- [ ] Regenerasi memakai konteks yang sama dan selesai ≤ 20 detik.

**A5. Konteks lead.** Pilih lead lama (cari nama / no. WA) atau buat baru otomatis dari nama di screenshot. Setiap lead punya segmen B2C (default) atau B2B; hanya admin yang menetapkan B2B, AI sebatas mengusulkan "kandidat B2B".

- [ ] Ringkasan lead (ukuran, penawaran terakhir, keberatan sebelumnya) ikut ke prompt; AI tidak menanyakan ulang data yang sudah ada.

**A6. Tandai terkirim.** Admin boleh mengedit draf, lalu klik "Terkirim". Teks final disimpan bersama persentase editnya.

- [ ] Draf yang tidak ditandai Terkirim tidak pernah masuk memori.

**A7. Aturan kanal marketplace.** TikTok dan Shopee membawa 75% order, kebanyakan ukuran katalog. Chat dari kanal ini dijawab dengan harga listing, tanpa nomor WhatsApp, rekening, atau ajakan bertransaksi di luar platform, karena aturan marketplace melarangnya dan toko bisa terkena sanksi.

- [ ] Draf untuk kanal TikTok/Shopee tidak pernah memuat nomor telepon, rekening, atau tautan di luar platform (dicek server).
- [ ] Permintaan custom dari marketplace mengikuti kebijakan custom marketplace (pertanyaan #22); selama belum ditetapkan, draf ditandai "perlu owner".

### B. Kalkulator & Penawaran PDF — P0

**B1. Item cermin.** Bentuk (daftar katalog + Custom), panjang & lebar (cm), varian lampu/kontrol, frame (tanpa / HPL / aluminium), antifog, sandblast (lebar 2–5 cm, jarak tepi 1–5 cm), qty. Banyak item per penawaran. Dua mode harga: ukuran yang cocok dengan SKU katalog memakai harga katalog; ukuran lain memakai rumus per m² (bagian 6).

- [ ] Aluminium hanya aktif untuk bentuk yang ditandai "boleh aluminium" di pengaturan (persegi/persegi panjang tanpa lengkung). Bentuk lain: opsi nonaktif + keterangan.
- [ ] Sandblast di luar rentang: input merah dan tidak bisa disimpan; admin bisa klik "Minta persetujuan owner".
- [ ] Total berubah < 100 ms saat input berubah; browser dan server memakai modul harga yang sama.
- [ ] Capsule 60 × 40 sandblast, kabel → Rp650.000 dari tabel SKU; 120 × 70 cm custom → dihitung per m².

**B2. Pengiriman & pemasangan.** Zona Bandung / luar kota (+ nama kota), pasang ya/tidak, harga list otomatis, kolom harga deal dengan penjaga batas.

- [ ] Admin tidak bisa mengisi harga di bawah batas admin. Admin bisa mengajukan persetujuan (B7); owner bisa langsung mengisi, wajib menulis alasan, dan tercatat di audit log.

**B3. Ringkasan.** Subtotal, ongkir, pasang, diskon, total, DP 50%, pelunasan.

**B4. PDF penawaran.** Nomor `PG-Q-YYMM-0001`, tanggal, berlaku s/d (default 7 hari), data klien, rincian item, alur pemesanan, garansi + syarat klaim, rekening, kontak WhatsApp, QR Instagram. Unduh, atau bagikan langsung lewat menu share HP.

- [ ] PDF jadi ≤ 5 detik, ≤ 1 MB, muat 1 halaman A4 untuk ≤ 4 item.
- [ ] Angka di PDF = angka di layar. Penawaran disimpan sebagai snapshot; unduh ulang tidak menghitung ulang.

**B5. Isi otomatis dari Balas.** Tombol "Buat penawaran" di panel internal membuka kalkulator yang sudah terisi spesifikasi hasil ekstraksi.

**B6. Riwayat & revisi.** Penawaran tersimpan per lead; bisa diduplikat menjadi revisi (`-R1`, `-R2`).

**B7. Persetujuan owner.** Admin mengajukan harga di bawah batasnya (harga cermin B2B di bawah tingkat, ongkir, pasang) atau spesifikasi di luar aturan (mis. sandblast di luar rentang) lewat tombol "Minta persetujuan owner" + alasan. Owner melihat antrean persetujuan dengan badge di app, lalu menyetujui (boleh dengan angka lain) atau menolak. Notifikasi WhatsApp ke owner masuk P1.

- [ ] Penawaran yang menunggu persetujuan tidak bisa diunduh atau dibagikan.
- [ ] Harga yang disetujui hanya berlaku untuk penawaran itu, tidak untuk lead atau penawaran lain.
- [ ] Setiap keputusan tercatat: siapa, nilai diminta, nilai disetujui, alasan, waktu.

### C. Memori — P0

**C1. Kartu kasus.** Saat Terkirim, sistem menyimpan kartu memori: ringkasan situasi, keberatan, balasan final, tahap funnel, plus embedding untuk pencarian kemiripan.

**C2. Hasil.** Admin menandai DP / masih nego / gagal (+ alasan: harga, ongkir, waktu, menghilang, pilih toko lain). Bobot: DP > nego > gagal.

**C3. Pengambilan memori.** Setiap draf memakai 5 kasus paling mirip (kemiripan × bobot hasil × kebaruan), riwayat lead, dan aturan playbook aktif.

- [ ] Panel "Memori yang dipakai" menampilkan kasus rujukan dan bisa dibuka.
- [ ] Owner bisa menonaktifkan kartu memori; kartu nonaktif tidak pernah diambil lagi.
- [ ] Jika memori bertentangan dengan harga/knowledge base terbaru, knowledge base yang dipakai (diuji dengan kasus lama berharga lama).

### D. Pengaturan & Akses — P0

**D1. Akun.** Login email + password, peran owner/admin.

**D2. Buku harga berversi (owner).** Harga per m² per varian dan segmen (B2C/B2B), add-on dengan basis (per unit / per m² / per meter keliling), ongkir & pasang (list, batas admin, batas owner), pembulatan, harga minimum per item, masa berlaku penawaran, bentuk yang boleh aluminium, tabel SKU katalog (bentuk × ukuran × sandblast × kabel/baterai), dan produk di luar cermin LED (cermin bevel, kaca polos + jasa, tambahan gambar/logo/nama). Simpan = versi baru; penawaran lama terkunci ke versinya.

**D3. Knowledge base (owner).** Alur pemesanan, garansi, spesifikasi, playbook keberatan. Disuntikkan ke system prompt lewat variabel, jadi perubahan berlaku tanpa deploy.

**D4. Audit log.** Perubahan harga, persetujuan di bawah batas, penonaktifan memori.

### P1 — menyusul 2–4 minggu setelah rilis

- Usulan aturan playbook dari selisih draf AI vs teks final admin; owner menyetujui atau menolak.
- Gambar teknik sederhana di PDF: bentuk, ukuran, garis sandblast, dan jarak tepi. Mengurangi salah produksi pesanan custom.
- PWA + Share Target (Android): bagikan screenshot dari galeri/WhatsApp langsung ke app.
- Pengingat follow-up untuk lead yang sudah menerima penawaran tapi belum DP.
- Dasbor mingguan: waktu respons, draf tanpa edit, closing rate, rata-rata diskon per admin.
- Set uji 30 kasus nyata untuk regresi setiap kali prompt diubah.
- Order & rekap otomatis: penawaran yang sudah DP menjadi baris order dengan kolom yang sama seperti rekap penjualan sekarang (bulan, kanal, bentuk, ukuran, sandblast, baterai, kota, harga, qty). Rekap manual dan salah ketik ukuran tidak terjadi lagi.

### P2 — belum dibangun, tapi arsitektur disiapkan

- WhatsApp Business Platform: pesan masuk otomatis jadi kasus, tetap disetujui admin sebelum terkirim. Tabel `kasus` sudah punya kolom `sumber` dan `id_pesan_eksternal`.
- Atribusi sumber lead (iklan, IG organik, referral) ke nilai order.
- Transkripsi voice note klien.
- Multi-merek: kolom `brand_id` di tabel inti sejak awal.

## 6. Logika Harga & Kalkulator

Semua angka dihitung oleh satu modul kode (`pricing.ts`) yang dipakai kalkulator, PDF, dan AI. Angka di bawah diambil dari knowledge base owner; tanda \* = asumsi sampai dijawab di bagian 11.

**Dua mode harga (usulan dari data, menunggu konfirmasi #2).** Ukuran katalog selama ini terjual tepat di harga katalog, sedangkan custom dihitung per m². Kalkulator mengikuti pola itu: bentuk + ukuran + sandblast + kontrol yang cocok dengan SKU katalog → harga SKU; selain itu → rumus di bawah. Tabel SKU diimpor dari katalog 2026 ke buku harga dan diperbarui di sana.

**Buku harga versi 1**

| Komponen | Harga list | Batas admin | Batas owner | Basis | Catatan |
| --- | --- | --- | --- | --- | --- |
| Cermin Premium, klien B2C (LED 3 warna, touchscreen kabel, bevel 10 mm, kaca 5 mm, braket + fisher S6) | Rp1.750.000 | — | — | per m² | Default; harga cermin tidak dinego |
| Cermin Premium, klien B2B | Rp1.750.000 | Harga tingkat sesuai jumlah unit | Rp1.350.000, lewat persetujuan | per m² | Buka di harga list; turun bertahap per jumlah unit |
| Cermin Basic (1 warna lampu atau saklar) | Rp1.550.000 | — | — | per m² | Hanya bila klien meminta; harga B2B belum ada |
| Kontrol: touchscreen + baterai | +Rp150.000 | — | — | per unit\* | Pilih satu jenis kontrol\*. Di SKU katalog, baterai terjual +Rp180.000–Rp200.000 (#20) |
| Kontrol: sensor tangan | +Rp100.000 | — | — | per unit\* |  |
| Kontrol: sensor tangan + baterai | +Rp250.000 | — | — | per unit\* |  |
| Antifog | +Rp200.000 | — | — | per unit\* |  |
| Frame HPL | +Rp200.000 | — | — | per unit\* |  |
| Frame aluminium | +Rp400.000 | — | — | per unit\* | Hanya bentuk persegi tanpa lengkung |
| Pengiriman Bandung | Rp750.000 | Rp500.000 | Rp500.000 | per order |  |
| Pengiriman luar kota | Rp1.300.000 | Rp1.150.000 | Rp1.150.000 | per order | Arti "bisa 50%" belum jelas (bagian 11) |
| Pemasangan Bandung | Rp800.000 | Rp500.000\* | Rp300.000\* | per kunjungan | Rentang "300–500 rb" dibagi dua batas |
| Pemasangan luar kota | Rp1.300.000 | Rp1.000.000\* | Rp800.000\* | per kunjungan | Rentang "800 rb–1 jt" dibagi dua batas |

**Rumus**

```latex
\begin{aligned}
\text{luas (m}^2\text{)} &= \tfrac{P_{cm}}{100} \times \tfrac{L_{cm}}{100} \\
\text{harga cermin} &= \max\big(\lceil \text{luas} \times \text{tarif varian} \rceil_{5.000},\ \text{harga minimum}\big) \\
\text{harga item} &= \big(\text{harga cermin} + \textstyle\sum \text{add-on}\big) \times \text{qty} \\
\text{total} &= \textstyle\sum \text{harga item} + \text{kirim} + \text{pasang} - \text{diskon} \\
\text{DP} &= \lceil 50\% \times \text{total} \rceil_{1.000}
\end{aligned}
```

- **Bentuk lengkung** (round, oval, kapsul, leaf, half moon, hex) dihitung dari kotak terluarnya, P × L\*.
- **Pembulatan:** harga cermin ke atas ke kelipatan Rp5.000\*, DP ke atas ke Rp1.000. Uang disimpan sebagai integer rupiah, bukan desimal.
- **Harga minimum per item belum ada.** Tanpa itu, 30 × 45 cm keluar Rp236.250, padahal katalog menjual ukuran yang sama Rp570.000. Data: 9 order custom LED di bawah 0,4 m² tanpa add-on terjual Rp500.000–Rp765.000 (median Rp654.750), jadi usulan minimum Rp650.000 (= harga katalog 60 × 40).
- **Sandblast** tidak mengubah harga custom\* (di SKU katalog, no-sandblast Rp50.000–Rp65.000 lebih murah), tetapi lebar (2–5 cm) dan jarak tepi (1–5 cm) wajib tercatat di spesifikasi dan PDF.

**Contoh:** 1 cermin 60 × 80 cm, Premium, sensor tangan + baterai, antifog, kirim ke Surabaya, tanpa pasang.

| Langkah | Hitungan | Hasil |
| --- | --- | --- |
| Luas | 0,60 × 0,80 | 0,48 m² |
| Cermin Premium | 0,48 × Rp1.750.000 | Rp840.000 |
| Sensor tangan + baterai | add-on | Rp250.000 |
| Antifog | add-on | Rp200.000 |
| Pengiriman luar kota | harga list | Rp1.300.000 |
| **Total** |  | **Rp2.590.000** |
| DP 50% / pelunasan |  | Rp1.295.000 / Rp1.295.000 |

**Tangga nego (ongkir & pasang)** — dipakai AI dan admin:

1. **Tahan di harga list.** Jawab keberatan dengan nilai: packing kayu, foto & video produksi, garansi 7 hari untuk pecah di jalan (refund atau buat ulang gratis).
2. **Tawarkan opsi, bukan potongan.** Pasang sendiri (braket, fisher S6, dan sekrup sudah termasuk), sesuaikan ukuran, atau lepas add-on.
3. **Satu potongan, ditukar komitmen.** Turun ke batas admin hanya jika klien DP hari itu: "Kalau DP hari ini, ongkirnya saya bantu jadi Rp1.150.000 ya Kak."
4. **Di bawah batas admin = keputusan owner.** AI tidak pernah menulis angka di bawah batas admin; draf diberi bendera "perlu owner".

Maksimal satu potongan per komponen per percakapan, dan potongan yang sudah disebut tidak ditarik lagi. Cermin Basic (Rp1.550.000/m²) hanya ditawarkan saat klien meminta 1 warna atau saklar, atau anggaran tetap tidak masuk setelah ukuran disesuaikan; selalu sebutkan konsekuensinya (warna lampu tidak bisa diganti / tanpa touchscreen).

**Tangga nego harga cermin — khusus klien B2B** (desainer interior, kontraktor, proyek, reseller; segmen ditetapkan admin di data lead). Harga turun mengikuti jumlah unit; harga net hanya keluar lewat persetujuan owner.

| Tingkat | Total unit per penawaran | Premium per m² | Siapa yang boleh memberi |
| --- | --- | --- | --- |
| Harga list | berapa pun | Rp1.750.000 | Admin & AI, selalu jadi harga pembuka |
| Tingkat 1 | diisi owner | diisi owner | Admin & AI, jika jumlah unit memenuhi |
| Tingkat 2 | diisi owner | diisi owner | Admin & AI, jika jumlah unit memenuhi |
| Harga net | — | Rp1.350.000 | Hanya owner, lewat persetujuan di app |

1. **Buka di Rp1.750.000/m²**, sama dengan B2C. Istilah "harga net" atau "harga B2B" tidak pernah disebut ke klien.
2. **Harga tingkat sesuai jumlah unit yang benar-benar dipesan**, ditukar komitmen (DP hari itu, jadwal proyek pasti). Tingkat berikutnya boleh disebut sebagai alasan menambah unit.
3. **Di bawah harga tingkat = persetujuan owner.** Admin klik "Minta persetujuan owner" dengan alasan; penawaran terkunci sampai owner menyetujui atau menolak (B7).

Selama tingkat belum diisi (v1), klien B2B menerima harga list dan setiap potongan harga cermin lewat persetujuan owner. AI hanya menerima tabel tingkat untuk lead yang sudah ditandai B2B; angka Rp1.350.000 tidak pernah dikirim ke AI. Klien yang mengaku desainer atau kontraktor ditandai "kandidat B2B" untuk dicek admin, supaya klaim di chat tidak otomatis membuka harga tingkat.

## 7. Arsitektur & Data Model

Satu aplikasi Next.js di atas Supabase, dengan dua panggilan AI per balasan dan satu mesin harga yang dipakai bersama. Skala 1–5 admin tidak butuh microservice, antrean, atau server terpisah.

&#91;embedded content: arsitektur · browser, server Next.js, Claude API, Supabase\]

Kunci API Claude dan embedding hanya ada di server; browser tidak pernah memanggil AI langsung.

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Frontend | Next.js (App Router) + TypeScript + Tailwind, komponen Radix | Satu codebase untuk web dan PWA; komponen aksesibel tanpa menulis ulang dropdown/dialog |
| Backend | Route handler Next.js (runtime Node) | Cukup untuk beban beberapa admin; tidak ada server kedua untuk dirawat |
| Database | Supabase Postgres + pgvector | Data relasional (harga, penawaran) dan vektor memori dalam satu DB, dengan Row Level Security |
| Auth & file | Supabase Auth + Storage bucket privat | Screenshot dan PDF tidak pernah publik; akses lewat signed URL berumur pendek |
| AI | Claude API: `claude-haiku-5-5` untuk ekstraksi dan ringkasan memori, `claude-sonnet-5-5` untuk draf balasan | Haiku cepat dan murah untuk tugas terstruktur; Sonnet untuk nuansa persuasi. Prompt caching untuk system prompt + knowledge base |
| Embedding | Model embedding multibahasa (mis. Voyage AI) | Claude API tidak menyediakan embedding; model harus paham bahasa chat Indonesia yang penuh singkatan |
| PDF | `@react-pdf/renderer` di server | Layout deterministik tanpa Chromium; font disematkan |
| Hosting | Vercel + Supabase, region Singapura | Latensi rendah dari Indonesia |
| Pemantauan | Sentry + tabel `llm_calls` (token, latensi, versi prompt) | Lacak biaya dan penurunan kualitas per versi prompt |

**Alur satu balasan**

1. Browser mengompres gambar → Storage → baris `pesan_masuk`.
2. **Ekstraksi** (Haiku, vision) → JSON transkrip + spesifikasi.
3. **Hitung harga:** jika spesifikasi cukup, `pricing.ts` menghitung harga list dan batas nego per item.
4. **Ambil memori:** embedding 3 pesan klien terakhir → 5 kartu kasus teratas + riwayat lead + aturan playbook aktif.
5. **Draf** (Sonnet): system prompt (di-cache) + blok konteks → JSON. Tool `hitung_harga` tersedia jika AI perlu menawarkan ukuran alternatif.
6. **Validasi server:** skema JSON, setiap angka Rp harus berasal dari mesin harga, frasa terlarang, janji di luar knowledge base → bendera.
7. Hasil di-stream ke layar.

Ekstraksi dipisah dari draf karena pencarian memori butuh teks lebih dulu, dan transkrip yang dikoreksi admin bisa dipakai ulang tanpa membaca gambar lagi.

**Data model**

| Tabel | Kolom penting | Catatan |
| --- | --- | --- |
| `users` | id, nama, email, peran (owner/admin) |  |
| `price_books` | id, versi, aktif, data\_json, dibuat\_oleh | Tidak pernah di-update; perubahan = versi baru |
| `leads` | id, brand\_id, nama, no\_wa, kota, zona, sumber, segmen (B2C/B2B), status | no\_wa unik per brand |
| `kasus` | id, lead\_id, admin\_id, sumber, id\_pesan\_eksternal, tahap, hasil, alasan\_gagal, nilai\_order | Satu kasus = satu sesi balas |
| `pesan_masuk` | id, kasus\_id, gambar\[\], transkrip, spesifikasi\_json |  |
| `draf_ai` | id, kasus\_id, versi\_prompt, model, output\_json, flags, token, latensi\_ms |  |
| `balasan_final` | id, kasus\_id, draf\_id, teks, persen\_edit, terkirim\_at | Sumber utama memori |
| `kartu_memori` | id, kasus\_id, ringkasan, keberatan\[\], tahap, hasil, embedding, aktif | Indeks HNSW di kolom embedding |
| `playbook_rules` | id, aturan, sumber\_kasus\_id, status (usulan/aktif/arsip), disetujui\_oleh |  |
| `penawaran` | id, nomor, lead\_id, price\_book\_id, items\_json, ringkasan\_json, valid\_until, pdf\_path, revisi\_dari | Snapshot; tidak dihitung ulang |
| `audit_log` | id, aktor, aksi, objek, sebelum, sesudah, alasan |  |
| persetujuan | id, penawaran\_id, jenis, nilai\_diminta, nilai\_disetujui, alasan, status, diputuskan\_oleh | Status: menunggu / disetujui / ditolak |

Row Level Security: admin hanya membaca/menulis data brand-nya; `price_books` dan `playbook_rules` hanya bisa ditulis owner.

## 8. Desain Layar

Empat layar, satu tugas utama per layar. Layar Balas adalah beranda dan harus bisa dipakai penuh dengan keyboard.

&#91;embedded content: wireframe layar Balas · desktop\]

Contoh di wireframe memakai pesanan bagian 6 (60 × 80 cm ke Surabaya): klien keberatan ongkir, draf 1 membingkai nilai dulu tanpa langsung memotong, dan batas ongkir hanya tampil di panel internal.

| Layar | Isi | Akses |
| --- | --- | --- |
| Balas (beranda) | Kiri: kasus hari ini dengan status berwarna. Tengah: zona tempel, thumbnail, transkrip yang bisa dilipat/diedit. Kanan: 2 kartu draf berisi bubble + tombol salin; di bawahnya panel internal (situasi, keberatan, batas nego, data kurang, memori yang dipakai, tombol "Buat penawaran"). | Admin, owner |
| Penawaran | Kartu per cermin, panel ringkasan menempel di kanan (desktop) atau bawah (HP), pratinjau PDF, tombol Unduh & Bagikan. | Admin, owner |
| Lead & Memori | Cari lead, riwayat kasus dan penawaran, tandai hasil. Tab Memori: daftar kartu dengan filter keberatan/hasil, aktif/nonaktif. Tab Playbook (P1). | Admin baca, owner kelola |
| Pengaturan | Buku harga berversi, knowledge base, rekening dan kontak untuk PDF, pengguna. | Owner |

**Aturan UI**

- **Mobile-first.** Di HP, Balas menjadi satu kolom bertahap (Tempel → Draf → Internal) dengan tab bawah: Balas · Penawaran · Lead · Pengaturan.
- **Pintasan desktop:** Ctrl/Cmd+V tempel, Ctrl/Cmd+Enter buat draf, tombol 1/2 salin versi 1/2, Ctrl/Cmd+Shift+P buka penawaran.
- **Status per langkah**, bukan spinner kosong: "Membaca screenshot…" → "Menghitung harga…" → "Menyusun balasan…".
- **Format tetap:** rupiah `Rp1.750.000` (titik ribuan, tanpa desimal), ukuran `60 × 80 cm`, angka tabular agar kolom harga rata.
- **Batas nego** tampil di blok berlatar beda, ikon gembok, label "Internal — jangan dikirim".
- **Warna dari katalog:** navy `#273154` (aksen, tombol utama, diambil dari logo), steel `#BFCBD9` (garis, latar lembut), off-white hangat `#F7F5F2` (latar), ink `#1C1B19` (teks), amber `#E3A857` hanya untuk status "Perlu owner". Mode gelap memakai token yang sama.
- **Tipografi:** Plus Jakarta Sans untuk UI; serif (mis. Fraunces) hanya untuk judul PDF, menggemakan judul serif di katalog.
- **Hindari:** gradasi ungu, ilustrasi robot/"AI magic", emoji di UI, bayangan tebal.

**PDF penawaran (A4, 1 halaman)**

1. Header: logo, "Penawaran Harga", nomor, tanggal, berlaku s/d.
2. Kepada: nama dan kota klien.
3. Tabel item: ikon garis bentuk cermin, spesifikasi ringkas (varian, kontrol, frame, antifog, sandblast), ukuran, luas, harga.
4. Ringkasan kanan bawah: subtotal, kirim, pasang, potongan, **Total** (terbesar di halaman), DP 50%, pelunasan.
5. Strip alur pemesanan 4 langkah: DP 50% → Produksi 1–5 hari kerja + foto/video → Pelunasan & kirim (packing kayu) → Garansi.
6. Garansi dan syarat klaim (teks kecil), rekening, nomor WhatsApp, QR ke Instagram @putraglass.id.

## 9. Metrik Keberhasilan

Rekap Juli–Oktober sudah memberi baseline order dan harga: WhatsApp rata-rata 28 order/bulan, Rp1.506.314 per unit, harga custom median Rp1.750.000/m² di Oktober. Yang belum ada adalah jumlah lead dan waktu respons, jadi selama 2 minggu sebelum rilis admin mencatat jumlah chat masuk dan jam balas agar closing rate bisa dihitung.

| Metrik | Jenis | Target sukses | Stretch | Cara ukur | Dinilai |
| --- | --- | --- | --- | --- | --- |
| Tempel → draf tampil | Leading | p95 ≤ 30 detik | p95 ≤ 15 detik | `draf_ai.latensi_ms` | Minggu 1 |
| Waktu membuat PDF penawaran | Leading | median ≤ 60 detik | ≤ 30 detik | buka kalkulator → unduh/bagikan | Minggu 1 |
| Chat yang dibalas lewat app | Leading | ≥ 80% | ≥ 95% | jumlah kasus vs chat masuk harian | Minggu 3 |
| Draf terkirim dengan edit ≤ 20% | Leading | ≥ 50% (minggu 2) | ≥ 70% (minggu 6) | `balasan_final.persen_edit` | Mingguan |
| Kesalahan harga di PDF | Guardrail | 0 | 0 | owner mengaudit 20 penawaran acak per minggu | Mingguan |
| Waktu respons ke klien | Lagging | turun ≥ 50% vs baseline | turun ≥ 70% | jam pesan terakhir klien (dibaca dari screenshot) vs `terkirim_at` | Bulan 1 |
| Closing rate (lead → DP) | Lagging | +20% relatif vs baseline | +40% relatif | `kasus.hasil` per lead per bulan | Bulan 1 & 3 |
| Rata-rata potongan per order | Guardrail | tidak naik vs baseline | turun 10% | harga list vs deal di `penawaran` | Bulanan |
| Order dengan add-on (antifog/sensor) | Lagging | baseline bulan 1 | +10 poin | `penawaran.items_json` | Bulan 3 |
| Order WhatsApp per bulan | Lagging | ≥ 34 (+20% dari 28) | ≥ 39 (+40%) | kasus kanal WhatsApp dengan hasil DP | Bulan 1 & 3 |
| Harga realisasi custom B2C per m² (median) | Guardrail | ≥ Rp1.700.000 | Rp1.750.000 | penawaran custom yang DP, dibagi luas | Bulanan |

## 10. Risiko & Guardrail AI

Prinsipnya: AI menulis kata-kata, kode menghitung angka, admin menekan tombol kirim.

| Risiko | Dampak | Penangkal |
| --- | --- | --- |
| AI salah hitung atau mengarang harga | Klien memegang angka salah | AI tidak pernah menghitung. Angka dari `pricing.ts`; server mencocokkan setiap "Rp" di draf dengan daftar angka sah |
| Janji di luar kebijakan (garansi lebih panjang, gratis ongkir luar kota, aluminium lengkung) | Klaim dan kerugian | Knowledge base satu-satunya sumber; daftar janji terlarang dicek server; bendera "perlu owner" |
| Batas nego bocor | Margin turun | Batas hanya di panel internal; prompt melarang angka di bawah batas admin; validasi angka |
| Memori mempelajari kebiasaan buruk | Kualitas turun pelan-pelan | Hanya balasan "Terkirim" yang masuk; bobot hasil; owner bisa menonaktifkan kartu; aturan playbook butuh persetujuan |
| Salah baca screenshot | Draf salah konteks | `[tidak terbaca]`, transkrip bisa diedit, spesifikasi tampil untuk dicek sebelum penawaran dibuat |
| Suara brand generik | Klien merasa dibalas bot | Panduan gaya + daftar frasa terlarang di prompt; contoh dari balasan terbaik owner; pantau persen edit |
| Data pribadi klien (nama, nomor, foto rumah) | Kewajiban UU 27/2022 tentang Pelindungan Data Pribadi | Bucket privat, RLS, screenshot dihapus otomatis setelah 180 hari\* (transkrip dan memori tetap), tidak ada data klien di log aplikasi |
| Biaya API membengkak | Biaya bulanan tak terduga | Gambar dikompres, prompt caching, Haiku untuk ekstraksi, batas harian per admin + peringatan |
| Admin terlalu percaya AI | Kesalahan lolos ke klien | Bendera merah mematikan salin satu klik; audit mingguan owner |
| Perubahan prompt merusak kualitas | Regresi diam-diam | Versi prompt tercatat per draf; set uji 30 kasus wajib lulus sebelum versi baru aktif |

## 11. Pertanyaan Terbuka

Pertanyaan #1 dan #17 sudah terjawab. Pertanyaan 2–7, 16, dan 20 memblokir rilis kalkulator: tanpa jawabannya, mesin harga akan menghitung angka yang bisa salah. Semua bertanda \* di dokumen ini merujuk ke tabel ini.

| # | Pertanyaan | Asumsi sementara | Penjawab | Blok rilis? |
| --- | --- | --- | --- | --- |
| 1 | Harga per m² yang berlaku: Rp1.750.000 (knowledge base) atau Rp1.330.000 (katalog hlm. 17)? | **Terjawab:** Rp1.750.000 = harga terbaru B2C dan harga buka B2B; net B2B Rp1.350.000. Katalog belum diperbarui. | Owner | Selesai |
| 2 | Ukuran standar katalog pakai harga katalog (Rectangle 40 × 60 = Rp650.000) atau rumus per m² (= Rp420.000)? | Data mendukung: SKU katalog terjual tepat di harga katalog. Usulan: harga SKU untuk ukuran katalog, per m² untuk custom | Owner | Ya |
| 3 | Berapa harga minimum per item? | Usulan dari data: Rp650.000 (9 order custom kecil terjual Rp500.000–Rp765.000) | Owner | Ya |
| 4 | Garansi tertulis 7 hari (alur), 3 bulan (knowledge base), 2 minggu (katalog). Mana untuk apa? | 7 hari = klaim pecah di jalan / tidak sesuai; 3 bulan = fungsi LED & touchscreen | Owner | Ya |
| 5 | Ongkir: "ditanggung pembeli", "gratis ongkir Bandung" (katalog), dan jasa kirim Bandung Rp750.000 — mana yang berlaku? "Bisa 50%" artinya Putra Glass menanggung maks. 50%, atau ongkir dibayar 50% di DP? | Jasa kirim sesuai tabel bagian 6; opsi 50% belum diaktifkan | Owner | Ya |
| 6 | Add-on dihitung per unit, per m², atau per meter keliling (terutama aluminium dan HPL)? | Per unit | Owner | Ya |
| 7 | Sensor tangan menggantikan touchscreen atau tambahan? Cermin Basic (1 warna/saklar) boleh ditambah sensor atau baterai? | Pilih satu kontrol; Basic tanpa add-on kontrol | Owner | Ya |
| 8 | Katalog memberi harga no-sandblast Rp20.000–Rp80.000 lebih murah. Berlaku juga untuk custom? | SKU katalog: ya, Rp50.000–Rp65.000 lebih murah (data). Custom: harga sama | Owner | Tidak |
| 9 | Survei tersedia? Area dan biayanya? | Tidak ada survei; klien dipandu mengukur sendiri + kirim foto dinding | Owner | Tidak |
| 10 | Pembagian rentang pasang (Bandung 300–500 rb, luar kota 800 rb–1 jt) menjadi batas admin vs owner sudah benar? Luar kota mencakup kota mana saja? | Batas atas rentang = batas admin | Owner | Tidak |
| 11 | Klien boleh berkunjung ke workshop Bandung? Alamat dicantumkan di PDF? | Tidak dicantumkan | Owner | Tidak |
| 12 | Rekening, nama penerima, nomor WhatsApp resmi untuk PDF | — | Owner | Ya (PDF) |
| 13 | Bentuk Rectangle di katalog bersudut lengkung? Termasuk "boleh aluminium"? | Hanya persegi bersudut siku | Owner | Tidak |
| 14 | Bisa dikumpulkan 30–50 percakapan lama (yang closing dan yang gagal) sebagai benih memori? | Ya, sebelum fase 2 | Owner | Tidak |
| 15 | Jumlah admin dan perangkatnya (Android/iPhone/laptop); anggaran API bulanan maksimum | 1–3 admin | Owner + engineering | Tidak |
| 16 | Siapa yang masuk B2B (desainer interior, kontraktor, hotel/proyek, reseller)? Ada syarat minimal unit atau nilai order? | Ditetapkan admin per lead, tanpa syarat minimal | Owner | Ya |
| 17 | Rp1.350.000/m² boleh diberikan admin langsung, atau perlu langkah antara (mis. per jumlah unit) dan persetujuan owner? | **Terjawab:** bertingkat per jumlah unit; harga net hanya lewat persetujuan owner | Owner | Selesai |
| 18 | Klien B2B dapat harga khusus juga untuk varian Basic, add-on, ongkir, dan pasang? | Sama dengan B2C | Owner | Tidak |
| 19 | Isi tabel tingkat B2B: rentang jumlah unit dan harga per m² tiap tingkat. Jumlah unit dihitung per penawaran? | **Terjawab sebagian:** unit dihitung per penawaran. Nilai tingkat belum diisi; v1 rilis dengan B2B = harga list, potongan lewat persetujuan owner | Owner | Tidak |
| 20 | Baterai: knowledge base +Rp150.000, tetapi SKU katalog terjual +Rp180.000–Rp200.000. Mana yang berlaku untuk custom? | +Rp150.000 untuk custom; SKU katalog memakai harga SKU | Owner | Ya |
| 21 | Harga produk dan tambahan yang terjual tetapi belum ada di knowledge base: gambar/logo/nama, frame, LED COB, cermin bevel tanpa LED, kaca polos + jasa pasang | Belum ada; AI menandai "perlu owner" saat klien memintanya | Owner | Tidak |
| 22 | Order custom lewat Shopee/TikTok: harga dinaikkan untuk potongan platform (data: harga custom Shopee tidak bulat, mis. Rp1.024.925)? Prosesnya lewat link khusus? | Belum ada; draf custom di marketplace ditandai "perlu owner" | Owner | Tidak |

## 12. Tahapan Rilis

P0 selesai sekitar 4 minggu dengan satu developer full-stack berpengalaman. Kalkulator dibangun lebih dulu karena mesin harga adalah dependensi AI, dan langsung berguna bagi admin walau AI belum jalan.

1. **Fase 0 — Persiapan (2–3 hari).** Owner menjawab pertanyaan 2–7, 12, 16, dan 20; kumpulkan 30–50 percakapan lama; admin mulai mencatat baseline.
2. **Fase 1 — Kalkulator & PDF (minggu 1–2).** `pricing.ts` + unit test untuk setiap baris tabel harga dan contoh hitung, buku harga berversi, layar Penawaran, PDF, login dan peran. *Gerbang:* 20 penawaran nyata dicek owner, 0 selisih.
3. **Fase 2 — Balas dari screenshot (minggu 2–3).** Ekstraksi, draf, validasi angka, panel internal, tandai terkirim. *Gerbang:* set uji 30 kasus — 0 angka salah, ≥ 80% draf dinilai owner "layak kirim dengan edit kecil".
4. **Fase 3 — Memori (minggu 4).** Kartu memori, penandaan hasil, pengambilan memori, panel "Memori yang dipakai", benih dari percakapan lama. *Gerbang:* 20 draf sampel merujuk kasus yang relevan.
5. **Fase 4 — Evaluasi & P1 (minggu 5–8).** Dasbor mingguan, usulan playbook dari editan, Share Target Android, gambar teknik di PDF.
