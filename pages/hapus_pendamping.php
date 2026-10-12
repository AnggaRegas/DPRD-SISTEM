<?php

session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: /fasilitasi%20penganggaran%20dan%20pengawasan/pages/login.php");
    exit;
}

require_once "../config/database.php";

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($id <= 0) {
    header("Location: pendamping.php");
    exit;
}

$sql = "DELETE FROM pendamping WHERE id = ?";

$stmt = mysqli_prepare($conn, $sql);

mysqli_stmt_bind_param(
    $stmt,
    "i",
    $id
);

mysqli_stmt_execute($stmt);

header("Location: pendamping.php");
exit;

?>