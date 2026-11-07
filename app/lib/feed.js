// 偏心我 · gentle notifications derived from the other person's changes,
// plus the "一起模式" watcher (phase changes, quiet state, auto-logging).
// Nothing here keeps score: no streaks, no read receipts, no comparisons.

import { app, bus, toast, chime, vibrate, notify, nameOf, NEEDS, MOODS } from './ctx.js?v=efe89b71a3';
import { derive, session, isMember, quietOf, logSession, end, MODES, join } from './together.js?v=efe89b71a3';
import { pick } from './util.js?v=efe89b71a3';

const short = (s, n = 18) => {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
};
const ta = () => nameOf(app.partner);
const go = (hash) => () => { location.hash = hash; };

export const POKE_KINDS = {
  poke: { icon: '👉', label: '戳一下', texts: ['戳了戳你', '戳了戳你的脸', '戳了戳你的肩膀', '轻轻戳了你一下', '戳戳戳～', '戳了戳你的小脑袋'] },
  hug: { icon: '🫂', label: '抱抱', texts: ['抱了抱你', '给你一个大大的拥抱', '把你抱紧紧'] },
  listen: { icon: '👂', label: '我在听', texts: ['说：我在听，你慢慢说', '搬好小板凳听你吐槽'] },
  heart: { icon: '💗', label: '比心', texts: ['给你比了个心', '说：在想你'] },
  cheer: { icon: '💪', label: '加油', texts: ['给你加油打气', '说：你超棒的！'] },
};

const lastPoke = {};
/** returns false when the same kind is tapped too fast (keeps the brokers happy) */
export function poke(kind = 'poke') {
  const now = Date.now();
  if (now - (lastPoke[kind] || 0) < 900) return false;
  lastPoke[kind] = now;
  const k = POKE_KINDS[kind] || POKE_KINDS.poke;
  app.store.put('poke', app.me, { at: now, kind, v: pick(k.texts) });
  return true;
}

// ---------- chat unread (local only, never shared) ----------
app.unread = 0;
app.chatViews = 0;
export function chatVisible() {
  return app.chatViews > 0 && document.visibilityState === 'visible';
}
export function markChatRead() {
  if (app.unread) {
    app.unread = 0;
    bus.emit('unread', 0);
  }
}
document.addEventListener('visibilitychange', () => {
  if (chatVisible()) markChatRead();
});

function newChat(r, live) {
  if (live) bus.emit('chat:new', r.x);
  if (chatVisible()) return;
  app.unread++;
  bus.emit('unread', app.unread);
  if (!live) return;
  if (!app.quiet) chime('soft');
  notify(`${ta()} 发来消息`, r.x.emo ? r.x.text : short(r.x.text, 40));
}

// ---------- live toasts ----------
let qToastAt = 0;
let qBurst = 0;

