// 偏心我 · app entry
import { html, render } from './ui/h.js?v=efe89b71a3';
import { useState, useEffect } from './vendor/hooks.js';
import { app, WHO, bus, loadSettings, useBus, useForce, useToasts, dismissToast, useSyncEvent, useCols, useNow, useMedia, nameOf, avatarOf, toast, NEEDS } from './lib/ctx.js?v=efe89b71a3';
import { Store } from './lib/store.js?v=efe89b71a3';
import { Sync } from './lib/sync.js?v=efe89b71a3';
import { deriveSeed, keyringFromSeed } from './lib/crypto.js?v=efe89b71a3';
import { startFeed, startWatcher, poke } from './lib/feed.js?v=efe89b71a3';
import { derive, session, isMember, phaseText } from './lib/together.js?v=efe89b71a3';
import { cx, fmtClock } from './lib/util.js?v=efe89b71a3';
import { Avatar, Dot } from './ui/common.js?v=efe89b71a3';
import { Home } from './ui/pages/home.js?v=efe89b71a3';
import { Together } from './ui/pages/together.js?v=efe89b71a3';
import { Journal } from './ui/pages/journal.js?v=efe89b71a3';
import { Fit } from './ui/pages/fit.js?v=efe89b71a3';
import { Food } from './ui/pages/food.js?v=efe89b71a3';
import { Cal } from './ui/pages/cal.js?v=efe89b71a3';
import { Me } from './ui/pages/me.js?v=efe89b71a3';

const PAGES = {
  home: { label: '首页', icon: '🏠', C: Home },
  together: { label: '一起', icon: '⏱️', C: Together },
  journal: { label: '记录', icon: '📔', C: Journal },
  fit: { label: '健身', icon: '💪', C: Fit },
  food: { label: '吃饭', icon: '🍚', C: Food },
  cal: { label: '小日历', icon: '📅', C: Cal },
  me: { label: '设置', icon: '⚙️', C: Me },
};

function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [page, param] = h.split('/');
  return { page: PAGES[page] ? page : 'home', param: param || '' };
}

// ---------- header ----------
function PartnerChip() {
  useCols(['status', 'profile']);
  useSyncEvent('presence');
  const st = app.store.get('status', app.partner);
  const need = st && NEEDS.find((n) => n.k === st.need);
  return html`<a class=${cx('partner-chip', 'p-' + app.partner)} href="#/" title=${nameOf(app.partner)}>
    <${Avatar} who=${app.partner} size=${30} />
    <span class="pc-t"><b>${nameOf(app.partner)}</b><small>${app.sync.isOnline(app.partner) ? '在线' : '不在线'}${st?.mood ? ' · ' + st.mood : ''}${need ? ' · ' + need.label : ''}</small></span>
    <${Dot} on=${app.sync.isOnline(app.partner)} />
  </a>`;
}

function NetPill() {
  useSyncEvent(['net', 'sweep']);
  const online = app.sync.online;
  const sw = app.sync.sweepState;
  if (sw) return html`<span class="pill">同步中 ${sw.done}/${sw.total}</span>`;
  if (!online) return html`<span class="pill warn" title="网络恢复后会自动同步">离线中</span>`;
  return null;
}

function TimerPill() {
  useCols(['together', 'tjoin']);
  const now = useNow(1000);
  const s = session();
  const d = derive(s, now);
  if (d.state !== 'run') return null;
  return html`<a class=${cx('pill timer', d.phase, d.paused && 'paused')} href="#/together">${d.mode.emoji} ${isMember(s) ? phaseText(d) : '一起' + d.mode.label} ${fmtClock(d.remaining)}</a>`;
}

function Header({ route }) {
  const [poked, setPoked] = useState(0);
  const force = useForce();
  useBus('quiet', force, []);
  const doPoke = () => {
    if (!poke('poke')) return;
    setPoked(Date.now());
    toast(`戳了戳 ${nameOf(app.partner)}`, { icon: '👉', kind: 'soft', ms: 2000 });
  };
  return html`<header class="hd">
    <div class="hd-in">
      <a class="logo" href="#/"><span class="logo-h">♥</span><span>偏心我</span></a>
      <nav class="tabs">${Object.entries(PAGES).filter(([k]) => k !== 'me').map(([k, p]) => html`<a href=${'#/' + (k === 'home' ? '' : k)} class=${cx('tab', route.page === k && 'on')}>${p.label}<${TabBadge} k=${k} /></a>`)}</nav>
      <span class="sp"></span>
      ${app.focus && html`<span class="pill focus">🤫 专注中</span>`}
      <${TimerPill} />
      <${NetPill} />
      <button class=${cx('poke-mini', poked && 'pop')} key=${poked} title="戳一下" aria-label="戳一下" onClick=${doPoke}>👉</button>
      <${PartnerChip} />
      <a class=${cx('icon-btn gear', route.page === 'me' && 'on')} href="#/me" aria-label="设置">⚙️</a>
    </div>
  </header>`;
}

