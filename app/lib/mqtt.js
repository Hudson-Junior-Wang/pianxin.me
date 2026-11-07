// 偏心我 · a tiny dependency-free MQTT 3.1.1 client over WebSocket.
// Works in browsers and in Node >= 22 (global WebSocket).
// Accepts several equivalent URLs and races them; the first socket to open wins.

const te = new TextEncoder();
const td = new TextDecoder();

const T = {
  CONNECT: 1, CONNACK: 2, PUBLISH: 3, PUBACK: 4, PUBREC: 5, PUBREL: 6, PUBCOMP: 7,
  SUBSCRIBE: 8, SUBACK: 9, UNSUBSCRIBE: 10, UNSUBACK: 11, PINGREQ: 12, PINGRESP: 13, DISCONNECT: 14,
};

function varLen(n) {
  const out = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 0x80;
    out.push(b);
  } while (n > 0);
  return out;
}

const u16 = (n) => Uint8Array.of((n >> 8) & 0xff, n & 0xff);

function utf8(s) {
  const b = te.encode(s);
  const out = new Uint8Array(2 + b.length);
  out[0] = b.length >> 8;
  out[1] = b.length & 0xff;
  out.set(b, 2);
  return out;
}

function join(parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function pkt(type, flags, parts = []) {
  const body = join(parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p))));
  return join([Uint8Array.of((type << 4) | flags, ...varLen(body.length)), body]);
}

export function toBytes(v) {
  if (v == null) return new Uint8Array(0);
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  return te.encode(String(v));
}

function shut(ws) {
  if (!ws) return;
  ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
  try { ws.close(); } catch {}
}

export class MqttClient {
  /**
   * @param {string|string[]} urls wss://host:port/path (several = raced)
   * @param {object} o
   */
  constructor(urls, o = {}) {
    this.urls = Array.isArray(urls) ? urls : [urls];
    this.url = '';
    this.clientId = o.clientId || 'px' + Math.random().toString(36).slice(2, 14);
    this.keepalive = o.keepalive ?? 25;
    this.username = o.username ?? null;
    this.password = o.password ?? null;
    this.will = o.will || null; // { topic, payload, qos, retain }
    this.onMessage = o.onMessage || (() => {});
    this.onState = o.onState || (() => {});
    this.onConnect = o.onConnect || (() => {});
    this.state = 'idle'; // idle | connecting | up | down | stopped
    this.subs = new Map(); // filter -> qos (re-subscribed automatically)
    this.inflight = new Map(); // pid -> { topic, payload, retain, resolve }
    this.waiters = new Map(); // pid -> resolve (SUBACK / UNSUBACK)
    this.pid = 0;
    this.retries = 0;
    this.lastRx = 0;
    this.ws = null;
    this.cands = [];
    this.attempt = 0;
    this.rx = new Uint8Array(0);
    this.stopped = true;
    this.connectedAt = 0;
  }

