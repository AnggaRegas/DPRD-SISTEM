<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


/* =====================================================
   AMBIL PARAMETER
===================================================== */

$dewan_id = intval(
    $_GET['dewan_id'] ?? 0
);

$kategori_id = intval(
    $_GET['kategori_id'] ?? 0
);

$tahun = intval(
    $_GET['tahun'] ?? 0
);

$nama_folder = trim(
    $_GET['nama_folder'] ?? ''
);


/* =====================================================
   VALIDASI
===================================================== */

if (
    $dewan_id <= 0 ||
    $kategori_id <= 0 ||
    $tahun <= 0 ||
    $nama_folder === ''
) {
    header("Location: dewan.php");
    exit;
}


/* =====================================================
   AMBIL DATA FILE DALAM FOLDER
===================================================== */

$stmt_files = mysqli_prepare(
    $conn,
    "SELECT
        id,
        nama_file,
        path_file
     FROM dokumen
     WHERE dewan_id = ?
       AND kategori_id = ?
       AND tahun = ?
       AND TRIM(nama_folder) = TRIM(?)"
);

mysqli_stmt_bind_param(
    $stmt_files,
    "iiis",
    $dewan_id,
    $kategori_id,
    $tahun,
    $nama_folder
);

mysqli_stmt_execute($stmt_files);

$result_files = mysqli_stmt_get_result($stmt_files);

$files = [];

while ($row = mysqli_fetch_assoc($result_files)) {

    $files[] = $row;

}

mysqli_stmt_close($stmt_files);


/* =====================================================
   CEK FOLDER
===================================================== */

$stmt_folder = mysqli_prepare(
    $conn,
    "SELECT id
     FROM folder_dokumen
     WHERE dewan_id = ?
       AND kategori_id = ?
       AND tahun = ?
       AND TRIM(nama_folder) = TRIM(?)
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt_folder,
    "iiis",
    $dewan_id,
    $kategori_id,
    $tahun,
    $nama_folder
);

mysqli_stmt_execute($stmt_folder);

$result_folder = mysqli_stmt_get_result($stmt_folder);

$folder = mysqli_fetch_assoc($result_folder);

mysqli_stmt_close($stmt_folder);


if (!$folder) {

    echo "
        <script>
            alert('Folder tidak ditemukan.');
            history.back();
        </script>
    ";

    exit;
}


/* =====================================================
   HAPUS DATABASE
===================================================== */

mysqli_begin_transaction($conn);


try {

    /* -------------------------------------------------
       HAPUS DOKUMEN DALAM FOLDER
    ------------------------------------------------- */

    $stmt_delete_dokumen = mysqli_prepare(
        $conn,
        "DELETE FROM dokumen
         WHERE dewan_id = ?
           AND kategori_id = ?
           AND tahun = ?
           AND TRIM(nama_folder) = TRIM(?)"
    );

    mysqli_stmt_bind_param(
        $stmt_delete_dokumen,
        "iiis",
        $dewan_id,
        $kategori_id,
        $tahun,
        $nama_folder
    );


    if (!mysqli_stmt_execute($stmt_delete_dokumen)) {

        throw new Exception(
            mysqli_stmt_error($stmt_delete_dokumen)
        );

    }


    mysqli_stmt_close($stmt_delete_dokumen);


    /* -------------------------------------------------
       HAPUS FOLDER
    ------------------------------------------------- */

    $stmt_delete_folder = mysqli_prepare(
        $conn,
        "DELETE FROM folder_dokumen
         WHERE dewan_id = ?
           AND kategori_id = ?
           AND tahun = ?
           AND TRIM(nama_folder) = TRIM(?)"
    );

    mysqli_stmt_bind_param(
        $stmt_delete_folder,
        "iiis",
        $dewan_id,
        $kategori_id,
        $tahun,
        $nama_folder
    );


    if (!mysqli_stmt_execute($stmt_delete_folder)) {

        throw new Exception(
            mysqli_stmt_error($stmt_delete_folder)
        );

    }


    mysqli_stmt_close($stmt_delete_folder);


    /* -------------------------------------------------
       COMMIT
    ------------------------------------------------- */

    mysqli_commit($conn);


} catch (Exception $e) {

    mysqli_rollback($conn);

    echo "
        <script>
            alert('Gagal menghapus folder: "
            . htmlspecialchars(
                $e->getMessage(),
                ENT_QUOTES
            )
            . "');
            history.back();
        </script>
    ";

    exit;
}


/* =====================================================
   HAPUS FILE FISIK
===================================================== */

foreach ($files as $file) {

    $nama_file = '';


    if (!empty($file['nama_file'])) {

        $nama_file = basename(
            $file['nama_file']
        );

    } elseif (!empty($file['path_file'])) {

        $nama_file = basename(
            $file['path_file']
        );

    }


    if ($nama_file !== '') {

        $file_path =
            "../uploads/dokumen/"
            . $nama_file;


        if (is_file($file_path)) {

            @unlink($file_path);

        }

    }

}


/* =====================================================
   KEMBALI
===================================================== */

header(
    "Location: dokumen_tahun.php"
    . "?dewan_id=" . $dewan_id
    . "&kategori_id=" . $kategori_id
    . "&tahun=" . $tahun
);

exit;

?>