// 偏心我 · shared UI pieces
import { html, render } from './h.js?v=6970b80344';
import { useState, useEffect, useRef, useLayoutEffect } from '../vendor/hooks.js';
import { app, nameOf, setReaction, useCols, toast, isSt, stUrl, stLabel, stId, avId, chOf, CHARS, DUO, ST_LABEL } from '../lib/ctx.js?v=6970b80344';
import { compressPair, cx } from '../lib/util.js?v=6970b80344';

/** a sticker image (id like 'b-cheer') or, for old data, a plain emoji */
export function St({ id, size = 48, cls = '', title, onClick }) {
  if (!id) return null;
  if (!isSt(id)) return html`<span class=${cx('st-emo', cls)} style=${`--s:${size}px`} onClick=${onClick}>${id}</span>`;
  const t = title ?? stLabel(id);
  return html`<img class=${cx('st', cls)} src=${stUrl(id)} width=${size} height=${size} alt=${t} title=${t} loading="lazy" decoding="async" draggable="false" onClick=${onClick} />`;
}

export function Avatar({ who, size = 40, cls = '' }) {
  return html`<span class=${cx('av', 'p-' + who, cls)} style=${`--s:${size}px`} title=${nameOf(who)}>
    <img src=${stUrl(avId(who))} alt=${nameOf(who)} draggable="false" />
  </span>`;
}

export function Dot({ on }) {
  return html`<i class=${cx('dot', on && 'on')} aria-label=${on ? '在线' : '不在线'}></i>`;
}

/** empty state with a sticker of *my* character */
export function Empty({ st = 'idea', text, children }) {
  return html`<div class="empty"><${St} id=${stId(app.me, st)} size=${88} /><p>${text}</p>${children}</div>`;
}

export function Seg({ value, options, onChange, cls }) {
  return html`<div class=${cx('seg', cls)} role="tablist">
    ${options.map(
      (o) => html`<button type="button" role="tab" aria-selected=${o.value === value} class=${cx(o.value === value && 'on')} onClick=${() => onChange(o.value)}>
        ${o.st ? html`<${St} id=${o.st} size=${24} title="" />` : o.icon ? html`<span class="seg-i">${o.icon}</span>` : null}${o.label}${o.badge ? html`<i class="seg-badge">${o.badge}</i>` : null}
      </button>`,
    )}
  </div>`;
}

/** Renders children into document.body (keeps parent state & closures). */
export function Portal({ children }) {
  const ref = useRef(null);
  if (!ref.current) ref.current = document.createElement('div');
  useLayoutEffect(() => {
    const el = ref.current;
    document.body.appendChild(el);
    return () => {
      render(null, el);
      el.remove();
    };
  }, []);
  useLayoutEffect(() => {
    render(children, ref.current);
  });
  return null;
}

let openModals = 0;
// Shared by modal forms and the phone chat sheet. Focus a close control, not a
// text field, so opening a panel does not summon the iPhone keyboard by surprise.
export function useDialog(selector, onClose) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const nodes = [...document.querySelectorAll(selector)];
    const node = nodes[nodes.length - 1];
    if (!node) return;
    const opener = document.activeElement;
    const layer = [...document.body.children].find((el) => el.contains(node));
    const hasInert = 'inert' in HTMLElement.prototype;
    const background = [...document.body.children].filter((el) => el !== layer).map((el) => [el, el.inert, el.getAttribute('aria-hidden')]);
    background.forEach(([el]) => { if (hasInert) el.inert = true; else el.setAttribute('aria-hidden', 'true'); });
    const focusable = () => [...node.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter((el) => el.getClientRects().length);
    const frame = requestAnimationFrame(() => {
      if (node.contains(document.activeElement) && document.activeElement !== opener) return;
      (node.querySelector('[aria-label^="关闭"]') || node).focus({ preventScroll: true });
    });
    const isTop = () => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      return dialogs[dialogs.length - 1] === node;
    };
    const guardFocus = (e) => {
      if (!hasInert && isTop() && !node.contains(e.target)) (focusable()[0] || node).focus({ preventScroll: true });
    };
    const k = (e) => {
      if (!isTop()) return;
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items[items.length - 1];
      if (!first) { e.preventDefault(); node.focus(); }
      else if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', k);
    document.addEventListener('focusin', guardFocus);
    openModals++;
    document.body.classList.add('noscroll');
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('keydown', k);
      document.removeEventListener('focusin', guardFocus);
      background.forEach(([el, inert, aria]) => {
        if (hasInert) el.inert = inert;
        else if (aria === null) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', aria);
      });
      if (--openModals <= 0) document.body.classList.remove('noscroll');
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
}
export function Modal({ title, onClose, children, cls }) {
  useDialog('.modal', onClose);
  return html`<${Portal}>
    <div class="modal-bg" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
      <div class=${cx('modal', cls)} role="dialog" aria-modal="true" aria-label=${title} tabIndex=${-1}>
        <div class="modal-hd"><h3>${title}</h3><button class="icon-btn" aria-label="关闭" onClick=${onClose}>✕</button></div>
        <div class="modal-bd">${children}</div>
      </div>
    </div>
  <//>`;
}

