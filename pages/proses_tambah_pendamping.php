<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: /fasilitasi%20penganggaran%20dan%20pengawasan/pages/login.php");
    exit;
}

require_once "../config/database.php";

$nama = trim($_POST['nama'] ?? '');
$jabatan = trim($_POST['jabatan'] ?? '');
$keterangan = trim($_POST['keterangan'] ?? '');

if ($nama === '') {
    echo "Nama pendamping wajib diisi.";
    exit;
}

$sql = "INSERT INTO pendamping
        (nama, jabatan, keterangan)
        VALUES (?, ?, ?)";

$stmt = mysqli_prepare($conn, $sql);

mysqli_stmt_bind_param(
    $stmt,
    "sss",
    $nama,
    $jabatan,
    $keterangan
);

if (mysqli_stmt_execute($stmt)) {

    header("Location: pendamping.php");
    exit;

} else {

    echo "Data gagal disimpan.";

}

?>