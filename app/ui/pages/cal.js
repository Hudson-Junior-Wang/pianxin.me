// 偏心我 · 日历 — 下次见面、重要的日子、一起的计划、点子罐
import { html } from '../h.js?v=84b24374a3';
import { useState } from '../../vendor/hooks.js';
import { app, useCols, useNow, nameOf, zoneOf, toast, stId } from '../../lib/ctx.js?v=84b24374a3';
import { uid, today, nextOccurrence, diffDays, fmtDay, fmtDayFull, dayKey, parseDay, pad2, addMonths, cx, pick } from '../../lib/util.js?v=84b24374a3';
import { Avatar, Modal, Empty, St, confirmDel, AutoText, strip } from '../common.js?v=84b24374a3';
import { Icon } from '../icons.js?v=84b24374a3';
import { planScope, planOwner, canEditPlan } from '../../lib/plans.js?v=84b24374a3';
import { localZone, zonedStamp, wallInstant, meetInstant, meetUpcoming } from '../../lib/time.js?v=84b24374a3';
import { Pic } from '../pictograms.js?v=84b24374a3';

// Original keys remain in old/new records so edits and sync need no migration.
const DAY_ART = [['🎂','birthday','生日'],['🎓','graduation','毕业'],['📝','note','记事'],['✈️','travel','旅行'],['🎉','party','庆祝'],['🏠','home','家'],['🐾','paw','小脚印'],['⭐','star','星星'],['🍰','dessert','甜品'],['📅','calendar','日历']];

// ---------- next meet-up ----------
function MeetCard() {
  useCols(['meet', 'tz', 'profile']);
  const now = useNow(1000);
  const [form, setForm] = useState(false);
  const t = today();
  const key = (m) => meetInstant(m) ?? parseDay(m.date).getTime();
  const list = app.store.list('meet').sort((a, b) => key(a) - key(b));
  const next = list.find((m) => meetUpcoming(m, now, t));
  const past = list.filter((m) => !meetUpcoming(m, now, t)).slice(-3).reverse();
  let main = null;
  if (next) {
    const instant = meetInstant(next);
    const ms = instant == null ? 0 : instant - now;
    const days = instant == null ? diffDays(t, next.date) : Math.floor(Math.max(0, ms) / 864e5);
    main = html`<div class="meet-main">
      <${St} id="d-five" size=${96} title="" />
      <div class="meet-big">${instant == null && next.time ? html`<em>时间待确认</em>` : days > 0 ? html`还有 <em>${days}</em> 天` : ms > 0 ? html`还有 <em>${Math.floor(ms / 3600000)}</em> 小时 <em>${Math.floor((ms % 3600000) / 60000)}</em> 分` : html`<em>就是今天</em>`}</div>
      <div class="meet-sub">${next.date}${next.time ? ' ' + next.time : ' · 只定日期'}${next.zone ? ' · ' + next.zone : next.time ? ' · 旧记录时区待确认' : ''}${next.where ? ` · ${next.where}` : ''}</div>
      ${instant != null && html`<div class="meet-zones"><small>我这里：${zonedStamp(instant)}</small><small>${nameOf(app.partner)}：${zoneOf(app.partner) ? zonedStamp(instant, zoneOf(app.partner)) : '当地时区待同步'}</small></div>`}
      ${next.note && html`<div class="meet-note">${next.note}</div>`}
      <div class="row center">
        <button class="btn xs ghost" onClick=${() => setForm({ edit: next })}>改一下</button>
        <button class="btn xs ghost" onClick=${() => confirmDel('删除这次见面？') && app.store.del('meet', next.id)}>删除</button>
      </div>
    </div>`;
  }
  return html`<section class="card meet">
    <div class="card-hd"><h3>下次见面</h3><button class="btn xs" onClick=${() => setForm({})}><${Icon} n="plus" size=${14} /> 定个日子</button></div>
    ${main || html`<${Empty} st="hi" text="暂无见面安排" />`}
    ${past.length > 0 && html`<div class="meet-past"><small class="muted">之前见过：${past.map((m) => fmtDay(m.date)).join('、')}</small></div>`}
    ${form && html`<${MeetForm} edit=${form.edit} onClose=${() => setForm(false)} />`}
  </section>`;
}

