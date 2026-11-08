// 偏心我 · app entry & shell
// wide screens: sidebar (nav) | page | chat column
// phones:       top bar + page + bottom tabs, chat in a bottom sheet
import { html, render } from './ui/h.js?v=84b24374a3';
import { useState, useEffect, useRef } from './vendor/hooks.js';
import { app, WHO, DEFAULT_PROFILE, bus, loadSettings, useBus, useForce, useToasts, dismissToast, useSyncEvent, useCols, useNow, useMedia, nameOf, toast, needOf, moodOf, stId, chOf, syncTimezone } from './lib/ctx.js?v=84b24374a3';
import { Store } from './lib/store.js?v=84b24374a3';
import { initViewport } from './lib/viewport.js?v=84b24374a3';
import { Sync } from './lib/sync.js?v=84b24374a3';
import { deriveSeed, keyringFromSeed } from './lib/crypto.js?v=84b24374a3';
import { startFeed, startWatcher, poke } from './lib/feed.js?v=84b24374a3';
import { derive, session, isMember, phaseText } from './lib/together.js?v=84b24374a3';
import { cx, fmtClock } from './lib/util.js?v=84b24374a3';
import { Avatar, Dot, St, Portal, useDialog } from './ui/common.js?v=84b24374a3';
import { Icon } from './ui/icons.js?v=84b24374a3';
import { Chat } from './ui/chat.js?v=84b24374a3';
import { Home } from './ui/pages/home.js?v=84b24374a3';
import { Learn } from './ui/pages/learn.js?v=84b24374a3';
import { Together } from './ui/pages/together.js?v=84b24374a3';
import { Journal } from './ui/pages/journal.js?v=84b24374a3';
import { Life } from './ui/pages/food.js?v=84b24374a3';
import { Me } from './ui/pages/me.js?v=84b24374a3';
import { useLayerClose, useRouteMotion } from './ui/motion.js?v=84b24374a3';
import { Fingerprint } from './ui/pictograms.js?v=84b24374a3';

initViewport();

const NAV = [
  { k: 'home', label: '首页', icon: 'today', C: Home },
  { k: 'learn', label: '学习', icon: 'learn', C: Learn },
  { k: 'journal', label: '记录', icon: 'journal', C: Journal },
  { k: 'life', label: '生活', icon: 'life', C: Life },
];
const PAGES = Object.fromEntries([...NAV.map((n) => [n.k, n]), ['me', { k: 'me', label: '设置', icon: 'gear', C: Me }], ['together', { k: 'together', label: '专注小工具', icon: 'clock', C: Together }]]);
// old links keep working
const ALIAS = { food: ['life', null], fit: ['life', 'fit'], cal: ['journal', 'cal'] };

