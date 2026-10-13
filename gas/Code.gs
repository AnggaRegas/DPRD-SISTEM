/**
 * @license
 * Sistem Informasi Pengarsipan Dokumen DPRD
 * Bagian Fasilitasi Penganggaran dan Pengawasan
 * Backend Google Apps Script (GAS) untuk Google Sheets & Google Drive
 *
 * Struktur Lembar Kerja (Google Sheets):
 * 1. Sheet "users"            (Kolom: id, nama, username, password_hash, role, created_at)
 * 2. Sheet "dewan"            (Kolom: id, nama, jabatan, urutan, periode, nama_pengawas, nama_partai, keterangan, created_at, updated_at)
 * 3. Sheet "kategori_dokumen" (Kolom: id, nama_kategori, created_at)
 * 4. Sheet "tahun_dokumen"    (Kolom: id, dewan_id, kategori_id, tahun, created_at)
 * 5. Sheet "folder_dokumen"   (Kolom: id, dewan_id, kategori_id, tahun, nama_folder, created_at)
 * 6. Sheet "dokumen"          (Kolom: id, dewan_id, kategori_id, tahun, nama_folder, nama_dokumen, keterangan, nama_file, file_id, direct_url, view_url, mime_type, ukuran_file, uploaded_by, tanggal_upload)
 * 7. Sheet "aktivitas_log"    (Kolom: id, waktu, username, aksi, detail)
 *
 * Konfigurasi Script Properties (File > Project Settings > Script Properties):
 * - DATABASE_ID        : ID Google Spreadsheet aplikasi
 * - ROOT_FOLDER_ID     : ID Folder Utama Google Drive
 * - DOKUMEN_FOLDER_ID  : ID Subfolder Dokumen Fisik
 * - PASSWORD_SALT      : Salt kriptografis unik SHA-256
 */

const APP_NAME = 'Sistem Pengarsipan Dokumen DPRD';
const TIMEZONE = 'Asia/Makassar';

// Urutan prioritas tampilan jabatan dewan
const JABATAN_PRIORITY = [
  'Ketua DPRD',
  'Wakil Ketua I',
  'Wakil Ketua II',
  'Wakil Ketua III',
  'Ketua Komisi I',
  'Ketua Komisi II',
  'Ketua Komisi III',
  'Wakil Ketua Komisi I',
  'Wakil Ketua Komisi II',
  'Wakil Ketua Komisi III'
];

// ---------------- SETUP & INISIALISASI (MANUAL ADMIN SATU KALI) ----------------

/**
 * Menyiapkan Spreadsheet database dan folder Google Drive baru dari nol.
 * Fungsi ini dijalankan secara MANUAL SATU KALI oleh administrator dari Apps Script Editor.
 * Sifat: IDEMPOTEN (Aman dijalankan berulang kali tanpa merusak data).
 */
function setupApp() {
  const props = PropertiesService.getScriptProperties();

  // Inisialisasi Salt Kriptografis jika belum ada
  let salt = props.getProperty('PASSWORD_SALT');
  if (!salt) {
    const seed = Utilities.getUuid() + '-' + Date.now() + '-' + Math.random().toString(36).substring(2);
    salt = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed, Utilities.Charset.UTF_8)
    ).substring(0, 32);
    props.setProperty('PASSWORD_SALT', salt);
  }

  // 1. SPREADSHEET DATABASE
  let ss = null;
  const existingDbId = props.getProperty('DATABASE_ID') || props.getProperty('SPREADSHEET_ID');

  if (existingDbId && existingDbId.trim()) {
    try {
      ss = SpreadsheetApp.openById(existingDbId.trim());
      Logger.log('Menggunakan Spreadsheet yang sudah ada: ' + ss.getId());
    } catch (e) {
      Logger.log('Spreadsheet ID lama tidak dapat dibuka: ' + e.message);
    }
  }

  if (!ss) {
    try {
      const active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) {
        ss = active;
        Logger.log('Menggunakan Bound Active Spreadsheet: ' + ss.getId());
      }
    } catch (e) {}
  }

  if (!ss) {
    ss = SpreadsheetApp.create('Database Sistem Pengarsipan Dokumen DPRD');
    Logger.log('Spreadsheet baru berhasil dibuat: ' + ss.getId());
  }

  props.setProperty('DATABASE_ID', ss.getId());

  // 2. STRUKTUR SHEET
  // Sheet users
  let usersSheet = ss.getSheetByName('users');
  if (!usersSheet) {
    usersSheet = ss.insertSheet('users');
    usersSheet.appendRow(['id', 'nama', 'username', 'password_hash', 'role', 'created_at']);
    usersSheet.setFrozenRows(1);
    
    // Seed default users
    const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
    usersSheet.appendRow(['USR-1', 'Staff Pengarsipan', 'staff', hashPasswordGAS('staff123'), 'staff', nowIso]);
    usersSheet.appendRow(['USR-2', 'Kepala Bagian', 'kabag', hashPasswordGAS('kabag123'), 'kepala_bagian', nowIso]);
    usersSheet.appendRow(['USR-3', 'Administrator DPRD', 'admin', hashPasswordGAS('admin123'), 'admin', nowIso]);
  }

  // Sheet dewan
  let dewanSheet = ss.getSheetByName('dewan');
  if (!dewanSheet) {
    dewanSheet = ss.insertSheet('dewan');
    dewanSheet.appendRow([
      'id', 'nama', 'jabatan', 'urutan', 'periode', 'nama_pengawas', 'nama_partai', 'keterangan', 'created_at', 'updated_at'
    ]);
    dewanSheet.setFrozenRows(1);

    // Seed contoh data dewan periode 2024-2029
    const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
    dewanSheet.appendRow([
      1, 'H. Andi Muhammad Fajar, S.Pd.', 'Ketua DPRD', 1, '2024–2029', 'St. Aminah, S.Sos.', 'Partai Golongan Karya', 'Pimpinan DPRD', nowIso, nowIso
    ]);
    dewanSheet.appendRow([
      2, 'Dra. Hj. Nurfadillah, M.Si.', 'Wakil Ketua I', 2, '2024–2029', 'Drs. H. Rahman, M.M.', 'Partai Nasional Demokrat', 'Pimpinan DPRD', nowIso, nowIso
    ]);
    dewanSheet.appendRow([
      3, 'Muhammad Yusuf, S.E.', 'Wakil Ketua II', 3, '2024–2029', 'Baharuddin, S.T.', 'Partai Gerakan Indonesia Raya', 'Pimpinan DPRD', nowIso, nowIso
    ]);
    dewanSheet.appendRow([
      4, 'Ir. H. Ahmad Rusdi', 'Ketua Komisi I', 4, '2024–2029', 'Fitriani, S.IP.', 'Partai Keadilan Sejahtera', 'Komisi Pemerintahan & Hukum', nowIso, nowIso
    ]);
  }

  // Sheet kategori_dokumen
  let kategoriSheet = ss.getSheetByName('kategori_dokumen');
  if (!kategoriSheet) {
    kategoriSheet = ss.insertSheet('kategori_dokumen');
    kategoriSheet.appendRow(['id', 'nama_kategori', 'created_at']);
    kategoriSheet.setFrozenRows(1);

    const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
    kategoriSheet.appendRow([1, 'Pokok-Pokok Pikiran (Pokir)', nowIso]);
    kategoriSheet.appendRow([2, 'Laporan Hasil Reses', nowIso]);
    kategoriSheet.appendRow([3, 'Fasilitasi Penganggaran (RKA/DPA)', nowIso]);
    kategoriSheet.appendRow([4, 'Fasilitasi Pengawasan', nowIso]);
    kategoriSheet.appendRow([5, 'Dokumen Perjalanan Dinas', nowIso]);
  }

  // Sheet tahun_dokumen
  let tahunSheet = ss.getSheetByName('tahun_dokumen');
  if (!tahunSheet) {
    tahunSheet = ss.insertSheet('tahun_dokumen');
    tahunSheet.appendRow(['id', 'dewan_id', 'kategori_id', 'tahun', 'created_at']);
    tahunSheet.setFrozenRows(1);
    
    const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
    tahunSheet.appendRow([1, 1, 1, 2024, nowIso]);
    tahunSheet.appendRow([2, 1, 1, 2025, nowIso]);
  }

  // Sheet folder_dokumen
  let folderSheet = ss.getSheetByName('folder_dokumen');
  if (!folderSheet) {
    folderSheet = ss.insertSheet('folder_dokumen');
    folderSheet.appendRow(['id', 'dewan_id', 'kategori_id', 'tahun', 'nama_folder', 'created_at']);
    folderSheet.setFrozenRows(1);

    const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
    folderSheet.appendRow([1, 1, 1, 2024, 'Masa Sidang I', nowIso]);
    folderSheet.appendRow([2, 1, 1, 2024, 'Masa Sidang II', nowIso]);
  }

  // Sheet dokumen
  let docSheet = ss.getSheetByName('dokumen');
  if (!docSheet) {
    docSheet = ss.insertSheet('dokumen');
    docSheet.appendRow([
      'id', 'dewan_id', 'kategori_id', 'tahun', 'nama_folder',
      'nama_dokumen', 'keterangan', 'nama_file', 'file_id',
      'direct_url', 'view_url', 'mime_type', 'ukuran_file',
      'uploaded_by', 'tanggal_upload'
    ]);
    docSheet.setFrozenRows(1);
  }

  // Sheet aktivitas_log
  let logSheet = ss.getSheetByName('aktivitas_log');
  if (!logSheet) {
    logSheet = ss.insertSheet('aktivitas_log');
    logSheet.appendRow(['id', 'waktu', 'username', 'aksi', 'detail']);
    logSheet.setFrozenRows(1);
  }

  // Hapus sheet default Sheet1 jika ada
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // 3. STRUKTUR GOOGLE DRIVE
  let rootFolder = null;
  const existingRootId = props.getProperty('ROOT_FOLDER_ID');
  if (existingRootId && existingRootId.trim()) {
    try { rootFolder = DriveApp.getFolderById(existingRootId.trim()); } catch (e) {}
  }
  if (!rootFolder) {
    rootFolder = DriveApp.createFolder('Arsip Dokumen DPRD - Penganggaran & Pengawasan');
    props.setProperty('ROOT_FOLDER_ID', rootFolder.getId());
  }

  let docFolder = null;
  const existingDocFolderId = props.getProperty('DOKUMEN_FOLDER_ID');
  if (existingDocFolderId && existingDocFolderId.trim()) {
    try { docFolder = DriveApp.getFolderById(existingDocFolderId.trim()); } catch (e) {}
  }
  if (!docFolder) {
    const existingIter = rootFolder.getFoldersByName('Dokumen Fisik');
    if (existingIter.hasNext()) {
      docFolder = existingIter.next();
    } else {
      docFolder = rootFolder.createFolder('Dokumen Fisik');
    }
    // Set permission agar berkas arsip dapat dibaca oleh pengguna sistem yang memiliki URL file
    docFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    props.setProperty('DOKUMEN_FOLDER_ID', docFolder.getId());
  }

  const resultInfo = {
    DATABASE_ID: ss.getId(),
    ROOT_FOLDER_ID: rootFolder.getId(),
    DOKUMEN_FOLDER_ID: docFolder.getId(),
    SpreadsheetUrl: ss.getUrl(),
    RootFolderUrl: rootFolder.getUrl(),
  };

  Logger.log('setupApp() berhasil dijalankan: ' + JSON.stringify(resultInfo, null, 2));
  return resultInfo;
}

