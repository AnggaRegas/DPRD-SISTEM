<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";

$nama = $_SESSION['nama'];
$role = $_SESSION['role'];

?>

<!DOCTYPE html>
<html lang="id">

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Dokumen - Sistem Pengarsipan</title>

    <link rel="stylesheet" href="../assets/css/style.css">

</head>

<body>


<!-- SIDEBAR -->

<aside class="sidebar">

    <div class="logo">

        <h2>
            Sistem Pengarsipan
        </h2>

        <p>
            Fasilitasi Penganggaran dan Pengawasan
        </p>

    </div>


    <div class="menu">

        <div class="menu-title">
            Menu Utama
        </div>

        <a href="dashboard.php">
            🏠 Dashboard
        </a>

        <a href="dewan.php">
            👤 Anggota Dewan
        </a>


        <div class="menu-title">
            Pengarsipan
        </div>

        <a href="dokumen.php" class="active">
            📁 Dokumen
        </a>


        <div class="menu-title">
            Sistem
        </div>

        <a href="logout.php">
            🚪 Keluar
        </a>

    </div>

</aside>


<!-- MAIN -->

<main class="main-content">


    <!-- TOPBAR -->

    <header class="topbar">

        <div class="topbar-title">
            Dokumen
        </div>


        <div class="user-info">

            <div class="user-avatar">

                <?php
                echo strtoupper(substr($nama, 0, 1));
                ?>

            </div>


            <div class="user-text">

                <strong>
                    <?php echo htmlspecialchars($nama); ?>
                </strong>

                <span>
                    <?php echo htmlspecialchars($role); ?>
                </span>

            </div>

        </div>

    </header>


    <!-- PAGE -->

    <section class="page">


        <div class="page-header">

            <h1>
                Arsip Dokumen
            </h1>

            <p>
                Kelola dokumen yang berkaitan dengan anggota Dewan.
            </p>

        </div>


        <div class="content-box">

            <h3>
                Arsip Dokumen
            </h3>

            <p>
                Halaman pengarsipan dokumen Bagian Fasilitasi
                Penganggaran dan Pengawasan.
            </p>

        </div>


    </section>


</main>


</body>

</html>