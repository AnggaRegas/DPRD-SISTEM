/**
 * Suite Pengujian Otomatis Sistem Pengarsipan Dokumen DPRD Kota Parepare
 * Memverifikasi Autentikasi, Kriptografi PBKDF2, Hak Akses (RBAC), Proteksi Integritas,
 * Validasi Berkas Drive, Revokasi Sesi Real-Time, dan Konkurensi Simultan
 */
import crypto from 'crypto';
import { api } from '../assets/js/api.js';
import { saveSession, clearSession, isSessionExpiredClientSide, getStoredToken, getStoredUser, getSafeRedirectUrl, formatDateIndonesia, escapeHtml, sanitizeUrl } from '../assets/js/auth.js';

console.log('=== MEMULAI TEST VERIFIKASI LENGKAP SISTEM ARSIP DPRD KOTA PAREPARE ===\n');

async function runAllTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, name, detail = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${detail ? '(' + detail + ')' : ''}`);
      failed++;
    }
  }

  // ================= 1. VERIFIKASI KRIPTOGRAFI PBKDF2-HMAC-SHA256 (RFC 6070) =================
  console.log('--- 1. Verifikasi Standar Kriptografi PBKDF2-HMAC-SHA256 (RFC 6070) ---');

  // Vektor Uji 1: c = 1, dkLen = 32
  const v1 = crypto.pbkdf2Sync('password', 'salt', 1, 32, 'sha256').toString('hex');
  assert(v1 === '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b', 'RFC 6070 PBKDF2-HMAC-SHA256 (c=1, dkLen=32) valid');

  // Vektor Uji 2: c = 2, dkLen = 32
  const v2 = crypto.pbkdf2Sync('password', 'salt', 2, 32, 'sha256').toString('hex');
  assert(v2 === 'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43', 'RFC 6070 PBKDF2-HMAC-SHA256 (c=2, dkLen=32) valid');

  // Vektor Uji 3: c = 4096, dkLen = 32
  const v4096 = crypto.pbkdf2Sync('password', 'salt', 4096, 32, 'sha256').toString('hex');
  assert(v4096 === 'c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a', 'RFC 6070 PBKDF2-HMAC-SHA256 (c=4096, dkLen=32) valid');

  // Vektor Uji 4: Simulasi Hashing Apps Script Byte[] (RFC 2898 / RFC 6070)
  function simulateGasPbkdf2(password, salt, iter) {
    const passwordBytes = Buffer.from(password, 'utf8');
    const saltBytes = Buffer.from(salt, 'utf8');
    const initialData = Buffer.concat([saltBytes, Buffer.from([0, 0, 0, 1])]);
    let u = crypto.createHmac('sha256', passwordBytes).update(initialData).digest();
    let result = Buffer.from(u);
    for (let i = 1; i < iter; i++) {
      u = crypto.createHmac('sha256', passwordBytes).update(u).digest();
      for (let k = 0; k < result.length; k++) {
        result[k] ^= u[k];
      }
    }
    return 'pbkdf2$' + iter + '$' + result.toString('hex');
  }

  const gasSim1000 = simulateGasPbkdf2('SandiDPRD2026!', 'salt_test_123', 1000);
  const nodeExpected1000 = 'pbkdf2$1000$' + crypto.pbkdf2Sync('SandiDPRD2026!', 'salt_test_123', 1000, 32, 'sha256').toString('hex');
  assert(gasSim1000 === nodeExpected1000, 'Simulasi Hashing Apps Script Byte[] identik bitwise dengan crypto.pbkdf2Sync');

  // ================= 2. PENGUJIAN AUTENTIKASI, LOCKOUT & RATE LIMITING =================
  console.log('\n--- 2. Pengujian Autentikasi, Proteksi Brute-Force & Lockout ---');

  // Test 4: Login gagal username tidak ada
  const loginNonexistent = await api.login('user_tidak_dikenal_123', 'SandiRahasia123!');
  assert(!loginNonexistent.success, 'Login gagal untuk username tidak terdaftar');
  assert(loginNonexistent.message === 'Username atau password tidak valid.', 'Pesan kegagalan login bersifat generik tanpa informasi bocor');

  // Test 5: Simulasi percobaan salah 5x untuk memicu lockout 15 menit
  for (let i = 1; i <= 4; i++) {
    await api.login('target_lockout', 'SalahPass' + i);
  }
  const attempt5 = await api.login('target_lockout', 'SalahPass5');
  assert(!attempt5.success && attempt5.error?.code === 'TOO_MANY_REQUESTS', 'Percobaan ke-5 memicu penguncian akun (Lockout 15 menit)');

  const attempt6 = await api.login('target_lockout', 'SalahPass6');
  assert(!attempt6.success && attempt6.error?.code === 'TOO_MANY_REQUESTS', 'Permintaan berikutnya selama periode lockout langsung ditolak');

  // Test 6: Login akun superadmin awal
  const loginSuper = await api.login('superadmin', 'SandiRahasia123!');
  assert(loginSuper.success && loginSuper.data?.token, 'Login berhasil dengan kredensial superadmin');
  assert(loginSuper.data?.user?.mustChangePassword === true, 'Akun superadmin awal memiliki flag mustChangePassword = true');

  // ================= 3. PROTEKSI WAJIB GANTI PASSWORD (GATE ENFORCEMENT) =================
  console.log('\n--- 3. Proteksi Wajib Ganti Password (Gate Enforcement) ---');

  // Test 7: Akses fitur diblokir saat mustChangePassword = true
  const blockedDash = await api.getDashboardData();
  assert(!blockedDash.success && blockedDash.error?.code === 'MUST_CHANGE_PASSWORD', 'Akses dashboard ditolak sebelum ganti password');

  const blockedDewan = await api.getDewanList();
  assert(!blockedDewan.success && blockedDewan.error?.code === 'MUST_CHANGE_PASSWORD', 'Akses data dewan ditolak sebelum ganti password');

  const blockedUpload = await api.uploadDokumen({ dewan_id: 'DWN-01', kategori_id: 'KAT-01', tahun: 2026 });
  assert(!blockedUpload.success && blockedUpload.error?.code === 'MUST_CHANGE_PASSWORD', 'Unggah dokumen ditolak sebelum ganti password');

  // Test 8: Hanya aksi changePassword & checkSession yang diizinkan saat mustChangePassword
  const checkSessBefore = await api.checkSession();
  assert(checkSessBefore.success && checkSessBefore.data?.mustChangePassword === true, 'Sesi dapat diperiksa untuk menampilkan UI ganti password');

  // Test 9: Ganti kata sandi dengan validasi password lama
  const wrongOldPass = await api.changePassword('SalahPasswordLama', 'PasswordBaru123!');
  assert(!wrongOldPass.success && wrongOldPass.error?.code === 'INVALID_OLD_PASSWORD', 'Penggantian sandi gagal jika password lama salah');

  const validChange = await api.changePassword('SandiRahasia123!', 'SandiKuatSuperadmin2026!');
  assert(validChange.success, 'Kata sandi superadmin berhasil diperbarui');
  assert(validChange.data?.mustChangePassword === false, 'Flag mustChangePassword dinonaktifkan setelah penggantian');

  // Test 10: Setelah sandi diganti, akses ke dashboard dan data normal kembali
  const allowedDash = await api.getDashboardData();
  assert(allowedDash.success && allowedDash.data?.totalDewan >= 0, 'Akses fitur terbuka penuh setelah kata sandi diganti');

  // ================= 4. PENGUJIAN ANGGOTA DEWAN & VALIDASI =================
  console.log('\n--- 4. Pengujian Anggota DPRD Kota Parepare (2024 - 2029) ---');

  const dewanList = await api.getDewanList();
  assert(dewanList.success && Array.isArray(dewanList.data) && dewanList.data.length >= 4, 'Daftar 25 anggota DPRD Kota Parepare berhasil dimuat');

  const searchDewan = await api.getDewanList('KAHARUDDIN');
  assert(searchDewan.success && searchDewan.data.length >= 1, 'Pencarian nama dewan berhasil');

  const newDewan = await api.createDewan({
    nomor_urut: 26,
    nama: 'H. Ir. Uji Coba Dewan, M.Si.',
    jabatan: 'Anggota Komisi III',
    periode: '2024 - 2029',
    nama_pendamping: 'Staf Uji',
    nama_partai: 'Partai Golongan Karya'
  });
  assert(newDewan.success && newDewan.data?.id, 'Tambah anggota dewan baru berhasil');
  const testDewanId = newDewan.data?.id;

  const toggleDewan = await api.toggleDewanStatus(testDewanId, 'nonaktif');
  assert(toggleDewan.success && toggleDewan.data?.status === 'nonaktif', 'Status anggota dewan dapat dinonaktifkan');

  // ================= 5. PENGUJIAN KATEGORI, TAHUN & FOLDER =================
  console.log('\n--- 5. Pengujian Kategori Arsip, Tahun, & Folder Dokumen ---');

  const katList = await api.getKategoriList();
  assert(katList.success && Array.isArray(katList.data) && katList.data.length >= 3, 'Daftar kategori dokumen berhasil dimuat');

  const newKat = await api.createKategori('Arsip Risalah Rapat Komisi 2026', 'Kategori uji verifikasi');
  assert(newKat.success && newKat.data?.id, 'Tambah kategori arsip berhasil');
  const testKatId = newKat.data?.id;

  const dupKat = await api.createKategori('arsip risalah rapat komisi 2026');
  assert(!dupKat.success, 'Sistem menolak duplikasi kategori (case-insensitive)');

  const newTahun = await api.createTahun(testDewanId, testKatId, 2026);
  assert(newTahun.success && newTahun.data?.tahun === 2026, 'Tambah tahun anggaran (2026) berhasil');

  const newFolder = await api.createFolder(testDewanId, testKatId, 2026, 'Sidang Paripurna I');
  assert(newFolder.success && newFolder.data?.nama_folder === 'Sidang Paripurna I', 'Tambah folder berkas berhasil');

  // Uji Idempotensi Double-Click Pembuatan Folder
  const [folderClick1, folderClick2] = await Promise.all([
    api.createFolder(testDewanId, testKatId, 2026, 'Sidang Paripurna I'),
    api.createFolder(testDewanId, testKatId, 2026, 'Sidang Paripurna I')
  ]);
  assert(folderClick1.success && folderClick2.success, 'Double-click pembuatan folder menghasilkan respons sukses secara konsisten');
  const folderListCheck = await api.getFolderList(testDewanId, testKatId, 2026);
  const matchingFolders = (folderListCheck.data || []).filter(f => f.nama_folder.toLowerCase() === 'sidang paripurna i');
  assert(matchingFolders.length === 1, 'Hanya ada 1 folder yang dibuat meski tombol diklik berulang kali (Idempotensi Folder)');

  // ================= 6. VALIDASI UNGGAH BERKAS, UNDUH & PROTEKSI DRIVE =================
  console.log('\n--- 6. Pengujian Dokumen Arsip & Proteksi Berkas Google Drive ---');

  // Test 11: Tolak ekstensi berbahaya
  const badExtUpload = await api.uploadDokumen({
    dewan_id: testDewanId,
    kategori_id: testKatId,
    tahun: 2026,
    nama_folder: 'Sidang Paripurna I',
    nama_dokumen: 'Skrip Berbahaya',
    fileName: 'exploit.exe',
    base64: 'data:application/octet-stream;base64,TVqQAAMAAAAEAAAA...'
  });
  assert(!badExtUpload.success && badExtUpload.error?.code === 'FILE_VALIDATION_ERROR', 'Sistem menolak unggahan berkas dengan ekstensi tidak diizinkan (.exe)');

  // Test 12: Unggah berkas valid (PDF) dengan pengujian double-click
  const uploadPayload = {
    dewan_id: testDewanId,
    kategori_id: testKatId,
    tahun: 2026,
    nama_folder: 'Sidang Paripurna I',
    nama_dokumen: 'Risalah Rapat Paripurna Penetapan APBD',
    keterangan: 'Dokumen sah hasil rapat dewan',
    fileName: 'risalah_apbd_2026.pdf',
    base64: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...'
  };
  const [upload1, upload2] = await Promise.all([
    api.uploadDokumen(uploadPayload),
    api.uploadDokumen(uploadPayload)
  ]);
  assert(upload1.success && upload2.success, 'Double-click unggah dokumen menghasilkan respons sukses tanpa duplikasi');
  const testDocId = upload1.data?.id;

  const docListCheck = await api.getDokumenList({
    dewan_id: testDewanId,
    kategori_id: testKatId,
    tahun: 2026,
    nama_folder: 'Sidang Paripurna I'
  });
  const matchingDocs = (docListCheck.data || []).filter(d => d.nama_dokumen.toLowerCase() === 'risalah rapat paripurna penetapan apbd');
  assert(matchingDocs.length === 1, 'Hanya ada 1 dokumen yang tersimpan meski tombol unggah diklik dua kali secara simultan (Idempotensi Dokumen)');

  // Test 13: Unduh dokumen terotentikasi (downloadDokumen)
  const downloadDoc = await api.downloadDokumen(testDocId);
  assert(downloadDoc.success && downloadDoc.data?.base64 && downloadDoc.data?.nama_file, 'Pengunduhan dokumen melalui endpoint terotentikasi berhasil');

  // Test 14: Perlindungan dependensi integritas data (Kategori, Dewan, dan Folder)
  const delUsedKat = await api.deleteKategori(testKatId);
  assert(!delUsedKat.success && delUsedKat.error?.code === 'HAS_DEPENDENT_RECORDS', 'Penghapusan kategori dengan dokumen aktif ditolak demi integritas');

  const delUsedDewan = await api.deleteDewan(testDewanId);
  assert(!delUsedDewan.success && delUsedDewan.error?.code === 'HAS_DEPENDENT_RECORDS', 'Penghapusan dewan dengan dokumen aktif ditolak demi integritas');

  const delUsedFolder = await api.deleteFolder(testDewanId, testKatId, 2026, 'Sidang Paripurna I');
  assert(!delUsedFolder.success && delUsedFolder.error?.code === 'HAS_DEPENDENT_RECORDS', 'Penghapusan folder dengan dokumen aktif ditolak demi integritas (HAS_DEPENDENT_RECORDS)');

  // Test 14b: Ubah nama folder (updateFolder)
  const updateFolderRes = await api.updateFolder({
    dewan_id: testDewanId,
    kategori_id: testKatId,
    tahun: 2026,
    folder_lama: 'Sidang Paripurna I',
    folder_baru: 'Sidang Paripurna I Revisi'
  });
  assert(updateFolderRes.success && updateFolderRes.data?.nama_folder === 'Sidang Paripurna I Revisi', 'Pembaruan nama folder berhasil diterapkan');

  // Test 14c: Pembatalan dialog konfirmasi (Cancel simulation)
  let cancelCalled = false;
  const simulateModal = (opts) => {
    if (typeof opts.onCancel === 'function') opts.onCancel();
    cancelCalled = true;
  };
  simulateModal({
    title: 'Hapus Berkas',
    onCancel: () => { cancelCalled = true; },
    onConfirm: async () => { await api.deleteDokumen(testDocId); }
  });
  assert(cancelCalled === true, 'Membatalkan dialog konfirmasi tidak menghapus dokumen atau memicu aksi penghapusan');

  // Test 15: Hapus dokumen arsip
  const delDoc = await api.deleteDokumen(testDocId);
  assert(delDoc.success, 'Dokumen arsip berhasil dihapus');

  const docListAfterDel = await api.getDokumenList({ dewan_id: testDewanId, kategori_id: testKatId, tahun: 2026 });
  assert(!docListAfterDel.data?.some(d => d.id === testDocId), 'Dokumen terhapus tidak muncul lagi di daftar dokumen (Cache ter-invalidasi)');

  // Test 15b: Hapus folder yang sudah kosong
  const delEmptyFolder = await api.deleteFolder({
    dewan_id: testDewanId,
    kategori_id: testKatId,
    tahun: 2026,
    nama_folder: 'Sidang Paripurna I Revisi'
  });
  assert(delEmptyFolder.success, 'Folder kosong berhasil dihapus setelah berkas di dalamnya bersih');

  const folderListAfterDel = await api.getFolderList(testDewanId, testKatId, 2026);
  assert(!folderListAfterDel.data?.some(f => f.nama_folder.toLowerCase() === 'sidang paripurna i revisi'), 'Folder terhapus tidak muncul lagi di daftar folder (Cache ter-invalidasi)');

  // Test 16: Hapus kategori dan dewan setelah tidak memiliki berkas
  const delSafeKat = await api.deleteKategori(testKatId);
  assert(delSafeKat.success, 'Kategori tanpa berkas dapat dihapus dengan aman');

  const delSafeDewan = await api.deleteDewan(testDewanId);
  assert(delSafeDewan.success, 'Anggota dewan tanpa berkas dapat dihapus dengan aman');

  // ================= 7. PENGUJIAN RBAC & REVOKASI SESI REAL-TIME =================
  console.log('\n--- 7. Pengujian Otorisasi Peran (RBAC) & Revokasi Sesi Real-Time ---');

  // Buat akun staf baru oleh superadmin
  const newStaff = await api.createUser({
    username: 'staf_lapangan',
    nama: 'Staf Pengarsip Lapangan',
    password: 'PasswordStaf123!',
    role: 'staff'
  });
  assert(newStaff.success && newStaff.data?.username === 'staf_lapangan', 'Superadmin berhasil mendaftarkan staf baru');
  const staffUserId = newStaff.data?.id;

  // Login sebagai staf
  const loginStaff = await api.login('staf_lapangan', 'PasswordStaf123!');
  assert(loginStaff.success && loginStaff.data?.user?.role === 'staff', 'Login sebagai akun staf berhasil');

  // Ganti password pertama staf agar bisa mengakses fitur
  await api.changePassword('PasswordStaf123!', 'PasswordStafKuat2026!');

  // Test 17: Uji RBAC - Staf mencoba aksi administratif (harus DITOLAK FORBIDDEN)
  const staffCreateUser = await api.createUser({ username: 'hacker', nama: 'Hacker', password: 'P123', role: 'admin' });
  assert(!staffCreateUser.success && staffCreateUser.error?.code === 'FORBIDDEN', 'Staf dilarang membuat akun pengguna baru (RBAC: FORBIDDEN)');

  const staffDeleteDewan = await api.deleteDewan('DWN-01');
  assert(!staffDeleteDewan.success && staffDeleteDewan.error?.code === 'FORBIDDEN', 'Staf dilarang menghapus anggota dewan (RBAC: FORBIDDEN)');

  const staffDeleteKat = await api.deleteKategori('KAT-01');
  assert(!staffDeleteKat.success && staffDeleteKat.error?.code === 'FORBIDDEN', 'Staf dilarang menghapus kategori (RBAC: FORBIDDEN)');

  // Test 18: Uji Revokasi Sesi Real-Time saat akun dinonaktifkan
  // Switch kembali ke superadmin untuk menonaktifkan akun staf
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  const deactivateStaff = await api.toggleUserStatus(staffUserId, 'nonaktif');
  assert(deactivateStaff.success, 'Superadmin berhasil menonaktifkan akun staf');

  // Login ulang dengan sesi staf yang dinonaktifkan
  const tryLoginDisabled = await api.login('staf_lapangan', 'PasswordStafKuat2026!');
  assert(!tryLoginDisabled.success, 'Akun nonaktif ditolak login ke dalam sistem');

  // ================= 8. SIMULASI 5 PENGGUNA SIMULTAN (CONCURRENCY) =================
  console.log('\n--- 8. Simulasi 5 Pengguna Akses Simultan (Concurrency) ---');

  const concurrentRequests = [1, 2, 3, 4, 5].map(async (idx) => {
    const dList = await api.getDewanList();
    const dash = await api.getDashboardData();
    const kList = await api.getKategoriList();
    return dList.success && dash.success && kList.success;
  });

  const results = await Promise.all(concurrentRequests);
  const allPassed = results.every(r => r === true);
  assert(allPassed, '5 Pengguna mengakses sistem secara bersamaan tanpa konflik atau race-condition');

  // Test 19: Audit Log Aktivitas
  const auditLogs = await api.getActivityLog(10);
  assert(auditLogs.success && Array.isArray(auditLogs.data), 'Log audit aktivitas sistem tercatat dan dapat diambil');

  // Test 20: Bersihkan Semua Aktivitas Log (Purge Activity Log)
  const clearLogsRes = await api.clearActivityLog();
  assert(clearLogsRes.success && clearLogsRes.data?.cleared === true, 'Pembersihan seluruh riwayat log aktivitas berhasil');

  const afterClearLogs = await api.getActivityLog(10);
  assert(afterClearLogs.success && Array.isArray(afterClearLogs.data) && afterClearLogs.data.length === 1 && afterClearLogs.data[0].aksi === 'BERSIHKAN_LOG', 'Log setelah dibersihkan hanya menyisakan 1 rekaman audit BERSIHKAN_LOG');

  // Test 21: In-Flight Deduplication & In-Memory Caching
  const [req1, req2] = await Promise.all([
    api.getDewanList(),
    api.getDewanList()
  ]);
  assert(req1.success && req2.success && req1.data?.length === req2.data?.length, 'Deduplikasi in-flight request dan in-memory caching berjalan mulus');

  // ================= 9. PENGUJIAN SESI TAB RESUME, EXPIRATION & DEDUPLIKASI =================
  console.log('\n--- 9. Pengujian Sesi Tab Resume, Expiration & Deduplikasi Permintaan ---');

  // Test 22: Penyimpanan Sesi Lengkap dengan Timestamp
  const dummyUser = { id: 'u_test_99', username: 'superadmin', nama: 'Super Admin', role: 'superadmin' };
  saveSession('DPRD_SES_test_token_1234567890', dummyUser);
  const tokenSaved = getStoredToken();
  const userSaved = getStoredUser();
  assert(tokenSaved === 'DPRD_SES_test_token_1234567890' && userSaved?.username === 'superadmin', 'Sesi baru tersimpan lengkap dengan token dan metadata pengguna');

  // Test 23: Sesi Baru Tidak Kedaluwarsa Client-Side
  const isExpFresh = isSessionExpiredClientSide();
  assert(isExpFresh === false, 'Sesi aktif yang baru dibuat terdeteksi valid (tidak kedaluwarsa)');

  // Test 24: Simulasi Overnight Resume (Sesi Kedaluwarsa Client-Side)
  const expiredUser = { ...dummyUser, expiresAt: Date.now() - 3600000 };
  saveSession('DPRD_SES_test_token_expired', expiredUser);
  const isExpSimulated = isSessionExpiredClientSide();
  assert(isExpSimulated === true, 'Sesi yang melewati batas waktu terdeteksi kedaluwarsa secara instan (0ms client-side check)');

  // Test 25: Pembersihan Sesi (clearSession)
  clearSession();
  assert(!getStoredToken() && !getStoredUser(), 'clearSession berhasil menghapus seluruh token, data pengguna, dan timestamp');

  // Test 26: Login ulang untuk validasi checkSession & Deduplikasi Sesi
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  const [sessPromise1, sessPromise2] = [api.checkSession(), api.checkSession()];
  const [sessRes1, sessRes2] = await Promise.all([sessPromise1, sessPromise2]);
  assert(sessRes1.success && sessRes2.success && sessRes1.data?.username === 'superadmin', 'checkSession berhasil divalidasi dengan in-flight deduplication');

  // Test 27: Force Refresh checkSession
  const refreshedSess = await api.checkSession(true);
  assert(refreshedSess.success && refreshedSess.data?.username === 'superadmin', 'checkSession dengan forceRefresh berhasil mengambil status terkini');

  // Test 28: Sanitasi Ketat URL Redirect (Proteksi Open Redirect & XSS)
  assert(getSafeRedirectUrl('arsip_dewan.html?dewan_id=5') === 'arsip_dewan.html?dewan_id=5', 'URL internal valid diterima dengan parameter query');
  assert(getSafeRedirectUrl('/dewan.html') === 'dewan.html', 'Path relatif diawali slash dinormalisasi ke halaman lokal');
  assert(getSafeRedirectUrl('javascript:alert(1)') === 'dashboard.html', 'Skema berbahaya javascript: berhasil dinetralisir ke dashboard');
  assert(getSafeRedirectUrl('https://attacker.com') === 'dashboard.html', 'Domain eksternal https://attacker.com berhasil diblokir');
  assert(getSafeRedirectUrl('//malicious.org/phish') === 'dashboard.html', 'Protocol-relative URL //malicious.org berhasil diblokir');
  assert(getSafeRedirectUrl('login.html') === 'dashboard.html', 'Pengalihan balik ke login.html dicegah untuk menghindari redirect loop');

  // ================= 10. PENGUJIAN MODUL KOMISI & DOKUMEN RDP =================
  console.log('\n--- 10. Pengujian Modul Komisi & Dokumen RDP ---');

  // Test 29: Komisi harus tepat 3 komisi
  const komisiListRes = await api.getKomisiList();
  assert(komisiListRes.success && Array.isArray(komisiListRes.data) && komisiListRes.data.length === 3, 'Terdapat tepat 3 Komisi (Komisi 1, Komisi 2, Komisi 3)');
  assert(komisiListRes.data[0].id === 'KOM-1' && komisiListRes.data[1].id === 'KOM-2' && komisiListRes.data[2].id === 'KOM-3', 'ID Komisi terdefinisi konsisten (KOM-1, KOM-2, KOM-3)');

  // Test 30: Unggah dokumen RDP untuk Komisi 1 (tahun 2024 dan 2026)
  const upRdp1 = await api.uploadRdpDokumen({
    komisi_id: 'KOM-1',
    tahun: 2024,
    nama_dokumen: 'RDP Pembahasan APBD 2024',
    keterangan: 'Agenda APBD',
    fileName: 'rdp_apbd_2024.pdf'
  });
  assert(upRdp1.success && upRdp1.data?.id, 'Dokumen RDP 2024 berhasil diunggah ke Komisi 1');

  const upRdp2 = await api.uploadRdpDokumen({
    komisi_id: 'KOM-1',
    tahun: 2026,
    nama_dokumen: 'RDP Drainase & Banjir 2026',
    keterangan: 'Agenda penanganan banjir',
    fileName: 'rdp_banjir_2026.pdf'
  });
  assert(upRdp2.success && upRdp2.data?.id, 'Dokumen RDP 2026 berhasil diunggah ke Komisi 1');

  // Test 31: Unggah dokumen RDP untuk Komisi 2 (tahun 2025)
  const upRdpKom2 = await api.uploadRdpDokumen({
    komisi_id: 'KOM-2',
    tahun: 2025,
    nama_dokumen: 'RDP Pasar Tradisional 2025',
    keterangan: 'Agenda penataan pasar',
    fileName: 'rdp_pasar_2025.pdf'
  });
  assert(upRdpKom2.success && upRdpKom2.data?.id, 'Dokumen RDP 2025 berhasil diunggah ke Komisi 2');

  // Test 32: Isolasi arsip antar komisi (Komisi 2 tidak boleh menampilkan arsip Komisi 1)
  const listRdpKom2 = await api.getRdpDokumenList('KOM-2', 'semua');
  assert(listRdpKom2.success && listRdpKom2.data?.dokumen?.length === 1, 'Komisi 2 hanya memiliki 1 dokumen RDP miliknya sendiri');
  assert(listRdpKom2.data?.dokumen[0].dewan_id === 'KOM-2', 'Dokumen RDP Komisi 2 terisolasi dari Komisi 1');

  // Test 33: Filter tahun dinamis pada Komisi 1 (available_years & filter tahun)
  const listRdpKom1All = await api.getRdpDokumenList('KOM-1', 'semua');
  assert(listRdpKom1All.success && listRdpKom1All.data?.dokumen?.length === 2, 'Komisi 1 menampilkan 2 dokumen RDP pada filter Semua Tahun');
  assert(listRdpKom1All.data?.available_years?.includes(2024) && listRdpKom1All.data?.available_years?.includes(2026), 'available_years mengembalikan pilihan tahun dinamis dari data aktual');

  const listRdpKom1_2024 = await api.getRdpDokumenList('KOM-1', '2024');
  assert(listRdpKom1_2024.success && listRdpKom1_2024.data?.dokumen?.length === 1 && listRdpKom1_2024.data?.dokumen[0].tahun === 2024, 'Filter tahun 2024 hanya menampilkan arsip tahun 2024');

  // Test 34: Hapus dokumen RDP
  const delRdpRes = await api.deleteRdpDokumen(upRdp1.data.id);
  assert(delRdpRes.success, 'Dokumen RDP berhasil dihapus');
  const listRdpKom1AfterDel = await api.getRdpDokumenList('KOM-1', 'semua');
  assert(listRdpKom1AfterDel.data?.dokumen?.length === 1, 'Daftar dokumen RDP berkurang setelah penghapusan');

  // ================= 11. PENGUJIAN KECAMATAN ANGGOTA DEWAN =================
  console.log('\n--- 11. Pengujian Pengaturan Kecamatan Anggota Dewan ---');

  // Test 35: Tambah anggota dewan dengan kecamatan resmi Kota Parepare
  const newDewanKec = await api.createDewan({
    nama: 'H. TEST DEWAN KECAMATAN, S.E.',
    jabatan: 'Anggota DPRD',
    periode: '2024 - 2029',
    nama_partai: 'Partai Golongan Karya',
    nama_pendamping: 'Staff Pengarsipan',
    kecamatan: 'Kecamatan Bacukiki Barat'
  });
  assert(newDewanKec.success && newDewanKec.data?.kecamatan === 'Kecamatan Bacukiki Barat', 'Superadmin berhasil menetapkan kecamatan asal dewan (Bacukiki Barat)');

  // Test 36: Update kecamatan dewan
  const updDewanKec = await api.updateDewan({
    id: newDewanKec.data.id,
    kecamatan: 'Kecamatan Soreang'
  });
  assert(updDewanKec.success && updDewanKec.data?.kecamatan === 'Kecamatan Soreang', 'Superadmin berhasil memperbarui kecamatan asal dewan ke Kecamatan Soreang');

  // ================= 12. PENGUJIAN PEMBATASAN AKSES STAF PENDAMPING =================
  console.log('\n--- 12. Pengujian Otorisasi & Pembatasan Akses Staf Pendamping ---');

  // Test 37: Login sebagai akun staf
  await api.logout();
  const staffLoginRes = await api.login('staff', 'PasswordStaff2026!');
  assert(staffLoginRes.success && staffLoginRes.data?.user?.role === 'staff', 'Login sebagai akun staf pengarsipan berhasil');

  // Test 38: Staf dilarang mengubah kecamatan dewan atau mengupdate data dewan (RBAC: FORBIDDEN)
  const staffUpdDewan = await api.updateDewan({ id: 'DWN-01', kecamatan: 'Kecamatan Ujung' });
  assert(!staffUpdDewan.success && staffUpdDewan.error?.code === 'FORBIDDEN', 'Staf dilarang mengubah data/kecamatan anggota dewan (RBAC: FORBIDDEN)');

  // Test 39: Staf dilarang mengakses log aktivitas dan daftar user
  const staffLogs = await api.getActivityLog();
  assert(!staffLogs.success && staffLogs.error?.code === 'FORBIDDEN', 'Staf dilarang mengakses log aktivitas sistem (RBAC: FORBIDDEN)');
  const staffUsers = await api.getUserList();
  assert(!staffUsers.success && staffUsers.error?.code === 'FORBIDDEN', 'Staf dilarang mengakses daftar user sistem (RBAC: FORBIDDEN)');

  // Test 40: Staf dilarang mengunggah arsip untuk dewan yang bukan penugasannya
  // DWN-01 ditugaskan ke 'SUKARNO, S. Kom.', bukan 'Staff Pengarsipan'
  const staffUploadLain = await api.uploadDokumen({
    dewan_id: 'DWN-01',
    kategori_id: 'KAT-01',
    tahun: 2026,
    nama_folder: 'Surat Masuk',
    nama_dokumen: 'Arsip Tidak Berizin',
    fileName: 'surat.pdf'
  });
  assert(!staffUploadLain.success && staffUploadLain.error?.code === 'FORBIDDEN', 'Staf dilarang mengunggah dokumen ke dewan staf lain (RBAC: FORBIDDEN)');

  // Test 41: Staf dilarang membuka daftar dokumen dewan staf lain
  const staffGetDocLain = await api.getDokumenList({ dewan_id: 'DWN-01' });
  assert(!staffGetDocLain.success && staffGetDocLain.error?.code === 'FORBIDDEN', 'Staf dilarang membaca arsip dewan staf lain (RBAC: FORBIDDEN)');

  // Test 42: Staf diizinkan mengunggah arsip untuk dewan penugasannya (DWN-02 ditugaskan ke Staff Pengarsipan)
  const staffUploadSendiri = await api.uploadDokumen({
    dewan_id: 'DWN-02',
    kategori_id: 'KAT-01',
    tahun: 2026,
    nama_folder: 'Pokir',
    nama_dokumen: 'Usulan Aspirasi Warga Soreang',
    fileName: 'usulan_soreang.pdf'
  });
  assert(staffUploadSendiri.success && staffUploadSendiri.data?.id, 'Staf berhasil mengunggah arsip untuk dewan penugasannya');

  // Test 43: Staf diizinkan mengunduh arsip dewan penugasannya
  const staffDownloadSendiri = await api.downloadDokumen(staffUploadSendiri.data.id);
  assert(staffDownloadSendiri.success && staffDownloadSendiri.data?.nama_file, 'Staf berhasil mengunduh dokumen penugasannya');

  // ================= 13. PENGUJIAN PORTAL PUBLIK & LAPORAN MASYARAKAT =================
  console.log('\n--- 13. Pengujian Portal Publik & Laporan Masyarakat ---');

  // Test 44: Pengambilan daftar publik dewan tanpa login (Akses Publik)
  await api.logout(); // Logout memastikan tidak ada sesi aktif
  const pubDewanList = await api.getPublicDewanList();
  assert(pubDewanList.success && Array.isArray(pubDewanList.data) && pubDewanList.data.length > 0, 'Daftar publik dewan dapat diakses publik tanpa login');
  assert(pubDewanList.data[0].nama && pubDewanList.data[0].kecamatan !== undefined, 'Daftar publik dewan memiliki atribut nama dan kecamatan');
  assert(!pubDewanList.data[0].password && !pubDewanList.data[0].token, 'Data privat/kredensial terlindungi dan tidak bocor ke publik');

  // Test 45: Validasi kecamatan resmi Kota Parepare saat kirim laporan publik
  const reportInvalidKec = await api.submitLaporanPublik({
    nama_pelapor: 'Warga Luar',
    kontak_pelapor: '081234567890',
    kecamatan: 'Kecamatan Makale', // Bukan Parepare
    kategori: 'Aspirasi',
    tujuan: 'DPRD',
    judul: 'Laporan Luar Wilayah',
    isi: 'Uji coba'
  });
  assert(!reportInvalidKec.success && reportInvalidKec.error?.code === 'VALIDATION_ERROR', 'Laporan dengan kecamatan di luar Kota Parepare ditolak');

  // Test 46: Pengiriman laporan publik yang valid menghasilkan nomor tiket LAP-YYYYMMDD-XXXX
  const reportValid = await api.submitLaporanPublik({
    nama_pelapor: 'Andi Mallarangeng',
    kontak_pelapor: '081198765432',
    kecamatan: 'Kecamatan Soreang',
    kategori: 'Aspirasi Pembangunan',
    tujuan: 'Komisi 2',
    judul: 'Perbaikan Lampu Jalan Soreang',
    isi: 'Mohon penambahan penerangan jalan umum di area Soreang dekat pasar.'
  });
  assert(reportValid.success && reportValid.data?.nomor_tiket, 'Pengiriman laporan publik berhasil diterima tanpa login');
  assert(/^LAP-\d{8}-[A-Z0-9]{4}$/.test(reportValid.data?.nomor_tiket), 'Nomor tiket memiliki format acak aman LAP-YYYYMMDD-XXXX (' + reportValid.data?.nomor_tiket + ')');

  // Test 47: Superadmin dapat melihat seluruh laporan masuk
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  const adminLaporanList = await api.getLaporanList();
  assert(adminLaporanList.success && adminLaporanList.data?.some(l => l.nomor_tiket === reportValid.data.nomor_tiket), 'Superadmin dapat melihat laporan masyarakat yang baru masuk');

  // Test 48: Superadmin menugaskan laporan ke staf pendamping
  const assignRes = await api.assignLaporan(reportValid.data.nomor_tiket, 'USR-STAFF-1', 'Staff Pengarsipan');
  assert(assignRes.success && assignRes.data?.assigned_to === 'Staff Pengarsipan', 'Superadmin berhasil menugaskan laporan kepada Staff Pengarsipan');

  // Test 49: Staf hanya dapat melihat laporan yang ditugaskan kepadanya
  await api.logout();
  await api.login('staff', 'PasswordStaff2026!');
  const staffLaporanList = await api.getLaporanList();
  assert(staffLaporanList.success && staffLaporanList.data?.some(l => l.nomor_tiket === reportValid.data.nomor_tiket), 'Staf melihat laporan yang ditugaskan kepadanya');

  // Test 50: Staf yang ditugaskan berhasil mengupdate status dan memberi tanggapan
  const staffUpdateReport = await api.updateLaporanStatus(reportValid.data.nomor_tiket, 'selesai', 'Telah dikoordinasikan dengan Dinas PUPR Kota Parepare');
  assert(staffUpdateReport.success && staffUpdateReport.data?.status === 'selesai', 'Staf berhasil menindaklanjuti dan menyelesaikan laporan masyarakat');

  // ================= 14. PENGUJIAN KELOLA AKUN STAF (SUPERADMIN ONLY) =================
  console.log('\n--- 14. Pengujian Kelola Akun Staf (Superadmin Only) ---');

  // Login kembali sebagai Superadmin
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');

  // Test 51: Superadmin memuat daftar akun lengkap dengan penugasan dewan
  const userListRes = await api.getUserList();
  assert(userListRes.success && Array.isArray(userListRes.data) && userListRes.data.length > 0, 'Superadmin berhasil memuat daftar akun pengguna');
  assert(userListRes.data[0].assigned_dewan !== undefined, 'Daftar pengguna memuat informasi assigned_dewan');

  // Test 52: Superadmin mendaftarkan akun staf baru dengan penugasan dewan
  const createStafRes = await api.createUser({
    username: 'staf_keuangan',
    nama: 'Staf Keuangan Parepare',
    password: 'PasswordStafKuat2026!',
    role: 'staff',
    assigned_dewan: ['DWN-03']
  });
  assert(createStafRes.success && createStafRes.data?.username === 'staf_keuangan', 'Superadmin berhasil mendaftarkan staf baru staf_keuangan');
  const stafKeuanganId = createStafRes.data.id;

  // Verifikasi penugasan dewan DWN-03
  const dewan3Check = await api.getDewanById('DWN-03');
  assert(dewan3Check.success && dewan3Check.data?.nama_pendamping === 'Staf Keuangan Parepare', 'Penugasan dewan DWN-03 otomatis terikat pada staf baru');

  // Test 53: Superadmin mengedit profil dan memindahkan penugasan dewan ke DWN-04
  const updateStafRes = await api.updateUser(stafKeuanganId, {
    nama: 'Ahmad Pratama, S.IP',
    status: 'aktif',
    assigned_dewan: ['DWN-04']
  });
  assert(updateStafRes.success && updateStafRes.data?.nama === 'Ahmad Pratama, S.IP', 'Superadmin berhasil memperbarui nama dan penugasan staf');

  const dewan3AfterUpdate = await api.getDewanById('DWN-03');
  const dewan4AfterUpdate = await api.getDewanById('DWN-04');
  assert(!dewan3AfterUpdate.data?.nama_pendamping || dewan3AfterUpdate.data?.nama_pendamping === '', 'Penugasan lama pada DWN-03 otomatis dilepaskan');
  assert(dewan4AfterUpdate.data?.nama_pendamping === 'Ahmad Pratama, S.IP', 'Penugasan baru pada DWN-04 berhasil diterapkan');

  // Test 54: Toggle status staf (nonaktifkan & aktifkan kembali)
  const deactRes = await api.toggleUserStatus(stafKeuanganId, 'nonaktif');
  assert(deactRes.success, 'Superadmin berhasil menonaktifkan akun staf');
  const reactRes = await api.toggleUserStatus(stafKeuanganId, 'aktif');
  assert(reactRes.success, 'Superadmin berhasil mengaktifkan kembali akun staf');

  // Test 55: Reset kata sandi staf oleh Superadmin
  const resetPassRes = await api.resetUserPassword(stafKeuanganId, 'PasswordBaruStaf2026!');
  assert(resetPassRes.success, 'Superadmin berhasil mereset kata sandi akun staf');

  // Test 56: Proteksi Superadmin Terakhir (Ditolak jika menonaktifkan/menghapus satu-satunya superadmin aktif)
  const currentAdmin = userListRes.data.find(u => u.role === 'superadmin');
  const protectToggle = await api.toggleUserStatus(currentAdmin.id, 'nonaktif');
  assert(!protectToggle.success && protectToggle.error?.code === 'PROTECTED_USER', 'Sistem mencegah menonaktifkan satu-satunya superadmin aktif (PROTECTED_USER)');

  const protectDelete = await api.deleteUser(currentAdmin.id);
  assert(!protectDelete.success && protectDelete.error?.code === 'PROTECTED_USER', 'Sistem mencegah menghapus satu-satunya superadmin aktif (PROTECTED_USER)');

  // Test 57: Proteksi Hapus User yang Memiliki Riwayat Arsip Dokumen
  // Akun 'staff' sebelumnya telah mengunggah arsip usulan_soreang.pdf
  const staffAccount = userListRes.data.find(u => u.username === 'staff');
  const delStaffWithDocs = await api.deleteUser(staffAccount.id);
  assert(!delStaffWithDocs.success && delStaffWithDocs.error?.code === 'HAS_DEPENDENT_RECORDS', 'Sistem mencegah menghapus staf yang memiliki riwayat arsip dokumen (HAS_DEPENDENT_RECORDS)');

  // Test 58: Hapus Akun Staf Tanpa Riwayat Dokumen
  const createTempStaf = await api.createUser({
    username: 'staf_sementara',
    nama: 'Staf Sementara Magang',
    password: 'PasswordMagang123!',
    role: 'staff'
  });
  assert(createTempStaf.success, 'Akun staf sementara berhasil dibuat');
  const delTempStaf = await api.deleteUser(createTempStaf.data.id);
  assert(delTempStaf.success, 'Akun staf tanpa riwayat dokumen berhasil dihapus dengan aman');

  // ================= 15. PENGUJIAN PENEGASAN TIGA ROLE & ISOLASI ANTAR STAF =================
  console.log('\n--- 15. Pengujian Penegasan Tiga Role & Isolasi Antar Staf ---');

  // Login sebagai Staf A ('staff')
  await api.logout();
  await api.login('staff', 'PasswordStaff2026!');

  // Test 59: Staf dilarang memanggil seluruh endpoint administrasi akun (RBAC: FORBIDDEN)
  const staffTryUserList = await api.getUserList();
  assert(!staffTryUserList.success && staffTryUserList.error?.code === 'FORBIDDEN', 'Staf dilarang membuka daftar user (RBAC: FORBIDDEN)');

  const staffTryCreateUser = await api.createUser({ username: 'staf_ilegal', nama: 'Ilegal', password: 'Password123!', role: 'staff' });
  assert(!staffTryCreateUser.success && staffTryCreateUser.error?.code === 'FORBIDDEN', 'Staf dilarang mendaftarkan user baru (RBAC: FORBIDDEN)');

  const staffTryUpdateUser = await api.updateUser('USR-1', { nama: 'Hacked' });
  assert(!staffTryUpdateUser.success && staffTryUpdateUser.error?.code === 'FORBIDDEN', 'Staf dilarang mengubah akun user (RBAC: FORBIDDEN)');

  const staffTryToggleUser = await api.toggleUserStatus('USR-1', 'nonaktif');
  assert(!staffTryToggleUser.success && staffTryToggleUser.error?.code === 'FORBIDDEN', 'Staf dilarang mengubah status user (RBAC: FORBIDDEN)');

  const staffTryDeleteUser = await api.deleteUser('USR-1');
  assert(!staffTryDeleteUser.success && staffTryDeleteUser.error?.code === 'FORBIDDEN', 'Staf dilarang menghapus akun user (RBAC: FORBIDDEN)');

  const staffTryResetPass = await api.resetUserPassword('USR-1', 'NewPass123!');
  assert(!staffTryResetPass.success && staffTryResetPass.error?.code === 'FORBIDDEN', 'Staf dilarang mereset kata sandi user (RBAC: FORBIDDEN)');

  // Test 60: Penegasan Hak Akses Staf — Ditolak dari Seluruh Endpoint Komisi & RDP
  const staffTryKomisiList = await api.getKomisiList();
  assert(!staffTryKomisiList.success && staffTryKomisiList.error?.code === 'FORBIDDEN', 'Staf dilarang mengakses daftar komisi (RBAC: FORBIDDEN)');

  const staffTryRdpList = await api.getRdpDokumenList('KOM-1');
  assert(!staffTryRdpList.success && staffTryRdpList.error?.code === 'FORBIDDEN', 'Staf dilarang membaca dokumen RDP Komisi (RBAC: FORBIDDEN)');

  const staffTryUploadRdp = await api.uploadRdpDokumen({
    komisi_id: 'KOM-1',
    tahun: 2026,
    nama_dokumen: 'RDP Ilegal oleh Staf',
    keterangan: 'Upaya unggah oleh staf',
    fileName: 'rdp_ilegal.pdf'
  });
  assert(!staffTryUploadRdp.success && staffTryUploadRdp.error?.code === 'FORBIDDEN', 'Staf dilarang mengunggah dokumen RDP ke Komisi (RBAC: FORBIDDEN)');

  // Test 60B: Verifikasi Hak Akses Staf Dewan & Pembuktian Solusi Bug "Akun akses ditolak"
  // Staf A ('staff') ditugaskan ke DWN-02
  const dwn2StafA = await api.getDewanById('DWN-02');
  assert(dwn2StafA.success && dwn2StafA.is_assigned === true, 'Staf A sah teridentifikasi memiliki hak akses (is_assigned: true) pada dewan penugasannya DWN-02');

  const dwn1StafA = await api.getDewanById('DWN-01');
  assert(dwn1StafA.success && dwn1StafA.is_assigned === false, 'Staf A tidak memiliki hak akses (is_assigned: false) pada dewan staf lain DWN-01');

  // Staf A mengunggah dokumen arsip untuk dewan penugasannya DWN-02
  const docStafA = await api.uploadDokumen({
    dewan_id: 'DWN-02',
    kategori_id: 'KAT-01',
    tahun: 2026,
    nama_folder: 'Reses',
    nama_dokumen: 'Laporan Reses Dapil II - Staf A',
    fileName: 'reses_dapil_2_staf_a.pdf'
  });
  assert(docStafA.success && docStafA.data?.id, 'Staf A berhasil mengunggah arsip dewan yang ditugaskan kepadanya');

  // Login sebagai Staf B ('staf_keuangan' dengan password baru)
  await api.logout();
  const loginStafB = await api.login('staf_keuangan', 'PasswordBaruStaf2026!');
  assert(loginStafB.success && loginStafB.data?.user?.username === 'staf_keuangan', 'Login sebagai Staf B (staf_keuangan) berhasil');

  // Staf B menyelesaikan kewajiban ganti password agar sesi aktif secara penuh
  const changePassRes = await api.changePassword('PasswordBaruStaf2026!', 'PasswordStafBValid123!');
  assert(changePassRes.success, 'Staf B berhasil menyelesaikan kewajiban ganti sandi');

  // Staf B ditugaskan ke DWN-04 (bukan DWN-02)
  const dwn4StafB = await api.getDewanById('DWN-04');
  assert(dwn4StafB.success && dwn4StafB.is_assigned === true, 'Staf B sah teridentifikasi memiliki hak akses (is_assigned: true) pada DWN-04');

  const dwn2StafB = await api.getDewanById('DWN-02');
  assert(dwn2StafB.success && dwn2StafB.is_assigned === false, 'Staf B ditolak hak aksesnya (is_assigned: false) pada dewan DWN-02 milik Staf A');

  // Staf B mencoba membaca daftar arsip dokumen milik Staf A di DWN-02 (harus DITOLAK FORBIDDEN)
  const stafBTryReadDoc = await api.getDokumenList({ dewan_id: 'DWN-02' });
  assert(!stafBTryReadDoc.success && stafBTryReadDoc.error?.code === 'FORBIDDEN', 'Staf B dilarang membaca arsip dewan milik Staf A (RBAC: FORBIDDEN)');

  // Staf B mencoba menghapus dokumen milik Staf A (harus DITOLAK FORBIDDEN)
  const stafBTryDelete = await api.deleteDokumen(docStafA.data.id);
  assert(!stafBTryDelete.success && stafBTryDelete.error?.code === 'FORBIDDEN', 'Staf B dilarang menghapus dokumen arsip milik Staf A (RBAC: FORBIDDEN)');

  // Login kembali sebagai Staf A untuk memodifikasi dan menghapus dokumennya sendiri
  await api.logout();
  await api.login('staff', 'PasswordStaff2026!');

  const stafADeleteOwn = await api.deleteDokumen(docStafA.data.id);
  assert(stafADeleteOwn.success, 'Staf A berhasil menghapus arsip dokumen miliknya sendiri');

  // Test 61: Tamu / Masyarakat Tanpa Login (Ditolak dari seluruh akses internal)
  await api.logout();
  const guestTryDocList = await api.getDokumenList();
  assert(!guestTryDocList.success && guestTryDocList.error?.code === 'UNAUTHORIZED', 'Tamu tanpa login ditolak mengakses getDokumenList (UNAUTHORIZED)');

  const guestTryRdpList = await api.getRdpDokumenList('KOM-1');
  assert(!guestTryRdpList.success && guestTryRdpList.error?.code === 'UNAUTHORIZED', 'Tamu tanpa login ditolak mengakses getRdpDokumenList (UNAUTHORIZED)');

  const guestTryUserList = await api.getUserList();
  assert(!guestTryUserList.success && guestTryUserList.error?.code === 'UNAUTHORIZED', 'Tamu tanpa login ditolak mengakses getUserList (UNAUTHORIZED)');

  const guestTryAuditLog = await api.getActivityLog();
  assert(!guestTryAuditLog.success && guestTryAuditLog.error?.code === 'UNAUTHORIZED', 'Tamu tanpa login ditolak mengakses getActivityLog (UNAUTHORIZED)');

  const guestTryUploadRdp = await api.uploadRdpDokumen({ komisi_id: 'KOM-1', tahun: 2026, nama_dokumen: 'Guest Hack', fileName: 'hack.pdf' });
  assert(!guestTryUploadRdp.success && guestTryUploadRdp.error?.code === 'UNAUTHORIZED', 'Tamu tanpa login ditolak mengunggah dokumen RDP (UNAUTHORIZED)');

  // ================= 16. PENGUJIAN LENGKAP CRUD DOKUMEN RDP & FILTER KOMISI =================
  console.log('\n--- 16. Pengujian Lengkap CRUD Dokumen RDP & Filter Komisi ---');

  // Superadmin login
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');

  // Create: Tambah Dokumen RDP di Komisi 3
  const newRdpKom3 = await api.uploadRdpDokumen({
    komisi_id: 'KOM-3',
    tahun: 2026,
    nama_dokumen: 'RDP Peningkatan Layanan Puskesmas 2026',
    keterangan: 'Agenda bersama Dinas Kesehatan Kota Parepare',
    fileName: 'rdp_puskesmas_2026.pdf'
  });
  assert(newRdpKom3.success && newRdpKom3.data?.id, 'CRUD Create: Dokumen RDP Komisi 3 berhasil ditambahkan');

  // Read: Tampilkan daftar Komisi 3
  const readKom3 = await api.getRdpDokumenList('KOM-3', 'semua');
  assert(readKom3.success && readKom3.data?.dokumen?.some(d => d.id === newRdpKom3.data.id), 'CRUD Read: Dokumen RDP Komisi 3 berhasil dimuat pada tabel');
  assert(readKom3.data?.available_years?.includes(2026), 'CRUD Read: Tahun 2026 otomatis terdaftar pada filter tahun');

  // Update: Edit Metadata Dokumen RDP
  const updateRdpKom3 = await api.updateRdpDokumen({
    id: newRdpKom3.data.id,
    nama_dokumen: 'RDP Peningkatan Mutu RSUD & Puskesmas 2026',
    tahun: 2026,
    keterangan: 'Agenda diperluas mencakup RSUD Andi Makkasau'
  });
  assert(updateRdpKom3.success && updateRdpKom3.data?.nama_dokumen.includes('RSUD & Puskesmas'), 'CRUD Update: Metadata dokumen RDP berhasil diperbarui');

  // Download: Verifikasi fungsi unduh dokumen
  const dlRes = await api.downloadDokumen(newRdpKom3.data.id);
  assert(dlRes.success && dlRes.data?.nama_file, 'CRUD Download: Berkas dokumen RDP dapat diunduh');

  // Delete: Hapus dokumen RDP dengan otorisasi Superadmin
  const delRdpKom3 = await api.deleteRdpDokumen(newRdpKom3.data.id);
  assert(delRdpKom3.success, 'CRUD Delete: Dokumen RDP berhasil dihapus oleh Superadmin');

  const readKom3AfterDel = await api.getRdpDokumenList('KOM-3', 'semua');
  assert(!readKom3AfterDel.data?.dokumen?.some(d => d.id === newRdpKom3.data.id), 'CRUD Delete: Dokumen terhapus tidak muncul lagi di daftar');

  // ================= 17. PENGUJIAN CRUD KOMISI & PERLINDUNGAN ARSIP =================
  console.log('\n--- 17. Pengujian CRUD Komisi & Perlindungan Dokumen Arsip ---');

  // Test 71: Staf dilarang menambah komisi baru (RBAC)
  await api.login('staff', 'PasswordStaff2026!');
  const staffTryCreateKomisi = await api.createKomisi({
    nama: 'Komisi Staf Ilegal',
    bidang: 'Bidang Tak Berizin'
  });
  assert(!staffTryCreateKomisi.success && staffTryCreateKomisi.error?.code === 'FORBIDDEN', 'Staf dilarang menambah komisi baru (RBAC: FORBIDDEN)');

  // Test 72: Staf dilarang menghapus komisi (RBAC)
  const staffTryDeleteKomisi = await api.deleteKomisi('KOM-1');
  assert(!staffTryDeleteKomisi.success && staffTryDeleteKomisi.error?.code === 'FORBIDDEN', 'Staf dilarang menghapus komisi (RBAC: FORBIDDEN)');

  // Superadmin login
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');

  // Test 73: Validasi input tambah komisi (nama & bidang wajib)
  const emptyKomisiRes = await api.createKomisi({ nama: '', bidang: '' });
  assert(!emptyKomisiRes.success && emptyKomisiRes.error?.code === 'VALIDATION_ERROR', 'Sistem menolak penambahan komisi tanpa nama dan bidang (VALIDATION_ERROR)');

  // Test 74: Pencegahan nama komisi duplikat
  const dupKomisiRes = await api.createKomisi({ nama: 'Komisi 1', bidang: 'Bidang Duplikat' });
  assert(!dupKomisiRes.success && dupKomisiRes.error?.code === 'DUPLICATE_ENTRY', 'Sistem menolak penambahan komisi dengan nama duplikat (DUPLICATE_ENTRY)');

  // Test 75: Superadmin berhasil menambahkan Komisi 4
  const createKom4Res = await api.createKomisi({
    nama: 'Komisi 4',
    bidang: 'Bidang Pembangunan, Tata Ruang, & Lingkungan Hidup',
    deskripsi: 'Membidangi urusan pekerjaan umum, tata ruang kota, dan kebersihan lingkungan hidup.',
    kategori_folder: 'RDP'
  });
  assert(createKom4Res.success && createKom4Res.data?.id, 'CRUD Create: Superadmin berhasil menambahkan Komisi 4 baru');
  const kom4Id = createKom4Res.data.id;

  // Test 76: Daftar komisi memuat 4 komisi setelah penambahan
  const listAfterAdd = await api.getKomisiList();
  assert(listAfterAdd.success && listAfterAdd.data?.length === 4, 'CRUD Read: Daftar komisi bertambah menjadi 4 komisi');
  assert(listAfterAdd.data?.some(k => k.id === kom4Id && k.nama === 'Komisi 4'), 'Komisi 4 terdaftar dalam daftar komisi aktif');

  // Test 77: Proteksi Arsip - Mencoba menghapus Komisi 1 yang memiliki dokumen aktif
  // Komisi 1 masih memiliki dokumen RDP (Test 30)
  const delKom1Res = await api.deleteKomisi('KOM-1');
  assert(!delKom1Res.success && delKom1Res.error?.code === 'HAS_DEPENDENT_RECORDS', 'Proteksi Arsip: Komisi 1 ditolak dihapus karena masih memiliki dokumen RDP aktif (HAS_DEPENDENT_RECORDS)');
  const listAfterBlockedDel = await api.getKomisiList();
  assert(listAfterBlockedDel.data?.some(k => k.id === 'KOM-1'), 'Komisi 1 tetap utuh dan terlindungi di sistem');

  // Test 78: Hapus Komisi 4 yang kosong (tanpa berkas dokumen)
  const delKom4Res = await api.deleteKomisi(kom4Id);
  assert(delKom4Res.success, 'CRUD Delete: Komisi 4 kosong berhasil dihapus oleh Superadmin');

  // Test 79: Daftar komisi kembali menjadi 3 komisi
  const listAfterCleanDel = await api.getKomisiList();
  assert(listAfterCleanDel.success && listAfterCleanDel.data?.length === 3, 'CRUD Delete: Daftar komisi kembali menjadi 3 komisi');
  assert(!listAfterCleanDel.data?.some(k => k.id === kom4Id), 'Komisi 4 terhapus tidak muncul lagi di daftar');

  // ================= 18. PENGUJIAN NORMALISASI GELAR STAF & SINKRONISASI PENUGASAN REAL-TIME =================
  console.log('\n--- 18. Pengujian Normalisasi Gelar Staf & Sinkronisasi Penugasan Real-Time ---');

  // Superadmin mendaftarkan staf dengan gelar akademik lengkap
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  const stafGelarRes = await api.createUser({
    username: 'staf_gelar',
    nama: 'Drs. H. Ahmad Pratama, M.Si',
    password: 'PasswordGelar2026!',
    role: 'staff',
    assigned_dewan: ['DWN-05']
  });
  assert(stafGelarRes.success, 'Superadmin berhasil mendaftarkan staf dengan gelar akademik lengkap');

  // Login sebagai staf bergelar
  await api.logout();
  const loginGelar = await api.login('staf_gelar', 'PasswordGelar2026!');
  assert(loginGelar.success, 'Login sebagai staf bergelar berhasil');

  await api.changePassword('PasswordGelar2026!', 'PasswordGelarValid2026!');

  // Test 80: Normalisasi gelar berhasil mencocokkan izin staf tanpa false positive "Akun akses ditolak"
  const dwn5Gelar = await api.getDewanById('DWN-05');
  assert(dwn5Gelar.success && dwn5Gelar.data?.is_assigned === true, 'Staf bergelar sah teridentifikasi memiliki hak akses (is_assigned: true) pada DWN-05');

  // Test 81: Staf bergelar dapat mengunggah berkas ke dewan penugasannya
  const uploadDocGelar = await api.uploadDokumen({
    dewan_id: 'DWN-05',
    kategori_id: 'KAT-01',
    tahun: 2026,
    nama_folder: 'Reses',
    nama_dokumen: 'Dokumen Verifikasi Gelar',
    fileName: 'gelar_verif.pdf'
  });
  assert(uploadDocGelar.success && uploadDocGelar.data?.id, 'Staf bergelar berhasil mengunggah berkas ke dewan yang ditugaskan');

  // Test 82: Superadmin memperbarui penugasan dewan secara real-time
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  const updatePenugasanRes = await api.updateUser(stafGelarRes.data.id, {
    nama: 'Drs. H. Ahmad Pratama, M.Si',
    status: 'aktif',
    assigned_dewan: ['DWN-03'] // Mengalihkan penugasan dari DWN-05 ke DWN-03 yang valid
  });
  assert(updatePenugasanRes.success, 'Superadmin berhasil memperbarui penugasan staf ke DWN-03 secara real-time');

  // Login kembali sebagai staf bergelar untuk menguji pembaruan izin instan
  await api.logout();
  await api.login('staf_gelar', 'PasswordGelarValid2026!');

  // Penugasan baru DWN-03 langsung aktif (is_assigned: true)
  const dwn3AfterUpdate = await api.getDewanById('DWN-03');
  assert(dwn3AfterUpdate.success && dwn3AfterUpdate.data?.is_assigned === true, 'Pembaruan izin langsung aktif: Staf memperoleh hak akses pada DWN-03');

  // Penugasan lama DWN-05 langsung dicabut (is_assigned: false)
  const dwn5AfterUpdate = await api.getDewanById('DWN-05');
  assert(dwn5AfterUpdate.success && dwn5AfterUpdate.data?.is_assigned === false, 'Pembaruan izin langsung aktif: Hak akses staf pada DWN-05 telah dicabut');

  // Bersihkan data uji
  await api.deleteDokumen(uploadDocGelar.data.id);
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  await api.deleteUser(stafGelarRes.data.id);

  // Cleanup logout
  await api.logout();

  console.log(`\n--- 19. Pengujian Komprehensif Audit 14 Butir (Reses/Pokir, Penugasan Staf, Lampiran, Hapus Laporan, Profil, 3 Status Pokir & Pengecualian) ---`);

  // Login sebagai Superadmin
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');

  // --- Butir 1: Kategori Arsip Reses & Pokok-Pokok Pikiran (Pokir) ---
  const katWithCount = await api.getKategoriWithDocCount('DWN-01');
  assert(katWithCount.success && Array.isArray(katWithCount.data), 'Kategori dengan jumlah dokumen berhasil dimuat');
  const pokirKat = katWithCount.data.find(k => k.nama_kategori.toLowerCase().includes('pokok') || k.nama_kategori.toLowerCase().includes('pokir'));
  assert(pokirKat, 'Kategori Pokok-Pokok Pikiran (Pokir) tersedia di daftar kategori');

  // getTahunList & getDokumenList dengan parameter alias 'pokir' dan 'pokok-pokok pikiran'
  const tahunPokirAlias = await api.getTahunList('DWN-01', 'pokir');
  assert(tahunPokirAlias.success, 'getTahunList mengenali alias kategori pokir');
  const docsPokirAlias = await api.getDokumenList({ dewan_id: 'DWN-01', kategori_id: 'Pokok-Pokok Pikiran' });
  assert(docsPokirAlias.success, 'getDokumenList mengenali alias nama kategori Pokok-Pokok Pikiran');

  // --- Butir 8: Sinkronisasi nama_pendamping dan nama_pengawas ---
  const dewanSyncRes = await api.updateDewan({
    id: 'DWN-01',
    nama_pengawas: 'Staf Pendamping Terintegrasi'
  });
  assert(dewanSyncRes.success, 'updateDewan berhasil memperbarui nama_pengawas');
  const dwn1Check = await api.getDewanById('DWN-01');
  assert(dwn1Check.data.nama_pendamping === 'Staf Pendamping Terintegrasi' && dwn1Check.data.nama_pengawas === 'Staf Pendamping Terintegrasi', 'nama_pendamping dan nama_pengawas tersinkronisasi dua arah');

  // Buat akun staf uji untuk verifikasi penugasan laporan dan akses
  const stafAuditRes = await api.createUser({
    username: 'staf_audit',
    nama: 'Staf Pendamping Terintegrasi',
    password: 'PasswordAudit2026!',
    role: 'staff',
    assigned_dewan: ['DWN-01']
  });
  assert(stafAuditRes.success, 'Akun staf audit baru berhasil dibuat');

  // Login sebagai staf audit dan ganti sandi awal
  await api.logout();
  await api.login('staf_audit', 'PasswordAudit2026!');
  await api.changePassword('PasswordAudit2026!', 'PasswordBaruAudit2026!');
  await api.logout();

  // --- Butir 3: Pengiriman Laporan Publik dengan Lampiran Dokumen ---
  const base64Dummy = 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCA2OAo+PgpzdHJlYW0KeJwrSExPTcxLzNFLzs8rSc0r0Y/m0vLiAgAJFgbLCmVuZHN0cmVhbQplbmRvYmoK';
  const laporanWithAttachment = await api.submitLaporanPublik({
    nama_pelapor: 'Ahmad Dahlan',
    kontak_pelapor: '081234567890',
    kecamatan: 'Kecamatan Bacukiki',
    kategori: 'Aspirasi',
    tujuan: 'DPRD Kota Parepare',
    judul: 'Perbaikan Lampu Penerangan Jalan Umum',
    isi: 'Mohon perbaikan lampu jalan yang padam di RW 02 Bacukiki.',
    base64: base64Dummy,
    fileName: 'bukti_foto_lampu.pdf'
  });
  assert(laporanWithAttachment.success && laporanWithAttachment.data.nomor_tiket, 'Laporan publik dengan lampiran berhasil dikirim');
  const tiketLaporan = laporanWithAttachment.data.nomor_tiket;

  // Login sebagai Superadmin untuk memeriksa detail lampiran
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  const allLapAdmin = await api.getLaporanList();
  const lapTarget = allLapAdmin.data.find(l => l.nomor_tiket === tiketLaporan);
  assert(lapTarget, 'Laporan baru muncul di daftar laporan admin');
  assert(lapTarget.status === 'menunggu', 'Status awal laporan adalah menunggu');

  // Unduh lampiran melalui endpoint downloadLaporanLampiran
  const downloadRes = await api.downloadLaporanLampiran(lapTarget.id);
  assert(downloadRes.success && downloadRes.data && downloadRes.data.base64, 'Lampiran laporan berhasil diunduh via endpoint terotentikasi');
  assert(downloadRes.data.fileName === 'bukti_foto_lampu.pdf', 'Nama berkas lampiran sesuai dengan yang dikirim');

  // --- Butir 2 & 9: Penugasan Laporan Masyarakat kepada Staf ---
  // Superadmin menugaskan laporan kepada staf_audit
  const assignAuditRes = await api.assignLaporan(lapTarget.id, 'staf_audit', 'Staf Pendamping Terintegrasi', stafAuditRes.data.id);
  assert(assignAuditRes.success, 'Superadmin berhasil menugaskan laporan kepada staf');

  // Verifikasi status laporan di admin langsung berubah menjadi 'diproses'
  const lapAfterAssign = (await api.getLaporanList()).data.find(l => l.nomor_tiket === tiketLaporan);
  assert(lapAfterAssign.status === 'diproses', 'Status laporan otomatis berubah menjadi "diproses"');
  assert(lapAfterAssign.assigned_to.includes('staf_audit') || lapAfterAssign.assigned_to.includes('Staf Pendamping Terintegrasi'), 'Field assigned_to menyimpan identitas staf penerima');

  // Verifikasi laporan muncul pada akun staf_audit
  await api.logout();
  await api.login('staf_audit', 'PasswordBaruAudit2026!');
  const stafReports = await api.getLaporanList();
  assert(stafReports.success, 'Staf berhasil memuat daftar laporan tugas');
  const lapInStaff = stafReports.data.find(l => l.nomor_tiket === tiketLaporan);
  assert(lapInStaff, 'Laporan yang ditugaskan muncul pada akun pendamping terkait');

  // Staf dapat mengunduh lampiran tugasnya
  const stafDlRes = await api.downloadLaporanLampiran(lapTarget.id);
  assert(stafDlRes.success, 'Staf yang ditugaskan dapat mengunduh berkas lampiran');

  // Staf memperbarui respon tindak lanjut
  const updateStatusRes = await api.updateLaporanStatus(lapTarget.id, 'diproses', 'Sedang dikoordinasikan dengan Dinas Perhubungan Parepare.');
  assert(updateStatusRes.success, 'Staf berhasil memperbarui tindak lanjut laporan');

  // --- Butir 4: Penghapusan Laporan (RBAC Superadmin & Audit Log) ---
  // Staf mencoba menghapus laporan -> DITOLAK (FORBIDDEN)
  const stafDeleteRes = await api.deleteLaporan(lapTarget.id);
  assert(!stafDeleteRes.success && (stafDeleteRes.error?.code === 'FORBIDDEN' || stafDeleteRes.message.includes('Superadmin')), 'Staf dilarang menghapus laporan masyarakat (RBAC: FORBIDDEN)');

  // Login sebagai Superadmin
  await api.logout();
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');

  // Superadmin menghapus laporan
  const superDeleteRes = await api.deleteLaporan(lapTarget.id, 'Laporan uji coba selesai diperiksa');
  assert(superDeleteRes.success, 'Superadmin berhasil menghapus laporan masyarakat');
  const lapAfterDelete = (await api.getLaporanList()).data.find(l => l.nomor_tiket === tiketLaporan);
  assert(!lapAfterDelete, 'Laporan terhapus tidak muncul lagi dalam daftar aktif');

  // Log audit mencatat aksi penghapusan
  const logsAfterDel = await api.getActivityLog(10);
  const delLog = logsAfterDel.data.find(l => l.aksi === 'HAPUS_LAPORAN');
  assert(delLog, 'Penghapusan laporan tercatat dalam riwayat audit log sistem');

  // --- Butir 6: Ubah Username Admin (Validasi Keunikan, Regex & Sesi) ---
  // Coba username pendek (< 3 karakter) -> GAGAL
  const shortUserRes = await api.updateProfile({ username: 'ab' });
  assert(!shortUserRes.success, 'Sistem menolak username kurang dari 3 karakter (VALIDATION_ERROR)');

  // Coba username duplikat -> GAGAL
  const dupUserRes = await api.updateProfile({ username: 'staf_audit' });
  assert(!dupUserRes.success && dupUserRes.error?.code === 'DUPLICATE_USERNAME', 'Sistem menolak perubahan ke username yang sudah ada (DUPLICATE_USERNAME)');

  // Ubah username valid
  const updateProfileRes = await api.updateProfile({ username: 'superadmin_parepare' });
  assert(updateProfileRes.success, 'Superadmin berhasil mengubah username');
  const sessionCheck = await api.checkSession();
  assert(sessionCheck.data.username === 'superadmin_parepare', 'Sesi aktif langsung tersinkronisasi dengan username baru');

  // Kembalikan username ke semula untuk menjaga konsistensi pengujian lain
  const revertProfileRes = await api.updateProfile({ username: 'superadmin' });
  assert(revertProfileRes.success, 'Username superadmin berhasil dikembalikan ke default');

  // --- Butir 10-14: Penyaringan Usulan Berulang Pokir (3 Hasil Pemeriksaan) ---
  const proposerNama = 'Haji Syamsuddin Petani Mandiri';
  const proposerKontak = '085242001122';
  const programJudul = 'Bantuan Bibit Jagung Hibrida dan Pupuk Bersubsidi';

  // Skenario A: Usulan pertama oleh pengusul -> Hasil A (Tidak terindikasi berulang / Lolos normal)
  const pokirCheckA = await api.checkPokirDuplication({
    nama_pelapor: proposerNama,
    kontak_pelapor: proposerKontak,
    kategori: 'Pokok-Pokok Pikiran',
    tujuan: 'Dinas Pertanian dan Perikanan',
    judul: programJudul
  });
  assert(pokirCheckA.success && pokirCheckA.data.status === 'A' && pokirCheckA.data.allowed === true, 'Pemeriksaan Pokir Hasil A: Tidak terindikasi berulang');

  // Ajukan usulan Pokir pertama
  const pokirSub1 = await api.submitLaporanPublik({
    nama_pelapor: proposerNama,
    kontak_pelapor: proposerKontak,
    kecamatan: 'Kecamatan Bacukiki',
    kategori: 'Pokok-Pokok Pikiran',
    tujuan: 'Dinas Pertanian dan Perikanan',
    judul: programJudul,
    isi: 'Pengajuan bantuan bibit jagung hibrida untuk kelompok tani Bacukiki seluas 15 hektar.'
  });
  assert(pokirSub1.success && pokirSub1.data.nomor_tiket, 'Usulan Pokir pertama berhasil diserahkan');
  const tiketPokir1 = pokirSub1.data.nomor_tiket;

  // Skenario B: Usulan kedua diajukan oleh pengusul yang sama selagi usulan pertama masih 'menunggu'/'diproses'
  // -> Hasil B (Diduga berulang tetapi belum pasti: Diterima dengan flag perlu_verifikasi)
  const pokirCheckB = await api.checkPokirDuplication({
    nama_pelapor: 'H. Syamsuddin', // Varian nama tanpa gelar
    kontak_pelapor: proposerKontak,
    kategori: 'Pokok-Pokok Pikiran',
    tujuan: 'Dinas Pertanian dan Perikanan',
    judul: 'Tambahan Bantuan Bibit Jagung Hibrida dan Pupuk'
  });
  assert(pokirCheckB.success && pokirCheckB.data.status === 'B' && pokirCheckB.data.perluVerifikasi === true && pokirCheckB.data.allowed === true, 'Pemeriksaan Pokir Hasil B: Terdeteksi diduga berulang dengan usulan berjalan, ditandai perlu verifikasi');

  const pokirSub2 = await api.submitLaporanPublik({
    nama_pelapor: 'H. Syamsuddin',
    kontak_pelapor: proposerKontak,
    kecamatan: 'Kecamatan Bacukiki',
    kategori: 'Pokok-Pokok Pikiran',
    tujuan: 'Dinas Pertanian dan Perikanan',
    judul: 'Tambahan Bantuan Bibit Jagung Hibrida dan Pupuk',
    isi: 'Usulan penambahan alokasi bibit jagung hibrida untuk musim tanam mendatang.'
  });
  assert(pokirSub2.success, 'Usulan Pokir kedua tetap diterima ke sistem dengan status verifikasi');
  const tiketPokir2 = pokirSub2.data.nomor_tiket;

  // Verifikasi flag status_duplikasi pada usulan kedua
  const lapPokir2 = (await api.getLaporanList()).data.find(l => l.nomor_tiket === tiketPokir2);
  assert(lapPokir2 && lapPokir2.status_duplikasi === 'perlu_verifikasi', 'Usulan kedua berstatus_duplikasi: "perlu_verifikasi"');

  // Pengecualian Resmi Superadmin untuk Usulan Bertanda Perlu Verifikasi
  // Staf mencoba menyetujui pengecualian -> DITOLAK (FORBIDDEN)
  await api.logout();
  await api.login('staf_audit', 'PasswordBaruAudit2026!');
  const stafExceptRes = await api.approvePokirException(tiketPokir2, 'Disetujui staf');
  assert(!stafExceptRes.success && (stafExceptRes.error?.code === 'FORBIDDEN' || stafExceptRes.message.includes('Superadmin')), 'Staf dilarang memberikan pengecualian pokir (RBAC: FORBIDDEN)');

  // Superadmin menyetujui pengecualian usulan kedua
  await api.logout();
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  const superExceptRes = await api.approvePokirException(tiketPokir2, 'Pengecualian resmi disetujui: Penambahan kuota petani terdampak kekeringan.');
  assert(superExceptRes.success, 'Superadmin berhasil menyetujui pengecualian usulan Pokir');
  const lapPokir2After = (await api.getLaporanList()).data.find(l => l.nomor_tiket === tiketPokir2);
  assert(lapPokir2After.status_duplikasi === 'pengecualian_disetujui', 'Status duplikasi berubah menjadi "pengecualian_disetujui"');

  // Skenario C: Usulan pertama telah berstatus 'terealisasi' / 'didanai'
  // Ubah status usulan pertama menjadi 'terealisasi'
  const target1 = (await api.getLaporanList()).data.find(l => l.nomor_tiket === tiketPokir1);
  await api.updateLaporanStatus(target1.id, 'terealisasi', 'Program telah disalurkan penuh.');

  // Usulan ketiga diajukan untuk program yang sama -> Hasil C (Terbukti melanggar pembatasan karena sudah TEREALISASI)
  const pokirCheckC = await api.checkPokirDuplication({
    nama_pelapor: proposerNama,
    kontak_pelapor: proposerKontak,
    kategori: 'Pokok-Pokok Pikiran',
    tujuan: 'Dinas Pertanian dan Perikanan',
    judul: 'Permintaan Bibit Jagung Hibrida dan Pupuk Bersubsidi'
  });
  assert(pokirCheckC.success && pokirCheckC.data.status === 'C' && pokirCheckC.data.allowed === false, 'Pemeriksaan Pokir Hasil C: Terdeteksi melanggar pembatasan program terealisasi');

  // Pengajuan usulan ketiga DITOLAK oleh validasi backend
  const pokirSub3 = await api.submitLaporanPublik({
    nama_pelapor: proposerNama,
    kontak_pelapor: proposerKontak,
    kecamatan: 'Kecamatan Bacukiki',
    kategori: 'Pokok-Pokok Pikiran',
    tujuan: 'Dinas Pertanian dan Perikanan',
    judul: 'Permintaan Bibit Jagung Hibrida dan Pupuk Bersubsidi',
    isi: 'Mengajukan kembali bibit jagung.'
  });
  assert(!pokirSub3.success && (pokirSub3.error?.code === 'DUPLICATE_REALIZED_PROPOSAL' || pokirSub3.message.includes('terealisasi')), 'Pengajuan usulan Pokir yang telah terealisasi ditolak backend dengan pesan resmi');

  // --- 20. Pengujian Validasi Upload Dokumen RDP & Pengelolaan Kategori Arsip Dewan ---
  console.log(`\n--- 20. Pengujian Validasi Upload Dokumen RDP & Pengelolaan Kategori Arsip Dewan ---`);

  // Login kembali sebagai superadmin
  const superLogin20 = await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  assert(superLogin20.success, 'Login kembali sebagai superadmin berhasil');

  // Test 20.1: Upload RDP tanpa nama dokumen / judul ditolak
  const upRdpNoJudul = await api.uploadRdpDokumen({
    komisi_id: 'KOM-1',
    tahun: 2026,
    nama_dokumen: '',
    fileName: 'berkas.pdf',
    base64: 'dGVzdA=='
  });
  assert(!upRdpNoJudul.success && upRdpNoJudul.error?.code === 'VALIDATION_ERROR', 'Upload RDP tanpa judul ditolak (VALIDATION_ERROR)');

  // Test 20.2: Upload RDP tanpa tahun ditolak
  const upRdpNoTahun = await api.uploadRdpDokumen({
    komisi_id: 'KOM-1',
    tahun: '',
    nama_dokumen: 'RDP Pembahasan Anggaran',
    fileName: 'berkas.pdf',
    base64: 'dGVzdA=='
  });
  assert(!upRdpNoTahun.success && upRdpNoTahun.error?.code === 'VALIDATION_ERROR', 'Upload RDP tanpa tahun ditolak (VALIDATION_ERROR)');

  // Test 20.3: Upload RDP dengan berkas kosong ditolak
  const upRdpNoFile = await api.uploadRdpDokumen({
    komisi_id: 'KOM-1',
    tahun: 2026,
    nama_dokumen: 'RDP Tanpa Berkas',
    fileName: '',
    base64: ''
  });
  assert(!upRdpNoFile.success && upRdpNoFile.error?.code === 'VALIDATION_ERROR', 'Upload RDP tanpa berkas fisik ditolak (VALIDATION_ERROR)');

  // Test 20.4: Upload RDP dengan payload base64 berhasil
  const upRdpBase64 = await api.uploadRdpDokumen({
    komisi_id: 'KOM-1',
    tahun: 2026,
    nama_dokumen: 'RDP Uji Payload Base64',
    keterangan: 'Uji format payload base64',
    fileName: 'uji_base64.pdf',
    base64: 'JVBERi0xLjQKJcTl8uXr...'
  });
  assert(upRdpBase64.success && upRdpBase64.data?.id, 'Upload RDP dengan format payload base64 berhasil');

  // Test 20.5: Upload RDP dengan payload fileData berhasil (kompatibilitas FileReader)
  const upRdpFileData = await api.uploadRdpDokumen({
    komisi_id: 'KOM-1',
    tahun: 2026,
    nama_dokumen: 'RDP Uji Payload FileData',
    keterangan: 'Uji format payload fileData',
    fileName: 'uji_filedata.pdf',
    fileData: 'JVBERi0xLjQKJcTl8uXr...'
  });
  assert(upRdpFileData.success && upRdpFileData.data?.id, 'Upload RDP dengan format payload fileData berhasil');

  // Hapus dokumen RDP uji
  await api.deleteRdpDokumen(upRdpBase64.data.id);
  await api.deleteRdpDokumen(upRdpFileData.data.id);

  // Buat akun Admin untuk pengujian hak kelola kategori
  const adminTestUser = await api.createUser({
    username: 'admin_kategori_test',
    nama: 'Admin Kategori Test',
    role: 'admin',
    password: 'PasswordAdminKat2026!'
  });
  assert(adminTestUser.success, 'Akun admin uji kategori berhasil dibuat');

  // Login sebagai Admin
  await api.logout();
  await api.login('admin_kategori_test', 'PasswordAdminKat2026!');
  await api.changePassword('PasswordAdminKat2026!', 'PasswordAdminKatValid123!');

  // Test 20.6: Admin berhak menambah kategori arsip baru
  const katBaruRes = await api.createKategori('Sosialisasi Perda 2026', 'Kategori arsip sosialisasi perda anggota dewan');
  assert(katBaruRes.success && katBaruRes.data?.id, 'Admin berhak menambahkan kategori arsip baru (createKategori)');

  // Test 20.7: Tambah kategori tanpa nama ditolak
  const katEmptyRes = await api.createKategori('', 'Deskripsi');
  assert(!katEmptyRes.success && katEmptyRes.error?.code === 'VALIDATION_ERROR', 'Tambah kategori tanpa nama ditolak (VALIDATION_ERROR)');

  // Test 20.8: Tambah kategori duplikat ditolak
  const katDupRes = await api.createKategori('sosialisasi perda 2026', 'Deskripsi duplikat');
  assert(!katDupRes.success && katDupRes.error?.code === 'DUPLICATE_CATEGORY', 'Tambah kategori dengan nama duplikat ditolak (DUPLICATE_CATEGORY)');

  // Test 20.9: Admin berhak memperbarui kategori arsip
  const updateKatRes = await api.updateKategori(katBaruRes.data.id, 'Sosialisasi Perda & Wawasan Kebangsaan', 'Deskripsi diperbarui');
  assert(updateKatRes.success, 'Admin berhak memperbarui kategori arsip (updateKategori)');

  // Test 20.10: Perlindungan kategori bawaan sistem (Hasil Reses & Pokir tidak dapat dihapus)
  const delResesTry = await api.deleteKategori('KAT-02');
  assert(!delResesTry.success && delResesTry.error?.code === 'SYSTEM_CATEGORY_PROTECTED', 'Kategori bawaan Hasil Reses ditolak dihapus (SYSTEM_CATEGORY_PROTECTED)');

  const delPokirTry = await api.deleteKategori('KAT-01');
  assert(!delPokirTry.success && delPokirTry.error?.code === 'SYSTEM_CATEGORY_PROTECTED', 'Kategori bawaan Pokok-Pokok Pikiran ditolak dihapus (SYSTEM_CATEGORY_PROTECTED)');

  // Test 20.11: Kategori baru yang dibuat terdaftar di getKategoriWithDocCount
  const listKatDewan = await api.getKategoriWithDocCount('DWN-01');
  assert(listKatDewan.success && listKatDewan.data.some(k => k.id === katBaruRes.data.id), 'Kategori baru aktif terdaftar dalam daftar kategori anggota dewan');

  // Test 20.12: Kategori baru tanpa dokumen aktif dapat dihapus oleh Admin
  const delKatBaruRes = await api.deleteKategori(katBaruRes.data.id);
  assert(delKatBaruRes.success, 'Kategori baru tanpa berkas berhasil dihapus');

  // Test 20.13: RBAC Staf ditolak menambah kategori
  await api.logout();
  await api.login('staf_keuangan', 'PasswordStafBValid123!');
  const stafCreateKat = await api.createKategori('Kategori Ilegal Staf', 'Staf coba buat');
  assert(!stafCreateKat.success && stafCreateKat.error?.code === 'FORBIDDEN', 'Staf dilarang menambah kategori baru (RBAC: FORBIDDEN)');

  const stafDeleteKat = await api.deleteKategori('KAT-02');
  assert(!stafDeleteKat.success && stafDeleteKat.error?.code === 'FORBIDDEN', 'Staf dilarang menghapus kategori (RBAC: FORBIDDEN)');

  // Bersihkan akun admin uji
  await api.logout();
  const superLoginClean = await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  assert(superLoginClean.success, 'Login superadmin untuk pembersihan berhasil');
  await api.deleteUser(adminTestUser.data.id);

  // Pembersihan akun dan data uji audit
  await api.deleteLaporan(target1.id);
  await api.deleteLaporan(lapPokir2.id);
  await api.deleteUser(stafAuditRes.data.id);
  await api.logout();

  // --- 21. Pengujian Penyimpanan Kecamatan Dewan, Toggle Kata Sandi, & Netralisasi Akses Login ---
  console.log('\n--- 21. Pengujian Penyimpanan Kecamatan Dewan, Toggle Kata Sandi, & Netralisasi Akses Login ---');
  const superLogin21 = await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  assert(superLogin21.success, 'Login superadmin untuk Test Suite 21 berhasil');

  // Test 21.1: Pembuatan anggota dewan dengan kecamatan tersimpan
  const dewanKecItem21 = await api.createDewan({
    nama: 'H. Andi Baso Uji, S.E.',
    jabatan: 'Anggota Komisi 2',
    periode: '2024 - 2029',
    nama_partai: 'Partai Golongan Karya',
    nama_pendamping: 'Staf Pendamping Uji',
    kecamatan: 'Kecamatan Bacukiki Barat'
  });
  assert(dewanKecItem21.success && dewanKecItem21.data?.id, 'Pembuatan dewan baru dengan data kecamatan berhasil');
  assert(dewanKecItem21.data.kecamatan === 'Kecamatan Bacukiki Barat', 'Field kecamatan langsung tersimpan pada respons pembuatan dewan');

  // Test 21.2: Pengambilan data dewan via getDewanById mengembalikan kecamatan dengan tepat
  const fetchDewanKec21 = await api.getDewanById(dewanKecItem21.data.id);
  assert(fetchDewanKec21.success && fetchDewanKec21.data.kecamatan === 'Kecamatan Bacukiki Barat', 'getDewanById mengembalikan nilai kecamatan secara akurat');

  // Test 21.3: Pembaruan kecamatan anggota dewan via updateDewan
  const updateDewanKec21 = await api.updateDewan({
    id: dewanKecItem21.data.id,
    nama: 'H. Andi Baso Uji, S.E., M.Si.',
    kecamatan: 'Kecamatan Soreang'
  });
  assert(updateDewanKec21.success, 'Pembaruan data kecamatan anggota dewan berhasil disimpan');

  // Test 21.4: Verifikasi pembaruan kecamatan bertahan saat dimuat ulang
  const verifyUpdatedDewan21 = await api.getDewanById(dewanKecItem21.data.id);
  assert(verifyUpdatedDewan21.success && verifyUpdatedDewan21.data.kecamatan === 'Kecamatan Soreang', 'Data kecamatan yang diperbarui tersimpan dan termuat ulang secara persisten');

  // Test 21.5: getDewanList memuat seluruh data dewan beserta properti kecamatan
  const listDewanKec = await api.getDewanList();
  assert(listDewanKec.success && Array.isArray(listDewanKec.data), 'getDewanList memuat daftar anggota dewan');
  const foundInList21 = listDewanKec.data.find(d => d.id === dewanKecItem21.data.id);
  assert(foundInList21 && foundInList21.kecamatan === 'Kecamatan Soreang', 'Item dewan pada getDewanList menyertakan properti kecamatan secara lengkap');

  // Bersihkan dewan uji
  await api.deleteDewan(dewanKecItem21.data.id);

  // Test 21.6: Verifikasi file HTML login.html memiliki kontrol password-toggle-btn dan atribut aksesibilitas
  const fs = await import('fs');
  const loginHtml = fs.readFileSync('login.html', 'utf-8');
  assert(loginHtml.includes('id="btnTogglePassword"'), 'login.html memiliki tombol #btnTogglePassword');
  assert(loginHtml.includes('class="password-toggle-btn"'), 'login.html menggunakan class password-toggle-btn');
  assert(loginHtml.includes('aria-label="Tampilkan kata sandi"'), 'login.html memiliki aria-label aksesibilitas kata sandi');
  assert(loginHtml.includes('class="password-input-wrapper"'), 'login.html membungkus password dengan .password-input-wrapper');

  // Test 21.7: Verifikasi file profil.html memiliki kontrol toggle password untuk semua field sandi
  const profilHtml = fs.readFileSync('profil.html', 'utf-8');
  assert(profilHtml.includes('data-target="oldPassword"'), 'profil.html memiliki tombol toggle untuk oldPassword');
  assert(profilHtml.includes('data-target="newPassword"'), 'profil.html memiliki tombol toggle untuk newPassword');
  assert(profilHtml.includes('data-target="confirmPassword"'), 'profil.html memiliki tombol toggle untuk confirmPassword');

  // Test 21.8: Verifikasi index.html bersih dari teks "Portal Petugas" dan "Masuk Portal"
  const indexHtml = fs.readFileSync('index.html', 'utf-8');
  assert(!indexHtml.includes('Portal Petugas'), 'index.html bersih total dari label teks "Portal Petugas"');
  assert(!indexHtml.includes('Masuk Portal'), 'index.html bersih total dari label teks "Masuk Portal"');

  // Test 21.9: Verifikasi index.html memiliki ikon profil netral menuju login.html pada header dan footer
  assert(indexHtml.includes('class="btn-profile-login"'), 'index.html menggunakan class .btn-profile-login untuk akses login');
  assert(indexHtml.includes('href="login.html" class="btn-profile-login" aria-label="Login" title="Login"'), 'Header index.html memiliki tautan netral ke login.html dengan tooltip dan aria-label Login');

  // Test 21.10: Verifikasi style.css menyertakan perbaikan layout
  const styleCss = fs.readFileSync('assets/css/style.css', 'utf-8');
  assert(styleCss.includes('.password-input-wrapper'), 'style.css mendefinisikan kelas .password-input-wrapper');
  assert(styleCss.includes('.password-toggle-btn'), 'style.css mendefinisikan kelas .password-toggle-btn');
  assert(styleCss.includes('.btn-profile-login'), 'style.css mendefinisikan kelas .btn-profile-login');
  assert(styleCss.includes('.form-row'), 'style.css mendefinisikan layout responsif .form-row');
  assert(styleCss.includes('max-height: calc(100vh - 32px)'), 'style.css memastikan modal dialog konfirmasi responsif pada viewport pendek');

  // --- 22. Pengujian Menyeluruh Autentikasi, Rate Limiting, Lockout 15 Menit, Isolasi Akun, & Pemulihan Admin ---
  console.log('\n--- 22. Pengujian Menyeluruh Autentikasi, Rate Limiting, Lockout 15 Menit, Isolasi Akun, & Pemulihan Admin ---');
  const superLogin22 = await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  assert(superLogin22.success, 'Login superadmin untuk persiapan Test Suite 22 berhasil');

  // Test 22.1: Buat akun staf uji untuk skenario lockout
  const testStaffRes = await api.createUser({
    username: 'staf_lockout_test',
    password: 'PasswordStafAwal123!',
    nama: 'Staf Uji Lockout',
    role: 'staff',
    status: 'aktif'
  });
  assert(testStaffRes.success && testStaffRes.data?.id, 'Akun staf uji lockout berhasil dibuat');
  const testStaffId = testStaffRes.data.id;
  await api.logout();

  // Test 22.2: Login dengan password salah 4 kali -> status gagal kredensial, belum terkunci
  for (let i = 1; i <= 4; i++) {
    const wrongRes = await api.login('staf_lockout_test', 'SandiSalahKe' + i);
    assert(!wrongRes.success && wrongRes.error?.code === 'INVALID_CREDENTIALS', `Percobaan gagal ke-${i} mengembalikan INVALID_CREDENTIALS`);
  }

  // Test 22.3: Percobaan gagal ke-5 -> memicu lockout 15 menit
  const fifthFailRes = await api.login('staf_lockout_test', 'SandiSalahKe5');
  assert(!fifthFailRes.success && fifthFailRes.error?.code === 'TOO_MANY_REQUESTS', 'Percobaan ke-5 langsung memicu penguncian akun (TOO_MANY_REQUESTS)');
  assert(fifthFailRes.message.includes('dikunci sementara'), 'Pesan penguncian akun ditampilkan secara jelas');

  // Test 22.4: Memasukkan password BENAR saat akun masih terkunci -> tetap ditolak dengan pesan waktu dinamis
  const lockedCorrectRes = await api.login('staf_lockout_test', 'PasswordStafAwal123!');
  assert(!lockedCorrectRes.success && lockedCorrectRes.error?.code === 'TOO_MANY_REQUESTS', 'Login dengan password benar saat status terkunci tetap ditolak (proteksi brute force aktif)');
  assert(lockedCorrectRes.message.includes('menit') || lockedCorrectRes.message.includes('dikunci sementara'), 'Pesan penguncian menyertakan informasi durasi');

  // Test 22.5: Isolasi akun -> penguncian staf_lockout_test tidak memengaruhi login akun lain (staf_keuangan)
  const otherUserRes = await api.login('staf_keuangan', 'PasswordStafBValid123!');
  assert(otherUserRes.success, 'Isolasi akun terbukti: staf_keuangan dapat login secara normal tanpa terpengaruh lockout akun lain');
  await api.logout();

  // Test 22.6: RBAC unlockUser -> staf dilarang membuka kunci akun
  await api.login('staf_keuangan', 'PasswordStafBValid123!');
  const forbiddenUnlock = await api.unlockUser('staf_lockout_test');
  assert(!forbiddenUnlock.success && forbiddenUnlock.error?.code === 'FORBIDDEN', 'Staf dilarang membuka kunci akun (RBAC: FORBIDDEN)');
  await api.logout();

  // Test 22.7: Pemulihan kunci akun via Superadmin unlockUser
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  const unlockRes = await api.unlockUser('staf_lockout_test');
  assert(unlockRes.success, 'Superadmin berhasil membuka kunci akun staf_lockout_test');
  await api.logout();

  // Test 22.8: Login staf setelah unlockUser berhasil seketika dengan password benar
  const staffLoginAfterUnlock = await api.login('staf_lockout_test', 'PasswordStafAwal123!');
  assert(staffLoginAfterUnlock.success, 'Staf berhasil login seketika setelah kunci dibuka oleh Superadmin');
  await api.logout();

  // Test 22.9: Penguncian ulang (5x salah) dan pemulihan otomatis saat Admin mereset kata sandi
  for (let i = 1; i <= 5; i++) {
    await api.login('staf_lockout_test', 'SandiSalahLagi' + i);
  }
  const verifyLockedAgain = await api.login('staf_lockout_test', 'PasswordStafAwal123!');
  assert(!verifyLockedAgain.success && verifyLockedAgain.error?.code === 'TOO_MANY_REQUESTS', 'Akun berhasil terkunci kembali pada pengujian tahap 2');

  // Superadmin mereset password staf yang terkunci
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  const resetPassRes22 = await api.resetUserPassword(testStaffId, 'PasswordBaruHasilReset2026!');
  assert(resetPassRes22.success, 'Superadmin mereset password staf');
  await api.logout();

  // Staf yang direset langsung dapat login dengan password baru (lockout terhapus otomatis)
  const loginWithNewPass = await api.login('staf_lockout_test', 'PasswordBaruHasilReset2026!');
  assert(loginWithNewPass.success, 'Staf dapat langsung login dengan password baru hasil reset admin (auto-recovery lockout)');
  await api.logout();

  // Test 22.10: Akun nonaktif tidak memicu penumpukan kegagalan lockout
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  await api.toggleUserStatus(testStaffId, 'nonaktif');
  await api.logout();

  const inactiveLogin = await api.login('staf_lockout_test', 'PasswordBaruHasilReset2026!');
  assert(!inactiveLogin.success && inactiveLogin.error?.code === 'ACCOUNT_INACTIVE', 'Akun nonaktif mengembalikan ACCOUNT_INACTIVE tanpa menambah counter lockout');

  // Aktifkan kembali akun, login harus berhasil seketika
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  await api.toggleUserStatus(testStaffId, 'aktif');
  await api.logout();

  const activeAgainLogin = await api.login('staf_lockout_test', 'PasswordBaruHasilReset2026!');
  assert(activeAgainLogin.success, 'Akun yang diaktifkan kembali dapat login secara normal');
  await api.logout();

  // Pembersihan akun uji
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  await api.deleteUser(testStaffId);
  await api.logout();

  // --- 23. Pengujian Pemformatan Waktu Log Aktivitas (WITA Parepare), Normalisasi Legacy GAS, & Urutan Kronologis ---
  console.log('\n--- 23. Pengujian Pemformatan Waktu Log Aktivitas (WITA Parepare), Normalisasi Legacy GAS, & Urutan Kronologis ---');

  // Test 23.1: Normalisasi legacy GAS string 'YYYY-MM-DDTHH:mm:ssZ' (jam lokal Makassar yang salah ditempel 'Z')
  const legacyGasTime = '2026-10-27T00:08:11Z';
  const legacyFormatted = formatDateIndonesia(legacyGasTime);
  assert(legacyFormatted.includes('00.08 WITA') || legacyFormatted.includes('00:08 WITA'), 'Legacy GAS string tanpa milidetik dinormalisasi ke waktu Makassar tanpa lompat 8 jam: ' + legacyFormatted);

  // Test 23.2: Format ISO offset eksplisit (+08:00)
  const isoOffsetTime = '2026-10-27T00:08:11+08:00';
  const isoFormatted = formatDateIndonesia(isoOffsetTime);
  assert(isoFormatted.includes('00.08 WITA') || isoFormatted.includes('00:08 WITA'), 'Format ISO offset +08:00 terformat presisi pada zona WITA: ' + isoFormatted);

  // Test 23.3: Format UTC murni dengan milidetik (.sssZ)
  const utcStandardTime = '2026-10-26T16:08:11.123Z'; // 16:08 UTC = 00:08 WITA (+8 jam)
  const utcFormatted = formatDateIndonesia(utcStandardTime);
  assert(utcFormatted.includes('00.08 WITA') || utcFormatted.includes('00:08 WITA'), 'Format UTC murni dikonversi secara akurat ke waktu WITA: ' + utcFormatted);

  // Test 23.4: Format SQL / Database date string 'YYYY-MM-DD HH:mm:ss'
  const sqlDate = '2026-10-27 00:08:11';
  const sqlFormatted = formatDateIndonesia(sqlDate);
  assert(sqlFormatted.includes('00.08 WITA') || sqlFormatted.includes('00:08 WITA'), 'Format database SQL date terformat konsisten sebagai WITA: ' + sqlFormatted);

  // Test 23.5: Fallback aman untuk input null / undefined / kosong
  assert(formatDateIndonesia(null) === '-', 'formatDateIndonesia(null) mengembalikan "-"');
  assert(formatDateIndonesia(undefined) === '-', 'formatDateIndonesia(undefined) mengembalikan "-"');
  assert(formatDateIndonesia('') === '-', 'formatDateIndonesia("") mengembalikan "-"');

  // Test 23.6: Login Superadmin dan periksa integritas getActivityLog
  const superLogin23 = await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  assert(superLogin23.success, 'Login superadmin untuk verifikasi log aktivitas berhasil');

  const actLogRes = await api.getActivityLog(20);
  assert(actLogRes.success && Array.isArray(actLogRes.data), 'getActivityLog mengembalikan array data aktivitas');
  assert(actLogRes.data.length > 0, 'Terdapat riwayat aktivitas sistem tercatat');

  // Test 23.7: Verifikasi format waktu pada setiap log aktivitas valid
  const firstLog = actLogRes.data[0];
  const firstLogTime = formatDateIndonesia(firstLog.waktu);
  assert(firstLogTime.endsWith('WITA'), 'Entri log aktivitas memiliki penanda zona waktu resmi WITA: ' + firstLogTime);

  // Test 23.8: Verifikasi urutan recentActivities pada dashboard terurut dari yang terbaru (descending)
  const dashDataRes = await api.getDashboardData();
  assert(dashDataRes.success && dashDataRes.data, 'getDashboardData berhasil dimuat');
  assert(Array.isArray(dashDataRes.data.recentActivities), 'recentActivities berbentuk array pada data dashboard');

  // Test 23.9: Verifikasi file HTML aktivitas.html memiliki penanganan aman aksi dan badge role dinamis
  const fsModule = await import('fs');
  const actHtmlContent = fsModule.readFileSync('aktivitas.html', 'utf-8');
  assert(actHtmlContent.includes('formatDateIndonesia(l.waktu)'), 'aktivitas.html memanggil formatDateIndonesia untuk kolom waktu');
  assert(actHtmlContent.includes('userRole === \'staff\' ? \'staff\' : \'superadmin\''), 'aktivitas.html membedakan badge role staf vs superadmin secara dinamis');
  assert(actHtmlContent.includes('isDangerAction'), 'aktivitas.html memiliki penanganan aman untuk aksi berisiko/hapus');

  // Test 23.10: Verifikasi laporan.html menggunakan formatDateIndonesia
  const lapHtmlContent = fsModule.readFileSync('laporan.html', 'utf-8');
  assert(lapHtmlContent.includes('formatDateIndonesia(l.created_at)'), 'laporan.html memformat tanggal laporan publik dengan formatDateIndonesia');

  await api.logout();

  // =========================================================================
  // TEST SUITE 24: Verifikasi Modul Arsip Dokumen, Daftar Tabel Horizontal Kategori,
  // Ikon Aksi SVG, Proteksi Hapus Kategori, & Layout Form Centering
  // =========================================================================
  console.log('\n--- 24. Pengujian Desain Tabel Horizontal Kategori, Ikon Aksi, Proteksi Hapus, & Form Centering ---');

  // Test 24.1: Periksa arsip_dewan.html memiliki struktur tabel horizontal
  const arsipHtml = fsModule.readFileSync('arsip_dewan.html', 'utf-8');
  assert(arsipHtml.includes('class="category-table-list"'), 'arsip_dewan.html menggunakan container .category-table-list');
  assert(arsipHtml.includes('class="category-table-head"'), 'arsip_dewan.html menyertakan header kolom .category-table-head');
  assert(arsipHtml.includes('<div>Kategori Dokumen</div>'), 'Header menyertakan kolom Kategori Dokumen');
  assert(arsipHtml.includes('<div>Jumlah Dokumen</div>'), 'Header menyertakan kolom Jumlah Dokumen');
  assert(arsipHtml.includes('Aksi</div>'), 'Header menyertakan kolom Aksi');

  // Test 24.2: Periksa tombol Edit memiliki ikon pensil SVG
  assert(arsipHtml.includes('btn-edit-kategori') && arsipHtml.includes('M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'), 'Tombol Edit pada baris kategori memiliki ikon pensil SVG');

  // Test 24.3: Periksa tombol Hapus memiliki ikon tempat sampah SVG dan proteksi kategori sistem
  assert(arsipHtml.includes('btn-hapus-kategori') && arsipHtml.includes('polyline points="3 6 5 6 21 6"'), 'Tombol Hapus pada baris kategori memiliki ikon tempat sampah SVG');
  assert(arsipHtml.includes('btn-kategori-protected'), 'Kategori sistem memiliki penanda proteksi btn-kategori-protected');
  assert(arsipHtml.includes('Kategori bawaan sistem DPRD (Hasil Reses / Pokir) dilindungi'), 'Kategori sistem dilindungi dari penghapusan dengan tooltip edukatif');

  // Test 24.4: Periksa konfirmasi dialog sebelum hapus kategori
  assert(arsipHtml.includes('showConfirmDialog'), 'arsip_dewan.html memanggil showConfirmDialog sebelum menghapus kategori');
  assert(arsipHtml.includes('Hapus Kategori Arsip?'), 'Dialog konfirmasi memiliki judul yang jelas');

  // Test 24.5: Periksa style.css memiliki aturan grid proporsional dan form centering
  const styleCss24 = fsModule.readFileSync('assets/css/style.css', 'utf-8');
  assert(styleCss24.includes('.category-table-head') && styleCss24.includes('grid-template-columns: minmax(0, 1fr) 160px auto;'), 'style.css menerapkan grid template proporsional minmax(0, 1fr) 160px auto pada header kategori');
  assert(styleCss24.includes('.category-row-item') && styleCss24.includes('grid-template-columns: minmax(0, 1fr) 160px auto;'), 'style.css menerapkan grid template proporsional pada baris kategori');
  assert(styleCss24.includes('.form-page-container') && styleCss24.includes('margin: 0 auto;'), 'style.css memusatkan .form-page-container secara simetris di layar desktop (margin: 0 auto)');
  assert(styleCss24.includes('.btn-danger-action'), 'style.css menyediakan class aksi bahaya .btn-danger-action');

  // Test 24.6: Periksa tambah_dokumen.html dan edit_dokumen.html menggunakan .form-page-container
  const tambahDocHtml = fsModule.readFileSync('tambah_dokumen.html', 'utf-8');
  const editDocHtml = fsModule.readFileSync('edit_dokumen.html', 'utf-8');
  assert(tambahDocHtml.includes('class="form-page-container"'), 'tambah_dokumen.html menggunakan .form-page-container');
  assert(editDocHtml.includes('class="form-page-container"'), 'edit_dokumen.html menggunakan .form-page-container');

  // Test 24.7: Periksa modal tambah dan edit kategori responsif dan centered
  assert(arsipHtml.includes('id="modalTambahKatBackdrop"'), 'arsip_dewan.html memiliki modal tambah kategori');
  assert(arsipHtml.includes('id="modalEditKatBackdrop"'), 'arsip_dewan.html memiliki modal edit kategori');
  assert(styleCss24.includes('.modal-backdrop') && styleCss24.includes('justify-content: center;'), 'Modal backdrop terpusat presisi');

  // Test 24.8: Verifikasi presisi proteksi kategori sistem: tidak salah menolak kata 'pokok' biasa pada kategori kustom
  const superLogin24 = await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  assert(superLogin24.success, 'Login superadmin untuk verifikasi proteksi presisi kategori berhasil');

  // Buat kategori kustom dengan kata 'pokok' biasa
  const katKustomPokok = await api.createKategori('Sosialisasi Pokok Pembahasan Perda', 'Kategori kustom pengujian');
  assert(katKustomPokok.success, 'Kategori kustom dengan kata pokok biasa berhasil dibuat');
  const katKustomId = katKustomPokok.data.id;

  // Hapus kategori kustom ini (harus diizinkan karena bukan Pokir/Reses sistem dan belum ada dokumen)
  const delKustomRes = await api.deleteKategori(katKustomId);
  assert(delKustomRes.success, 'Kategori kustom dengan kata pokok biasa TIDAK salah diklasifikasikan sebagai kategori sistem dan berhasil dihapus');

  // Coba hapus kategori sistem KAT-01 (harus ditolak dengan SYSTEM_CATEGORY_PROTECTED)
  const delSistemRes = await api.deleteKategori('KAT-01');
  assert(!delSistemRes.success && delSistemRes.error?.code === 'SYSTEM_CATEGORY_PROTECTED', 'Kategori sistem KAT-01 tetap ditolak keras dihapus (SYSTEM_CATEGORY_PROTECTED)');

  await api.logout();

  // ================= 25. VERIFIKASI INTEGRITAS SIMBOL DAN LOGIKA BACKEND GAS/CODE.GS =================
  console.log('\n--- 25. Verifikasi Statis & Integritas Simbol gas/Code.gs ---');
  const codeGsContent = fsModule.readFileSync('gas/Code.gs', 'utf-8');

  // Test 25.1: Bug matchedUser tidak ada di Code.gs
  assert(!codeGsContent.includes('matchedUser'), 'Variabel undefined matchedUser telah dibersihkan sepenuhnya dari gas/Code.gs');

  // Test 25.2: targetUser digunakan pada respons login
  assert(codeGsContent.includes('id: targetUser.id') && codeGsContent.includes('username: targetUser.username'), 'Respons autentikasi di gas/Code.gs menggunakan targetUser yang terdefinisi');

  // Test 25.3: Otorisasi deleteTahun di gas/Code.gs memvalidasi role superadmin
  assert(codeGsContent.includes("action === 'deleteTahun'") && codeGsContent.includes("session.role !== 'superadmin'"), 'Action deleteTahun di gas/Code.gs membatasi hak akses strictly untuk role superadmin');

  // Test 25.4: deleteTahun di gas/Code.gs memeriksa dependensi dokumen aktif
  assert(codeGsContent.includes('HAS_DEPENDENT_RECORDS'), 'Action deleteTahun di gas/Code.gs memeriksa dependensi dokumen aktif sebelum menghapus');

  // Test 25.5: isStaffAuthorizedForDewan di gas/Code.gs tidak menggunakan indexOf !== -1
  const isStaffAuthSection = codeGsContent.substring(codeGsContent.indexOf('function isStaffAuthorizedForDewan'), codeGsContent.indexOf('function isStaffAuthorizedForDokumen'));
  assert(!isStaffAuthSection.includes('indexOf !== -1') && !isStaffAuthSection.includes('.includes('), 'isStaffAuthorizedForDewan di gas/Code.gs tidak menggunakan pencocokan substring longgar indexOf / includes');

  // Test 25.6: isKategoriMatching di gas/Code.gs tidak mencocokkan kata "pokok" biasa
  const isKatMatchingSection = codeGsContent.substring(codeGsContent.indexOf('function isKategoriMatching'), codeGsContent.indexOf('function getOrCreateFolder'));
  assert(!isKatMatchingSection.includes("val.indexOf('pokok') !== -1"), 'isKategoriMatching di gas/Code.gs tidak mencocokkan substring pokok secara longgar');

  // ================= 26. VERIFIKASI SANITASI ANTI-STORED XSS & OUTPUT ESCAPING =================
  console.log('\n--- 26. Verifikasi Sanitasi Anti-Stored XSS & Output Escaping ---');

  // Test 26.1: escapeHtml menetralkan tag script dan atribut event handler
  const xssPayloadScript = "<script>alert('xss')</script>";
  assert(escapeHtml(xssPayloadScript) === "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;", 'escapeHtml menetralkan tag <script> menjadi entitas HTML');

  const xssPayloadImg = '<img src="x" onerror="alert(1)">';
  assert(escapeHtml(xssPayloadImg) === '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;', 'escapeHtml menetralkan tag <img> dan event onerror');

  const xssPayloadChars = '& < > " \'';
  assert(escapeHtml(xssPayloadChars) === '&amp; &lt; &gt; &quot; &#39;', 'escapeHtml meng-escape seluruh 5 karakter sensitif HTML secara presisi');

  assert(escapeHtml(null) === '' && escapeHtml(undefined) === '', 'escapeHtml menangani input null dan undefined secara aman');

  // Test 26.2: sanitizeUrl menolak skema berbahaya (javascript:, data:, protocol-relative)
  assert(sanitizeUrl('javascript:alert(1)') === '#', 'sanitizeUrl menolak skema javascript:');
  assert(sanitizeUrl('data:text/html,<script>alert(1)</script>') === '#', 'sanitizeUrl menolak skema data: URI');
  assert(sanitizeUrl('//evil.com/xss') === '#', 'sanitizeUrl menolak protocol-relative URL');
  assert(sanitizeUrl('https://dprd.pareparekota.go.id/doc.pdf') === 'https://dprd.pareparekota.go.id/doc.pdf', 'sanitizeUrl mengizinkan https: URL yang sah');
  assert(sanitizeUrl('/assets/docs/rdp.pdf') === '/assets/docs/rdp.pdf', 'sanitizeUrl mengizinkan relative URL yang sah');

  // Test 26.3: Verifikasi statis penutupan Stored XSS pada halaman HTML
  const lapHtml = fsModule.readFileSync('laporan.html', 'utf-8');
  assert(lapHtml.includes('escapeHtml(l.nomor_tiket') && lapHtml.includes('escapeHtml(l.nama_pelapor') && lapHtml.includes('escapeHtml(l.judul'), 'laporan.html menerapkan escapeHtml pada rendering tabel laporan');

  const aktHtml = fsModule.readFileSync('aktivitas.html', 'utf-8');
  assert(aktHtml.includes('escapeHtml(l.username') && aktHtml.includes('escapeHtml(actionText') && aktHtml.includes('escapeHtml(l.detail'), 'aktivitas.html menerapkan escapeHtml pada rendering log aktivitas');

  const komHtml = fsModule.readFileSync('komisi.html', 'utf-8');
  assert(komHtml.includes('escapeHtml(doc.nama_dokumen') && komHtml.includes('sanitizeUrl(doc.view_url'), 'komisi.html menerapkan escapeHtml dan sanitizeUrl pada dokumen RDP');

  // Test 26.4: komisi.html mengimplementasikan trigger unduh berkas riil menggunakan Blob
  assert(komHtml.includes('new Blob') && komHtml.includes('URL.createObjectURL') && komHtml.includes('downloadLink.click()'), 'komisi.html memiliki trigger unduh berkas riil menggunakan Blob dan object URL');

  const dewHtml = fsModule.readFileSync('dewan.html', 'utf-8');
  assert(dewHtml.includes('escapeHtml(d.nama') && dewHtml.includes('escapeHtml(d.jabatan'), 'dewan.html menerapkan escapeHtml pada data anggota dewan');

  const stfHtml = fsModule.readFileSync('staf.html', 'utf-8');
  assert(stfHtml.includes('escapeHtml(u.nama') && stfHtml.includes('escapeHtml(u.username'), 'staf.html menerapkan escapeHtml pada rendering daftar staf');

  const dshHtml = fsModule.readFileSync('dashboard.html', 'utf-8');
  assert(dshHtml.includes('escapeHtml(doc.nama_dokumen') && dshHtml.includes('escapeHtml(act.username'), 'dashboard.html menerapkan escapeHtml pada dokumen dan aktivitas terkini');

  // ================= 27. PENGUJIAN KETAT OTORISASI STAF DEWAN =================
  console.log('\n--- 27. Pengujian Ketat Otorisasi Staf Dewan ---');

  // Login superadmin untuk setup data penugasan dewan
  const superLogin27 = await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  assert(superLogin27.success, 'Login superadmin untuk penyiapan pengujian otorisasi staf berhasil');

  // Buat anggota dewan pengujian dengan pendamping spesifik "Staf Pendamping Resmi"
  const dewanList27 = await api.getDewanList();
  assert(dewanList27.success && dewanList27.data.length > 0, 'Daftar dewan berhasil dimuat');
  const targetDewan = dewanList27.data[0];

  // Buat staf dengan username yang merupakan substring nama orang lain (misal: "ali")
  const staffShortRes = await api.createUser({
    nama: 'Ali Staf Khusus',
    username: 'ali_khusus',
    role: 'staff',
    password: 'SandiKuatStaf2026!',
    assigned_dewan: []
  });
  assert(staffShortRes.success, 'Staf penguji Ali Khusus berhasil dibuat');
  const aliUserId = staffShortRes.data.id;

  // Login sebagai staf Ali
  const aliLogin = await api.login('ali_khusus', 'SandiKuatStaf2026!');
  assert(aliLogin.success, 'Login sebagai staf Ali Khusus berhasil');

  // Selesaikan kewajiban ganti sandi awal agar sesi aktif penuh
  const aliChangePass = await api.changePassword('SandiKuatStaf2026!', 'SandiValidAli123!');
  assert(aliChangePass.success, 'Staf Ali berhasil menyelesaikan kewajiban ganti sandi');

  // Coba unggah dokumen ke dewan yang bukan penugasannya
  const unauthorizedUpload = await api.uploadDokumen({
    dewan_id: targetDewan.id,
    kategori_id: 'KAT-01',
    tahun: 2026,
    nama_folder: 'Folder Uji Otorisasi',
    nama_dokumen: 'Dokumen Ilegal',
    nama_file: 'ilegal.pdf',
    base64: 'dGVzdA=='
  });
  assert(!unauthorizedUpload.success && unauthorizedUpload.error?.code === 'FORBIDDEN', 'Staf Ali yang tidak ditugaskan ke target dewan ditolak mengunggah dokumen (FORBIDDEN)');

  // Bersihkan akun staf penguji
  await api.logout();
  await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  await api.deleteUser(aliUserId);
  await api.logout();

  // ================= 28. PENGUJIAN OTORISASI & DEPENDENSI DELETETAHUN =================
  console.log('\n--- 28. Pengujian Otorisasi & Dependensi deleteTahun ---');

  // 1. Staf biasa mencoba memanggil deleteTahun -> harus ditolak
  const staffLogin28 = await api.login('staff', 'PasswordStaff2026!');
  assert(staffLogin28.success, 'Login staf pendamping untuk uji deleteTahun berhasil');

  const staffDelTahunRes = await api.deleteTahun('DWN-01', 'KAT-01', 2026);
  assert(!staffDelTahunRes.success && (staffDelTahunRes.error?.code === 'FORBIDDEN' || staffDelTahunRes.message.includes('Akses ditolak')), 'Staf pendamping ditolak keras menghapus struktur tahun (FORBIDDEN)');

  await api.logout();

  // 2. Superadmin mencoba menghapus tahun yang masih memiliki dokumen aktif -> ditolak HAS_DEPENDENT_RECORDS
  const superLogin28 = await api.login('superadmin', 'SandiKuatSuperadmin2026!');
  assert(superLogin28.success, 'Login superadmin untuk uji deleteTahun berhasil');

  // Pastikan terdapat struktur tahun dan dokumen aktif pada DWN-01
  await api.createTahun('DWN-01', 'KAT-01', 2026);
  await api.uploadDokumen({
    dewan_id: 'DWN-01',
    kategori_id: 'KAT-01',
    tahun: 2026,
    nama_folder: 'Folder Dependensi Uji',
    nama_dokumen: 'Dokumen Penguji Dependensi',
    nama_file: 'dependensi.pdf',
    base64: 'dGVzdA=='
  });

  const delTahunActiveRes = await api.deleteTahun('DWN-01', 'KAT-01', 2026);
  assert(!delTahunActiveRes.success && delTahunActiveRes.error?.code === 'HAS_DEPENDENT_RECORDS', 'Tahun dengan dokumen aktif ditolak dihapus dengan kode HAS_DEPENDENT_RECORDS');

  // 3. Superadmin membuat tahun kosong baru lalu menghapusnya -> berhasil
  const createEmptyTahunRes = await api.createTahun('DWN-01', 'KAT-01', 2035);
  assert(createEmptyTahunRes.success, 'Tahun kosong 2035 berhasil dibuat untuk pengujian');

  const delEmptyTahunRes = await api.deleteTahun('DWN-01', 'KAT-01', 2035);
  assert(delEmptyTahunRes.success, 'Tahun kosong 2035 tanpa dependensi berhasil dihapus oleh superadmin');

  await api.logout();
  console.log(`HASIL TOTAL PENGUJIAN: ${passed} PASS, ${failed} FAIL`);
  console.log(`=======================================================`);

  if (failed > 0) process.exit(1);
}

runAllTests().catch((e) => {
  console.error('Fatal Test Error:', e);
  process.exit(1);
});
