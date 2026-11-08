// 偏心我 · local-first record store (IndexedDB + in-memory index).
// A record is { k, c (collection), i (id), t (hybrid clock), d (device), by, x (data|null) }.
// Last writer wins per record; x === null is a tombstone.

import { openDB, reqP, txDone } from './idb.js?v=0cc8a63665';
import { uid } from './util.js?v=0cc8a63665';

// "state" collections keep exactly one copy at a fixed topic; everything else is a dated log.
export const STATE_COLS = new Set(['profile', 'status', 'draft', 'ink', 'together', 'tjoin', 'poke', 'tz']);
// collections starting with "_" never leave this device
export const isLocalCol = (c) => c[0] === '_';
export const LINK_MASK = 3; // one bit per broker link

export function newer(a, b) {
  if (!b) return true;
  if (a.t !== b.t) return a.t > b.t;
  return (a.d || '') > (b.d || '');
}

export class Store {
  constructor(me) {
    this.me = me;
    this.recs = new Map();
    this.byCol = new Map();
    this.subs = new Set();
    this.colSubs = new Set();
    this.dirtyCols = new Set();
    this.pending = new Map();
    this.last = 0;
    this.onLocal = null;
    this.dev = '';
  }

  async open() {
    this.db = await openDB('pianxin-' + this.me, 1, (db) => {
      db.createObjectStore('rec', { keyPath: 'k' });
      db.createObjectStore('blob');
      db.createObjectStore('meta');
    });
    const all = await reqP(this.db.transaction('rec').objectStore('rec').getAll());
    const now = Date.now();
    for (const r of all) {
      this._mem(r);
      if (r.t > this.last && r.t < now + 864e5) this.last = r.t;
    }
    this.dev = await this.getMeta('dev');
    if (!this.dev) {
      this.dev = uid(8);
      await this.setMeta('dev', this.dev);
    }
  }

  _mem(r) {
    this.recs.set(r.k, r);
    let m = this.byCol.get(r.c);
    if (!m) this.byCol.set(r.c, (m = new Map()));
    m.set(r.i, r);
  }

  clock() {
    this.last = Math.max(Date.now(), this.last + 1);
    return this.last;
  }

  rec(col, id) {
    return this.byCol.get(col)?.get(id);
  }

  get(col, id) {
    const r = this.rec(col, id);
    return r && r.x != null ? r.x : undefined;
  }

  list(col, filter) {
    const m = this.byCol.get(col);
    if (!m) return [];
    const out = [];
    for (const r of m.values()) {
      if (r.x == null) continue;
      if (filter && !filter(r.x, r)) continue;
      out.push({ ...r.x, id: r.i, _t: r.t, _by: r.by });
    }
    return out;
  }

