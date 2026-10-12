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
   AMBIL ID ANGGOTA DEWAN
===================================================== */

$id = intval($_GET['id'] ?? 0);

if ($id <= 0) {
    header("Location: dewan.php");
    exit;
}


/* =====================================================
   AMBIL DATA ANGGOTA DEWAN
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "SELECT *
     FROM dewan
     WHERE id = ?
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt,
    "i",
    $id
);

mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);

$dewan = mysqli_fetch_assoc($result);

mysqli_stmt_close($stmt);


if (!$dewan) {
    echo "Data anggota Dewan tidak ditemukan.";
    exit;
}


/* =====================================================
   AMBIL KATEGORI DOKUMEN
===================================================== */

$query_kategori = mysqli_query(
    $conn,
    "SELECT
        k.id,
        k.nama_kategori,
        COUNT(d.id) AS jumlah_dokumen
     FROM kategori_dokumen k
     LEFT JOIN dokumen d
        ON d.kategori_id = k.id
        AND d.dewan_id = $id
     GROUP BY
        k.id,
        k.nama_kategori
     ORDER BY
        k.nama_kategori ASC"
);


/* =====================================================
   AMBIL KATEGORI PERTAMA
   UNTUK TOMBOL TAMBAH DOKUMEN
===================================================== */

$kategori_pertama_id = 0;

if (
    $query_kategori &&
    mysqli_num_rows($query_kategori) > 0
) {

    $kategori_pertama = mysqli_fetch_assoc(
        $query_kategori
    );

    $kategori_pertama_id = intval(
        $kategori_pertama['id']
    );

    mysqli_data_seek(
        $query_kategori,
        0
    );
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
        Arsip Anggota Dewan
    </title>


    <link
        rel="stylesheet"
        href="../assets/css/style.css"
    >


    <style>

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
            font-family: Arial, Helvetica, sans-serif;
            color: #334155;
        }


        /* =====================================================
           MAIN CONTENT
        ===================================================== */

        .main-content {
            margin-left: 250px;
            min-height: 100vh;
            background: #f4f6f9;
            transition: margin-left 0.25s ease;
        }


        .main-content.sidebar-collapsed {
            margin-left: 78px;
        }


        .archive-page {
            padding: 32px;
        }


        /* =====================================================
           HEADER
        ===================================================== */

        .archive-header {
            margin-bottom: 18px;
        }


        .archive-header h1 {
            margin: 0 0 7px;
            font-size: 24px;
            line-height: 1.4;
            color: #1e293b;
        }


        .archive-header p {
            margin: 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
        }


        /* =====================================================
           KEMBALI
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
           INFORMASI DEWAN
        ===================================================== */

        .profile-box {
            background: white;

            border: 1px solid #e5e7eb;

            border-radius: 10px;

            padding: 20px;

            margin-bottom: 25px;
        }


        .profile-header {
            display: flex;

            justify-content: space-between;

            align-items: center;

            gap: 15px;

            margin-bottom: 18px;

            padding-bottom: 15px;

            border-bottom: 1px solid #e5e7eb;
        }


        .profile-header h3 {
            margin: 0;

            font-size: 16px;

            color: #1e3a8a;
        }


        .profile-grid {
            display: grid;

            grid-template-columns: 140px 1fr;

            row-gap: 12px;

            column-gap: 20px;
        }


        .profile-label {
            font-size: 13px;

            font-weight: 600;

            color: #475569;
        }


        .profile-value {
            font-size: 13px;

            color: #334155;

            line-height: 1.5;
        }


        /* =====================================================
           BUTTON
        ===================================================== */

        .archive-btn {
            display: inline-flex;

            align-items: center;

            justify-content: center;

            gap: 6px;

            padding: 10px 14px;

            border: none;

            border-radius: 7px;

            background: #1e3a8a;

            color: white;

            text-decoration: none;

            font-size: 12px;

            font-weight: 600;

            cursor: pointer;

            transition: background 0.2s ease;
        }


        .archive-btn:hover {
            background: #1d4ed8;
        }


        /* =====================================================
           ICON BUTTON
        ===================================================== */

        .archive-btn svg {
            width: 14px;

            height: 14px;

            flex-shrink: 0;

            display: block;
        }


        /* =====================================================
           HEADER KATEGORI
        ===================================================== */

        .category-header {
            display: flex;

            justify-content: space-between;

            align-items: center;

            gap: 15px;

            margin-bottom: 15px;
        }


        .category-header h3 {
            margin: 0;

            font-size: 17px;

            color: #1e293b;
        }


        .category-actions {
            display: flex;

            align-items: center;

            gap: 8px;
        }


        /* =====================================================
           GRID KATEGORI
        ===================================================== */

        .category-grid {
            display: grid;

            grid-template-columns:
                repeat(3, minmax(0, 1fr));

            gap: 14px;
        }


        /* =====================================================
           KARTU KATEGORI
        ===================================================== */

        .category-card {
            display: block;

            background: white;

            border: 1px solid #e5e7eb;

            border-radius: 10px;

            padding: 16px;

            min-height: 120px;

            text-decoration: none;

            transition:
                border-color 0.2s ease,
                box-shadow 0.2s ease,
                transform 0.2s ease;
        }


        .category-card:hover {
            border-color: #1e3a8a;

            box-shadow:
                0 4px 12px
                rgba(30, 58, 138, 0.08);

            transform: translateY(-1px);
        }


        .category-icon {
            width: 38px;

            height: 38px;

            display: flex;

            align-items: center;

            justify-content: center;

            margin-bottom: 10px;

            border-radius: 8px;

            background: #eff6ff;

            font-size: 20px;
        }


        .category-name {
            margin-bottom: 5px;

            color: #1e3a8a;

            font-size: 13px;

            font-weight: 700;
        }


        .category-count {
            color: #64748b;

            font-size: 11px;
        }


        /* =====================================================
           KATEGORI KOSONG
        ===================================================== */

        .empty-category {
            background: white;

            border: 1px solid #e5e7eb;

            border-radius: 10px;

            text-align: center;

            padding: 45px 20px;
        }


        .empty-category-icon {
            font-size: 38px;

            margin-bottom: 10px;
        }


        .empty-category h3 {
            margin: 0 0 7px;

            color: #475569;

            font-size: 16px;
        }


        .empty-category p {
            margin: 0 0 18px;

            color: #64748b;

            font-size: 13px;
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


            .archive-page {
                padding: 25px;
            }


            .category-grid {
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
            }

        }


        @media (max-width: 650px) {

            .main-content {
                margin-left: 75px;
            }


            .main-content.sidebar-collapsed {
                margin-left: 78px;
            }


            .archive-page {
                padding: 20px;
            }


            .archive-header h1 {
                font-size: 21px;
            }


            .profile-header {
                flex-direction: column;

                align-items: flex-start;
            }


            .profile-grid {
                grid-template-columns: 1fr;

                row-gap: 5px;
            }


            .profile-label {
                margin-top: 8px;
            }


            .category-header {
                flex-direction: column;

                align-items: flex-start;
            }


            .category-actions {
                width: 100%;

                flex-direction: column;

                align-items: stretch;
            }


            .category-actions .archive-btn {
                width: 100%;
            }


            .category-grid {
                grid-template-columns: 1fr;
            }

        }

    </style>

