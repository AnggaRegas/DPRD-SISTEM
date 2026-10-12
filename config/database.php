<?php

$host = "127.0.0.1";
$user = "root";
$password = "";
$database = "fasilitasi penganggaran dan pengawasan";
$port = 3307;

$conn = mysqli_connect($host, $user, $password, $database, $port);

if (!$conn) {
    die("Koneksi database gagal: " . mysqli_connect_error());
}

?>