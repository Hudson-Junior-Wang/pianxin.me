// 偏心我 · app-wide context: identity, stickers, reactive hooks, toasts, sounds.

import { useState, useEffect } from '../vendor/hooks.js';
import { localZone, validZone, zoneParts } from './time.js?v=2b526ea3b9';
import { emojiText } from './pictograms.js?v=2b526ea3b9';

export const WHO = ['zhengwang', 'xiaoha'];
export const DEFAULT_PROFILE = {
  zhengwang: { name: '小郑王', ch: 'bunny', roleV: 2 },
  xiaoha: { name: '小哈森', ch: 'bear', roleV: 2 },
};

export const app = {
  me: '',
  partner: '',
  store: null,
  sync: null,
  quiet: false,
  focus: false,
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

/** open the chat wherever it lives on this screen size */
export const openChat = () => bus.emit('chat:open');

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
    const wait = () => {
      const ph = ((((anchor || 0) - Date.now()) % 1000) + 1000) % 1000;
      return (ph || 1000) + 8;
    };
    const loop = () => {
      setNow(Date.now());
      t = setTimeout(loop, wait());
    };
    t = setTimeout(loop, wait());
    return () => clearTimeout(t);
  }, [anchor]);
  return now;
}

export function useMedia(q) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return m;
}

// ---------- people ----------
export function profileOf(who) {
  const p = { ...DEFAULT_PROFILE[who], ...((app.store && app.store.get('profile', who)) || {}) };
  // Old profiles saved the URL identifier as their default name. Keep custom nicknames.
  if (!p.name || p.name === who) p.name = DEFAULT_PROFILE[who]?.name || who;
  const saved = app.store?.get('profile', who);
  if (saved && saved.roleV !== 2 && !saved.chCustom) p.ch = DEFAULT_PROFILE[who]?.ch || p.ch;
  return p;
}
export const nameOf = (who) => profileOf(who).name || who;
export const myName = () => nameOf(app.me);
export const taName = () => nameOf(app.partner);

// ---------- stickers (小熊 & 小兔) ----------
const KEYS = ['hi', 'cheer', 'ok', 'okay', 'thanks', 'what', 'study', 'read', 'done', 'idea', 'tea', 'eat', 'run', 'yawn', 'sleep', 'morning',
  'poke', 'pat', 'listen', 'salute', 'dizzy', 'pout', 'facepalm', 'sorry', 'cry'];
export const CHARS = {
  bear: { p: 'b', name: '小熊', keys: KEYS },
  bunny: { p: 'r', name: '小兔', keys: [...KEYS, 'gym'] },
};
export const ST_LABEL = {
  hi: '嗨', cheer: '冲呀', ok: '棒', okay: 'OK', thanks: '谢谢', what: '啊？', study: '学习中', read: '看书', done: '搞定',
  idea: '有了', tea: '喝奶茶', eat: '干饭', run: '跑起来', gym: '举铁', yawn: '好困', sleep: '晚安', morning: '早安',
  poke: '戳', pat: '拍拍', listen: '我在听', salute: '收到', dizzy: '晕了', pout: '哼', facepalm: '无语', sorry: '抱歉', cry: '哭哭',
};
const DUO_LABEL = {
  'd-study': '一起学习', 'd-five': '击掌', 'd-eat': '一起干饭', 'd-movie': '看电影', 'd-run': '一起跑',
  'd-pat': '拍拍', 'd-yay': '耶', 'd-listen': '听你说', 'd-tired': '累瘫',
};
export const DUO = Object.keys(DUO_LABEL);

export function chOf(who) {
  const ch = profileOf(who).ch;
  return CHARS[ch] ? ch : DEFAULT_PROFILE[who]?.ch || 'bear';
}
/** sticker id for a person: stId('zhengwang', 'cheer') → 'r-cheer'; duo ids pass through */
export function stId(who, key) {
  if (!key) return '';
  if (key.startsWith('d-')) return key;
  const c = CHARS[chOf(who)];
  return `${c.p}-${c.keys.includes(key) ? key : 'hi'}`;
}
export const avId = (who) => (chOf(who) === 'bunny' ? 'av-bunny' : 'av-bear');
export const isSt = (s) => typeof s === 'string' && /^(?:[bdr]|av)-[a-z]+$/.test(s);
export const stUrl = (id) => `/app/stickers/${id}.webp`;
export function stLabel(id) {
  if (!isSt(id)) return '';
  if (id.startsWith('d-')) return DUO_LABEL[id] || '';
  return ST_LABEL[id.slice(2)] || '';
}
export function stickersOf(who) {
  const c = CHARS[chOf(who)];
  return c.keys.map((k) => `${c.p}-${k}`);
}

/** a gentle edge toast on the other person's screen (live only, never stored) */
export function liveToast(icon, text, extra = {}) {
  if (app.sync) app.sync.sendLive({ e: 'toast', icon, text, ...extra });
}

// reactions: one sticker per person per target, toggled
export function setReaction(target, e) {
  const id = `${target}~${app.me}`;
  const cur = app.store.get('react', id);
  app.store.put('react', id, cur && cur.e === e ? null : { t: target, who: app.me, e });
}

