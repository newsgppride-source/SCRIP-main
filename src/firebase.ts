import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs, 
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { User, Asset, Pilar, Category, Transaction, Budget } from './types';
import { 
  DEFAULT_USERS, 
  DEFAULT_PILARS, 
  DEFAULT_CATEGORIES, 
  DEFAULT_BUDGETS, 
  generateDefaultTransactions 
} from './utils';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

function getActiveUsername(): string {
  try {
    const userSession = sessionStorage.getItem('logged_user');
    return userSession ? JSON.parse(userSession).username || 'global' : 'global';
  } catch {
    return 'global';
  }
}

export async function initializeFirestoreDefaults(defaults: {
  users: User[];
  assets: Asset[];
  pilars: Pilar[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
}) {
  try {
    const usersToUse = defaults.users.length > 0 ? defaults.users : DEFAULT_USERS;
    const pilarsToUse = defaults.pilars.length > 0 ? defaults.pilars : DEFAULT_PILARS;
    const categoriesToUse = defaults.categories.length > 0 ? defaults.categories : DEFAULT_CATEGORIES;
    const transactionsToUse = defaults.transactions.length > 0 ? defaults.transactions : generateDefaultTransactions();
    const budgetsToUse = defaults.budgets.length > 0 ? defaults.budgets : DEFAULT_BUDGETS;

    // 1. Users
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      const batch = writeBatch(db);
      usersToUse.forEach((u) => {
        const docRef = doc(db, 'users', u.username);
        batch.set(docRef, u);
      });
      await batch.commit();
    }

    // 2. Assets (Dikosongkan total agar tidak membal memunculkan e-wallet bawaan pabrik)
    const assetsSnap = await getDocs(collection(db, 'assets'));
    if (assetsSnap.empty) {
      console.log('Firebase: Default assets initialization disabled.');
    }

    // 3. Pilars
    const pilarsSnap = await getDocs(collection(db, 'pilars'));
    if (pilarsSnap.empty) {
      const batch = writeBatch(db);
      pilarsToUse.forEach((p) => {
        const docRef = doc(db, 'pilars', p.name);
        batch.set(docRef, p);
      });
      await batch.commit();
    }

    // 4. Categories
    const categoriesSnap = await getDocs(collection(db, 'categories'));
    if (categoriesSnap.empty) {
      const batch = writeBatch(db);
      categoriesToUse.forEach((c) => {
        const docRef = doc(db, 'categories', `${c.name}_${c.type}`);
        batch.set(docRef, c);
      });
      await batch.commit();
    }

    // 5. Transactions
    const txSnap = await getDocs(collection(db, 'transactions'));
    if (txSnap.empty) {
      const batch = writeBatch(db);
      transactionsToUse.forEach((t) => {
        const docRef = doc(db, 'transactions', t.id);
        batch.set(docRef, t);
      });
      await batch.commit();
    }

    // 6. Budgets
    const budgetsSnap = await getDocs(collection(db, 'budgets'));
    if (budgetsSnap.empty && usersSnap.empty) {
      const batch = writeBatch(db);
      budgetsToUse.forEach((b) => {
        const docId = `${b.month}_${b.type}_${b.category.split('/').join('_')}`;
        const docRef = doc(db, 'budgets', docId);
        batch.set(docRef, b);
      });
      await batch.commit();
    }

    // 7. Config Setup
    const configRef = doc(db, 'config', 'global');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, { isUserWriteLocked: false });
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

export function subscribeUsers(callback: (users: User[]) => void) {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const list: User[] = [];
    snapshot.forEach((d) => { list.push(d.data() as User); });
    callback(list);
  }, (err) => console.error('Users sub err:', err));
}

export function subscribeAssets(callback: (assets: Asset[]) => void) {
  const username = getActiveUsername();
  return onSnapshot(collection(db, 'assets'), (snapshot) => {
    const list: Asset[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as Asset & { owner?: string };
      if (username.includes('admin')) {
        list.push(data);
      } else {
        if (!data.owner || data.owner === username) {
          list.push(data);
        }
      }
    });
    callback(list);
  }, (err) => console.error('Assets sub err:', err));
}

