<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


/* =====================================================
   AMBIL DATA FORM
===================================================== */

$id = intval($_POST['id'] ?? 0);

$dewan_id = intval(
    $_POST['dewan_id'] ?? 0
);

$nama_dokumen = trim(
    $_POST['nama_dokumen'] ?? ''
);

$kategori_id = intval(
    $_POST['kategori_id'] ?? 0
);

$tahun = intval(
    $_POST['tahun'] ?? 0
);

$keterangan = trim(
    $_POST['keterangan'] ?? ''
);


/* =====================================================
   VALIDASI DATA
===================================================== */

if ($id <= 0 || $dewan_id <= 0) {

    echo "Data tidak valid.";
    exit;

}


if ($nama_dokumen === '') {

    echo "Nama dokumen wajib diisi.";
    exit;

}


if ($kategori_id <= 0) {

    echo "Kategori dokumen wajib dipilih.";
    exit;

}


if ($tahun < 1900 || $tahun > 2100) {

    echo "Tahun dokumen tidak valid.";
    exit;

}


/* =====================================================
   AMBIL DATA DOKUMEN LAMA
===================================================== */

$stmt = mysqli_prepare(
    $conn,
    "SELECT *
     FROM dokumen
     WHERE id = ?
     AND dewan_id = ?
     LIMIT 1"
);

mysqli_stmt_bind_param(
    $stmt,
    "ii",
    $id,
    $dewan_id
);

mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);

$dokumen = mysqli_fetch_assoc($result);


if (!$dokumen) {

    echo "Dokumen tidak ditemukan.";
    exit;

}


/* =====================================================
   DATA FILE LAMA
===================================================== */

$nama_file_lama = $dokumen['nama_file'] ?? '';

$path_file_lama = $dokumen['path_file'] ?? '';

$nama_file_baru = $nama_file_lama;

$path_file_baru = $path_file_lama;


/* =====================================================
   CEK APAKAH ADA FILE BARU
===================================================== */

$ada_file_baru = false;


if (
    isset($_FILES['file_dokumen']) &&
    $_FILES['file_dokumen']['error'] !== UPLOAD_ERR_NO_FILE
) {

    $file = $_FILES['file_dokumen'];

    $ada_file_baru = true;


    /* =================================================
       CEK ERROR UPLOAD
    ================================================= */

    if (
        $file['error'] !== UPLOAD_ERR_OK
    ) {

        echo "File gagal diupload.";
        exit;

    }


    /* =================================================
       MAKSIMAL 20 MB
    ================================================= */

    $max_size = 20 * 1024 * 1024;


    if (
        $file['size'] > $max_size
    ) {

        echo "Ukuran file maksimal 20 MB.";
        exit;

    }


    /* =================================================
       FORMAT FILE YANG DIIZINKAN
    ================================================= */

    $allowed_extensions = [

        'pdf',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'jpg',
        'jpeg',
        'png'

    ];


    $extension = strtolower(
        pathinfo(
            $file['name'],
            PATHINFO_EXTENSION
        )
    );


    if (
        !in_array(
            $extension,
            $allowed_extensions
        )
    ) {

        echo "Format file tidak diperbolehkan.";
        exit;

    }


    /* =================================================
       FOLDER UPLOAD
    ================================================= */

    $folder = "../uploads/dokumen/";


    if (
        !is_dir($folder)
    ) {

        mkdir(
            $folder,
            0777,
            true
        );

    }


    /* =================================================
       AMBIL NAMA FILE ASLI
    ================================================= */

    $nama_asli = basename(
        $file['name']
    );


    /*
       Hilangkan karakter yang berpotensi
       mengganggu nama file.
    */

    $nama_asli = preg_replace(
        '/[^\p{L}\p{N}\s\-\_\(\)\.]/u',
        '',
        $nama_asli
    );


    $nama_asli = trim(
        $nama_asli
    );


    /*
       Jika nama file kosong,
       gunakan nama sederhana.
    */

    if (
        $nama_asli === ''
    ) {

        $nama_asli =
            'dokumen.' .
            $extension;

    }


    /* =================================================
       PASTIKAN EKSTENSI SESUAI
    ================================================= */

    $nama_tanpa_ekstensi =
        pathinfo(
            $nama_asli,
            PATHINFO_FILENAME
        );

    $ekstensi_asli =
        strtolower(
            pathinfo(
                $nama_asli,
                PATHINFO_EXTENSION
            )
        );


    /*
       Jika file tidak memiliki ekstensi,
       tambahkan ekstensi dari file upload.
    */

    if (
        $ekstensi_asli === ''
    ) {

        $nama_asli =
            $nama_asli .
            '.' .
            $extension;

    }


    /* =================================================
       CEK NAMA FILE AGAR TIDAK BENTROK
    ================================================= */

    $nama_file_baru = $nama_asli;

    $tujuan =
        $folder .
        $nama_file_baru;


    $counter = 1;


    while (
        file_exists($tujuan)
    ) {

        /*
           Jika nama file sama dengan file lama
           dan file tersebut adalah file yang sedang
           diedit, kita tidak perlu membuat nama baru.
        */

        if (
            !empty($nama_file_lama) &&
            $nama_file_baru === $nama_file_lama
        ) {

            break;

        }


        $nama_file_baru =
            $nama_tanpa_ekstensi .
            " (" .
            $counter .
            ")." .
            $extension;


        $tujuan =
            $folder .
            $nama_file_baru;


        $counter++;

    }


    /* =================================================
       SIMPAN FILE BARU
    ================================================= */

    if (
        !move_uploaded_file(
            $file['tmp_name'],
            $tujuan
        )
    ) {

        echo "File gagal disimpan.";
        exit;

    }


    /* =================================================
       PATH FILE BARU
    ================================================= */

    $path_file_baru =
        "uploads/dokumen/" .
        $nama_file_baru;

}


