<?php

/* =====================================================
   DATA USER
===================================================== */

$nama_user = $_SESSION['nama'] ?? 'Staff';
$role      = $_SESSION['role'] ?? 'Staff';


/* =====================================================
   INISIAL USER
===================================================== */

$inisial = strtoupper(
    substr($nama_user, 0, 1)
);

?>

<style>

/* =====================================================
   SIDEBAR
===================================================== */

.sidebar {

    position: fixed;

    left: 0;
    top: 0;

    width: 250px;
    height: 100vh;

    background: #1e3a8a;

    color: white;

    padding: 24px 15px;

    display: flex;

    flex-direction: column;

    z-index: 1000;

    overflow: visible;

    transition:
        width 0.25s ease,
        padding 0.25s ease;

}


/* =====================================================
   SIDEBAR COLLAPSED
===================================================== */

.sidebar.collapsed {

    width: 78px;

    padding:
        24px 10px;

}


/* =====================================================
   LOGO / NAMA SISTEM
===================================================== */

.logo {

    height: 82px;

    min-height: 82px;

    width: 220px;

    flex-shrink: 0;

    box-sizing: border-box;

    padding:
        0 10px 28px;

    border-bottom:
        1px solid
        rgba(255,255,255,0.18);

    margin-bottom: 10px;

    display: flex;

    flex-direction: column;

    justify-content: center;

    overflow: hidden;

}


/* =====================================================
   NAMA SISTEM
===================================================== */

.logo h2 {

    margin: 0;

    padding-left: 34px;

    font-size: 18px;

    line-height: 1.4;

    color: white;

    white-space: nowrap;

    position: relative;

    top: 12px;

}


/* =====================================================
   SUB NAMA SISTEM
===================================================== */

.logo p {

    margin: 6px 0 0;

    padding-left: 34px;

    font-size: 12px;

    line-height: 1.5;

    color: #dbeafe;

    font-weight: 500;

    position: relative;

    top: 12px;

    max-width: 180px;

}


/* =====================================================
   SAAT SIDEBAR DITUTUP
   TINGGI AREA LOGO TETAP SAMA
===================================================== */

.sidebar.collapsed .logo {

    height: 82px;

    min-height: 82px;

    /*
     * Sidebar saat collapsed lebarnya 78px
     * dengan padding kiri dan kanan 10px.
     * Jadi lebar area dalam = 58px.
     *
     * Ini mencegah area logo menutupi
     * tombol pada halaman utama.
     */

    width: 58px;

    padding:
        0;

}


/* =====================================================
   TEXT LOGO DISEMBUNYIKAN
   AREA LOGO TETAP ADA
===================================================== */

.sidebar.collapsed .logo h2,
.sidebar.collapsed .logo p {

    display: none;

}


/* =====================================================
   TOMBOL BUKA / TUTUP
===================================================== */

.sidebar-toggle {

    position: absolute;

    top: 28px;

    left: 21px;

    width: 30px;
    height: 30px;

    padding: 0;

    border: none;

    background: transparent;

    color: white;

    display: flex;

    align-items: center;

    justify-content: center;

    cursor: pointer;

    z-index: 1100;

}


.sidebar-toggle:hover {

    background:
        rgba(255,255,255,0.10);

    border-radius: 6px;

}


.sidebar-toggle svg {

    width: 19px;
    height: 19px;

    stroke:
        currentColor;

    transition:
        transform 0.25s ease;

}


/* =====================================================
   SAAT SIDEBAR DITUTUP
===================================================== */

.sidebar.collapsed .sidebar-toggle {

    left: 24px;

    top: 28px;

}


.sidebar.collapsed .sidebar-toggle svg {

    transform:
        rotate(180deg);

}


/* =====================================================
   MENU
===================================================== */

.menu {

    flex: 1;

}


/* =====================================================
   LINK MENU
===================================================== */

.menu a {

    display: flex;

    align-items: center;

    gap: 11px;

    width: 100%;

    padding:
        10px 17px;

    margin-bottom: 3px;

    border-radius: 7px;

    color: white;

    text-decoration: none;

    font-size: 13px;

    transition:
        background-color 0.2s ease;

}


