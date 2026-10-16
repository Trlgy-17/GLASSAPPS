<tanggal>{{tanggal_hari_ini}}</tanggal>
<kanal>{{kasus.kanal}}</kanal>

<riwayat_lead>
Nama: {{lead.nama}} | Kota: {{lead.kota}} ({{lead.zona}}) | Segmen: {{lead.segmen}} | Status: {{lead.status}}
Penawaran terakhir: {{penawaran.nomor}}, total {{penawaran.total}}, {{penawaran.tanggal}}
Keberatan sebelumnya: {{lead.keberatan}}
</riwayat_lead>

<aturan_playbook>
{{daftar aturan aktif, bernomor}}
</aturan_playbook>

<memori_kasus>
<kasus hasil="DP" kemiripan="0.83" tanggal="2026-09-12">
Situasi: {{ringkasan}}
Balasan yang dikirim: {{teks_final}}
</kasus>
... maksimal 5 kasus
</memori_kasus>

<hasil_kalkulator>
{{JSON dari pricing.ts: per item luas, harga cermin, add-on, subtotal; ongkir & pasang (list + batas admin); total; DP; pelunasan; alternatif varian Basic}}
</hasil_kalkulator>

<transkrip>
{{maks. 30 pesan terakhir hasil ekstraksi, format "[HH:MM] klien: ..."}}
</transkrip>

<arahan_admin>{{chip atau teks bebas; boleh kosong}}</arahan_admin>

Tulis draf balasan untuk pesan klien terakhir.
