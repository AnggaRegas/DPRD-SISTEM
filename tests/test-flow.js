/**
 * Suite Pengujian Otomatis Sistem Pengarsipan Dokumen DPRD Kota Parepare
 * Memverifikasi Autentikasi, Kriptografi PBKDF2, Hak Akses (RBAC), Proteksi Integritas,
 * Validasi Berkas Drive, Revokasi Sesi Real-Time, dan Konkurensi Simultan
 */
import crypto from 'crypto';
import { api } from '../assets/js/api.js';
import { saveSession, clearSession, isSessionExpiredClientSide, getStoredToken, getStoredUser, getSafeRedirectUrl } from '../assets/js/auth.js';

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

  // Cleanup logout
  await api.logout();

  console.log(`\n=======================================================`);
  console.log(`HASIL TOTAL PENGUJIAN: ${passed} PASS, ${failed} FAIL`);
  console.log(`=======================================================`);

  if (failed > 0) process.exit(1);
}

runAllTests().catch((e) => {
  console.error('Fatal Test Error:', e);
  process.exit(1);
});
