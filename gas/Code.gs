/**
 * ============================================================================
 * SISTEM PENGARSIPAN DOKUMEN DPRD KOTA PAREPARE
 * Backend Google Apps Script Web App (Arsitektur Satu Aktor: Staf / Superadmin)
 * ============================================================================
 * 
 * Database : Google Spreadsheet
 * Storage  : Google Drive (Folder Dokumen Fisik)
 * Frontend : Vite SPA di Vercel
 * 
 * ID Database & Folder yang Sudah Terdaftar:
 * - DATABASE_ID       : 1au0x8Ya46aB3z2kfosAhFn4IW1tx0vYAr4UYoNkHF-Q
 * - ROOT_FOLDER_ID    : 1rI8ew0II_VXmTbLyB5bvsW3rUgeEgObz
 * - DOKUMEN_FOLDER_ID : 1bwTxHOFheoRNC2hrHUnHk5RXjpk732YR
 */

// ============================================================================
// KONFIGURASI GLOBAL & DEFAULT ID RESMI
// ============================================================================
const APP_NAME = 'Sistem Pengarsipan Dokumen DPRD Kota Parepare';
const TIMEZONE = 'Asia/Makassar';
const INITIAL_SUPERADMIN_USER = 'superadmin';

// ID Default Spreadsheet & Folder yang telah terbukti dibuat
const DEFAULT_DATABASE_ID = '1au0x8Ya46aB3z2kfosAhFn4IW1tx0vYAr4UYoNkHF-Q';
const DEFAULT_ROOT_FOLDER_ID = '1rI8ew0II_VXmTbLyB5bvsW3rUgeEgObz';
const DEFAULT_DOKUMEN_FOLDER_ID = '1bwTxHOFheoRNC2hrHUnHk5RXjpk732YR';

// Parameter Hashing PBKDF2-HMAC-SHA256
// 10.000 iterasi terbukti stabil (~1 detik di V8 Google Apps Script)
const PBKDF2_STANDARD_ITERATIONS = 10000;
const MIN_ALLOWED_ITERATIONS = 1000;

// ============================================================================
// 1. KONEKSI DATABASE & GOOGLE DRIVE (NON-DESTRUKTIF)
// ============================================================================

/**
 * Membuka Spreadsheet database yang sudah ada tanpa pernah mereset data.
 */
function getDatabase() {
  const props = PropertiesService.getScriptProperties();
  const dbId = props.getProperty('DATABASE_ID') || props.getProperty('SPREADSHEET_ID') || DEFAULT_DATABASE_ID;
  if (dbId && dbId.trim()) {
    try {
      return SpreadsheetApp.openById(dbId.trim());
    } catch (e) {
      Logger.log('Gagal membuka spreadsheet via ID: ' + e.message);
    }
  }

  // Fallback ke spreadsheet aktif jika script terikat langsung (container-bound)
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  throw new Error('Database Spreadsheet tidak dapat diakses. Pastikan ID Spreadsheet valid: ' + DEFAULT_DATABASE_ID);
}

/**
 * Mengakses folder Google Drive penyimpanan dokumen fisik.
 */
function getDocFolder() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('DOKUMEN_FOLDER_ID') || DEFAULT_DOKUMEN_FOLDER_ID;
  if (folderId && folderId.trim()) {
    try {
      return DriveApp.getFolderById(folderId.trim());
    } catch (e) {
      Logger.log('Gagal membuka folder dokumen via ID: ' + e.message);
    }
  }
  throw new Error('Folder penyimpanan Google Drive tidak dapat diakses. Pastikan ID Folder valid: ' + DEFAULT_DOKUMEN_FOLDER_ID);
}

// ============================================================================
// 2. SISTEM KRIPTOGRAFI PBKDF2-HMAC-SHA256 (FIX METHOD SIGNATURE ERROR)
// ============================================================================

function getSystemSalt() {
  const props = PropertiesService.getScriptProperties();
  let salt = props.getProperty('PASSWORD_SALT');
  if (!salt) {
    salt = generateCryptographicSalt();
    props.setProperty('PASSWORD_SALT', salt);
  }
  return salt;
}

function generateCryptographicSalt() {
  const seed = Utilities.getUuid() + '-' + Date.now() + '-' + Math.random().toString(36) + '-' + Utilities.getUuid();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

/**
 * Derivasi Sandi PBKDF2-HMAC-SHA256 Google Apps Script (RFC 2898 / RFC 6070).
 * 
 * SOLUSI BUG:
 * Utilities.computeHmacSha256Signature di Apps Script memerlukan pasangan parameter
 * bertipe identik: (Byte[] value, Byte[] key).
 * Mengonversi password dan salt ke Byte[] menghilangkan error (number[], String).
 */
function hashPasswordPBKDF2(password, salt, iterations) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password wajib berupa string.');
  }

  const iter = iterations || PBKDF2_STANDARD_ITERATIONS;
  const fullSalt = (salt || getSystemSalt());

  // Konversi password dan salt ke byte array (Byte[]) native Apps Script
  const passwordBytes = Utilities.newBlob(password).getBytes();
  const saltBytes = Utilities.newBlob(fullSalt).getBytes();

  // U_1 = HMAC(Key=passwordBytes, Data=saltBytes || INT_32_BE(1))
  const initialData = saltBytes.concat([0, 0, 0, 1]);
  let u = Utilities.computeHmacSha256Signature(initialData, passwordBytes);
  let result = new Array(u.length);
  for (let k = 0; k < u.length; k++) {
    result[k] = u[k];
  }

  // Iterasi key-stretching: U_i = HMAC(Key=passwordBytes, Data=U_{i-1})
  // Keduanya berupa Byte[] sehingga 100% cocok dengan method signature Apps Script
  for (let i = 1; i < iter; i++) {
    u = Utilities.computeHmacSha256Signature(u, passwordBytes);
    for (let k = 0; k < result.length; k++) {
      result[k] ^= u[k];
    }
  }

  let hex = '';
  for (let i = 0; i < result.length; i++) {
    let b = result[i];
    if (b < 0) b += 256;
    let h = b.toString(16);
    if (h.length === 1) h = '0' + h;
    hex += h;
  }
  return 'pbkdf2$' + iter + '$' + hex;
}

/**
 * Verifikasi Sandi Constant-Time Compare.
 */
