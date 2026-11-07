// 偏心我 · app-wide context: identity, reactive hooks, toasts, sounds.

import { useState, useEffect } from '../vendor/hooks.js';

export const WHO = ['zhengwang', 'xiaoha'];
export const DEFAULT_PROFILE = {
  zhengwang: { name: 'zhengwang', avatar: '🐻' },
  xiaoha: { name: 'xiaoha', avatar: '🐰' },
};

export const app = {
  me: '',
  partner: '',
  store: null,
  sync: null,
  quiet: false,
  settings: { sound: true, notify: false },
};

export function loadSettings() {
  try {
    Object.assign(app.settings, JSON.parse(localStorage.getItem(`px:${app.me}:settings`) || '{}'));
  } catch {}
}
export function saveSettings(patch) {
  Object.assign(app.settings, patch);
  try { localStorage.setItem(`px:${app.me}:settings`, JSON.stringify(app.settings)); } catch {}
  bus.emit('settings');
}

// ---------- tiny event bus ----------
const handlers = new Map();
export const bus = {
  on(type, fn) {
    let s = handlers.get(type);
    if (!s) handlers.set(type, (s = new Set()));
    s.add(fn);
    return () => s.delete(fn);
  },
  emit(type, data) {
    const s = handlers.get(type);
    if (s) for (const fn of [...s]) {
      try { fn(data); } catch (e) { console.error(e); }
    }
  },
};

// ---------- reactive hooks ----------
export function useForce() {
  const [, set] = useState(0);
  return () => set((v) => v + 1);
}

/** re-render when any of the collections change; returns a version counter */
export function useCols(cols) {
  const [ver, setVer] = useState(0);
  const key = Array.isArray(cols) ? cols.join('|') : cols;
  useEffect(() => {
    const want = key.split('|');
    return app.store.onCols((changed) => {
      if (want.some((c) => changed.has(c))) setVer((v) => v + 1);
    });
  }, [key]);
  return ver;
}

export function useRec(col, id) {
  useCols(col);
  return app.store.get(col, id);
}

export function useList(col, filter) {
  useCols(col);
  return app.store.list(col, filter);
}

export function useSyncEvent(types) {
  const force = useForce();
  const key = Array.isArray(types) ? types.join('|') : types;
  useEffect(() => {
    const want = key.split('|');
    return app.sync.on((t) => {
      if (want.includes(t)) force();
    });
  }, [key]);
}

export function useBus(type, fn, deps = []) {
  useEffect(() => bus.on(type, fn), deps);
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** re-render exactly when a countdown anchored at `anchor` (ms) crosses a whole second */
export function useSecondTick(anchor) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let t;
    const loop = () => {
      const n = Date.now();
      setNow(n);
      const ph = ((((anchor || 0) - n) % 1000) + 1000) % 1000;
      t = setTimeout(loop, (ph || 1000) + 8);
    };
    const n = Date.now();
    const ph = ((((anchor || 0) - n) % 1000) + 1000) % 1000;
    t = setTimeout(loop, (ph || 1000) + 8);
    return () => clearTimeout(t);
  }, [anchor]);
  return now;
}

export function useMedia(q) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return m;
}

// ---------- people ----------
export function profileOf(who) {
  return { ...DEFAULT_PROFILE[who], ...(app.store.get('profile', who) || {}) };
}
export const nameOf = (who) => profileOf(who).name || who;
export const avatarOf = (who) => profileOf(who).avatar || '🙂';
export const myName = () => nameOf(app.me);
export const taName = () => nameOf(app.partner);

/** a gentle edge toast on the other person's screen (live only, never stored) */
export function liveToast(icon, text, extra = {}) {
  if (app.sync) app.sync.sendLive({ e: 'toast', icon, text, ...extra });
}

// reactions: one emoji per person per target, toggled
export function setReaction(target, e) {
  const id = `${target}~${app.me}`;
  const cur = app.store.get('react', id);
  app.store.put('react', id, cur && cur.e === e ? null : { t: target, who: app.me, e });
}

