<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";

$nama_user = $_SESSION['nama'] ?? 'Staff';
$role      = $_SESSION['role'] ?? 'Staff';

$dewan_id    = intval($_GET['dewan_id'] ?? 0);
$kategori_id = intval($_GET['kategori_id'] ?? 0);
$tahun       = intval($_GET['tahun'] ?? 0);

if (
    $dewan_id <= 0 ||
    $kategori_id <= 0 ||
    $tahun <= 0
) {
    header("Location: dewan.php");
    exit;
}

$error   = $_GET['error'] ?? '';
$success = $_GET['success'] ?? '';

$pesan = '';
$jenis_pesan = '';

if ($error !== '') {
    $pesan = $error;
    $jenis_pesan = "error";
}

if ($success !== '') {
    $pesan = $success;
    $jenis_pesan = "success";
}

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

$result_dewan = mysqli_stmt_get_result($stmt_dewan);

$dewan = mysqli_fetch_assoc($result_dewan);

mysqli_stmt_close($stmt_dewan);

if (!$dewan) {
    echo "Data anggota Dewan tidak ditemukan.";
    exit;
}

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

$result_kategori = mysqli_stmt_get_result($stmt_kategori);

$kategori = mysqli_fetch_assoc($result_kategori);

mysqli_stmt_close($stmt_kategori);

if (!$kategori) {
    echo "Kategori dokumen tidak ditemukan.";
    exit;
}

$nama_kategori =
    $kategori['nama_kategori']
    ?? 'Kategori Dokumen';

$stmt_folder = mysqli_prepare(
    $conn,
    "
    SELECT
        f.id,
        f.nama_folder,
        COUNT(d.id) AS jumlah_dokumen
    FROM folder_dokumen f
    LEFT JOIN dokumen d
        ON d.dewan_id = f.dewan_id
       AND d.kategori_id = f.kategori_id
       AND d.tahun = f.tahun
       AND TRIM(d.nama_folder) = TRIM(f.nama_folder)
    WHERE f.dewan_id = ?
      AND f.kategori_id = ?
      AND f.tahun = ?
    GROUP BY
        f.id,
        f.nama_folder
    ORDER BY
        f.nama_folder ASC
    "
);

mysqli_stmt_bind_param(
    $stmt_folder,
    "iii",
    $dewan_id,
    $kategori_id,
    $tahun
);

mysqli_stmt_execute($stmt_folder);

$query_folder = mysqli_stmt_get_result($stmt_folder);

$folder_list = [];

if ($query_folder) {
    while ($folder_data = mysqli_fetch_assoc($query_folder)) {
        $folder_list[] = $folder_data;
    }
}

$ada_folder = count($folder_list) > 0;

$url_kembali =
    "kategori_dokumen.php"
    . "?dewan_id="
    . $dewan_id
    . "&kategori_id="
    . $kategori_id;

$url_edit_tahun =
    "edit_tahun.php"
    . "?dewan_id="
    . $dewan_id
    . "&kategori_id="
    . $kategori_id
    . "&tahun="
    . $tahun;

