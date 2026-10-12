<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


$id = intval($_GET['id'] ?? 0);

$dewan_id = intval($_GET['dewan_id'] ?? 0);

$kategori_id = intval(
    $_GET['kategori_id'] ?? 0
);

$tahun = intval(
    $_GET['tahun'] ?? 0
);


if ($id <= 0) {
    header("Location: dewan.php");
    exit;
}


/* =====================================================
   AMBIL DATA DOKUMEN
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "SELECT *
     FROM dokumen
     WHERE id = ?
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt,
    "i",
    $id
);

mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);

$dokumen = mysqli_fetch_assoc($result);

mysqli_stmt_close($stmt);


if (!$dokumen) {
    echo "Dokumen tidak ditemukan.";
    exit;
}


/* =====================================================
   JIKA PARAMETER TIDAK ADA,
   AMBIL DARI DATA DOKUMEN
===================================================== */

if ($dewan_id <= 0) {
    $dewan_id = intval(
        $dokumen['dewan_id']
    );
}

if ($kategori_id <= 0) {
    $kategori_id = intval(
        $dokumen['kategori_id']
    );
}

if ($tahun <= 0) {
    $tahun = intval(
        $dokumen['tahun']
    );
}


/* =====================================================
   HAPUS FILE FISIK
===================================================== */

if (!empty($dokumen['nama_file'])) {

    $file_path =
        "../uploads/dokumen/" .
        $dokumen['nama_file'];

    if (file_exists($file_path)) {
        unlink($file_path);
    }

}


/* =====================================================
   HAPUS DATA DATABASE
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "DELETE FROM dokumen
     WHERE id = ?"
);

mysqli_stmt_bind_param(
    $stmt,
    "i",
    $id
);


if (mysqli_stmt_execute($stmt)) {

    mysqli_stmt_close($stmt);

    header(
        "Location: dokumen_tahun.php" .
        "?dewan_id=" . $dewan_id .
        "&kategori_id=" . $kategori_id .
        "&tahun=" . $tahun
    );

    exit;

}


echo "Dokumen gagal dihapus: " .
     mysqli_error($conn);

?>