// ---------- moods & needs ----------
export const MOODS = [
  ['😊', '开心'], ['🥰', '甜甜的'], ['😌', '平静'], ['🤩', '兴奋'],
  ['😴', '困困'], ['🥱', '累了'], ['😤', '烦躁'], ['😢', '难过'],
  ['🤒', '不舒服'], ['🤯', '忙炸了'], ['😶', '说不清'], ['🥺', '想你'],
];
export const NEEDS = [
  { k: 'chat', label: '想聊天', icon: '💬', hint: '想聊天！快来找我', ta: 'TA 想聊天，去找 TA 说说话吧' },
  { k: 'quiet', label: '想安静', icon: '🤫', hint: '想安静一会儿，消息不会响', ta: 'TA 想安静一会儿，消息不会吵到 TA' },
  { k: 'comfort', label: '求安慰', icon: '🫂', hint: '需要一点安慰', ta: 'TA 现在需要抱抱和安慰' },
  { k: 'vent', label: '只想吐槽', icon: '😮‍💨', hint: '只想吐槽，听着就好', ta: 'TA 只想吐槽，听着就好，不用讲道理' },
];

// ---------- the other person's local day / time ----------
function shifted(who) {
  const o = app.store.get('tz', who)?.o;
  if (o == null || who === app.me) return null;
  return new Date(Date.now() - o * 60000);
}
export function dayOf(who) {
  const d = shifted(who);
  if (!d) {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
/** "HH:MM" in the other person's timezone, or '' when it matches ours */
export function timeOf(who) {
  const o = app.store.get('tz', who)?.o;
  if (o == null || who === app.me || o === new Date().getTimezoneOffset()) return '';
  const d = new Date(Date.now() - o * 60000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// ---------- toasts ----------
let toastList = [];
const toastSubs = new Set();
const pushToasts = () => toastSubs.forEach((f) => f(toastList));
export function dismissToast(id) {
  toastList = toastList.filter((x) => x.id !== id);
  pushToasts();
}
export function toast(text, { icon = '💗', ms = 4200, kind = '', action = null } = {}) {
  // the same message twice in a row just refreshes the existing toast
  const dup = toastList.find((x) => x.text === text);
  if (dup) toastList = toastList.filter((x) => x !== dup);
  const t = { id: Math.random().toString(36).slice(2), text, icon, kind, action };
  toastList = [...toastList, t].slice(-4);
  pushToasts();
  setTimeout(() => dismissToast(t.id), action ? Math.max(ms, 9000) : ms);
}
export function useToasts() {
  const [l, set] = useState(toastList);
  useEffect(() => {
    toastSubs.add(set);
    return () => toastSubs.delete(set);
  }, []);
  return l;
}

// ---------- sound / vibration / notifications ----------
let actx = null;
function audio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
  }
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
addEventListener('pointerdown', () => { try { audio(); } catch {} }, { once: true, passive: true });

const TUNES = {
  soft: [[988, 0], [1319, 0.11]],
  poke: [[660, 0], [880, 0.09], [660, 0.18]],
  bell: [[784, 0], [988, 0.16], [1175, 0.32]],
  end: [[1047, 0], [880, 0.16], [784, 0.32], [1047, 0.5]],
  start: [[587, 0], [784, 0.14]],
};
export function chime(kind = 'soft', force = false) {
  if (!app.settings.sound) return;
  if (app.quiet && !force) return;
  try {
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime + 0.02;
    for (const [f, dt] of TUNES[kind] || TUNES.soft) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + dt);
      g.gain.linearRampToValueAtTime(0.09, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.6);
      o.connect(g).connect(ac.destination);
      o.start(t0 + dt);
      o.stop(t0 + dt + 0.65);
    }
  } catch {}
}

export function vibrate(p) {
  try { if (navigator.vibrate) navigator.vibrate(p); } catch {}
}

export function notify(title, body) {
  if (!app.settings.notify || app.quiet) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try { new Notification(title, { body, tag: 'pianxin-' + Date.now(), icon: '/app/icon-192.png' }); } catch {}
}
