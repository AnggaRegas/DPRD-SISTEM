<?php



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
   PESAN ERROR
===================================================== */

$error = $_GET['error'] ?? '';

$error_message = '';



if ($error === 'nama_double') {

    $error_message =
        "Nama anggota Dewan sudah terdaftar. Silakan gunakan nama yang berbeda.";

} elseif ($error === 'nama_kosong') {

    $error_message =
        "Nama anggota Dewan wajib diisi.";

} elseif ($error === 'jabatan_kosong') {

    $error_message =
        "Jabatan wajib diisi.";

} elseif ($error === 'periode_kosong') {

    $error_message =
        "Periode wajib diisi.";

} elseif ($error === 'gagal_simpan') {

    $error_message =
        "Data gagal disimpan. Silakan coba lagi.";

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
        Tambah Anggota Dewan
    </title>



    <link
        rel="stylesheet"
        href="../assets/css/style.css"
    >



    <style>



        /* =====================================================
           RESET
        ===================================================== */

        * {
            box-sizing: border-box;
        }



        html,
        body {
            margin: 0;
            padding: 0;
        }



        body {
            background: #f4f6f9;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            color: #334155;
        }



        /* =====================================================
           MAIN CONTENT
        ===================================================== */

        .main-content {

            margin-left: 250px;

            min-height: 100vh;

            background: #f4f6f9;

            transition:
                margin-left 0.25s ease;

        }



        .main-content.sidebar-collapsed {

            margin-left: 78px;

        }



        /* =====================================================
           PAGE
        ===================================================== */

        .page {

            padding: 32px;

        }



        /* =====================================================
           NAVIGASI KEMBALI
        ===================================================== */

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

            transition:
                background-color 0.2s ease;

        }



        .back-navigation a:hover {

            background: #1d4ed8;

        }



        /* =====================================================
           HEADER
        ===================================================== */

        .page-header {

            margin-bottom: 15px;

        }



        .page-header h1 {

            margin:
                0 0 7px;

            font-size: 24px;

            color: #1e293b;

        }



        .page-header p {

            margin: 0;

            color: #64748b;

            font-size: 13px;

            line-height: 1.6;

        }



        /* =====================================================
           FORM BOX
        ===================================================== */

        .form-box {

            background: white;

            border:
                1px solid
                #e5e7eb;

            border-radius: 10px;

            padding: 25px;

            max-width: 700px;

        }



        /* =====================================================
           PESAN ERROR
        ===================================================== */

        .error-message {

            background: #fef2f2;

            border:
                1px solid
                #fca5a5;

            color: #b91c1c;

            padding:
                12px 14px;

            border-radius: 7px;

            font-size: 13px;

            line-height: 1.5;

            margin-bottom: 20px;

        }



        /* =====================================================
           FORM GROUP
        ===================================================== */

        .form-group {

            margin-bottom: 18px;

        }



        .form-group label {

            display: block;

            font-size: 14px;

            font-weight: 600;

            margin-bottom: 7px;

            color: #374151;

        }



        .form-group input,
        .form-group textarea {

            width: 100%;

            box-sizing: border-box;

            padding:
                11px 13px;

            border:
                1px solid
                #d1d5db;

            border-radius: 7px;

            font-size: 14px;

        }



        .form-group textarea {

            min-height: 100px;

            resize: vertical;

        }



        /* =====================================================
           FORM ACTION
        ===================================================== */

        .form-actions {

            display: flex;

            gap: 10px;

            margin-top: 25px;

        }



        /* =====================================================
           BUTTON
        ===================================================== */

        .btn {

            display: inline-block;

            padding:
                11px 17px;

            border-radius: 7px;

            text-decoration: none;

            border: none;

            cursor: pointer;

            font-size: 14px;

        }



        /* =====================================================
           BUTTON PRIMARY
        ===================================================== */

        .btn-primary {

            background: #1e3a8a;

            color: white;

        }



        .btn-primary:hover {

            background: #1d4ed8;

        }



        /* =====================================================
           BUTTON SECONDARY
        ===================================================== */

        .btn-secondary {

            background: #e5e7eb;

            color: #374151;

        }



        .btn-secondary:hover {

            background: #d1d5db;

        }



        /* =====================================================
           RESPONSIVE
        ===================================================== */

        @media (max-width: 900px) {

            .main-content {

                margin-left: 220px;

            }



            .main-content.sidebar-collapsed {

                margin-left: 78px;

            }



            .page {

                padding: 25px;

            }

        }



        @media (max-width: 650px) {

            .main-content {

                margin-left: 78px;

            }



            .main-content.sidebar-collapsed {

                margin-left: 78px;

            }



            .page {

                padding: 20px;

            }



            .form-box {

                max-width: 100%;

            }

        }



    </style>



