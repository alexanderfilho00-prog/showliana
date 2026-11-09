// Minimal IndexedDB layer. One database per device, no server.
import type { Activity, Client, Context } from "./types";

const DB_NAME = "showliana";
const DB_VERSION = 1;
export type StoreName = "activities" | "contexts" | "clients" | "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ["activities", "contexts", "clients"]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAll<T>(store: Exclude<StoreName, "meta">): Promise<T[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function put(store: Exclude<StoreName, "meta">, value: Activity | Client | Context) {
  const db = await open();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  return done(tx);
}

export async function putMany(store: Exclude<StoreName, "meta">, values: (Activity | Client | Context)[]) {
  const db = await open();
  const tx = db.transaction(store, "readwrite");
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  return done(tx);
}

export async function remove(store: Exclude<StoreName, "meta">, id: string) {
  const db = await open();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  return done(tx);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction("meta").objectStore("meta").get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta(key: string, value: unknown) {
  const db = await open();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put(value, key);
  return done(tx);
}

/** Replace every record in one transaction (used by backup import). */
export async function replaceAll(data: {
  activities: Activity[];
  contexts: Context[];
  clients: Client[];
}) {
  const db = await open();
  const tx = db.transaction(["activities", "contexts", "clients"], "readwrite");
  for (const name of ["activities", "contexts", "clients"] as const) {
    const os = tx.objectStore(name);
    os.clear();
    for (const v of data[name]) os.put(v);
  }
  return done(tx);
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* not supported */
  }
}