</head>


<body>


<?php

/* =====================================================
   SIDEBAR
   SIDEBAR DIPANGGIL DARI FOLDER INCLUDES
===================================================== */

require_once "../includes/sidebar.php";

?>


<!-- =====================================================
     MAIN CONTENT
===================================================== -->

<main class="main-content" id="mainContent">


    <section class="archive-page">


        <!-- =================================================
             KEMBALI
        ================================================== -->

        <div class="back-navigation">

            <a
                href="dewan.php"
            >
                ← Kembali
            </a>

        </div>


        <!-- =================================================
             HEADER
        ================================================== -->

        <div class="archive-header">

            <h1>
                Arsip Anggota Dewan
            </h1>

            <p>
                Kelola informasi dan dokumen arsip anggota Dewan.
            </p>

        </div>


        <!-- =================================================
             INFORMASI ANGGOTA DEWAN
        ================================================== -->

        <div class="profile-box">


            <div class="profile-header">

                <h3>
                    Informasi Anggota Dewan
                </h3>


                <!-- EDIT DATA -->

                <a
                    href="edit_dewan.php?id=<?php echo $id; ?>"
                    class="archive-btn"
                    title="Edit Data Anggota Dewan"
                >

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >

                        <path
                            d="M12 20h9"
                        />

                        <path
                            d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z"
                        />

                    </svg>

                    Edit Data

                </a>

            </div>


            <div class="profile-grid">


                <!-- NAMA -->

                <div class="profile-label">
                    Nama Anggota
                </div>

                <div class="profile-value">

                    <?php

                    echo htmlspecialchars(
                        $dewan['nama'] ?? '-'
                    );

                    ?>

                </div>


                <!-- JABATAN -->

                <div class="profile-label">
                    Jabatan
                </div>

                <div class="profile-value">

                    <?php

                    echo htmlspecialchars(
                        $dewan['jabatan'] ?? '-'
                    );

                    ?>

                </div>


                <!-- PERIODE -->

                <div class="profile-label">
                    Periode
                </div>

                <div class="profile-value">

                    <?php

                    echo htmlspecialchars(
                        $dewan['periode'] ?? '-'
                    );

                    ?>

                </div>


                <!-- PENGAWAS -->

                <?php

                if (!empty($dewan['nama_pengawas'])) {

                ?>

                    <div class="profile-label">
                        Pengawas
                    </div>

                    <div class="profile-value">

                        <?php

                        echo htmlspecialchars(
                            $dewan['nama_pengawas']
                        );

                        ?>

                    </div>

                <?php

                }


                /* =================================================
                   KETERANGAN
                ================================================== */

                if (!empty($dewan['keterangan'])) {

                ?>

                    <div class="profile-label">
                        Keterangan
                    </div>

                    <div class="profile-value">

                        <?php

                        echo nl2br(
                            htmlspecialchars(
                                $dewan['keterangan']
                            )
                        );

                        ?>

                    </div>

                <?php

                }

                ?>


            </div>


        </div>


        <!-- =====================================================
             KATEGORI DOKUMEN
        ===================================================== -->

        <div class="category-header">


            <h3>
                Kategori Dokumen
            </h3>


            <div class="category-actions">


                <!-- =================================================
                     TOMBOL TAMBAH DOKUMEN
                ================================================== -->

                <?php if ($kategori_pertama_id > 0): ?>

                    <a
                        href="tambah_dokumen.php?dewan_id=<?php echo $id; ?>&kategori_id=<?php echo $kategori_pertama_id; ?>"
                        class="archive-btn"
                        title="Tambah Dokumen"
                    >

                        <!-- ICON DOKUMEN -->

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >

                            <path
                                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                            />

                            <polyline
                                points="14 2 14 8 20 8"
                            />

                            <line
                                x1="12"
                                y1="12"
                                x2="12"
                                y2="18"
                            />

                            <line
                                x1="9"
                                y1="15"
                                x2="15"
                                y2="15"
                            />

                        </svg>

                        Tambah Dokumen

                    </a>

                <?php else: ?>

                    <a
                        href="tambah_kategori.php?dewan_id=<?php echo $id; ?>"
                        class="archive-btn"
                        title="Tambah Kategori"
                    >

                        <!-- ICON KATEGORI -->

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >

                            <path
                                d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
                            />

                            <line
                                x1="12"
                                y1="10"
                                x2="12"
                                y2="16"
                            />

                            <line
                                x1="9"
                                y1="13"
                                x2="15"
                                y2="13"
                            />

                        </svg>

                        Tambah Kategori

                    </a>

                <?php endif; ?>


                <!-- =================================================
                     TOMBOL TAMBAH KATEGORI
                ================================================== -->

                <a
                    href="tambah_kategori.php?dewan_id=<?php echo $id; ?>"
                    class="archive-btn"
                    title="Tambah Kategori"
                >

                    <!-- ICON KATEGORI -->

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >

                        <path
                            d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
                        />

                        <line
                            x1="12"
                            y1="10"
                            x2="12"
                            y2="16"
                        />

                        <line
                            x1="9"
                            y1="13"
                            x2="15"
                            y2="13"
                        />

                    </svg>

                    Tambah Kategori

                </a>


            </div>


        </div>


        <!-- =====================================================
             DAFTAR KATEGORI
        ===================================================== -->

        <?php

        if (
            $query_kategori &&
            mysqli_num_rows($query_kategori) > 0
        ) {

        ?>

            <div class="category-grid">


                <?php

                while (
                    $kategori =
                    mysqli_fetch_assoc(
                        $query_kategori
                    )
                ) {


                    $kategori_id =
                        intval(
                            $kategori['id']
                        );


                    $nama_kategori =
                        $kategori['nama_kategori'];


                    $jumlah_dokumen =
                        intval(
                            $kategori['jumlah_dokumen']
                        );

                ?>


                    <a
                        href="kategori_dokumen.php?dewan_id=<?php echo $id; ?>&kategori_id=<?php echo $kategori_id; ?>"
                        class="category-card"
                    >


                        <!-- IKON FOLDER TETAP -->

                        <div class="category-icon">
                            📁
                        </div>


                        <div class="category-name">

                            <?php

                            echo htmlspecialchars(
                                $nama_kategori
                            );

                            ?>

                        </div>


                        <div class="category-count">

                            <?php

                            echo $jumlah_dokumen;

                            ?>

                            dokumen

                        </div>


                    </a>


                <?php

                }

                ?>


            </div>


        <?php

        } else {

        ?>


            <div class="empty-category">


                <!-- IKON FOLDER TETAP -->

                <div class="empty-category-icon">
                    📁
                </div>


                <h3>
                    Belum Ada Kategori Dokumen
                </h3>


                <p>
                    Belum ada kategori dokumen yang tersedia.
                </p>


                <a
                    href="tambah_kategori.php?dewan_id=<?php echo $id; ?>"
                    class="archive-btn"
                    title="Tambah Kategori"
                >

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >

                        <path
                            d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
                        />

                        <line
                            x1="12"
                            y1="10"
                            x2="12"
                            y2="16"
                        />

                        <line
                            x1="9"
                            y1="13"
                            x2="15"
                            y2="13"
                        />

                    </svg>

                    Tambah Kategori

                </a>


            </div>


        <?php

        }

        ?>


    </section>


</main>


</body>

</html>