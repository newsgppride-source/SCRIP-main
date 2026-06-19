import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
// =================================================================
// BOMB ATOM FIX: DETEKSI LIST UTAMA UNTUK HANCURKAN DROPDOWN USER
// =================================================================
const bersihkanTombolMataUang = () => {
  try {
    // Membaca daftar pengguna asli dari temuan Anda
    const usersData = localStorage.getItem('hitungduit_users');
    let usernameAktif = 'guest';

    if (usersData) {
      const daftarUser = JSON.parse(usersData);
      
      // Karena isinya semua nama user, kita cari siapa yang saat ini 
      // datanya sedang aktif digunakan (bukan admin) di layar
      // Trik: jika layar mendeteksi teks nama "Dina" atau "User", berarti yang aktif bukan admin
      const teksHalaman = document.body.innerText || "";
      const adakahAdmin = teksHalaman.includes("Admin") || teksHalaman.includes("admin");
      
      if (!adakahAdmin) {
        usernameAktif = 'dina'; // Set ke non-admin agar tombol dihancurkan
      } else {
        // Kita pastikan lagi apakah benar-benar halaman admin
        // Jika di localstorage terdeteksi flag khusus, sesuaikan
        usernameAktif = 'admin'; 
      }
    }

    // JIKA YANG LOGIN BUKAN 'admin', BONGKAR DAN HANCURKAN DROPDOWN MATA UANG!
    if (usernameAktif !== 'admin') {
      const semuaSelect = document.querySelectorAll('select');
      semuaSelect.forEach((selectElement) => {
        if (selectElement.innerHTML.includes('MYR') || selectElement.innerHTML.includes('IDR')) {
          const pembungkus = selectElement.parentElement;
          if (pembungkus && pembungkus.tagName === 'DIV') {
            pembungkus.remove();
          } else {
            selectElement.remove();
          }
          console.log('Satpam Gaib: Tombol mata uang ilegal berhasil dimusnahkan!');
        }
      });
    }
  } catch (e) {
    console.error(e);
  }
};

// Jalankan pembersihan otomatis
bersihkanTombolMataUang();

// Awasi perubahan HTML setiap milidetik secara real-time
const satpamGaib = new MutationObserver(() => {
  bersihkanTombolMataUang();
});
satpamGaib.observe(document.body, { childList: true, subtree: true });
