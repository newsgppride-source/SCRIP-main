import { Asset, Category, Pilar, Budget, Transaction, User } from './types';

export function formatMYR(n: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n || 0);
}

export function formatCustomDate(dStr: string): string {
  if (!dStr) return '';
  const dt = new Date(dStr);
  if (isNaN(dt.getTime())) return dStr;
  const h = String(dt.getHours()).padStart(2, '0');
  const m = String(dt.getMinutes()).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const mn = dt.toLocaleString('ms-MY', { month: 'short' });
  const y = dt.getFullYear();
  return `${h}:${m} • ${d} ${mn} ${y}`;
}

export const DEFAULT_USERS: User[] = [
  { username: 'admin', fullname: 'Admin', role: 'Admin', email: 'admin@hitungduit.my', password: 'admin123' },
  { username: 'dina', fullname: 'Dina Wahyu', role: 'User', email: 'dina@hitungduit.my', password: 'dina123' }
];

export const DEFAULT_ASSETS: Asset[] = [
  { name: 'Maybank', no_rek: '164123456789', value: 15240.50, category: 'Dompet' },
  { name: 'CIMB Bank', no_rek: '8001234567', value: 8500.00, category: 'Dompet' },
  { name: 'Touch n Go', no_rek: '0123456789', value: 450.00, category: 'Dompet' },
  { name: 'Tunai', no_rek: '-', value: 809.50, category: 'Dompet' },
  { name: 'ASB Saving', no_rek: 'ASB-99812', value: 12000.00, category: 'Aset' }
];

export const DEFAULT_PILARS: Pilar[] = [
  { name: 'Keperluan Asas', type: 'Pengeluaran' },
  { name: 'Gaya Hidup', type: 'Pengeluaran' },
  { name: 'Utiliti & Komitmen', type: 'Pengeluaran' },
  { name: 'Pelaburan & Simpanan', type: 'Pengeluaran' },
  { name: 'Gaji & Pendapatan', type: 'Pemasukan' }
];

export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Gaji Pokok', type: 'Pemasukan', pilar: 'Gaji & Pendapatan' },
  { name: 'Sampingan', type: 'Pemasukan', pilar: 'Gaji & Pendapatan' },
  { name: 'Dividen', type: 'Pemasukan', pilar: 'Gaji & Pendapatan' },
  { name: 'Makanan & Minuman', type: 'Pengeluaran', pilar: 'Keperluan Asas' },
  { name: 'Barangan Dapur', type: 'Pengeluaran', pilar: 'Keperluan Asas' },
  { name: 'Petrol & Transport', type: 'Pengeluaran', pilar: 'Keperluan Asas' },
  { name: 'Sewa Rumah', type: 'Pengeluaran', pilar: 'Utiliti & Komitmen' },
  { name: 'Utiliti & Bil', type: 'Pengeluaran', pilar: 'Utiliti & Komitmen' },
  { name: 'Membeli-belah', type: 'Pengeluaran', pilar: 'Gaya Hidup' },
  { name: 'Hiburan', type: 'Pengeluaran', pilar: 'Gaya Hidup' },
  { name: 'Melancong', type: 'Pengeluaran', pilar: 'Gaya Hidup' },
  { name: 'Simpanan Kecemasan', type: 'Pengeluaran', pilar: 'Pelaburan & Simpanan' }
];

export function generateDefaultTransactions(): Transaction[] {
  return [];
}

export const DEFAULT_BUDGETS: Budget[] = [
  { month: new Date().toISOString().substring(0, 7), type: 'Pengeluaran', category: 'Makanan & Minuman', limit: 600.00, dateRange: '', note: 'Batas belanja makan di luar' },
  { month: new Date().toISOString().substring(0, 7), type: 'Pengeluaran', category: 'Petrol & Transport', limit: 250.00, dateRange: '', note: 'Bajet bulanan pengangkutan' },
  { month: new Date().toISOString().substring(0, 7), type: 'Pemasukan', category: 'Maybank|Gaji Pokok', limit: 4500.00, dateRange: '', note: 'Sasaran simpanan gaji utama' }
];

const KEYS = {
  USERS: 'hitungduit_users',
  ASSETS: 'hitungduit_assets',
  PILARS: 'hitungduit_pilars',
  CATEGORIES: 'hitungduit_categories',
  TRANSACTIONS: 'hitungduit_transactions',
  BUDGETS: 'hitungduit_budgets',
  HIDE_BALANCE: 'hitungduit_hide_balance',
  THEME_DARK: 'hitungduit_theme_dark',
  USER_WRITE_LOCKED: 'hitungduit_user_write_locked'
};

export class LocalDB {
  static init() {
    const initKey = (key: string, defaultValue: any) => {
      const value = localStorage.getItem(key);
      // PERBAIKAN MUTLAK: Jika data kosong karena dihapus, jangan paksa isi ulang data default
      if (value === null) {
        localStorage.setItem(key, JSON.stringify(defaultValue));
      }
    };
    initKey(KEYS.USERS, DEFAULT_USERS);
    initKey(KEYS.ASSETS, DEFAULT_ASSETS);
    initKey(KEYS.PILARS, DEFAULT_PILARS);
    initKey(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    initKey(KEYS.TRANSACTIONS, generateDefaultTransactions());
    initKey(KEYS.BUDGETS, DEFAULT_BUDGETS);
  }

  static getUsers(): User[] { this.init(); return JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'); }
  static saveUsers(users: User[]) { localStorage.setItem(KEYS.USERS, JSON.stringify(users)); }
  static getAssets(): Asset[] { this.init(); return JSON.parse(localStorage.getItem(KEYS.ASSETS) || '[]'); }
  static saveAssets(assets: Asset[]) { localStorage.setItem(KEYS.ASSETS, JSON.stringify(assets)); }
  static getPilars(): Pilar[] { this.init(); return JSON.parse(localStorage.getItem(KEYS.PILARS) || '[]'); }
  static savePilars(pilars: Pilar[]) { localStorage.setItem(KEYS.PILARS, JSON.stringify(pilars)); }
  static getCategories(): Category[] { this.init(); return JSON.parse(localStorage.getItem(KEYS.CATEGORIES) || '[]'); }
  static saveCategories(categories: Category[]) { localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories)); }
  
  static getTransactions(): Transaction[] {
    try {
      this.init();
      const data = localStorage.getItem(KEYS.TRANSACTIONS);
      return (!data || data === 'undefined' || data === 'null') ? [] : JSON.parse(data);
    } catch {
      return [];
    }
  }
  static saveTransactions(transactions: Transaction[]) { localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions)); }
  static getBudgets(): Budget[] { this.init(); return JSON.parse(localStorage.getItem(KEYS.BUDGETS) || '[]'); }
  static saveBudgets(budgets: Budget[]) { localStorage.setItem(KEYS.BUDGETS, JSON.stringify(budgets)); }
  static getHideBalance(): boolean { return localStorage.getItem(KEYS.HIDE_BALANCE) === 'true'; }
  static saveHideBalance(hide: boolean) { localStorage.setItem(KEYS.HIDE_BALANCE, String(hide)); }
  static getThemeDark(): boolean { return localStorage.getItem(KEYS.THEME_DARK) === 'true'; }
  static saveThemeDark(dark: boolean) { localStorage.setItem(KEYS.THEME_DARK, String(dark)); }
  static getUserWriteLocked(): boolean { return localStorage.getItem(KEYS.USER_WRITE_LOCKED) === 'true'; }
  static saveUserWriteLocked(locked: boolean) { localStorage.setItem(KEYS.USER_WRITE_LOCKED, String(locked)); }
}
