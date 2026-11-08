// 偏心我 · 日历 — 下次见面、重要的日子、一起的计划、点子罐
import { html } from '../h.js?v=575a878181';
import { useState } from '../../vendor/hooks.js';
import { app, useCols, useNow, nameOf, toast, stId } from '../../lib/ctx.js?v=575a878181';
import { uid, today, nextOccurrence, diffDays, fmtDay, fmtDayFull, dayKey, parseDay, pad2, addMonths, cx, pick } from '../../lib/util.js?v=575a878181';
import { Avatar, Modal, Empty, St, confirmDel, AutoText, strip } from '../common.js?v=575a878181';
import { Icon } from '../icons.js?v=575a878181';

const DAY_EMOJI = ['🎂', '🎓', '📝', '✈️', '🎉', '🏠', '🐾', '⭐', '🍰', '📅'];

// ---------- next meet-up ----------
function MeetCard() {
  useCols('meet');
  const now = useNow(1000);
  const [form, setForm] = useState(false);
  const t = today();
  const list = app.store.list('meet').sort((a, b) => (a.date > b.date ? 1 : -1));
  const next = list.find((m) => m.date >= t);
  const past = list.filter((m) => m.date < t).slice(-3).reverse();
  let main = null;
  if (next) {
    const target = parseDay(next.date);
    if (next.time) {
      const [h, mi] = next.time.split(':').map(Number);
      target.setHours(h, mi, 0, 0);
    }
    const ms = target - now;
    const days = diffDays(t, next.date);
    main = html`<div class="meet-main">
      <${St} id="d-five" size=${96} title="" />
      <div class="meet-big">${days > 0 ? html`还有 <em>${days}</em> 天` : ms > 0 && next.time ? html`今天！还有 <em>${Math.floor(ms / 3600000)}</em> 小时 <em>${Math.floor((ms % 3600000) / 60000)}</em> 分` : html`<em>就是今天</em>`}</div>
      <div class="meet-sub">${fmtDayFull(next.date)}${next.time ? ' ' + next.time : ''}${next.where ? ` · ${next.where}` : ''}</div>
      ${next.note && html`<div class="meet-note">${next.note}</div>`}
      <div class="row center">
        <button class="btn xs ghost" onClick=${() => setForm({ edit: next })}>改一下</button>
        <button class="btn xs ghost" onClick=${() => confirmDel('删除这次见面？') && app.store.del('meet', next.id)}>删除</button>
      </div>
    </div>`;
  }
  return html`<section class="card meet">
    <div class="card-hd"><h3>下次见面</h3><button class="btn xs" onClick=${() => setForm({})}><${Icon} n="plus" size=${14} /> 定个日子</button></div>
    ${main || html`<${Empty} st="hi" text="下次什么时候见？定个日子，一起倒数" />`}
    ${past.length > 0 && html`<div class="meet-past"><small class="muted">之前见过：${past.map((m) => fmtDay(m.date)).join('、')}</small></div>`}
    ${form && html`<${MeetForm} edit=${form.edit} onClose=${() => setForm(false)} />`}
  </section>`;
}

function MeetForm({ edit, onClose }) {
  const [date, setDate] = useState(edit ? edit.date : '');
  const [time, setTime] = useState(edit ? edit.time || '' : '');
  const [where, setWhere] = useState(edit ? edit.where || '' : '');
  const [note, setNote] = useState(edit ? edit.note || '' : '');
  const save = () => {
    if (!date) return;
    const data = { date, time, where: where.trim().slice(0, 60), note: note.trim().slice(0, 200), who: edit ? edit.who : app.me };
    app.store.put('meet', edit ? edit.id : uid(), edit ? { ...strip(edit), ...data } : data);
    onClose();
  };
  return html`<${Modal} title="下次见面" onClose=${onClose}>
    <label class="lbl">日期</label><input class="inp" type="date" value=${date} onInput=${(e) => setDate(e.target.value)} />
    <label class="lbl">时间（选填）</label><input class="inp" type="time" value=${time} onInput=${(e) => setTime(e.target.value)} />
    <label class="lbl">在哪（选填）</label><input class="inp" maxlength="60" placeholder="比如：图书馆门口 / 地铁站" value=${where} onInput=${(e) => setWhere(e.target.value)} />
    <label class="lbl">备注（选填）</label><input class="inp" maxlength="200" placeholder="比如：记得带上那本书" value=${note} onInput=${(e) => setNote(e.target.value)} />
    <div class="modal-ft"><button class="btn ghost" onClick=${onClose}>取消</button><button class="btn" disabled=${!date} onClick=${save}>好</button></div>
  <//>`;
}

