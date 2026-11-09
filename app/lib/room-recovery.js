// Local-only recovery for devices that used a different passphrase. No Sync,
// sockets or old-room requests are created here. Source DB is never rekeyed,
// modified or deleted. Migration only runs after the official key is verified
// and the person explicitly opts in; old data remains available for backups.
import { Store, isLocalCol, LINK_MASK } from './store.js?v=4420681d90';
import { seal, keyedHash } from './crypto.js?v=4420681d90';
import { roomAccessIssue } from './room-access.js?v=4420681d90';
import { download } from './util.js?v=4420681d90';
import { reqP, txDone } from './idb.js?v=4420681d90';

const HISTORY = new Set(['learn', 'journal', 'meal', 'recipe', 'workout', 'wish', 'plan', 'meet', 'anniv', 'idea', 'chat', 'react', 'cmt', 'task', 'tsess', 'rcook']);
const privateData = (x) => !!x && (x.to === 'me' || x.private || x._private || x._local);

export async function openRecoverySource(me) {
  const source = new Store(me);
  try { await source.open({ readOnly: true }); } catch { throw new Error('没有找到可读取的本机旧记录。请保留原浏览器数据，不要清除。'); }
  return source;
}

export function recoveryCounts(source) {
  let records = 0, stickers = 0, privateNotes = 0;
  for (const r of source.recs.values()) {
    if (r.x == null) continue;
    records++;
    if (r.c === 'chat' && r.x.st) stickers++;
    if (isLocalCol(r.c) || privateData(r.x)) privateNotes++;
  }
  return { records, stickers, privateNotes };
}

/** Full local archive, including photos and tombstones. With a surviving old
 * key, encrypt using that OLD key; no seed/key/room address is exported. */
export async function exportRecoveryArchive(source, oldKr) {
  const recs = [...source.recs.values()].map(({ c, i, t, d, by, x }) => ({ c, i, t, d, by, x }));
  const photos = [];
  for (const id of await source.blobIds()) {
    const v = await source.getBlob(id);
    if (!v) continue;
    const bytes = v.b instanceof Uint8Array ? v.b : new Uint8Array(v.b);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    photos.push({ id, m: v.m, b: btoa(binary) });
  }
  const body = { app: 'pianxin.me', v: 2, kind: 'local-recovery', me: source.me, at: Date.now(), recs, photos };
  const tag = 'pianxin.me/local-recovery/v1';
  const date = new Date().toISOString().slice(0, 10);
  if (oldKr) {
    const payload = await seal(oldKr.key, tag, body);
    // The fixed AAD is part of the format; old password can derive its key.
    download(`pianxin-${source.me}-local-${date}.pxbackup`, payload, 'application/octet-stream');
  } else {
    // Key absent: still allow saving surviving local bytes, with an explicit UI
    // warning. This file is private; never import/upload it automatically.
    download(`pianxin-${source.me}-local-${date}.json`, JSON.stringify(body));
  }
  return { records: recs.length, photos: photos.length, encrypted: !!oldKr };
}

/** Copy a union of non-conflicting old history into a separate official DB.
 * Deterministic new IDs prevent collisions with desktop history. No state,
 * credentials, draft or old broker topic is copied. Source remains untouched. */
