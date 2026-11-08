// Learning is about what we share, not elapsed time or matching progress.
import { html } from '../h.js?v=6970b80344';
import { useState, useEffect } from '../../vendor/hooks.js';
import { app, useCols, nameOf, localDayLabel, toast, stId } from '../../lib/ctx.js?v=6970b80344';
import { uid, today, cx } from '../../lib/util.js?v=6970b80344';
import { localZone } from '../../lib/time.js?v=6970b80344';
import { safeLink, recentShares, shareTitle, sharePreview } from '../../lib/shares.js?v=6970b80344';
import { Avatar, PhotoPicker, AutoText, Modal, Empty, Img, strip, confirmDel } from '../common.js?v=6970b80344';
import { ShareDetail } from '../shares.js?v=6970b80344';
import { Icon } from '../icons.js?v=6970b80344';
import { Drafts } from './together.js?v=6970b80344';
import { TaskList } from './home.js?v=6970b80344';

function LearningForm({ edit, onClose, onSaved }) {
  const [id] = useState(() => edit?.id || uid());
  const [createdAt] = useState(() => edit?.at || edit?._t || Date.now());
  const [title,setTitle] = useState(edit?.title || '');
  const [text,setText] = useState(edit?.text || '');
  const [link,setLink] = useState(edit?.link || '');
  const [day,setDay] = useState(edit?.day || today());
  const [photos,setPhotos] = useState(edit?.photos || []);
  const [busy,setBusy] = useState(false), [saving,setSaving] = useState(false), [err,setErr] = useState('');
  const hasContent = title.trim() || text.trim() || link.trim() || photos.length;
  const close = () => { if (!saving) onClose(); };
  const save = async (e) => {
    e.preventDefault();
    if (!hasContent || busy || saving) return;
    const url = safeLink(link);
    if (link.trim() && !url) return setErr('资料链接请使用有效的 http / https 地址。');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return setErr('选一个记录日期，再分享吧。');
    if (edit && !app.store.get('learn',edit.id)) return setErr('原记录已被删除，请关闭后重新分享。');
    setSaving(true); setErr('');
    const shared = photos.map((p) => { const {loc,...rest}=p; return rest; });
    const data = { ...(edit ? strip(edit) : {}), who:edit?.who || app.me, title:title.trim().slice(0,120), text:text.trim().slice(0,5000), link:url, day, zone:edit?.zone || localZone(), at:createdAt, photos:shared };
    try {
      app.store.put('learn',id,data);
      if (await app.store.flush() === false) throw new Error('local save failed');
      const newPhotos = photos.filter((p) => p.loc);
      for (const p of newPhotos) { app.sync.shareBlob(p.id); app.sync.shareBlob(p.th); }
      if (newPhotos.length) await app.store.setMeta('blobOut',{...app.sync.blobOut});
      toast(edit ? '学习分享已更新' : '分享了学到的一点东西', {icon:stId(app.me,'ok')});
      onSaved(id);
    } catch { setSaving(false); setErr('保存遇到了问题，内容还在这里，请再试一次。'); }
  };
  return html`<${Modal} title=${edit ? '编辑学习分享' : '分享学到的东西'} onClose=${close} cls="learn-editor">
    <form onSubmit=${save}>
      <label class="lbl" for="learn-title">学了什么（选填）</label><input id="learn-title" class="inp" maxlength="120" placeholder="标题" value=${title} onInput=${(e)=>setTitle(e.target.value)} />
      <label class="lbl" for="learn-text">想分享的内容（选填）</label><${AutoText} id="learn-text" cls="learn-text" value=${text} onInput=${setText} rows=${4} maxLength=${5000} placeholder="学习内容" />
      <label class="lbl" for="learn-link">资料链接（选填）</label><input id="learn-link" class="inp" type="text" inputmode="url" maxlength="2000" placeholder="https://…" value=${link} onInput=${(e)=>setLink(e.target.value)} />
      <label class="lbl" for="learn-day">这条分享的当地日期</label><input id="learn-day" class="inp" type="date" value=${day} onInput=${(e)=>setDay(e.target.value)} />
      <label class="lbl">笔记 / 图片（选填）</label><${PhotoPicker} value=${photos} onChange=${setPhotos} local=${true} max=${6} onBusy=${setBusy} />
      <p class="hint">图片在点「分享」前只保存在本机。</p>
      ${err && html`<p class="err" role="alert">${err}</p>`}
      <div class="modal-ft"><button class="btn ghost" type="button" disabled=${saving} onClick=${close}>取消</button><button class="btn" type="submit" disabled=${!hasContent || busy || saving}>${saving ? '保存中…' : edit ? '保存修改' : '分享'}</button></div>
    </form>
  <//>`;
}

