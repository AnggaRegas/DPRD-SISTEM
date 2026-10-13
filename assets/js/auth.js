/**
 * Modul Autentikasi dan Guard Halaman
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
 * Guard Halaman: Validasi sesi, kewajiban ganti password, dan hak akses peran (role)
 */
export function requireAuth(allowedRoles = null) {
  const user = getStoredUser();
  const token = getStoredToken();

  if (!user || !token) {
    clearSession();
    window.location.replace('login.html');
    return null;
  }

  // Jika akun diwajibkan ganti password pertama kali dan saat ini bukan di halaman profil
  const currentPath = window.location.pathname.toLowerCase();
  const isProfilePage = currentPath.includes('profil.html') || currentPath.endsWith('/profil');
  if (user.mustChangePassword && !isProfilePage) {
    window.location.replace('profil.html?wajib_ganti_password=1');
    return null;
  }

  // Validasi role (jika dibatasi)
  if (allowedRoles && Array.isArray(allowedRoles)) {
    const userRole = (user.role || 'staff').toLowerCase();
    const hasAccess = allowedRoles.map((r) => r.toLowerCase()).includes(userRole);
    if (!hasAccess) {
      alert('Akses Ditolak: Halaman ini hanya dapat diakses oleh administrator sistem.');
      window.location.replace('dashboard.html');
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