// ---------- stickers panel ----------
export function StickerPanel({ onPick, size = 64 }) {
  const own = chOf(app.me);
  const other = own === 'bear' ? 'bunny' : 'bear';
  const [tab, setTab] = useState(own);
  const list = tab === 'duo' ? DUO : CHARS[tab].keys.map((k) => `${CHARS[tab].p}-${k}`);
  return html`<div class="stp">
    <div class="stp-tabs">
      ${[own, other, 'duo'].map(
        (t) => html`<button type="button" class=${cx(tab === t && 'on')} onClick=${() => setTab(t)}>
          <${St} id=${t === 'duo' ? 'd-five' : t === 'bear' ? 'av-bear' : 'av-bunny'} size=${24} title="" />${t === 'duo' ? '一起' : CHARS[t].name}
        </button>`,
      )}
    </div>
    <div class="stp-grid">
      ${list.map((id) => html`<button type="button" class="stp-b" key=${id} onClick=${() => onPick(id)}><${St} id=${id} size=${size} /><small>${stLabel(id)}</small></button>`)}
    </div>
  </div>`;
}

// ---------- images ----------
const urls = new Map();
export function blobUrl(id) {
  let p = urls.get(id);
  if (!p) {
    p = app.sync.fetchBlob(id).then((v) => (v ? URL.createObjectURL(new Blob([v.b], { type: v.m || 'image/jpeg' })) : null));
    urls.set(id, p);
    p.then((u) => {
      if (!u) urls.delete(id);
    });
  }
  return p;
}

