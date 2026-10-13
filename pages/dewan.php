<?php
session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";

$keyword = trim($_GET['cari'] ?? '');

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

if ($keyword !== '') {
    $stmt = mysqli_prepare(
        $conn,
        "SELECT * FROM dewan
         WHERE nama LIKE ?
         ORDER BY $order_jabatan ASC, jabatan ASC, nama ASC"
    );

    $cari = "%{$keyword}%";
    mysqli_stmt_bind_param($stmt, "s", $cari);
    mysqli_stmt_execute($stmt);
    $query = mysqli_stmt_get_result($stmt);
} else {
    $query = mysqli_query(
        $conn,
        "SELECT * FROM dewan
         ORDER BY $order_jabatan ASC, jabatan ASC, nama ASC"
    );
}

function tampilkan($nilai)
{
    return htmlspecialchars(
        (string)($nilai ?? ''),
        ENT_QUOTES,
        'UTF-8'
    );
}

$total_data = $query ? mysqli_num_rows($query) : 0;
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Anggota Dewan</title>

    <link rel="stylesheet" href="../assets/css/style.css">

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            background: #f5f7fb;
            font-family: Arial, Helvetica, sans-serif;
            color: #334155;
        }

        .main-content {
            margin-left: 250px;
            min-height: 100vh;
            background: #f5f7fb;
            transition: margin-left .25s ease;
        }

        .main-content.sidebar-collapsed {
            margin-left: 78px;
        }

        .dewan-page {
            width: 100%;
            max-width: 1800px;
            margin: 0 auto;
            padding: 26px 24px;
        }

        /* HEADER */

        .page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 24px;
        }

        .page-heading {
            min-width: 0;
        }

        .breadcrumb {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-size: 12px;
            color: #94a3b8;
        }

        .breadcrumb a {
            color: #64748b;
            text-decoration: none;
        }

        .breadcrumb a:hover {
            color: #1e3a8a;
        }

        .page-header h1 {
            margin: 0 0 8px;
            color: #172554;
            font-size: 25px;
            font-weight: 700;
            letter-spacing: -.4px;
        }

        .page-header p {
            margin: 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.7;
        }

        /* BUTTON */

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            min-height: 38px;
            padding: 9px 13px;
            border: 1px solid transparent;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            text-decoration: none;
            white-space: nowrap;
            cursor: pointer;
            transition: background .2s ease, border-color .2s ease;
        }

        .btn-primary {
            background: #1e3a8a;
            color: #fff;
        }

        .btn-primary:hover {
            background: #1d4ed8;
        }

        .btn-reset {
            background: #fff;
            border-color: #e2e8f0;
            color: #475569;
        }

        .btn-reset:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
        }

        /* PANEL */

        .content-panel {
            width: 100%;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 3px 12px rgba(15, 23, 42, .035);
        }

        .panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            padding: 18px;
            border-bottom: 1px solid #edf0f5;
        }

        .panel-title h2 {
            margin: 0 0 6px;
            color: #1e293b;
            font-size: 15px;
        }

        .panel-title p {
            margin: 0;
            color: #94a3b8;
            font-size: 11px;
        }

        .panel-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .total-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 10px;
            border-radius: 7px;
            background: #eff6ff;
            color: #1e40af;
            font-size: 11px;
            font-weight: 600;
        }

        .total-badge span {
            font-size: 14px;
            font-weight: 700;
        }

        /* TOOLBAR */

        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            padding: 14px 18px;
            background: #fff;
            border-bottom: 1px solid #edf0f5;
        }

        .search-form {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 7px;
            flex: 1;
        }

        .search-input-wrap {
            position: relative;
            width: 300px;
            max-width: 100%;
        }

        .search-input-wrap svg {
            position: absolute;
            left: 11px;
            top: 50%;
            width: 16px;
            height: 16px;
            transform: translateY(-50%);
            stroke: #94a3b8;
            pointer-events: none;
        }

        .search-form input {
            width: 100%;
            height: 38px;
            padding: 0 12px 0 35px;
            border: 1px solid #dbe2ea;
            border-radius: 8px;
            background: #fff;
            color: #334155;
            font-size: 12px;
            outline: none;
            transition: border-color .2s, box-shadow .2s;
        }

        .search-form input::placeholder {
            color: #a0aaba;
        }

        .search-form input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, .10);
        }

        .search-result-info {
            padding: 11px 18px;
            background: #f8fbff;
            border-bottom: 1px solid #e5edf9;
            color: #475569;
            font-size: 11px;
        }

        .search-result-info strong {
            color: #1e3a8a;
        }

        /* TABLE */

        .table-box {
            width: 100%;
            overflow-x: hidden;
        }

        table {
            width: 100%;
            min-width: 0;
            border-collapse: separate;
            border-spacing: 0;
            table-layout: fixed;
        }

        thead th {
            padding: 12px 7px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 10px;
            font-weight: 700;
            text-align: left;
            text-transform: uppercase;
            letter-spacing: 0;
            line-height: 1.5;
            overflow-wrap: anywhere;
        }

        tbody td {
            padding: 12px 7px;
            border-bottom: 1px solid #f1f5f9;
            color: #475569;
            font-size: 11px;
            line-height: 1.65;
            vertical-align: middle;
            overflow-wrap: anywhere;
            word-break: normal;
        }

        tbody tr {
            transition: background .15s ease;
        }

        tbody tr:hover td {
            background: #f8fbff;
        }

        tbody tr:last-child td {
            border-bottom: none;
        }

        /* LEBAR KOLOM */

        th:nth-child(1),
        td:nth-child(1) {
            width: 4%;
            text-align: center;
        }

        th:nth-child(2),
        td:nth-child(2) {
            width: 21%;
        }

        th:nth-child(3),
        td:nth-child(3) {
            width: 16%;
        }

        th:nth-child(4),
        td:nth-child(4) {
            width: 10%;
        }

        th:nth-child(5),
        td:nth-child(5) {
            width: 19%;
        }

        th:nth-child(6),
        td:nth-child(6) {
            width: 17%;
        }

        th:nth-child(7),
        td:nth-child(7) {
            width: 13%;
        }

        .number-cell {
            color: #94a3b8;
            font-weight: 600;
        }

        .dewan-name {
            color: #1e3a8a;
            font-size: 11px;
            font-weight: 700;
            text-decoration: none;
        }

        .dewan-name:hover {
            color: #2563eb;
            text-decoration: underline;
        }

        .jabatan-text {
            color: #334155;
            font-weight: 500;
        }

        .periode-text,
        .party-text {
            color: #64748b;
        }

        .belum-ditentukan {
            color: #94a3b8;
            font-style: italic;
        }

        /* AKSI */

        .lihat-arsip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            max-width: 100%;
            padding: 7px 8px;
            border: 1px solid #dbeafe;
            border-radius: 7px;
            background: #eff6ff;
            color: #1e40af;
            font-size: 10px;
            font-weight: 700;
            text-decoration: none;
            white-space: normal;
            line-height: 1.4;
            transition: background .2s, border-color .2s;
        }

        .lihat-arsip:hover {
            background: #dbeafe;
            border-color: #bfdbfe;
        }

        .lihat-arsip svg {
            width: 13px;
            height: 13px;
            min-width: 13px;
            stroke: currentColor;
        }

        /* DATA KOSONG */

        .empty-data {
            padding: 45px 20px;
            text-align: center;
        }

        .empty-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 50px;
            height: 50px;
            margin: 0 auto 14px;
            border-radius: 14px;
            background: #eff6ff;
            color: #2563eb;
        }

        .empty-icon svg {
            width: 25px;
            height: 25px;
            stroke: currentColor;
        }

        .empty-data h3 {
            margin: 0 0 7px;
            color: #334155;
            font-size: 14px;
        }

        .empty-data p {
            margin: 0;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.7;
        }

        /* FOOTER */

        .table-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            padding: 12px 18px;
            border-top: 1px solid #edf0f5;
            background: #fff;
            color: #94a3b8;
            font-size: 10px;
        }

        /* LAYAR MENENGAH */

        @media (max-width: 1100px) {
            .dewan-page {
                padding: 20px 14px;
            }

            .panel-header,
            .toolbar {
                padding-left: 13px;
                padding-right: 13px;
            }

            thead th {
                padding: 10px 5px;
                font-size: 9px;
            }

            tbody td {
                padding: 10px 5px;
                font-size: 10px;
            }

            .dewan-name {
                font-size: 10px;
            }

            .lihat-arsip {
                padding: 6px 5px;
                font-size: 9px;
                gap: 3px;
            }

            .lihat-arsip svg {
                width: 11px;
                height: 11px;
                min-width: 11px;
            }
        }

        /* LAYAR KECIL */

        @media (max-width: 650px) {
            .main-content,
            .main-content.sidebar-collapsed {
                margin-left: 78px;
            }

            .dewan-page {
                padding: 16px 10px;
            }

            .page-header {
                flex-direction: column;
                align-items: stretch;
                gap: 14px;
                margin-bottom: 18px;
            }

            .page-header h1 {
                font-size: 21px;
            }

            .panel-header {
                align-items: flex-start;
                flex-direction: column;
            }

            .panel-actions {
                width: 100%;
                justify-content: space-between;
            }

            .toolbar {
                align-items: stretch;
                flex-direction: column;
            }

            .search-form {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
            }

            .search-input-wrap {
                width: 100%;
                min-width: 0;
            }

            .search-form .btn-reset {
                grid-column: 1 / -1;
            }

            .table-footer {
                align-items: flex-start;
                flex-direction: column;
            }
        }
    </style>
