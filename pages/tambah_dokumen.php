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
   PARAMETER DARI URL / FORM
===================================================== */

$dewan_id = intval(
    $_GET['dewan_id']
    ?? $_POST['dewan_id']
    ?? 0
);

$kategori_id = intval(
    $_GET['kategori_id']
    ?? $_POST['kategori_id']
    ?? 0
);

$tahun = intval(
    $_GET['tahun']
    ?? $_POST['tahun']
    ?? date('Y')
);

$nama_folder = trim(
    $_GET['nama_folder']
    ?? $_POST['nama_folder']
    ?? ''
);


/* =====================================================
   DATA DEWAN
===================================================== */

$daftar_dewan = [];

$result_dewan_list = mysqli_query(
    $conn,
    "SELECT id, nama, jabatan, urutan
     FROM dewan
     ORDER BY
        CASE
            WHEN jabatan LIKE 'Ketua DPRD%' THEN 1
            WHEN jabatan LIKE 'Wakil Ketua I%' THEN 2
            WHEN jabatan LIKE 'Wakil Ketua II%' THEN 3
            WHEN jabatan LIKE 'Wakil Ketua III%' THEN 4
            ELSE 5
        END ASC,
        urutan ASC,
        nama ASC"
);

if ($result_dewan_list) {

    while (
        $row = mysqli_fetch_assoc(
            $result_dewan_list
        )
    ) {

        $daftar_dewan[] = $row;

    }

}


/* =====================================================
   DATA KATEGORI
===================================================== */

$daftar_kategori = [];

$result_kategori_list = mysqli_query(
    $conn,
    "SELECT id, nama_kategori
     FROM kategori_dokumen
     ORDER BY nama_kategori ASC"
);

if ($result_kategori_list) {

    while (
        $row = mysqli_fetch_assoc(
            $result_kategori_list
        )
    ) {

        $daftar_kategori[] = $row;

    }

}


/* =====================================================
   DATA DEWAN TERPILIH
===================================================== */

$dewan = null;

if ($dewan_id > 0) {

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

}


/* =====================================================
   DATA KATEGORI TERPILIH
===================================================== */

$kategori = null;

if ($kategori_id > 0) {

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

}


/* =====================================================
   NAMA KATEGORI
===================================================== */

$nama_kategori =
    $kategori['nama_kategori']
    ?? 'Kategori Dokumen';


/* =====================================================
   PESAN
===================================================== */

$error = '';