export function Img({ id, cls, onClick, alt = '' }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setSrc(null);
    setFailed(false);
    blobUrl(id).then((u) => {
      if (!live) return;
      if (u) setSrc(u);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [id, n]);
  if (failed)
    return html`<button type="button" class=${cx('img ph fail', cls)} onClick=${(e) => { e.stopPropagation(); setN(n + 1); }}>
      图片还在路上<br />点我重试
    </button>`;
  if (!src) return html`<div class=${cx('img ph', cls)}></div>`;
  return html`<img class=${cx('img', cls)} src=${src} alt=${alt} role=${onClick ? 'button' : undefined} tabIndex=${onClick ? 0 : undefined} aria-label=${onClick ? (alt || '查看图片') : undefined} onClick=${onClick} onKeyDown=${onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined} draggable="false" />`;
}

export function Lightbox({ list, index, onClose }) {
  const [i, setI] = useState(index);
  const close = useRef(onClose);
  close.current = onClose;
  useDialog('.lightbox', onClose);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'ArrowRight') setI((v) => Math.min(list.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  return html`<${Portal}>
    <div class="lightbox" role="dialog" aria-modal="true" aria-label="查看图片" tabIndex=${-1} onClick=${() => close.current()}>
      <${Img} id=${list[i].id} cls="lb-img" onClick=${(e) => e.stopPropagation()} />
      ${list.length > 1 &&
      html`<div class="lb-nav" onClick=${(e) => e.stopPropagation()}>
        <button aria-label="上一张图片" disabled=${i === 0} onClick=${() => setI(i - 1)}>‹</button>
        <span>${i + 1} / ${list.length}</span>
        <button aria-label="下一张图片" disabled=${i === list.length - 1} onClick=${() => setI(i + 1)}>›</button>
      </div>`}
      <button class="lb-x" aria-label="关闭">✕</button>
    </div>
  <//>`;
}

export function Photos({ list }) {
  const [open, setOpen] = useState(-1);
  if (!list || !list.length) return null;
  return html`<div class=${'photos n' + Math.min(list.length, 4)}>
    ${list.map((p, i) => html`<${Img} key=${p.id} id=${p.th || p.id} cls="ph-i" onClick=${() => setOpen(i)} />`)}
    ${open >= 0 && html`<${Lightbox} list=${list} index=${open} onClose=${() => setOpen(-1)} />`}
  </div>`;
}

export async function uploadPhotos(files, onProgress, local = false) {
  const out = [];
  let i = 0;
  for (const f of files) {
    i++;
    if (!f.type || !f.type.startsWith('image/')) continue;
    if (onProgress) onProgress(i, files.length);
    try {
      const { big, small } = await compressPair(f);
      const id = await app.sync.putBlob(big.bytes, big.mime, local);
      const th = await app.sync.putBlob(small.bytes, small.mime, local);
      out.push(local ? { id, th, w: big.w, h: big.h, loc: 1 } : { id, th, w: big.w, h: big.h });
    } catch (e) {
      console.error(e);
      toast('有一张图片没处理好，换一张试试', { icon: stId(app.me, 'dizzy') });
    }
  }
  return out;
}

export function PhotoPicker({ value, onChange, max = 9, local = false, onBusy }) {
  const [busy, setBusy] = useState('');
  const inp = useRef(), latest = useRef(value), mounted = useRef(true), working = useRef(false);
  latest.current = value;
  useEffect(() => () => { mounted.current = false; }, []);
  const pick = async (e) => {
    const files = [...e.target.files].slice(0, Math.max(0, max - latest.current.length));
    e.target.value = '';
    if (!files.length || working.current) return;
    working.current = true;
    onBusy?.(true);
    setBusy('…');
    try {
      const got = await uploadPhotos(files, (i, n) => mounted.current && setBusy(`${i}/${n}`), local);
      if (mounted.current) onChange([...latest.current, ...got].slice(0, max));
    } finally {
      working.current = false;
      if (mounted.current) { setBusy(''); onBusy?.(false); }
    }
  };
  return html`<div class="pp">
    ${value.map(
      (p, i) => html`<div class="pp-i" key=${p.id}>
        <${Img} id=${p.th || p.id} />
        <button type="button" class="pp-x" aria-label="移除" onClick=${() => onChange(value.filter((_, j) => j !== i))}>✕</button>
      </div>`,
    )}
    ${value.length < max &&
    html`<button type="button" class="pp-add" disabled=${!!busy} onClick=${() => inp.current.click()}>
      ${busy ? html`<span class="spin"></span><small>${busy}</small>` : html`<span class="pp-plus">＋</span><small>加图片</small>`}
    </button>`}
    <input ref=${inp} type="file" accept="image/*" multiple hidden onChange=${pick} />
  </div>`;
}

// ---------- reactions (stickers of each person's own character) ----------
const REACT_SETS = {
  def: ['cheer', 'ok', 'pat', 'thanks', 'what'],
  food: ['eat', 'ok', 'tea', 'cheer', 'what'],
  fit: ['cheer', 'ok', 'salute', 'pat', 'run'],
};
const isKey = (e) => typeof e === 'string' && Object.prototype.hasOwnProperty.call(ST_LABEL, e);

function ReactBadge({ r, mine, onClick }) {
  const pic = isKey(r.e) ? html`<${St} id=${stId(r.who, r.e)} size=${30} />` : html`<b>${r.e}</b>`;
  return mine
    ? html`<button type="button" class=${'rx mine p-' + r.who} title="再点一下取消" onClick=${onClick}>${pic}</button>`
    : html`<span class=${'rx p-' + r.who} title=${nameOf(r.who)}>${pic}</span>`;
}

export function Reacts({ target, set = 'def' }) {
  useCols('react');
  const [open, setOpen] = useState(false);
  const mine = app.store.get('react', `${target}~${app.me}`);
  const ta = app.store.get('react', `${target}~${app.partner}`);
  const choose = (e) => {
    setOpen(false);
    setReaction(target, e);
  };
  return html`<div class="reacts">
    ${ta && html`<${ReactBadge} r=${ta} />`}
    ${mine && html`<${ReactBadge} r=${mine} mine onClick=${() => choose(mine.e)} />`}
    ${open
      ? html`<span class="rx-pick">${(REACT_SETS[set] || REACT_SETS.def).map((k) => html`<button type="button" title=${ST_LABEL[k]} onClick=${() => choose(k)}><${St} id=${stId(app.me, k)} size=${38} /></button>`)}
          <button type="button" class="rx-close" aria-label="收起" onClick=${() => setOpen(false)}>✕</button></span>`
      : html`<button type="button" class="rx-add" onClick=${() => setOpen(true)}>＋ 回应</button>`}
  </div>`;
}

export function AutoText({ value, onInput, placeholder, rows = 3, maxLength = 4000, cls, onKeyDown, autoFocus, id }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(480, el.scrollHeight + 2) + 'px';
  }, [value]);
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, []);
  return html`<textarea id=${id} ref=${ref} class=${cx('inp', 'ta', cls)} rows=${rows} maxlength=${maxLength} placeholder=${placeholder} value=${value}
    onInput=${(e) => onInput(e.target.value)} onKeyDown=${onKeyDown}></textarea>`;
}

export function confirmDel(text = '确定删除吗？') {
  return window.confirm(text);
}

export const strip = (x) => {
  const { id, _t, _by, ...rest } = x;
  return rest;
};