// ---------------- DATABASE & DRIVE RESOLVERS ----------------

function getDatabase() {
  const props = PropertiesService.getScriptProperties();
  const dbId = props.getProperty('DATABASE_ID') || props.getProperty('SPREADSHEET_ID');
  if (dbId && dbId.trim()) {
    try {
      return SpreadsheetApp.openById(dbId.trim());
    } catch (err) {
      Logger.log('Gagal membuka spreadsheet via DATABASE_ID: ' + err.message);
    }
  }
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}
  throw new Error('Spreadsheet database belum dikonfigurasi. Harap jalankan setupApp() terlebih dahulu.');
}

function getDokumenFolder() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('DOKUMEN_FOLDER_ID');
  if (folderId && folderId.trim()) {
    try {
      return DriveApp.getFolderById(folderId.trim());
    } catch (e) {}
  }
  const rootId = props.getProperty('ROOT_FOLDER_ID');
  if (rootId && rootId.trim()) {
    try {
      const root = DriveApp.getFolderById(rootId.trim());
      const iter = root.getFoldersByName('Dokumen Fisik');
      if (iter.hasNext()) return iter.next();
      return root;
    } catch (e) {}
  }
  return DriveApp.getRootFolder();
}

// ---------------- KEAMANAN & AUTENTIKASI ----------------

function getPasswordSalt() {
  const props = PropertiesService.getScriptProperties();
  let salt = props.getProperty('PASSWORD_SALT');
  if (!salt) {
    salt = 'DPRD_SISTEM_SALT_SECURE_2026';
    props.setProperty('PASSWORD_SALT', salt);
  }
  return salt;
}

function hashPasswordGAS(password) {
  const salt = getPasswordSalt();
  const rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + '_' + salt,
    Utilities.Charset.UTF_8
  );
  let hash = '';
  for (let i = 0; i < rawBytes.length; i++) {
    let byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hash += byteHex;
  }
  return hash;
}

function sanitizeSheetValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const str = String(value);
  const formulaTriggers = ['=', '+', '-', '@', '\t', '\r'];
  if (str.length > 0 && formulaTriggers.indexOf(str.charAt(0)) !== -1) {
    return "'" + str;
  }
  return str;
}

function verifySession(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Akses ditolak. Token sesi autentikasi tidak ditemukan.');
  }
  const cleanToken = token.trim();
  if (cleanToken.length < 16) {
    throw new Error('Akses ditolak. Format token sesi tidak valid.');
  }
  const cache = CacheService.getScriptCache();
  const sessionData = cache.get('session_' + cleanToken);
  if (!sessionData) {
    throw new Error('Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.');
  }
  try {
    const session = JSON.parse(sessionData);
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      cache.remove('session_' + cleanToken);
      throw new Error('Sesi telah kedaluwarsa. Silakan login kembali.');
    }
    return session;
  } catch (err) {
    throw new Error('Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.');
  }
}

function checkLoginRateLimit(identifier) {
  const cache = CacheService.getScriptCache();
  const lockoutKey = 'lockout_' + identifier;
  const isLocked = cache.get(lockoutKey);
  if (isLocked) {
    return {
      allowed: false,
      message: 'Terlalu banyak percobaan login gagal. Akun dikunci sementara. Silakan coba lagi dalam 15 menit.'
    };
  }
  return { allowed: true };
}

function recordFailedLogin(identifier) {
  const cache = CacheService.getScriptCache();
  const lockoutKey = 'lockout_' + identifier;
  const attemptsKey = 'attempts_' + identifier;
  let attempts = parseInt(cache.get(attemptsKey) || '0', 10) + 1;
  let isLocked = false;
  if (attempts >= 5) {
    cache.put(lockoutKey, 'true', 900); // 15 menit
    cache.remove(attemptsKey);
    isLocked = true;
  } else {
    cache.put(attemptsKey, String(attempts), 900);
  }
  return isLocked;
}