// ---------- important days ----------
function DayForm({ edit, onClose }) {
  const [title, setTitle] = useState(edit ? edit.title : '');
  const [date, setDate] = useState(edit ? edit.date : '');
  const [yearly, setYearly] = useState(edit ? edit.yearly !== false : true);
  const [emoji, setEmoji] = useState(edit?.emoji || '📅');
  const save = () => {
    if (!title.trim() || !date) return;
    const data = { title: title.trim().slice(0, 40), date, yearly, emoji, who: edit ? edit.who : app.me };
    app.store.put('anniv', edit ? edit.id : uid(), edit ? { ...strip(edit), ...data } : data);
    onClose();
  };
  return html`<${Modal} title=${edit ? '改一下' : '加一个重要的日子'} onClose=${onClose}>
    <div class="emo-pick">${DAY_EMOJI.map((e) => html`<button type="button" class=${cx(emoji === e && 'on')} onClick=${() => setEmoji(e)}>${e}</button>`)}</div>
    <label class="lbl">名字</label><input class="inp" maxlength="40" placeholder="TA 的生日 / 期末考试 / 认识的那天" value=${title} onInput=${(e) => setTitle(e.target.value)} />
    <label class="lbl">日期</label><input class="inp" type="date" value=${date} onInput=${(e) => setDate(e.target.value)} />
    <label class="check"><input type="checkbox" checked=${yearly} onChange=${(e) => setYearly(e.target.checked)} /> 每年都提醒（比如生日）</label>
    <div class="modal-ft"><button class="btn ghost" onClick=${onClose}>取消</button><button class="btn" disabled=${!title.trim() || !date} onClick=${save}>好</button></div>
  <//>`;
}

function Days() {
  useCols('anniv');
  const [form, setForm] = useState(null);
  const t = today();
  const list = app.store.list('anniv').map((a) => {
    const n = nextOccurrence(a.date, a.yearly !== false);
    const since = diffDays(a.date, t);
    return { ...a, ...n, since };
  }).sort((a, b) => (a.days < 0) - (b.days < 0) || (a.days >= 0 ? a.days - b.days : b.days - a.days));
  return html`<section class="card annivs">
    <div class="card-hd"><h3>重要的日子</h3><button class="btn xs" onClick=${() => setForm({})}><${Icon} n="plus" size=${14} /> 添加</button></div>
    ${list.length ? html`<ul class="anniv-ul">${list.map((a) => html`<li key=${a.id} class=${cx(a.days === 0 && 'today')}>
      <span class="anniv-e">${a.emoji || '📅'}</span>
      <div class="anniv-m">
        <b>${a.title}</b>
        <small class="muted">${fmtDayFull(a.date)}${a.yearly !== false && a.years > 0 ? ` · 第 ${a.years} 年` : ''}${a.since > 0 ? ` · 已经 ${a.since} 天` : ''}</small>
      </div>
      <span class="anniv-d">${a.days === 0 ? html`<em>今天</em>` : a.days > 0 ? html`<em>${a.days}</em><small>天后</small>` : html`<small>已过去</small>`}</span>
      <span class="anniv-ops"><button class="icon-btn xs" aria-label="编辑" onClick=${() => setForm({ edit: a })}><${Icon} n="edit" size=${14} /></button><button class="icon-btn xs" aria-label="删除" onClick=${() => confirmDel(`删除「${a.title}」？`) && app.store.del('anniv', a.id)}><${Icon} n="x" size=${14} /></button></span>
    </li>`)}</ul>` : html`<${Empty} st="idea" text="生日、考试、出发的日子…都可以记下来" />`}
    ${form && html`<${DayForm} edit=${form.edit} onClose=${() => setForm(null)} />`}
  </section>`;
}

// ---------- shared plans ----------
function PlanForm({ edit, date0, onClose }) {
  const [title, setTitle] = useState(edit ? edit.title : '');
  const [date, setDate] = useState(edit ? edit.date || '' : date0 || '');
  const [note, setNote] = useState(edit ? edit.note || '' : '');
  const save = () => {
    if (!title.trim()) return;
    const data = { title: title.trim().slice(0, 60), date, note: note.trim().slice(0, 500), who: edit ? edit.who : app.me, done: edit ? !!edit.done : false };
    app.store.put('plan', edit ? edit.id : uid(), edit ? { ...strip(edit), ...data } : data);
    onClose();
  };
  return html`<${Modal} title=${edit ? '改计划' : '一起的计划'} onClose=${onClose}>
    <label class="lbl">要一起做什么</label><input class="inp" maxlength="60" placeholder="一起去图书馆 / 周末去爬山 / 学会做蛋糕" value=${title} onInput=${(e) => setTitle(e.target.value)} />
    <label class="lbl">哪天（选填，不填就是“总有一天”）</label><input class="inp" type="date" value=${date} onInput=${(e) => setDate(e.target.value)} />
    <label class="lbl">备注（选填）</label><${AutoText} value=${note} onInput=${setNote} rows=${2} maxLength=${500} placeholder="要带什么、怎么去…" />
    <div class="modal-ft"><button class="btn ghost" onClick=${onClose}>取消</button><button class="btn" disabled=${!title.trim()} onClick=${save}>好</button></div>
  <//>`;
}

