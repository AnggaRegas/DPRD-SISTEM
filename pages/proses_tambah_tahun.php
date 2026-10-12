<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


/* =====================================================
   AMBIL DATA
===================================================== */

$dewan_id = intval($_POST['dewan_id'] ?? 0);

$kategori_id = intval($_POST['kategori_id'] ?? 0);

$tahun = intval($_POST['tahun'] ?? 0);


/* =====================================================
   VALIDASI
===================================================== */

if ($dewan_id <= 0 || $kategori_id <= 0) {

    header("Location: dewan.php");

    exit;

}


if ($tahun < 1900 || $tahun > 2100) {

    header(
        "Location: kategori_dokumen.php"
        . "?dewan_id=" . $dewan_id
        . "&kategori_id=" . $kategori_id
        . "&error=tahun_tidak_valid"
    );

    exit;

}


/* =====================================================
   CEK TAHUN SUDAH ADA
===================================================== */

$cek_sql = "
    SELECT id
    FROM tahun_dokumen
    WHERE dewan_id = ?
    AND kategori_id = ?
    AND tahun = ?
    LIMIT 1
";

$cek_stmt = mysqli_prepare(
    $conn,
    $cek_sql
);

mysqli_stmt_bind_param(
    $cek_stmt,
    "iii",
    $dewan_id,
    $kategori_id,
    $tahun
);

mysqli_stmt_execute($cek_stmt);

mysqli_stmt_store_result($cek_stmt);


if (mysqli_stmt_num_rows($cek_stmt) > 0) {

    mysqli_stmt_close($cek_stmt);

    header(
        "Location: kategori_dokumen.php"
        . "?dewan_id=" . $dewan_id
        . "&kategori_id=" . $kategori_id
        . "&error=tahun_double"
    );

    exit;

}


mysqli_stmt_close($cek_stmt);


/* =====================================================
   SIMPAN TAHUN
===================================================== */

$sql = "
    INSERT INTO tahun_dokumen
    (
        dewan_id,
        kategori_id,
        tahun
    )
    VALUES (?, ?, ?)
";

$stmt = mysqli_prepare(
    $conn,
    $sql
);

mysqli_stmt_bind_param(
    $stmt,
    "iii",
    $dewan_id,
    $kategori_id,
    $tahun
);


if (mysqli_stmt_execute($stmt)) {

    mysqli_stmt_close($stmt);

    header(
        "Location: kategori_dokumen.php"
        . "?dewan_id=" . $dewan_id
        . "&kategori_id=" . $kategori_id
        . "&success=tahun_berhasil"
    );

    exit;

}


/* =====================================================
   GAGAL
===================================================== */

mysqli_stmt_close($stmt);

header(
    "Location: kategori_dokumen.php"
    . "?dewan_id=" . $dewan_id
    . "&kategori_id=" . $kategori_id
    . "&error=gagal_tambah_tahun"
);

exit;

?>