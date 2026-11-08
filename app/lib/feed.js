// 偏心我 · gentle notifications derived from the other person's changes,
// plus the "一起模式" watcher (phase changes, quiet state, auto-logging).
// Nothing here keeps score: no streaks, no read receipts, no comparisons.

import { app, bus, toast, chime, vibrate, notify, nameOf, NEEDS, moodOf, stId, stLabel, isSt } from './ctx.js?v=14a1b2f159';
import { derive, session, isMember, quietOf, logSession, MODES } from './together.js?v=14a1b2f159';
import { pick } from './util.js?v=14a1b2f159';

const short = (s, n = 18) => {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
};
const ta = () => nameOf(app.partner);
const taSt = (k) => stId(app.partner, k);
const modeSt = (m, who = app.partner) => (m.st && m.st.startsWith('d-') ? m.st : stId(who, m.st || 'hi'));
const go = (hash) => () => { location.hash = hash; };

// quick, friendly nudges (each person sends their own character's sticker)
export const POKE_KINDS = {
  poke: { st: 'poke', label: '戳一下', texts: ['戳了戳你', '轻轻戳了你一下', '戳戳戳～', '戳了戳你的小脑袋'] },
  pat: { st: 'pat', label: '拍拍', texts: ['拍了拍你', '拍拍你，辛苦啦'] },
  listen: { st: 'listen', label: '我在听', texts: ['说：我在听，你慢慢说', '搬好小板凳听你说'] },
  cheer: { st: 'cheer', label: '加油', texts: ['给你加油打气', '说：你可以的！'] },
  hi: { st: 'hi', label: '打招呼', texts: ['跟你打了个招呼', '说：嗨～'] },
};
// old records may still say "hug" / "heart"
const pokeKind = (k) => POKE_KINDS[k] || POKE_KINDS[k === 'hug' ? 'pat' : k === 'heart' ? 'hi' : 'poke'];