  /** per-record listener: fn(rec, origin, prev) with origin = local | live | sync */
  on(fn) {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  /** batched listener for UI: fn(Set<col>) at most every ~16ms */
  onCols(fn) {
    this.colSubs.add(fn);
    return () => this.colSubs.delete(fn);
  }

  _emit(r, origin, prev) {
    for (const fn of this.subs) {
      try { fn(r, origin, prev); } catch (e) { console.error(e); }
    }
    this.dirtyCols.add(r.c);
    if (!this.colTimer) this.colTimer = setTimeout(() => this._flushCols(), 16);
  }

  _flushCols() {
    this.colTimer = null;
    const cols = this.dirtyCols;
    this.dirtyCols = new Set();
    for (const fn of this.colSubs) {
      try { fn(cols); } catch (e) { console.error(e); }
    }
  }

  /** local write */
  put(col, id, x) {
    const prev = this.rec(col, id);
    const r = { k: `${col}/${id}`, c: col, i: id, t: this.clock(), d: this.dev, by: this.me, x: x ?? null, dirty: isLocalCol(col) ? 0 : LINK_MASK };
    const ptp = prev && (prev.tp || prev.ptp);
    if (ptp) r.ptp = ptp;
    this._mem(r);
    this._save(r);
    this._emit(r, 'local', prev);
    if (this.onLocal && r.dirty) this.onLocal(r);
    return r;
  }

  /** restore a record from a backup file (keeps its clock, marks it for upload) */
  importRec(x) {
    if (!x || typeof x.c !== 'string' || typeof x.i !== 'string' || isLocalCol(x.c)) return false;
    const r = { k: `${x.c}/${x.i}`, c: x.c, i: x.i, t: Number(x.t) || this.clock(), d: 'import', by: x.by, x: x.x ?? null };
    const cur = this.recs.get(r.k);
    if (cur && !newer(r, cur)) return false;
    if (cur && (cur.tp || cur.ptp)) r.ptp = cur.tp || cur.ptp;
    r.dirty = LINK_MASK;
    this._mem(r);
    this._save(r);
    this._emit(r, 'sync', cur);
    if (this.onLocal) this.onLocal(r);
    return true;
  }

  patch(col, id, partial) {
    return this.put(col, id, { ...(this.get(col, id) || {}), ...partial });
  }

  del(col, id) {
    if (!this.rec(col, id)) return null;
    return this.put(col, id, null);
  }

  /** remote record */
  apply(r, origin) {
    if (isLocalCol(r.c)) return false;
    const now = Date.now();
    if (r.t > this.last && r.t < now + 864e5) this.last = r.t;
    const cur = this.recs.get(r.k);
    if (cur && !newer(r, cur)) {
      if (cur.t === r.t && !cur.tp && r.tp) {
        cur.tp = r.tp;
        this._save(cur);
      }
      return false;
    }
    r.dirty = 0;
    this._mem(r);
    this._save(r);
    this._emit(r, origin, cur);
    return true;
  }

  markClean(k, t, bit, tp) {
    const r = this.recs.get(k);
    if (!r || r.t !== t) return;
    r.dirty = (r.dirty || 0) & ~bit;
    r.tp = tp;
    if (!r.dirty) delete r.ptp;
    this._save(r);
  }

  dirtyRecs() {
    const out = [];
    for (const r of this.recs.values()) if (r.dirty) out.push(r);
    return out;
  }

  /** the room key changed: forget broker topics and upload everything again */
  rekey() {
    for (const r of this.recs.values()) {
      if (isLocalCol(r.c)) continue;
      delete r.tp;
      delete r.ptp;
      r.dirty = LINK_MASK;
      this._save(r);
    }
  }

  blobIds() {
    return reqP(this.db.transaction('blob').objectStore('blob').getAllKeys());
  }

  _save(r) {
    this.pending.set(r.k, r);
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), 80);
  }

  async flush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (!this.pending.size) return true;
    const batch = [...this.pending.values()];
    this.pending.clear();
    try {
      const t = this.db.transaction('rec', 'readwrite');
      const os = t.objectStore('rec');
      for (const r of batch) os.put(r);
      await txDone(t);
      return true;
    } catch (e) {
      // Keep unsaved revisions for an explicit retry or the next local write.
      for (const r of batch) if (!this.pending.has(r.k)) this.pending.set(r.k, this.recs.get(r.k) || r);
      console.error('[store] save failed', e);
      return false;
    }
  }

  // ---------- meta & blobs ----------
  getMeta(k) {
    return reqP(this.db.transaction('meta').objectStore('meta').get(k));
  }
  async setMeta(k, v) {
    const t = this.db.transaction('meta', 'readwrite');
    t.objectStore('meta').put(v, k);
    await txDone(t);
  }
  getBlob(id) {
    return reqP(this.db.transaction('blob').objectStore('blob').get(id));
  }
  async putBlob(id, v) {
    const t = this.db.transaction('blob', 'readwrite');
    t.objectStore('blob').put(v, id);
    await txDone(t);
  }

  exportAll() {
    const out = [];
    for (const r of this.recs.values()) if (r.x != null) out.push({ c: r.c, i: r.i, t: r.t, by: r.by, x: r.x });
    return out;
  }

  async destroy() {
    try { this.db.close(); } catch {}
    await new Promise((res) => {
      const r = indexedDB.deleteDatabase('pianxin-' + this.me);
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
  }
}
