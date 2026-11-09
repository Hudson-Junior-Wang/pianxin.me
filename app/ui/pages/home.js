// 偏心我 · 首页 — 最近分享为主，状态和打招呼轻轻放在后面
import { html } from '../h.js?v=4420681d90';
import { useState } from '../../vendor/hooks.js';
import { app, useCols, useNow, useSyncEvent, nameOf, MOODS, moodOf, NEEDS, needOf, needTagsOf, NEED_TAG_LIMIT, NEED_TAG_LENGTH, dayOf, timeOf, zoneOf, localDayLabel, toast, stId, openChat } from '../../lib/ctx.js?v=4420681d90';
import { poke, POKE_KINDS } from '../../lib/feed.js?v=4420681d90';
import { uid, today, cx, fmtDayFull } from '../../lib/util.js?v=4420681d90';
import { Recent } from '../recent.js?v=4420681d90';
import { Avatar, Dot, Modal, St, strip } from '../common.js?v=4420681d90';
import { Icon } from '../icons.js?v=4420681d90';

// ---------- status card ----------
function StatusCard({ who }) {
  useCols(['status', 'profile', 'tz']);
  useSyncEvent('presence');
  useNow(30000);
  const mine = who === app.me;
  const st = app.store.get('status', who);
  const mood = st && moodOf(st.mood);
  const need = needOf(st);
  const tags = needTagsOf(st);
  const [edit, setEdit] = useState(false);
  const [editTags, setEditTags] = useState(false);
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
        ${need && html`<div class="sc-need"><b>${need.label}</b>${(mine ? need.hint : need.ta) && html`<small>${mine ? need.hint : need.ta}</small>`}</div>`}
      </div>
      ${mine && html`<button class="btn sm ghost sc-edit" onClick=${() => setEdit(true)}>改状态</button>`}
    </div>
    ${mine && html`<div class="need-row">
      ${tags.map((n) => html`<button type="button" class=${cx('chip', need?.k === n.k && 'on')} key=${n.k} aria-pressed=${need?.k === n.k} onClick=${() => app.store.patch('status', app.me, { need: st?.need === n.k ? null : n.k, at: Date.now() })}>${n.label}</button>`)}
      ${need && html`<button type="button" class="chip" onClick=${() => app.store.patch('status', app.me, { need: null, at: Date.now() })}>不需要了</button>`}
      <button type="button" class="chip ghost need-customize" onClick=${() => setEditTags(true)}>自定义标签</button>
    </div>`}
    ${!mine && need && !need.custom && need.k !== 'quiet' && html`<${NeedActions} need=${need.k} />`}
    ${edit && html`<${StatusEditor} onClose=${() => setEdit(false)} />`}
    ${editTags && html`<${NeedTagsEditor} onClose=${() => setEditTags(false)} />`}
  </section>`;
}

function NeedActions({ need }) {
  const send = (k, msg) => poke(k) && toast(msg, { icon: stId(app.me, POKE_KINDS[k].st), kind: 'soft', ms: 2400 });
  if (need === 'chat') return html`<div class="need-acts"><button class="btn sm" onClick=${openChat}><${Icon} n="chat" size=${16} /> 去聊天</button><button class="btn sm ghost" onClick=${() => send('hi', '打过招呼啦')}>打个招呼</button></div>`;
  if (need === 'comfort') return html`<div class="need-acts"><button class="btn sm" onClick=${() => send('pat', '拍拍送到啦')}>拍拍 TA</button><button class="btn sm ghost" onClick=${openChat}>说点什么</button></div>`;
  if (need === 'vent') return html`<div class="need-acts"><button class="btn sm" onClick=${() => send('listen', 'TA 知道你在听啦')}>我在听</button><button class="btn sm ghost" onClick=${openChat}>去听 TA 说</button></div>`;
  return null;
}

function NeedTagsEditor({ onClose }) {
  const [initial] = useState(() => needTagsOf(app.store.get('status', app.me)));
  const [tags, setTags] = useState(initial);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const change = (k, label) => { setTags(tags.map((n) => n.k === k ? { ...n, label } : n)); setErr(''); };
  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    const cleaned = tags.map((n) => ({ k: n.k, label: n.label.replace(/\s+/g, ' ').trim().slice(0, NEED_TAG_LENGTH) }));
    if (cleaned.some((n) => !n.label)) return setErr('填好标签文字，或删除空白标签。');
    if (new Set(cleaned.map((n) => n.label.toLowerCase())).size !== cleaned.length) return setErr('标签文字重复了，换一个吧。');
    setSaving(true); setErr('');
    try {
      const current = app.store.get('status', app.me) || {};
      const removed = initial.some((n) => n.k === current.need) && !cleaned.some((n) => n.k === current.need);
      app.store.patch('status', app.me, { needTags: cleaned, ...(removed ? { need: null } : {}) });
      if (await app.store.flush() === false) throw new Error('local save failed');
      onClose();
    } catch { setSaving(false); setErr('保存遇到了问题，标签还在这里，请再试一次。'); }
  };
  return html`<${Modal} title="自定义标签" cls="need-tags-editor" onClose=${() => { if (!saving) onClose(); }}>
    <form onSubmit=${save}>
      <p class="hint">编辑自己的常用标签，最多 ${NEED_TAG_LIMIT} 个，每个 ${NEED_TAG_LENGTH} 字。</p>
      <div class="need-tag-list">${tags.map((n, i) => html`<div class="need-tag-item" key=${n.k}>
        <input class="inp" aria-label=${`标签 ${i + 1}`} maxlength=${NEED_TAG_LENGTH} value=${n.label} disabled=${saving} onInput=${(e) => change(n.k, e.target.value)} />
        <button type="button" class="icon-btn" aria-label=${`删除标签 ${i + 1}`} disabled=${saving} onClick=${() => { setTags(tags.filter((x) => x.k !== n.k)); setErr(''); }}><${Icon} n="x" size=${18} /></button>
      </div>`)}</div>
      <div class="row wrap need-tag-tools">
        <button type="button" class="btn sm ghost" disabled=${saving || tags.length >= NEED_TAG_LIMIT} onClick=${() => { setTags([...tags, { k: 'custom-' + uid(), label: '' }]); setErr(''); }}><${Icon} n="plus" size=${16} /> 添加标签</button>
        <button type="button" class="btn sm ghost" disabled=${saving} onClick=${() => { setTags(NEEDS.map(({ k, label }) => ({ k, label }))); setErr(''); }}>恢复默认</button>
      </div>
      ${err && html`<p class="err" role="alert">${err}</p>`}
      <div class="modal-ft"><button type="button" class="btn ghost" disabled=${saving} onClick=${onClose}>取消</button><button type="submit" class="btn" disabled=${saving}>${saving ? '保存中…' : '保存标签'}</button></div>
    </form>
  <//>`;
}