</head>



<body>



<!-- =====================================================
     SIDEBAR
===================================================== -->

<?php

include "../includes/sidebar.php";

?>



<!-- =====================================================
     MAIN CONTENT
===================================================== -->

<main
    class="main-content"
    id="mainContent"
>



    <section class="page">



        <!-- =================================================
             KEMBALI
        ================================================== -->

        <div class="back-navigation">

            <a href="dewan.php">

                ← Kembali

            </a>

        </div>



        <!-- =================================================
             HEADER
        ================================================== -->

        <div class="page-header">

            <h1>

                Tambah Anggota Dewan

            </h1>



            <p>

                Masukkan data anggota DPRD dan pengawas yang terkait.

            </p>

        </div>



        <!-- =================================================
             FORM
        ================================================= -->

        <div class="form-box">



            <!-- =================================================
                 PESAN ERROR
            ================================================== -->

            <?php if ($error_message !== ''): ?>

                <div class="error-message">

                    ⚠️

                    <?= htmlspecialchars($error_message) ?>

                </div>

            <?php endif; ?>



            <form
                action="proses_tambah_dewan.php"
                method="POST"
                id="formTambahDewan"
            >



                <!-- NAMA ANGGOTA DEWAN -->

                <div class="form-group">

                    <label>

                        Nama Anggota Dewan

                    </label>



                    <input
                        type="text"
                        name="nama"
                        id="nama"
                        placeholder="Contoh: Ir. H. Kaharuddin Kadir, M.Si"
                        required
                    >


                </div>



                <!-- JABATAN -->

                <div class="form-group">

                    <label>

                        Jabatan

                    </label>



                    <input
                        type="text"
                        name="jabatan"
                        id="jabatan"
                        placeholder="Contoh: Anggota"
                        required
                    >


                </div>



                <!-- PERIODE -->

                <div class="form-group">

                    <label>

                        Periode

                    </label>



                    <input
                        type="text"
                        name="periode"
                        id="periode"
                        placeholder="Contoh: 2024-2029"
                        required
                    >


                </div>



                <!-- NAMA PENGAWAS -->

                <div class="form-group">

                    <label>

                        Nama Pengawas

                    </label>



                    <input
                        type="text"
                        name="nama_pengawas"
                        id="nama_pengawas"
                        placeholder="Masukkan nama pengawas"
                    >


                </div>



                <!-- KETERANGAN -->

                <div class="form-group">

                    <label>

                        Keterangan

                    </label>



                    <textarea
                        name="keterangan"
                        id="keterangan"
                        placeholder="Keterangan tambahan jika diperlukan"
                    ></textarea>


                </div>



                <!-- TOMBOL -->

                <div class="form-actions">

                    <a
                        href="dewan.php"
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



<script>

document.addEventListener("DOMContentLoaded", function () {

    const fields = [
        document.getElementById("nama"),
        document.getElementById("jabatan"),
        document.getElementById("periode"),
        document.getElementById("nama_pengawas"),
        document.getElementById("keterangan")
    ];



    fields.forEach(function (field, index) {

        if (!field) return;



        field.addEventListener("keydown", function (event) {


            /* =================================================
               PANAH BAWAH
               Pindah ke kolom berikutnya
            ================================================= */

            if (event.key === "ArrowDown") {

                event.preventDefault();

                if (index < fields.length - 1) {

                    fields[index + 1].focus();

                }

                return;

            }



            /* =================================================
               PANAH ATAS
               Kembali ke kolom sebelumnya
            ================================================= */

            if (event.key === "ArrowUp") {

                event.preventDefault();

                if (index > 0) {

                    fields[index - 1].focus();

                }

                return;

            }



            /* =================================================
               ENTER
               Pindah ke kolom berikutnya.

               Jika sudah di Keterangan,
               Enter akan menyimpan form.
            ================================================= */

            if (event.key === "Enter") {

                /*
                 * Jika sedang berada di textarea Keterangan,
                 * Enter digunakan untuk submit.
                 */

                if (field.id === "keterangan") {

                    event.preventDefault();

                    document
                        .getElementById("formTambahDewan")
                        .requestSubmit();

                    return;

                }



                /*
                 * Untuk input lainnya,
                 * Enter pindah ke kolom berikutnya.
                 */

                event.preventDefault();

                if (index < fields.length - 1) {

                    fields[index + 1].focus();

                }

            }

        });

    });

});

</script>



</body>



</html>