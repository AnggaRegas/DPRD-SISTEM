/**
 * Client API Sistem Pengarsipan Dokumen DPRD Kota Parepare
 * Menghubungkan Frontend Vercel dengan Backend Google Apps Script Web App
 */

// Memory Storage Fallback untuk Node.js Test Runner
const memoryStorage = {};
const safeLocalStorage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : {
  getItem: (k) => memoryStorage[k] || null,
  setItem: (k, v) => { memoryStorage[k] = String(v); },
  removeItem: (k) => { delete memoryStorage[k]; }
};

const safeSessionStorage = typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : safeLocalStorage;

// Konfigurasi URL Backend dari Environment Variables (Vite)
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyUYefpWZiETwX6OLheIw8dfD4InOr4R9O7f_8rBp73UYSpfnWQrhLrCLUuqyObfgCp/exec';
const ENV_GAS_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APPS_SCRIPT_URL) || '';
const STORED_GAS_URL = safeLocalStorage.getItem('dprd_gas_url') || '';
export const GAS_API_URL = (ENV_GAS_URL || STORED_GAS_URL || DEFAULT_GAS_URL).trim();

// ======================= CLIENT-SIDE IN-MEMORY CACHE & DEDUPLICATION =======================
const responseCache = new Map();
const pendingRequests = new Map();

export function clearApiCache(prefix = "") {
  if (!prefix) {
    responseCache.clear();
  } else {
    for (const key of responseCache.keys()) {
      if (key.startsWith(prefix)) responseCache.delete(key);
    }
  }
}

const CACHEABLE_ACTIONS = [
  "getDewanList", "getDewanById",
  "getKategoriList", "getKategoriWithDocCount",
  "getTahunList", "getFolderList",
  "getDokumenList", "getDokumenById",
  "getKomisiList", "getRdpDokumenList",
  "getDashboardData", "getActivityLog",
  "getCurrentUser", "checkSession", "getProfile"
];

function invalidateCacheForAction(action) {
  if (action.includes("Dewan")) {
    clearApiCache("getDewan");
    clearApiCache("getDashboardData");
  } else if (action.includes("Kategori")) {
    clearApiCache("getKategori");
    clearApiCache("getDashboardData");
  } else if (action.includes("Komisi") || action.includes("Rdp")) {
    clearApiCache("getKomisi");
    clearApiCache("getRdpDokumen");
    clearApiCache("getDashboardData");
  } else if (action.includes("Tahun")) {
    clearApiCache("getTahun");
    clearApiCache("getFolder");
    clearApiCache("getDokumen");
    clearApiCache("getDashboardData");
  } else if (action.includes("Folder")) {
    clearApiCache("getFolder");
    clearApiCache("getDokumen");
    clearApiCache("getDashboardData");
  } else if (action.includes("Dokumen")) {
    clearApiCache("getDokumen");
    clearApiCache("getTahun");
    clearApiCache("getFolder");
    clearApiCache("getKategori");
    clearApiCache("getDashboardData");
  } else if (action.includes("Activity") || action.includes("Log")) {
    clearApiCache("getActivityLog");
    clearApiCache("getDashboardData");
  } else if (action.includes("Laporan") || action.includes("Pokir")) {
    clearApiCache("getLaporan");
    clearApiCache("getDashboardData");
  } else if (action.includes("Profile") || action.includes("Login") || action.includes("Logout") || action.includes("Password") || action.includes("User")) {
    clearApiCache();
  }
}


// Mode Mock HANYA diizinkan jika secara eksplisit disetel ke 'true' atau saat test runner Node.js berjalan
const ENV_USE_MOCK = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_MOCK_API) || '';
const isNodeTest = typeof process !== 'undefined' && (
  (process.env && (process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test')) ||
  (process.argv && process.argv.some(arg => arg.includes('test')))
);
export const IS_MOCK_MODE = ENV_USE_MOCK === 'true' || Boolean(isNodeTest);

// Simpan active abort controller untuk query pencarian/navigasi yang cepat berganti
let activeSearchController = null;

// ======================= HELPER NETWORK & BASE64 =======================

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
  });
}

function getStoredToken() {
  return safeSessionStorage.getItem('dprd_token') || safeLocalStorage.getItem('dprd_token') || '';
}

const CACHE_TTL_MS = 60000; // 60 detik cache TTL untuk aksi read-only

async function performGasFetch(action, payload = {}, options = {}) {
  if (!GAS_API_URL) {
    return {
      success: false,
      data: null,
      message: 'Layanan autentikasi backend belum terkonfigurasi. Silakan hubungi administrator.',
      error: { code: 'BACKEND_URL_NOT_CONFIGURED' }
    };
  }

  const token = getStoredToken();
  const controller = options.signal ? null : new AbortController();
  const signal = options.signal || (controller ? controller.signal : null);
  const timeoutMs = options.timeout || 35000; // 35 detik batas aman Google Apps Script
  let timeoutId = null;

  if (controller) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  // Parameter cache-busting (?_t=...) mencegah proxy dan browser meng-cache response redirect HTTP 302
  const separator = GAS_API_URL.indexOf('?') === -1 ? '?' : '&';
  const requestUrl = `${GAS_API_URL}${separator}_t=${Date.now()}`;

  try {
    const res = await fetch(requestUrl, {
      method: 'POST',
      signal: signal,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        action,
        token,
        ...payload
      })
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Server merespons dengan kode status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        success: false,
        data: null,
        message: 'Koneksi ke server melebihi batas waktu tunggu. Silakan periksa koneksi internet Anda.',
        error: { code: 'TIMEOUT' }
      };
    }
    return {
      success: false,
      data: null,
      message: err.message || 'Layanan sedang tidak dapat dihubungi. Silakan coba beberapa saat lagi.',
      error: { code: 'NETWORK_ERROR' }
    };
  }
}

/**
 * Pemanggilan API Universal dengan In-Memory Caching, In-Flight Deduplication, dan Timeout
 */
