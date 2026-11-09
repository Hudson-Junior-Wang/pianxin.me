// Recent shared moments: people first, content next, newest updated first.
import { html } from './h.js?v=ef34bd8a76';
import { useState, useEffect } from '../vendor/hooks.js';
import { app, useCols, nameOf, localDayLabel, stId } from '../lib/ctx.js?v=ef34bd8a76';
import { fmtDay, fmtHM, dayKey, cx } from '../lib/util.js?v=ef34bd8a76';
import { SHARE_TYPES, SHARE_COLS, recentShares, shareTitle, sharePreview } from '../lib/shares.js?v=ef34bd8a76';
import { Img, Empty, Modal, St, Avatar } from './common.js?v=ef34bd8a76';
import { ShareDetail } from './shares.js?v=ef34bd8a76';
import { Icon } from './icons.js?v=ef34bd8a76';

const SHARE_CHOICES = [
  { key: 'journal', label: '生活点滴', hint: '文字、照片或留言', st: 'read', route: '#/journal' },
  { key: 'learn', label: '学习分享', hint: '笔记、资料或新发现', st: 'study', route: '#/learn/new' },
  { key: 'meal', label: '吃了什么', hint: '记一顿饭', st: 'eat', route: '#/life/meal' },
  { key: 'recipe', label: '分享菜谱', hint: '食材和做法', st: 'idea', route: '#/life/recipe' },
  { key: 'wish', label: '想吃的', hint: '菜、店或零食', st: 'tea', route: '#/life/wish' },
  { key: 'fit', label: '运动记录', hint: '记一次运动', st: 'run', route: '#/life/fit' },
  { key: 'personal', label: '各自的计划', hint: '放下自己的安排', st: 'done', route: '#/journal/cal-personal' },
  { key: 'together', label: '一起的计划', hint: '收好共同的安排', st: 'salute', route: '#/journal/cal' },
];

function ShareChooser({ onClose }) {
  return html`<${Modal} title="留点小东西" cls="wide share-chooser" onClose=${onClose}>
    <p class="share-chooser-hint muted">想分享哪一种？选好后再去填写。</p>
    <div class="share-choices">${SHARE_CHOICES.map((c, i) => html`<a class="share-choice" key=${c.key} data-choice=${c.key} href=${c.route} style=${`--choice-order:${i}`} onClick=${(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); onClose(); location.hash = c.route; }}>
      <${St} id=${stId(app.me, c.st)} size=${52} title="" /><span><b>${c.label}</b><small>${c.hint}</small></span><${Icon} n="right" size=${16} />
    </a>`)}</div>
  <//>`;
}

export function Recent() {
  useCols([...SHARE_COLS,'profile','tz']);
  const [group,setGroup] = useState('all'),[who,setWho] = useState(''),[query,setQuery] = useState(''),[limit,setLimit] = useState(20),[selected,setSelected] = useState(null);
  const [choosing, setChoosing] = useState(false);
  useEffect(()=>setLimit(20),[group,who,query]);
  const list=recentShares(app.store,{group,who,query});
  return html`<section class="recent-shares">
    <div class="recent-heading"><div><h3><${St} id="d-listen" size=${42} cls="recent-heading-art" title="" />最近分享</h3></div><button type="button" class="btn sm share-launch" aria-haspopup="dialog" aria-expanded=${choosing} onClick=${(e) => { e.currentTarget.focus({ preventScroll: true }); setChoosing(true); }}>留点小东西 <${Icon} n="plus" size=${16} /></button></div>
    <div class="recent-tools"><div class="chips" role="group" aria-label="分享类型">${[['all','全部'],['learn','学习'],['life','生活'],['cal','安排']].map(([k,label])=>html`<button class=${cx('chip',group===k&&'on')} aria-pressed=${group===k} onClick=${()=>setGroup(k)}>${label}</button>`)}</div><div class="row"><label class="search"><${Icon} n="search" size=${18} /><input class="inp" aria-label="搜索最近分享" placeholder="找分享过的内容…" value=${query} onInput=${(e)=>setQuery(e.target.value)} /></label><select class="inp share-who" aria-label="分享者" value=${who} onChange=${(e)=>setWho(e.target.value)}><option value="">两个人的</option><option value=${app.me}>我分享的</option><option value=${app.partner}>${nameOf(app.partner)} 分享的</option></select></div></div>
    ${list.length ? html`<div class="recent-list">${list.slice(0,limit).map(({col,x,key,updated})=>html`<button type="button" class="recent-row" key=${key} data-share=${key} onClick=${()=>setSelected({col,id:x.id})}>
      <span class="recent-head">
        <span class="recent-author"><span aria-hidden="true"><${Avatar} who=${x.who||x._by} size=${32} /></span><span class="recent-byline"><b>${nameOf(x.who||x._by)}</b>${x.day && html`<time class="recent-day" dateTime=${x.day}>${localDayLabel(x.who||x._by,x.day)}</time>`}</span></span>
        <span class=${cx('recent-type','type-'+SHARE_TYPES[col].group)}><${Icon} n=${SHARE_TYPES[col].icon} size=${13} />${SHARE_TYPES[col].label}</span>
      </span>
      <span class=${cx('recent-content',x.photos?.length&&'has-photo')}>
        <span class="recent-main"><strong>${shareTitle(col,x)}</strong>${sharePreview(col,x) && !(col==='journal' && x.to!=='ta' && x.photos?.length) && html`<span class="recent-preview">${sharePreview(col,x)}</span>`}</span>
        ${x.photos?.length ? html`<span class="recent-photo"><${Img} id=${x.photos[0].th||x.photos[0].id} cls="recent-thumb" /></span>` : null}
      </span>
      <span class="recent-foot">${x.photos?.length ? html`<span class="recent-photo-count"><${Icon} n="image" size=${13} />${x.photos.length} 张图片</span>` : null}
        <time class="recent-updated" dateTime=${new Date(updated).toISOString()}><span>更新于</span> ${fmtDay(dayKey(new Date(updated)))} ${fmtHM(updated)}</time><${Icon} n="right" cls="recent-arrow" size=${15} />
      </span>
    </button>`)}</div>` : html`<${Empty} st="read" text=${group!=='all'||who||query ? '没有匹配的分享' : '暂无分享'} />`}
    ${list.length>limit && html`<button class="btn ghost block" onClick=${()=>setLimit(limit+20)}>看看更早的分享</button>`}
    ${choosing && html`<${ShareChooser} onClose=${() => setChoosing(false)} />`}
    ${selected && html`<${ShareDetail} col=${selected.col} id=${selected.id} onClose=${()=>setSelected(null)} />`}
  </section>`;
}