function MeetForm({ edit, onClose }) {
  const [date, setDate] = useState(edit ? edit.date : '');
  const [time, setTime] = useState(edit ? edit.time || '' : '');
  const [where, setWhere] = useState(edit ? edit.where || '' : '');
  const [note, setNote] = useState(edit ? edit.note || '' : '');
  const [zone, setZone] = useState(edit?.time ? edit.zone || '' : localZone());
  const [err, setErr] = useState('');
  const save = () => {
    if (!date) return;
    const when = time ? wallInstant(date, time, zone.trim()) : null;
    if (time && !Number.isFinite(when)) return setErr('请确认有效的 IANA 时区。这个时间若在夏令时切换的重复或跳过区间，请换一个明确的时间。');
    const data = { date, time, zone: time ? zone.trim() : '', when, where: where.trim().slice(0, 60), note: note.trim().slice(0, 200), who: edit ? edit.who : app.me };
    app.store.put('meet', edit ? edit.id : uid(), edit ? { ...strip(edit), ...data } : data);
    onClose();
  };
  return html`<${Modal} title="下次见面" onClose=${onClose}>
    <label class="lbl">日期</label><input class="inp" type="date" value=${date} onInput=${(e) => setDate(e.target.value)} />
    <label class="lbl">时间（选填）</label><input class="inp" type="time" value=${time} onInput=${(e) => setTime(e.target.value)} />
    ${time && html`<label class="lbl">上面日期和时间所属的时区</label><input class="inp event-zone" aria-label="见面时区" value=${zone} placeholder="例如 Australia/Sydney" onInput=${(e) => setZone(e.target.value)} /><div class="chips"><button class="chip" onClick=${() => setZone(localZone())}>用我这里：${localZone()}</button>${zoneOf(app.partner) && html`<button class="chip" onClick=${() => setZone(zoneOf(app.partner))}>用 ${nameOf(app.partner)} 那边：${zoneOf(app.partner)}</button>`}</div><p class="hint">不是自动猜见面城市的时区，请按实际地点选择。双方会看到同一时刻的各自当地时间。</p>`}
    ${err && html`<p class="err">${err}</p>`}
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
    <div class="emo-pick" role="group" aria-label="日子图案">${DAY_ART.map(([e, art, label]) => html`<button type="button" class=${cx(emoji === e && 'on')} aria-label=${label} aria-pressed=${emoji === e} onClick=${() => setEmoji(e)}><${Pic} name=${art} size=${34} /></button>`)}</div>
    <label class="lbl">名字</label><input class="inp" maxlength="40" placeholder="TA 的生日 / 出发的日子 / 见面的日子" value=${title} onInput=${(e) => setTitle(e.target.value)} />
    <label class="lbl">日期</label><input class="inp" type="date" value=${date} onInput=${(e) => setDate(e.target.value)} />
    <label class="check"><input type="checkbox" checked=${yearly} onChange=${(e) => setYearly(e.target.checked)} /> 每年重复显示倒数（比如生日）</label>
    <div class="modal-ft"><button class="btn ghost" onClick=${onClose}>取消</button><button class="btn" disabled=${!title.trim() || !date} onClick=${save}>好</button></div>
  <//>`;
}

