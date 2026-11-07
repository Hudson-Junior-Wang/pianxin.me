// 偏心我 · 健身专区 — 记录运动、这一周的小足迹、一起运动（不比较、不打分）
import { html } from '../h.js?v=efe89b71a3';
import { useState } from '../../vendor/hooks.js';
import { app, useCols, nameOf, toast } from '../../lib/ctx.js?v=efe89b71a3';
import { quickStart } from '../../lib/together.js?v=efe89b71a3';
import { uid, today, addDays, weekStart, WEEK, parseDay, fmtDay, fmtHM, cx } from '../../lib/util.js?v=efe89b71a3';
import { Photos, PhotoPicker, Reacts, AutoText, Empty, confirmDel } from '../common.js?v=efe89b71a3';
import { strip } from './home.js?v=efe89b71a3';

export const SPORTS = [
  ['🏃', '跑步'], ['🚶', '散步'], ['🚴', '骑车'], ['🏊', '游泳'], ['🧘', '瑜伽'], ['🏋️', '力量'],
  ['🤸', '拉伸'], ['🏸', '羽毛球'], ['🏀', '篮球'], ['⚽', '足球'], ['🧗', '攀岩'], ['💃', '跳舞'],
  ['🥾', '爬山'], ['🎾', '网球'], ['🏓', '乒乓'], ['✨', '其他'],
];
const FEELS = [['😌', '轻松'], ['🙂', '刚好'], ['🥵', '好累'], ['🔥', '燃爆']];
const MINS = [10, 20, 30, 45, 60, 90];

function LogForm({ edit, onDone }) {
  const [sport, setSport] = useState(edit ? edit.sport : '🏃');
  const [min, setMin] = useState(edit ? edit.min : 30);
  const [feel, setFeel] = useState(edit ? edit.feel || '' : '');
  const [note, setNote] = useState(edit ? edit.note || '' : '');
  const [photos, setPhotos] = useState(edit ? edit.photos || [] : []);
  const [day, setDay] = useState(edit ? edit.day : today());
  const name = (SPORTS.find((s) => s[0] === sport) || SPORTS[15])[1];
  const save = () => {
    const m = Math.max(1, Math.min(600, Math.round(Number(min) || 0)));
    const data = { who: app.me, day, sport, name, min: m, feel, note: note.trim().slice(0, 1000), photos, at: edit ? edit.at : Date.now() };
    if (edit) app.store.put('workout', edit.id, { ...strip(edit), ...data });
    else {
      app.store.put('workout', uid(), data);
      toast(`记下来啦，${name} ${m} 分钟`, { icon: sport });
    }
    setNote('');
    setPhotos([]);
    setFeel('');
    onDone && onDone();
  };
  return html`<section class="card fit-form">
    <div class="card-hd"><h3>${edit ? '改一下' : '记一笔运动'}</h3></div>
    <div class="sport-grid">${SPORTS.map(([e, l]) => html`<button type="button" class=${cx('sport-b', sport === e && 'on')} onClick=${() => setSport(e)}><span>${e}</span><small>${l}</small></button>`)}</div>
    <div class="row wrap">
      <span class="lbl">时长</span>
      <div class="chips">${MINS.map((v) => html`<button type="button" class=${cx('chip', Number(min) === v && 'on')} onClick=${() => setMin(v)}>${v} 分</button>`)}</div>
      <input class="inp num" type="number" min="1" max="600" value=${min} onInput=${(e) => setMin(e.target.value)} /><span class="muted">分钟</span>
    </div>
    <div class="row wrap">
      <span class="lbl">感觉</span>
      <div class="chips">${FEELS.map(([e, l]) => html`<button type="button" class=${cx('chip', feel === e && 'on')} onClick=${() => setFeel(feel === e ? '' : e)}><span class="chip-i">${e}</span>${l}</button>`)}</div>
    </div>
    <div class="row wrap">
      <span class="lbl">日期</span>
      <input class="inp date" type="date" value=${day} max=${today()} onInput=${(e) => e.target.value && setDay(e.target.value)} />
    </div>
    <${AutoText} value=${note} onInput=${setNote} rows=${2} maxLength=${1000} placeholder="想说点什么（选填）：跑了哪条路、练了什么…" />
    <${PhotoPicker} value=${photos} onChange=${setPhotos} max=${4} />
    <div class="row end">
      ${edit && html`<button type="button" class="btn ghost sm" onClick=${onDone}>取消</button>`}
      <button type="button" class="btn" onClick=${save}>${edit ? '保存' : '记下来'}</button>
    </div>
  </section>`;
}

