// Shared content reader used by Home Recent and the Learning shelf.
import { html } from './h.js?v=f8c0c1b1d6';
import { useState } from '../vendor/hooks.js';
import { app, useCols, nameOf, localDayLabel } from '../lib/ctx.js?v=f8c0c1b1d6';
import { uid, cx } from '../lib/util.js?v=f8c0c1b1d6';
import { SHARE_TYPES, safeLink, shareTitle, shareRoute } from '../lib/shares.js?v=f8c0c1b1d6';
import { planScope, planOwner } from '../lib/plans.js?v=f8c0c1b1d6';
import { Avatar, Modal, Photos, Reacts, confirmDel } from './common.js?v=f8c0c1b1d6';
import { Icon } from './icons.js?v=f8c0c1b1d6';

export function Comments({ target }) {
  useCols('cmt');
  const list = app.store.list('cmt', (x) => x.t === target).sort((a,b) => a.at-b.at);
  const [text, setText] = useState('');
  const send = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const slash = target.indexOf('/');
    const parent = app.store.get(target.slice(0,slash),target.slice(slash+1));
    if (!parent || parent.to === 'me' || parent.private || parent._private || parent._local) return;
    app.store.put('cmt', uid(), { t:target, who:app.me, text:t.slice(0,500), at:Date.now() });
    setText('');
  };
  return html`<div class="cmts">
    ${list.map((c) => html`<div class="cmt" key=${c.id}><${Avatar} who=${c.who} size=${22} /><span class="cmt-t">${c.text}</span>${c.who === app.me && html`<button class="icon-btn xs" aria-label="删除回复" onClick=${() => confirmDel('删除这条回复？') && app.store.del('cmt',c.id)}><${Icon} n="x" size=${12} /></button>`}</div>`)}
    <form class="cmt-in" onSubmit=${send}><input class="inp sm" aria-label="回复内容" maxlength="500" placeholder="回一句…" value=${text} onInput=${(e) => setText(e.target.value)} />${text.trim() && html`<button class="btn xs">回复</button>`}</form>
  </div>`;
}

export function ShareDetail({ col, id, onClose }) {
  useCols([col,'profile','tz']);
  const x = app.store.list(col).find((v) => v.id === id);
  const eligible = SHARE_TYPES[col] && x && x.to !== 'me' && !x.private && !x._private && !x._local;
  if (!eligible) return html`<${Modal} title="这条分享已不在这里" onClose=${onClose}><p class="hint">记录可能已删除或改为私人内容。</p><button class="btn" onClick=${onClose}>知道了</button><//>`;
  const link = safeLink(x.link);
  return html`<${Modal} title=${SHARE_TYPES[col].label} onClose=${onClose} cls="share-reader">
    <header class=${cx('entry-hd','p-'+x.who)}><${Avatar} who=${x.who} size=${36} /><div class="entry-meta"><b>${nameOf(x.who)}</b><small class="muted">${x.day ? localDayLabel(x.who,x.day) : '共同收好的小东西'}${x.zone ? ' · '+x.zone : ''}</small></div></header>
    <h3 class="share-title">${col === 'journal' ? (x.to === 'ta' ? '给对方的留言' : '生活里的小事') : shareTitle(col,x)}</h3>
    ${x.text && col !== 'meal' && html`<div class="entry-t">${x.text}</div>`}
    ${x.note && html`<div class="entry-t">${x.note}</div>`}
    ${col === 'wish' && x.where && html`<p class="hint">地点：${x.where}</p>`}
    ${col === 'recipe' && html`<h4>食材</h4><div class="entry-t">${x.ing}</div><h4>做法</h4><div class="entry-t">${x.steps}</div>`}
    ${col === 'plan' && html`<p class="hint">${planScope(x) === 'personal' ? nameOf(planOwner(x)) + ' 的个人计划' : '一起的计划'}</p>`}
    ${(col === 'plan' || col === 'meet' || col === 'anniv') && html`<p class="hint">${x.date || '日期待定'}${x.time ? ' '+x.time : ''}${x.where ? ' · '+x.where : ''}</p>`}
    ${link && html`<a class="share-link" href=${link} target="_blank" rel="noopener noreferrer"><${Icon} n="link" size=${18} />${link}</a>`}
    <${Photos} list=${x.photos} />
    <${Reacts} target=${col+'/'+id} set=${col === 'meal' || col === 'recipe' ? 'food' : col === 'workout' ? 'fit' : 'def'} />
    <${Comments} target=${col+'/'+id} />
    <div class="row end"><a class="btn ghost sm" href=${col === 'learn' ? '#/learn' : shareRoute(col,x)} onClick=${(e) => { e.preventDefault(); onClose(); location.hash = col === 'learn' ? '#/learn' : shareRoute(col,x); }}>${col === 'learn' ? '回到学习分享' : '在'+(col === 'journal' ? '记录' : '生活')+'中打开'} <${Icon} n="right" size=${16} /></a></div>
  <//>`;
}
