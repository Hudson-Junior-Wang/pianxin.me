// 偏心我 · sync engine.
// All content is sealed with AES-GCM before it leaves the device and travels over
// two independent public MQTT brokers. Retained messages act as an encrypted
// mailbox, so the other person receives everything even if you were never online
// at the same time. Topics:
//   s/<h>              latest copy of a "state" record (status, draft, together…)
//   r/YYYY/MM/DD/<h>   log records, partitioned by the UTC day they were written
//   b/<blob>/<n>       encrypted image chunks
//   l                  live events (poke, gentle toasts, blob requests)
//   p/<who>.<device>   presence (cleared by the broker's last-will when we drop)
//   i                  room info

import { MqttClient } from './mqtt.js?v=2b526ea3b9';
import { seal, unseal, keyedHash } from './crypto.js?v=2b526ea3b9';
import { STATE_COLS, LINK_MASK } from './store.js?v=2b526ea3b9';
import { utcDay, sleep, uid } from './util.js?v=2b526ea3b9';

export const LINKS = [
  { name: 'EMQX', urls: ['wss://broker.emqx.io:8084/mqtt', 'wss://broker-cn.emqx.io:8084/mqtt'], rate: 6, burst: 6 },
  { name: 'HiveMQ', urls: ['wss://broker.hivemq.com:8884/mqtt'], rate: 15, burst: 15 },
];
const CHUNK = 60000;
const MAX_RETAINED = 98000;
const EMPTY = new Uint8Array(0);

class Link {
  constructor(sync, cfg, idx) {
    this.sync = sync;
    this.idx = idx;
    this.bit = 1 << idx;
    this.name = cfg.name;
    this.burst = cfg.burst;
    this.tokens = cfg.burst;
    this.q = [[], [], []];
    this.seen = new Map();
    this.seenInfo = false;
    this.lastMsg = 0;
    // try the address that worked last time first (e.g. the China endpoint for someone in China)
    const prefKey = 'px:url:' + cfg.name;
    let urls = cfg.urls;
    try {
      const pref = localStorage.getItem(prefKey);
      if (pref && urls.includes(pref)) urls = [pref, ...urls.filter((u) => u !== pref)];
    } catch {}
    this.client = new MqttClient(urls, {
      keepalive: 60,
      onMessage: (t, p, m) => sync._onMessage(this, t, p, m),
      onState: (s) => {
        if (s === 'up') try { localStorage.setItem(prefKey, this.client.url); } catch {}
        sync._onLinkState(this, s);
      },
      onConnect: () => sync._onConnect(this),
    });
    this.timer = setInterval(() => {
      if (this.tokens < this.burst) this.tokens++;
      this._drain();
    }, Math.round(1000 / cfg.rate));
  }

  get up() { return this.client.up; }
  get state() { return this.client.state; }

  /** queue a publish; retained publishes to the same topic coalesce */
  send(prio, rel, payload, opts) {
    const topic = this.sync.base + rel;
    return new Promise((resolve) => {
      const q = this.q[prio];
      if (opts.retain) {
        const j = q.findIndex((x) => x.topic === topic);
        if (j >= 0) {
          q[j].resolve(false);
          q.splice(j, 1);
        }
      }
      q.push({ topic, payload, opts, resolve, at: Date.now() });
      this._drain();
    });
  }

  _drain() {
    const now = Date.now();
    const q0 = this.q[0];
    while (q0.length && now - q0[0].at > 20000) q0.shift().resolve(false);
    if (!this.up) return;
    while (this.tokens > 0) {
      const job = this.q[0].shift() || this.q[1].shift() || this.q[2].shift();
      if (!job) return;
      this.tokens--;
      this.client.publish(job.topic, job.payload, job.opts).then(job.resolve);
    }
  }
}