export function Learn({ param }) {
  useCols(['learn','profile','tz']);
  const [form,setForm] = useState(null), [query,setQuery] = useState(''), [who,setWho] = useState('');
  const [selected,setSelected] = useState('');
  useEffect(()=>{ setSelected(param && param !== 'new' ? param : ''); if(param==='new') setForm({}); },[param]);
  const closeDetail = () => { setSelected(''); if(param && param!=='new') { location.hash='#/learn'; } };
  const saved = () => { setForm(null); if(param==='new') location.hash='#/learn'; };
  const list = recentShares(app.store,{group:'learn',query,who});
  const [limit,setLimit] = useState(20);
  useEffect(()=>setLimit(20),[query,who]);
  return html`<div class="page learning">
    <div class="page-hd"><h2>学习</h2><button class="btn" onClick=${()=>setForm({})}><${Icon} n="plus" size=${18} /> 分享学了什么</button></div>
    <div class="learn-toolbar row wrap"><label class="search"><${Icon} n="search" size=${18} /><input class="inp" aria-label="搜索学习分享" placeholder="找内容、笔记或资料…" value=${query} onInput=${(e)=>setQuery(e.target.value)} /></label><select class="inp share-who" aria-label="学习分享者" value=${who} onChange=${(e)=>setWho(e.target.value)}><option value="">两个人的</option><option value=${app.me}>我分享的</option><option value=${app.partner}>${nameOf(app.partner)} 分享的</option></select></div>
    ${list.length ? html`<div class="learning-list">${list.slice(0,limit).map(({x,key})=>html`<article class=${cx('card learn-card','p-'+x.who)} key=${key}>
      <header class="entry-hd"><${Avatar} who=${x.who} size=${32} /><div class="entry-meta"><b>${nameOf(x.who)}</b><small class="muted">${localDayLabel(x.who,x.day)}${x.zone ? ' · '+x.zone : ''}</small></div>${x.who===app.me && html`<span class="entry-ops"><button class="icon-btn sm" aria-label="编辑学习分享" onClick=${()=>setForm({edit:x})}><${Icon} n="edit" size=${16} /></button><button class="icon-btn sm" aria-label="删除学习分享" onClick=${()=>confirmDel('删除这条学习分享？')&&app.store.del('learn',x.id)}><${Icon} n="trash" size=${16} /></button></span>`}</header>
      <button class="learn-open" onClick=${()=>setSelected(x.id)}>${x.photos?.length ? html`<${Img} id=${x.photos[0].th||x.photos[0].id} cls="learn-thumb" />` : null}<span><strong>${shareTitle('learn',x)}</strong><small>${sharePreview('learn',x)}</small><em>${x.link ? '含资料链接 · ' : ''}${x.photos?.length ? x.photos.length+' 张图片 · ' : ''}打开看看 <${Icon} n="right" size=${14} /></em></span></button>
    </article>`)}</div>` : html`<${Empty} st="read" text=${query||who ? '没有匹配的学习分享' : '暂无学习分享'} />`}
    ${list.length>limit && html`<button class="btn ghost block" onClick=${()=>setLimit(limit+20)}>再看看更早的</button>`}
    <section class="learning-tools">
      <h3>学习小工具</h3>
      <details class="learning-drafts" open>
        <summary>待办与草稿纸</summary>
        <div class="grid2"><${TaskList} who=${app.me} /><${TaskList} who=${app.partner} /></div>
        <${Drafts} />
      </details>
      <div class="card learning-tools-hd learning-focus"><h3>专注</h3><a class="chip" href="#/together"><${Icon} n="clock" size=${16} /> 专注计时</a></div>
    </section>
    ${selected && html`<${ShareDetail} col="learn" id=${selected} onClose=${closeDetail} />`}
    ${form && html`<${LearningForm} key=${form.edit?.id||'new'} edit=${form.edit} onClose=${()=>{setForm(null);if(param==='new')location.hash='#/learn';}} onSaved=${saved} />`}
  </div>`;
}
