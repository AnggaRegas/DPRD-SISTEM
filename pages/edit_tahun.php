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


/* =====================================================
   VALIDASI
===================================================== */

if (
    $dewan_id <= 0 ||
    $kategori_id <= 0 ||
    $tahun <= 0
) {

    header("Location: dewan.php");
    exit;

}


/* =====================================================
   AMBIL DATA DEWAN
===================================================== */

$stmt_dewan = mysqli_prepare(
    $conn,
    "
    SELECT *
    FROM dewan
    WHERE id = ?
    LIMIT 1
    "
);

mysqli_stmt_bind_param(
    $stmt_dewan,
    "i",
    $dewan_id
);

mysqli_stmt_execute($stmt_dewan);

$result_dewan =
    mysqli_stmt_get_result(
        $stmt_dewan
    );

$dewan =
    mysqli_fetch_assoc(
        $result_dewan
    );

mysqli_stmt_close($stmt_dewan);


if (!$dewan) {

    echo "Data anggota Dewan tidak ditemukan.";
    exit;

}


/* =====================================================
   AMBIL DATA KATEGORI
===================================================== */

$stmt_kategori = mysqli_prepare(
    $conn,
    "
    SELECT *
    FROM kategori_dokumen
    WHERE id = ?
    LIMIT 1
    "
);

mysqli_stmt_bind_param(
    $stmt_kategori,
    "i",
    $kategori_id
);

mysqli_stmt_execute($stmt_kategori);

$result_kategori =
    mysqli_stmt_get_result(
        $stmt_kategori
    );

$kategori =
    mysqli_fetch_assoc(
        $result_kategori
    );

mysqli_stmt_close($stmt_kategori);


if (!$kategori) {

    echo "Kategori dokumen tidak ditemukan.";
    exit;

}


$nama_kategori =
    $kategori['nama_kategori']
    ?? 'Kategori Dokumen';


/* =====================================================
   CEK TAHUN
===================================================== */

$stmt_tahun = mysqli_prepare(
    $conn,
    "
    SELECT tahun
    FROM tahun_dokumen
    WHERE dewan_id = ?
      AND kategori_id = ?
      AND tahun = ?
    LIMIT 1
    "
);

mysqli_stmt_bind_param(
    $stmt_tahun,
    "iii",
    $dewan_id,
    $kategori_id,
    $tahun
);

mysqli_stmt_execute($stmt_tahun);

$result_tahun =
    mysqli_stmt_get_result(
        $stmt_tahun
    );

$tahun_data =
    mysqli_fetch_assoc(
        $result_tahun
    );

mysqli_stmt_close($stmt_tahun);


/*
 * Jika belum ada di tahun_dokumen,
 * cek dari tabel dokumen.
 */

if (!$tahun_data) {

    $stmt_dokumen = mysqli_prepare(
        $conn,
        "
        SELECT tahun
        FROM dokumen
        WHERE dewan_id = ?
          AND kategori_id = ?
          AND tahun = ?
        LIMIT 1
        "
    );

    mysqli_stmt_bind_param(
        $stmt_dokumen,
        "iii",
        $dewan_id,
        $kategori_id,
        $tahun
    );

    mysqli_stmt_execute($stmt_dokumen);

    $result_dokumen =
        mysqli_stmt_get_result(
            $stmt_dokumen
        );

    $tahun_data =
        mysqli_fetch_assoc(
            $result_dokumen
        );

    mysqli_stmt_close(
        $stmt_dokumen
    );

}


/* =====================================================
   TAHUN TIDAK DITEMUKAN
===================================================== */

if (!$tahun_data) {

    header(
        "Location: kategori_dokumen.php"
        . "?dewan_id="
        . $dewan_id
        . "&kategori_id="
        . $kategori_id
        . "&error=tahun_tidak_ditemukan"
    );

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
        Edit Tahun
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


        .main-content {
            margin-left: 250px;
            min-height: 100vh;
            background: #f4f6f9;
        }

        .main-content.sidebar-collapsed {
            margin-left: 78px;
        }


        .page {
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
            margin-bottom: 20px;
        }

        .page-header h1 {
            margin: 0 0 6px;
            color: #1e293b;
            font-size: 24px;
        }

        .page-header p {
            margin: 0;
            color: #64748b;
            font-size: 13px;
        }


        .form-box {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 25px;
            max-width: 650px;
        }


        .info-box {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 20px;
        }

        .info-item {
            font-size: 13px;
            color: #64748b;
            margin-bottom: 7px;
        }

        .info-item:last-child {
            margin-bottom: 0;
        }

        .info-item strong {
            color: #1e3a8a;
        }


        .form-group {
            margin-bottom: 18px;
        }

        .form-group label {
            display: block;
            margin-bottom: 7px;
            font-size: 13px;
            font-weight: 600;
            color: #374151;
        }

        .form-group input {
            width: 100%;
            padding: 11px 12px;
            border: 1px solid #d1d5db;
            border-radius: 7px;
            font-size: 14px;
        }

        .form-group input:focus {
            outline: none;
            border-color: #1e3a8a;
            box-shadow:
                0 0 0 2px
                rgba(30,58,138,0.08);
        }


        .button-group {
            display: flex;
            gap: 8px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 10px 15px;
            border: none;
            border-radius: 7px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
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


        @media (max-width: 650px) {

            .main-content {
                margin-left: 78px;
            }

            .page {
                padding: 20px;
            }

            .form-box {
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

    <section class="page">


        <div class="back-navigation">

            <a
                href="dokumen_tahun.php?dewan_id=<?php echo $dewan_id; ?>&kategori_id=<?php echo $kategori_id; ?>&tahun=<?php echo $tahun; ?>"
            >

                ← Kembali

            </a>

        </div>


        <div class="page-header">

            <h1>
                Edit Tahun
            </h1>

            <p>
                Ubah tahun dokumen pada kategori ini.
            </p>

        </div>


        <div class="form-box">


            <div class="info-box">

                <div class="info-item">

                    Anggota Dewan:

                    <strong>

                        <?php

                        echo htmlspecialchars(
                            $dewan['nama']
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

            </div>


            <form
                action="proses_edit_tahun.php"
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
                    name="tahun_lama"
                    value="<?php echo $tahun; ?>"
                >


                <div class="form-group">

                    <label
                        for="tahun_baru"
                    >
                        Tahun
                    </label>


                    <input
                        type="number"
                        name="tahun_baru"
                        id="tahun_baru"
                        min="1900"
                        max="2100"
                        value="<?php echo htmlspecialchars($tahun); ?>"
                        required
                        autofocus
                    >

                </div>


                <div class="button-group">

                    <button
                        type="submit"
                        class="btn btn-primary"
                    >
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