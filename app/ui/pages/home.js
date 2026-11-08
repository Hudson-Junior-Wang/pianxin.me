// 偏心我 · 今天 — 两个人的状态卡、戳一下、一起模式入口、今天的小目标与任务
import { html } from '../h.js?v=575a878181';
import { useState } from '../../vendor/hooks.js';
import { app, useCols, useNow, useSyncEvent, nameOf, MOODS, moodOf, NEEDS, dayOf, timeOf, toast, stId, openChat } from '../../lib/ctx.js?v=575a878181';
import { derive, session, members, isMember, MODES, MODE_KEYS, join, phaseText } from '../../lib/together.js?v=575a878181';
import { poke, POKE_KINDS } from '../../lib/feed.js?v=575a878181';
import { uid, today, fmtClock, nextOccurrence, cx, fmtDayFull } from '../../lib/util.js?v=575a878181';
import { Avatar, Dot, Modal, St, strip } from '../common.js?v=575a878181';
import { Icon } from '../icons.js?v=575a878181';

// ---------- status card ----------
function StatusCard({ who }) {
  useCols(['status', 'profile', 'tz']);
  useSyncEvent('presence');
  const mine = who === app.me;
  const st = app.store.get('status', who);
  const mood = st && moodOf(st.mood);
  const need = st && NEEDS.find((n) => n.k === st.need);
  const [edit, setEdit] = useState(false);
  const on = app.sync.isOnline(who);
  const clock = timeOf(who);
  const face = need ? need.st : mood ? mood.st : 'hi';
  return html`<section class=${cx('card status-card', 'p-' + who, need && 'need-' + need.k)}>
    <div class="sc-main">
      <div class="sc-st"><${St} id=${stId(who, face)} size=${96} /></div>
      <div class="sc-id">
        <div class="sc-name">${nameOf(who)} <${Dot} on=${on} /><small class="muted">${mine ? '我' : on ? '在线' : '不在线'}${clock ? ` · 那边 ${clock}` : ''}</small></div>
        <div class="sc-line">
          ${mood ? html`<span class="tag mood">${mood.label}</span>` : null}
          ${st?.note ? html`<span class="sc-note">${st.note}</span>` : !mood && html`<span class="muted">${mine ? '还没写现在的状态' : '还没有状态'}</span>`}
        </div>
        ${need && html`<div class="sc-need"><b>${need.label}</b><small>${mine ? need.hint : need.ta}</small></div>`}
      </div>
      ${mine && html`<button class="btn sm ghost sc-edit" onClick=${() => setEdit(true)}>改状态</button>`}
    </div>
    ${mine && !need && html`<div class="need-row">${NEEDS.map((n) => html`<button class="chip" onClick=${() => app.store.patch('status', app.me, { need: n.k, at: Date.now() })}>${n.label}</button>`)}</div>`}
    ${mine && need && html`<div class="need-row"><button class="chip" onClick=${() => app.store.patch('status', app.me, { need: null })}>不需要了</button></div>`}
    ${!mine && need && need.k !== 'quiet' && html`<${NeedActions} need=${need.k} />`}
    ${!mine && html`<${TaGlance} />`}
    ${edit && html`<${StatusEditor} onClose=${() => setEdit(false)} />`}
  </section>`;
}

/** what the other person is up to right now (never a score) */
function TaGlance() {
  useCols(['goal', 'together', 'tjoin', 'tz']);
  useNow(30000);
  const s = session();
  const d = derive(s, Date.now());
  const inS = d.state === 'run' && members(s).includes(app.partner);
  const goal = app.store.get('goal', `${app.partner}~${dayOf(app.partner)}`);
  if (!inS && !goal?.text) return null;
  return html`<div class="ta-glance">
    ${inS && html`<a class="tg-row" href="#/together"><${Icon} n="together" size=${16} /> 正在${members(s).length > 1 ? '和你一起' : ''}${d.mode.label} · ${phaseText(d)}</a>`}
    ${goal?.text && html`<div class="tg-row"><${Icon} n="pin" size=${16} /> 今天的小目标：<b>${goal.text}</b></div>`}
  </div>`;
}

