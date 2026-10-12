<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


/* =====================================================
   AMBIL DATA FORM
===================================================== */

$nama = trim($_POST['nama'] ?? '');
$jabatan = trim($_POST['jabatan'] ?? '');
$periode = trim($_POST['periode'] ?? '');
$nama_pengawas = trim($_POST['nama_pengawas'] ?? '');
$keterangan = trim($_POST['keterangan'] ?? '');


/* =====================================================
   CEK DATA WAJIB
===================================================== */

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


/* =====================================================
   CEK NAMA DEWAN SUDAH ADA ATAU BELUM
===================================================== */

$cek_sql = "
    SELECT id
    FROM dewan
    WHERE nama = ?
    LIMIT 1
";

$cek_stmt = mysqli_prepare(
    $conn,
    $cek_sql
);

mysqli_stmt_bind_param(
    $cek_stmt,
    "s",
    $nama
);

mysqli_stmt_execute($cek_stmt);

mysqli_stmt_store_result($cek_stmt);


if (mysqli_stmt_num_rows($cek_stmt) > 0) {

    mysqli_stmt_close($cek_stmt);

    header("Location: tambah_dewan.php?error=nama_double");
    exit;

}


mysqli_stmt_close($cek_stmt);


/* =====================================================
   TENTUKAN URUTAN
===================================================== */

$urutan_sql = "
    SELECT COALESCE(MAX(urutan), 0) + 1 AS urutan_baru
    FROM dewan
";

$urutan_result = mysqli_query(
    $conn,
    $urutan_sql
);

$urutan_data = mysqli_fetch_assoc(
    $urutan_result
);

$urutan = (int) $urutan_data['urutan_baru'];


/* =====================================================
   SIMPAN DATA
===================================================== */

$sql = "
    INSERT INTO dewan
    (
        nama,
        jabatan,
        urutan,
        periode,
        nama_pengawas,
        keterangan
    )
    VALUES (?, ?, ?, ?, ?, ?)
";

$stmt = mysqli_prepare(
    $conn,
    $sql
);

mysqli_stmt_bind_param(
    $stmt,
    "ssisss",
    $nama,
    $jabatan,
    $urutan,
    $periode,
    $nama_pengawas,
    $keterangan
);


/* =====================================================
   HASIL SIMPAN
===================================================== */

if (mysqli_stmt_execute($stmt)) {

    mysqli_stmt_close($stmt);

    header("Location: dewan.php");
    exit;

} else {

    mysqli_stmt_close($stmt);

    header("Location: tambah_dewan.php?error=gagal_simpan");
    exit;

}

?>