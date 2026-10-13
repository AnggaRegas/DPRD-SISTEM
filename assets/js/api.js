/**
 * Client API Sistem Pengarsipan Dokumen DPRD
 * Menghubungkan Frontend Vercel dengan Backend Google Apps Script Web App
 * Dilengkapi dengan Local Mock Engine agar sistem dapat diuji langsung 100% secara lokal.
 */

// Memory Storage Fallback untuk Node.js Test Runner
const memoryStorage = {};
const safeLocalStorage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : {
  getItem: (k) => memoryStorage[k] || null,
  setItem: (k, v) => { memoryStorage[k] = String(v); },
  removeItem: (k) => { delete memoryStorage[k]; }
};

const safeSessionStorage = typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : safeLocalStorage;

// Konfigurasi URL dari Environment Variables (Vite) atau Local Storage
const ENV_GAS_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APPS_SCRIPT_URL) || '';
const STORED_GAS_URL = safeLocalStorage.getItem('dprd_gas_url') || '';
export const GAS_API_URL = ENV_GAS_URL || STORED_GAS_URL;

// Mode Mock otomatis nonaktif jika GAS_API_URL tersedia dan VITE_USE_MOCK_API bukan 'true'
const ENV_USE_MOCK = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_MOCK_API !== undefined)
  ? import.meta.env.VITE_USE_MOCK_API
  : (GAS_API_URL ? 'false' : 'true');

export const IS_MOCK_MODE = ENV_USE_MOCK === 'true' || !GAS_API_URL;

// ======================= MOCK DATA ENGINE (OFFLINE FALLBACK) =======================
const MOCK_STORAGE_KEY = 'dprd_mock_database_v1';

function getMockDb() {
  const existing = safeLocalStorage.getItem(MOCK_STORAGE_KEY);
  if (existing) {
    try { return JSON.parse(existing); } catch (e) {}
  }
  const defaultDb = {
    users: [
      { id: 'USR-1', nama: 'Staff Pengarsipan', username: 'staff', password: 'staff123', role: 'staff' },
      { id: 'USR-2', nama: 'Kepala Bagian', username: 'kabag', password: 'kabag123', role: 'kepala_bagian' },
      { id: 'USR-3', nama: 'Administrator DPRD', username: 'admin', password: 'admin123', role: 'admin' }
    ],
    dewan: [
      { id: 1, nama: 'H. Andi Muhammad Fajar, S.Pd.', jabatan: 'Ketua DPRD', urutan: 1, periode: '2024–2029', nama_pengawas: 'St. Aminah, S.Sos.', nama_partai: 'Partai Golongan Karya', keterangan: 'Pimpinan DPRD' },
      { id: 2, nama: 'Dra. Hj. Nurfadillah, M.Si.', jabatan: 'Wakil Ketua I', urutan: 2, periode: '2024–2029', nama_pengawas: 'Drs. H. Rahman, M.M.', nama_partai: 'Partai Nasional Demokrat', keterangan: 'Pimpinan DPRD' },
      { id: 3, nama: 'Muhammad Yusuf, S.E.', jabatan: 'Wakil Ketua II', urutan: 3, periode: '2024–2029', nama_pengawas: 'Baharuddin, S.T.', nama_partai: 'Partai Gerakan Indonesia Raya', keterangan: 'Pimpinan DPRD' },
      { id: 4, nama: 'Ir. H. Ahmad Rusdi', jabatan: 'Ketua Komisi I', urutan: 4, periode: '2024–2029', nama_pengawas: 'Fitriani, S.IP.', nama_partai: 'Partai Keadilan Sejahtera', keterangan: 'Komisi Pemerintahan' }
    ],
    kategori: [
      { id: 1, nama_kategori: 'Pokok-Pokok Pikiran (Pokir)' },
      { id: 2, nama_kategori: 'Laporan Hasil Reses' },
      { id: 3, nama_kategori: 'Fasilitasi Penganggaran (RKA/DPA)' },
      { id: 4, nama_kategori: 'Fasilitasi Pengawasan' },
      { id: 5, nama_kategori: 'Dokumen Perjalanan Dinas' }
    ],
    tahun: [
      { id: 1, dewan_id: 1, kategori_id: 1, tahun: 2024 },
      { id: 2, dewan_id: 1, kategori_id: 1, tahun: 2025 },
      { id: 3, dewan_id: 1, kategori_id: 2, tahun: 2024 }
    ],
    folder: [
      { id: 1, dewan_id: 1, kategori_id: 1, tahun: 2024, nama_folder: 'Masa Sidang I' },
      { id: 2, dewan_id: 1, kategori_id: 1, tahun: 2024, nama_folder: 'Masa Sidang II' }
    ],
    dokumen: [
      {
        id: 1,
        dewan_id: 1,
        kategori_id: 1,
        tahun: 2024,
        nama_folder: 'Masa Sidang I',
        nama_dokumen: 'Laporan Pokir Dapil I Ujung - Soreang',
        keterangan: 'Arsip usulan pokir pembangunan infrastruktur',
        nama_file: 'laporan_pokir_dapil1.pdf',
        file_id: 'mock-drive-1',
        direct_url: '#',
        view_url: '#',
        ukuran_file: 245000,
        uploaded_by: 'staff',
        tanggal_upload: '2024-03-15T09:30:00Z'
      }
    ]
  };
  safeLocalStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(defaultDb));
  return defaultDb;
}

