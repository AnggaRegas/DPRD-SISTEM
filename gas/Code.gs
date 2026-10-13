/**
 * @license
 * Sistem Informasi Pengarsipan Dokumen DPRD Kota Parepare
 * Bagian Fasilitasi Penganggaran dan Pengawasan
 * Backend Google Apps Script (GAS) Web App untuk Google Sheets & Google Drive
 *
 * LEMBAR KERJA GOOGLE SHEETS:
 * 1. users            (id, username, password_hash, salt, nama, role, status, must_change_password, created_at, last_login)
 * 2. dewan            (id, nomor_urut, nama, jabatan, periode, nama_pendamping, nama_partai, status, created_at, updated_at)
 * 3. kategori_dokumen (id, nama_kategori, deskripsi, status, created_at, updated_at)
 * 4. tahun_dokumen    (id, dewan_id, kategori_id, tahun, status, created_at)
 * 5. folder_dokumen   (id, dewan_id, kategori_id, tahun, nama_folder, deskripsi, status, created_at)
 * 6. dokumen          (id, dewan_id, kategori_id, tahun, nama_folder, nama_dokumen, keterangan, nama_file, file_id, direct_url, view_url, mime_type, ukuran_file, status, uploaded_by, tanggal_upload)
 * 7. aktivitas_log    (id, waktu, user_id, username, role, aksi, detail, ip_address)
 *
 * SCRIPT PROPERTIES:
 * - DATABASE_ID        : ID Spreadsheet Database
 * - ROOT_FOLDER_ID     : ID Folder Utama di Google Drive
 * - DOKUMEN_FOLDER_ID  : ID Subfolder Dokumen Fisik di Drive
 * - PASSWORD_SALT      : Kunci Salt Kriptografis SHA-256
 */

const APP_NAME = 'Sistem Pengarsipan Dokumen DPRD Kota Parepare';
const TIMEZONE = 'Asia/Makassar';
const INITIAL_SUPERADMIN_USER = 'superadmin';

