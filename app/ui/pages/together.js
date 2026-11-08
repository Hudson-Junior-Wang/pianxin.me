// 偏心我 · 一起模式 — 同步计时 + 互相可见的草稿栏 + 今日任务（聊天在右栏 / 底部抽屉）
import { html } from '../h.js?v=b9727bb22b';
import { useState, useEffect, useRef } from '../../vendor/hooks.js';
import { app, useCols, useNow, useBus, useSyncEvent, useForce, useSecondTick, nameOf, toast, moodOf, stId } from '../../lib/ctx.js?v=b9727bb22b';
import { MODES, MODE_KEYS, derive, session, members, isMember, phaseText, start, join, leave, pause, resume, skip, end } from '../../lib/together.js?v=b9727bb22b';
import { fmtClock, fmtHM, fmtMin, throttle, cx, fmtDay } from '../../lib/util.js?v=b9727bb22b';
import { Avatar, Dot, St, confirmDel } from '../common.js?v=b9727bb22b';
import { Icon } from '../icons.js?v=b9727bb22b';
import { TaskList } from './home.js?v=b9727bb22b';

const modeSticker = (m, who = app.me) => (m.st.startsWith('d-') ? m.st : stId(who, m.st));

// ---------- timer ----------
function Ring({ frac, phase, children }) {
  const R = 92;
  const C = 2 * Math.PI * R;
  return html`<div class=${cx('ring', phase)}>
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <circle class="ring-bg" cx="100" cy="100" r=${R} />
      <circle class="ring-fg" cx="100" cy="100" r=${R} stroke-dasharray=${C} stroke-dashoffset=${C * (1 - Math.min(1, Math.max(0, frac)))} />
    </svg>
    <div class="ring-in">${children}</div>
  </div>`;
}

const cfgKey = () => `px:${app.me}:tcfg`;
function loadCfg() {
  try { return JSON.parse(localStorage.getItem(cfgKey()) || '{}'); } catch { return {}; }
}
function cfgFor(all, mode) {
  const d = MODES[mode].def;
  return { focus: d[0], brk: d[1], rounds: d[2], ...(all[mode] || {}) };
}

function minLabel(v) {
  if (v >= 60 && v % 60 === 0) return `${v / 60} 小时`;
  if (v > 60) return `${Math.floor(v / 60)}时${v % 60}分`;
  return `${v} 分`;
}

function Pick({ label, value, options, onChange, fmt = minLabel, zero }) {
  const [custom, setCustom] = useState(!options.includes(value));
  return html`<div class="pick">
    <span class="lbl">${label}</span>
    <div class="chips">
      ${options.map((v) => html`<button type="button" class=${cx('chip', !custom && v === value && 'on')} onClick=${() => { setCustom(false); onChange(v); }}>${v === 0 && zero ? zero : fmt(v)}</button>`)}
      <label class=${cx('chip custom', custom && 'on')}>
        <input type="number" inputmode="numeric" min="1" max="720" placeholder="自定" value=${custom ? value : ''} onFocus=${() => setCustom(true)}
          onInput=${(e) => { const n = Math.round(Number(e.target.value)); if (n > 0 && n <= 720) { setCustom(true); onChange(n); } }} />
      </label>
    </div>
  </div>`;
}

function Setup({ initial }) {
  const all = loadCfg();
  const first = MODE_KEYS.includes(initial) ? initial : 'study';
  const mode = first;
  const [cfg, setCfg] = useState(() => cfgFor(all, first));
  const m = MODES[mode];
  const go = () => {
    const a = loadCfg();
    a[mode] = cfg;
    a._mode = mode;
    localStorage.setItem(cfgKey(), JSON.stringify(a));
    start(mode, cfg.focus, m.brk.length ? cfg.brk : 0, m.rounds.length ? cfg.rounds : 1);
  };
  const total = cfg.rounds ? cfg.focus * cfg.rounds + (m.brk.length ? cfg.brk * Math.max(0, cfg.rounds - 1) : 0) : 0;
  return html`<section class="card setup">
    <div class="card-hd"><h3>专注计时</h3><${St} id=${stId(app.me, 'study')} size=${56} title="" /></div>
    <div class="setup-opts">
      <${Pick} key=${mode + 'f'} label=${mode === 'study' || mode === 'read' ? '专注' : '时长'} value=${cfg.focus} options=${m.focus} onChange=${(v) => setCfg({ ...cfg, focus: v })} />
      ${m.brk.length > 0 && html`<${Pick} key=${mode + 'b'} label="休息" value=${cfg.brk} options=${m.brk} zero="不休息" onChange=${(v) => setCfg({ ...cfg, brk: v })} />`}
      ${m.rounds.length > 0 && html`<${Pick} key=${mode + 'r'} label="轮数" value=${cfg.rounds} options=${m.rounds} zero="不限" fmt=${(v) => `${v} 轮`} onChange=${(v) => setCfg({ ...cfg, rounds: v })} />`}
    </div>
    <p class="hint">${m.quiet ? '专注时聊天自动收起、静音，只能发表情；休息时再展开。' : '这个模式聊天一直开着，边做边聊。'}${total ? ` 大约 ${fmtMin(total)}。` : ''}</p>
    <button class="btn big" onClick=${go}>开始专注</button>
  </section>`;
}

