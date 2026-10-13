/**
 * Test Otomatis Verifikasi Alur Sistem & Simulasi 5 Pengguna Bersamaan
 */
import { api } from '../assets/js/api.js';

console.log('=== MEMULAI TEST VERIFIKASI SISTEM ARSIP DPRD ===\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // 1. Test Login Gagal
  const loginFail = await api.login('wrong_user', 'wrong_pass');
  assert(!loginFail.success, 'Login gagal dengan kredensial salah');

  // 2. Test Login Berhasil
  const loginSuccess = await api.login('staff', 'staff123');
  assert(loginSuccess.success && loginSuccess.data?.token, 'Login berhasil dengan akun staff / staff123');

  // 3. Test Dashboard Stats
  const dashStats = await api.getDashboardData();
  assert(dashStats.success && dashStats.data?.totalDewan >= 4, 'Data statistik dashboard berhasil diambil');

  // 4. Test Ambil Daftar Anggota Dewan
  const dewanList = await api.getDewanList();
  assert(dewanList.success && Array.isArray(dewanList.data) && dewanList.data.length > 0, 'Daftar anggota dewan berhasil dimuat');

  // 5. Test Pencarian Anggota Dewan
  const dewanSearch = await api.getDewanList('Fajar');
  assert(dewanSearch.success && dewanSearch.data.length >= 1, 'Pencarian nama anggota dewan ("Fajar") berhasil');

  // 6. Test Tambah Anggota Dewan
  const newDewan = await api.createDewan({
    nama: 'H. Test Anggota Dewan, S.T.',
    jabatan: 'Anggota Komisi III',
    periode: '2024–2029',
    nama_partai: 'Partai Golongan Karya',
    nama_pengawas: 'Staf Pengawas Uji',
    keterangan: 'Data Uji Otomatis'
  });
  assert(newDewan.success && newDewan.data?.id, 'Tambah anggota dewan berhasil');
  const testDewanId = newDewan.data?.id;

  // 7. Test Ambil Kategori dengan Jumlah Dokumen
  const katDocs = await api.getKategoriWithDocCount(testDewanId);
  assert(katDocs.success && Array.isArray(katDocs.data) && katDocs.data.length > 0, 'Kategori dokumen arsip dengan hitungan berhasil dimuat');

  // 8. Test Tambah Tahun Anggaran
  const newTahun = await api.createTahun(testDewanId, 1, 2026);
  assert(newTahun.success && newTahun.data?.tahun === 2026, 'Tambah folder tahun anggaran (2026) berhasil');

  // 9. Test Tambah Folder Dokumen
  const newFolder = await api.createFolder(testDewanId, 1, 2026, 'Masa Sidang Uji');
  assert(newFolder.success && newFolder.data?.nama_folder === 'Masa Sidang Uji', 'Tambah folder dokumen ("Masa Sidang Uji") berhasil');

  // 10. Test Unggah Dokumen Mock
  const uploadDoc = await api.uploadDokumen({
    dewan_id: testDewanId,
    kategori_id: 1,
    tahun: 2026,
    nama_folder: 'Masa Sidang Uji',
    nama_dokumen: 'Dokumen Verifikasi Otomatis',
    keterangan: 'Uji unggah berkas',
    fileName: 'berkas_verifikasi.pdf',
    base64: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9ia...'
  });
  assert(uploadDoc.success && uploadDoc.data?.id, 'Unggah dokumen arsip berhasil');
  const testDocId = uploadDoc.data?.id;

  // 11. Test Ambil Dokumen di Folder
  const docList = await api.getDokumenList({
    dewan_id: testDewanId,
    kategori_id: 1,
    tahun: 2026,
    nama_folder: 'Masa Sidang Uji'
  });
  assert(docList.success && docList.data.length >= 1, 'Dokumen berhasil terdaftar di dalam folder');

  // 12. Test Hapus Dokumen
  const delDoc = await api.deleteDokumen(testDocId);
  assert(delDoc.success, 'Hapus dokumen berhasil');

  // 13. Test Hapus Anggota Dewan Uji
  const delDewan = await api.deleteDewan(testDewanId);
  assert(delDewan.success, 'Hapus anggota dewan uji berhasil');

  // 14. SIMULASI 5 PENGGUNA BERSAMAAN (CONCURRENCY TEST)
  console.log('\n--- Menjalankan Simulasi 5 Pengguna Akses Bersamaan ---');
  const userSimulations = [1, 2, 3, 4, 5].map(async (userNum) => {
    const listRes = await api.getDewanList();
    const dashRes = await api.getDashboardData();
    const katRes = await api.getKategoriList();
    return listRes.success && dashRes.success && katRes.success;
  });

  const concurrentResults = await Promise.all(userSimulations);
  const allSucceeded = concurrentResults.every((r) => r === true);
  assert(allSucceeded, '5 Pengguna bersamaan sukses mengakses data secara simultan tanpa konflik');

  console.log(`\nHASIL PENGUJIAN: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
