```php
<?php
session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";

$nama = trim($_POST['nama'] ?? '');
$jabatan = trim($_POST['jabatan'] ?? '');
$periode = trim($_POST['periode'] ?? '');
$nama_pengawas = trim($_POST['nama_pengawas'] ?? '');
$nama_partai = trim($_POST['nama_partai'] ?? '');
$keterangan = trim($_POST['keterangan'] ?? '');

// Validasi data
if ($nama === '') {
    header("Location: tambah_dewan.php?error=nama_kosong");
    exit;
}

if ($jabatan === '') {
    header("Location: tambah_dewan.php?error=jabatan_kosong");
    exit;
}

if ($periode === '') {
    header("Location: tambah_dewan.php?error=periode_kosong");
    exit;
}

if ($nama_partai === '') {
    header("Location: tambah_dewan.php?error=partai_kosong");
    exit;
}

// Daftar partai yang diperbolehkan
$daftar_partai = [
    'Partai Kebangkitan Bangsa',
    'Partai Golongan Karya',
    'Partai Nasional Demokrat',
    'Partai Keadilan Sejahtera',
    'Partai Amanat Nasional',
    'Partai Persatuan Pembangunan',
    'Partai Gerakan Indonesia Raya',
    'Partai Gelombang Rakyat Indonesia',
    'Partai Demokrasi Indonesia Perjuangan',
    'Partai Hati Nurani Rakyat',
    'Partai Demokrat',
    'Partai Bulan Bintang'
];

if (!in_array($nama_partai, $daftar_partai, true)) {
    header("Location: tambah_dewan.php?error=partai_kosong");
    exit;
}

// Cek apakah nama anggota sudah terdaftar
$sql_cek = "SELECT id FROM dewan WHERE nama = ? LIMIT 1";
$stmt_cek = mysqli_prepare($conn, $sql_cek);

if (!$stmt_cek) {
    header("Location: tambah_dewan.php?error=gagal_simpan");
    exit;
}

mysqli_stmt_bind_param($stmt_cek, "s", $nama);
mysqli_stmt_execute($stmt_cek);
mysqli_stmt_store_result($stmt_cek);

if (mysqli_stmt_num_rows($stmt_cek) > 0) {
    mysqli_stmt_close($stmt_cek);
    header("Location: tambah_dewan.php?error=nama_double");
    exit;
}

mysqli_stmt_close($stmt_cek);

// Menentukan urutan anggota berikutnya
$sql_urutan = "
    SELECT COALESCE(MAX(urutan), 0) + 1 AS urutan_baru
    FROM dewan
";

$result_urutan = mysqli_query($conn, $sql_urutan);

if (!$result_urutan) {
    header("Location: tambah_dewan.php?error=gagal_simpan");
    exit;
}

$data_urutan = mysqli_fetch_assoc($result_urutan);
$urutan = (int) $data_urutan['urutan_baru'];

// Simpan seluruh data, termasuk nama partai
$sql = "
    INSERT INTO dewan (
        nama,
        jabatan,
        urutan,
        periode,
        nama_pengawas,
        nama_partai,
        keterangan
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
";

$stmt = mysqli_prepare($conn, $sql);

if (!$stmt) {
    header("Location: tambah_dewan.php?error=gagal_simpan");
    exit;
}

mysqli_stmt_bind_param(
    $stmt,
    "ssissss",
    $nama,
    $jabatan,
    $urutan,
    $periode,
    $nama_pengawas,
    $nama_partai,
    $keterangan
);

if (mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);
    header("Location: dewan.php");
    exit;
}

mysqli_stmt_close($stmt);

header("Location: tambah_dewan.php?error=gagal_simpan");
exit;
?>
```