const lastPoke = {};
/** returns false when the same kind is tapped too fast (keeps the brokers happy) */
export function poke(kind = 'poke') {
  const now = Date.now();
  if (now - (lastPoke[kind] || 0) < 900) return false;
  lastPoke[kind] = now;
  const k = pokeKind(kind);
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

const chatPreview = (x) => (x.st ? `[${stLabel(x.st) || '表情'}]` : x.emo ? x.text : short(x.text, 40));

function newChat(r, live) {
  if (live) bus.emit('chat:new', r.x);
  if (chatVisible()) return;
  app.unread++;
  bus.emit('unread', app.unread);
  if (!live) return;
  if (!app.quiet) chime('soft');
  notify(`${ta()} 发来消息`, chatPreview(r.x));
}

// ---------- live toasts ----------
function onLive(r, prev) {
  const x = r.x;
  const px = prev && prev.x;
  if (r.c === 'poke') {
    if (!x || (px && px.at === x.at)) return;
    if (Date.now() - (x.at - (app.sync?.skew || 0)) > 180000) return;
    const k = pokeKind(x.kind);
    toast(`${ta()} ${x.v || k.texts[0]}`, { icon: taSt(k.st), kind: 'poke' });
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
      if (x.done && !(px && px.done)) toast(`${ta()} 勾掉了「${short(x.text)}」`, { icon: taSt('done'), kind: 'soft' });
      break;
    case 'status': {
      if (x.need && x.need !== (px && px.need)) {
        const n = NEEDS.find((v) => v.k === x.need);
        if (n) {
          toast(`${ta()} 现在「${n.label}」`, { icon: taSt(n.st), ms: 5200, action: x.need === 'chat' ? { label: '去聊天', fn: () => bus.emit('chat:open') } : null });
          notify('偏心我', `${ta()} 现在「${n.label}」`);
        }
      } else if (x.mood && x.mood !== (px && px.mood)) {
        const m = moodOf(x.mood);
        if (m) toast(`${ta()} 的心情：${m.label}`, { icon: taSt(m.st), kind: 'soft', ms: 3200 });
      }
      break;
    }
    case 'together': {
      const m = MODES[x.mode] || MODES.study;
      if (x.sid && x.sid !== (px && px.sid) && derive(x, Date.now()).state === 'run') {
        toast(`${ta()} 开始了${m.label}计时`, {
          icon: modeSt(m),
          ms: 12000,
          action: { label: '看看', fn: () => { location.hash = '#/together'; } },
        });
        notify('偏心我', `${ta()} 开始了${m.label}计时`);
      } else if (x.ended && !x.natural && px && !px.ended && x.sid === px.sid && isMember(x)) {
        toast(`${ta()} 结束了这次一起${m.label}`, { icon: taSt('salute'), kind: 'soft' });
      } else if (px && x.sid === px.sid && x.paused !== px.paused && isMember(x)) {
        toast(x.paused ? `${ta()} 暂停了计时` : `${ta()} 继续了计时`, { icon: taSt(x.paused ? 'tea' : 'cheer'), kind: 'soft', ms: 2600 });
      }
      break;
    }
    case 'tjoin': {
      const s = session();
      const m = (s && MODES[s.mode]) || MODES.study;
      if (x.sid && s && x.sid === s.sid && !(px && px.sid === x.sid) && isMember(s)) {
        toast(`${ta()} 加入了，一起${m.label}`, { icon: taSt('hi') });
      } else if (!x.sid && px && px.sid && s && px.sid === s.sid && isMember(s)) {
        toast(`${ta()} 先离开一下`, { icon: taSt('salute'), kind: 'soft' });
      }
      break;
    }
    case 'learn':
      if (!px && x.to !== 'me' && !x.private && !x._private && !x._local) toast(`${ta()} 分享了学到的东西「${short(x.title || x.text || '学习笔记', 16)}」`, { icon: taSt('read'), action: { label: '看看', fn: go('#/learn/' + encodeURIComponent(r.i)) } });
      break;
    case 'journal':
      if (!px) {
        const toMe = x.to === 'ta';
        toast(toMe ? `${ta()} 给你留了一段话` : `${ta()} 记录了今天的小事`, {
          icon: taSt(toMe ? 'idea' : 'read'),
          action: { label: '去看看', fn: go('#/journal/' + x.day) },
        });
        if (toMe) notify('偏心我', `${ta()} 给你留了一段话`);
      }
      break;
    case 'workout':
      if (!px) toast(`${ta()} 运动了 ${x.min || ''} 分钟`, { icon: taSt('run'), action: { label: '去夸夸', fn: go('#/life/fit') } });
      break;
    case 'meal':
      if (!px) toast(`${ta()} 吃了：${short(x.text, 14)}`, { icon: taSt('eat'), kind: 'soft', action: { label: '看看', fn: go('#/life/meal') } });
      break;
    case 'recipe':
      if (!px) toast(`${ta()} 分享了一个菜谱「${short(x.name, 12)}」`, { icon: taSt('idea'), action: { label: '看看', fn: go('#/life/recipe') } });
      break;
    case 'wish':
      if (!px) toast(`${ta()} 想吃「${short(x.name, 12)}」`, { icon: taSt('eat'), action: { label: '看看', fn: go('#/life/wish') } });
      else if (x.done && !px.done) toast(`${ta()} 把「${short(x.name, 12)}」标成吃到啦`, { icon: taSt('ok'), kind: 'soft' });
      break;
    case 'idea':
      if (!px) toast(`${ta()} 往点子罐里放了一个点子（先不偷看）`, { icon: taSt('idea'), kind: 'soft' });
      else if (x.drawn && !px.drawn) toast(`${ta()} 从点子罐里摇出了「${short(x.text, 14)}」`, { icon: taSt('cheer'), action: { label: '看看', fn: go('#/cal') } });
      break;
    case 'anniv':
    case 'meet':
    case 'plan':
      if (!px) {
        const label = r.c === 'meet' ? `见面：${x.date}` : short(x.title, 14);
        toast(`${ta()} 在日历上加了「${label}」`, { icon: taSt(r.c === 'meet' ? 'hi' : 'idea'), action: { label: '看看', fn: go('#/cal') } });
      }
      break;
    case 'react': {
      if (px && px.e === x.e) break;
      const [col, id] = String(x.t || '').split('/');
      const author = app.store.rec(col, id)?.by;
      if (author !== app.me) break;
      const isKey = !!stLabel(stId(app.partner, x.e)) && !/\p{Extended_Pictographic}/u.test(x.e);
      toast(`${ta()} 回应了你${isKey ? `：${stLabel(stId(app.partner, x.e))}` : ` ${x.e}`}`, { icon: isKey ? stId(app.partner, x.e) : x.e, kind: 'soft', ms: 3000 });
      break;
    }
    case 'cmt': {
      if (px) break;
      const [col, id] = String(x.t || '').split('/');
      const author = app.store.rec(col, id)?.by;
      if (author === app.me) toast(`${ta()} 回你：${short(x.text, 16)}`, { icon: taSt('hi') });
      break;
    }
    default:
      break;
  }
}

// ---------- "while you were away" summary ----------
const AWAY = {
  chat: (n) => `发了 ${n} 条消息`,
  journalTa: (n) => `给你留了 ${n} 段话`,
  journal: (n) => `记录了 ${n} 件小事`,
  learn: (n) => `分享了 ${n} 条学习笔记`,
  poke: () => '戳过你',
  workout: (n) => `运动了 ${n} 次`,
  meal: (n) => `记了 ${n} 顿饭`,
  recipe: (n) => `分享了 ${n} 个菜谱`,
  wish: (n) => `想吃 ${n} 样东西`,
  idea: (n) => `往点子罐放了 ${n} 个点子`,
  cal: () => '更新了日历',
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
      case 'learn': if (fresh && x.to !== 'me' && !x.private && !x._private && !x._local) inc('learn'); break;
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
  const fn = c.has('learn') ? go('#/learn') : c.has('journalTa') || c.has('journal') ? go('#/journal') : c.has('chat') ? () => bus.emit('chat:open') : c.has('cal') ? go('#/cal') : null;
  toast(`欢迎回来～你不在的时候，${ta()} ${parts.join('、')}`, { icon: taSt('hi'), ms: 9000, action: fn ? { label: '去看看', fn } : null });
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
  let confirmedRevision = '';
  // Cached startup state is not proof that a partner has not paused it while away.
  // Only a session record received/changed during this page lifetime may auto-log.
  const revision = (r) => r ? `${r.t}:${r.d}` : '';
  app.store.on((r) => { if (r.c === 'together' && r.i === 'main') confirmedRevision = revision(r); });
  const tick = () => {
    const s = session();
    const d = derive(s, Date.now());
    const member = isMember(s);
    const focus = quietOf(d, s);
    const quiet = focus || app.store.get('status', app.me)?.need === 'quiet';
    if (focus !== app.focus || quiet !== app.quiet) {
      app.focus = focus;
      app.quiet = quiet;
      bus.emit('quiet', { focus, quiet });
      if (!focus && chatVisible()) markChatRead();
    }
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
            toast(`一起${m.label}结束啦，辛苦啦`, { icon: 'd-yay', ms: 6000 });
            notify('偏心我', `一起${m.label}结束啦`, true);
          } else if (d.phase === 'break') {
            chime('bell', true);
            toast('休息时间到～可以聊两句了', { icon: stId(app.me, 'tea'), ms: 5000 });
            notify('偏心我', '休息时间到～', true);
          } else {
            chime('start', true);
            toast(`第 ${d.round} 轮开始，一起加油`, { icon: modeSt(m, app.me), ms: 3600 });
            notify('偏心我', `第 ${d.round} 轮开始啦`, true);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    // Never finalize an expired startup cache before receiving the partner's newer state.
    if (d.state === 'done' && member && confirmedRevision && confirmedRevision === revision(app.store.rec('together', 'main'))) {
      if (!d.stale) logSession(s, d.round, d.endedAt);
      // derive() already renders this as finished. Do not publish an automatic ended
      // record: a stale local timer must never overwrite an unseen remote pause/update.
    }
  };
  app.focus = false;
  tick();
  setInterval(tick, 500);
  app.store.onCols((cols) => {
    if (cols.has('together') || cols.has('tjoin') || cols.has('status')) tick();
  });
}
