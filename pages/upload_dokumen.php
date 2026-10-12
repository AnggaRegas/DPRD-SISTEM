<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: /fasilitasi%20penganggaran%20dan%20pengawasan/pages/login.php");
    exit;
}

require_once "../config/database.php";

$nama_user = $_SESSION['nama'];
$role = $_SESSION['role'];

$dewan_id = isset($_GET['dewan_id'])
    ? intval($_GET['dewan_id'])
    : 0;


/* Ambil data dewan */

$stmt = mysqli_prepare(
    $conn,
    "SELECT id, nama
     FROM dewan
     WHERE id = ?
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt,
    "i",
    $dewan_id
);

mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);

$dewan = mysqli_fetch_assoc($result);

if (!$dewan) {
    echo "Data anggota Dewan tidak ditemukan.";
    exit;
}


/* Ambil kategori */

$query_kategori = mysqli_query(
    $conn,
    "SELECT id, nama_kategori
     FROM kategori_dokumen
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

    <title>
        Upload Dokumen
    </title>

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
            max-width: 750px;
        }

        .form-group {
            margin-bottom: 18px;
        }

        .form-group label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 7px;
        }

        .form-group input,
        .form-group select,
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

        .member-info {
            background: #eff6ff;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }

        .member-info strong {
            color: #1e3a8a;
        }

        .form-actions {
            display: flex;
            gap: 10px;
            margin-top: 25px;
        }

        .btn {
            display: inline-block;
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
            Upload Dokumen
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
                Upload Dokumen
            </h1>

            <p>
                Tambahkan dokumen arsip anggota DPRD.
            </p>

        </div>


        <div class="form-box">


            <div class="member-info">

                Dokumen akan diarsipkan untuk anggota:

                <strong>
                    <?php
                    echo htmlspecialchars(
                        $dewan['nama']
                    );
                    ?>
                </strong>

            </div>


            <form
                action="proses_upload_dokumen.php"
                method="POST"
                enctype="multipart/form-data"
            >


                <input
                    type="hidden"
                    name="dewan_id"
                    value="<?php echo $dewan['id']; ?>"
                >


                <div class="form-group">

                    <label>
                        Nama Dokumen
                    </label>

                    <input
                        type="text"
                        name="nama_dokumen"
                        placeholder="Contoh: Laporan Reses Tahun 2026"
                        required
                    >

                </div>


                <div class="form-group">

                    <label>
                        Kategori Dokumen
                    </label>

                    <select
                        name="kategori_id"
                        required
                    >

                        <option value="">
                            -- Pilih Kategori --
                        </option>


                        <?php while ($kategori = mysqli_fetch_assoc($query_kategori)): ?>

                            <option
                                value="<?php echo $kategori['id']; ?>"
                            >

                                <?php
                                echo htmlspecialchars(
                                    $kategori['nama_kategori']
                                );
                                ?>

                            </option>

                        <?php endwhile; ?>

                    </select>

                </div>


                <div class="form-group">

                    <label>
                        Tahun
                    </label>

                    <input
                        type="number"
                        name="tahun"
                        min="2000"
                        max="2100"
                        value="<?php echo date('Y'); ?>"
                        required
                    >

                </div>


                <div class="form-group">

                    <label>
                        File Dokumen
                    </label>

                    <input
                        type="file"
                        name="file_dokumen"
                        required
                    >

                    <small>
                        Format yang disarankan: PDF, DOC, DOCX, XLS, XLSX.
                    </small>

                </div>


                <div class="form-group">

                    <label>
                        Keterangan
                    </label>

                    <textarea
                        name="keterangan"
                        placeholder="Keterangan tambahan jika diperlukan"
                    ></textarea>

                </div>


                <div class="form-actions">

                    <a
                        href="arsip_dewan.php?id=<?php echo $dewan['id']; ?>"
                        class="btn btn-secondary"
                    >
                        Batal
                    </a>


                    <button
                        type="submit"
                        class="btn btn-primary"
                    >
                        Simpan Dokumen
                    </button>

                </div>


            </form>


        </div>


    </section>


</main>


</body>

</html>