function saveMockDb(db) {
  safeLocalStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
}

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
 * Pemanggilan API Universal dengan Timeout dan Proteksi CORS
 */
async function callAppsScript(action, payload = {}) {
  if (IS_MOCK_MODE) {
    return handleMockRequest(action, payload);
  }

  const token = getStoredToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 detik timeout

  try {
    const res = await fetch(GAS_API_URL, {
      method: 'POST',
      signal: controller.signal,
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
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Server Google Apps Script merespons dengan HTTP status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, data: null, message: 'Koneksi ke Google Apps Script melebihi batas waktu (20 detik).' };
    }
    return { success: false, data: null, message: err.message || 'Gagal menghubungi server Apps Script.' };
  }
}

// ======================= MOCK REQUEST HANDLER =======================

async function handleMockRequest(action, payload) {
  await new Promise((r) => setTimeout(r, 20)); // Simulasi latensi cepat
  const db = getMockDb();

  switch (action) {
    case 'adminLogin':
    case 'login': {
      const u = (payload.username || (payload.credentials && payload.credentials.username) || '').trim().toLowerCase();
      const p = payload.password || (payload.credentials && payload.credentials.password) || '';
      const matched = db.users.find((x) => x.username.toLowerCase() === u && x.password === p);
      if (matched) {
        const token = 'mock-token-' + Date.now();
        const userObj = { id: matched.id, username: matched.username, nama: matched.nama, role: matched.role };
        safeSessionStorage.setItem('dprd_token', token);
        safeSessionStorage.setItem('dprd_user', JSON.stringify(userObj));
        return { success: true, data: { token, user: userObj }, message: 'Login mock berhasil.' };
      }
      return { success: false, data: null, message: 'Username atau password salah (Mock: staff / staff123).' };
    }

    case 'adminLogout':
    case 'logout':
      safeSessionStorage.removeItem('dprd_token');
      safeSessionStorage.removeItem('dprd_user');
      return { success: true, data: null, message: 'Logout berhasil.' };

    case 'getCurrentUser':
    case 'checkSession': {
      const uStr = safeSessionStorage.getItem('dprd_user');
      if (uStr) {
        return { success: true, data: JSON.parse(uStr), message: 'Sesi aktif.' };
      }
      return { success: false, data: null, message: 'Sesi tidak ditemukan.' };
    }

    case 'getDashboardData': {
      return {
        success: true,
        data: {
          totalDewan: db.dewan.length,
          totalDokumen: db.dokumen.length,
          totalKategori: db.kategori.length,
          recentDocuments: db.dokumen.slice(0, 5)
        },
        message: 'Data dashboard mock berhasil dimuat.'
      };
    }

    case 'getDewanList': {
      const q = String(payload.cari || payload.q || '').trim().toLowerCase();
      let list = db.dewan.slice();
      if (q) {
        list = list.filter((d) => d.nama.toLowerCase().includes(q) || (d.nama_partai && d.nama_partai.toLowerCase().includes(q)));
      }
      return { success: true, data: list, message: 'Daftar dewan berhasil dimuat.' };
    }

    case 'getDewanById': {
      const id = parseInt(payload.id, 10);
      const item = db.dewan.find((d) => d.id === id);
      return item ? { success: true, data: item } : { success: false, message: 'Data dewan tidak ditemukan.' };
    }

    case 'createDewan': {
      const d = payload.data || payload;
      const newId = (db.dewan.length ? Math.max(...db.dewan.map((x) => x.id)) : 0) + 1;
      const record = { id: newId, ...d, urutan: newId };
      db.dewan.push(record);
      saveMockDb(db);
      return { success: true, data: record, message: 'Dewan berhasil ditambahkan.' };
    }

    case 'updateDewan': {
      const d = payload.data || payload;
      const idx = db.dewan.findIndex((x) => String(x.id) === String(d.id));
      if (idx !== -1) {
        db.dewan[idx] = { ...db.dewan[idx], ...d };
        saveMockDb(db);
        return { success: true, data: db.dewan[idx], message: 'Dewan berhasil diperbarui.' };
      }
      return { success: false, message: 'Data dewan tidak ditemukan.' };
    }

    case 'deleteDewan': {
      const id = parseInt(payload.id, 10);
      db.dewan = db.dewan.filter((x) => x.id !== id);
      db.dokumen = db.dokumen.filter((x) => parseInt(x.dewan_id, 10) !== id);
      saveMockDb(db);
      return { success: true, message: 'Dewan berhasil dihapus.' };
    }

    case 'getKategoriList':
      return { success: true, data: db.kategori, message: 'Kategori berhasil dimuat.' };

    case 'getKategoriWithDocCount': {
      const dewanId = parseInt(payload.dewan_id, 10);
      const res = db.kategori.map((k) => {
        const count = db.dokumen.filter((d) => parseInt(d.kategori_id, 10) === k.id && (!dewanId || parseInt(d.dewan_id, 10) === dewanId)).length;
        return { id: k.id, nama_kategori: k.nama_kategori, jumlah_dokumen: count };
      });
      return { success: true, data: res, message: 'Kategori dengan jumlah dokumen berhasil dimuat.' };
    }

    case 'createKategori': {
      const nama = String(payload.nama_kategori || '').trim();
      const newId = (db.kategori.length ? Math.max(...db.kategori.map((x) => x.id)) : 0) + 1;
      const item = { id: newId, nama_kategori: nama };
      db.kategori.push(item);
      saveMockDb(db);
      return { success: true, data: item, message: 'Kategori berhasil ditambahkan.' };
    }

    case 'updateKategori': {
      const id = parseInt(payload.id, 10);
      const nama = String(payload.nama_kategori || '').trim();
      const target = db.kategori.find((k) => k.id === id);
      if (target) {
        target.nama_kategori = nama;
        saveMockDb(db);
        return { success: true, data: target, message: 'Kategori berhasil diperbarui.' };
      }
      return { success: false, message: 'Kategori tidak ditemukan.' };
    }

    case 'deleteKategori': {
      const id = parseInt(payload.id, 10);
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
        const count = db.dokumen.filter((d) => parseInt(d.dewan_id, 10) === dewanId && parseInt(d.kategori_id, 10) === katId && parseInt(d.tahun, 10) === yr).length;
        return { tahun: yr, jumlah_dokumen: count };
      }).sort((a, b) => b.tahun - a.tahun);

      return { success: true, data: list, message: 'Daftar tahun berhasil dimuat.' };
    }

    case 'createTahun': {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const yr = parseInt(payload.tahun, 10);
      const newId = (db.tahun.length ? Math.max(...db.tahun.map((x) => x.id)) : 0) + 1;
      const rec = { id: newId, dewan_id: dewanId, kategori_id: katId, tahun: yr };
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
        const count = db.dokumen.filter((d) => parseInt(d.dewan_id, 10) === dewanId && parseInt(d.kategori_id, 10) === katId && parseInt(d.tahun, 10) === yr && String(d.nama_folder).trim().toLowerCase() === String(f.nama_folder).trim().toLowerCase()).length;
        return { id: f.id, nama_folder: f.nama_folder, jumlah_dokumen: count };
      });
      return { success: true, data: res, message: 'Daftar folder berhasil dimuat.' };
    }

    case 'createFolder': {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const yr = parseInt(payload.tahun, 10);
      const nama = String(payload.nama_folder || '').trim();
      const newId = (db.folder.length ? Math.max(...db.folder.map((x) => x.id)) : 0) + 1;
      const rec = { id: newId, dewan_id: dewanId, kategori_id: katId, tahun: yr, nama_folder: nama };
      db.folder.push(rec);
      saveMockDb(db);
      return { success: true, data: rec, message: 'Folder berhasil ditambahkan.' };
    }

    case 'getDokumenList': {
      const dewanId = payload.dewan_id ? parseInt(payload.dewan_id, 10) : null;
      const katId = payload.kategori_id ? parseInt(payload.kategori_id, 10) : null;
      const yr = payload.tahun ? parseInt(payload.tahun, 10) : null;
      const folder = payload.nama_folder ? String(payload.nama_folder).trim().toLowerCase() : null;

      let list = db.dokumen.slice();
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
        uploaded_by: 'staff',
        tanggal_upload: new Date().toISOString()
      };
      db.dokumen.push(doc);
      saveMockDb(db);
      return { success: true, data: doc, message: 'Dokumen berhasil diunggah (Mock mode).' };
    }

    case 'deleteDokumen': {
      const id = parseInt(payload.id, 10);
      db.dokumen = db.dokumen.filter((d) => d.id !== id);
      saveMockDb(db);
      return { success: true, message: 'Dokumen berhasil dihapus.' };
    }

    default:
      return { success: false, message: 'Aksi mock tidak dikenali: ' + action };
  }
}