  get up() { return this.state === 'up'; }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this._open();
  }

  stop() {
    this.stopped = true;
    this.attempt++;
    clearTimeout(this.retryTimer);
    clearTimeout(this.connGuard);
    clearInterval(this.pingTimer);
    clearTimeout(this.probeTimer);
    const ws = this.ws;
    this.ws = null;
    for (const c of this.cands) if (c !== ws) shut(c);
    this.cands = [];
    if (ws) {
      try { if (ws.readyState === 1) ws.send(pkt(T.DISCONNECT, 0)); } catch {}
      shut(ws);
    }
    for (const [, p] of this.inflight) p.resolve(false);
    this.inflight.clear();
    for (const [, w] of this.waiters) w(null);
    this.waiters.clear();
    this._set('stopped');
  }

  /** Reconnect now if down; if up, verify the link is alive. */
  kick() {
    if (this.stopped) return;
    if (this.state === 'down' || this.state === 'idle') {
      clearTimeout(this.retryTimer);
      this.retries = 0;
      this._open();
    } else if (this.state === 'up') {
      const before = this.lastRx;
      this._send(pkt(T.PINGREQ, 0));
      clearTimeout(this.probeTimer);
      this.probeTimer = setTimeout(() => {
        if (this.state === 'up' && this.lastRx === before) this._lost(this.ws, new Error('probe timeout'));
      }, 6000);
    }
  }

  setWill(will) { this.will = will; }

  publish(topic, payload, { qos = 0, retain = false } = {}) {
    const data = toBytes(payload);
    if (qos === 0) {
      if (!this.up) return Promise.resolve(false);
      return Promise.resolve(this._send(this._pubPkt(topic, data, 0, retain, 0, false)));
    }
    const pid = this._nextPid();
    return new Promise((resolve) => {
      this.inflight.set(pid, { topic, payload: data, retain, resolve });
      if (this.up) this._send(this._pubPkt(topic, data, 1, retain, pid, false));
    });
  }

  subscribe(filter, qos = 0) {
    this.subs.set(filter, qos);
    if (this.up) return this._sendSub([[filter, qos]]);
    return Promise.resolve(null);
  }

  /** Subscribe without remembering the filters for automatic re-subscription. */
  subscribeOnce(list) {
    if (!this.up || !list.length) return Promise.resolve(null);
    const jobs = [];
    for (let i = 0; i < list.length; i += 12) jobs.push(this._sendSub(list.slice(i, i + 12)));
    return Promise.all(jobs).then((r) => (r.some((x) => x == null) ? null : r.flat()));
  }

  unsubscribeMany(filters) {
    if (!this.up || !filters.length) return Promise.resolve(null);
    const pid = this._nextPid();
    return new Promise((res) => {
      this.waiters.set(pid, res);
      if (!this._send(pkt(T.UNSUBSCRIBE, 2, [u16(pid), ...filters.map(utf8)]))) { this.waiters.delete(pid); res(null); }
    });
  }

  unsubscribe(filter) {
    if (!this.subs.delete(filter)) return Promise.resolve(null);
    return this.unsubscribeMany([filter]);
  }

  // ---------- internals ----------
  _set(state, err) {
    if (this.state === state) return;
    this.state = state;
    try { this.onState(state, err); } catch (e) { console.error(e); }
  }

  _nextPid() {
    for (let i = 0; i < 65535; i++) {
      this.pid = (this.pid % 65535) + 1;
      if (!this.inflight.has(this.pid) && !this.waiters.has(this.pid)) return this.pid;
    }
    throw new Error('mqtt: no free packet id');
  }

  _send(bytes) {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(bytes); return true; } catch { return false; }
  }

  _open() {
    clearTimeout(this.retryTimer);
    if (this.stopped) return;
    this._set('connecting');
    this.rx = new Uint8Array(0);
    const attempt = ++this.attempt;
    let left = this.urls.length;
    let won = false;
    const cands = [];
    this.cands = cands;
    const dead = new Set();
    const fail = (ws, err) => {
      if (attempt !== this.attempt) return;
      if (ws && dead.has(ws)) return;
      if (ws) dead.add(ws);
      if (won) { if (ws === this.ws) this._lost(ws, err); return; }
      left--;
      if (left <= 0) this._lost(null, err);
    };
    clearTimeout(this.connGuard);
    this.connGuard = setTimeout(() => {
      if (attempt !== this.attempt || this.state === 'up') return;
      for (const c of cands) if (c !== this.ws) shut(c);
      if (this.ws) this._lost(this.ws, new Error('connect timeout'));
      else this._lost(null, new Error('connect timeout'));
    }, 15000);
    // "happy eyeballs": try the first address, start the next one only if it is slow or fails
    let next = 0;
    let stagger = null;
    const launch = () => {
      clearTimeout(stagger);
      if (attempt !== this.attempt || won || next >= this.urls.length) return;
      const url = this.urls[next++];
      if (next < this.urls.length) stagger = setTimeout(launch, 3500);
      let ws;
      try {
        ws = new WebSocket(url, ['mqtt']);
      } catch (e) {
        fail(null, e);
        launch();
        return;
      }
      ws.binaryType = 'arraybuffer';
      cands.push(ws);
      ws.onopen = () => {
        if (attempt !== this.attempt || won) { shut(ws); return; }
        won = true;
        clearTimeout(stagger);
        this.ws = ws;
        this.url = url;
        for (const c of cands) if (c !== ws) shut(c);
        try { ws.send(this._connectPkt()); } catch (e) { fail(ws, e); }
      };
      ws.onmessage = (e) => {
        if (this.ws !== ws) return;
        const d = e.data;
        if (d instanceof ArrayBuffer) this._rx(new Uint8Array(d));
        else if (ArrayBuffer.isView(d)) this._rx(new Uint8Array(d.buffer, d.byteOffset, d.byteLength));
      };
      const onFail = (err) => {
        if (dead.has(ws)) return;
        fail(ws, err);
        if (!won) launch();
      };
      ws.onerror = () => onFail(new Error('socket error'));
      ws.onclose = (e) => onFail(new Error('socket closed ' + (e && e.code)));
    };
    launch();
  }

  _lost(ws, err) {
    if (ws && this.ws !== ws) return;
    if (!ws && this.ws) return;
    clearTimeout(this.connGuard);
    if (ws) shut(ws);
    for (const c of this.cands) shut(c);
    this.cands = [];
    this.ws = null;
    this.attempt++;
    clearInterval(this.pingTimer);
    clearTimeout(this.probeTimer);
    for (const [pid, w] of this.waiters) { this.waiters.delete(pid); w(null); }
    if (this.stopped) return;
    this._set('down', err);
    const base = Math.min(30000, 1000 * 2 ** Math.min(this.retries, 5));
    this.retries++;
    this.retryTimer = setTimeout(() => this._open(), base * (0.6 + Math.random() * 0.4));
  }

  _connectPkt() {
    let flags = 0x02; // clean session
    const payload = [utf8(this.clientId)];
    if (this.will) {
      const w = this.will;
      flags |= 0x04 | ((w.qos || 0) << 3) | (w.retain ? 0x20 : 0);
      const wp = toBytes(w.payload);
      payload.push(utf8(w.topic), u16(wp.length), wp);
    }
    if (this.username != null) { flags |= 0x80; payload.push(utf8(this.username)); }
    if (this.password != null) { flags |= 0x40; payload.push(utf8(this.password)); }
    return pkt(T.CONNECT, 0, [utf8('MQTT'), [4, flags], u16(this.keepalive), ...payload]);
  }

  _pubPkt(topic, data, qos, retain, pid, dup) {
    const flags = (dup ? 8 : 0) | (qos << 1) | (retain ? 1 : 0);
    const parts = [utf8(topic)];
    if (qos > 0) parts.push(u16(pid));
    parts.push(data);
    return pkt(T.PUBLISH, flags, parts);
  }

  _sendSub(list) {
    const pid = this._nextPid();
    const parts = [u16(pid)];
    for (const [f, q] of list) parts.push(utf8(f), [q]);
    return new Promise((res) => {
      this.waiters.set(pid, res);
      if (!this._send(pkt(T.SUBSCRIBE, 2, parts))) { this.waiters.delete(pid); res(null); }
    });
  }

  _rx(chunk) {
    const buf = this.rx.length ? join([this.rx, chunk]) : chunk;
    let off = 0;
    while (buf.length - off >= 2) {
      let mul = 1, len = 0, i = off + 1, b, complete = false;
      while (i < buf.length) {
        b = buf[i++];
        len += (b & 0x7f) * mul;
        if (!(b & 0x80)) { complete = true; break; }
        mul *= 128;
        if (mul > 2097152) { this._lost(this.ws, new Error('bad remaining length')); return; }
      }
      if (!complete || buf.length < i + len) break;
      const header = buf[off];
      const body = buf.subarray(i, i + len);
      off = i + len;
      this.lastRx = Date.now();
      try { this._handle(header >> 4, header & 0x0f, body); } catch (e) { console.error('mqtt', e); }
      if (!this.ws) return;
    }
    this.rx = off < buf.length ? buf.slice(off) : new Uint8Array(0);
  }

  _handle(type, flags, body) {
    switch (type) {
      case T.CONNACK: {
        if (body[1] !== 0) { this._lost(this.ws, new Error('connack ' + body[1])); return; }
        clearTimeout(this.connGuard);
        this.retries = 0;
        this.connectedAt = Date.now();
        this._set('up');
        const subs = [...this.subs];
        for (let i = 0; i < subs.length; i += 12) this._sendSub(subs.slice(i, i + 12));
        for (const [pid, p] of this.inflight) this._send(this._pubPkt(p.topic, p.payload, 1, p.retain, pid, true));
        clearInterval(this.pingTimer);
        // ping regularly and expect an answer within 10s, so a dead link is noticed in < 40s
        this.pingTimer = setInterval(() => {
          if (!this.up) return;
          if (Date.now() - this.lastRx > this.keepalive * 1500 + 4000) {
            this._lost(this.ws, new Error('keepalive timeout'));
            return;
          }
          const before = this.lastRx;
          const ws = this.ws;
          this._send(pkt(T.PINGREQ, 0));
          clearTimeout(this.probeTimer);
          this.probeTimer = setTimeout(() => {
            if (this.ws === ws && this.state === 'up' && this.lastRx === before) this._lost(ws, new Error('ping timeout'));
          }, 10000);
        }, Math.min(25000, Math.max(4000, this.keepalive * 400)));
        try { this.onConnect(); } catch (e) { console.error(e); }
        break;
      }
      case T.PUBLISH: {
        const qos = (flags >> 1) & 3;
        const retain = !!(flags & 1);
        const tl = (body[0] << 8) | body[1];
        const topic = td.decode(body.subarray(2, 2 + tl));
        let p = 2 + tl;
        if (qos > 0) {
          const pid = (body[p] << 8) | body[p + 1];
          p += 2;
          this._send(pkt(qos === 1 ? T.PUBACK : T.PUBREC, 0, [u16(pid)]));
        }
        const payload = body.slice(p);
        try { this.onMessage(topic, payload, { retain, qos }); } catch (e) { console.error(e); }
        break;
      }
      case T.PUBREL: {
        this._send(pkt(T.PUBCOMP, 0, [body.subarray(0, 2)]));
        break;
      }
      case T.PUBACK: {
        const pid = (body[0] << 8) | body[1];
        const p = this.inflight.get(pid);
        if (p) { this.inflight.delete(pid); p.resolve(true); }
        break;
      }
      case T.SUBACK:
      case T.UNSUBACK: {
        const pid = (body[0] << 8) | body[1];
        const w = this.waiters.get(pid);
        if (w) { this.waiters.delete(pid); w(Array.from(body.subarray(2))); }
        break;
      }
      default:
        break; // PINGRESP and others only refresh lastRx
    }
  }
}