// 25 ANGGOTA DPRD KOTA PAREPARE RESMI PERIODE 2024 - 2029
const SEED_DEWAN_PAREPARE = [
  { nomor_urut: 1, nama: 'Ir. H. KAHARUDDIN KADIR, M.Si.', jabatan: 'Ketua DPRD Kota parepare', periode: '2024 - 2029', nama_pendamping: 'SUKARNO, S. Kom.', nama_partai: 'Partai Golongan Karya' },
  { nomor_urut: 2, nama: 'SUYUTI, S.E.', jabatan: 'Wakil Ketua I', periode: '2024 - 2029', nama_pendamping: 'M. KHAERUL KADAR,S.H', nama_partai: 'Partai Nasional Demokrat' },
  { nomor_urut: 3, nama: 'MUHAMMAD YUSUF LAPANNA, SH.I.', jabatan: 'Wakil Ketua II', periode: '2024 - 2029', nama_pendamping: 'AJI WICAKSONO, S.H', nama_partai: 'Partai Gerakan Indonesia Raya' },
  { nomor_urut: 4, nama: 'ACHMAD ARIADY, S.E.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'SINTA DEWI ANGGRAENI, S.E.', nama_partai: 'Partai Nasional Demokrat' },
  { nomor_urut: 5, nama: 'ANDI MUH. FUDAIL, S.E.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'ANDI ANWAR, A.md.', nama_partai: 'Partai Kebangkitan Bangsa' },
  { nomor_urut: 6, nama: "ASY'ARI ABDULLAH, S.T.", jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'SYARIEF LATIEF, S.Pt.', nama_partai: 'Partai Gelombang Rakyat Indonesia' },
  { nomor_urut: 7, nama: 'Dr. KAMALUDDIN KADIR, S.Sos., M.M', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'SARTIKA', nama_partai: 'Partai Gerakan Indonesia Raya' },
  { nomor_urut: 8, nama: 'Dra. Hj. ASMAWATI', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'ARIYANI, S.H.', nama_partai: 'Partai Nasional Demokrat' },
  { nomor_urut: 9, nama: 'H. AHMAD ZULFIKAR ZUHDY, S.T.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'SUDARMIN, S.Pt.', nama_partai: 'Partai Demokrat' },
  { nomor_urut: 10, nama: 'H. HASIB HASYIM, S.T., S.E.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'ARIS, S.E.', nama_partai: 'Partai Kebangkitan Bangsa' },
  { nomor_urut: 11, nama: 'H. KADARUSMAN MANGURUSI, S.T', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'MARIANI', nama_partai: 'Partai Golongan Karya' },
  { nomor_urut: 12, nama: 'HAMRAN HAMDANI, S.E', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'AMIR, S.T', nama_partai: 'Partai Golongan Karya' },
  { nomor_urut: 13, nama: 'Hj INDRIASARI HUSNI, S.Kom.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'RESTY NOVIANTI, S.H', nama_partai: 'Partai Golongan Karya' },
  { nomor_urut: 14, nama: 'Hj. APRIYANI DJAMALUDDIN', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'MUH. RAYNALDI KURNIAWAN, S,Tr.IP', nama_partai: 'Partai Demokrasi Indonesia Perjuangan' },
  { nomor_urut: 15, nama: 'Hj. FARIDAH, HS, S.E.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: "YOPIE MA'DIKA, S.H.", nama_partai: 'Partai Demokrat' },
  { nomor_urut: 16, nama: 'Hj. SRI TANTY MARIANI NASRAH', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'AGUS SALIM', nama_partai: 'Partai Hati Nurani Rakyat' },
  { nomor_urut: 17, nama: 'HUSAIN MUHAMMAD SAUD, S.E.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'FAISAL IKHWANSYAH, S.H.', nama_partai: 'Partai Gerakan Indonesia Raya' },
  { nomor_urut: 18, nama: 'Ir. IBRAHIM SUANDA', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'Hj. NURAENI HUSAIN', nama_partai: 'Partai Amanat Nasional' },
  { nomor_urut: 19, nama: 'JUSVARI GENDA', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'NURAINIA NAIM', nama_partai: 'Partai Keadilan Sejahtera' },
  { nomor_urut: 20, nama: 'MUH. ILHAMSYAH TAUFAN, S.H.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'M. ALI YUNUS', nama_partai: 'Partai Golongan Karya' },
  { nomor_urut: 21, nama: 'MUSDALIFAH PAWE, S.H.', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'FITRI HANDAYANI, SE.', nama_partai: 'Partai Amanat Nasional' },
  { nomor_urut: 22, nama: 'NAMRI NASIR', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'MUHAMMAD RAIHAN IRSAN', nama_partai: 'Partai Persatuan Pembangunan' },
  { nomor_urut: 23, nama: 'RUDY NAJAMUDDIN', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'HASRIANTI, S.Kom.', nama_partai: 'Partai Persatuan Pembangunan' },
  { nomor_urut: 24, nama: 'S. PARMAN AGOES MANTE', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'ALFIAN SYUKUR', nama_partai: 'Partai Gelombang Rakyat Indonesia' },
  { nomor_urut: 25, nama: 'SAPPE', jabatan: 'Anggota', periode: '2024 - 2029', nama_pendamping: 'ARI WIBOWO S.H.', nama_partai: 'Partai Keadilan Sejahtera' }
];

const SEED_KATEGORI_DEFAULT = [
  { nama_kategori: 'Pokok-Pokok Pikiran (Pokir)', deskripsi: 'Arsip usulan aspirasi masyarakat melalui anggota DPRD' },
  { nama_kategori: 'Laporan Hasil Reses', deskripsi: 'Laporan kegiatan penjaringan aspirasi konstituen' },
  { nama_kategori: 'Fasilitasi Penganggaran (RKA/DPA)', deskripsi: 'Dokumen pembahasan RKA dan DPA perangkat daerah' },
  { nama_kategori: 'Fasilitasi Pengawasan', deskripsi: 'Laporan pengawasan pelaksanaan perda dan anggaran' },
  { nama_kategori: 'Dokumen Perjalanan Dinas', deskripsi: 'Surat tugas dan laporan hasil perjalanan dinas anggota dewan' },
  { nama_kategori: 'Risalah Rapat Paripurna', deskripsi: 'Notulen dan risalah pembahasan sidang paripurna DPRD' }
];

// ============================================================================
// 1. SETUP OTOMATIS & HEALTH CHECK
// ============================================================================

/**
 * Menyiapkan Database Google Sheets & Folder Google Drive dari nol secara otomatis.
 * SIFAT: IDEMPOTEN (Aman dijalankan berulang kali tanpa merusak atau menduplikasi data).
 */
function setupDatabaseDPRD() {
  const props = PropertiesService.getScriptProperties();

  // Inisialisasi Salt Kriptografis
  let salt = props.getProperty('PASSWORD_SALT');
  if (!salt) {
    const seed = Utilities.getUuid() + '-' + Date.now() + '-' + Math.random().toString(36);
    salt = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed, Utilities.Charset.UTF_8)
    ).substring(0, 32);
    props.setProperty('PASSWORD_SALT', salt);
  }

  // 1. SPREADSHEET
  let ss = null;
  const existingDbId = props.getProperty('DATABASE_ID') || props.getProperty('SPREADSHEET_ID');
  if (existingDbId && existingDbId.trim()) {
    try { ss = SpreadsheetApp.openById(existingDbId.trim()); } catch (e) {}
  }
  if (!ss) {
    try {
      const active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) ss = active;
    } catch (e) {}
  }
  if (!ss) {
    ss = SpreadsheetApp.create('DATABASE ARSIP DPRD KOTA PAREPARE');
  }
  props.setProperty('DATABASE_ID', ss.getId());

  const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

  // 2. SHEETS & HEADERS
  // Sheet users
  let usersSheet = ss.getSheetByName('users');
  if (!usersSheet) {
    usersSheet = ss.insertSheet('users');
    usersSheet.appendRow(['id', 'username', 'password_hash', 'salt', 'nama', 'role', 'status', 'must_change_password', 'created_at', 'last_login']);
    usersSheet.setFrozenRows(1);
  }
  // Bootstrap Superadmin jika belum ada
  const existingUsers = getSheetData(ss, 'users');
  const superadminExists = existingUsers.some(function(u) { return String(u.username || '').toLowerCase() === INITIAL_SUPERADMIN_USER; });
  if (!superadminExists) {
    const initialPass = 'SandiRahasia123!';
    const initialHash = hashPasswordWithSalt(initialPass, salt);
    usersSheet.appendRow([
      'USR-SUPERADMIN-1',
      INITIAL_SUPERADMIN_USER,
      initialHash,
      salt,
      'Super Administrator DPRD',
      'superadmin',
      'aktif',
      'true', // Wajib ganti password pada login pertama
      nowIso,
      ''
    ]);
  }

  // Sheet dewan
  let dewanSheet = ss.getSheetByName('dewan');
  if (!dewanSheet) {
    dewanSheet = ss.insertSheet('dewan');
    dewanSheet.appendRow(['id', 'nomor_urut', 'nama', 'jabatan', 'periode', 'nama_pendamping', 'nama_partai', 'status', 'created_at', 'updated_at']);
    dewanSheet.setFrozenRows(1);
  }
  // Seed 25 Anggota DPRD Parepare (Idempotent: cek berdasarkan nomor_urut / nama)
  const existingDewan = getSheetData(ss, 'dewan');
  SEED_DEWAN_PAREPARE.forEach(function(item) {
    const exists = existingDewan.some(function(d) {
      return parseInt(d.nomor_urut, 10) === item.nomor_urut || String(d.nama || '').trim().toLowerCase() === item.nama.trim().toLowerCase();
    });
    if (!exists) {
      dewanSheet.appendRow([
        item.nomor_urut,
        item.nomor_urut,
        item.nama,
        item.jabatan,
        item.periode,
        item.nama_pendamping,
        item.nama_partai,
        'aktif',
        nowIso,
        nowIso
      ]);
    }
  });

  // Sheet kategori_dokumen
  let katSheet = ss.getSheetByName('kategori_dokumen');
  if (!katSheet) {
    katSheet = ss.insertSheet('kategori_dokumen');
    katSheet.appendRow(['id', 'nama_kategori', 'deskripsi', 'status', 'created_at', 'updated_at']);
    katSheet.setFrozenRows(1);
  }
  const existingKat = getSheetData(ss, 'kategori_dokumen');
  SEED_KATEGORI_DEFAULT.forEach(function(item, idx) {
    const exists = existingKat.some(function(k) {
      return String(k.nama_kategori || '').trim().toLowerCase() === item.nama_kategori.trim().toLowerCase();
    });
    if (!exists) {
      const newId = (existingKat.length ? Math.max.apply(null, existingKat.map(function(x) { return parseInt(x.id, 10) || 0; })) : 0) + idx + 1;
      katSheet.appendRow([newId, item.nama_kategori, item.deskripsi, 'aktif', nowIso, nowIso]);
    }
  });

  // Sheet tahun_dokumen
  let tahunSheet = ss.getSheetByName('tahun_dokumen');
  if (!tahunSheet) {
    tahunSheet = ss.insertSheet('tahun_dokumen');
    tahunSheet.appendRow(['id', 'dewan_id', 'kategori_id', 'tahun', 'status', 'created_at']);
    tahunSheet.setFrozenRows(1);
  }

  // Sheet folder_dokumen
  let folderSheet = ss.getSheetByName('folder_dokumen');
  if (!folderSheet) {
    folderSheet = ss.insertSheet('folder_dokumen');
    folderSheet.appendRow(['id', 'dewan_id', 'kategori_id', 'tahun', 'nama_folder', 'deskripsi', 'status', 'created_at']);
    folderSheet.setFrozenRows(1);
  }

  // Sheet dokumen
  let docSheet = ss.getSheetByName('dokumen');
  if (!docSheet) {
    docSheet = ss.insertSheet('dokumen');
    docSheet.appendRow([
      'id', 'dewan_id', 'kategori_id', 'tahun', 'nama_folder',
      'nama_dokumen', 'keterangan', 'nama_file', 'file_id',
      'direct_url', 'view_url', 'mime_type', 'ukuran_file',
      'status', 'uploaded_by', 'tanggal_upload'
    ]);
    docSheet.setFrozenRows(1);
  }

  // Sheet aktivitas_log
  let logSheet = ss.getSheetByName('aktivitas_log');
  if (!logSheet) {
    logSheet = ss.insertSheet('aktivitas_log');
    logSheet.appendRow(['id', 'waktu', 'user_id', 'username', 'role', 'aksi', 'detail', 'ip_address']);
    logSheet.setFrozenRows(1);
  }

  // Hapus Sheet default jika ada
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // 3. FOLDER GOOGLE DRIVE
  let rootFolder = null;
  const existingRootId = props.getProperty('ROOT_FOLDER_ID');
  if (existingRootId && existingRootId.trim()) {
    try { rootFolder = DriveApp.getFolderById(existingRootId.trim()); } catch (e) {}
  }
  if (!rootFolder) {
    rootFolder = DriveApp.createFolder('Arsip Dokumen DPRD - Kota Parepare');
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
    props.setProperty('DOKUMEN_FOLDER_ID', docFolder.getId());
  }

  const summary = {
    status: 'SETUP_SUCCESS',
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    rootFolderId: rootFolder.getId(),
    rootFolderUrl: rootFolder.getUrl(),
    docFolderId: docFolder.getId(),
    superadminCreated: !superadminExists,
    totalDewanSeeded: SEED_DEWAN_PAREPARE.length
  };

  Logger.log('HASIL SETUP DATABASE DPRD: ' + JSON.stringify(summary, null, 2));
  return summary;
}

/**
 * Pemeriksaan kesehatan database dan struktur sistem
 */
function checkDatabaseDPRD() {
  const ss = getDatabase();
  const sheets = ['users', 'dewan', 'kategori_dokumen', 'tahun_dokumen', 'folder_dokumen', 'dokumen', 'aktivitas_log'];
  const report = {
    spreadsheetId: ss.getId(),
    sheetsStatus: {},
    allSheetsPresent: true
  };

  sheets.forEach(function(sh) {
    const sheetObj = ss.getSheetByName(sh);
    if (!sheetObj) {
      report.sheetsStatus[sh] = { present: false, rows: 0 };
      report.allSheetsPresent = false;
    } else {
      report.sheetsStatus[sh] = {
        present: true,
        rows: Math.max(0, sheetObj.getLastRow() - 1)
      };
    }
  });

  const props = PropertiesService.getScriptProperties();
  report.rootFolderId = props.getProperty('ROOT_FOLDER_ID') || 'BELUM_DIATUR';
  report.docFolderId = props.getProperty('DOKUMEN_FOLDER_ID') || 'BELUM_DIATUR';
  report.hasSalt = Boolean(props.getProperty('PASSWORD_SALT'));

  Logger.log('HEALTH CHECK DATABASE DPRD: ' + JSON.stringify(report, null, 2));
  return report;
}

/**
 * Prosedur Manual Pemulihan Password Superadmin (Hanya dapat dipanggil dari editor Apps Script oleh pemilik akun Google)
 */
function resetSuperadminPasswordManual(newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password baru minimal 8 karakter.');
  }
  const ss = getDatabase();
  const props = PropertiesService.getScriptProperties();
  const salt = props.getProperty('PASSWORD_SALT') || 'SALT_FALLBACK_2026';
  const newHash = hashPasswordWithSalt(newPassword, salt);
  const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

  const sheet = ss.getSheetByName('users');
  if (!sheet) throw new Error('Sheet users tidak ditemukan.');

  const data = sheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim().toLowerCase() === INITIAL_SUPERADMIN_USER) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow !== -1) {
    sheet.getRange(foundRow, 3).setValue(newHash);
    sheet.getRange(foundRow, 4).setValue(salt);
    sheet.getRange(foundRow, 8).setValue('false'); // must_change_password di-reset
    Logger.log('Password superadmin berhasil direset.');
  } else {
    sheet.appendRow([
      'USR-SUPERADMIN-MANUAL',
      INITIAL_SUPERADMIN_USER,
      newHash,
      salt,
      'Super Administrator DPRD',
      'superadmin',
      'aktif',
      'false',
      nowIso,
      ''
    ]);
    Logger.log('Akun superadmin baru berhasil dibuat.');
  }

  recordActivity(ss, 'SYSTEM', 'superadmin', 'superadmin', 'PASSWORD_RESET_MANUAL', 'Password superadmin direset via console Apps Script');
  return { success: true, message: 'Password superadmin berhasil diperbarui.' };
}

// ============================================================================
// 2. RESOLVER & HELPER KEAMANAN
// ============================================================================

function getDatabase() {
  const props = PropertiesService.getScriptProperties();
  const dbId = props.getProperty('DATABASE_ID') || props.getProperty('SPREADSHEET_ID');
  if (dbId && dbId.trim()) {
    try { return SpreadsheetApp.openById(dbId.trim()); } catch (e) {}
  }
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  throw new Error('Database Spreadsheet belum terhubung. Silakan jalankan setupDatabaseDPRD() terlebih dahulu.');
}

function getPasswordSalt() {
  const props = PropertiesService.getScriptProperties();
  let salt = props.getProperty('PASSWORD_SALT');
  if (!salt) {
    salt = 'DPRD_PAREPARE_SALT_SECURE_2026';
    props.setProperty('PASSWORD_SALT', salt);
  }
  return salt;
}

function hashPasswordWithSalt(password, salt) {
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

function hashPasswordGAS(password) {
  return hashPasswordWithSalt(password, getPasswordSalt());
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
    throw new Error('Akses ditolak. Sesi autentikasi tidak ditemukan.');
  }
  const cleanToken = token.trim();
  if (cleanToken.length < 16) {
    throw new Error('Akses ditolak. Format token sesi tidak valid.');
  }
  const cache = CacheService.getScriptCache();
  const sessionData = cache.get('session_' + cleanToken);
  if (!sessionData) {
    throw new Error('Sesi telah kedaluwarsa atau tidak valid. Silakan login kembali.');
  }
  try {
    const session = JSON.parse(sessionData);
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      cache.remove('session_' + cleanToken);
      throw new Error('Sesi telah kedaluwarsa. Silakan login kembali.');
    }
    return session;
  } catch (err) {
    throw new Error('Sesi telah kedaluwarsa. Silakan login kembali.');
  }
}

function checkLoginRateLimit(identifier) {
  const cache = CacheService.getScriptCache();
  const lockoutKey = 'lockout_' + identifier;
  const isLocked = cache.get(lockoutKey);
  if (isLocked) {
    return {
      allowed: false,
      message: 'Terlalu banyak percobaan login gagal. Akses dikunci sementara selama 15 menit.'
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
    cache.put(lockoutKey, 'true', 900); // 15 menit lockout
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

function recordActivity(ss, userId, username, role, aksi, detail, ipAddress) {
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
      sanitizeSheetValue(role || '-'),
      sanitizeSheetValue(aksi),
      sanitizeSheetValue(detail),
      sanitizeSheetValue(ipAddress || '-')
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

// ============================================================================
// 3. HTTP HANDLER: doGet(e)
// ============================================================================

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
        }, 'Sistem Pengarsipan DPRD Kota Parepare aktif.');

      case 'checkConfig': {
        const check = checkDatabaseDPRD();
        return jsonResponse(true, check, 'Pemeriksaan konfigurasi berhasil.');
      }

      case 'getPublicStats': {
        const dewan = getSheetData(ss, 'dewan');
        const docs = getSheetData(ss, 'dokumen');
        const kat = getSheetData(ss, 'kategori_dokumen');
        return jsonResponse(true, {
          totalDewan: dewan.length,
          totalDokumen: docs.length,
          totalKategori: kat.length
        }, 'Statistik publik berhasil dimuat.');
      }

      default:
        return jsonResponse(false, null, 'Aksi GET tidak dikenali.', 'NOT_FOUND');
    }
  } catch (err) {
    return jsonResponse(false, null, err.message, 'GAS_GET_ERROR');
  }
}

