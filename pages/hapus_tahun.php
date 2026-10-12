<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


/* =====================================================
   PARAMETER
===================================================== */

$dewan_id =
    intval($_GET['dewan_id'] ?? 0);

$kategori_id =
    intval($_GET['kategori_id'] ?? 0);

$tahun =
    intval($_GET['tahun'] ?? 0);


/* =====================================================
   URL KEMBALI
===================================================== */

$url_kategori =
    "kategori_dokumen.php"
    . "?dewan_id="
    . $dewan_id
    . "&kategori_id="
    . $kategori_id;


/* =====================================================
   VALIDASI
===================================================== */

if (
    $dewan_id <= 0 ||
    $kategori_id <= 0 ||
    $tahun <= 0
) {

    header(
        "Location: dewan.php"
    );

    exit;

}


/* =====================================================
   AMBIL FILE DOKUMEN
===================================================== */

$files_to_delete = [];


$stmt_file = mysqli_prepare(
    $conn,
    "
    SELECT
        nama_file,
        path_file
    FROM dokumen
    WHERE dewan_id = ?
      AND kategori_id = ?
      AND tahun = ?
    "
);

mysqli_stmt_bind_param(
    $stmt_file,
    "iii",
    $dewan_id,
    $kategori_id,
    $tahun
);

mysqli_stmt_execute($stmt_file);

$result_file =
    mysqli_stmt_get_result(
        $stmt_file
    );


while (
    $file =
    mysqli_fetch_assoc(
        $result_file
    )
) {

    if (!empty($file['path_file'])) {

        $files_to_delete[] =
            $file['path_file'];

    } elseif (!empty($file['nama_file'])) {

        $files_to_delete[] =
            "uploads/dokumen/"
            . $file['nama_file'];

    }

}


mysqli_stmt_close($stmt_file);


/* =====================================================
   TRANSACTION
===================================================== */

mysqli_begin_transaction($conn);

try {


    /* =================================================
       HAPUS DOKUMEN
    ================================================= */

    $stmt_dokumen = mysqli_prepare(
        $conn,
        "
        DELETE FROM dokumen
        WHERE dewan_id = ?
          AND kategori_id = ?
          AND tahun = ?
        "
    );

    mysqli_stmt_bind_param(
        $stmt_dokumen,
        "iii",
        $dewan_id,
        $kategori_id,
        $tahun
    );

    if (
        !mysqli_stmt_execute(
            $stmt_dokumen
        )
    ) {

        throw new Exception(
            "Gagal menghapus dokumen."
        );

    }

    mysqli_stmt_close(
        $stmt_dokumen
    );


    /* =================================================
       HAPUS FOLDER DOKUMEN
    ================================================= */

    $stmt_folder = mysqli_prepare(
        $conn,
        "
        DELETE FROM folder_dokumen
        WHERE dewan_id = ?
          AND kategori_id = ?
          AND tahun = ?
        "
    );

    mysqli_stmt_bind_param(
        $stmt_folder,
        "iii",
        $dewan_id,
        $kategori_id,
        $tahun
    );

    if (
        !mysqli_stmt_execute(
            $stmt_folder
        )
    ) {

        throw new Exception(
            "Gagal menghapus folder."
        );

    }

    mysqli_stmt_close(
        $stmt_folder
    );


    /* =================================================
       HAPUS TAHUN
    ================================================= */

    $stmt_tahun = mysqli_prepare(
        $conn,
        "
        DELETE FROM tahun_dokumen
        WHERE dewan_id = ?
          AND kategori_id = ?
          AND tahun = ?
        "
    );

    mysqli_stmt_bind_param(
        $stmt_tahun,
        "iii",
        $dewan_id,
        $kategori_id,
        $tahun
    );

    if (
        !mysqli_stmt_execute(
            $stmt_tahun
        )
    ) {

        throw new Exception(
            "Gagal menghapus tahun."
        );

    }

    mysqli_stmt_close(
        $stmt_tahun
    );


    /* =================================================
       COMMIT
    ================================================= */

    mysqli_commit($conn);


    /* =================================================
       HAPUS FILE FISIK
    ================================================= */

    foreach (
        $files_to_delete
        as $relative_path
    ) {


        /*
         * Hanya izinkan file yang berada
         * di dalam uploads/dokumen.
         */

        $relative_path =
            str_replace(
                "\\",
                "/",
                $relative_path
            );


        $relative_path =
            ltrim(
                $relative_path,
                "/"
            );


        if (
            strpos(
                $relative_path,
                "uploads/dokumen/"
            ) !== 0
        ) {

            continue;

        }


        $full_path =
            realpath(
                __DIR__
                . "/../"
                . $relative_path
            );


        $upload_folder =
            realpath(
                __DIR__
                . "/../uploads/dokumen"
            );


        if (
            $full_path &&
            $upload_folder &&
            strpos(
                $full_path,
                $upload_folder
            ) === 0 &&
            is_file($full_path)
        ) {

            @unlink(
                $full_path
            );

        }

    }


    /* =================================================
       KEMBALI
    ================================================= */

    header(
        "Location: "
        . $url_kategori
        . "&success=tahun_berhasil_dihapus"
    );

    exit;


} catch (Exception $e) {


    mysqli_rollback($conn);


    header(
        "Location: dokumen_tahun.php"
        . "?dewan_id="
        . $dewan_id
        . "&kategori_id="
        . $kategori_id
        . "&tahun="
        . $tahun
        . "&error=gagal_hapus_tahun"
    );

    exit;

}

?>