function Days() {
  useCols('anniv');
  useNow(30000);
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
      <span class="anniv-e"><${Pic} name=${a.emoji||'calendar'} size=${38} fallback="calendar" label=${DAY_ART.find(([e])=>e===a.emoji)?.[2]||'日子图案'} /></span>
      <div class="anniv-m">
        <b>${a.title}</b>
        <small class="muted">${fmtDayFull(a.day)}${a.yearly !== false && a.years > 0 ? ` · 第 ${a.years} 年` : ''}${a.since > 0 ? ` · 已经 ${a.since} 天` : ''}</small>
      </div>
      <span class="anniv-d">${a.days === 0 ? html`<em>今天</em>` : a.days > 0 ? html`<em>${a.days}</em><small>天后</small>` : html`<small>已过去</small>`}</span>
      <span class="anniv-ops"><button class="icon-btn xs" aria-label="编辑" onClick=${() => setForm({ edit: a })}><${Icon} n="edit" size=${14} /></button><button class="icon-btn xs" aria-label="删除" onClick=${() => confirmDel(`删除「${a.title}」？`) && app.store.del('anniv', a.id)}><${Icon} n="x" size=${14} /></button></span>
    </li>`)}</ul>` : html`<${Empty} st="idea" text="暂无重要日子" />`}
    ${form && html`<${DayForm} edit=${form.edit} onClose=${() => setForm(null)} />`}
  </section>`;
}

// ---------- personal and shared plans ----------
function PlanForm({ edit, date0, scope0, onClose, onSaved }) {
  const [id] = useState(() => edit?.id || uid());
  const [title, setTitle] = useState(edit ? edit.title : '');
  const [date, setDate] = useState(edit ? edit.date || '' : date0 || '');
  const [note, setNote] = useState(edit ? edit.note || '' : '');
  const [scope, setScope] = useState(edit ? planScope(edit) : scope0 || 'together');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('请确认计划日期。');
    const current = edit && app.store.get('plan', id);
    if (edit && !current) return setErr('这条计划已被删除，请关闭后重新添加。');
    if (edit && !canEditPlan(current, app.me)) return setErr('这条个人计划由本人修改。');
    if (edit && current.who !== app.me && scope !== planScope(current)) return setErr('计划类型由创建者修改。');
    setSaving(true); setErr('');
    try {
      const data = { ...(current || {}), title: title.trim().slice(0, 60), date, note: note.trim().slice(0, 500), who: current?.who || app.me, scope, owner: scope === 'personal' ? planOwner(current) || app.me : '', done: current ? !!current.done : false };
      app.store.put('plan', id, data);
      if (await app.store.flush() === false) throw new Error('local save failed');
      onSaved(scope);
    } catch { setSaving(false); setErr('保存遇到了问题，内容还在这里，请再试一次。'); }
  };
  const close = () => { if (!saving) onClose(); };
  return html`<${Modal} title=${edit ? '改计划' : scope === 'personal' ? '我的计划' : '一起的计划'} cls="plan-editor" onClose=${close}>
    <form onSubmit=${save}>
      <label class="lbl" for="plan-scope">计划类型</label><select id="plan-scope" class="inp" value=${scope} disabled=${saving || !!edit && edit.who !== app.me} onChange=${(e) => setScope(e.target.value)}><option value="personal">个人计划</option><option value="together">一起的计划</option></select>
      <p class="hint">${scope === 'personal' ? '双方可见，由本人修改。' : '两个人都可以修改和标记完成。'}</p>
      <label class="lbl" for="plan-title">想做的事</label><input id="plan-title" class="inp" maxlength="60" placeholder="计划名称" value=${title} disabled=${saving} onInput=${(e) => setTitle(e.target.value)} />
      <label class="lbl" for="plan-date">哪天（选填，不填就是“总有一天”）</label><input id="plan-date" class="inp" type="date" value=${date} disabled=${saving} onInput=${(e) => setDate(e.target.value)} />
      <label class="lbl" for="plan-note">备注（选填）</label><${AutoText} id="plan-note" value=${note} onInput=${setNote} rows=${2} maxLength=${500} placeholder="计划备注" />
      ${err && html`<p class="err" role="alert">${err}</p>`}
      <div class="modal-ft"><button type="button" class="btn ghost" disabled=${saving} onClick=${close}>取消</button><button type="submit" class="btn" disabled=${!title.trim() || saving}>${saving ? '保存中…' : '好'}</button></div>
    </form>
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

