// 偏心我 · 生活 — 吃了啥、共享菜谱（可展开）、想吃的、运动
import { html } from '../h.js?v=0cc8a63665';
import { useState } from '../../vendor/hooks.js';
import { app, useCols, useNow, nameOf, localDayLabel, toast, stId } from '../../lib/ctx.js?v=0cc8a63665';
import { localZone } from '../../lib/time.js?v=0cc8a63665';
import { uid, today, fmtDay, cx, pick } from '../../lib/util.js?v=0cc8a63665';
import { Avatar, Photos, PhotoPicker, Reacts, AutoText, Empty, Seg, St, confirmDel, Modal, strip } from '../common.js?v=0cc8a63665';
import { Icon } from '../icons.js?v=0cc8a63665';
import { Fit } from './fit.js?v=0cc8a63665';
import { Cal } from './cal.js?v=0cc8a63665';

// ---------- meals ----------
const MEALS = [['🌅', '早饭'], ['🍱', '午饭'], ['🌙', '晚饭'], ['🍪', '加餐'], ['🌃', '夜宵']];
function guessMeal() {
  const h = new Date().getHours();
  if (h < 10) return '早饭';
  if (h < 15) return '午饭';
  if (h < 17) return '加餐';
  if (h < 21) return '晚饭';
  return '夜宵';
}

function MealForm({ edit, onDone }) {
  useNow(30000);
  const [mealChoice, setMeal] = useState(edit ? edit.meal : '');
  const meal = mealChoice || guessMeal();
  const [text, setText] = useState(edit ? edit.text : '');
  const [photos, setPhotos] = useState(edit ? edit.photos || [] : []);
  const [dayChoice, setDay] = useState(edit ? edit.day : '');
  const day = dayChoice || today();
  const save = () => {
    if (!text.trim() && !photos.length) return;
    const data = { who: app.me, day: dayChoice || today(), meal: mealChoice || guessMeal(), text: text.trim().slice(0, 500) || meal, photos, zone: edit?.zone || localZone(), at: edit ? edit.at : Date.now() };
    if (edit) app.store.put('meal', edit.id, { ...strip(edit), ...data });
    else app.store.put('meal', uid(), data);
    setText('');
    setPhotos([]);
    if (!edit) { setMeal(''); setDay(''); }
    onDone && onDone();
  };
  return html`<section class="card meal-form">
    <div class="meal-form-hd"><${St} id=${stId(app.me, 'eat')} size=${56} title="" /><b>今天吃了什么？</b></div>
    <div class="chips">${MEALS.map(([e, l]) => html`<button type="button" class=${cx('chip', meal === l && 'on')} onClick=${() => setMeal(l)}><span class="chip-i">${e}</span>${l}</button>`)}</div>
    <div class="row date-row">
      <input class="inp" maxlength="500" placeholder="比如：番茄牛腩饭 + 冰美式" value=${text} onInput=${(e) => setText(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && save()} />
      <input class="inp date" type="date" value=${day} max=${today()} onInput=${(e) => e.target.value && setDay(e.target.value)} />
    </div>
    <${PhotoPicker} value=${photos} onChange=${setPhotos} max=${4} />
    <div class="row end">
      ${edit && html`<button type="button" class="btn ghost sm" onClick=${onDone}>取消</button>`}
      <button type="button" class="btn" disabled=${!text.trim() && !photos.length} onClick=${save}>${edit ? '保存' : '记下这顿'}</button>
    </div>
  </section>`;
}

