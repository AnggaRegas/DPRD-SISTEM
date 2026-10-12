<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


$id = intval($_GET['id'] ?? 0);
$dewan_id = intval($_GET['dewan_id'] ?? 0);


if ($id <= 0) {
    header("Location: dewan.php");
    exit;
}


/* =====================================================
   CEK JUMLAH DOKUMEN
===================================================== */

$stmt_cek = mysqli_prepare(
    $conn,
    "SELECT COUNT(*) AS jumlah
     FROM dokumen
     WHERE kategori_id = ?"
);

mysqli_stmt_bind_param(
    $stmt_cek,
    "i",
    $id
);

mysqli_stmt_execute($stmt_cek);

$result_cek = mysqli_stmt_get_result($stmt_cek);

$data_cek = mysqli_fetch_assoc($result_cek);

$jumlah_dokumen = intval(
    $data_cek['jumlah']
);


/* =====================================================
   JIKA MASIH ADA DOKUMEN
===================================================== */

if ($jumlah_dokumen > 0) {

    echo "
    <script>
        alert('Kategori tidak dapat dihapus karena masih memiliki dokumen. Hapus atau pindahkan dokumen terlebih dahulu.');
        window.location.href =
            'kategori_dokumen.php?dewan_id={$dewan_id}&kategori_id={$id}';
    </script>
    ";

    exit;
}


/* =====================================================
   HAPUS KATEGORI
===================================================== */

$stmt_hapus = mysqli_prepare(
    $conn,
    "DELETE FROM kategori_dokumen
     WHERE id = ?"
);

mysqli_stmt_bind_param(
    $stmt_hapus,
    "i",
    $id
);


if (mysqli_stmt_execute($stmt_hapus)) {

    echo "
    <script>
        alert('Kategori berhasil dihapus.');
        window.location.href =
            'arsip_dewan.php?id={$dewan_id}';
    </script>
    ";

    exit;

} else {

    echo "
    <script>
        alert('Kategori gagal dihapus.');
        window.history.back();
    </script>
    ";

    exit;
}

?>