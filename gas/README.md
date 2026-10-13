# Panduan Deployment Google Apps Script (Backend Akun Baru)
## Sistem Pengarsipan Dokumen DPRD Kota Parepare (2024 - 2029)

Dokumen ini adalah panduan lengkap migrasi backend, database Google Sheets, dan penyimpanan Google Drive ke **Akun Google Baru**.

---

### Langkah 1: Buat Project di Akun Google Baru
1. Login ke browser menggunakan **Akun Google Baru** Anda.
2. Buka [script.google.com](https://script.google.com).
3. Klik tombol **New project** (Proyek Baru) di kiri atas.
4. Beri nama proyek: `DPRD-PAREPARE-BACKEND`.

---

### Langkah 2: Tempelkan Kode Backend
1. Buka editor file `Code.gs`.
2. Hapus seluruh isi default `function myFunction() { ... }`.
3. Buka file [`gas/Code.gs`](file:///home/avva/Projects/DPRD-SISTEM/gas/Code.gs) pada repository ini, salin (**Copy**) seluruh isinya.
4. Tempelkan (**Paste**) ke dalam editor Apps Script.
5. Tekan `Ctrl + S` untuk menyimpan proyek.

---

### Langkah 3: Jalankan Setup Otomatis Database & Drive
1. Pada toolbar dropdown pilihan fungsi di bagian atas editor, pilih **`setupDatabaseDPRD`**.
2. Klik tombol **Run** (Jalankan).
3. Google akan menampilkan dialog perizinan (*Authorization Required*):
   - Klik **Review Permissions** (Tinjau Izin).
   - Pilih akun Google Anda.
   - Klik **Advanced** (Lanjutan) di kiri bawah.
   - Klik tautan **Go to DPRD-PAREPARE-BACKEND (unsafe)**.
   - Klik tombol **Allow** (Izinkan).
4. Skrip akan berjalan dan secara otomatis membuat:
   - **Spreadsheet Database**: `DATABASE ARSIP DPRD KOTA PAREPARE` lengkap dengan 7 sheet:
     1. `users` (Bootstrap akun `superadmin` terenkripsi salted SHA-256)
     2. `dewan` (Terisi otomatis 25 Anggota resmi DPRD Kota Parepare 2024 - 2029)
     3. `kategori_dokumen` (Terisi 6 kategori arsip resmi DPRD)
     4. `tahun_dokumen`
     5. `folder_dokumen`
     6. `dokumen`
     7. `aktivitas_log`
   - **Folder Google Drive**: `Arsip Dokumen DPRD - Kota Parepare / Dokumen Fisik`.
   - Mengisi otomatis `PropertiesService` (`DATABASE_ID`, `ROOT_FOLDER_ID`, `DOKUMEN_FOLDER_ID`, `PASSWORD_SALT`).
5. Periksa **Execution log** (Log Eksekusi) di bawah editor; pastikan muncul ringkasan `status: "SETUP_SUCCESS"`.
6. *(Opsional)* Untuk memverifikasi kelengkapan seluruh tabel dan izin, pilih fungsi **`checkDatabaseDPRD`** lalu klik **Run**.

---

### Langkah 4: Publikasikan sebagai Web App (API Production)
1. Klik tombol **Deploy** di pojok kanan atas > pilih **New deployment**.
2. Klik ikon roda gigi (*Select type*) di sebelah kiri > pilih **Web app**.
3. Isi konfigurasi deployment:
   - **Description**: `Produksi DPRD Parepare v2`
   - **Execute as**: **`Me (email-anda@gmail.com)`** *(Wajib agar skrip memiliki hak mengelola Drive dan Sheets akun Anda)*
   - **Who has access**: **`Anyone`** *(Wajib agar antarmuka web Vercel dapat memanggil endpoint API)*
4. Klik **Deploy**.
5. Salin **Web app URL** yang berakhiran `/exec`.
   Contoh format:
   `https://script.google.com/macros/s/AKfycb.../exec`

---

### Langkah 5: Hubungkan ke Vercel
1. Buka dashboard proyek Anda di [vercel.com](https://vercel.com).
2. Masuk ke tab **Settings** > **Environment Variables**.
3. Tambahkan atau perbarui variabel:
   - **Key**: `VITE_APPS_SCRIPT_URL`
   - **Value**: *(Tempelkan URL Web App dari Langkah 4)*
4. Masuk ke tab **Deployments** di Vercel, lalu klik tombol titik tiga `...` pada deployment terbaru > **Redeploy**.
5. Selesai! Frontend Vercel kini 100% menggunakan backend, database, dan Google Drive akun baru.

---

### Akun Awal & Keamanan
- **Username**: `superadmin`
- **Password Awal**: `SandiRahasia123!`
- **Kebijakan Keamanan**:
  Pada saat pertama kali login menggunakan akun awal, sistem akan secara otomatis mewajibkan Anda untuk mengganti kata sandi baru (minimal 8 karakter kombinasi huruf dan angka) di halaman Profil sebelum dapat mengakses dokumen.
- **Pemulihan Password Darurat**:
  Jika Anda lupa kata sandi superadmin di kemudian hari, buka Apps Script Editor, jalankan fungsi:
  `resetSuperadminPasswordManual("KataSandiBaruAnda123!")`
  Prosedur ini hanya dapat dieksekusi secara privat oleh pemilik akun Google tanpa risiko eksploitasi endpoint publik.