function Person({ who, inSession }) {
  useCols(['status']);
  useSyncEvent('presence');
  const st = app.store.get('status', who);
  const mood = st && moodOf(st.mood);
  const on = app.sync.isOnline(who);
  return html`<div class=${cx('person', 'p-' + who, inSession ? 'in' : 'out')}>
    <${Avatar} who=${who} size=${44} />
    <div class="person-t">
      <b>${nameOf(who)} <${Dot} on=${on} /></b>
      <small>${inSession ? (on ? '在这里' : '暂时离开了页面') : on ? '还没加入' : '不在线'}${mood ? ` · ${mood.label}` : ''}</small>
    </div>
  </div>`;
}

function Running() {
  useCols(['together', 'tjoin']);
  const s0 = session();
  const off = s0 && s0.clk && s0.clk !== app.me ? app.sync.skew || 0 : 0;
  const now = useSecondTick(s0 && !s0.paused ? s0.start - off : 0);
  const s = session();
  const d = derive(s, now);
  if (d.state !== 'run') return null;
  const me = isMember(s);
  const who = members(s);
  const frac = d.dur ? 1 - d.remaining / d.dur : 0;
  const rounds = s.rounds || 0;
  const roundText = d.mode.brk.length || rounds > 1 ? (rounds ? `第 ${d.round}/${rounds} 轮` : `第 ${d.round} 轮`) : '';
  const elapsed = Math.max(0, now - (s.t0 || s.start));
  const face = d.paused ? stId(app.me, 'tea') : d.phase === 'break' ? stId(app.me, 'tea') : modeSticker(d.mode);
  return html`<section class=${cx('card running', d.phase, d.paused && 'paused', 'm-' + s.mode)}>
    <div class="run-hd">
      <span class="run-mode">一起${d.mode.label}</span>
      ${roundText && html`<span class="run-round">${roundText}</span>`}
    </div>
    <div class="run-body">
      <${Ring} frac=${frac} phase=${d.paused ? 'paused' : d.phase}>
        <${St} id=${face} size=${84} cls="run-st" title="" />
        <div class="run-clock">${fmtClock(d.remaining)}</div>
        <div class="run-phase">${phaseText(d)}</div>
      </${Ring}>
      <div class="run-side">
        <div class="people">${[app.me, app.partner].map((w) => html`<${Person} who=${w} inSession=${who.includes(w)} />`)}</div>
        <div class="run-sub"><${Icon} n="clock" size=${16} /> 本次时段 ${fmtMin(elapsed / 60000)}（含休息与暂停）</div>
        ${me
          ? html`<div class="run-ctl">
              ${d.paused
                ? html`<button class="btn" onClick=${resume}><${Icon} n="play" size=${16} /> 继续</button>`
                : html`<button class="btn ghost" onClick=${() => pause(d)}><${Icon} n="pause" size=${16} /> 暂停</button>`}
              ${d.mode.brk.length > 0 && s.brk > 0 && html`<button class="btn ghost" onClick=${() => skip(d)}><${Icon} n="skip" size=${16} /> ${d.phase === 'focus' ? '提前休息' : '跳过休息'}</button>`}
              <button class="btn ghost" onClick=${() => { if (confirmDel('结束这次一起' + d.mode.label + '吗？')) end(s, true, d.round); }}><${Icon} n="stop" size=${16} /> 结束</button>
              ${html`<button class="btn ghost" onClick=${() => { if (confirmDel('先离开一下？TA 的计时会继续。')) leave(); }}><${Icon} n="leave" size=${16} /> 先离开</button>`}
            </div>`
          : html`<div class="run-ctl"><button class="btn big" onClick=${() => join(s.sid)}>加入 ${nameOf(s.owner || app.partner)}</button></div>`}
      </div>
    </div>
  </section>`;
}

// ---------- draft pads ----------
const INK_W = 1000;
const INK_H = 640;
const INK_COLORS = ['#4a3a35', '#e8789a', '#5b8def', '#3aa676'];
const INK_MAX = 90000;