export class Sync {
  constructor(store, kr, me, partner) {
    this.store = store;
    this.kr = kr;
    this.me = me;
    this.partner = partner;
    this.dev = store.dev;
    this.base = `px/${kr.room}/`;
    this.links = [];
    this.listeners = new Set();
    this.seen = new Map();
    this.presence = new Map();
    this.blobWait = new Map();
    this.hashes = new Map();
    this.cooldown = new Map();
    this.days = [];
    this.skew = 0;
    this.skewSamples = [];
    this.lastRx = 0;
    this.info = null;
    this.swept = false;
    this.sweeping = false;
    this.sweepState = null;
    this.blobOut = {};
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(type, data) {
    for (const fn of this.listeners) {
      try { fn(type, data); } catch (e) { console.error(e); }
    }
  }

  get online() { return this.links.some((l) => l.up); }
  status() { return this.links.map((l) => ({ name: l.name, state: l.state, url: l.client.url })); }

  async start() {
    const pendingBlobs = (await this.store.getMeta('blobOut')) || {};
    const shared = this._sharedBlobIds();
    this.blobOut = Object.fromEntries(Object.entries(pendingBlobs).filter(([id]) => shared.has(id)));
    LINKS.forEach((cfg, i) => this.links.push(new Link(this, cfg, i)));
    const willTopic = this.base + `p/${this.me}.${this.dev}`;
    this.days = this._dayFilters();
    for (const l of this.links) {
      l.client.setWill({ topic: willTopic, payload: EMPTY, qos: 1, retain: true });
      for (const f of ['s/#', 'l', 'p/#', 'i', ...this.days]) l.client.subscribe(this.base + f, 1);
      l.client.start();
    }
    this.store.onLocal = (r) => this.publishRecord(r);
    for (const r of this.store.dirtyRecs()) this.publishRecord(r);
    this._resumeBlobOut();
    this.tickTimer = setInterval(() => this._tick(), 30000);
    this.presTimer = setInterval(() => this.pubPresence(), 50000);
    document.addEventListener('visibilitychange', () => {
      this.pubPresence();
      if (document.visibilityState === 'visible') {
        this.kick();
        // phones freeze background tabs; a reconnect re-delivers today and yesterday,
        // but after a long absence the days in between have to be swept explicitly
        if (this.hiddenAt && Date.now() - this.hiddenAt > 20 * 3600e3) this._catchUp(this.hiddenAt);
        this.hiddenAt = 0;
      } else {
        this.hiddenAt = Date.now();
      }
    });
    addEventListener('online', () => this.kick());
    addEventListener('offline', () => this.kick());
    addEventListener('pagehide', () => this._leave());
    addEventListener('pageshow', (e) => {
      if (e.persisted) {
        this.kick();
        this.pubPresence();
      }
    });
  }

  kick() {
    for (const l of this.links) l.client.kick();
  }

  // ---------- topics ----------
  _dayFilters() {
    const now = Date.now();
    return [...new Set([utcDay(now - 864e5), utcDay(now)])].map((d) => `r/${d}/#`);
  }

  async _hash(k) {
    let h = this.hashes.get(k);
    if (!h) {
      h = await keyedHash(this.kr.salt, k, 20);
      this.hashes.set(k, h);
    }
    return h;
  }

  async _atag(who) {
    return this._hash('author/' + (who || '?')).then((h) => h.slice(0, 6));
  }

  /** s/<h> for state, r/YYYY/MM/DD/<author>/<h> for log records */
  async topicFor(r) {
    const h = await this._hash(r.k);
    if (STATE_COLS.has(r.c)) return `s/${h}`;
    return `r/${utcDay(r.t)}/${await this._atag(r.by)}/${h}`;
  }

  /**
   * Every few days, check that the brokers still hold what *I* wrote in the last
   * three weeks and put back anything that went missing (public brokers can lose data).
   */
  async _audit() {
    try {
      const last = (await this.store.getMeta('auditAt')) || 0;
      if (Date.now() - last < 3 * 864e5) return;
      const links = this.links.filter((l) => l.up);
      if (!links.length) return;
      const since = links.map((l) => l.client.connectedAt);
      const a = await this._atag(this.me);
      const days = [];
      for (let i = 2; i <= 21; i++) days.push(utcDay(Date.now() - i * 864e5));
      for (const d of days) await this._sweepOne(`r/${d}/${a}/#`);
      const daySet = new Set(days);
      let n = 0;
      for (const r of this.store.recs.values()) {
        if (r.by !== this.me || !r.tp || r.tp[0] !== 'r' || !daySet.has(r.tp.slice(2, 12))) continue;
        links.forEach((l, i) => {
          if (!l.up || l.client.connectedAt !== since[i]) return;
          const seenT = l.seen.get(r.tp);
          if (seenT == null || seenT < r.t) {
            this._republish(r, [l]);
            n++;
          }
        });
      }
      if (n) console.info(`[sync] audit restored ${n} records`);
      await this.store.setMeta('auditAt', Date.now());
    } catch (e) {
      console.warn('[sync] audit failed', e);
    }
  }

  _tick() {
    const nd = this._dayFilters();
    if (nd.join() !== this.days.join()) {
      for (const l of this.links) {
        for (const f of this.days) if (!nd.includes(f)) l.client.unsubscribe(this.base + f);
        for (const f of nd) if (!this.days.includes(f)) l.client.subscribe(this.base + f, 1);
      }
      this.days = nd;
    }
    if (this.swept && this.online) this.store.setMeta('lastSync', utcDay(Date.now()));
    const cut = Date.now() - 600000;
    for (const [id, t] of this.seen) if (t < cut) this.seen.delete(id);
    this.emit('presence');
  }

  // ---------- records ----------
  async publishRecord(r, only) {
    const tp = await this.topicFor(r);
    const payload = await seal(this.kr.key, tp, { c: r.c, i: r.i, t: r.t, d: r.d, by: r.by, x: r.x });
    if (payload.length > MAX_RETAINED) console.warn('[sync] record exceeds EMQX retained limit', r.k, payload.length);
    const ptp = r.ptp;
    const links = (only || this.links).filter((l) => r.dirty & l.bit);
    await Promise.all(
      links.map(async (l) => {
        const ok = await l.send(1, tp, payload, { qos: 1, retain: true });
        if (!ok) return;
        this.store.markClean(r.k, r.t, l.bit, tp);
        if (ptp && ptp !== tp && ptp[0] === 'r') l.send(2, ptp, EMPTY, { qos: 1, retain: true });
      }),
    );
  }

  async _republish(r, links) {
    if (!r.tp) return;
    const payload = await seal(this.kr.key, r.tp, { c: r.c, i: r.i, t: r.t, d: r.d, by: r.by, x: r.x });
    for (const l of links) l.send(2, r.tp, payload, { qos: 1, retain: true });
  }

  /** push every local record back to the brokers (after a broker wipe) */
  async repairAll() {
    const links = this.links.filter((l) => l.up);
    let n = 0;
    for (const r of this.store.recs.values()) {
      if (!r.tp) continue;
      await this._republish(r, links);
      n++;
    }
    for (const id of Object.keys(this.blobOut)) this._resumeOne(id);
    return n;
  }

  // ---------- message handling ----------
  async _onMessage(link, topic, payload, meta) {
    if (!topic.startsWith(this.base)) return;
    const rel = topic.slice(this.base.length);
    link.lastMsg = Date.now();
    const kind = rel[0];
    if (kind === 'r') this.lastRx = Date.now();
    if (kind === 'p') return this._onPresence(rel, payload, meta);
    if (!payload.length) return;
    if (kind === 'b') return this._onBlobChunk(rel, payload);
    const res = await unseal(this.kr.key, rel, payload);
    if (!res || !res.header) return;
    const h = res.header;
    if (kind === 's' || kind === 'r') {
      if (typeof h.c !== 'string' || typeof h.i !== 'string') return;
      const t = Number(h.t) || 0;
      const prev = link.seen.get(rel);
      if (prev == null || prev < t) link.seen.set(rel, t);
      const r = { k: `${h.c}/${h.i}`, c: h.c, i: h.i, t, d: h.d || '', by: h.by, x: h.x ?? null, tp: rel };
      this.store.apply(r, meta.retain ? 'sync' : 'live');
    } else if (kind === 'l') {
      if (!h.id || this.seen.has(h.id)) return;
      this.seen.set(h.id, Date.now());
      if (h.from === this.partner) this._skewSample(h.ts);
      if (h.dev === this.dev) return;
      if (h.e === 'need' && h.b) {
        this._serveBlob(h.b);
        return;
      }
      this.emit('live', h);
    } else if (kind === 'i') {
      link.seenInfo = true;
      if (h.created && (!this.info || h.created < this.info.created)) this.info = h;
    }
  }

  _onLinkState(link, s) {
    if (s !== 'up') link.seen = new Map();
    this.emit('net', { link: link.name, state: s });
  }

  _onConnect(link) {
    link.seen = new Map();
    link.seenInfo = false;
    link.lastMsg = Date.now();
    this.pubPresence(link);
    for (const w of this.blobWait.values()) {
      if (!w.subbed) continue;
      link.client.subscribeOnce([[this.base + `b/${w.id}/#`, 1]]);
    }
    this._repairSoon(link);
    if (!this.swept) this._sweep();
  }

  /** after the retained snapshot settles, re-publish what this broker is missing */
  async _repairSoon(link) {
    const t0 = Date.now();
    while (Date.now() - link.lastMsg < 2500 && Date.now() - t0 < 15000) await sleep(500);
    if (!link.up) return;
    const days = new Set(this.days.map((f) => f.slice(2, 12)));
    const missing = [];
    for (const r of this.store.recs.values()) {
      if (!r.tp || r.dirty & link.bit) continue;
      if (!(r.tp[0] === 's' || days.has(r.tp.slice(2, 12)))) continue;
      // state records are written by both sides: each side repairs only its own
      if (r.tp[0] === 's' && r.by !== this.me) continue;
      const seenT = link.seen.get(r.tp);
      if (seenT == null || seenT < r.t) missing.push(r);
    }
    for (const r of missing) await this._republish(r, [link]);
    if (missing.length) console.info(`[sync] repaired ${missing.length} records on ${link.name}`);
  }

  // ---------- catching up after being away ----------
  async _sweep() {
    if (this.sweeping || this.swept) return;
    this.sweeping = true;
    try {
      await sleep(2500);
      const last = await this.store.getMeta('lastSync');
      const now = Date.now();
      const todayD = utcDay(now);
      const yestD = utcDay(now - 864e5);
      const filters = [];
      const months = (fromTs) => {
        const d = new Date(fromTs);
        let y = d.getUTCFullYear();
        let m = d.getUTCMonth();
        const end = new Date(now);
        while (y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth())) {
          filters.push(`r/${y}/${String(m + 1).padStart(2, '0')}/#`);
          m++;
          if (m > 11) { m = 0; y++; }
        }
      };
      if (!last) {
        // brand-new room (no info anywhere yet): only look back a little
        const created = this.info?.created ? Date.parse(this.info.created + 'T00:00:00Z') : now - 40 * 864e5;
        months(Math.max(created - 864e5, now - 3 * 365 * 864e5));
      } else if (last < yestD) {
        const start = Date.parse(last.replace(/\//g, '-') + 'T00:00:00Z') - 864e5;
        if (!(start > 0)) months(now - 40 * 864e5);
        else if ((now - start) / 864e5 > 45) months(start);
        else for (let t = start, i = 0; utcDay(t) < yestD && i < 60; t += 864e5, i++) filters.push(`r/${utcDay(t)}/#`);
      }
      for (let i = 0; i < filters.length; i++) {
        this.sweepState = { total: filters.length, done: i };
        this.emit('sweep', this.sweepState);
        await this._sweepOne(filters[i]);
      }
      this.sweepState = null;
      if (filters.length) this.emit('sweep', null);
      if (this.online) {
        this.swept = true;
        await this.store.setMeta('lastSync', todayD);
        this._fixInfo();
        setTimeout(() => this._audit(), 20000);
      }
    } finally {
      this.sweeping = false;
    }
  }

  /** re-read retained records written since `since` (after the page was frozen) */
  async _catchUp(since) {
    if (this.catching) return;
    this.catching = true;
    try {
      for (let i = 0; i < 20 && !this.online; i++) await sleep(500);
      if (!this.online) return;
      const days = new Set();
      for (let t = since - 864e5; t <= Date.now() + 1000; t += 864e5) days.add(utcDay(t));
      // today and yesterday are permanent subscriptions (never unsubscribe those)
      const filters = [...days].map((d) => `r/${d}/#`).filter((f) => !this.days.includes(f));
      if (filters.length > 40) {
        this.swept = false;
        await this.store.setMeta('lastSync', utcDay(since));
        return this._sweep();
      }
      for (const f of filters) await this._sweepOne(f);
    } finally {
      this.catching = false;
    }
  }

  async _sweepOne(rel) {
    const links = this.links.filter((l) => l.up);
    if (!links.length || rel === 's/#' || this.days.includes(rel)) return;
    const topic = this.base + rel;
    this.lastRx = Date.now();
    await Promise.all(links.map((l) => l.client.subscribeOnce([[topic, 1]])));
    const t0 = Date.now();
    while (Date.now() - this.lastRx < 1500 && Date.now() - t0 < 30000) await sleep(250);
    await Promise.all(links.map((l) => l.client.unsubscribeMany([topic])));
  }

  async _fixInfo() {
    let first = Date.now();
    for (const r of this.store.recs.values()) if (r.t < first && r.t > 1.6e12) first = r.t;
    const mine = utcDay(first).replace(/\//g, '-');
    let targets = [];
    if (!this.info || mine < this.info.created) {
      this.info = { created: mine };
      targets = this.links;
    } else {
      targets = this.links.filter((l) => l.up && !l.seenInfo);
    }
    if (!targets.length) return;
    const payload = await seal(this.kr.key, 'i', this.info);
    for (const l of targets) l.send(2, 'i', payload, { qos: 1, retain: true });
  }

  // ---------- presence ----------
  async _onPresence(rel, payload, meta) {
    const key = rel.slice(2);
    if (!payload.length) {
      if (this.presence.delete(key)) this.emit('presence');
      return;
    }
    const res = await unseal(this.kr.key, rel, payload);
    if (!res || !res.header) return;
    const h = res.header;
    // retained copies can be minutes old, so only live ones say anything about clocks
    if (h.who === this.partner && !meta.retain) this._skewSample(h.ts);
    this.presence.set(key, h);
    this.emit('presence');
  }

  isOnline(who) {
    const now = Date.now();
    for (const p of this.presence.values()) {
      if (p.who !== who) continue;
      if (who === this.me && p.dev === this.dev) return true;
      const age = now - (p.ts - (who === this.partner ? this.skew : 0));
      if (age < 150000) return true;
    }
    return false;
  }

  async pubPresence(only) {
    const rel = `p/${this.me}.${this.dev}`;
    const payload = await seal(this.kr.key, rel, { who: this.me, dev: this.dev, ts: Date.now(), vis: document.visibilityState });
    for (const l of only ? [only] : this.links) if (l.up) l.send(0, rel, payload, { qos: 1, retain: true });
  }

  _leave() {
    for (const l of this.links) {
      if (l.up) l.client.publish(this.base + `p/${this.me}.${this.dev}`, EMPTY, { qos: 0, retain: true });
    }
  }

  _skewSample(ts) {
    if (!ts) return;
    this.skewSamples.push(ts - Date.now());
    if (this.skewSamples.length > 12) this.skewSamples.shift();
    const best = Math.max(...this.skewSamples);
    this.skew = Math.abs(best) > 1500 ? best : 0;
  }

  // ---------- live events ----------
  async sendLive(evt) {
    const h = { ...evt, id: uid(10), from: this.me, dev: this.dev, ts: Date.now() };
    this.seen.set(h.id, Date.now());
    const payload = await seal(this.kr.key, 'l', h);
    for (const l of this.links) l.send(0, 'l', payload, { qos: 0, retain: false });
    return h;
  }

  // ---------- blobs (images) ----------
  async putBlob(bytes, mime, local = false) {
    const id = await keyedHash(this.kr.salt, bytes, 24);
    await this.store.putBlob(id, { m: mime, b: bytes });
    if (local) return id;
    this.blobOut[id] = LINK_MASK;
    this._saveBlobOut();
    this._publishBlob(id, bytes, mime, this.links, true);
    return id;
  }

  _saveBlobOut() {
    clearTimeout(this.boTimer);
    this.boTimer = setTimeout(() => this.store.setMeta('blobOut', { ...this.blobOut }), 300);
  }

  async _publishBlob(id, bytes, mime, links, track) {
    const n = Math.max(1, Math.ceil(bytes.length / CHUNK));
    const jobs = links.map(() => []);
    for (let i = 0; i < n; i++) {
      const rel = `b/${id}/${i}`;
      const payload = await seal(this.kr.key, rel, { n, i, m: mime, s: bytes.length }, bytes.subarray(i * CHUNK, (i + 1) * CHUNK));
      links.forEach((l, j) => jobs[j].push(l.send(2, rel, payload, { qos: 1, retain: true })));
    }
    if (!track) return;
    links.forEach(async (l, j) => {
      const ok = (await Promise.all(jobs[j])).every(Boolean);
      if (ok && this.blobOut[id] != null) {
        this.blobOut[id] &= ~l.bit;
        if (!this.blobOut[id]) delete this.blobOut[id];
        this._saveBlobOut();
      }
    });
  }

  async _resumeOne(id) {
    const v = await this.store.getBlob(id);
    if (!v) {
      delete this.blobOut[id];
      this._saveBlobOut();
      return;
    }
    const mask = this.blobOut[id] || LINK_MASK;
    this._publishBlob(id, v.b, v.m, this.links.filter((l) => mask & l.bit), true);
  }

  _resumeBlobOut() {
    for (const id of Object.keys(this.blobOut)) this._resumeOne(id);
  }

  _sharedBlobIds() {
    const ids = new Set();
    for (const r of this.store.recs.values()) {
      if (r.c.startsWith('_') || !r.x || !Array.isArray(r.x.photos)) continue;
      for (const p of r.x.photos) if (!p.loc) {
        if (p.id) ids.add(p.id);
        if (p.th) ids.add(p.th);
      }
    }
    return ids;
  }

  /** After a key change, only re-upload images referenced by shared records. */
  async reshareAll() {
    this.blobOut = Object.fromEntries([...this._sharedBlobIds()].map((id) => [id, LINK_MASK]));
    // Called before start(); persist now so startup cannot overwrite the new queue.
    await this.store.setMeta('blobOut', { ...this.blobOut });
  }

  /** publish a blob that was stored locally only (e.g. a private note became shared) */
  shareBlob(id) {
    if (!id) return;
    this.blobOut[id] = LINK_MASK;
    this._saveBlobOut();
    this._resumeOne(id);
  }

  fetchBlob(id) {
    let w = this.blobWait.get(id);
    if (w) return w.promise;
    w = { id, parts: [], n: 0, got: 0, m: '' };
    w.promise = new Promise((res) => (w.resolve = res));
    this.blobWait.set(id, w);
    (async () => {
      const local = await this.store.getBlob(id);
      if (local) return this._blobDone(w, local);
      w.subbed = true;
      for (const l of this.links) if (l.up) l.client.subscribeOnce([[this.base + `b/${id}/#`, 1]]);
      w.t1 = setTimeout(() => {
        if (this.blobWait.get(id) === w) this.sendLive({ e: 'need', b: id });
      }, 8000);
      w.t2 = setTimeout(() => {
        if (this.blobWait.get(id) === w) this._blobDone(w, null);
      }, 30000);
    })();
    return w.promise;
  }

  _blobDone(w, val) {
    clearTimeout(w.t1);
    clearTimeout(w.t2);
    if (this.blobWait.get(w.id) === w) this.blobWait.delete(w.id);
    if (w.subbed) {
      const topic = this.base + `b/${w.id}/#`;
      for (const l of this.links) if (l.up) l.client.unsubscribeMany([topic]);
    }
    w.resolve(val);
  }

  async _onBlobChunk(rel, payload) {
    const [, id, si] = rel.split('/');
    const w = this.blobWait.get(id);
    if (!w) return;
    const i = Number(si);
    if (w.parts[i]) return;
    const res = await unseal(this.kr.key, rel, payload);
    if (!res || !res.bin || w.parts[i] || this.blobWait.get(id) !== w) return;
    w.parts[i] = res.bin;
    w.n = res.header.n;
    w.m = res.header.m;
    w.got++;
    if (w.got < w.n) return;
    let total = 0;
    for (const p of w.parts) total += p.length;
    const bytes = new Uint8Array(total);
    let o = 0;
    for (const p of w.parts) {
      bytes.set(p, o);
      o += p.length;
    }
    // every chunk is authenticated by AES-GCM (topic bound as AAD), so the bytes are genuine
    const val = { m: w.m, b: bytes };
    await this.store.putBlob(id, val);
    this._blobDone(w, val);
  }

  async _serveBlob(id) {
    if (!this._sharedBlobIds().has(id)) return;
    if (Date.now() - (this.cooldown.get(id) || 0) < 60000) return;
    const v = await this.store.getBlob(id);
    if (!v) return;
    this.cooldown.set(id, Date.now());
    this._publishBlob(id, v.b, v.m, this.links.filter((l) => l.up), false);
  }
}
