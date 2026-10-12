<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: /fasilitasi%20penganggaran%20dan%20pengawasan/pages/login.php");
    exit;
}

$nama_user = $_SESSION['nama'];
$role = $_SESSION['role'];

?>

<!DOCTYPE html>
<html lang="id">

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Tambah Pendamping</title>

    <link
        rel="stylesheet"
        href="../assets/css/style.css"
    >

    <style>

        .form-box {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 25px;
            max-width: 700px;
        }

        .form-group {
            margin-bottom: 18px;
        }

        .form-group label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 7px;
        }

        .form-group input,
        .form-group textarea {
            width: 100%;
            box-sizing: border-box;
            padding: 11px 13px;
            border: 1px solid #d1d5db;
            border-radius: 7px;
            font-size: 14px;
        }

        .form-group textarea {
            min-height: 100px;
            resize: vertical;
        }

        .form-actions {
            display: flex;
            gap: 10px;
            margin-top: 25px;
        }

        .btn {
            padding: 11px 17px;
            border-radius: 7px;
            text-decoration: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }

        .btn-primary {
            background: #1e3a8a;
            color: white;
        }

        .btn-secondary {
            background: #e5e7eb;
            color: #374151;
        }

    </style>

</head>

<body>

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

            <a href="pendamping.php" class="active">
                👥 Pendamping / Pengawas
            </a>

            <div class="menu-title">
                Pengarsipan
            </div>

            <a href="dokumen.php">
                📁 Dokumen
            </a>

            <a href="kategori.php">
                🗂 Kategori Dokumen
            </a>

            <div class="menu-title">
                Sistem
            </div>

            <a href="logout.php">
                🚪 Keluar
            </a>

        </div>

    </aside>


    <main class="main-content">

        <header class="topbar">

            <div class="topbar-title">
                Tambah Pendamping / Pengawas
            </div>

            <div class="user-info">

                <div class="user-avatar">
                    <?php
                    echo strtoupper(
                        substr($nama_user, 0, 1)
                    );
                    ?>
                </div>

                <div class="user-text">

                    <strong>
                        <?php
                        echo htmlspecialchars($nama_user);
                        ?>
                    </strong>

                    <?php
                    echo htmlspecialchars($role);
                    ?>

                </div>

            </div>

        </header>


        <section class="page">

            <div class="page-header">

                <h1>
                    Tambah Pendamping / Pengawas
                </h1>

                <p>
                    Masukkan data pendamping atau pengawas.
                </p>

            </div>


            <div class="form-box">

                <form
                    action="proses_tambah_pendamping.php"
                    method="POST"
                >

                    <div class="form-group">

                        <label>
                            Nama Pendamping / Pengawas
                        </label>

                        <input
                            type="text"
                            name="nama"
                            placeholder="Masukkan nama"
                            required
                        >

                    </div>


                    <div class="form-group">

                        <label>
                            Jabatan
                        </label>

                        <input
                            type="text"
                            name="jabatan"
                            placeholder="Masukkan jabatan"
                        >

                    </div>


                    <div class="form-group">

                        <label>
                            Keterangan
                        </label>

                        <textarea
                            name="keterangan"
                            placeholder="Keterangan tambahan"
                        ></textarea>

                    </div>


                    <div class="form-actions">

                        <a
                            href="pendamping.php"
                            class="btn btn-secondary"
                        >
                            Batal
                        </a>

                        <button
                            type="submit"
                            class="btn btn-primary"
                        >
                            Simpan Data
                        </button>

                    </div>

                </form>

            </div>

        </section>

    </main>

</body>

</html>