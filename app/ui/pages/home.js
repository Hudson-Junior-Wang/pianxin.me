// 偏心我 · 首页 — 心情/需求卡、今日目标与任务、做题计数、戳一下、一起模式入口
import { html } from '../h.js?v=efe89b71a3';
import { useState, useEffect, useRef } from '../../vendor/hooks.js';
import { app, useCols, useNow, useSyncEvent, useBus, nameOf, avatarOf, MOODS, NEEDS, dayOf, timeOf, toast } from '../../lib/ctx.js?v=efe89b71a3';
import { derive, session, members, isMember, MODES, join, phaseText } from '../../lib/together.js?v=efe89b71a3';
import { poke, POKE_KINDS } from '../../lib/feed.js?v=efe89b71a3';
import { uid, today, fmtClock, fmtHM, nextOccurrence, cx, fmtDayFull } from '../../lib/util.js?v=efe89b71a3';
import { Avatar, Dot, Modal, Empty } from '../common.js?v=efe89b71a3';

// ---------- status card ----------
function statusLine(st) {
  if (!st) return '';
  const parts = [];
  const m = MOODS.find((v) => v[0] === st.mood);
  if (m) parts.push(m[1]);
  if (st.note) parts.push(st.note);
  return parts.join(' · ');
}

function StatusCard({ who }) {
  useCols(['status', 'profile', 'tz']);
  useSyncEvent('presence');
  const mine = who === app.me;
  const st = app.store.get('status', who);
  const need = st && NEEDS.find((n) => n.k === st.need);
  const [edit, setEdit] = useState(false);
  const on = app.sync.isOnline(who);
  const clock = timeOf(who);
  return html`<section class=${cx('card status-card', 'p-' + who, need && 'need-' + need.k)}>
    <div class="sc-top">
      <${Avatar} who=${who} size=${46} />
      <div class="sc-id">
        <div class="sc-name">${nameOf(who)} <${Dot} on=${on} /> ${clock && html`<small class="muted">· TA 那边 ${clock}</small>`}</div>
        <div class="sc-line">${st?.mood ? html`<span class="sc-mood">${st.mood}</span>` : null}${statusLine(st) || html`<span class="muted">${mine ? '还没写今天的状态' : '还没有状态'}</span>`}</div>
      </div>
      ${mine && html`<button class="btn sm ghost" onClick=${() => setEdit(true)}>改状态</button>`}
    </div>
    ${need
      ? html`<div class="need-banner"><span class="need-i">${need.icon}</span><div><b>${need.label}</b><small>${mine ? need.hint : need.ta}</small></div>
          ${mine && html`<button class="btn xs ghost" onClick=${() => app.store.patch('status', app.me, { need: null })}>取消</button>`}</div>`
      : mine && html`<div class="need-row">${NEEDS.map((n) => html`<button class="chip" onClick=${() => app.store.patch('status', app.me, { need: n.k, at: Date.now() })}><span class="chip-i">${n.icon}</span>${n.label}</button>`)}</div>`}
    ${!mine && need && need.k !== 'quiet' && html`<${NeedActions} need=${need.k} />`}
    ${!mine && html`<${TaGlance} />`}
    ${edit && html`<${StatusEditor} onClose=${() => setEdit(false)} />`}
  </section>`;
}

/** what the other person is up to today (never a score) */
function TaGlance() {
  useCols(['goal', 'together', 'tjoin', 'tz']);
  useNow(30000);
  const s = session();
  const d = derive(s, Date.now());
  const inS = d.state === 'run' && members(s).includes(app.partner);
  const goal = app.store.get('goal', `${app.partner}~${dayOf(app.partner)}`);
  if (!inS && !goal?.text) return null;
  return html`<div class="ta-glance">
    ${inS && html`<a class="tg-row" href="#/together">${d.mode.emoji} 正在${members(s).length > 1 ? '和你一起' : ''}${d.mode.label} · ${phaseText(d)}</a>`}
    ${goal?.text && html`<div class="tg-row">🎯 今天的小目标：<b>${goal.text}</b></div>`}
  </div>`;
}

function NeedActions({ need }) {
  const go = () => (location.hash = '#/together');
  if (need === 'chat') return html`<div class="need-acts"><button class="btn sm" onClick=${go}>💬 去聊天</button><button class="btn sm ghost" onClick=${() => poke('poke') && toast('戳到啦', { icon: '👉' })}>👉 先戳一下</button></div>`;
  if (need === 'comfort') return html`<div class="need-acts"><button class="btn sm" onClick=${() => poke('hug') && toast('抱抱送到啦', { icon: '🫂' })}>🫂 抱抱 TA</button><button class="btn sm ghost" onClick=${go}>💬 说点什么</button></div>`;
  if (need === 'vent') return html`<div class="need-acts"><button class="btn sm" onClick=${() => poke('listen') && toast('TA 知道你在听啦', { icon: '👂' })}>👂 我在听</button><button class="btn sm ghost" onClick=${go}>💬 去听 TA 说</button></div>`;
  return null;
}