$url_hapus_tahun =
    "hapus_tahun.php"
    . "?dewan_id="
    . $dewan_id
    . "&kategori_id="
    . $kategori_id
    . "&tahun="
    . $tahun;

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
        Tahun <?php echo htmlspecialchars($tahun); ?>
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

        .page {
            padding: 32px;
        }

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
            transition:
                background-color 0.2s ease;
        }

        .back-navigation a:hover {
            background: #1d4ed8;
        }

        .system-message {
            padding:
                12px 15px;
            border-radius: 7px;
            margin-bottom: 18px;
            font-size: 13px;
            line-height: 1.5;
        }

        .system-message.success {
            background: #f0fdf4;
            border:
                1px solid #86efac;
            color: #166534;
        }

        .system-message.error {
            background: #fef2f2;
            border:
                1px solid #fca5a5;
            color: #b91c1c;
        }

        .page-header {
            margin-bottom: 20px;
        }

        .year-title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        }

        .year-title-row h1 {
            margin: 0;
            font-size: 24px;
            line-height: 1.4;
            color: #1e293b;
        }

        .page-header p {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
        }

        .year-actions-top {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .icon-action {
            width: 34px;
            height: 34px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 7px;
            text-decoration: none;
            border: none;
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
        }

        .icon-action.delete {
            background: #fef2f2;
            color: #dc2626;
        }

        .icon-action.delete:hover {
            background: #fee2e2;
        }

        .info-box {
            background: white;
            border:
                1px solid #e5e7eb;
            border-radius: 10px;
            padding: 15px 18px;
            margin-bottom: 22px;
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

        .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 14px;
        }

        .section-header h3 {
            margin: 0;
            font-size: 16px;
            color: #1e293b;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 9px 14px;
            border-radius: 7px;
            border: none;
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

        .btn-secondary {
            background: #e5e7eb;
            color: #374151;
        }

        .btn-secondary:hover {
            background: #d1d5db;
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
        }

        .btn-delete:hover {
            background: #b91c1c;
        }

        .folder-form {
            background: white;
            border:
                1px solid #e5e7eb;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 18px;
            display: none;
        }

        .folder-form.show {
            display: block;
        }

        .folder-form form {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .folder-form input {
            flex: 1;
            min-width: 220px;
            padding:
                9px 11px;
            border:
                1px solid #d1d5db;
            border-radius: 7px;
            font-size: 13px;
        }

        .folder-form input:focus {
            outline: none;
            border-color: #1e3a8a;
        }

        .folder-grid {
            display: grid;
            grid-template-columns:
                repeat(3, minmax(0, 1fr));
            gap: 14px;
        }

        .folder-card {
            position: relative;
            background: white;
            border:
                1px solid #e5e7eb;
            border-radius: 10px;
            padding: 20px 16px;
            min-height: 145px;
            text-decoration: none;
            transition:
                border-color 0.2s ease,
                box-shadow 0.2s ease,
                transform 0.2s ease;
        }

        .folder-card:hover {
            border-color: #1e3a8a;
            box-shadow:
                0 4px 12px
                rgba(30,58,138,0.08);
            transform: translateY(-1px);
        }

        .folder-icon {
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

        .folder-name {
            color: #1e3a8a;
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 5px;
            word-break: break-word;
        }

        .folder-count {
            color: #64748b;
            font-size: 12px;
        }

        .empty-folder {
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

        .empty-folder-icon {
            font-size: 40px;
            margin-bottom: 12px;
        }

        .empty-folder h3 {
            margin: 0 0 8px;
            color: #475569;
            font-size: 17px;
        }

        .empty-folder p {
            margin: 0 0 18px;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
        }

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

        @media (max-width: 900px) {

            .main-content {
                margin-left: 220px;
            }

            .main-content.sidebar-collapsed {
                margin-left: 78px;
                width: calc(100% - 78px);
            }

            .page {
                padding: 25px;
            }

            .folder-grid {
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

            .page {
                padding: 20px;
            }

            .year-title-row {
                align-items: flex-start;
            }

            .year-title-row h1 {
                font-size: 21px;
            }

            .year-actions-top {
                flex-shrink: 0;
            }

            .info-row {
                flex-direction: column;
                gap: 8px;
            }

            .section-header {
                align-items: center;
            }

            .folder-grid {
                grid-template-columns: 1fr;
            }

            .folder-form form {
                flex-direction: column;
                align-items: stretch;
            }

            .folder-form input {
                width: 100%;
                min-width: 0;
            }

            .folder-form .btn {
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

<?php
require_once "../includes/sidebar.php";
?>

<main
    class="main-content"
    id="mainContent"
>

    <section class="page">

        <div class="back-navigation">

            <a
                href="<?php echo htmlspecialchars($url_kembali); ?>"
            >
                ← Kembali
            </a>

        </div>

        <?php if ($pesan !== ''): ?>

            <div
                class="system-message <?php echo htmlspecialchars($jenis_pesan); ?>"
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

        <div class="page-header">

            <div class="year-title-row">

                <h1>
                    📁 Tahun
                    <?php echo htmlspecialchars($tahun); ?>
                </h1>

                <div class="year-actions-top">

                    <a
                        href="<?php echo htmlspecialchars($url_edit_tahun); ?>"
                        class="icon-action edit"
                        title="Edit Tahun"
                        aria-label="Edit Tahun"
                    >

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >

                            <path d="M12 20h9" />

                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z" />

                        </svg>

                    </a>

                    <button
                        type="button"
                        class="icon-action delete"
                        title="Hapus Tahun"
                        aria-label="Hapus Tahun"
                        onclick="bukaModalHapusTahun()"
                    >

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >

                            <polyline points="3 6 5 6 21 6" />

                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />

                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />

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
                Kelola folder dokumen berdasarkan tahun.
            </p>

        </div>

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

            </div>

        </div>

        <div class="section-header">

            <h3>
                Folder Dokumen
            </h3>

            <?php if ($ada_folder): ?>

                <button
                    type="button"
                    class="btn btn-primary"
                    onclick="tampilkanFormFolder()"
                    title="Tambah Folder"
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

                    Tambah Folder

                </button>

            <?php endif; ?>

        </div>

        <div
            id="formTambahFolder"
            class="folder-form"
        >

            <form
                action="proses_tambah_folder.php"
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

                <input
                    type="hidden"
                    name="tahun"
                    value="<?php echo $tahun; ?>"
                >

                <input
                    type="text"
                    name="nama_folder"
                    id="nama_folder"
                    placeholder="Masukkan nama folder"
                    autocomplete="off"
                    required
                    oninput="hapusPesanError()"
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
                    onclick="sembunyikanFormFolder()"
                >
                    Batal
                </button>

            </form>

        </div>

        <?php if ($ada_folder): ?>

            <div class="folder-grid">

                <?php foreach ($folder_list as $folder): ?>

                    <?php

                    $folder_id =
                        intval(
                            $folder['id']
                        );

                    $nama_folder =
                        $folder['nama_folder']
                        ?? '';

                    $jumlah_dokumen =
                        intval(
                            $folder['jumlah_dokumen']
                        );

                    ?>

                    <div class="folder-card">

                        <a
                            href="dokumen_folder.php?dewan_id=<?php echo $dewan_id; ?>&kategori_id=<?php echo $kategori_id; ?>&tahun=<?php echo $tahun; ?>&nama_folder=<?php echo urlencode($nama_folder); ?>"
                            style="display:block; text-decoration:none;"
                        >

                            <div class="folder-icon">
                                📁
                            </div>

                            <div class="folder-name">

                                <?php

                                echo htmlspecialchars(
                                    $nama_folder
                                );

                                ?>

                            </div>

                            <div class="folder-count">

                                <?php

                                echo $jumlah_dokumen;

                                ?>

                                dokumen

                            </div>

                        </a>

                    </div>

                <?php endforeach; ?>

            </div>

        <?php else: ?>

            <div class="empty-folder">

                <div class="empty-folder-icon">
                    📁
                </div>

                <h3>
                    Belum Ada Folder
                </h3>

                <p>

                    Belum ada folder dokumen pada tahun

                    <strong>

                        <?php

                        echo htmlspecialchars(
                            $tahun
                        );

                        ?>

                    </strong>.

                </p>

                <button
                    type="button"
                    class="btn btn-primary"
                    onclick="tampilkanFormFolder()"
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

                    Tambah Folder

                </button>

            </div>

        <?php endif; ?>

    </section>

</main>

<div
    id="modalHapus"
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

        <h3 id="judulModalHapus">
            Hapus
        </h3>

        <p id="isiModalHapus">
            Apakah Anda yakin ingin menghapus data ini?
        </p>

        <div class="delete-modal-actions">

            <button
                type="button"
                class="btn btn-secondary"
                onclick="tutupModalHapus()"
            >
                Batal
            </button>

            <form
                id="formHapus"
                method="GET"
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
                    value="<?php echo $tahun; ?>"
                >

                <input
                    type="hidden"
                    name="nama_folder"
                    id="namaFolderHapus"
                    value=""
                >

                <button
                    type="submit"
                    class="btn btn-delete"
                >
                    Hapus
                </button>

            </form>

        </div>

    </div>

</div>

<script>

function tampilkanFormFolder() {

    const form =
        document.getElementById(
            "formTambahFolder"
        );

    if (form) {

        form.classList.add("show");

        const input =
            form.querySelector(
                'input[name="nama_folder"]'
            );

        if (input) {
            input.focus();
        }
    }
}

function hapusPesanError() {

    const pesan =
        document.querySelector(
            ".system-message.error"
        );

    if (pesan) {
        pesan.remove();
    }
}

function sembunyikanFormFolder() {

    const form =
        document.getElementById(
            "formTambahFolder"
        );

    if (form) {
        form.classList.remove("show");
    }

    hapusPesanError();
}

function bukaModalHapusTahun() {

    const modal =
        document.getElementById(
            "modalHapus"
        );

    const judul =
        document.getElementById(
            "judulModalHapus"
        );

    const isi =
        document.getElementById(
            "isiModalHapus"
        );

    const form =
        document.getElementById(
            "formHapus"
        );

    const namaFolder =
        document.getElementById(
            "namaFolderHapus"
        );

    judul.textContent =
        "Hapus Tahun";

    isi.innerHTML =
        'Apakah Anda yakin ingin menghapus tahun <strong><?php echo htmlspecialchars($tahun, ENT_QUOTES); ?></strong> beserta seluruh folder dan dokumen di dalamnya?';

    form.action =
        "hapus_tahun.php";

    namaFolder.value =
        "";

    modal.classList.add(
        "show"
    );
}

function bukaModalHapusFolder(
    namaFolder
) {

    const modal =
        document.getElementById(
            "modalHapus"
        );

    const judul =
        document.getElementById(
            "judulModalHapus"
        );

    const isi =
        document.getElementById(
            "isiModalHapus"
        );

    const form =
        document.getElementById(
            "formHapus"
        );

    const namaFolderInput =
        document.getElementById(
            "namaFolderHapus"
        );

    judul.textContent =
        "Hapus Folder";

    isi.innerHTML =
        'Apakah Anda yakin ingin menghapus folder <strong>' +
        escapeHtml(namaFolder) +
        '</strong> beserta dokumen di dalamnya?';

    form.action =
        "hapus_folder.php";

    namaFolderInput.value =
        namaFolder;

    modal.classList.add(
        "show"
    );
}

function escapeHtml(
    text
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;
}

function tutupModalHapus() {

    const modal =
        document.getElementById(
            "modalHapus"
        );

    modal.classList.remove(
        "show"
    );
}

document
    .getElementById(
        "modalHapus"
    )
    .addEventListener(
        "click",
        function () {
            tutupModalHapus();
        }
    );

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape"
        ) {
            tutupModalHapus();
        }

    }
);

</script>

</body>

</html>

<?php

mysqli_stmt_close(
    $stmt_folder
);

?>