function Plans({ scope = 'together' }) {
  useCols(['plan', 'meet', 'anniv', 'profile']);
  useNow(30000);
  const [form, setForm] = useState(null);
  const [ym, setYm] = useState(today().slice(0, 7));
  const [person, setPerson] = useState('');
  const [showDone, setShowDone] = useState(false);
  const plans = app.store.list('plan').filter((p) => planScope(p) === scope && (scope !== 'personal' || !person || planOwner(p) === person));
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
  const todo = plans.filter((p) => !p.done).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a._t || 0) - (b._t || 0));
  const done = plans.filter((p) => p.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const toggle = (p) => {
    const current = app.store.get('plan', p.id);
    if (!current || !canEditPlan(current, app.me)) return;
    app.store.put('plan', p.id, { ...current, done: !current.done, doneAt: current.done ? 0 : Date.now() });
  };
  const remove = (p) => {
    const current = app.store.get('plan', p.id);
    if (current && canEditPlan(current, app.me) && confirmDel(`删除「${current.title}」？`)) app.store.del('plan', p.id);
  };
  const row = (p) => {
    const editable = canEditPlan(p, app.me);
    const owner = planOwner(p);
    return html`<li key=${p.id} class=${cx('plan', p.done && 'done', scope === 'personal' && 'p-' + owner)} data-plan=${p.id}>
      <label class="ck"><input type="checkbox" aria-label=${`完成计划：${p.title}`} checked=${!!p.done} disabled=${!editable} onChange=${() => toggle(p)} /><span class="ck-box"></span></label>
      <button type="button" class="plan-m" disabled=${!editable} aria-label=${editable ? `编辑计划：${p.title}` : `个人计划：${p.title}`} onClick=${() => { if (editable) setForm({ edit: p }); }}>
        <b>${p.title}</b><small class="muted">${scope === 'personal' ? nameOf(owner) + ' · ' : ''}${p.date ? fmtDay(p.date) : '总有一天'}${p.note ? ' · ' + p.note : ''}${p.doneAt ? ' · 完成于 ' + fmtDay(dayKey(p.doneAt)) : ''}</small>
      </button>
      <${Avatar} who=${scope === 'personal' ? owner : p.who} size=${24} />
      ${editable && html`<button type="button" class="icon-btn xs" aria-label="删除计划" onClick=${() => remove(p)}><${Icon} n="x" size=${14} /></button>`}
    </li>`;
  };
  return html`<section class="card plans">
    <div class="card-hd"><h3>计划与日历</h3><button type="button" class="btn xs" onClick=${() => setForm({ scope })}><${Icon} n="plus" size=${14} /> ${scope === 'personal' ? '我的计划' : '计划'}</button></div>
    <div class="chips plan-tabs" role="group" aria-label="计划类型">${[['personal', '各自的计划'], ['together', '一起的计划']].map(([value, label]) => html`<button type="button" class=${cx('chip', scope === value && 'on')} aria-pressed=${scope === value} onClick=${() => { location.hash = value === 'personal' ? '#/journal/cal-personal' : '#/journal/cal'; setShowDone(false); }}>${label}</button>`)}</div>
    ${scope === 'personal' && html`<div class="chips plan-people" role="group" aria-label="个人计划筛选">${[['', '两个人的'], [app.me, '我的'], [app.partner, nameOf(app.partner) + ' 的']].map(([value, label]) => html`<button type="button" class=${cx('chip', person === value && 'on')} aria-pressed=${person === value} onClick=${() => setPerson(value)}>${label}</button>`)}</div>`}
    <p class="hint">${scope === 'personal' ? '双方可见，由本人修改。' : '两个人都可以修改和标记完成。'}仅显示日期，不提供到时推送。</p>
    <${MonthGrid} ym=${ym} setYm=${setYm} marks=${marks} onPick=${(d) => setForm({ date: d, scope })} />
    ${todo.length ? html`<ul class="plan-ul">${todo.map(row)}</ul>` : html`<p class="hint">${scope === 'personal' ? '暂无个人计划' : '暂无一起的计划'}</p>`}
    ${done.length > 0 && html`<button type="button" class="link sm plan-done-toggle" onClick=${() => setShowDone(!showDone)}>${showDone ? '收起' : `已完成 ${done.length} 件`}</button>`}
    ${showDone && html`<ul class="plan-ul done">${done.map(row)}</ul>`}
    ${form && html`<${PlanForm} edit=${form.edit} date0=${form.date} scope0=${form.scope} onClose=${() => setForm(null)} onSaved=${(value) => { setForm(null); setPerson(''); setShowDone(false); location.hash = value === 'personal' ? '#/journal/cal-personal' : '#/journal/cal'; }} />`}
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
              <div class="row"><button class="btn xs" onClick=${() => { app.store.put('plan', uid(), { title: drawn.text, date: '', note: '从点子罐里摇出来的', who: app.me, scope: 'together', owner: '', done: false }); toast('放进一起的计划啦', { icon: stId(app.me, 'ok') }); setDrawn(null); }}>加进计划</button>
              <button class="btn xs ghost" onClick=${() => { app.store.put('idea', drawn.id, { ...strip(drawn), drawn: false, drawnAt: 0 }); setDrawn(null); }}>放回去</button></div></div>`
          : html`<div class="jar-tip"><${St} id=${stId(app.me, inJar.length ? 'idea' : 'what')} size=${64} title="" /><p class="muted">${inJar.length ? '点击罐子随机抽取' : '暂无点子'}</p></div>`}
      </div>
    </div>
    <form class="row" onSubmit=${add}>
      <input class="inp" maxlength="120" placeholder="输入点子" value=${text} onInput=${(e) => setText(e.target.value)} />
      <button class="btn" disabled=${!text.trim()}>放进去</button>
    </form>
    ${used.length > 0 && html`<button class="link sm" onClick=${() => setShowUsed(!showUsed)}>${showUsed ? '收起' : `摇出来过的 ${used.length} 个点子`}</button>`}
    ${showUsed && html`<ul class="idea-used">${used.map((x) => html`<li key=${x.id}><${Avatar} who=${x.who} size=${22} />${x.text}
      <span class="sp"></span>
      <button class="icon-btn xs" title="放回罐子" onClick=${() => app.store.put('idea', x.id, { ...strip(x), drawn: false, drawnAt: 0 })}><${Icon} n="refresh" size=${14} /></button>
      <button class="icon-btn xs" aria-label="删除" onClick=${() => confirmDel('删除这个点子？') && app.store.del('idea', x.id)}><${Icon} n="x" size=${14} /></button></li>`)}</ul>`}
  </section>`;
}

export function Cal({ scope = 'together' }) {
  return html`<div class="calpage">
    <div class="cols">
      <div class="col-a">
        <${MeetCard} />
        <${Plans} scope=${scope} />
      </div>
      <div class="col-b">
        <${Days} />
        <${IdeaJar} />
      </div>
    </div>
  </div>`;
}
