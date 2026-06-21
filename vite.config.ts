import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/', // 🎯 KUNCI PENUTUP: Cukup gunakan '/' agar rute Vercel langsung tegak lurus terbuka!
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    host: true
  }
});
