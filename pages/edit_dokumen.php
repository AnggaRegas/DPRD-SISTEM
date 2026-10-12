<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";

$nama_user = $_SESSION['nama'];
$role = $_SESSION['role'];

$id = intval($_GET['id'] ?? 0);

if ($id <= 0) {
    header("Location: dewan.php");
    exit;
}


/* =====================================================
   AMBIL DATA DOKUMEN
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "SELECT * FROM dokumen WHERE id = ? LIMIT 1"
);

mysqli_stmt_bind_param($stmt, "i", $id);
mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);
$dokumen = mysqli_fetch_assoc($result);

if (!$dokumen) {
    echo "Dokumen tidak ditemukan.";
    exit;
}

$dewan_id = intval($dokumen['dewan_id']);


/* =====================================================
   AMBIL DATA ANGGOTA DEWAN
===================================================== */

$stmt_dewan = mysqli_prepare(
    $conn,
    "SELECT * FROM dewan WHERE id = ? LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt_dewan,
    "i",
    $dewan_id
);

mysqli_stmt_execute($stmt_dewan);

$result_dewan = mysqli_stmt_get_result($stmt_dewan);
$dewan = mysqli_fetch_assoc($result_dewan);

if (!$dewan) {
    echo "Anggota Dewan tidak ditemukan.";
    exit;
}


/* =====================================================
   AMBIL KATEGORI
===================================================== */

$query_kategori = mysqli_query(
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

    <title>
        Edit Dokumen
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

        .info-box {

            background: #eff6ff;

            border: 1px solid #bfdbfe;

            padding: 15px;

            border-radius: 8px;

            margin-bottom: 20px;

        }

        .form-group {

            margin-bottom: 18px;

        }

        label {

            display: block;

            font-weight: 600;

            font-size: 14px;

            margin-bottom: 7px;

        }

        input,
        select,
        textarea {

            width: 100%;

            box-sizing: border-box;

            padding: 11px 13px;

            border: 1px solid #d1d5db;

            border-radius: 7px;

            font-size: 14px;

        }

        textarea {

            min-height: 100px;

            resize: vertical;

        }

        .current-file {

            margin-top: 8px;

            padding: 10px;

            background: #f8fafc;

            border-radius: 6px;

            font-size: 13px;

        }

        .current-file a {

            color: #1e3a8a;

            font-weight: 600;

            text-decoration: none;

        }

        .btn {

            padding: 11px 17px;

            border-radius: 7px;

            border: none;

            text-decoration: none;

            cursor: pointer;

            font-size: 14px;

        }

        .btn-primary {

            background: #1e3a8a;

            color: white;

        }

        .btn-primary:hover {

            background: #1d4ed8;

        }

        .btn-secondary {

            background: #e5e7eb;

            color: #374151;

        }

        .actions {

            display: flex;

            gap: 10px;

            margin-top: 25px;

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

        <a href="dewan.php" class="active">
            👤 Anggota Dewan
        </a>


        <div class="menu-title">
            Pengarsipan
        </div>

        <a href="dokumen.php">
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


<main class="main-content">


    <header class="topbar">

        <div class="topbar-title">
            Edit Dokumen
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

                <span>
                    <?php
                    echo htmlspecialchars($role);
                    ?>
                </span>

            </div>

        </div>

    </header>


    <section class="page">


        <div class="page-header">

            <h1>
                Edit Dokumen
            </h1>

            <p>
                Ubah informasi dokumen yang telah diarsipkan.
            </p>

        </div>


        <div class="form-box">


            <div class="info-box">

                <strong>
                    Anggota Dewan
                </strong>

                <br>

                <?php
                echo htmlspecialchars(
                    $dewan['nama']
                );
                ?>

            </div>


            <form
                action="proses_edit_dokumen.php"
                method="POST"
                enctype="multipart/form-data"
            >


                <input
                    type="hidden"
                    name="id"
                    value="<?php echo $id; ?>"
                >


                <input
                    type="hidden"
                    name="dewan_id"
                    value="<?php echo $dewan_id; ?>"
                >


                <div class="form-group">

                    <label>
                        Nama Dokumen
                    </label>

                    <input
                        type="text"
                        name="nama_dokumen"
                        value="<?php
                            echo htmlspecialchars(
                                $dokumen['nama_dokumen'] ?? ''
                            );
                        ?>"
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

                        <?php while (
                            $kategori = mysqli_fetch_assoc(
                                $query_kategori
                            )
                        ) { ?>

                            <option
                                value="<?php echo $kategori['id']; ?>"
                                <?php
                                if (
                                    intval(
                                        $dokumen['kategori_id']
                                    ) === intval(
                                        $kategori['id']
                                    )
                                ) {
                                    echo 'selected';
                                }
                                ?>
                            >

                                <?php
                                echo htmlspecialchars(
                                    $kategori['nama_kategori']
                                );
                                ?>

                            </option>

                        <?php } ?>

                    </select>

                </div>


                <div class="form-group">

                    <label>
                        Tahun Dokumen
                    </label>

                    <input
                        type="number"
                        name="tahun"
                        min="1900"
                        max="2100"
                        value="<?php
                            echo htmlspecialchars(
                                $dokumen['tahun'] ?? date('Y')
                            );
                        ?>"
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
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    >

                    <small>
                        Kosongkan jika tidak ingin mengganti file.
                        Maksimal 5 MB.
                    </small>


                    <?php if (
                        !empty($dokumen['nama_file'])
                    ) { ?>

                        <div class="current-file">

                            File saat ini:

                            <strong>
                                <?php
                                echo htmlspecialchars(
                                    $dokumen['nama_file']
                                );
                                ?>
                            </strong>

                        </div>

                    <?php } ?>

                </div>


                <div class="form-group">

                    <label>
                        Keterangan
                    </label>

                    <textarea
                        name="keterangan"
                        placeholder="Masukkan keterangan dokumen jika diperlukan"
                    ><?php
                        echo htmlspecialchars(
                            $dokumen['keterangan'] ?? ''
                        );
                    ?></textarea>

                </div>


                <div class="actions">

                    <a
                        href="arsip_dewan.php?id=<?php echo $dewan_id; ?>"
                        class="btn btn-secondary"
                    >
                        Batal
                    </a>


                    <button
                        type="submit"
                        class="btn btn-primary"
                    >
                        Simpan Perubahan
                    </button>

                </div>


            </form>


        </div>


    </section>

</main>


</body>

</html>