// ============================================================================
// 4. HTTP HANDLER: doPost(e) & ROUTING
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

    // ---------------- AUTH: LOGIN ----------------
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
        if (String(u.username || '').trim().toLowerCase() !== username) return false;
        // Cocokkan hash dengan salt tersimpan atau salt sistem
        const userSalt = String(u.salt || getPasswordSalt());
        const expectedHash = hashPasswordWithSalt(password, userSalt);
        if (String(u.password_hash || '') === expectedHash) return true;
        if (String(u.password_hash || '') === inputHash) return true;
        return false;
      });

      if (!matchedUser || String(matchedUser.status || '').toLowerCase() === 'nonaktif') {
        const isLocked = recordFailedLogin(username);
        recordActivity(ss, '-', username, '-', 'LOGIN_GAGAL', 'Percobaan login gagal untuk username: ' + username);
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

      // Buat token sesi acak 256-bit
      const rawSeed = Utilities.getUuid() + '-' + Date.now() + '-' + Math.random().toString(36);
      const tokenDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawSeed, Utilities.Charset.UTF_8);
      const sessionToken = Utilities.base64EncodeWebSafe(tokenDigest).replace(/=+$/, '');

      const ttlSeconds = 21600; // 6 Jam masa berlaku sesi
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      const mustChange = String(matchedUser.must_change_password || '').toLowerCase() === 'true';

      const sessionObj = {
        userId: matchedUser.id,
        username: matchedUser.username,
        nama: matchedUser.nama,
        role: matchedUser.role || 'staff',
        mustChangePassword: mustChange,
        expiresAt: expiresAt
      };

      CacheService.getScriptCache().put('session_' + sessionToken, JSON.stringify(sessionObj), ttlSeconds);

      // Perbarui waktu login terakhir di spreadsheet
      try {
        const uSheet = ss.getSheetByName('users');
        if (uSheet && matchedUser._rowIndex) {
          const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
          uSheet.getRange(matchedUser._rowIndex, 10).setValue(nowIso);
        }
      } catch (e) {}

      recordActivity(ss, matchedUser.id, matchedUser.username, matchedUser.role, 'LOGIN_SUKSES', 'Pengguna berhasil masuk ke sistem');

      return jsonResponse(true, {
        token: sessionToken,
        user: sessionObj
      }, 'Login berhasil.');
    }

    // ---------------- AUTH: LOGOUT ----------------
    if (action === 'adminLogout' || action === 'logout') {
      if (token) {
        try {
          const sess = verifySession(token);
          recordActivity(ss, sess.userId, sess.username, sess.role, 'LOGOUT', 'Pengguna keluar dari sistem');
        } catch (e) {}
        CacheService.getScriptCache().remove('session_' + token);
      }
      return jsonResponse(true, null, 'Logout berhasil.');
    }

    // ---------------- OPERASI YANG MEMERLUKAN SESI VALID ----------------
    const session = verifySession(token);

    // ---------------- AUTH: CEK SESI & PROFIL ----------------
    if (action === 'getCurrentUser' || action === 'checkSession' || action === 'getProfile') {
      return jsonResponse(true, session, 'Sesi aktif.');
    }

    // ---------------- AUTH: GANTI PASSWORD ----------------
    if (action === 'changePassword') {
      const oldPass = String(payload.oldPassword || '');
      const newPass = String(payload.newPassword || '');

      if (!newPass || newPass.length < 8) {
        return jsonResponse(false, null, 'Password baru minimal 8 karakter.', 'VALIDATION_ERROR');
      }

      const users = getSheetData(ss, 'users');
      const curUser = users.find(function(u) { return String(u.username || '').toLowerCase() === session.username.toLowerCase(); });
      if (!curUser) {
        return jsonResponse(false, null, 'Pengguna tidak ditemukan.', 'USER_NOT_FOUND');
      }

      const userSalt = String(curUser.salt || getPasswordSalt());
      const expectedOldHash = hashPasswordWithSalt(oldPass, userSalt);
      if (String(curUser.password_hash) !== expectedOldHash && String(curUser.password_hash) !== hashPasswordGAS(oldPass)) {
        return jsonResponse(false, null, 'Password lama tidak sesuai.', 'INVALID_OLD_PASSWORD');
      }

      // Hash password baru
      const newHash = hashPasswordWithSalt(newPass, userSalt);
      const uSheet = ss.getSheetByName('users');
      uSheet.getRange(curUser._rowIndex, 3).setValue(newHash);
      uSheet.getRange(curUser._rowIndex, 8).setValue('false'); // must_change_password selesai

      // Perbarui cache sesi
      session.mustChangePassword = false;
      CacheService.getScriptCache().put('session_' + token, JSON.stringify(session), 21600);

      recordActivity(ss, session.userId, session.username, session.role, 'GANTI_PASSWORD', 'Pengguna berhasil memperbarui password');
      return jsonResponse(true, session, 'Password berhasil diperbarui.');
    }

    // PENGUNCIAN SCRIPTLOCK UNTUK OPERASI PENULISAN (MUTASI DATA)
    const writeActions = [
      'createDewan', 'updateDewan', 'toggleDewanStatus', 'deleteDewan',
      'createKategori', 'updateKategori', 'toggleKategoriStatus', 'deleteKategori',
      'createTahun', 'updateTahun', 'deleteTahun',
      'createFolder', 'updateFolder', 'deleteFolder',
      'uploadDokumen', 'updateDokumen', 'deleteDokumen',
      'createUser', 'toggleUserStatus', 'resetUserPassword'
    ];

    if (writeActions.indexOf(action) !== -1) {
      lock.waitLock(25000); // 25 detik batas antrian
      lockAcquired = true;
    }

    // ---------------- DASHBOARD DATA ----------------
    if (action === 'getDashboardData') {
      const dewanList = getSheetData(ss, 'dewan');
      const docList = getSheetData(ss, 'dokumen');
      const katList = getSheetData(ss, 'kategori_dokumen');
      const logList = getSheetData(ss, 'aktivitas_log');

      const dewanAktif = dewanList.filter(function(d) { return String(d.status || '').toLowerCase() !== 'nonaktif'; });
      const docAktif = docList.filter(function(d) { return String(d.status || '').toLowerCase() !== 'nonaktif'; });
      const katAktif = katList.filter(function(k) { return String(k.status || '').toLowerCase() !== 'nonaktif'; });

      const sortedDocs = docAktif.slice().sort(function(a, b) {
        return new Date(b.tanggal_upload || 0).getTime() - new Date(a.tanggal_upload || 0).getTime();
      }).slice(0, 5);

      const recentLogs = logList.slice(-6).reverse();

      return jsonResponse(true, {
        totalDewan: dewanList.length,
        totalDewanAktif: dewanAktif.length,
        totalDokumen: docAktif.length,
        totalKategori: katAktif.length,
        recentDocuments: sortedDocs,
        recentActivities: (session.role === 'superadmin' || session.role === 'admin') ? recentLogs : []
      }, 'Data dashboard berhasil dimuat.');
    }

    // ---------------- ANGGOTA DEWAN CRUD ----------------
    if (action === 'getDewanList') {
      const list = getSheetData(ss, 'dewan');
      const q = String(payload.cari || payload.q || '').trim().toLowerCase();
      const statusFilter = String(payload.status || '').trim().toLowerCase();

      let filtered = list;
      if (q) {
        filtered = filtered.filter(function(d) {
          return String(d.nama || '').toLowerCase().indexOf(q) !== -1 ||
                 String(d.nama_partai || '').toLowerCase().indexOf(q) !== -1 ||
                 String(d.jabatan || '').toLowerCase().indexOf(q) !== -1;
        });
      }
      if (statusFilter) {
        filtered = filtered.filter(function(d) {
          return String(d.status || '').toLowerCase() === statusFilter;
        });
      }

      // Urutkan berdasarkan nomor_urut
      filtered.sort(function(a, b) {
        return (parseInt(a.nomor_urut, 10) || 999) - (parseInt(b.nomor_urut, 10) || 999);
      });

      return jsonResponse(true, filtered, 'Daftar anggota dewan berhasil dimuat.');
    }

    if (action === 'getDewanById') {
      const id = parseInt(payload.id, 10);
      const list = getSheetData(ss, 'dewan');
      const item = list.find(function(d) { return parseInt(d.id, 10) === id || parseInt(d.nomor_urut, 10) === id; });
      if (!item) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');
      return jsonResponse(true, item, 'Data dewan ditemukan.');
    }

    if (action === 'createDewan') {
      const d = payload.data || payload;
      const dewanSheet = ss.getSheetByName('dewan');
      const allDewan = getSheetData(ss, 'dewan');

      const maxId = allDewan.length ? Math.max.apply(null, allDewan.map(function(x) { return parseInt(x.id, 10) || 0; })) : 0;
      const newId = maxId + 1;
      const nomorUrut = parseInt(d.nomor_urut, 10) || newId;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      dewanSheet.appendRow([
        newId,
        nomorUrut,
        sanitizeSheetValue(d.nama),
        sanitizeSheetValue(d.jabatan || 'Anggota'),
        sanitizeSheetValue(d.periode || '2024 - 2029'),
        sanitizeSheetValue(d.nama_pendamping || '-'),
        sanitizeSheetValue(d.nama_partai || '-'),
        'aktif',
        nowIso,
        nowIso
      ]);

      recordActivity(ss, session.userId, session.username, session.role, 'TAMBAH_DEWAN', 'Menambahkan anggota dewan: ' + d.nama);
      return jsonResponse(true, { id: newId, nomor_urut: nomorUrut, nama: d.nama }, 'Anggota dewan berhasil ditambahkan.');
    }

    if (action === 'updateDewan') {
      const d = payload.data || payload;
      const id = parseInt(d.id, 10);
      const dewanSheet = ss.getSheetByName('dewan');
      const allDewan = getSheetData(ss, 'dewan');
      const target = allDewan.find(function(x) { return parseInt(x.id, 10) === id; });

      if (!target) return jsonResponse(false, null, 'Anggota dewan tidak ditemukan.', 'NOT_FOUND');

      const row = target._rowIndex;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      if (d.nomor_urut !== undefined) dewanSheet.getRange(row, 2).setValue(parseInt(d.nomor_urut, 10));
      if (d.nama !== undefined) dewanSheet.getRange(row, 3).setValue(sanitizeSheetValue(d.nama));
      if (d.jabatan !== undefined) dewanSheet.getRange(row, 4).setValue(sanitizeSheetValue(d.jabatan));
      if (d.periode !== undefined) dewanSheet.getRange(row, 5).setValue(sanitizeSheetValue(d.periode));
      if (d.nama_pendamping !== undefined) dewanSheet.getRange(row, 6).setValue(sanitizeSheetValue(d.nama_pendamping));
      if (d.nama_partai !== undefined) dewanSheet.getRange(row, 7).setValue(sanitizeSheetValue(d.nama_partai));
      if (d.status !== undefined) dewanSheet.getRange(row, 8).setValue(sanitizeSheetValue(d.status));
      dewanSheet.getRange(row, 10).setValue(nowIso);

      recordActivity(ss, session.userId, session.username, session.role, 'UPDATE_DEWAN', 'Memperbarui data dewan ID: ' + id);
      return jsonResponse(true, { id: id }, 'Data anggota dewan berhasil diperbarui.');
    }

    if (action === 'toggleDewanStatus') {
      const id = parseInt(payload.id, 10);
      const newStatus = String(payload.status || 'aktif').toLowerCase() === 'aktif' ? 'aktif' : 'nonaktif';
      const dewanSheet = ss.getSheetByName('dewan');
      const allDewan = getSheetData(ss, 'dewan');
      const target = allDewan.find(function(x) { return parseInt(x.id, 10) === id; });

      if (!target) return jsonResponse(false, null, 'Anggota dewan tidak ditemukan.', 'NOT_FOUND');
      dewanSheet.getRange(target._rowIndex, 8).setValue(newStatus);

      recordActivity(ss, session.userId, session.username, session.role, 'STATUS_DEWAN', 'Mengubah status dewan ID ' + id + ' menjadi: ' + newStatus);
      return jsonResponse(true, { id: id, status: newStatus }, 'Status anggota dewan berhasil diubah.');
    }

    if (action === 'deleteDewan') {
      const id = parseInt(payload.id, 10);
      const docs = getSheetData(ss, 'dokumen');
      const relatedDocs = docs.filter(function(doc) { return parseInt(doc.dewan_id, 10) === id; });

      // Perlindungan integritas: jangan hapus dewan yang memiliki dokumen arsip
      if (relatedDocs.length > 0) {
        return jsonResponse(
          false,
          { totalDokumen: relatedDocs.length },
          'Anggota dewan tidak dapat dihapus karena memiliki ' + relatedDocs.length + ' dokumen arsip terikat. Silakan gunakan fitur Nonaktifkan.',
          'HAS_DEPENDENT_RECORDS'
        );
      }

      const dewanSheet = ss.getSheetByName('dewan');
      const allDewan = getSheetData(ss, 'dewan');
      const target = allDewan.find(function(x) { return parseInt(x.id, 10) === id; });
      if (!target) return jsonResponse(false, null, 'Data dewan tidak ditemukan.', 'NOT_FOUND');

      dewanSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_DEWAN', 'Menghapus anggota dewan ID: ' + id);
      return jsonResponse(true, { id: id }, 'Anggota dewan berhasil dihapus.');
    }

    // ---------------- KATEGORI ARSIP CRUD ----------------
    if (action === 'getKategoriList') {
      const list = getSheetData(ss, 'kategori_dokumen');
      return jsonResponse(true, list, 'Daftar kategori berhasil dimuat.');
    }

    if (action === 'getKategoriWithDocCount') {
      const dewanId = payload.dewan_id ? parseInt(payload.dewan_id, 10) : null;
      const katList = getSheetData(ss, 'kategori_dokumen');
      const docList = getSheetData(ss, 'dokumen');

      const result = katList.map(function(k) {
        const count = docList.filter(function(d) {
          const matchKat = parseInt(d.kategori_id, 10) === parseInt(k.id, 10);
          const matchDewan = !dewanId || parseInt(d.dewan_id, 10) === dewanId;
          const isNotDeleted = String(d.status || '').toLowerCase() !== 'nonaktif';
          return matchKat && matchDewan && isNotDeleted;
        }).length;
        return {
          id: k.id,
          nama_kategori: k.nama_kategori,
          deskripsi: k.deskripsi || '',
          status: k.status || 'aktif',
          jumlah_dokumen: count
        };
      });

      return jsonResponse(true, result, 'Kategori dengan jumlah dokumen berhasil dimuat.');
    }

    if (action === 'createKategori') {
      const nama = String(payload.nama_kategori || '').trim();
      const deskripsi = String(payload.deskripsi || '').trim();

      if (!nama) return jsonResponse(false, null, 'Nama kategori wajib diisi.', 'VALIDATION_ERROR');

      const katSheet = ss.getSheetByName('kategori_dokumen');
      const allKat = getSheetData(ss, 'kategori_dokumen');

      // Validasi duplikasi (case-insensitive)
      const duplicate = allKat.some(function(k) { return String(k.nama_kategori || '').trim().toLowerCase() === nama.toLowerCase(); });
      if (duplicate) {
        return jsonResponse(false, null, 'Kategori dengan nama "' + nama + '" sudah terdaftar.', 'DUPLICATE_NAME');
      }

      const maxId = allKat.length ? Math.max.apply(null, allKat.map(function(x) { return parseInt(x.id, 10) || 0; })) : 0;
      const newId = maxId + 1;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      katSheet.appendRow([newId, sanitizeSheetValue(nama), sanitizeSheetValue(deskripsi), 'aktif', nowIso, nowIso]);

      recordActivity(ss, session.userId, session.username, session.role, 'TAMBAH_KATEGORI', 'Menambahkan kategori: ' + nama);
      return jsonResponse(true, { id: newId, nama_kategori: nama }, 'Kategori berhasil ditambahkan.');
    }

    if (action === 'updateKategori') {
      const id = parseInt(payload.id, 10);
      const nama = String(payload.nama_kategori || '').trim();
      const deskripsi = String(payload.deskripsi || '').trim();

      if (!nama) return jsonResponse(false, null, 'Nama kategori wajib diisi.', 'VALIDATION_ERROR');

      const katSheet = ss.getSheetByName('kategori_dokumen');
      const allKat = getSheetData(ss, 'kategori_dokumen');
      const target = allKat.find(function(k) { return parseInt(k.id, 10) === id; });
      if (!target) return jsonResponse(false, null, 'Kategori tidak ditemukan.', 'NOT_FOUND');

      // Validasi duplikasi nama dengan ID lain
      const duplicate = allKat.some(function(k) {
        return parseInt(k.id, 10) !== id && String(k.nama_kategori || '').trim().toLowerCase() === nama.toLowerCase();
      });
      if (duplicate) {
        return jsonResponse(false, null, 'Kategori dengan nama "' + nama + '" sudah ada.', 'DUPLICATE_NAME');
      }

      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");
      katSheet.getRange(target._rowIndex, 2).setValue(sanitizeSheetValue(nama));
      katSheet.getRange(target._rowIndex, 3).setValue(sanitizeSheetValue(deskripsi));
      katSheet.getRange(target._rowIndex, 6).setValue(nowIso);

      recordActivity(ss, session.userId, session.username, session.role, 'UPDATE_KATEGORI', 'Memperbarui kategori ID: ' + id);
      return jsonResponse(true, { id: id, nama_kategori: nama }, 'Kategori berhasil diperbarui.');
    }

    if (action === 'toggleKategoriStatus') {
      const id = parseInt(payload.id, 10);
      const newStatus = String(payload.status || 'aktif').toLowerCase() === 'aktif' ? 'aktif' : 'nonaktif';
      const katSheet = ss.getSheetByName('kategori_dokumen');
      const allKat = getSheetData(ss, 'kategori_dokumen');
      const target = allKat.find(function(k) { return parseInt(k.id, 10) === id; });
      if (!target) return jsonResponse(false, null, 'Kategori tidak ditemukan.', 'NOT_FOUND');

      katSheet.getRange(target._rowIndex, 4).setValue(newStatus);
      recordActivity(ss, session.userId, session.username, session.role, 'STATUS_KATEGORI', 'Mengubah status kategori ID ' + id + ' menjadi: ' + newStatus);
      return jsonResponse(true, { id: id, status: newStatus }, 'Status kategori berhasil diubah.');
    }

    if (action === 'deleteKategori') {
      const id = parseInt(payload.id, 10);
      const docs = getSheetData(ss, 'dokumen');
      const relatedDocs = docs.filter(function(d) { return parseInt(d.kategori_id, 10) === id; });

      // Perlindungan integritas kategori
      if (relatedDocs.length > 0) {
        return jsonResponse(
          false,
          { totalDokumen: relatedDocs.length },
          'Kategori tidak dapat dihapus karena masih digunakan oleh ' + relatedDocs.length + ' dokumen arsip. Silakan nonaktifkan kategori ini atau pindahkan dokumen terkait terlebih dahulu.',
          'HAS_DEPENDENT_RECORDS'
        );
      }

      const katSheet = ss.getSheetByName('kategori_dokumen');
      const allKat = getSheetData(ss, 'kategori_dokumen');
      const target = allKat.find(function(k) { return parseInt(k.id, 10) === id; });
      if (!target) return jsonResponse(false, null, 'Kategori tidak ditemukan.', 'NOT_FOUND');

      katSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_KATEGORI', 'Menghapus kategori ID: ' + id);
      return jsonResponse(true, { id: id }, 'Kategori berhasil dihapus.');
    }

    // ---------------- TAHUN ANGGARAN & FOLDER CRUD ----------------
    if (action === 'getTahunList') {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const tahunSheetData = getSheetData(ss, 'tahun_dokumen');
      const docSheetData = getSheetData(ss, 'dokumen');

      const tahunMap = {};
      tahunSheetData.forEach(function(t) {
        if (parseInt(t.dewan_id, 10) === dewanId && parseInt(t.kategori_id, 10) === katId) {
          const yr = parseInt(t.tahun, 10);
          tahunMap[yr] = { id: t.id, tahun: yr, jumlah_dokumen: 0 };
        }
      });

      docSheetData.forEach(function(d) {
        if (parseInt(d.dewan_id, 10) === dewanId && parseInt(d.kategori_id, 10) === katId) {
          const yr = parseInt(d.tahun, 10);
          if (!tahunMap[yr]) {
            tahunMap[yr] = { id: yr, tahun: yr, jumlah_dokumen: 0 };
          }
          if (String(d.status || '').toLowerCase() !== 'nonaktif') {
            tahunMap[yr].jumlah_dokumen++;
          }
        }
      });

      const list = Object.keys(tahunMap).map(function(k) { return tahunMap[k]; });
      list.sort(function(a, b) { return b.tahun - a.tahun; });

      return jsonResponse(true, list, 'Daftar tahun berhasil dimuat.');
    }

    if (action === 'createTahun') {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const yr = parseInt(payload.tahun, 10);

      if (!yr || yr < 1990 || yr > 2099) {
        return jsonResponse(false, null, 'Format tahun tidak valid.', 'VALIDATION_ERROR');
      }

      const tahunSheet = ss.getSheetByName('tahun_dokumen');
      const allTahun = getSheetData(ss, 'tahun_dokumen');
      const exists = allTahun.some(function(t) {
        return parseInt(t.dewan_id, 10) === dewanId && parseInt(t.kategori_id, 10) === katId && parseInt(t.tahun, 10) === yr;
      });

      if (exists) {
        return jsonResponse(false, null, 'Tahun ' + yr + ' sudah terdaftar untuk kategori ini.', 'DUPLICATE_ENTRY');
      }

      const maxId = allTahun.length ? Math.max.apply(null, allTahun.map(function(x) { return parseInt(x.id, 10) || 0; })) : 0;
      const newId = maxId + 1;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      tahunSheet.appendRow([newId, dewanId, katId, yr, 'aktif', nowIso]);
      recordActivity(ss, session.userId, session.username, session.role, 'TAMBAH_TAHUN', 'Menambahkan tahun: ' + yr);
      return jsonResponse(true, { id: newId, tahun: yr }, 'Tahun berhasil ditambahkan.');
    }

    if (action === 'updateTahun') {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const tahunLama = parseInt(payload.tahun_lama, 10);
      const tahunBaru = parseInt(payload.tahun_baru, 10);

      const tahunSheet = ss.getSheetByName('tahun_dokumen');
      const allTahun = getSheetData(ss, 'tahun_dokumen');
      const target = allTahun.find(function(t) {
        return parseInt(t.dewan_id, 10) === dewanId && parseInt(t.kategori_id, 10) === katId && parseInt(t.tahun, 10) === tahunLama;
      });

      if (target) {
        tahunSheet.getRange(target._rowIndex, 4).setValue(tahunBaru);
      }

      // Perbarui juga di folder dan dokumen
      const fSheet = ss.getSheetByName('folder_dokumen');
      const allF = getSheetData(ss, 'folder_dokumen');
      allF.forEach(function(f) {
        if (parseInt(f.dewan_id, 10) === dewanId && parseInt(f.kategori_id, 10) === katId && parseInt(f.tahun, 10) === tahunLama) {
          fSheet.getRange(f._rowIndex, 4).setValue(tahunBaru);
        }
      });

      const dSheet = ss.getSheetByName('dokumen');
      const allD = getSheetData(ss, 'dokumen');
      allD.forEach(function(d) {
        if (parseInt(d.dewan_id, 10) === dewanId && parseInt(d.kategori_id, 10) === katId && parseInt(d.tahun, 10) === tahunLama) {
          dSheet.getRange(d._rowIndex, 4).setValue(tahunBaru);
        }
      });

      recordActivity(ss, session.userId, session.username, session.role, 'UPDATE_TAHUN', 'Mengubah tahun ' + tahunLama + ' menjadi ' + tahunBaru);
      return jsonResponse(true, { tahun: tahunBaru }, 'Tahun berhasil diperbarui.');
    }

    if (action === 'deleteTahun') {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const yr = parseInt(payload.tahun, 10);

      const docs = getSheetData(ss, 'dokumen');
      const related = docs.filter(function(d) {
        return parseInt(d.dewan_id, 10) === dewanId && parseInt(d.kategori_id, 10) === katId && parseInt(d.tahun, 10) === yr;
      });

      if (related.length > 0) {
        return jsonResponse(false, { totalDokumen: related.length }, 'Tahun tidak dapat dihapus karena masih memiliki ' + related.length + ' dokumen.', 'HAS_DEPENDENT_RECORDS');
      }

      const tahunSheet = ss.getSheetByName('tahun_dokumen');
      const allTahun = getSheetData(ss, 'tahun_dokumen');
      const target = allTahun.find(function(t) {
        return parseInt(t.dewan_id, 10) === dewanId && parseInt(t.kategori_id, 10) === katId && parseInt(t.tahun, 10) === yr;
      });
      if (target) tahunSheet.deleteRow(target._rowIndex);

      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_TAHUN', 'Menghapus tahun: ' + yr);
      return jsonResponse(true, { tahun: yr }, 'Tahun berhasil dihapus.');
    }

    if (action === 'getFolderList') {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const yr = parseInt(payload.tahun, 10);

      const fData = getSheetData(ss, 'folder_dokumen');
      const dData = getSheetData(ss, 'dokumen');

      const folders = fData.filter(function(f) {
        return parseInt(f.dewan_id, 10) === dewanId && parseInt(f.kategori_id, 10) === katId && parseInt(f.tahun, 10) === yr;
      });

      const res = folders.map(function(f) {
        const count = dData.filter(function(d) {
          const matchDewan = parseInt(d.dewan_id, 10) === dewanId;
          const matchKat = parseInt(d.kategori_id, 10) === katId;
          const matchYr = parseInt(d.tahun, 10) === yr;
          const matchFolder = String(d.nama_folder || '').trim().toLowerCase() === String(f.nama_folder || '').trim().toLowerCase();
          const isNotDeleted = String(d.status || '').toLowerCase() !== 'nonaktif';
          return matchDewan && matchKat && matchYr && matchFolder && isNotDeleted;
        }).length;
        return {
          id: f.id,
          nama_folder: f.nama_folder,
          deskripsi: f.deskripsi || '',
          jumlah_dokumen: count
        };
      });

      return jsonResponse(true, res, 'Daftar folder berhasil dimuat.');
    }

    if (action === 'createFolder') {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const yr = parseInt(payload.tahun, 10);
      const nama = String(payload.nama_folder || '').trim();
      const deskripsi = String(payload.deskripsi || '').trim();

      if (!nama) return jsonResponse(false, null, 'Nama folder wajib diisi.', 'VALIDATION_ERROR');

      const fSheet = ss.getSheetByName('folder_dokumen');
      const allF = getSheetData(ss, 'folder_dokumen');
      const exists = allF.some(function(f) {
        return parseInt(f.dewan_id, 10) === dewanId && parseInt(f.kategori_id, 10) === katId &&
               parseInt(f.tahun, 10) === yr && String(f.nama_folder || '').trim().toLowerCase() === nama.toLowerCase();
      });

      if (exists) {
        return jsonResponse(false, null, 'Folder dengan nama "' + nama + '" sudah ada.', 'DUPLICATE_ENTRY');
      }

      const maxId = allF.length ? Math.max.apply(null, allF.map(function(x) { return parseInt(x.id, 10) || 0; })) : 0;
      const newId = maxId + 1;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      fSheet.appendRow([newId, dewanId, katId, yr, sanitizeSheetValue(nama), sanitizeSheetValue(deskripsi), 'aktif', nowIso]);
      recordActivity(ss, session.userId, session.username, session.role, 'TAMBAH_FOLDER', 'Menambahkan folder: ' + nama);
      return jsonResponse(true, { id: newId, nama_folder: nama }, 'Folder berhasil ditambahkan.');
    }

    if (action === 'updateFolder') {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const yr = parseInt(payload.tahun, 10);
      const folderLama = String(payload.nama_folder_lama || '').trim();
      const folderBaru = String(payload.nama_folder_baru || '').trim();

      if (!folderBaru) return jsonResponse(false, null, 'Nama folder baru wajib diisi.', 'VALIDATION_ERROR');

      const fSheet = ss.getSheetByName('folder_dokumen');
      const allF = getSheetData(ss, 'folder_dokumen');
      const target = allF.find(function(f) {
        return parseInt(f.dewan_id, 10) === dewanId && parseInt(f.kategori_id, 10) === katId &&
               parseInt(f.tahun, 10) === yr && String(f.nama_folder || '').trim().toLowerCase() === folderLama.toLowerCase();
      });

      if (target) {
        fSheet.getRange(target._rowIndex, 5).setValue(sanitizeSheetValue(folderBaru));
      }

      // Perbarui juga di dokumen terkait
      const dSheet = ss.getSheetByName('dokumen');
      const allD = getSheetData(ss, 'dokumen');
      allD.forEach(function(d) {
        if (parseInt(d.dewan_id, 10) === dewanId && parseInt(d.kategori_id, 10) === katId &&
            parseInt(d.tahun, 10) === yr && String(d.nama_folder || '').trim().toLowerCase() === folderLama.toLowerCase()) {
          dSheet.getRange(d._rowIndex, 5).setValue(sanitizeSheetValue(folderBaru));
        }
      });

      recordActivity(ss, session.userId, session.username, session.role, 'UPDATE_FOLDER', 'Mengubah folder: ' + folderLama + ' -> ' + folderBaru);
      return jsonResponse(true, { nama_folder: folderBaru }, 'Folder berhasil diperbarui.');
    }

    if (action === 'deleteFolder') {
      const dewanId = parseInt(payload.dewan_id, 10);
      const katId = parseInt(payload.kategori_id, 10);
      const yr = parseInt(payload.tahun, 10);
      const nama = String(payload.nama_folder || '').trim();

      const docs = getSheetData(ss, 'dokumen');
      const related = docs.filter(function(d) {
        return parseInt(d.dewan_id, 10) === dewanId && parseInt(d.kategori_id, 10) === katId &&
               parseInt(d.tahun, 10) === yr && String(d.nama_folder || '').trim().toLowerCase() === nama.toLowerCase();
      });

      if (related.length > 0) {
        return jsonResponse(false, { totalDokumen: related.length }, 'Folder tidak dapat dihapus karena memiliki ' + related.length + ' dokumen di dalamnya.', 'HAS_DEPENDENT_RECORDS');
      }

      const fSheet = ss.getSheetByName('folder_dokumen');
      const allF = getSheetData(ss, 'folder_dokumen');
      const target = allF.find(function(f) {
        return parseInt(f.dewan_id, 10) === dewanId && parseInt(f.kategori_id, 10) === katId &&
               parseInt(f.tahun, 10) === yr && String(f.nama_folder || '').trim().toLowerCase() === nama.toLowerCase();
      });
      if (target) fSheet.deleteRow(target._rowIndex);

      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_FOLDER', 'Menghapus folder: ' + nama);
      return jsonResponse(true, { nama_folder: nama }, 'Folder berhasil dihapus.');
    }

    // ---------------- DOKUMEN & DRIVE CRUD ----------------
    if (action === 'getDokumenList') {
      const dewanId = payload.dewan_id ? parseInt(payload.dewan_id, 10) : null;
      const katId = payload.kategori_id ? parseInt(payload.kategori_id, 10) : null;
      const yr = payload.tahun ? parseInt(payload.tahun, 10) : null;
      const folderName = payload.nama_folder ? String(payload.nama_folder).trim().toLowerCase() : null;
      const q = String(payload.q || payload.cari || '').trim().toLowerCase();

      let list = getSheetData(ss, 'dokumen');

      list = list.filter(function(d) {
        if (String(d.status || '').toLowerCase() === 'nonaktif') return false;
        if (dewanId && parseInt(d.dewan_id, 10) !== dewanId) return false;
        if (katId && parseInt(d.kategori_id, 10) !== katId) return false;
        if (yr && parseInt(d.tahun, 10) !== yr) return false;
        if (folderName && String(d.nama_folder || '').trim().toLowerCase() !== folderName) return false;
        if (q) {
          const matchTitle = String(d.nama_dokumen || '').toLowerCase().indexOf(q) !== -1;
          const matchDesc = String(d.keterangan || '').toLowerCase().indexOf(q) !== -1;
          const matchFile = String(d.nama_file || '').toLowerCase().indexOf(q) !== -1;
          return matchTitle || matchDesc || matchFile;
        }
        return true;
      });

      return jsonResponse(true, list, 'Daftar dokumen berhasil dimuat.');
    }

    if (action === 'getDokumenById') {
      const id = parseInt(payload.id, 10);
      const docs = getSheetData(ss, 'dokumen');
      const target = docs.find(function(d) { return parseInt(d.id, 10) === id; });
      if (!target) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');
      return jsonResponse(true, target, 'Dokumen ditemukan.');
    }

    if (action === 'uploadDokumen' || action === 'createDokumen') {
      const d = payload.data || payload;
      const dewanId = parseInt(d.dewan_id, 10);
      const katId = parseInt(d.kategori_id, 10);
      const yr = parseInt(d.tahun, 10);
      const folderName = String(d.nama_folder || '').trim();
      const namaDokumen = String(d.nama_dokumen || d.judul || '').trim();
      const keterangan = String(d.keterangan || '').trim();
      const fileName = String(d.fileName || d.nama_file || 'dokumen.pdf').trim();
      const base64Data = String(d.base64 || d.fileBase64 || '').trim();

      if (!namaDokumen) return jsonResponse(false, null, 'Judul dokumen wajib diisi.', 'VALIDATION_ERROR');
      if (!base64Data) return jsonResponse(false, null, 'Berkas dokumen wajib diunggah.', 'VALIDATION_ERROR');

      // Ambil folder Google Drive target
      const props = PropertiesService.getScriptProperties();
      const docFolderId = props.getProperty('DOKUMEN_FOLDER_ID');
      let targetFolder = null;
      if (docFolderId) {
        try { targetFolder = DriveApp.getFolderById(docFolderId.trim()); } catch (e) {}
      }
      if (!targetFolder) {
        targetFolder = DriveApp.getRootFolder();
      }

      // Bersihkan format Base64 (jika ada data URI prefix data:...;base64,)
      let pureBase64 = base64Data;
      let detectedMime = 'application/pdf';
      if (base64Data.indexOf(',') !== -1) {
        const parts = base64Data.split(',');
        pureBase64 = parts[1];
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) detectedMime = mimeMatch[1];
      }

      const decodedBytes = Utilities.base64Decode(pureBase64);
      if (decodedBytes.length > 10 * 1024 * 1024) {
        return jsonResponse(false, null, 'Ukuran berkas melebihi batas 10 MB.', 'FILE_TOO_LARGE');
      }

      // Simpan berkas fisik ke Google Drive
      const blob = Utilities.newBlob(decodedBytes, detectedMime, fileName);
      const driveFile = targetFolder.createFile(blob);
      const fileId = driveFile.getId();
      const viewUrl = driveFile.getUrl();
      const directUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;

      // Simpan metadata ke Sheet dokumen
      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      const maxId = allDocs.length ? Math.max.apply(null, allDocs.map(function(x) { return parseInt(x.id, 10) || 0; })) : 0;
      const newId = maxId + 1;
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      try {
        docSheet.appendRow([
          newId,
          dewanId,
          katId,
          yr,
          sanitizeSheetValue(folderName),
          sanitizeSheetValue(namaDokumen),
          sanitizeSheetValue(keterangan),
          sanitizeSheetValue(fileName),
          fileId,
          directUrl,
          viewUrl,
          detectedMime,
          decodedBytes.length,
          'aktif',
          sanitizeSheetValue(session.username),
          nowIso
        ]);
      } catch (errSheet) {
        // Kompensasi pemulihan: jika penulisan metadata gagal, hapus berkas fisik di Drive agar tidak menjadi file yatim!
        try { driveFile.setTrashed(true); } catch (e) {}
        throw new Error('Gagal mencatat metadata dokumen: ' + errSheet.message);
      }

      recordActivity(ss, session.userId, session.username, session.role, 'UPLOAD_DOKUMEN', 'Mengunggah dokumen: ' + namaDokumen + ' (' + fileName + ')');

      return jsonResponse(true, {
        id: newId,
        nama_dokumen: namaDokumen,
        nama_file: fileName,
        file_id: fileId,
        view_url: viewUrl,
        direct_url: directUrl
      }, 'Dokumen berhasil diunggah dan disimpan.');
    }

    if (action === 'updateDokumen') {
      const d = payload.data || payload;
      const id = parseInt(d.id, 10);
      const namaDokumen = String(d.nama_dokumen || d.judul || '').trim();
      const keterangan = String(d.keterangan || '').trim();

      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      const target = allDocs.find(function(x) { return parseInt(x.id, 10) === id; });
      if (!target) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');

      const row = target._rowIndex;
      if (namaDokumen) docSheet.getRange(row, 6).setValue(sanitizeSheetValue(namaDokumen));
      if (keterangan !== undefined) docSheet.getRange(row, 7).setValue(sanitizeSheetValue(keterangan));

      recordActivity(ss, session.userId, session.username, session.role, 'UPDATE_DOKUMEN', 'Memperbarui dokumen ID: ' + id);
      return jsonResponse(true, { id: id }, 'Metadata dokumen berhasil diperbarui.');
    }

    if (action === 'deleteDokumen') {
      const id = parseInt(payload.id, 10);
      const docSheet = ss.getSheetByName('dokumen');
      const allDocs = getSheetData(ss, 'dokumen');
      const target = allDocs.find(function(d) { return parseInt(d.id, 10) === id; });

      if (!target) return jsonResponse(false, null, 'Dokumen tidak ditemukan.', 'NOT_FOUND');

      // Hapus berkas di Google Drive (pindahkan ke Trash)
      const fileId = target.file_id;
      if (fileId && String(fileId).trim()) {
        try {
          const file = DriveApp.getFileById(String(fileId).trim());
          file.setTrashed(true);
        } catch (e) {
          Logger.log('Gagal memindahkan file Drive ke trash: ' + e.message);
        }
      }

      // Hapus baris dokumen
      docSheet.deleteRow(target._rowIndex);
      recordActivity(ss, session.userId, session.username, session.role, 'HAPUS_DOKUMEN', 'Menghapus dokumen ID: ' + id + ' (' + target.nama_dokumen + ')');
      return jsonResponse(true, { id: id }, 'Dokumen dan berkas fisik berhasil dihapus.');
    }

    // ---------------- PENGGUNA & HAK AKSES (SUPERADMIN & ADMIN) ----------------
    if (action === 'getUserList') {
      if (session.role !== 'superadmin' && session.role !== 'admin') {
        return jsonResponse(false, null, 'Akses ditolak. Fitur ini hanya untuk administrator.', 'FORBIDDEN');
      }
      const users = getSheetData(ss, 'users');
      const safeList = users.map(function(u) {
        return {
          id: u.id,
          username: u.username,
          nama: u.nama,
          role: u.role,
          status: u.status || 'aktif',
          must_change_password: u.must_change_password,
          created_at: u.created_at,
          last_login: u.last_login
        };
      });
      return jsonResponse(true, safeList, 'Daftar pengguna berhasil dimuat.');
    }

    if (action === 'createUser') {
      if (session.role !== 'superadmin' && session.role !== 'admin') {
        return jsonResponse(false, null, 'Akses ditolak.', 'FORBIDDEN');
      }
      const u = payload.data || payload;
      const username = String(u.username || '').trim().toLowerCase();
      const password = String(u.password || '');
      const nama = String(u.nama || '').trim();
      const role = String(u.role || 'staff').toLowerCase();

      if (!username || !password || !nama) {
        return jsonResponse(false, null, 'Semua kolom pengguna wajib diisi.', 'VALIDATION_ERROR');
      }

      const uSheet = ss.getSheetByName('users');
      const allUsers = getSheetData(ss, 'users');
      const duplicate = allUsers.some(function(x) { return String(x.username || '').toLowerCase() === username; });
      if (duplicate) {
        return jsonResponse(false, null, 'Username "' + username + '" sudah digunakan.', 'DUPLICATE_USERNAME');
      }

      const salt = getPasswordSalt();
      const pHash = hashPasswordWithSalt(password, salt);
      const newId = 'USR-' + (allUsers.length + 1) + '-' + Utilities.getUuid().substring(0, 4);
      const nowIso = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'Z'");

      uSheet.appendRow([
        newId,
        username,
        pHash,
        salt,
        sanitizeSheetValue(nama),
        role,
        'aktif',
        'true', // Wajib ganti password pada login pertama
        nowIso,
        ''
      ]);

      recordActivity(ss, session.userId, session.username, session.role, 'TAMBAH_USER', 'Membuat pengguna baru: ' + username + ' (' + role + ')');
      return jsonResponse(true, { id: newId, username: username, role: role }, 'Pengguna berhasil dibuat.');
    }

    if (action === 'toggleUserStatus') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Hanya superadmin yang berhak mengubah status akun pengguna.', 'FORBIDDEN');
      }
      const targetId = String(payload.id || '');
      const newStatus = String(payload.status || 'aktif').toLowerCase() === 'aktif' ? 'aktif' : 'nonaktif';

      const uSheet = ss.getSheetByName('users');
      const allUsers = getSheetData(ss, 'users');
      const target = allUsers.find(function(x) { return String(x.id) === targetId; });
      if (!target) return jsonResponse(false, null, 'Pengguna tidak ditemukan.', 'NOT_FOUND');

      if (String(target.username || '').toLowerCase() === INITIAL_SUPERADMIN_USER) {
        return jsonResponse(false, null, 'Akun superadmin utama tidak dapat dinonaktifkan.', 'FORBIDDEN');
      }

      uSheet.getRange(target._rowIndex, 7).setValue(newStatus);
      recordActivity(ss, session.userId, session.username, session.role, 'STATUS_USER', 'Mengubah status pengguna ' + target.username + ' menjadi: ' + newStatus);
      return jsonResponse(true, { id: targetId, status: newStatus }, 'Status pengguna berhasil diperbarui.');
    }

    if (action === 'resetUserPassword') {
      if (session.role !== 'superadmin') {
        return jsonResponse(false, null, 'Hanya superadmin yang berhak mereset password pengguna lain.', 'FORBIDDEN');
      }
      const targetId = String(payload.id || '');
      const newPass = String(payload.newPassword || '');
      if (!newPass || newPass.length < 8) {
        return jsonResponse(false, null, 'Password baru minimal 8 karakter.', 'VALIDATION_ERROR');
      }

      const uSheet = ss.getSheetByName('users');
      const allUsers = getSheetData(ss, 'users');
      const target = allUsers.find(function(x) { return String(x.id) === targetId; });
      if (!target) return jsonResponse(false, null, 'Pengguna tidak ditemukan.', 'NOT_FOUND');

      const salt = String(target.salt || getPasswordSalt());
      const newHash = hashPasswordWithSalt(newPass, salt);

      uSheet.getRange(target._rowIndex, 3).setValue(newHash);
      uSheet.getRange(target._rowIndex, 8).setValue('true'); // wajib ganti password lagi

      recordActivity(ss, session.userId, session.username, session.role, 'RESET_USER_PASSWORD', 'Mereset password pengguna: ' + target.username);
      return jsonResponse(true, { id: targetId }, 'Password pengguna berhasil direset.');
    }

    // ---------------- AUDIT LOG AKTIVITAS ----------------
    if (action === 'getActivityLog') {
      if (session.role !== 'superadmin' && session.role !== 'admin') {
        return jsonResponse(false, null, 'Akses ditolak.', 'FORBIDDEN');
      }
      const limit = parseInt(payload.limit, 10) || 50;
      const logs = getSheetData(ss, 'aktivitas_log');
      const sorted = logs.slice(-limit).reverse();
      return jsonResponse(true, sorted, 'Log aktivitas berhasil dimuat.');
    }

    // Endpoint tidak ditemukan
    return jsonResponse(false, null, 'Aksi API tidak dikenali: ' + action, 'NOT_FOUND');

  } catch (err) {
    return jsonResponse(false, null, err.message, 'GAS_POST_ERROR');
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}