export function subscribePilars(callback: (pilars: Pilar[]) => void) {
  return onSnapshot(collection(db, 'pilars'), (snapshot) => {
    const list: Pilar[] = [];
    snapshot.forEach((d) => { list.push(d.data() as Pilar); });
    callback(list);
  }, (err) => console.error('Pilars sub err:', err));
}

export function subscribeCategories(callback: (categories: Category[]) => void) {
  return onSnapshot(collection(db, 'categories'), (snapshot) => {
    const list: Category[] = [];
    snapshot.forEach((d) => { list.push(d.data() as Category); });
    callback(list);
  }, (err) => console.error('Categories sub err:', err));
}

export function subscribeTransactions(callback: (transactions: Transaction[]) => void) {
  const username = getActiveUsername();
  return onSnapshot(collection(db, 'transactions'), (snapshot) => {
    const list: Transaction[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as Transaction & { owner?: string };
      if (username.includes('admin')) {
        list.push(data);
      } else {
        if (!data.owner || data.owner === username) {
          list.push(data);
        }
      }
    });
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    callback(list);
  }, (err) => console.error('Transactions sub err:', err));
}

export function subscribeBudgets(callback: (budgets: Budget[]) => void) {
  return onSnapshot(collection(db, 'budgets'), (snapshot) => {
    const list: Budget[] = [];
    snapshot.forEach((d) => { list.push(d.data() as Budget); });
    callback(list);
  }, (err) => console.error('Budgets sub err:', err));
}

export function subscribeGlobalConfig(callback: (isLocked: boolean) => void) {
  return onSnapshot(doc(db, 'config', 'global'), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback(!!data.isUserWriteLocked);
    }
  }, (err) => console.error('Global config sub err:', err));
}

export async function dbSaveUser(user: User) {
  await setDoc(doc(db, 'users', user.username), user);
}

export async function dbDeleteUser(username: string) {
  await deleteDoc(doc(db, 'users', username));
}

export async function dbSaveAsset(asset: Asset & { owner?: string }) {
  const targetOwner = asset.owner || getActiveUsername();
  const uniqueAssetName = `${targetOwner}_${asset.name}`;
  await setDoc(doc(db, 'assets', uniqueAssetName), { ...asset, owner: targetOwner });
}

export async function dbDeleteAsset(name: string) {
  const username = getActiveUsername();
  await deleteDoc(doc(db, 'assets', `${username}_${name}`));
}

export async function dbSavePilar(pilar: Pilar) {
  await setDoc(doc(db, 'pilars', pilar.name), pilar);
}

export async function dbDeletePilar(name: string) {
  await deleteDoc(doc(db, 'pilars', name));
}

export async function dbSaveCategory(category: Category) {
  await setDoc(doc(db, 'categories', `${category.name}_${category.type}`), category);
}

export async function dbDeleteCategory(categoryName: string, categoryType: string) {
  await deleteDoc(doc(db, 'categories', `${categoryName}_${categoryType}`));
}

export async function dbSaveTransaction(tx: Transaction) {
  const username = getActiveUsername();
  await setDoc(doc(db, 'transactions', tx.id), { ...tx, owner: username });
}

export async function dbDeleteTransaction(id: string) {
  await deleteDoc(doc(db, 'transactions', id));
}

export async function dbSaveBudget(budget: Budget) {
  const docId = `${budget.month}_${budget.type}_${budget.category.split('/').join('_')}`;
  await setDoc(doc(db, 'budgets', docId), budget);
}

export async function dbDeleteBudget(budget: Budget) {
  const docId = `${budget.month}_${budget.type}_${budget.category.split('/').join('_')}`;
  await deleteDoc(doc(db, 'budgets', docId));
}

export async function dbSetWriteLocked(locked: boolean) {
  await setDoc(doc(db, 'config', 'global'), { isUserWriteLocked: locked });
}

export async function fetchLiveState() {
  return null;
}
