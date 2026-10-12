<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


/* =====================================================
   DATA POST
===================================================== */

$dewan_id =
    intval($_POST['dewan_id'] ?? 0);

$kategori_id =
    intval($_POST['kategori_id'] ?? 0);

$tahun_lama =
    intval($_POST['tahun_lama'] ?? 0);

$tahun_baru =
    intval($_POST['tahun_baru'] ?? 0);


/* =====================================================
   URL KEMBALI
===================================================== */

$url_kembali =
    "dokumen_tahun.php"
    . "?dewan_id="
    . $dewan_id
    . "&kategori_id="
    . $kategori_id
    . "&tahun="
    . $tahun_lama;


/* =====================================================
   VALIDASI
===================================================== */

if (
    $dewan_id <= 0 ||
    $kategori_id <= 0 ||
    $tahun_lama <= 0 ||
    $tahun_baru < 1900 ||
    $tahun_baru > 2100
) {

    header(
        "Location: "
        . $url_kembali
        . "&error=tahun_tidak_valid"
    );

    exit;

}


/* =====================================================
   CEK APAKAH TAHUN SAMA
===================================================== */

if ($tahun_lama === $tahun_baru) {

    header(
        "Location: "
        . $url_kembali
        . "&success=tahun_berhasil_diedit"
    );

    exit;

}


/* =====================================================
   CEK DUPLIKAT TAHUN
===================================================== */

$stmt_cek = mysqli_prepare(
    $conn,
    "
    SELECT tahun
    FROM tahun_dokumen
    WHERE dewan_id = ?
      AND kategori_id = ?
      AND tahun = ?
    LIMIT 1
    "
);

mysqli_stmt_bind_param(
    $stmt_cek,
    "iii",
    $dewan_id,
    $kategori_id,
    $tahun_baru
);

mysqli_stmt_execute($stmt_cek);

mysqli_stmt_store_result($stmt_cek);

$ada_tahun_baru =
    mysqli_stmt_num_rows(
        $stmt_cek
    ) > 0;

mysqli_stmt_close($stmt_cek);


/*
 * Jika belum ada di tahun_dokumen,
 * cek juga tabel dokumen.
 */

if (!$ada_tahun_baru) {

    $stmt_cek_dokumen = mysqli_prepare(
        $conn,
        "
        SELECT tahun
        FROM dokumen
        WHERE dewan_id = ?
          AND kategori_id = ?
          AND tahun = ?
        LIMIT 1
        "
    );

    mysqli_stmt_bind_param(
        $stmt_cek_dokumen,
        "iii",
        $dewan_id,
        $kategori_id,
        $tahun_baru
    );

    mysqli_stmt_execute(
        $stmt_cek_dokumen
    );

    mysqli_stmt_store_result(
        $stmt_cek_dokumen
    );

    $ada_tahun_baru =
        mysqli_stmt_num_rows(
            $stmt_cek_dokumen
        ) > 0;

    mysqli_stmt_close(
        $stmt_cek_dokumen
    );

}


if ($ada_tahun_baru) {

    header(
        "Location: "
        . $url_kembali
        . "&error=tahun_double"
    );

    exit;

}


/* =====================================================
   TRANSACTION
===================================================== */

mysqli_begin_transaction($conn);

try {


    /* =================================================
       UPDATE TAHUN_DOKUMEN
    ================================================= */

    $stmt_update_tahun = mysqli_prepare(
        $conn,
        "
        UPDATE tahun_dokumen
        SET tahun = ?
        WHERE dewan_id = ?
          AND kategori_id = ?
          AND tahun = ?
        "
    );

    mysqli_stmt_bind_param(
        $stmt_update_tahun,
        "iiii",
        $tahun_baru,
        $dewan_id,
        $kategori_id,
        $tahun_lama
    );

    if (
        !mysqli_stmt_execute(
            $stmt_update_tahun
        )
    ) {

        throw new Exception(
            "Gagal memperbarui tahun."
        );

    }

    mysqli_stmt_close(
        $stmt_update_tahun
    );


    /* =================================================
       UPDATE DOKUMEN
    ================================================= */

    $stmt_update_dokumen = mysqli_prepare(
        $conn,
        "
        UPDATE dokumen
        SET tahun = ?
        WHERE dewan_id = ?
          AND kategori_id = ?
          AND tahun = ?
        "
    );

    mysqli_stmt_bind_param(
        $stmt_update_dokumen,
        "iiii",
        $tahun_baru,
        $dewan_id,
        $kategori_id,
        $tahun_lama
    );

    if (
        !mysqli_stmt_execute(
            $stmt_update_dokumen
        )
    ) {

        throw new Exception(
            "Gagal memperbarui dokumen."
        );

    }

    mysqli_stmt_close(
        $stmt_update_dokumen
    );


    /* =================================================
       UPDATE FOLDER_DOKUMEN
    ================================================= */

    $stmt_update_folder = mysqli_prepare(
        $conn,
        "
        UPDATE folder_dokumen
        SET tahun = ?
        WHERE dewan_id = ?
          AND kategori_id = ?
          AND tahun = ?
        "
    );

    mysqli_stmt_bind_param(
        $stmt_update_folder,
        "iiii",
        $tahun_baru,
        $dewan_id,
        $kategori_id,
        $tahun_lama
    );

    if (
        !mysqli_stmt_execute(
            $stmt_update_folder
        )
    ) {

        throw new Exception(
            "Gagal memperbarui folder."
        );

    }

    mysqli_stmt_close(
        $stmt_update_folder
    );


    /* =================================================
       COMMIT
    ================================================= */

    mysqli_commit($conn);


    header(
        "Location: dokumen_tahun.php"
        . "?dewan_id="
        . $dewan_id
        . "&kategori_id="
        . $kategori_id
        . "&tahun="
        . $tahun_baru
        . "&success=tahun_berhasil_diedit"
    );

    exit;


} catch (Exception $e) {


    mysqli_rollback($conn);


    header(
        "Location: "
        . $url_kembali
        . "&error=gagal_edit_tahun"
    );

    exit;

}

?>