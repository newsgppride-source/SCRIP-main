export interface Transaction {
  id: string;
  date: string; // ISO string or YYYY-MM-DDTHH:MM:SS
  type: 'Pemasukan' | 'Pengeluaran' | 'Transfer';
  assetName: string; // Wallet name (e.g., Maybank, Cash)
  amount: number;
  note: string;
  category: string; // For transfer, this is the destination wallet name
  user: string; // Full name of the user who recorded it
  receiptUrl?: string; // Optional image/base64 URL
}

export interface Asset {
  name: string;
  no_rek: string; // Account number
  value: number; // Current balance
  category: 'Dompet' | 'Aset'; // Dompet = Wallet/Bank Account, Aset = Physical/Investment
}

export interface Category {
  name: string;
  type: 'Pemasukan' | 'Pengeluaran';
  pilar?: string; // Optional pillar (e.g. Belanja Bulanan)
}

export interface Pilar {
  name: string;
  type: 'Pemasukan' | 'Pengeluaran';
}

export interface Budget {
  month: string; // YYYY-MM
  type: 'Pemasukan' | 'Pengeluaran';
  category: string; // Category name or "Asset|Category" for complex Pemasukan target
  limit: number;
  dateRange: string; // YYYY-MM-DD_YYYY-MM-DD or empty
  note: string;
}

export interface User {
  username: string;
  fullname: string;
  role: 'Admin' | 'User';
  email: string;
  password?: string;
}
