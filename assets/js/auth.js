/**
 * Modul Autentikasi, Guard Halaman, & Sistem Feedback Global (Toast & Dialog)
 * Sistem Pengarsipan Dokumen DPRD Kota Parepare
 */
import { api } from './api.js';

export function getStoredUser() {
  try {
    const raw = sessionStorage.getItem('dprd_user') || localStorage.getItem('dprd_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function getStoredToken() {
  return sessionStorage.getItem('dprd_token') || localStorage.getItem('dprd_token') || '';
}

export function saveSession(token, user) {
  sessionStorage.setItem('dprd_token', token);
  sessionStorage.setItem('dprd_user', JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem('dprd_token');
  sessionStorage.removeItem('dprd_user');
  localStorage.removeItem('dprd_token');
  localStorage.removeItem('dprd_user');
}

/**
 * Guard Halaman: Validasi sesi aktif, proteksi wajib ganti sandi, dan pembatasan peran
 */
export function requireAuth(allowedRoles = null) {
  const user = getStoredUser();
  const token = getStoredToken();

  if (!user || !token) {
    clearSession();
    window.location.replace('login.html');
    return null;
  }

  // Jika akun diwajibkan ganti password pertama kali, kunci akses halaman lain
  const currentPath = window.location.pathname.toLowerCase();
  const isProfilePage = currentPath.includes('profil.html') || currentPath.endsWith('/profil');
  if (user.mustChangePassword && !isProfilePage) {
    window.location.replace('profil.html?wajib_ganti_password=1');
    return null;
  }

  // Validasi peran (Role-Based Access Control)
  if (allowedRoles && Array.isArray(allowedRoles)) {
    const userRole = (user.role || 'superadmin').toLowerCase();
    // Pada arsitektur satu aktor, superadmin memiliki akses penuh ke seluruh fitur
    if (userRole === 'superadmin') {
      return user;
    }
    const hasAccess = allowedRoles.map((r) => r.toLowerCase()).includes(userRole);
    if (!hasAccess) {
      showToast('Akses Ditolak: Anda tidak memiliki izin untuk halaman ini.', 'error');
      setTimeout(() => {
        window.location.replace('dashboard.html');
      }, 1200);
      return null;
    }
  }

  return user;
}

/**
 * Handle proses Logout sistem
 */
export async function doLogout() {
  try {
    await api.logout();
  } catch (e) {}
  clearSession();
  window.location.replace('login.html');
}

/**
 * Sistem Toast Notification Universal (Pengganti alert() browser)
 */
export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  const iconSvg = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  }[type] || '';

  toast.innerHTML = `
    <span class="toast-icon">${iconSvg}</span>
    <span class="toast-message">${message}</span>
    <button type="button" class="toast-close" aria-label="Tutup">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 250);
  });

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 250);
    }
  }, duration);
}

/**
 * Dialog Konfirmasi Aksesibel (Pengganti confirm() browser)
 */
export function showConfirmDialog(options = {}) {
  const title = options.title || 'Konfirmasi Tindakan';
  const message = options.message || 'Apakah Anda yakin ingin melanjutkan?';
  const confirmText = options.confirmText || options.confirmLabel || 'Ya, Lanjutkan';
  const cancelText = options.cancelText || options.cancelLabel || 'Batal';
  const isDanger = Boolean(options.isDanger || options.danger);
  const onConfirm = options.onConfirm;
  const onCancel = options.onCancel;

  let modal = document.getElementById('globalConfirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'globalConfirmModal';
    modal.className = 'confirm-modal-backdrop';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="confirm-modal-box">
      <div class="confirm-modal-icon ${isDanger ? 'icon-danger' : 'icon-primary'}">
        ${isDanger ? `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        ` : `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        `}
      </div>
      <h3 class="confirm-modal-title">${title}</h3>
      <p class="confirm-modal-desc">${message}</p>
      <div class="confirm-modal-actions">
        <button type="button" class="btn btn-secondary" id="confirmModalCancel">${cancelText}</button>
        <button type="button" class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirmModalOk">${confirmText}</button>
      </div>
    </div>
  `;

  modal.classList.add('active');

  const cancelBtn = modal.querySelector('#confirmModalCancel');
  const okBtn = modal.querySelector('#confirmModalOk');

  const closeModal = () => {
    modal.classList.remove('active');
  };

  cancelBtn.onclick = () => {
    closeModal();
    if (typeof onCancel === 'function') onCancel();
  };

  okBtn.onclick = async () => {
    if (okBtn.disabled) return;
    okBtn.disabled = true;
    const originalText = okBtn.textContent;
    try {
      if (typeof onConfirm === 'function') {
        await onConfirm();
      }
    } finally {
      closeModal();
      okBtn.disabled = false;
      okBtn.textContent = originalText;
    }
  };
}

/**
 * Format Ukuran File Lokal Indonesia
 */
export function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Format Tanggal Lokal Indonesia (WITA Parepare)
 */
export function formatDateIndonesia(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WITA';
  } catch (e) {
    return isoString;
  }
}
