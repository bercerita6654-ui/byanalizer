import { DailySales, ProductPerformance } from './types';

const DB_NAME = 'SalesDashboardCacheDB';
const DB_VERSION = 3;
const SALES_STORE = 'sales_cache_v3';
const PRODUCTS_STORE = 'products_cache_v3';

export interface CacheEntry<T> {
  url: string;
  data: T;
  timestamp: number;
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error || new Error('Gagal membuka IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SALES_STORE)) {
        db.createObjectStore(SALES_STORE, { keyPath: 'url' });
      }
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        db.createObjectStore(PRODUCTS_STORE, { keyPath: 'url' });
      }
    };
  });
}

export async function getSalesCache(url: string): Promise<DailySales[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SALES_STORE, 'readonly');
      const store = transaction.objectStore(SALES_STORE);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result as CacheEntry<DailySales[]> | undefined;
        resolve(result ? result.data : null);
      };

      request.onerror = () => {
        reject(request.error || new Error('Gagal mengambil cache sales'));
      };
    });
  } catch (err) {
    console.warn('Gagal membaca cache IndexedDB:', err);
    return null;
  }
}

export async function setSalesCache(url: string, data: DailySales[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SALES_STORE, 'readwrite');
      const store = transaction.objectStore(SALES_STORE);
      const entry: CacheEntry<DailySales[]> = {
        url,
        data,
        timestamp: Date.now()
      };
      const request = store.put(entry);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Gagal menyimpan cache sales'));
      };
    });
  } catch (err) {
    console.warn('Gagal menulis cache IndexedDB:', err);
  }
}

export async function getProductsCache(url: string): Promise<ProductPerformance[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PRODUCTS_STORE, 'readonly');
      const store = transaction.objectStore(PRODUCTS_STORE);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result as CacheEntry<ProductPerformance[]> | undefined;
        resolve(result ? result.data : null);
      };

      request.onerror = () => {
        reject(request.error || new Error('Gagal mengambil cache produk'));
      };
    });
  } catch (err) {
    console.warn('Gagal membaca cache produk IndexedDB:', err);
    return null;
  }
}

export async function setProductsCache(url: string, data: ProductPerformance[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PRODUCTS_STORE, 'readwrite');
      const store = transaction.objectStore(PRODUCTS_STORE);
      const entry: CacheEntry<ProductPerformance[]> = {
        url,
        data,
        timestamp: Date.now()
      };
      const request = store.put(entry);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Gagal menyimpan cache produk'));
      };
    });
  } catch (err) {
    console.warn('Gagal menulis cache produk IndexedDB:', err);
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SALES_STORE, PRODUCTS_STORE], 'readwrite');
      const salesStore = transaction.objectStore(SALES_STORE);
      const productsStore = transaction.objectStore(PRODUCTS_STORE);
      
      salesStore.clear();
      productsStore.clear();

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error || new Error('Gagal membersihkan cache'));
      };
    });
  } catch (err) {
    console.warn('Gagal membersihkan cache IndexedDB:', err);
  }
}
