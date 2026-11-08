// 偏心我 · 今天 — 各自的状态、当地时间、专注入口与可选待办
import { html } from '../h.js?v=ad495840f0';
import { useState } from '../../vendor/hooks.js';
import { app, useCols, useNow, useSyncEvent, nameOf, MOODS, moodOf, NEEDS, dayOf, timeOf, zoneOf, localDayLabel, toast, stId, openChat } from '../../lib/ctx.js?v=ad495840f0';
import { derive, session, members, isMember, join, phaseText } from '../../lib/together.js?v=ad495840f0';
import { poke, POKE_KINDS } from '../../lib/feed.js?v=ad495840f0';
import { uid, today, fmtClock, nextOccurrence, cx, fmtDayFull } from '../../lib/util.js?v=ad495840f0';
import { Avatar, Dot, Modal, St, strip } from '../common.js?v=ad495840f0';
import { Icon } from '../icons.js?v=ad495840f0';
import { meetUpcoming, meetInstant } from '../../lib/time.js?v=ad495840f0';

// ---------- status card ----------
function StatusCard({ who }) {
  useCols(['status', 'profile', 'tz']);
  useSyncEvent('presence');
  useNow(30000);
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
        <div class="sc-name">${nameOf(who)} <${Dot} on=${on} /><small class="muted">${mine ? '我' : on ? '在线' : '不在线'}${clock ? ` · ${mine ? '这里' : '那边'} ${clock}` : ''}</small></div>
        <small class="muted sc-zone">${zoneOf(who) ? `${dayOf(who)} · ${zoneOf(who)}` : '当地时间待同步'}</small>
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
  useCols(['together', 'tjoin']);
  useNow(30000);
  const s = session();
  const d = derive(s, Date.now());
  const inS = d.state === 'run' && members(s).includes(app.partner);
  if (!inS) return null;
  return html`<div class="ta-glance">
    ${inS && html`<a class="tg-row" href="#/together"><${Icon} n="together" size=${16} /> 正在${members(s).length > 1 ? '和你一起' : ''}${d.mode.label} · ${phaseText(d)}</a>`}
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
      <div class="card-hd"><h3>有空时一起专注</h3><a class="link sm" href="#/together">设置时长 <${Icon} n="right" size=${14} /></a></div>
      <a class="focus-entry" href="#/together"><${St} id=${stId(app.me, 'study')} size=${72} title="" /><div><b>开一段专注时间</b><small>独自开始，或在空闲重叠时作伴</small></div><${Icon} n="right" /></a>
      <p class="hint">专业不同也没关系，各做各的。可以自己先开始，不要求同时上线。</p>
      <div class="async-links"><a class="chip" href="#/life/meal">各自的饭</a><a class="chip" href="#/life/fit">运动记录</a><a class="chip" href="#/journal">留点生活碎片</a></div>
    </section>`;
  }
  const who = members(s);
  const me = isMember(s);
  return html`<a class=${cx('card together-card live', d.phase)} href="#/together">
    <${St} id=${d.mode.st.startsWith('d-') ? d.mode.st : stId(app.me, d.mode.st)} size=${72} title="" />
    <div class="tc-m"><b>一起${d.mode.label} · ${phaseText(d)}</b><small>${who.length === 2 ? '两个人都在' : who.includes(app.me) ? `你先专注，${nameOf(app.partner)} 有空再来` : `${nameOf(app.partner)} 在专注，有空再加入`}</small></div>
    <span class="tc-c">${fmtClock(d.remaining)}</span>
    ${!me && html`<button class="btn sm" onClick=${(e) => { e.preventDefault(); join(s.sid); location.hash = '#/together'; }}>加入</button>`}
  </a>`;
}

// ---------- optional, subject-neutral tasks ----------

export function TaskList({ who, compact }) {
  useCols(['task', 'tz']);
  useNow(30000);
  const mine = who === app.me;
  const day = dayOf(who);
  const list = app.store.list('task', (x) => x.who === who && (x.day === day || (!x.done && x.day < day))).sort((a, b) => (a.done - b.done) || (a.o || a._t) - (b.o || b._t));
  const [text, setText] = useState('');
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
  const doneN = list.filter((x) => x.done).length;
  return html`<section class=${cx('card tasks', 'p-' + who, compact && 'compact')}>
    <div class="card-hd">
      <h3><${Avatar} who=${who} size=${28} /> ${mine ? '我的待办' : `${nameOf(who)} 的待办`}</h3>
      <span class="muted sm">${list.length ? `${doneN}/${list.length}` : ''}</span>
    </div>
    <p class="hint">${localDayLabel(who, day)} · 按各自当地日期，不要求进度一致</p>
    <ul class="task-ul">
      ${list.map(
        (x) => html`<li key=${x.id} class=${cx('task', x.done && 'done')}>
          <label class="ck"><input type="checkbox" checked=${x.done} disabled=${!mine} onChange=${() => toggle(x)} /><span class="ck-box"></span></label>
          <span class="task-t">${x.text}${x.day < day && !x.done ? html`<small class="muted"> · 之前的</small>` : null}</span>
          ${mine && html`<button class="icon-btn sm" aria-label="删除" onClick=${() => app.store.del('task', x.id)}><${Icon} n="x" size=${14} /></button>`}
        </li>`,
      )}
    </ul>
    ${!list.length && html`<p class="hint">${mine ? '待办可写可不写，按自己的节奏来。' : '暂时没有分享待办，不代表没有在忙。'}</p>`}
    ${mine && html`<form class="row add-row" onSubmit=${add}><input class="inp" maxlength="120" placeholder="加一项任务" value=${text} onInput=${(e) => setText(e.target.value)} /><button class="btn sm" disabled=${!text.trim()}>添加</button></form>`}
  </section>`;
}

// ---------- calendar glance ----------
function CalGlance() {
  useCols(['meet', 'anniv']);
  useNow(30000);
  const now = Date.now();
  const meets = app.store.list('meet').filter((m) => meetUpcoming(m, now)).map((m) => ({ ...m, days: meetInstant(m) == null ? nextOccurrence(m.date, false).days : Math.floor((m.when - now) / 864e5) })).sort((a, b) => a.days - b.days);
  const annivs = app.store.list('anniv').map((a) => ({ ...a, ...nextOccurrence(a.date, a.yearly !== false) })).filter((a) => a.days >= 0).sort((a, b) => a.days - b.days);
  const meet = meets[0];
  const ann = annivs[0];
  if (!meet && !ann) return null;
  return html`<a class="card cal-glance" href="#/cal">
    ${meet && html`<div class="cg"><${St} id="d-five" size=${56} title="" /><div><small>下次见面</small><b>${meet.time && meetInstant(meet) == null ? '时区待确认' : meet.days === 0 ? (meetInstant(meet) == null ? '就是今天' : '不到 1 天') : html`还有 <em>${meet.days}</em> 天`}</b><small class="muted">${meet.note || fmtDayFull(meet.date)}</small></div></div>`}
    ${ann && html`<div class="cg"><${St} id=${stId(app.me, 'cheer')} size=${56} title="" /><div><small>${ann.title}</small><b>${ann.days === 0 ? '就是今天' : html`还有 <em>${ann.days}</em> 天`}</b>${ann.years > 0 && html`<small class="muted">第 ${ann.years} 年</small>`}</div></div>`}
  </a>`;
}

export function Home() {
  useNow(30000);
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
