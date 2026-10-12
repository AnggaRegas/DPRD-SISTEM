<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


/* =====================================================
   PARAMETER
===================================================== */

$dewan_id    = intval($_GET['dewan_id'] ?? 0);
$kategori_id = intval($_GET['kategori_id'] ?? 0);
$tahun       = intval($_GET['tahun'] ?? 0);

$nama_folder = trim(
    $_GET['nama_folder'] ?? ''
);


/* =====================================================
   VALIDASI
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
   CEK FOLDER
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "SELECT nama_folder
     FROM folder_dokumen
     WHERE dewan_id = ?
       AND kategori_id = ?
       AND tahun = ?
       AND TRIM(nama_folder) = TRIM(?)
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt,
    "iiis",
    $dewan_id,
    $kategori_id,
    $tahun,
    $nama_folder
);

mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);

$folder = mysqli_fetch_assoc($result);

mysqli_stmt_close($stmt);


if (!$folder) {
    echo "Folder tidak ditemukan.";
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
        Edit Folder
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
            background: #f4f6f9;
            font-family: Arial, Helvetica, sans-serif;
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


        .category-page {
            padding: 32px;
        }


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
        }


        .back-navigation a:hover {
            background: #1d4ed8;
        }


        .page-header {
            margin-bottom: 18px;
        }


        .page-header h1 {
            margin: 0 0 7px;
            color: #1e293b;
            font-size: 22px;
            display: flex;
            align-items: center;
            gap: 8px;
        }


        .page-header p {
            margin: 0;
            color: #64748b;
            font-size: 13px;
        }


        /* =================================================
           IKON HEADER
        ================================================== */

        .page-header-icon {
            width: 20px;
            height: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #1e3a8a;
            flex-shrink: 0;
        }


        .page-header-icon svg {
            width: 20px;
            height: 20px;
        }


        .form-box {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 24px;
            max-width: 700px;
        }


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
        }


        .button-group {
            display: flex;
            gap: 8px;
            margin-top: 24px;
        }


        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 10px 15px;
            border: none;
            border-radius: 7px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }


        .btn svg {
            width: 15px;
            height: 15px;
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
            background: #e2e8f0;
            color: #334155;
        }


        .btn-secondary:hover {
            background: #cbd5e1;
        }


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


<?php

require_once "../includes/sidebar.php";

?>


<main
    class="main-content"
    id="mainContent"
>


    <section class="category-page">


        <!-- KEMBALI -->

        <div class="back-navigation">

            <a
                href="dokumen_tahun.php?dewan_id=<?php echo $dewan_id; ?>&kategori_id=<?php echo $kategori_id; ?>&tahun=<?php echo $tahun; ?>"
            >
                ← Kembali
            </a>

        </div>


        <!-- HEADER -->

        <div class="page-header">

            <h1>

                <span class="page-header-icon">

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

                </span>

                Edit Folder

            </h1>


            <p>
                Ubah nama folder dokumen.
            </p>

        </div>


        <!-- FORM -->

        <div class="form-box">


            <form
                action="proses_edit_folder.php"
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
                    type="hidden"
                    name="nama_folder_lama"
                    value="<?php echo htmlspecialchars($nama_folder); ?>"
                >


                <div class="form-group">

                    <label for="nama_folder">
                        Nama Folder
                    </label>


                    <input
                        type="text"
                        id="nama_folder"
                        name="nama_folder"
                        value="<?php echo htmlspecialchars($nama_folder); ?>"
                        required
                        autocomplete="off"
                        autofocus
                    >

                </div>


                <div class="button-group">


                    <button
                        type="submit"
                        class="btn btn-primary"
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
                                d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
                            />

                            <polyline
                                points="17 21 17 13 7 13 7 21"
                            />

                            <polyline
                                points="7 3 7 8 15 8"
                            />

                        </svg>

                        Simpan Perubahan

                    </button>


                    <a
                        href="dokumen_tahun.php?dewan_id=<?php echo $dewan_id; ?>&kategori_id=<?php echo $kategori_id; ?>&tahun=<?php echo $tahun; ?>"
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