function NeedActions({ need }) {
  const send = (k, msg) => poke(k) && toast(msg, { icon: stId(app.me, POKE_KINDS[k].st), kind: 'soft', ms: 2400 });
  if (need === 'chat') return html`<div class="need-acts"><button class="btn sm" onClick=${openChat}><${Icon} n="chat" size=${16} /> 去聊天</button><button class="btn sm ghost" onClick=${() => send('hi', '打过招呼啦')}>打个招呼</button></div>`;
  if (need === 'comfort') return html`<div class="need-acts"><button class="btn sm" onClick=${() => send('pat', '拍拍送到啦')}>拍拍 TA</button><button class="btn sm ghost" onClick=${openChat}>说点什么</button></div>`;
  if (need === 'vent') return html`<div class="need-acts"><button class="btn sm" onClick=${() => send('listen', 'TA 知道你在听啦')}>我在听</button><button class="btn sm ghost" onClick=${openChat}>去听 TA 说</button></div>`;
  return null;
}

function StatusEditor({ onClose }) {
  const st = app.store.get('status', app.me) || {};
  const [mood, setMood] = useState(moodOf(st.mood)?.k || '');
  const [note, setNote] = useState(st.note || '');
  const [need, setNeed] = useState(st.need || null);
  const save = () => {
    app.store.put('status', app.me, { ...st, mood, note: note.trim().slice(0, 40), need, at: Date.now() });
    onClose();
  };
  return html`<${Modal} title="现在的我" onClose=${onClose}>
    <label class="lbl">心情</label>
    <div class="mood-grid">${MOODS.map((m) => html`<button class=${cx('mood-b', mood === m.k && 'on')} onClick=${() => setMood(mood === m.k ? '' : m.k)}><${St} id=${stId(app.me, m.st)} size=${48} title="" /><small>${m.label}</small></button>`)}</div>
    <label class="lbl">一句话（选填）</label>
    <input class="inp" maxlength="40" placeholder="比如：在图书馆三楼 / 今天有点累" value=${note} onInput=${(e) => setNote(e.target.value)} />
    <label class="lbl">现在需要</label>
    <div class="chips">
      <button class=${cx('chip', !need && 'on')} onClick=${() => setNeed(null)}>都可以</button>
      ${NEEDS.map((n) => html`<button class=${cx('chip', need === n.k && 'on')} onClick=${() => setNeed(n.k)}>${n.label}</button>`)}
    </div>
    <p class="hint">选了「想安静」，消息和戳一下就不会响，只是安静地出现在边上。</p>
    <div class="modal-ft"><button class="btn ghost" onClick=${onClose}>取消</button><button class="btn" onClick=${save}>好啦</button></div>
  <//>`;
}

// ---------- nudges ----------
export function PokeRow() {
  const [pop, setPop] = useState('');
  const send = (k) => {
    if (!poke(k)) return;
    setPop(k + Date.now());
    toast(`${POKE_KINDS[k].label}送到啦`, { icon: stId(app.me, POKE_KINDS[k].st), kind: 'soft', ms: 1800 });
  };
  return html`<section class="card poke-card">
    <div class="card-hd"><h3>戳一下 ${nameOf(app.partner)}</h3><small class="muted">会在 TA 屏幕边上冒出来</small></div>
    <div class="poke-row">
      ${Object.entries(POKE_KINDS).map(([k, v]) => html`<button type="button" class=${cx('poke-b', pop.startsWith(k) && 'pop')} key=${k + (pop.startsWith(k) ? pop : '')} onClick=${() => send(k)}>
        <${St} id=${stId(app.me, v.st)} size=${64} title="" /><span>${v.label}</span>
      </button>`)}
    </div>
  </section>`;
}