function resetFailedLogin(identifier) {
  const cache = CacheService.getScriptCache();
  cache.remove('attempts_' + identifier);
  cache.remove('lockout_' + identifier);
}

// ---------------- LOGGING AKTIVITAS ----------------

function recordActivity(ss, username, aksi, detail) {
  try {
    const sheet = ss.getSheetByName('aktivitas_log');
    if (!sheet) return;
    const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const id = Utilities.getUuid().substring(0, 8);
    sheet.appendRow([
      id,
      nowIso,
      sanitizeSheetValue(username || 'system'),
      sanitizeSheetValue(aksi),
      sanitizeSheetValue(detail)
    ]);
  } catch (e) {
    Logger.log('Gagal mencatat log aktivitas: ' + e.message);
  }
}

// ---------------- HELPER GOOGLE SHEETS TABEL ----------------

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(function(h) { return String(h || '').trim(); });
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    // Abaikan baris kosong
    if (row.every(function(cell) { return cell === '' || cell === null || cell === undefined; })) {
      continue;
    }
    const item = { _rowIndex: i + 1 };
    for (let j = 0; j < headers.length; j++) {
      item[headers[j]] = row[j];
    }
    rows.push(item);
  }
  return rows;
}

function jsonResponse(success, data, message, errorCode) {
  const payload = {
    success: Boolean(success),
    data: data !== undefined ? data : null,
    message: message || '',
    error: errorCode ? { code: errorCode } : null
  };
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------- HANDLER UTAMA: doGet(e) ----------------

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';

  try {
    const ss = getDatabase();

    switch (action) {
      case 'ping':
        return jsonResponse(true, {
          app: APP_NAME,
          status: 'online',
          serverTime: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
        }, 'Sistem Pengarsipan DPRD aktif.');

      case 'getPublicStats': {
        const dewan = getSheetData(ss, 'dewan');
        const docs = getSheetData(ss, 'dokumen');
        const kat = getSheetData(ss, 'kategori_dokumen');
        return jsonResponse(true, {
          totalDewan: dewan.length,
          totalDokumen: docs.length,
          totalKategori: kat.length
        }, 'Statistik umum berhasil dimuat.');
      }

      default:
        return jsonResponse(false, null, 'Aksi GET tidak dikenali: ' + action, 'NOT_FOUND');
    }
  } catch (err) {
    return jsonResponse(false, null, err.message, 'GAS_GET_ERROR');
  }
}

// ---------------- HANDLER UTAMA: doPost(e) ----------------

