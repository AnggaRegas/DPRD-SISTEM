<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


$dewan_id = intval($_POST['dewan_id'] ?? 0);

$nama_kategori = trim(
    $_POST['nama_kategori'] ?? ''
);


if ($dewan_id <= 0) {
    echo "Anggota Dewan tidak valid.";
    exit;
}


if ($nama_kategori === '') {
    echo "Nama kategori wajib diisi.";
    exit;
}


/* =====================================================
   CEK APAKAH KATEGORI SUDAH ADA
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "SELECT id
     FROM kategori_dokumen
     WHERE LOWER(nama_kategori) = LOWER(?)
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt,
    "s",
    $nama_kategori
);

mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);

if (mysqli_num_rows($result) > 0) {

    mysqli_stmt_close($stmt);

    echo "Kategori tersebut sudah tersedia.";
    exit;
}

mysqli_stmt_close($stmt);


/* =====================================================
   SIMPAN KATEGORI
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "INSERT INTO kategori_dokumen
        (nama_kategori)
     VALUES (?)"
);

mysqli_stmt_bind_param(
    $stmt,
    "s",
    $nama_kategori
);


if (mysqli_stmt_execute($stmt)) {

    mysqli_stmt_close($stmt);

    header(
        "Location: arsip_dewan.php?id=" . $dewan_id
    );

    exit;

}


echo "Kategori gagal disimpan: " .
     mysqli_error($conn);

?>