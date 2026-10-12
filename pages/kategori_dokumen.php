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
   AMBIL ID DEWAN DAN KATEGORI
===================================================== */

$dewan_id    = intval($_GET['dewan_id'] ?? 0);
$kategori_id = intval($_GET['kategori_id'] ?? 0);


if ($dewan_id <= 0 || $kategori_id <= 0) {

    header("Location: dewan.php");
    exit;

}


/* =====================================================
   PESAN SISTEM
===================================================== */

$error   = $_GET['error'] ?? '';
$success = $_GET['success'] ?? '';

$pesan = '';
$jenis_pesan = '';


if ($error === 'tahun_double') {

    $pesan =
        "Folder tahun tersebut sudah ada.";

    $jenis_pesan = "error";

}


if ($error === 'tahun_tidak_valid') {

    $pesan =
        "Tahun yang dimasukkan tidak valid.";

    $jenis_pesan = "error";

}


if ($error === 'gagal_tambah_tahun') {

    $pesan =
        "Folder tahun gagal ditambahkan.";

    $jenis_pesan = "error";

}


if ($error === 'gagal_hapus_tahun') {

    $pesan =
        "Folder tahun gagal dihapus.";

    $jenis_pesan = "error";

}


if ($success === 'tahun_berhasil') {

    $pesan =
        "Folder tahun berhasil ditambahkan.";

    $jenis_pesan = "success";

}


if ($success === 'tahun_dihapus') {

    $pesan =
        "Folder tahun berhasil dihapus.";

    $jenis_pesan = "success";

}


/* =====================================================
   AMBIL DATA KATEGORI
===================================================== */

$stmt_kategori = mysqli_prepare(
    $conn,
    "SELECT *
     FROM kategori_dokumen
     WHERE id = ?
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt_kategori,
    "i",
    $kategori_id
);

mysqli_stmt_execute($stmt_kategori);

$result_kategori = mysqli_stmt_get_result(
    $stmt_kategori
);

$kategori = mysqli_fetch_assoc(
    $result_kategori
);

mysqli_stmt_close($stmt_kategori);


if (!$kategori) {

    echo "Kategori dokumen tidak ditemukan.";
    exit;

}


/* =====================================================
   AMBIL DATA DEWAN
===================================================== */

$stmt_dewan = mysqli_prepare(
    $conn,
    "SELECT *
     FROM dewan
     WHERE id = ?
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt_dewan,
    "i",
    $dewan_id
);

mysqli_stmt_execute($stmt_dewan);

$result_dewan = mysqli_stmt_get_result(
    $stmt_dewan
);

$dewan = mysqli_fetch_assoc(
    $result_dewan
);

mysqli_stmt_close($stmt_dewan);


if (!$dewan) {

    echo "Data anggota Dewan tidak ditemukan.";
    exit;

}


/* =====================================================
   NAMA KATEGORI
===================================================== */

$nama_kategori =
    $kategori['nama_kategori'] ?? 'Kategori Dokumen';


/* =====================================================
   AMBIL DATA TAHUN DOKUMEN
===================================================== */

/*
 * Tahun diambil dari dua sumber:
 *
 * 1. tabel tahun_dokumen
 *    → folder tahun yang dibuat secara manual
 *
 * 2. tabel dokumen
 *    → tahun yang sudah memiliki dokumen
 *
 * Dengan begitu, folder tahun tetap muncul
 * walaupun belum mempunyai dokumen.
 */

$tahun_list = [];


$stmt_tahun = mysqli_prepare(
    $conn,
    "
    SELECT
        semua_tahun.tahun,

        (
            SELECT COUNT(*)
            FROM dokumen d
            WHERE d.dewan_id = ?
              AND d.kategori_id = ?
              AND d.tahun = semua_tahun.tahun
        ) AS jumlah_dokumen

    FROM
    (
        SELECT tahun
        FROM tahun_dokumen
        WHERE dewan_id = ?
          AND kategori_id = ?

        UNION

        SELECT tahun
        FROM dokumen
        WHERE dewan_id = ?
          AND kategori_id = ?

    ) AS semua_tahun

    ORDER BY semua_tahun.tahun DESC
    "
);


