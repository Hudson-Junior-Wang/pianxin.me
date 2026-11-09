// 偏心我 · app entry & shell
// wide screens: sidebar (nav) | page | chat column
// phones:       top bar + page + bottom tabs, chat in a bottom sheet
import { html, render } from './ui/h.js?v=ef34bd8a76';
import { useState, useEffect, useRef } from './vendor/hooks.js';
import { app, WHO, DEFAULT_PROFILE, bus, loadSettings, useBus, useForce, useToasts, dismissToast, useSyncEvent, useCols, useNow, useMedia, nameOf, toast, needOf, moodOf, stId, chOf, syncTimezone } from './lib/ctx.js?v=ef34bd8a76';
import { Store } from './lib/store.js?v=ef34bd8a76';
import { initViewport } from './lib/viewport.js?v=ef34bd8a76';
import { Sync } from './lib/sync.js?v=ef34bd8a76';
import { deriveSeed, keyringFromSeed } from './lib/crypto.js?v=ef34bd8a76';
import { unlockRoomSeed } from './lib/room-unlock.js?v=ef34bd8a76';
import { startFeed, startWatcher, poke } from './lib/feed.js?v=ef34bd8a76';
import { derive, session, isMember, phaseText } from './lib/together.js?v=ef34bd8a76';
import { cx, fmtClock } from './lib/util.js?v=ef34bd8a76';
import { Avatar, Dot, St, Portal, useDialog } from './ui/common.js?v=ef34bd8a76';
import { Icon } from './ui/icons.js?v=ef34bd8a76';
import { Chat } from './ui/chat.js?v=ef34bd8a76';
import { Home } from './ui/pages/home.js?v=ef34bd8a76';
import { Learn } from './ui/pages/learn.js?v=ef34bd8a76';
import { Together } from './ui/pages/together.js?v=ef34bd8a76';
import { Journal } from './ui/pages/journal.js?v=ef34bd8a76';
import { Life } from './ui/pages/food.js?v=ef34bd8a76';
import { Me } from './ui/pages/me.js?v=ef34bd8a76';
import { useLayerClose, useRouteMotion } from './ui/motion.js?v=ef34bd8a76';
import { Fingerprint } from './ui/pictograms.js?v=ef34bd8a76';
import { roomIsBound, roomAccessIssue } from './lib/room-access.js?v=ef34bd8a76';
import { RoomRecovery } from './ui/room-recovery.js?v=ef34bd8a76';

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
function Lock({ onDone, issue = '', recovery = null }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(issue);
  const [res, setRes] = useState(null);
  const ch = chOf(app.me) === 'bunny' ? 'r' : 'b';
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!roomIsBound()) return setErr('正在绑定电脑上的固定暗号，暂不开放新解锁，不会创建新空间。请从仍已登录的电脑「设置 → 连接」复制固定空间校验码。');
    if (pw.trim().length < 6) return setErr('请输入原来的完整暗号');
    setErr('');
    setBusy(true);
    try {
      const credential = await deriveSeed(pw);
      const seed = await unlockRoomSeed(credential);
      const kr = seed ? await keyringFromSeed(seed) : null;
      const issue = await roomAccessIssue(kr);
      if (issue) { setErr(issue); setBusy(false); return; }
      setRes({ seed, credential, fp: kr.fp });
    } catch (x) {
      setErr('这个浏览器不支持加密功能，换个新一点的浏览器试试');
    }
    setBusy(false);
  };
  const enter = async () => {
    if (busy) return;
    setBusy(true);
    try { await onDone(res.seed, res.credential); } finally { setBusy(false); }
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
            <p class="hint">固定空间校验通过。这里只使用你们确认的同一把钥匙。</p>
            <button class="btn big" disabled=${busy} onClick=${enter}>${busy ? '正在打开…' : '进入'}</button>
            <button class="link sm" disabled=${busy} onClick=${() => setRes(null)}>重新输入</button>
          </div>`
        : html`<form onSubmit=${submit}>
            <p class="hint">${roomIsBound() ? '这里只属于你们两个人。请输入原来确认的暗号；暗号错误不会另建空间。' : '正在将网站绑定到电脑上的固定暗号。现有记录保留，暂不接受新解锁。'}</p>
            <div class="pw-row">
              <input class="inp" type=${show ? 'text' : 'password'} autocomplete="current-password" placeholder="我们的暗号" value=${pw} onInput=${(e) => setPw(e.target.value)} autoFocus />
              <button type="button" class="btn ghost sm" onClick=${() => setShow(!show)}>${show ? '隐藏' : '显示'}</button>
            </div>
            ${err && html`<p class="err" role="alert">${err}</p>`}
            <button class="btn big" disabled=${busy || !pw.trim()}>${busy ? '正在核对暗号…' : '开门'}</button>
            <p class="hint small">所有内容都会先用这个暗号加密，再离开你的设备。暗号本身不会被上传，忘了就找不回，请记好。</p>
          </form>`}
    </div>
    ${recovery && html`<${RoomRecovery} oldKr=${recovery.oldKr} />`}
  </div>`;
}

