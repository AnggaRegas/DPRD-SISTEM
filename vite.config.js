import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        dewan: resolve(__dirname, 'dewan.html'),
        tambah_dewan: resolve(__dirname, 'tambah_dewan.html'),
        edit_dewan: resolve(__dirname, 'edit_dewan.html'),
        arsip_dewan: resolve(__dirname, 'arsip_dewan.html'),
        kategori_dokumen: resolve(__dirname, 'kategori_dokumen.html'),
        dokumen_tahun: resolve(__dirname, 'dokumen_tahun.html'),
        dokumen_folder: resolve(__dirname, 'dokumen_folder.html'),
        tambah_dokumen: resolve(__dirname, 'tambah_dokumen.html'),
        edit_dokumen: resolve(__dirname, 'edit_dokumen.html'),
        tambah_kategori: resolve(__dirname, 'tambah_kategori.html'),
        edit_kategori: resolve(__dirname, 'edit_kategori.html'),
        edit_tahun: resolve(__dirname, 'edit_tahun.html'),
        edit_folder: resolve(__dirname, 'edit_folder.html'),
        profil: resolve(__dirname, 'profil.html'),
        aktivitas: resolve(__dirname, 'aktivitas.html')
      }
    }
  }
});
