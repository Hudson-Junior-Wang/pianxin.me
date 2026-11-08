// 偏心我 · 运动 — 各自记录，方便时再回应，不比较、不要求同时进行
import { html } from '../h.js?v=f8c0c1b1d6';
import { useState } from '../../vendor/hooks.js';
import { app, useCols, useNow, nameOf, localDayLabel, toast, stId } from '../../lib/ctx.js?v=f8c0c1b1d6';
import { localZone } from '../../lib/time.js?v=f8c0c1b1d6';
import { uid, today, addDays, weekStart, WEEK, parseDay, cx } from '../../lib/util.js?v=f8c0c1b1d6';
import { Photos, PhotoPicker, Reacts, AutoText, Empty, St, confirmDel, strip } from '../common.js?v=f8c0c1b1d6';
import { Icon } from '../icons.js?v=f8c0c1b1d6';

import { SPORTS, sportOf } from '../../lib/sports.js?v=f8c0c1b1d6';
import { SportIcon } from '../sport-icons.js?v=f8c0c1b1d6';
export { SPORTS } from '../../lib/sports.js?v=f8c0c1b1d6';
const FEELS = [['easy', '轻松', 'thanks'], ['ok', '刚好', 'ok'], ['tired', '好累', 'dizzy'], ['fire', '超爽', 'cheer']];
const OLD_FEEL = { '😌': 'easy', '🙂': 'ok', '🥵': 'tired', '🔥': 'fire' };
const feelOf = (f) => FEELS.find((x) => x[0] === (OLD_FEEL[f] || f));
const MINS = [10, 20, 30, 45, 60, 90];

function LogForm({ edit, onDone }) {
  const [sport, setSport] = useState(edit ? edit.sport : '🏃');
  const [min, setMin] = useState(edit ? edit.min : 30);
  const [feel, setFeel] = useState(edit ? OLD_FEEL[edit.feel] || edit.feel || '' : '');
  const [note, setNote] = useState(edit ? edit.note || '' : '');
  const [photos, setPhotos] = useState(edit ? edit.photos || [] : []);
  useNow(30000);
  const [dayChoice, setDay] = useState(edit ? edit.day : '');
  const day = dayChoice || today();
  const legacy = edit && !sportOf(edit.sport);
  const name = sportOf(sport)?.[1] || (edit?.sport === sport ? edit.name : '') || '其他';
  const save = () => {
    const m = Math.max(1, Math.min(600, Math.round(Number(min) || 0)));
    const data = { who: app.me, day: dayChoice || today(), sport, name, min: m, feel, note: note.trim().slice(0, 1000), photos, zone: edit?.zone || localZone(), at: edit ? edit.at : Date.now() };
    if (edit) app.store.put('workout', edit.id, { ...strip(edit), ...data });
    else {
      app.store.put('workout', uid(), data);
      toast(`记下来啦，${name} ${m} 分钟`, { icon: stId(app.me, 'cheer') });
    }
    setNote('');
    setPhotos([]);
    setFeel('');
    if (!edit) setDay('');
    onDone && onDone();
  };
  return html`<section class="card fit-form">
    <div class="card-hd"><h3>${edit ? '改一下' : '记一笔运动'}</h3></div>
    <div class="sport-grid" role="group" aria-label="运动类型">${SPORTS.map(([key, label]) => html`<button type="button" key=${key} class=${cx('sport-b', sport === key && 'on')} aria-label=${label} aria-pressed=${sport === key} onClick=${() => setSport(key)}><${SportIcon} sport=${key} /><small>${label}</small></button>`)}</div>
    ${legacy && html`<div class="fit-legacy"><button type="button" class=${cx('chip', sport === edit.sport && 'on')} aria-pressed=${sport === edit.sport} onClick=${() => setSport(edit.sport)}>保留原项目：${edit.name || edit.sport}</button><p class="hint">原有记录会保留，也可以改选上面的运动。</p></div>`}
    <div class="row wrap">
      <span class="lbl">时长</span>
      <div class="chips">${MINS.map((v) => html`<button type="button" class=${cx('chip', Number(min) === v && 'on')} onClick=${() => setMin(v)}>${v} 分</button>`)}</div>
      <input class="inp num" type="number" min="1" max="600" value=${min} onInput=${(e) => setMin(e.target.value)} /><span class="muted">分钟</span>
    </div>
    <div class="row wrap">
      <span class="lbl">感觉</span>
      <div class="chips">${FEELS.map(([k, l, st]) => html`<button type="button" class=${cx('chip st-chip', feel === k && 'on')} onClick=${() => setFeel(feel === k ? '' : k)}><${St} id=${stId(app.me, st)} size=${26} title="" />${l}</button>`)}</div>
    </div>
    <div class="row wrap">
      <span class="lbl">日期</span>
      <input class="inp date" type="date" value=${day} max=${today()} onInput=${(e) => e.target.value && setDay(e.target.value)} />
    </div>
    <${AutoText} value=${note} onInput=${setNote} rows=${2} maxLength=${1000} placeholder="想说点什么（选填）" />
    <${PhotoPicker} value=${photos} onChange=${setPhotos} max=${4} />
    <div class="row end">
      ${edit && html`<button type="button" class="btn ghost sm" onClick=${onDone}>取消</button>`}
      <button type="button" class="btn" onClick=${save}>${edit ? '保存' : '记下来'}</button>
    </div>
  </section>`;
}