function doPost(e) {
  // Gunakan ScriptLock agar operasi penulisan dari hingga 5 komputer bersamaan aman dan atomik
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse(false, null, 'Tidak ada data yang dikirimkan.', 'EMPTY_REQUEST');
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const token = payload.token;

    const ss = getDatabase();

    // 1. AUTH: LOGIN
    if (action === 'adminLogin' || action === 'login') {
      const creds = payload.credentials || payload.data || payload;
      const username = String(creds.username || '').trim().toLowerCase();
      const password = String(creds.password || '');

      if (!username || !password) {
        return jsonResponse(false, null, 'Username dan kata sandi wajib diisi.', 'VALIDATION_ERROR');
      }

      const rateCheck = checkLoginRateLimit(username);
      if (!rateCheck.allowed) {
        return jsonResponse(false, null, rateCheck.message, 'TOO_MANY_REQUESTS');
      }

      const users = getSheetData(ss, 'users');
      const inputHash = hashPasswordGAS(password);
      const matchedUser = users.find(function(u) {
        if (String(u.username || '').toLowerCase() !== username) return false;
        // Cocokkan hash SHA-256 + salt
        if (String(u.password_hash || '') === inputHash) return true;
        // Fallback: Cocokkan kolom password atau password_hash plaintext (kompatibilitas migrasi)
        const rawPass = String(u.password || u.password_hash || '');
        if (rawPass && rawPass === password) return true;
        return false;
      });

      if (!matchedUser) {
        const isLocked = recordFailedLogin(username);
        return jsonResponse(
          false,
          null,
          isLocked
            ? 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.'
            : 'Username atau kata sandi tidak valid.',
          isLocked ? 'TOO_MANY_REQUESTS' : 'INVALID_CREDENTIALS'
        );
      }

      resetFailedLogin(username);

      // Buat session token acak
      const rawSeed = Utilities.getUuid() + '-' + Date.now() + '-' + Math.random().toString(36);
      const tokenDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawSeed, Utilities.Charset.UTF_8);
      const sessionToken = Utilities.base64EncodeWebSafe(tokenDigest).replace(/=+$/, '');

      const ttlSeconds = 21600; // 6 jam
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      const sessionObj = {
        userId: matchedUser.id,
        username: matchedUser.username,
        nama: matchedUser.nama,
        role: matchedUser.role,
        expiresAt: expiresAt
      };

      CacheService.getScriptCache().put('session_' + sessionToken, JSON.stringify(sessionObj), ttlSeconds);
      recordActivity(ss, matchedUser.username, 'LOGIN', 'Pengguna berhasil masuk ke sistem');

      return jsonResponse(true, {
        token: sessionToken,
        user: sessionObj
      }, 'Login berhasil.');
    }

    // 2. AUTH: LOGOUT
    if (action === 'adminLogout' || action === 'logout') {
      if (token) {
        CacheService.getScriptCache().remove('session_' + token);
      }
      return jsonResponse(true, null, 'Logout berhasil.');
    }

    // 3. AUTH: CHECK SESSION
    if (action === 'getCurrentUser' || action === 'checkSession') {
      const session = verifySession(token);
      return jsonResponse(true, session, 'Sesi aktif.');
    }

    // Operasi selanjutnya memerlukan otorisasi session valid!
    const userSession = verifySession(token);

    // Kunci ScriptLock untuk seluruh operasi penulisan data
    const isWriteAction = [
      'createDewan', 'updateDewan', 'deleteDewan',
      'createKategori', 'updateKategori', 'deleteKategori',
      'createTahun', 'updateTahun', 'deleteTahun',
      'createFolder', 'updateFolder', 'deleteFolder',
      'uploadDokumen', 'updateDokumen', 'deleteDokumen'
    ].indexOf(action) !== -1;

    if (isWriteAction) {
      lock.waitLock(15000); // Tunggu hingga 15 detik jika ada antrian tulis
      lockAcquired = true;
    }

    // 4. DASHBOARD DATA
    if (action === 'getDashboardData') {
      const dewanList = getSheetData(ss, 'dewan');
      const docList = getSheetData(ss, 'dokumen');
      const katList = getSheetData(ss, 'kategori_dokumen');

      // Ambil 5 dokumen terbaru
      const sortedDocs = docList.slice().sort(function(a, b) {
        return new Date(b.tanggal_upload || 0).getTime() - new Date(a.tanggal_upload || 0).getTime();
      }).slice(0, 5);

      return jsonResponse(true, {
        totalDewan: dewanList.length,
        totalDokumen: docList.length,
        totalKategori: katList.length,
        recentDocuments: sortedDocs
      }, 'Data dashboard berhasil dimuat.');
    }

    // 5. ANGGOTA DEWAN CRUD
    if (action === 'getDewanList') {
      const dewanList = getSheetData(ss, 'dewan');
      const search = String(payload.cari || payload.q || '').trim().toLowerCase();

      let filtered = dewanList;
      if (search) {
        filtered = dewanList.filter(function(d) {
          return String(d.nama || '').toLowerCase().indexOf(search) !== -1 ||
                 String(d.nama_partai || '').toLowerCase().indexOf(search) !== -1 ||
                 String(d.jabatan || '').toLowerCase().indexOf(search) !== -1;
        });
      }

      // Urutkan berdasarkan prioritas jabatan, kemudian urutan, kemudian nama
      filtered.sort(function(a, b) {
        const getPriority = function(jab) {
          const j = String(jab || '');
          for (let i = 0; i < JABATAN_PRIORITY.length; i++) {
            if (j.indexOf(JABATAN_PRIORITY[i]) === 0) return i + 1;
          }
          return 99;
        };
        const pA = getPriority(a.jabatan);
        const pB = getPriority(b.jabatan);
        if (pA !== pB) return pA - pB;
        const uA = Number(a.urutan) || 999;
        const uB = Number(b.urutan) || 999;
        if (uA !== uB) return uA - uB;
        return String(a.nama || '').localeCompare(String(b.nama || ''));
      });

      return jsonResponse(true, filtered, 'Daftar anggota dewan berhasil dimuat.');
    }

    if (action === 'getDewanById') {
      const id = String(payload.id || '');
      const dewanList = getSheetData(ss, 'dewan');
      const item = dewanList.find(function(d) { return String(d.id) === id; });
      if (!item) return jsonResponse(false, null, 'Data anggota dewan tidak ditemukan.', 'NOT_FOUND');
      return jsonResponse(true, item, 'Data anggota dewan ditemukan.');
    }

    if (action === 'createDewan') {
      const data = payload.data || payload;
      const nama = String(data.nama || '').trim();
      const jabatan = String(data.jabatan || '').trim();
      const periode = String(data.periode || '').trim();
      const nama_partai = String(data.nama_partai || '').trim();
      const nama_pengawas = String(data.nama_pengawas || '').trim();
      const keterangan = String(data.keterangan || '').trim();

      if (!nama || !jabatan || !periode || !nama_partai) {
        return jsonResponse(false, null, 'Nama, jabatan, periode, dan partai wajib diisi.', 'VALIDATION_ERROR');
      }

      const dewanSheet = ss.getSheetByName('dewan');
      const dewanList = getSheetData(ss, 'dewan');

      // Cek nama duplikat
      const exist = dewanList.some(function(d) {
        return String(d.nama || '').trim().toLowerCase() === nama.toLowerCase();
      });
      if (exist) {
        return jsonResponse(false, null, 'Nama anggota dewan sudah terdaftar.', 'DUPLICATE_NAME');
      }

      // Tentukan ID dan urutan baru
      let maxId = 0;
      let maxUrutan = 0;
      dewanList.forEach(function(d) {
        const numId = parseInt(d.id, 10);
        if (!isNaN(numId) && numId > maxId) maxId = numId;
        const numUrutan = parseInt(d.urutan, 10);
        if (!isNaN(numUrutan) && numUrutan > maxUrutan) maxUrutan = numUrutan;
      });

      const newId = maxId + 1;
      const newUrutan = maxUrutan + 1;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      dewanSheet.appendRow([
        newId,
        sanitizeSheetValue(nama),
        sanitizeSheetValue(jabatan),
        newUrutan,
        sanitizeSheetValue(periode),
        sanitizeSheetValue(nama_pengawas),
        sanitizeSheetValue(nama_partai),
        sanitizeSheetValue(keterangan),
        nowIso,
        nowIso
      ]);

      recordActivity(ss, userSession.username, 'TAMBAH_DEWAN', 'Menambah dewan: ' + nama);
      return jsonResponse(true, { id: newId }, 'Data anggota dewan berhasil ditambahkan.');
    }

    if (action === 'updateDewan') {
      const data = payload.data || payload;
      const id = String(data.id || '');
      const nama = String(data.nama || '').trim();
      const jabatan = String(data.jabatan || '').trim();
      const periode = String(data.periode || '').trim();
      const nama_partai = String(data.nama_partai || '').trim();
      const nama_pengawas = String(data.nama_pengawas || '').trim();
      const keterangan = String(data.keterangan || '').trim();

      if (!id || !nama || !jabatan || !periode || !nama_partai) {
        return jsonResponse(false, null, 'Data tidak lengkap.', 'VALIDATION_ERROR');
      }

      const dewanSheet = ss.getSheetByName('dewan');
      const dewanList = getSheetData(ss, 'dewan');
      const target = dewanList.find(function(d) { return String(d.id) === id; });
      if (!target) return jsonResponse(false, null, 'Data anggota dewan tidak ditemukan.', 'NOT_FOUND');

      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
      const rowIndex = target._rowIndex;

      // Update kolom: nama, jabatan, periode, nama_pengawas, nama_partai, keterangan, updated_at
      dewanSheet.getRange(rowIndex, 2).setValue(sanitizeSheetValue(nama));
      dewanSheet.getRange(rowIndex, 3).setValue(sanitizeSheetValue(jabatan));
      dewanSheet.getRange(rowIndex, 5).setValue(sanitizeSheetValue(periode));
      dewanSheet.getRange(rowIndex, 6).setValue(sanitizeSheetValue(nama_pengawas));
      dewanSheet.getRange(rowIndex, 7).setValue(sanitizeSheetValue(nama_partai));
      dewanSheet.getRange(rowIndex, 8).setValue(sanitizeSheetValue(keterangan));
      dewanSheet.getRange(rowIndex, 10).setValue(nowIso);

      recordActivity(ss, userSession.username, 'EDIT_DEWAN', 'Memperbarui dewan ID ' + id + ': ' + nama);
      return jsonResponse(true, { id: id }, 'Data anggota dewan berhasil diperbarui.');
    }

    if (action === 'deleteDewan') {
      const id = String(payload.id || '');
      if (!id) return jsonResponse(false, null, 'ID dewan diperlukan.', 'VALIDATION_ERROR');

      const dewanSheet = ss.getSheetByName('dewan');
      const dewanList = getSheetData(ss, 'dewan');
      const target = dewanList.find(function(d) { return String(d.id) === id; });
      if (!target) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');

      // Hapus seluruh dokumen terkait dan berkas Drive fisiknya
      const docSheet = ss.getSheetByName('dokumen');
      const docList = getSheetData(ss, 'dokumen');
      const docsToDelete = docList.filter(function(dc) { return String(dc.dewan_id) === id; });

      docsToDelete.forEach(function(dc) {
        if (dc.file_id) {
          try {
            DriveApp.getFileById(dc.file_id).setTrashed(true);
          } catch (e) {}
        }
      });

      // Hapus baris dokumen dari bawah ke atas agar indeks tidak bergeser
      const docRows = docsToDelete.map(function(dc) { return dc._rowIndex; }).sort(function(a, b) { return b - a; });
      docRows.forEach(function(r) { docSheet.deleteRow(r); });

      // Hapus baris dewan
      dewanSheet.deleteRow(target._rowIndex);

      recordActivity(ss, userSession.username, 'HAPUS_DEWAN', 'Menghapus dewan ID ' + id + ': ' + target.nama);
      return jsonResponse(true, null, 'Data anggota dewan dan berkas terkait berhasil dihapus.');
    }

    // 6. KATEGORI DOKUMEN CRUD
    if (action === 'getKategoriList') {
      const katList = getSheetData(ss, 'kategori_dokumen');
      katList.sort(function(a, b) { return String(a.nama_kategori || '').localeCompare(String(b.nama_kategori || '')); });
      return jsonResponse(true, katList, 'Daftar kategori berhasil dimuat.');
    }

    if (action === 'getKategoriWithDocCount') {
      const dewanId = String(payload.dewan_id || '');
      const katList = getSheetData(ss, 'kategori_dokumen');
      const docList = getSheetData(ss, 'dokumen');

      const result = katList.map(function(k) {
        const count = docList.filter(function(d) {
          return String(d.kategori_id) === String(k.id) && (!dewanId || String(d.dewan_id) === dewanId);
        }).length;
        return {
          id: k.id,
          nama_kategori: k.nama_kategori,
          jumlah_dokumen: count
        };
      });

      result.sort(function(a, b) { return String(a.nama_kategori || '').localeCompare(String(b.nama_kategori || '')); });
      return jsonResponse(true, result, 'Daftar kategori dengan jumlah dokumen berhasil dimuat.');
    }

    if (action === 'createKategori') {
      const nama = String(payload.nama_kategori || (payload.data && payload.data.nama_kategori) || '').trim();
      if (!nama) return jsonResponse(false, null, 'Nama kategori wajib diisi.', 'VALIDATION_ERROR');

      const katSheet = ss.getSheetByName('kategori_dokumen');
      const katList = getSheetData(ss, 'kategori_dokumen');
      const exist = katList.some(function(k) {
        return String(k.nama_kategori || '').trim().toLowerCase() === nama.toLowerCase();
      });
      if (exist) return jsonResponse(false, null, 'Kategori tersebut sudah tersedia.', 'DUPLICATE');

      let maxId = 0;
      katList.forEach(function(k) {
        const nid = parseInt(k.id, 10);
        if (!isNaN(nid) && nid > maxId) maxId = nid;
      });
      const newId = maxId + 1;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      katSheet.appendRow([newId, sanitizeSheetValue(nama), nowIso]);
      recordActivity(ss, userSession.username, 'TAMBAH_KATEGORI', 'Menambah kategori: ' + nama);
      return jsonResponse(true, { id: newId, nama_kategori: nama }, 'Kategori berhasil ditambahkan.');
    }

    if (action === 'updateKategori') {
      const id = String(payload.id || '');
      const nama = String(payload.nama_kategori || '').trim();
      if (!id || !nama) return jsonResponse(false, null, 'Data tidak lengkap.', 'VALIDATION_ERROR');

      const katSheet = ss.getSheetByName('kategori_dokumen');
      const katList = getSheetData(ss, 'kategori_dokumen');
      const target = katList.find(function(k) { return String(k.id) === id; });
      if (!target) return jsonResponse(false, null, 'Kategori tidak ditemukan.', 'NOT_FOUND');

      katSheet.getRange(target._rowIndex, 2).setValue(sanitizeSheetValue(nama));
      recordActivity(ss, userSession.username, 'EDIT_KATEGORI', 'Mengubah kategori ID ' + id + ': ' + nama);
      return jsonResponse(true, { id: id, nama_kategori: nama }, 'Kategori berhasil diperbarui.');
    }

    if (action === 'deleteKategori') {
      const id = String(payload.id || '');
      const katSheet = ss.getSheetByName('kategori_dokumen');
      const katList = getSheetData(ss, 'kategori_dokumen');
      const target = katList.find(function(k) { return String(k.id) === id; });
      if (!target) return jsonResponse(false, null, 'Kategori tidak ditemukan.', 'NOT_FOUND');

      // Cek apakah masih ada dokumen dalam kategori ini
      const docList = getSheetData(ss, 'dokumen');
      const docCount = docList.filter(function(d) { return String(d.kategori_id) === id; }).length;
      if (docCount > 0) {
        return jsonResponse(false, null, 'Kategori tidak dapat dihapus karena masih memiliki ' + docCount + ' dokumen.', 'HAS_DOCUMENTS');
      }

      katSheet.deleteRow(target._rowIndex);
      recordActivity(ss, userSession.username, 'HAPUS_KATEGORI', 'Menghapus kategori ID ' + id);
      return jsonResponse(true, null, 'Kategori berhasil dihapus.');
    }

    // 7. TAHUN DOKUMEN CRUD
    if (action === 'getTahunList') {
      const dewanId = String(payload.dewan_id || '');
      const kategoriId = String(payload.kategori_id || '');

      const tahunManual = getSheetData(ss, 'tahun_dokumen').filter(function(t) {
        return String(t.dewan_id) === dewanId && String(t.kategori_id) === kategoriId;
      });

      const docs = getSheetData(ss, 'dokumen').filter(function(d) {
        return String(d.dewan_id) === dewanId && String(d.kategori_id) === kategoriId;
      });

      // Gabungkan tahun dari tabel tahun_dokumen dan dokumen (UNION)
      const tahunSet = {};
      tahunManual.forEach(function(t) {
        if (t.tahun) tahunSet[String(t.tahun)] = true;
      });
      docs.forEach(function(d) {
        if (d.tahun) tahunSet[String(d.tahun)] = true;
      });

      const result = Object.keys(tahunSet).map(function(yr) {
        const count = docs.filter(function(d) { return String(d.tahun) === yr; }).length;
        return {
          tahun: parseInt(yr, 10),
          jumlah_dokumen: count
        };
      });

      result.sort(function(a, b) { return b.tahun - a.tahun; });
      return jsonResponse(true, result, 'Daftar tahun berhasil dimuat.');
    }

    if (action === 'createTahun') {
      const dewanId = String(payload.dewan_id || '');
      const kategoriId = String(payload.kategori_id || '');
      const tahun = parseInt(payload.tahun, 10);

      if (!dewanId || !kategoriId || isNaN(tahun) || tahun < 1900 || tahun > 2100) {
        return jsonResponse(false, null, 'Data tahun tidak valid.', 'VALIDATION_ERROR');
      }

      const tahunSheet = ss.getSheetByName('tahun_dokumen');
      const tahunList = getSheetData(ss, 'tahun_dokumen');
      const exist = tahunList.some(function(t) {
        return String(t.dewan_id) === dewanId && String(t.kategori_id) === kategoriId && parseInt(t.tahun, 10) === tahun;
      });
      if (exist) {
        return jsonResponse(false, null, 'Folder tahun tersebut sudah ada.', 'DUPLICATE_YEAR');
      }

      let maxId = 0;
      tahunList.forEach(function(t) {
        const nid = parseInt(t.id, 10);
        if (!isNaN(nid) && nid > maxId) maxId = nid;
      });
      const newId = maxId + 1;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      tahunSheet.appendRow([newId, dewanId, kategoriId, tahun, nowIso]);
      recordActivity(ss, userSession.username, 'TAMBAH_TAHUN', 'Menambah tahun ' + tahun + ' untuk dewan ' + dewanId);
      return jsonResponse(true, { id: newId, tahun: tahun }, 'Folder tahun berhasil ditambahkan.');
    }

    if (action === 'updateTahun') {
      const dewanId = String(payload.dewan_id || '');
      const kategoriId = String(payload.kategori_id || '');
      const tahunLama = parseInt(payload.tahun_lama, 10);
      const tahunBaru = parseInt(payload.tahun_baru || payload.tahun, 10);

      if (!dewanId || !kategoriId || isNaN(tahunLama) || isNaN(tahunBaru)) {
        return jsonResponse(false, null, 'Data tahun tidak valid.', 'VALIDATION_ERROR');
      }

      // Update di tahun_dokumen
      const tahunSheet = ss.getSheetByName('tahun_dokumen');
      const tahunList = getSheetData(ss, 'tahun_dokumen');
      tahunList.forEach(function(t) {
        if (String(t.dewan_id) === dewanId && String(t.kategori_id) === kategoriId && parseInt(t.tahun, 10) === tahunLama) {
          tahunSheet.getRange(t._rowIndex, 4).setValue(tahunBaru);
        }
      });

      // Update di folder_dokumen
      const folderSheet = ss.getSheetByName('folder_dokumen');
      const folderList = getSheetData(ss, 'folder_dokumen');
      folderList.forEach(function(f) {
        if (String(f.dewan_id) === dewanId && String(f.kategori_id) === kategoriId && parseInt(f.tahun, 10) === tahunLama) {
          folderSheet.getRange(f._rowIndex, 4).setValue(tahunBaru);
        }
      });

      // Update di dokumen
      const docSheet = ss.getSheetByName('dokumen');
      const docList = getSheetData(ss, 'dokumen');
      docList.forEach(function(d) {
        if (String(d.dewan_id) === dewanId && String(d.kategori_id) === kategoriId && parseInt(d.tahun, 10) === tahunLama) {
          docSheet.getRange(d._rowIndex, 4).setValue(tahunBaru);
        }
      });

      recordActivity(ss, userSession.username, 'EDIT_TAHUN', 'Mengubah tahun ' + tahunLama + ' menjadi ' + tahunBaru);
      return jsonResponse(true, { tahun: tahunBaru }, 'Tahun berhasil diperbarui.');
    }

    if (action === 'deleteTahun') {
      const dewanId = String(payload.dewan_id || '');
      const kategoriId = String(payload.kategori_id || '');
      const tahun = parseInt(payload.tahun, 10);

      if (!dewanId || !kategoriId || isNaN(tahun)) {
        return jsonResponse(false, null, 'Parameter tidak lengkap.', 'VALIDATION_ERROR');
      }

      // Hapus dokumen terkait dan berkas Drive fisiknya
      const docSheet = ss.getSheetByName('dokumen');
      const docList = getSheetData(ss, 'dokumen');
      const docsToDelete = docList.filter(function(d) {
        return String(d.dewan_id) === dewanId && String(d.kategori_id) === kategoriId && parseInt(d.tahun, 10) === tahun;
      });

      docsToDelete.forEach(function(d) {
        if (d.file_id) {
          try { DriveApp.getFileById(d.file_id).setTrashed(true); } catch (e) {}
        }
      });
      const docRows = docsToDelete.map(function(d) { return d._rowIndex; }).sort(function(a, b) { return b - a; });
      docRows.forEach(function(r) { docSheet.deleteRow(r); });

      // Hapus folder terkait
      const folderSheet = ss.getSheetByName('folder_dokumen');
      const folderList = getSheetData(ss, 'folder_dokumen');
      const foldersToDelete = folderList.filter(function(f) {
        return String(f.dewan_id) === dewanId && String(f.kategori_id) === kategoriId && parseInt(f.tahun, 10) === tahun;
      });
      const folderRows = foldersToDelete.map(function(f) { return f._rowIndex; }).sort(function(a, b) { return b - a; });
      folderRows.forEach(function(r) { folderSheet.deleteRow(r); });

      // Hapus tahun
      const tahunSheet = ss.getSheetByName('tahun_dokumen');
      const tahunList = getSheetData(ss, 'tahun_dokumen');
      const tahunToDelete = tahunList.filter(function(t) {
        return String(t.dewan_id) === dewanId && String(t.kategori_id) === kategoriId && parseInt(t.tahun, 10) === tahun;
      });
      const tahunRows = tahunToDelete.map(function(t) { return t._rowIndex; }).sort(function(a, b) { return b - a; });
      tahunRows.forEach(function(r) { tahunSheet.deleteRow(r); });

      recordActivity(ss, userSession.username, 'HAPUS_TAHUN', 'Menghapus tahun ' + tahun);
      return jsonResponse(true, null, 'Tahun dan seluruh dokumen di dalamnya berhasil dihapus.');
    }

    // 8. FOLDER DOKUMEN CRUD
    if (action === 'getFolderList') {
      const dewanId = String(payload.dewan_id || '');
      const kategoriId = String(payload.kategori_id || '');
      const tahun = parseInt(payload.tahun, 10);

      const folderList = getSheetData(ss, 'folder_dokumen').filter(function(f) {
        return String(f.dewan_id) === dewanId && String(f.kategori_id) === kategoriId && parseInt(f.tahun, 10) === tahun;
      });

      const docs = getSheetData(ss, 'dokumen').filter(function(d) {
        return String(d.dewan_id) === dewanId && String(d.kategori_id) === kategoriId && parseInt(d.tahun, 10) === tahun;
      });

      const result = folderList.map(function(f) {
        const count = docs.filter(function(d) {
          return String(d.nama_folder || '').trim().toLowerCase() === String(f.nama_folder || '').trim().toLowerCase();
        }).length;
        return {
          id: f.id,
          nama_folder: f.nama_folder,
          jumlah_dokumen: count
        };
      });

      result.sort(function(a, b) { return String(a.nama_folder || '').localeCompare(String(b.nama_folder || '')); });
      return jsonResponse(true, result, 'Daftar folder berhasil dimuat.');
    }

    if (action === 'createFolder') {
      const dewanId = String(payload.dewan_id || '');
      const kategoriId = String(payload.kategori_id || '');
      const tahun = parseInt(payload.tahun, 10);
      const namaFolder = String(payload.nama_folder || '').trim();

      if (!dewanId || !kategoriId || isNaN(tahun) || !namaFolder) {
        return jsonResponse(false, null, 'Data folder tidak lengkap.', 'VALIDATION_ERROR');
      }

      const folderSheet = ss.getSheetByName('folder_dokumen');
      const folderList = getSheetData(ss, 'folder_dokumen');
      const exist = folderList.some(function(f) {
        return String(f.dewan_id) === dewanId &&
               String(f.kategori_id) === kategoriId &&
               parseInt(f.tahun, 10) === tahun &&
               String(f.nama_folder || '').trim().toLowerCase() === namaFolder.toLowerCase();
      });
      if (exist) {
        return jsonResponse(false, null, 'Nama folder tersebut sudah digunakan.', 'DUPLICATE_FOLDER');
      }

      let maxId = 0;
      folderList.forEach(function(f) {
        const nid = parseInt(f.id, 10);
        if (!isNaN(nid) && nid > maxId) maxId = nid;
      });
      const newId = maxId + 1;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      folderSheet.appendRow([newId, dewanId, kategoriId, tahun, sanitizeSheetValue(namaFolder), nowIso]);
      recordActivity(ss, userSession.username, 'TAMBAH_FOLDER', 'Menambah folder ' + namaFolder);
      return jsonResponse(true, { id: newId, nama_folder: namaFolder }, 'Folder berhasil ditambahkan.');
    }

    if (action === 'updateFolder') {
      const dewanId = String(payload.dewan_id || '');
      const kategoriId = String(payload.kategori_id || '');
      const tahun = parseInt(payload.tahun, 10);
      const namaLama = String(payload.nama_folder_lama || '').trim();
      const namaBaru = String(payload.nama_folder || payload.nama_folder_baru || '').trim();

      if (!dewanId || !kategoriId || isNaN(tahun) || !namaLama || !namaBaru) {
        return jsonResponse(false, null, 'Data folder tidak lengkap.', 'VALIDATION_ERROR');
      }

      const folderSheet = ss.getSheetByName('folder_dokumen');
      const folderList = getSheetData(ss, 'folder_dokumen');

      // Cek apakah nama baru sudah digunakan oleh folder lain
      const exist = folderList.some(function(f) {
        return String(f.dewan_id) === dewanId &&
               String(f.kategori_id) === kategoriId &&
               parseInt(f.tahun, 10) === tahun &&
               String(f.nama_folder || '').trim().toLowerCase() === namaBaru.toLowerCase() &&
               String(f.nama_folder || '').trim().toLowerCase() !== namaLama.toLowerCase();
      });
      if (exist) {
        return jsonResponse(false, null, 'Nama folder tersebut sudah digunakan.', 'DUPLICATE_FOLDER');
      }

      // Update folder_dokumen
      folderList.forEach(function(f) {
        if (String(f.dewan_id) === dewanId &&
            String(f.kategori_id) === kategoriId &&
            parseInt(f.tahun, 10) === tahun &&
            String(f.nama_folder || '').trim().toLowerCase() === namaLama.toLowerCase()) {
          folderSheet.getRange(f._rowIndex, 5).setValue(sanitizeSheetValue(namaBaru));
        }
      });

      // Update nama_folder pada dokumen terkait
      const docSheet = ss.getSheetByName('dokumen');
      const docList = getSheetData(ss, 'dokumen');
      docList.forEach(function(d) {
        if (String(d.dewan_id) === dewanId &&
            String(d.kategori_id) === kategoriId &&
            parseInt(d.tahun, 10) === tahun &&
            String(d.nama_folder || '').trim().toLowerCase() === namaLama.toLowerCase()) {
          docSheet.getRange(d._rowIndex, 5).setValue(sanitizeSheetValue(namaBaru));
        }
      });

      recordActivity(ss, userSession.username, 'EDIT_FOLDER', 'Mengubah nama folder dari ' + namaLama + ' menjadi ' + namaBaru);
      return jsonResponse(true, { nama_folder: namaBaru }, 'Folder berhasil diperbarui.');
    }

    if (action === 'deleteFolder') {
      const dewanId = String(payload.dewan_id || '');
      const kategoriId = String(payload.kategori_id || '');
      const tahun = parseInt(payload.tahun, 10);
      const namaFolder = String(payload.nama_folder || '').trim();

      if (!dewanId || !kategoriId || isNaN(tahun) || !namaFolder) {
        return jsonResponse(false, null, 'Data tidak lengkap.', 'VALIDATION_ERROR');
      }

      // Hapus seluruh dokumen di folder ini dan berkas Drive fisiknya
      const docSheet = ss.getSheetByName('dokumen');
      const docList = getSheetData(ss, 'dokumen');
      const docsToDelete = docList.filter(function(d) {
        return String(d.dewan_id) === dewanId &&
               String(d.kategori_id) === kategoriId &&
               parseInt(d.tahun, 10) === tahun &&
               String(d.nama_folder || '').trim().toLowerCase() === namaFolder.toLowerCase();
      });

      docsToDelete.forEach(function(d) {
        if (d.file_id) {
          try { DriveApp.getFileById(d.file_id).setTrashed(true); } catch (e) {}
        }
      });
      const docRows = docsToDelete.map(function(d) { return d._rowIndex; }).sort(function(a, b) { return b - a; });
      docRows.forEach(function(r) { docSheet.deleteRow(r); });

      // Hapus entri folder
      const folderSheet = ss.getSheetByName('folder_dokumen');
      const folderList = getSheetData(ss, 'folder_dokumen');
      const foldersToDelete = folderList.filter(function(f) {
        return String(f.dewan_id) === dewanId &&
               String(f.kategori_id) === kategoriId &&
               parseInt(f.tahun, 10) === tahun &&
               String(f.nama_folder || '').trim().toLowerCase() === namaFolder.toLowerCase();
      });
      const folderRows = foldersToDelete.map(function(f) { return f._rowIndex; }).sort(function(a, b) { return b - a; });
      folderRows.forEach(function(r) { folderSheet.deleteRow(r); });

      recordActivity(ss, userSession.username, 'HAPUS_FOLDER', 'Menghapus folder ' + namaFolder);
      return jsonResponse(true, null, 'Folder dan dokumen di dalamnya berhasil dihapus.');
    }

    // 9. DOKUMEN CRUD & GOOGLE DRIVE UPLOAD
    if (action === 'getDokumenList') {
      const dewanId = String(payload.dewan_id || '');
      const kategoriId = String(payload.kategori_id || '');
      const tahun = payload.tahun !== undefined && payload.tahun !== '' ? parseInt(payload.tahun, 10) : null;
      const namaFolder = String(payload.nama_folder || '').trim().toLowerCase();

      let docs = getSheetData(ss, 'dokumen');

      if (dewanId) {
        docs = docs.filter(function(d) { return String(d.dewan_id) === dewanId; });
      }
      if (kategoriId) {
        docs = docs.filter(function(d) { return String(d.kategori_id) === kategoriId; });
      }
      if (tahun !== null && !isNaN(tahun)) {
        docs = docs.filter(function(d) { return parseInt(d.tahun, 10) === tahun; });
      }
      if (namaFolder) {
        docs = docs.filter(function(d) {
          return String(d.nama_folder || '').trim().toLowerCase() === namaFolder;
        });
      }

      docs.sort(function(a, b) {
        return new Date(b.tanggal_upload || 0).getTime() - new Date(a.tanggal_upload || 0).getTime();
      });

      return jsonResponse(true, docs, 'Daftar dokumen berhasil dimuat.');
    }

    if (action === 'getDokumenById') {
      const id = String(payload.id || '');
      const docs = getSheetData(ss, 'dokumen');
      const doc = docs.find(function(d) { return String(d.id) === id; });
      if (!doc) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');
      return jsonResponse(true, doc, 'Data dokumen ditemukan.');
    }

    if (action === 'uploadDokumen' || action === 'createDokumen') {
      const data = payload.data || payload;
      const dewanId = String(data.dewan_id || '');
      const kategoriId = String(data.kategori_id || '');
      const tahun = parseInt(data.tahun, 10);
      const namaFolder = String(data.nama_folder || '').trim();
      const namaDokumen = String(data.nama_dokumen || data.judul || '').trim();
      const keterangan = String(data.keterangan || '').trim();
      const base64Content = data.base64 || data.base64Content || '';
      const originalFileName = String(data.fileName || data.nama_file || 'dokumen').trim();

      if (!dewanId || !kategoriId || isNaN(tahun) || !namaDokumen) {
        return jsonResponse(false, null, 'Data dewan, kategori, tahun, dan nama dokumen wajib diisi.', 'VALIDATION_ERROR');
      }

      if (!base64Content) {
        return jsonResponse(false, null, 'File dokumen wajib dilampirkan.', 'VALIDATION_ERROR');
      }

      // Validasi ekstensi
      const allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png'];
      const extMatch = originalFileName.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : '';
      if (!ext || allowedExts.indexOf(ext) === -1) {
        return jsonResponse(false, null, 'Format file tidak didukung. Format yang didukung: ' + allowedExts.join(', '), 'INVALID_FILE_TYPE');
      }

      // Validasi batas ukuran file (maksimal 10 MB untuk payload Base64)
      const MAX_BYTES = 10 * 1024 * 1024;
      const approxBytes = (base64Content.length * 3) / 4;
      if (approxBytes > MAX_BYTES * 1.05) {
        return jsonResponse(false, null, 'Ukuran file melebihi batas maksimum 10 MB.', 'FILE_TOO_LARGE');
      }

      // Ekstrak header MIME type jika ada
      let mimeType = 'application/octet-stream';
      const mimeMatch = base64Content.match(/^data:([^;]+);base64,/);
      if (mimeMatch) {
        mimeType = mimeMatch[1].toLowerCase();
      } else {
        const mimeMap = {
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png'
        };
        mimeType = mimeMap[ext] || 'application/octet-stream';
      }

      const rawBase64 = base64Content.replace(/^data:[^;]+;base64,/, '');
      const bytes = Utilities.base64Decode(rawBase64);

      if (bytes.length > MAX_BYTES) {
        return jsonResponse(false, null, 'Ukuran berkas melebihi batas 10 MB.', 'FILE_TOO_LARGE');
      }

      // Sanitasi nama file
      const safeBaseName = originalFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-\. ]/g, '_').substring(0, 80);
      const cleanFileName = safeBaseName + '_' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd_HHmmss') + '.' + ext;

      // Simpan berkas fisik ke Google Drive
      const blob = Utilities.newBlob(bytes, mimeType, cleanFileName);
      const targetFolder = getDokumenFolder();
      const driveFile = targetFolder.createFile(blob);
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      const fileId = driveFile.getId();
      const directUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
      const viewUrl = 'https://drive.google.com/file/d/' + fileId + '/view';

      // Simpan metadata ke Google Sheets
      const docSheet = ss.getSheetByName('dokumen');
      const docList = getSheetData(ss, 'dokumen');
      let maxId = 0;
      docList.forEach(function(d) {
        const nid = parseInt(d.id, 10);
        if (!isNaN(nid) && nid > maxId) maxId = nid;
      });
      const newId = maxId + 1;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      docSheet.appendRow([
        newId,
        dewanId,
        kategoriId,
        tahun,
        sanitizeSheetValue(namaFolder),
        sanitizeSheetValue(namaDokumen),
        sanitizeSheetValue(keterangan),
        cleanFileName,
        fileId,
        directUrl,
        viewUrl,
        mimeType,
        bytes.length,
        userSession.username,
        nowIso
      ]);

      // Pastikan entri tahun dan folder juga tercatat di tabel jika ada namaFolder
      if (namaFolder) {
        const folderSheet = ss.getSheetByName('folder_dokumen');
        const folderList = getSheetData(ss, 'folder_dokumen');
        const folderExist = folderList.some(function(f) {
          return String(f.dewan_id) === dewanId &&
                 String(f.kategori_id) === kategoriId &&
                 parseInt(f.tahun, 10) === tahun &&
                 String(f.nama_folder || '').trim().toLowerCase() === namaFolder.toLowerCase();
        });
        if (!folderExist) {
          let maxFid = 0;
          folderList.forEach(function(f) {
            const fid = parseInt(f.id, 10);
            if (!isNaN(fid) && fid > maxFid) maxFid = fid;
          });
          folderSheet.appendRow([maxFid + 1, dewanId, kategoriId, tahun, sanitizeSheetValue(namaFolder), nowIso]);
        }
      }

      recordActivity(ss, userSession.username, 'UPLOAD_DOKUMEN', 'Mengunggah dokumen: ' + namaDokumen + ' (' + cleanFileName + ')');
      return jsonResponse(true, {
        id: newId,
        nama_dokumen: namaDokumen,
        nama_file: cleanFileName,
        file_id: fileId,
        view_url: viewUrl,
        direct_url: directUrl
      }, 'Dokumen berhasil diunggah ke Google Drive dan disimpan.');
    }

    if (action === 'updateDokumen') {
      const data = payload.data || payload;
      const id = String(data.id || '');
      const namaDokumen = String(data.nama_dokumen || '').trim();
      const kategoriId = String(data.kategori_id || '');
      const tahun = parseInt(data.tahun, 10);
      const keterangan = String(data.keterangan || '').trim();
      const base64Content = data.base64 || '';
      const originalFileName = String(data.fileName || '').trim();

      if (!id || !namaDokumen) {
        return jsonResponse(false, null, 'ID dan nama dokumen wajib diisi.', 'VALIDATION_ERROR');
      }

      const docSheet = ss.getSheetByName('dokumen');
      const docList = getSheetData(ss, 'dokumen');
      const target = docList.find(function(d) { return String(d.id) === id; });
      if (!target) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');

      const rowIndex = target._rowIndex;
      docSheet.getRange(rowIndex, 6).setValue(sanitizeSheetValue(namaDokumen));
      if (kategoriId) docSheet.getRange(rowIndex, 3).setValue(kategoriId);
      if (!isNaN(tahun)) docSheet.getRange(rowIndex, 4).setValue(tahun);
      docSheet.getRange(rowIndex, 7).setValue(sanitizeSheetValue(keterangan));

      // Jika ada file baru yang diunggah
      if (base64Content && originalFileName) {
        const MAX_BYTES = 10 * 1024 * 1024;
        const rawBase64 = base64Content.replace(/^data:[^;]+;base64,/, '');
        const bytes = Utilities.base64Decode(rawBase64);
        if (bytes.length > MAX_BYTES) {
          return jsonResponse(false, null, 'Ukuran file baru melebihi batas 10 MB.', 'FILE_TOO_LARGE');
        }

        const extMatch = originalFileName.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'pdf';
        const cleanFileName = originalFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-\. ]/g, '_').substring(0, 80) +
          '_' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd_HHmmss') + '.' + ext;

        let mimeType = 'application/octet-stream';
        const mimeMatch = base64Content.match(/^data:([^;]+);base64,/);
        if (mimeMatch) mimeType = mimeMatch[1].toLowerCase();

        // Buat file baru di Drive
        const blob = Utilities.newBlob(bytes, mimeType, cleanFileName);
        const targetFolder = getDokumenFolder();
        const newDriveFile = targetFolder.createFile(blob);
        newDriveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        const newFileId = newDriveFile.getId();
        const newDirectUrl = 'https://drive.google.com/uc?export=view&id=' + newFileId;
        const newViewUrl = 'https://drive.google.com/file/d/' + newFileId + '/view';

        // Pindahkan file lama ke trash jika ada
        if (target.file_id) {
          try { DriveApp.getFileById(target.file_id).setTrashed(true); } catch (e) {}
        }

        // Perbarui data file di sheet
        docSheet.getRange(rowIndex, 8).setValue(cleanFileName);
        docSheet.getRange(rowIndex, 9).setValue(newFileId);
        docSheet.getRange(rowIndex, 10).setValue(newDirectUrl);
        docSheet.getRange(rowIndex, 11).setValue(newViewUrl);
        docSheet.getRange(rowIndex, 12).setValue(mimeType);
        docSheet.getRange(rowIndex, 13).setValue(bytes.length);
      }

      recordActivity(ss, userSession.username, 'EDIT_DOKUMEN', 'Memperbarui dokumen ID ' + id + ': ' + namaDokumen);
      return jsonResponse(true, { id: id }, 'Dokumen berhasil diperbarui.');
    }

    if (action === 'deleteDokumen') {
      const id = String(payload.id || '');
      if (!id) return jsonResponse(false, null, 'ID dokumen diperlukan.', 'VALIDATION_ERROR');

      const docSheet = ss.getSheetByName('dokumen');
      const docList = getSheetData(ss, 'dokumen');
      const target = docList.find(function(d) { return String(d.id) === id; });
      if (!target) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');

      // Hapus berkas fisik di Drive jika ada
      if (target.file_id) {
        try { DriveApp.getFileById(target.file_id).setTrashed(true); } catch (e) {}
      }

      docSheet.deleteRow(target._rowIndex);
      recordActivity(ss, userSession.username, 'HAPUS_DOKUMEN', 'Menghapus dokumen ID ' + id + ': ' + target.nama_dokumen);
      return jsonResponse(true, null, 'Dokumen berhasil dihapus.');
    }

    return jsonResponse(false, null, 'Aksi POST tidak dikenali: ' + action, 'NOT_FOUND');

  } catch (error) {
    return jsonResponse(false, null, error.message || 'Terjadi kesalahan pada backend Apps Script.', 'GAS_POST_ERROR');
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}