</head>

<body>

<?php include "../includes/sidebar.php"; ?>

<main class="main-content" id="mainContent">
    <section class="dewan-page">

        <header class="page-header">
            <div class="page-heading">
                <div class="breadcrumb">
                    <a href="dashboard.php">Dashboard</a>
                    <span>/</span>
                    <span>Anggota Dewan</span>
                </div>

                <h1>Anggota Dewan</h1>

                <p>
                    Kelola data anggota DPRD, jabatan, pendamping,
                    dan informasi partai politik.
                </p>
            </div>
        </header>

        <section class="content-panel">

            <div class="panel-header">
                <div class="panel-title">
                    <h2>Daftar Anggota Dewan</h2>
                    <p>Informasi anggota dewan untuk periode 2024–2029.</p>
                </div>

                <div class="panel-actions">
                    <div class="total-badge">
                        Total dewan:
                        <span><?= $total_data ?></span>
                    </div>

                    <a href="tambah_dewan.php" class="btn btn-primary">
                        <span aria-hidden="true">+</span>
                        Tambah Dewan
                    </a>
                </div>
            </div>

            <div class="toolbar">
                <form method="GET" action="dewan.php" class="search-form">
                    <div class="search-input-wrap">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="11" cy="11" r="7"></circle>
                            <path d="m20 20-4-4"></path>
                        </svg>

                        <input
                            type="text"
                            name="cari"
                            value="<?= tampilkan($keyword) ?>"
                            placeholder="Cari nama anggota dewan..."
                            autocomplete="off"
                            aria-label="Cari nama anggota dewan"
                        >
                    </div>

                    <button type="submit" class="btn btn-primary">
                        Cari
                    </button>

                    <?php if ($keyword !== ''): ?>
                        <a href="dewan.php" class="btn btn-reset">
                            Reset
                        </a>
                    <?php endif; ?>
                </form>
            </div>

            <?php if ($keyword !== ''): ?>
                <div class="search-result-info">
                    Hasil pencarian untuk
                    <strong>"<?= tampilkan($keyword) ?>"</strong>.
                    Ditemukan <?= $total_data ?> data.
                </div>
            <?php endif; ?>

            <?php if ($query && $total_data > 0): ?>

                <div class="table-box">
                    <table id="tabelDewan">
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>Nama Dewan</th>
                                <th>Jabatan</th>
                                <th>Periode</th>
                                <th>Pendamping</th>
                                <th>Nama Partai</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>

                        <tbody>
                            <?php $no = 1; ?>

                            <?php while ($row = mysqli_fetch_assoc($query)): ?>
                                <tr>
                                    <td class="number-cell">
                                        <?= $no++ ?>
                                    </td>

                                    <td>
                                        <a
                                            href="arsip_dewan.php?id=<?= (int)$row['id'] ?>"
                                            class="dewan-name"
                                        >
                                            <?= tampilkan($row['nama'] ?? '-') ?>
                                        </a>
                                    </td>

                                    <td class="jabatan-text">
                                        <?= tampilkan($row['jabatan'] ?? '-') ?>
                                    </td>

                                    <td class="periode-text">
                                        <?= tampilkan($row['periode'] ?? '-') ?>
                                    </td>

                                    <td>
                                        <?php if (!empty($row['nama_pengawas'])): ?>
                                            <?= tampilkan($row['nama_pengawas']) ?>
                                        <?php else: ?>
                                            <span class="belum-ditentukan">
                                                Belum ditentukan
                                            </span>
                                        <?php endif; ?>
                                    </td>

                                    <td class="party-text">
                                        <?php if (!empty($row['nama_partai'])): ?>
                                            <?= tampilkan($row['nama_partai']) ?>
                                        <?php else: ?>
                                            <span class="belum-ditentukan">
                                                Belum diisi
                                            </span>
                                        <?php endif; ?>
                                    </td>

                                    <td>
                                        <a
                                            href="arsip_dewan.php?id=<?= (int)$row['id'] ?>"
                                            class="lihat-arsip"
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke-width="2"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                aria-hidden="true"
                                            >
                                                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"></path>
                                                <circle cx="12" cy="12" r="3"></circle>
                                            </svg>

                                            Lihat Arsip
                                        </a>
                                    </td>
                                </tr>
                            <?php endwhile; ?>
                        </tbody>
                    </table>
                </div>

                <div class="table-footer">
                    <span>
                        Menampilkan <?= $total_data ?> data anggota dewan
                    </span>

                    <span>
                        Sistem Pengarsipan DPRD
                    </span>
                </div>

            <?php else: ?>

                <div class="empty-data">
                    <div class="empty-icon">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="10" cy="10" r="6"></circle>
                            <path d="m15 15 5 5"></path>
                        </svg>
                    </div>

                    <?php if ($keyword !== ''): ?>
                        <h3>Data anggota dewan tidak ditemukan</h3>
                        <p>
                            Tidak ada anggota dewan dengan nama
                            "<?= tampilkan($keyword) ?>".
                            <br>
                            Coba gunakan kata kunci yang berbeda.
                        </p>
                    <?php else: ?>
                        <h3>Belum ada data anggota dewan</h3>
                        <p>
                            Tambahkan data anggota dewan untuk mulai
                            menggunakan halaman ini.
                        </p>
                    <?php endif; ?>
                </div>

            <?php endif; ?>

        </section>
    </section>
</main>

</body>
</html>