// ======================= PUBLIC API EXPORTS =======================

export const api = {
  // Auth
  login: (username, password) => callAppsScript('adminLogin', { username, password }),
  logout: () => callAppsScript('adminLogout'),
  checkSession: () => callAppsScript('getCurrentUser'),

  // Dashboard
  getDashboardData: () => callAppsScript('getDashboardData'),

  // Dewan
  getDewanList: (cari = '') => callAppsScript('getDewanList', { cari }),
  getDewanById: (id) => callAppsScript('getDewanById', { id }),
  createDewan: (data) => callAppsScript('createDewan', { data }),
  updateDewan: (data) => callAppsScript('updateDewan', { data }),
  deleteDewan: (id) => callAppsScript('deleteDewan', { id }),

  // Kategori
  getKategoriList: () => callAppsScript('getKategoriList'),
  getKategoriWithDocCount: (dewan_id) => callAppsScript('getKategoriWithDocCount', { dewan_id }),
  createKategori: (nama_kategori) => callAppsScript('createKategori', { nama_kategori }),
  updateKategori: (id, nama_kategori) => callAppsScript('updateKategori', { id, nama_kategori }),
  deleteKategori: (id) => callAppsScript('deleteKategori', { id }),

  // Tahun
  getTahunList: (dewan_id, kategori_id) => callAppsScript('getTahunList', { dewan_id, kategori_id }),
  createTahun: (dewan_id, kategori_id, tahun) => callAppsScript('createTahun', { dewan_id, kategori_id, tahun }),
  updateTahun: (dewan_id, kategori_id, tahun_lama, tahun_baru) => callAppsScript('updateTahun', { dewan_id, kategori_id, tahun_lama, tahun_baru }),
  deleteTahun: (dewan_id, kategori_id, tahun) => callAppsScript('deleteTahun', { dewan_id, kategori_id, tahun }),

  // Folder
  getFolderList: (dewan_id, kategori_id, tahun) => callAppsScript('getFolderList', { dewan_id, kategori_id, tahun }),
  createFolder: (dewan_id, kategori_id, tahun, nama_folder) => callAppsScript('createFolder', { dewan_id, kategori_id, tahun, nama_folder }),
  updateFolder: (dewan_id, kategori_id, tahun, nama_folder_lama, nama_folder_baru) => callAppsScript('updateFolder', { dewan_id, kategori_id, tahun, nama_folder_lama, nama_folder_baru }),
  deleteFolder: (dewan_id, kategori_id, tahun, nama_folder) => callAppsScript('deleteFolder', { dewan_id, kategori_id, tahun, nama_folder }),

  // Dokumen
  getDokumenList: (params) => callAppsScript('getDokumenList', params),
  getDokumenById: (id) => callAppsScript('getDokumenById', { id }),
  uploadDokumen: (data) => callAppsScript('uploadDokumen', data),
  updateDokumen: (data) => callAppsScript('updateDokumen', data),
  deleteDokumen: (id) => callAppsScript('deleteDokumen', { id })
};
