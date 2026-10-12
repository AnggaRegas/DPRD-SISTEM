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

$dewan_id = intval(
    $_POST['dewan_id'] ?? 0
);

$kategori_id = intval(
    $_POST['kategori_id'] ?? 0
);

$tahun = intval(
    $_POST['tahun'] ?? 0
);

$nama_folder_lama = trim(
    $_POST['nama_folder_lama'] ?? ''
);

$nama_folder_baru = trim(
    $_POST['nama_folder'] ?? ''
);


/* =====================================================
   VALIDASI
===================================================== */

if (
    $dewan_id <= 0 ||
    $kategori_id <= 0 ||
    $tahun <= 0 ||
    $nama_folder_lama === '' ||
    $nama_folder_baru === ''
) {
    echo "Data folder tidak lengkap.";
    exit;
}


/* =====================================================
   CEK NAMA FOLDER BARU
===================================================== */

$stmt_cek = mysqli_prepare(
    $conn,
    "SELECT id
     FROM folder_dokumen
     WHERE dewan_id = ?
       AND kategori_id = ?
       AND tahun = ?
       AND TRIM(nama_folder) = TRIM(?)
       AND TRIM(nama_folder) <> TRIM(?)
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt_cek,
    "iiiss",
    $dewan_id,
    $kategori_id,
    $tahun,
    $nama_folder_baru,
    $nama_folder_lama
);

mysqli_stmt_execute($stmt_cek);

$result_cek = mysqli_stmt_get_result($stmt_cek);

$folder_cek = mysqli_fetch_assoc($result_cek);

mysqli_stmt_close($stmt_cek);


if ($folder_cek) {

    echo "
        <script>
            alert('Nama folder tersebut sudah digunakan.');
            history.back();
        </script>
    ";

    exit;
}


/* =====================================================
   CEK FOLDER LAMA
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
    $nama_folder_lama
);

mysqli_stmt_execute($stmt_folder);

$result_folder = mysqli_stmt_get_result($stmt_folder);

$folder_lama = mysqli_fetch_assoc($result_folder);

mysqli_stmt_close($stmt_folder);


if (!$folder_lama) {

    echo "
        <script>
            alert('Folder tidak ditemukan.');
            history.back();
        </script>
    ";

    exit;
}


/* =====================================================
   UPDATE NAMA FOLDER
===================================================== */

mysqli_begin_transaction($conn);


try {

    /* -------------------------------------------------
       UPDATE TABEL folder_dokumen
    ------------------------------------------------- */

    $stmt_update_folder = mysqli_prepare(
        $conn,
        "UPDATE folder_dokumen
         SET nama_folder = ?
         WHERE dewan_id = ?
           AND kategori_id = ?
           AND tahun = ?
           AND TRIM(nama_folder) = TRIM(?)"
    );

    mysqli_stmt_bind_param(
        $stmt_update_folder,
        "siiis",
        $nama_folder_baru,
        $dewan_id,
        $kategori_id,
        $tahun,
        $nama_folder_lama
    );


    if (!mysqli_stmt_execute($stmt_update_folder)) {

        throw new Exception(
            mysqli_stmt_error($stmt_update_folder)
        );

    }


    mysqli_stmt_close($stmt_update_folder);


    /* -------------------------------------------------
       UPDATE NAMA FOLDER PADA DOKUMEN YANG ADA
    ------------------------------------------------- */

    $stmt_update_dokumen = mysqli_prepare(
        $conn,
        "UPDATE dokumen
         SET nama_folder = ?
         WHERE dewan_id = ?
           AND kategori_id = ?
           AND tahun = ?
           AND TRIM(nama_folder) = TRIM(?)"
    );

    mysqli_stmt_bind_param(
        $stmt_update_dokumen,
        "siiis",
        $nama_folder_baru,
        $dewan_id,
        $kategori_id,
        $tahun,
        $nama_folder_lama
    );


    if (!mysqli_stmt_execute($stmt_update_dokumen)) {

        throw new Exception(
            mysqli_stmt_error($stmt_update_dokumen)
        );

    }


    mysqli_stmt_close($stmt_update_dokumen);


    /* -------------------------------------------------
       COMMIT
    ------------------------------------------------- */

    mysqli_commit($conn);


} catch (Exception $e) {

    mysqli_rollback($conn);

    echo "
        <script>
            alert('Gagal mengubah nama folder: "
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