function onLive(r, prev) {
  const x = r.x;
  const px = prev && prev.x;
  if (r.c === 'poke') {
    if (!x || (px && px.at === x.at)) return;
    if (Date.now() - (x.at - (app.sync?.skew || 0)) > 180000) return;
    const k = POKE_KINDS[x.kind] || POKE_KINDS.poke;
    toast(`${ta()} ${x.v || k.texts[0]}`, { icon: k.icon, kind: 'poke' });
    if (!app.quiet) vibrate([40, 70, 40]);
    chime('poke');
    bus.emit('poked', x);
    notify('偏心我', `${ta()} ${x.v || k.texts[0]}`);
    return;
  }
  if (r.c === 'chat') {
    if (x && !px && x.who === app.partner) newChat(r, true);
    return;
  }
  if (!x) return;
  switch (r.c) {
    case 'task':
      if (x.done && !(px && px.done)) toast(`${ta()} 勾掉了「${short(x.text)}」`, { icon: '✅', kind: 'soft' });
      break;
    case 'qc': {
      const n = x.n || 0;
      const was = (px && px.n) || 0;
      if (n <= was) break;
      const now = Date.now();
      qBurst = now - qToastAt < 15000 ? qBurst + (n - was) : n - was;
      qToastAt = now;
      toast(qBurst > 1 ? `${ta()} 又做完 ${qBurst} 道题啦` : `${ta()} 做完一道题 ✏️`, { icon: '✏️', kind: 'soft', ms: 3200 });
      break;
    }
    case 'status': {
      if (x.need && x.need !== (px && px.need)) {
        const n = NEEDS.find((v) => v.k === x.need);
        if (n) toast(`${ta()} 现在「${n.label}」`, { icon: n.icon, ms: 5200, action: x.need === 'chat' ? { label: '去聊天', fn: go('#/together') } : null });
        if (n) notify('偏心我', `${ta()} 现在「${n.label}」`);
      } else if (x.mood && x.mood !== (px && px.mood)) {
        const m = MOODS.find((v) => v[0] === x.mood);
        toast(`${ta()} 的心情：${m ? m[1] : ''}`, { icon: x.mood, kind: 'soft', ms: 3200 });
      }
      break;
    }
    case 'together': {
      const m = MODES[x.mode] || MODES.study;
      if (x.sid && x.sid !== (px && px.sid) && !x.ended) {
        toast(`${ta()} 开始了「一起${m.label}」，要来吗？`, {
          icon: m.emoji,
          ms: 12000,
          action: { label: '加入', fn: () => { join(); location.hash = '#/together'; } },
        });
        notify('偏心我', `${ta()} 开始了「一起${m.label}」`);
      } else if (x.ended && !x.natural && px && !px.ended && x.sid === px.sid && isMember(x)) {
        toast(`${ta()} 结束了这次一起${m.label}`, { icon: m.emoji, kind: 'soft' });
      } else if (px && x.sid === px.sid && x.paused !== px.paused && isMember(x)) {
        toast(x.paused ? `${ta()} 暂停了计时` : `${ta()} 继续了计时`, { icon: x.paused ? '⏸️' : '▶️', kind: 'soft', ms: 2600 });
      }
      break;
    }
    case 'tjoin': {
      const s = session();
      const m = (s && MODES[s.mode]) || MODES.study;
      if (x.sid && s && x.sid === s.sid && !(px && px.sid === x.sid) && isMember(s)) {
        toast(`${ta()} 来陪你${m.label}啦`, { icon: m.emoji });
      } else if (!x.sid && px && px.sid && s && px.sid === s.sid && isMember(s)) {
        toast(`${ta()} 先离开一下`, { icon: '🚪', kind: 'soft' });
      }
      break;
    }
    case 'journal':
      if (!px) {
        const toMe = x.to === 'ta';
        toast(toMe ? `${ta()} 对你说了一段话` : `${ta()} 记录了今天的小事`, {
          icon: toMe ? '💌' : '📔',
          action: { label: '去看看', fn: go('#/journal/' + x.day) },
        });
        if (toMe) notify('偏心我', `${ta()} 对你说了一段话 💌`);
      }
      break;
    case 'workout':
      if (!px) toast(`${ta()} 运动了 ${x.min || ''} 分钟`, { icon: '💪', action: { label: '去夸夸', fn: go('#/fit') } });
      break;
    case 'meal':
      if (!px) toast(`${ta()} 吃了：${short(x.text, 14)}`, { icon: '🍚', kind: 'soft', action: { label: '看看', fn: go('#/food') } });
      break;
    case 'recipe':
      if (!px) toast(`${ta()} 扔上来一个菜谱「${short(x.name, 12)}」`, { icon: '📖', action: { label: '看看', fn: go('#/food/recipe') } });
      break;
    case 'wish':
      if (!px) toast(`${ta()} 想吃「${short(x.name, 12)}」`, { icon: '🤤', action: { label: '看看', fn: go('#/food/wish') } });
      else if (x.done && !px.done) toast(`${ta()} 把「${short(x.name, 12)}」标成吃到啦`, { icon: '😋', kind: 'soft' });
      break;
    case 'idea':
      if (!px) toast(`${ta()} 往点子罐里扔了点子（先不偷看）`, { icon: '🫙', kind: 'soft' });
      else if (x.drawn && !px.drawn) toast(`${ta()} 从点子罐里摇出了「${short(x.text, 14)}」`, { icon: '🎲', action: { label: '看看', fn: go('#/cal') } });
      break;
    case 'anniv':
    case 'meet':
    case 'plan':
      if (!px) {
        const label = r.c === 'meet' ? `见面：${x.date}` : short(x.title, 14);
        toast(`${ta()} 在小日历上加了「${label}」`, { icon: r.c === 'meet' ? '🚄' : '📅', action: { label: '看看', fn: go('#/cal') } });
      }
      break;
    case 'react': {
      if (px && px.e === x.e) break;
      const [col, id] = String(x.t || '').split('/');
      const author = app.store.rec(col, id)?.by;
      if (author === app.me) toast(`${ta()} 回应了你 ${x.e}`, { icon: x.e, kind: 'soft', ms: 3000 });
      break;
    }
    case 'cmt': {
      if (px) break;
      const [col, id] = String(x.t || '').split('/');
      const author = app.store.rec(col, id)?.by;
      if (author === app.me) toast(`${ta()} 回你：${short(x.text, 16)}`, { icon: '💬' });
      break;
    }
    default:
      break;
  }
}

// ---------- "while you were away" summary ----------
const AWAY = {
  chat: (n) => `发了 ${n} 条消息`,
  journalTa: (n) => `对你说了 ${n} 段话`,
  journal: (n) => `记录了 ${n} 件小事`,
  poke: () => '戳过你',
  workout: (n) => `运动了 ${n} 次`,
  meal: (n) => `记了 ${n} 顿饭`,
  recipe: (n) => `扔上来 ${n} 个菜谱`,
  wish: (n) => `想吃 ${n} 样东西`,
  idea: (n) => `往点子罐扔了 ${n} 个点子`,
  cal: () => '更新了小日历',
};