function verifyPassword(password, storedHash, userSalt) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;

  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') {
    return false;
  }

  const iterations = parseInt(parts[1], 10);
  if (isNaN(iterations) || iterations < MIN_ALLOWED_ITERATIONS) {
    return false;
  }

  const expectedHash = hashPasswordPBKDF2(password, userSalt || getSystemSalt(), iterations);
  if (storedHash.length !== expectedHash.length) return false;

  let diff = 0;
  for (let i = 0; i < storedHash.length; i++) {
    diff |= storedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

// ============================================================================
// 3. INISIALISASI AKUN AWAL (BOOTSTRAP SUPERADMIN)
// ============================================================================

/**
 * Fungsi Bootstrap Akun Tunggal Superadmin.
 * Mendukung pemanggilan langsung dengan argumen ATAU melalui Script Properties: BOOTSTRAP_PASSWORD.
 * Aman, idempoten, dan memperbarui akun jika sudah ada tanpa membuat baris duplikat.
 *
 * @param {string} [initialPassword] Sandi awal (opsional jika BOOTSTRAP_PASSWORD di Script Properties terisi).
 */
function bootstrapSuperadmin(initialPassword) {
  const props = PropertiesService.getScriptProperties();

  // Pastikan ID default tersimpan di Script Properties jika belum ada
  if (!props.getProperty('DATABASE_ID')) props.setProperty('DATABASE_ID', DEFAULT_DATABASE_ID);
  if (!props.getProperty('ROOT_FOLDER_ID')) props.setProperty('ROOT_FOLDER_ID', DEFAULT_ROOT_FOLDER_ID);
  if (!props.getProperty('DOKUMEN_FOLDER_ID')) props.setProperty('DOKUMEN_FOLDER_ID', DEFAULT_DOKUMEN_FOLDER_ID);

  let password = initialPassword;
  if (!password || typeof password !== 'string') {
    password = props.getProperty('BOOTSTRAP_PASSWORD');
    if (password) {
      props.deleteProperty('BOOTSTRAP_PASSWORD'); // Hapus setelah dipakai
    }
  }

  if (!password || typeof password !== 'string' || password.trim().length < 8) {
    throw new Error('Gagal: Password awal wajib diisi minimal 8 karakter kombinasi huruf dan angka. Panggil bootstrapSuperadmin("PasswordAnda123!") atau simpan pada Project Settings > Script Properties dengan kunci BOOTSTRAP_PASSWORD.');
  }

  const cleanPass = password.trim();
  if (!/[a-zA-Z]/.test(cleanPass) || !/[0-9]/.test(cleanPass)) {
    throw new Error('Gagal: Password awal wajib mengandung kombinasi huruf dan angka.');
  }

  const ss = getDatabase();
  let uSheet = ss.getSheetByName('users');
  if (!uSheet) {
    uSheet = ss.insertSheet('users');
    uSheet.appendRow(['id', 'username', 'password_hash', 'salt', 'nama', 'role', 'status', 'must_change_password', 'created_at', 'last_login']);
    uSheet.setFrozenRows(1);
  }

  const existingUsers = getSheetData(ss, 'users');
  const userRow = existingUsers.find(function(u) {
    return String(u.username || '').toLowerCase() === INITIAL_SUPERADMIN_USER;
  });

  const salt = generateCryptographicSalt();
  const hash = hashPasswordPBKDF2(cleanPass, salt, PBKDF2_STANDARD_ITERATIONS);
  const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

  if (userRow) {
    // Akun sudah ada: perbarui password in-place tanpa membuat baris baru
    uSheet.getRange(userRow._rowIndex, 3).setValue(hash);
    uSheet.getRange(userRow._rowIndex, 4).setValue(salt);
    uSheet.getRange(userRow._rowIndex, 7).setValue('aktif');
    uSheet.getRange(userRow._rowIndex, 8).setValue('false');
    revokeUserSessions(userRow.id);

    Logger.log('=====================================================');
    Logger.log('SUKSES: Kata sandi akun (' + INITIAL_SUPERADMIN_USER + ') berhasil diperbarui.');
    Logger.log('Status: Akun aktif dan siap digunakan untuk login.');
    Logger.log('=====================================================');
    return { success: true, message: 'Password akun superadmin berhasil diperbarui.' };
  }

  // Daftarkan baris baru jika akun belum pernah dibuat
  uSheet.appendRow([
    'USR-01',
    INITIAL_SUPERADMIN_USER,
    hash,
    salt,
    'Administrator Arsip DPRD',
    'superadmin',
    'aktif',
    'false',
    nowIso,
    ''
  ]);

  Logger.log('=====================================================');
  Logger.log('SUKSES: Akun (' + INITIAL_SUPERADMIN_USER + ') berhasil diinisialisasi.');
  Logger.log('Status: Akun aktif dan siap digunakan untuk login.');
  Logger.log('=====================================================');

  return { success: true, message: 'Akun superadmin berhasil diinisialisasi.' };
}

/**
 * Runner Pembantu untuk Toolbar Apps Script Editor.
 * Membaca properti BOOTSTRAP_PASSWORD dari Script Properties.
 */
function runBootstrapSuperadmin() {
  const props = PropertiesService.getScriptProperties();
  const pass = props.getProperty('BOOTSTRAP_PASSWORD');
  if (!pass) {
    throw new Error('Silakan simpan password sementara di Project Settings > Script Properties (Properti: BOOTSTRAP_PASSWORD), lalu klik Run pada fungsi ini.');
  }
  return bootstrapSuperadmin(pass);
}

/**
 * Alternatif Praktis: Jalankan fungsi ini langsung dari editor Apps Script
 * jika Anda ingin mengisi kata sandi langsung di kode.
 * Silakan ganti kata sandi di bawah ini dengan kata sandi yang Anda inginkan.
 */
function jalankanBootstrapLangsung() {
  const sandiAwal = "AdminDprd2026!"; // <-- Ganti sesuai kebutuhan (min 8 karakter, huruf & angka)
  return bootstrapSuperadmin(sandiAwal);
}

// ============================================================================
// 4. PENGELOLAAN SESI & HELPER DATABASE
// ============================================================================

function generateSessionToken(userId) {
  const raw = Utilities.getUuid() + '-' + Date.now() + '-' + Math.random().toString(36);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  const secretPart = Utilities.base64EncodeWebSafe(digest).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  return 'DPRD_SES_' + userId + '_' + secretPart;
}

/**
 * Verifikasi Sesi Terpusat untuk Satu Aktor.
 * Setiap sesi aktif yang valid memiliki izin penuh terhadap seluruh fitur.
 */
function verifySession(token, ss) {
  if (!token || typeof token !== 'string') {
    throw new Error('Akses ditolak: Token autentikasi tidak ditemukan.');
  }
  const cleanToken = token.trim();
  if (cleanToken.length < 24 || !cleanToken.startsWith('DPRD_SES_')) {
    throw new Error('Akses ditolak: Format token sesi tidak valid.');
  }

  const cache = CacheService.getScriptCache();
  const sessionData = cache.get('session_' + cleanToken);
  if (!sessionData) {
    throw new Error('Sesi telah kedaluwarsa atau tidak valid. Silakan login kembali.');
  }

  let session;
  try {
    session = JSON.parse(sessionData);
  } catch (e) {
    cache.remove('session_' + cleanToken);
    throw new Error('Data sesi rusak. Silakan login kembali.');
  }

  if (session.expiresAt && Date.now() > session.expiresAt) {
    cache.remove('session_' + cleanToken);
    throw new Error('Sesi telah kedaluwarsa. Silakan login kembali.');
  }

  // Sinkronisasi status akun dengan database
  const users = getSheetData(ss, 'users');
  const currentUser = users.find(function(u) {
    return String(u.id || '').trim() === String(session.userId || '').trim();
  });

  if (!currentUser) {
    cache.remove('session_' + cleanToken);
    throw new Error('Akses ditolak: Akun pengguna tidak ditemukan.');
  }

  if (String(currentUser.status || '').toLowerCase() !== 'aktif') {
    cache.remove('session_' + cleanToken);
    throw new Error('Akses ditolak: Akun telah dinonaktifkan.');
  }

  session.role = 'superadmin';
  session.nama = String(currentUser.nama || session.username);
  session.mustChangePassword = false;
  session.userRowIndex = currentUser._rowIndex;
  session.token = cleanToken;

  return session;
}

function revokeUserSessions(userId) {
  const cache = CacheService.getScriptCache();
  const activeToken = cache.get('user_active_token_' + userId);
  if (activeToken) {
    cache.remove('session_' + activeToken);
    cache.remove('user_active_token_' + userId);
  }
}

function checkLoginRateLimit(normalizedUsername) {
  const cache = CacheService.getScriptCache();
  const isLocked = cache.get('lockout_' + normalizedUsername);
  if (isLocked) {
    return {
      allowed: false,
      message: 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.'
    };
  }
  return { allowed: true };
}

function recordFailedLogin(normalizedUsername) {
  const cache = CacheService.getScriptCache();
  const attemptsKey = 'attempts_' + normalizedUsername;
  let attempts = parseInt(cache.get(attemptsKey) || '0', 10) + 1;
  let isLocked = false;
  if (attempts >= 5) {
    cache.put('lockout_' + normalizedUsername, 'true', 900);
    cache.remove(attemptsKey);
    isLocked = true;
  } else {
    cache.put(attemptsKey, String(attempts), 900);
  }
  return isLocked;
}

function resetFailedLogin(normalizedUsername) {
  const cache = CacheService.getScriptCache();
  cache.remove('attempts_' + normalizedUsername);
  cache.remove('lockout_' + normalizedUsername);
}

function recordActivity(ss, userId, username, role, aksi, detail) {
  try {
    const sheet = ss.getSheetByName('aktivitas_log');
    if (!sheet) return;
    const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const id = Utilities.getUuid().substring(0, 8);
    sheet.appendRow([
      id,
      nowIso,
      sanitizeSheetValue(userId || '-'),
      sanitizeSheetValue(username || 'system'),
      sanitizeSheetValue(role || 'superadmin'),
      sanitizeSheetValue(aksi),
      sanitizeSheetValue(detail),
      '-'
    ]);
  } catch (e) {
    Logger.log('Gagal mencatat log aktivitas: ' + e.message);
  }
}

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

function sanitizeSheetValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const str = String(value);
  const formulaTriggers = ['=', '+', '-', '@', '\t', '\r'];
  if (formulaTriggers.indexOf(str.charAt(0)) !== -1) {
    return "'" + str;
  }
  return str;
}