function StatusEditor({ onClose }) {
  const st = app.store.get('status', app.me) || {};
  const [mood, setMood] = useState(st.mood || '');
  const [note, setNote] = useState(st.note || '');
  const [need, setNeed] = useState(st.need || null);
  const save = () => {
    app.store.put('status', app.me, { ...st, mood, note: note.trim().slice(0, 40), need, at: Date.now() });
    onClose();
  };
  return html`<${Modal} title="此刻的我" onClose=${onClose}>
    <label class="lbl">心情</label>
    <div class="mood-grid">${MOODS.map(([e, l]) => html`<button class=${cx('mood-b', mood === e && 'on')} onClick=${() => setMood(mood === e ? '' : e)}><span>${e}</span><small>${l}</small></button>`)}</div>
    <label class="lbl">一句话（选填）</label>
    <input class="inp" maxlength="40" placeholder="比如：在图书馆三楼 / 今天有点累" value=${note} onInput=${(e) => setNote(e.target.value)} />
    <label class="lbl">现在需要</label>
    <div class="chips">
      <button class=${cx('chip', !need && 'on')} onClick=${() => setNeed(null)}>都可以</button>
      ${NEEDS.map((n) => html`<button class=${cx('chip', need === n.k && 'on')} onClick=${() => setNeed(n.k)}><span class="chip-i">${n.icon}</span>${n.label}</button>`)}
    </div>
    <p class="hint">选了「想安静」，消息和戳一下就不会响，只是安静地出现在边上。</p>
    <div class="modal-ft"><button class="btn ghost" onClick=${onClose}>取消</button><button class="btn" onClick=${save}>好啦</button></div>
  <//>`;
}

// ---------- poke ----------
export function PokeBar() {
  const [pop, setPop] = useState(0);
  const [more, setMore] = useState(false);
  const send = (k) => {
    if (!poke(k)) return;
    setPop(Date.now());
    setMore(false);
  };
  return html`<div class="poke-bar">
    <button class=${cx('poke-btn', pop && 'pop')} key=${pop} onClick=${() => send('poke')}>
      <span class="poke-i">👉</span><span>戳一下 ${nameOf(app.partner)}</span>
    </button>
    <button class="btn ghost sm" aria-label="更多" onClick=${() => setMore(!more)}>${more ? '收起' : '更多'}</button>
    ${more && html`<div class="poke-more">${Object.entries(POKE_KINDS).filter(([k]) => k !== 'poke').map(([k, v]) => html`<button class="chip" onClick=${() => send(k)}><span class="chip-i">${v.icon}</span>${v.label}</button>`)}</div>`}
  </div>`;
}

// ---------- tasks & question counter ----------
function QuestionCounter({ who, day }) {
  useCols('qc');
  const mine = who === app.me;
  const id = `${who}~${day}`;
  const n = app.store.get('qc', id)?.n || 0;
  const [bump, setBump] = useState(0);
  const add = (d) => {
    const v = Math.max(0, n + d);
    app.store.put('qc', id, { who, day, n: v });
    if (d > 0) setBump(Date.now());
  };
  return html`<div class="qc">
    <span class="qc-l">✏️ 做题</span>
    <b class=${cx('qc-n', bump && 'bump')} key=${bump}>${n}</b><span class="muted">道</span>
    ${mine && html`<span class="qc-btns"><button class="btn xs ghost" disabled=${!n} onClick=${() => add(-1)}>−1</button><button class="btn xs" onClick=${() => add(1)}>做完一道 +1</button></span>`}
  </div>`;
}