/* =====================================================
   UPDATE DATABASE
===================================================== */

$sql = "UPDATE dokumen SET

            nama_dokumen = ?,

            kategori_id = ?,

            tahun = ?,

            keterangan = ?,

            nama_file = ?,

            path_file = ?

        WHERE id = ?

        AND dewan_id = ?";


$stmt_update = mysqli_prepare(
    $conn,
    $sql
);


if (!$stmt_update) {

    /*
       Jika database gagal disiapkan,
       hapus file baru yang sudah terlanjur
       disimpan.
    */

    if (
        $ada_file_baru &&
        !empty($nama_file_baru)
    ) {

        $file_baru =
            "../uploads/dokumen/" .
            $nama_file_baru;

        if (
            file_exists($file_baru)
        ) {

            unlink($file_baru);

        }

    }


    echo "Gagal memproses perubahan dokumen.";
    exit;

}


mysqli_stmt_bind_param(
    $stmt_update,
    "siisssii",

    $nama_dokumen,

    $kategori_id,

    $tahun,

    $keterangan,

    $nama_file_baru,

    $path_file_baru,

    $id,

    $dewan_id
);


/* =====================================================
   JALANKAN UPDATE
===================================================== */

if (
    mysqli_stmt_execute(
        $stmt_update
    )
) {


    /* ================================================
       HAPUS FILE LAMA JIKA FILE DIGANTI
    ================================================= */

    if (
        $ada_file_baru &&
        !empty($nama_file_lama)
    ) {


        /*
           Jangan hapus file lama jika nama file
           lama dan file baru ternyata sama.
        */

        if (
            $nama_file_lama !==
            $nama_file_baru
        ) {

            $file_lama =
                "../uploads/dokumen/" .
                $nama_file_lama;


            if (
                file_exists($file_lama)
            ) {

                unlink($file_lama);

            }

        }

    }


    /* ================================================
       KEMBALI KE ARSIP ANGGOTA
    ================================================= */

    header(
        "Location: arsip_dewan.php?id=" .
        $dewan_id
    );

    exit;


} else {


    /* ================================================
       DATABASE GAGAL
       HAPUS FILE BARU
    ================================================= */

    if (
        $ada_file_baru &&
        !empty($nama_file_baru)
    ) {

        $file_baru =
            "../uploads/dokumen/" .
            $nama_file_baru;


        if (
            file_exists($file_baru)
        ) {

            unlink($file_baru);

        }

    }


    echo
        "Dokumen gagal diperbarui: " .
        mysqli_error($conn);

}

?>