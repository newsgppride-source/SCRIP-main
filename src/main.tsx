import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
// Deteksi otomatis siapa yang login untuk menyembunyikan tombol
const sessionUser = localStorage.getItem('hitungduit_active_user');
if (sessionUser) {
  const user = JSON.parse(sessionUser);
  document.body.setAttribute('data-username', user.username?.toLowerCase().trim());
} else {
  document.body.setAttribute('data-username', 'guest');
}
// Penanda Global untuk CSS
const userCheck = localStorage.getItem('hitungduit_active_user');
if (userCheck) {
  const parsed = JSON.parse(userCheck);
  document.body.setAttribute('data-username', parsed.username?.toLowerCase().trim());
  
  if (parsed.username?.toLowerCase().trim() === 'admin') {
    const flag = document.createElement('div');
    flag.id = 'admin-flag';
    flag.style.display = 'none';
    document.body.appendChild(flag);
  }
}
