<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";

/* =====================================================
   AMBIL ID
===================================================== */

$id = intval($_GET['id'] ?? 0);

if ($id <= 0) {
    header("Location: dewan.php");
    exit;
}


/* =====================================================
   PESAN ERROR
===================================================== */

$error = $_GET['error'] ?? '';

$error_message = '';

if ($error === 'nama_double') {

    $error_message =
        "Nama anggota Dewan sudah digunakan oleh anggota Dewan lain.";

} elseif ($error === 'nama_kosong') {

    $error_message =
        "Nama anggota Dewan wajib diisi.";

} elseif ($error === 'jabatan_kosong') {

    $error_message =
        "Jabatan wajib diisi.";

} elseif ($error === 'periode_kosong') {

    $error_message =
        "Periode wajib diisi.";

} elseif ($error === 'gagal_simpan') {

    $error_message =
        "Data gagal disimpan. Silakan coba lagi.";

}


/* =====================================================
   AMBIL DATA DEWAN
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "SELECT *
     FROM dewan
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

$dewan = mysqli_fetch_assoc($result);

mysqli_stmt_close($stmt);

if (!$dewan) {
    echo "Data anggota Dewan tidak ditemukan.";
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
        Edit Anggota Dewan
    </title>

    <link
        rel="stylesheet"
        href="../assets/css/style.css"
    >

    <style>

        /* =====================================================
           HALAMAN
        ===================================================== */

        .page {

            padding: 32px;

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
           HEADER HALAMAN
        ===================================================== */

        .page-header {

            margin-bottom: 20px;

        }


        .page-header h1 {

            margin:
                0 0 7px;

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
           FORM
        ===================================================== */

        .form-box {

            background: white;

            border:
                1px solid
                #e5e7eb;

            border-radius: 10px;

            padding: 25px;

            max-width: 750px;

        }


        /* =====================================================
           PESAN ERROR
        ===================================================== */

        .error-message {

            background: #fef2f2;

            border:
                1px solid
                #fca5a5;

            color: #b91c1c;

            padding:
                12px 14px;

            border-radius: 7px;

            font-size: 13px;

            line-height: 1.5;

            margin-bottom: 20px;

        }


        /* =====================================================
           FORM GROUP
        ===================================================== */

        .form-group {

            margin-bottom: 18px;

        }


        label {

            display: block;

            font-weight: 600;

            font-size: 14px;

            margin-bottom: 7px;

            color: #334155;

        }


        input,
        textarea {

            width: 100%;

            box-sizing: border-box;

            padding:
                11px 13px;

            border:
                1px solid
                #d1d5db;

            border-radius: 7px;

            font-size: 14px;

            color: #334155;

            background: white;

            outline: none;

        }


        input:focus,
        textarea:focus {

            border-color:
                #1e3a8a;

            box-shadow:
                0 0 0 2px
                rgba(30,58,138,0.08);

        }


        textarea {

            min-height: 100px;

            resize: vertical;

        }


        /* =====================================================
           BUTTON
        ===================================================== */

        .btn {

            padding:
                11px 17px;

            border-radius: 7px;

            border: none;

            text-decoration: none;

            cursor: pointer;

            font-size: 14px;

            display: inline-flex;

            align-items: center;

            justify-content: center;

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


        .btn-danger {

            background: #dc2626;

            color: white;

        }


        .btn-danger:hover {

            background: #b91c1c;

        }


        /* =====================================================
           ACTIONS
        ===================================================== */

        .actions {

            display: flex;

            gap: 10px;

            margin-top: 25px;

            flex-wrap: wrap;

        }


        /* =====================================================
           HAPUS DATA
        ===================================================== */

        .delete-area {

            margin-top: 25px;

            padding-top: 20px;

            border-top:
                1px solid
                #e5e7eb;

        }


        /* =====================================================
           MODAL HAPUS
        ===================================================== */

        .delete-modal {

            position: fixed;

            inset: 0;

            background:
                rgba(15, 23, 42, 0.55);

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

            background: #ffffff;

            border-radius: 12px;

            padding: 24px;

            box-shadow:
                0 20px 50px
                rgba(0, 0, 0, 0.18);

            animation:
                modalMasuk
                0.18s ease;

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

            margin:
                0 0 8px;

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


        .btn-modal-cancel {

            padding:
                9px 14px;

            border: none;

            border-radius: 7px;

            background: #e5e7eb;

            color: #374151;

            font-size: 12px;

            font-weight: 600;

            cursor: pointer;

        }


        .btn-modal-cancel:hover {

            background: #d1d5db;

        }


        .btn-modal-delete {

            padding:
                9px 14px;

            border: none;

            border-radius: 7px;

            background: #dc2626;

            color: white;

            font-size: 12px;

            font-weight: 600;

            cursor: pointer;

            text-decoration: none;

            display: inline-flex;

            align-items: center;

            justify-content: center;

        }


        .btn-modal-delete:hover {

            background: #b91c1c;

        }


        /* =====================================================
           RESPONSIVE
        ===================================================== */

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


            .actions {

                flex-direction: column;

            }


            .actions .btn {

                width: 100%;

            }


            .delete-modal-actions {

                flex-direction: column-reverse;

            }


            .delete-modal-actions .btn-modal-cancel,
            .delete-modal-actions .btn-modal-delete {

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

include "../includes/sidebar.php";

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
                href="arsip_dewan.php?id=<?php echo $id; ?>"
            >

                ← Kembali

            </a>

        </div>


        <!-- =================================================
             HEADER HALAMAN
        ================================================== -->

        <div class="page-header">

            <h1>

                Edit Anggota Dewan

            </h1>


            <p>

                Ubah informasi anggota Dewan.

            </p>

        </div>


        <!-- =================================================
             FORM EDIT
        ================================================== -->

        <div class="form-box">


            <!-- =================================================
                 PESAN ERROR
            ================================================== -->

            <?php if ($error_message !== ''): ?>

                <div class="error-message">

                    ⚠️

                    <?= htmlspecialchars($error_message) ?>

                </div>

            <?php endif; ?>


            <form
                action="proses_edit_dewan.php"
                method="POST"
                id="formEditDewan"
            >


                <input
                    type="hidden"
                    name="id"
                    value="<?php echo $id; ?>"
                >


                <!-- NAMA -->

                <div class="form-group">

                    <label>

                        Nama Anggota

                    </label>


                    <input
                        type="text"
                        name="nama"
                        id="nama"
                        value="<?php

                            echo htmlspecialchars(
                                $dewan['nama'] ?? ''
                            );

                        ?>"
                        required
                    >

                </div>


                <!-- JABATAN -->

                <div class="form-group">

                    <label>

                        Jabatan

                    </label>


                    <input
                        type="text"
                        name="jabatan"
                        id="jabatan"
                        value="<?php

                            echo htmlspecialchars(
                                $dewan['jabatan'] ?? ''
                            );

                        ?>"
                        required
                    >

                </div>


                <!-- PERIODE -->

                <div class="form-group">

                    <label>

                        Periode

                    </label>


                    <input
                        type="text"
                        name="periode"
                        id="periode"
                        value="<?php

                            echo htmlspecialchars(
                                $dewan['periode'] ?? ''
                            );

                        ?>"
                        placeholder="Contoh: 2024 - 2029"
                        required
                    >

                </div>


                <!-- PENGAWAS -->

                <div class="form-group">

                    <label>

                        Pengawas

                    </label>


                    <input
                        type="text"
                        name="nama_pengawas"
                        id="nama_pengawas"
                        value="<?php

                            echo htmlspecialchars(
                                $dewan['nama_pengawas'] ?? ''
                            );

                        ?>"
                        placeholder="Masukkan nama pengawas"
                    >

                </div>


                <!-- KETERANGAN -->

                <div class="form-group">

                    <label>

                        Keterangan

                    </label>


                    <textarea
                        name="keterangan"
                        id="keterangan"
                        placeholder="Masukkan keterangan jika diperlukan"
                    ><?php

                        echo htmlspecialchars(
                            $dewan['keterangan'] ?? ''
                        );

                    ?></textarea>

                </div>


                <!-- =================================================
                     TOMBOL
                ================================================== -->

                <div class="actions">


                    <a
                        href="arsip_dewan.php?id=<?php echo $id; ?>"
                        class="btn btn-secondary"
                    >

                        Batal

                    </a>


                    <button
                        type="submit"
                        class="btn btn-primary"
                    >

                        Simpan Perubahan

                    </button>


                </div>


            </form>


            <!-- =================================================
                 HAPUS ANGGOTA
            ================================================== -->

            <div class="delete-area">


                <button
                    type="button"
                    class="btn btn-danger"
                    onclick="bukaModalHapusDewan()"
                >

                    🗑️ Hapus Anggota Dewan

                </button>


            </div>


        </div>


    </section>


</main>


<!-- =====================================================
     MODAL HAPUS ANGGOTA DEWAN
===================================================== -->

<div
    id="modalHapusDewan"
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


        <h3>

            Hapus Anggota Dewan

        </h3>


        <p>

            Apakah Anda yakin ingin menghapus anggota Dewan ini?
            Semua dokumen yang terkait juga akan dihapus.

        </p>


        <div class="delete-modal-actions">


            <button
                type="button"
                class="btn-modal-cancel"
                onclick="tutupModalHapusDewan()"
            >

                Batal

            </button>


            <a
                href="hapus_dewan.php?id=<?php echo $id; ?>"
                class="btn-modal-delete"
            >

                Hapus

            </a>


        </div>


    </div>


</div>


<script>


/* =====================================================
   MODAL HAPUS
===================================================== */

function bukaModalHapusDewan() {

    const modal =
        document.getElementById(
            "modalHapusDewan"
        );

    if (modal) {

        modal.classList.add(
            "show"
        );

    }

}


function tutupModalHapusDewan() {

    const modal =
        document.getElementById(
            "modalHapusDewan"
        );

    if (modal) {

        modal.classList.remove(
            "show"
        );

    }

}


/* Klik area luar modal */

const modalHapusDewan =
    document.getElementById(
        "modalHapusDewan"
    );

if (modalHapusDewan) {

    modalHapusDewan.addEventListener(
        "click",
        function () {

            tutupModalHapusDewan();

        }
    );

}


/* Tombol Escape */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape"
        ) {

            tutupModalHapusDewan();

        }

    }
);


/* =====================================================
   KEYBOARD NAVIGATION FORM
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {


        const fields = [

            document.getElementById(
                "nama"
            ),

            document.getElementById(
                "jabatan"
            ),

            document.getElementById(
                "periode"
            ),

            document.getElementById(
                "nama_pengawas"
            ),

            document.getElementById(
                "keterangan"
            )

        ];


        fields.forEach(
            function (
                field,
                index
            ) {


                if (!field) return;


                field.addEventListener(
                    "keydown",
                    function (event) {


                        /* =================================================
                           PANAH BAWAH
                        ================================================= */

                        if (
                            event.key ===
                            "ArrowDown"
                        ) {

                            event.preventDefault();


                            if (
                                index <
                                fields.length - 1
                            ) {

                                fields[
                                    index + 1
                                ].focus();

                            }


                            return;

                        }


                        /* =================================================
                           PANAH ATAS
                        ================================================= */

                        if (
                            event.key ===
                            "ArrowUp"
                        ) {

                            event.preventDefault();


                            if (
                                index > 0
                            ) {

                                fields[
                                    index - 1
                                ].focus();

                            }


                            return;

                        }


                        /* =================================================
                           ENTER
                        ================================================= */

                        if (
                            event.key ===
                            "Enter"
                        ) {


                            /*
                             * Jika berada di textarea Keterangan,
                             * Enter digunakan untuk menyimpan.
                             */

                            if (
                                field.id ===
                                "keterangan"
                            ) {

                                event.preventDefault();


                                document
                                    .getElementById(
                                        "formEditDewan"
                                    )
                                    .requestSubmit();


                                return;

                            }


                            /*
                             * Input lainnya:
                             * Enter pindah ke kolom berikutnya.
                             */

                            event.preventDefault();


                            if (
                                index <
                                fields.length - 1
                            ) {

                                fields[
                                    index + 1
                                ].focus();

                            }

                        }

                    }
                );

            }
        );

    }
);

</script>


</body>

</html>