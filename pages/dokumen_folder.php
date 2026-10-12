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
   PARAMETER DARI URL
===================================================== */

$dewan_id    = intval($_GET['dewan_id'] ?? 0);
$kategori_id = intval($_GET['kategori_id'] ?? 0);
$tahun       = intval($_GET['tahun'] ?? 0);

$nama_folder = trim(
    $_GET['nama_folder'] ?? ''
);


/* =====================================================
   VALIDASI PARAMETER
===================================================== */

if (
    $dewan_id <= 0 ||
    $kategori_id <= 0 ||
    $tahun <= 0 ||
    $nama_folder === ''
) {
    header("Location: dewan.php");
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

mysqli_stmt_execute(
    $stmt_dewan
);

$result_dewan = mysqli_stmt_get_result(
    $stmt_dewan
);

$dewan = mysqli_fetch_assoc(
    $result_dewan
);

mysqli_stmt_close(
    $stmt_dewan
);


if (!$dewan) {

    echo "Data anggota Dewan tidak ditemukan.";
    exit;

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

mysqli_stmt_execute(
    $stmt_kategori
);

$result_kategori = mysqli_stmt_get_result(
    $stmt_kategori
);

$kategori = mysqli_fetch_assoc(
    $result_kategori
);

mysqli_stmt_close(
    $stmt_kategori
);


if (!$kategori) {

    echo "Kategori dokumen tidak ditemukan.";
    exit;

}


$nama_kategori =
    $kategori['nama_kategori']
    ?? 'Kategori Dokumen';


/* =====================================================
   AMBIL DOKUMEN DALAM FOLDER
===================================================== */

$stmt_dokumen = mysqli_prepare(
    $conn,
    "SELECT *
     FROM dokumen
     WHERE dewan_id = ?
       AND kategori_id = ?
       AND tahun = ?
       AND TRIM(nama_folder) = TRIM(?)
     ORDER BY tanggal_upload DESC"
);

mysqli_stmt_bind_param(
    $stmt_dokumen,
    "iiis",
    $dewan_id,
    $kategori_id,
    $tahun,
    $nama_folder
);

mysqli_stmt_execute(
    $stmt_dokumen
);

$query_dokumen = mysqli_stmt_get_result(
    $stmt_dokumen
);


/* =====================================================
   JUMLAH DOKUMEN
===================================================== */

$jumlah_dokumen = mysqli_num_rows(
    $query_dokumen
);


/* =====================================================
   URL KEMBALI KE DAFTAR FOLDER
===================================================== */

$url_kembali =
    "dokumen_tahun.php"
    . "?dewan_id="
    . $dewan_id
    . "&kategori_id="
    . $kategori_id
    . "&tahun="
    . $tahun;


/* =====================================================
   URL TAMBAH DOKUMEN
===================================================== */

$url_tambah =
    "tambah_dokumen.php"
    . "?dewan_id="
    . $dewan_id
    . "&kategori_id="
    . $kategori_id
    . "&tahun="
    . $tahun
    . "&nama_folder="
    . urlencode(
        $nama_folder
    );


/* =====================================================
   URL EDIT FOLDER
===================================================== */

$url_edit_folder =
    "edit_folder.php"
    . "?dewan_id="
    . $dewan_id
    . "&kategori_id="
    . $kategori_id
    . "&tahun="
    . $tahun
    . "&nama_folder="
    . urlencode(
        $nama_folder
    );


/* =====================================================
   URL HAPUS FOLDER
===================================================== */

$url_hapus_folder =
    "hapus_folder.php"
    . "?dewan_id="
    . $dewan_id
    . "&kategori_id="
    . $kategori_id
    . "&tahun="
    . $tahun
    . "&nama_folder="
    . urlencode(
        $nama_folder
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

        <?php

        echo htmlspecialchars(
            $nama_folder
        );

        ?>

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
                margin-left 0.25s ease,
                width 0.25s ease;

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
           KEMBALI
        ===================================================== */

        .back-navigation {

            margin-bottom: 20px;
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
        }


        .back-navigation a:hover {

            background: #1d4ed8;
        }


        /* =====================================================
           HEADER
        ===================================================== */

        .page-header {

            margin-bottom: 20px;
        }


        .folder-title-row {

            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 15px;

            width: 100%;
        }


        .page-header h1 {

            margin: 0 0 6px;

            font-size: 24px;

            color: #1e293b;

            line-height: 1.4;
        }


        .folder-title-row h1 {

            margin: 0;
        }


        .page-header p {

            margin: 0;

            color: #64748b;

            font-size: 13px;

            line-height: 1.6;
        }


        /* =====================================================
           AKSI FOLDER KANAN ATAS
        ===================================================== */

        .folder-page-actions {

            display: flex;

            align-items: center;

            gap: 7px;

            flex-shrink: 0;
        }


        .icon-action {

            width: 32px;

            height: 32px;

            display: inline-flex;

            align-items: center;

            justify-content: center;

            border-radius: 7px;

            border: none;

            text-decoration: none;

            cursor: pointer;

            transition:
                background-color 0.2s ease,
                color 0.2s ease;
        }


        .icon-action svg {

            width: 16px;

            height: 16px;

            display: block;
        }


        .icon-action.edit {

            background: #eff6ff;

            color: #1e3a8a;
        }


        .icon-action.edit:hover {

            background: #dbeafe;

            color: #1d4ed8;
        }


        .icon-action.delete {

            background: #fef2f2;

            color: #dc2626;
        }


        .icon-action.delete:hover {

            background: #fee2e2;

            color: #b91c1c;
        }


        /* =====================================================
           INFO
        ===================================================== */

        .info-box {

            background: white;

            border:
                1px solid #e5e7eb;

            border-radius: 10px;

            padding: 15px 18px;

            margin-bottom: 20px;
        }


        .info-row {

            display: flex;

            flex-wrap: wrap;

            gap: 8px 25px;
        }


        .info-item {

            font-size: 12px;

            color: #64748b;
        }


        .info-item strong {

            color: #1e3a8a;
        }


        /* =====================================================
           HEADER DOKUMEN
        ===================================================== */

        .document-header {

            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 15px;

            margin-bottom: 14px;
        }


        .document-header h3 {

            margin: 0;

            font-size: 16px;

            color: #1e293b;
        }


        /* =====================================================
           BUTTON
        ===================================================== */

        .btn {

            display: inline-flex;

            align-items: center;

            justify-content: center;

            gap: 6px;

            padding: 9px 14px;

            border-radius: 7px;

            text-decoration: none;

            font-size: 12px;

            font-weight: 600;

            border: none;

            cursor: pointer;

            white-space: nowrap;
        }


        .btn-primary {

            background: #1e3a8a;

            color: white;
        }


        .btn-primary:hover {

            background: #1d4ed8;
        }


        .btn-edit {

            background: #1e3a8a;

            color: white;
        }


        .btn-edit:hover {

            background: #1d4ed8;
        }


        .btn-delete {

            background: #dc2626;

            color: white;

            cursor: pointer;
        }


        .btn-delete:hover {

            background: #b91c1c;
        }


        /* =====================================================
           IKON BUTTON
        ===================================================== */

        .btn-icon {

            width: 14px;

            height: 14px;

            display: block;

            flex-shrink: 0;
        }


        .btn-action .btn-icon {

            width: 13px;

            height: 13px;

        }


        /* =====================================================
           TABLE
        ===================================================== */

        .table-box {

            background: white;

            border:
                1px solid #e5e7eb;

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

            padding: 12px;

            font-size: 12px;

            color: #475569;

            border-bottom:
                1px solid #e5e7eb;
        }


        td {

            padding: 12px;

            font-size: 13px;

            color: #334155;

            border-bottom:
                1px solid #f1f5f9;

            vertical-align: top;
        }


        tr:last-child td {

            border-bottom: none;
        }


        /* =====================================================
           FILE
        ===================================================== */

        .file-link {

            display: inline-flex;

            align-items: center;

            gap: 6px;

            color: #1e3a8a;

            text-decoration: none;

            font-weight: 600;

            word-break: break-word;
        }


        .file-link:hover {

            text-decoration: underline;
        }


        /* =====================================================
           KETERANGAN
        ===================================================== */

        .document-description {

            color: #64748b;

            font-size: 12px;

            line-height: 1.5;

            max-width: 350px;

            word-wrap: break-word;
        }


        /* =====================================================
           AKSI DOKUMEN
        ===================================================== */

        .document-actions {

            display: flex;

            gap: 5px;

            flex-wrap: wrap;
        }


        .btn-action {

            display: inline-flex;

            align-items: center;

            justify-content: center;

            gap: 5px;

            padding: 6px 9px;

            border-radius: 6px;

            text-decoration: none;

            font-size: 11px;

            font-weight: 600;
        }


        /* =====================================================
           EMPTY
        ===================================================== */

        .empty-document {

            background: white;

            border:
                1px solid #e5e7eb;

            border-radius: 10px;

            min-height: 250px;

            display: flex;

            flex-direction: column;

            justify-content: center;

            align-items: center;

            text-align: center;

            padding: 35px 20px;
        }


        .empty-document-icon {

            font-size: 40px;

            margin-bottom: 12px;
        }


        .empty-document h3 {

            margin: 0 0 8px;

            color: #475569;

            font-size: 17px;
        }


        .empty-document p {

            margin: 0 0 18px;

            color: #64748b;

            font-size: 13px;

            line-height: 1.6;
        }


        /* =====================================================
           MODAL KONFIRMASI HAPUS
        ===================================================== */

        .delete-modal-overlay {

            display: none;

            position: fixed;

            top: 0;

            left: 0;

            width: 100%;

            height: 100%;

            background:
                rgba(15, 23, 42, 0.45);

            z-index: 9999;

            align-items: center;

            justify-content: center;

            padding: 20px;
        }


        .delete-modal-overlay.show {

            display: flex;

        }


        .delete-modal {

            width: 400px;

            max-width: 100%;

            background: white;

            border-radius: 12px;

            padding: 24px;

            box-shadow:
                0 15px 40px
                rgba(0, 0, 0, 0.20);

            animation:
                modalMuncul 0.18s ease-out;
        }


        @keyframes modalMuncul {

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

            margin-bottom: 14px;

            border-radius: 50%;

            background: #fef2f2;

            color: #dc2626;

            display: flex;

            align-items: center;

            justify-content: center;
        }


        .delete-modal-icon svg {

            width: 22px;

            height: 22px;
        }


        .delete-modal-title {

            margin: 0 0 8px;

            color: #1e293b;

            font-size: 18px;

            font-weight: 700;
        }


        .delete-modal-text {

            margin: 0 0 22px;

            color: #64748b;

            font-size: 13px;

            line-height: 1.6;
        }


        .delete-modal-actions {

            display: flex;

            justify-content: flex-end;

            gap: 8px;
        }


        .modal-btn {

            border: none;

            border-radius: 7px;

            padding: 9px 15px;

            font-size: 12px;

            font-weight: 600;

            cursor: pointer;

            text-decoration: none;

            display: inline-flex;

            align-items: center;

            justify-content: center;
        }


        .modal-btn-cancel {

            background: #e5e7eb;

            color: #374151;
        }


        .modal-btn-cancel:hover {

            background: #d1d5db;
        }


        .modal-btn-delete {

            background: #dc2626;

            color: white;
        }


        .modal-btn-delete:hover {

            background: #b91c1c;
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

                margin-left: 75px;
            }


            .main-content.sidebar-collapsed {

                margin-left: 78px;

            }


            .page {

                padding: 20px;
            }


            .folder-title-row {

                align-items: flex-start;

            }


            .folder-page-actions {

                flex-shrink: 0;

            }


            .document-header {

                flex-direction: column;

                align-items: flex-start;
            }


            .table-box {

                overflow-x: auto;
            }


            table {

                min-width: 850px;
            }


            .delete-modal {

                padding: 20px;

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

    <section class="page">


        <!-- =================================================
             KEMBALI
        ================================================== -->

        <div class="back-navigation">

            <a
                href="<?php
                echo htmlspecialchars(
                    $url_kembali
                );
                ?>"
            >

                ← Kembali

            </a>

        </div>


        <!-- =================================================
             HEADER
        ================================================== -->

        <div class="page-header">


            <div class="folder-title-row">


                <h1>

                    📁

                    <?php

                    echo htmlspecialchars(
                        $nama_folder
                    );

                    ?>

                </h1>


                <!-- =================================================
                     AKSI FOLDER
                ================================================== -->

                <div class="folder-page-actions">


                    <!-- EDIT FOLDER -->

                    <a
                        href="<?php
                        echo htmlspecialchars(
                            $url_edit_folder
                        );
                        ?>"
                        class="icon-action edit"
                        title="Edit Folder"
                        aria-label="Edit Folder"
                    >

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >

                            <path
                                d="M12 20h9"
                            />

                            <path
                                d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z"
                            />

                        </svg>

                    </a>


                    <!-- HAPUS FOLDER -->

                    <button
                        type="button"
                        class="icon-action delete"
                        title="Hapus Folder"
                        aria-label="Hapus Folder"
                        onclick="bukaModalHapusFolder()"
                    >

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

                            <line
                                x1="10"
                                y1="11"
                                x2="10"
                                y2="17"
                            />

                            <line
                                x1="14"
                                y1="11"
                                x2="14"
                                y2="17"
                            />

                        </svg>

                    </button>


                </div>


            </div>


            <p>

                Daftar dokumen dalam folder

                <strong>

                    <?php

                    echo htmlspecialchars(
                        $nama_folder
                    );

                    ?>

                </strong>

            </p>


        </div>


        <!-- =================================================
             INFORMASI
        ================================================== -->

        <div class="info-box">

            <div class="info-row">


                <div class="info-item">

                    Anggota Dewan:

                    <strong>

                        <?php

                        echo htmlspecialchars(
                            $dewan['nama'] ?? '-'
                        );

                        ?>

                    </strong>

                </div>


                <div class="info-item">

                    Kategori:

                    <strong>

                        <?php

                        echo htmlspecialchars(
                            $nama_kategori
                        );

                        ?>

                    </strong>

                </div>


                <div class="info-item">

                    Tahun:

                    <strong>

                        <?php

                        echo htmlspecialchars(
                            $tahun
                        );

                        ?>

                    </strong>

                </div>


                <div class="info-item">

                    Folder:

                    <strong>

                        <?php

                        echo htmlspecialchars(
                            $nama_folder
                        );

                        ?>

                    </strong>

                </div>


            </div>

        </div>


        <!-- =================================================
             HEADER DOKUMEN
        ================================================== -->

        <?php if ($jumlah_dokumen > 0) { ?>

            <div class="document-header">


                <h3>

                    File Dokumen

                </h3>


                <a
                    href="<?php
                    echo htmlspecialchars(
                        $url_tambah
                    );
                    ?>"
                    class="btn btn-primary"
                >

                    <!-- IKON TAMBAH DOKUMEN -->

                    <svg
                        class="btn-icon"
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

        <?php } ?>


        <!-- =================================================
             DAFTAR DOKUMEN
        ================================================== -->

        <?php if ($jumlah_dokumen > 0) { ?>


            <div class="table-box">

                <table>

                    <thead>

                        <tr>

                            <th width="5%">
                                No
                            </th>

                            <th width="22%">
                                Nama Dokumen
                            </th>

                            <th width="18%">
                                Tanggal Upload
                            </th>

                            <th width="25%">
                                Keterangan
                            </th>

                            <th width="20%">
                                File
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
                        $dokumen =
                        mysqli_fetch_assoc(
                            $query_dokumen
                        )
                    ) {

                        $url_hapus =
                            "hapus_dokumen.php"
                            . "?id="
                            . urlencode(
                                $dokumen['id']
                            )
                            . "&dewan_id="
                            . $dewan_id
                            . "&kategori_id="
                            . $kategori_id
                            . "&tahun="
                            . $tahun
                            . "&nama_folder="
                            . urlencode(
                                $nama_folder
                            );

                    ?>


                        <tr>


                            <!-- NO -->

                            <td>

                                <?php

                                echo $no++;

                                ?>

                            </td>


                            <!-- NAMA DOKUMEN -->

                            <td>

                                <?php

                                echo htmlspecialchars(
                                    $dokumen['nama_dokumen']
                                    ?? '-'
                                );

                                ?>

                            </td>


                            <!-- TANGGAL -->

                            <td>

                                <?php

                                echo htmlspecialchars(
                                    $dokumen['tanggal_upload']
                                    ?? '-'
                                );

                                ?>

                            </td>


                            <!-- KETERANGAN -->

                            <td>

                                <?php

                                if (
                                    !empty(
                                        $dokumen['keterangan']
                                    )
                                ) {

                                    echo
                                        '<div class="document-description">';

                                    echo nl2br(
                                        htmlspecialchars(
                                            $dokumen['keterangan']
                                        )
                                    );

                                    echo '</div>';

                                } else {

                                    echo
                                        '<span style="color:#94a3b8;">-</span>';

                                }

                                ?>

                            </td>


                            <!-- FILE -->

                            <td>

                                <?php

                                if (
                                    !empty(
                                        $dokumen['path_file']
                                    )
                                ) {

                                ?>

                                    <a
                                        href="../<?php

                                        echo htmlspecialchars(
                                            $dokumen['path_file']
                                        );

                                        ?>"
                                        target="_blank"
                                        class="file-link"
                                    >

                                        📄

                                        <?php

                                        echo htmlspecialchars(
                                            $dokumen['nama_file']
                                            ?? 'Lihat File'
                                        );

                                        ?>

                                    </a>


                                <?php

                                } elseif (
                                    !empty(
                                        $dokumen['nama_file']
                                    )
                                ) {

                                ?>

                                    <a
                                        href="../uploads/dokumen/<?php

                                        echo rawurlencode(
                                            $dokumen['nama_file']
                                        );

                                        ?>"
                                        target="_blank"
                                        class="file-link"
                                    >

                                        📄

                                        <?php

                                        echo htmlspecialchars(
                                            $dokumen['nama_file']
                                        );

                                        ?>

                                    </a>


                                <?php

                                } else {

                                ?>

                                    <span
                                        style="color:#94a3b8;"
                                    >

                                        Tidak ada file

                                    </span>

                                <?php

                                }

                                ?>

                            </td>


                            <!-- AKSI -->

                            <td>

                                <div
                                    class="document-actions"
                                >


                                    <!-- EDIT -->

                                    <a
                                        href="edit_dokumen.php?id=<?php
                                        echo $dokumen['id'];
                                        ?>"
                                        class="btn-action btn-edit"
                                        title="Edit Dokumen"
                                    >

                                        <svg
                                            class="btn-icon"
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

                                        Edit

                                    </a>


                                    <!-- HAPUS -->

                                    <a
                                        href="#"
                                        class="btn-action btn-delete"
                                        title="Hapus Dokumen"
                                        onclick='konfirmasiHapus(<?php
                                            echo htmlspecialchars(
                                                json_encode(
                                                    $url_hapus,
                                                    JSON_UNESCAPED_SLASHES
                                                ),
                                                ENT_QUOTES,
                                                "UTF-8"
                                            );
                                        ?>); return false;'
                                    >

                                        <svg
                                            class="btn-icon"
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
                                                d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                                            />

                                            <line
                                                x1="10"
                                                y1="11"
                                                x2="10"
                                                y2="17"
                                            />

                                            <line
                                                x1="14"
                                                y1="11"
                                                x2="14"
                                                y2="17"
                                            />

                                        </svg>

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

            </div>


        <?php } else { ?>


            <!-- =================================================
                 KOSONG
            ================================================== -->

            <div class="empty-document">


                <div class="empty-document-icon">

                    📁

                </div>


                <h3>

                    Belum Ada Dokumen

                </h3>


                <p>

                    Belum ada file di dalam folder

                    <strong>

                        <?php

                        echo htmlspecialchars(
                            $nama_folder
                        );

                        ?>

                    </strong>.

                </p>


                <a
                    href="<?php
                    echo htmlspecialchars(
                        $url_tambah
                    );
                    ?>"
                    class="btn btn-primary"
                >

                    <!-- IKON TAMBAH DOKUMEN FORMAL -->

                    <svg
                        class="btn-icon"
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


        <?php } ?>


    </section>


    <!-- =====================================================
         MODAL KONFIRMASI HAPUS DOKUMEN
    ====================================================== -->

    <div
        class="delete-modal-overlay"
        id="deleteModal"
    >

        <div
            class="delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleteModalTitle"
        >


            <!-- IKON SAMPAH -->

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
                        d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    />

                    <line
                        x1="10"
                        y1="11"
                        x2="10"
                        y2="17"
                    />

                    <line
                        x1="14"
                        y1="11"
                        x2="14"
                        y2="17"
                    />

                </svg>

            </div>


            <!-- JUDUL -->

            <h3
                class="delete-modal-title"
                id="deleteModalTitle"
            >

                Hapus Dokumen

            </h3>


            <!-- PESAN -->

            <p class="delete-modal-text">

                Apakah Anda yakin ingin menghapus dokumen ini?

            </p>


            <!-- TOMBOL -->

            <div class="delete-modal-actions">


                <button
                    type="button"
                    class="modal-btn modal-btn-cancel"
                    onclick="tutupModalHapus()"
                >

                    Batal

                </button>


                <a
                    href="#"
                    id="btnHapusDokumen"
                    class="modal-btn modal-btn-delete"
                >

                    Hapus

                </a>


            </div>


        </div>

    </div>


    <!-- =====================================================
         MODAL KONFIRMASI HAPUS FOLDER
    ====================================================== -->

    <div
        class="delete-modal-overlay"
        id="deleteFolderModal"
    >

        <div
            class="delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleteFolderModalTitle"
        >


            <!-- IKON SAMPAH -->

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

                    <line
                        x1="10"
                        y1="11"
                        x2="10"
                        y2="17"
                    />

                    <line
                        x1="14"
                        y1="11"
                        x2="14"
                        y2="17"
                    />

                </svg>

            </div>


            <!-- JUDUL -->

            <h3
                class="delete-modal-title"
                id="deleteFolderModalTitle"
            >

                Hapus Folder

            </h3>


            <!-- PESAN -->

            <p class="delete-modal-text">

                Apakah Anda yakin ingin menghapus folder

                <strong>

                    <?php

                    echo htmlspecialchars(
                        $nama_folder
                    );

                    ?>

                </strong>

                beserta dokumen di dalamnya?

            </p>


            <!-- TOMBOL -->

            <div class="delete-modal-actions">


                <button
                    type="button"
                    class="modal-btn modal-btn-cancel"
                    onclick="tutupModalHapusFolder()"
                >

                    Batal

                </button>


                <a
                    href="<?php
                    echo htmlspecialchars(
                        $url_hapus_folder
                    );
                    ?>"
                    class="modal-btn modal-btn-delete"
                >

                    Hapus

                </a>


            </div>


        </div>

    </div>


</main>


<!-- =====================================================
     JAVASCRIPT MODAL
===================================================== -->

<script>


/* =====================================================
   MODAL HAPUS DOKUMEN
===================================================== */

function konfirmasiHapus(url) {

    const modal =
        document.getElementById(
            "deleteModal"
        );

    const tombolHapus =
        document.getElementById(
            "btnHapusDokumen"
        );

    if (!modal || !tombolHapus) {
        return;
    }

    tombolHapus.href = url;

    modal.classList.add("show");

}


function tutupModalHapus() {

    const modal =
        document.getElementById(
            "deleteModal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove("show");

}


/* =====================================================
   MODAL HAPUS FOLDER
===================================================== */

function bukaModalHapusFolder() {

    const modal =
        document.getElementById(
            "deleteFolderModal"
        );

    if (!modal) {
        return;
    }

    modal.classList.add("show");

}


function tutupModalHapusFolder() {

    const modal =
        document.getElementById(
            "deleteFolderModal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove("show");

}


/* =====================================================
   ESCAPE
===================================================== */

document.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Escape") {

            tutupModalHapus();

            tutupModalHapusFolder();

        }

    }
);


/* =====================================================
   KLIK DI LUAR MODAL DOKUMEN
===================================================== */

const deleteModal =
    document.getElementById(
        "deleteModal"
    );

if (deleteModal) {

    deleteModal.addEventListener(
        "click",
        function(event) {

            if (event.target === this) {

                tutupModalHapus();

            }

        }
    );

}


/* =====================================================
   KLIK DI LUAR MODAL FOLDER
===================================================== */

const deleteFolderModal =
    document.getElementById(
        "deleteFolderModal"
    );

if (deleteFolderModal) {

    deleteFolderModal.addEventListener(
        "click",
        function(event) {

            if (event.target === this) {

                tutupModalHapusFolder();

            }

        }
    );

}

</script>


</body>

</html>


<?php

/* =====================================================
   TUTUP STATEMENT
===================================================== */

mysqli_stmt_close(
    $stmt_dokumen
);

?>