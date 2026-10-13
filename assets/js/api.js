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
const ENV_GAS_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APPS_SCRIPT_URL) || '';
const STORED_GAS_URL = safeLocalStorage.getItem('dprd_gas_url') || '';
export const GAS_API_URL = (ENV_GAS_URL || STORED_GAS_URL).trim();

// Mode Mock HANYA diizinkan jika secara eksplisit disetel ke 'true' atau saat unit test Node.js berjalan
const ENV_USE_MOCK = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_MOCK_API) || '';
const isNodeTest = typeof process !== 'undefined' && process.env && (process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test');
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

/**
 * Pemanggilan API Universal dengan Cache-Busting, Timeout, dan Proteksi CORS
 */
async function callAppsScript(action, payload = {}, options = {}) {
  // Jika mode mock aktif secara eksplisit (hanya di lingkungan dev/test terisolasi)
  if (IS_MOCK_MODE) {
    return handleMockRequest(action, payload);
  }

  // Jika URL Apps Script belum diisi di produksi, gagal secara aman tanpa membocorkan info rahasia
  if (!GAS_API_URL) {
    return {
      success: false,
      data: null,
      message: 'Layanan autentikasi sedang tidak tersedia. Silakan coba kembali.',
      error: { code: 'BACKEND_URL_NOT_CONFIGURED' }
    };
  }

  const token = getStoredToken();
  const controller = options.signal ? null : new AbortController();
  const signal = options.signal || (controller ? controller.signal : null);
  const timeoutMs = options.timeout || 30000; // 30 detik batas aman Google Apps Script
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

// ======================= MOCK DATA ENGINE (KHUSUS DEV/TESTING EKSPLISIT) =======================
const MOCK_STORAGE_KEY = 'dprd_mock_database_v2';

function getMockDb() {
  const existing = safeLocalStorage.getItem(MOCK_STORAGE_KEY);
  if (existing) {
    try { return JSON.parse(existing); } catch (e) {}
  }
  const defaultDb = {
    users: [
      { id: 'USR-MOCK-1', nama: 'Super Administrator', username: 'superadmin', password: 'SandiRahasia123!', role: 'superadmin', must_change_password: true, status: 'aktif' },
      { id: 'USR-MOCK-2', nama: 'Staff Pengarsipan', username: 'staff', password: 'PasswordStaff2026!', role: 'staff', must_change_password: false, status: 'aktif' }
    ],
    dewan: [
      { id: 1, nomor_urut: 1, nama: 'Ir. H. KAHARUDDIN KADIR, M.Si.', jabatan: 'Ketua DPRD Kota parepare', periode: '2024 - 2029', nama_pendamping: 'SUKARNO, S. Kom.', nama_partai: 'Partai Golongan Karya', status: 'aktif' },
      { id: 2, nomor_urut: 2, nama: 'SUYUTI, S.E.', jabatan: 'Wakil Ketua I', periode: '2024 - 2029', nama_pendamping: 'M. KHAERUL KADAR,S.H', nama_partai: 'Partai Nasional Demokrat', status: 'aktif' },
      { id: 3, nomor_urut: 3, nama: 'MUHAMMAD YUSUF LAPANNA, SH.I.', jabatan: 'Wakil Ketua II', periode: '2024 - 2029', nama_pendamping: 'AJI WICAKSONO, S.H', nama_partai: 'Partai Gerakan Indonesia Raya', status: 'aktif' },
      { id: 4, nomor_urut: 4, nama: 'ACHMAD ARIADY, S.E.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'SINTA DEWI ANGGRAENI, S.E.', nama_partai: 'Partai Nasional Demokrat', status: 'aktif' }
    ],
    kategori: [
      { id: 1, nama_kategori: 'Pokok-Pokok Pikiran (Pokir)', deskripsi: 'Arsip usulan aspirasi masyarakat', status: 'aktif' },
      { id: 2, nama_kategori: 'Laporan Hasil Reses', deskripsi: 'Laporan penjaringan aspirasi konstituen', status: 'aktif' },
      { id: 3, nama_kategori: 'Fasilitasi Penganggaran (RKA/DPA)', deskripsi: 'Dokumen pembahasan anggaran', status: 'aktif' }
    ],
    tahun: [
      { id: 1, dewan_id: 1, kategori_id: 1, tahun: 2024, status: 'aktif' },
      { id: 2, dewan_id: 1, kategori_id: 1, tahun: 2025, status: 'aktif' }
    ],
    folder: [
      { id: 1, dewan_id: 1, kategori_id: 1, tahun: 2024, nama_folder: 'Masa Sidang I', status: 'aktif' }
    ],
    dokumen: [
      {
        id: 1,
        dewan_id: 1,
        kategori_id: 1,
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
    logs: []
  };
  safeLocalStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(defaultDb));
  return defaultDb;
}

function saveMockDb(db) {
  safeLocalStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
}

async function handleMockRequest(action, payload) {
  await new Promise((r) => setTimeout(r, 20));
  const db = getMockDb();

  switch (action) {
    case 'adminLogin':
    case 'login': {
      const u = (payload.username || (payload.credentials && payload.credentials.username) || '').trim().toLowerCase();
      const p = payload.password || (payload.credentials && payload.credentials.password) || '';
      const matched = db.users.find((x) => x.username.toLowerCase() === u && x.password === p && x.status === 'aktif');
      if (matched) {
        const token = 'mock-token-' + Date.now();
        const userObj = {
          id: matched.id,
          username: matched.username,
          nama: matched.nama,
          role: matched.role,
          mustChangePassword: Boolean(matched.must_change_password)
        };
        safeSessionStorage.setItem('dprd_token', token);
        safeSessionStorage.setItem('dprd_user', JSON.stringify(userObj));
        return { success: true, data: { token, user: userObj }, message: 'Login berhasil.' };
      }
      return { success: false, data: null, message: 'Username atau password tidak valid.' };
    }

    case 'adminLogout':
    case 'logout':
      safeSessionStorage.removeItem('dprd_token');
      safeSessionStorage.removeItem('dprd_user');
      return { success: true, data: null, message: 'Logout berhasil.' };

    case 'getCurrentUser':
    case 'checkSession':
    case 'getProfile': {
      const uStr = safeSessionStorage.getItem('dprd_user');
      if (uStr) return { success: true, data: JSON.parse(uStr), message: 'Sesi aktif.' };
      return { success: false, data: null, message: 'Sesi tidak ditemukan.' };
    }

    case 'changePassword': {
      const uStr = safeSessionStorage.getItem('dprd_user');
      if (!uStr) return { success: false, message: 'Sesi tidak valid.' };
      const cur = JSON.parse(uStr);
      const target = db.users.find((x) => x.id === cur.id);
      if (!target) return { success: false, message: 'Pengguna tidak ditemukan.' };
      if (target.password !== payload.oldPassword) return { success: false, message: 'Password lama tidak sesuai.' };
      target.password = payload.newPassword;
      target.must_change_password = false;
      cur.mustChangePassword = false;
      safeSessionStorage.setItem('dprd_user', JSON.stringify(cur));
      saveMockDb(db);
      return { success: true, data: cur, message: 'Password berhasil diperbarui.' };
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
      const id = parseInt(payload.id, 10);
      const item = db.dewan.find((d) => d.id === id || d.nomor_urut === id);
      return item ? { success: true, data: item } : { success: false, message: 'Data dewan tidak ditemukan.' };
    }

    case 'createDewan': {
      const d = payload.data || payload;
      const maxId = db.dewan.length ? Math.max(...db.dewan.map((x) => x.id)) : 0;
      const newId = maxId + 1;
      const record = { id: newId, nomor_urut: parseInt(d.nomor_urut, 10) || newId, ...d, status: 'aktif' };
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
      const id = parseInt(payload.id, 10);
      const target = db.dewan.find((x) => x.id === id);
      if (target) {
        target.status = payload.status || (target.status === 'aktif' ? 'nonaktif' : 'aktif');
        saveMockDb(db);
        return { success: true, data: target, message: 'Status dewan berhasil diubah.' };
      }
      return { success: false, message: 'Data dewan tidak ditemukan.' };
    }

    case 'deleteDewan': {
      const id = parseInt(payload.id, 10);
      const hasDocs = db.dokumen.some((d) => parseInt(d.dewan_id, 10) === id);
      if (hasDocs) {
        return { success: false, message: 'Anggota dewan tidak dapat dihapus karena memiliki dokumen terikat. Silakan nonaktifkan.', error: { code: 'HAS_DEPENDENT_RECORDS' } };
      }
      db.dewan = db.dewan.filter((x) => x.id !== id);
      saveMockDb(db);
      return { success: true, message: 'Anggota dewan berhasil dihapus.' };
    }

    case 'getKategoriList':
      return { success: true, data: db.kategori, message: 'Kategori berhasil dimuat.' };

    case 'getKategoriWithDocCount': {
      const dewanId = payload.dewan_id ? parseInt(payload.dewan_id, 10) : null;
      const res = db.kategori.map((k) => {
        const count = db.dokumen.filter((d) => parseInt(d.kategori_id, 10) === k.id && (!dewanId || parseInt(d.dewan_id, 10) === dewanId) && d.status === 'aktif').length;
        return { id: k.id, nama_kategori: k.nama_kategori, deskripsi: k.deskripsi || '', status: k.status || 'aktif', jumlah_dokumen: count };
      });
      return { success: true, data: res, message: 'Kategori berhasil dimuat.' };
    }

    case 'createKategori': {
      const nama = String(payload.nama_kategori || '').trim();
      const duplicate = db.kategori.some((k) => k.nama_kategori.toLowerCase() === nama.toLowerCase());
      if (duplicate) return { success: false, message: 'Kategori dengan nama tersebut sudah ada.' };
      const newId = (db.kategori.length ? Math.max(...db.kategori.map((x) => x.id)) : 0) + 1;
      const item = { id: newId, nama_kategori: nama, deskripsi: payload.deskripsi || '', status: 'aktif' };
      db.kategori.push(item);
      saveMockDb(db);
      return { success: true, data: item, message: 'Kategori berhasil ditambahkan.' };
    }

    case 'updateKategori': {
      const id = parseInt(payload.id, 10);
      const target = db.kategori.find((k) => k.id === id);
      if (target) {
        target.nama_kategori = payload.nama_kategori || target.nama_kategori;
        target.deskripsi = payload.deskripsi !== undefined ? payload.deskripsi : target.deskripsi;
        saveMockDb(db);
        return { success: true, data: target, message: 'Kategori berhasil diperbarui.' };
      }
      return { success: false, message: 'Kategori tidak ditemukan.' };
    }

    case 'toggleKategoriStatus': {
      const id = parseInt(payload.id, 10);
      const target = db.kategori.find((k) => k.id === id);
      if (target) {
        target.status = payload.status || (target.status === 'aktif' ? 'nonaktif' : 'aktif');
        saveMockDb(db);
        return { success: true, data: target, message: 'Status kategori berhasil diubah.' };
      }
      return { success: false, message: 'Kategori tidak ditemukan.' };
    }

    case 'deleteKategori': {
      const id = parseInt(payload.id, 10);
      const hasDocs = db.dokumen.some((d) => parseInt(d.kategori_id, 10) === id);
      if (hasDocs) {
        return { success: false, message: 'Kategori masih digunakan oleh dokumen arsip. Silakan nonaktifkan kategori ini.', error: { code: 'HAS_DEPENDENT_RECORDS' } };
      }
      db.kategori = db.kategori.filter((k) => k.id !== id);
      saveMockDb(db);
      return { success: true, message: 'Kategori berhasil dihapus.' };
    }

    case 'getTahunList': {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const tahunSet = new Set();
      db.tahun.filter((t) => t.dewan_id === dewanId && t.kategori_id === katId).forEach((t) => tahunSet.add(t.tahun));
      db.dokumen.filter((d) => parseInt(d.dewan_id, 10) === dewanId && parseInt(d.kategori_id, 10) === katId).forEach((d) => tahunSet.add(d.tahun));
      const list = Array.from(tahunSet).map((yr) => {
        const count = db.dokumen.filter((d) => parseInt(d.dewan_id, 10) === dewanId && parseInt(d.kategori_id, 10) === katId && parseInt(d.tahun, 10) === yr && d.status === 'aktif').length;
        return { tahun: yr, jumlah_dokumen: count };
      }).sort((a, b) => b.tahun - a.tahun);
      return { success: true, data: list, message: 'Daftar tahun berhasil dimuat.' };
    }

    case 'createTahun': {
      const rec = { id: Date.now(), dewan_id: parseInt(payload.dewan_id, 10), kategori_id: parseInt(payload.kategori_id, 10), tahun: parseInt(payload.tahun, 10), status: 'aktif' };
      db.tahun.push(rec);
      saveMockDb(db);
      return { success: true, data: rec, message: 'Tahun berhasil ditambahkan.' };
    }

    case 'getFolderList': {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const yr = parseInt(payload.tahun, 10);
      const folders = db.folder.filter((f) => f.dewan_id === dewanId && f.kategori_id === katId && f.tahun === yr);
      const res = folders.map((f) => {
        const count = db.dokumen.filter((d) => parseInt(d.dewan_id, 10) === dewanId && parseInt(d.kategori_id, 10) === katId && parseInt(d.tahun, 10) === yr && String(d.nama_folder).trim().toLowerCase() === String(f.nama_folder).trim().toLowerCase() && d.status === 'aktif').length;
        return { id: f.id, nama_folder: f.nama_folder, jumlah_dokumen: count };
      });
      return { success: true, data: res, message: 'Daftar folder berhasil dimuat.' };
    }

    case 'createFolder': {
      const rec = { id: Date.now(), dewan_id: parseInt(payload.dewan_id, 10), kategori_id: parseInt(payload.kategori_id, 10), tahun: parseInt(payload.tahun, 10), nama_folder: String(payload.nama_folder || '').trim(), status: 'aktif' };
      db.folder.push(rec);
      saveMockDb(db);
      return { success: true, data: rec, message: 'Folder berhasil ditambahkan.' };
    }

    case 'getDokumenList': {
      const dewanId = payload.dewan_id ? parseInt(payload.dewan_id, 10) : null;
      const katId = payload.kategori_id ? parseInt(payload.kategori_id, 10) : null;
      const yr = payload.tahun ? parseInt(payload.tahun, 10) : null;
      const folder = payload.nama_folder ? String(payload.nama_folder).trim().toLowerCase() : null;
      let list = db.dokumen.filter((d) => d.status === 'aktif');
      if (dewanId) list = list.filter((d) => parseInt(d.dewan_id, 10) === dewanId);
      if (katId) list = list.filter((d) => parseInt(d.kategori_id, 10) === katId);
      if (yr) list = list.filter((d) => parseInt(d.tahun, 10) === yr);
      if (folder) list = list.filter((d) => String(d.nama_folder || '').trim().toLowerCase() === folder);
      return { success: true, data: list, message: 'Daftar dokumen berhasil dimuat.' };
    }

    case 'uploadDokumen': {
      const data = payload.data || payload;
      const newId = (db.dokumen.length ? Math.max(...db.dokumen.map((x) => x.id)) : 0) + 1;
      const doc = {
        id: newId,
        dewan_id: parseInt(data.dewan_id, 10),
        kategori_id: parseInt(data.kategori_id, 10),
        tahun: parseInt(data.tahun, 10),
        nama_folder: String(data.nama_folder || '').trim(),
        nama_dokumen: String(data.nama_dokumen || data.judul || '').trim(),
        keterangan: String(data.keterangan || '').trim(),
        nama_file: String(data.fileName || 'dokumen.pdf').trim(),
        file_id: 'mock-file-' + newId,
        direct_url: '#',
        view_url: '#',
        ukuran_file: 350000,
        status: 'aktif',
        uploaded_by: 'superadmin',
        tanggal_upload: new Date().toISOString()
      };
      db.dokumen.push(doc);
      saveMockDb(db);
      return { success: true, data: doc, message: 'Dokumen berhasil diunggah.' };
    }

    case 'deleteDokumen': {
      const id = parseInt(payload.id, 10);
      db.dokumen = db.dokumen.filter((d) => d.id !== id);
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
        return { success: true, message: 'Password berhasil direset.' };
      }
      return { success: false, message: 'Pengguna tidak ditemukan.' };
    }

    default:
      return { success: false, message: 'Aksi mock tidak dikenali: ' + action };
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
    // Batalkan request pencarian sebelumnya jika ada
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
  updateFolder: (dewan_id, kategori_id, tahun, nama_folder_lama, nama_folder_baru, deskripsi = '') => callAppsScript('updateFolder', { dewan_id, kategori_id, tahun, nama_folder_lama, nama_folder_baru, deskripsi }),
  deleteFolder: (dewan_id, kategori_id, tahun, nama_folder) => callAppsScript('deleteFolder', { dewan_id, kategori_id, tahun, nama_folder }),

  // Dokumen Fisik & Google Drive
  getDokumenList: (params) => callAppsScript('getDokumenList', params),
  getDokumenById: (id) => callAppsScript('getDokumenById', { id }),
  uploadDokumen: (data) => callAppsScript('uploadDokumen', data, { timeout: 35000 }),
  updateDokumen: (data) => callAppsScript('updateDokumen', data),
  deleteDokumen: (id) => callAppsScript('deleteDokumen', { id }),

  // Pengguna & Hak Akses
  getUserList: () => callAppsScript('getUserList'),
  createUser: (data) => callAppsScript('createUser', { data }),
  toggleUserStatus: (id, status) => callAppsScript('toggleUserStatus', { id, status }),
  resetUserPassword: (id, newPassword) => callAppsScript('resetUserPassword', { id, newPassword }),

  // Audit Log
  getActivityLog: (limit = 50) => callAppsScript('getActivityLog', { limit })
};