/* =====================================================
   PROSES SIMPAN DOKUMEN
===================================================== */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {


    /* =================================================
       AMBIL DATA FORM
    ================================================= */

    $dewan_id =
        intval(
            $_POST['dewan_id'] ?? 0
        );

    $kategori_id =
        intval(
            $_POST['kategori_id'] ?? 0
        );

    $tahun =
        intval(
            $_POST['tahun'] ?? date('Y')
        );

    $nama_folder =
        trim(
            $_POST['nama_folder'] ?? ''
        );

    $nama_dokumen =
        trim(
            $_POST['nama_dokumen'] ?? ''
        );

    $keterangan =
        trim(
            $_POST['keterangan'] ?? ''
        );


    /* =================================================
       VALIDASI DEWAN
    ================================================= */

    if ($dewan_id <= 0) {

        $error =
            "Anggota Dewan wajib dipilih.";

    }


    /* =================================================
       VALIDASI KATEGORI
    ================================================= */

    elseif ($kategori_id <= 0) {

        $error =
            "Kategori dokumen wajib dipilih.";

    }


    /* =================================================
       VALIDASI TAHUN
    ================================================= */

    elseif ($tahun <= 0) {

        $error =
            "Tahun dokumen wajib diisi.";

    }


    /* =================================================
       VALIDASI FOLDER
    ================================================= */

    elseif ($nama_folder === '') {

        $error =
            "Nama folder wajib diisi.";

    }


    /* =================================================
       VALIDASI NAMA DOKUMEN
    ================================================= */

    elseif ($nama_dokumen === '') {

        $error =
            "Nama dokumen wajib diisi.";

    }


    /* =================================================
       VALIDASI FILE
    ================================================= */

    elseif (
        !isset(
            $_FILES['file_dokumen']
        )
        ||
        $_FILES['file_dokumen']['error']
        === UPLOAD_ERR_NO_FILE
    ) {

        $error =
            "File dokumen wajib dipilih.";

    }


    else {


        /* =============================================
           DATA FILE
        ============================================= */

        $file =
            $_FILES['file_dokumen'];


        if ($file['error'] !== UPLOAD_ERR_OK) {

    switch ($file['error']) {

        case UPLOAD_ERR_INI_SIZE:
            $error = "Ukuran file terlalu besar menurut pengaturan PHP.";
            break;

        case UPLOAD_ERR_FORM_SIZE:
            $error = "Ukuran file terlalu besar.";
            break;

        case UPLOAD_ERR_PARTIAL:
            $error = "File hanya terunggah sebagian.";
            break;

        case UPLOAD_ERR_NO_FILE:
            $error = "File belum dipilih.";
            break;

        case UPLOAD_ERR_NO_TMP_DIR:
            $error = "Folder temporary PHP tidak ditemukan.";
            break;

        case UPLOAD_ERR_CANT_WRITE:
            $error = "PHP tidak dapat menulis file ke server.";
            break;

        case UPLOAD_ERR_EXTENSION:
            $error = "Upload file dihentikan oleh ekstensi PHP.";
            break;

        default:
            $error = "Terjadi kesalahan saat mengunggah file. Kode error: " . $file['error'];
            break;

    }

}


        else {


            /* =========================================
               CEK UKURAN FILE
            ========================================= */

            $max_size =
                20 * 1024 * 1024;


            if (
                $file['size']
                > $max_size
            ) {

                $error =
                    "Ukuran file maksimal 20 MB.";

            }


            else {


                /* =====================================
                   NAMA FILE ASLI
                ===================================== */

                $nama_file_asli =
                    basename(
                        $file['name']
                    );


                $ekstensi =
                    strtolower(
                        pathinfo(
                            $nama_file_asli,
                            PATHINFO_EXTENSION
                        )
                    );


                /* =====================================
                   EKSTENSI YANG DIIZINKAN
                ===================================== */

                $allowed_extensions = [

                    'pdf',

                    'doc',
                    'docx',

                    'xls',
                    'xlsx',

                    'ppt',
                    'pptx',

                    'jpg',
                    'jpeg',
                    'png',

                ];


                if (
                    !in_array(
                        $ekstensi,
                        $allowed_extensions
                    )
                ) {

                    $error =
                        "Jenis file tidak diizinkan.";

                }


                else {


                    /* =================================
                       FOLDER UPLOAD
                    ================================= */

                    $folder_upload =
                        "../uploads/dokumen/";


                    if (
                        !is_dir(
                            $folder_upload
                        )
                    ) {

                        mkdir(
                            $folder_upload,
                            0777,
                            true
                        );

                    }


                    /* =================================
                       BUAT NAMA FILE UNIK
                    ================================= */

                    $nama_file_baru =
                        time()
                        . "_"
                        . uniqid()
                        . "_"
                        . preg_replace(
                            '/[^A-Za-z0-9._-]/',
                            '_',
                            $nama_file_asli
                        );


                    $target_file =
                        $folder_upload
                        . $nama_file_baru;


                    /* =================================
                       PINDAHKAN FILE
                    ================================= */

                    if (
                        move_uploaded_file(
                            $file['tmp_name'],
                            $target_file
                        )
                    ) {


                        /* =============================
                           PATH YANG DISIMPAN DATABASE
                        ============================= */

                        $path_file =
                            "uploads/dokumen/"
                            . $nama_file_baru;


                        /* =============================
                           SIMPAN KE DATABASE
                        ============================= */

                        $stmt_insert =
                            mysqli_prepare(
                                $conn,
                                "INSERT INTO dokumen
                                (
                                    dewan_id,
                                    kategori_id,
                                    tahun,
                                    nama_folder,
                                    nama_dokumen,
                                    keterangan,
                                    nama_file,
                                    path_file
                                )
                                VALUES
                                (
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?
                                )"
                            );


                        mysqli_stmt_bind_param(
                            $stmt_insert,
                            "iiisssss",
                            $dewan_id,
                            $kategori_id,
                            $tahun,
                            $nama_folder,
                            $nama_dokumen,
                            $keterangan,
                            $nama_file_baru,
                            $path_file
                        );


                        if (
                            mysqli_stmt_execute(
                                $stmt_insert
                            )
                        ) {


                            mysqli_stmt_close(
                                $stmt_insert
                            );


                            /* =====================
                               SETELAH BERHASIL
                            ===================== */

                            header(
                                "Location: dokumen_folder.php"
                                . "?dewan_id="
                                . $dewan_id
                                . "&kategori_id="
                                . $kategori_id
                                . "&tahun="
                                . $tahun
                                . "&nama_folder="
                                . urlencode(
                                    $nama_folder
                                )
                            );

                            exit;


                        }


                        else {


                            /* =====================
                               JIKA DATABASE GAGAL
                            ===================== */

                            unlink(
                                $target_file
                            );


                            $error =
                                "Gagal menyimpan data dokumen: "
                                . mysqli_error($conn);


                            mysqli_stmt_close(
                                $stmt_insert
                            );

                        }


                    }


                    else {

                        $error =
                            "File gagal dipindahkan ke folder upload.";

                    }

                }

            }

        }

    }


    /* =================================================
       REFRESH DATA SETELAH VALIDASI / ERROR
    ================================================= */

    if ($dewan_id > 0) {

        $stmt_dewan =
            mysqli_prepare(
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

        $result_dewan =
            mysqli_stmt_get_result(
                $stmt_dewan
            );

        $dewan =
            mysqli_fetch_assoc(
                $result_dewan
            );

        mysqli_stmt_close(
            $stmt_dewan
        );

    }


    if ($kategori_id > 0) {

        $stmt_kategori =
            mysqli_prepare(
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

        $result_kategori =
            mysqli_stmt_get_result(
                $stmt_kategori
            );

        $kategori =
            mysqli_fetch_assoc(
                $result_kategori
            );

        mysqli_stmt_close(
            $stmt_kategori
        );

    }


    $nama_kategori =
        $kategori['nama_kategori']
        ?? 'Kategori Dokumen';

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
        Tambah Dokumen
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

        }


        /* =====================================================
           PAGE
        ===================================================== */

        .page {

            padding: 32px;

            max-width: 1000px;

        }


        /* =====================================================
           HEADER
        ===================================================== */

        .page-header {

            margin-bottom: 20px;

        }


        .page-header h1 {

            margin:
                0 0 7px;

            color: #1e293b;

            font-size: 24px;

            line-height: 1.4;

        }


        .page-header p {

            margin: 0;

            color: #64748b;

            font-size: 13px;

            line-height: 1.6;

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
           FORM BOX
        ===================================================== */

        .form-box {

            background: white;

            border:
                1px solid #e5e7eb;

            border-radius: 10px;

            padding: 25px;

            box-shadow:
                0 2px 6px
                rgba(15, 23, 42, 0.03);

        }


        /* =====================================================
           INFO
        ===================================================== */

        .info-box {

            background: #eff6ff;

            border:
                1px solid #dbeafe;

            border-radius: 8px;

            padding: 14px 16px;

            margin-bottom: 22px;

            color: #475569;

            font-size: 13px;

            line-height: 1.6;

        }


        .info-box strong {

            color: #1e3a8a;

        }


        /* =====================================================
           FORM GROUP
        ===================================================== */

        .form-group {

            margin-bottom: 18px;

        }


        .form-group label {

            display: block;

            margin-bottom: 7px;

            font-size: 13px;

            font-weight: 600;

            color: #334155;

        }


        .required {

            color: #dc2626;

        }


        .form-group input,
        .form-group textarea,
        .form-group select {

            width: 100%;

            padding: 10px 12px;

            border:
                1px solid #cbd5e1;

            border-radius: 7px;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            font-size: 13px;

            color: #334155;

            background: white;

            outline: none;

            transition:
                border-color 0.2s ease,
                box-shadow 0.2s ease;

        }


        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {

            border-color: #2563eb;

            box-shadow:
                0 0 0 3px
                rgba(37,99,235,0.10);

        }


        .form-group textarea {

            min-height: 110px;

            resize: vertical;

        }


        .form-group small {

            display: block;

            margin-top: 6px;

            color: #64748b;

            font-size: 11px;

            line-height: 1.5;

        }


        /* =====================================================
           FILE INPUT
        ===================================================== */

        .file-input {

            padding: 9px !important;

            background: #f8fafc !important;

        }


        /* =====================================================
           ERROR
        ===================================================== */

        .error-box {

            background: #fef2f2;

            border:
                1px solid #fecaca;

            color: #b91c1c;

            padding: 12px 14px;

            border-radius: 7px;

            margin-bottom: 18px;

            font-size: 13px;

            line-height: 1.5;

        }


        /* =====================================================
           BUTTON
        ===================================================== */

        .form-actions {

            display: flex;

            align-items: center;

            justify-content: flex-end;

            gap: 8px;

            margin-top: 25px;

            padding-top: 20px;

            border-top:
                1px solid #e5e7eb;

        }


        .btn {

            display: inline-flex;

            align-items: center;

            justify-content: center;

            padding: 10px 16px;

            border-radius: 7px;

            text-decoration: none;

            font-size: 12px;

            font-weight: 600;

            border: none;

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

            color: #475569;

        }


        .btn-secondary:hover {

            background: #cbd5e1;

        }


        /* =====================================================
           RESPONSIVE
        ===================================================== */

        @media (max-width: 900px) {

            .main-content {

                margin-left: 220px;

            }


            .page {

                padding: 25px;

            }

        }


        @media (max-width: 650px) {

            .main-content {

                margin-left: 75px;

            }


            .page {

                padding: 20px;

            }


            .form-box {

                padding: 18px;

            }


            .form-actions {

                flex-direction: column-reverse;

                align-items: stretch;

            }


            .form-actions .btn {

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

    <main class="main-content">

        <section class="page">


            <!-- =================================================
                 KEMBALI
            ================================================== -->

            <div class="back-navigation">

                <a href="javascript:history.back();">

                    ← Kembali

                </a>

            </div>


            <!-- =================================================
                 HEADER
            ================================================== -->

            <div class="page-header">

                <h1>

                    Tambah Dokumen

                </h1>


                <p>

                    Tambahkan file ke dalam folder arsip.

                </p>

            </div>


            <!-- =================================================
                 FORM
            ================================================== -->

            <div class="form-box">


                <!-- =================================================
                     PILIH ANGGOTA DEWAN
                ================================================== -->

                <?php if ($dewan_id <= 0) { ?>

                    <div class="form-group">

                        <label for="pilih_dewan">

                            Anggota Dewan

                            <span class="required">

                                *

                            </span>

                        </label>


                        <select
                            id="pilih_dewan"
                            onchange="pilihDewan(this.value)"
                            required
                        >

                            <option value="">

                                -- Pilih Anggota Dewan --

                            </option>


                            <?php foreach (
                                $daftar_dewan
                                as $item_dewan
                            ) { ?>

                                <option
                                    value="<?php echo $item_dewan['id']; ?>"
                                    <?php
                                    echo (
                                        $dewan_id
                                        == $item_dewan['id']
                                    )
                                    ? 'selected'
                                    : '';
                                    ?>
                                >

                                    <?php

                                    echo htmlspecialchars(
                                        $item_dewan['nama']
                                    );

                                    ?>

                                    -
                                    <?php

                                    echo htmlspecialchars(
                                        $item_dewan['jabatan']
                                    );

                                    ?>

                                </option>

                            <?php } ?>

                        </select>


                        <small>

                            Pilih anggota Dewan yang memiliki dokumen.

                        </small>

                    </div>

                <?php } ?>


                <!-- =================================================
                     PILIH KATEGORI
                ================================================== -->

                <?php if ($kategori_id <= 0) { ?>

                    <div class="form-group">

                        <label for="pilih_kategori">

                            Kategori Dokumen

                            <span class="required">

                                *

                            </span>

                        </label>


                        <select
                            id="pilih_kategori"
                            onchange="pilihKategori(this.value)"
                            required
                        >

                            <option value="">

                                -- Pilih Kategori Dokumen --

                            </option>


                            <?php foreach (
                                $daftar_kategori
                                as $item_kategori
                            ) { ?>

                                <option
                                    value="<?php echo $item_kategori['id']; ?>"
                                    <?php
                                    echo (
                                        $kategori_id
                                        == $item_kategori['id']
                                    )
                                    ? 'selected'
                                    : '';
                                    ?>
                                >

                                    <?php

                                    echo htmlspecialchars(
                                        $item_kategori['nama_kategori']
                                    );

                                    ?>

                                </option>

                            <?php } ?>

                        </select>


                        <small>

                            Pilih kategori dokumen sebelum mengisi data arsip.

                        </small>

                    </div>

                <?php } ?>


                <!-- =================================================
                     INFORMASI
                ================================================== -->

                <?php if (
                    $dewan_id > 0 &&
                    $kategori_id > 0 &&
                    $dewan &&
                    $kategori
                ) { ?>

                    <div class="info-box">

                        <strong>

                            Informasi Arsip

                        </strong>

                        <br>

                        Anggota Dewan:

                        <strong>

                            <?php

                            echo htmlspecialchars(
                                $dewan['nama'] ?? '-'
                            );

                            ?>

                        </strong>

                        <br>

                        Kategori:

                        <strong>

                            <?php

                            echo htmlspecialchars(
                                $nama_kategori
                            );

                            ?>

                        </strong>

                    </div>

                <?php } ?>


                <!-- =================================================
                     ERROR
                ================================================== -->

                <?php if ($error !== '') { ?>

                    <div class="error-box">

                        <?php

                        echo htmlspecialchars(
                            $error
                        );

                        ?>

                    </div>

                <?php } ?>


                <!-- =================================================
                     FORM
                ================================================== -->

                <?php if (
                    $dewan_id > 0 &&
                    $kategori_id > 0 &&
                    $dewan &&
                    $kategori
                ) { ?>

                    <form
                        method="POST"
                        enctype="multipart/form-data"
                    >


                        <!-- ID DEWAN -->

                        <input
                            type="hidden"
                            name="dewan_id"
                            value="<?php echo $dewan_id; ?>"
                        >


                        <!-- ID KATEGORI -->

                        <input
                            type="hidden"
                            name="kategori_id"
                            value="<?php echo $kategori_id; ?>"
                        >


                        <!-- =================================================
                             TAHUN
                        ================================================== -->

                        <div class="form-group">

                            <label for="tahun">

                                Tahun

                                <span class="required">

                                    *

                                </span>

                            </label>


                            <input
                                type="number"
                                id="tahun"
                                name="tahun"
                                value="<?php echo htmlspecialchars($tahun); ?>"
                                min="2000"
                                max="2100"
                                required
                            >


                            <small>

                                Masukkan tahun dokumen, misalnya 2026.

                            </small>

                        </div>


                        <!-- =================================================
                             NAMA FOLDER
                        ================================================== -->

                        <div class="form-group">

                            <label for="nama_folder">

                                Nama Folder

                                <span class="required">

                                    *

                                </span>

                            </label>


                            <input
                                type="text"
                                id="nama_folder"
                                name="nama_folder"
                                value="<?php echo htmlspecialchars($nama_folder); ?>"
                                placeholder="Contoh: Reses 1"
                                required
                            >


                            <small>

                                Masukkan nama folder tempat dokumen
                                disimpan, misalnya
                                <strong>Reses 1</strong>,
                                <strong>Reses 2</strong>,
                                atau
                                <strong>Reses 3</strong>.

                            </small>

                        </div>


                        <!-- =================================================
                             NAMA DOKUMEN
                        ================================================== -->

                        <div class="form-group">

                            <label for="nama_dokumen">

                                Nama Dokumen

                                <span class="required">

                                    *

                                </span>

                            </label>


                            <input
                                type="text"
                                id="nama_dokumen"
                                name="nama_dokumen"
                                placeholder="Contoh: Laporan Pelaksanaan Reses"
                                value="<?php echo htmlspecialchars($_POST['nama_dokumen'] ?? ''); ?>"
                                required
                            >

                        </div>


                        <!-- =================================================
                             KETERANGAN
                        ================================================== -->

                        <div class="form-group">

                            <label for="keterangan">

                                Keterangan

                            </label>


                            <textarea
                                id="keterangan"
                                name="keterangan"
                                placeholder="Masukkan keterangan dokumen jika diperlukan..."
                            ><?php

                            echo htmlspecialchars(
                                $_POST['keterangan'] ?? ''
                            );

                            ?></textarea>


                            <small>

                                Keterangan bersifat opsional.

                            </small>

                        </div>


                        <!-- =================================================
                             FILE
                        ================================================== -->

                        <div class="form-group">

                            <label for="file_dokumen">

                                File Dokumen

                                <span class="required">

                                    *

                                </span>

                            </label>


                            <input
                                type="file"
                                id="file_dokumen"
                                name="file_dokumen"
                                class="file-input"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                                required
                            >


                            <small>

                                Format yang diperbolehkan:
                                PDF, Word, Excel, PowerPoint,
                                JPG, JPEG, dan PNG.
                                Maksimal 20 MB.

                            </small>

                        </div>


                        <!-- =================================================
                             ACTION
                        ================================================== -->

                        <div class="form-actions">


                            <!-- BATAL -->

                            <button
                                type="button"
                                class="btn btn-secondary"
                                onclick="history.back();"
                            >

                                Batal

                            </button>


                            <button
                                type="submit"
                                class="btn btn-primary"
                            >

                                Simpan Dokumen

                            </button>


                        </div>


                    </form>

                <?php } ?>


            </div>


        </section>

    </main>


    <!-- =====================================================
         JAVASCRIPT
    ===================================================== -->

    <script>

    function pilihDewan(id) {

        if (!id) {

            window.location.href =
                "tambah_dokumen.php";

            return;

        }


        window.location.href =
            "tambah_dokumen.php"
            + "?dewan_id="
            + encodeURIComponent(id);

    }


    function pilihKategori(id) {

        if (!id) {

            return;

        }


        const dewanSelect =
            document.getElementById(
                "pilih_dewan"
            );


        let dewanId = <?php echo $dewan_id; ?>;


        if (dewanSelect) {

            dewanId =
                dewanSelect.value;

        }


        if (!dewanId) {

            alert(
                "Silakan pilih Anggota Dewan terlebih dahulu."
            );

            return;

        }


        window.location.href =
            "tambah_dokumen.php"
            + "?dewan_id="
            + encodeURIComponent(dewanId)
            + "&kategori_id="
            + encodeURIComponent(id);

    }

    </script>


</body>

</html>