function Meals() {
  useCols(['meal', 'react', 'profile', 'tz']);
  useNow(30000);
  const [edit, setEdit] = useState(null);
  const [limit, setLimit] = useState(10);
  const all = app.store.list('meal');
  const days = [...new Set(all.map((x) => x.day))].sort().reverse();
  const order = MEALS.map((m) => m[1]);
  return html`<div class="stack">
    ${edit ? html`<${MealForm} key=${edit.id} edit=${edit} onDone=${() => setEdit(null)} />` : html`<${MealForm} key="new" />`}
    ${!days.length && html`<${Empty} st="eat" text="暂无饮食记录" />`}
    ${days.slice(0, limit).map((d) => html`<section class="card meal-day" key=${d}>
      <div class="card-hd"><h3>${d} · 记录者当地日期</h3></div>
      <div class="meal-cols">
        ${[app.me, app.partner].map((w) => {
          const items = all.filter((x) => x.day === d && x.who === w).sort((a, b) => order.indexOf(a.meal) - order.indexOf(b.meal) || a.at - b.at);
          if (!items.length) return null;
          return html`<div class=${cx('meal-col', 'p-' + w)}>
            <div class="meal-who"><${Avatar} who=${w} size=${26} /> ${nameOf(w)}</div>
            <small class="muted">${localDayLabel(w, d)}${items[0].zone ? ' · ' + items[0].zone : ''}</small>
            ${items.length ? items.map((x) => html`<div class="meal-i" key=${x.id}>
              <div class="meal-row"><span class="meal-tag">${(MEALS.find((m) => m[1] === x.meal) || MEALS[3])[0]} ${x.meal}</span><span class="meal-t">${x.text}</span>
                ${x.who === app.me && html`<span class="meal-ops"><button class="icon-btn xs" aria-label="编辑" onClick=${() => setEdit(x)}><${Icon} n="edit" size=${14} /></button><button class="icon-btn xs" aria-label="删除" onClick=${() => confirmDel('删除这条？') && app.store.del('meal', x.id)}><${Icon} n="x" size=${14} /></button></span>`}</div>
              <${Photos} list=${x.photos} />
              <${Reacts} target=${`meal/${x.id}`} set="food" />
            </div>`) : html`<p class="muted sm">还没记</p>`}
          </div>`;
        })}
      </div>
    </section>`)}
    ${days.length > limit && html`<button class="btn ghost block" onClick=${() => setLimit(limit + 10)}>再看看更早的</button>`}
  </div>`;
}

// ---------- recipes ----------
function RecipeForm({ edit, onClose }) {
  const [name, setName] = useState(edit ? edit.name : '');
  const [ing, setIng] = useState(edit ? edit.ing || '' : '');
  const [steps, setSteps] = useState(edit ? edit.steps || '' : '');
  const [tags, setTags] = useState(edit ? (edit.tags || []).join(' ') : '');
  const [photos, setPhotos] = useState(edit ? edit.photos || [] : []);
  const save = () => {
    const n = name.trim();
    if (!n) return;
    const data = {
      name: n.slice(0, 60), ing: ing.trim().slice(0, 3000), steps: steps.trim().slice(0, 8000),
      tags: tags.split(/[\s,，、#]+/).map((t) => t.trim()).filter(Boolean).slice(0, 6), photos,
      who: edit ? edit.who : app.me, at: edit ? edit.at : Date.now(),
    };
    if (edit) app.store.put('recipe', edit.id, { ...strip(edit), ...data, editBy: app.me });
    else app.store.put('recipe', uid(), data);
    toast(edit ? '菜谱改好啦' : '菜谱放上去啦', { icon: stId(app.me, 'ok') });
    onClose();
  };
  return html`<${Modal} title=${edit ? '改菜谱' : '分享一个菜谱'} onClose=${onClose} cls="wide">
    <label class="lbl">菜名</label>
    <input class="inp" maxlength="60" placeholder="比如：可乐鸡翅" value=${name} onInput=${(e) => setName(e.target.value)} />
    <label class="lbl">食材（选填，一行一个）</label>
    <${AutoText} value=${ing} onInput=${setIng} rows=${3} maxLength=${3000} placeholder=${'鸡翅 10 个\n可乐 1 罐\n姜 3 片'} />
    <label class="lbl">做法</label>
    <${AutoText} value=${steps} onInput=${setSteps} rows=${5} maxLength=${8000} placeholder=${'1. 鸡翅两面划刀，冷水下锅焯水\n2. 煎到两面金黄\n3. 倒入可乐和生抽，小火收汁'} />
    <label class="lbl">标签（选填，空格分开）</label>
    <input class="inp" maxlength="80" placeholder="家常 快手 下饭" value=${tags} onInput=${(e) => setTags(e.target.value)} />
    <label class="lbl">成品图（选填）</label>
    <${PhotoPicker} value=${photos} onChange=${setPhotos} max=${4} />
    <div class="modal-ft"><button class="btn ghost" onClick=${onClose}>取消</button><button class="btn" disabled=${!name.trim()} onClick=${save}>${edit ? '保存' : '放上去'}</button></div>
  <//>`;
}

function stepsList(s) {
  return String(s || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^(\d+[.、)）]|[-*•·])\s*/, ''));
}

