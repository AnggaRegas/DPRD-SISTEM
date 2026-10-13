/**
 * Modul Komponen Sidebar & Navigasi
 * Mempertahankan 100% tampilan, animasi, dan fungsi sidebar DPRD
 */
import { getStoredUser, doLogout } from './auth.js';

export function renderSidebar(activeMenu = '') {
  const container = document.getElementById('sidebarContainer');
  if (!container) return;

  const user = getStoredUser() || { nama: 'Staff', role: 'Staff' };
  const inisial = (user.nama || 'S').charAt(0).toUpperCase();

  const isDashboardActive = activeMenu === 'dashboard';
  const isDewanActive = activeMenu === 'dewan';

  const html = `
    <!-- SIDEBAR -->
    <aside class="sidebar" id="sidebar">
      <div class="logo">
        <h2>Sistem Pengarsipan</h2>
        <p>Fasilitasi Penganggaran dan Pengawasan</p>
      </div>

      <button type="button" class="sidebar-toggle" id="sidebarToggle" aria-label="Buka atau tutup sidebar" title="Buka atau tutup sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="18" x2="20" y2="18"/>
        </svg>
      </button>

      <div class="menu">
        <!-- DASHBOARD -->
        <a href="dashboard.html" class="${isDashboardActive ? 'active' : ''}" title="Dashboard">
          <span class="menu-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 10.5L12 3l9 7.5"/>
              <path d="M5 9.5V21h14V9.5"/>
              <path d="M9 21v-7h6v7"/>
            </svg>
          </span>
          <span class="menu-text">Dashboard</span>
        </a>

        <!-- ANGGOTA DEWAN -->
        <a href="dewan.html" class="${isDewanActive ? 'active' : ''}" title="Anggota Dewan">
          <span class="menu-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="3"/>
              <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>
            </svg>
          </span>
          <span class="menu-text">Anggota Dewan</span>
        </a>

        <!-- KELUAR -->
        <a href="#" id="btnLogoutTrigger" title="Keluar">
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

      <!-- AKUN -->
      <div class="sidebar-account">
        <div class="sidebar-account-avatar">${inisial}</div>
        <div class="sidebar-account-text">
          <strong>${user.nama || 'Staff'}</strong>
          <span>${user.role || 'Staff'}</span>
        </div>
      </div>
    </aside>

    <!-- MODAL LOGOUT -->
    <div id="modalLogout" class="logout-modal">
      <div class="logout-modal-box">
        <div class="logout-modal-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <h3>Keluar Sistem</h3>
        <p>Apakah Anda yakin ingin keluar dari sistem pengarsipan?</p>
        <div class="logout-modal-actions">
          <button type="button" class="logout-modal-cancel" id="btnCancelLogout">Batal</button>
          <button type="button" class="logout-modal-confirm" id="btnConfirmLogout">Keluar</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Inisialisasi event & perilaku sidebar
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

  // Pulihkan status sidebar collapsed dari localStorage
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

  // Modal Logout
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
      if (e.target === modalLogout) {
        modalLogout.classList.remove('show');
      }
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
