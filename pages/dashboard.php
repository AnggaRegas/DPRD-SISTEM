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
   INISIAL USER
===================================================== */

$inisial = strtoupper(
    substr($nama_user, 0, 1)
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
        Dashboard
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


        /* =====================================================
           MAIN CONTENT SAAT SIDEBAR DITUTUP
        ===================================================== */

        .main-content.sidebar-collapsed {

            margin-left: 78px;

        }


        /* =====================================================
           DASHBOARD PAGE
        ===================================================== */

        .dashboard-page {

            padding: 32px;

        }


        /* =====================================================
           WELCOME
        ===================================================== */

        .welcome-section {

            margin-bottom: 22px;

        }


        .welcome-section h1 {

            margin:
                0 0 7px;

            font-size: 24px;

            color: #1e293b;

        }


        .welcome-section p {

            margin: 0;

            color: #64748b;

            font-size: 13px;

            line-height: 1.6;

        }


        /* =====================================================
           CONTENT BOX
        ===================================================== */

        .dashboard-box {

            background: white;

            border:
                1px solid
                #e5e7eb;

            border-radius: 10px;

            padding: 20px;

            margin-bottom: 18px;

        }


        .dashboard-box h2 {

            margin:
                0 0 8px;

            font-size: 16px;

            color: #1e293b;

        }


        .dashboard-box p {

            margin: 0;

            font-size: 13px;

            line-height: 1.7;

            color: #64748b;

        }


        /* =====================================================
           QUICK ACCESS
        ===================================================== */

        .quick-title {

            margin-bottom: 15px;

        }


        .quick-title h2 {

            margin:
                0 0 6px;

            font-size: 16px;

            color: #1e293b;

        }


        .quick-title p {

            margin: 0;

            font-size: 13px;

            color: #64748b;

        }


        .quick-actions {

            display: flex;

            gap: 12px;

            margin-top: 18px;

        }


        .quick-button {

            display: inline-flex;

            align-items: center;

            gap: 8px;

            padding:
                11px 15px;

            background: #1e3a8a;

            color: white;

            border-radius: 7px;

            text-decoration: none;

            font-size: 13px;

            font-weight: 600;

            transition:
                background-color 0.2s ease;

        }


        .quick-button:hover {

            background: #1d4ed8;

        }


        .quick-icon {

            width: 18px;
            height: 18px;

            display: flex;

            align-items: center;

            justify-content: center;

        }


        .quick-icon svg {

            width: 17px;
            height: 17px;

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


            .dashboard-page {

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


            .dashboard-page {

                padding: 20px;

            }


            .welcome-section h1 {

                font-size: 21px;

            }


            .quick-actions {

                flex-direction: column;

            }


            .quick-button {

                justify-content: center;

            }

        }

    </style>

</head>


<body>


<!-- =====================================================
     SIDEBAR
     
     MENGGUNAKAN SIDEBAR YANG SAMA DENGAN
     HALAMAN LAIN
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


    <section class="dashboard-page">


        <!-- =================================================
             WELCOME
        ================================================== -->

        <div class="welcome-section">


            <h1>
                Selamat Datang
            </h1>


            <p>
                Sistem Pengarsipan Bagian Fasilitasi Penganggaran dan Pengawasan.
            </p>


        </div>



        <!-- =================================================
             INFORMASI SISTEM
        ================================================== -->

        <div class="dashboard-box">


            <h2>
                Sistem Pengarsipan Dokumen
            </h2>


            <p>

                Sistem ini digunakan untuk membantu Bagian Fasilitasi
                Penganggaran dan Pengawasan dalam mengelola dan menyimpan
                dokumen secara terstruktur.

            </p>


            <p style="margin-top: 7px;">

                Data anggota Dewan dapat dikelola melalui menu
                <strong>Anggota Dewan</strong>.

                Setiap anggota Dewan memiliki halaman arsip untuk
                mengelola dokumen yang berkaitan dengan anggota tersebut.

            </p>


            <p style="margin-top: 7px;">

                Dokumen dapat dikelompokkan berdasarkan kategori
                dokumen sehingga memudahkan proses penyimpanan,
                pencarian, dan pengelolaan arsip.

            </p>


        </div>



        <!-- =================================================
             AKSES CEPAT
        ================================================== -->

        <div class="dashboard-box">


            <div class="quick-title">


                <h2>
                    Akses Cepat
                </h2>


                <p>
                    Gunakan menu berikut untuk mengelola data sistem.
                </p>


            </div>



            <div class="quick-actions">


                <!-- =================================================
                     TAMBAH DOKUMEN
                ================================================== -->

                <a
                    href="tambah_dokumen.php"
                    class="quick-button"
                >


                    <span class="quick-icon">


                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >

                            <path
                                d="M12 5v14"
                            />

                            <path
                                d="M5 12h14"
                            />

                        </svg>


                    </span>


                    Tambah Dokumen


                </a>


            </div>


        </div>


    </section>


</main>


</body>

</html>