function drawStrokes(cv, strokes, extra) {
  if (!cv) return;
  const r = cv.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = Math.round(r.width * dpr);
  const H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const k = W / INK_W;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const list = extra ? [...strokes, extra] : strokes;
  for (const s of list) {
    if (!s || s.length < 4) continue;
    let c = INK_COLORS[s[0]] || INK_COLORS[0];
    if (dark && s[0] === 0) c = '#f3e9e4';
    g.strokeStyle = c;
    g.lineWidth = s[1];
    g.beginPath();
    let x = s[2];
    let y = s[3];
    g.moveTo(x, y);
    if (s.length === 4) g.lineTo(x + 0.1, y + 0.1);
    for (let i = 4; i < s.length; i += 2) {
      x += s[i];
      y += s[i + 1];
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

function InkView({ strokes }) {
  const cv = useRef();
  useEffect(() => {
    drawStrokes(cv.current, strokes || []);
    const ro = new ResizeObserver(() => drawStrokes(cv.current, strokes || []));
    ro.observe(cv.current);
    return () => ro.disconnect();
  }, [strokes]);
  return html`<canvas class="ink" ref=${cv}></canvas>`;
}

function InkPad() {
  const rec = app.store.get('ink', app.me);
  const cv = useRef();
  const strokes = useRef(rec?.s ? rec.s.slice() : []);
  const cur = useRef(null);
  const last = useRef(null);
  const [color, setColor] = useState(0);
  const [, setN] = useState(0);
  const save = useRef(null);
  if (!save.current) save.current = throttle(() => app.store.put('ink', app.me, { s: strokes.current, at: Date.now() }), 900);
  useEffect(() => {
    const redraw = () => drawStrokes(cv.current, strokes.current, cur.current);
    redraw();
    const ro = new ResizeObserver(redraw);
    ro.observe(cv.current);
    return () => {
      ro.disconnect();
      save.current.flush();
    };
  }, []);
  const pt = (e) => {
    const r = cv.current.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * INK_W), Math.round(((e.clientY - r.top) / r.height) * INK_H)];
  };
  const down = (e) => {
    if (e.button > 0) return;
    if (JSON.stringify(strokes.current).length > INK_MAX) {
      toast('草稿纸写满啦，清一清再写吧', { icon: stId(app.me, 'dizzy') });
      return;
    }
    e.preventDefault();
    cv.current.setPointerCapture(e.pointerId);
    const [x, y] = pt(e);
    cur.current = [color, e.pointerType === 'pen' ? 3 : 4, x, y];
    last.current = [x, y];
    drawStrokes(cv.current, strokes.current, cur.current);
  };
  const move = (e) => {
    if (!cur.current) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) {
      const [x, y] = pt(ev);
      const dx = x - last.current[0];
      const dy = y - last.current[1];
      if (dx * dx + dy * dy < 9) continue;
      cur.current.push(dx, dy);
      last.current = [x, y];
    }
    drawStrokes(cv.current, strokes.current, cur.current);
  };
  const up = () => {
    if (!cur.current) return;
    strokes.current.push(cur.current);
    cur.current = null;
    save.current();
    setN((n) => n + 1);
  };
  const undo = () => {
    strokes.current.pop();
    drawStrokes(cv.current, strokes.current);
    save.current();
    setN((n) => n + 1);
  };
  const clear = () => {
    if (!strokes.current.length || !confirmDel('清空手写草稿？')) return;
    strokes.current = [];
    drawStrokes(cv.current, []);
    save.current();
    save.current.flush();
    setN((n) => n + 1);
  };
  return html`<div class="inkpad">
    <canvas class="ink edit" ref=${cv} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}></canvas>
    <div class="ink-tools">
      ${INK_COLORS.map((c, i) => html`<button type="button" class=${cx('ink-c', i === color && 'on')} style=${`--c:${c}`} aria-label="颜色" onClick=${() => setColor(i)}></button>`)}
      <span class="sp"></span>
      <button type="button" class="btn xs ghost" disabled=${!strokes.current.length} onClick=${undo}>撤销</button>
      <button type="button" class="btn xs ghost" disabled=${!strokes.current.length} onClick=${clear}>清空</button>
    </div>
  </div>`;
}

