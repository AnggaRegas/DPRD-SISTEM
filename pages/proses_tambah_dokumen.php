<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

require_once "../config/database.php";


$dewan_id = intval($_POST['dewan_id'] ?? 0);
$judul = trim($_POST['judul'] ?? '');
$kategori_id = intval($_POST['kategori_id'] ?? 0);
$tahun = intval($_POST['tahun'] ?? 0);
$keterangan = trim($_POST['keterangan'] ?? '');


if ($dewan_id <= 0) {
    echo "Anggota Dewan tidak valid.";
    exit;
}


if ($judul === '') {
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


if (!isset($_FILES['file_dokumen'])) {
    echo "File dokumen wajib diupload.";
    exit;
}


$file = $_FILES['file_dokumen'];


if ($file['error'] !== UPLOAD_ERR_OK) {
    echo "File gagal diupload.";
    exit;
}


/* =====================================================
   MAKSIMAL 20 MB
===================================================== */

$max_size = 20 * 1024 * 1024;

if ($file['size'] > $max_size) {
    echo "Ukuran file maksimal 20 MB.";
    exit;
}


/* =====================================================
   FORMAT FILE
===================================================== */

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

if (!in_array(
    $extension,
    $allowed_extensions
)) {
    echo "Format file tidak diperbolehkan.";
    exit;
}


/* =====================================================
   FOLDER UPLOAD
===================================================== */

$folder = "../uploads/dokumen/";

if (!is_dir($folder)) {

    mkdir(
        $folder,
        0777,
        true
    );

}


/* =====================================================
   NAMA FILE
   MENGGUNAKAN NAMA ASLI FILE
===================================================== */

$nama_asli = basename(
    $file['name']
);


/*
 * Bersihkan karakter yang berpotensi bermasalah
 * tetapi tetap mempertahankan nama file.
 */

$nama_file = preg_replace(
    '/[^\w\-. ]+/u',
    '_',
    $nama_asli
);


/*
 * Jika file dengan nama yang sama sudah ada,
 * tambahkan nomor agar tidak tertimpa.
 */

$nama_tanpa_ext = pathinfo(
    $nama_file,
    PATHINFO_FILENAME
);

$ext_file = pathinfo(
    $nama_file,
    PATHINFO_EXTENSION
);

$nama_awal = $nama_tanpa_ext;

$counter = 1;

while (
    file_exists(
        $folder . $nama_file
    )
) {

    $nama_file =
        $nama_awal .
        " (" .
        $counter .
        ")." .
        $ext_file;

    $counter++;

}


$tujuan = $folder . $nama_file;


/* =====================================================
   SIMPAN FILE
===================================================== */

if (!move_uploaded_file(
    $file['tmp_name'],
    $tujuan
)) {

    echo "File gagal disimpan.";
    exit;

}


/* =====================================================
   SIMPAN DATABASE
===================================================== */

$sql = "INSERT INTO dokumen
        (
            dewan_id,
            kategori_id,
            nama_dokumen,
            tahun,
            nama_file,
            keterangan
        )
        VALUES (?, ?, ?, ?, ?, ?)";


$stmt = mysqli_prepare(
    $conn,
    $sql
);


mysqli_stmt_bind_param(
    $stmt,
    "iisiss",
    $dewan_id,
    $kategori_id,
    $judul,
    $tahun,
    $nama_file,
    $keterangan
);


if (mysqli_stmt_execute($stmt)) {

    mysqli_stmt_close($stmt);

    /*
     * Setelah berhasil,
     * kembali ke kategori + tahun.
     */

    header(
        "Location: dokumen_tahun.php" .
        "?dewan_id=" . $dewan_id .
        "&kategori_id=" . $kategori_id .
        "&tahun=" . $tahun
    );

    exit;

}


/* =====================================================
   JIKA DATABASE GAGAL
===================================================== */

if (file_exists($tujuan)) {
    unlink($tujuan);
}

echo "Dokumen gagal disimpan: " .
     mysqli_error($conn);

?>