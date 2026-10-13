/**
 * Modul Komponen Sidebar & Navigasi
 * Sistem Pengarsipan Dokumen DPRD Kota Parepare
 * Mengikuti struktur navigasi resmi yang bersih dan sederhana.
 */
import { getStoredUser, doLogout } from './auth.js';

export function renderSidebar(activeMenu = '') {
  const container = document.getElementById('sidebarContainer');
  if (!container) return;

  const user = getStoredUser() || { nama: 'Pengguna', role: 'Staff' };
  const inisial = (user.nama || 'P').charAt(0).toUpperCase();
  const role = (user.role || 'staff').toLowerCase();
  const isAdminOrSuper = role === 'superadmin' || role === 'admin';

  const isDashboardActive = activeMenu === 'dashboard';
  const isArsipActive = activeMenu === 'arsip';
  const isDewanActive = activeMenu === 'dewan';
  const isKategoriActive = activeMenu === 'kategori';
  const isPenggunaActive = activeMenu === 'pengguna';
  const isProfilActive = activeMenu === 'profil';

  const html = `
    <!-- SIDEBAR -->
    <aside class="sidebar" id="sidebar">
      <div class="logo">
        <h2>Sistem Pengarsipan</h2>
        <p>DPRD Kota Parepare</p>
      </div>

      <button type="button" class="sidebar-toggle" id="sidebarToggle" aria-label="Buka atau tutup sidebar" title="Buka atau tutup sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="18" x2="20" y2="18"/>
        </svg>
      </button>

      <div class="menu">
        <!-- 1. DASHBOARD -->
        <a href="dashboard.html" class="${isDashboardActive ? 'active' : ''}" title="Dashboard Utama">
          <span class="menu-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 10.5L12 3l9 7.5"/>
              <path d="M5 9.5V21h14V9.5"/>
              <path d="M9 21v-7h6v7"/>
            </svg>
          </span>
          <span class="menu-text">Dashboard</span>
        </a>

        <!-- 2. ARSIP DOKUMEN -->
        <a href="arsip_dewan.html" class="${isArsipActive ? 'active' : ''}" title="Katalog Arsip Dokumen">
          <span class="menu-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span class="menu-text">Arsip Dokumen</span>
        </a>

        <!-- 3. ANGGOTA DEWAN -->
        <a href="dewan.html" class="${isDewanActive ? 'active' : ''}" title="Daftar Anggota DPRD">
          <span class="menu-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </span>
          <span class="menu-text">Anggota Dewan</span>
        </a>

        <!-- 4. KATEGORI ARSIP -->
        <a href="kategori_dokumen.html" class="${isKategoriActive ? 'active' : ''}" title="Pengelolaan Kategori Arsip">
          <span class="menu-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </span>
          <span class="menu-text">Kategori Arsip</span>
        </a>

        ${isAdminOrSuper ? `
        <!-- 5. PENGGUNA & HAK AKSES (KHUSUS ADMIN/SUPERADMIN) -->
        <a href="pengguna.html" class="${isPenggunaActive ? 'active' : ''}" title="Pengguna dan Hak Akses">
          <span class="menu-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"/>
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="12" r="1"/>
            </svg>
          </span>
          <span class="menu-text">Pengguna Sistem</span>
        </a>
        ` : ''}

        <!-- 6. PROFIL & PENGATURAN -->
        <a href="profil.html" class="${isProfilActive ? 'active' : ''}" title="Profil & Ganti Password">
          <span class="menu-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          <span class="menu-text">Profil & Sandi</span>
        </a>

        <!-- 7. KELUAR -->
        <a href="#" id="btnLogoutTrigger" title="Keluar dari Sistem">
          <span class="menu-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 17l5-5-5-5"/>
              <path d="M15 12H3"/>
              <path d="M21 4v16"/>
            </svg>
          </span>
          <span class="menu-text">Keluar</span>
        </a>
      </div>

      <!-- INFO AKUN SIDEBAR -->
      <a href="profil.html" class="sidebar-account" title="Buka Profil Pengguna">
        <div class="sidebar-account-avatar">${inisial}</div>
        <div class="sidebar-account-text">
          <strong>${user.nama || 'Pengguna'}</strong>
          <span>${user.role ? user.role.toUpperCase() : 'STAFF'}</span>
        </div>
      </a>
    </aside>

    <!-- MODAL KONFIRMASI LOGOUT -->
    <div id="modalLogout" class="logout-modal">
      <div class="logout-modal-box">
        <div class="logout-modal-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <h3>Keluar dari Sistem</h3>
        <p>Apakah Anda yakin ingin mengakhiri sesi pengarsipan saat ini?</p>
        <div class="logout-modal-actions">
          <button type="button" class="logout-modal-cancel" id="btnCancelLogout">Batal</button>
          <button type="button" class="logout-modal-confirm" id="btnConfirmLogout">Ya, Keluar</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  setupSidebarBehavior();
}

function setupSidebarBehavior() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  const toggleBtn = document.getElementById('sidebarToggle');
  const modalLogout = document.getElementById('modalLogout');
  const btnLogoutTrigger = document.getElementById('btnLogoutTrigger');
  const btnCancelLogout = document.getElementById('btnCancelLogout');
  const btnConfirmLogout = document.getElementById('btnConfirmLogout');

  if (!sidebar) return;

  if (localStorage.getItem('sidebarStatus') === 'collapsed') {
    sidebar.classList.add('collapsed');
    if (mainContent) mainContent.classList.add('sidebar-collapsed');
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      if (mainContent) mainContent.classList.toggle('sidebar-collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('sidebarStatus', isCollapsed ? 'collapsed' : 'open');
    });
  }

  if (btnLogoutTrigger && modalLogout) {
    btnLogoutTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      modalLogout.classList.add('show');
    });
  }

  if (btnCancelLogout && modalLogout) {
    btnCancelLogout.addEventListener('click', () => {
      modalLogout.classList.remove('show');
    });
  }

  if (modalLogout) {
    modalLogout.addEventListener('click', (e) => {
      if (e.target === modalLogout) modalLogout.classList.remove('show');
    });
  }

  if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', () => {
      doLogout();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalLogout && modalLogout.classList.contains('show')) {
      modalLogout.classList.remove('show');
    }
  });
}
