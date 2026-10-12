<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


$id = intval($_POST['id'] ?? 0);
$dewan_id = intval($_POST['dewan_id'] ?? 0);

$nama_kategori = trim(
    $_POST['nama_kategori'] ?? ''
);


if ($id <= 0 || $dewan_id <= 0) {
    echo "Data tidak valid.";
    exit;
}


if ($nama_kategori === '') {
    echo "Nama kategori wajib diisi.";
    exit;
}


/* =====================================================
   CEK KATEGORI
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "SELECT id
     FROM kategori_dokumen
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

if (!mysqli_fetch_assoc($result)) {
    echo "Kategori tidak ditemukan.";
    exit;
}


/* =====================================================
   CEK NAMA KATEGORI DUPLIKAT
===================================================== */

$stmt_cek = mysqli_prepare(
    $conn,
    "SELECT id
     FROM kategori_dokumen
     WHERE nama_kategori = ?
     AND id != ?
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt_cek,
    "si",
    $nama_kategori,
    $id
);

mysqli_stmt_execute($stmt_cek);

$result_cek = mysqli_stmt_get_result($stmt_cek);

if (mysqli_num_rows($result_cek) > 0) {
    echo "Nama kategori tersebut sudah digunakan.";
    exit;
}


/* =====================================================
   UPDATE
===================================================== */

$stmt_update = mysqli_prepare(
    $conn,
    "UPDATE kategori_dokumen
     SET nama_kategori = ?
     WHERE id = ?"
);

mysqli_stmt_bind_param(
    $stmt_update,
    "si",
    $nama_kategori,
    $id
);


if (mysqli_stmt_execute($stmt_update)) {

    header(
        "Location: kategori_dokumen.php?dewan_id=" .
        $dewan_id .
        "&kategori_id=" .
        $id
    );

    exit;

} else {

    echo "Kategori gagal diperbarui: " .
        mysqli_error($conn);

}

?>