function TabBadge({ k }) {
  const force = useForce();
  useBus('unread', force, []);
  useCols(['together', 'tjoin']);
  if (k === 'together') {
    const d = derive(session(), Date.now());
    if (app.unread > 0) return html`<i class="tab-badge">${app.unread > 99 ? '99+' : app.unread}</i>`;
    if (d.state === 'run') return html`<i class="tab-dot"></i>`;
  }
  return null;
}

function BottomNav({ route }) {
  return html`<nav class="bnav">${Object.entries(PAGES).filter(([k]) => k !== 'me').map(([k, p]) => html`<a href=${'#/' + (k === 'home' ? '' : k)} class=${cx('bn', route.page === k && 'on')}><span class="bn-i">${p.icon}<${TabBadge} k=${k} /></span><small>${p.label}</small></a>`)}</nav>`;
}

function Toasts() {
  const list = useToasts();
  return html`<div class="toasts" aria-live="polite">${list.map(
    (t) => html`<div key=${t.id} class=${cx('toast', t.kind)} onClick=${() => dismissToast(t.id)}>
      <span class="toast-i">${t.icon}</span><span class="toast-t">${t.text}</span>
      ${t.action && html`<button class="btn xs" onClick=${(e) => { e.stopPropagation(); dismissToast(t.id); t.action.fn(); }}>${t.action.label}</button>`}
    </div>`,
  )}</div>`;
}

function App() {
  const [route, setRoute] = useState(parseHash());
  const force = useForce();
  useBus('quiet', force, []);
  const wide = useMedia('(min-width: 900px)');
  useEffect(() => {
    let last = route.page;
    const f = () => {
      const r = parseHash();
      if (r.page !== last) scrollTo(0, 0);
      last = r.page;
      setRoute(r);
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const P = PAGES[route.page].C;
  return html`<div class=${cx('shell', app.focus && 'focus-mode', 'me-' + app.me)}>
    <${Header} route=${route} />
    <main class="main"><${P} param=${route.param} /></main>
    ${!wide && html`<${BottomNav} route=${route} />`}
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
      <div class="lock-heart">♥</div>
      <h1>偏心我</h1>
      <p class="lock-hi">你好呀，<b>${app.me}</b></p>
      ${res
        ? html`<div class="fp-box">
            <p>这是你们这把钥匙的指纹：</p>
            <div class="fp">${res.fp}</div>
            <p class="hint">和 ${app.partner} 那边看到的一样，就说明暗号对上啦。</p>
            <button class="btn big" onClick=${enter}>进入</button>
            <button class="link sm" onClick=${() => setRes(null)}>重新输入</button>
          </div>`
        : html`<form onSubmit=${submit}>
            <p class="hint">输入你们俩约定好的暗号。两个人要输入<b>一模一样</b>的暗号，才会进到同一个小空间。</p>
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
  const o = new Date().getTimezoneOffset();
  if (store.get('tz', app.me)?.o !== o) store.put('tz', app.me, { o });
  if (!store.get('profile', app.me)) store.put('profile', app.me, { name: app.me, avatar: app.me === 'xiaoha' ? '🐰' : '🐻' });

  startFeed();
  startWatcher();
  bus.on('unread', (n) => {
    document.title = n ? `(${n}) 偏心我` : `偏心我 · ${nameOf(app.me)}`;
  });
  document.title = `偏心我 · ${nameOf(app.me)}`;
  sync.on((type, h) => {
    if (type === 'live' && h.e === 'toast') toast(h.text, { icon: h.icon || '💗' });
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
    root.innerHTML = '<div class="lock"><div class="lock-card"><h1>偏心我</h1><p>这个浏览器太旧啦，换一个新一点的浏览器（Chrome / Safari / Edge）再打开吧。</p></div></div>';
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
