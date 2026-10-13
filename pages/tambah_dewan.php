<?php
session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";

$error = $_GET['error'] ?? '';

$pesan = [
    'nama_double' => 'Nama anggota Dewan sudah terdaftar.',
    'nama_kosong' => 'Nama anggota Dewan wajib diisi.',
    'jabatan_kosong' => 'Jabatan wajib diisi.',
    'periode_kosong' => 'Periode wajib diisi.',
    'partai_kosong' => 'Nama partai wajib dipilih.',
    'gagal_simpan' => 'Data gagal disimpan. Periksa proses penyimpanan.'
];

$daftar_partai = [
    'Partai Kebangkitan Bangsa',
    'Partai Golongan Karya',
    'Partai Nasional Demokrat',
    'Partai Keadilan Sejahtera',
    'Partai Amanat Nasional',
    'Partai Persatuan Pembangunan',
    'Partai Gerakan Indonesia Raya',
    'Partai Gelombang Rakyat Indonesia',
    'Partai Demokrasi Indonesia Perjuangan',
    'Partai Hati Nurani Rakyat',
    'Partai Demokrat',
    'Partai Bulan Bintang'
];
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Tambah Anggota Dewan</title>
    <link rel="stylesheet" href="../assets/css/style.css">

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
            background: #f4f6f9;
        }

        .page {
            padding: 32px;
        }

        .back-navigation {
            margin-bottom: 18px;
        }

        .back-navigation a {
            display: inline-block;
            padding: 9px 14px;
            background: #1e3a8a;
            color: white;
            text-decoration: none;
            border-radius: 7px;
            font-size: 13px;
            font-weight: 600;
        }

        .page-header {
            margin-bottom: 20px;
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

        .form-box {
            max-width: 700px;
            padding: 25px;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
        }

        .error-message {
            margin-bottom: 20px;
            padding: 12px 14px;
            background: #fef2f2;
            border: 1px solid #fca5a5;
            border-radius: 7px;
            color: #b91c1c;
            font-size: 13px;
        }

        .form-group {
            margin-bottom: 18px;
        }

        .form-group label {
            display: block;
            margin-bottom: 7px;
            font-size: 14px;
            font-weight: 600;
            color: #374151;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            display: block;
            width: 100%;
            min-height: 43px;
            padding: 11px 13px;
            border: 1px solid #cbd5e1;
            border-radius: 7px;
            background-color: #fff;
            color: #334155;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 14px;
        }

        .form-group select {
            appearance: auto;
            -webkit-appearance: menulist;
            cursor: pointer;
        }

        .form-group textarea {
            min-height: 100px;
            resize: vertical;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: 2px solid #bfdbfe;
            border-color: #1e3a8a;
        }

        .form-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 25px;
        }

        .btn {
            display: inline-block;
            padding: 11px 17px;
            border: none;
            border-radius: 7px;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
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
            background: #e5e7eb;
            color: #374151;
        }

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
                margin-left: 78px;
            }

            .page {
                padding: 20px;
            }

            .form-box {
                padding: 18px;
            }
        }
    </style>
</head>
<body>

<?php include "../includes/sidebar.php"; ?>

<main class="main-content" id="mainContent">
    <section class="page">

        <div class="back-navigation">
            <a href="dewan.php">← Kembali</a>
        </div>

        <div class="page-header">
            <h1>Tambah Anggota Dewan</h1>
            <p>Masukkan data anggota DPRD Kota Parepare periode 2024–2029.</p>
        </div>

        <div class="form-box">

            <?php if (isset($pesan[$error])): ?>
                <div class="error-message">
                    <?= htmlspecialchars(
                        $pesan[$error],
                        ENT_QUOTES,
                        'UTF-8'
                    ) ?>
                </div>
            <?php endif; ?>

            <form action="proses_tambah_dewan.php" method="POST">

                <div class="form-group">
                    <label for="nama">Nama Anggota Dewan</label>
                    <input
                        type="text"
                        name="nama"
                        id="nama"
                        placeholder="Masukkan nama anggota Dewan"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="jabatan">Jabatan</label>
                    <input
                        type="text"
                        name="jabatan"
                        id="jabatan"
                        placeholder="Contoh: Anggota"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="periode">Periode</label>
                    <input
                        type="text"
                        name="periode"
                        id="periode"
                        value="2024 - 2029"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="nama_pengawas">Pendamping / Pengawas</label>
                    <input
                        type="text"
                        name="nama_pengawas"
                        id="nama_pengawas"
                        placeholder="Masukkan nama pendamping atau pengawas"
                    >
                </div>

                <div class="form-group">
                    <label for="nama_partai">Nama Partai</label>
                    <select name="nama_partai" id="nama_partai" required>
                        <option value="">-- Pilih Nama Partai --</option>

                        <?php foreach ($daftar_partai as $partai): ?>
                            <option value="<?= htmlspecialchars(
                                $partai,
                                ENT_QUOTES,
                                'UTF-8'
                            ) ?>">
                                <?= htmlspecialchars(
                                    $partai,
                                    ENT_QUOTES,
                                    'UTF-8'
                                ) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="form-group">
                    <label for="keterangan">Keterangan</label>
                    <textarea
                        name="keterangan"
                        id="keterangan"
                        placeholder="Keterangan tambahan jika diperlukan"
                    ></textarea>
                </div>

                <div class="form-actions">
                    <a href="dewan.php" class="btn btn-secondary">Batal</a>
                    <button type="submit" class="btn btn-primary">
                        Simpan Data
                    </button>
                </div>

            </form>
        </div>
    </section>
</main>

</body>
</html>
