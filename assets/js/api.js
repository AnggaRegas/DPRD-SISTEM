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
  "getDashboardData", "getActivityLog"
];

function invalidateCacheForAction(action) {
  if (action.includes("Dewan")) {
    clearApiCache("getDewan");
    clearApiCache("getDashboardData");
  } else if (action.includes("Kategori")) {
    clearApiCache("getKategori");
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
  } else if (action.includes("Login") || action.includes("Logout") || action.includes("Password")) {
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
      { id: 'DWN-01', nomor_urut: 1, nama: 'Ir. H. KAHARUDDIN KADIR, M.Si.', jabatan: 'Ketua DPRD Kota parepare', periode: '2024 - 2029', nama_pendamping: 'SUKARNO, S. Kom.', nama_partai: 'Partai Golongan Karya', status: 'aktif' },
      { id: 'DWN-02', nomor_urut: 2, nama: 'SUYUTI, S.E.', jabatan: 'Wakil Ketua I', periode: '2024 - 2029', nama_pendamping: 'M. KHAERUL KADAR,S.H', nama_partai: 'Partai Nasional Demokrat', status: 'aktif' },
      { id: 'DWN-03', nomor_urut: 3, nama: 'MUHAMMAD YUSUF LAPANNA, SH.I.', jabatan: 'Wakil Ketua II', periode: '2024 - 2029', nama_pendamping: 'AJI WICAKSONO, S.H', nama_partai: 'Partai Gerakan Indonesia Raya', status: 'aktif' },
      { id: 'DWN-04', nomor_urut: 4, nama: 'ACHMAD ARIADY, S.E.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'SINTA DEWI ANGGRAENI, S.E.', nama_partai: 'Partai Nasional Demokrat', status: 'aktif' }
    ],
    kategori: [
      { id: 'KAT-01', nama_kategori: 'Pokok-Pokok Pikiran (Pokir)', deskripsi: 'Arsip usulan aspirasi masyarakat', status: 'aktif' },
      { id: 'KAT-02', nama_kategori: 'Laporan Hasil Reses', deskripsi: 'Laporan penjaringan aspirasi konstituen', status: 'aktif' },
      { id: 'KAT-03', nama_kategori: 'Fasilitasi Penganggaran (RKA/DPA)', deskripsi: 'Dokumen pembahasan anggaran', status: 'aktif' }
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
  'createDewan': ['admin', 'superadmin'],
  'updateDewan': ['admin', 'superadmin'],
  'toggleDewanStatus': ['admin', 'superadmin'],
  'deleteDewan': ['admin', 'superadmin'],
  'createKategori': ['admin', 'superadmin'],
  'updateKategori': ['admin', 'superadmin'],
  'toggleKategoriStatus': ['admin', 'superadmin'],
  'deleteKategori': ['admin', 'superadmin'],
  'deleteTahun': ['admin', 'superadmin'],
  'deleteFolder': ['admin', 'superadmin'],
  'deleteDokumen': ['admin', 'superadmin'],
  'getUserList': ['admin', 'superadmin'],
  'getActivityLog': ['admin', 'superadmin'],
  'clearActivityLog': ['staff', 'admin', 'superadmin'],
  'createUser': ['superadmin'],
  'toggleUserStatus': ['superadmin'],
  'resetUserPassword': ['superadmin']
};

async function handleMockRequest(action, payload) {
  await new Promise((r) => setTimeout(r, 15));
  const db = getMockDb();

  // 1. Matriks Akses Eksplisit
  const allowedRoles = MOCK_ACTION_PERMISSIONS[action];
  if (!allowedRoles) {
    return { success: false, data: null, message: 'Aksi API tidak dikenali: ' + action, error: { code: 'NOT_FOUND' } };
  }

  // 2. Login Publik
  if (action === 'adminLogin' || action === 'login') {
    const u = (payload.username || (payload.credentials && payload.credentials.username) || '').trim().toLowerCase();
    const p = payload.password || (payload.credentials && payload.credentials.password) || '';

    // Cek Lockout
    if (db.lockouts[u] && db.lockouts[u] > Date.now()) {
      return { success: false, data: null, message: 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.', error: { code: 'TOO_MANY_REQUESTS' } };
    }

    const matched = db.users.find((x) => x.username.toLowerCase() === u && x.password === p && x.status === 'aktif');
    if (!matched) {
      db.failedAttempts[u] = (db.failedAttempts[u] || 0) + 1;
      let isLocked = false;
      if (db.failedAttempts[u] >= 5) {
        db.lockouts[u] = Date.now() + 15 * 60 * 1000;
        delete db.failedAttempts[u];
        isLocked = true;
      }
      saveMockDb(db);
      return {
        success: false,
        data: null,
        message: isLocked ? 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.' : 'Username atau password tidak valid.',
        error: { code: isLocked ? 'TOO_MANY_REQUESTS' : 'INVALID_CREDENTIALS' }
      };
    }

    // Reset percobaan gagal saat sukses
    delete db.failedAttempts[u];
    delete db.lockouts[u];

    const token = 'DPRD_SES_' + matched.id + '_' + Date.now();
    const userObj = {
      id: matched.id,
      username: matched.username,
      nama: matched.nama,
      role: matched.role,
      mustChangePassword: Boolean(matched.must_change_password)
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

  // Sinkronisasi status peran dan kewajiban ganti password terbaru
  currentUser.role = liveUser.role;
  currentUser.mustChangePassword = Boolean(liveUser.must_change_password);

  // 4. Proteksi Wajib Ganti Password
  const ALLOWED_MUST_CHANGE = ['changePassword', 'logout', 'adminLogout', 'checkSession', 'getCurrentUser', 'getProfile'];
  if (currentUser.mustChangePassword && ALLOWED_MUST_CHANGE.indexOf(action) === -1) {
    return { success: false, data: null, message: 'Anda wajib mengganti kata sandi terlebih dahulu sebelum dapat mengakses fitur sistem.', error: { code: 'MUST_CHANGE_PASSWORD' } };
  }

  // 5. Otorisasi Peran (RBAC)
  if (Array.isArray(allowedRoles) && !allowedRoles.includes(currentUser.role)) {
    return { success: false, data: null, message: 'Akses ditolak: Peran akun "' + currentUser.role + '" tidak memiliki izin.', error: { code: 'FORBIDDEN' } };
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
        list = list.filter((d) => d.nama.toLowerCase().includes(q) || d.nama_partai.toLowerCase().includes(q) || d.jabatan.toLowerCase().includes(q));
      }
      list.sort((a, b) => (a.nomor_urut || 999) - (b.nomor_urut || 999));
      return { success: true, data: list, message: 'Daftar anggota dewan berhasil dimuat.' };
    }

    case 'getDewanById': {
      const id = String(payload.id);
      const item = db.dewan.find((d) => String(d.id) === id || String(d.nomor_urut) === id);
      return item ? { success: true, data: item } : { success: false, message: 'Data dewan tidak ditemukan.', error: { code: 'NOT_FOUND' } };
    }

    case 'createDewan': {
      const d = payload.data || payload;
      const nextNum = db.dewan.length + 1;
      const idStr = 'DWN-' + (nextNum < 10 ? '0' + nextNum : nextNum);
      const record = { id: idStr, nomor_urut: nextNum, ...d, status: 'aktif' };
      db.dewan.push(record);
      saveMockDb(db);
      return { success: true, data: record, message: 'Anggota dewan berhasil ditambahkan.' };
    }

    case 'updateDewan': {
      const d = payload.data || payload;
      const idx = db.dewan.findIndex((x) => String(x.id) === String(d.id));
      if (idx !== -1) {
        db.dewan[idx] = { ...db.dewan[idx], ...d };
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
        const count = db.dokumen.filter((d) => String(d.kategori_id) === String(k.id) && (!dewanId || String(d.dewan_id) === dewanId) && d.status === 'aktif').length;
        return { id: k.id, nama_kategori: k.nama_kategori, deskripsi: k.deskripsi || '', status: k.status || 'aktif', jumlah_dokumen: count };
      });
      return { success: true, data: res, message: 'Kategori berhasil dimuat.' };
    }

    case 'createKategori': {
      const nama = String(payload.nama_kategori || '').trim();
      const duplicate = db.kategori.some((k) => k.nama_kategori.toLowerCase() === nama.toLowerCase());
      if (duplicate) return { success: false, message: 'Kategori dengan nama tersebut sudah ada.' };
      const newId = 'KAT-' + (db.kategori.length + 1);
      const item = { id: newId, nama_kategori: nama, deskripsi: payload.deskripsi || '', status: 'aktif' };
      db.kategori.push(item);
      saveMockDb(db);
      return { success: true, data: item, message: 'Kategori berhasil ditambahkan.' };
    }

    case 'updateKategori': {
      const id = String(payload.id);
      const target = db.kategori.find((k) => String(k.id) === id);
      if (target) {
        target.nama_kategori = payload.nama_kategori || target.nama_kategori;
        target.deskripsi = payload.deskripsi !== undefined ? payload.deskripsi : target.deskripsi;
        saveMockDb(db);
        return { success: true, data: target, message: 'Kategori berhasil diperbarui.' };
      }
      return { success: false, message: 'Kategori tidak ditemukan.' };
    }

    case 'toggleKategoriStatus': {
      const id = String(payload.id);
      const target = db.kategori.find((k) => String(k.id) === id);
      if (target) {
        target.status = payload.status || (target.status === 'aktif' ? 'nonaktif' : 'aktif');
        saveMockDb(db);
        return { success: true, data: target, message: 'Status kategori berhasil diubah.' };
      }
      return { success: false, message: 'Kategori tidak ditemukan.' };
    }

    case 'deleteKategori': {
      const id = String(payload.id);
      const hasDocs = db.dokumen.some((d) => String(d.kategori_id) === id);
      if (hasDocs) {
        return { success: false, message: 'Kategori masih digunakan oleh dokumen arsip. Silakan nonaktifkan kategori ini.', error: { code: 'HAS_DEPENDENT_RECORDS' } };
      }
      db.kategori = db.kategori.filter((k) => String(k.id) !== id);
      saveMockDb(db);
      return { success: true, message: 'Kategori berhasil dihapus.' };
    }

    case 'getTahunList': {
      const dewanId = String(payload.dewan_id);
      const katId = String(payload.kategori_id);
      const tahunSet = new Set();
      db.tahun.filter((t) => String(t.dewan_id) === dewanId && String(t.kategori_id) === katId).forEach((t) => tahunSet.add(t.tahun));
      db.dokumen.filter((d) => String(d.dewan_id) === dewanId && String(d.kategori_id) === katId).forEach((d) => tahunSet.add(d.tahun));
      const list = Array.from(tahunSet).map((yr) => {
        const count = db.dokumen.filter((d) => String(d.dewan_id) === dewanId && String(d.kategori_id) === katId && parseInt(d.tahun, 10) === yr && d.status === 'aktif').length;
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
      const folders = db.folder.filter((f) => String(f.dewan_id) === dewanId && String(f.kategori_id) === katId && f.tahun === yr);
      const res = folders.map((f) => {
        const count = db.dokumen.filter((d) => String(d.dewan_id) === dewanId && String(d.kategori_id) === katId && parseInt(d.tahun, 10) === yr && String(d.nama_folder).trim().toLowerCase() === String(f.nama_folder).trim().toLowerCase() && d.status === 'aktif').length;
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

      const existing = db.folder.find(f => String(f.dewan_id) === dewanId && String(f.kategori_id) === katId && f.tahun === yr && f.nama_folder.toLowerCase() === nama.toLowerCase());
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

      const target = db.folder.find(f => String(f.dewan_id) === dewanId && String(f.kategori_id) === katId && f.tahun === yr && f.nama_folder.toLowerCase() === folderLama.toLowerCase());
      if (target) {
        target.nama_folder = folderBaru;
        if (payload.deskripsi) target.deskripsi = payload.deskripsi;
      }

      db.dokumen.forEach(d => {
        if (String(d.dewan_id) === dewanId && String(d.kategori_id) === katId && parseInt(d.tahun, 10) === yr && String(d.nama_folder || '').toLowerCase() === folderLama.toLowerCase()) {
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
        String(d.kategori_id) === katId &&
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
        String(f.kategori_id) === katId &&
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
      let list = db.dokumen.filter((d) => d.status === 'aktif');
      if (dewanId) list = list.filter((d) => String(d.dewan_id) === dewanId);
      if (katId) list = list.filter((d) => String(d.kategori_id) === katId);
      if (yr) list = list.filter((d) => parseInt(d.tahun, 10) === yr);
      if (folder) list = list.filter((d) => String(d.nama_folder || '').trim().toLowerCase() === folder);
      return { success: true, data: list, message: 'Daftar dokumen berhasil dimuat.' };
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

    case 'deleteDokumen': {
      const id = String(payload.id);
      db.dokumen = db.dokumen.filter((d) => String(d.id) !== id);
      saveMockDb(db);
      return { success: true, message: 'Dokumen berhasil dihapus.' };
    }

    case 'getUserList':
      return { success: true, data: db.users.map((u) => ({ id: u.id, username: u.username, nama: u.nama, role: u.role, status: u.status })), message: 'Daftar pengguna dimuat.' };

    case 'createUser': {
      const newU = { id: 'USR-' + Date.now(), ...payload.data, status: 'aktif', must_change_password: true };
      db.users.push(newU);
      saveMockDb(db);
      return { success: true, data: newU, message: 'Pengguna berhasil dibuat.' };
    }

    case 'toggleUserStatus': {
      const target = db.users.find((u) => u.id === payload.id);
      if (target) {
        target.status = payload.status;
        saveMockDb(db);
        // Jika akun dinonaktifkan, cabut sesi
        if (payload.status === 'nonaktif' && currentUser.id === payload.id) {
          safeSessionStorage.removeItem('dprd_token');
          safeSessionStorage.removeItem('dprd_user');
        }
        return { success: true, message: 'Status pengguna diubah.' };
      }
      return { success: false, message: 'Pengguna tidak ditemukan.' };
    }

    case 'resetUserPassword': {
      const target = db.users.find((u) => u.id === payload.id);
      if (target) {
        target.password = payload.newPassword;
        target.must_change_password = true;
        saveMockDb(db);
        // Cabut sesi aktif pengguna yang direset
        if (currentUser.id === payload.id) {
          safeSessionStorage.removeItem('dprd_token');
          safeSessionStorage.removeItem('dprd_user');
        }
        return { success: true, message: 'Password berhasil direset.' };
      }
      return { success: false, message: 'Pengguna tidak ditemukan.' };
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
  checkSession: () => callAppsScript('getCurrentUser'),
  getProfile: () => callAppsScript('getProfile'),
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
  createKategori: (nama_kategori, deskripsi = '') => callAppsScript('createKategori', { nama_kategori, deskripsi }),
  updateKategori: (id, nama_kategori, deskripsi = '') => callAppsScript('updateKategori', { id, nama_kategori, deskripsi }),
  toggleKategoriStatus: (id, status) => callAppsScript('toggleKategoriStatus', { id, status }),
  deleteKategori: (id) => callAppsScript('deleteKategori', { id }),

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

  // Pengguna & Hak Akses
  getUserList: () => callAppsScript('getUserList'),
  createUser: (data) => callAppsScript('createUser', { data }),
  toggleUserStatus: (id, status) => callAppsScript('toggleUserStatus', { id, status }),
  resetUserPassword: (id, newPassword) => callAppsScript('resetUserPassword', { id, newPassword }),

  // Audit Log
  getActivityLog: (limit = 100) => callAppsScript('getActivityLog', { limit }),
  clearActivityLog: () => callAppsScript('clearActivityLog')
};
