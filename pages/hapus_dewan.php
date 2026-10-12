<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


$id = intval(
    $_GET['id'] ?? 0
);


if ($id <= 0) {
    header("Location: dewan.php");
    exit;
}


/* =====================================================
   AMBIL SEMUA FILE DOKUMEN
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "SELECT nama_file, path_file
     FROM dokumen
     WHERE dewan_id = ?"
);

mysqli_stmt_bind_param(
    $stmt,
    "i",
    $id
);

mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);


/* =====================================================
   SIMPAN DATA FILE UNTUK DIHAPUS
===================================================== */

$files = [];

while (
    $dokumen = mysqli_fetch_assoc($result)
) {

    $files[] = $dokumen;

}


/* =====================================================
   HAPUS DOKUMEN DARI DATABASE
===================================================== */

$stmt_delete_dokumen = mysqli_prepare(
    $conn,
    "DELETE FROM dokumen
     WHERE dewan_id = ?"
);

mysqli_stmt_bind_param(
    $stmt_delete_dokumen,
    "i",
    $id
);


if (
    !mysqli_stmt_execute(
        $stmt_delete_dokumen
    )
) {

    echo "Dokumen anggota Dewan gagal dihapus: " .
        mysqli_error($conn);

    exit;
}


/* =====================================================
   HAPUS ANGGOTA DEWAN
===================================================== */

$stmt_delete_dewan = mysqli_prepare(
    $conn,
    "DELETE FROM dewan
     WHERE id = ?"
);

mysqli_stmt_bind_param(
    $stmt_delete_dewan,
    "i",
    $id
);


if (
    mysqli_stmt_execute(
        $stmt_delete_dewan
    )
) {


    /* =============================================
       HAPUS FILE FISIK
    ============================================= */

    foreach (
        $files as $file
    ) {

        if (
            !empty(
                $file['nama_file']
            )
        ) {

            $file_path =
                "../uploads/dokumen/" .
                $file['nama_file'];

            if (
                file_exists($file_path)
            ) {

                unlink($file_path);

            }

        }

    }


    header(
        "Location: dewan.php"
    );

    exit;

} else {

    echo "Anggota Dewan gagal dihapus: " .
        mysqli_error($conn);

}

?>