function jsonResponse(success, data, message, errorCode) {
  const payload = {
    success: Boolean(success),
    data: data !== undefined ? data : null,
    message: message || '',
    error: errorCode ? { code: errorCode } : null,
    timestamp: Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'")
  };
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function validateFileContentAndSignature(base64Data, fileName) {
  if (!base64Data || typeof base64Data !== 'string') {
    throw new Error('Data berkas base64 tidak valid.');
  }

  let cleanBase64 = base64Data;
  let detectedMime = '';
  if (base64Data.indexOf(',') !== -1) {
    const parts = base64Data.split(',');
    cleanBase64 = parts[1];
    const match = parts[0].match(/data:(.*?);base64/);
    if (match) detectedMime = match[1];
  }

  const bytes = Utilities.base64Decode(cleanBase64);
  const sizeBytes = bytes.length;

  if (sizeBytes > 20 * 1024 * 1024) {
    throw new Error('Ukuran berkas (' + Math.round(sizeBytes / (1024 * 1024)) + 'MB) melebihi batas aman 20MB.');
  }

  const cleanName = String(fileName || '').toLowerCase();
  const dotIndex = cleanName.lastIndexOf('.');
  if (dotIndex === -1) {
    throw new Error('Nama berkas wajib memiliki ekstensi yang valid.');
  }
  const ext = cleanName.substring(dotIndex);

  const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'];
  if (ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
    throw new Error('Ekstensi berkas "' + ext + '" tidak didukung. Ekstensi yang diizinkan: PDF, Word, Excel, Gambar.');
  }

  let mimeType = detectedMime || 'application/octet-stream';
  let detectedType = false;

  if (ext === '.pdf') {
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      detectedType = true;
      mimeType = 'application/pdf';
    }
  } else if (ext === '.docx' || ext === '.xlsx' || ext === '.pptx') {
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      detectedType = true;
      if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (ext === '.xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (ext === '.pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
  } else if (ext === '.doc' || ext === '.xls' || ext === '.ppt') {
    if ((bytes[0] === -48 && bytes[1] === -49 && bytes[2] === 0x11 && bytes[3] === -32) ||
        (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0)) {
      detectedType = true;
      if (ext === '.doc') mimeType = 'application/msword';
      if (ext === '.xls') mimeType = 'application/vnd.ms-excel';
      if (ext === '.ppt') mimeType = 'application/vnd.ms-powerpoint';
    }
  } else if (ext === '.png') {
    if ((bytes[0] === -119 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) ||
        (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47)) {
      detectedType = true;
      mimeType = 'image/png';
    }
  } else if (ext === '.jpg' || ext === '.jpeg') {
    if ((bytes[0] === -1 && bytes[1] === -40 && bytes[2] === -1) ||
        (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF)) {
      detectedType = true;
      mimeType = 'image/jpeg';
    }
  }

  if (!detectedType) {
    throw new Error('Format isi berkas tidak valid atau rusak.');
  }

  return {
    bytes: bytes,
    sizeBytes: sizeBytes,
    mimeType: mimeType
  };
}

// ============================================================================
// 5. HTTP HANDLER: doGet(e) - HEALTH-CHECK MINIMAL
// ============================================================================

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';

  if (action === 'ping') {
    return jsonResponse(true, {
      app: APP_NAME,
      status: 'online',
      actorModel: 'single-actor'
    }, 'Sistem Pengarsipan DPRD Kota Parepare aktif.');
  }

  return jsonResponse(false, null, 'Endpoint publik tidak tersedia.', 'NOT_FOUND');
}

// ============================================================================
// 6. HTTP HANDLER: doPost(e) - API UNIVERSAL UNTUK SATU AKTOR
// ============================================================================

