<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


/* =====================================================
   DATA USER
===================================================== */

$nama_user = $_SESSION['nama'] ?? 'Staff';
$role      = $_SESSION['role'] ?? 'Staff';


/* =====================================================
   AMBIL ID DEWAN
===================================================== */

$dewan_id = intval($_GET['dewan_id'] ?? 0);


/* =====================================================
   VALIDASI ID DEWAN
===================================================== */

if ($dewan_id <= 0) {
    echo "Anggota Dewan tidak valid.";
    exit;
}

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
        Tambah Kategori - Sistem Pengarsipan
    </title>

    <link
        rel="stylesheet"
        href="../assets/css/style.css"
    >

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            background: #f4f6f9;
            font-family: Arial, Helvetica, sans-serif;
            color: #334155;
        }


        /* =================================================
           MAIN CONTENT
        ================================================== */

        .main-content {
            margin-left: 250px;
            min-height: 100vh;
            width: calc(100% - 250px);
            background: #f4f6f9;
            transition:
                margin-left 0.25s ease,
                width 0.25s ease;
        }

        .main-content.sidebar-collapsed {
            margin-left: 78px;
            width: calc(100% - 78px);
        }


        /* =================================================
           PAGE
        ================================================== */

        .category-page {
            padding: 32px;
        }


        /* =================================================
           TOMBOL KEMBALI
        ================================================== */

        .back-navigation {
            margin-bottom: 18px;
        }

        .back-navigation a {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 9px 14px;
            background: #1e3a8a;
            color: white;
            text-decoration: none;
            border-radius: 7px;
            font-size: 13px;
            font-weight: 600;
            transition: background-color 0.2s ease;
        }

        .back-navigation a:hover {
            background: #1d4ed8;
        }


        /* =================================================
           HEADER
        ================================================== */

        .page-header {
            margin-bottom: 18px;
        }

        .page-header h1 {
            margin: 0 0 7px;
            font-size: 24px;
            line-height: 1.4;
            color: #1e293b;
        }

        .page-header p {
            margin: 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
        }


        /* =================================================
           FORM BOX
        ================================================== */

        .form-box {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 24px;
            max-width: 700px;
        }


        /* =================================================
           INFO
        ================================================== */

        .info-box {
            background: #eff6ff;
            border: 1px solid #dbeafe;
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 20px;
        }

        .info-box strong {
            display: block;
            color: #1e3a8a;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .info-box span {
            color: #64748b;
            font-size: 13px;
        }


        /* =================================================
           FORM
        ================================================== */

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 7px;
            font-size: 13px;
            font-weight: 600;
            color: #334155;
        }

        .form-group input {
            width: 100%;
            padding: 11px 13px;
            border: 1px solid #cbd5e1;
            border-radius: 7px;
            font-size: 14px;
            outline: none;
        }

        .form-group input:focus {
            border-color: #1e3a8a;
            box-shadow:
                0 0 0 2px
                rgba(30, 58, 138, 0.08);
        }


        /* =================================================
           BUTTON
        ================================================== */

        .button-group {
            display: flex;
            gap: 8px;
            margin-top: 24px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 7px;
            padding: 10px 15px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }

        .btn-primary {
            background: #1e3a8a;
            color: white;
        }

        .btn-primary:hover {
            background: #1d4ed8;
        }

        .btn-secondary {
            background: #e2e8f0;
            color: #334155;
        }

        .btn-secondary:hover {
            background: #cbd5e1;
        }


        /* =================================================
           RESPONSIVE
        ================================================== */

        @media (max-width: 900px) {

            .main-content {
                margin-left: 220px;
            }

            .main-content.sidebar-collapsed {
                margin-left: 78px;
                width: calc(100% - 78px);
            }

            .category-page {
                padding: 25px;
            }

        }


        @media (max-width: 650px) {

            .main-content {
                margin-left: 75px;
            }

            .main-content.sidebar-collapsed {
                margin-left: 78px;
                width: calc(100% - 78px);
            }

            .category-page {
                padding: 20px;
            }

            .button-group {
                flex-direction: column;
            }

            .button-group .btn {
                width: 100%;
            }

        }

    </style>

</head>


<body>


<!-- =====================================================
     SIDEBAR
===================================================== -->

<?php

require_once "../includes/sidebar.php";

?>


<!-- =====================================================
     MAIN CONTENT
===================================================== -->

<main
    class="main-content"
    id="mainContent"
>


    <section class="category-page">


        <!-- =================================================
             TOMBOL KEMBALI
        ================================================== -->

        <div class="back-navigation">

            <a
                href="arsip_dewan.php?id=<?php echo $dewan_id; ?>"
            >
                ← Kembali
            </a>

        </div>


        <!-- =================================================
             HEADER
        ================================================== -->

        <div class="page-header">

            <h1>
                Tambah Kategori
            </h1>

            <p>
                Tambahkan kategori dokumen untuk anggota Dewan.
            </p>

        </div>


        <!-- =================================================
             FORM
        ================================================== -->

        <div class="form-box">


            <div class="info-box">

                <strong>
                    Anggota Dewan
                </strong>

                <span>
                    Kategori akan ditambahkan untuk anggota Dewan yang dipilih.
                </span>

            </div>


            <form
                action="proses_tambah_kategori.php"
                method="POST"
            >


                <!-- ID DEWAN -->

                <input
                    type="hidden"
                    name="dewan_id"
                    value="<?php echo $dewan_id; ?>"
                >


                <!-- NAMA KATEGORI -->

                <div class="form-group">

                    <label for="nama_kategori">
                        Nama Kategori
                    </label>

                    <input
                        type="text"
                        id="nama_kategori"
                        name="nama_kategori"
                        placeholder="Contoh: Reses"
                        required
                        autofocus
                    >

                </div>


                <!-- BUTTON -->

                <div class="button-group">

                    <button
                        type="submit"
                        class="btn btn-primary"
                    >
                        Simpan Kategori
                    </button>


                    <a
                        href="arsip_dewan.php?id=<?php echo $dewan_id; ?>"
                        class="btn btn-secondary"
                    >
                        Batal
                    </a>

                </div>


            </form>


        </div>


    </section>


</main>


</body>

</html>