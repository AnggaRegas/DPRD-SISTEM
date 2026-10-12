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

$dewan_id =
    intval($_POST['dewan_id'] ?? 0);

$kategori_id =
    intval($_POST['kategori_id'] ?? 0);

$tahun =
    intval($_POST['tahun'] ?? 0);

$nama_folder =
    trim($_POST['nama_folder'] ?? '');


/* =====================================================
   VALIDASI
===================================================== */

if (
    $dewan_id <= 0 ||
    $kategori_id <= 0 ||
    $tahun <= 0 ||
    $nama_folder === ''
) {
    header(
        "Location: dokumen_tahun.php?"
        . "dewan_id=" . $dewan_id
        . "&kategori_id=" . $kategori_id
        . "&tahun=" . $tahun
    );
    exit;
}


/* =====================================================
   CEK FOLDER SUDAH ADA
===================================================== */

$stmt_cek = mysqli_prepare(
    $conn,
    "SELECT id
     FROM folder_dokumen
     WHERE dewan_id = ?
       AND kategori_id = ?
       AND tahun = ?
       AND nama_folder = ?
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt_cek,
    "iiis",
    $dewan_id,
    $kategori_id,
    $tahun,
    $nama_folder
);

mysqli_stmt_execute($stmt_cek);

mysqli_stmt_store_result($stmt_cek);

if (
    mysqli_stmt_num_rows(
        $stmt_cek
    ) > 0
) {

    mysqli_stmt_close($stmt_cek);

    header(
        "Location: dokumen_tahun.php?"
        . "dewan_id=" . $dewan_id
        . "&kategori_id=" . $kategori_id
        . "&tahun=" . $tahun
        . "&error="
        . urlencode(
            "Folder tersebut sudah ada."
        )
    );

    exit;
}

mysqli_stmt_close($stmt_cek);


/* =====================================================
   SIMPAN FOLDER
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "INSERT INTO folder_dokumen
    (
        dewan_id,
        kategori_id,
        tahun,
        nama_folder
    )
    VALUES (?, ?, ?, ?)"
);

mysqli_stmt_bind_param(
    $stmt,
    "iiis",
    $dewan_id,
    $kategori_id,
    $tahun,
    $nama_folder
);


if (
    mysqli_stmt_execute($stmt)
) {

    mysqli_stmt_close($stmt);

    header(
        "Location: dokumen_tahun.php?"
        . "dewan_id=" . $dewan_id
        . "&kategori_id=" . $kategori_id
        . "&tahun=" . $tahun
        . "&success="
        . urlencode(
            "Folder berhasil ditambahkan."
        )
    );

    exit;

}


mysqli_stmt_close($stmt);


header(
    "Location: dokumen_tahun.php?"
    . "dewan_id=" . $dewan_id
    . "&kategori_id=" . $kategori_id
    . "&tahun=" . $tahun
    . "&error="
    . urlencode(
        "Folder gagal ditambahkan."
    )
);

exit;

?>