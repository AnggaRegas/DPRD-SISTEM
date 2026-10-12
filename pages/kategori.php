<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";

$nama_user = $_SESSION['nama'];
$role = $_SESSION['role'];

/* Ambil data kategori */

$query = mysqli_query(
    $conn,
    "SELECT * FROM kategori_dokumen
     ORDER BY nama_kategori ASC"
);

?>

<!DOCTYPE html>
<html lang="id">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Kategori Dokumen - Sistem Pengarsipan</title>

    <link
        rel="stylesheet"
        href="../assets/css/style.css"
    >

    <style>

        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .btn {
            display: inline-block;
            padding: 10px 15px;
            border-radius: 7px;
            text-decoration: none;
            border: none;
            cursor: pointer;
            font-size: 13px;
        }

        .btn-primary {
            background: #1e3a8a;
            color: white;
        }

        .btn-primary:hover {
            background: #1d4ed8;
        }

        .table-box {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            overflow: hidden;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th {
            background: #f8fafc;
            text-align: left;
            font-size: 13px;
            color: #475569;
            padding: 14px;
            border-bottom: 1px solid #e5e7eb;
        }

        td {
            padding: 14px;
            font-size: 14px;
            border-bottom: 1px solid #f1f5f9;
        }

        tr:last-child td {
            border-bottom: none;
        }

        .empty-data {
            text-align: center;
            padding: 50px;
            color: #64748b;
        }

    </style>

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

        <a href="dokumen.php">
            📁 Arsip Dokumen
        </a>

        <a href="kategori.php" class="active">
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


<!-- MAIN -->

<main class="main-content">


    <!-- TOPBAR -->

    <header class="topbar">

        <div class="topbar-title">
            Kategori Dokumen
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


    <!-- PAGE -->

    <section class="page">


        <div class="page-header">

            <h1>
                Kategori Dokumen
            </h1>

            <p>
                Kelola kategori dokumen yang digunakan dalam pengarsipan anggota DPRD.
            </p>

        </div>


        <!-- TOOLBAR -->

        <div class="toolbar">

            <div></div>

            <a
                href="tambah_kategori.php"
                class="btn btn-primary"
            >
                + Tambah Kategori
            </a>

        </div>


        <!-- TABLE -->

        <div class="table-box">

            <?php if (mysqli_num_rows($query) > 0): ?>

                <table>

                    <thead>

                        <tr>

                            <th width="8%">
                                No
                            </th>

                            <th>
                                Nama Kategori
                            </th>

                            <th>
                                Keterangan
                            </th>

                            <th width="20%">
                                Aksi
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        <?php

                        $no = 1;

                        while ($row = mysqli_fetch_assoc($query)):

                        ?>

                            <tr>

                                <td>
                                    <?php echo $no++; ?>
                                </td>


                                <td>

                                    <strong>
                                        <?php
                                        echo htmlspecialchars(
                                            $row['nama_kategori']
                                        );
                                        ?>
                                    </strong>

                                </td>


                                <td>

                                    <?php
                                    echo !empty($row['keterangan'])
                                        ? htmlspecialchars($row['keterangan'])
                                        : '-';
                                    ?>

                                </td>


                                <td>

                                    <a
                                        href="edit_kategori.php?id=<?php echo $row['id']; ?>"
                                    >
                                        Edit
                                    </a>

                                    &nbsp; | &nbsp;

                                    <a
                                        href="hapus_kategori.php?id=<?php echo $row['id']; ?>"
                                        onclick="return confirm('Yakin ingin menghapus kategori ini?')"
                                    >
                                        Hapus
                                    </a>

                                </td>

                            </tr>

                        <?php endwhile; ?>

                    </tbody>

                </table>

            <?php else: ?>

                <div class="empty-data">

                    <div style="font-size: 40px;">
                        🗂
                    </div>

                    <strong>
                        Belum ada kategori dokumen
                    </strong>

                    <p>
                        Silakan tambahkan kategori dokumen terlebih dahulu.
                    </p>

                </div>

            <?php endif; ?>

        </div>


    </section>

</main>


</body>

</html>