function RecipeCard({ x, open, onToggle, onEdit }) {
  useCols(['rcook']);
  const cooked = app.store.list('rcook', (c) => c.r === x.id).sort((a, b) => b.at - a.at);
  const steps = stepsList(x.steps);
  const ings = String(x.ing || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return html`<article class=${cx('recipe', open && 'open')}>
    <button type="button" class="recipe-hd" aria-expanded=${open} onClick=${onToggle}>
      <span class="recipe-name">${x.name}</span>
      <span class="chev"><${Icon} n=${open ? 'down' : 'right'} size=${18} /></span>
    </button>
    ${open && html`<div class="recipe-bd">
      <div class="recipe-meta"><${Avatar} who=${x.who} size=${24} />${(x.tags || []).map((t) => html`<em class="tag">${t}</em>`)}</div>
      <${Photos} list=${x.photos} />
      ${ings.length > 0 && html`<div class="recipe-sec"><h4>食材</h4><ul class="ing">${ings.map((l) => html`<li>${l}</li>`)}</ul></div>`}
      ${steps.length > 0 ? html`<div class="recipe-sec"><h4>做法</h4><ol class="steps">${steps.map((l) => html`<li>${l}</li>`)}</ol></div>` : html`<p class="muted">暂无做法</p>`}
      <div class="recipe-ft">
        <small class="muted">${nameOf(x.who)} 分享的${x.editBy && x.editBy !== x.who ? ` · ${nameOf(x.editBy)} 改过` : ''}${cooked.length ? ` · 做过 ${cooked.length} 次，最近一次 ${fmtDay(cooked[0].day)}` : ''}</small>
        <span class="sp"></span>
        <button class="btn xs" onClick=${() => { app.store.put('rcook', uid(), { r: x.id, who: app.me, day: today(), at: Date.now() }); toast(`做了「${x.name}」，好吃吗？`, { icon: stId(app.me, 'eat') }); }}>今天做了</button>
        <button class="btn xs ghost" onClick=${() => onEdit(x)}>编辑</button>
        <button class="btn xs ghost" onClick=${() => confirmDel(`删除菜谱「${x.name}」？`) && app.store.del('recipe', x.id)}>删除</button>
      </div>
      <${Reacts} target=${`recipe/${x.id}`} set="food" />
    </div>`}
  </article>`;
}

function Recipes() {
  useCols(['recipe']);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => new Set());
  const [form, setForm] = useState(null);
  const ql = q.trim().toLowerCase();
  const list = app.store
    .list('recipe', (x) => !ql || [x.name, x.ing, x.steps, ...(x.tags || [])].join(' ').toLowerCase().includes(ql))
    .sort((a, b) => (b.at || b._t) - (a.at || a._t));
  const toggle = (id) => {
    const n = new Set(open);
    n.has(id) ? n.delete(id) : n.add(id);
    setOpen(n);
  };
  const roll = () => {
    const all = app.store.list('recipe');
    if (!all.length) return;
    const r = pick(all);
    setQ('');
    setOpen(new Set([r.id]));
    toast(`今天做「${r.name}」怎么样？`, { icon: stId(app.me, 'idea') });
  };
  return html`<div class="stack">
    <div class="row recipe-tools">
      <label class="search"><${Icon} n="search" size=${18} /><input class="inp" placeholder="搜菜名、食材、标签" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
      <button class="btn ghost" onClick=${roll} title="随机一道"><${Icon} n="dice" size=${18} /></button>
      <button class="btn" onClick=${() => setForm({})}><${Icon} n="plus" size=${18} /> 菜谱</button>
    </div>
    <p class="hint">点菜名展开做法，两个人都能编辑。</p>
    <div class="recipe-list card">
      ${list.length ? list.map((x) => html`<${RecipeCard} key=${x.id} x=${x} open=${open.has(x.id)} onToggle=${() => toggle(x.id)} onEdit=${(r) => setForm({ edit: r })} />`)
        : html`<${Empty} st="idea" text=${ql ? '没找到这道菜' : '暂无菜谱'} />`}
    </div>
    ${form && html`<${RecipeForm} edit=${form.edit} onClose=${() => setForm(null)} />`}
  </div>`;
}

// ---------- wishlist ----------
const WISH_KINDS = [['🍜', '想吃的菜'], ['🏪', '想去的店'], ['🧋', '零食饮品'], ['🍰', '甜品'], ['✈️', '旅行美食']];