export function TaskList({ who }) {
  useCols(['task', 'tz']);
  const mine = who === app.me;
  const day = dayOf(who);
  const list = app.store.list('task', (x) => x.who === who && (x.day === day || (!x.done && x.day < day))).sort((a, b) => (a.done - b.done) || (a.o || a._t) - (b.o || b._t));
  const goal = app.store.get('goal', `${who}~${day}`);
  const [text, setText] = useState('');
  const [editGoal, setEditGoal] = useState(false);
  const [g, setG] = useState('');
  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    app.store.put('task', uid(), { who, day, text: t.slice(0, 120), done: false, o: Date.now() });
    setText('');
  };
  const toggle = (x) => {
    const done = !x.done;
    app.store.put('task', x.id, { ...strip(x), done, doneAt: done ? Date.now() : 0, day: done ? day : x.day });
  };
  const saveGoal = () => {
    app.store.put('goal', `${who}~${day}`, { who, day, text: g.trim().slice(0, 80) });
    setEditGoal(false);
  };
  const doneN = list.filter((x) => x.done).length;
  return html`<section class=${cx('card tasks', 'p-' + who)}>
    <div class="card-hd">
      <h3><${Avatar} who=${who} size=${24} /> ${mine ? '我的今天' : `${nameOf(who)} 的今天`}</h3>
      <span class="muted sm">${list.length ? `${doneN}/${list.length}` : ''}</span>
    </div>
    <div class="goal">
      ${editGoal
        ? html`<form class="row" onSubmit=${(e) => { e.preventDefault(); saveGoal(); }}><input class="inp" autoFocus maxlength="80" placeholder="今天最想完成的一件事" value=${g} onInput=${(e) => setG(e.target.value)} /><button class="btn sm">好</button></form>`
        : html`<div class="goal-t" onClick=${() => { if (mine) { setG(goal?.text || ''); setEditGoal(true); } }}>
            🎯 ${goal?.text ? html`<b>${goal.text}</b>` : html`<span class="muted">${mine ? '点这里写今天的小目标' : '还没写今天的目标'}</span>`}
          </div>`}
    </div>
    <${QuestionCounter} who=${who} day=${day} />
    <ul class="task-ul">
      ${list.map(
        (x) => html`<li key=${x.id} class=${cx('task', x.done && 'done')}>
          <label class="ck"><input type="checkbox" checked=${x.done} disabled=${!mine} onChange=${() => toggle(x)} /><span class="ck-box"></span></label>
          <span class="task-t">${x.text}${x.day < day && !x.done ? html`<small class="muted"> · 之前的</small>` : null}</span>
          ${mine && html`<button class="icon-btn sm" aria-label="删除" onClick=${() => app.store.del('task', x.id)}>✕</button>`}
        </li>`,
      )}
    </ul>
    ${!list.length && html`<p class="hint">${mine ? '写下今天要做的事，勾掉的时候 TA 会收到一个小提示。' : 'TA 还没写任务'}</p>`}
    ${mine && html`<form class="row add-row" onSubmit=${add}><input class="inp" maxlength="120" placeholder="+ 加一项任务" value=${text} onInput=${(e) => setText(e.target.value)} /><button class="btn sm" disabled=${!text.trim()}>添加</button></form>`}
  </section>`;
}

export const strip = (x) => {
  const { id, _t, _by, ...rest } = x;
  return rest;
};

// ---------- together summary ----------
function TogetherMini() {
  useCols(['together', 'tjoin']);
  const now = useNow(1000);
  const s = session();
  const d = derive(s, now);
  if (d.state !== 'run') {
    return html`<a class="card together-mini idle" href="#/together">
      <div><b>一起模式</b><small>自习 · 阅读 · 运动 · 吃饭 · 观影 · 睡觉</small></div>
      <span class="tm-modes">${Object.values(MODES).map((m) => m.emoji).join(' ')}</span>
    </a>`;
  }
  const who = members(s);
  const me = isMember(s);
  return html`<a class=${cx('card together-mini', d.phase)} href="#/together">
    <span class="tm-e">${d.mode.emoji}</span>
    <div class="tm-m"><b>一起${d.mode.label} · ${phaseText(d)}</b><small>${who.map((w) => avatarOf(w)).join(' ')} ${who.length === 2 ? '你们在一起' : who.includes(app.me) ? '等 TA 加入' : `${nameOf(app.partner)} 在等你`}</small></div>
    <span class="tm-c">${fmtClock(d.remaining)}</span>
    ${!me && html`<button class="btn sm" onClick=${(e) => { e.preventDefault(); join(); location.hash = '#/together'; }}>加入</button>`}
  </a>`;
}

// ---------- little calendar glance ----------
function CalGlance() {
  useCols(['meet', 'anniv']);
  const meets = app.store.list('meet').map((m) => ({ ...m, days: nextOccurrence(m.date, false).days })).filter((m) => m.days >= 0).sort((a, b) => a.days - b.days);
  const annivs = app.store.list('anniv').map((a) => ({ ...a, ...nextOccurrence(a.date, a.yearly !== false) })).filter((a) => a.days >= 0).sort((a, b) => a.days - b.days);
  const meet = meets[0];
  const ann = annivs[0];
  if (!meet && !ann) return null;
  return html`<a class="card cal-glance" href="#/cal">
    ${meet && html`<div class="cg"><span class="cg-e">🚄</span><div><small>见面倒计时</small><b>${meet.days === 0 ? '就是今天！' : html`还有 <em>${meet.days}</em> 天`}</b><small class="muted">${meet.note || fmtDayFull(meet.date)}</small></div></div>`}
    ${ann && html`<div class="cg"><span class="cg-e">${ann.emoji || '💝'}</span><div><small>${ann.title}</small><b>${ann.days === 0 ? '就是今天' : html`还有 <em>${ann.days}</em> 天`}</b>${ann.years > 0 && html`<small class="muted">第 ${ann.years} 年</small>`}</div></div>`}
  </a>`;
}

export function Home() {
  const hour = new Date().getHours();
  const hi = hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  return html`<div class="page home">
    <div class="hello"><h2>${hi}，${nameOf(app.me)}</h2><span class="muted">${fmtDayFull(today())}</span></div>
    <div class="grid2">
      <${StatusCard} who=${app.partner} />
      <${StatusCard} who=${app.me} />
    </div>
    <${PokeBar} />
    <${TogetherMini} />
    <${CalGlance} />
    <div class="grid2">
      <${TaskList} who=${app.me} />
      <${TaskList} who=${app.partner} />
    </div>
  </div>`;
}