export async function mergeRecoverySource(source, target, kr) {
  const issue = await roomAccessIssue(kr);
  if (issue) throw new Error(issue);
  const oldRoom = await source.getMeta('room');
  if (!oldRoom || oldRoom === kr.room) throw new Error('无法确认旧空间，已停止迁入；原记录保留。');
  if (target.dbName === source.dbName) throw new Error('迁入目标必须与原记录隔离。');
  const marker = 'recovery/' + await keyedHash(kr.salt, oldRoom, 24);
  const done = await target.getMeta(marker);
  if (done) return { ...done, repeated: true };
  const map = new Map();
  const mapped = async (c, i) => {
    const k = c + '/' + i;
    if (!map.has(k)) map.set(k, 'm' + await keyedHash(kr.salt, 'recovery/v1/' + oldRoom + '/' + k, 24));
    return map.get(k);
  };
  const parentTarget = async (value) => {
    if (typeof value !== 'string') return null;
    const slash = value.indexOf('/');
    if (slash < 1) return null;
    const c = value.slice(0, slash), i = value.slice(slash + 1);
    const parent = source.rec(c, i);
    if (!parent || !HISTORY.has(c) || privateData(parent.x)) return null;
    return c + '/' + await mapped(c, i);
  };
  const blobMap = new Map(), candidates = [];
  let photos = 0, missingPhotos = 0, thumbnailOnly = 0, skipped = 0;
  const copyPhoto = async (id) => {
    if (!id) return null;
    if (blobMap.has(id)) return blobMap.get(id);
    const v = await source.getBlob(id);
    if (!v) { blobMap.set(id, null); missingPhotos++; return null; }
    const bytes = v.b instanceof Uint8Array ? v.b : new Uint8Array(v.b);
    const next = await keyedHash(kr.salt, bytes, 24);
    await target.putBlob(next, { m: v.m, b: bytes });
    blobMap.set(id, next); photos++;
    return next;
  };
  for (const r of source.recs.values()) {
    const legacyPrivate = privateData(r.x);
    if (!isLocalCol(r.c) && !HISTORY.has(r.c)) { skipped++; continue; }
    // Legacy private journal flags are made genuinely local-only; unknown
    // private non-journal records stay in the untouched source archive.
    if (legacyPrivate && r.c !== 'journal' && !isLocalCol(r.c)) { skipped++; continue; }
    const c = legacyPrivate && r.c === 'journal' ? '_journal' : r.c;
    const local = isLocalCol(c);
    let i = await mapped(r.c, r.i);
    let x = r.x == null ? null : structuredClone(r.x);
    if (r.c === 'react') {
      const cut = r.i.lastIndexOf('~');
      const original = x?.t || (cut >= 0 ? r.i.slice(0, cut) : '');
      const targetRef = await parentTarget(original);
      if (!targetRef) { skipped++; continue; }
      i = targetRef + '~' + (x?.who || r.i.slice(cut + 1));
      if (x) x.t = targetRef;
    } else if (r.c === 'cmt' && x) {
      const targetRef = await parentTarget(x.t);
      if (!targetRef) { skipped++; continue; }
      x.t = targetRef;
    } else if (r.c === 'rcook' && x) {
      if (!source.rec('recipe', x.r) || privateData(source.get('recipe', x.r))) { skipped++; continue; }
      x.r = await mapped('recipe', x.r);
    }
    if (x && Array.isArray(x.photos)) {
      const next = [];
      for (const p of x.photos) {
        // Still-local staged photos in a shared record must never be uploaded.
        if (!local && p.loc) { skipped++; continue; }
        const id = await copyPhoto(p.id);
        const th = p.th ? await copyPhoto(p.th) : id;
        if (!id && !th) continue;
        if (!id && th) thumbnailOnly++;
        const photo = { ...p, id: id || th, th: th || id };
        if (local) photo.loc = true; else delete photo.loc;
        next.push(photo);
      }
      x.photos = next;
    }
    const k = c + '/' + i;
    const next = { k, c, i, t: r.t, d: r.d || 'recovery', by: r.by, x, dirty: local ? 0 : LINK_MASK };
    if (!local) next.tp = 's/' + await keyedHash(kr.salt, k, 20);
    candidates.push(next);
  }
  // Blob copies above are already durable. Keep every record, the upload queue
  // and completion marker in one commit; Store's auto-flush is not a barrier.
  const tx = target.db.transaction(['rec', 'meta'], 'readwrite');
  const committed = txDone(tx), rec = tx.objectStore('rec'), meta = tx.objectStore('meta');
  const inserted = [];
  let result;
  try {
    // Read under the write lock, not from target's potentially stale memory.
    // A concurrent migration/edit/tombstone must win even if preparation began
    // before it committed. Recheck the marker here for concurrent attempts.
    const [rows, blobOut, completed] = await Promise.all([
      reqP(rec.getAll()), reqP(meta.get('blobOut')), reqP(meta.get(marker)),
    ]);
    if (completed) {
      result = { ...completed, repeated: true };
    } else {
      const current = new Map(rows.map((r) => [r.k, r]));
      for (const next of candidates) {
        if (current.has(next.k)) continue; // existing edits/deletions always win
        rec.add(next); // insert-only, including protection against tombstones
        current.set(next.k, next);
        inserted.push(next);
      }
      const pending = { ...(blobOut || {}) };
      // Use the durable/current union: a rejected candidate must not enqueue
      // its photos, and private or still-local photos never become public.
      for (const r of current.values()) {
        if (isLocalCol(r.c) || !r.x || privateData(r.x) || !Array.isArray(r.x.photos)) continue;
        for (const p of r.x.photos) if (!p.loc) for (const id of [p.id, p.th]) if (id) pending[id] = LINK_MASK;
      }
      result = { copied: inserted.length, photos, missingPhotos, thumbnailOnly, skipped, at: Date.now() };
      meta.put(pending, 'blobOut');
      meta.put(result, marker);
    }
    await committed;
  } catch (e) {
    // Also roll back synchronous request errors rather than committing a prefix.
    try { tx.abort(); } catch {}
    await committed.catch(() => {});
    throw e;
  }
  // Never expose uncommitted records or schedule a later auto-flush. Preserve
  // any in-memory edit made while the transaction was in flight as well.
  for (const r of inserted) {
    if (!target.rec(r.c, r.i)) target._mem(r);
    if (r.t > target.last && r.t < Date.now() + 864e5) target.last = r.t;
  }
  return result;
}
