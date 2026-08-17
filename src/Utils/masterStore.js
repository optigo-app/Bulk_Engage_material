// masterStore.js
// Large master datasets (fetched from the API) used to be dumped into
// sessionStorage, whose ~5MB per-origin quota was easily exceeded
// (QuotaExceededError on `allJobMaterialData`). They now live in IndexedDB
// (hundreds of MB quota) with a synchronous in-memory cache so existing
// synchronous consumers keep working unchanged.

const DB_NAME = 'engageMasterDB';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

// The set of keys that are considered "master data" and therefore backed by
// IndexedDB instead of sessionStorage.
export const MASTER_KEYS = new Set([
  'allLockerData',
  'allEmployeeData',
  'allJobListData',
  'allBagListData',
  'allEmployeeLockerData',
  'allJobMaterialData',
  'allEngagedMaterial',
]);

export const isMasterKey = (key) => MASTER_KEYS.has(key);

// Synchronous in-memory cache. Consumers read from here.
const cache = new Map();

let dbPromise = null;

const hasIndexedDB = () =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const openDB = () => {
  if (!hasIndexedDB()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let request;
    try {
      request = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

  return dbPromise;
};

const idbGetAll = (db) =>
  new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();
      tx.oncomplete = () => {
        const keys = keysReq.result || [];
        const vals = valsReq.result || [];
        const out = {};
        keys.forEach((k, i) => {
          out[k] = vals[i];
        });
        resolve(out);
      };
      tx.onerror = () => resolve({});
    } catch {
      resolve({});
    }
  });

const idbPut = async (key, value) => {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

const idbDelete = async (key) => {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

/**
 * Loads any persisted master data from IndexedDB into the in-memory cache.
 * Must be awaited before rendering components that read master data so that
 * synchronous reads return the persisted values after a hard page reload.
 */
export const hydrateMasterStore = async () => {
  const db = await openDB();
  if (!db) return;
  const all = await idbGetAll(db);
  Object.entries(all).forEach(([key, value]) => {
    if (MASTER_KEYS.has(key)) cache.set(key, value);
  });
};

/** Synchronously read a master dataset. Returns `fallback` when absent. */
export const getMaster = (key, fallback = []) =>
  cache.has(key) ? cache.get(key) : fallback;

/**
 * Synchronously update the in-memory cache and asynchronously persist to
 * IndexedDB. Reads via getMaster see the new value immediately.
 */
export const setMaster = (key, value) => {
  cache.set(key, value);
  // Fire-and-forget persistence; failures never break the app.
  idbPut(key, value).catch(() => {});
};

/** Remove a master dataset from both the cache and IndexedDB. */
export const removeMaster = (key) => {
  cache.delete(key);
  idbDelete(key).catch(() => {});
};
