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
   PENCARIAN
===================================================== */

$keyword = trim($_GET['cari'] ?? '');


/* =====================================================
   URUTAN JABATAN
===================================================== */

$order_jabatan = "
    CASE
        WHEN jabatan LIKE 'Ketua DPRD%' THEN 1
        WHEN jabatan = 'Wakil Ketua I' THEN 2
        WHEN jabatan = 'Wakil Ketua II' THEN 3
        WHEN jabatan = 'Wakil Ketua III' THEN 4
        WHEN jabatan LIKE 'Ketua Komisi%' THEN 5
        WHEN jabatan LIKE 'Wakil Ketua Komisi%' THEN 6
        ELSE 7
    END
";


/* =====================================================
   AMBIL DATA ANGGOTA DEWAN
===================================================== */

if ($keyword !== '') {

    $keyword_sql = mysqli_real_escape_string(
        $conn,
        $keyword
    );

    $query = mysqli_query(
        $conn,
        "SELECT *
         FROM dewan
         WHERE nama LIKE '%$keyword_sql%'
         ORDER BY
            $order_jabatan ASC,
            jabatan ASC,
            nama ASC"
    );

} else {

    $query = mysqli_query(
        $conn,
        "SELECT *
         FROM dewan
         ORDER BY
            $order_jabatan ASC,
            jabatan ASC,
            nama ASC"
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
        Anggota Dewan
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

        .dewan-page {
            padding: 32px;
        }


        /* =====================================================
           HEADER
        ===================================================== */

        .page-header {
            margin-bottom: 15px;
        }

        .page-header h1 {
            margin: 0 0 7px;
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
           TOOLBAR
        ===================================================== */

        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            margin-bottom: 14px;
        }


        /* =====================================================
           SEARCH
        ===================================================== */

        .search-box {
            display: flex;
            align-items: center;
            gap: 7px;
            flex: 1;
        }

        .search-form {
            display: flex;
            align-items: center;
            gap: 7px;
        }

        .search-box input {
            width: 320px;
            height: 42px;
            border:
                1px solid
                #d1d5db;
            border-radius: 7px;
            padding:
                0 14px;
            outline: none;
            font-size: 13px;
            background: white;
            color: #334155;
        }

        .search-box input:focus {
            border-color:
                #1e3a8a;
            box-shadow:
                0 0 0 2px
                rgba(30,58,138,0.08);
        }

        .search-box input::placeholder {
            color: #94a3b8;
        }


        /* =====================================================
           TOMBOL CARI
        ===================================================== */

        .btn-search {
            display: none;
            align-items: center;
            justify-content: center;
            height: 42px;
            padding:
                0 15px;
            border: none;
            border-radius: 7px;
            background: #1e3a8a;
            color: white;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
        }

        .btn-search:hover {
            background: #1d4ed8;
        }


        /* =====================================================
           RESET SEARCH
        ===================================================== */

        .btn-reset {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 42px;
            padding:
                0 14px;
            border-radius: 7px;
            background: #64748b;
            color: white;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
        }

        .btn-reset:hover {
            background: #475569;
        }


        /* =====================================================
           BUTTON
        ===================================================== */

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 7px;
            padding:
                11px 15px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
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


        /* =====================================================
           TABLE BOX
        ===================================================== */

        .table-box {
            width: 100%;
            background: white;
            border:
                1px solid
                #e5e7eb;
            border-radius: 10px;
            overflow: hidden;
        }


        /* =====================================================
           TABLE
        ===================================================== */

        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        th {
            background: #f8fafc;
            text-align: left;
            font-size: 13px;
            font-weight: 600;
            color: #475569;
            padding: 13px;
            border-bottom:
                1px solid
                #e5e7eb;
        }

        td {
            padding: 13px;
            font-size: 13px;
            border-bottom:
                1px solid
                #f1f5f9;
            vertical-align: middle;
            color: #475569;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr:hover td {
            background: #f8fafc;
        }


        /* =====================================================
           LEBAR KOLOM
        ===================================================== */

        th:nth-child(1),
        td:nth-child(1) {
            width: 5%;
        }

        th:nth-child(2),
        td:nth-child(2) {
            width: 25%;
        }

        th:nth-child(3),
        td:nth-child(3) {
            width: 22%;
        }

        th:nth-child(4),
        td:nth-child(4) {
            width: 12%;
        }

        th:nth-child(5),
        td:nth-child(5) {
            width: 22%;
        }

        th:nth-child(6),
        td:nth-child(6) {
            width: 14%;
        }


        /* =====================================================
           NAMA DEWAN
        ===================================================== */

        .dewan-name {
            font-weight: 600;
            color: #1e3a8a;
            text-decoration: none;
        }

        .dewan-name:hover {
            text-decoration: underline;
        }


        /* =====================================================
           PENGAWAS
        ===================================================== */

        .pendamping-name {
            color: #374151;
        }

        .belum-ditentukan {
            color: #94a3b8;
        }


        /* =====================================================
           LIHAT ARSIP
        ===================================================== */

        .lihat-arsip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: #1e3a8a;
            color: white;
            text-decoration: none;
            font-weight: 600;
            font-size: 12px;
            padding:
                8px 11px;
            border-radius: 6px;
            white-space: nowrap;
        }

        .lihat-arsip:hover {
            background: #1d4ed8;
        }


        /* =====================================================
           EMPTY DATA
        ===================================================== */

        .empty-data {
            text-align: center;
            padding: 50px;
            color: #64748b;
        }

        .empty-icon {
            font-size: 40px;
            margin-bottom: 10px;
        }

        .empty-data strong {
            color: #475569;
            font-size: 14px;
        }

        .empty-data p {
            font-size: 13px;
        }


        /* =====================================================
           HASIL PENCARIAN
        ===================================================== */

        .search-result-info {
            padding:
                13px 15px;
            background: #eff6ff;
            border-bottom:
                1px solid
                #dbeafe;
            color: #1e3a8a;
            font-size: 13px;
        }

        .search-result-info strong {
            font-weight: 600;
        }


        /* =====================================================
           PENCARIAN TIDAK DITEMUKAN
        ===================================================== */

        .search-not-found {
            text-align: center;
            padding: 55px 20px;
            color: #64748b;
        }

        .search-not-found-icon {
            font-size: 42px;
            margin-bottom: 12px;
        }

        .search-not-found h3 {
            margin:
                0 0 7px;
            color: #475569;
            font-size: 16px;
        }

        .search-not-found p {
            margin: 0;
            font-size: 13px;
            line-height: 1.6;
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

            .dewan-page {
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

            .dewan-page {
                padding: 20px;
            }

            .page-header h1 {
                font-size: 21px;
            }

            .toolbar {
                flex-direction: column;
                align-items: stretch;
            }

            .search-box {
                width: 100%;
            }

            .search-form {
                width: 100%;
            }

            .search-box input {
                width: 100%;
            }

            .btn-search {
                flex-shrink: 0;
            }

            .toolbar > .btn {
                width: 100%;
            }

            .table-box {
                overflow-x: auto;
            }

            table {
                min-width: 850px;
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

    <section class="dewan-page">


        <!-- =================================================
             KEMBALI
        ================================================== -->

        <div class="back-navigation">

            <a href="dashboard.php">

                ← Kembali

            </a>

        </div>


        <!-- =================================================
             HEADER
        ================================================== -->

        <div class="page-header">

            <h1>
                Anggota Dewan
            </h1>

            <p>
                Daftar anggota Dewan beserta pendamping atau pengawas.
            </p>

        </div>


        <!-- =================================================
             TOOLBAR
        ================================================== -->

        <div class="toolbar">


            <!-- SEARCH -->

            <div class="search-box">

                <form
                    method="GET"
                    action="dewan.php"
                    class="search-form"
                    id="searchForm"
                >

                    <input
                        type="text"
                        name="cari"
                        id="searchDewan"
                        value="<?php echo htmlspecialchars($keyword); ?>"
                        placeholder="Cari nama anggota Dewan..."
                        autocomplete="off"
                    >

                    <button
                        type="submit"
                        class="btn-search"
                        id="btnCari"
                    >
                        Cari
                    </button>


                    <?php if ($keyword !== '') { ?>

                        <a
                            href="dewan.php"
                            class="btn-reset"
                        >
                            Reset
                        </a>

                    <?php } ?>

                </form>

            </div>


            <!-- TAMBAH DEWAN -->

            <a
                href="tambah_dewan.php"
                class="btn btn-primary"
            >
                + Tambah Dewan
            </a>

        </div>


        <!-- =================================================
             TABLE
        ================================================== -->

        <div class="table-box">

            <?php

            $jumlah_data = 0;

            if ($query) {

                $jumlah_data =
                    mysqli_num_rows($query);

            }


            /* =================================================
               JIKA PENCARIAN
            ================================================= */

            if ($keyword !== '') {


                if ($jumlah_data > 0) {

            ?>

                    <div class="search-result-info">

                        Hasil pencarian untuk:

                        <strong>
                            "<?php
                            echo htmlspecialchars(
                                $keyword
                            );
                            ?>"
                        </strong>

                    </div>


                    <table id="tabelDewan">

                        <thead>

                            <tr>

                                <th>
                                    No
                                </th>

                                <th>
                                    Nama Dewan
                                </th>

                                <th>
                                    Jabatan
                                </th>

                                <th>
                                    Periode
                                </th>

                                <th>
                                    Pendamping / Pengawas
                                </th>

                                <th>
                                    Aksi
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                        <?php

                        $no = 1;

                        while (
                            $row =
                            mysqli_fetch_assoc(
                                $query
                            )
                        ) {

                        ?>

                            <tr>

                                <td>
                                    <?php
                                    echo $no++;
                                    ?>
                                </td>


                                <td>

                                    <a
                                        href="arsip_dewan.php?id=<?php echo intval($row['id']); ?>"
                                        class="dewan-name"
                                    >

                                        <?php
                                        echo htmlspecialchars(
                                            $row['nama'] ?? '-'
                                        );
                                        ?>

                                    </a>

                                </td>


                                <td>

                                    <?php
                                    echo htmlspecialchars(
                                        $row['jabatan'] ?? '-'
                                    );
                                    ?>

                                </td>


                                <td>

                                    <?php
                                    echo htmlspecialchars(
                                        $row['periode'] ?? '-'
                                    );
                                    ?>

                                </td>


                                <td>

                                    <?php

                                    if (
                                        !empty(
                                            $row['nama_pengawas']
                                        )
                                    ) {

                                    ?>

                                        <span class="pendamping-name">

                                            <?php
                                            echo htmlspecialchars(
                                                $row['nama_pengawas']
                                            );
                                            ?>

                                        </span>

                                    <?php

                                    } else {

                                    ?>

                                        <span class="belum-ditentukan">
                                            Belum ditentukan
                                        </span>

                                    <?php

                                    }

                                    ?>

                                </td>


                                <td>

                                    <a
                                        href="arsip_dewan.php?id=<?php echo intval($row['id']); ?>"
                                        class="lihat-arsip"
                                    >
                                        Lihat Arsip
                                    </a>

                                </td>

                            </tr>

                        <?php

                        }

                        ?>

                        </tbody>

                    </table>


            <?php

                } else {

            ?>

                    <div class="search-not-found">

                        <div class="search-not-found-icon">
                            🔍
                        </div>

                        <h3>
                            Data anggota Dewan tidak ditemukan
                        </h3>

                        <p>

                            Tidak ada anggota Dewan dengan nama

                            <strong>
                                "<?php
                                echo htmlspecialchars(
                                    $keyword
                                );
                                ?>"
                            </strong>.

                        </p>

                    </div>

            <?php

                }


            /* =================================================
               JIKA TIDAK MENCARI
            ================================================= */

            } else {


                if ($jumlah_data > 0) {

            ?>

                    <table id="tabelDewan">

                        <thead>

                            <tr>

                                <th>
                                    No
                                </th>

                                <th>
                                    Nama Dewan
                                </th>

                                <th>
                                    Jabatan
                                </th>

                                <th>
                                    Periode
                                </th>

                                <th>
                                    Pendamping / Pengawas
                                </th>

                                <th>
                                    Aksi
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                        <?php

                        $no = 1;

                        while (
                            $row =
                            mysqli_fetch_assoc(
                                $query
                            )
                        ) {

                        ?>

                            <tr>

                                <td>

                                    <?php
                                    echo $no++;
                                    ?>

                                </td>


                                <td>

                                    <a
                                        href="arsip_dewan.php?id=<?php echo intval($row['id']); ?>"
                                        class="dewan-name"
                                    >

                                        <?php
                                        echo htmlspecialchars(
                                            $row['nama'] ?? '-'
                                        );
                                        ?>

                                    </a>

                                </td>


                                <td>

                                    <?php
                                    echo htmlspecialchars(
                                        $row['jabatan'] ?? '-'
                                    );
                                    ?>

                                </td>


                                <td>

                                    <?php
                                    echo htmlspecialchars(
                                        $row['periode'] ?? '-'
                                    );
                                    ?>

                                </td>


                                <td>

                                    <?php

                                    if (
                                        !empty(
                                            $row['nama_pengawas']
                                        )
                                    ) {

                                    ?>

                                        <span class="pendamping-name">

                                            <?php
                                            echo htmlspecialchars(
                                                $row['nama_pengawas']
                                            );
                                            ?>

                                        </span>

                                    <?php

                                    } else {

                                    ?>

                                        <span class="belum-ditentukan">
                                            Belum ditentukan
                                        </span>

                                    <?php

                                    }

                                    ?>

                                </td>


                                <td>

                                    <a
                                        href="arsip_dewan.php?id=<?php echo intval($row['id']); ?>"
                                        class="lihat-arsip"
                                    >
                                        Lihat Arsip
                                    </a>

                                </td>

                            </tr>

                        <?php

                        }

                        ?>

                        </tbody>

                    </table>


            <?php

                } else {

            ?>

                    <div class="empty-data">

                        <div class="empty-icon">
                            👤
                        </div>

                        <strong>
                            Belum ada data anggota Dewan
                        </strong>

                        <p style="margin-top: 8px;">
                            Data anggota Dewan akan
                            ditampilkan di halaman ini.
                        </p>

                    </div>

            <?php

                }

            }

            ?>

        </div>

    </section>

</main>


<!-- =====================================================
     JAVASCRIPT PENCARIAN
===================================================== -->

<script>

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const searchInput =
            document.getElementById(
                "searchDewan"
            );

        const btnCari =
            document.getElementById(
                "btnCari"
            );

        if (
            !searchInput ||
            !btnCari
        ) {

            return;

        }


        function tampilkanTombolCari() {

            const nilai =
                searchInput.value.trim();


            if (nilai.length > 0) {

                btnCari.style.display =
                    "inline-flex";

            } else {

                btnCari.style.display =
                    "none";

            }

        }


        tampilkanTombolCari();


        searchInput.addEventListener(
            "input",
            function () {

                tampilkanTombolCari();

            }
        );

    }
);

</script>


</body>

</html>