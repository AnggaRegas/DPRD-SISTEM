/**
 * Modul Komponen Sidebar & Navigasi Enterprise Government
 * Sistem Pengarsipan Dokumen DPRD Kota Parepare
 * Palet: Deep Navy (#0B192C), Crisp White, Aksen Emas Elegan (#C5A059)
 */
import { getStoredUser, doLogout, showConfirmDialog, initConnectionMonitor } from './auth.js';

export function renderSidebar(activeMenu = '') {
  const container = document.getElementById('sidebarContainer');
  if (!container) return;

  const user = getStoredUser() || { nama: 'Pengguna', role: 'superadmin' };
  const inisial = (user.nama || 'P').charAt(0).toUpperCase();
  const isSuperadmin = user.role === 'superadmin';

  const isDashboardActive = activeMenu === 'dashboard';
  const isArsipActive = activeMenu === 'arsip';
  const isKomisiActive = activeMenu === 'komisi';
  const isDewanActive = activeMenu === 'dewan';
  const isLaporanActive = activeMenu === 'laporan';
  const isStafActive = activeMenu === 'staf';
  const isKategoriActive = activeMenu === 'kategori';
  const isAktivitasActive = activeMenu === 'aktivitas';
  const isProfilActive = activeMenu === 'profil';

  const html = `
    <!-- OVERLAY MOBILE -->
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

    <!-- SIDEBAR UTAMA -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="logo-box">
          <div class="logo-emblem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div class="logo-text">
            <h2>Sistem Pengarsipan</h2>
            <p>DPRD Kota Parepare</p>
          </div>
        </div>
        <button type="button" class="sidebar-toggle-btn desktop-only" id="sidebarToggle" aria-label="Ciutkan navigasi" title="Ciutkan navigasi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button type="button" class="sidebar-close-btn mobile-only" id="sidebarMobileClose" aria-label="Tutup navigasi" title="Tutup navigasi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section-label">Menu Utama</div>

        <!-- 1. DASHBOARD -->
        <a href="dashboard.html" class="nav-item ${isDashboardActive ? 'active' : ''}" title="Dashboard Utama">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </span>
          <span class="nav-text">Dashboard</span>
        </a>

        <!-- 2. ARSIP DOKUMEN DEWAN -->
        <a href="arsip_dewan.html" class="nav-item ${isArsipActive ? 'active' : ''}" title="Katalog Arsip Dokumen Dewan">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </span>
          <span class="nav-text">Arsip Dokumen</span>
        </a>

        ${isSuperadmin ? `
        <!-- 3. ARSIP KOMISI & RDP (SUPERADMIN ONLY) -->
        <a href="komisi.html" class="nav-item ${isKomisiActive ? 'active' : ''}" title="Arsip Komisi & Dokumen RDP">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </span>
          <span class="nav-text">Arsip Komisi & RDP</span>
        </a>
        ` : ''}

        <!-- 4. ANGGOTA DPRD -->
        <a href="dewan.html" class="nav-item ${isDewanActive ? 'active' : ''}" title="Daftar Anggota DPRD Kota Parepare">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </span>
          <span class="nav-text">Anggota DPRD</span>
        </a>

        <!-- 5. LAPORAN & ASPIRASI MASYARAKAT -->
        <a href="laporan.html" class="nav-item ${isLaporanActive ? 'active' : ''}" title="Aspirasi & Laporan Masyarakat">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </span>
          <span class="nav-text">Laporan Masyarakat</span>
        </a>

        ${isSuperadmin ? `
          <!-- 6. KELOLA AKUN STAF (SUPERADMIN ONLY) -->
          <a href="staf.html" class="nav-item ${isStafActive ? 'active' : ''}" title="Kelola Akun Staf Pendamping">
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </span>
            <span class="nav-text">Kelola Akun Staf</span>
          </a>

          <!-- 7. KATEGORI ARSIP (SUPERADMIN ONLY) -->
          <a href="kategori_dokumen.html" class="nav-item ${isKategoriActive ? 'active' : ''}" title="Pengelolaan Kategori Arsip">
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            </span>
            <span class="nav-text">Kategori Arsip</span>
          </a>

          <!-- 7. AKTIVITAS SISTEM (SUPERADMIN ONLY) -->
          <a href="aktivitas.html" class="nav-item ${isAktivitasActive ? 'active' : ''}" title="Catatan Aktivitas & Log Audit Keamanan">
            <span class="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </span>
            <span class="nav-text">Aktivitas Sistem</span>
          </a>
        ` : ''}

        <div class="nav-section-label">Pengaturan</div>

        <!-- 8. PROFIL DAN KEAMANAN -->
        <a href="profil.html" class="nav-item ${isProfilActive ? 'active' : ''}" title="Profil Akun & Keamanan Sandi">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </span>
          <span class="nav-text">Profil & Keamanan</span>
        </a>

        <!-- 9. KELUAR -->
        <a href="#" class="nav-item nav-item-logout" id="btnLogoutTrigger" title="Keluar dari Sistem">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </span>
          <span class="nav-text">Keluar</span>
        </a>
      </nav>

      <!-- USER FOOTER CHIP -->
      <div class="sidebar-user-footer">
        <a href="profil.html" class="user-chip" title="Lihat Profil">
          <div class="user-avatar">${inisial}</div>
          <div class="user-meta">
            <div class="user-name">${user.nama || 'Pengguna'}</div>
            <div class="user-role-badge ${isSuperadmin ? 'superadmin' : 'staff'}">
              ${isSuperadmin ? 'Superadmin' : 'Staf Pendamping'}
            </div>
          </div>
        </a>
      </div>
    </aside>
  `;

  container.innerHTML = html;

  // Pasang Handler Interaktif
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  const mobileCloseBtn = document.getElementById('sidebarMobileClose');
  const backdrop = document.getElementById('sidebarBackdrop');
  const logoutBtn = document.getElementById('btnLogoutTrigger');
  const mobileBtn = document.getElementById('mobileMenuBtn');

  function openMobileSidebar() {
    sidebar.classList.add('mobile-open');
    backdrop.classList.add('active');
    document.body.classList.add('mobile-nav-open');
    if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'true');
    if (mobileCloseBtn) mobileCloseBtn.focus();
  }

  function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    backdrop.classList.remove('active');
    document.body.classList.remove('mobile-nav-open');
    if (mobileBtn) {
      mobileBtn.setAttribute('aria-expanded', 'false');
      mobileBtn.focus();
    }
  }

  // Pulihkan status collapse desktop
  const isCollapsed = localStorage.getItem('dprd_sidebar_collapsed') === 'true';
  if (isCollapsed && window.innerWidth >= 992) {
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
  }

  if (mobileBtn) {
    mobileBtn.setAttribute('aria-expanded', 'false');
    mobileBtn.setAttribute('aria-controls', 'sidebar');
    mobileBtn.onclick = (e) => {
      e.stopPropagation();
      if (sidebar.classList.contains('mobile-open')) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    };
  }

  if (mobileCloseBtn) {
    mobileCloseBtn.onclick = (e) => {
      e.stopPropagation();
      closeMobileSidebar();
    };
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (window.innerWidth < 992) {
        // Mode mobile: buka/tutup drawer
        if (sidebar.classList.contains('mobile-open')) {
          closeMobileSidebar();
        } else {
          openMobileSidebar();
        }
      } else {
        // Mode desktop: ciutkan/lebarkan
        sidebar.classList.toggle('collapsed');
        document.body.classList.toggle('sidebar-collapsed');
        const nowCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('dprd_sidebar_collapsed', String(nowCollapsed));
      }
    });
  }

  if (backdrop) {
    backdrop.onclick = (e) => {
      e.stopPropagation();
      closeMobileSidebar();
    };
  }

  // Tutup dengan tombol Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
      closeMobileSidebar();
    }
  });

  // Otomatis tutup drawer di mobile ketika link menu diklik
  sidebar.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
    if (item.id !== 'btnLogoutTrigger') {
      item.addEventListener('click', () => {
        if (window.innerWidth < 992) {
          closeMobileSidebar();
        }
      });
    }
  });

  // Pasang pemantau status koneksi otomatis pada badge header
  initConnectionMonitor();

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showConfirmDialog({
        title: 'Keluar dari Sistem',
        message: 'Apakah Anda yakin ingin mengakhiri sesi pengarsipan dan keluar?',
        confirmText: 'Ya, Keluar',
        cancelText: 'Batal',
        isDanger: true,
        onConfirm: () => {
          doLogout();
        }
      });
    });
  }
}
