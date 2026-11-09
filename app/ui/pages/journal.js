// 偏心我 · 记录 — 生活点滴与日历安排：文字、照片、留言、计划和重要日子
import { html } from '../h.js?v=ef34bd8a76';
import { useState, useEffect } from '../../vendor/hooks.js';
import { app, useCols, useNow, nameOf, dayOf, localDayLabel, MOODS, moodOf, toast, stId } from '../../lib/ctx.js?v=ef34bd8a76';
import { uid, today, addMonths, pad2, fmtDayFull, cx } from '../../lib/util.js?v=ef34bd8a76';
import { Avatar, Photos, PhotoPicker, Reacts, AutoText, Empty, St, Seg, confirmDel, Img, strip } from '../common.js?v=ef34bd8a76';
import { Icon } from '../icons.js?v=ef34bd8a76';
import { localZone } from '../../lib/time.js?v=ef34bd8a76';
import { Comments } from '../shares.js?v=ef34bd8a76';
import { Cal } from './cal.js?v=ef34bd8a76';

const TO = {
  day: { label: '生活点滴', st: 'read', hint: '两个人都能看到' },
  ta: { label: '留言给 TA', st: 'idea', hint: 'TA 会收到一个小提示' },
  me: { label: '只给自己', st: 'sleep', hint: '只有自己看得到，悄悄存在这台设备上' },
};

/** private notes live in a local-only collection and never leave this device */
const colOf = (to) => (to === 'me' ? '_journal' : 'journal');

function entriesFor(day) {
  const shared = app.store.list('journal', (x) => x.day === day);
  const mine = app.store.list('_journal', (x) => x.day === day && x.who === app.me).map((x) => ({ ...x, _local: true }));
  return [...shared, ...mine].sort((a, b) => (a.at || a._t) - (b.at || b._t));
}

function monthIndex(ym) {
  const idx = new Map();
  const add = (x, local) => {
    if (!x.day || !x.day.startsWith(ym)) return;
    let v = idx.get(x.day);
    if (!v) idx.set(x.day, (v = { n: 0, photo: null, who: new Set(), toMe: false, mood: null }));
    v.n++;
    v.who.add(x.who);
    if (!v.photo && x.photos && x.photos.length) v.photo = x.photos[0];
    if (x.to === 'ta' && x.who === app.partner) v.toMe = true;
    if (x.mood && !v.mood && moodOf(x.mood)) v.mood = { who: x.who, m: moodOf(x.mood) };
    if (local) v.self = true;
  };
  for (const x of app.store.list('journal')) add(x, false);
  for (const x of app.store.list('_journal', (x) => x.who === app.me)) add(x, true);
  return idx;
}

