// 偏心我 · tiny IndexedDB helpers

export function openDB(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, version);
    r.onupgradeneeded = (e) => upgrade(r.result, e.oldVersion, r.transaction);
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => { try { db.close(); } catch {} location.reload(); };
      resolve(db);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => console.warn('[idb] open blocked by another tab');
  });
}

export const reqP = (r) =>
  new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

export const txDone = (t) =>
  new Promise((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error || new Error('transaction failed'));
    t.onabort = () => rej(t.error || new Error('transaction aborted'));
  });

export async function kvGet(db, store, key) {
  return reqP(db.transaction(store, 'readonly').objectStore(store).get(key));
}

export async function kvPut(db, store, value, key) {
  const t = db.transaction(store, 'readwrite');
  if (key === undefined) t.objectStore(store).put(value);
  else t.objectStore(store).put(value, key);
  return txDone(t);
}

export async function kvDel(db, store, key) {
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).delete(key);
  return txDone(t);
}

export async function kvAll(db, store) {
  return reqP(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function kvAllKeys(db, store) {
  return reqP(db.transaction(store, 'readonly').objectStore(store).getAllKeys());
}
