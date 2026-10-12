<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: /fasilitasi%20penganggaran%20dan%20pengawasan/pages/login.php");
    exit;
}

require_once "../config/database.php";

$nama_user = $_SESSION['nama'];
$role = $_SESSION['role'];

$query = mysqli_query(
    $conn,
    "SELECT * FROM pendamping ORDER BY nama ASC"
);

?>

<!DOCTYPE html>
<html lang="id">

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Pendamping / Pengawas</title>

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
            padding: 11px 16px;
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

        .btn-danger {
            background: #dc2626;
            color: white;
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
            padding: 15px;
            border-bottom: 1px solid #e5e7eb;
        }

        td {
            padding: 15px;
            font-size: 14px;
            border-bottom: 1px solid #f1f5f9;
        }

        .nama-pendamping {
            font-weight: 600;
            color: #1e3a8a;
        }

        .empty-data {
            text-align: center;
            padding: 50px;
            color: #64748b;
        }

        .aksi {
            display: flex;
            gap: 8px;
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


    <!-- MAIN -->

    <main class="main-content">

        <header class="topbar">

            <div class="topbar-title">
                Pendamping / Pengawas
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
                    Pendamping / Pengawas
                </h1>

                <p>
                    Kelola data pendamping atau pengawas anggota Dewan.
                </p>

            </div>


            <div class="toolbar">

                <div></div>

                <a
                    href="tambah_pendamping.php"
                    class="btn btn-primary"
                >
                    + Tambah Pendamping
                </a>

            </div>


            <div class="table-box">

                <?php if (mysqli_num_rows($query) > 0) { ?>

                    <table>

                        <thead>

                            <tr>

                                <th width="7%">
                                    No
                                </th>

                                <th>
                                    Nama Pendamping / Pengawas
                                </th>

                                <th>
                                    Jabatan
                                </th>

                                <th>
                                    Keterangan
                                </th>

                                <th width="15%">
                                    Aksi
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            <?php

                            $no = 1;

                            while (
                                $row = mysqli_fetch_assoc($query)
                            ) {

                            ?>

                                <tr>

                                    <td>
                                        <?php echo $no++; ?>
                                    </td>

                                    <td>

                                        <div class="nama-pendamping">

                                            <?php
                                            echo htmlspecialchars(
                                                $row['nama']
                                            );
                                            ?>

                                        </div>

                                    </td>

                                    <td>

                                        <?php
                                        echo htmlspecialchars(
                                            $row['jabatan'] ?: '-'
                                        );
                                        ?>

                                    </td>

                                    <td>

                                        <?php
                                        echo htmlspecialchars(
                                            $row['keterangan'] ?: '-'
                                        );
                                        ?>

                                    </td>

                                    <td>

                                        <div class="aksi">

                                            <a
                                                href="hapus_pendamping.php?id=<?php echo $row['id']; ?>"
                                                class="btn btn-danger"
                                                onclick="return confirm('Yakin ingin menghapus data ini?');"
                                            >
                                                Hapus
                                            </a>

                                        </div>

                                    </td>

                                </tr>

                            <?php

                            }

                            ?>

                        </tbody>

                    </table>

                <?php } else { ?>

                    <div class="empty-data">

                        <div style="font-size:40px;">
                            👥
                        </div>

                        <strong>
                            Belum ada data pendamping/pengawas
                        </strong>

                        <p>
                            Silakan tambahkan data pendamping atau pengawas.
                        </p>

                    </div>

                <?php } ?>

            </div>


        </section>

    </main>

</body>

</html>