function WeekStrip({ list }) {
  const [off, setOff] = useState(0);
  const start = addDays(weekStart(today()), off * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const t = today();
  return html`<section class="card week">
    <div class="card-hd">
      <h3>这一周，我们动了动</h3>
      <span class="row tight">
        <button class="icon-btn" aria-label="上一周" onClick=${() => setOff(off - 1)}>‹</button>
        ${off !== 0 && html`<button class="btn xs ghost" onClick=${() => setOff(0)}>本周</button>`}
        <button class="icon-btn" aria-label="下一周" disabled=${off >= 0} onClick=${() => setOff(off + 1)}>›</button>
      </span>
    </div>
    <div class="week-row">
      ${days.map((d) => {
        const items = list.filter((x) => x.day === d);
        return html`<div class=${cx('wk-day', d === t && 'today')}>
          <span class="wk-d">周${WEEK[parseDay(d).getDay()]}<small>${Number(d.slice(8))}</small></span>
          <span class=${cx('wk-c', items.length && 'has')}>${items.slice(0, 4).map((x) => html`<i class=${'p-' + x.who} title=${`${nameOf(x.who)} · ${x.name} ${x.min} 分钟`}>${x.sport}</i>`)}</span>
        </div>`;
      })}
    </div>
    <p class="hint">只是留个脚印，不比较、不打卡，动一动就很好。</p>
  </section>`;
}

function Item({ x, onEdit }) {
  const mine = x.who === app.me;
  return html`<article class=${cx('entry fit-item', 'p-' + x.who)}>
    <header class="entry-hd">
      <span class="fit-e">${x.sport}</span>
      <div class="entry-meta">
        <b>${nameOf(x.who)} · ${x.name} ${x.min} 分钟 ${x.feel || ''}</b>
        <small class="muted">${fmtDay(x.day)} ${x.at ? fmtHM(x.at) : ''}</small>
      </div>
      ${mine && html`<span class="entry-ops"><button class="btn xs ghost" onClick=${() => onEdit(x)}>编辑</button><button class="btn xs ghost" onClick=${() => confirmDel('删除这条运动记录？') && app.store.del('workout', x.id)}>删除</button></span>`}
    </header>
    ${x.note && html`<div class="entry-t">${x.note}</div>`}
    <${Photos} list=${x.photos} />
    <${Reacts} target=${`workout/${x.id}`} opts=${['💪', '👏', '🔥', '🥹', '❤️']} />
  </article>`;
}

export function Fit() {
  useCols(['workout', 'react', 'profile']);
  const [edit, setEdit] = useState(null);
  const [limit, setLimit] = useState(20);
  const list = app.store.list('workout').sort((a, b) => (b.day > a.day ? 1 : b.day < a.day ? -1 : (b.at || b._t) - (a.at || a._t)));
  return html`<div class="page fit">
    <div class="page-hd">
      <h2>💪 健身专区</h2>
      <button class="btn" onClick=${() => { quickStart('sport'); location.hash = '#/together'; }}>🏃 开始一起运动</button>
    </div>
    <div class="cols">
      <div class="col-a">
        ${edit ? html`<${LogForm} key=${edit.id} edit=${edit} onDone=${() => setEdit(null)} />` : html`<${LogForm} key="new" />`}
        <${WeekStrip} list=${list} />
      </div>
      <div class="col-b">
        ${list.length ? list.slice(0, limit).map((x) => html`<${Item} key=${x.id} x=${x} onEdit=${setEdit} />`) : html`<${Empty} icon="🌿" text="还没有运动记录，散步十分钟也算哦" />`}
        ${list.length > limit && html`<button class="btn ghost block" onClick=${() => setLimit(limit + 20)}>再看看更早的</button>`}
      </div>
    </div>
  </div>`;
}