function WeekStrip({ list }) {
  useNow(30000);
  const [off, setOff] = useState(0);
  const start = addDays(weekStart(today()), off * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const t = today();
  return html`<section class="card week">
    <div class="card-hd">
      <h3>这一周动了动</h3>
      <span class="row tight">
        <button class="icon-btn" aria-label="上一周" onClick=${() => setOff(off - 1)}><${Icon} n="left" size=${18} /></button>
        ${off !== 0 && html`<button class="btn xs ghost" onClick=${() => setOff(0)}>本周</button>`}
        <button class="icon-btn" aria-label="下一周" disabled=${off >= 0} onClick=${() => setOff(off + 1)}><${Icon} n="right" size=${18} /></button>
      </span>
    </div>
    <div class="week-row">
      ${days.map((d) => {
        const items = list.filter((x) => x.day === d);
        return html`<div class=${cx('wk-day', d === t && 'today')}>
          <span class="wk-d">周${WEEK[parseDay(d).getDay()]}<small>${Number(d.slice(8))}</small></span>
          <span class=${cx('wk-c', items.length && 'has')}>${items.slice(0, 4).map((x) => html`<i class=${'p-' + x.who} title=${`${nameOf(x.who)} · ${x.name} ${x.min} 分钟`}><${SportIcon} sport=${x.sport} size=${24} /></i>`)}</span>
        </div>`;
      })}
    </div>
  </section>`;
}

function Item({ x, onEdit }) {
  const mine = x.who === app.me;
  const f = feelOf(x.feel);
  return html`<article class=${cx('entry fit-item', 'p-' + x.who)}>
    <header class="entry-hd">
      <span class="fit-e"><${SportIcon} sport=${x.sport} size=${46} /></span>
      <div class="entry-meta">
        <b>${nameOf(x.who)} · ${x.name} ${x.min} 分钟</b>
        <small class="muted">${localDayLabel(x.who, x.day)}${x.zone ? ' · ' + x.zone : ''}${f ? ` · ${f[1]}` : ''}</small>
      </div>
      ${f && html`<${St} id=${stId(x.who, f[2])} size=${44} />`}
      ${mine && html`<span class="entry-ops"><button class="icon-btn sm" aria-label="编辑" onClick=${() => onEdit(x)}><${Icon} n="edit" size=${16} /></button><button class="icon-btn sm" aria-label="删除" onClick=${() => confirmDel('删除这条运动记录？') && app.store.del('workout', x.id)}><${Icon} n="trash" size=${16} /></button></span>`}
    </header>
    ${x.note && html`<div class="entry-t">${x.note}</div>`}
    <${Photos} list=${x.photos} />
    <${Reacts} target=${`workout/${x.id}`} set="fit" />
  </article>`;
}

export function Fit() {
  useCols(['workout', 'react', 'profile']);
  const [edit, setEdit] = useState(null);
  const [limit, setLimit] = useState(20);
  const list = app.store.list('workout').sort((a, b) => (b.day > a.day ? 1 : b.day < a.day ? -1 : (b.at || b._t) - (a.at || a._t)));
  return html`<div class="cols">
    <div class="col-a">
      ${edit ? html`<${LogForm} key=${edit.id} edit=${edit} onDone=${() => setEdit(null)} />` : html`<${LogForm} key="new" />`}
      <${WeekStrip} list=${list} />
    </div>
    <div class="col-b">
      ${list.length ? list.slice(0, limit).map((x) => html`<${Item} key=${x.id} x=${x} onEdit=${setEdit} />`) : html`<${Empty} st="run" text="暂无运动记录" />`}
      ${list.length > limit && html`<button class="btn ghost block" onClick=${() => setLimit(limit + 20)}>再看看更早的</button>`}
    </div>
  </div>`;
}