function Wishes() {
  useCols(['wish', 'react']);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('🍜');
  const [where, setWhere] = useState('');
  const [tab, setTab] = useState('todo');
  const all = app.store.list('wish');
  const list = all.filter((x) => (tab === 'todo' ? !x.done : x.done)).sort((a, b) => (tab === 'todo' ? (b.at || b._t) - (a.at || a._t) : (b.doneAt || 0) - (a.doneAt || 0)));
  const add = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    app.store.put('wish', uid(), { name: n.slice(0, 60), kind, where: where.trim().slice(0, 80), who: app.me, at: Date.now(), done: false });
    setName('');
    setWhere('');
  };
  const want = (x) => app.store.put('wish', x.id, { ...strip(x), plus: [...new Set([...(x.plus || []), app.me])] });
  const unwant = (x) => app.store.put('wish', x.id, { ...strip(x), plus: (x.plus || []).filter((w) => w !== app.me) });
  const done = (x) => app.store.put('wish', x.id, { ...strip(x), done: !x.done, doneAt: x.done ? 0 : Date.now(), doneDay: x.done ? '' : today() });
  return html`<div class="stack">
    <form class="card wish-form" onSubmit=${add}>
      <div class="meal-form-hd"><${St} id=${stId(app.me, 'tea')} size=${56} title="" /><b>想吃什么？记下来</b></div>
      <div class="chips">${WISH_KINDS.map(([e, l]) => html`<button type="button" class=${cx('chip', kind === e && 'on')} onClick=${() => setKind(e)}><span class="chip-i">${e}</span>${l}</button>`)}</div>
      <div class="row">
        <input class="inp" maxlength="60" placeholder="比如：楼下新开的烤肉" value=${name} onInput=${(e) => setName(e.target.value)} />
        <input class="inp" maxlength="80" placeholder="在哪（选填）" value=${where} onInput=${(e) => setWhere(e.target.value)} />
        <button class="btn" disabled=${!name.trim()}>记下</button>
      </div>
    </form>
    <${Seg} value=${tab} onChange=${setTab} options=${[{ value: 'todo', label: `想吃的 ${all.filter((x) => !x.done).length}` }, { value: 'done', label: `吃到啦 ${all.filter((x) => x.done).length}` }]} />
    <div class="wish-grid">
      ${list.length ? list.map((x) => {
        const plus = new Set([x.who, ...(x.plus || [])]);
        const both = plus.has(app.me) && plus.has(app.partner);
        return html`<article class=${cx('card wish', both && 'both', x.done && 'done')} key=${x.id}>
          <div class="wish-hd"><span class="wish-k">${x.kind}</span><b>${x.name}</b></div>
          ${x.where && html`<small class="muted">📍 ${x.where}</small>`}
          <div class="wish-who">${[...plus].map((w) => html`<${Avatar} who=${w} size=${24} />`)}<small class="muted">${both ? '都想吃' : `${nameOf(x.who)} 想吃`}</small></div>
          ${x.done && html`<small class="muted">${x.doneDay ? fmtDay(x.doneDay) : ''}吃到啦</small>`}
          <div class="wish-ft">
            ${!x.done && (plus.has(app.me) ? (x.who !== app.me ? html`<button class="btn xs ghost" onClick=${() => unwant(x)}>不想了</button>` : null) : html`<button class="btn xs" onClick=${() => want(x)}>我也想</button>`)}
            <button class="btn xs ghost" onClick=${() => done(x)}>${x.done ? '还想再吃' : '吃到啦'}</button>
            ${x.who === app.me && html`<button class="icon-btn xs" aria-label="删除" onClick=${() => confirmDel('删掉这个？') && app.store.del('wish', x.id)}><${Icon} n="x" size=${14} /></button>`}
          </div>
          ${x.done && html`<${Reacts} target=${`wish/${x.id}`} set="food" />`}
        </article>`;
      }) : html`<${Empty} st=${tab === 'todo' ? 'tea' : 'eat'} text=${tab === 'todo' ? '暂无想吃的' : '暂无已吃记录'} />`}
    </div>
  </div>`;
}

export const LIFE_TABS = [
  { value: 'meal', label: '吃了啥', key: 'eat' },
  { value: 'recipe', label: '菜谱', key: 'idea' },
  { value: 'wish', label: '想吃的', key: 'tea' },
  { value: 'fit', label: '运动', key: 'run' },
  { value: 'cal', label: '日历', key: 'salute' },
];

export function Life({ param }) {
  const tab = param === 'cal-personal' ? 'cal' : LIFE_TABS.some((t) => t.value === param) ? param : 'meal';
  return html`<div class="page life">
    <div class="page-hd"><h2>生活</h2></div>
    <${Seg} value=${tab} onChange=${(v) => (location.hash = '#/life/' + v)} cls="big"
      options=${LIFE_TABS.map((t) => ({ value: t.value, label: t.label, st: stId(app.me, t.key) }))} />
    ${tab === 'meal' && html`<${Meals} />`}
    ${tab === 'recipe' && html`<${Recipes} />`}
    ${tab === 'wish' && html`<${Wishes} />`}
    ${tab === 'fit' && html`<${Fit} />`}
    ${tab === 'cal' && html`<${Cal} scope=${param === 'cal-personal' ? 'personal' : 'together'} />`}
  </div>`;
}