function StatusEditor({ onClose }) {
  useCols(['status']);
  const st = app.store.get('status', app.me) || {};
  const tags = needTagsOf(st);
  const current = needOf(st);
  const [mood, setMood] = useState(moodOf(st.mood)?.k || '');
  const [note, setNote] = useState(st.note || '');
  const [need, setNeed] = useState(st.need || null);
  const save = () => {
    app.store.patch('status', app.me, { mood, note: note.trim().slice(0, 40), need, at: Date.now() });
    onClose();
  };
  return html`<${Modal} title="现在的我" cls="status-editor" onClose=${onClose}>
    <label class="lbl">心情</label>
    <div class="mood-grid">${MOODS.map((m) => html`<button class=${cx('mood-b', mood === m.k && 'on')} onClick=${() => setMood(mood === m.k ? '' : m.k)}><${St} id=${stId(app.me, m.st)} size=${48} title="" /><small>${m.label}</small></button>`)}</div>
    <label class="lbl">一句话（选填）</label>
    <input class="inp" maxlength="40" placeholder="比如：在图书馆三楼 / 今天有点累" value=${note} onInput=${(e) => setNote(e.target.value)} />
    <label class="lbl">状态标签</label>
    <div class="chips">
      <button type="button" class=${cx('chip', !need && 'on')} onClick=${() => setNeed(null)}>不选标签</button>
      ${tags.map((n) => html`<button type="button" class=${cx('chip', need === n.k && 'on')} onClick=${() => setNeed(n.k)}>${n.label}</button>`)}
      ${current && !tags.some((n) => n.k === current.k) && html`<button type="button" class=${cx('chip', need === current.k && 'on')} onClick=${() => setNeed(current.k)}>${current.label}</button>`}
    </div>
    ${need === 'quiet' && html`<p class="hint">消息和戳一下不会响。</p>`}
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
    <p class="hint">${localDayLabel(who, day)}</p>
    <ul class="task-ul">
      ${list.map(
        (x) => html`<li key=${x.id} class=${cx('task', x.done && 'done')}>
          <label class="ck"><input type="checkbox" checked=${x.done} disabled=${!mine} onChange=${() => toggle(x)} /><span class="ck-box"></span></label>
          <span class="task-t">${x.text}${x.day < day && !x.done ? html`<small class="muted"> · 之前的</small>` : null}</span>
          ${mine && html`<button class="icon-btn sm" aria-label="删除" onClick=${() => app.store.del('task', x.id)}><${Icon} n="x" size=${14} /></button>`}
        </li>`,
      )}
    </ul>
    ${!list.length && html`<p class="hint">暂无待办</p>`}
    ${mine && html`<form class="row add-row" onSubmit=${add}><input class="inp" maxlength="120" placeholder="加一项任务" value=${text} onInput=${(e) => setText(e.target.value)} /><button class="btn sm" disabled=${!text.trim()}>添加</button></form>`}
  </section>`;
}

export function Home() {
  useNow(30000);
  const hour = new Date().getHours();
  const hi = hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  return html`<div class="page home">
    <div class="page-hd"><div><h2>${hi}，${nameOf(app.me)}</h2><span class="muted">${fmtDayFull(today())}</span></div></div>
    <${Recent} />
    <details class="home-corner" open><summary>近况与打招呼</summary>
      <div class="grid2"><${StatusCard} who=${app.partner} /><${StatusCard} who=${app.me} /></div>
      <${PokeRow} />
    </details>
  </div>`;
}
