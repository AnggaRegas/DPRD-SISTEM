/**
 * Modul Autentikasi dan Guard Halaman
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
 * Guard Halaman: Jika belum login, redirect ke login.html
 */
export function requireAuth() {
  const user = getStoredUser();
  const token = getStoredToken();
  if (!user || !token) {
    window.location.replace('login.html');
    return null;
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