function MonthGrid({ ym, setYm, marks, onPick }) {
  const [y, m] = ym.split('-').map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${ym}-${pad2(d)}`);
  while (cells.length % 7) cells.push(null);
  const t = today();
  return html`<div class="mini-cal">
    <div class="cal-hd">
      <button class="icon-btn" aria-label="上个月" onClick=${() => setYm(addMonths(ym, -1))}><${Icon} n="left" size=${18} /></button>
      <b>${y} 年 ${m} 月</b>
      <button class="icon-btn" aria-label="下个月" onClick=${() => setYm(addMonths(ym, 1))}><${Icon} n="right" size=${18} /></button>
    </div>
    <div class="cal-grid">
      ${['一', '二', '三', '四', '五', '六', '日'].map((w) => html`<div class="cal-w">${w}</div>`)}
      ${cells.map((d) => (d ? html`<button type="button" class=${cx('cal-c', d === t && 'today', marks.has(d) && 'has')} onClick=${() => onPick(d)}>
        <span class="cal-n">${Number(d.slice(8))}</span>${marks.has(d) && html`<span class="cal-marks">${marks.get(d).slice(0, 3).map((k) => html`<i class=${'mk-' + k}></i>`)}</span>`}
      </button>` : html`<div class="cal-c empty"></div>`))}
    </div>
    <p class="hint cal-legend"><i class="mk mk-plan"></i> 计划 <i class="mk mk-meet"></i> 见面 <i class="mk mk-day"></i> 重要的日子</p>
  </div>`;
}

function Plans() {
  useCols(['plan', 'meet', 'anniv']);
  const [form, setForm] = useState(null);
  const [ym, setYm] = useState(today().slice(0, 7));
  const [showDone, setShowDone] = useState(false);
  const t = today();
  const plans = app.store.list('plan');
  const marks = new Map();
  const mark = (d, k) => {
    if (!d) return;
    if (!marks.has(d)) marks.set(d, []);
    marks.get(d).push(k);
  };
  for (const p of plans) if (!p.done) mark(p.date, 'plan');
  for (const m of app.store.list('meet')) mark(m.date, 'meet');
  for (const a of app.store.list('anniv')) {
    if (a.yearly !== false) {
      const [, mm, dd] = a.date.split('-');
      if (ym.slice(5) === mm) mark(`${ym}-${dd}`, 'day');
    } else mark(a.date, 'day');
  }
  const todo = plans.filter((p) => !p.done).sort((a, b) => ((a.date || '9999') > (b.date || '9999') ? 1 : -1));
  const done = plans.filter((p) => p.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const toggle = (p) => app.store.put('plan', p.id, { ...strip(p), done: !p.done, doneAt: p.done ? 0 : Date.now() });
  return html`<section class="card plans">
    <div class="card-hd"><h3>一起的计划</h3><button class="btn xs" onClick=${() => setForm({})}><${Icon} n="plus" size=${14} /> 计划</button></div>
    <${MonthGrid} ym=${ym} setYm=${setYm} marks=${marks} onPick=${(d) => setForm({ date: d })} />
    ${todo.length ? html`<ul class="plan-ul">${todo.map((p) => html`<li key=${p.id} class=${cx(p.date && p.date < t && 'late')}>
      <label class="ck"><input type="checkbox" checked=${false} onChange=${() => toggle(p)} /><span class="ck-box"></span></label>
      <div class="plan-m" onClick=${() => setForm({ edit: p })}>
        <b>${p.title}</b>
        <small class="muted">${p.date ? fmtDay(p.date) : '总有一天'}${p.note ? ' · ' + p.note : ''}</small>
      </div>
      <${Avatar} who=${p.who} size=${24} />
      <button class="icon-btn xs" aria-label="删除" onClick=${() => confirmDel(`删除「${p.title}」？`) && app.store.del('plan', p.id)}><${Icon} n="x" size=${14} /></button>
    </li>`)}</ul>` : html`<p class="hint">点日历上的某一天，就能加一个一起的计划。</p>`}
    ${done.length > 0 && html`<button class="link sm" onClick=${() => setShowDone(!showDone)}>${showDone ? '收起' : `一起做到的 ${done.length} 件事`}</button>`}
    ${showDone && html`<ul class="plan-ul done">${done.map((p) => html`<li key=${p.id}>
      <label class="ck"><input type="checkbox" checked=${true} onChange=${() => toggle(p)} /><span class="ck-box"></span></label>
      <div class="plan-m"><b>${p.title}</b><small class="muted">${p.doneAt ? fmtDay(dayKey(p.doneAt)) : ''}</small></div>
    </li>`)}</ul>`}
    ${form && html`<${PlanForm} edit=${form.edit} date0=${form.date} onClose=${() => setForm(null)} />`}
  </section>`;
}

// ---------- idea jar ----------
function IdeaJar() {
  useCols('idea');
  const [text, setText] = useState('');
  const [shake, setShake] = useState(0);
  const [drawn, setDrawn] = useState(null);
  const [showUsed, setShowUsed] = useState(false);
  const all = app.store.list('idea');
  const inJar = all.filter((x) => !x.drawn);
  const used = all.filter((x) => x.drawn).sort((a, b) => (b.drawnAt || 0) - (a.drawnAt || 0));
  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    app.store.put('idea', uid(), { text: t.slice(0, 120), who: app.me, at: Date.now() });
    setText('');
    toast('放进罐子里啦，摇到之前谁也看不到', { icon: stId(app.me, 'idea') });
  };
  const draw = () => {
    if (!inJar.length) return;
    setShake(Date.now());
    setDrawn(null);
    setTimeout(() => {
      const x = pick(inJar);
      app.store.put('idea', x.id, { ...strip(x), drawn: true, drawnAt: Date.now(), drawnBy: app.me });
      setDrawn(x);
    }, 900);
  };
  return html`<section class="card jar">
    <div class="card-hd"><h3>点子罐</h3><small class="muted">罐子里有 ${inJar.length} 个点子</small></div>
    <div class="jar-body">
      <button type="button" class=${cx('jar-pot', shake && 'shake')} key=${shake} onClick=${draw} disabled=${!inJar.length} aria-label="摇一摇">
        <span class="jar-glass">${inJar.slice(0, 12).map((x, i) => html`<i class=${'paper p-' + x.who} style=${`--i:${i}`}></i>`)}</span>
        <span class="jar-lid"></span>
      </button>
      <div class="jar-side">
        ${drawn
          ? html`<div class="jar-note"><small class="muted">${nameOf(drawn.who)} 写的：</small><b>${drawn.text}</b>
              <div class="row"><button class="btn xs" onClick=${() => { app.store.put('plan', uid(), { title: drawn.text, date: '', note: '从点子罐里摇出来的', who: app.me, done: false }); toast('放进一起的计划啦', { icon: stId(app.me, 'ok') }); setDrawn(null); }}>加进计划</button>
              <button class="btn xs ghost" onClick=${() => { app.store.put('idea', drawn.id, { ...strip(drawn), drawn: false, drawnAt: 0 }); setDrawn(null); }}>放回去</button></div></div>`
          : html`<div class="jar-tip"><${St} id=${stId(app.me, inJar.length ? 'idea' : 'what')} size=${64} title="" /><p class="muted">${inJar.length ? '周末不知道做什么？点罐子摇一个！' : '罐子空空的，先放几个点子进去吧'}</p></div>`}
      </div>
    </div>
    <form class="row" onSubmit=${add}>
      <input class="inp" maxlength="120" placeholder="写一个点子：一起拼乐高 / 去吃那家火锅…" value=${text} onInput=${(e) => setText(e.target.value)} />
      <button class="btn" disabled=${!text.trim()}>放进去</button>
    </form>
    ${used.length > 0 && html`<button class="link sm" onClick=${() => setShowUsed(!showUsed)}>${showUsed ? '收起' : `摇出来过的 ${used.length} 个点子`}</button>`}
    ${showUsed && html`<ul class="idea-used">${used.map((x) => html`<li key=${x.id}><${Avatar} who=${x.who} size=${22} />${x.text}
      <span class="sp"></span>
      <button class="icon-btn xs" title="放回罐子" onClick=${() => app.store.put('idea', x.id, { ...strip(x), drawn: false, drawnAt: 0 })}><${Icon} n="refresh" size=${14} /></button>
      <button class="icon-btn xs" aria-label="删除" onClick=${() => confirmDel('删除这个点子？') && app.store.del('idea', x.id)}><${Icon} n="x" size=${14} /></button></li>`)}</ul>`}
  </section>`;
}

export function Cal() {
  return html`<div class="page calpage">
    <div class="page-hd"><h2>日历</h2><small class="muted">见面、重要的日子、一起的计划</small></div>
    <div class="cols">
      <div class="col-a">
        <${MeetCard} />
        <${Plans} />
      </div>
      <div class="col-b">
        <${Days} />
        <${IdeaJar} />
      </div>
    </div>
  </div>`;
}