// ---------- together entry ----------
function TogetherCard() {
  useCols(['together', 'tjoin']);
  const now = useNow(1000);
  const s = session();
  const d = derive(s, now);
  if (d.state !== 'run') {
    return html`<section class="card together-card idle">
      <div class="card-hd"><h3>一起模式</h3><a class="link sm" href="#/together">设置时长 <${Icon} n="right" size=${14} /></a></div>
      <div class="mode-strip">
        ${MODE_KEYS.map((k) => html`<a class="ms-b" href=${'#/together/' + k}><${St} id=${MODES[k].st.startsWith('d-') ? MODES[k].st : stId(app.me, MODES[k].st)} size=${56} title="" /><span>${MODES[k].label}</span></a>`)}
      </div>
      <p class="hint">同一个计时，各做各的，彼此作伴。</p>
    </section>`;
  }
  const who = members(s);
  const me = isMember(s);
  return html`<a class=${cx('card together-card live', d.phase)} href="#/together">
    <${St} id=${d.mode.st.startsWith('d-') ? d.mode.st : stId(app.me, d.mode.st)} size=${72} title="" />
    <div class="tc-m"><b>一起${d.mode.label} · ${phaseText(d)}</b><small>${who.length === 2 ? '两个人都在' : who.includes(app.me) ? `等 ${nameOf(app.partner)} 加入` : `${nameOf(app.partner)} 开始了，要来吗？`}</small></div>
    <span class="tc-c">${fmtClock(d.remaining)}</span>
    ${!me && html`<button class="btn sm" onClick=${(e) => { e.preventDefault(); join(); location.hash = '#/together'; }}>加入</button>`}
  </a>`;
}

// ---------- tasks & question counter ----------
function QuestionCounter({ who, day }) {
  useCols('qc');
  const mine = who === app.me;
  const id = `${who}~${day}`;
  const n = app.store.get('qc', id)?.n || 0;
  const [bump, setBump] = useState(0);
  const add = (d) => {
    const currentDay = dayOf(who);
    const currentId = `${who}~${currentDay}`;
    const v = Math.max(0, (app.store.get('qc', currentId)?.n || 0) + d);
    app.store.put('qc', currentId, { who, day: currentDay, n: v });
    if (d > 0) setBump(Date.now());
  };
  return html`<div class="qc">
    <span class="qc-l">做题</span>
    <b class=${cx('qc-n', bump && 'bump')} key=${bump}>${n}</b><span class="muted">道</span>
    ${mine && html`<span class="qc-btns"><button class="btn xs ghost" disabled=${!n} onClick=${() => add(-1)}>−1</button><button class="btn xs" onClick=${() => add(1)}>做完一道 +1</button></span>`}
  </div>`;
}

