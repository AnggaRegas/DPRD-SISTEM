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

$nama_user = $_SESSION['nama'] ?? 'User';
$role      = $_SESSION['role'] ?? 'Staff';


/* =====================================================
   AMBIL ID
===================================================== */

$id = intval($_GET['id'] ?? 0);

$dewan_id = intval($_GET['dewan_id'] ?? 0);


if ($id <= 0) {
    header("Location: dewan.php");
    exit;
}


/* =====================================================
   AMBIL DATA KATEGORI
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "SELECT *
     FROM kategori_dokumen
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

$kategori = mysqli_fetch_assoc($result);


if (!$kategori) {
    echo "Kategori tidak ditemukan.";
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
        Edit Kategori Dokumen
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
           FORM BOX
        ================================================== */

        .form-box {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 25px;
            max-width: 700px;
        }


        .form-box h2 {
            margin: 0 0 7px;
            color: #1e3a8a;
            font-size: 18px;
        }


        .form-description {
            margin: 0 0 25px;
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
            color: #374151;
            font-size: 13px;
            font-weight: 600;
        }


        .form-group input {
            width: 100%;
            box-sizing: border-box;
            padding: 11px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 7px;
            font-size: 14px;
            outline: none;
        }


        .form-group input:focus {
            border-color: #1e3a8a;
        }


        /* =================================================
           BUTTON
        ================================================== */

        .form-actions {
            display: flex;
            gap: 8px;
            margin-top: 25px;
        }


        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 16px;
            border-radius: 7px;
            text-decoration: none;
            font-size: 13px;
            border: none;
            cursor: pointer;
            font-weight: 600;
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


            .form-actions {
                flex-direction: column;
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
                href="kategori_dokumen.php?dewan_id=<?php echo $dewan_id; ?>&kategori_id=<?php echo $id; ?>"
            >
                ← Kembali
            </a>

        </div>


        <!-- =================================================
             FORM
        ================================================== -->

        <div class="form-box">


            <h2>
                Edit Kategori Dokumen
            </h2>


            <p class="form-description">
                Ubah nama kategori dokumen sesuai kebutuhan.
            </p>


            <form
                action="proses_edit_kategori.php"
                method="POST"
            >


                <!-- ID KATEGORI -->

                <input
                    type="hidden"
                    name="id"
                    value="<?php echo $id; ?>"
                >


                <!-- ID DEWAN -->

                <input
                    type="hidden"
                    name="dewan_id"
                    value="<?php echo $dewan_id; ?>"
                >


                <!-- NAMA KATEGORI -->

                <div class="form-group">

                    <label>
                        Nama Kategori
                    </label>


                    <input
                        type="text"
                        name="nama_kategori"
                        value="<?php
                            echo htmlspecialchars(
                                $kategori['nama_kategori']
                            );
                        ?>"
                        required
                        autocomplete="off"
                    >

                </div>


                <!-- BUTTON -->

                <div class="form-actions">


                    <button
                        type="submit"
                        class="btn btn-primary"
                    >
                        Simpan Perubahan
                    </button>


                    <a
                        href="kategori_dokumen.php?dewan_id=<?php echo $dewan_id; ?>&kategori_id=<?php echo $id; ?>"
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