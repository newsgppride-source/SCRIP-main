import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Wallet, 
  TrendingUp, 
  History, 
  Settings as SettingsIcon, 
  Power, 
  Eye, 
  EyeOff, 
  Check, 
  Calendar, 
  Trash2, 
  Edit3, 
  Copy, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCw, 
  ChevronRight, 
  FolderPlus, 
  Layers, 
  UserPlus, 
  Download, 
  FileText, 
  Image as ImageIcon, 
  TrendingDown, 
  Cpu, 
  ChevronLeft,
  X,
  CreditCard,
  Lock,
  Unlock
} from 'lucide-react';
import { LocalDB, formatMYR, formatCustomDate, DEFAULT_USERS } from './utils';
import { Asset, Category, Pilar, Budget, Transaction, User } from './types';
import { 
  initializeFirestoreDefaults,
  subscribeUsers,
  subscribeAssets,
  subscribePilars,
  subscribeCategories,
  subscribeTransactions,
  subscribeBudgets,
  subscribeGlobalConfig,
  dbSaveUser,
  dbDeleteUser,
  dbSaveAsset,
  dbDeleteAsset,
  dbSavePilar,
  dbDeletePilar,
  dbSaveCategory,
  dbDeleteCategory,
  dbSaveTransaction,
  dbDeleteTransaction,
  dbSaveBudget,
  dbDeleteBudget,
  dbSetWriteLocked,
  fetchLiveState
} from './firebase';

