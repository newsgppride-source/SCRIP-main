import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './', // 🎯 KUNCI UTAMA: Ubah menjadi './' agar rute aset otomatis terbuka dinamis di internet!
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    host: true
  }
});