// ---------- moods & needs ----------
export const MOODS = [
  { k: 'happy', label: '开心', st: 'cheer' },
  { k: 'fresh', label: '元气满满', st: 'morning' },
  { k: 'calm', label: '平静', st: 'thanks' },
  { k: 'focus', label: '在专注', st: 'study' },
  { k: 'great', label: '超顺利', st: 'ok' },
  { k: 'hungry', label: '饿了', st: 'eat' },
  { k: 'sleepy', label: '困困', st: 'yawn' },
  { k: 'sleeping', label: '休息中', st: 'sleep' },
  { k: 'tired', label: '累了', st: 'sorry' },
  { k: 'busy', label: '忙炸了', st: 'dizzy' },
  { k: 'annoyed', label: '烦躁', st: 'pout' },
  { k: 'sad', label: '难过', st: 'cry' },
  { k: 'meh', label: '说不清', st: 'what' },
];
// Historical moods retain their original meaning/value; only new choices use the neutral list.
const OLD_MOODS = [
  ['😊', '开心', 'cheer'], ['🥰', '甜甜的', 'cheer'], ['😌', '平静', 'thanks'], ['🤩', '兴奋', 'ok'],
  ['😴', '困困', 'yawn'], ['🥱', '累了', 'sorry'], ['😤', '烦躁', 'pout'], ['😢', '难过', 'cry'],
  ['🤒', '不舒服', 'sorry'], ['🤯', '忙炸了', 'dizzy'], ['😶', '说不清', 'what'], ['🥺', '想你', 'hi'],
].map(([k, label, st]) => ({ k, label, st, legacy: true }));
export const moodOf = (k) => MOODS.find((m) => m.k === k) || OLD_MOODS.find((m) => m.k === k);

export const NEEDS = [
  { k: 'chat', label: '想聊天', st: 'hi' },
  { k: 'bored', label: '好无聊', st: 'yawn' },
  { k: 'hungry', label: '我饿了', st: 'eat' },
  { k: 'craving', label: '好馋啊', st: 'tea' },
];
// Keep existing selections meaningful, including the explicit quiet-mode behavior.
const OLD_NEEDS = [
  { k: 'quiet', label: '想安静', st: 'read', hint: '想安静一会儿，消息不会响', ta: '想安静一会儿，消息不会吵到 TA' },
  { k: 'comfort', label: '求安慰', st: 'cry', hint: '需要一点安慰', ta: '现在需要一点安慰' },
  { k: 'vent', label: '只想吐槽', st: 'pout', hint: '只想吐槽，听着就好', ta: '只想吐槽，听着就好，不用讲道理' },
];
export const NEED_TAG_LIMIT = 12;
export const NEED_TAG_LENGTH = 20;
/** Choices belong to the person's status record, so they sync atomically with the selection. */
export function needTagsOf(status) {
  const source = Array.isArray(status?.needTags) ? status.needTags : NEEDS;
  const keys = new Set(), labels = new Set(), out = [];
  for (const tag of source.slice(0, NEED_TAG_LIMIT)) {
    if (!tag || typeof tag.k !== 'string' || !/^[a-z][a-z0-9_-]{0,80}$/i.test(tag.k) || typeof tag.label !== 'string') continue;
    const label = tag.label.replace(/\s+/g, ' ').trim().slice(0, NEED_TAG_LENGTH);
    if (!label || keys.has(tag.k) || labels.has(label.toLowerCase())) continue;
    keys.add(tag.k); labels.add(label.toLowerCase()); out.push({ k: tag.k, label });
  }
  return out;
}
export function needOf(status) {
  if (!status?.need) return null;
  const choice = needTagsOf(status).find((n) => n.k === status.need);
  const known = NEEDS.find((n) => n.k === status.need) || OLD_NEEDS.find((n) => n.k === status.need);
  if (choice) return known?.label === choice.label ? known : { ...choice, st: 'hi', custom: true };
  return known || null;
}

// ---------- local clocks: IANA zone handles DST even while the other person is offline ----------
export function syncTimezone() {
  const zone = localZone(), o = new Date().getTimezoneOffset();
  const old = app.store.get('tz', app.me);
  if (old?.zone !== zone || old?.o !== o) app.store.put('tz', app.me, { zone, o, at: Date.now() });
}
export function zoneOf(who) {
  if (who === app.me) return localZone();
  const z = app.store?.get('tz', who)?.zone;
  return validZone(z) ? z : '';
}
function personParts(who, ts = Date.now()) {
  const zone = zoneOf(who);
  if (zone) return zoneParts(ts, zone);
  const o = app.store?.get('tz', who)?.o;
  if (o != null) return zoneParts(ts - o * 60000, 'UTC');
  return null;
}
export function dayOf(who) {
  return personParts(who)?.day || zoneParts().day;
}
export const timeOf = (who) => personParts(who)?.time || '';
export function localDayLabel(who, day) {
  const current = personParts(who)?.day;
  return `${day}${current === day ? ' · 当地今天' : ''}`;
}

// ---------- toasts ----------
let toastList = [];
const toastSubs = new Set();
const pushToasts = () => toastSubs.forEach((f) => f(toastList));
export function dismissToast(id) {
  toastList = toastList.filter((x) => x.id !== id);
  pushToasts();
}
/** icon: sticker ID; historical emoji IDs are illustrated at render time. */
export function toast(text, { icon = stId(app.me, 'idea'), ms = 4200, kind = '', action = null } = {}) {
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
  if (app.store?.get('status', app.me)?.need === 'quiet') return;
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

export function notify(title, body, timer = false) {
  if (!app.settings.notify || (app.quiet && !timer) || app.store?.get('status', app.me)?.need === 'quiet') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try { new Notification(emojiText(title), { body: emojiText(body), tag: 'pianxin-' + Date.now(), icon: '/app/icons/icon-192-v3.png' }); } catch {}
}