mysqli_stmt_bind_param(
    $stmt_tahun,
    "iiiiii",
    $dewan_id,
    $kategori_id,
    $dewan_id,
    $kategori_id,
    $dewan_id,
    $kategori_id
);


mysqli_stmt_execute($stmt_tahun);


$query_tahun = mysqli_stmt_get_result(
    $stmt_tahun
);


/* =====================================================
   MASUKKAN DATA TAHUN KE ARRAY
===================================================== */

if ($query_tahun) {

    while (
        $tahun_data =
        mysqli_fetch_assoc($query_tahun)
    ) {

        $tahun_list[] = $tahun_data;

    }

}


/* =====================================================
   CEK APAKAH SUDAH ADA TAHUN
===================================================== */

$ada_tahun = count($tahun_list) > 0;


/* =====================================================
   CEK APAKAH SUDAH ADA DOKUMEN
===================================================== */

$ada_dokumen = false;


foreach ($tahun_list as $tahun_data) {

    if (
        intval(
            $tahun_data['jumlah_dokumen']
        ) > 0
    ) {

        $ada_dokumen = true;

        break;

    }

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
        <?php echo htmlspecialchars($nama_kategori); ?>
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
            font-family: Arial, Helvetica, sans-serif;
            color: #334155;
        }


        /* =====================================================
           MAIN CONTENT
        ===================================================== */

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


        /* =====================================================
           PAGE
        ===================================================== */

        .category-page {

            padding: 32px;

        }


        /* =====================================================
           HEADER
        ===================================================== */

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


        /* =====================================================
           TOMBOL KEMBALI
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
           PESAN SISTEM
        ===================================================== */

        .system-message {

            padding:
                12px 15px;

            border-radius: 7px;

            margin-bottom: 15px;

            font-size: 13px;

            line-height: 1.5;

        }


        .system-message.success {

            background: #f0fdf4;

            border:
                1px solid
                #86efac;

            color: #166534;

        }


        .system-message.error {

            background: #fef2f2;

            border:
                1px solid
                #fca5a5;

            color: #b91c1c;

        }


        /* =====================================================
           KATEGORI BOX
        ===================================================== */

        .category-box {

            background: white;

            border:
                1px solid
                #e5e7eb;

            border-radius: 10px;

            padding: 14px 16px;

            margin-bottom: 18px;

            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 15px;

        }


        .category-info {

            display: flex;

            align-items: center;

            gap: 12px;

            min-width: 0;

        }


        .category-icon {

            width: 38px;

            height: 38px;

            min-width: 38px;

            border-radius: 8px;

            background: #eff6ff;

            display: flex;

            align-items: center;

            justify-content: center;

            font-size: 20px;

        }


        .category-text {

            min-width: 0;

        }


        .category-text h2 {

            margin: 0;

            font-size: 16px;

            color: #1e3a8a;

        }


        .category-text p {

            margin: 4px 0 0;

            font-size: 12px;

            color: #64748b;

        }


        /* =====================================================
           BUTTON
        ===================================================== */

        .button-group {

            display: flex;

            align-items: center;

            gap: 8px;

        }


        .btn {

            display: inline-flex;

            align-items: center;

            justify-content: center;

            gap: 6px;

            border: none;

            border-radius: 7px;

            padding: 10px 14px;

            text-decoration: none;

            font-size: 12px;

            font-weight: 600;

            cursor: pointer;

            white-space: nowrap;

        }


        .btn svg {

            width: 14px;

            height: 14px;

            display: block;

            flex-shrink: 0;

        }


        .btn-primary {

            background: #1e3a8a;

            color: white;

        }


        .btn-primary:hover {

            background: #1d4ed8;

        }


        .btn-danger {

            background: #dc2626;

            color: white;

        }


        .btn-danger:hover {

            background: #b91c1c;

        }


        .btn-secondary {

            background: #e5e7eb;

            color: #374151;

        }


        .btn-secondary:hover {

            background: #d1d5db;

        }


        /* =====================================================
           SECTION HEADER
        ===================================================== */

        .section-header {

            display: flex;

            align-items: center;

            justify-content: space-between;

            margin-bottom: 12px;

            gap: 15px;

        }


        .section-header h3 {

            margin: 0;

            font-size: 16px;

            color: #1e293b;

        }


        /* =====================================================
           TOMBOL TAHUN
        ===================================================== */

        .year-actions {

            display: flex;

            align-items: center;

            gap: 8px;

        }


        /* =====================================================
           FORM TAMBAH TAHUN
        ===================================================== */

        .form-tahun {

            background: white;

            border:
                1px solid
                #e5e7eb;

            border-radius: 10px;

            padding: 15px;

            margin-bottom: 15px;

        }


        .form-tahun form {

            display: flex;

            align-items: center;

            gap: 10px;

            flex-wrap: wrap;

        }


        .form-tahun label {

            font-size: 13px;

            font-weight: 600;

            color: #374151;

        }


        .form-tahun input {

            width: 140px;

            padding:
                9px 11px;

            border:
                1px solid
                #d1d5db;

            border-radius: 7px;

            font-size: 13px;

        }


        .form-tahun input:focus {

            outline: none;

            border-color: #1e3a8a;

        }


        /* =====================================================
           YEAR GRID
        ===================================================== */

        .year-grid {

            display: grid;

            grid-template-columns:
                repeat(3, minmax(0, 1fr));

            gap: 14px;

        }


        /* =====================================================
           YEAR CARD WRAPPER
        ===================================================== */

        .year-card-wrapper {

            position: relative;

        }


        /* =====================================================
           YEAR CARD
        ===================================================== */

        .year-card {

            display: block;

            background: white;

            border:
                1px solid
                #e5e7eb;

            border-radius: 10px;

            padding: 20px 16px;

            min-height: 120px;

            text-decoration: none;

            transition:
                border-color 0.2s ease,
                box-shadow 0.2s ease,
                transform 0.2s ease;

        }


        .year-card:hover {

            border-color: #1e3a8a;

            box-shadow:
                0 4px 12px
                rgba(30,58,138,0.08);

            transform: translateY(-1px);

        }


        .year-icon {

            width: 38px;

            height: 38px;

            border-radius: 8px;

            background: #eff6ff;

            display: flex;

            align-items: center;

            justify-content: center;

            font-size: 21px;

            margin-bottom: 10px;

        }


        .year-name {

            color: #1e3a8a;

            font-size: 16px;

            font-weight: 700;

            margin-bottom: 5px;

        }


        .year-count {

            color: #64748b;

            font-size: 12px;

        }


        /* =====================================================
           TOMBOL HAPUS TAHUN
        ===================================================== */

        .year-delete {

            position: absolute;

            top: 12px;

            right: 12px;

            width: 30px;

            height: 30px;

            display: flex;

            align-items: center;

            justify-content: center;

            border: none;

            border-radius: 6px;

            background: #fef2f2;

            color: #dc2626;

            cursor: pointer;

            z-index: 5;

            transition:
                background-color 0.2s ease,
                color 0.2s ease;

        }


        .year-delete:hover {

            background: #dc2626;

            color: white;

        }


        .year-delete svg {

            width: 15px;

            height: 15px;

        }


        /* =====================================================
           MODAL KONFIRMASI
        ===================================================== */

        .delete-modal {

            position: fixed;

            inset: 0;

            background: rgba(15, 23, 42, 0.55);

            display: none;

            align-items: center;

            justify-content: center;

            padding: 20px;

            z-index: 9999;

        }


        .delete-modal.show {

            display: flex;

        }


        .delete-modal-box {

            width: 100%;

            max-width: 430px;

            background: white;

            border-radius: 12px;

            padding: 24px;

            box-shadow:
                0 20px 50px
                rgba(0, 0, 0, 0.18);

            animation:
                modalMasuk 0.18s ease;

        }


        @keyframes modalMasuk {

            from {

                opacity: 0;

                transform:
                    translateY(-8px)
                    scale(0.98);

            }

            to {

                opacity: 1;

                transform:
                    translateY(0)
                    scale(1);

            }

        }


        .delete-modal-icon {

            width: 46px;

            height: 46px;

            border-radius: 10px;

            background: #fef2f2;

            color: #dc2626;

            display: flex;

            align-items: center;

            justify-content: center;

            margin-bottom: 15px;

        }


        .delete-modal-icon svg {

            width: 23px;

            height: 23px;

        }


        .delete-modal-box h3 {

            margin: 0 0 8px;

            font-size: 18px;

            color: #1e293b;

        }


        .delete-modal-box p {

            margin: 0;

            color: #64748b;

            font-size: 13px;

            line-height: 1.6;

        }


        .delete-modal-box p strong {

            color: #1e3a8a;

        }


        .delete-modal-actions {

            display: flex;

            justify-content: flex-end;

            gap: 8px;

            margin-top: 22px;

        }


        /* =====================================================
           EMPTY DATA
        ===================================================== */

        .empty-data {

            background: white;

            border:
                1px solid
                #e5e7eb;

            border-radius: 10px;

            text-align: center;

            padding: 50px 20px;

            color: #64748b;

        }


        .empty-icon {

            font-size: 40px;

            margin-bottom: 10px;

        }


        .empty-data h3 {

            margin: 0;

            color: #475569;

            font-size: 16px;

        }


        .empty-data p {

            margin: 7px 0 18px;

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

                width: calc(100% - 78px);

            }


            .category-page {

                padding: 25px;

            }


            .year-grid {

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

                width: calc(100% - 78px);

            }


            .category-page {

                padding: 20px;

            }


            .page-header h1 {

                font-size: 21px;

            }


            .category-box {

                flex-direction: column;

                align-items: stretch;

            }


            .button-group {

                width: 100%;

            }


            .button-group .btn {

                flex: 1;

            }


            .section-header {

                flex-direction: column;

                align-items: stretch;

            }


            .year-actions {

                width: 100%;

            }


            .year-actions .btn {

                flex: 1;

            }


            .year-grid {

                grid-template-columns: 1fr;

            }


            .form-tahun form {

                align-items: stretch;

                flex-direction: column;

            }


            .form-tahun input {

                width: 100%;

            }


            .form-tahun .btn {

                width: 100%;

            }


            .delete-modal-actions {

                flex-direction: column-reverse;

            }


            .delete-modal-actions .btn {

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
             PESAN SISTEM
        ================================================== -->

        <?php if ($pesan !== ''): ?>

            <div
                class="system-message <?php echo $jenis_pesan; ?>"
            >

                <?php

                if ($jenis_pesan === 'success') {

                    echo '✓ ';

                } else {

                    echo '⚠ ';

                }

                echo htmlspecialchars($pesan);

                ?>

            </div>

        <?php endif; ?>


        <!-- =================================================
             HEADER
        ================================================== -->

        <div class="page-header">

            <h1>
                Arsip Dokumen
            </h1>

            <p>
                Kelola dokumen berdasarkan kategori dan tahun.
            </p>

        </div>


        <!-- =================================================
             INFORMASI KATEGORI
        ================================================== -->

        <div class="category-box">


            <div class="category-info">


                <div class="category-icon">
                    📁
                </div>


                <div class="category-text">

                    <h2>

                        <?php

                        echo htmlspecialchars(
                            $nama_kategori
                        );

                        ?>

                    </h2>


                    <p>

                        Dokumen anggota Dewan:

                        <strong>

                            <?php

                            echo htmlspecialchars(
                                $dewan['nama'] ?? '-'
                            );

                            ?>

                        </strong>

                    </p>

                </div>


            </div>


            <!-- =================================================
                 ACTION KATEGORI
            ================================================== -->

            <div class="button-group">


                <!-- EDIT KATEGORI -->

                <a
                    href="edit_kategori.php?id=<?php echo $kategori_id; ?>&dewan_id=<?php echo $dewan_id; ?>"
                    class="btn btn-primary"
                    title="Edit Kategori"
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

                    Edit Kategori

                </a>


                <!-- HAPUS KATEGORI -->

                <a
                    href="hapus_kategori.php?id=<?php echo $kategori_id; ?>&dewan_id=<?php echo $dewan_id; ?>"
                    class="btn btn-danger"
                    title="Hapus Kategori"
                    onclick="return confirm('Apakah Anda yakin ingin menghapus kategori ini?');"
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

                        <polyline
                            points="3 6 5 6 21 6"
                        />

                        <path
                            d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
                        />

                        <path
                            d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                        />

                    </svg>

                    Hapus

                </a>


            </div>


        </div>


        <!-- =================================================
             HEADER TAHUN
        ================================================== -->

        <div class="section-header">


            <h3>
                Tahun Dokumen
            </h3>


            <div class="year-actions">


                <!-- TAMBAH TAHUN -->

                <button
                    type="button"
                    class="btn btn-primary"
                    onclick="tampilkanFormTahun()"
                    title="Tambah Tahun"
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

                        <line
                            x1="12"
                            y1="5"
                            x2="12"
                            y2="19"
                        />

                        <line
                            x1="5"
                            y1="12"
                            x2="19"
                            y2="12"
                        />

                    </svg>

                    Tambah Tahun

                </button>


                <!-- TAMBAH DOKUMEN -->

                <a
                    href="tambah_dokumen.php?dewan_id=<?php echo $dewan_id; ?>&kategori_id=<?php echo $kategori_id; ?>"
                    class="btn btn-primary"
                    title="Tambah Dokumen"
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
                            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                        />

                        <polyline
                            points="14 2 14 8 20 8"
                        />

                        <line
                            x1="12"
                            y1="11"
                            x2="12"
                            y2="17"
                        />

                        <line
                            x1="9"
                            y1="14"
                            x2="15"
                            y2="14"
                        />

                    </svg>

                    Tambah Dokumen

                </a>


            </div>


        </div>


        <!-- =================================================
             FORM TAMBAH TAHUN
        ================================================== -->

        <div
            id="formTahun"
            class="form-tahun"
            style="display: none;"
        >


            <form
                action="proses_tambah_tahun.php"
                method="POST"
            >


                <input
                    type="hidden"
                    name="dewan_id"
                    value="<?php echo $dewan_id; ?>"
                >


                <input
                    type="hidden"
                    name="kategori_id"
                    value="<?php echo $kategori_id; ?>"
                >


                <label
                    for="tahun"
                >

                    Tahun

                </label>


                <input
                    type="number"
                    name="tahun"
                    id="tahun"
                    min="1900"
                    max="2100"
                    placeholder="Contoh: 2024"
                    required
                    autofocus
                >


                <button
                    type="submit"
                    class="btn btn-primary"
                >

                    Simpan

                </button>


                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick="sembunyikanFormTahun()"
                >

                    Batal

                </button>


            </form>


        </div>


        <!-- =================================================
             DAFTAR TAHUN
        ================================================== -->

        <?php if ($ada_tahun): ?>


            <div class="year-grid">


                <?php foreach ($tahun_list as $tahun_data): ?>


                    <?php

                    $tahun =
                        $tahun_data['tahun'];

                    $jumlah =
                        intval(
                            $tahun_data['jumlah_dokumen']
                        );

                    ?>


                    <div class="year-card-wrapper">


                        <!-- KARTU TAHUN -->

                        <a
                            href="dokumen_tahun.php?dewan_id=<?php echo $dewan_id; ?>&kategori_id=<?php echo $kategori_id; ?>&tahun=<?php echo urlencode($tahun); ?>"
                            class="year-card"
                        >


                            <div class="year-icon">
                                📁
                            </div>


                            <div class="year-name">

                                <?php

                                echo htmlspecialchars(
                                    $tahun
                                );

                                ?>

                            </div>


                            <div class="year-count">

                                <?php

                                echo $jumlah;

                                ?>

                                dokumen

                            </div>


                        </a>


                    </div>


                <?php endforeach; ?>


            </div>


        <?php else: ?>


            <!-- =================================================
                 BELUM ADA TAHUN
            ================================================== -->

            <div class="empty-data">


                <div class="empty-icon">
                    📁
                </div>


                <h3>
                    Belum Ada Folder Tahun
                </h3>


                <p>
                    Belum ada folder tahun pada kategori ini.
                </p>


                <button
                    type="button"
                    class="btn btn-primary"
                    onclick="tampilkanFormTahun()"
                >

                    + Tambah Tahun

                </button>


            </div>


        <?php endif; ?>


    </section>


</main>


<!-- =====================================================
     MODAL KONFIRMASI HAPUS TAHUN
===================================================== -->

<div
    id="modalHapusTahun"
    class="delete-modal"
>


    <div
        class="delete-modal-box"
        onclick="event.stopPropagation()"
    >


        <div class="delete-modal-icon">

            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >

                <polyline
                    points="3 6 5 6 21 6"
                />

                <path
                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
                />

                <path
                    d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                />

            </svg>

        </div>


        <h3>
            Hapus Tahun
        </h3>


        <p>

            Apakah Anda yakin ingin menghapus tahun

            <strong id="namaTahunHapus">
                -
            </strong>

            beserta seluruh folder dan dokumen di dalamnya?

        </p>


        <div class="delete-modal-actions">


            <button
                type="button"
                class="btn btn-secondary"
                onclick="tutupModalHapusTahun()"
            >

                Batal

            </button>


            <form
                id="formHapusTahun"
                action="hapus_tahun.php"
                method="POST"
                style="margin:0;"
            >


                <input
                    type="hidden"
                    name="dewan_id"
                    value="<?php echo $dewan_id; ?>"
                >


                <input
                    type="hidden"
                    name="kategori_id"
                    value="<?php echo $kategori_id; ?>"
                >


                <input
                    type="hidden"
                    name="tahun"
                    id="tahunHapus"
                    value=""
                >


                <button
                    type="submit"
                    class="btn btn-danger"
                >

                    Hapus Tahun

                </button>


            </form>


        </div>


    </div>


</div>


<script>

/* =====================================================
   TAMPILKAN FORM TAHUN
===================================================== */

function tampilkanFormTahun() {

    const form =
        document.getElementById("formTahun");

    form.style.display = "block";


    const input =
        document.getElementById("tahun");

    if (input) {

        input.focus();

    }

}


/* =====================================================
   SEMBUNYIKAN FORM TAHUN
===================================================== */

function sembunyikanFormTahun() {

    const form =
        document.getElementById("formTahun");

    form.style.display = "none";

}


/* =====================================================
   BUKA MODAL HAPUS TAHUN
===================================================== */

function bukaModalHapusTahun(event, tahun) {

    event.preventDefault();

    event.stopPropagation();


    const modal =
        document.getElementById("modalHapusTahun");

    const namaTahun =
        document.getElementById("namaTahunHapus");

    const inputTahun =
        document.getElementById("tahunHapus");


    namaTahun.textContent =
        tahun;


    inputTahun.value =
        tahun;


    modal.classList.add("show");

}


/* =====================================================
   TUTUP MODAL HAPUS TAHUN
===================================================== */

function tutupModalHapusTahun() {

    const modal =
        document.getElementById("modalHapusTahun");

    modal.classList.remove("show");

}


/* =====================================================
   KLIK AREA LUAR MODAL
===================================================== */

document
    .getElementById("modalHapusTahun")
    .addEventListener(
        "click",
        function () {

            tutupModalHapusTahun();

        }
    );


/* =====================================================
   TOMBOL ESC
===================================================== */

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Escape") {

            tutupModalHapusTahun();

        }

    }
);

</script>


</body>

</html>


<?php

/* =====================================================
   TUTUP STATEMENT TAHUN
===================================================== */

mysqli_stmt_close($stmt_tahun);

?>