function parseHash() {
  let h = location.hash.replace(/^#\/?/, '');
  try { h = decodeURIComponent(h); } catch {}
  let [page, param] = h.split('/');
  if (ALIAS[page]) {
    const [p, fixed] = ALIAS[page];
    param = fixed || param;
    page = p;
  }
  // Calendar used to live under Life. Keep bookmarked routes compatible while
  // rendering the Records destination and its selected navigation state.
  if (page === 'life' && (param === 'cal' || param === 'cal-personal')) return { page: 'journal', param };
  if (page === 'together' && param && !['study', 'read', 'drafts'].includes(param)) {
    if (param === 'eat' || param === 'sport') return { page: 'life', param: param === 'eat' ? 'meal' : 'fit' };
    return { page: 'journal', param: '' };
  }
  return { page: PAGES[page] ? page : 'home', param: param || '' };
}

// ---------- small shared widgets ----------
function UnreadBadge({ dot }) {
  const force = useForce();
  useBus('unread', force, []);
  if (!app.unread) return null;
  return dot ? html`<i class="nav-dot"></i>` : html`<i class="nav-badge">${app.unread > 99 ? '99+' : app.unread}</i>`;
}

function LiveDot() {
  useCols(['together', 'tjoin']);
  useNow(5000);
  return derive(session(), Date.now()).state === 'run' ? html`<i class="nav-live"></i>` : null;
}

function PartnerMini() {
  useCols(['status', 'profile']);
  useSyncEvent('presence');
  const st = app.store.get('status', app.partner);
  const need = needOf(st);
  const mood = st && moodOf(st.mood);
  const on = app.sync.isOnline(app.partner);
  return html`<a class=${cx('partner-mini', 'p-' + app.partner)} href="#/">
    <${Avatar} who=${app.partner} size=${36} />
    <span class="pm-t"><b>${nameOf(app.partner)} <${Dot} on=${on} /></b><small>${need ? need.label : mood ? mood.label : on ? '在线' : '不在线'}</small></span>
  </a>`;
}

function NetPill() {
  useSyncEvent(['net', 'sweep']);
  const sw = app.sync.sweepState;
  if (sw) return html`<span class="pill">同步中 ${sw.done}/${sw.total}</span>`;
  if (!app.sync.online) return html`<span class="pill warn" title="网络恢复后会自动同步">离线中</span>`;
  return null;
}

function TimerPill() {
  useCols(['together', 'tjoin']);
  const now = useNow(1000);
  const s = session();
  const d = derive(s, now);
  if (d.state !== 'run') return null;
  return html`<a class=${cx('pill timer', d.phase, d.paused && 'paused')} href="#/together"><${Icon} n="clock" size=${14} /> ${isMember(s) ? phaseText(d) : '一起' + d.mode.label} ${fmtClock(d.remaining)}</a>`;
}

function PokeBtn({ cls }) {
  const [pop, setPop] = useState(0);
  const go = () => {
    if (!poke('poke')) return;
    setPop(Date.now());
    toast(`戳了戳 ${nameOf(app.partner)}`, { icon: stId(app.me, 'poke'), kind: 'soft', ms: 1800 });
  };
  return html`<button class=${cx('poke-mini', cls, pop && 'pop')} key=${pop} title="戳一下" aria-label="戳一下" onClick=${go}><${St} id=${stId(app.me, 'poke')} size=${34} title="" /></button>`;
}

// ---------- wide layout ----------
function Sidebar({ route }) {
  useCols(['profile']);
  return html`<aside class="side">
    <a class="brand" href="#/"><img src="/app/icons/icon-192-v3.png" alt="" /><span>偏心我</span></a>
    <nav class="side-nav">
      ${NAV.map((n) => html`<a href=${'#/' + (n.k === 'home' ? '' : n.k)} class=${cx('sn', (route.page === n.k || (n.k === 'learn' && route.page === 'together')) && 'on')}>
        <${Icon} n=${n.icon} size=${22} /><span>${n.label}</span>${n.k === 'learn' ? html`<${LiveDot} />` : null}
      </a>`)}
    </nav>
    <span class="sp"></span>
    <div class="side-me">
      <${Avatar} who=${app.me} size=${36} />
      <span class="sm-t"><b>${nameOf(app.me)}</b><small>我</small></span>
      <a class=${cx('icon-btn', route.page === 'me' && 'on')} href="#/me" aria-label="设置"><${Icon} n="gear" /></a>
    </div>
  </aside>`;
}

function ChatColumn() {
  const force = useForce();
  useBus('quiet', force, []);
  return html`<aside class="chat-col"><${Chat} quiet=${app.focus} /></aside>`;
}

// ---------- phone layout ----------
function TopBar({ route }) {
  return html`<header class="topbar">
    <${PartnerMini} />
    <span class="sp"></span>
    <${NetPill} />
    <${PokeBtn} />
    <button class="icon-btn chat-btn" aria-label="聊天" onClick=${() => bus.emit('chat:open')}><${Icon} n="chat" /><${UnreadBadge} /></button>
    <a class=${cx('icon-btn', route.page === 'me' && 'on')} href="#/me" aria-label="设置"><${Icon} n="gear" /></a>
  </header>`;
}

function TabBar({ route }) {
  return html`<nav class="tabbar" aria-label="主要导航">${NAV.map((n) => html`<a href=${'#/' + (n.k === 'home' ? '' : n.k)} class=${cx('tb', (route.page === n.k || (n.k === 'learn' && route.page === 'together')) && 'on')} aria-current=${route.page === n.k || (n.k === 'learn' && route.page === 'together') ? 'page' : undefined}>
    <span class="tb-i"><${Icon} n=${n.icon} size=${24} />${n.k === 'learn' ? html`<${LiveDot} />` : null}</span><small>${n.label}</small>
  </a>`)}</nav>`;
}

function ChatSheet({ onClose }) {
  const force = useForce();
  useBus('quiet', force, []);
  const close = useLayerClose('.sheet', onClose, 'sheet');
  useDialog('.sheet', close);
  return html`<${Portal}>
    <div class="sheet-bg" onClick=${(e) => e.target === e.currentTarget && close()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="聊天" tabIndex=${-1}><${Chat} quiet=${app.focus} onClose=${close} /></div>
    </div>
  <//>`;
}

function Toasts() {
  const list = useToasts();
  return html`<div class="toasts" aria-live="polite">${list.map(
    (t) => html`<div key=${t.id} class=${cx('toast', t.kind)} onClick=${() => dismissToast(t.id)}>
      <${St} id=${t.icon} size=${44} cls="toast-st" title="" />
      <span class="toast-t">${t.text}</span>
      ${t.action && html`<button class="btn xs" onClick=${(e) => { e.stopPropagation(); dismissToast(t.id); t.action.fn(); }}>${t.action.label}</button>`}
    </div>`,
  )}</div>`;
}

function App() {
  useCols('profile');
  const [route, setRoute] = useState(parseHash());
  const [sheet, setSheet] = useState(false);
  const mainRef = useRef(null);
  useRouteMotion(mainRef, route.page + '/' + route.param);
  const force = useForce();
  useBus('quiet', force, []);
  const wide = useMedia('(min-width: 1100px)');
  const mid = useMedia('(min-width: 760px)');
  useEffect(() => { if (wide) setSheet(false); }, [wide]);
  useEffect(() => {
    let last = route.page;
    const f = () => {
      const r = parseHash();
      if (r.page !== last) scrollTo(0, 0);
      last = r.page;
      setRoute(r);
      setSheet(false);
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  useBus('chat:open', () => {
    if (!matchMedia('(min-width: 1100px)').matches) setSheet(true);
    else document.querySelector('.chat-col .chat-ta, .chat-col .st-quick button')?.focus();
  }, []);
  const P = PAGES[route.page].C;
  return html`<div class=${cx('shell', wide ? 'wide' : mid ? 'mid' : 'narrow', app.focus && 'focus-mode', 'me-' + app.me, 'ch-' + chOf(app.me))}>
    ${mid ? html`<${Sidebar} route=${route} />` : html`<${TopBar} route=${route} />`}
    <main class="main" ref=${mainRef}>
      ${mid && html`<div class="main-top"><span class="sp"></span>${route.page !== 'home' && html`<${TimerPill} />`}<${NetPill} /><${PokeBtn} />${!wide && html`<button class="icon-btn chat-btn" aria-label="聊天" onClick=${() => setSheet(true)}><${Icon} n="chat" /><${UnreadBadge} /></button>`}</div>`}
      <${P} param=${route.param} />
    </main>
    ${wide && html`<${ChatColumn} />`}
    ${!mid && html`<${TabBar} route=${route} />`}
    ${!wide && sheet && html`<${ChatSheet} onClose=${() => setSheet(false)} />`}
    <${Toasts} />
  </div>`;
}

// ---------- lock screen ----------
function Lock({ onDone }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const ch = chOf(app.me) === 'bunny' ? 'r' : 'b';
  const submit = async (e) => {
    e.preventDefault();
    if (pw.trim().length < 6) return setErr('暗号至少 6 个字，长一点更安全');
    setErr('');
    setBusy(true);
    try {
      const seed = await deriveSeed(pw);
      const kr = await keyringFromSeed(seed);
      setRes({ seed, fp: kr.fp });
    } catch (x) {
      setErr('这个浏览器不支持加密功能，换个新一点的浏览器试试');
    }
    setBusy(false);
  };
  const enter = () => {
    localStorage.setItem(`px:${app.me}:kr`, res.seed);
    onDone(res.seed);
  };
  return html`<div class="lock">
    <div class="lock-card">
      <${St} id=${res ? `${ch}-ok` : busy ? `${ch}-study` : `${ch}-hi`} size=${120} title="" />
      <h1>偏心我</h1>
      <p class="lock-hi">你好呀，<b>${nameOf(app.me)}</b></p>
      ${res
        ? html`<div class="fp-box">
            <p>这是你们这把钥匙的指纹：</p>
            <div class="fp"><${Fingerprint} value=${res.fp} /></div>
            <p class="hint">和 ${nameOf(app.partner)} 那边的四组编号一模一样，就说明暗号对上啦。</p>
            <button class="btn big" onClick=${enter}>进入</button>
            <button class="link sm" onClick=${() => setRes(null)}>重新输入</button>
          </div>`
        : html`<form onSubmit=${submit}>
            <p class="hint">输入你们约定好的暗号。两个人要输入<b>一模一样</b>的暗号，才会进到同一个小空间。</p>
            <div class="pw-row">
              <input class="inp" type=${show ? 'text' : 'password'} autocomplete="current-password" placeholder="我们的暗号" value=${pw} onInput=${(e) => setPw(e.target.value)} autoFocus />
              <button type="button" class="btn ghost sm" onClick=${() => setShow(!show)}>${show ? '隐藏' : '显示'}</button>
            </div>
            ${err && html`<p class="err">${err}</p>`}
            <button class="btn big" disabled=${busy || !pw.trim()}>${busy ? '正在配钥匙…' : '开门'}</button>
            <p class="hint small">所有内容都会先用这个暗号加密，再离开你的设备。暗号本身不会被上传，忘了就找不回，请记好。</p>
          </form>`}
    </div>
  </div>`;
}

// ---------- boot ----------
async function start(seed) {
  const root = document.getElementById('app');
  let kr;
  try {
    kr = await keyringFromSeed(seed);
  } catch {
    localStorage.removeItem(`px:${app.me}:kr`);
    location.reload();
    return;
  }
  app.kr = kr;
  const store = new Store(app.me);
  await store.open();
  app.store = store;
  const sync = new Sync(store, kr, app.me, app.partner);
  app.sync = sync;
  const room = await store.getMeta('room');
  if (room && room !== kr.room) {
    store.rekey();
    await sync.reshareAll();
    await store.setMeta('lastSync', null);
  }
  if (room !== kr.room) await store.setMeta('room', kr.room);
  syncTimezone();
  setInterval(syncTimezone, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncTimezone(); });
  addEventListener('pageshow', syncTimezone);
  const prof = store.get('profile', app.me);
  const defaults = DEFAULT_PROFILE[app.me];
  if (!prof || !prof.ch || !prof.name || prof.name === app.me || prof.roleV !== 2) {
    store.put('profile', app.me, {
      ...defaults, ...prof,
      name: !prof?.name || prof.name === app.me ? defaults.name : prof.name,
      ch: prof?.roleV === 2 || prof?.chCustom ? prof.ch || defaults.ch : defaults.ch,
      roleV: 2,
    });
  }

  startFeed();
  startWatcher();
  bus.on('unread', (n) => {
    document.title = n ? `(${n}) 偏心我` : `偏心我 · ${nameOf(app.me)}`;
  });
  document.title = `偏心我 · ${nameOf(app.me)}`;
  sync.on((type, h) => {
    if (type === 'live' && h.e === 'toast') toast(h.text, { icon: h.icon || stId(app.partner, 'hi') });
  });
  await sync.start();
  render(html`<${App} />`, root);
  window.__px = app;
}

function boot() {
  const me = window.PX_ME;
  if (!WHO.includes(me)) {
    location.href = '/';
    return;
  }
  app.me = me;
  app.partner = WHO.find((w) => w !== me);
  document.documentElement.dataset.me = me;
  loadSettings();
  const root = document.getElementById('app');
  if (!window.crypto || !crypto.subtle || !window.indexedDB) {
    root.innerHTML = '<div class="lock"><div class="lock-card"><h1>偏心我</h1><p>这个浏览器缺少安全存储或加密功能。请先更新华为浏览器 / Safari / Chrome / Edge，再重新打开；不要清除原浏览器的网站数据。</p></div></div>';
    return;
  }
  const seed = localStorage.getItem(`px:${me}:kr`);
  if (!seed) {
    render(html`<${Lock} onDone=${(s) => { render(null, root); start(s); }} />`, root);
    return;
  }
  start(seed).catch((e) => {
    console.error(e);
    root.innerHTML = '<div class="lock"><div class="lock-card"><h1>偏心我</h1><p>打开时出了点问题，刷新一下试试。</p></div></div>';
  });
}

boot();
