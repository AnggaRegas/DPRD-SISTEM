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

$id = intval($_POST['id'] ?? 0);

$nama = trim($_POST['nama'] ?? '');

$jabatan = trim($_POST['jabatan'] ?? '');

$periode = trim($_POST['periode'] ?? '');

$nama_pengawas = trim($_POST['nama_pengawas'] ?? '');

$keterangan = trim($_POST['keterangan'] ?? '');


/* =====================================================
   CEK ID
===================================================== */

if ($id <= 0) {

    header("Location: dewan.php");

    exit;

}


/* =====================================================
   CEK DATA WAJIB
===================================================== */

if ($nama === '') {

    header(
        "Location: edit_dewan.php?id="
        . $id
        . "&error=nama_kosong"
    );

    exit;

}


if ($jabatan === '') {

    header(
        "Location: edit_dewan.php?id="
        . $id
        . "&error=jabatan_kosong"
    );

    exit;

}


if ($periode === '') {

    header(
        "Location: edit_dewan.php?id="
        . $id
        . "&error=periode_kosong"
    );

    exit;

}


/* =====================================================
   CEK NAMA DOUBLE
===================================================== */

/*
 * Cari apakah nama tersebut sudah digunakan
 * oleh anggota Dewan LAIN.
 *
 * id != id yang sedang diedit
 */

$cek_sql = "
    SELECT id
    FROM dewan
    WHERE nama = ?
    AND id != ?
    LIMIT 1
";


$cek_stmt = mysqli_prepare(
    $conn,
    $cek_sql
);


mysqli_stmt_bind_param(
    $cek_stmt,
    "si",
    $nama,
    $id
);


mysqli_stmt_execute(
    $cek_stmt
);


mysqli_stmt_store_result(
    $cek_stmt
);


/* =====================================================
   JIKA NAMA DOUBLE
===================================================== */

if (mysqli_stmt_num_rows($cek_stmt) > 0) {

    mysqli_stmt_close($cek_stmt);


    header(
        "Location: edit_dewan.php?id="
        . $id
        . "&error=nama_double"
    );


    exit;

}


mysqli_stmt_close($cek_stmt);


/* =====================================================
   UPDATE DATA
===================================================== */

$sql = "
    UPDATE dewan

    SET
        nama = ?,
        jabatan = ?,
        periode = ?,
        nama_pengawas = ?,
        keterangan = ?

    WHERE id = ?
";


$stmt = mysqli_prepare(
    $conn,
    $sql
);


mysqli_stmt_bind_param(
    $stmt,
    "sssssi",
    $nama,
    $jabatan,
    $periode,
    $nama_pengawas,
    $keterangan,
    $id
);


/* =====================================================
   SIMPAN PERUBAHAN
===================================================== */

if (mysqli_stmt_execute($stmt)) {

    mysqli_stmt_close($stmt);


    header(
        "Location: arsip_dewan.php?id="
        . $id
    );


    exit;

}


/* =====================================================
   JIKA GAGAL
===================================================== */

mysqli_stmt_close($stmt);


header(
    "Location: edit_dewan.php?id="
    . $id
    . "&error=gagal_simpan"
);

exit;

?>