function MyDraft() {
  useCols(['draft']);
  const rec = app.store.get('draft', app.me);
  const ref = useRef();
  const [text, setText] = useState(rec?.text || '');
  const [tab, setTab] = useState(() => localStorage.getItem(`px:${app.me}:dtab`) || 'text');
  const save = useRef(null);
  if (!save.current) save.current = throttle((t) => app.store.put('draft', app.me, { text: t, at: Date.now() }), 700);
  useEffect(() => () => save.current.flush(), []);
  useEffect(() => {
    if (rec && rec.text !== text && document.activeElement !== ref.current) setText(rec.text || '');
  }, [rec && rec.text]);
  const pickTab = (t) => {
    setTab(t);
    localStorage.setItem(`px:${app.me}:dtab`, t);
  };
  return html`<div class=${cx('pad mine', 'p-' + app.me)}>
    <div class="pad-hd">
      <span><${Avatar} who=${app.me} size=${26} /> 我的草稿</span>
      <div class="seg tiny">
        <button type="button" class=${cx(tab === 'text' && 'on')} onClick=${() => pickTab('text')}><${Icon} n="type" size=${14} /> 文字</button>
        <button type="button" class=${cx(tab === 'ink' && 'on')} onClick=${() => pickTab('ink')}><${Icon} n="pen" size=${14} /> 手写</button>
      </div>
    </div>
    ${tab === 'text'
      ? html`<textarea ref=${ref} class="inp pad-ta" maxlength="20000" placeholder="输入草稿" value=${text}
          onInput=${(e) => { setText(e.target.value); save.current(e.target.value); }}></textarea>`
      : html`<${InkPad} />`}
  </div>`;
}

function TaDraft() {
  useCols(['draft', 'ink']);
  const now = useNow(2000);
  const rec = app.store.get('draft', app.partner);
  const ink = app.store.get('ink', app.partner);
  const writing = rec && now - (app.store.rec('draft', app.partner)?.t || 0) < 6000;
  const drawing = ink && now - (app.store.rec('ink', app.partner)?.t || 0) < 6000;
  const hasInk = ink && ink.s && ink.s.length > 0;
  return html`<div class=${cx('pad ta', 'p-' + app.partner)}>
    <div class="pad-hd">
      <span><${Avatar} who=${app.partner} size=${26} /> ${nameOf(app.partner)} 的草稿</span>
      ${(writing || drawing) && html`<span class="typing">${drawing ? '正在画' : '正在写'}<i>.</i><i>.</i><i>.</i></span>`}
    </div>
    ${rec?.text ? html`<div class="pad-view">${rec.text}</div>` : !hasInk && html`<div class="pad-view empty-pad"><${St} id=${stId(app.partner, 'study')} size=${64} title="" /><span class="muted">TA 的草稿还是空白的</span></div>`}
    ${hasInk && html`<${InkView} strokes=${ink.s} />`}
  </div>`;
}

export function Drafts() {
  return html`<section class="card drafts">
    <div class="card-hd"><h3>草稿栏</h3><small class="muted">你们能看到彼此的草稿</small></div>
    <div class="pads">
      <${MyDraft} />
      <${TaDraft} />
    </div>
  </section>`;
}

// ---------- past sessions ----------
function Memories() {
  useCols(['tsess']);
  const list = app.store.list('tsess').sort((a, b) => b.t0 - a.t0).slice(0, 6);
  if (!list.length) return null;
  return html`<section class="card memories">
    <div class="card-hd"><h3>最近的计时记录</h3></div>
    <p class="hint">时段包含休息与暂停。</p>
    <ul class="mem-ul">
      ${list.map((x) => {
        const m = MODES[x.mode] || MODES.study;
        const both = (x.who || []).length > 1;
        return html`<li key=${x.id}><${St} id=${modeSticker(m)} size=${36} title="" /><span>${fmtDay(x.day)} ${fmtHM(x.t0)}</span><span class="muted">${both ? '一起' : `${nameOf((x.who || [])[0] || app.me)} `}${m.label} · 时段 ${fmtMin((x.t1 - x.t0) / 60000)}</span></li>`;
      })}
    </ul>
  </section>`;
}

export function Together({ param }) {
  useCols(['together', 'tjoin']);
  useNow(5000);
  const force = useForce();
  useBus('quiet', force, []);
  const s = session();
  const d = derive(s, Date.now());
  const running = d.state === 'run';
  return html`<div class=${cx('page together', app.focus && 'is-focus')}>
    <div class="page-hd"><div><a class="link sm" href="#/learn">‹ 返回学习分享</a><h2>学习小工具</h2></div></div>
    <div class="grid2">
      <${TaskList} who=${app.me} />
      <${TaskList} who=${app.partner} />
    </div>
    <${Drafts} />
    ${param === 'drafts' && !running ? null : running ? html`<${Running} />` : html`<${Setup} key=${param || 'x'} initial=${param} />`}
    ${!running && html`<${Memories} />`}
  </div>`;
}
