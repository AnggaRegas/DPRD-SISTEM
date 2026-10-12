<?php

session_start();

session_unset();
session_destroy();

header("Location: /fasilitasi%20penganggaran%20dan%20pengawasan/pages/login.php");
exit;

?>