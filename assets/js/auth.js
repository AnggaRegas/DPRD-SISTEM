/**
 * Modul Autentikasi, Guard Halaman, & Sistem Feedback Global (Toast & Dialog)
 * Sistem Pengarsipan Dokumen DPRD Kota Parepare
 */
import { api } from './api.js';

// Safe Storage Fallback untuk Browser & Lingkungan Node.js Test Runner
const memoryStorage = {};
const isBrowser = typeof window !== 'undefined';
const safeLocalStorage = isBrowser && window.localStorage ? window.localStorage : {
  getItem: (k) => memoryStorage[k] || null,
  setItem: (k, v) => { memoryStorage[k] = String(v); },
  removeItem: (k) => { delete memoryStorage[k]; }
};
const safeSessionStorage = isBrowser && window.sessionStorage ? window.sessionStorage : safeLocalStorage;

export const SESSION_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 Jam (Sesuai batas CacheService Google Apps Script)

export function getStoredUser() {
  try {
    const raw = safeSessionStorage.getItem('dprd_user') || safeLocalStorage.getItem('dprd_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function getStoredToken() {
  try {
    return safeSessionStorage.getItem('dprd_token') || safeLocalStorage.getItem('dprd_token') || '';
  } catch (e) {
    return '';
  }
}

export function saveSession(token, user) {
  const now = Date.now();
  const expiresAt = (user && user.expiresAt) ? Number(user.expiresAt) : (now + SESSION_EXPIRY_MS);

  try {
    safeSessionStorage.setItem('dprd_token', token);
    safeSessionStorage.setItem('dprd_user', JSON.stringify(user));
    safeSessionStorage.setItem('dprd_session_saved_at', String(now));
    safeSessionStorage.setItem('dprd_session_expires_at', String(expiresAt));

    safeLocalStorage.setItem('dprd_token', token);
    safeLocalStorage.setItem('dprd_user', JSON.stringify(user));
    safeLocalStorage.setItem('dprd_session_saved_at', String(now));
    safeLocalStorage.setItem('dprd_session_expires_at', String(expiresAt));
  } catch (e) {}
}

export function clearSession() {
  try {
    safeSessionStorage.removeItem('dprd_token');
    safeSessionStorage.removeItem('dprd_user');
    safeSessionStorage.removeItem('dprd_session_saved_at');
    safeSessionStorage.removeItem('dprd_session_expires_at');

    safeLocalStorage.removeItem('dprd_token');
    safeLocalStorage.removeItem('dprd_user');
    safeLocalStorage.removeItem('dprd_session_saved_at');
    safeLocalStorage.removeItem('dprd_session_expires_at');
  } catch (e) {}
}

/**
 * Validasi apakah sesi telah kedaluwarsa secara lokal di browser
 */
export function isSessionExpiredClientSide() {
  try {
    const expiresAtStr = safeSessionStorage.getItem('dprd_session_expires_at') || safeLocalStorage.getItem('dprd_session_expires_at');
    if (expiresAtStr) {
      const expiresAt = Number(expiresAtStr);
      if (!isNaN(expiresAt) && expiresAt > 0) {
        return Date.now() > expiresAt;
      }
    }

    const savedAtStr = safeSessionStorage.getItem('dprd_session_saved_at') || safeLocalStorage.getItem('dprd_session_saved_at');
    if (savedAtStr) {
      const savedAt = Number(savedAtStr);
      if (!isNaN(savedAt) && savedAt > 0) {
        return (Date.now() - savedAt) > SESSION_EXPIRY_MS;
      }
    }
  } catch (e) {}

  return false;
}

/**
 * Arahkan pengguna ke halaman login dengan pengawetan URL target
 */
export function redirectToLogin(isExpired = false) {
  if (typeof window === 'undefined' || !window.location) return;

  const currentPath = window.location.pathname || '';
  const currentSearch = window.location.search || '';
  let target = currentPath;
  if (currentSearch) target += currentSearch;

  // Hindari looping redirect jika sudah berada di halaman login
  if (target.includes('login.html') || target.endsWith('/login')) {
    return;
  }

  const queryParts = [];
  if (isExpired) {
    queryParts.push('expired=1');
  }

  const cleanTarget = target.replace(/^\//, '');
  if (cleanTarget && cleanTarget !== 'index.html' && cleanTarget !== 'login.html') {
    queryParts.push(`redirect=${encodeURIComponent(target)}`);
  }

  const qs = queryParts.length ? `?${queryParts.join('&')}` : '';
  window.location.replace(`login.html${qs}`);
}

/**
 * Guard Halaman: Validasi sesi aktif, proteksi wajib ganti sandi, dan pembatasan peran
 */
export function requireAuth(allowedRoles = null) {
  const user = getStoredUser();
  const token = getStoredToken();

  // 1. Cek keberadaan token & data user
  if (!user || !token) {
    clearSession();
    redirectToLogin(false);
    return null;
  }

  // 2. Cek apakah sesi telah kedaluwarsa secara lokal (misal: tab ditinggal semalaman)
  if (isSessionExpiredClientSide()) {
    clearSession();
    redirectToLogin(true);
    return null;
  }

  // 3. Jika akun diwajibkan ganti password pertama kali, kunci akses halaman lain
  const currentPath = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
  const isProfilePage = currentPath.includes('profil.html') || currentPath.endsWith('/profil');
  if (user.mustChangePassword && !isProfilePage) {
    if (typeof window !== 'undefined' && window.location) {
      window.location.replace('profil.html?wajib_ganti_password=1');
    }
    return null;
  }

  // 4. Validasi peran (Role-Based Access Control)
  if (allowedRoles && Array.isArray(allowedRoles)) {
    const userRole = (user.role || 'superadmin').toLowerCase();
    if (userRole === 'superadmin') {
      return user;
    }
    const hasAccess = allowedRoles.map((r) => r.toLowerCase()).includes(userRole);
    if (!hasAccess) {
      showToast('Akses Ditolak: Anda tidak memiliki izin untuk halaman ini.', 'error');
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location) {
          window.location.replace('dashboard.html');
        }
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

/**
 * Pemantau Status Koneksi Jaringan & Manajemen Siklus Tab Aktif
 * Menjaga header-badge tetap akurat saat online/offline dan mendeteksi sesi kedaluwarsa saat tab dibuka kembali
 */
export function initConnectionMonitor() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function updateBadgeStatus(status) {
    const badges = document.querySelectorAll('.header-badge');
    badges.forEach((badge) => {
      if (badge.id && badge.id.startsWith('badgeTotal')) return;

      const dot = badge.querySelector('.header-badge-dot');
      if (status === 'offline') {
        badge.classList.add('offline');
        badge.classList.remove('reconnecting');
        if (dot) {
          dot.classList.add('offline');
          dot.classList.remove('reconnecting');
        }
        badge.lastChild.textContent = ' Koneksi Terputus';
      } else if (status === 'reconnecting') {
        badge.classList.add('reconnecting');
        badge.classList.remove('offline');
        if (dot) {
          dot.classList.add('reconnecting');
          dot.classList.remove('offline');
        }
        badge.lastChild.textContent = ' Menghubungkan...';
      } else {
        badge.classList.remove('offline', 'reconnecting');
        if (dot) {
          dot.classList.remove('offline', 'reconnecting');
        }
        badge.lastChild.textContent = ' Server Terhubung';
      }
    });
  }

  // Listener event jaringan browser
  window.addEventListener('offline', () => {
    updateBadgeStatus('offline');
    showToast('Koneksi internet terputus. Menunggu jaringan kembali...', 'warning', 4000);
  });

  window.addEventListener('online', () => {
    updateBadgeStatus('reconnecting');
    setTimeout(() => {
      updateBadgeStatus('online');
      showToast('Koneksi internet terhubung kembali.', 'success', 2500);
    }, 1200);
  });

  // Listener visibilitas tab (ketika pengguna kembali membuka tab setelah laptop/HP sleep)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // 1. Cek langsung apakah sesi sudah kedaluwarsa secara lokal
      if (isSessionExpiredClientSide()) {
        clearSession();
        redirectToLogin(true);
        return;
      }

      // 2. Perbarui indikator koneksi
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        updateBadgeStatus('offline');
      } else {
        updateBadgeStatus('online');
      }
    }
  });

  // Jalankan cek awal
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    updateBadgeStatus('offline');
  }
}
