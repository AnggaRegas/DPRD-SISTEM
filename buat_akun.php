<?php

require_once "config/database.php";

/* =========================
   AKUN STAFF
========================= */

$nama_staff = "Staff Pengarsipan";
$username_staff = "staff";
$password_staff = password_hash("staff123", PASSWORD_DEFAULT);
$role_staff = "staff";

$sql_staff = "INSERT INTO users (nama, username, password, role)
              VALUES (?, ?, ?, ?)";

$stmt_staff = mysqli_prepare($conn, $sql_staff);

mysqli_stmt_bind_param(
    $stmt_staff,
    "ssss",
    $nama_staff,
    $username_staff,
    $password_staff,
    $role_staff
);

$staff_berhasil = mysqli_stmt_execute($stmt_staff);


/* =========================
   AKUN KEPALA BAGIAN
========================= */

$nama_kabag = "Kepala Bagian";
$username_kabag = "kabag";
$password_kabag = password_hash("kabag123", PASSWORD_DEFAULT);
$role_kabag = "kepala_bagian";

$sql_kabag = "INSERT INTO users (nama, username, password, role)
              VALUES (?, ?, ?, ?)";

$stmt_kabag = mysqli_prepare($conn, $sql_kabag);

mysqli_stmt_bind_param(
    $stmt_kabag,
    "ssss",
    $nama_kabag,
    $username_kabag,
    $password_kabag,
    $role_kabag
);

$kabag_berhasil = mysqli_stmt_execute($stmt_kabag);


/* =========================
   HASIL
========================= */

if ($staff_berhasil && $kabag_berhasil) {

    echo "<h2>Akun berhasil dibuat!</h2>";

    echo "<p>Staff: <b>staff</b> / <b>staff123</b></p>";
    echo "<p>Kepala Bagian: <b>kabag</b> / <b>kabag123</b></p>";

} else {

    echo "Terjadi kesalahan saat membuat akun.";

}

?>