// ---------- boot ----------
function showLock(issue = '', recovery = null) {
  render(html`<${Lock} key=${issue} issue=${issue} recovery=${recovery} onDone=${(seed, credential) => start(seed, { credential }).catch(showStartError)} />`, document.getElementById('app'));
}

function showStartError(e) {
  console.error(e);
  showLock('打开时出了点问题，请保留本机数据后刷新重试。');
}

let starting = null;
function start(seed, options = {}) {
  if (!starting) starting = openApp(seed, options).finally(() => { starting = null; });
  return starting;
}

async function openApp(seed, { existing = false, credential = null } = {}) {
  const root = document.getElementById('app');
  // A surviving data key is not proof of the current login password. Validate
  // the current wrapped credential before opening any DB or network connection.
  if (!credential || await unlockRoomSeed(credential) !== seed) {
    let oldKr = null;
    try { oldKr = await keyringFromSeed(seed); } catch {}
    const oldIssue = oldKr ? await roomAccessIssue(oldKr, { existing }) : '';
    showLock(oldIssue, oldIssue ? { oldKr } : null);
    return;
  }
  let kr;
  try {
    kr = await keyringFromSeed(seed);
  } catch {
    showLock('这台设备保存的钥匙无法读取。原有记录没有清除，请输入原来的暗号。');
    return;
  }
  const issue = await roomAccessIssue(kr, { existing });
  if (issue) { showLock(issue, existing ? { oldKr: kr } : null); return; }
  const dbRoom = localStorage.getItem(`px:${app.me}:dbroom`);
  let store = new Store(app.me, dbRoom === kr.room ? kr.room : '');
  // Probe the legacy source without updating its metadata. Only the verified
  // official key may create an absent DB or initialize metadata afterwards.
  try { await store.open({ readOnly: true }); }
  catch { store = new Store(app.me, dbRoom === kr.room ? kr.room : ''); await store.open(); }
  const room = await store.getMeta('room');
  // Never rekey a device's surviving history merely because a different
  // passphrase was entered. Migration requires an explicit recovery flow.
  if (room && room !== kr.room) {
    store.db.close();
    let oldKr = null;
    try { const saved = localStorage.getItem(`px:${app.me}:kr`); if (saved) { const old = await keyringFromSeed(saved); if (old.room === room) oldKr = old; } } catch {}
    showLock('这台设备的记录属于另一把钥匙，已停止自动切换空间。请先用下方本机恢复入口备份，再确认迁入；原记录保留。', { oldKr });
    return;
  }
  if (!await store.getMeta('dev')) await store.setMeta('dev', store.dev);
  if (room !== kr.room) await store.setMeta('room', kr.room);
  localStorage.setItem(`px:${app.me}:unlock`, credential);
  localStorage.setItem(`px:${app.me}:kr`, seed);
  app.kr = kr;
  app.store = store;
  const sync = new Sync(store, kr, app.me, app.partner);
  app.sync = sync;
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
  if (await store.getMeta('recoveryResult')) {
    const result = await store.getMeta('recoveryResult');
    toast(`旧记录已复制到固定空间，原件仍在本机保留。${result.missingPhotos ? `有 ${result.missingPhotos} 份原图本机未保存；现存缩略图已保留。` : ''}`, { icon: stId(app.me, 'done'), ms: 10000 });
    await store.setMeta('lastRecoveryResult', result);
    await store.setMeta('recoveryResult', null);
  }
  render(html`<${App} />`, root);
  window.__px = app;
}

async function boot() {
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
  const credential = localStorage.getItem(`px:${me}:unlock`);
  const saved = localStorage.getItem(`px:${me}:kr`);
  const seed = saved || (credential && await unlockRoomSeed(credential));
  if (!seed) {
    showLock();
    return;
  }
  start(seed, { existing: true, credential }).catch(showStartError);
}

boot().catch(showStartError);