.menu a:hover {

    background:
        rgba(255,255,255,0.10);

}


.menu a.active {

    background: #2563eb;

}


/* =====================================================
   ICON MENU
===================================================== */

.menu-icon {

    width: 22px;

    min-width: 22px;

    height: 22px;

    display: flex;

    align-items: center;

    justify-content: center;

}


.menu-icon svg {

    width: 18px;

    height: 18px;

    stroke:
        currentColor;

}


/* =====================================================
   TEXT MENU
===================================================== */

.menu-text {

    white-space: nowrap;

}


/* =====================================================
   MENU SAAT SIDEBAR DITUTUP
   POSISI IKON TETAP SAMA
===================================================== */

.sidebar.collapsed .menu a {

    justify-content: flex-start;

    padding:
        10px 17px;

}


.sidebar.collapsed .menu-icon {

    width: 22px;

    min-width: 22px;

}


.sidebar.collapsed .menu-text {

    display: none;

}


/* =====================================================
   AKUN
===================================================== */

.sidebar-account {

    flex-shrink: 0;

    display: flex;

    align-items: center;

    gap: 10px;

    padding:
        15px 8px 0;

    border-top:
        1px solid
        rgba(255,255,255,0.18);

}


.sidebar-account-avatar {

    width: 38px;
    height: 38px;

    min-width: 38px;

    border-radius: 50%;

    background: #dbeafe;

    color: #1e3a8a;

    display: flex;

    align-items: center;

    justify-content: center;

    font-size: 14px;

    font-weight: bold;

}


.sidebar-account-text {

    min-width: 0;

    overflow: hidden;

    color: white;

}


.sidebar-account-text strong {

    display: block;

    font-size: 13px;

    font-weight: 600;

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;

}


.sidebar-account-text span {

    display: block;

    margin-top: 3px;

    font-size: 11px;

    color: #dbeafe;

    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;

}


/* =====================================================
   AKUN SAAT SIDEBAR DITUTUP
===================================================== */

.sidebar.collapsed .sidebar-account {

    justify-content: center;

    padding:
        15px 0 0;

}


