// 偏心我 · small helpers

export const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
export const pad2 = (n) => String(n).padStart(2, '0');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const cx = (...a) => a.filter(Boolean).join(' ');

const ABC = '0123456789abcdefghijklmnopqrstuvwxyz';
export function uid(n = 10) {
  const a = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const b of a) s += ABC[b % 36];
  return s;
}

// ---------- local calendar days (YYYY-MM-DD) ----------
export function dayKey(d = new Date()) {
  if (!(d instanceof Date)) d = new Date(d);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export const today = () => dayKey(new Date());
export function parseDay(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(s, n) {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
export const diffDays = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
export function weekStart(s) {
  const d = parseDay(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}
export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

// ---------- UTC partitions used by the sync layer ----------
export function utcDay(ts) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}/${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}`;
}
export function utcHour(ts) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}${pad2(d.getUTCHours())}`;
}

// ---------- formatting ----------
export function fmtHM(ts) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
export function fmtClock(ms) {
  let s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}
export function fmtMin(min) {
  min = Math.round(min);
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}
export function fmtDay(s) {
  const n = diffDays(today(), s);
  const names = { '-2': '前天', '-1': '昨天', 0: '今天', 1: '明天', 2: '后天' };
  if (names[n] != null) return names[n];
  const d = parseDay(s);
  const y = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}年` : '';
  return `${y}${d.getMonth() + 1}月${d.getDate()}日`;
}
export function fmtDayFull(s) {
  const d = parseDay(s);
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${WEEK[d.getDay()]}`;
}

/** Next occurrence of a (possibly yearly) date. days = 0 means today. */
export function nextOccurrence(date, yearly) {
  const t = today();
  if (!yearly) return { day: date, days: diffDays(t, date), years: 0 };
  const [y0, m, d] = date.split('-').map(Number);
  const y = parseDay(t).getFullYear();
  let cand = dayKey(new Date(y, m - 1, d));
  if (diffDays(t, cand) < 0) cand = dayKey(new Date(y + 1, m - 1, d));
  return { day: cand, days: diffDays(t, cand), years: parseDay(cand).getFullYear() - y0 };
}

export function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  let args = null;
  const run = () => {
    last = Date.now();
    timer = null;
    const a = args;
    args = null;
    fn(...a);
  };
  const f = (...a) => {
    args = a;
    if (timer) return;
    const wait = ms - (Date.now() - last);
    if (wait <= 0) run();
    else timer = setTimeout(run, wait);
  };
  f.flush = () => {
    if (timer) {
      clearTimeout(timer);
      run();
    }
  };
  return f;
}

// ---------- images ----------
async function decode(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }
}

export async function compressImage(file, maxSide = 1600, quality = 0.82, src = null) {
  const img = src || (await decode(file));
  const w0 = img.width;
  const h0 = img.height;
  const k = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k));
  const h = Math.max(1, Math.round(h0 * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg', w, h };
}

/** Big image + thumbnail from one decode. */
export async function compressPair(file) {
  const img = await decode(file);
  try {
    const big = await compressImage(file, 1600, 0.8, img);
    const small = await compressImage(file, 360, 0.72, img);
    return { big, small };
  } finally {
    if (img.close) img.close();
  }
}

export function download(name, text, mime = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
