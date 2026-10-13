# Panduan Deployment Google Apps Script (Backend & Database)

Backend Sistem Pengarsipan Dokumen DPRD menggunakan **Google Apps Script**, **Google Sheets**, dan **Google Drive**.

---

## Langkah 1: Buat Project Google Apps Script
1. Buka browser dan kunjungi [script.google.com](https://script.google.com).
2. Klik tombol **New project** / **Project Baru**.
3. Beri nama project: `DPRD-SISTEM-BACKEND`.

---

## Langkah 2: Salin Kode Backend
1. Hapus isi fungsi default `myFunction()` pada editor file `Code.gs`.
2. Salin seluruh isi berkas [Code.gs](file:///home/avva/Projects/DPRD-SISTEM/gas/Code.gs).
3. Tempelkan (*paste*) ke dalam editor Apps Script.
4. Simpan dengan menekan `Ctrl + S`.

---

## Langkah 3: Jalankan Inisialisasi Otomatis (setupApp)
1. Pada menu dropdown fungsi di bagian atas editor, pilih `setupApp`.
2. Klik tombol **Run** / **Jalankan**.
3. Google akan meminta persetujuan izin akses (*Review Permissions*):
   - Pilih akun Google Anda.
   - Klik **Advanced** (Lanjutan).
   - Klik **Go to DPRD-SISTEM-BACKEND (unsafe)**.
   - Klik **Allow** (Izinkan).
4. Periksa log eksekusi (Execution Log). `setupApp` akan secara otomatis membuat:
   - Spreadsheet Database lengkap dengan 7 lembar kerja:
     1. `users` (terisi akun default: `staff`, `kabag`, `admin`)
     2. `dewan` (terisi contoh data anggota DPRD 2024–2029)
     3. `kategori_dokumen` (terisi kategori arsip resmi DPRD)
     4. `tahun_dokumen`
     5. `folder_dokumen`
     6. `dokumen`
     7. `aktivitas_log`
   - Folder Google Drive: `Arsip Dokumen DPRD - Penganggaran & Pengawasan / Dokumen Fisik`
   - Menghasilkan salt rahasia `PASSWORD_SALT` dan ID ke dalam *Script Properties*.

---

## Langkah 4: Deploy sebagai Web App (API Publik Aman)
1. Klik tombol **Deploy** di pojok kanan atas, lalu pilih **New deployment**.
2. Klik ikon gerigi (Select type) di sebelah kiri, pilih **Web app**.
3. Isi konfigurasi berikut:
   - **Description**: `Versi 1.0 Produksi`
   - **Execute as**: `Me (email@gmail.com)` *(Sangat penting: agar aplikasi dapat menulis ke Sheets & Drive Anda)*
   - **Who has access**: `Anyone` *(Sangat penting: agar browser frontend di Vercel dapat memanggil API)*
4. Klik **Deploy**.
5. Salin **Web app URL** yang muncul (formatnya: `https://script.google.com/macros/s/AKfycb.../exec`).
6. URL ini dimasukkan ke environment variable frontend Vercel: `VITE_APPS_SCRIPT_URL`.

---

## Akun Login Awal
- **Staff Pengarsipan**: Username `staff` / Password `staff123`
- **Kepala Bagian**: Username `kabag` / Password `kabag123`
- **Administrator**: Username `admin` / Password `admin123`