.sidebar.collapsed .sidebar-account-text {

    display: none;

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


/* =====================================================
   MAIN CONTENT SAAT SIDEBAR DITUTUP
===================================================== */

.main-content.sidebar-collapsed {

    margin-left: 78px;

}


/* =====================================================
   RESPONSIVE
===================================================== */

@media (max-width: 900px) {

    .sidebar {

        width: 220px;

    }


    .main-content {

        margin-left: 220px;

    }


    .main-content.sidebar-collapsed {

        margin-left: 78px;

    }

}


@media (max-width: 650px) {

    .sidebar {

        width: 78px;

        padding:
            24px 10px;

    }


    .sidebar:not(.collapsed) {

        width: 250px;

    }


    .main-content {

        margin-left: 78px;

    }


    .sidebar:not(.collapsed)
    ~ .main-content {

        margin-left: 250px;

    }


    .sidebar.collapsed {

        width: 78px;

    }


    .main-content.sidebar-collapsed {

        margin-left: 78px;

    }

}


/* =====================================================
   MODAL KONFIRMASI KELUAR
===================================================== */

.logout-modal {

    position: fixed;

    inset: 0;

    background: rgba(0, 0, 0, 0.45);

    display: none;

    align-items: center;

    justify-content: center;

    z-index: 9999;

}


.logout-modal.show {

    display: flex;

}


.logout-modal-box {

    width: 390px;

    max-width: calc(100% - 40px);

    background: white;

    border-radius: 12px;

    padding: 28px;

    box-sizing: border-box;

    text-align: center;

    box-shadow:
        0 15px 40px
        rgba(0, 0, 0, 0.20);

    animation:
        logoutModalShow
        0.18s ease;

}


@keyframes logoutModalShow {

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


.logout-modal-icon {

    width: 52px;

    height: 52px;

    margin:
        0 auto 15px;

    border-radius: 50%;

    background: #fee2e2;

    color: #dc2626;

    display: flex;

    align-items: center;

    justify-content: center;

}


.logout-modal-icon svg {

    width: 25px;

    height: 25px;

}


.logout-modal-box h3 {

    margin:
        0 0 8px;

    color: #1f2937;

    font-size: 18px;

}


.logout-modal-box p {

    margin:
        0;

    color: #6b7280;

    font-size: 14px;

    line-height: 1.6;

}


.logout-modal-actions {

    margin-top: 22px;

    display: flex;

    justify-content: center;

    gap: 10px;

}


.logout-modal-cancel {

    border: none;

    background: #e5e7eb;

    color: #374151;

    padding:
        10px 20px;

    border-radius: 7px;

    font-size: 13px;

    font-weight: 600;

    cursor: pointer;

}


.logout-modal-cancel:hover {

    background: #d1d5db;

}


.logout-modal-confirm {

    border: none;

    background: #dc2626;

    color: white;

    padding:
        10px 20px;

    border-radius: 7px;

    font-size: 13px;

    font-weight: 600;

    text-decoration: none;

    cursor: pointer;

}


.logout-modal-confirm:hover {

    background: #b91c1c;

}

</style>


<!-- =====================================================
     SIDEBAR
===================================================== -->

<aside
    class="sidebar"
    id="sidebar"
>


    <!-- =================================================
         NAMA SISTEM
    ================================================== -->

    <div class="logo">

        <h2>
            Sistem Pengarsipan
        </h2>

        <p>
            Fasilitasi Penganggaran dan Pengawasan
        </p>

    </div>


    <!-- =================================================
         TOMBOL BUKA / TUTUP
    ================================================== -->

    <button
        type="button"
        class="sidebar-toggle"
        id="sidebarToggle"
        aria-label="Buka atau tutup sidebar"
        title="Buka atau tutup sidebar"
    >

        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >

            <line
                x1="4"
                y1="6"
                x2="20"
                y2="6"
            />

            <line
                x1="4"
                y1="12"
                x2="20"
                y2="12"
            />

            <line
                x1="4"
                y1="18"
                x2="20"
                y2="18"
            />

        </svg>

    </button>


    <!-- =================================================
         MENU
    ================================================== -->

    <div class="menu">


        <!-- DASHBOARD -->

        <a
            href="dashboard.php"
            class="<?php
                echo basename($_SERVER['PHP_SELF']) === 'dashboard.php'
                    ? 'active'
                    : '';
            ?>"
            title="Dashboard"
        >

            <span class="menu-icon">

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >

                    <path
                        d="M3 10.5L12 3l9 7.5"
                    />

                    <path
                        d="M5 9.5V21h14V9.5"
                    />

                    <path
                        d="M9 21v-7h6v7"
                    />

                </svg>

            </span>


            <span class="menu-text">
                Dashboard
            </span>

        </a>


        <!-- ANGGOTA DEWAN -->

        <a
            href="dewan.php"
            class="<?php
                echo in_array(
                    basename($_SERVER['PHP_SELF']),
                    [
                        'dewan.php',
                        'tambah_dewan.php',
                        'edit_dewan.php',
                        'arsip_dewan.php',
                        'kategori_dokumen.php',
                        'dokumen_tahun.php',
                        'dokumen_folder.php',
                        'dokumen.php',
                        'tambah_dokumen.php',
                        'edit_dokumen.php'
                    ]
                )
                ? 'active'
                : '';
            ?>"
            title="Anggota Dewan"
        >

            <span class="menu-icon">

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >

                    <circle
                        cx="12"
                        cy="8"
                        r="3"
                    />

                    <path
                        d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"
                    />

                </svg>

            </span>


            <span class="menu-text">
                Anggota Dewan
            </span>

        </a>


        <!-- KELUAR -->

        <a
            href="#"
            title="Keluar"
            onclick="bukaModalLogout(); return false;"
        >

            <span class="menu-icon">

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >

                    <path
                        d="M10 17l5-5-5-5"
                    />

                    <path
                        d="M15 12H3"
                    />

                    <path
                        d="M21 4v16"
                    />

                </svg>

            </span>


            <span class="menu-text">
                Keluar
            </span>

        </a>


    </div>


    <!-- =================================================
         AKUN
    ================================================== -->

    <div class="sidebar-account">


        <div class="sidebar-account-avatar">

            <?php

            echo htmlspecialchars(
                $inisial
            );

            ?>

        </div>


        <div class="sidebar-account-text">

            <strong>

                <?php

                echo htmlspecialchars(
                    $nama_user
                );

                ?>

            </strong>


            <span>

                <?php

                echo htmlspecialchars(
                    $role
                );

                ?>

            </span>

        </div>

    </div>


</aside>


<!-- =====================================================
     MODAL KONFIRMASI KELUAR
===================================================== -->

<div
    id="modalLogout"
    class="logout-modal"
    onclick="tutupModalLogout()"
>


    <div
        class="logout-modal-box"
        onclick="event.stopPropagation()"
    >


        <div class="logout-modal-icon">

            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >

                <path
                    d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                />

                <polyline
                    points="16 17 21 12 16 7"
                />

                <line
                    x1="21"
                    y1="12"
                    x2="9"
                    y2="12"
                />

            </svg>

        </div>


        <h3>
            Keluar Sistem
        </h3>


        <p>
            Apakah Anda yakin ingin keluar dari sistem?
        </p>


        <div class="logout-modal-actions">


            <button
                type="button"
                class="logout-modal-cancel"
                onclick="tutupModalLogout()"
            >
                Batal
            </button>


            <a
                href="logout.php"
                class="logout-modal-confirm"
            >
                Keluar
            </a>


        </div>


    </div>

</div>


<!-- =====================================================
     JAVASCRIPT SIDEBAR
===================================================== -->

<script>

document.addEventListener(
    "DOMContentLoaded",
    function () {


        const sidebar =
            document.getElementById(
                "sidebar"
            );


        const mainContent =
            document.getElementById(
                "mainContent"
            );


        const toggleButton =
            document.getElementById(
                "sidebarToggle"
            );


        /*
         * Pastikan semua elemen
         * ditemukan.
         */

        if (
            !sidebar ||
            !toggleButton
        ) {

            return;

        }


        /*
         * Ambil status sidebar
         * yang tersimpan.
         */

        const sidebarStatus =
            localStorage.getItem(
                "sidebarStatus"
            );


        /*
         * Jika sebelumnya ditutup,
         * tetap dalam keadaan tertutup.
         */

        if (
            sidebarStatus === "collapsed"
        ) {

            sidebar.classList.add(
                "collapsed"
            );


            if (mainContent) {

                mainContent.classList.add(
                    "sidebar-collapsed"
                );

            }

        }


        /* =================================================
           TOMBOL BUKA / TUTUP
        ================================================= */

        toggleButton.addEventListener(
            "click",
            function () {


                sidebar.classList.toggle(
                    "collapsed"
                );


                if (mainContent) {

                    mainContent.classList.toggle(
                        "sidebar-collapsed"
                    );

                }


                /*
                 * Simpan kondisi sidebar.
                 */

                if (
                    sidebar.classList.contains(
                        "collapsed"
                    )
                ) {

                    localStorage.setItem(
                        "sidebarStatus",
                        "collapsed"
                    );

                } else {

                    localStorage.setItem(
                        "sidebarStatus",
                        "open"
                    );

                }

            }
        );


    }
);


/* =====================================================
   MODAL LOGOUT
===================================================== */

function bukaModalLogout() {

    const modal =
        document.getElementById(
            "modalLogout"
        );

    if (modal) {

        modal.classList.add(
            "show"
        );

    }

}


function tutupModalLogout() {

    const modal =
        document.getElementById(
            "modalLogout"
        );

    if (modal) {

        modal.classList.remove(
            "show"
        );

    }

}


/* =====================================================
   TOMBOL ESC UNTUK MENUTUP MODAL
===================================================== */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape"
        ) {

            tutupModalLogout();

        }

    }
);

</script>