async function callAppsScript(action, payload = {}, options = {}) {
  const isCacheable = CACHEABLE_ACTIONS.includes(action);
  const bypassCache = Boolean(options.forceRefresh || options.bypassCache);
  const cacheKey = `${action}:${JSON.stringify(payload)}`;

  // 1. Cek cache in-memory jika permintaan bersifat read-only dan tidak dibypass
  if (isCacheable && !bypassCache) {
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < (options.ttl || CACHE_TTL_MS))) {
      return JSON.parse(JSON.stringify(cached.data));
    }
  }

  // 2. In-flight request deduplication: gabungkan permintaan identik yang sedang berjalan
  if (isCacheable && !bypassCache && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // 3. Buat promise eksekusi (Mock atau Live Fetch)
  const executionPromise = (async () => {
    try {
      let result;
      if (IS_MOCK_MODE) {
        result = await handleMockRequest(action, payload);
      } else {
        result = await performGasFetch(action, payload, options);
      }

      // Evaluasi hasil dan kelola cache
      if (result && result.success) {
        if (isCacheable) {
          responseCache.set(cacheKey, {
            timestamp: Date.now(),
            data: JSON.parse(JSON.stringify(result))
          });
        } else {
          invalidateCacheForAction(action);
        }
      } else if (result && !result.success) {
        // Cek apakah error merupakan penolakan otorisasi atau sesi kedaluwarsa
        const isAuthError = result.error?.code === 'UNAUTHORIZED' ||
          (result.message && (
            result.message.toLowerCase().includes('kedaluwarsa') ||
            result.message.toLowerCase().includes('sesi tidak ditemukan') ||
            result.message.toLowerCase().includes('format token')
          ));

        // Jangan picu redirect jika aksi yang dijalankan adalah upaya login itu sendiri
        if (isAuthError && action !== 'login' && action !== 'adminLogin') {
          clearApiCache();
          safeSessionStorage.removeItem('dprd_token');
          safeSessionStorage.removeItem('dprd_user');
          safeSessionStorage.removeItem('dprd_session_saved_at');
          safeSessionStorage.removeItem('dprd_session_expires_at');
          safeLocalStorage.removeItem('dprd_token');
          safeLocalStorage.removeItem('dprd_user');
          safeLocalStorage.removeItem('dprd_session_saved_at');
          safeLocalStorage.removeItem('dprd_session_expires_at');

          if (typeof window !== 'undefined' && window.location) {
            const currentPath = window.location.pathname || '';
            if (!currentPath.includes('login.html')) {
              const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
              window.location.replace(`login.html?expired=1&redirect=${redirectUrl}`);
            }
          }
        }
      }

      return result;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  if (isCacheable && !bypassCache) {
    pendingRequests.set(cacheKey, executionPromise);
  }

  return executionPromise;
}

// ======================= PURE PBKDF2-HMAC-SHA256 (RFC 2898 / RFC 6070) =======================
// Disediakan untuk verifikasi unit test standar dan pengujian independen
export function computePbkdf2HmacSha256Sync(password, salt, iterations, dkLen = 32) {
  // Dalam lingkungan Node.js kita manfaatkan modul crypto native
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      // eslint-disable-next-line global-require
      const crypto = require('crypto');
      return crypto.pbkdf2Sync(password, salt, iterations, dkLen, 'sha256').toString('hex');
    } catch (e) {}
  }

  // Fallback simulator jika berjalan di lingkungan browser tanpa Node crypto
  return 'pbkdf2_simulated_' + iterations;
}

// ======================= MOCK DATA ENGINE (KHUSUS DEV/TESTING EKSPLISIT) =======================
const MOCK_STORAGE_KEY = 'dprd_mock_database_v3';

function getMockDb() {
  const existing = safeLocalStorage.getItem(MOCK_STORAGE_KEY);
  if (existing) {
    try { return JSON.parse(existing); } catch (e) {}
  }
  const defaultDb = {
    users: [
      { id: 'USR-SUPERADMIN', nama: 'Super Administrator DPRD', username: 'superadmin', password: 'SandiRahasia123!', role: 'superadmin', must_change_password: true, status: 'aktif' },
      { id: 'USR-STAFF-1', nama: 'Staff Pengarsipan', username: 'staff', password: 'PasswordStaff2026!', role: 'staff', must_change_password: false, status: 'aktif' }
    ],
    dewan: [
      { id: 'DWN-01', nomor_urut: 1, nama: 'Ir. H. KAHARUDDIN KADIR, M.Si.', jabatan: 'Ketua DPRD Kota parepare', periode: '2024 - 2029', nama_pendamping: 'SUKARNO, S. Kom.', nama_partai: 'Partai Golongan Karya', status: 'aktif', kecamatan: 'Kecamatan Bacukiki Barat' },
      { id: 'DWN-02', nomor_urut: 2, nama: 'SUYUTI, S.E.', jabatan: 'Wakil Ketua I', periode: '2024 - 2029', nama_pendamping: 'Staff Pengarsipan', nama_partai: 'Partai Nasional Demokrat', status: 'aktif', kecamatan: 'Kecamatan Soreang' },
      { id: 'DWN-03', nomor_urut: 3, nama: 'MUHAMMAD YUSUF LAPANNA, SH.I.', jabatan: 'Wakil Ketua II', periode: '2024 - 2029', nama_pendamping: 'AJI WICAKSONO, S.H', nama_partai: 'Partai Gerakan Indonesia Raya', status: 'aktif', kecamatan: 'Kecamatan Bacukiki' },
      { id: 'DWN-04', nomor_urut: 4, nama: 'ACHMAD ARIADY, S.E.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'SINTA DEWI ANGGRAENI, S.E.', nama_partai: 'Partai Nasional Demokrat', status: 'aktif', kecamatan: 'Kecamatan Ujung' }
    ],
    kategori: [
      { id: 'KAT-01', nama_kategori: 'Pokok-Pokok Pikiran (Pokir)', deskripsi: 'Arsip usulan aspirasi masyarakat', status: 'aktif' },
      { id: 'KAT-02', nama_kategori: 'Laporan Hasil Reses', deskripsi: 'Laporan penjaringan aspirasi konstituen', status: 'aktif' },
      { id: 'KAT-03', nama_kategori: 'Fasilitasi Penganggaran (RKA/DPA)', deskripsi: 'Dokumen pembahasan anggaran', status: 'aktif' }
    ],
    komisi: [
      { id: 'KOM-1', kode: 'komisi_1', nama: 'Komisi 1', bidang: 'Bidang Pemerintahan, Hukum, dan Ketertiban', deskripsi: 'Membidangi urusan pemerintahan umum, hukum, perizinan, aparatur, dan ketertiban masyarakat.', kategori_folder: 'RDP', status: 'aktif' },
      { id: 'KOM-2', kode: 'komisi_2', nama: 'Komisi 2', bidang: 'Bidang Ekonomi, Keuangan, dan Pembangunan', deskripsi: 'Membidangi urusan keuangan daerah, perpajakan, perindustrian, perdagangan, dan pembangunan infrastruktur.', kategori_folder: 'RDP', status: 'aktif' },
      { id: 'KOM-3', kode: 'komisi_3', nama: 'Komisi 3', bidang: 'Bidang Kesejahteraan Rakyat dan Pendidikan', deskripsi: 'Membidangi urusan pendidikan, kesehatan, sosial, ketenagakerjaan, kepemudaan, dan kesejahteraan rakyat.', kategori_folder: 'RDP', status: 'aktif' }
    ],
    tahun: [
      { id: 'THN-1', dewan_id: 'DWN-01', kategori_id: 'KAT-01', tahun: 2024, status: 'aktif' }
    ],
    folder: [
      { id: 'FLD-1', dewan_id: 'DWN-01', kategori_id: 'KAT-01', tahun: 2024, nama_folder: 'Masa Sidang I', status: 'aktif' }
    ],
    dokumen: [
      {
        id: 'DOC-1',
        dewan_id: 'DWN-01',
        kategori_id: 'KAT-01',
        tahun: 2024,
        nama_folder: 'Masa Sidang I',
        nama_dokumen: 'Laporan Pokir Dapil Soreang 2024',
        keterangan: 'Arsip pokir dewan',
        nama_file: 'pokir_2024.pdf',
        file_id: 'mock-drive-1',
        direct_url: '#',
        view_url: '#',
        ukuran_file: 250000,
        status: 'aktif',
        uploaded_by: 'superadmin',
        tanggal_upload: '2024-03-15T09:30:00Z'
      }
    ],
    laporan: [],
    logs: [],
    failedAttempts: {},
    lockouts: {}
  };
  safeLocalStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(defaultDb));
  return defaultDb;
}

function saveMockDb(db) {
  safeLocalStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
}

// Matriks Perizinan Role pada Mock Handler (Sinkron dengan backend Code.gs)
const MOCK_ACTION_PERMISSIONS = {
  'login': 'PUBLIC',
  'adminLogin': 'PUBLIC',
  'submitLaporanPublik': 'PUBLIC',
  'getPublicDewanList': 'PUBLIC',
  'checkPokirDuplication': 'PUBLIC',
  'logout': ['staff', 'admin', 'superadmin'],
  'adminLogout': ['staff', 'admin', 'superadmin'],
  'checkSession': ['staff', 'admin', 'superadmin'],
  'getCurrentUser': ['staff', 'admin', 'superadmin'],
  'getProfile': ['staff', 'admin', 'superadmin'],
  'changePassword': ['staff', 'admin', 'superadmin'],
  'getDashboardData': ['staff', 'admin', 'superadmin'],
  'getDewanList': ['staff', 'admin', 'superadmin'],
  'getDewanById': ['staff', 'admin', 'superadmin'],
  'getKategoriList': ['staff', 'admin', 'superadmin'],
  'getKategoriWithDocCount': ['staff', 'admin', 'superadmin'],
  'getTahunList': ['staff', 'admin', 'superadmin'],
  'getFolderList': ['staff', 'admin', 'superadmin'],
  'getDokumenList': ['staff', 'admin', 'superadmin'],
  'getDokumenById': ['staff', 'admin', 'superadmin'],
  'downloadDokumen': ['staff', 'admin', 'superadmin'],
  'createTahun': ['staff', 'admin', 'superadmin'],
  'updateTahun': ['staff', 'admin', 'superadmin'],
  'createFolder': ['staff', 'admin', 'superadmin'],
  'updateFolder': ['staff', 'admin', 'superadmin'],
  'uploadDokumen': ['staff', 'admin', 'superadmin'],
  'updateDokumen': ['staff', 'admin', 'superadmin'],
  'createDewan': ['superadmin'],
  'updateDewan': ['superadmin'],
  'toggleDewanStatus': ['superadmin'],
  'deleteDewan': ['superadmin'],
  'createKategori': ['superadmin', 'admin'],
  'updateKategori': ['superadmin', 'admin'],
  'toggleKategoriStatus': ['superadmin', 'admin'],
  'deleteKategori': ['superadmin', 'admin'],
  'deleteTahun': ['superadmin'],
  'deleteFolder': ['superadmin'],
  'deleteDokumen': ['staff', 'admin', 'superadmin'],
  'getKomisiList': ['superadmin'],
  'createKomisi': ['superadmin'],
  'deleteKomisi': ['superadmin'],
  'getRdpDokumenList': ['superadmin'],
  'uploadRdpDokumen': ['superadmin'],
  'updateRdpDokumen': ['superadmin'],
  'deleteRdpDokumen': ['superadmin'],
  'getLaporanList': ['staff', 'admin', 'superadmin'],
  'assignLaporan': ['superadmin'],
  'updateLaporanStatus': ['staff', 'admin', 'superadmin'],
  'downloadLaporanLampiran': ['staff', 'admin', 'superadmin'],
  'deleteLaporan': ['superadmin'],
  'approvePokirException': ['superadmin'],
  'updateProfile': ['staff', 'admin', 'superadmin'],
  'getUserList': ['superadmin'],
  'getActivityLog': ['superadmin'],
  'clearActivityLog': ['superadmin'],
  'createUser': ['superadmin'],
  'updateUser': ['superadmin'],
  'toggleUserStatus': ['superadmin'],
  'resetUserPassword': ['superadmin'],
  'unlockUser': ['superadmin'],
  'deleteUser': ['superadmin']
};

async function handleMockRequest(action, payload) {
  await new Promise((r) => setTimeout(r, 15));
  const db = getMockDb();

  // 1. Matriks Akses Eksplisit
  const allowedRoles = MOCK_ACTION_PERMISSIONS[action];
  if (!allowedRoles) {
    return { success: false, data: null, message: 'Aksi API tidak dikenali: ' + action, error: { code: 'NOT_FOUND' } };
  }

  // Engine Penyaringan Usulan Berulang Pokir
  function checkPokirDuplicationRule(data) {
    const nama = String(data.nama_pelapor || '').trim();
    const kontak = String(data.kontak_pelapor || '').trim();
    const kategori = String(data.kategori || '').trim();
    const tujuan = String(data.tujuan || '').trim();
    const judul = String(data.judul || '').trim();
    const cleanContact = kontak.replace(/[^0-9]/g, '');
    const cleanName = cleanStaffTitle(nama);

    const allLaporan = db.laporan || [];

    // Cari riwayat dari pengusul yang sama berdasarkan kontak atau nama terverifikasi
    const existingReports = allLaporan.filter(l => {
      const exContact = String(l.kontak_pelapor || '').replace(/[^0-9]/g, '');
      const exName = cleanStaffTitle(l.nama_pelapor || '');
      const contactMatch = cleanContact && exContact && cleanContact.length >= 8 && cleanContact === exContact;
      const nameMatch = cleanName && exName && cleanName.length >= 3 && cleanName === exName;
      return contactMatch || nameMatch;
    });

    if (!existingReports.length) {
      return { status: 'A', allowed: true, perluVerifikasi: false, message: 'Tidak terindikasi berulang.' };
    }

    // Periksa apakah sudah ada usulan yang BENAR-BENAR terealisasi / didanai untuk program/kategori yang sama
    const realizedMatch = existingReports.find(l => {
      const st = String(l.status || '').toLowerCase();
      const realSt = String(l.realisasi_status || '').toLowerCase();
      const isRealized = st === 'terealisasi' || st === 'didanai' || realSt === 'terealisasi';
      const isSameCategory = String(l.kategori || '').toLowerCase() === kategori.toLowerCase();
      const isSameTujuan = String(l.tujuan || '').toLowerCase() === tujuan.toLowerCase();
      return isRealized && (isSameCategory || isSameTujuan);
    });

    if (realizedMatch && String(realizedMatch.status_duplikasi || '') !== 'disetujui_pengecualian') {
      return {
        status: 'C',
        allowed: false,
        perluVerifikasi: false,
        message: 'Pengajuan belum dapat diterima karena berdasarkan riwayat sistem, pihak pengusul telah memiliki usulan yang terealisasi untuk program ini dan memenuhi ketentuan pembatasan. Silakan hubungi petugas berwenang apabila data tersebut tidak sesuai.',
        priorTicket: realizedMatch.nomor_tiket
      };
    }

    // Periksa apakah ada indikasi berulang (program sama tetapi belum terealisasi / sedang diproses)
    const pendingSameProgram = existingReports.find(l => {
      const isSameCategory = String(l.kategori || '').toLowerCase() === kategori.toLowerCase();
      const isSameTujuan = String(l.tujuan || '').toLowerCase() === tujuan.toLowerCase();
      return isSameCategory && isSameTujuan;
    });

    if (pendingSameProgram) {
      return {
        status: 'B',
        allowed: true,
        perluVerifikasi: true,
        message: 'Pengajuan Anda memerlukan pemeriksaan lebih lanjut karena sistem menemukan kemungkinan kesamaan dengan usulan yang pernah diajukan. Petugas akan memeriksa data tersebut sebelum keputusan diberikan.',
        priorTicket: pendingSameProgram.nomor_tiket
      };
    }

    return { status: 'A', allowed: true, perluVerifikasi: false, message: 'Tidak terindikasi berulang.' };
  }

  // 2. Aksi Publik (Tanpa Autentikasi)
  if (action === 'checkPokirDuplication') {
    const d = payload.data || payload;
    const res = checkPokirDuplicationRule(d);
    return { success: true, data: res, message: res.message };
  }

  if (action === 'submitLaporanPublik') {
    const d = payload.data || payload;
    const nama = String(d.nama_pelapor || '').trim();
    const kontak = String(d.kontak_pelapor || '').trim();
    const kec = String(d.kecamatan || '').trim();
    const kat = String(d.kategori || 'Aspirasi').trim();
    const tujuan = String(d.tujuan || 'DPRD Kota Parepare').trim();
    const judul = String(d.judul || '').trim();
    const isi = String(d.isi || '').trim();

    if (!nama || !kontak || !kec || !judul || !isi) {
      return { success: false, message: 'Nama, kontak, kecamatan, judul, dan isi laporan wajib diisi.', error: { code: 'VALIDATION_ERROR' } };
    }

    const allowedKec = ['Kecamatan Bacukiki', 'Kecamatan Bacukiki Barat', 'Kecamatan Soreang', 'Kecamatan Ujung', 'Bacukiki', 'Bacukiki Barat', 'Soreang', 'Ujung'];
    const matchKec = allowedKec.find((x) => x.toLowerCase() === kec.toLowerCase());
    if (!matchKec) {
      return { success: false, message: 'Kecamatan harus berada di wilayah resmi Kota Parepare.', error: { code: 'VALIDATION_ERROR' } };
    }

    // Jalankan Penyaringan Usulan Berulang Pokir
    const pokirCheck = checkPokirDuplicationRule({
      nama_pelapor: nama,
      kontak_pelapor: kontak,
      kategori: kat,
      tujuan: tujuan,
      judul: judul
    });

    if (!pokirCheck.allowed) {
      return {
        success: false,
        decision: 'MELANGGAR_PEMBATASAN',
        message: pokirCheck.message,
        error: { code: 'DUPLICATE_REALIZED_PROPOSAL' }
      };
    }

    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const hex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const nomorTiket = `LAP-${ymd}-${hex}`;

    db.laporan = db.laporan || [];
    const newReport = {
      id: 'RPT-' + Date.now(),
      nomor_tiket: nomorTiket,
      nama_pelapor: nama,
      kontak_pelapor: kontak,
      kecamatan: matchKec,
      kategori: kat,
      tujuan: tujuan,
      judul: judul,
      isi: isi,
      lampiran_nama: d.fileName || '',
      lampiran_base64: d.base64 || d.fileData || '',
      lampiran_file_id: d.fileName ? 'mock-lap-' + Date.now() : '',
      lampiran_url: d.fileName ? '#' : '',
      status: 'menunggu',
      status_duplikasi: pokirCheck.perluVerifikasi ? 'perlu_verifikasi' : 'normal',
      catatan_duplikasi: pokirCheck.perluVerifikasi ? pokirCheck.message : '',
      assigned_to: '',
      tanggapan: '',
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };
    db.laporan.push(newReport);
    saveMockDb(db);

    return {
      success: true,
      data: {
        nomor_tiket: nomorTiket,
        created_at: newReport.created_at,
        status_duplikasi: newReport.status_duplikasi
      },
      message: pokirCheck.perluVerifikasi ? pokirCheck.message : 'Aspirasi / pengaduan Anda telah berhasil diterima oleh Sekretariat DPRD Kota Parepare.'
    };
  }

  if (action === 'getPublicDewanList') {
    const list = (db.dewan || []).filter((d) => d.status === 'aktif').map((d) => ({
      nomor_urut: d.nomor_urut,
      nama: d.nama,
      jabatan: d.jabatan,
      nama_partai: d.nama_partai,
      kecamatan: d.kecamatan || '',
      komisi: (d.jabatan && d.jabatan.includes('Komisi')) ? d.jabatan : ''
    })).sort((a, b) => (a.nomor_urut || 999) - (b.nomor_urut || 999));
    return { success: true, data: list, message: 'Daftar publik dewan berhasil dimuat.' };
  }

  if (action === 'adminLogin' || action === 'login') {
    const u = (payload.username || (payload.credentials && payload.credentials.username) || '').trim().toLowerCase();
    const p = payload.password || (payload.credentials && payload.credentials.password) || '';

    if (!u || !p) {
      return { success: false, data: null, message: 'Username dan kata sandi wajib diisi.', error: { code: 'VALIDATION_ERROR' } };
    }

    if (!db.lockouts) db.lockouts = {};
    if (!db.failedAttempts) db.failedAttempts = {};

    // Cek status Lockout
    if (db.lockouts[u]) {
      if (Date.now() < db.lockouts[u]) {
        const remainingMins = Math.max(1, Math.ceil((db.lockouts[u] - Date.now()) / 60000));
        return {
          success: false,
          data: null,
          message: `Terlalu banyak percobaan login gagal. Akun dikunci sementara. Silakan coba lagi dalam ${remainingMins} menit.`,
          error: { code: 'TOO_MANY_REQUESTS' }
        };
      } else {
        // Lockout telah kedaluwarsa secara alami
        delete db.lockouts[u];
        delete db.failedAttempts[u];
        saveMockDb(db);
      }
    }

    const targetUser = db.users.find((x) => String(x.username || '').trim().toLowerCase() === u);
    if (!targetUser) {
      db.failedAttempts[u] = (db.failedAttempts[u] || 0) + 1;
      let isLocked = false;
      let msg = 'Username atau password tidak valid.';
      if (db.failedAttempts[u] >= 5) {
        db.lockouts[u] = Date.now() + 15 * 60 * 1000;
        delete db.failedAttempts[u];
        isLocked = true;
        msg = 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.';
      }
      saveMockDb(db);
      return {
        success: false,
        data: null,
        message: msg,
        error: { code: isLocked ? 'TOO_MANY_REQUESTS' : 'INVALID_CREDENTIALS' }
      };
    }

    // Jika akun berstatus nonaktif
    if (String(targetUser.status || '').toLowerCase() === 'nonaktif') {
      return {
        success: false,
        data: null,
        message: 'Akun Anda berstatus nonaktif. Silakan hubungi Administrator.',
        error: { code: 'ACCOUNT_INACTIVE' }
      };
    }

    // Verifikasi password (mendukung teks polos maupun PBKDF2 hash)
    let isPasswordValid = false;
    if (targetUser.password === p) {
      isPasswordValid = true;
    } else if (typeof targetUser.password === 'string' && targetUser.password.startsWith('pbkdf2$')) {
      const parts = targetUser.password.split('$');
      if (parts.length === 3) {
        const iter = parseInt(parts[1], 10);
        const salt = targetUser.salt || 'default_salt';
        const expected = hashPasswordPBKDF2Simulator(p, salt, iter);
        if (expected === targetUser.password) {
          isPasswordValid = true;
        }
      }
    }

    if (!isPasswordValid) {
      db.failedAttempts[u] = (db.failedAttempts[u] || 0) + 1;
      let isLocked = false;
      let msg = 'Username atau password tidak valid.';
      if (db.failedAttempts[u] >= 5) {
        db.lockouts[u] = Date.now() + 15 * 60 * 1000;
        delete db.failedAttempts[u];
        isLocked = true;
        msg = 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.';
      }
      saveMockDb(db);
      return {
        success: false,
        data: null,
        message: msg,
        error: { code: isLocked ? 'TOO_MANY_REQUESTS' : 'INVALID_CREDENTIALS' }
      };
    }

    // Login sukses: reset penghitung gagal & lockout seketika
    delete db.failedAttempts[u];
    delete db.lockouts[u];

    const token = 'DPRD_SES_' + targetUser.id + '_' + Date.now();
    const userObj = {
      id: targetUser.id,
      username: targetUser.username,
      nama: targetUser.nama,
      role: targetUser.role,
      mustChangePassword: Boolean(targetUser.must_change_password)
    };

    safeSessionStorage.setItem('dprd_token', token);
    safeSessionStorage.setItem('dprd_user', JSON.stringify(userObj));
    saveMockDb(db);

    return { success: true, data: { token, user: userObj }, message: 'Login berhasil.' };
  }

  // 3. Verifikasi Sesi Terautentikasi
  const storedToken = getStoredToken();
  const uStr = safeSessionStorage.getItem('dprd_user');
  if (!storedToken || !uStr) {
    return { success: false, data: null, message: 'Akses ditolak: Sesi tidak ditemukan atau telah kedaluwarsa.', error: { code: 'UNAUTHORIZED' } };
  }

  const currentUser = JSON.parse(uStr);
  const liveUser = db.users.find((x) => x.id === currentUser.id);

  if (!liveUser || liveUser.status !== 'aktif') {
    safeSessionStorage.removeItem('dprd_token');
    safeSessionStorage.removeItem('dprd_user');
    return { success: false, data: null, message: 'Akses ditolak: Akun telah dinonaktifkan.', error: { code: 'UNAUTHORIZED' } };
  }

  // Sinkronisasi status peran, nama, username, dan kewajiban ganti password terbaru
  currentUser.role = liveUser.role;
  currentUser.mustChangePassword = Boolean(liveUser.must_change_password);
  currentUser.nama = liveUser.nama;
  currentUser.username = liveUser.username;
  try {
    safeSessionStorage.setItem('dprd_user', JSON.stringify(currentUser));
    safeLocalStorage.setItem('dprd_user', JSON.stringify(currentUser));
  } catch (e) {}

  // 4. Proteksi Wajib Ganti Password
  const ALLOWED_MUST_CHANGE = ['changePassword', 'logout', 'adminLogout', 'checkSession', 'getCurrentUser', 'getProfile'];
  if (currentUser.mustChangePassword && ALLOWED_MUST_CHANGE.indexOf(action) === -1) {
    return { success: false, data: null, message: 'Anda wajib mengganti kata sandi terlebih dahulu sebelum dapat mengakses fitur sistem.', error: { code: 'MUST_CHANGE_PASSWORD' } };
  }

  // 5. Otorisasi Peran (RBAC)
  if (Array.isArray(allowedRoles) && !allowedRoles.includes(currentUser.role)) {
    return { success: false, data: null, message: 'Akses ditolak: Peran akun "' + currentUser.role + '" tidak memiliki izin.', error: { code: 'FORBIDDEN' } };
  }

  // Helper Otorisasi Staf untuk Mock Database
  function cleanStaffTitle(str) {
    if (!str) return '';
    return String(str)
      .replace(/[,.]/g, ' ')
      .replace(/\b(h|hj|ir|drs|dra|dr|prof|m\.si|msi|s\.ip|sip|s\.kom|skom|s\.e|se|s\.h|sh|s\.sos|ssos|m\.m|mm|m\.pd|mpd|s\.pd|spd)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function isKategoriMatching(katParam, recordKatId) {
    if (!katParam || !recordKatId) return false;
    const p = String(katParam).trim().toLowerCase();
    const r = String(recordKatId).trim().toLowerCase();
    if (p === r) return true;

    // Pencocokan numerik bila satu KAT-01 dan satu lagi 1 atau format angka murni
    const numP = p.replace(/[^0-9]/g, '');
    const numR = r.replace(/[^0-9]/g, '');
    if (numP && numR && parseInt(numP, 10) === parseInt(numR, 10)) {
      const isPrefixP = p.startsWith('kat-') || /^\d+$/.test(p);
      const isPrefixR = r.startsWith('kat-') || /^\d+$/.test(r);
      if (isPrefixP && isPrefixR) return true;
    }

    const katObjP = (db.kategori || []).find((k) => String(k.id).toLowerCase() === p || String(k.nama_kategori).toLowerCase() === p);
    const katObjR = (db.kategori || []).find((k) => String(k.id).toLowerCase() === r || String(k.nama_kategori).toLowerCase() === r);

    const nameP = (katObjP ? katObjP.nama_kategori : p).toLowerCase();
    const nameR = (katObjR ? katObjR.nama_kategori : r).toLowerCase();

    if (nameP === nameR) return true;

    const isPokirP = nameP.includes('pokir') || nameP.includes('pokok-pokok pikiran') || nameP.includes('pokok pikiran') || p === 'kat-01' || p === '1';
    const isPokirR = nameR.includes('pokir') || nameR.includes('pokok-pokok pikiran') || nameR.includes('pokok pikiran') || r === 'kat-01' || r === '1';
    if (isPokirP && isPokirR) return true;

    const isResesP = nameP.includes('reses') || p === 'kat-02' || p === '2';
    const isResesR = nameR.includes('reses') || r === 'kat-02' || r === '2';
    if (isResesP && isResesR) return true;

    return false;
  }

  function isMockStaffAuthorizedForDewan(targetDewanId) {
    if (!targetDewanId) return false;
    if (currentUser.role === 'superadmin' || currentUser.role === 'admin') return true;
    if (currentUser.role !== 'staff') return false;

    const idStr = String(targetDewanId).trim();
    if (idStr.startsWith('KOM-')) return false; // Arsip Komisi dilarang untuk staf pendamping

    // Cek apakah penugasan tercatat pada akun pengguna di db.users
    const userInDb = (db.users || []).find((u) => u.id === currentUser.id || u.username === currentUser.username);
    if (userInDb && Array.isArray(userInDb.assigned_dewan)) {
      if (userInDb.assigned_dewan.some((d) => String(d.id || d) === idStr)) {
        return true;
      }
    }

    const dwn = (db.dewan || []).find((d) => String(d.id) === idStr || String(d.nomor_urut) === idStr);
    if (!dwn) return false;

    const pendampingRaw = String(dwn.nama_pendamping || '').trim().toLowerCase();
    if (!pendampingRaw) return false;

    const pendampingClean = cleanStaffTitle(pendampingRaw);
    const userNamaRaw = String(currentUser.nama || '').trim().toLowerCase();
    const userNamaClean = cleanStaffTitle(userNamaRaw);
    const userNameRaw = String(currentUser.username || '').trim().toLowerCase();
    const userIdRaw = String(currentUser.id || '').trim().toLowerCase();

    // 1. Direct equality / ID / Username
    if (pendampingRaw === userNamaRaw || pendampingRaw === userNameRaw || pendampingRaw === userIdRaw) {
      return true;
    }

    // 2. Normalized clean name equality
    if (userNamaClean && pendampingClean && (pendampingClean === userNamaClean)) {
      return true;
    }

    // 3. Substring / inclusion matching
    if (userNameRaw && (pendampingRaw.includes(userNameRaw) || userNameRaw.includes(pendampingRaw))) {
      return true;
    }
    if (userNamaRaw && (pendampingRaw.includes(userNamaRaw) || userNamaRaw.includes(pendampingRaw))) {
      return true;
    }
    if (userNamaClean && pendampingClean && (pendampingClean.includes(userNamaClean) || userNamaClean.includes(pendampingClean))) {
      return true;
    }

    // 4. Split multi-pendamping (jika dipisah koma, titik koma, garis miring)
    const parts = pendampingRaw.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.some((p) => {
      const pC = cleanStaffTitle(p);
      return p === userNamaRaw || p === userNameRaw || p === userIdRaw ||
             (userNamaClean && pC && pC === userNamaClean) ||
             (userNameRaw && p.includes(userNameRaw)) ||
             (userNamaClean && pC && (pC.includes(userNamaClean) || userNamaClean.includes(pC)));
    })) {
      return true;
    }

    return false;
  }

  function isMockStaffAuthorizedForDokumen(doc) {
    if (!doc) return false;
    if (currentUser.role === 'superadmin') return true;
    return isMockStaffAuthorizedForDewan(doc.dewan_id);
  }

  // 6. Router Aksi Mock
  switch (action) {
    case 'adminLogout':
    case 'logout':
      safeSessionStorage.removeItem('dprd_token');
      safeSessionStorage.removeItem('dprd_user');
      return { success: true, data: null, message: 'Logout berhasil.' };

    case 'getCurrentUser':
    case 'checkSession':
    case 'getProfile':
      return { success: true, data: currentUser, message: 'Sesi aktif.' };

    case 'changePassword': {
      if (liveUser.password !== payload.oldPassword) {
        return { success: false, message: 'Password lama tidak sesuai.', error: { code: 'INVALID_OLD_PASSWORD' } };
      }
      if (!payload.newPassword || payload.newPassword.length < 8 || !/[a-zA-Z]/.test(payload.newPassword) || !/[0-9]/.test(payload.newPassword)) {
        return { success: false, message: 'Password baru minimal 8 karakter kombinasi huruf dan angka.', error: { code: 'VALIDATION_ERROR' } };
      }
      liveUser.password = payload.newPassword;
      liveUser.must_change_password = false;
      currentUser.mustChangePassword = false;
      safeSessionStorage.setItem('dprd_user', JSON.stringify(currentUser));
      saveMockDb(db);
      return { success: true, data: currentUser, message: 'Password berhasil diperbarui.' };
    }

    case 'updateProfile': {
      const data = payload.data || payload;
      const newUsername = data.username !== undefined ? String(data.username).trim().toLowerCase() : '';
      const newNama = data.nama !== undefined ? String(data.nama).trim() : '';

      if (newUsername) {
        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(newUsername)) {
          return {
            success: false,
            message: 'Username harus berupa 3-30 karakter alfanumerik, titik, atau garis bawah/strip.',
            error: { code: 'VALIDATION_ERROR' }
          };
        }
        const duplicate = db.users.some(u => String(u.id) !== String(currentUser.id) && String(u.username).toLowerCase() === newUsername);
        if (duplicate) {
          return {
            success: false,
            message: 'Username sudah digunakan oleh akun lain.',
            error: { code: 'DUPLICATE_USERNAME' }
          };
        }
        const oldUsername = liveUser.username;
        liveUser.username = newUsername;
        currentUser.username = newUsername;

        (db.dokumen || []).forEach(d => {
          if (String(d.uploaded_by || '').toLowerCase() === oldUsername.toLowerCase()) {
            d.uploaded_by = newUsername;
          }
        });
      }

      if (newNama) {
        liveUser.nama = newNama;
        currentUser.nama = newNama;
      }

      safeSessionStorage.setItem('dprd_user', JSON.stringify(currentUser));
      saveMockDb(db);
      return { success: true, data: { ...currentUser, ...liveUser }, message: 'Profil pengguna berhasil diperbarui.' };
    }

    case 'getDashboardData':
      return {
        success: true,
        data: {
          totalDewan: db.dewan.length,
          totalDewanAktif: db.dewan.filter((d) => d.status === 'aktif').length,
          totalDokumen: db.dokumen.filter((d) => d.status === 'aktif').length,
          totalKategori: db.kategori.filter((k) => k.status === 'aktif').length,
          recentDocuments: db.dokumen.slice(0, 5),
          recentActivities: db.logs.slice(-5)
        },
        message: 'Data dashboard berhasil dimuat.'
      };

    case 'getDewanList': {
      const q = String(payload.cari || payload.q || '').trim().toLowerCase();
      let list = db.dewan.slice();
      if (q) {
        list = list.filter((d) => d.nama.toLowerCase().includes(q) || d.nama_partai.toLowerCase().includes(q) || d.jabatan.toLowerCase().includes(q) || (d.kecamatan && d.kecamatan.toLowerCase().includes(q)));
      }
      list.sort((a, b) => (a.nomor_urut || 999) - (b.nomor_urut || 999));
      if (currentUser.role === 'staff') {
        list = list.map((d) => ({
          ...d,
          is_assigned: isMockStaffAuthorizedForDewan(d.id)
        }));
      }
      return { success: true, data: list, message: 'Daftar anggota dewan berhasil dimuat.' };
    }

    case 'getDewanById': {
      const id = String(payload.id);
      const item = db.dewan.find((d) => String(d.id) === id || String(d.nomor_urut) === id);
      if (!item) return { success: false, message: 'Data dewan tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      const res = { ...item };
      if (currentUser.role === 'staff') {
        res.is_assigned = Boolean(isMockStaffAuthorizedForDewan(item.id));
      } else {
        res.is_assigned = true;
      }
      return { success: true, data: res, is_assigned: res.is_assigned };
    }

    case 'createDewan': {
      const d = payload.data || payload;
      const nextNum = db.dewan.length + 1;
      const idStr = 'DWN-' + (nextNum < 10 ? '0' + nextNum : nextNum);
      const pendVal = d.nama_pendamping || d.nama_pengawas || '';
      const record = { id: idStr, nomor_urut: nextNum, ...d, nama_pendamping: pendVal, nama_pengawas: pendVal, kecamatan: d.kecamatan || '', status: 'aktif' };
      db.dewan.push(record);
      saveMockDb(db);
      return { success: true, data: record, message: 'Anggota dewan berhasil ditambahkan.' };
    }

    case 'updateDewan': {
      const d = payload.data || payload;
      const idx = db.dewan.findIndex((x) => String(x.id) === String(d.id));
      if (idx !== -1) {
        const existing = db.dewan[idx];
        const pendVal = d.nama_pendamping !== undefined ? d.nama_pendamping : (d.nama_pengawas !== undefined ? d.nama_pengawas : existing.nama_pendamping || existing.nama_pengawas || '');
        db.dewan[idx] = {
          ...existing,
          ...d,
          nama_pendamping: pendVal,
          nama_pengawas: pendVal,
          kecamatan: d.kecamatan !== undefined ? d.kecamatan : existing.kecamatan
        };
        saveMockDb(db);
        return { success: true, data: db.dewan[idx], message: 'Data dewan berhasil diperbarui.' };
      }
      return { success: false, message: 'Data dewan tidak ditemukan.' };
    }

    case 'toggleDewanStatus': {
      const id = String(payload.id);
      const target = db.dewan.find((x) => String(x.id) === id);
      if (target) {
        target.status = payload.status || (target.status === 'aktif' ? 'nonaktif' : 'aktif');
        saveMockDb(db);
        return { success: true, data: target, message: 'Status dewan berhasil diubah.' };
      }
      return { success: false, message: 'Data dewan tidak ditemukan.' };
    }

    case 'deleteDewan': {
      const id = String(payload.id);
      const hasDocs = db.dokumen.some((d) => String(d.dewan_id) === id);
      if (hasDocs) {
        return { success: false, message: 'Anggota dewan tidak dapat dihapus karena memiliki dokumen terikat. Silakan nonaktifkan.', error: { code: 'HAS_DEPENDENT_RECORDS' } };
      }
      db.dewan = db.dewan.filter((x) => String(x.id) !== id);
      saveMockDb(db);
      return { success: true, message: 'Anggota dewan berhasil dihapus.' };
    }

    case 'getKategoriList':
      return { success: true, data: db.kategori, message: 'Kategori berhasil dimuat.' };

    case 'getKategoriWithDocCount': {
      const dewanId = payload.dewan_id ? String(payload.dewan_id) : null;
      const res = db.kategori.map((k) => {
        const count = db.dokumen.filter((d) => isKategoriMatching(k.id, d.kategori_id) && (!dewanId || String(d.dewan_id) === dewanId) && d.status === 'aktif').length;
        return { id: k.id, nama_kategori: k.nama_kategori, deskripsi: k.deskripsi || '', status: k.status || 'aktif', jumlah_dokumen: count };
      });
      return { success: true, data: res, message: 'Kategori berhasil dimuat.' };
    }

    case 'createKategori': {
      const data = payload.data || payload;
      const nama = String(data.nama_kategori || '').trim();
      if (!nama) return { success: false, message: 'Nama kategori wajib diisi.', error: { code: 'VALIDATION_ERROR' } };
      const duplicate = db.kategori.some((k) => k.nama_kategori.toLowerCase() === nama.toLowerCase());
      if (duplicate) return { success: false, message: 'Kategori dengan nama tersebut sudah ada.', error: { code: 'DUPLICATE_CATEGORY' } };
      const nextNum = db.kategori.reduce((max, k) => {
        const m = String(k.id).match(/\d+/);
        return m ? Math.max(max, parseInt(m[0], 10)) : max;
      }, 0) + 1;
      const newId = 'KAT-' + String(nextNum).padStart(2, '0');
      const item = { id: newId, nama_kategori: nama, deskripsi: data.deskripsi || '', status: 'aktif' };
      db.kategori.push(item);
      saveMockDb(db);
      return { success: true, data: item, message: 'Kategori berhasil ditambahkan.' };
    }

    case 'updateKategori': {
      const data = payload.data || payload;
      const id = String(data.id || '').trim();
      const target = db.kategori.find((k) => String(k.id) === id);
      if (!target) return { success: false, message: 'Kategori tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      const nama = String(data.nama_kategori || '').trim();
      if (nama && nama.toLowerCase() !== target.nama_kategori.toLowerCase()) {
        const duplicate = db.kategori.some((k) => String(k.id) !== id && k.nama_kategori.toLowerCase() === nama.toLowerCase());
        if (duplicate) return { success: false, message: 'Kategori dengan nama tersebut sudah ada.', error: { code: 'DUPLICATE_CATEGORY' } };
        target.nama_kategori = nama;
      }
      if (data.deskripsi !== undefined) target.deskripsi = String(data.deskripsi).trim();
      saveMockDb(db);
      return { success: true, data: target, message: 'Kategori berhasil diperbarui.' };
    }

    case 'toggleKategoriStatus': {
      const data = payload.data || payload;
      const id = String(data.id || '').trim();
      const target = db.kategori.find((k) => String(k.id) === id);
      if (target) {
        target.status = data.status || (target.status === 'aktif' ? 'nonaktif' : 'aktif');
        saveMockDb(db);
        return { success: true, data: target, message: 'Status kategori berhasil diubah.' };
      }
      return { success: false, message: 'Kategori tidak ditemukan.', error: { code: 'NOT_FOUND' } };
    }

    case 'deleteKategori': {
      const data = payload.data || payload;
      const id = String(data.id || '').trim();
      const target = db.kategori.find((k) => String(k.id) === id);
      if (!target) return { success: false, message: 'Kategori tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      const namaLow = target.nama_kategori.toLowerCase();
      if (namaLow.includes('reses') || namaLow.includes('pokir') || namaLow.includes('pokok')) {
        return { success: false, message: 'Kategori bawaan sistem (Hasil Reses / Pokir) tidak dapat dihapus.', error: { code: 'SYSTEM_CATEGORY_PROTECTED' } };
      }
      const hasDocs = db.dokumen.some((d) => isKategoriMatching(id, d.kategori_id) && d.status === 'aktif');
      if (hasDocs) {
        return { success: false, message: 'Kategori masih digunakan oleh dokumen arsip aktif. Silakan nonaktifkan kategori ini jika tidak ingin digunakan.', error: { code: 'HAS_DEPENDENT_RECORDS' } };
      }
      db.kategori = db.kategori.filter((k) => String(k.id) !== id);
      saveMockDb(db);
      return { success: true, message: 'Kategori berhasil dihapus.' };
    }

    case 'getTahunList': {
      const dewanId = String(payload.dewan_id);
      const katId = String(payload.kategori_id);
      const tahunSet = new Set();
      db.tahun.filter((t) => String(t.dewan_id) === dewanId && isKategoriMatching(katId, t.kategori_id)).forEach((t) => tahunSet.add(t.tahun));
      db.dokumen.filter((d) => String(d.dewan_id) === dewanId && isKategoriMatching(katId, d.kategori_id)).forEach((d) => tahunSet.add(d.tahun));
      const list = Array.from(tahunSet).map((yr) => {
        const count = db.dokumen.filter((d) => String(d.dewan_id) === dewanId && isKategoriMatching(katId, d.kategori_id) && parseInt(d.tahun, 10) === yr && d.status === 'aktif').length;
        return { tahun: yr, jumlah_dokumen: count };
      }).sort((a, b) => b.tahun - a.tahun);
      return { success: true, data: list, message: 'Daftar tahun berhasil dimuat.' };
    }

    case 'createTahun': {
      const rec = { id: 'THN-' + Date.now(), dewan_id: String(payload.dewan_id), kategori_id: String(payload.kategori_id), tahun: parseInt(payload.tahun, 10), status: 'aktif' };
      db.tahun.push(rec);
      saveMockDb(db);
      return { success: true, data: rec, message: 'Tahun berhasil ditambahkan.' };
    }

    case 'getFolderList': {
      const dewanId = String(payload.dewan_id);
      const katId = String(payload.kategori_id);
      const yr = parseInt(payload.tahun, 10);
      const folders = db.folder.filter((f) => String(f.dewan_id) === dewanId && isKategoriMatching(katId, f.kategori_id) && f.tahun === yr);
      const res = folders.map((f) => {
        const count = db.dokumen.filter((d) => String(d.dewan_id) === dewanId && isKategoriMatching(katId, d.kategori_id) && parseInt(d.tahun, 10) === yr && String(d.nama_folder).trim().toLowerCase() === String(f.nama_folder).trim().toLowerCase() && d.status === 'aktif').length;
        return { id: f.id, nama_folder: f.nama_folder, jumlah_dokumen: count };
      });
      return { success: true, data: res, message: 'Daftar folder berhasil dimuat.' };
    }

    case 'createFolder': {
      const dewanId = String(payload.dewan_id);
      const katId = String(payload.kategori_id);
      const yr = parseInt(payload.tahun, 10);
      const nama = String(payload.nama_folder || '').trim();
      if (!nama) return { success: false, message: 'Nama folder wajib diisi.', error: { code: 'VALIDATION_ERROR' } };

      const existing = db.folder.find(f => String(f.dewan_id) === dewanId && isKategoriMatching(katId, f.kategori_id) && f.tahun === yr && f.nama_folder.toLowerCase() === nama.toLowerCase());
      if (existing) {
        return { success: true, data: existing, message: 'Folder sudah ada.', already_existed: true };
      }

      const rec = { id: 'FLD-' + Date.now(), dewan_id: dewanId, kategori_id: katId, tahun: yr, nama_folder: nama, deskripsi: payload.deskripsi || '', status: 'aktif' };
      db.folder.push(rec);
      saveMockDb(db);
      return { success: true, data: rec, message: 'Folder berhasil ditambahkan.' };
    }

    case 'updateFolder': {
      const dewanId = String(payload.dewan_id);
      const katId = String(payload.kategori_id);
      const yr = parseInt(payload.tahun, 10);
      const folderLama = String(payload.folder_lama || payload.nama_folder_lama || '').trim();
      const folderBaru = String(payload.folder_baru || payload.nama_folder_baru || '').trim();
      if (!folderBaru) return { success: false, message: 'Nama folder baru wajib diisi.', error: { code: 'VALIDATION_ERROR' } };

      const target = db.folder.find(f => String(f.dewan_id) === dewanId && isKategoriMatching(katId, f.kategori_id) && f.tahun === yr && f.nama_folder.toLowerCase() === folderLama.toLowerCase());
      if (target) {
        target.nama_folder = folderBaru;
        if (payload.deskripsi) target.deskripsi = payload.deskripsi;
      }

      db.dokumen.forEach(d => {
        if (String(d.dewan_id) === dewanId && isKategoriMatching(katId, d.kategori_id) && parseInt(d.tahun, 10) === yr && String(d.nama_folder || '').toLowerCase() === folderLama.toLowerCase()) {
          d.nama_folder = folderBaru;
        }
      });
      saveMockDb(db);
      return { success: true, data: { nama_folder: folderBaru }, message: 'Folder berhasil diperbarui.' };
    }

    case 'deleteFolder': {
      const dewanId = String(payload.dewan_id);
      const katId = String(payload.kategori_id);
      const yr = parseInt(payload.tahun, 10);
      const namaFolder = String(payload.nama_folder || '').trim();

      const activeDocs = db.dokumen.filter(d =>
        String(d.dewan_id) === dewanId &&
        isKategoriMatching(katId, d.kategori_id) &&
        parseInt(d.tahun, 10) === yr &&
        String(d.nama_folder || '').trim().toLowerCase() === namaFolder.toLowerCase() &&
        d.status === 'aktif'
      );

      if (activeDocs.length > 0) {
        return {
          success: false,
          data: null,
          message: `Folder tidak dapat dihapus karena masih berisi ${activeDocs.length} berkas dokumen aktif. Hapus berkas dokumen di dalamnya terlebih dahulu.`,
          error: { code: 'HAS_DEPENDENT_RECORDS' }
        };
      }

      const idx = db.folder.findIndex(f =>
        String(f.dewan_id) === dewanId &&
        isKategoriMatching(katId, f.kategori_id) &&
        f.tahun === yr &&
        String(f.nama_folder || '').trim().toLowerCase() === namaFolder.toLowerCase()
      );

      if (idx !== -1) {
        db.folder.splice(idx, 1);
        saveMockDb(db);
      }
      return { success: true, data: { nama_folder: namaFolder }, message: 'Folder berhasil dihapus.' };
    }

    case 'getDokumenList': {
      const dewanId = payload.dewan_id ? String(payload.dewan_id) : null;
      const katId = payload.kategori_id ? String(payload.kategori_id) : null;
      const yr = payload.tahun ? parseInt(payload.tahun, 10) : null;
      const folder = payload.nama_folder ? String(payload.nama_folder).trim().toLowerCase() : null;

      if (dewanId && !isMockStaffAuthorizedForDewan(dewanId)) {
        return { success: false, data: [], message: 'Akses ditolak: Anda tidak memiliki akses ke arsip anggota dewan ini.', error: { code: 'FORBIDDEN' } };
      }

      let list = db.dokumen.filter((d) => d.status === 'aktif');
      if (dewanId) {
        list = list.filter((d) => String(d.dewan_id) === dewanId);
      } else if (currentUser.role === 'staff') {
        list = list.filter((d) => isMockStaffAuthorizedForDokumen(d));
      }

      if (katId) list = list.filter((d) => isKategoriMatching(katId, d.kategori_id));
      if (yr) list = list.filter((d) => parseInt(d.tahun, 10) === yr);
      if (folder) list = list.filter((d) => String(d.nama_folder || '').trim().toLowerCase() === folder);
      return { success: true, data: list, message: 'Daftar dokumen berhasil dimuat.' };
    }

    case 'getDokumenById': {
      const id = String(payload.id);
      const doc = db.dokumen.find((d) => String(d.id) === id);
      if (!doc) return { success: false, message: 'Dokumen tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      if (!isMockStaffAuthorizedForDokumen(doc)) {
        return { success: false, message: 'Akses ditolak: Anda tidak memiliki akses ke dokumen ini.', error: { code: 'FORBIDDEN' } };
      }
      return { success: true, data: doc };
    }

    case 'uploadDokumen': {
      const data = payload.data || payload;
      const dewanId = String(data.dewan_id);
      const katId = String(data.kategori_id);
      const dewanExists = db.dewan.some((x) => String(x.id) === dewanId);
      const katExists = db.kategori.some((x) => String(x.id) === katId);
      if (!dewanExists || !katExists) {
        return { success: false, message: 'ID Dewan atau Kategori tidak valid.', error: { code: 'VALIDATION_ERROR' } };
      }

      if (!isMockStaffAuthorizedForDewan(dewanId)) {
        return { success: false, message: 'Akses ditolak: Anda tidak diizinkan mengunggah arsip untuk dewan ini.', error: { code: 'FORBIDDEN' } };
      }

      // Validasi berkas
      const fileName = String(data.fileName || data.nama_file || 'dokumen.pdf').trim();
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      const allowedExts = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.jpg', '.jpeg', '.png'];
      if (!allowedExts.includes(ext)) {
        return { success: false, message: 'Ekstensi berkas tidak diizinkan.', error: { code: 'FILE_VALIDATION_ERROR' } };
      }

      const yr = parseInt(data.tahun, 10);
      const folder = String(data.nama_folder || '').trim();
      const namaDokumen = String(data.nama_dokumen || data.judul || '').trim();

      // Idempotency: deteksi duplikasi double-click dokumen identik
      const existing = db.dokumen.find(d =>
        String(d.dewan_id) === dewanId &&
        String(d.kategori_id) === katId &&
        parseInt(d.tahun, 10) === yr &&
        String(d.nama_folder || '').toLowerCase() === folder.toLowerCase() &&
        String(d.nama_dokumen || '').toLowerCase() === namaDokumen.toLowerCase() &&
        String(d.nama_file || '').toLowerCase() === fileName.toLowerCase() &&
        d.status === 'aktif'
      );
      if (existing) {
        return { success: true, data: existing, message: 'Dokumen berhasil diunggah.', already_existed: true };
      }

      const newId = 'DOC-' + Date.now();
      const doc = {
        id: newId,
        dewan_id: dewanId,
        kategori_id: katId,
        tahun: yr,
        nama_folder: folder,
        nama_dokumen: namaDokumen,
        keterangan: String(data.keterangan || '').trim(),
        nama_file: fileName,
        file_id: 'mock-file-' + newId,
        direct_url: '#',
        view_url: '#',
        ukuran_file: 350000,
        status: 'aktif',
        uploaded_by: currentUser.username,
        tanggal_upload: new Date().toISOString()
      };
      db.dokumen.push(doc);
      saveMockDb(db);
      return { success: true, data: doc, message: 'Dokumen berhasil diunggah.' };
    }

    case 'downloadDokumen': {
      const id = String(payload.id);
      const doc = db.dokumen.find((d) => String(d.id) === id);
      if (!doc) return { success: false, message: 'Dokumen tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      if (!isMockStaffAuthorizedForDokumen(doc)) {
        return { success: false, message: 'Akses ditolak: Anda tidak memiliki izin untuk mengunduh dokumen ini.', error: { code: 'FORBIDDEN' } };
      }
      return {
        success: true,
        data: {
          id: doc.id,
          nama_dokumen: doc.nama_dokumen,
          nama_file: doc.nama_file,
          mime_type: 'application/pdf',
          ukuran_file: doc.ukuran_file,
          base64: 'JVBERi0xLjQKJcTl8uXr...'
        },
        message: 'Berkas siap diunduh.'
      };
    }

    case 'updateDokumen': {
      const d = payload.data || payload;
      const id = String(d.id);
      const doc = db.dokumen.find((x) => String(x.id) === id);
      if (!doc) return { success: false, message: 'Dokumen tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      if (!isMockStaffAuthorizedForDokumen(doc)) {
        return { success: false, message: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah dokumen ini.', error: { code: 'FORBIDDEN' } };
      }
      if (d.nama_dokumen) doc.nama_dokumen = String(d.nama_dokumen).trim();
      if (d.keterangan !== undefined) doc.keterangan = String(d.keterangan).trim();
      saveMockDb(db);
      return { success: true, data: doc, message: 'Dokumen berhasil diperbarui.' };
    }

    case 'deleteDokumen': {
      const id = String(payload.id);
      const doc = db.dokumen.find((d) => String(d.id) === id);
      if (!doc) return { success: false, message: 'Dokumen tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      if (!isMockStaffAuthorizedForDokumen(doc)) {
        return { success: false, message: 'Akses ditolak: Anda tidak memiliki izin untuk menghapus dokumen ini.', error: { code: 'FORBIDDEN' } };
      }
      db.dokumen = db.dokumen.filter((d) => String(d.id) !== id);
      saveMockDb(db);
      return { success: true, message: 'Dokumen berhasil dihapus.' };
    }

    case 'getKomisiList': {
      if (currentUser.role !== 'superadmin') {
        return { success: false, message: 'Akses ditolak: Hanya Superadmin yang berhak mengakses daftar komisi.', error: { code: 'FORBIDDEN' } };
      }
      if (!Array.isArray(db.komisi) || db.komisi.length === 0) {
        db.komisi = [
          { id: 'KOM-1', kode: 'komisi_1', nama: 'Komisi 1', bidang: 'Bidang Pemerintahan, Hukum, dan Ketertiban', deskripsi: 'Membidangi urusan pemerintahan umum, hukum, perizinan, aparatur, dan ketertiban masyarakat.', kategori_folder: 'RDP', status: 'aktif' },
          { id: 'KOM-2', kode: 'komisi_2', nama: 'Komisi 2', bidang: 'Bidang Ekonomi, Keuangan, dan Pembangunan', deskripsi: 'Membidangi urusan keuangan daerah, perpajakan, perindustrian, perdagangan, dan pembangunan infrastruktur.', kategori_folder: 'RDP', status: 'aktif' },
          { id: 'KOM-3', kode: 'komisi_3', nama: 'Komisi 3', bidang: 'Bidang Kesejahteraan Rakyat dan Pendidikan', deskripsi: 'Membidangi urusan pendidikan, kesehatan, sosial, ketenagakerjaan, kepemudaan, dan kesejahteraan rakyat.', kategori_folder: 'RDP', status: 'aktif' }
        ];
        saveMockDb(db);
      }
      const activeKomisi = db.komisi.filter((k) => (k.status || 'aktif') === 'aktif');
      return { success: true, data: activeKomisi, message: 'Daftar komisi berhasil dimuat.' };
    }

    case 'createKomisi': {
      if (currentUser.role !== 'superadmin') {
        return { success: false, message: 'Akses ditolak: Hanya Superadmin yang dapat menambah komisi.', error: { code: 'FORBIDDEN' } };
      }

      const data = payload.data || payload;
      const nama = String(data.nama || data.nama_komisi || '').trim();
      const bidang = String(data.bidang || '').trim();
      const deskripsi = String(data.deskripsi || '').trim();
      const kategoriFolder = String(data.kategori_folder || 'RDP').trim().toUpperCase();

      if (!nama || !bidang) {
        return { success: false, message: 'Nama komisi dan bidang komisi wajib diisi.', error: { code: 'VALIDATION_ERROR' } };
      }

      if (!Array.isArray(db.komisi) || db.komisi.length === 0) {
        db.komisi = [
          { id: 'KOM-1', kode: 'komisi_1', nama: 'Komisi 1', bidang: 'Bidang Pemerintahan, Hukum, dan Ketertiban', deskripsi: 'Membidangi urusan pemerintahan umum, hukum, perizinan, aparatur, dan ketertiban masyarakat.', kategori_folder: 'RDP', status: 'aktif' },
          { id: 'KOM-2', kode: 'komisi_2', nama: 'Komisi 2', bidang: 'Bidang Ekonomi, Keuangan, dan Pembangunan', deskripsi: 'Membidangi urusan keuangan daerah, perpajakan, perindustrian, perdagangan, dan pembangunan infrastruktur.', kategori_folder: 'RDP', status: 'aktif' },
          { id: 'KOM-3', kode: 'komisi_3', nama: 'Komisi 3', bidang: 'Bidang Kesejahteraan Rakyat dan Pendidikan', deskripsi: 'Membidangi urusan pendidikan, kesehatan, sosial, ketenagakerjaan, kepemudaan, dan kesejahteraan rakyat.', kategori_folder: 'RDP', status: 'aktif' }
        ];
      }

      const isDup = db.komisi.some((k) => (k.status || 'aktif') === 'aktif' && k.nama.toLowerCase() === nama.toLowerCase());
      if (isDup) {
        return { success: false, message: `Komisi dengan nama "${nama}" sudah terdaftar.`, error: { code: 'DUPLICATE_ENTRY' } };
      }

      let newId = 'KOM-' + Date.now();
      const numMatch = nama.match(/komisi\s*(\d+)/i);
      if (numMatch && numMatch[1]) {
        const candidateId = 'KOM-' + numMatch[1];
        if (!db.komisi.some((k) => k.id === candidateId)) {
          newId = candidateId;
        }
      }

      const newKomisi = {
        id: newId,
        kode: nama.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        nama,
        bidang,
        deskripsi,
        kategori_folder: kategoriFolder,
        status: 'aktif',
        created_at: new Date().toISOString()
      };

      db.komisi.push(newKomisi);
      saveMockDb(db);
      return { success: true, data: newKomisi, message: 'Komisi berhasil ditambahkan.' };
    }

    case 'deleteKomisi': {
      if (currentUser.role !== 'superadmin') {
        return { success: false, message: 'Akses ditolak: Hanya Superadmin yang dapat menghapus komisi.', error: { code: 'FORBIDDEN' } };
      }

      const id = String(payload.id || '').trim();
      if (!id) {
        return { success: false, message: 'ID Komisi wajib disertakan.', error: { code: 'VALIDATION_ERROR' } };
      }

      if (!Array.isArray(db.komisi) || db.komisi.length === 0) {
        db.komisi = [
          { id: 'KOM-1', kode: 'komisi_1', nama: 'Komisi 1', bidang: 'Bidang Pemerintahan, Hukum, dan Ketertiban', deskripsi: 'Membidangi urusan pemerintahan umum, hukum, perizinan, aparatur, dan ketertiban masyarakat.', kategori_folder: 'RDP', status: 'aktif' },
          { id: 'KOM-2', kode: 'komisi_2', nama: 'Komisi 2', bidang: 'Bidang Ekonomi, Keuangan, dan Pembangunan', deskripsi: 'Membidangi urusan keuangan daerah, perpajakan, perindustrian, perdagangan, dan pembangunan infrastruktur.', kategori_folder: 'RDP', status: 'aktif' },
          { id: 'KOM-3', kode: 'komisi_3', nama: 'Komisi 3', bidang: 'Bidang Kesejahteraan Rakyat dan Pendidikan', deskripsi: 'Membidangi urusan pendidikan, kesehatan, sosial, ketenagakerjaan, kepemudaan, dan kesejahteraan rakyat.', kategori_folder: 'RDP', status: 'aktif' }
        ];
      }

      const target = db.komisi.find((k) => String(k.id) === id);
      if (!target || target.status === 'dihapus') {
        return { success: false, message: 'Komisi tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      }

      const activeDocs = (db.dokumen || []).filter((d) => String(d.dewan_id) === id && d.status === 'aktif');
      if (activeDocs.length > 0) {
        return {
          success: false,
          message: `Gagal menghapus: Komisi masih memiliki ${activeDocs.length} dokumen arsip RDP aktif. Dokumen terlindungi dari penghapusan.`,
          error: { code: 'HAS_DEPENDENT_RECORDS' }
        };
      }

      db.komisi = db.komisi.filter((k) => String(k.id) !== id);
      saveMockDb(db);
      return { success: true, message: 'Komisi berhasil dihapus.' };
    }

    case 'getRdpDokumenList': {
      if (currentUser.role !== 'superadmin') {
        return { success: false, message: 'Akses ditolak: Hanya Superadmin yang berhak mengakses arsip RDP.', error: { code: 'FORBIDDEN' } };
      }
      const komisiId = String(payload.komisi_id || payload.komisiId || '').trim();
      const tahunFilter = payload.tahun ? String(payload.tahun).trim() : '';

      const validKomisi = (db.komisi || []).filter(k => (k.status || 'aktif') === 'aktif').map(k => String(k.id));
      if (!validKomisi.includes(komisiId) && !['KOM-1', 'KOM-2', 'KOM-3'].includes(komisiId)) {
        return { success: false, message: 'ID Komisi tidak valid.', error: { code: 'VALIDATION_ERROR' } };
      }

      const allRdp = (db.dokumen || []).filter((d) =>
        String(d.dewan_id) === komisiId &&
        d.status === 'aktif' &&
        (String(d.kategori_id).toUpperCase() === 'RDP' || String(d.nama_folder).toUpperCase() === 'RDP')
      );

      const yearSet = new Set();
      allRdp.forEach((d) => {
        if (d.tahun) yearSet.add(parseInt(d.tahun, 10));
      });
      const availableYears = Array.from(yearSet).sort((a, b) => b - a);

      let filtered = allRdp;
      if (tahunFilter && tahunFilter !== 'semua' && tahunFilter !== 'ALL') {
        const yrInt = parseInt(tahunFilter, 10);
        filtered = filtered.filter((d) => parseInt(d.tahun, 10) === yrInt);
      }

      filtered.sort((a, b) => new Date(b.tanggal_upload || 0) - new Date(a.tanggal_upload || 0));

      return {
        success: true,
        data: {
          komisi_id: komisiId,
          available_years: availableYears,
          dokumen: filtered
        },
        message: 'Daftar dokumen RDP berhasil dimuat.'
      };
    }

    case 'uploadRdpDokumen': {
      if (currentUser.role !== 'superadmin') {
        return { success: false, message: 'Akses ditolak: Hanya Superadmin yang dapat mengunggah arsip RDP.', error: { code: 'FORBIDDEN' } };
      }
      const data = payload.data || payload;
      const komisiId = String(data.komisi_id || '').trim();
      const validKomisi = (db.komisi || []).filter(k => (k.status || 'aktif') === 'aktif').map(k => String(k.id));
      if (!validKomisi.includes(komisiId) && !['KOM-1', 'KOM-2', 'KOM-3'].includes(komisiId)) {
        return { success: false, message: 'ID Komisi tidak valid.', error: { code: 'VALIDATION_ERROR' } };
      }

      const yr = parseInt(data.tahun, 10);
      if (!yr || isNaN(yr) || yr < 2000 || yr > 2100) {
        return { success: false, message: 'Tahun dokumen RDP tidak valid.', error: { code: 'VALIDATION_ERROR' } };
      }

      const namaDokumen = String(data.nama_dokumen || data.judul || '').trim();
      if (!namaDokumen) {
        return { success: false, message: 'Nama/judul dokumen RDP wajib diisi.', error: { code: 'VALIDATION_ERROR' } };
      }

      const hasExplicitFileProp = Object.prototype.hasOwnProperty.call(data, 'base64') || Object.prototype.hasOwnProperty.call(data, 'fileData');
      const base64Data = data.base64 || data.fileData;
      if (hasExplicitFileProp && !base64Data) {
        return { success: false, message: 'Tahun, judul dokumen, dan berkas fisik wajib diisi.', error: { code: 'VALIDATION_ERROR' } };
      }
      if (!data.fileName && !data.nama_file && !base64Data) {
        return { success: false, message: 'Tahun, judul dokumen, dan berkas fisik wajib diisi.', error: { code: 'VALIDATION_ERROR' } };
      }

      const fileName = String(data.fileName || data.nama_file || 'rdp.pdf').trim();
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      const allowedExts = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.jpg', '.jpeg', '.png'];
      if (!allowedExts.includes(ext)) {
        return { success: false, message: 'Ekstensi berkas tidak diizinkan.', error: { code: 'FILE_VALIDATION_ERROR' } };
      }

      // Idempotensi: deteksi duplikasi dokumen RDP aktif
      const existingDoc = db.dokumen.find((d) =>
        String(d.dewan_id || '').trim() === komisiId &&
        parseInt(d.tahun, 10) === yr &&
        String(d.nama_folder || '').trim().toUpperCase() === 'RDP' &&
        String(d.nama_dokumen || '').trim().toLowerCase() === namaDokumen.toLowerCase() &&
        String(d.status || '').toLowerCase() === 'aktif'
      );
      if (existingDoc) {
        return { success: true, data: existingDoc, message: 'Dokumen RDP berhasil diunggah.' };
      }

      const newId = 'DOC-RDP-' + Date.now();
      const doc = {
        id: newId,
        dewan_id: komisiId,
        kategori_id: 'RDP',
        tahun: yr,
        nama_folder: 'RDP',
        nama_dokumen: namaDokumen,
        keterangan: String(data.keterangan || '').trim(),
        nama_file: fileName,
        file_id: 'mock-file-' + newId,
        direct_url: '#',
        view_url: '#',
        ukuran_file: 420000,
        status: 'aktif',
        uploaded_by: currentUser.username,
        tanggal_upload: new Date().toISOString()
      };
      db.dokumen.push(doc);
      saveMockDb(db);
      return { success: true, data: doc, message: 'Dokumen RDP berhasil diunggah.' };
    }

    case 'updateRdpDokumen': {
      if (currentUser.role !== 'superadmin') {
        return { success: false, message: 'Akses ditolak: Hanya Superadmin yang berhak mengubah dokumen RDP.', error: { code: 'FORBIDDEN' } };
      }
      const data = payload.data || payload;
      const id = String(data.id || '').trim();
      const namaDokumen = String(data.nama_dokumen || data.judul || '').trim();
      const yr = parseInt(data.tahun, 10);
      const keterangan = String(data.keterangan || '').trim();

      if (!id || !namaDokumen || !yr) {
        return { success: false, message: 'ID, judul, dan tahun wajib diisi.', error: { code: 'VALIDATION_ERROR' } };
      }

      const doc = (db.dokumen || []).find((d) => String(d.id) === id && String(d.dewan_id).startsWith('KOM-'));
      if (!doc) {
        return { success: false, message: 'Dokumen RDP tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      }

      doc.nama_dokumen = namaDokumen;
      doc.tahun = yr;
      doc.keterangan = keterangan;
      doc.updated_at = new Date().toISOString();
      saveMockDb(db);
      return { success: true, data: doc, message: 'Metadata dokumen RDP berhasil diperbarui.' };
    }

    case 'deleteRdpDokumen': {
      if (currentUser.role !== 'superadmin') {
        return { success: false, message: 'Akses ditolak: Hanya Superadmin yang berhak menghapus dokumen RDP.', error: { code: 'FORBIDDEN' } };
      }
      const id = String(payload.id);
      const doc = (db.dokumen || []).find((d) => String(d.id) === id && String(d.dewan_id).startsWith('KOM-'));
      if (!doc) {
        return { success: false, message: 'Dokumen RDP tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      }
      db.dokumen = db.dokumen.filter((d) => String(d.id) !== id);
      saveMockDb(db);
      return { success: true, message: 'Dokumen RDP berhasil dihapus.' };
    }

    case 'getLaporanList': {
      const st = String(payload.status || '').trim().toLowerCase();
      const kec = String(payload.kecamatan || '').trim().toLowerCase();
      const q = String(payload.cari || payload.q || '').trim().toLowerCase();

      let list = (db.laporan || []).slice();
      if (currentUser.role === 'staff') {
        const staffName = String(currentUser.nama || '').trim().toLowerCase();
        const staffUsername = String(currentUser.username || '').trim().toLowerCase();
        const staffId = String(currentUser.id || '').trim().toLowerCase();
        list = list.filter((l) => {
          const assigned = String(l.assigned_to || '').toLowerCase().trim();
          const assignedId = String(l.assigned_staff_id || '').toLowerCase().trim();
          const assignedName = String(l.assigned_staff_name || '').toLowerCase().trim();
          return (
            (assigned && (assigned === staffUsername || assigned === staffName || assigned === staffId || (staffName && assigned.includes(staffName)))) ||
            (assignedId && assignedId === staffId) ||
            (assignedName && (assignedName === staffName || (staffName && assignedName.includes(staffName))))
          );
        });
      }

      if (st) {
        list = list.filter((l) => String(l.status || '').toLowerCase() === st);
      }
      if (kec) {
        list = list.filter((l) => String(l.kecamatan || '').toLowerCase().includes(kec));
      }
      if (q) {
        list = list.filter((l) =>
          String(l.nomor_tiket || '').toLowerCase().includes(q) ||
          String(l.nama_pelapor || '').toLowerCase().includes(q) ||
          String(l.judul || '').toLowerCase().includes(q) ||
          String(l.isi || '').toLowerCase().includes(q)
        );
      }

      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      return { success: true, data: list, message: 'Daftar laporan masyarakat berhasil dimuat.' };
    }

    case 'assignLaporan': {
      const id = String(payload.id);
      const target = (db.laporan || []).find((l) => String(l.id) === id || String(l.nomor_tiket) === id);
      if (!target) {
        return { success: false, message: 'Laporan tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      }
      const assignedVal = payload.staff_nama || payload.assigned_to || payload.staff_id || '';
      target.assigned_to = assignedVal;
      target.assigned_staff_id = payload.staff_id || '';
      target.assigned_staff_name = payload.staff_nama || '';
      target.status = 'diproses';
      target.updated_at = new Date().toISOString();
      saveMockDb(db);
      return { success: true, data: target, message: 'Laporan berhasil ditugaskan kepada staf.' };
    }

    case 'updateLaporanStatus': {
      const id = String(payload.id);
      const target = (db.laporan || []).find((l) => String(l.id) === id || String(l.nomor_tiket) === id);
      if (!target) {
        return { success: false, message: 'Laporan tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      }

      if (currentUser.role === 'staff') {
        const staffName = String(currentUser.nama || '').trim().toLowerCase();
        const staffUsername = String(currentUser.username || '').trim().toLowerCase();
        const staffId = String(currentUser.id || '').trim().toLowerCase();
        const assigned = String(target.assigned_to || '').trim().toLowerCase();
        const assignedId = String(target.assigned_staff_id || '').trim().toLowerCase();
        const assignedName = String(target.assigned_staff_name || '').trim().toLowerCase();
        const isMatched = (
          (assigned && (assigned === staffName || assigned === staffUsername || assigned === staffId || (staffName && assigned.includes(staffName)))) ||
          (assignedId && (assignedId === staffId || assignedId === staffUsername)) ||
          (assignedName && (assignedName === staffName || (staffName && assignedName.includes(staffName))))
        );
        if (!isMatched) {
          return { success: false, message: 'Akses ditolak: Laporan ini bukan penugasan Anda.', error: { code: 'FORBIDDEN' } };
        }
      }

      if (payload.status) target.status = payload.status;
      if (payload.tanggapan !== undefined) target.tanggapan = payload.tanggapan;
      target.updated_at = new Date().toISOString();
      saveMockDb(db);
      return { success: true, data: target, message: 'Status laporan berhasil diperbarui.' };
    }

    case 'downloadLaporanLampiran': {
      const id = String(payload.id || payload.nomor_tiket || '');
      const target = (db.laporan || []).find((l) => String(l.id) === id || String(l.nomor_tiket) === id);
      if (!target) {
        return { success: false, message: 'Laporan tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      }
      if (!target.lampiran_base64 && !target.lampiran_file_id && !target.lampiran_url && !target.lampiran) {
        return { success: false, message: 'Laporan ini tidak memiliki berkas lampiran.', error: { code: 'NO_ATTACHMENT' } };
      }
      const dummyBase64 = 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCA2OAo+PgpzdHJlYW0KeJwrSExPTcxLzNFLzs8rSc0r0Y/m0vLiAgAJFgbLCmVuZHN0cmVhbQplbmRvYmoK';
      return {
        success: true,
        data: {
          base64: target.lampiran_base64 || dummyBase64,
          fileName: target.lampiran_nama || target.lampiran || 'lampiran.pdf',
          fileType: target.lampiran_tipe || 'application/pdf',
          url: target.lampiran_url || ''
        },
        message: 'Lampiran laporan berhasil diunduh.'
      };
    }

    case 'deleteLaporan': {
      if (currentUser.role !== 'superadmin') {
        return { success: false, message: 'Akses ditolak: Hanya Superadmin yang berwenang menghapus laporan masyarakat.', error: { code: 'FORBIDDEN' } };
      }
      const id = String(payload.id || payload.nomor_tiket || '');
      const idx = (db.laporan || []).findIndex((l) => String(l.id) === id || String(l.nomor_tiket) === id);
      if (idx === -1) {
        return { success: false, message: 'Laporan tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      }
      const deleted = db.laporan[idx];
      db.laporan.splice(idx, 1);

      db.logs.push({
        id: 'LOG-' + Date.now(),
        waktu: new Date().toISOString(),
        user_id: currentUser.id,
        username: currentUser.username,
        role: currentUser.role,
        aksi: 'HAPUS_LAPORAN',
        detail: `Menghapus laporan nomor tiket ${deleted.nomor_tiket} (${deleted.judul})`,
        ip: '-'
      });

      saveMockDb(db);
      return { success: true, data: { nomor_tiket: deleted.nomor_tiket }, message: `Laporan ${deleted.nomor_tiket} berhasil dihapus.` };
    }

    case 'approvePokirException': {
      if (currentUser.role !== 'superadmin') {
        return { success: false, message: 'Akses ditolak: Hanya Superadmin yang berwenang memberikan pengecualian pokir.', error: { code: 'FORBIDDEN' } };
      }
      const ticket = String(payload.nomor_tiket || payload.id || '');
      const target = (db.laporan || []).find((l) => String(l.nomor_tiket) === ticket || String(l.id) === ticket);
      if (!target) {
        return { success: false, message: 'Usulan Pokir tidak ditemukan.', error: { code: 'NOT_FOUND' } };
      }

      target.status_duplikasi = 'pengecualian_disetujui';
      target.catatan_verifikasi = payload.catatan || 'Pengecualian disetujui resmi oleh Superadmin.';
      target.verified_by = currentUser.username;
      target.verified_at = new Date().toISOString();

      db.logs.push({
        id: 'LOG-' + Date.now(),
        waktu: new Date().toISOString(),
        user_id: currentUser.id,
        username: currentUser.username,
        role: currentUser.role,
        aksi: 'PENGECUALIAN_POKIR',
        detail: `Menyetujui pengecualian usulan Pokir nomor tiket ${target.nomor_tiket}. Catatan: ${payload.catatan || '-'}`,
        ip: '-'
      });

      saveMockDb(db);
      return { success: true, data: target, message: 'Pengecualian usulan Pokir berhasil disetujui.' };
    }

    case 'getUserList': {
      const safeList = db.users.map((u) => {
        const uName = String(u.nama || '').trim().toLowerCase();
        const uUser = String(u.username || '').trim().toLowerCase();
        const assigned = (db.dewan || []).filter((d) => {
          const pend = String(d.nama_pendamping || '').trim().toLowerCase();
          return pend && (pend === uUser || pend === uName || (uName && pend.includes(uName)));
        }).map((d) => ({ id: d.id, nama: d.nama, jabatan: d.jabatan, partai: d.partai }));

        return {
          id: u.id,
          username: u.username,
          nama: u.nama,
          role: u.role || 'staff',
          status: u.status || 'aktif',
          assigned_dewan: assigned,
          must_change_password: !!u.must_change_password,
          created_at: u.created_at || new Date().toISOString(),
          last_login: u.last_login || null
        };
      });
      return { success: true, data: safeList, message: 'Daftar pengguna dimuat.' };
    }

    case 'createUser': {
      const data = payload.data || payload;
      const username = String(data.username || '').trim().toLowerCase();
      const nama = String(data.nama || '').trim();
      const password = String(data.password || '').trim();
      const role = String(data.role || 'staff').toLowerCase();
      const assignedDewan = data.assigned_dewan || [];

      if (!username || !nama || !password) {
        return { success: false, message: 'Semua kolom wajib diisi.', error: { code: 'VALIDATION_ERROR' } };
      }

      const exists = db.users.some((u) => u.username.toLowerCase() === username);
      if (exists) {
        return { success: false, message: 'Username sudah digunakan oleh akun lain.', error: { code: 'DUPLICATE_USERNAME' } };
      }

      const newU = {
        id: 'USR-' + Date.now(),
        username,
        nama,
        password,
        role,
        status: 'aktif',
        must_change_password: true,
        created_at: new Date().toISOString()
      };
      db.users.push(newU);

      if (Array.isArray(assignedDewan) && assignedDewan.length > 0) {
        (db.dewan || []).forEach((d) => {
          if (assignedDewan.includes(d.id)) {
            d.nama_pendamping = nama;
          }
        });
      }

      saveMockDb(db);
      return { success: true, data: newU, message: 'Pengguna berhasil dibuat.' };
    }

    case 'updateUser': {
      const data = payload.data || payload;
      const id = String(data.id || payload.id || '').trim();
      const target = db.users.find((u) => u.id === id);
      if (!target) return { success: false, message: 'Pengguna tidak ditemukan.', error: { code: 'NOT_FOUND' } };

      const status = data.status || target.status;
      if (target.role === 'superadmin' && status === 'nonaktif') {
        const activeSupers = db.users.filter((u) => u.role === 'superadmin' && u.status === 'aktif');
        if (activeSupers.length <= 1) {
          return { success: false, message: 'Gagal: Tidak dapat menonaktifkan satu-satunya Superadmin aktif.', error: { code: 'PROTECTED_USER' } };
        }
      }

      const oldStaffName = String(target.nama || '').toLowerCase();
      const newStaffName = data.nama || target.nama;

      if (data.nama) target.nama = data.nama;
      if (data.status) target.status = data.status;

      if (Array.isArray(data.assigned_dewan)) {
        (db.dewan || []).forEach((d) => {
          const currentPend = String(d.nama_pendamping || '').toLowerCase();
          if (data.assigned_dewan.includes(d.id)) {
            d.nama_pendamping = newStaffName;
          } else if (currentPend && (currentPend === oldStaffName || currentPend === target.username.toLowerCase())) {
            d.nama_pendamping = '';
          }
        });
      }

      saveMockDb(db);
      return { success: true, data: target, message: 'Data pengguna berhasil diperbarui.' };
    }

    case 'toggleUserStatus': {
      const target = db.users.find((u) => u.id === payload.id);
      if (!target) return { success: false, message: 'Pengguna tidak ditemukan.', error: { code: 'NOT_FOUND' } };

      if (target.role === 'superadmin' && payload.status === 'nonaktif') {
        const activeSupers = db.users.filter((u) => u.role === 'superadmin' && u.status === 'aktif');
        if (activeSupers.length <= 1) {
          return { success: false, message: 'Gagal: Tidak dapat menonaktifkan satu-satunya Superadmin aktif.', error: { code: 'PROTECTED_USER' } };
        }
      }

      target.status = payload.status;
      if (payload.status === 'aktif') {
        const cleanU = String(target.username || '').toLowerCase();
        if (db.failedAttempts) delete db.failedAttempts[cleanU];
        if (db.lockouts) delete db.lockouts[cleanU];
      }
      saveMockDb(db);
      // Jika akun dinonaktifkan, cabut sesi
      if (payload.status === 'nonaktif' && currentUser.id === payload.id) {
        safeSessionStorage.removeItem('dprd_token');
        safeSessionStorage.removeItem('dprd_user');
      }
      return { success: true, message: 'Status pengguna diubah.' };
    }

    case 'deleteUser': {
      const id = String(payload.id || '').trim();
      const target = db.users.find((u) => u.id === id);
      if (!target) return { success: false, message: 'Pengguna tidak ditemukan.', error: { code: 'NOT_FOUND' } };

      if (target.role === 'superadmin') {
        const activeSupers = db.users.filter((u) => u.role === 'superadmin' && u.status === 'aktif');
        if (activeSupers.length <= 1) {
          return { success: false, message: 'Gagal: Tidak dapat menghapus satu-satunya Superadmin aktif.', error: { code: 'PROTECTED_USER' } };
        }
      }

      const hasDocs = (db.dokumen || []).some((d) => String(d.uploaded_by || '').toLowerCase() === target.username.toLowerCase());
      if (hasDocs) {
        return { success: false, message: 'Pengguna tidak dapat dihapus karena memiliki riwayat arsip dokumen. Anda disarankan menonaktifkan akun pengguna demi audit keaslian berkas.', error: { code: 'HAS_DEPENDENT_RECORDS' } };
      }

      const staffName = String(target.nama || '').toLowerCase();
      const staffUser = String(target.username || '').toLowerCase();
      (db.dewan || []).forEach((d) => {
        const pend = String(d.nama_pendamping || '').toLowerCase();
        if (pend && (pend === staffName || pend === staffUser)) {
          d.nama_pendamping = '';
        }
      });

      db.users = db.users.filter((u) => u.id !== id);
      saveMockDb(db);
      return { success: true, message: 'Akun staf berhasil dihapus.' };
    }

    case 'resetUserPassword': {
      const target = db.users.find((u) => u.id === payload.id);
      if (target) {
        target.password = payload.newPassword;
        target.must_change_password = true;
        const cleanU = String(target.username || '').toLowerCase();
        if (db.failedAttempts) delete db.failedAttempts[cleanU];
        if (db.lockouts) delete db.lockouts[cleanU];
        saveMockDb(db);
        // Cabut sesi aktif pengguna yang direset
        if (currentUser.id === payload.id) {
          safeSessionStorage.removeItem('dprd_token');
          safeSessionStorage.removeItem('dprd_user');
        }
        return { success: true, message: 'Password berhasil direset dan kunci akun dipulihkan.' };
      }
      return { success: false, message: 'Pengguna tidak ditemukan.' };
    }

    case 'unlockUser': {
      const targetUser = String(payload.username || '').trim().toLowerCase();
      if (!targetUser) {
        return { success: false, data: null, message: 'Username target wajib disertakan.', error: { code: 'VALIDATION_ERROR' } };
      }
      if (db.failedAttempts) delete db.failedAttempts[targetUser];
      if (db.lockouts) delete db.lockouts[targetUser];
      saveMockDb(db);
      return { success: true, data: { username: targetUser }, message: `Kunci akun ${targetUser} berhasil dibuka.` };
    }

    case 'clearActivityLog': {
      db.logs = [{
        id: 'LOG-' + Date.now(),
        waktu: new Date().toISOString(),
        user_id: currentUser.id,
        username: currentUser.username,
        role: 'superadmin',
        aksi: 'BERSIHKAN_LOG',
        detail: 'Seluruh riwayat aktivitas log sistem telah dibersihkan',
        ip: '-'
      }];
      saveMockDb(db);
      clearApiCache("getActivityLog");
      return { success: true, data: { cleared: true }, message: 'Seluruh riwayat aktivitas log berhasil dibersihkan.' };
    }

    case 'getActivityLog':
      return { success: true, data: db.logs, message: 'Log aktivitas dimuat.' };

    default:
      return { success: false, message: 'Aksi mock tidak dikenali: ' + action, error: { code: 'NOT_FOUND' } };
  }
}

// ======================= PUBLIC API EXPORTS =======================

export const api = {
  // Auth & Profil
  login: (username, password) => callAppsScript('adminLogin', { username, password }),
  logout: () => callAppsScript('adminLogout'),
  checkSession: (forceRefresh = false) => callAppsScript('getCurrentUser', {}, { forceRefresh }),
  getProfile: () => callAppsScript('getProfile'),
  updateProfile: (data) => callAppsScript('updateProfile', { data }),
  changePassword: (oldPassword, newPassword) => callAppsScript('changePassword', { oldPassword, newPassword }),

  // Dashboard
  getDashboardData: () => callAppsScript('getDashboardData'),

  // Dewan (Anggota DPRD)
  getDewanList: (cari = '', status = '', options = {}) => {
    if (activeSearchController && !options.signal) {
      activeSearchController.abort();
    }
    if (!options.signal) {
      activeSearchController = new AbortController();
      options.signal = activeSearchController.signal;
    }
    return callAppsScript('getDewanList', { cari, status }, options);
  },
  getDewanById: (id) => callAppsScript('getDewanById', { id }),
  createDewan: (data) => callAppsScript('createDewan', { data }),
  updateDewan: (data) => callAppsScript('updateDewan', { data }),
  toggleDewanStatus: (id, status) => callAppsScript('toggleDewanStatus', { id, status }),
  deleteDewan: (id) => callAppsScript('deleteDewan', { id }),

  // Kategori Arsip
  getKategoriList: () => callAppsScript('getKategoriList'),
  getKategoriWithDocCount: (dewan_id) => callAppsScript('getKategoriWithDocCount', { dewan_id }),
  createKategori: (nama_kategori, deskripsi = '') => {
    if (typeof nama_kategori === 'object' && nama_kategori !== null) {
      return callAppsScript('createKategori', nama_kategori);
    }
    return callAppsScript('createKategori', { nama_kategori, deskripsi });
  },
  updateKategori: (id, nama_kategori, deskripsi = '') => {
    if (typeof id === 'object' && id !== null) {
      return callAppsScript('updateKategori', id);
    }
    return callAppsScript('updateKategori', { id, nama_kategori, deskripsi });
  },
  toggleKategoriStatus: (id, status) => callAppsScript('toggleKategoriStatus', { id, status }),
  deleteKategori: (id) => {
    if (typeof id === 'object' && id !== null) {
      return callAppsScript('deleteKategori', id);
    }
    return callAppsScript('deleteKategori', { id });
  },

  // Tahun Anggaran
  getTahunList: (dewan_id, kategori_id) => callAppsScript('getTahunList', { dewan_id, kategori_id }),
  createTahun: (dewan_id, kategori_id, tahun) => callAppsScript('createTahun', { dewan_id, kategori_id, tahun }),
  updateTahun: (dewan_id, kategori_id, tahun_lama, tahun_baru) => callAppsScript('updateTahun', { dewan_id, kategori_id, tahun_lama, tahun_baru }),
  deleteTahun: (dewan_id, kategori_id, tahun) => callAppsScript('deleteTahun', { dewan_id, kategori_id, tahun }),

  // Folder Dokumen
  getFolderList: (dewan_id, kategori_id, tahun) => callAppsScript('getFolderList', { dewan_id, kategori_id, tahun }),
  createFolder: (dewan_id, kategori_id, tahun, nama_folder, deskripsi = '') => callAppsScript('createFolder', { dewan_id, kategori_id, tahun, nama_folder, deskripsi }),
  updateFolder: (dewan_id, kategori_id, tahun, nama_folder_lama, nama_folder_baru, deskripsi = '') => {
    if (typeof dewan_id === 'object' && dewan_id !== null) {
      const o = dewan_id;
      return callAppsScript('updateFolder', {
        dewan_id: o.dewan_id,
        kategori_id: o.kategori_id,
        tahun: o.tahun,
        folder_lama: o.folder_lama || o.nama_folder_lama,
        folder_baru: o.folder_baru || o.nama_folder_baru,
        deskripsi: o.deskripsi || ''
      });
    }
    return callAppsScript('updateFolder', {
      dewan_id,
      kategori_id,
      tahun,
      folder_lama: nama_folder_lama,
      folder_baru: nama_folder_baru,
      deskripsi
    });
  },
  deleteFolder: (dewan_id, kategori_id, tahun, nama_folder) => {
    if (typeof dewan_id === 'object' && dewan_id !== null) {
      const o = dewan_id;
      return callAppsScript('deleteFolder', {
        dewan_id: o.dewan_id,
        kategori_id: o.kategori_id,
        tahun: o.tahun,
        nama_folder: o.nama_folder
      });
    }
    return callAppsScript('deleteFolder', { dewan_id, kategori_id, tahun, nama_folder });
  },

  // Dokumen Fisik & Google Drive
  getDokumenList: (params) => callAppsScript('getDokumenList', params),
  getDokumenById: (id) => callAppsScript('getDokumenById', { id }),
  uploadDokumen: (data) => callAppsScript('uploadDokumen', data, { timeout: 40000 }),
  downloadDokumen: (id) => callAppsScript('downloadDokumen', { id }),
  updateDokumen: (data) => callAppsScript('updateDokumen', data),
  deleteDokumen: (id) => callAppsScript('deleteDokumen', { id }),

  // Komisi & RDP
  getKomisiList: () => callAppsScript('getKomisiList'),
  createKomisi: (data) => callAppsScript('createKomisi', { data }),
  deleteKomisi: (id) => callAppsScript('deleteKomisi', { id }),
  getRdpDokumenList: (komisi_id, tahun = '') => callAppsScript('getRdpDokumenList', { komisi_id, tahun }),
  uploadRdpDokumen: (data) => {
    const payload = {
      ...data,
      nama_dokumen: data.nama_dokumen || data.judul || '',
      judul: data.judul || data.nama_dokumen || '',
      fileName: data.fileName || data.nama_file || '',
      nama_file: data.nama_file || data.fileName || ''
    };
    if (data.base64 !== undefined || data.fileData !== undefined) {
      payload.base64 = data.base64 !== undefined ? data.base64 : data.fileData;
      payload.fileData = data.fileData !== undefined ? data.fileData : data.base64;
    }
    return callAppsScript('uploadRdpDokumen', payload, { timeout: 40000 });
  },
  updateRdpDokumen: (data) => callAppsScript('updateRdpDokumen', data),
  deleteRdpDokumen: (id) => callAppsScript('deleteRdpDokumen', { id }),

  // Laporan Masyarakat (Publik & Terautentikasi)
  submitLaporanPublik: (data) => callAppsScript('submitLaporanPublik', { data }, { timeout: 40000 }),
  getPublicDewanList: () => callAppsScript('getPublicDewanList'),
  checkPokirDuplication: (data) => callAppsScript('checkPokirDuplication', { data }),
  approvePokirException: (nomor_tiket, catatan = '') => callAppsScript('approvePokirException', { nomor_tiket, catatan }),
  getLaporanList: (params = {}) => callAppsScript('getLaporanList', params),
  assignLaporan: (id, staff_id, staff_nama, assigned_to) => {
    if (typeof id === 'object' && id !== null) {
      return callAppsScript('assignLaporan', id);
    }
    return callAppsScript('assignLaporan', {
      id,
      staff_id: staff_id || assigned_to,
      staff_nama: staff_nama || staff_id,
      assigned_to: assigned_to || staff_nama || staff_id
    });
  },
  updateLaporanStatus: (id, status, tanggapan = '') => callAppsScript('updateLaporanStatus', { id, status, tanggapan }),
  downloadLaporanLampiran: (id) => callAppsScript('downloadLaporanLampiran', { id }),
  deleteLaporan: (id, alasan = '') => callAppsScript('deleteLaporan', { id, alasan }),

  // Pengguna & Hak Akses
  getUserList: () => callAppsScript('getUserList'),
  createUser: (data) => callAppsScript('createUser', { data }),
  updateUser: (id, data) => callAppsScript('updateUser', { id, ...data }),
  deleteUser: (id) => callAppsScript('deleteUser', { id }),
  toggleUserStatus: (id, status) => callAppsScript('toggleUserStatus', { id, status }),
  resetUserPassword: (id, newPassword) => callAppsScript('resetUserPassword', { id, newPassword }),
  unlockUser: (username) => callAppsScript('unlockUser', { username }),

  // Audit Log
  getActivityLog: (limit = 100) => callAppsScript('getActivityLog', { limit }),
  clearActivityLog: () => callAppsScript('clearActivityLog')
};
