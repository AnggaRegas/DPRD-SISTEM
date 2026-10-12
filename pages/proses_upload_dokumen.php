<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: /fasilitasi%20penganggaran%20dan%20pengawasan/pages/login.php");
    exit;
}

require_once "../config/database.php";


/* =========================================================
   AMBIL DATA
   ========================================================= */

$dewan_id = intval($_POST['dewan_id'] ?? 0);

$kategori_id = intval($_POST['kategori_id'] ?? 0);

$nama_dokumen = trim(
    $_POST['nama_dokumen'] ?? ''
);

$tahun = intval(
    $_POST['tahun'] ?? 0
);

$keterangan = trim(
    $_POST['keterangan'] ?? ''
);

$uploaded_by = $_SESSION['user_id'];


/* =========================================================
   VALIDASI
   ========================================================= */

if ($dewan_id <= 0) {
    echo "Anggota Dewan tidak valid.";
    exit;
}

if ($kategori_id <= 0) {
    echo "Kategori dokumen wajib dipilih.";
    exit;
}

if ($nama_dokumen === '') {
    echo "Nama dokumen wajib diisi.";
    exit;
}

if ($tahun <= 0) {
    echo "Tahun dokumen tidak valid.";
    exit;
}


if (
    !isset($_FILES['file_dokumen']) ||
    $_FILES['file_dokumen']['error'] !== UPLOAD_ERR_OK
) {

    echo "File dokumen wajib dipilih.";
    exit;
}


/* =========================================================
   FILE
   ========================================================= */

$file = $_FILES['file_dokumen'];

$nama_file_asli = $file['name'];

$ukuran_file = $file['size'];

$tmp_file = $file['tmp_name'];

$tipe_file = $file['type'];


/* =========================================================
   CEK EKSTENSI
   ========================================================= */

$ekstensi = strtolower(
    pathinfo(
        $nama_file_asli,
        PATHINFO_EXTENSION
    )
);


$ekstensi_diizinkan = [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx'
];


if (!in_array(
    $ekstensi,
    $ekstensi_diizinkan
)) {

    echo "Format file tidak diperbolehkan.";
    exit;
}


/* =========================================================
   BATAS UKURAN
   10 MB
   ========================================================= */

$batas = 10 * 1024 * 1024;


if ($ukuran_file > $batas) {

    echo "Ukuran file maksimal 10 MB.";
    exit;
}


/* =========================================================
   BUAT NAMA FILE UNIK
   ========================================================= */

$nama_file_baru =
    time()
    . '_'
    . uniqid()
    . '.'
    . $ekstensi;


/* =========================================================
   FOLDER UPLOAD
   ========================================================= */

$folder_upload = "../uploads/";


if (!is_dir($folder_upload)) {

    mkdir(
        $folder_upload,
        0777,
        true
    );
}


$path_file = $folder_upload . $nama_file_baru;


/* =========================================================
   PINDAHKAN FILE
   ========================================================= */

if (!move_uploaded_file(
    $tmp_file,
    $path_file
)) {

    echo "File gagal disimpan.";
    exit;
}


/* =========================================================
   SIMPAN KE DATABASE
   ========================================================= */

$sql = "INSERT INTO dokumen
        (
            dewan_id,
            kategori_id,
            nama_dokumen,
            tahun,
            nama_file,
            path_file,
            ukuran_file,
            tipe_file,
            uploaded_by,
            keterangan
        )
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";


$stmt = mysqli_prepare(
    $conn,
    $sql
);


if (!$stmt) {

    unlink($path_file);

    echo "Query database gagal.";
    exit;
}


mysqli_stmt_bind_param(
    $stmt,
    "iisissisis",
    $dewan_id,
    $kategori_id,
    $nama_dokumen,
    $tahun,
    $nama_file_baru,
    $path_file,
    $ukuran_file,
    $tipe_file,
    $uploaded_by,
    $keterangan
);


/* =========================================================
   SIMPAN
   ========================================================= */

if (mysqli_stmt_execute($stmt)) {

    header(
        "Location: dokumen.php?dewan_id="
        . $dewan_id
    );

    exit;

} else {

    unlink($path_file);

    echo "Dokumen gagal disimpan ke database.";

}

?>