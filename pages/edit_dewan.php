```php
<?php
session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";

$id = (int) ($_GET['id'] ?? 0);

if ($id <= 0) {
    header("Location: dewan.php");
    exit;
}

$error = $_GET['error'] ?? '';

$pesan_error = [
    'nama_double' => 'Nama anggota Dewan sudah digunakan oleh anggota lain.',
    'nama_kosong' => 'Nama anggota Dewan wajib diisi.',
    'jabatan_kosong' => 'Jabatan wajib diisi.',
    'periode_kosong' => 'Periode wajib diisi.',
    'partai_kosong' => 'Nama partai wajib dipilih.',
    'gagal_simpan' => 'Data gagal disimpan. Silakan coba lagi.'
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

$stmt = mysqli_prepare(
    $conn,
    "SELECT * FROM dewan WHERE id = ? LIMIT 1"
);

if (!$stmt) {
    die("Gagal menyiapkan query data anggota Dewan.");
}

mysqli_stmt_bind_param($stmt, "i", $id);
mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);
$dewan = mysqli_fetch_assoc($result);

mysqli_stmt_close($stmt);

if (!$dewan) {
    die("Data anggota Dewan tidak ditemukan.");
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Edit Anggota Dewan</title>
    <link rel="stylesheet" href="../assets/css/style.css">

    <style>
        * {
            box-sizing: border-box;
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

        .back-navigation a:hover {
            background: #1d4ed8;
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
            max-width: 750px;
            padding: 25px;
            background: white;
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
            line-height: 1.5;
        }

        .form-group {
            margin-bottom: 18px;
        }

        .form-group label {
            display: block;
            margin-bottom: 7px;
            font-size: 14px;
            font-weight: 600;
            color: #334155;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
            display: block;
            width: 100%;
            min-height: 43px;
            padding: 11px 13px;
            border: 1px solid #d1d5db;
            border-radius: 7px;
            background: white;
            color: #334155;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 14px;
        }

        .form-group select {
            appearance: auto;
            -webkit-appearance: menulist;
            cursor: pointer;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: 2px solid #bfdbfe;
            border-color: #1e3a8a;
        }

        .form-group textarea {
            min-height: 100px;
            resize: vertical;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 25px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
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

        .btn-secondary:hover {
            background: #d1d5db;
        }

        .delete-area {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }

        .btn-danger {
            background: #dc2626;
            color: white;
        }

        .btn-danger:hover {
            background: #b91c1c;
        }

        .delete-modal {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(15, 23, 42, 0.55);
        }

        .delete-modal.show {
            display: flex;
        }

        .delete-modal-box {
            width: 100%;
            max-width: 430px;
            padding: 24px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
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

        .delete-modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 22px;
        }

        .btn-modal-cancel,
        .btn-modal-delete {
            padding: 9px 14px;
            border: none;
            border-radius: 7px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
        }

        .btn-modal-cancel {
            background: #e5e7eb;
            color: #374151;
        }

        .btn-modal-delete {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #dc2626;
            color: white;
        }

        @media (max-width: 900px) {
            .page {
                padding: 25px;
            }
        }

        @media (max-width: 650px) {
            .page {
                padding: 20px;
            }

            .page-header h1 {
                font-size: 21px;
            }

            .form-box {
                padding: 20px;
            }

            .actions,
            .delete-modal-actions {
                flex-direction: column;
            }

            .actions .btn,
            .delete-modal-actions button,
            .delete-modal-actions a {
                width: 100%;
            }
        }
    </style>
</head>
<body>

<?php include "../includes/sidebar.php"; ?>

<main class="main-content" id="mainContent">
    <section class="page">

        <div class="back-navigation">
            <a href="arsip_dewan.php?id=<?= $id ?>">← Kembali</a>
        </div>

        <div class="page-header">
            <h1>Edit Anggota Dewan</h1>
            <p>Ubah informasi anggota Dewan.</p>
        </div>

        <div class="form-box">

            <?php if (isset($pesan_error[$error])): ?>
                <div class="error-message">
                    <?= htmlspecialchars(
                        $pesan_error[$error],
                        ENT_QUOTES,
                        'UTF-8'
                    ) ?>
                </div>
            <?php endif; ?>

            <form
                action="proses_edit_dewan.php"
                method="POST"
                id="formEditDewan"
            >
                <input type="hidden" name="id" value="<?= $id ?>">

                <div class="form-group">
                    <label for="nama">Nama Anggota</label>
                    <input
                        type="text"
                        name="nama"
                        id="nama"
                        value="<?= htmlspecialchars($dewan['nama'] ?? '', ENT_QUOTES, 'UTF-8') ?>"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="jabatan">Jabatan</label>
                    <input
                        type="text"
                        name="jabatan"
                        id="jabatan"
                        value="<?= htmlspecialchars($dewan['jabatan'] ?? '', ENT_QUOTES, 'UTF-8') ?>"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="periode">Periode</label>
                    <input
                        type="text"
                        name="periode"
                        id="periode"
                        value="<?= htmlspecialchars($dewan['periode'] ?? '', ENT_QUOTES, 'UTF-8') ?>"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="nama_pengawas">Pengawas</label>
                    <input
                        type="text"
                        name="nama_pengawas"
                        id="nama_pengawas"
                        value="<?= htmlspecialchars($dewan['nama_pengawas'] ?? '', ENT_QUOTES, 'UTF-8') ?>"
                        placeholder="Masukkan nama pengawas"
                    >
                </div>

                <div class="form-group">
                    <label for="nama_partai">Nama Partai</label>
                    <select name="nama_partai" id="nama_partai" required>
                        <option value="">-- Pilih Nama Partai --</option>

                        <?php foreach ($daftar_partai as $partai): ?>
                            <option
                                value="<?= htmlspecialchars($partai, ENT_QUOTES, 'UTF-8') ?>"
                                <?= (($dewan['nama_partai'] ?? '') === $partai) ? 'selected' : '' ?>
                            >
                                <?= htmlspecialchars($partai, ENT_QUOTES, 'UTF-8') ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="form-group">
                    <label for="keterangan">Keterangan</label>
                    <textarea
                        name="keterangan"
                        id="keterangan"
                        placeholder="Masukkan keterangan jika diperlukan"
                    ><?= htmlspecialchars($dewan['keterangan'] ?? '', ENT_QUOTES, 'UTF-8') ?></textarea>
                </div>

                <div class="actions">
                    <a
                        href="arsip_dewan.php?id=<?= $id ?>"
                        class="btn btn-secondary"
                    >Batal</a>

                    <button
                        type="submit"
                        class="btn btn-primary"
                    >Simpan Perubahan</button>
                </div>
            </form>

            <div class="delete-area">
                <button
                    type="button"
                    class="btn btn-danger"
                    onclick="bukaModalHapusDewan()"
                >🗑️ Hapus Anggota Dewan</button>
            </div>
        </div>
    </section>
</main>

<div
    id="modalHapusDewan"
    class="delete-modal"
    onclick="tutupModalHapusDewan()"
>
    <div
        class="delete-modal-box"
        onclick="event.stopPropagation()"
    >
        <h3>Hapus Anggota Dewan</h3>
        <p>
            Apakah Anda yakin ingin menghapus anggota Dewan ini?
            Pastikan tindakan ini memang diperlukan.
        </p>

        <div class="delete-modal-actions">
            <button
                type="button"
                class="btn-modal-cancel"
                onclick="tutupModalHapusDewan()"
            >Batal</button>

            <a
                href="hapus_dewan.php?id=<?= $id ?>"
                class="btn-modal-delete"
            >Hapus</a>
        </div>
    </div>
</div>

<script>
function bukaModalHapusDewan() {
    document.getElementById('modalHapusDewan').classList.add('show');
}

function tutupModalHapusDewan() {
    document.getElementById('modalHapusDewan').classList.remove('show');
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        tutupModalHapusDewan();
    }
});
</script>

</body>
</html>
```