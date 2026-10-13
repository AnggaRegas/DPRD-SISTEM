/**
 * Suite Pengujian Otomatis Sistem Pengarsipan Dokumen DPRD Kota Parepare
 * Memverifikasi Autentikasi, Hak Akses, Proteksi Integritas, CRUD, dan Konkurensi
 */
import { api } from '../assets/js/api.js';

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

  // ================= 1. PENGUJIAN AUTENTIKASI & KEAMANAN =================
  console.log('--- 1. Pengujian Autentikasi & Keamanan ---');

  // Test 1: Login gagal dengan username salah
  const loginNonexistent = await api.login('user_tidak_ada', 'SandiRahasia123!');
  assert(!loginNonexistent.success, 'Login gagal untuk username tidak terdaftar');
  assert(loginNonexistent.message === 'Username atau password tidak valid.', 'Pesan login gagal bersifat generik tanpa membocorkan data');

  // Test 2: Login gagal dengan password salah
  const loginWrongPass = await api.login('superadmin', 'PasswordSalah123');
  assert(!loginWrongPass.success, 'Login gagal dengan password salah');

  // Test 3: Login berhasil dengan akun bootstrap superadmin
  const loginSuper = await api.login('superadmin', 'SandiRahasia123!');
  assert(loginSuper.success && loginSuper.data?.token, 'Login berhasil dengan akun superadmin');
  assert(loginSuper.data?.user?.mustChangePassword === true, 'Akun bootstrap superadmin ditandai wajib ganti password');

  // Test 4: Verifikasi sesi aktif
  const checkSess = await api.checkSession();
  assert(checkSess.success && checkSess.data?.username === 'superadmin', 'Sesi aktif berhasil diverifikasi');

  // Test 5: Penggantian password dengan password lama yang benar
  const changePass = await api.changePassword('SandiRahasia123!', 'SandiBaruSuperadmin2026!');
  assert(changePass.success, 'Superadmin berhasil memperbarui kata sandi');
  assert(changePass.data?.mustChangePassword === false, 'Flag mustChangePassword dinonaktifkan setelah penggantian');

  // Test 6: Login kembali dengan password baru
  const loginNewPass = await api.login('superadmin', 'SandiBaruSuperadmin2026!');
  assert(loginNewPass.success, 'Login berhasil menggunakan password baru');

  // ================= 2. PENGUJIAN ANGGOTA DEWAN & SEED DATA =================
  console.log('\n--- 2. Pengujian Anggota DPRD Kota Parepare (2024 - 2029) ---');

  // Test 7: Ambil daftar anggota dewan
  const dewanList = await api.getDewanList();
  assert(dewanList.success && Array.isArray(dewanList.data) && dewanList.data.length >= 4, 'Daftar anggota DPRD berhasil dimuat');

  // Test 8: Pencarian anggota dewan berdasarkan nama / partai
  const dewanSearch = await api.getDewanList('KAHARUDDIN');
  assert(dewanSearch.success && dewanSearch.data.length >= 1, 'Pencarian nama Ketua DPRD ("KAHARUDDIN") berhasil');

  // Test 9: Tambah anggota dewan baru
  const newDewan = await api.createDewan({
    nomor_urut: 26,
    nama: 'H. Anggota Uji Coba, S.T.',
    jabatan: 'Anggota Komisi II',
    periode: '2024 - 2029',
    nama_pendamping: 'Staf Pendamping Uji',
    nama_partai: 'Partai Golongan Karya'
  });
  assert(newDewan.success && newDewan.data?.id, 'Tambah anggota dewan berhasil');
  const testDewanId = newDewan.data?.id;

  // Test 10: Toggle status dewan (nonaktifkan / aktifkan)
  const toggleDewan = await api.toggleDewanStatus(testDewanId, 'nonaktif');
  assert(toggleDewan.success && toggleDewan.data?.status === 'nonaktif', 'Status anggota dewan berhasil dinonaktifkan');

  // ================= 3. PENGUJIAN KATEGORI ARSIP & INTEGRITAS =================
  console.log('\n--- 3. Pengujian Kategori Arsip & Perlindungan Dependensi ---');

  // Test 11: Ambil daftar kategori
  const katList = await api.getKategoriList();
  assert(katList.success && Array.isArray(katList.data) && katList.data.length >= 3, 'Kategori arsip resmi berhasil dimuat');

  // Test 12: Tambah kategori baru
  const newKat = await api.createKategori('Arsip Uji Khusus 2026', 'Kategori pengujian verifikasi');
  assert(newKat.success && newKat.data?.id, 'Tambah kategori baru berhasil');
  const testKatId = newKat.data?.id;

  // Test 13: Validasi duplikasi kategori (case-insensitive)
  const dupKat = await api.createKategori('arsip uji khusus 2026');
  assert(!dupKat.success, 'Sistem menolak duplikasi nama kategori');

  // Test 14: Tambah tahun dan folder arsip
  const newTahun = await api.createTahun(testDewanId, testKatId, 2026);
  assert(newTahun.success && newTahun.data?.tahun === 2026, 'Tambah tahun anggaran (2026) berhasil');

  const newFolder = await api.createFolder(testDewanId, testKatId, 2026, 'Masa Sidang Uji');
  assert(newFolder.success && newFolder.data?.nama_folder === 'Masa Sidang Uji', 'Tambah folder dokumen berhasil');

  // ================= 4. PENGUJIAN DOKUMEN ARSIP & DRIVE =================
  console.log('\n--- 4. Pengujian Dokumen Arsip & Google Drive Metadata ---');

  // Test 15: Unggah dokumen arsip
  const uploadDoc = await api.uploadDokumen({
    dewan_id: testDewanId,
    kategori_id: testKatId,
    tahun: 2026,
    nama_folder: 'Masa Sidang Uji',
    nama_dokumen: 'Laporan Fasilitasi Pengawasan Masa Sidang',
    keterangan: 'Dokumen uji verifikasi pengarsipan',
    fileName: 'laporan_pengawasan_uji.pdf',
    base64: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9ia...'
  });
  assert(uploadDoc.success && uploadDoc.data?.id, 'Unggah dokumen arsip fisik dan metadata berhasil');
  const testDocId = uploadDoc.data?.id;

  // Test 16: Pengujian perlindungan dependensi: Hapus kategori yang memiliki dokumen HARUS DITOLAK
  const delUsedKat = await api.deleteKategori(testKatId);
  assert(!delUsedKat.success, 'Penghapusan kategori yang masih memiliki dokumen ditolak untuk melindungi data');

  // Test 17: Pengujian perlindungan dependensi: Hapus dewan yang memiliki dokumen HARUS DITOLAK
  const delUsedDewan = await api.deleteDewan(testDewanId);
  assert(!delUsedDewan.success, 'Penghapusan dewan yang masih memiliki dokumen ditolak untuk melindungi arsip');

  // Test 18: Hapus dokumen arsip
  const delDoc = await api.deleteDokumen(testDocId);
  assert(delDoc.success, 'Dokumen arsip berhasil dihapus');

  // Test 19: Setelah dokumen dihapus, kategori uji dapat dihapus dengan aman
  const delSafeKat = await api.deleteKategori(testKatId);
  assert(delSafeKat.success, 'Kategori yang sudah tidak memiliki dokumen dapat dihapus dengan aman');

  // Test 20: Hapus anggota dewan uji
  const delSafeDewan = await api.deleteDewan(testDewanId);
  assert(delSafeDewan.success, 'Anggota dewan uji berhasil dihapus');

  // ================= 5. PENGUJIAN PENGGUNA & HAK AKSES =================
  console.log('\n--- 5. Pengujian Manajemen Pengguna & Hak Akses ---');

  // Test 21: Ambil daftar pengguna
  const usersList = await api.getUserList();
  assert(usersList.success && Array.isArray(usersList.data), 'Daftar pengguna sistem berhasil dimuat');

  // Test 22: Tambah pengguna staf baru
  const newStaff = await api.createUser({
    username: 'staf_verifikasi',
    nama: 'Staf Pengarsipan Uji',
    password: 'PasswordStafUji123!',
    role: 'staff'
  });
  assert(newStaff.success && newStaff.data?.username === 'staf_verifikasi', 'Penambahan akun staf baru berhasil');

  // ================= 6. SIMULASI 5 PENGGUNA SIMULTAN (CONCURRENCY) =================
  console.log('\n--- 6. Pengujian Simulasi 5 Pengguna Bersamaan ---');

  const userSimulations = [1, 2, 3, 4, 5].map(async (uNum) => {
    const listD = await api.getDewanList();
    const dashD = await api.getDashboardData();
    const katD = await api.getKategoriList();
    return listD.success && dashD.success && katD.success;
  });

  const concurrentResults = await Promise.all(userSimulations);
  const allConcurrentSuccess = concurrentResults.every((r) => r === true);
  assert(allConcurrentSuccess, '5 Pengguna bersamaan sukses membaca dan mengakses data tanpa konflik');

  // Logout sesi
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