function Calendar({ ym, setYm, sel, onPick }) {
  const idx = monthIndex(ym);
  const [y, m] = ym.split('-').map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${ym}-${pad2(d)}`);
  while (cells.length % 7) cells.push(null);
  const t = today();
  return html`<section class="card cal">
    <div class="cal-hd">
      <button class="icon-btn" aria-label="上个月" onClick=${() => setYm(addMonths(ym, -1))}><${Icon} n="left" size=${18} /></button>
      <b>${y} 年 ${m} 月</b>
      <button class="icon-btn" aria-label="下个月" onClick=${() => setYm(addMonths(ym, 1))}><${Icon} n="right" size=${18} /></button>
      <span class="sp"></span>
      ${ym !== t.slice(0, 7) && html`<button class="btn xs ghost" onClick=${() => { setYm(t.slice(0, 7)); onPick(t); }}>回到今天</button>`}
    </div>
    <div class="cal-grid">
      ${['一', '二', '三', '四', '五', '六', '日'].map((w) => html`<div class="cal-w">${w}</div>`)}
      ${cells.map((d) => {
        if (!d) return html`<div class="cal-c empty"></div>`;
        const v = idx.get(d);
        return html`<button type="button" class=${cx('cal-c', d === t && 'today', d === sel && 'sel', v && 'has', d > t && 'future')} onClick=${() => onPick(d)}>
          ${v?.photo && html`<${Img} id=${v.photo.th || v.photo.id} cls="cal-ph" />`}
          ${!v?.photo && v?.mood && html`<${St} id=${stId(v.mood.who, v.mood.m.st)} size=${30} cls="cal-st" title="" />`}
          <span class="cal-n">${Number(d.slice(8))}</span>
          ${v && html`<span class="cal-dots">${[...v.who].map((w) => html`<i class=${'p-' + w}></i>`)}${v.toMe ? html`<em class="cal-msg"></em>` : null}</span>`}
        </button>`;
      })}
    </div>
    <p class="hint cal-legend"><i class=${'dot-p p-' + app.me}></i> 我 <i class=${'dot-p p-' + app.partner}></i> ${nameOf(app.partner)} <em class="cal-msg"></em> 给我的留言</p>
  </section>`;
}

function Entry({ x, onEdit }) {
  const mine = x.who === app.me;
  const to = TO[x.to] || TO.day;
  const target = `journal/${x.id}`;
  const mood = moodOf(x.mood);
  return html`<article class=${cx('entry', 'p-' + x.who, 'to-' + (x.to || 'day'))}>
    <header class="entry-hd">
      <${Avatar} who=${x.who} size=${36} />
      <div class="entry-meta">
        <b>${nameOf(x.who)}</b>
        <small class="muted">记录于 ${localDayLabel(x.who, x.day)} · ${x.to === 'ta' ? (mine ? `留言给 ${nameOf(app.partner)}` : '给你的留言') : to.label}</small>
      </div>
      ${mood && html`<${St} id=${stId(x.who, mood.st)} size=${48} title=${mood.label} />`}
      ${mine && html`<span class="entry-ops"><button class="icon-btn sm" aria-label="编辑" onClick=${() => onEdit(x)}><${Icon} n="edit" size=${16} /></button>
        <button class="icon-btn sm" aria-label="删除" onClick=${() => confirmDel('删除这条记录？') && app.store.del(x._local ? '_journal' : 'journal', x.id)}><${Icon} n="trash" size=${16} /></button></span>`}
    </header>
    ${x.text && html`<div class="entry-t">${x.text}</div>`}
    <${Photos} list=${x.photos} />
    ${!x._local && html`<${Reacts} target=${target} />`}
    ${!x._local && html`<${Comments} target=${target} />`}
  </article>`;
}

function Composer({ day, edit, onDone }) {
  const [to, setTo] = useState(edit ? edit.to || 'day' : 'day');
  const [text, setText] = useState(edit ? edit.text || '' : '');
  const [photos, setPhotos] = useState(edit ? edit.photos || [] : []);
  const [mood, setMood] = useState(edit ? moodOf(edit.mood)?.k || '' : '');
  const [moodOpen, setMoodOpen] = useState(false);
  const save = () => {
    if (!text.trim() && !photos.length) return;
    let ph = photos;
    if (to !== 'me') {
      // photos picked while writing a private note were kept on this device; share them now
      ph = photos.map((p) => {
        if (!p.loc) return p;
        app.sync.shareBlob(p.id);
        app.sync.shareBlob(p.th);
        const { loc, ...rest } = p;
        return rest;
      });
    }
    const data = { who: app.me, day, to, text: text.trim().slice(0, 5000), photos: ph, mood, zone: edit?.zone || localZone(), at: edit ? edit.at || edit._t : Date.now() };
    if (edit) {
      const oldCol = edit._local ? '_journal' : 'journal';
      const newCol = colOf(to);
      if (oldCol !== newCol) {
        app.store.del(oldCol, edit.id);
        app.store.put(newCol, uid(), data);
      } else {
        app.store.put(newCol, edit.id, { ...strip(edit), ...data });
      }
    } else {
      app.store.put(colOf(to), uid(), data);
      toast(to === 'ta' ? `留言给 ${nameOf(app.partner)} 啦` : to === 'me' ? '收好啦，只有你看得到' : '记下来啦', { icon: stId(app.me, 'ok') });
    }
    setText('');
    setPhotos([]);
    setMood('');
    onDone && onDone();
  };
  const m = moodOf(mood);
  return html`<div class=${cx('card composer', 'to-' + to)}>
    <${Seg} value=${to} onChange=${setTo} options=${Object.entries(TO).map(([k, v]) => ({ value: k, label: k === 'ta' ? `留言给 ${nameOf(app.partner)}` : v.label }))} />
    <${AutoText} value=${text} onInput=${setText} rows=${3} maxLength=${5000}
      placeholder=${to === 'me' ? '今天想对自己说…' : to === 'ta' ? `想跟 ${nameOf(app.partner)} 说…` : '今天发生了什么小事？'} />
    <${PhotoPicker} value=${photos} onChange=${setPhotos} local=${true} />
    <div class="composer-ft">
      <button type="button" class="chip st-chip" onClick=${() => setMoodOpen(!moodOpen)}>${m ? html`<${St} id=${stId(app.me, m.st)} size=${26} title="" />${m.label}` : html`<${Icon} n="smile" size=${18} /> 心情`}</button>
      <small class="muted">${TO[to].hint}</small>
      <span class="sp"></span>
      ${onDone && edit && html`<button type="button" class="btn ghost sm" onClick=${onDone}>取消</button>`}
      <button type="button" class="btn sm" disabled=${!text.trim() && !photos.length} onClick=${save}>${edit ? '保存' : '记下来'}</button>
    </div>
    ${moodOpen && html`<div class="mood-row">${MOODS.map((x) => html`<button type="button" title=${x.label} class=${cx(mood === x.k && 'on')} onClick=${() => { setMood(mood === x.k ? '' : x.k); setMoodOpen(false); }}><${St} id=${stId(app.me, x.st)} size=${40} title="" /><small>${x.label}</small></button>`)}</div>`}
  </div>`;
}

export function Journal({ param }) {
  useCols(['journal', '_journal', 'react', 'cmt', 'profile', 'tz']);
  useNow(30000);
  const tab = param === 'cal' || param === 'cal-personal' ? 'cal' : 'entries';
  const initial = /^\d{4}-\d{2}-\d{2}$/.test(param || '') ? param : today();
  const [sel, setSel] = useState(initial);
  const [ym, setYm] = useState(initial.slice(0, 7));
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(param || '')) {
      setSel(param);
      setYm(param.slice(0, 7));
    }
  }, [param]);
  const pick = (d) => {
    setSel(d);
    setEditing(null);
    history.replaceState(null, '', '#/journal/' + d);
  };
  const list = entriesFor(sel);
  return html`<div class="page journal">
    <div class="page-hd"><h2>记录</h2></div>
    <${Seg} value=${tab} onChange=${(value) => { location.hash = value === 'cal' ? '#/journal/cal' : '#/journal/' + sel; }} cls="big records-tabs"
      options=${[{value:'entries',label:'生活点滴',st:stId(app.me,'read')},{value:'cal',label:'日历',st:stId(app.me,'salute')}]} />
    <div class="journal-entries" hidden=${tab !== 'entries'}>
    <div class="chips journal-dates"><button class="chip" onClick=${() => { setYm(today().slice(0, 7)); pick(today()); }}>我的今天 · ${today()}</button>${app.store.get('tz', app.partner) && html`<button class="chip" onClick=${() => { const d = dayOf(app.partner); setYm(d.slice(0, 7)); pick(d); }}>${nameOf(app.partner)} 的今天 · ${dayOf(app.partner)}</button>`}</div>
    <div class="journal-wrap">
      <div class="journal-cal"><${Calendar} ym=${ym} setYm=${setYm} sel=${sel} onPick=${pick} /></div>
      <div class="journal-day">
        <h3 class="day-title">${fmtDayFull(sel)}${sel === today() ? html` <small class="badge">今天</small>` : null}</h3>
        ${editing
          ? html`<${Composer} key=${'e' + editing.id} day=${sel} edit=${editing} onDone=${() => setEditing(null)} />`
          : html`<${Composer} key=${'n' + sel} day=${sel} />`}
        ${list.length
          ? list.map((x) => html`<${Entry} key=${x.id} x=${x} onEdit=${setEditing} />`)
          : html`<${Empty} st="read" text="当天暂无记录" />`}
      </div>
    </div>
    </div>
    ${tab === 'cal' && html`<${Cal} scope=${param === 'cal-personal' ? 'personal' : 'together'} />`}
  </div>`;
}
