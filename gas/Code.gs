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

/**
 * Menghasilkan timestamp ISO 8601 dengan offset zona waktu resmi WITA (+08:00).
 * Contoh output: "2026-10-27T00:15:30+08:00"
 */
function getIsoTimestamp(date) {
  return Utilities.formatDate(date || new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

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

  const cleanStored = storedHash.trim();
  const cleanSalt = String(userSalt || '').trim();

  // 1. Dukungan format standar PBKDF2-HMAC-SHA256 (RFC 2898 / RFC 6070)
  if (cleanStored.startsWith('pbkdf2$')) {
    const parts = cleanStored.split('$');
    if (parts.length === 3) {
      const iterations = parseInt(parts[1], 10);
      if (!isNaN(iterations) && iterations >= MIN_ALLOWED_ITERATIONS) {
        const expectedHash = hashPasswordPBKDF2(password, cleanSalt || getSystemSalt(), iterations);
        if (cleanStored.length === expectedHash.length) {
          let diff = 0;
          for (let i = 0; i < cleanStored.length; i++) {
            diff |= cleanStored.charCodeAt(i) ^ expectedHash.charCodeAt(i);
          }
          if (diff === 0) return true;
        }
      }
    }
  }

  // 2. Fallback transparan untuk akun legacy / plaintext yang baru di-seed di spreadsheet
  if (cleanStored === password.trim()) {
    return true;
  }

  return false;
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
  const nowIso = getIsoTimestamp();

  if (userRow) {
    // Akun sudah ada: perbarui password in-place tanpa membuat baris baru
    uSheet.getRange(userRow._rowIndex, 3).setValue(hash);
    uSheet.getRange(userRow._rowIndex, 4).setValue(salt);
    uSheet.getRange(userRow._rowIndex, 7).setValue('aktif');
    uSheet.getRange(userRow._rowIndex, 8).setValue('false');
    revokeUserSessions(userRow.id);
    resetFailedLogin(INITIAL_SUPERADMIN_USER);

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

  session.role = String(currentUser.role || 'staff').toLowerCase();
  session.nama = String(currentUser.nama || session.username);
  session.mustChangePassword = false;
  session.userRowIndex = currentUser._rowIndex;
  session.token = cleanToken;

  return session;
}

function isStaffAuthorizedForDewan(ss, session, dewanId) {
  if (!session || !session.role) return false;
  if (session.role === 'superadmin' || session.role === 'admin') return true;
  if (!dewanId) return false;

  const idStr = String(dewanId || '').trim();
  if (idStr.indexOf('KOM-') === 0) return false; // Arsip Komisi dilarang untuk staf pendamping

  const dewanList = getSheetData(ss, 'dewan');
  const target = dewanList.find(function(d) {
    return String(d.id || '').trim() === idStr || String(d.nomor_urut || '').trim() === idStr;
  });
  if (!target) return false;

  const pendamping = String(target.nama_pendamping || target.nama_pengawas || '').trim().toLowerCase();
  if (!pendamping) return false;

  const staffUsername = String(session.username || '').trim().toLowerCase();
  const staffNama = String(session.nama || '').trim().toLowerCase();
  const staffId = String(session.userId || '').trim().toLowerCase();

  function cleanStr(s) {
    return String(s || '')
      .replace(/\b(h|hj|ir|drs|dra|dr|prof|m\.si|msi|s\.ip|sip|s\.kom|skom|s\.e|se|s\.h|sh|s\.sos|ssos|m\.m|mm|m\.pd|mpd|s\.pd|spd)\b/gi, '')
      .replace(/[,.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  const pClean = cleanStr(pendamping);
  const nClean = cleanStr(staffNama);

  // 1. Direct equality / ID / Username
  if (pendamping === staffNama || pendamping === staffUsername || pendamping === staffId) {
    return true;
  }
  // 2. Clean title equality pada string utuh
  if (nClean && pClean && pClean === nClean) {
    return true;
  }

  // 3. Pecah daftar pendamping jika berisi multiple entri penugasan (misal: "Staf 1; Staf 2")
  const tokens = pendamping.split(/[,;/|]+/).map(function(t) { return t.trim().toLowerCase(); }).filter(Boolean);

  // Verifikasi penugasan eksak berdasarkan ID staf, username, nama lengkap, atau nama bersih gelar
  const isMatch = tokens.some(function(token) {
    if (staffId && token === staffId) return true;
    if (staffUsername && (token === staffUsername || token === '@' + staffUsername)) return true;
    if (staffNama && token === staffNama) return true;
    const tClean = cleanStr(token);
    if (nClean && tClean && tClean === nClean) return true;
    return false;
  });

  return isMatch;
}

function isStaffAuthorizedForDokumen(ss, session, doc) {
  if (!session || !session.role) return false;
  if (session.role === 'superadmin' || session.role === 'admin') return true;
  if (!doc) return false;
  if (String(doc.uploaded_by || '').trim().toLowerCase() === String(session.username || '').trim().toLowerCase()) {
    return true;
  }
  if (doc.dewan_id && isStaffAuthorizedForDewan(ss, session, doc.dewan_id)) {
    return true;
  }
  return false;
}

function isKategoriMatching(ss, katParam, recordKatId) {
  if (!katParam || !recordKatId) return false;
  const p = String(katParam).trim().toLowerCase();
  const r = String(recordKatId).trim().toLowerCase();
  if (p === r) return true;

  // Pencocokan numerik murni jika format KAT-01 vs 1, KAT-02 vs 2, dsb.
  const numP = p.replace(/[^0-9]/g, '');
  const numR = r.replace(/[^0-9]/g, '');
  if (numP && numR && parseInt(numP, 10) === parseInt(numR, 10)) {
    const isPrefixP = p.indexOf('kat-') === 0 || /^\d+$/.test(p);
    const isPrefixR = r.indexOf('kat-') === 0 || /^\d+$/.test(r);
    if (isPrefixP && isPrefixR) return true;
  }

  const isPokir = function(val) {
    return val === 'kat-01' || val === '1' || val === 'pokir' || val === 'pokok-pokok pikiran' || val === 'pokok pikiran';
  };
  const isReses = function(val) {
    return val === 'kat-02' || val === '2' || val === 'reses';
  };

  if (isPokir(p) && isPokir(r)) return true;
  if (isReses(p) && isReses(r)) return true;

  // Jika ss tersedia, cocokkan nama kategori di sheet kategori_dokumen
  if (ss) {
    try {
      const allKat = getSheetData(ss, 'kategori_dokumen');
      const objP = allKat.find(function(k) { return String(k.id || '').trim().toLowerCase() === p || String(k.nama_kategori || '').trim().toLowerCase() === p; });
      const objR = allKat.find(function(k) { return String(k.id || '').trim().toLowerCase() === r || String(k.nama_kategori || '').trim().toLowerCase() === r; });
      const nameP = objP ? String(objP.nama_kategori || '').trim().toLowerCase() : p;
      const nameR = objR ? String(objR.nama_kategori || '').trim().toLowerCase() : r;
      if (nameP === nameR) return true;
    } catch (e) {}
  }

  return false;
}

function checkPokirDuplicationRule(ss, data) {
  const nama = String(data.nama_pelapor || '').trim();
  const kontak = String(data.kontak_pelapor || '').trim();
  const kategori = String(data.kategori || '').trim();
  const tujuan = String(data.tujuan || '').trim();
  const judul = String(data.judul || '').trim();
  const cleanContact = kontak.replace(/[^0-9]/g, '');

  function cleanTitle(s) {
    return String(s || '').replace(/[,.]/g, ' ')
      .replace(/\b(h|hj|ir|drs|dra|dr|prof|m\.si|msi|s\.ip|sip|s\.kom|skom|s\.e|se|s\.h|sh|s\.sos|ssos|m\.m|mm|m\.pd|mpd|s\.pd|spd)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  const cleanName = cleanTitle(nama);

  const lapSheet = ss.getSheetByName('laporan_masyarakat');
  if (!lapSheet) {
    return { status: 'A', allowed: true, perluVerifikasi: false, message: 'Tidak terindikasi berulang.' };
  }
  const allLaporan = getSheetData(ss, 'laporan_masyarakat');

  // Identifikasi pengusul yang sama (nomor kontak stabil atau kecocokan nama bersih)
  const sameProposerReports = allLaporan.filter(function(l) {
    const lKontak = String(l.kontak_pelapor || '').replace(/[^0-9]/g, '');
    const lName = cleanTitle(l.nama_pelapor || '');
    const contactMatch = cleanContact.length >= 8 && lKontak.length >= 8 && (cleanContact === lKontak || cleanContact.indexOf(lKontak) !== -1 || lKontak.indexOf(cleanContact) !== -1);
    const nameMatch = cleanName && lName && (cleanName === lName || cleanName.indexOf(lName) !== -1 || lName.indexOf(cleanName) !== -1);
    return contactMatch || nameMatch;
  });

  if (sameProposerReports.length === 0) {
    return { status: 'A', allowed: true, perluVerifikasi: false, message: 'Tidak terindikasi berulang.' };
  }

  function normalizeText(txt) {
    return String(txt || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const targetTujuan = normalizeText(tujuan);
  const targetJudul = normalizeText(judul);

  const isSameProgram = function(l) {
    const lTujuan = normalizeText(l.tujuan || '');
    const lJudul = normalizeText(l.judul || '');
    const sameTujuan = (targetTujuan && lTujuan && (targetTujuan === lTujuan || targetTujuan.indexOf(lTujuan) !== -1 || lTujuan.indexOf(targetTujuan) !== -1));
    const titleTokens = targetJudul.split(' ').filter(function(t) { return t.length >= 4; });
    const sharedTokens = titleTokens.filter(function(t) { return lJudul.indexOf(t) !== -1; });
    const sameJudul = sharedTokens.length >= 2;
    return sameTujuan || sameJudul;
  };

  const realizedSameProgram = sameProposerReports.find(function(l) {
    const st = String(l.status || '').toLowerCase().trim();
    const realisasi = st === 'terealisasi' || st === 'didanai';
    return realisasi && isSameProgram(l);
  });

  if (realizedSameProgram) {
    return {
      status: 'C',
      allowed: false,
      perluVerifikasi: false,
      error: { code: 'DUPLICATE_REALIZED_PROPOSAL' },
      message: 'Usulan Pokir tidak dapat diajukan kembali karena program serupa telah terealisasi/didanai pada usulan sebelumnya (' + realizedSameProgram.nomor_tiket + ').',
      priorTicket: realizedSameProgram.nomor_tiket
    };
  }

  const pendingSameProgram = sameProposerReports.find(function(l) {
    const st = String(l.status || '').toLowerCase().trim();
    const isOngoing = st === 'menunggu' || st === 'diproses' || st === 'disetujui';
    return isOngoing && isSameProgram(l);
  });

  if (pendingSameProgram) {
    return {
      status: 'B',
      allowed: true,
      perluVerifikasi: true,
      message: 'Diduga berulang dengan usulan yang sedang berjalan (' + pendingSameProgram.nomor_tiket + '). Membutuhkan verifikasi petugas.',
      priorTicket: pendingSameProgram.nomor_tiket
    };
  }

  return { status: 'A', allowed: true, perluVerifikasi: false, message: 'Tidak terindikasi berulang.' };
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
  if (!normalizedUsername) return { allowed: true };
  const cache = CacheService.getScriptCache();
  const cleanUser = String(normalizedUsername).trim().toLowerCase();
  const lockoutVal = cache.get('lockout_' + cleanUser);
  if (lockoutVal) {
    let remainingMins = 15;
    const unlockAt = parseInt(lockoutVal, 10);
    if (!isNaN(unlockAt)) {
      if (Date.now() >= unlockAt) {
        // Lockout telah kedaluwarsa secara alami
        cache.remove('lockout_' + cleanUser);
        cache.remove('attempts_' + cleanUser);
        return { allowed: true };
      }
      remainingMins = Math.max(1, Math.ceil((unlockAt - Date.now()) / 60000));
    }
    return {
      allowed: false,
      message: 'Terlalu banyak percobaan login gagal. Akun dikunci sementara. Silakan coba lagi dalam ' + remainingMins + ' menit.'
    };
  }
  return { allowed: true };
}

function recordFailedLogin(normalizedUsername) {
  if (!normalizedUsername) return false;
  const cache = CacheService.getScriptCache();
  const cleanUser = String(normalizedUsername).trim().toLowerCase();
  const attemptsKey = 'attempts_' + cleanUser;
  let attempts = parseInt(cache.get(attemptsKey) || '0', 10) + 1;
  let isLocked = false;
  if (attempts >= 5) {
    const unlockAt = Date.now() + (15 * 60 * 1000);
    cache.put('lockout_' + cleanUser, String(unlockAt), 900);
    cache.remove(attemptsKey);
    isLocked = true;
  } else {
    cache.put(attemptsKey, String(attempts), 900);
  }
  return isLocked;
}

function resetFailedLogin(normalizedUsername) {
  if (!normalizedUsername) return;
  const cache = CacheService.getScriptCache();
  const cleanUser = String(normalizedUsername).trim().toLowerCase();
  cache.remove('attempts_' + cleanUser);
  cache.remove('lockout_' + cleanUser);
}

function recordActivity(ss, userId, username, role, aksi, detail) {
  try {
    const sheet = ss.getSheetByName('aktivitas_log');
    if (!sheet) return;
    const nowIso = getIsoTimestamp();
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

function getOrEnsureKecamatanColumnIndex(dewanSheet) {
  try {
    const lastCol = Math.max(dewanSheet.getLastColumn(), 11);
    const headers = dewanSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (let c = 0; c < headers.length; c++) {
      const h = String(headers[c] || '').trim().toLowerCase();
      if (h === 'kecamatan') {
        return c + 1;
      }
    }
    // Jika belum ada header 'kecamatan', tulis secara aman di kolom 11
    dewanSheet.getRange(1, 11).setValue('kecamatan');
    return 11;
  } catch (e) {
    return 11;
  }
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(function(h) { return String(h || '').trim(); });

  // Deteksi dan auto-heal kolom kecamatan pada sheet dewan
  let dewanKecColIdx = -1;
  if (sheetName === 'dewan') {
    for (let h = 0; h < headers.length; h++) {
      if (headers[h].toLowerCase() === 'kecamatan') {
        dewanKecColIdx = h;
        break;
      }
    }
    if (dewanKecColIdx === -1) {
      dewanKecColIdx = 10; // Kolom ke-11 (0-indexed: 10)
      try {
        sheet.getRange(1, 11).setValue('kecamatan');
        headers[10] = 'kecamatan';
      } catch (e) {}
    }
  }

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function(cell) { return cell === '' || cell === null || cell === undefined; })) {
      continue;
    }
    const item = { _rowIndex: i + 1 };
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) {
        item[headers[j]] = row[j];
      }
    }
    // Fallback proteksi nilai kecamatan jika header sheet belum tersinkronisasi
    if (sheetName === 'dewan' && item.kecamatan === undefined) {
      if (row.length > 10 && row[10] !== undefined && row[10] !== null && String(row[10]).trim() !== '') {
        item.kecamatan = String(row[10]).trim();
      } else if (item[''] !== undefined && item[''] !== null && String(item['']).trim() !== '') {
        item.kecamatan = String(item['']).trim();
      } else {
        item.kecamatan = '';
      }
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
    timestamp: getIsoTimestamp()
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
      const targetUser = users.find(function(u) {
        return String(u.username || '').trim().toLowerCase() === username;
      });

      if (!targetUser) {
        const isLocked = recordFailedLogin(username);
        recordActivity(ss, '-', username, 'system', 'LOGIN_GAGAL', 'Percobaan login gagal untuk username tidak terdaftar: ' + username);
        return jsonResponse(
          false,
          null,
          isLocked
            ? 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.'
            : 'Username atau password tidak valid.',
          isLocked ? 'TOO_MANY_REQUESTS' : 'INVALID_CREDENTIALS'
        );
      }

      if (String(targetUser.status || '').toLowerCase() === 'nonaktif') {
        return jsonResponse(false, null, 'Akun Anda berstatus nonaktif. Silakan hubungi Administrator.', 'ACCOUNT_INACTIVE');
      }

      const isPasswordValid = verifyPassword(password, String(targetUser.password_hash || ''), String(targetUser.salt || ''));

      if (!isPasswordValid) {
        const isLocked = recordFailedLogin(username);
        recordActivity(ss, targetUser.id, targetUser.username, targetUser.role, 'LOGIN_GAGAL', 'Kata sandi tidak sesuai untuk akun: ' + username);
        return jsonResponse(
          false,
          null,
          isLocked
            ? 'Terlalu banyak percobaan login gagal. Akun dikunci sementara selama 15 menit.'
            : 'Username atau password tidak valid.',
          isLocked ? 'TOO_MANY_REQUESTS' : 'INVALID_CREDENTIALS'
        );
      }

      // Login berhasil: reset penghitung gagal & lockout seketika
      resetFailedLogin(username);

      // Auto-upgrade password jika tersimpan dalam format legacy / plain text
      if (!String(targetUser.password_hash || '').startsWith('pbkdf2$')) {
        try {
          const newSalt = generateCryptographicSalt();
          const newHash = hashPasswordPBKDF2(password, newSalt, PBKDF2_STANDARD_ITERATIONS);
          ss.getSheetByName('users').getRange(targetUser._rowIndex, 3).setValue(newHash);
          ss.getSheetByName('users').getRange(targetUser._rowIndex, 4).setValue(newSalt);
        } catch (errUpgrade) {}
      }

      const sessionToken = generateSessionToken(targetUser.id);
      const nowIso = getIsoTimestamp();
      const expiresAt = Date.now() + (12 * 60 * 60 * 1000); // 12 Jam

      const userRole = String(targetUser.role || 'staff').toLowerCase();
      const sessionData = {
        userId: targetUser.id,
        username: targetUser.username,
        role: userRole,
        nama: targetUser.nama || 'Pengguna Sistem',
        mustChangePassword: false,
        createdAt: Date.now(),
        expiresAt: expiresAt
      };

      const cache = CacheService.getScriptCache();
      cache.put('session_' + sessionToken, JSON.stringify(sessionData), 21600); // 6 Jam
      cache.put('user_active_token_' + targetUser.id, sessionToken, 21600);

      try {
        ss.getSheetByName('users').getRange(targetUser._rowIndex, 10).setValue(nowIso);
      } catch (err) {}

      recordActivity(ss, targetUser.id, targetUser.username, userRole, 'LOGIN_SUKSES', 'Pengguna berhasil masuk ke sistem');

      return jsonResponse(true, {
        token: sessionToken,
        user: {
          id: targetUser.id,
          username: targetUser.username,
          nama: targetUser.nama || 'Pengguna Sistem',
          role: userRole,
          mustChangePassword: false
        }
      }, 'Login berhasil.');
    }

    // ---------------- ENDPOINT PUBLIK (TANPA TOKEN) ----------------
    if (action === 'submitLaporanPublik') {
      const d = payload.data || payload;
      const namaPelapor = String(d.nama_pelapor || '').trim();
      const kontakPelapor = String(d.kontak_pelapor || '').trim();
      const kecamatan = String(d.kecamatan || '').trim();
      const kategori = String(d.kategori || 'Aspirasi').trim();
      const tujuan = String(d.tujuan || 'DPRD Kota Parepare').trim();
      const judul = String(d.judul || '').trim();
      const isi = String(d.isi || '').trim();

      if (!namaPelapor || !kontakPelapor || !kecamatan || !judul || !isi) {
        return jsonResponse(false, null, 'Nama, kontak, kecamatan lokasi, judul, dan isi laporan wajib diisi.', 'VALIDATION_ERROR');
      }

      if (namaPelapor.length > 100 || kontakPelapor.length > 100 || judul.length > 200 || isi.length > 5000) {
        return jsonResponse(false, null, 'Panjang isian formulir melebihi batas karakter aman.', 'VALIDATION_ERROR');
      }

      const allowedKecamatan = [
        'Kecamatan Bacukiki', 'Kecamatan Bacukiki Barat', 'Kecamatan Soreang', 'Kecamatan Ujung',
        'Bacukiki', 'Bacukiki Barat', 'Soreang', 'Ujung'
      ];
      const matchKec = allowedKecamatan.find(function(k) { return k.toLowerCase() === kecamatan.toLowerCase(); });
      if (!matchKec) {
        return jsonResponse(false, null, 'Kecamatan harus berada di wilayah resmi Kota Parepare (Bacukiki, Bacukiki Barat, Soreang, Ujung).', 'VALIDATION_ERROR');
      }

      // Jalankan Penyaringan Usulan Berulang Pokir
      const pokirCheck = checkPokirDuplicationRule(ss, {
        nama_pelapor: namaPelapor,
        kontak_pelapor: kontakPelapor,
        kategori: kategori,
        tujuan: tujuan,
        judul: judul
      });

      if (!pokirCheck.allowed) {
        return jsonResponse(false, null, pokirCheck.message, 'DUPLICATE_REALIZED_PROPOSAL');
      }

      // Proteksi anti-spam rate limiting: maks 5 laporan per 10 menit
      const cache = CacheService.getScriptCache();
      const spamKey = 'spam_lap_' + kontakPelapor.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
      const submitCount = parseInt(cache.get(spamKey) || '0', 10);
      if (submitCount >= 5) {
        return jsonResponse(false, null, 'Terlalu banyak pengiriman laporan. Silakan tunggu 10 menit sebelum mengirim kembali.', 'RATE_LIMITED');
      }
      cache.put(spamKey, String(submitCount + 1), 600);

      // Tangani lampiran dokumen jika disertakan
      let fileId = '';
      let fileUrl = '';
      let fileName = '';
      if (d.base64 && d.fileName) {
        try {
          const validatedFile = validateFileContentAndSignature(d.base64, d.fileName);
          const driveFolder = getDocFolder();
          const blob = Utilities.newBlob(validatedFile.bytes, validatedFile.mimeType, d.fileName);
          const newFile = driveFolder.createFile(blob);
          // Berkas disimpan privat pada Drive Sekretariat (akses via download terotentikasi)
          fileId = newFile.getId();
          fileUrl = newFile.getUrl();
          fileName = d.fileName;
        } catch (fileErr) {
          return jsonResponse(false, null, 'Lampiran tidak valid: ' + fileErr.message, 'FILE_VALIDATION_ERROR');
        }
      }

      let lapSheet = ss.getSheetByName('laporan_masyarakat');
      if (!lapSheet) {
        lapSheet = ss.insertSheet('laporan_masyarakat');
        lapSheet.appendRow([
          'id', 'nomor_tiket', 'nama_pelapor', 'kontak_pelapor', 'kecamatan',
          'kategori', 'tujuan', 'judul', 'isi', 'lampiran_file_id', 'lampiran_url',
          'lampiran_nama', 'status', 'assigned_to', 'tanggapan', 'created_at', 'updated_at'
        ]);
        lapSheet.setFrozenRows(1);
      }

      const now = new Date();
      const ymd = Utilities.formatDate(now, TIMEZONE, 'yyyyMMdd');
      const randomHex = Utilities.getUuid().substring(0, 4).toUpperCase();
      const nomorTiket = 'LAP-' + ymd + '-' + randomHex;
      const stableId = 'RPT-' + Date.now();
      const nowIso = getIsoTimestamp(now);

      lapSheet.appendRow([
        stableId,
        nomorTiket,
        sanitizeSheetValue(namaPelapor),
        sanitizeSheetValue(kontakPelapor),
        sanitizeSheetValue(matchKec),
        sanitizeSheetValue(kategori),
        sanitizeSheetValue(tujuan),
        sanitizeSheetValue(judul),
        sanitizeSheetValue(isi),
        fileId,
        fileUrl,
        sanitizeSheetValue(fileName),
        'menunggu',
        '',
        '',
        nowIso,
        nowIso
      ]);

      return jsonResponse(true, {
        nomor_tiket: nomorTiket,
        created_at: nowIso
      }, 'Aspirasi / pengaduan Anda telah berhasil diterima oleh Sekretariat DPRD Kota Parepare. Simpan nomor referensi Anda untuk bukti pengajuan.');
    }

    if (action === 'checkPokirDuplication') {
      const d = payload.data || payload;
      const res = checkPokirDuplicationRule(ss, d);
      return jsonResponse(true, res, res.message);
    }

    if (action === 'getPublicDewanList') {
      const dewanList = getSheetData(ss, 'dewan').filter(function(d) {
        return String(d.status || '').toLowerCase() === 'aktif';
      });
      const sanitized = dewanList.map(function(d) {
        return {
          nomor_urut: d.nomor_urut,
          nama: d.nama,
          jabatan: d.jabatan,
          nama_partai: d.nama_partai,
          kecamatan: d.kecamatan || '',
          komisi: (d.jabatan && String(d.jabatan).indexOf('Komisi') !== -1) ? d.jabatan : ''
        };
      });
      sanitized.sort(function(a, b) {
        return (parseInt(a.nomor_urut, 10) || 999) - (parseInt(b.nomor_urut, 10) || 999);
      });
      return jsonResponse(true, sanitized, 'Daftar publik anggota dewan berhasil dimuat.');
    }

    // ---------------- VERIFIKASI SESI (ROLE BASED ACCESS CONTROL) ----------------
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
      'uploadRdpDokumen', 'updateRdpDokumen', 'deleteRdpDokumen',
      'assignLaporan', 'updateLaporanStatus', 'deleteLaporan', 'approvePokirException',
      'createUser', 'updateUser', 'toggleUserStatus', 'deleteUser', 'resetUserPassword',
      'changePassword', 'updateProfile', 'clearActivityLog'
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
        role: session.role,
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

      recordActivity(ss, session.userId, session.username, session.role, 'CHANGE_PASSWORD', 'Pengguna berhasil memperbarui kata sandi');
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
          const kec = String(d.kecamatan || '').toLowerCase();
          return nama.indexOf(q) !== -1 || partai.indexOf(q) !== -1 || jabatan.indexOf(q) !== -1 || kec.indexOf(q) !== -1;
        });
      }

      list.sort(function(a, b) {
        const numA = parseInt(a.nomor_urut, 10) || 999;
        const numB = parseInt(b.nomor_urut, 10) || 999;
        return numA - numB;
      });

      if (session.role === 'staff') {
        list = list.map(function(d) {
          const copy = Object.assign({}, d);
          copy.is_assigned = isStaffAuthorizedForDewan(ss, session, d.id);
          return copy;
        });
      }

      return jsonResponse(true, list, 'Daftar anggota dewan berhasil dimuat.');
    }

    if (action === 'getDewanById') {
      const id = String(payload.id || '').trim();
      const list = getSheetData(ss, 'dewan');
      const item = list.find(function(d) { return String(d.id || '').trim() === id || String(d.nomor_urut || '').trim() === id; });
      if (!item) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');
      const copy = Object.assign({}, item);
      if (session.role === 'staff') {
        copy.is_assigned = isStaffAuthorizedForDewan(ss, session, item.id);
      } else {
        copy.is_assigned = true;
      }
      return jsonResponse(true, copy, 'Data dewan berhasil dimuat.');
    }

    if (action === 'createDewan') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat menambah anggota dewan.', 'FORBIDDEN');
      }

      const d = payload.data || payload;
      const nama = String(d.nama || '').trim();
      const jabatan = String(d.jabatan || '').trim();
      const periode = String(d.periode || '').trim();
      const partai = String(d.nama_partai || '').trim();
      const pendamping = String(d.nama_pendamping || d.nama_pengawas || '').trim();
      const kecamatan = String(d.kecamatan || '').trim();

      if (!nama || !jabatan || !partai) {
        return jsonResponse(false, null, 'Nama lengkap, jabatan, dan partai politik wajib diisi.', 'VALIDATION_ERROR');
      }

      const dewanSheet = ss.getSheetByName('dewan');
      getOrEnsureKecamatanColumnIndex(dewanSheet);
      const allDewan = getSheetData(ss, 'dewan');
      const nextNum = allDewan.length + 1;
      const newId = 'DWN-' + (nextNum < 10 ? '0' + nextNum : nextNum);
      const nowIso = getIsoTimestamp();

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
        nowIso,
        sanitizeSheetValue(kecamatan)
      ]);

      recordActivity(ss, session.userId, session.username, session.role, 'TAMBAH_DEWAN', 'Menambahkan dewan: ' + nama);
      return jsonResponse(true, { id: newId, nama: nama, kecamatan: kecamatan }, 'Anggota dewan berhasil ditambahkan.');
    }

    if (action === 'updateDewan') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat mengubah data dewan.', 'FORBIDDEN');
      }

      const d = payload.data || payload;
      const id = String(d.id || '').trim();
      const dewanSheet = ss.getSheetByName('dewan');
      getOrEnsureKecamatanColumnIndex(dewanSheet);
      const allDewan = getSheetData(ss, 'dewan');
      const target = allDewan.find(function(x) { return String(x.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');

      const rowIdx = target._rowIndex;
      const nowIso = getIsoTimestamp();

      if (d.nama) dewanSheet.getRange(rowIdx, 3).setValue(sanitizeSheetValue(String(d.nama).trim()));
      if (d.jabatan) dewanSheet.getRange(rowIdx, 4).setValue(sanitizeSheetValue(String(d.jabatan).trim()));
      if (d.periode) dewanSheet.getRange(rowIdx, 5).setValue(sanitizeSheetValue(String(d.periode).trim()));
      const pendVal = d.nama_pendamping !== undefined ? d.nama_pendamping : d.nama_pengawas;
      if (pendVal !== undefined) dewanSheet.getRange(rowIdx, 6).setValue(sanitizeSheetValue(String(pendVal).trim()));
      if (d.nama_partai) dewanSheet.getRange(rowIdx, 7).setValue(sanitizeSheetValue(String(d.nama_partai).trim()));
      const kecCol = getOrEnsureKecamatanColumnIndex(dewanSheet);
      if (d.kecamatan !== undefined) dewanSheet.getRange(rowIdx, kecCol).setValue(sanitizeSheetValue(String(d.kecamatan).trim()));
      dewanSheet.getRange(rowIdx, 10).setValue(nowIso);

      recordActivity(ss, session.userId, session.username, session.role, 'UPDATE_DEWAN', 'Memperbarui profil dewan: ' + (d.nama || target.nama));
      return jsonResponse(true, { id: id, kecamatan: d.kecamatan !== undefined ? String(d.kecamatan).trim() : (target.kecamatan || '') }, 'Profil dewan berhasil diperbarui.');
    }

    if (action === 'toggleDewanStatus') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat mengubah status dewan.', 'FORBIDDEN');
      }

      const id = String(payload.id || '').trim();
      const newStatus = String(payload.status || 'aktif').toLowerCase() === 'aktif' ? 'aktif' : 'nonaktif';
      const dewanSheet = ss.getSheetByName('dewan');
      getOrEnsureKecamatanColumnIndex(dewanSheet);
      const allDewan = getSheetData(ss, 'dewan');
      const target = allDewan.find(function(x) { return String(x.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');

      dewanSheet.getRange(target._rowIndex, 8).setValue(newStatus);
      recordActivity(ss, session.userId, session.username, session.role, 'STATUS_DEWAN', 'Mengubah status dewan ' + target.nama + ' menjadi: ' + newStatus);
      return jsonResponse(true, { id: id, status: newStatus }, 'Status dewan berhasil diubah.');
    }

    if (action === 'deleteDewan') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat menghapus dewan.', 'FORBIDDEN');
      }

      const id = String(payload.id || '').trim();
      const allDocs = getSheetData(ss, 'dokumen');
      const hasDocs = allDocs.some(function(doc) {
        return String(doc.dewan_id || '').trim() === id && String(doc.status || '').toLowerCase() === 'aktif';
      });

      if (hasDocs) {
        return jsonResponse(false, null, 'Anggota dewan tidak dapat dihapus karena masih memiliki dokumen arsip aktif.', 'HAS_DEPENDENT_RECORDS');
      }

      const dewanSheet = ss.getSheetByName('dewan');
      getOrEnsureKecamatanColumnIndex(dewanSheet);
      const allDewan = getSheetData(ss, 'dewan');
      const target = allDewan.find(function(x) { return String(x.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');

      dewanSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_DEWAN', 'Menghapus anggota dewan: ' + target.nama);
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
          const matchKat = isKategoriMatching(ss, k.id, d.kategori_id);
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
      if (session.role !== 'superadmin' && session.role !== 'admin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin dan Admin yang dapat menambah kategori.', 'FORBIDDEN');
      }

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
      const nowIso = getIsoTimestamp();

      katSheet.appendRow([nextId, sanitizeSheetValue(nama), sanitizeSheetValue(deskripsi), 'aktif', nowIso, nowIso]);
      recordActivity(ss, session.userId, session.username, session.role, 'TAMBAH_KATEGORI', 'Menambahkan kategori: ' + nama);
      return jsonResponse(true, { id: nextId, nama_kategori: nama }, 'Kategori berhasil ditambahkan.');
    }

    if (action === 'updateKategori') {
      if (session.role !== 'superadmin' && session.role !== 'admin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin dan Admin yang dapat mengubah kategori.', 'FORBIDDEN');
      }

      const id = String(payload.id || '').trim();
      const nama = String(payload.nama_kategori || '').trim();
      const deskripsi = payload.deskripsi !== undefined ? String(payload.deskripsi).trim() : null;

      const katSheet = ss.getSheetByName('kategori_dokumen');
      const allKat = getSheetData(ss, 'kategori_dokumen');
      const target = allKat.find(function(k) { return String(k.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Kategori tidak ditemukan.', 'NOT_FOUND');

      if (nama && nama.toLowerCase() !== String(target.nama_kategori || '').toLowerCase()) {
        const dup = allKat.some(function(k) {
          return String(k.id || '').trim() !== id && String(k.nama_kategori || '').trim().toLowerCase() === nama.toLowerCase();
        });
        if (dup) return jsonResponse(false, null, 'Kategori dengan nama "' + nama + '" sudah ada.', 'DUPLICATE_CATEGORY');
      }

      const nowIso = getIsoTimestamp();
      if (nama) katSheet.getRange(target._rowIndex, 2).setValue(sanitizeSheetValue(nama));
      if (deskripsi !== null) katSheet.getRange(target._rowIndex, 3).setValue(sanitizeSheetValue(deskripsi));
      katSheet.getRange(target._rowIndex, 6).setValue(nowIso);

      recordActivity(ss, session.userId, session.username, session.role, 'UPDATE_KATEGORI', 'Memperbarui kategori: ' + (nama || target.nama_kategori));
      return jsonResponse(true, { id: id }, 'Kategori berhasil diperbarui.');
    }

    if (action === 'deleteKategori') {
      if (session.role !== 'superadmin' && session.role !== 'admin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin dan Admin yang dapat menghapus kategori.', 'FORBIDDEN');
      }

      const id = String(payload.id || '').trim();
      const katSheet = ss.getSheetByName('kategori_dokumen');
      const allKat = getSheetData(ss, 'kategori_dokumen');
      const target = allKat.find(function(k) { return String(k.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Kategori tidak ditemukan.', 'NOT_FOUND');

      const targetId = String(target.id || '').trim().toUpperCase();
      const namaLow = String(target.nama_kategori || '').toLowerCase();
      const isSystemCategory = targetId === 'KAT-01' || targetId === 'KAT-02' ||
        /\bpokir\b/i.test(namaLow) ||
        /\bpokok\s*-\s*pokok\s+pikiran\b/i.test(namaLow) ||
        /\bpokok\s+pikiran\b/i.test(namaLow) ||
        /\breses\b/i.test(namaLow);

      if (isSystemCategory) {
        return jsonResponse(false, null, 'Kategori bawaan sistem (Hasil Reses / Pokir) tidak dapat dihapus.', 'SYSTEM_CATEGORY_PROTECTED');
      }

      const allDocs = getSheetData(ss, 'dokumen');
      const hasDocs = allDocs.some(function(doc) {
        return isKategoriMatching(ss, id, doc.kategori_id) && String(doc.status || '').toLowerCase() === 'aktif';
      });

      if (hasDocs) {
        return jsonResponse(false, null, 'Kategori tidak dapat dihapus karena masih digunakan oleh dokumen arsip aktif.', 'HAS_DEPENDENT_RECORDS');
      }

      katSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_KATEGORI', 'Menghapus kategori: ' + target.nama_kategori);
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
        if (String(t.dewan_id).trim() === dewanId && isKategoriMatching(ss, katId, t.kategori_id)) {
          yearMap[t.tahun] = true;
        }
      });
      docData.forEach(function(d) {
        if (String(d.dewan_id).trim() === dewanId && isKategoriMatching(ss, katId, d.kategori_id) && d.tahun) {
          yearMap[d.tahun] = true;
        }
      });

      const list = Object.keys(yearMap).map(function(yrStr) {
        const yr = parseInt(yrStr, 10);
        const count = docData.filter(function(d) {
          return String(d.dewan_id).trim() === dewanId &&
                 isKategoriMatching(ss, katId, d.kategori_id) &&
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
      const nowIso = getIsoTimestamp();

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
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang berwenang menghapus tahun anggaran.', 'FORBIDDEN');
      }

      const dewanId = String(payload.dewan_id || '').trim();
      const katId = String(payload.kategori_id || '').trim();
      const tahun = parseInt(payload.tahun, 10);

      if (!dewanId || !katId || isNaN(tahun)) {
        return jsonResponse(false, null, 'Parameter dewan, kategori, dan tahun wajib ditentukan.', 'VALIDATION_ERROR');
      }

      const allDocs = getSheetData(ss, 'dokumen');
      const activeDocs = allDocs.filter(function(d) {
        return String(d.dewan_id || '').trim() === dewanId &&
               isKategoriMatching(ss, katId, d.kategori_id) &&
               parseInt(d.tahun, 10) === tahun &&
               String(d.status || '').toLowerCase() === 'aktif';
      });

      if (activeDocs.length > 0) {
        return jsonResponse(false, null, 'Tahun anggaran ' + tahun + ' tidak dapat dihapus karena masih berisi ' + activeDocs.length + ' berkas dokumen arsip aktif. Hapus berkas dokumen di dalamnya terlebih dahulu demi integritas arsip.', 'HAS_DEPENDENT_RECORDS');
      }

      const tahunSheet = ss.getSheetByName('tahun_dokumen');
      const allTahun = getSheetData(ss, 'tahun_dokumen');
      for (let i = allTahun.length - 1; i >= 0; i--) {
        const t = allTahun[i];
        if (String(t.dewan_id || '').trim() === dewanId && isKategoriMatching(ss, katId, t.kategori_id) && parseInt(t.tahun, 10) === tahun) {
          tahunSheet.deleteRow(t._rowIndex);
        }
      }

      const folderSheet = ss.getSheetByName('folder_dokumen');
      if (folderSheet) {
        const allFolder = getSheetData(ss, 'folder_dokumen');
        for (let i = allFolder.length - 1; i >= 0; i--) {
          const f = allFolder[i];
          if (String(f.dewan_id || '').trim() === dewanId && isKategoriMatching(ss, katId, f.kategori_id) && parseInt(f.tahun, 10) === tahun) {
            folderSheet.deleteRow(f._rowIndex);
          }
        }
      }

      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_TAHUN', 'Menghapus arsip tahun: ' + tahun);
      return jsonResponse(true, { dewan_id: dewanId, kategori_id: katId, tahun: tahun }, 'Tahun anggaran berhasil dihapus.');
    }

    if (action === 'getFolderList') {
      const dewanId = String(payload.dewan_id || '').trim();
      const katId = String(payload.kategori_id || '').trim();
      const yr = parseInt(payload.tahun, 10);

      const folderData = getSheetData(ss, 'folder_dokumen');
      const docData = getSheetData(ss, 'dokumen');

      const folders = folderData.filter(function(f) {
        return String(f.dewan_id).trim() === dewanId &&
               isKategoriMatching(ss, katId, f.kategori_id) &&
               parseInt(f.tahun, 10) === yr;
      });

      const result = folders.map(function(f) {
        const count = docData.filter(function(d) {
          return String(d.dewan_id).trim() === dewanId &&
                 isKategoriMatching(ss, katId, d.kategori_id) &&
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
      const nowIso = getIsoTimestamp();

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

      if (session.role === 'staff') {
        if (dewanId && !isStaffAuthorizedForDewan(ss, session, dewanId)) {
          return jsonResponse(false, null, 'Akses ditolak: Anda tidak memiliki wewenang untuk arsip dewan ini.', 'FORBIDDEN');
        }
        list = list.filter(function(d) {
          return isStaffAuthorizedForDokumen(ss, session, d);
        });
      }

      if (dewanId) list = list.filter(function(d) { return String(d.dewan_id).trim() === dewanId; });
      if (katId) list = list.filter(function(d) { return isKategoriMatching(ss, katId, d.kategori_id); });
      if (yr) list = list.filter(function(d) { return parseInt(d.tahun, 10) === yr; });
      if (folderName) list = list.filter(function(d) { return String(d.nama_folder || '').trim().toLowerCase() === folderName; });

      return jsonResponse(true, list, 'Daftar dokumen berhasil dimuat.');
    }

    if (action === 'getDokumenById') {
      const id = String(payload.id || '').trim();
      const allDocs = getSheetData(ss, 'dokumen');
      const item = allDocs.find(function(d) { return String(d.id || '').trim() === id; });

      if (!item) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');

      if (session.role === 'staff' && !isStaffAuthorizedForDokumen(ss, session, item)) {
        return jsonResponse(false, null, 'Akses ditolak: Dokumen bukan wewenang Anda.', 'FORBIDDEN');
      }

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

      if (session.role === 'staff' && !isStaffAuthorizedForDewan(ss, session, dewanId)) {
        return jsonResponse(false, null, 'Akses ditolak: Anda tidak ditugaskan pada anggota dewan ini.', 'FORBIDDEN');
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
        const nowIso = getIsoTimestamp();

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

        recordActivity(ss, session.userId, session.username, session.role, 'UPLOAD_DOKUMEN', 'Mengunggah: ' + namaDokumen + ' (' + fileName + ')');

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

      if (session.role === 'staff' && !isStaffAuthorizedForDokumen(ss, session, target)) {
        return jsonResponse(false, null, 'Akses ditolak: Anda tidak memiliki wewenang mengunduh dokumen ini.', 'FORBIDDEN');
      }

      try {
        const driveFile = DriveApp.getFileById(String(target.file_id).trim());
        const blob = driveFile.getBlob();
        const base64 = Utilities.base64Encode(blob.getBytes());

        recordActivity(ss, session.userId, session.username, session.role, 'DOWNLOAD_DOKUMEN', 'Mengunduh dokumen: ' + target.nama_dokumen);

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

      if (session.role === 'staff' && !isStaffAuthorizedForDokumen(ss, session, target)) {
        return jsonResponse(false, null, 'Akses ditolak: Anda tidak memiliki wewenang mengubah dokumen ini.', 'FORBIDDEN');
      }

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

      recordActivity(ss, session.userId, session.username, session.role, 'UPDATE_DOKUMEN', 'Memperbarui dokumen: ' + (data.nama_dokumen || target.nama_dokumen));
      return jsonResponse(true, { id: id }, 'Dokumen berhasil diperbarui.');
    }

    if (action === 'deleteDokumen') {
      const id = String(payload.id || '').trim();
      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      const target = allDocs.find(function(d) { return String(d.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');

      if (session.role === 'staff' && !isStaffAuthorizedForDokumen(ss, session, target)) {
        return jsonResponse(false, null, 'Akses ditolak: Anda tidak memiliki wewenang menghapus dokumen ini.', 'FORBIDDEN');
      }

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
      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_DOKUMEN', 'Menghapus dokumen: ' + target.nama_dokumen);
      return jsonResponse(true, { id: id }, 'Dokumen arsip berhasil dihapus.');
    }

    // ---------------- PENGELOLAAN KOMISI & RDP ----------------
    function getKomisiDataList(ss) {
      const defaultKomisi = [
        { id: 'KOM-1', kode: 'komisi_1', nama: 'Komisi 1', bidang: 'Bidang Pemerintahan, Hukum, dan Ketertiban', deskripsi: 'Membidangi urusan pemerintahan umum, hukum, perizinan, aparatur, dan ketertiban masyarakat.', kategori_folder: 'RDP', status: 'aktif' },
        { id: 'KOM-2', kode: 'komisi_2', nama: 'Komisi 2', bidang: 'Bidang Ekonomi, Keuangan, dan Pembangunan', deskripsi: 'Membidangi urusan keuangan daerah, perpajakan, perindustrian, perdagangan, dan pembangunan infrastruktur.', kategori_folder: 'RDP', status: 'aktif' },
        { id: 'KOM-3', kode: 'komisi_3', nama: 'Komisi 3', bidang: 'Bidang Kesejahteraan Rakyat dan Pendidikan', deskripsi: 'Membidangi urusan pendidikan, kesehatan, sosial, ketenagakerjaan, kepemudaan, dan kesejahteraan rakyat.', kategori_folder: 'RDP', status: 'aktif' }
      ];

      const sheet = ss.getSheetByName('komisi');
      if (!sheet) return defaultKomisi;

      const rows = getSheetData(ss, 'komisi');
      if (!rows || rows.length === 0) return defaultKomisi;

      const activeList = rows.filter(function(k) {
        return String(k.status || 'aktif').toLowerCase() === 'aktif';
      });

      return activeList.length > 0 ? activeList : defaultKomisi;
    }

    if (action === 'getKomisiList') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang berhak mengakses data komisi.', 'FORBIDDEN');
      }
      const komisiData = getKomisiDataList(ss);
      return jsonResponse(true, komisiData, 'Daftar komisi berhasil dimuat.');
    }

    if (action === 'createKomisi') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat menambah komisi.', 'FORBIDDEN');
      }

      const data = payload.data || payload;
      const nama = String(data.nama || data.nama_komisi || '').trim();
      const bidang = String(data.bidang || '').trim();
      const deskripsi = String(data.deskripsi || '').trim();
      const kategoriFolder = String(data.kategori_folder || 'RDP').trim().toUpperCase();

      if (!nama || !bidang) {
        return jsonResponse(false, null, 'Nama komisi dan bidang komisi wajib diisi.', 'VALIDATION_ERROR');
      }

      let komisiSheet = ss.getSheetByName('komisi');
      if (!komisiSheet) {
        komisiSheet = ss.insertSheet('komisi');
        komisiSheet.appendRow(['id', 'kode', 'nama', 'bidang', 'deskripsi', 'kategori_folder', 'status', 'created_at']);
        komisiSheet.setFrozenRows(1);
        const defaults = [
          ['KOM-1', 'komisi_1', 'Komisi 1', 'Bidang Pemerintahan, Hukum, dan Ketertiban', 'Membidangi urusan pemerintahan umum, hukum, perizinan, aparatur, dan ketertiban masyarakat.', 'RDP', 'aktif', '2024-01-01T00:00:00Z'],
          ['KOM-2', 'komisi_2', 'Komisi 2', 'Bidang Ekonomi, Keuangan, dan Pembangunan', 'Membidangi urusan keuangan daerah, perpajakan, perindustrian, perdagangan, dan pembangunan infrastruktur.', 'RDP', 'aktif', '2024-01-01T00:00:00Z'],
          ['KOM-3', 'komisi_3', 'Komisi 3', 'Bidang Kesejahteraan Rakyat dan Pendidikan', 'Membidangi urusan pendidikan, kesehatan, sosial, ketenagakerjaan, kepemudaan, dan kesejahteraan rakyat.', 'RDP', 'aktif', '2024-01-01T00:00:00Z']
        ];
        defaults.forEach(function(r) { komisiSheet.appendRow(r); });
      }

      const existingKomisi = getSheetData(ss, 'komisi');
      const isDuplicate = existingKomisi.some(function(k) {
        return String(k.nama || '').trim().toLowerCase() === nama.toLowerCase() &&
               String(k.status || 'aktif').toLowerCase() === 'aktif';
      });

      if (isDuplicate) {
        return jsonResponse(false, null, 'Komisi dengan nama "' + nama + '" sudah terdaftar.', 'DUPLICATE_ENTRY');
      }

      let newId = 'KOM-' + Date.now();
      const numMatch = nama.match(/komisi\s*(\d+)/i);
      if (numMatch && numMatch[1]) {
        const candidateId = 'KOM-' + numMatch[1];
        const idTaken = existingKomisi.some(function(k) { return String(k.id || '').trim() === candidateId; });
        if (!idTaken) newId = candidateId;
      }

      const kode = nama.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const nowIso = getIsoTimestamp();

      komisiSheet.appendRow([
        newId,
        kode,
        sanitizeSheetValue(nama),
        sanitizeSheetValue(bidang),
        sanitizeSheetValue(deskripsi),
        kategoriFolder,
        'aktif',
        nowIso
      ]);

      recordActivity(ss, session.userId, session.username, session.role, 'TAMBAH_KOMISI', 'Menambahkan komisi baru: ' + nama);

      const createdObj = {
        id: newId,
        kode: kode,
        nama: nama,
        bidang: bidang,
        deskripsi: deskripsi,
        kategori_folder: kategoriFolder,
        status: 'aktif'
      };

      return jsonResponse(true, createdObj, 'Komisi berhasil ditambahkan.');
    }

    if (action === 'deleteKomisi') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat menghapus komisi.', 'FORBIDDEN');
      }

      const id = String(payload.id || '').trim();
      if (!id) {
        return jsonResponse(false, null, 'ID Komisi wajib disertakan.', 'VALIDATION_ERROR');
      }

      const allDocs = getSheetData(ss, 'dokumen');
      const activeDocs = allDocs.filter(function(d) {
        return String(d.dewan_id || '').trim() === id && String(d.status || '').toLowerCase() === 'aktif';
      });

      if (activeDocs.length > 0) {
        return jsonResponse(false, null, 'Gagal menghapus: Komisi masih memiliki ' + activeDocs.length + ' dokumen arsip RDP aktif. Dokumen terlindungi dari penghapusan.', 'HAS_DEPENDENT_RECORDS');
      }

      let komisiSheet = ss.getSheetByName('komisi');
      if (!komisiSheet) {
        komisiSheet = ss.insertSheet('komisi');
        komisiSheet.appendRow(['id', 'kode', 'nama', 'bidang', 'deskripsi', 'kategori_folder', 'status', 'created_at']);
        komisiSheet.setFrozenRows(1);
        const defaults = [
          ['KOM-1', 'komisi_1', 'Komisi 1', 'Bidang Pemerintahan, Hukum, dan Ketertiban', 'Membidangi urusan pemerintahan umum, hukum, perizinan, aparatur, dan ketertiban masyarakat.', 'RDP', 'aktif', '2024-01-01T00:00:00Z'],
          ['KOM-2', 'komisi_2', 'Komisi 2', 'Bidang Ekonomi, Keuangan, dan Pembangunan', 'Membidangi urusan keuangan daerah, perpajakan, perindustrian, perdagangan, dan pembangunan infrastruktur.', 'RDP', 'aktif', '2024-01-01T00:00:00Z'],
          ['KOM-3', 'komisi_3', 'Komisi 3', 'Bidang Kesejahteraan Rakyat dan Pendidikan', 'Membidangi urusan pendidikan, kesehatan, sosial, ketenagakerjaan, kepemudaan, dan kesejahteraan rakyat.', 'RDP', 'aktif', '2024-01-01T00:00:00Z']
        ];
        defaults.forEach(function(r) { komisiSheet.appendRow(r); });
      }

      const allKomisi = getSheetData(ss, 'komisi');
      const target = allKomisi.find(function(k) { return String(k.id || '').trim() === id; });
      if (target) {
        komisiSheet.getRange(target._rowIndex, 7).setValue('dihapus');
        recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_KOMISI', 'Menghapus komisi: ' + (target.nama || id));
        return jsonResponse(true, { id: id }, 'Komisi berhasil dihapus.');
      }

      return jsonResponse(true, { id: id }, 'Komisi berhasil dihapus.');
    }

    if (action === 'getRdpDokumenList') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang berhak mengakses arsip RDP.', 'FORBIDDEN');
      }
      const komisiId = String(payload.komisi_id || '').trim();
      const allActiveKomisi = getKomisiDataList(ss);
      const validKomisiIds = allActiveKomisi.map(function(k) { return String(k.id || '').trim(); });
      if (!validKomisiIds.includes(komisiId) && !['KOM-1', 'KOM-2', 'KOM-3'].includes(komisiId)) {
        return jsonResponse(false, null, 'ID Komisi tidak valid.', 'VALIDATION_ERROR');
      }

      const allDocs = getSheetData(ss, 'dokumen').filter(function(d) {
        const matchKomisi = String(d.dewan_id || '').trim() === komisiId;
        const matchFolder = String(d.nama_folder || '').trim().toUpperCase() === 'RDP' || String(d.kategori_id || '').trim().toUpperCase() === 'RDP';
        const matchStatus = String(d.status || '').toLowerCase() === 'aktif';
        return matchKomisi && matchFolder && matchStatus;
      });

      let filteredDocs = allDocs;
      if (session.role === 'staff') {
        filteredDocs = allDocs.filter(function(d) {
          return String(d.uploaded_by || '').toLowerCase() === session.username.toLowerCase() ||
                 (d.assigned_to && String(d.assigned_to).toLowerCase() === session.username.toLowerCase());
        });
      }

      // Ambil daftar tahun unik dari data riil yang ada
      const availableYears = [];
      const yearSet = {};
      allDocs.forEach(function(d) {
        const y = parseInt(d.tahun, 10);
        if (y && !yearSet[y]) {
          yearSet[y] = true;
          availableYears.push(y);
        }
      });
      availableYears.sort(function(a, b) { return b - a; });

      const yrFilter = payload.tahun ? parseInt(payload.tahun, 10) : null;
      if (yrFilter) {
        filteredDocs = filteredDocs.filter(function(d) { return parseInt(d.tahun, 10) === yrFilter; });
      }

      const q = String(payload.cari || payload.q || '').trim().toLowerCase();
      if (q) {
        filteredDocs = filteredDocs.filter(function(d) {
          const judul = String(d.nama_dokumen || '').toLowerCase();
          const ket = String(d.keterangan || '').toLowerCase();
          const fn = String(d.nama_file || '').toLowerCase();
          return judul.indexOf(q) !== -1 || ket.indexOf(q) !== -1 || fn.indexOf(q) !== -1;
        });
      }

      return jsonResponse(true, {
        komisi_id: komisiId,
        available_years: availableYears,
        dokumen: filteredDocs
      }, 'Daftar arsip RDP berhasil dimuat.');
    }

    if (action === 'uploadRdpDokumen') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat mengunggah arsip RDP.', 'FORBIDDEN');
      }
      const data = payload.data || payload;
      const komisiId = String(data.komisi_id || '').trim();
      const allActiveKomisi = getKomisiDataList(ss);
      const validKomisiIds = allActiveKomisi.map(function(k) { return String(k.id || '').trim(); });
      if (!validKomisiIds.includes(komisiId) && !['KOM-1', 'KOM-2', 'KOM-3'].includes(komisiId)) {
        return jsonResponse(false, null, 'ID Komisi tidak valid.', 'VALIDATION_ERROR');
      }

      const tahun = parseInt(data.tahun, 10);
      const namaDokumen = String(data.nama_dokumen || data.judul || '').trim();
      const keterangan = String(data.keterangan || '').trim();
      const fileName = String(data.fileName || data.nama_file || 'rdp.pdf').trim();
      const base64Data = data.base64 || data.fileData;

      if (!tahun || !namaDokumen || !base64Data) {
        return jsonResponse(false, null, 'Tahun, judul dokumen, dan berkas fisik wajib diisi.', 'VALIDATION_ERROR');
      }

      // Idempotensi: deteksi duplikasi
      const allDocs = getSheetData(ss, 'dokumen');
      const existingDoc = allDocs.find(function(d) {
        return String(d.dewan_id || '').trim() === komisiId &&
               parseInt(d.tahun, 10) === tahun &&
               String(d.nama_folder || '').trim().toUpperCase() === 'RDP' &&
               String(d.nama_dokumen || '').trim().toLowerCase() === namaDokumen.toLowerCase() &&
               String(d.status || '').toLowerCase() === 'aktif';
      });
      if (existingDoc) {
        return jsonResponse(true, {
          id: existingDoc.id,
          nama_dokumen: existingDoc.nama_dokumen,
          file_id: existingDoc.file_id,
          view_url: existingDoc.view_url
        }, 'Dokumen RDP berhasil diunggah.');
      }

      const validatedFile = validateFileContentAndSignature(base64Data, fileName);
      const driveFolder = getDocFolder();
      let createdDriveFile = null;

      try {
        const blob = Utilities.newBlob(validatedFile.bytes, validatedFile.mimeType, fileName);
        createdDriveFile = driveFolder.createFile(blob);
        createdDriveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        const driveFileId = createdDriveFile.getId();
        const driveViewUrl = createdDriveFile.getUrl();
        const driveDownloadUrl = createdDriveFile.getDownloadUrl();

        const stableDocId = 'RDP-' + Date.now() + '-' + Utilities.getUuid().substring(0, 4);
        const nowIso = getIsoTimestamp();

        const docSheet = ss.getSheetByName('dokumen');
        docSheet.appendRow([
          stableDocId,
          komisiId,
          'RDP',
          tahun,
          'RDP',
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

        recordActivity(ss, session.userId, session.username, session.role, 'UPLOAD_RDP', 'Mengunggah arsip RDP ' + komisiId + ': ' + namaDokumen);

        return jsonResponse(true, {
          id: stableDocId,
          nama_dokumen: namaDokumen,
          file_id: driveFileId,
          view_url: driveViewUrl
        }, 'Dokumen RDP berhasil diunggah.');
      } catch (uploadErr) {
        if (createdDriveFile) {
          try { createdDriveFile.setTrashed(true); } catch (e) {}
        }
        return jsonResponse(false, null, 'Gagal mengunggah dokumen RDP: ' + uploadErr.message, 'UPLOAD_ROLLBACK');
      }
    }

    if (action === 'updateRdpDokumen') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang berhak mengubah dokumen RDP.', 'FORBIDDEN');
      }
      const data = payload.data || payload;
      const id = String(data.id || '').trim();
      const namaDokumen = String(data.nama_dokumen || data.judul || '').trim();
      const tahun = parseInt(data.tahun, 10);
      const keterangan = String(data.keterangan || '').trim();

      if (!id || !namaDokumen || !tahun) {
        return jsonResponse(false, null, 'ID dokumen, judul dokumen, dan tahun wajib diisi.', 'VALIDATION_ERROR');
      }

      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      const target = allDocs.find(function(d) { return String(d.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Dokumen RDP tidak ditemukan.', 'NOT_FOUND');

      // Update kolom tahun (kolom 4), nama_dokumen (kolom 6), keterangan (kolom 7)
      docSheet.getRange(target._rowIndex, 4).setValue(tahun);
      docSheet.getRange(target._rowIndex, 6).setValue(sanitizeSheetValue(namaDokumen));
      docSheet.getRange(target._rowIndex, 7).setValue(sanitizeSheetValue(keterangan));

      recordActivity(ss, session.userId, session.username, session.role, 'UPDATE_RDP', 'Memperbarui metadata dokumen RDP: ' + namaDokumen);
      return jsonResponse(true, {
        id: id,
        nama_dokumen: namaDokumen,
        tahun: tahun,
        keterangan: keterangan
      }, 'Metadata dokumen RDP berhasil diperbarui.');
    }

    if (action === 'deleteRdpDokumen') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang berhak menghapus dokumen RDP.', 'FORBIDDEN');
      }
      const id = String(payload.id || '').trim();
      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      const target = allDocs.find(function(d) { return String(d.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Dokumen RDP tidak ditemukan.', 'NOT_FOUND');

      if (target.file_id) {
        try {
          DriveApp.getFileById(String(target.file_id).trim()).setTrashed(true);
        } catch (e) {}
      }

      docSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_RDP', 'Menghapus arsip RDP: ' + target.nama_dokumen);
      return jsonResponse(true, { id: id }, 'Dokumen RDP berhasil dihapus.');
    }

    // ---------------- PENGELOLAAN LAPORAN MASYARAKAT (TERAUTENTIKASI) ----------------
    if (action === 'getLaporanList') {
      let lapSheet = ss.getSheetByName('laporan_masyarakat');
      if (!lapSheet) {
        return jsonResponse(true, [], 'Belum ada laporan masyarakat.');
      }
      let reports = getSheetData(ss, 'laporan_masyarakat');

      if (session.role === 'staff') {
        const staffUsername = session.username ? session.username.toLowerCase() : '';
        const staffNama = session.nama ? session.nama.toLowerCase() : '';
        const staffId = session.userId ? String(session.userId).toLowerCase() : '';
        reports = reports.filter(function(r) {
          const assigned = String(r.assigned_to || '').trim().toLowerCase();
          return (assigned && (assigned === staffUsername || assigned === staffNama || assigned === staffId || (staffNama && assigned.indexOf(staffNama) !== -1)));
        });
      }

      reports.reverse();
      return jsonResponse(true, reports, 'Daftar laporan masyarakat berhasil dimuat.');
    }

    if (action === 'assignLaporan') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat menugaskan laporan.', 'FORBIDDEN');
      }
      const id = String(payload.id || '').trim();
      const staffUser = String(payload.assigned_to || payload.staff_nama || payload.staff_id || '').trim();
      const lapSheet = ss.getSheetByName('laporan_masyarakat');
      if (!lapSheet) return jsonResponse(false, null, 'Sheet laporan tidak ditemukan.', 'NOT_FOUND');

      const allReports = getSheetData(ss, 'laporan_masyarakat');
      const target = allReports.find(function(r) { return String(r.id || '').trim() === id || String(r.nomor_tiket || '').trim() === id; });
      if (!target) return jsonResponse(false, null, 'Laporan tidak ditemukan.', 'NOT_FOUND');

      const nowIso = getIsoTimestamp();
      lapSheet.getRange(target._rowIndex, 14).setValue(sanitizeSheetValue(staffUser));
      lapSheet.getRange(target._rowIndex, 13).setValue('diproses');
      lapSheet.getRange(target._rowIndex, 17).setValue(nowIso);

      recordActivity(ss, session.userId, session.username, session.role, 'TUGASKAN_LAPORAN', 'Menugaskan laporan ' + target.nomor_tiket + ' kepada: ' + staffUser);
      return jsonResponse(true, { id: id, assigned_to: staffUser, status: 'diproses' }, 'Laporan berhasil ditugaskan ke staf pendamping.');
    }

    if (action === 'updateLaporanStatus') {
      const id = String(payload.id || '').trim();
      const newStatus = String(payload.status || 'diproses').toLowerCase();
      const tanggapan = String(payload.tanggapan || '').trim();
      const lapSheet = ss.getSheetByName('laporan_masyarakat');
      if (!lapSheet) return jsonResponse(false, null, 'Sheet laporan tidak ditemukan.', 'NOT_FOUND');

      const allReports = getSheetData(ss, 'laporan_masyarakat');
      const target = allReports.find(function(r) { return String(r.id || '').trim() === id || String(r.nomor_tiket || '').trim() === id; });
      if (!target) return jsonResponse(false, null, 'Laporan tidak ditemukan.', 'NOT_FOUND');

      if (session.role === 'staff') {
        const assigned = String(target.assigned_to || '').trim().toLowerCase();
        const isAssigned = assigned === session.username.toLowerCase() ||
                           (session.nama && assigned === session.nama.toLowerCase()) ||
                           assigned === String(session.userId).toLowerCase();
        if (!isAssigned) {
          return jsonResponse(false, null, 'Akses ditolak: Anda tidak memiliki wewenang untuk laporan ini.', 'FORBIDDEN');
        }
      }

      const nowIso = getIsoTimestamp();
      lapSheet.getRange(target._rowIndex, 13).setValue(newStatus);
      if (tanggapan) {
        lapSheet.getRange(target._rowIndex, 15).setValue(sanitizeSheetValue(tanggapan));
      }
      lapSheet.getRange(target._rowIndex, 17).setValue(nowIso);

      recordActivity(ss, session.userId, session.username, session.role, 'STATUS_LAPORAN', 'Memperbarui status laporan ' + target.nomor_tiket + ' menjadi: ' + newStatus);
      return jsonResponse(true, { id: id, status: newStatus, tanggapan: tanggapan }, 'Status laporan berhasil diperbarui.');
    }

    if (action === 'downloadLaporanLampiran') {
      const id = String(payload.id || payload.nomor_tiket || '').trim();
      const allReports = getSheetData(ss, 'laporan_masyarakat');
      const target = allReports.find(function(r) { return String(r.id || '').trim() === id || String(r.nomor_tiket || '').trim() === id; });
      if (!target) return jsonResponse(false, null, 'Laporan tidak ditemukan.', 'NOT_FOUND');

      if (session.role === 'staff') {
        const staffUsername = session.username ? session.username.toLowerCase() : '';
        const staffNama = session.nama ? session.nama.toLowerCase() : '';
        const staffId = session.userId ? String(session.userId).toLowerCase() : '';
        const assigned = String(target.assigned_to || '').trim().toLowerCase();
        const isAssigned = (assigned && (assigned === staffUsername || assigned === staffNama || assigned === staffId || (staffNama && assigned.indexOf(staffNama) !== -1)));
        if (!isAssigned) {
          return jsonResponse(false, null, 'Akses ditolak: Anda tidak memiliki wewenang untuk lampiran ini.', 'FORBIDDEN');
        }
      }

      if (!target.lampiran_file_id && !target.lampiran_url && !target.lampiran_nama) {
        return jsonResponse(false, null, 'Laporan ini tidak memiliki berkas lampiran.', 'NO_ATTACHMENT');
      }

      if (target.lampiran_file_id) {
        try {
          const file = DriveApp.getFileById(String(target.lampiran_file_id).trim());
          const blob = file.getBlob();
          const base64 = Utilities.base64Encode(blob.getBytes());
          return jsonResponse(true, {
            base64: base64,
            fileName: file.getName(),
            fileType: blob.getContentType(),
            url: target.lampiran_url || file.getUrl()
          }, 'Lampiran berhasil diunduh.');
        } catch (err) {
          return jsonResponse(false, null, 'Gagal mengambil berkas lampiran dari Drive: ' + err.message, 'DRIVE_ERROR');
        }
      }

      return jsonResponse(true, {
        base64: '',
        fileName: target.lampiran_nama || 'lampiran.pdf',
        fileType: 'application/pdf',
        url: target.lampiran_url || ''
      }, 'Informasi lampiran dimuat.');
    }

    if (action === 'deleteLaporan') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang berhak menghapus laporan.', 'FORBIDDEN');
      }
      const id = String(payload.id || payload.nomor_tiket || '').trim();
      const lapSheet = ss.getSheetByName('laporan_masyarakat');
      if (!lapSheet) return jsonResponse(false, null, 'Sheet laporan tidak ditemukan.', 'NOT_FOUND');
      const allReports = getSheetData(ss, 'laporan_masyarakat');
      const target = allReports.find(function(r) { return String(r.id || '').trim() === id || String(r.nomor_tiket || '').trim() === id; });
      if (!target) return jsonResponse(false, null, 'Laporan tidak ditemukan.', 'NOT_FOUND');

      lapSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_LAPORAN', 'Menghapus laporan nomor tiket ' + target.nomor_tiket + ' (' + target.judul + ')');
      return jsonResponse(true, { nomor_tiket: target.nomor_tiket }, 'Laporan ' + target.nomor_tiket + ' berhasil dihapus.');
    }

    if (action === 'approvePokirException') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang berwenang memberikan pengecualian Pokir.', 'FORBIDDEN');
      }
      const ticket = String(payload.nomor_tiket || payload.id || '').trim();
      const lapSheet = ss.getSheetByName('laporan_masyarakat');
      if (!lapSheet) return jsonResponse(false, null, 'Sheet laporan tidak ditemukan.', 'NOT_FOUND');

      const allReports = getSheetData(ss, 'laporan_masyarakat');
      const target = allReports.find(function(r) { return String(r.nomor_tiket || '').trim() === ticket || String(r.id || '').trim() === ticket; });
      if (!target) return jsonResponse(false, null, 'Usulan Pokir tidak ditemukan.', 'NOT_FOUND');

      recordActivity(ss, session.userId, session.username, session.role, 'PENGECUALIAN_POKIR', 'Memberikan pengecualian usulan Pokir nomor tiket ' + target.nomor_tiket + '. Catatan: ' + (payload.catatan || '-'));
      return jsonResponse(true, { nomor_tiket: target.nomor_tiket, status_duplikasi: 'pengecualian_disetujui' }, 'Pengecualian usulan Pokir berhasil disetujui.');
    }

    if (action === 'updateProfile') {
      const data = payload.data || payload;
      const newUsername = data.username !== undefined ? String(data.username).trim().toLowerCase() : '';
      const newNama = data.nama !== undefined ? String(data.nama).trim() : '';

      const usersSheet = ss.getSheetByName('users');
      const allUsers = getSheetData(ss, 'users');
      const target = allUsers.find(function(u) { return String(u.id || '').trim() === String(session.userId).trim(); });
      if (!target) return jsonResponse(false, null, 'Pengguna tidak ditemukan.', 'NOT_FOUND');

      if (newUsername) {
        if (newUsername.length < 3 || !/^[a-zA-Z0-9_.-]+$/.test(newUsername)) {
          return jsonResponse(false, null, 'Username harus berupa 3-30 karakter alfanumerik, titik, atau garis bawah/strip.', 'VALIDATION_ERROR');
        }
        const exists = allUsers.some(function(u) {
          return String(u.id || '').trim() !== String(session.userId).trim() && String(u.username || '').trim().toLowerCase() === newUsername;
        });
        if (exists) {
          return jsonResponse(false, null, 'Username sudah digunakan oleh akun lain.', 'DUPLICATE_USERNAME');
        }
        usersSheet.getRange(target._rowIndex, 2).setValue(newUsername);
      }

      if (newNama) {
        usersSheet.getRange(target._rowIndex, 5).setValue(sanitizeSheetValue(newNama));
      }

      recordActivity(ss, session.userId, newUsername || session.username, session.role, 'UPDATE_PROFILE', 'Memperbarui profil pengguna');
      return jsonResponse(true, {
        id: session.userId,
        username: newUsername || session.username,
        nama: newNama || session.nama,
        role: session.role
      }, 'Profil pengguna berhasil diperbarui.');
    }

    // ---------------- AKSI LOG AUDIT & PROFILE FALLBACK ----------------
    if (action === 'getActivityLog') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat mengakses log aktivitas.', 'FORBIDDEN');
      }
      const limit = parseInt(payload.limit, 10) || 100;
      const logs = getSheetData(ss, 'aktivitas_log');
      const sorted = logs.slice(-limit).reverse();
      return jsonResponse(true, sorted, 'Log aktivitas berhasil dimuat.');
    }

    if (action === 'clearActivityLog') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat membersihkan log.', 'FORBIDDEN');
      }
      const sheet = ss.getSheetByName('aktivitas_log');
      if (!sheet) {
        return jsonResponse(false, null, 'Sheet log aktivitas tidak ditemukan.', 'SHEET_NOT_FOUND');
      }
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      recordActivity(ss, session.userId, session.username, session.role, 'BERSIHKAN_LOG', 'Seluruh riwayat log aktivitas dibersihkan');
      return jsonResponse(true, { cleared: true }, 'Seluruh riwayat aktivitas berhasil dibersihkan.');
    }

    if (action === 'getUserList') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat mengelola data pengguna.', 'FORBIDDEN');
      }
      const users = getSheetData(ss, 'users');
      const allDewan = getSheetData(ss, 'dewan');

      const safeList = users.map(function(u) {
        const uName = String(u.nama || '').trim().toLowerCase();
        const uUser = String(u.username || '').trim().toLowerCase();

        const assigned = allDewan.filter(function(d) {
          const pend = String(d.nama_pendamping || '').trim().toLowerCase();
          return pend && (pend === uUser || pend === uName || (uName && pend.indexOf(uName) !== -1));
        }).map(function(d) {
          return { id: d.id, nama: d.nama, jabatan: d.jabatan, partai: d.partai };
        });

        return {
          id: u.id,
          username: u.username,
          nama: u.nama,
          role: u.role || 'staff',
          status: u.status,
          assigned_dewan: assigned,
          must_change_password: false,
          created_at: u.created_at,
          last_login: u.last_login
        };
      });
      return jsonResponse(true, safeList, 'Data akun berhasil dimuat.');
    }

    if (action === 'createUser') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat membuat akun pengguna baru.', 'FORBIDDEN');
      }

      const data = payload.data || payload;
      const username = String(data.username || '').trim().toLowerCase();
      const nama = String(data.nama || '').trim();
      const password = String(data.password || '').trim();
      const role = String(data.role || 'staff').toLowerCase();
      const assignedDewan = data.assigned_dewan || []; // array of dewan IDs

      if (!username || !nama || !password) {
        return jsonResponse(false, null, 'Username, nama lengkap, dan kata sandi awal wajib diisi.', 'VALIDATION_ERROR');
      }

      if (username.length < 3 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
        return jsonResponse(false, null, 'Username hanya boleh mengandung huruf, angka, titik, atau garis bawah (minimal 3 karakter).', 'VALIDATION_ERROR');
      }

      if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return jsonResponse(false, null, 'Kata sandi minimal 8 karakter kombinasi huruf dan angka.', 'VALIDATION_ERROR');
      }

      const usersSheet = ss.getSheetByName('users');
      const allUsers = getSheetData(ss, 'users');
      const exists = allUsers.some(function(u) { return String(u.username || '').trim().toLowerCase() === username; });
      if (exists) {
        return jsonResponse(false, null, 'Username sudah digunakan oleh akun lain.', 'DUPLICATE_USERNAME');
      }

      const salt = generateCryptographicSalt();
      const hash = hashPasswordPBKDF2(password, salt, PBKDF2_STANDARD_ITERATIONS);
      const newUserId = 'USR-' + Date.now();
      const nowIso = getIsoTimestamp();

      usersSheet.appendRow([
        newUserId,
        username,
        hash,
        salt,
        sanitizeSheetValue(nama),
        role,
        'aktif',
        'true',
        nowIso,
        ''
      ]);

      // Jika ada penugasan dewan yang dipilih
      if (Array.isArray(assignedDewan) && assignedDewan.length > 0) {
        const dewanSheet = ss.getSheetByName('dewan');
        const allDewan = getSheetData(ss, 'dewan');
        allDewan.forEach(function(d) {
          if (assignedDewan.includes(d.id)) {
            dewanSheet.getRange(d._rowIndex, 6).setValue(sanitizeSheetValue(nama));
          }
        });
      }

      recordActivity(ss, session.userId, session.username, session.role, 'TAMBAH_USER', 'Membuat akun staf baru: ' + username + ' (' + nama + ')');
      return jsonResponse(true, {
        id: newUserId,
        username: username,
        nama: nama,
        role: role,
        status: 'aktif'
      }, 'Akun pengguna berhasil didaftarkan.');
    }

    if (action === 'updateUser') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat memperbarui akun pengguna.', 'FORBIDDEN');
      }

      const data = payload.data || payload;
      const id = String(data.id || payload.id || '').trim();
      const nama = String(data.nama || '').trim();
      const status = String(data.status || 'aktif').toLowerCase() === 'nonaktif' ? 'nonaktif' : 'aktif';
      const assignedDewan = data.assigned_dewan; // array of dewan IDs if provided

      const usersSheet = ss.getSheetByName('users');
      const allUsers = getSheetData(ss, 'users');
      const target = allUsers.find(function(u) { return String(u.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Pengguna tidak ditemukan.', 'NOT_FOUND');

      // Proteksi superadmin terakhir jika status diubah ke nonaktif
      if (target.role === 'superadmin' && status === 'nonaktif') {
        const activeSuperadmins = allUsers.filter(function(u) {
          return u.role === 'superadmin' && String(u.status || '').toLowerCase() === 'aktif';
        });
        if (activeSuperadmins.length <= 1) {
          return jsonResponse(false, null, 'Gagal: Tidak dapat menonaktifkan satu-satunya Superadmin aktif pada sistem.', 'PROTECTED_USER');
        }
      }

      if (nama) {
        usersSheet.getRange(target._rowIndex, 5).setValue(sanitizeSheetValue(nama));
      }
      usersSheet.getRange(target._rowIndex, 7).setValue(status);

      // Jika akun dinonaktifkan, cabut seluruh sesi aktifnya
      if (status === 'nonaktif') {
        revokeUserSessions(target.id);
      }

      // Update penugasan dewan jika parameter assigned_dewan dikirimkan
      if (Array.isArray(assignedDewan)) {
        const dewanSheet = ss.getSheetByName('dewan');
        const allDewan = getSheetData(ss, 'dewan');
        const oldStaffName = String(target.nama || '').toLowerCase();
        const newStaffName = nama || target.nama;

        allDewan.forEach(function(d) {
          const currentPendamping = String(d.nama_pendamping || '').toLowerCase();
          const isAssigned = assignedDewan.includes(d.id);

          if (isAssigned) {
            dewanSheet.getRange(d._rowIndex, 6).setValue(sanitizeSheetValue(newStaffName));
          } else if (currentPendamping && (currentPendamping === oldStaffName || currentPendamping === String(target.username).toLowerCase())) {
            dewanSheet.getRange(d._rowIndex, 6).setValue('');
          }
        });
      }

      recordActivity(ss, session.userId, session.username, session.role, 'UPDATE_USER', 'Memperbarui profil akun: ' + target.username);
      return jsonResponse(true, { id: id, nama: nama || target.nama, status: status }, 'Data akun pengguna berhasil diperbarui.');
    }

    if (action === 'toggleUserStatus') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat mengubah status akun.', 'FORBIDDEN');
      }

      const id = String(payload.id || '').trim();
      const newStatus = String(payload.status || 'aktif').toLowerCase() === 'aktif' ? 'aktif' : 'nonaktif';
      const usersSheet = ss.getSheetByName('users');
      const allUsers = getSheetData(ss, 'users');
      const target = allUsers.find(function(u) { return String(u.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Pengguna tidak ditemukan.', 'NOT_FOUND');

      if (target.role === 'superadmin' && newStatus === 'nonaktif') {
        const activeSuperadmins = allUsers.filter(function(u) {
          return u.role === 'superadmin' && String(u.status || '').toLowerCase() === 'aktif';
        });
        if (activeSuperadmins.length <= 1) {
          return jsonResponse(false, null, 'Gagal: Tidak dapat menonaktifkan satu-satunya Superadmin aktif pada sistem.', 'PROTECTED_USER');
        }
      }

      usersSheet.getRange(target._rowIndex, 7).setValue(newStatus);
      if (newStatus === 'aktif') {
        resetFailedLogin(target.username);
      } else {
        revokeUserSessions(target.id);
      }

      recordActivity(ss, session.userId, session.username, session.role, 'TOGGLE_USER_STATUS', 'Mengubah status akun ' + target.username + ' menjadi ' + newStatus);
      return jsonResponse(true, { id: id, status: newStatus }, 'Status pengguna berhasil diperbarui.');
    }

    if (action === 'resetUserPassword') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat mereset kata sandi pengguna.', 'FORBIDDEN');
      }

      const id = String(payload.id || '').trim();
      const newPass = String(payload.newPassword || '').trim();

      if (!id || !newPass) {
        return jsonResponse(false, null, 'ID pengguna dan kata sandi baru wajib diisi.', 'VALIDATION_ERROR');
      }

      if (newPass.length < 8 || !/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) {
        return jsonResponse(false, null, 'Kata sandi baru minimal 8 karakter kombinasi huruf dan angka.', 'VALIDATION_ERROR');
      }

      const usersSheet = ss.getSheetByName('users');
      const allUsers = getSheetData(ss, 'users');
      const target = allUsers.find(function(u) { return String(u.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Pengguna tidak ditemukan.', 'NOT_FOUND');

      const salt = generateCryptographicSalt();
      const hash = hashPasswordPBKDF2(newPass, salt, PBKDF2_STANDARD_ITERATIONS);

      usersSheet.getRange(target._rowIndex, 3).setValue(hash);
      usersSheet.getRange(target._rowIndex, 4).setValue(salt);
      usersSheet.getRange(target._rowIndex, 8).setValue('true');

      revokeUserSessions(target.id);
      resetFailedLogin(target.username);
      recordActivity(ss, session.userId, session.username, session.role, 'RESET_PASSWORD_USER', 'Mereset kata sandi akun: ' + target.username);
      return jsonResponse(true, { id: id }, 'Kata sandi pengguna berhasil direset dan kunci akun dipulihkan.');
    }

    if (action === 'unlockUser') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat membuka kunci akun pengguna.', 'FORBIDDEN');
      }

      const targetUsername = String(payload.username || '').trim().toLowerCase();
      if (!targetUsername) {
        return jsonResponse(false, null, 'Username target wajib disertakan.', 'VALIDATION_ERROR');
      }

      resetFailedLogin(targetUsername);
      recordActivity(ss, session.userId, session.username, session.role, 'UNLOCK_USER', 'Membuka kunci akun pengguna: ' + targetUsername);
      return jsonResponse(true, { username: targetUsername }, 'Kunci akun ' + targetUsername + ' berhasil dibuka.');
    }

    if (action === 'deleteUser') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Akses ditolak: Hanya Superadmin yang dapat menghapus akun pengguna.', 'FORBIDDEN');
      }

      const id = String(payload.id || '').trim();
      const usersSheet = ss.getSheetByName('users');
      const allUsers = getSheetData(ss, 'users');
      const target = allUsers.find(function(u) { return String(u.id || '').trim() === id; });

      if (!target) return jsonResponse(false, null, 'Pengguna tidak ditemukan.', 'NOT_FOUND');

      // Proteksi superadmin
      if (target.role === 'superadmin') {
        const activeSuperadmins = allUsers.filter(function(u) {
          return u.role === 'superadmin' && String(u.status || '').toLowerCase() === 'aktif';
        });
        if (activeSuperadmins.length <= 1) {
          return jsonResponse(false, null, 'Gagal: Tidak dapat menghapus satu-satunya Superadmin aktif pada sistem.', 'PROTECTED_USER');
        }
      }

      // Proteksi integritas data arsip yang pernah diunggah
      const allDocs = getSheetData(ss, 'dokumen');
      const hasDocs = allDocs.some(function(d) {
        return String(d.uploaded_by || '').toLowerCase() === String(target.username || '').toLowerCase();
      });
      if (hasDocs) {
        return jsonResponse(false, null, 'Pengguna tidak dapat dihapus karena memiliki riwayat arsip dokumen. Anda disarankan menonaktifkan akun pengguna demi audit keaslian berkas.', 'HAS_DEPENDENT_RECORDS');
      }

      revokeUserSessions(target.id);

      // Bersihkan nama pendamping di dewan jika ditugaskan
      const dewanSheet = ss.getSheetByName('dewan');
      getOrEnsureKecamatanColumnIndex(dewanSheet);
      const allDewan = getSheetData(ss, 'dewan');
      const staffName = String(target.nama || '').toLowerCase();
      const staffUser = String(target.username || '').toLowerCase();
      allDewan.forEach(function(d) {
        const pend = String(d.nama_pendamping || '').toLowerCase();
        if (pend && (pend === staffName || pend === staffUser)) {
          dewanSheet.getRange(d._rowIndex, 6).setValue('');
        }
      });

      usersSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_USER', 'Menghapus akun staf: ' + target.username);
      return jsonResponse(true, { id: id }, 'Akun pengguna berhasil dihapus.');
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
