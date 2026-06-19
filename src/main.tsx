import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);// =================================================================
// BOMB ATOM JAVASCRIPT: PAKSA HAPUS DROPDOWN MATA UANG UNTUK USER
// =================================================================
const bersihkanTombolMataUang = () => {
  try {
    const userSession = localStorage.getItem('hitungduit_active_user');
    let username = 'guest';
    
    if (userSession) {
      username = JSON.parse(userSession).username?.toLowerCase().trim() || 'guest';
    }

    // JIKA YANG LOGIN BUKAN 'admin', BURU DAN HANCURKAN DROPDOWN MATA UANG!
    if (username !== 'admin') {
      // Cari semua elemen select yang berisi teks mata uang
      const semuaSelect = document.querySelectorAll('select');
      semuaSelect.forEach((selectElement) => {
        if (selectElement.innerHTML.includes('MYR') || selectElement.innerHTML.includes('IDR')) {
          // Hapus elemen select beserta div pembungkus luarnya agar bersih total
          const pembungkus = selectElement.parentElement;
          if (pembungkus && pembungkus.tagName === 'DIV') {
            pembungkus.remove();
          } else {
            selectElement.remove();
          }
          console.log('Satpam Gaib: Tombol mata uang ilegal berhasil dihancurkan!');
        }
      });
    }
  } catch (e) {
    console.error(e);
  }
};

// Jalankan pembersihan saat halaman pertama kali dimuat
bersihkanTombolMataUang();

// Satpam Gaib (MutationObserver) yang mengawasi layar setiap milidetik
const satpamGaib = new MutationObserver(() => {
  bersihkanTombolMataUang();
});

// Mulai mengawasi seluruh perubahan struktur HTML di website
satpamGaib.observe(document.body, { childList: true, subtree: true });