export default function App() {
    // SEBATIK PEMBERSIH UTAMA: Paksa buang dompet dummy dari memori saat aplikasi dibuka
  useEffect(() => {
    try {
      const bakiLokal = localStorage.getItem('hitungduit_assets');
      if (bakiLokal) {
        const senaraiAset = JSON.parse(bakiLokal);
        // Jika di memori lokal terdeteksi ada Maybank bawaan pabrik, bersihkan total!
        const adakahMaybank = senaraiAset.some((a: any) => a.name === 'Maybank' && a.no_rek === '164123456789');
        if (adakahMaybank) {
          localStorage.setItem('hitungduit_assets', JSON.stringify([]));
          setAssets([]);
          window.location.reload();
        }
      }
    } catch (e) {}
  }, []);

  // State from Local DB
  const [users, setUsers] = useState<User[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pilars, setPilars] = useState<Pilar[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  
  // UI States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [isUserWriteLocked, setIsUserWriteLocked] = useState(false);
  const [activePage, setActivePage] = useState<'home' | 'assets' | 'report' | 'history' | 'settings'>('home');
  const [liveClock, setLiveClock] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'connecting' | 'synced' | 'offline'>('connecting');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Filter States for Riwayat (History)
  const [histTypeFilter, setHistTypeFilter] = useState<'Semua' | 'Pemasukan' | 'Pengeluaran'>('Semua');
  const [histStartDate, setHistStartDate] = useState('');
  const [histEndDate, setHistEndDate] = useState('');
  const [histAssetFilter, setHistAssetFilter] = useState('Semua');

  // Filter States for Analitik (Report)
  const [repYearFilter, setRepYearFilter] = useState(new Date().getFullYear().toString());
  const [repMonthFilter, setRepMonthFilter] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [repAssetFilter, setRepAssetFilter] = useState('Semua');
  const [repPilarFilter, setRepPilarFilter] = useState<string | null>(null);
  const [repCategoryFilter, setRepCategoryFilter] = useState<string | null>(null);

  // Quick Add Transaction Dialog state
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txDate, setTxDate] = useState(new Date().toISOString().substring(0, 10));
  const [txType, setTxType] = useState<'Pemasukan' | 'Pengeluaran' | 'Transfer'>('Pengeluaran');
  const [txAmountStr, setTxAmountStr] = useState('');
  const [txAsset, setTxAsset] = useState('');
  const [txCategory, setTxCategory] = useState(''); // Category or Destination Wallet if transfer
  const [txNote, setTxNote] = useState('');
  const [txReceiptBase64, setTxReceiptBase64] = useState<string | null>(null);

  // Settings action modes
  const [settingsModal, setSettingsModal] = useState<{
    type: 'add_user' | 'edit_user' | 'add_category' | 'edit_category' | 'add_pilar' | 'edit_pilar' | 'add_asset' | 'edit_asset' | 'add_budget' | 'edit_budget' | null;
    data?: any;
  } | null>(null);

  // Form Inputs for settings modals
  const [userInputFullname, setUserInputFullname] = useState('');
  const [userInputUsername, setUserInputUsername] = useState('');
  const [userInputEmail, setUserInputEmail] = useState('');
  const [userInputPassword, setUserInputPassword] = useState('');
  const [userInputRole, setUserInputRole] = useState<'Admin' | 'User'>('User');

  const [catInputName, setCatInputName] = useState('');
  const [catInputPilar, setCatInputPilar] = useState('');

  const [pilarInputName, setPilarInputName] = useState('');

  const [assetInputName, setAssetInputName] = useState('');
  const [assetInputNoRek, setAssetInputNoRek] = useState('');
  const [assetInputVal, setAssetInputVal] = useState('');

  const [budgetInputCat, setBudgetInputCat] = useState('');
  const [budgetInputLimit, setBudgetInputLimit] = useState('');
  const [budgetInputStart, setBudgetInputStart] = useState('');
  const [budgetInputEnd, setBudgetInputEnd] = useState('');
  const [budgetInputIgnoreDate, setBudgetInputIgnoreDate] = useState(false);
  const [budgetInputNote, setBudgetInputNote] = useState('');

  // Toast State for micro feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Run initial state loading and Real-time Firestore Synchronizations
  useEffect(() => {
    LocalDB.init();
    setUsers(LocalDB.getUsers());
    setAssets(LocalDB.getAssets());
    setPilars(LocalDB.getPilars());
    setCategories(LocalDB.getCategories());
    setTransactions(LocalDB.getTransactions());
    setBudgets(LocalDB.getBudgets());
    setIsUserWriteLocked(LocalDB.getUserWriteLocked());
    setIsBalanceHidden(LocalDB.getHideBalance());
    
    const savedDark = LocalDB.getThemeDark();
    setIsDarkMode(savedDark);
    if (savedDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }

    // Auto-login if previously saved, otherwise prompt
    const savedUser = sessionStorage.getItem('logged_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }

    // Firebase real-time integration
    const runFirebaseSync = () => {
      // Helper to mark status as synced
      const markSynced = () => {
        setCloudStatus('synced');
      };

      // 1. Subscribe to real-time updates of each collection IMMEDIATELY
      const unsubUsers = subscribeUsers((usersList) => {
        setUsers(usersList);
        LocalDB.saveUsers(usersList);
        markSynced();
      });

      const unsubAssets = subscribeAssets((assetsList) => {
        setAssets(assetsList);
        LocalDB.saveAssets(assetsList);
        markSynced();
      });

      const unsubPilars = subscribePilars((pilarsList) => {
        setPilars(pilarsList);
        LocalDB.savePilars(pilarsList);
        markSynced();
      });

      const unsubCategories = subscribeCategories((categoriesList) => {
        setCategories(categoriesList);
        LocalDB.saveCategories(categoriesList);
        markSynced();
      });

      const unsubTransactions = subscribeTransactions((txList) => {
        setTransactions(txList);
        LocalDB.saveTransactions(txList);
        markSynced();
      });

      const unsubBudgets = subscribeBudgets((budgetsList) => {
        setBudgets(budgetsList);
        LocalDB.saveBudgets(budgetsList);
        markSynced();
      });

      const unsubConfig = subscribeGlobalConfig((isLocked) => {
        setIsUserWriteLocked(isLocked);
        LocalDB.saveUserWriteLocked(isLocked);
        markSynced();
      });

      // 2. Send default data to Firestore in background if completely new project
      initializeFirestoreDefaults({
        users: LocalDB.getUsers(),
        assets: LocalDB.getAssets(),
        pilars: LocalDB.getPilars(),
        categories: LocalDB.getCategories(),
        transactions: LocalDB.getTransactions(),
        budgets: LocalDB.getBudgets()
      }).catch((err) => {
        console.error('Firebase background initialization error:', err);
      });

      // return clear function
      return () => {
        unsubUsers();
        unsubAssets();
        unsubPilars();
        unsubCategories();
        unsubTransactions();
        unsubBudgets();
        unsubConfig();
      };
    };

    // Eager direct pull on startup to override empty localStorage immediately
    const doInitialStateSync = async () => {
      try {
        const data = await fetchLiveState();
        if (data.users.length > 0) setUsers(data.users);
        if (data.assets.length > 0) setAssets(data.assets);
        if (data.pilars.length > 0) setPilars(data.pilars);
        if (data.categories.length > 0) setCategories(data.categories);
        if (data.transactions.length > 0) setTransactions(data.transactions);
        if (data.budgets.length > 0) setBudgets(data.budgets);
        setIsUserWriteLocked(data.isUserWriteLocked);

        // Store in local storage
        if (data.users.length > 0) LocalDB.saveUsers(data.users);
        if (data.assets.length > 0) LocalDB.saveAssets(data.assets);
        if (data.pilars.length > 0) LocalDB.savePilars(data.pilars);
        if (data.categories.length > 0) LocalDB.saveCategories(data.categories);
        if (data.transactions.length > 0) LocalDB.saveTransactions(data.transactions);
        if (data.budgets.length > 0) LocalDB.saveBudgets(data.budgets);
        LocalDB.saveUserWriteLocked(data.isUserWriteLocked);

        setCloudStatus('synced');
      } catch (err) {
        console.warn('Initial cloud pull failed, relying on snapshots or localStorage cache:', err);
      }
    };

    const unsubFunc = runFirebaseSync();
    doInitialStateSync();

    // Setup offline fallback timer if cloud connection takes too long
    const checkTimeout = setTimeout(() => {
      setCloudStatus((current) => {
        if (current === 'connecting') {
          return 'offline';
        }
        return current;
      });
    }, 4500);

    return () => {
      if (unsubFunc) unsubFunc();
      clearTimeout(checkTimeout);
    };
  }, []);

  // Sync Live Clock in ms-MY / en-MY style
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
      const months = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
      const dayName = days[now.getDay()];
      const day = now.getDate();
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setLiveClock(`${h}:${m}, ${dayName} ${day} ${month} ${year}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Quick show notification toast helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

 const handleLogout = () => {
  // 1. Bersihkan seluruh memori sesi login di browser agar tidak tersangkut
  localStorage.clear(); 
  
  // 2. Setel ulang status user aktif menjadi kosong (null)
  setCurrentUser(null); 
  
  triggerToast('Anda telah log keluar.');
  
  // 3. Muat ulang halaman agar sistem bersih total
  window.location.reload(); 
};

  // Handle authentication login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Search in loaded users state, or fallback to DEFAULT_USERS static array
    let found = users.find(u => u.username.toLowerCase() === loginUsername.toLowerCase());
    if (!found) {
      found = DEFAULT_USERS.find(u => u.username.toLowerCase() === loginUsername.toLowerCase());
    }
    
    // Check if user has specific password, fallback to username or default password otherwise.
    // We explicitly support both 'admin123' and '@RuangPerpus' as valid fallback passwords for 'admin'
    const isPasswordValid = found && (
      (found.password && (
        loginPassword === found.password || 
        (found.username.toLowerCase() === 'admin' && (loginPassword === '@RuangPerpus' || loginPassword === 'admin123'))
      )) ||
      (!found.password && (loginPassword === '@RuangPerpus' || loginPassword === 'admin123' || loginPassword === found.username))
    );
        if (found && isPasswordValid) {
      setLoginError('');
      setCurrentUser(found);
      sessionStorage.setItem('logged_user', JSON.stringify(found));
      localStorage.setItem('logged_user', JSON.stringify(found)); // Cadangan memori instan
      
      // MEMAKSA MESIN SINKRONISASI FIREBASE CLOUD TERBANGUN INSTAN DETIK INI JUGA!
      runFirebaseSync();
      setCloudStatus('synced');
      
      triggerToast(`Selamat kembali, ${found.fullname}!`);
    }

  // Force database sync and pull fresh live state straight from cloud
  const triggerRealCloudSync = async () => {
    setIsSyncing(true);
    try {
      const data = await fetchLiveState();
      
      // Update state
      if (data.users.length > 0) setUsers(data.users);
      if (data.assets.length > 0) setAssets(data.assets);
      if (data.pilars.length > 0) setPilars(data.pilars);
      if (data.categories.length > 0) setCategories(data.categories);
      if (data.transactions.length > 0) setTransactions(data.transactions);
      if (data.budgets.length > 0) setBudgets(data.budgets);
      setIsUserWriteLocked(data.isUserWriteLocked);

      // Store in local storage to prevent mismatch
      if (data.users.length > 0) LocalDB.saveUsers(data.users);
      if (data.assets.length > 0) LocalDB.saveAssets(data.assets);
      if (data.pilars.length > 0) LocalDB.savePilars(data.pilars);
      if (data.categories.length > 0) LocalDB.saveCategories(data.categories);
      if (data.transactions.length > 0) LocalDB.saveTransactions(data.transactions);
      if (data.budgets.length > 0) LocalDB.saveBudgets(data.budgets);
      LocalDB.saveUserWriteLocked(data.isUserWriteLocked);

      setCloudStatus('synced');
      triggerToast('Penyelarasan awan berjaya disegerakan!');
    } catch (err) {
      console.error('Manual cloud resync failure:', err);
      setCloudStatus('offline');
      triggerToast('Sambungan awan gagal. Menggunakan data tempatan.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate Net Worth / Total asset in wallet
  const netWealth = useMemo(() => {
    return assets
      .filter(a => a.category === 'Dompet')
      .reduce((sum, a) => sum + a.value, 0);
  }, [assets]);

  // Current Month Totals
  const totalsThisMonth = useMemo(() => {
    const currentYearMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
      if (t.date.substring(0, 7) === currentYearMonth) {
        if (t.type === 'Pemasukan') {
          income += t.amount;
        } else if (t.type === 'Pengeluaran') {
          expense += t.amount;
        }
      }
    });

    return { income, expense };
  }, [transactions]);

  // Toggle hiding wealth balance
  const toggleBalancePrivacy = () => {
    const nextVal = !isBalanceHidden;
    setIsBalanceHidden(nextVal);
    LocalDB.saveHideBalance(nextVal);
    triggerToast(nextVal ? 'Baki disembunyikan.' : 'Baki dipaparkan.');
  };

  // Toggle Theme Mode
  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    LocalDB.saveThemeDark(nextDark);
    if (nextDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    triggerToast(nextDark ? 'Mod Gelap diaktifkan' : 'Mod Terang diaktifkan');
  };

  // Filtered transactions for Riwayat
  const filteredHistory = useMemo(() => {
    return transactions.filter(t => {
      // Type Filter
      if (histTypeFilter !== 'Semua') {
        if (histTypeFilter === 'Pemasukan' && t.type !== 'Pemasukan') return false;
        if (histTypeFilter === 'Pengeluaran' && t.type !== 'Pengeluaran') return false;
      }
      // Asset Wallet Filter
      if (histAssetFilter !== 'Semua' && t.assetName !== histAssetFilter) return false;
      // Date constraints
      const txDayOnly = t.date.substring(0, 10);
      if (histStartDate && txDayOnly < histStartDate) return false;
      if (histEndDate && txDayOnly > histEndDate) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, histTypeFilter, histAssetFilter, histStartDate, histEndDate]);

  // Filtered transactions for Report
  const filteredReportTx = useMemo(() => {
    return transactions.filter(t => {
      // Period Month/Year match
      let matchPeriod = false;
      if (repMonthFilter === 'Semua') {
        matchPeriod = t.date.substring(0, 4) === repYearFilter;
      } else {
        matchPeriod = t.date.substring(0, 7) === `${repYearFilter}-${repMonthFilter}`;
      }
      if (!matchPeriod) return false;

      // Wallet match
      if (repAssetFilter !== 'Semua' && t.assetName !== repAssetFilter) return false;

      // Skip internal transfers for pure expense reporting
      if (t.category === 'Transfer Masuk' || t.category === 'Transfer Keluar') return false;

      return true;
    });
  }, [transactions, repYearFilter, repMonthFilter, repAssetFilter]);

  // Report statistics calculations
  const reportStats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    const categoryExpenseMap: { [key: string]: number } = {};
    const pilarExpenseMap: { [key: string]: number } = {};
    const userExpenseMap: { [username: string]: number } = {};

    filteredReportTx.forEach(t => {
      if (t.type === 'Pemasukan') {
        totalIncome += t.amount;
        incomeCount++;
      } else if (t.type === 'Pengeluaran') {
        totalExpense += t.amount;
        expenseCount++;
        
        // Category expense aggregation
        categoryExpenseMap[t.category] = (categoryExpenseMap[t.category] || 0) + t.amount;

        // Pilar analysis
        const categoryDef = categories.find(c => c.name.toLowerCase() === t.category.toLowerCase() && c.type === 'Pengeluaran');
        const pilarName = categoryDef?.pilar || 'Lain-lain';
        pilarExpenseMap[pilarName] = (pilarExpenseMap[pilarName] || 0) + t.amount;

        // User logs
        const loggedUser = t.user || 'Sistem';
        userExpenseMap[loggedUser] = (userExpenseMap[loggedUser] || 0) + t.amount;
      }
    });

    return {
      totalIncome,
      totalExpense,
      incomeCount,
      expenseCount,
      categoryExpenseMap,
      pilarExpenseMap,
      userExpenseMap
    };
  }, [filteredReportTx, categories]);

  // Sorted Expense Categories for doughnut display & lists
  const sortedReportCategories = useMemo(() => {
    return Object.entries(reportStats.categoryExpenseMap as Record<string, number>)
      .map(([name, val]) => ({ name, value: val as number }))
      .sort((a, b) => b.value - a.value);
  }, [reportStats]);

  // Spending Advice AI generator engine based on current month stats
  const smartAdvice = useMemo(() => {
    if (sortedReportCategories.length === 0) {
      return {
        title: 'Pembantu Kewangan Pintar',
        text: 'Belum ada data pengeluaran direkodkan bagi tempoh ini. Catat perbelanjaan anda menggunakan butang tambah di bawah untuk mendapatkan analisis pintar!',
        isWarning: false
      };
    }

    const topCategory = sortedReportCategories[0];
    const percentage = reportStats.totalExpense > 0 ? Math.round((topCategory.value / reportStats.totalExpense) * 100) : 0;
    const keyCatName = topCategory.name.toLowerCase();

    let tip = 'Nilai pengeluaran anda dikesan stabil. Utamakan membina tabung kecemasan sekurang-kurangnya 3 hingga 6 bulan belanja bulanan.';
    if (keyCatName.includes('makan') || keyCatName.includes('minum') || keyCatName.includes('food')) {
      tip = 'Kurangkan makan di luar atau beralih kepada memesan barangan mentah dapur untuk dimasak sendiri. Ini dapat merendahkan belanja sebanyak 40%.';
    } else if (keyCatName.includes('petrol') || keyCatName.includes('transport') || keyCatName.includes('kereta')) {
      tip = 'Pertimbangkan berkongsi kenderaan atau mengoptimumkan perjalanan harian anda bagi mengurangkan penggunaan bahan api dan tol bas.';
    } else if (keyCatName.includes('beli') || keyCatName.includes('shopp') || keyCatName.includes('baju')) {
      tip = 'Lakukan prinsip "Tunggu 48 Jam" sebelum checkout barangan di tetingkap e-dagang Shopee/Lazada anda demi menyaring emosi meluap-luap.';
    } else if (keyCatName.includes('hiburan') || keyCatName.includes('wayang') || keyCatName.includes('netflix')) {
      tip = 'Beralih kepada pilihan rekreasi luar percuma dan tapis perkhidmatan langganan atas talian yang jarang digunakan.';
    } else if (keyCatName.includes('bil') || keyCatName.includes('sewa') || keyCatName.includes('utiliti')) {
      tip = 'Fokus menutup plug elektrik ketika tidak digunakan dan bandingkan tarif pakej internet/telefon untuk mendapat pelan penjimatan.';
    }

    return {
      title: 'Tumpuan Perbelanjaan Utama',
      text: `Belanja tertinggi adalah bagi kategori "${topCategory.name}" yang menyumbang sebanyak ${percentage}% (${formatMYR(topCategory.value)}) daripada jumlah pembayaran tempoh ini.`,
      tip,
      isWarning: percentage > 45
    };
  }, [sortedReportCategories, reportStats]);

  // Open Quick Add Modal
  const openAddTransaction = () => {
    if (isUserWriteLocked && currentUser?.role !== 'Admin') {
      triggerToast('Akses Dikunci! Pentadbir (Admin) sedang menyekat penambahan atau pengeditan data.');
      return;
    }
    const defaultAsset = assets[0]?.name || '';
    setTxAsset(defaultAsset);
    setTxType('Pengeluaran');
    setTxAmountStr('');
    setTxNote('');
    setTxReceiptBase64(null);

    // Initial default category
    const list = categories.filter(c => c.type === 'Pengeluaran');
    setTxCategory(list[0]?.name || 'Lain-lain');
    setIsAddTxOpen(true);
  };

  // Handle Type Change inside transaction form
  const handleTxTypeChange = (type: 'Pemasukan' | 'Pengeluaran' | 'Transfer') => {
    setTxType(type);
    if (type === 'Transfer') {
      const pocketList = assets.filter(a => a.category === 'Dompet');
      // Set Source (txAsset) & Destination (txCategory)
      setTxAsset(pocketList[0]?.name || '');
      setTxCategory(pocketList[1]?.name || pocketList[0]?.name || '');
    } else {
      const list = categories.filter(c => c.type === type);
      setTxAsset(assets[0]?.name || '');
      setTxCategory(list[0]?.name || 'Lain-lain');
    }
  };

  // Format inline input for money
  const handleAmountInMYR = (val: string, type: 'tx' | 'asset' | 'budget' = 'tx') => {
    // Keep digits only
    const digits = val.replace(/[^0-9]/g, '');
    if (!digits) {
      if (type === 'tx') setTxAmountStr('');
      else if (type === 'asset') setAssetInputVal('');
      else if (type === 'budget') setBudgetInputLimit('');
      return;
    }
    // format thousands separating with comma
    const rawVal = parseInt(digits, 10);
    const formatted = new Intl.NumberFormat('en-MY').format(rawVal);
    
    if (type === 'tx') setTxAmountStr(formatted);
    else if (type === 'asset') setAssetInputVal(formatted);
    else if (type === 'budget') setBudgetInputLimit(formatted);
  };

  // Save transaction submitted from modal
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const parsedAmount = parseFloat(txAmountStr.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Sila masukkan nilai RM yang sah.');
      return;
    }

    // Wallet checks for overdraft warning
    if (txType === 'Pengeluaran' || txType === 'Transfer') {
      const parentPocket = assets.find(a => a.name === txAsset);
      if (parentPocket && parentPocket.value < parsedAmount) {
        if (!window.confirm(`Perhatian: Baki dompet "${txAsset}" (${formatMYR(parentPocket.value)}) tidak mencukupi untuk bayaran RM ${txAmountStr}. Teruskan mencatat?`)) {
          return;
        }
      }
    }

    if (txType === 'Transfer' && txAsset === txCategory) {
      alert('Pemindahan tidak boleh dilakukan ke dompet yang sama!');
      return;
    }

    // New transaction instantiation
    const newTx: Transaction = {
      id: 'tx-' + Date.now(),
      date: txDate + 'T' + new Date().toTimeString().substring(0, 8),
      type: txType,
      assetName: txAsset,
      amount: parsedAmount,
      note: txNote,
      category: txCategory,
      user: currentUser.fullname,
      receiptUrl: txReceiptBase64 || undefined
    };

    // Balance Updates
    const updatedAssets = assets.map(a => {
      const fresh = { ...a };
      if (txType === 'Pemasukan') {
        if (fresh.name === txAsset) fresh.value += parsedAmount;
      } else if (txType === 'Pengeluaran') {
        if (fresh.name === txAsset) fresh.value -= parsedAmount;
      } else if (txType === 'Transfer') {
        if (fresh.name === txAsset) fresh.value -= parsedAmount; // Deduct from source
        if (fresh.name === txCategory) fresh.value += parsedAmount; // Add to destination
      }
      return fresh;
    });

    const updatedTransactions = [newTx, ...transactions];
    
    // Save state
    setAssets(updatedAssets);
    LocalDB.saveAssets(updatedAssets);

    setTransactions(updatedTransactions);
    LocalDB.saveTransactions(updatedTransactions);

    // Sync directly to Firestore for multi-device real-time sync
    updatedAssets.forEach(a => {
      dbSaveAsset(a);
    });
    dbSaveTransaction(newTx);

    setIsAddTxOpen(false);
    triggerToast('Transaksi berjaya direkodkan!');
  };

  // Delete transaction security confirm
  const handleDeleteTx = (id: string) => {
    if (isUserWriteLocked && currentUser?.role !== 'Admin') {
      triggerToast('Akses Dikunci! Pentadbir (Admin) sedang menyekat penambahan atau pengeditan data.');
      return;
    }
    const target = transactions.find(t => t.id === id);
    if (!target) return;

    if (window.confirm(`Adakah anda mahu memadam rekod "${target.category}" bernilai ${formatMYR(target.amount)}? Baki dompet akan diselaraskan semula.`)) {
      // Restore balances
      const updatedAssets = assets.map(a => {
        const fresh = { ...a };
        if (target.type === 'Pemasukan') {
          if (fresh.name === target.assetName) fresh.value -= target.amount;
        } else if (target.type === 'Pengeluaran') {
          if (fresh.name === target.assetName) fresh.value += target.amount;
        } else if (target.type === 'Transfer') {
          if (fresh.name === target.assetName) fresh.value += target.amount;
          if (fresh.name === target.category) fresh.value -= target.amount;
        }
        return fresh;
      });

      const updatedTransactions = transactions.filter(t => t.id !== id);

      setAssets(updatedAssets);
      LocalDB.saveAssets(updatedAssets);

      setTransactions(updatedTransactions);
      LocalDB.saveTransactions(updatedTransactions);

      // System state sync with Firestore
      updatedAssets.forEach(a => {
        dbSaveAsset(a);
      });
      dbDeleteTransaction(id);

      triggerToast('Rekod transaksi telah dipadam.');
    }
  };

  // Handle Receipt Upload Image conversion to Base64 (consistent with dynamic preview rules)
  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Fail melebihi had 2 MB!');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        setTxReceiptBase64(evt.target?.result as string);
        triggerToast('Gambar resit dimuat naik!');
      };
      reader.readAsDataURL(file);
    }
  };

  // Settings modals helpers
  const closeSettingsModal = () => {
    setSettingsModal(null);
    setUserInputFullname('');
    setUserInputUsername('');
    setUserInputEmail('');
    setUserInputPassword('');
    setCatInputName('');
    setCatInputPilar('');
    setPilarInputName('');
    setAssetInputName('');
    setAssetInputNoRek('');
    setAssetInputVal('');
    setBudgetInputCat('');
    setBudgetInputLimit('');
    setBudgetInputStart('');
    setBudgetInputEnd('');
    setBudgetInputIgnoreDate(false);
    setBudgetInputNote('');
  };

  // Save custom parameters (user, category, wallet, budgeting)
  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsModal) return;

    const mType = settingsModal.type;

       if (mType === 'add_user') {
      if (!userInputUsername || !userInputFullname) return;
      
      // PERBAIKAN: Mengambil mata uang sistem yang sedang aktif saat pendaftaran
      const currentSystemCurrency = localStorage.getItem('hitungduit_currency') || 'MYR';

      const newUser: User = {
        username: userInputUsername.toLowerCase().trim(),
        fullname: userInputFullname.trim(),
        role: userInputRole,
        email: userInputEmail.trim(),
        password: userInputPassword.trim() || undefined,
        currency: currentSystemCurrency // Mata uang user baru mengikuti mata uang sistem saat ini
      };
      const updated = [...users, newUser];
      setUsers(updated);
      LocalDB.saveUsers(updated);
      dbSaveUser(newUser);
      triggerToast('Pengguna baru berjaya didaftarkan.');
    } 
    
    else if (mType === 'edit_user') {
      const targetUser = settingsModal.data as User;
      const updated = users.map(u => {
        if (u.username === targetUser.username) {
          const edited = { 
            ...u, 
            fullname: userInputFullname, 
            role: userInputRole, 
            email: userInputEmail,
            password: userInputPassword.trim() ? userInputPassword.trim() : u.password
            // Tetap mempertahankan mata uang asli mereka saat diedit
          };
          dbSaveUser(edited);
          return edited;
        }
        return u;
      }); // Baris pelengkap penutup map

      setUsers(updated);
      LocalDB.saveUsers(updated);
      triggerToast('Akaun pengguna telah dikemaskini.');
    }

    else if (mType === 'add_category') {
      const type = settingsModal.data as 'Pemasukan' | 'Pengeluaran';
      if (!catInputName) return;
      const newCat: Category = {
        name: catInputName.trim(),
        type,
        pilar: catInputPilar || undefined
      };
      const updated = [...categories, newCat];
      setCategories(updated);
      LocalDB.saveCategories(updated);
      dbSaveCategory(newCat);
      triggerToast(`Kategori ${type} berjaya ditambah.`);
    }

    else if (mType === 'edit_category') {
      const oldCat = settingsModal.data as Category;
      if (!catInputName) return;
      const updated = categories.map(c => {
        if (c.name === oldCat.name && c.type === oldCat.type) {
          const edited = { ...c, name: catInputName, pilar: catInputPilar || undefined };
          dbSaveCategory(edited);
          return edited;
        }
        return c;
      });
      setCategories(updated);
      LocalDB.saveCategories(updated);
      // Delete old document key from Firebase if it was renamed
      if (oldCat.name !== catInputName) {
        dbDeleteCategory(oldCat.name, oldCat.type);
      }
      triggerToast('Kategori dikemaskini.');
    }

    else if (mType === 'add_pilar') {
      const type = settingsModal.data as 'Pemasukan' | 'Pengeluaran';
      if (!pilarInputName) return;
      const newPilar: Pilar = {
        name: pilarInputName.trim(),
        type
      };
      const updated = [...pilars, newPilar];
      setPilars(updated);
      LocalDB.savePilars(updated);
      dbSavePilar(newPilar);
      triggerToast('Pilar berjaya didaftarkan.');
    }
        else if (mType === 'add_asset') {
      if (!assetInputName) return;
      const rawBal = parseFloat(assetInputVal.replace(/,/g, '')) || 0;
      
      // MEMBACA TARGET USERNAME YANG DIKETIK ADMIN DI KOLOM REKENING (Budi / Dina / Admin)
      const inputOwner = assetInputNoRek.trim().toLowerCase();
      
      // Jika kolom rekening kosong, otomatis jadi milik Admin. Jika diisi, ikuti nama user tersebut.
      const targetOwnerInput = inputOwner ? inputOwner : 'admin';

      const newAsset: Asset & { owner?: string } = {
        name: assetInputName.trim(),
        no_rek: assetInputNoRek.trim() || '-',
        value: rawBal,
        category: 'Dompet',
        owner: targetOwnerInput // Label khusus agar Firebase tahu dompet ini milik siapa
      };

      const updated = [...assets, newAsset];
      setAssets(updated);
      LocalDB.saveAssets(updated);
      dbSaveAsset(newAsset);
      triggerToast('Pek/Dompet baru berjaya didaftarkan.');
    }

    else if (mType === 'edit_asset') {
      const oldAsset = settingsModal.data as Asset;
      if (!assetInputName) return;
      const rawBal = parseFloat(assetInputVal.replace(/,/g, '')) || 0;
      const updated = assets.map(a => {
        if (a.name === oldAsset.name) {
          const edited = { ...a, name: assetInputName, no_rek: assetInputNoRek || '-', value: rawBal };
          dbSaveAsset(edited);
          return edited;
        }
        return a;
      });
      setAssets(updated);
      LocalDB.saveAssets(updated);
      // Delete older asset name document from Firebase if name changed
      if (oldAsset.name !== assetInputName) {
        dbDeleteAsset(oldAsset.name);
      }
      triggerToast('Maklumat bank/dompet dikemaskini.');
    }

    else if (mType === 'add_budget' || mType === 'edit_budget') {
      const type = settingsModal.data.type as 'Pemasukan' | 'Pengeluaran';
      const monthlyKey = new Date().toISOString().substring(0, 7);
      const limitVal = parseFloat(budgetInputLimit.replace(/,/g, '')) || 0;
      if (!budgetInputCat || limitVal <= 0) {
        alert('Sila isikan sasaran kateogri dan nilai bajet!');
        return;
      }

      let dRange = '';
      if (budgetInputStart && budgetInputEnd) {
        dRange = `${budgetInputStart}_${budgetInputEnd}`;
      }

      let noteText = budgetInputNote;
      if (budgetInputIgnoreDate) {
        noteText = '[ALL] ' + noteText;
      }

      let updated: Budget[];
      if (mType === 'add_budget') {
        const newBudget: Budget = {
          month: monthlyKey,
          type,
          category: budgetInputCat,
          limit: limitVal,
          dateRange: dRange,
          note: noteText
        };
        updated = [...budgets, newBudget];
        dbSaveBudget(newBudget);
      } else {
        const oldB = settingsModal.data.budget as Budget;
        updated = budgets.map(b => {
          if (b.month === oldB.month && b.category === oldB.category && b.type === oldB.type) {
            const edited = {
              ...b,
              category: budgetInputCat,
              limit: limitVal,
              dateRange: dRange,
              note: noteText
            };
            dbSaveBudget(edited);
            return edited;
          }
          return b;
        });
        // Delete older budget document ID from Firebase if category name changed
        if (oldB.category !== budgetInputCat) {
          dbDeleteBudget(oldB);
        }
      }

      setBudgets(updated);
      LocalDB.saveBudgets(updated);
      triggerToast('Target belanjawan bulanan dikemaskini.');
    }

    closeSettingsModal();
  };

  // Delete handlers inside settings
  const handleDeleteUser = (username: string) => {
    if (username === 'admin') {
      alert('Tidak boleh memadam akaun pemilik utama (Super Admin).');
      return;
    }
    if (currentUser?.username === username) {
      alert('Anda tidak boleh memadam akaun anda yang sedang log masuk!');
      return;
    }
    if (window.confirm(`Singkirkan akaun pengguna "@${username}"?`)) {
      const updated = users.filter(u => u.username !== username);
      setUsers(updated);
      LocalDB.saveUsers(updated);
      dbDeleteUser(username);
      triggerToast('Pengguna ditolak akses.');
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    if (window.confirm(`Padam kategori "${cat.name}" (${cat.type})?`)) {
      const updated = categories.filter(c => !(c.name === cat.name && c.type === cat.type));
      setCategories(updated);
      LocalDB.saveCategories(updated);
      dbDeleteCategory(cat.name, cat.type);
      triggerToast('Kategori disingkirkan.');
    }
  };

  const handleDeletePilar = (p: Pilar) => {
    if (window.confirm(`Padam pilar "${p.name}"? Rutin kategori di bawahnya akan diletakkan di bawah seksyen biasa.`)) {
      const updatedPilars = pilars.filter(item => !(item.name === p.name && item.type === p.type));
      setPilars(updatedPilars);
      LocalDB.savePilars(updatedPilars);
      dbDeletePilar(p.name);
      
      const updatedCategories = categories.map(c => {
        if (c.pilar === p.name && c.type === p.type) {
          const mod = { ...c, pilar: undefined };
          dbSaveCategory(mod);
          return mod;
        }
        return c;
      });
      setCategories(updatedCategories);
      LocalDB.saveCategories(updatedCategories);

      triggerToast('Pilar ditolak dari senarai.');
    }
  };

  const handleDeleteAsset = (name: string) => {
    if (window.confirm(`Adakah anda mahu memadam akaun "${name}"? Semua data mutasi sejarah tidak akan diganggu.`)) {
      const updated = assets.filter(a => a.name !== name);
      setAssets(updated);
      LocalDB.saveAssets(updated);
      dbDeleteAsset(name);
      triggerToast('Akaun bank dikeluarkan.');
    }
  };

   const handleDeleteBudget = async (b: Budget) => {
    if (window.confirm(`Padam sasaran limit "${b.category}"?`)) {
      try {
        // 1. Hapus dari state layar dan LocalDB seperti biasa
        const updated = budgets.filter(item => !(item.month === b.month && item.category === b.category && item.type === b.type));
        setBudgets(updated);
        LocalDB.saveBudgets(updated);
        
        // 2. PERBAIKAN: Kirim perintah hapus ke Firebase dan pastikan ditunggu (async/await)
        if (b && typeof dbDeleteBudget === 'function') {
          await dbDeleteBudget(b);
        }
        
        triggerToast('Sasaran limit dibatalkan.');
      } catch (error) {
        console.error("Gagal memadamkan anggaran dari server:", error);
        triggerToast('Gagal memadamkan dari server, coba lagi.');
      }
    }
  };


  // Export CSV Handler
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert('Tiada data perbelanjaan untuk dieksport!');
      return;
    }
    let csvContent = 'data:text/csv;charset=utf-8,ID,Tarikh,Tipe,Kategori/Penerima,Nilai (RM),Dompet,Catatan,Oleh\n';
    transactions.forEach(t => {
      csvContent += `${t.id},${t.date.replace('T', ' ')},${t.type},"${t.category}",${t.amount},"${t.assetName}","${t.note || ''}","${t.user}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HitungDuit_RM_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Laporan CSV berjaya dimuat turun');
  };

  // Printable layout trigger
  const handlePrintDraft = () => {
    window.print();
  };

  // Calculate Wallet category-by-category values based on Transactions for Progress metrics
  const getAppliedBudgetValue = (b: Budget) => {
    let total = 0;
    const currentYearMonth = new Date().toISOString().substring(0, 7);
    
    let ignoreDate = false;
    let cleanNote = b.note || '';
    if (cleanNote.startsWith('[ALL]')) {
      ignoreDate = true;
    }

    let hasDateRange = b.dateRange && b.dateRange.includes('_');
    let sd = '', ed = '';
    if (hasDateRange) {
      const parts = b.dateRange.split('_');
      sd = parts[0];
      ed = parts[1];
    }

    transactions.forEach(t => {
      // Check type matching
      const isPemasukan = t.type === 'Pemasukan';
      const isPengeluaran = t.type === 'Pengeluaran';
      
      let isMatch = false;
      if (b.type === 'Pemasukan' && isPemasukan) {
        if (b.category.includes('|')) {
          const parts = b.category.split('|');
          const targetAsset = parts[0]?.trim();
          const targetCat = parts[1]?.trim();
          
          const matchAsset = !targetAsset || targetAsset === 'Semua Rekening' || t.assetName.toLowerCase() === targetAsset.toLowerCase();
          const matchCat = !targetCat || targetCat === 'Semua Kategori' || t.category.toLowerCase() === targetCat.toLowerCase();
          isMatch = matchAsset && matchCat;
        } else {
          isMatch = t.assetName.toLowerCase() === b.category.toLowerCase();
        }
      } else if (b.type === 'Pengeluaran' && isPengeluaran && t.category.toLowerCase() === b.category.toLowerCase()) {
        isMatch = true;
      }

      if (isMatch) {
         const tDateOnly = t.date.substring(0, 10);
         if (ignoreDate) {
           total += t.amount;
         } else if (hasDateRange) {
           if (tDateOnly >= sd && tDateOnly <= ed) total += t.amount;
         } else {
           if (t.date.substring(0, 7) === currentYearMonth) total += t.amount;
         }
      }
    });

    return total;
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        {/* Frame Outer Screen (Dynamic Preview Simulator Device) */}
        <div className="w-full max-w-[450px] bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700 relative text-slate-100 font-sans">
          {/* Status bar mock */}
          <div className="bg-slate-950 px-6 py-3 flex justify-between items-center text-xs opacity-70">
            <span>9:41 AM</span>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Online • MYR</span>
            </div>
          </div>

          <div className="p-8 md:p-10 flex flex-col justify-center min-h-[500px]">
            {/* Header branding */}
            {/* Header branding */}
            <div className="text-center mb-8">
              <div className="w-32 h-32 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20 overflow-hidden relative border-2 border-blue-500">
                {/* LOGO MEMBESAR PENUH PAS DI DALAM KOTAK BIRU */}
                <img 
                  src="/favicon.png" 
                  alt="Logo Wang Ajaib Halal"
                  className="absolute inset-0 w-full h-full object-cover scale-[1.4] origin-center"
                />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">WANG AJAIB</h2>
              <p className="text-slate-400 text-sm mt-1">wang ajaib halal pertolongan yang memerlukan (RM)</p>
            </div>

            {/* Form Login */}
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 tracking-wider uppercase">Nama Pengguna</label>
                <input 
                  type="text" 
                  value={loginUsername} 
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="Masukkan nama pengguna"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 tracking-wider uppercase">Kata Laluan</label>
                <input 
                  type="password" 
                  value={loginPassword} 
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="Masukkan kata laluan"
                  required
                />
              </div>

              <button 
                type="submit" 
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 active:scale-[0.98] transition-all text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/10"
              >
                Log Masuk Sistem
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-0 md:py-8 flex items-center justify-center">
      {/* Simulation Device Frame Container for Elegant Presentation */}
      <div className="w-full max-w-[500px] bg-slate-50 dark:bg-slate-900 min-h-screen md:min-h-[850px] md:max-h-[900px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative border border-slate-200 dark:border-slate-800 transition-colors">
        
        {/* Micro-Notification Toast */}
        {toastMessage && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-2 rounded-full text-xs font-bold shadow-xl z-50 flex items-center gap-2 border border-slate-800 dark:border-slate-200 animate-bounce">
            <Check className="w-4 h-4 text-emerald-500" />
            {toastMessage}
          </div>
        )}

        {/* Global Loading Spinner for sync simulation */}
        {isSyncing && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white">
            <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <h3 className="font-bold tracking-wider">MENYELARAS DATA...</h3>
            <p className="text-slate-400 text-xs mt-1">Mengemas baki Ringgit Malaysia (RM)</p>
          </div>
        )}

        {/* TOP STATUS BAR & HEADER */}
        <header className="bg-white/90 dark:bg-slate-950/90 border-b border-blue-50 dark:border-slate-800 p-5 sticky top-0 z-40 backdrop-blur-md flex flex-col">
          {/* Clock & Core Sync Info */}
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {currentUser.role === 'Admin' ? 'MODE KONTROL Admin' : 'Standard User'}
            </div>
            <span>RM Wallet Tracker</span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-extrabold text-blue-900 dark:text-sky-400 tracking-tight">
                {activePage === 'home' && 'Utama'}
                {activePage === 'assets' && 'Walet & Bajet'}
                {activePage === 'report' && 'Analisis Pintar'}
                {activePage === 'history' && 'Mutasi Sesi'}
                {activePage === 'settings' && 'Konfigurasi'}
              </h2>
              <div className="flex flex-col mt-0.5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                  SELAMAT DATANG, {currentUser.fullname}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">
                  {liveClock}
                </span>
              </div>
            </div>

            {/* Header Right Action icons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleDarkMode}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center active:scale-95 transition-all"
                title="Tukar Tema"
              >
                {isDarkMode ? <span className="text-sm">☀️</span> : <span className="text-sm">🌙</span>}
              </button>

              <button 
                onClick={() => setActivePage('settings')}
                className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all ${
                  activePage === 'settings' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
              </button>

              <button 
                onClick={handleLogout}
                className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center active:scale-95 transition-all"
                title="Keluar"
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* SCROLLABLE INTERMEDIATE AREA */}
        <main className="flex-1 overflow-y-auto px-5 pt-4 pb-28 scrollbar-none">
          
          {/* =================================_________ ================================= */}
          {/* SCREEN: HOME */}
          {activePage === 'home' && (
            <div className="space-y-5 animate-fadeIn">
              {/* OFFLINE STATUS BORDER / BANNER */}
              {cloudStatus === 'offline' && (
                <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-4 py-3 rounded-2xl flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">⚠️</span>
                    <div className="text-left">
                      <h5 className="font-extrabold text-[11px] uppercase tracking-wider">Mod Luar Talian (Offline)</h5>
                      <p className="text-[10px] mt-0.5 opacity-95 leading-tight">
                        Sambungan ke pangkalan data awan terputus. Saldo dipaparkan dari baki tempatan peranti ini sahaja.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={triggerRealCloudSync}
                    disabled={isSyncing}
                    className="px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                  >
                    Paut Semula
                  </button>
                </div>
              )}

              {/* WRITE LATCH WARNING FOR USERS */}
              {isUserWriteLocked && currentUser?.role !== 'Admin' && (
                <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-4 py-3 rounded-2xl flex items-center gap-2.5">
                  <span className="text-base leading-none">🔒</span>
                  <div className="text-left">
                     <h5 className="font-extrabold text-[11px] uppercase tracking-wider">Sesi Dikunci (Read-Only Active)</h5>
                     <p className="text-[10px] mt-0.5 opacity-90 leading-tight">
                       Kemasukan data baharu disekat buat masa ini. Hubungi Admin jika perlu membuat pelarasan baki.
                     </p>
                  </div>
                </div>
              )}

              {/* MAIN WEALTH CARD (Cobalt blue stylized) */}
              <div className="bg-gradient-to-br from-blue-900 via-blue-700 to-indigo-800 rounded-3xl p-6 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden">
                <div className="flex justify-between items-center opacity-90">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-100">Kekayaan Bersih</span>
                  <button 
                    onClick={triggerRealCloudSync}
                    disabled={isSyncing}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider transition-all ${
                      cloudStatus === 'synced' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : cloudStatus === 'connecting'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                        : 'bg-rose-500/25 text-rose-250 border border-rose-500/40'
                    }`}
                    title="Klik untuk menyegerakan pangkalan data awan secara manual"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing 
                      ? 'Menyegerakan...' 
                      : cloudStatus === 'synced' 
                      ? 'Awan Tersinkron' 
                      : cloudStatus === 'connecting'
                      ? 'Menghubung...' 
                      : 'Luar Talian (Segarkan)'}
                  </button>
                </div>

                <div className="flex items-center gap-3.5 mt-2.5">
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    {isBalanceHidden ? 'RM ••••••••' : formatMYR(netWealth)}
                  </h1>
                  <button 
                    onClick={toggleBalancePrivacy}
                    className="p-1 px-2 rounded-full bg-white/10 hover:bg-white/20"
                  >
                    {isBalanceHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                {/* Sub totals grids */}
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="bg-white/10 rounded-2xl p-3 border border-white/5">
                    <span className="text-[9px] block text-sky-100 font-bold uppercase tracking-wider mb-0.5">MASUK (BULAN INI)</span>
                    <b className="text-sm font-extrabold text-emerald-300">
                      {isBalanceHidden ? 'RM ••••' : formatMYR(totalsThisMonth.income)}
                    </b>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-3 border border-white/5">
                    <span className="text-[9px] block text-sky-100 font-bold uppercase tracking-wider mb-0.5">KELUAR (BULAN INI)</span>
                    <b className="text-sm font-extrabold text-rose-300">
                      {isBalanceHidden ? 'RM ••••' : formatMYR(totalsThisMonth.expense)}
                    </b>
                  </div>
                </div>
              </div>

              {/* QUICK WALLET BALANCES COLUMN */}
              <div>
                <div className="flex items-center gap-2 mb-3.5 px-1">
                  <Wallet className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest">Akaun Kewangan</h3>
                </div>

                {/* Horizontal grid list for quick view wallets */}
                <div className="grid grid-cols-2 gap-3">
                  {assets
                    .filter(a => a.category === 'Dompet')
                    .map((w, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setActivePage('assets')}
                        className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-slate-900 flex items-center justify-center mb-4">
                          <CreditCard className="w-4.5 h-4.5 text-blue-600 dark:text-sky-400" />
                        </div>
                        <div>
                          <span className="text-[9px] font-extrabold text-slate-400 block tracking-widest uppercase">{w.name}</span>
                          <b className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight mt-0.5 block">
                            {isBalanceHidden ? 'RM •••' : formatMYR(w.value)}
                          </b>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* BAR CHART GRAPH: 7-Days Trend (Calculated in custom interactive SVG) */}
              <div className="bg-white dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Tren Aliran Tunai (7 Hari Lalu)</span>
                  <span className="text-[9px] text-slate-400 font-bold tracking-wider">BAR CHART</span>
                </div>

                {/* Custom Interactive pure-SVG mini bar charts to display incomes vs expenses */}
                <div className="h-44 flex items-end justify-between pt-4 gap-2">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - i));
                    const dateStr = d.toISOString().substring(0, 10);
                    const dayLabel = d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' });

                    // Sum transactions for day
                    const dayIncoming = transactions
                      .filter(t => t.date.substring(0, 10) === dateStr && t.type === 'Pemasukan')
                      .reduce((sum, t) => sum + t.amount, 0);

                    const dayOutgoing = transactions
                      .filter(t => t.date.substring(0, 10) === dateStr && t.type === 'Pengeluaran')
                      .reduce((sum, t) => sum + t.amount, 0);

                    // Normalize height metrics
                    const maxScale = Math.max(...transactions.map(t => t.amount), 50);
                    const incomingHeight = Math.min((dayIncoming / maxScale) * 100, 100);
                    const outgoingHeight = Math.min((dayOutgoing / maxScale) * 100, 100);

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                        <div className="w-full flex justify-center items-end h-[120px] gap-1">
                          {/* Income column (Green) */}
                          <div 
                            style={{ height: `${Math.max(incomingHeight, 2)}%` }}
                            className="w-2 bg-emerald-500 rounded-t-sm transition-all duration-500 group-hover:brightness-105"
                            title={`Masuk: ${formatMYR(dayIncoming)}`}
                          ></div>
                          {/* Expense column (Rose) */}
                          <div 
                            style={{ height: `${Math.max(outgoingHeight, 2)}%` }}
                            className="w-2 bg-rose-500 rounded-t-sm transition-all duration-500 group-hover:brightness-105"
                            title={`Keluar: ${formatMYR(dayOutgoing)}`}
                          ></div>
                        </div>
                        <span className="text-[8px] font-extrabold text-slate-400 mt-2 block tracking-tight text-center whitespace-nowrap">
                          {dayLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RECENT TRANSACTIONS FEED (Shows last 5) */}
              <div>
                <div className="flex justify-between items-center mb-3.5 px-1">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest">Aktiviti Semasa</h3>
                  </div>
                  <button 
                    onClick={() => setActivePage('history')}
                    className="text-xs text-blue-600 dark:text-sky-400 font-extrabold uppercase hover:underline"
                  >
                    Semua
                  </button>
                </div>

                <div className="space-y-3">
                  {transactions.slice(0, 5).map((t, idx) => {
                    const isIncome = t.type === 'Pemasukan';
                    return (
                      <div 
                        key={idx}
                        onClick={() => setActivePage('history')}
                        className={`bg-white dark:bg-slate-950 p-4 rounded-2xl border ${
                          isIncome ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500'
                        } border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between cursor-pointer`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                            isIncome ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                          }`}>
                            {isIncome ? <ArrowDownLeft className="w-4.5 h-4.5" /> : <ArrowUpRight className="w-4.5 h-4.5" />}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{t.category}</h4>
                            <p className="text-slate-400 text-xs mt-1 leading-tight line-clamp-1">{t.note || 'Pencatatan'}</p>
                            <span className="text-[10px] text-slate-400 font-medium block mt-1">{formatCustomDate(t.date)} • {t.user || 'Sistem'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 font-bold block">{t.assetName}</span>
                          <span className={`font-extrabold text-sm ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isIncome ? '+' : '-'}{formatMYR(t.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =================================_________ ================================= */}
          {/* SCREEN: WALLETS/ASSETS & BUDGETS */}
          {activePage === 'assets' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* TARGET/BUDGETS SECTION */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest">Sasaran & Had Belanja</h3>
                  </div>
                  {currentUser?.role === 'Admin' && (
                    <button 
                      onClick={() => setSettingsModal({ type: 'add_budget', data: { type: 'Pengeluaran' } })}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full transition-all"
                    >
                      + Tetap Sasaran
                    </button>
                  )}
                </div>

                {budgets.length === 0 ? (
                  <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl text-center border border-slate-100 dark:border-slate-800 text-slate-400 text-xs">
                    Tiada had belanjawan ditetapkan untuk bulan ini.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {budgets.map((b, idx) => {
                      const totalCatur = getAppliedBudgetValue(b);
                      const percent = b.limit > 0 ? Math.min(Math.round((totalCatur / b.limit) * 100), 100) : 0;
                      const isLimitOver = totalCatur > b.limit;
                      
                      return (
                        <div key={idx} className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative group overflow-hidden">
                          {/* Edit / Delete small top buttons */}
                          {currentUser?.role === 'Admin' && (
                            <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setBudgetInputCat(b.category);
                                  setBudgetInputLimit(String(b.limit));
                                  if (b.dateRange.includes('_')) {
                                    const parts = b.dateRange.split('_');
                                    setBudgetInputStart(parts[0]);
                                    setBudgetInputEnd(parts[1]);
                                  }
                                  setBudgetInputIgnoreDate(b.note.startsWith('[ALL]'));
                                  setBudgetInputNote(b.note.startsWith('[ALL]') ? b.note.replace('[ALL]', '').trim() : b.note);
                                  setSettingsModal({ type: 'edit_budget', data: { type: b.type, budget: b } });
                                }}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => handleDeleteBudget(b)}
                                className="w-6 h-6 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <div className="pr-12">
                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block mb-2 ${
                              b.type === 'Pemasukan' 
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' 
                                : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'
                            }`}>
                              {b.type === 'Pemasukan' ? 'Sasaran Impian' : 'Kekang Perbelanjaan'}
                            </span>

                            <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm leading-tight">
                              {b.category.includes('|') ? b.category.split('|')[1] : b.category}
                            </h4>
                            
                            {b.note && (
                              <p className="text-slate-400 text-xs mt-1 leading-tight">{b.note.replace('[ALL]', '').trim()}</p>
                            )}
                          </div>

                          {/* Progress Metrics */}
                          <div className="mt-4 space-y-1.5">
                            <div className="flex justify-between items-baseline text-xs">
                              <span className="text-slate-400">Tercatat: <b className="text-slate-700 dark:text-slate-200">{formatMYR(totalCatur)}</b></span>
                              <span className="text-slate-400">Siling/Limit: <b className="text-slate-800 dark:text-slate-100">{formatMYR(b.limit)}</b></span>
                            </div>

                            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                              <div 
                                style={{ width: `${percent}%` }}
                                className={`h-full rounded-full transition-all duration-500 ${
                                  b.type === 'Pemasukan' 
                                    ? 'bg-emerald-500' 
                                    : isLimitOver ? 'bg-rose-500 animate-pulse' : percent > 85 ? 'bg-amber-500' : 'bg-blue-600'
                                }`}
                              ></div>
                            </div>

                            <div className="flex justify-between items-center text-[10px]">
                              <span className={`font-bold uppercase ${
                                b.type === 'Pemasukan' 
                                  ? (percent >= 100 ? 'text-emerald-500' : 'text-slate-400')
                                  : (isLimitOver ? 'text-rose-500' : 'text-slate-400')
                              }`}>
                                {b.type === 'Pemasukan' 
                                  ? (percent >= 100 ? 'Sasaran Kejayaan!' : 'Berusaha mencatatkan baki')
                                  : (isLimitOver ? 'AMARAN: Melebihi Bajet!' : 'Belanja Terkawal')
                                }
                              </span>
                              <span className="font-extrabold text-slate-700 dark:text-slate-300">{percent}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ACCOUNT POCKETS LISTING */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest">Semua Pek / Dompet</h3>
                  </div>
                  {currentUser?.role === 'Admin' && (
                    <button 
                      onClick={() => setSettingsModal({ type: 'add_asset' })}
                      className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/15 border border-blue-600/20 text-blue-600 dark:text-sky-400 text-xs font-bold rounded-full transition-all"
                    >
                      + Bina Pek
                    </button>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {assets.map((a, idx) => (
                    <div key={idx} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0 group">
                      <div>
                        <div className="flex items-center gap-2">
                          <b className="text-sm font-extrabold text-slate-800 dark:text-slate-150">{a.name}</b>
                          <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full font-bold uppercase">{a.category}</span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono tracking-wide mt-1 block">
                          No. Rek: {a.no_rek}
                        </span>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <b className="text-sm text-blue-600 dark:text-sky-400 font-extrabold">
                          {isBalanceHidden ? 'RM •••••' : formatMYR(a.value)}
                        </b>
                        {currentUser?.role === 'Admin' && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setAssetInputName(a.name);
                                setAssetInputNoRek(a.no_rek);
                                setAssetInputVal(String(a.value));
                                setSettingsModal({ type: 'edit_asset', data: a });
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteAsset(a.name)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* =================================_________ ================================= */}
          {/* SCREEN: ANALYTICS REPORT */}
          {activePage === 'report' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* FILTERS PANEL */}
              <div className="bg-white dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Tempoh & Dompet Laporan</span>
                  <button 
                    onClick={() => {
                      setRepMonthFilter(String(new Date().getMonth() + 1).padStart(2, '0'));
                      setRepAssetFilter('Semua');
                    }}
                    className="text-[9px] font-bold text-rose-500 uppercase tracking-widest hover:underline"
                  >
                    Set Semula
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Pilih Bulan</label>
                    <select 
                      value={repMonthFilter}
                      onChange={(e) => setRepMonthFilter(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200"
                    >
                      <option value="Semua">Semua Bulan</option>
                      <option value="01">Januari</option>
                      <option value="02">Februari</option>
                      <option value="03">Maret</option>
                      <option value="04">April</option>
                      <option value="05">Mei</option>
                      <option value="06">Jun</option>
                      <option value="07">Julai</option>
                      <option value="08">Ogos</option>
                      <option value="09">September</option>
                      <option value="10">Oktober</option>
                      <option value="11">November</option>
                      <option value="12">Desember</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Dompet Tabung</label>
                    <select 
                      value={repAssetFilter}
                      onChange={(e) => setRepAssetFilter(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200"
                    >
                      <option value="Semua">Semua Dompet</option>
                      {assets.filter(a => a.category === 'Dompet').map((w, idx) => (
                        <option key={idx} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* FLOW CARD */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/15 rounded-2xl p-4">
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-widest">MASUK ALiran</span>
                  <h3 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatMYR(reportStats.totalIncome)}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium block mt-1">{reportStats.incomeCount} kali rekod</span>
                </div>

                <div className="bg-rose-500/10 border border-rose-500/15 rounded-2xl p-4">
                  <span className="text-[9px] text-rose-600 dark:text-rose-400 font-extrabold uppercase tracking-widest">BELANJA KELUAR</span>
                  <h3 className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                    {formatMYR(reportStats.totalExpense)}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium block mt-1">{reportStats.expenseCount} kali rekod</span>
                </div>
              </div>

              {/* SMART ADVEC / AI NARRATIVE CHAT */}
              <div className="bg-gradient-to-br from-blue-50 to-sky-100 dark:from-slate-950 dark:to-slate-900 rounded-2xl p-5 border border-blue-100 dark:border-slate-800 shadow-sm relative">
                <div className="flex items-center gap-2 mb-2 text-blue-900 dark:text-sky-450">
                  <Cpu className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                  <h4 className="font-extrabold text-xs uppercase tracking-wider">{smartAdvice.title}</h4>
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                  {smartAdvice.text}
                </p>
                {smartAdvice.tip && (
                  <div className="mt-3.5 pt-3.5 border-t border-blue-200/50 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-blue-800 dark:text-sky-400 uppercase tracking-widest block mb-0.5">Saranan Pakar:</span>
                    <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed italic">
                      "{smartAdvice.tip}"
                    </p>
                  </div>
                )}
              </div>

              {/* PIE CHART / PILLAR OF EXPENDITURE GRID LIST */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Layers className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest">Pilar Analisis Belanja</h3>
                </div>

                <div className="bg-white dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                  {/* Category Donut Visual Simulation of pillars */}
                  <div className="flex justify-center py-4">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* Interactive dynamic segments mapped natively representation */}
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e2e8f0" strokeWidth="8" />
                        {(() => {
                          let accumulatedPercentage = 0;
                          const pillarEntries = Object.entries(reportStats.pilarExpenseMap as Record<string, number>).filter(([_, val]) => (val as number) > 0);
                          return pillarEntries.map(([name, val], i) => {
                            const valNum = val as number;
                            const pct = reportStats.totalExpense > 0 ? (valNum / reportStats.totalExpense) * 100 : 0;
                            const dashArray = `${pct} ${100 - pct}`;
                            const dashOffset = 100 - accumulatedPercentage;
                            accumulatedPercentage += pct;

                            const colors = ['#2563eb', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#64748b'];
                            const selectedColor = colors[i % colors.length];

                            return (
                              <circle 
                                key={i}
                                cx="50" 
                                cy="50" 
                                r="40" 
                                fill="transparent" 
                                stroke={selectedColor} 
                                strokeWidth="10" 
                                strokeDasharray={`${pct * 2.51} 251`} // radius 40 * 2 * pi = 251 approx
                                strokeDashoffset={(dashOffset / 100) * 251}
                                className="transition-all duration-700"
                              />
                            );
                          });
                        })()}
                      </svg>
                      <div className="text-center z-10">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">JUMLAH BELANJA</span>
                        <b className="text-base font-black text-slate-800 dark:text-slate-100 block tracking-tight">
                          {formatMYR(reportStats.totalExpense)}
                        </b>
                      </div>
                    </div>
                  </div>

                  {/* Pillars detail items */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {Object.entries(reportStats.pilarExpenseMap as Record<string, number>).filter(([_, val]) => (val as number) > 0).map(([name, val], i) => {
                      const valNum = val as number;
                      const pct = reportStats.totalExpense > 0 ? Math.round((valNum / reportStats.totalExpense) * 100) : 0;
                      const colors = ['bg-blue-600', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-teal-500', 'bg-slate-500'];
                      const selectedColor = colors[i % colors.length];
                      return (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${selectedColor}`}></span>
                            <span className="text-slate-600 dark:text-slate-400 font-medium">{name}</span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {formatMYR(valNum)} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* REPORT BY CATEGORY TABLE */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest">Pecahan Mengikut Kategori</h3>
                </div>

                <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedReportCategories.map((item, idx) => {
                    const percentage = reportStats.totalExpense > 0 ? Math.round((item.value / reportStats.totalExpense) * 100) : 0;
                    return (
                      <div key={idx} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                        <div>
                          <b className="text-slate-800 dark:text-slate-250 text-sm font-extrabold">{item.name}</b>
                          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{percentage}% dari had belanja bulanan</span>
                        </div>
                        <b className="text-slate-800 dark:text-slate-100 text-sm font-extrabold">{formatMYR(item.value)}</b>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* EXPORTS BUTTONS BOX */}
              <div className="bg-white dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Sediakan Laporan Bertulis Resmi</span>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleExportCSV}
                    className="flex items-center justify-center gap-1.5 py-3 border-2 border-blue-500/20 text-blue-600 dark:text-sky-400 text-xs font-black uppercase rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV Laporan
                  </button>
                  <button 
                    onClick={handlePrintDraft}
                    className="flex items-center justify-center gap-1.5 py-3 bg-blue-600 text-white text-xs font-black uppercase rounded-xl hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-blue-600/10"
                  >
                    <FileText className="w-3.5 h-3.5" /> Cetak Draft
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* =================================_________ ================================= */}
          {/* SCREEN: MUTASI HISTORY LIST */}
          {activePage === 'history' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* ADVANCED HISTORY FILTER DRAWER */}
              <div className="bg-white dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Tapis Rekod Mutasi Sesi</span>
                  <button 
                    onClick={() => {
                      setHistTypeFilter('Semua');
                      setHistAssetFilter('Semua');
                      setHistStartDate('');
                      setHistEndDate('');
                      triggerToast('Tapisan dibersihkan.');
                    }}
                    className="text-[9px] font-extrabold text-rose-500 uppercase tracking-widest hover:underline"
                  >
                    Set Semula
                  </button>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 justify-between text-xs font-bold divide-x divide-slate-200 dark:divide-slate-800 text-slate-500">
                  <button 
                    onClick={() => setHistTypeFilter('Semua')}
                    className={`flex-1 text-center py-2 rounded-lg ${histTypeFilter === 'Semua' ? 'bg-white dark:bg-slate-850 text-blue-600 shadow-sm' : ''}`}
                  >
                    Semua
                  </button>
                  <button 
                    onClick={() => setHistTypeFilter('Pemasukan')}
                    className={`flex-1 text-center py-2 rounded-lg ${histTypeFilter === 'Pemasukan' ? 'bg-white dark:bg-slate-850 text-emerald-600 shadow-sm' : ''}`}
                  >
                    Inflow
                  </button>
                  <button 
                    onClick={() => setHistTypeFilter('Pengeluaran')}
                    className={`flex-1 text-center py-2 rounded-lg ${histTypeFilter === 'Pengeluaran' ? 'bg-white dark:bg-slate-850 text-rose-600 shadow-sm' : ''}`}
                  >
                    Outflow
                  </button>
                </div>

                {/* Specific ranges inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Tarikh Mula</label>
                    <input 
                      type="date"
                      value={histStartDate}
                      onChange={(e) => setHistStartDate(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-2.5 text-slate-750 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Tarikh Tamat</label>
                    <input 
                      type="date"
                      value={histEndDate}
                      onChange={(e) => setHistEndDate(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-2.5 text-slate-750 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Dari Dompet</label>
                  <select 
                    value={histAssetFilter}
                    onChange={(e) => setHistAssetFilter(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-2.5 text-slate-700 dark:text-slate-200"
                  >
                    <option value="Semua">Semua Dompet</option>
                    {assets.filter(a => a.category === 'Dompet').map((w, idx) => (
                      <option key={idx} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TRANSACTIONS CONTAINER LIST */}
              <div className="space-y-3">
                {filteredHistory.length === 0 ? (
                  <div className="bg-white dark:bg-slate-950 p-10 py-12 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 text-xs">Tiada rekod mutasi sejarah sepadan dengan tapisan semasa.</span>
                  </div>
                ) : (
                  filteredHistory.map((t, idx) => {
                    const isInc = t.type === 'Pemasukan';
                    return (
                      <div 
                        key={idx}
                        className={`bg-white dark:bg-slate-950 p-4 rounded-2xl border ${
                          isInc ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500'
                        } border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group relative`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                            isInc ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                          }`}>
                            {isInc ? <ArrowDownLeft className="w-4.5 h-4.5" /> : <ArrowUpRight className="w-4.5 h-4.5" />}
                          </div>
                          <div>
                            <div className="flex items-baseline gap-2">
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{t.category}</h4>
                              <span className="text-[9px] text-slate-400 font-bold uppercase">{t.type}</span>
                            </div>
                            <p className="text-slate-400 text-xs mt-1 leading-tight">{t.note || 'Transaksi Masuk/Keluar'}</p>
                            
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-slate-400 font-medium">{formatCustomDate(t.date)} • {t.user}</span>
                              {t.receiptUrl && (
                                <a 
                                  href={t.receiptUrl} 
                                  target="_blank" 
                                  referrerPolicy="no-referrer"
                                  className="text-[9px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:opacity-80 flex items-center gap-0.5 font-bold"
                                >
                                  <ImageIcon className="w-2.5 h-2.5" /> Resit
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold block">{t.assetName}</span>
                            <span className={`font-black text-sm block ${isInc ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {isInc ? '+' : '-'}{formatMYR(t.amount)}
                            </span>
                          </div>
                          {!(isUserWriteLocked && currentUser?.role !== 'Admin') && (
                            <button 
                              onClick={() => handleDeleteTx(t.id)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                              title="Padam"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* =================================_________ ================================= */}
          {/* SCREEN: CONFIGURATION & SETTINGS */}
          {activePage === 'settings' && (
            <div className="space-y-6 animate-fadeIn text-xs">
              
              {/* TOP HEADER SECTION */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 rounded-2xl p-4 border border-blue-50 dark:border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-blue-900 dark:text-sky-450 text-sm">Konfigurasi & Master Data</h4>
                  <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Kawal had akses dan kategori belanjawan</p>
                </div>
              </div>

              {/* RESTRICTED ACCESS BANNER */}
              {currentUser?.role !== 'Admin' && (
                <div className="bg-amber-500/10 dark:bg-amber-500/5 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-4 py-3 rounded-2xl flex items-start gap-2.5">
                  <span className="text-base mt-0.5">⚠️</span>
                  <div>
                    <h5 className="font-extrabold text-xs">Akses Terhad (Restricted Access)</h5>
                    <p className="text-[10px] leading-relaxed mt-0.5 opacity-90">
                      Anda log masuk sebagai pengguna biasa (User). Sila hubungi System Administrator (Admin) sekiranya anda memerlukan akses untuk menyunting pengguna, pilar, kategori, dompet, atau sasaran bajet.
                    </p>
                  </div>
                </div>
              )}

              {/* ADMIN LOCK CONTROLLER */}
              {currentUser?.role === 'Admin' && (
                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                        {isUserWriteLocked ? <Lock className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> : <Unlock className="w-3.5 h-3.5 text-emerald-500" />}
                        Had Kawalan Akses Kemasukan Data
                      </h4>
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                        {isUserWriteLocked ? 'Sistem Sedang Dikunci (Locked)' : 'Sedia Untuk Pengguna (Unlocked)'}
                      </p>
                    </div>
                    
                    {/* Toggle Button */}
                    <button
                      onClick={() => {
                        const nextLocked = !isUserWriteLocked;
                        setIsUserWriteLocked(nextLocked);
                        LocalDB.saveUserWriteLocked(nextLocked);
                        dbSetWriteLocked(nextLocked);
                        triggerToast(nextLocked ? 'Kemasukan data pengguna biasa telah DIKUNCI!' : 'Kemasukan data pengguna biasa sedia digunakan!');
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all text-[10px] active:scale-95 border ${
                        isUserWriteLocked 
                          ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400' 
                          : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400'
                      }`}
                    >
                      {isUserWriteLocked ? 'Buka Kunci' : 'Kunci Sekarang'}
                    </button>
                  </div>
                  <p className="text-slate-400 text-[10px] leading-relaxed">
                    Apabila status dikunci diaktifkan, semua pengguna dengan peranan <span className="font-extrabold text-slate-700 dark:text-slate-300">"User"</span> disekat daripada mencatatkan transaksi baru (klik butang +) atau memadam rekod transaksi sedia ada demi menjaga integriti data.
                  </p>
                </div>
              )}

              {/* LIST USERS ACCESSIBLE SECTION */}
              {currentUser?.role === 'Admin' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Akses Pengguna ({users.length})</span>
                    <button 
                      onClick={() => {
                        setUserInputFullname('');
                        setUserInputUsername('');
                        setUserInputEmail('');
                        setUserInputPassword('');
                        setUserInputRole('User');
                        setSettingsModal({ type: 'add_user' });
                      }}
                      className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center hover:opacity-90 active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 divide-y divide-slate-100 dark:divide-slate-800 space-y-1.5">
                    {users.map((u, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0 group">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200">@{u.username}</span>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              u.role === 'Admin' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-900'
                            }`}>{u.role}</span>
                          </div>
                          <span className="text-slate-400 block mt-0.5">{u.fullname} • {u.email || 'Tiada e-mel'}</span>
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setUserInputFullname(u.fullname);
                              setUserInputUsername(u.username);
                              setUserInputEmail(u.email);
                              setUserInputRole(u.role);
                              setUserInputPassword(u.password || '');
                              setSettingsModal({ type: 'edit_user', data: u });
                            }}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.username)}
                            className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LIST CATEGORIES & PILLARS SECTION */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">Pilar & Kategori Belanja</span>
                  {currentUser?.role === 'Admin' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setPilarInputName('');
                          setSettingsModal({ type: 'add_pilar', data: 'Pengeluaran' });
                        }}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg"
                      >
                        + Pilar
                      </button>
                      <button 
                        onClick={() => {
                          setCatInputName('');
                          setCatInputPilar(pilars.filter(p => p.type === 'Pengeluaran')[0]?.name || '');
                          setSettingsModal({ type: 'add_category', data: 'Pengeluaran' });
                        }}
                        className="px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600/15 border border-blue-600/20 text-blue-600 dark:text-sky-400 text-[10px] font-bold rounded-lg"
                      >
                        + Kategori
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 space-y-4">
                  {['Pemasukan', 'Pengeluaran'].map((txType, index) => {
                    const typeCats = categories.filter(c => c.type === txType);
                    return (
                      <div key={index} className="space-y-2">
                        <h4 className={`font-black uppercase tracking-wider border-b pb-1.5 ${
                          txType === 'Pemasukan' ? 'text-emerald-500' : 'text-rose-500'
                        }`}>{txType === 'Pemasukan' ? 'Pemasukan (Inflow)' : 'Pengeluaran (Outflow)'}</h4>

                        {typeCats.length === 0 ? (
                          <span className="text-slate-400 block text-center py-2">Tiada kategori</span>
                        ) : (
                          <div className="divide-y divide-slate-100 dark:divide-slate-900">
                            {typeCats.map((c, i) => (
                              <div key={i} className="flex justify-between items-center py-1.5 group">
                                <div>
                                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{c.name}</span>
                                  {c.pilar && (
                                    <span className="text-[9px] block text-slate-400 font-bold uppercase tracking-wider mt-0.5">Pilar: {c.pilar}</span>
                                  )}
                                </div>
                                {currentUser?.role === 'Admin' && (
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    <button 
                                      onClick={() => {
                                        setCatInputName(c.name);
                                        setCatInputPilar(c.pilar || '');
                                        setSettingsModal({ type: 'edit_category', data: c });
                                      }}
                                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteCategory(c)}
                                      className="p-1 rounded bg-rose-50 hover:bg-rose-105 text-rose-600"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </main>

        {/* BOTTOM FIXED FLOATING ACTION BUTTON CONTAINER & TABS */}
        <div className="absolute bottom-[20px] left-1/2 -translate-x-1/2 z-35 flex items-center pointer-events-none">
          <button 
            onClick={openAddTransaction}
            className={`w-16 h-16 bg-gradient-to-r text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all outline-none border-4 border-slate-50 dark:border-slate-900 pointer-events-auto ${
              isUserWriteLocked && currentUser?.role !== 'Admin'
                ? 'from-amber-500 to-rose-500'
                : 'from-blue-600 to-indigo-600'
            }`}
            title={isUserWriteLocked && currentUser?.role !== 'Admin' ? "Sistem dikunci oleh Admin" : "Tambah Transaksi"}
          >
            {isUserWriteLocked && currentUser?.role !== 'Admin' ? (
              <Lock className="w-7 h-7" />
            ) : (
              <Plus className="w-8 h-8" />
            )}
          </button>
        </div>

        {/* BOTTOM NAVIGATION TABS FRAME CONTAINER */}
        <nav className="absolute bottom-0 left-0 w-full h-[85px] bg-white/95 dark:bg-slate-950/95 border-t border-slate-100 dark:border-slate-800 backdrop-blur-md flex justify-between items-center px-6 pb-2.5 z-30 md:rounded-b-[40px] shadow-lg">
          <button 
            onClick={() => { setActivePage('home'); }}
            className={`flex flex-col items-center gap-1 flex-1 py-2 ${activePage === 'home' ? 'text-blue-600 dark:text-sky-400 font-extrabold' : 'text-slate-300'}`}
          >
            <span className="text-xs">🏠</span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest">Utama</span>
          </button>

          <button 
            onClick={() => { setActivePage('assets'); }}
            className={`flex flex-col items-center gap-1 flex-1 py-2 ${activePage === 'assets' ? 'text-blue-600 dark:text-sky-400 font-extrabold' : 'text-slate-300'}`}
          >
            <span className="text-xs">📂</span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest">Walet</span>
          </button>

          <div className="w-16"></div> {/* Offset center space for float FAB */}

          <button 
            onClick={() => { setActivePage('report'); }}
            className={`flex flex-col items-center gap-1 flex-1 py-2 ${activePage === 'report' ? 'text-blue-600 dark:text-sky-400 font-extrabold' : 'text-slate-300'}`}
          >
            <span className="text-xs">📊</span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest">Pintar</span>
          </button>

          <button 
            onClick={() => { setActivePage('history'); }}
            className={`flex flex-col items-center gap-1 flex-1 py-2 ${activePage === 'history' ? 'text-blue-600 dark:text-sky-400 font-extrabold' : 'text-slate-300'}`}
          >
            <span className="text-xs">⏳</span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest">Mutasi</span>
          </button>
        </nav>

        {/* MODAL WINDOWS OVERLAYS */}
        {/* ======================= TRANSACTION CREATOR DIALOG OVERLAY ======================= */}
        {isAddTxOpen && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-end justify-center">
            <div className="bg-white dark:bg-slate-900 w-full max-w-[500px] rounded-t-[40px] shadow-2xl p-6 pb-12 overflow-y-auto max-h-[85vh] animate-slideUp text-xs font-sans text-slate-800 dark:text-white border-t border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">Catat Transaksi Baru (RM)</h3>
                <button 
                  onClick={() => setIsAddTxOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center font-bold"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveTransaction} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Tarikh Transaksi</label>
                    <input 
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl font-bold font-mono focus:outline-none text-slate-800 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Tipe Aliran</label>
                    <select 
                      value={txType}
                      onChange={(e) => handleTxTypeChange(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl font-bold focus:outline-none text-slate-800 dark:text-white"
                    >
                      <option value="Pengeluaran">Pengeluaran (-)</option>
                      <option value="Pemasukan">Pemasukan (+)</option>
                      <option value="Transfer">Pindahan Wang (↔)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nilai RM (Malaysian Ringgit)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400">RM</span>
                    <input 
                      type="text"
                      inputMode="numeric"
                      value={txAmountStr}
                      onChange={(e) => handleAmountInMYR(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-lg font-black tracking-tight text-blue-600 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      {txType === 'Transfer' ? 'Wallet Sumber (Asal)' : 'Dibelanjakan Dari'}
                    </label>
                    <select 
                      value={txAsset}
                      onChange={(e) => setTxAsset(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl font-bold focus:outline-none text-slate-800 dark:text-white"
                    >
                      {assets.filter(a => a.category === 'Dompet').map((w, idx) => (
                        <option key={idx} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      {txType === 'Transfer' ? 'Wallet Penerima (Sasaran)' : 'Kategori Aliran'}
                    </label>
                    <select 
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl font-bold focus:outline-none text-slate-800 dark:text-white"
                    >
                      {txType === 'Transfer' ? (
                        assets.filter(a => a.category === 'Dompet').map((w, idx) => (
                          <option key={idx} value={w.name}>{w.name}</option>
                        ))
                      ) : (
                        categories.filter(c => c.type === txType).map((cat, idx) => (
                          <option key={idx} value={cat.name}>{cat.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nota Catatan (Keterangan)</label>
                  <input 
                    type="text"
                    value={txNote}
                    onChange={(e) => setTxNote(e.target.value)}
                    placeholder="Contoh: Beli teh tarik, makan tengah hari..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl focus:outline-none focus:border-blue-500 text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Muat Naik Gambar Resit (Opsional)</label>
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-extrabold file:uppercase file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {txReceiptBase64 && (
                      <div className="mt-4 relative w-36 h-36 mx-auto rounded-3xl overflow-hidden border border-slate-300 shadow-md bg-blue-600">
                      <img src={txReceiptBase64} alt="Receipt preview"className="absolute inset-0 w-full h-full object-cover scale-[2.2] origin-center" />
                      <button 
                        type="button" 
                        onClick={() => setTxReceiptBase64(null)}
                        className="absolute top-1 right-1 bg-rose-500/85 text-white rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsAddTxOpen(false)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 font-bold uppercase tracking-wider rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 font-bold uppercase tracking-wider rounded-xl text-white shadow-lg shadow-blue-600/10 active:scale-95 transition-all"
                  >
                    Rekod (RM)
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================= MASTER CONFIG MODALS SYSTEM ======================= */}
        {settingsModal && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-[420px] rounded-3xl shadow-2xl p-6 overflow-y-auto max-h-[85vh] animate-fadeIn text-xs text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-4 border-b dark:border-slate-800 pb-2.5">
                <h3 className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                  {settingsModal.type === 'add_user' && 'Daftar Pengguna Baru'}
                  {settingsModal.type === 'edit_user' && 'Edit Akaun Pengguna'}
                  {settingsModal.type === 'add_category' && `Tambah Kategori (${settingsModal.data})`}
                  {settingsModal.type === 'edit_category' && `Edit Kategori (${settingsModal.data.name})`}
                  {settingsModal.type === 'add_pilar' && `Tambah Pilar Pentadbiran`}
                  {settingsModal.type === 'add_asset' && 'Bina Dompet Simpanan Baru'}
                  {settingsModal.type === 'edit_asset' && 'Kemaskini Dompet'}
                  {settingsModal.type === 'add_budget' && 'Tetapkan Sasaran Belanjawan'}
                  {settingsModal.type === 'edit_budget' && 'Ubah Sasaran Belanjawan'}
                </h3>
                <button onClick={closeSettingsModal} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSettingsSubmit} className="space-y-4">
                
                {/* Mode: User Form fields */}
                {(settingsModal.type === 'add_user' || settingsModal.type === 'edit_user') && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nama Penuh</label>
                      <input 
                        type="text"
                        value={userInputFullname}
                        onChange={(e) => setUserInputFullname(e.target.value)}
                        placeholder="Contoh: Budi Santoso"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nama Log Masuk (Username)</label>
                      <input 
                        type="text"
                        value={userInputUsername}
                        onChange={(e) => setUserInputUsername(e.target.value)}
                        placeholder="Contoh: budi123"
                        disabled={settingsModal.type === 'edit_user'}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-mono text-xs font-bold disabled:opacity-60"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Alamat E-mel</label>
                      <input 
                        type="email"
                        value={userInputEmail}
                        onChange={(e) => setUserInputEmail(e.target.value)}
                        placeholder="Contoh: budi@gmail.my"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Peranan Akses</label>
                      <select 
                        value={userInputRole}
                        onChange={(e) => setUserInputRole(e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold"
                      >
                        <option value="User">Standard User Only</option>
                        <option value="Admin">System Administrator</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Kata Laluan (Password)</label>
                      <input 
                        type="password"
                        value={userInputPassword}
                        onChange={(e) => setUserInputPassword(e.target.value)}
                        placeholder={settingsModal.type === 'edit_user' ? "Kosongkan jika tidak diubah" : "Contoh: laluanRahsia123"}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold"
                        required={settingsModal.type === 'add_user'}
                      />
                    </div>
                  </div>
                )}

                {/* Mode: Category Form fields */}
                {(settingsModal.type === 'add_category' || settingsModal.type === 'edit_category') && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nama Kategori</label>
                      <input 
                        type="text"
                        value={catInputName}
                        onChange={(e) => setCatInputName(e.target.value)}
                        placeholder="Contoh: Jajanan Luar..."
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Pilih Pilar Penyatuan (Opsional)</label>
                      <select 
                        value={catInputPilar}
                        onChange={(e) => setCatInputPilar(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold"
                      >
                        <option value="">(Bukan di bawah mana-mana pilar)</option>
                        {pilars
                          .filter(p => p.type === (settingsModal.type === 'add_category' ? settingsModal.data : settingsModal.data.type))
                          .map((p, idx) => (
                            <option key={idx} value={p.name}>{p.name}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                )}

                {/* Mode: Pilar Form fields */}
                {settingsModal.type === 'add_pilar' && (
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nama Pilar</label>
                    <input 
                      type="text"
                      value={pilarInputName}
                      onChange={(e) => setPilarInputName(e.target.value)}
                      placeholder="Contoh: Belanja Hiburan, Rumah..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold"
                      required
                    />
                  </div>
                )}

                {/* Mode: Asset/Wallet Form fields */}
                {(settingsModal.type === 'add_asset' || settingsModal.type === 'edit_asset') && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nama Dompet / Bank Pek</label>
                      <input 
                        type="text"
                        value={assetInputName}
                        onChange={(e) => setAssetInputName(e.target.value)}
                        placeholder="Contoh: Maybank Baru, CIMB Utama..."
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Nomor Akaun (Simpan Rekod)</label>
                      <input 
                        type="text"
                        value={assetInputNoRek}
                        onChange={(e) => setAssetInputNoRek(e.target.value)}
                        placeholder="Contoh: 1640001882"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Baki Awal / Anggaran RM</label>
                      <input 
                        type="text"
                        inputMode="numeric"
                        value={assetInputVal}
                        onChange={(e) => handleAmountInMYR(e.target.value, 'asset')}
                        placeholder="Contoh: 5,000"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Mode: Target Budgeting Form fields */}
                {(settingsModal.type === 'add_budget' || settingsModal.type === 'edit_budget') && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Pilih Kategori Perbelanjaan</label>
                      <select 
                        value={budgetInputCat}
                        onChange={(e) => setBudgetInputCat(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold text-slate-800"
                        required
                      >
                        <option value="">-- PILIH SASARAN --</option>
                        {categories
                          .filter(c => c.type === (settingsModal.type === 'add_budget' ? settingsModal.data.type : settingsModal.data.type))
                          .map((c, idx) => (
                            <option key={idx} value={c.name}>{c.name}</option>
                          ))
                        }
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Siling Sasaran Limit (RM)</label>
                      <input 
                        type="text"
                        inputMode="numeric"
                        value={budgetInputLimit}
                        onChange={(e) => handleAmountInMYR(e.target.value, 'budget')}
                        placeholder="Contoh: 1,500"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl font-bold"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Rentang Mula</label>
                        <input 
                          type="date"
                          value={budgetInputStart}
                          onChange={(e) => setBudgetInputStart(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-150 p-2 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Rentang Tamat</label>
                        <input 
                          type="date"
                          value={budgetInputEnd}
                          onChange={(e) => setBudgetInputEnd(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-150 p-2 rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={budgetInputIgnoreDate}
                          onChange={(e) => setBudgetInputIgnoreDate(e.target.checked)}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-100 block">Akumulasi Luar Jangka Masa</span>
                          <span className="text-[10px] text-slate-400 mt-1 block leading-tight">Gunting sekatan bulan semasa (berguna untuk projek simpanan tabungan berkekalan)</span>
                        </div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Keterangan Catatan Ringkas</label>
                      <input 
                        type="text"
                        value={budgetInputNote}
                        onChange={(e) => setBudgetInputNote(e.target.value)}
                        placeholder="Nota peribadi..."
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 p-2.5 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-3 flex gap-2">
                  <button 
                    type="button" 
                    onClick={closeSettingsModal}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 font-bold uppercase tracking-wider rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold uppercase tracking-wider rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all text-center"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