function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse(false, null, 'Permintaan kosong.', 'EMPTY_REQUEST');
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const token = payload.token;

    const ss = getDatabase();

    // ---------------- AUTH: LOGIN PUBLIK ----------------
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
      const matchedUser = users.find(function(u) {
        if (String(u.username || '').trim().toLowerCase() !== username) return false;
        return verifyPassword(password, String(u.password_hash || ''), String(u.salt || ''));
      });

      if (!matchedUser || String(matchedUser.status || '').toLowerCase() === 'nonaktif') {
        const isLocked = recordFailedLogin(username);
        recordActivity(ss, '-', username, 'superadmin', 'LOGIN_GAGAL', 'Percobaan login gagal untuk username: ' + username);
        return jsonResponse(
          false,
          null,
          isLocked
            ? 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.'
            : 'Username atau password tidak valid.',
          isLocked ? 'TOO_MANY_REQUESTS' : 'INVALID_CREDENTIALS'
        );
      }

      resetFailedLogin(username);

      const sessionToken = generateSessionToken(matchedUser.id);
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
      const expiresAt = Date.now() + (12 * 60 * 60 * 1000); // 12 Jam

      const sessionData = {
        userId: matchedUser.id,
        username: matchedUser.username,
        role: 'superadmin',
        nama: matchedUser.nama || 'Administrator Arsip',
        mustChangePassword: false,
        createdAt: Date.now(),
        expiresAt: expiresAt
      };

      const cache = CacheService.getScriptCache();
      cache.put('session_' + sessionToken, JSON.stringify(sessionData), 21600); // 6 Jam
      cache.put('user_active_token_' + matchedUser.id, sessionToken, 21600);

      try {
        ss.getSheetByName('users').getRange(matchedUser._rowIndex, 10).setValue(nowIso);
      } catch (err) {}

      recordActivity(ss, matchedUser.id, matchedUser.username, 'superadmin', 'LOGIN_SUKSES', 'Pengguna berhasil masuk ke sistem');

      return jsonResponse(true, {
        token: sessionToken,
        user: {
          id: matchedUser.id,
          username: matchedUser.username,
          nama: matchedUser.nama,
          role: 'superadmin',
          mustChangePassword: false
        }
      }, 'Login berhasil.');
    }

    // ---------------- VERIFIKASI SESI (SATU AKTOR BERHAK PENUH) ----------------
    let session;
    try {
      session = verifySession(token, ss);
    } catch (authErr) {
      return jsonResponse(false, null, authErr.message, 'UNAUTHORIZED');
    }

    // Kunci konkurensi untuk aksi modifikasi data
    const WRITE_ACTIONS = [
      'createDewan', 'updateDewan', 'toggleDewanStatus', 'deleteDewan',
      'createKategori', 'updateKategori', 'toggleKategoriStatus', 'deleteKategori',
      'createTahun', 'updateTahun', 'deleteTahun',
      'createFolder', 'updateFolder', 'deleteFolder',
      'uploadDokumen', 'updateDokumen', 'deleteDokumen',
      'changePassword', 'clearActivityLog'
    ];

    if (WRITE_ACTIONS.indexOf(action) !== -1) {
      lock.waitLock(15000);
      lockAcquired = true;
    }

    // ---------------- SESI, LOGOUT & PROFIL ----------------
    if (action === 'adminLogout' || action === 'logout') {
      const cache = CacheService.getScriptCache();
      cache.remove('session_' + token);
      cache.remove('user_active_token_' + session.userId);
      recordActivity(ss, session.userId, session.username, 'superadmin', 'LOGOUT', 'Pengguna keluar dari sistem');
      return jsonResponse(true, null, 'Sesi berhasil diakhiri.');
    }

    if (action === 'getCurrentUser' || action === 'checkSession' || action === 'getProfile') {
      return jsonResponse(true, {
        id: session.userId,
        username: session.username,
        nama: session.nama,
        role: 'superadmin',
        mustChangePassword: false
      }, 'Sesi valid.');
    }

    if (action === 'changePassword') {
      const oldPass = String(payload.oldPassword || '');
      const newPass = String(payload.newPassword || '');

      if (!oldPass || !newPass) {
        return jsonResponse(false, null, 'Kata sandi lama dan kata sandi baru wajib diisi.', 'VALIDATION_ERROR');
      }
      if (newPass.length < 8 || !/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) {
        return jsonResponse(false, null, 'Kata sandi baru minimal 8 karakter kombinasi huruf dan angka.', 'VALIDATION_ERROR');
      }

      const users = getSheetData(ss, 'users');
      const currentUser = users.find(function(u) { return String(u.id) === String(session.userId); });
      if (!currentUser) return jsonResponse(false, null, 'Akun pengguna tidak ditemukan.', 'NOT_FOUND');

      if (!verifyPassword(oldPass, String(currentUser.password_hash || ''), String(currentUser.salt || ''))) {
        return jsonResponse(false, null, 'Kata sandi lama tidak sesuai.', 'INVALID_OLD_PASSWORD');
      }

      const newSalt = generateCryptographicSalt();
      const newHash = hashPasswordPBKDF2(newPass, newSalt, PBKDF2_STANDARD_ITERATIONS);

      const uSheet = ss.getSheetByName('users');
      uSheet.getRange(currentUser._rowIndex, 3).setValue(newHash);
      uSheet.getRange(currentUser._rowIndex, 4).setValue(newSalt);
      uSheet.getRange(currentUser._rowIndex, 8).setValue('false');

      recordActivity(ss, session.userId, session.username, 'superadmin', 'CHANGE_PASSWORD', 'Pengguna berhasil memperbarui kata sandi');
      return jsonResponse(true, { mustChangePassword: false }, 'Kata sandi berhasil diperbarui.');
    }

    // ---------------- DASHBOARD & STATISTIK ----------------
    if (action === 'getDashboardData') {
      const dewanList = getSheetData(ss, 'dewan');
      const kategoriList = getSheetData(ss, 'kategori_dokumen');
      const dokumenList = getSheetData(ss, 'dokumen');
      const logs = getSheetData(ss, 'aktivitas_log');

      const totalDewan = dewanList.length;
      const totalDewanAktif = dewanList.filter(function(d) { return String(d.status || '').toLowerCase() === 'aktif'; }).length;
      const totalDokumen = dokumenList.filter(function(d) { return String(d.status || '').toLowerCase() === 'aktif'; }).length;
      const totalKategori = kategoriList.filter(function(k) { return String(k.status || '').toLowerCase() === 'aktif'; }).length;

      const recentDocs = dokumenList
        .filter(function(d) { return String(d.status || '').toLowerCase() === 'aktif'; })
        .slice(-5)
        .reverse();

      const recentActs = logs.slice(-5).reverse();

      return jsonResponse(true, {
        totalDewan: totalDewan,
        totalDewanAktif: totalDewanAktif,
        totalDokumen: totalDokumen,
        totalKategori: totalKategori,
        recentDocuments: recentDocs,
        recentActivities: recentActs
      }, 'Data dashboard berhasil dimuat.');
    }

    // ---------------- PENGELOLAAN ANGGOTA DPRD ----------------
    if (action === 'getDewanList') {
      const q = String(payload.cari || payload.q || '').trim().toLowerCase();
      const statusFilter = String(payload.status || '').trim().toLowerCase();
      let list = getSheetData(ss, 'dewan');

      if (statusFilter) {
        list = list.filter(function(d) { return String(d.status || '').toLowerCase() === statusFilter; });
      }
      if (q) {
        list = list.filter(function(d) {
          const nama = String(d.nama || '').toLowerCase();
          const partai = String(d.nama_partai || '').toLowerCase();
          const jabatan = String(d.jabatan || '').toLowerCase();
          return nama.indexOf(q) !== -1 || partai.indexOf(q) !== -1 || jabatan.indexOf(q) !== -1;
        });
      }

      list.sort(function(a, b) {
        const numA = parseInt(a.nomor_urut, 10) || 999;
        const numB = parseInt(b.nomor_urut, 10) || 999;
        return numA - numB;
      });

      return jsonResponse(true, list, 'Daftar anggota dewan berhasil dimuat.');
    }

    if (action === 'getDewanById') {
      const id = String(payload.id || '').trim();
      const list = getSheetData(ss, 'dewan');
      const item = list.find(function(d) { return String(d.id || '').trim() === id; });
      if (!item) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');
      return jsonResponse(true, item, 'Data dewan berhasil dimuat.');
    }

    if (action === 'createDewan') {
      const d = payload.data || payload;
      const nama = String(d.nama || '').trim();
      const jabatan = String(d.jabatan || '').trim();
      const periode = String(d.periode || '').trim();
      const partai = String(d.nama_partai || '').trim();
      const pendamping = String(d.nama_pendamping || d.nama_pengawas || '').trim();

      if (!nama || !jabatan || !partai) {
        return jsonResponse(false, null, 'Nama lengkap, jabatan, dan partai politik wajib diisi.', 'VALIDATION_ERROR');
      }

      const dewanSheet = ss.getSheetByName('dewan');
      const allDewan = getSheetData(ss, 'dewan');
      const nextNum = allDewan.length + 1;
      const newId = 'DWN-' + (nextNum < 10 ? '0' + nextNum : nextNum);
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      dewanSheet.appendRow([
        newId,
        nextNum,
        sanitizeSheetValue(nama),
        sanitizeSheetValue(jabatan),
        sanitizeSheetValue(periode || '2024 - 2029'),
        sanitizeSheetValue(pendamping),
        sanitizeSheetValue(partai),
        'aktif',
        nowIso,
        nowIso
      ]);

      recordActivity(ss, session.userId, session.username, 'superadmin', 'TAMBAH_DEWAN', 'Menambahkan dewan: ' + nama);
      return jsonResponse(true, { id: newId, nama: nama }, 'Anggota dewan berhasil ditambahkan.');
    }

    if (action === 'updateDewan') {
      const d = payload.data || payload;
      const id = String(d.id || '').trim();
      const dewanSheet = ss.getSheetByName('dewan');
      const allDewan = getSheetData(ss, 'dewan');
      const target = allDewan.find(function(x) { return String(x.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');

      const rowIdx = target._rowIndex;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      if (d.nama) dewanSheet.getRange(rowIdx, 3).setValue(sanitizeSheetValue(String(d.nama).trim()));
      if (d.jabatan) dewanSheet.getRange(rowIdx, 4).setValue(sanitizeSheetValue(String(d.jabatan).trim()));
      if (d.periode) dewanSheet.getRange(rowIdx, 5).setValue(sanitizeSheetValue(String(d.periode).trim()));
      if (d.nama_pendamping !== undefined) dewanSheet.getRange(rowIdx, 6).setValue(sanitizeSheetValue(String(d.nama_pendamping).trim()));
      if (d.nama_partai) dewanSheet.getRange(rowIdx, 7).setValue(sanitizeSheetValue(String(d.nama_partai).trim()));
      dewanSheet.getRange(rowIdx, 10).setValue(nowIso);

      recordActivity(ss, session.userId, session.username, 'superadmin', 'UPDATE_DEWAN', 'Memperbarui profil dewan: ' + (d.nama || target.nama));
      return jsonResponse(true, { id: id }, 'Profil dewan berhasil diperbarui.');
    }

    if (action === 'toggleDewanStatus') {
      const id = String(payload.id || '').trim();
      const newStatus = String(payload.status || 'aktif').toLowerCase() === 'aktif' ? 'aktif' : 'nonaktif';
      const dewanSheet = ss.getSheetByName('dewan');
      const allDewan = getSheetData(ss, 'dewan');
      const target = allDewan.find(function(x) { return String(x.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');

      dewanSheet.getRange(target._rowIndex, 8).setValue(newStatus);
      recordActivity(ss, session.userId, session.username, 'superadmin', 'STATUS_DEWAN', 'Mengubah status dewan ' + target.nama + ' menjadi: ' + newStatus);
      return jsonResponse(true, { id: id, status: newStatus }, 'Status dewan berhasil diubah.');
    }

    if (action === 'deleteDewan') {
      const id = String(payload.id || '').trim();
      const allDocs = getSheetData(ss, 'dokumen');
      const hasDocs = allDocs.some(function(doc) {
        return String(doc.dewan_id || '').trim() === id && String(doc.status || '').toLowerCase() === 'aktif';
      });

      if (hasDocs) {
        return jsonResponse(false, null, 'Anggota dewan tidak dapat dihapus karena masih memiliki dokumen arsip aktif.', 'HAS_DEPENDENT_RECORDS');
      }

      const dewanSheet = ss.getSheetByName('dewan');
      const allDewan = getSheetData(ss, 'dewan');
      const target = allDewan.find(function(x) { return String(x.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');

      dewanSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, 'superadmin', 'HAPUS_DEWAN', 'Menghapus anggota dewan: ' + target.nama);
      return jsonResponse(true, { id: id }, 'Anggota dewan berhasil dihapus.');
    }

    // ---------------- PENGELOLAAN KATEGORI ARSIP ----------------
    if (action === 'getKategoriList') {
      const list = getSheetData(ss, 'kategori_dokumen').filter(function(k) {
        return String(k.status || '').toLowerCase() === 'aktif';
      });
      return jsonResponse(true, list, 'Daftar kategori berhasil dimuat.');
    }

    if (action === 'getKategoriWithDocCount') {
      const dewanId = payload.dewan_id ? String(payload.dewan_id).trim() : null;
      const kategoriList = getSheetData(ss, 'kategori_dokumen');
      const dokumenList = getSheetData(ss, 'dokumen');

      const result = kategoriList.map(function(k) {
        const count = dokumenList.filter(function(d) {
          const matchKat = String(d.kategori_id || '').trim() === String(k.id || '').trim();
          const matchDewan = !dewanId || String(d.dewan_id || '').trim() === dewanId;
          const matchStatus = String(d.status || '').toLowerCase() === 'aktif';
          return matchKat && matchDewan && matchStatus;
        }).length;

        return {
          id: k.id,
          nama_kategori: k.nama_kategori,
          deskripsi: k.deskripsi || '',
          status: k.status || 'aktif',
          jumlah_dokumen: count
        };
      });

      return jsonResponse(true, result, 'Kategori dan jumlah dokumen berhasil dimuat.');
    }

    if (action === 'createKategori') {
      const nama = String(payload.nama_kategori || '').trim();
      const deskripsi = String(payload.deskripsi || '').trim();

      if (!nama) return jsonResponse(false, null, 'Nama kategori wajib diisi.', 'VALIDATION_ERROR');

      const katSheet = ss.getSheetByName('kategori_dokumen');
      const allKat = getSheetData(ss, 'kategori_dokumen');
      const dup = allKat.some(function(k) {
        return String(k.nama_kategori || '').trim().toLowerCase() === nama.toLowerCase();
      });

      if (dup) return jsonResponse(false, null, 'Kategori dengan nama "' + nama + '" sudah ada.', 'DUPLICATE_CATEGORY');

      const nextId = 'KAT-' + (allKat.length < 9 ? '0' + (allKat.length + 1) : (allKat.length + 1));
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      katSheet.appendRow([nextId, sanitizeSheetValue(nama), sanitizeSheetValue(deskripsi), 'aktif', nowIso, nowIso]);
      recordActivity(ss, session.userId, session.username, 'superadmin', 'TAMBAH_KATEGORI', 'Menambahkan kategori: ' + nama);
      return jsonResponse(true, { id: nextId, nama_kategori: nama }, 'Kategori berhasil ditambahkan.');
    }

    if (action === 'updateKategori') {
      const id = String(payload.id || '').trim();
      const nama = String(payload.nama_kategori || '').trim();
      const deskripsi = payload.deskripsi !== undefined ? String(payload.deskripsi).trim() : null;

      const katSheet = ss.getSheetByName('kategori_dokumen');
      const allKat = getSheetData(ss, 'kategori_dokumen');
      const target = allKat.find(function(k) { return String(k.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Kategori tidak ditemukan.', 'NOT_FOUND');

      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
      if (nama) katSheet.getRange(target._rowIndex, 2).setValue(sanitizeSheetValue(nama));
      if (deskripsi !== null) katSheet.getRange(target._rowIndex, 3).setValue(sanitizeSheetValue(deskripsi));
      katSheet.getRange(target._rowIndex, 6).setValue(nowIso);

      recordActivity(ss, session.userId, session.username, 'superadmin', 'UPDATE_KATEGORI', 'Memperbarui kategori: ' + (nama || target.nama_kategori));
      return jsonResponse(true, { id: id }, 'Kategori berhasil diperbarui.');
    }

    if (action === 'deleteKategori') {
      const id = String(payload.id || '').trim();
      const allDocs = getSheetData(ss, 'dokumen');
      const hasDocs = allDocs.some(function(doc) {
        return String(doc.kategori_id || '').trim() === id && String(doc.status || '').toLowerCase() === 'aktif';
      });

      if (hasDocs) {
        return jsonResponse(false, null, 'Kategori tidak dapat dihapus karena masih digunakan oleh dokumen arsip aktif.', 'HAS_DEPENDENT_RECORDS');
      }

      const katSheet = ss.getSheetByName('kategori_dokumen');
      const allKat = getSheetData(ss, 'kategori_dokumen');
      const target = allKat.find(function(k) { return String(k.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Kategori tidak ditemukan.', 'NOT_FOUND');

      katSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, 'superadmin', 'HAPUS_KATEGORI', 'Menghapus kategori: ' + target.nama_kategori);
      return jsonResponse(true, { id: id }, 'Kategori berhasil dihapus.');
    }

    // ---------------- PENGELOLAAN TAHUN ANGGARAN & FOLDER ----------------
    if (action === 'getTahunList') {
      const dewanId = String(payload.dewan_id || '').trim();
      const katId = String(payload.kategori_id || '').trim();

      const tahunData = getSheetData(ss, 'tahun_dokumen');
      const docData = getSheetData(ss, 'dokumen');

      const yearMap = {};
      tahunData.forEach(function(t) {
        if (String(t.dewan_id).trim() === dewanId && String(t.kategori_id).trim() === katId) {
          yearMap[t.tahun] = true;
        }
      });
      docData.forEach(function(d) {
        if (String(d.dewan_id).trim() === dewanId && String(d.kategori_id).trim() === katId && d.tahun) {
          yearMap[d.tahun] = true;
        }
      });

      const list = Object.keys(yearMap).map(function(yrStr) {
        const yr = parseInt(yrStr, 10);
        const count = docData.filter(function(d) {
          return String(d.dewan_id).trim() === dewanId &&
                 String(d.kategori_id).trim() === katId &&
                 parseInt(d.tahun, 10) === yr &&
                 String(d.status || '').toLowerCase() === 'aktif';
        }).length;
        return { tahun: yr, jumlah_dokumen: count };
      }).sort(function(a, b) { return b.tahun - a.tahun; });

      return jsonResponse(true, list, 'Daftar tahun berhasil dimuat.');
    }

    if (action === 'createTahun') {
      const dewanId = String(payload.dewan_id || '').trim();
      const katId = String(payload.kategori_id || '').trim();
      const tahun = parseInt(payload.tahun, 10);

      if (!dewanId || !katId || !tahun) {
        return jsonResponse(false, null, 'Dewan, kategori, dan tahun wajib ditentukan.', 'VALIDATION_ERROR');
      }

      const tahunSheet = ss.getSheetByName('tahun_dokumen');
      const newId = 'THN-' + Date.now();
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      tahunSheet.appendRow([newId, dewanId, katId, tahun, 'aktif', nowIso]);
      recordActivity(ss, session.userId, session.username, 'superadmin', 'TAMBAH_TAHUN', 'Menambahkan tahun anggaran: ' + tahun);
      return jsonResponse(true, { id: newId, tahun: tahun }, 'Tahun anggaran berhasil ditambahkan.');
    }

    if (action === 'updateTahun') {
      const dewanId = String(payload.dewan_id || '').trim();
      const katId = String(payload.kategori_id || '').trim();
      const tahunLama = parseInt(payload.tahun_lama, 10);
      const tahunBaru = parseInt(payload.tahun_baru, 10);

      if (!dewanId || !katId || !tahunLama || !tahunBaru) {
        return jsonResponse(false, null, 'Parameter tahun tidak lengkap.', 'VALIDATION_ERROR');
      }

      const tahunSheet = ss.getSheetByName('tahun_dokumen');
      const allTahun = getSheetData(ss, 'tahun_dokumen');
      allTahun.forEach(function(t) {
        if (String(t.dewan_id).trim() === dewanId && String(t.kategori_id).trim() === katId && parseInt(t.tahun, 10) === tahunLama) {
          tahunSheet.getRange(t._rowIndex, 4).setValue(tahunBaru);
        }
      });

      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      allDocs.forEach(function(d) {
        if (String(d.dewan_id).trim() === dewanId && String(d.kategori_id).trim() === katId && parseInt(d.tahun, 10) === tahunLama) {
          docSheet.getRange(d._rowIndex, 4).setValue(tahunBaru);
        }
      });

      recordActivity(ss, session.userId, session.username, 'superadmin', 'UPDATE_TAHUN', 'Memperbarui tahun: ' + tahunLama + ' -> ' + tahunBaru);
      return jsonResponse(true, { tahun: tahunBaru }, 'Tahun berhasil diperbarui.');
    }

    if (action === 'deleteTahun') {
      const dewanId = String(payload.dewan_id || '').trim();
      const katId = String(payload.kategori_id || '').trim();
      const tahun = parseInt(payload.tahun, 10);

      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      const docsToDelete = allDocs.filter(function(d) {
        return String(d.dewan_id).trim() === dewanId && String(d.kategori_id).trim() === katId && parseInt(d.tahun, 10) === tahun;
      });

      docsToDelete.forEach(function(doc) {
        if (doc.file_id) {
          try { DriveApp.getFileById(String(doc.file_id).trim()).setTrashed(true); } catch (e) {}
        }
      });

      for (let i = allDocs.length - 1; i >= 0; i--) {
        const d = allDocs[i];
        if (String(d.dewan_id).trim() === dewanId && String(d.kategori_id).trim() === katId && parseInt(d.tahun, 10) === tahun) {
          docSheet.deleteRow(d._rowIndex);
        }
      }

      const tahunSheet = ss.getSheetByName('tahun_dokumen');
      const allTahun = getSheetData(ss, 'tahun_dokumen');
      for (let i = allTahun.length - 1; i >= 0; i--) {
        const t = allTahun[i];
        if (String(t.dewan_id).trim() === dewanId && String(t.kategori_id).trim() === katId && parseInt(t.tahun, 10) === tahun) {
          tahunSheet.deleteRow(t._rowIndex);
        }
      }

      recordActivity(ss, session.userId, session.username, 'superadmin', 'HAPUS_TAHUN', 'Menghapus arsip tahun: ' + tahun);
      return jsonResponse(true, null, 'Folder tahun beserta dokumen terkait berhasil dihapus.');
    }

    if (action === 'getFolderList') {
      const dewanId = String(payload.dewan_id || '').trim();
      const katId = String(payload.kategori_id || '').trim();
      const yr = parseInt(payload.tahun, 10);

      const folderData = getSheetData(ss, 'folder_dokumen');
      const docData = getSheetData(ss, 'dokumen');

      const folders = folderData.filter(function(f) {
        return String(f.dewan_id).trim() === dewanId &&
               String(f.kategori_id).trim() === katId &&
               parseInt(f.tahun, 10) === yr;
      });

      const result = folders.map(function(f) {
        const count = docData.filter(function(d) {
          return String(d.dewan_id).trim() === dewanId &&
                 String(d.kategori_id).trim() === katId &&
                 parseInt(d.tahun, 10) === yr &&
                 String(d.nama_folder || '').trim().toLowerCase() === String(f.nama_folder || '').trim().toLowerCase() &&
                 String(d.status || '').toLowerCase() === 'aktif';
        }).length;
        return {
          id: f.id,
          nama_folder: f.nama_folder,
          jumlah_dokumen: count
        };
      });

      return jsonResponse(true, result, 'Daftar folder berhasil dimuat.');
    }

    if (action === 'createFolder') {
      const dewanId = String(payload.dewan_id || '').trim();
      const katId = String(payload.kategori_id || '').trim();
      const yr = parseInt(payload.tahun, 10);
      const namaFolder = String(payload.nama_folder || '').trim();

      if (!namaFolder) return jsonResponse(false, null, 'Nama folder wajib diisi.', 'VALIDATION_ERROR');

      // Idempotensi: kembalikan record jika folder dengan nama yang sama sudah ada
      const allFolder = getSheetData(ss, 'folder_dokumen');
      const existing = allFolder.find(function(f) {
        return String(f.dewan_id || '').trim() === dewanId &&
               String(f.kategori_id || '').trim() === katId &&
               parseInt(f.tahun, 10) === yr &&
               String(f.nama_folder || '').trim().toLowerCase() === namaFolder.toLowerCase() &&
               String(f.status || 'aktif').toLowerCase() === 'aktif';
      });

      if (existing) {
        return jsonResponse(true, { id: existing.id, nama_folder: existing.nama_folder }, 'Folder berhasil dibuat.');
      }

      const folderSheet = ss.getSheetByName('folder_dokumen');
      const newId = 'FLD-' + Date.now();
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      folderSheet.appendRow([newId, dewanId, katId, yr, sanitizeSheetValue(namaFolder), '', 'aktif', nowIso]);
      recordActivity(ss, session.userId, session.username, 'superadmin', 'TAMBAH_FOLDER', 'Membuat folder: ' + namaFolder);
      return jsonResponse(true, { id: newId, nama_folder: namaFolder }, 'Folder berhasil dibuat.');
    }

    if (action === 'updateFolder') {
      const dewanId = String(payload.dewan_id || '').trim();
      const katId = String(payload.kategori_id || '').trim();
      const yr = parseInt(payload.tahun, 10);
      const folderLama = String(payload.folder_lama || payload.nama_folder_lama || '').trim();
      const folderBaru = String(payload.folder_baru || payload.nama_folder_baru || '').trim();

      if (!dewanId || !katId || !yr || !folderLama || !folderBaru) {
        return jsonResponse(false, null, 'Parameter pembaruan folder tidak lengkap.', 'VALIDATION_ERROR');
      }

      const folderSheet = ss.getSheetByName('folder_dokumen');
      const allFolder = getSheetData(ss, 'folder_dokumen');
      allFolder.forEach(function(f) {
        if (String(f.dewan_id).trim() === dewanId && String(f.kategori_id).trim() === katId && parseInt(f.tahun, 10) === yr && String(f.nama_folder).trim().toLowerCase() === folderLama.toLowerCase()) {
          folderSheet.getRange(f._rowIndex, 5).setValue(sanitizeSheetValue(folderBaru));
        }
      });

      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      allDocs.forEach(function(d) {
        if (String(d.dewan_id).trim() === dewanId && String(d.kategori_id).trim() === katId && parseInt(d.tahun, 10) === yr && String(d.nama_folder).trim().toLowerCase() === folderLama.toLowerCase()) {
          docSheet.getRange(d._rowIndex, 5).setValue(sanitizeSheetValue(folderBaru));
        }
      });

      recordActivity(ss, session.userId, session.username, 'superadmin', 'UPDATE_FOLDER', 'Memperbarui folder: ' + folderLama + ' -> ' + folderBaru);
      return jsonResponse(true, { nama_folder: folderBaru }, 'Folder berhasil diperbarui.');
    }

    if (action === 'deleteFolder') {
      const dewanId = String(payload.dewan_id || '').trim();
      const katId = String(payload.kategori_id || '').trim();
      const yr = parseInt(payload.tahun, 10);
      const namaFolder = String(payload.nama_folder || '').trim();

      const allDocs = getSheetData(ss, 'dokumen');
      const activeDocs = allDocs.filter(function(d) {
        return String(d.dewan_id || '').trim() === dewanId &&
               String(d.kategori_id || '').trim() === katId &&
               parseInt(d.tahun, 10) === yr &&
               String(d.nama_folder || '').trim().toLowerCase() === namaFolder.toLowerCase() &&
               String(d.status || '').toLowerCase() === 'aktif';
      });

      if (activeDocs.length > 0) {
        return jsonResponse(false, null, 'Folder tidak dapat dihapus karena masih berisi ' + activeDocs.length + ' berkas dokumen aktif. Hapus berkas dokumen di dalamnya terlebih dahulu.', 'HAS_DEPENDENT_RECORDS');
      }

      const folderSheet = ss.getSheetByName('folder_dokumen');
      const allFolder = getSheetData(ss, 'folder_dokumen');
      for (let i = allFolder.length - 1; i >= 0; i--) {
        const f = allFolder[i];
        if (String(f.dewan_id || '').trim() === dewanId &&
            String(f.kategori_id || '').trim() === katId &&
            parseInt(f.tahun, 10) === yr &&
            String(f.nama_folder || '').trim().toLowerCase() === namaFolder.toLowerCase()) {
          folderSheet.deleteRow(f._rowIndex);
        }
      }

      recordActivity(ss, session.userId, session.username, 'superadmin', 'HAPUS_FOLDER', 'Menghapus folder: ' + namaFolder);
      return jsonResponse(true, { nama_folder: namaFolder }, 'Folder berhasil dihapus.');
    }

    // ---------------- PENGELOLAAN DOKUMEN ARSIP & DRIVE ----------------
    if (action === 'getDokumenList') {
      const dewanId = payload.dewan_id ? String(payload.dewan_id).trim() : null;
      const katId = payload.kategori_id ? String(payload.kategori_id).trim() : null;
      const yr = payload.tahun ? parseInt(payload.tahun, 10) : null;
      const folderName = payload.nama_folder ? String(payload.nama_folder).trim().toLowerCase() : null;

      let list = getSheetData(ss, 'dokumen').filter(function(d) {
        return String(d.status || '').toLowerCase() === 'aktif';
      });

      if (dewanId) list = list.filter(function(d) { return String(d.dewan_id).trim() === dewanId; });
      if (katId) list = list.filter(function(d) { return String(d.kategori_id).trim() === katId; });
      if (yr) list = list.filter(function(d) { return parseInt(d.tahun, 10) === yr; });
      if (folderName) list = list.filter(function(d) { return String(d.nama_folder || '').trim().toLowerCase() === folderName; });

      return jsonResponse(true, list, 'Daftar dokumen berhasil dimuat.');
    }

    if (action === 'getDokumenById') {
      const id = String(payload.id || '').trim();
      const allDocs = getSheetData(ss, 'dokumen');
      const item = allDocs.find(function(d) { return String(d.id || '').trim() === id; });

      if (!item) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');
      return jsonResponse(true, item, 'Data dokumen berhasil dimuat.');
    }

    if (action === 'uploadDokumen') {
      const data = payload.data || payload;
      const dewanId = String(data.dewan_id || '').trim();
      const katId = String(data.kategori_id || '').trim();
      const tahun = parseInt(data.tahun, 10);
      const namaFolder = String(data.nama_folder || '').trim();
      const namaDokumen = String(data.nama_dokumen || data.judul || '').trim();
      const keterangan = String(data.keterangan || '').trim();
      const fileName = String(data.fileName || data.nama_file || 'dokumen.pdf').trim();
      const base64Data = data.base64;

      if (!dewanId || !katId || !tahun || !namaDokumen || !base64Data) {
        return jsonResponse(false, null, 'Dewan, kategori, tahun, nama dokumen, dan berkas fisik wajib diisi.', 'VALIDATION_ERROR');
      }

      const allDewan = getSheetData(ss, 'dewan');
      const dewanExists = allDewan.some(function(d) { return String(d.id).trim() === dewanId; });
      if (!dewanExists) return jsonResponse(false, null, 'ID Dewan tidak valid.', 'INVALID_DEWAN');

      const allKat = getSheetData(ss, 'kategori_dokumen');
      const katExists = allKat.some(function(k) { return String(k.id).trim() === katId; });
      if (!katExists) return jsonResponse(false, null, 'ID Kategori tidak valid.', 'INVALID_CATEGORY');

      // Idempotensi: deteksi duplikasi dokumen identik yang baru saja diunggah
      const allDocs = getSheetData(ss, 'dokumen');
      const existingDoc = allDocs.find(function(d) {
        return String(d.dewan_id || '').trim() === dewanId &&
               String(d.kategori_id || '').trim() === katId &&
               parseInt(d.tahun, 10) === tahun &&
               String(d.nama_folder || '').trim().toLowerCase() === namaFolder.toLowerCase() &&
               String(d.nama_dokumen || '').trim().toLowerCase() === namaDokumen.toLowerCase() &&
               String(d.nama_file || '').trim().toLowerCase() === fileName.toLowerCase() &&
               String(d.status || '').toLowerCase() === 'aktif';
      });
      if (existingDoc) {
        return jsonResponse(true, {
          id: existingDoc.id,
          nama_dokumen: existingDoc.nama_dokumen,
          file_id: existingDoc.file_id,
          view_url: existingDoc.view_url
        }, 'Dokumen arsip berhasil diunggah.');
      }

      let validatedFile;
      try {
        validatedFile = validateFileContentAndSignature(base64Data, fileName);
      } catch (valErr) {
        return jsonResponse(false, null, valErr.message, 'FILE_VALIDATION_ERROR');
      }

      let driveFolder;
      try {
        driveFolder = getDocFolder();
      } catch (e) {
        return jsonResponse(false, null, 'Folder penyimpanan Google Drive tidak dapat diakses.', 'DRIVE_ACCESS_ERROR');
      }

      let createdDriveFile = null;
      try {
        const blob = Utilities.newBlob(validatedFile.bytes, validatedFile.mimeType, fileName);
        createdDriveFile = driveFolder.createFile(blob);
        createdDriveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        const driveFileId = createdDriveFile.getId();
        const driveViewUrl = createdDriveFile.getUrl();
        const driveDownloadUrl = createdDriveFile.getDownloadUrl();

        const stableDocId = 'DOC-' + Date.now() + '-' + Utilities.getUuid().substring(0, 4);
        const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

        const docSheet = ss.getSheetByName('dokumen');
        docSheet.appendRow([
          stableDocId,
          dewanId,
          katId,
          tahun,
          sanitizeSheetValue(namaFolder),
          sanitizeSheetValue(namaDokumen),
          sanitizeSheetValue(keterangan),
          sanitizeSheetValue(fileName),
          driveFileId,
          driveDownloadUrl,
          driveViewUrl,
          validatedFile.mimeType,
          validatedFile.sizeBytes,
          'aktif',
          session.username,
          nowIso
        ]);

        recordActivity(ss, session.userId, session.username, 'superadmin', 'UPLOAD_DOKUMEN', 'Mengunggah: ' + namaDokumen + ' (' + fileName + ')');

        return jsonResponse(true, {
          id: stableDocId,
          nama_dokumen: namaDokumen,
          file_id: driveFileId,
          view_url: driveViewUrl
        }, 'Dokumen arsip berhasil diunggah.');

      } catch (uploadErr) {
        if (createdDriveFile) {
          try { createdDriveFile.setTrashed(true); } catch (e) {}
        }
        return jsonResponse(false, null, 'Gagal menyimpan dokumen: ' + uploadErr.message, 'UPLOAD_ROLLBACK');
      }
    }

    if (action === 'downloadDokumen') {
      const id = String(payload.id || '').trim();
      const allDocs = getSheetData(ss, 'dokumen');
      const target = allDocs.find(function(d) { return String(d.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');
      if (!target.file_id) return jsonResponse(false, null, 'ID berkas Google Drive tidak tercatat.', 'FILE_NOT_FOUND');

      try {
        const driveFile = DriveApp.getFileById(String(target.file_id).trim());
        const blob = driveFile.getBlob();
        const base64 = Utilities.base64Encode(blob.getBytes());

        recordActivity(ss, session.userId, session.username, 'superadmin', 'DOWNLOAD_DOKUMEN', 'Mengunduh dokumen: ' + target.nama_dokumen);

        return jsonResponse(true, {
          id: target.id,
          nama_dokumen: target.nama_dokumen,
          nama_file: target.nama_file,
          mime_type: target.mime_type,
          ukuran_file: target.ukuran_file,
          base64: base64
        }, 'Berkas siap diunduh.');
      } catch (err) {
        return jsonResponse(false, null, 'Gagal mengambil berkas fisik dari Google Drive: ' + err.message, 'DRIVE_ERROR');
      }
    }

    if (action === 'updateDokumen') {
      const data = payload.data || payload;
      const id = String(data.id || '').trim();
      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      const target = allDocs.find(function(d) { return String(d.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');

      const rowIdx = target._rowIndex;
      if (data.nama_dokumen) docSheet.getRange(rowIdx, 6).setValue(sanitizeSheetValue(String(data.nama_dokumen).trim()));
      if (data.kategori_id) docSheet.getRange(rowIdx, 3).setValue(String(data.kategori_id).trim());
      if (data.tahun) docSheet.getRange(rowIdx, 4).setValue(parseInt(data.tahun, 10));
      if (data.nama_folder !== undefined) docSheet.getRange(rowIdx, 5).setValue(sanitizeSheetValue(String(data.nama_folder).trim()));
      if (data.keterangan !== undefined) docSheet.getRange(rowIdx, 7).setValue(sanitizeSheetValue(String(data.keterangan).trim()));

      if (data.base64 && data.fileName) {
        const validatedFile = validateFileContentAndSignature(data.base64, data.fileName);
        const driveFolder = getDocFolder();
        const blob = Utilities.newBlob(validatedFile.bytes, validatedFile.mimeType, data.fileName);
        const newFile = driveFolder.createFile(blob);
        newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        if (target.file_id) {
          try { DriveApp.getFileById(String(target.file_id).trim()).setTrashed(true); } catch (e) {}
        }

        docSheet.getRange(rowIdx, 8).setValue(sanitizeSheetValue(data.fileName));
        docSheet.getRange(rowIdx, 9).setValue(newFile.getId());
        docSheet.getRange(rowIdx, 10).setValue(newFile.getDownloadUrl());
        docSheet.getRange(rowIdx, 11).setValue(newFile.getUrl());
        docSheet.getRange(rowIdx, 12).setValue(validatedFile.mimeType);
        docSheet.getRange(rowIdx, 13).setValue(validatedFile.sizeBytes);
      }

      recordActivity(ss, session.userId, session.username, 'superadmin', 'UPDATE_DOKUMEN', 'Memperbarui dokumen: ' + (data.nama_dokumen || target.nama_dokumen));
      return jsonResponse(true, { id: id }, 'Dokumen berhasil diperbarui.');
    }

    if (action === 'deleteDokumen') {
      const id = String(payload.id || '').trim();
      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      const target = allDocs.find(function(d) { return String(d.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');

      const fileId = target.file_id;
      if (fileId && String(fileId).trim()) {
        try {
          const driveFile = DriveApp.getFileById(String(fileId).trim());
          driveFile.setTrashed(true);
        } catch (e) {
          Logger.log('Berkas fisik tidak ditemukan di Drive saat penghapusan: ' + e.message);
        }
      }

      docSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, 'superadmin', 'HAPUS_DOKUMEN', 'Menghapus dokumen: ' + target.nama_dokumen);
      return jsonResponse(true, { id: id }, 'Dokumen arsip berhasil dihapus.');
    }

    // ---------------- AKSI LOG AUDIT & PROFILE FALLBACK ----------------
    if (action === 'getActivityLog') {
      const limit = parseInt(payload.limit, 10) || 100;
      const logs = getSheetData(ss, 'aktivitas_log');
      const sorted = logs.slice(-limit).reverse();
      return jsonResponse(true, sorted, 'Log aktivitas berhasil dimuat.');
    }

    if (action === 'clearActivityLog') {
      const sheet = ss.getSheetByName('aktivitas_log');
      if (!sheet) {
        return jsonResponse(false, null, 'Sheet log aktivitas tidak ditemukan.', 'SHEET_NOT_FOUND');
      }
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Hapus baris rekaman log (baris 2 ke bawah), biarkan header kolom di baris 1
        sheet.deleteRows(2, lastRow - 1);
      }
      recordActivity(ss, session.userId, session.username, 'superadmin', 'BERSIHKAN_LOG', 'Seluruh riwayat log aktivitas dibersihkan');
      return jsonResponse(true, { cleared: true }, 'Seluruh riwayat aktivitas berhasil dibersihkan.');
    }

    if (action === 'getUserList') {
      const users = getSheetData(ss, 'users');
      const safeList = users.map(function(u) {
        return {
          id: u.id,
          username: u.username,
          nama: u.nama,
          role: 'superadmin',
          status: u.status,
          must_change_password: false,
          created_at: u.created_at,
          last_login: u.last_login
        };
      });
      return jsonResponse(true, safeList, 'Data akun berhasil dimuat.');
    }

    return jsonResponse(false, null, 'Aksi API tidak dikenali: ' + action, 'NOT_FOUND');

  } catch (err) {
    Logger.log('ERROR UTAMA POST: ' + err.toString());
    return jsonResponse(false, null, 'Terjadi kendala pada server: ' + err.message, 'INTERNAL_SERVER_ERROR');
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}