export function TaskList({ who, compact }) {
  useCols(['task', 'tz', 'goal']);
  useNow(30000);
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
    app.store.put('task', uid(), { who, day: dayOf(who), text: t.slice(0, 120), done: false, o: Date.now() });
    setText('');
  };
  const toggle = (x) => {
    const done = !x.done;
    app.store.put('task', x.id, { ...strip(x), done, doneAt: done ? Date.now() : 0, day: done ? dayOf(who) : x.day });
  };
  const saveGoal = () => {
    const currentDay = dayOf(who);
    app.store.put('goal', `${who}~${currentDay}`, { who, day: currentDay, text: g.trim().slice(0, 80) });
    setEditGoal(false);
  };
  const doneN = list.filter((x) => x.done).length;
  return html`<section class=${cx('card tasks', 'p-' + who, compact && 'compact')}>
    <div class="card-hd">
      <h3><${Avatar} who=${who} size=${28} /> ${mine ? '我的今天' : `${nameOf(who)} 的今天`}</h3>
      <span class="muted sm">${list.length ? `${doneN}/${list.length}` : ''}</span>
    </div>
    <div class="goal">
      ${editGoal
        ? html`<form class="row" onSubmit=${(e) => { e.preventDefault(); saveGoal(); }}><input class="inp" autoFocus maxlength="80" placeholder="今天最想完成的一件事" value=${g} onInput=${(e) => setG(e.target.value)} /><button class="btn sm">好</button></form>`
        : html`<div class=${cx('goal-t', mine && 'editable')} onClick=${() => { if (mine) { setG(goal?.text || ''); setEditGoal(true); } }}>
            <${Icon} n="pin" size=${16} /> ${goal?.text ? html`<b>${goal.text}</b>` : html`<span class="muted">${mine ? '点这里写今天的小目标' : '还没写今天的目标'}</span>`}
          </div>`}
    </div>
    <${QuestionCounter} who=${who} day=${day} />
    <ul class="task-ul">
      ${list.map(
        (x) => html`<li key=${x.id} class=${cx('task', x.done && 'done')}>
          <label class="ck"><input type="checkbox" checked=${x.done} disabled=${!mine} onChange=${() => toggle(x)} /><span class="ck-box"></span></label>
          <span class="task-t">${x.text}${x.day < day && !x.done ? html`<small class="muted"> · 之前的</small>` : null}</span>
          ${mine && html`<button class="icon-btn sm" aria-label="删除" onClick=${() => app.store.del('task', x.id)}><${Icon} n="x" size=${14} /></button>`}
        </li>`,
      )}
    </ul>
    ${!list.length && html`<p class="hint">${mine ? '写下今天要做的事，勾掉的时候 TA 会收到一个小提示。' : 'TA 还没写任务'}</p>`}
    ${mine && html`<form class="row add-row" onSubmit=${add}><input class="inp" maxlength="120" placeholder="加一项任务" value=${text} onInput=${(e) => setText(e.target.value)} /><button class="btn sm" disabled=${!text.trim()}>添加</button></form>`}
  </section>`;
}

// ---------- calendar glance ----------
function CalGlance() {
  useCols(['meet', 'anniv']);
  const meets = app.store.list('meet').map((m) => ({ ...m, days: nextOccurrence(m.date, false).days })).filter((m) => m.days >= 0).sort((a, b) => a.days - b.days);
  const annivs = app.store.list('anniv').map((a) => ({ ...a, ...nextOccurrence(a.date, a.yearly !== false) })).filter((a) => a.days >= 0).sort((a, b) => a.days - b.days);
  const meet = meets[0];
  const ann = annivs[0];
  if (!meet && !ann) return null;
  return html`<a class="card cal-glance" href="#/cal">
    ${meet && html`<div class="cg"><${St} id="d-five" size=${56} title="" /><div><small>下次见面</small><b>${meet.days === 0 ? '就是今天' : html`还有 <em>${meet.days}</em> 天`}</b><small class="muted">${meet.note || fmtDayFull(meet.date)}</small></div></div>`}
    ${ann && html`<div class="cg"><${St} id=${stId(app.me, 'cheer')} size=${56} title="" /><div><small>${ann.title}</small><b>${ann.days === 0 ? '就是今天' : html`还有 <em>${ann.days}</em> 天`}</b>${ann.years > 0 && html`<small class="muted">第 ${ann.years} 年</small>`}</div></div>`}
  </a>`;
}

export function Home() {
  const hour = new Date().getHours();
  const hi = hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  return html`<div class="page home">
    <div class="page-hd"><div><h2>${hi}，${nameOf(app.me)}</h2><span class="muted">${fmtDayFull(today())}</span></div></div>
    <div class="grid2">
      <${StatusCard} who=${app.partner} />
      <${StatusCard} who=${app.me} />
    </div>
    <${TogetherCard} />
    <${PokeRow} />
    <${CalGlance} />
    <div class="grid2">
      <${TaskList} who=${app.me} />
      <${TaskList} who=${app.partner} />
    </div>
  </div>`;
}