function summarize(since, countUnread) {
  const c = new Map();
  const inc = (k) => c.set(k, (c.get(k) || 0) + 1);
  for (const r of app.store.recs.values()) {
    if (r.by !== app.partner || r.x == null || r.t <= since) continue;
    const x = r.x;
    const fresh = (x.at || r.t) > since;
    switch (r.c) {
      case 'chat': if (fresh && x.who === app.partner) inc('chat'); break;
      case 'journal': if (fresh) inc(x.to === 'ta' ? 'journalTa' : 'journal'); break;
      case 'poke': if (fresh) inc('poke'); break;
      case 'workout': case 'meal': case 'recipe': case 'wish': case 'idea': if (fresh) inc(r.c); break;
      case 'anniv': case 'meet': case 'plan': inc('cal'); break;
      default: break;
    }
  }
  if (countUnread && c.get('chat') && !chatVisible()) {
    app.unread += c.get('chat');
    bus.emit('unread', app.unread);
  }
  if (!c.size) return;
  const parts = [];
  for (const k of Object.keys(AWAY)) if (c.has(k)) parts.push(AWAY[k](c.get(k)));
  const target = c.has('journalTa') || c.has('journal') ? '#/journal' : c.has('chat') ? '#/together' : c.has('cal') ? '#/cal' : '';
  toast(`欢迎回来～你不在的时候，${ta()} ${parts.join('、')}`, { icon: '🌷', ms: 9000, action: target ? { label: '去看看', fn: go(target) } : null });
}

export function startFeed() {
  const key = `px:${app.me}:seenAt`;
  let bootSince = Number(localStorage.getItem(key) || 0);
  let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : 0;
  const mark = () => localStorage.setItem(key, String(Date.now()));
  mark();
  setInterval(() => document.visibilityState === 'visible' && mark(), 20000);
  addEventListener('pagehide', mark);

  let timer = null;
  const later = (since, unread, ms) => {
    clearTimeout(timer);
    timer = setTimeout(() => summarize(since, unread), ms);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      mark();
      return;
    }
    if (hiddenAt && Date.now() - hiddenAt > 180000) later(hiddenAt, false, 900);
    hiddenAt = 0;
    mark();
  });

  const bootAt = Date.now();
  app.store.on((r, origin, prev) => {
    if (r.by !== app.partner) return;
    if (origin === 'live') return onLive(r, prev);
    // missed during a short network blip: treat recent changes as live
    if (origin === 'sync' && Date.now() - bootAt > 25000 && Date.now() - r.t < 600000) return onLive(r, prev);
    // first catch-up after opening the page: one gentle summary once things settle
    if (origin === 'sync' && bootSince && r.t > bootSince) {
      const since = bootSince;
      later(since, true, 4000);
      clearTimeout(startFeed.stop);
      startFeed.stop = setTimeout(() => { bootSince = 0; }, 4500);
    }
  });
}

// ---------- together watcher ----------
export function startWatcher() {
  let lastKey = '';
  const tick = () => {
    const s = session();
    const d = derive(s, Date.now());
    const member = isMember(s);
    const key = d.state === 'run' ? `${s.sid}:${d.phase}:${d.round}` : d.state === 'done' ? `${s.sid}:done` : 'idle';
    if (key !== lastKey) {
      const sameSession = s && lastKey.split(':')[0] === s.sid;
      const wasRunning = sameSession && !lastKey.endsWith(':done');
      lastKey = key;
      // the other side may have closed a naturally finished session before our own tick noticed
      const naturalIdle = d.state === 'idle' && s && s.ended && s.natural && wasRunning;
      // natural transitions only (a manual stop is announced by the other side's feed)
      if (member && sameSession && !d.stale && (d.mode || naturalIdle) && (d.state !== 'idle' || naturalIdle)) {
        try {
          const m = d.mode || MODES[s.mode] || MODES.study;
          if (d.state === 'done' || naturalIdle) {
            chime('end', true);
            toast(`一起${m.label}圆满结束啦，辛苦啦`, { icon: '🎉', ms: 6000 });
            notify('偏心我', `一起${m.label}结束啦`);
          } else if (d.phase === 'break') {
            chime('bell', true);
            toast('休息时间到～聊两句吧', { icon: '☕', ms: 5000 });
            notify('偏心我', '休息时间到～');
          } else {
            chime('start', true);
            toast(`第 ${d.round} 轮开始，一起加油`, { icon: m.emoji, ms: 3600 });
            notify('偏心我', `第 ${d.round} 轮开始啦`);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    if (d.state === 'done' && member) {
      if (!d.stale) logSession(s, d.round);
      end(s, false, undefined, true);
    }
    const focus = quietOf(d, s);
    const quiet = focus || app.store.get('status', app.me)?.need === 'quiet';
    if (focus !== app.focus || quiet !== app.quiet) {
      app.focus = focus;
      app.quiet = quiet;
      bus.emit('quiet', { focus, quiet });
      if (!focus && chatVisible()) markChatRead();
    }
  };
  app.focus = false;
  tick();
  setInterval(tick, 500);
  app.store.onCols((cols) => {
    if (cols.has('together') || cols.has('tjoin') || cols.has('status')) tick();
  });
}
