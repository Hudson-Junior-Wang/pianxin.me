// 偏心我 · chat (lives in the right column on wide screens, in a bottom sheet on phones)
import { html } from './h.js?v=ef34bd8a76';
import { useState, useEffect, useRef, useLayoutEffect, useMemo } from '../vendor/hooks.js';
import { app, useCols, useBus, useForce, nameOf, stId, isSt, stLabel, CHARS, chOf } from '../lib/ctx.js?v=ef34bd8a76';
import { markChatRead } from '../lib/feed.js?v=ef34bd8a76';
import { uid, fmtHM, cx, dayKey, fmtDay } from '../lib/util.js?v=ef34bd8a76';
import { Avatar, St, StickerPanel, confirmDel } from './common.js?v=ef34bd8a76';
import { Icon } from './icons.js?v=ef34bd8a76';

// quick stickers allowed while focusing (my own character)
const QUIET_KEYS = ['cheer', 'ok', 'study', 'tea', 'yawn', 'dizzy', 'salute', 'done', 'pat', 'okay', 'sleep', 'hi'];
const emojiOnly = (s) => /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u.test(s) && !/^[\d#*\s]+$/.test(s);

export function sendChat(text, kind) {
  if (kind === 'st') {
    app.store.put('chat', uid(), { who: app.me, st: text, text: '', at: Date.now() });
    return true;
  }
  text = String(text || '').trim();
  if (!text || (app.focus && !emojiOnly(text))) return false;
  app.store.put('chat', uid(), { who: app.me, text: text.slice(0, 2000), emo: emojiOnly(text), at: Date.now() });
  return true;
}

function Bubble({ m, showWho }) {
  const mine = m.who === app.me;
  const sticker = m.st || '';
  return html`<div class=${cx('msg', mine ? 'me' : 'ta', sticker && 'sticker', m.emo && !sticker && 'emo')}>
    ${!mine && showWho ? html`<${Avatar} who=${m.who} size=${30} />` : html`<span class="msg-sp"></span>`}
    ${sticker ? html`<${St} id=${sticker} size=${112} cls="msg-st" />` : html`<div class="bubble">${m.text}</div>`}
    <span class="msg-meta">${fmtHM(m.at || m._t)}${mine && html`<button class="msg-x" aria-label="撤回" onClick=${() => confirmDel('撤回这条消息？') && app.store.del('chat', m.id)}>撤回</button>`}</span>
  </div>`;
}

function Messages({ list }) {
  const box = useRef();
  const stick = useRef(true);
  const last = list.length ? list[list.length - 1].id : '';
  useLayoutEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [last, list.length]);
  // sticker images load late: keep the view pinned to the bottom while they do
  const onLoad = () => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  };
  let prevDay = '';
  let prevWho = '';
  return html`<div class="msgs" ref=${box} onLoadCapture=${onLoad} onScroll=${(e) => {
    const el = e.currentTarget;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }}>
    ${!list.length && html`<div class="msgs-empty"><${St} id=${stId(app.me, 'hi')} size=${96} /><p>暂无消息</p></div>`}
    ${list.map((m) => {
      const day = dayKey(m.at || m._t);
      const out = [];
      if (day !== prevDay) {
        out.push(html`<div class="msg-day" key=${'d' + day}>${fmtDay(day)}</div>`);
        prevDay = day;
        prevWho = '';
      }
      out.push(html`<${Bubble} key=${m.id} m=${m} showWho=${prevWho !== m.who} />`);
      prevWho = m.who;
      return out;
    })}
  </div>`;
}

export function Chat({ quiet, onClose }) {
  const ver = useCols(['chat', 'profile']);
  const force = useForce();
  useBus('unread', force, []);
  const [peek, setPeek] = useState(false);
  // Keep an unsent draft while closing the phone drawer or switching screen sizes.
  const [text, setText] = useState(() => app.chatDraft || '');
  const [panel, setPanel] = useState(false);
  const [more, setMore] = useState(200);
  const open = !quiet || peek;
  useEffect(() => {
    if (!quiet) setPeek(false);
  }, [quiet]);
  useEffect(() => {
    if (!open) return;
    app.chatViews++;
    markChatRead();
    return () => { app.chatViews--; };
  }, [open]);
  const all = useMemo(() => app.store.list('chat').sort((a, b) => (a.at || a._t) - (b.at || b._t)), [ver]);
  const list = all.length > more ? all.slice(-more) : all;
  const submit = (e) => {
    e && e.preventDefault();
    if (sendChat(text)) { app.chatDraft = ''; setText(''); }
  };
  const pickSticker = (id) => {
    sendChat(id, 'st');
    setPanel(false);
  };
  const c = CHARS[chOf(app.me)];
  const quick = html`<div class="st-quick">${QUIET_KEYS.filter((k) => c.keys.includes(k)).map((k) => html`<button type="button" title=${stLabel(`${c.p}-${k}`)} onClick=${() => sendChat(`${c.p}-${k}`, 'st')}><${St} id=${`${c.p}-${k}`} size=${52} title="" /></button>`)}</div>`;
  const head = html`<div class="chat-hd">
    <${Avatar} who=${app.partner} size=${32} />
    <h3>${nameOf(app.partner)}</h3>
    ${quiet ? html`<span class="badge focus">专注中</span>` : null}
    <span class="sp"></span>
    ${quiet && open && html`<button type="button" class="link sm" onClick=${() => setPeek(false)}>收起</button>`}
    ${onClose && html`<button type="button" class="icon-btn" aria-label="关闭聊天" onClick=${onClose}><${Icon} n="x" /></button>`}
  </div>`;

  if (!open) {
    const recent = all.filter((m) => m.who === app.partner && (m.st || m.emo) && Date.now() - (m.at || m._t) < 10 * 60000).slice(-3);
    return html`<section class="chat collapsed">
      ${head}
      <div class="chat-q">
        <${St} id=${stId(app.me, 'study')} size=${88} title="" />
        <b>专注中，聊天先收起来</b>
        <small class="muted">消息不会响，只能发表情${app.unread > 0 ? ` · ${app.unread} 条消息等休息时再看` : ''}</small>
      </div>
      ${recent.length > 0 && html`<div class="chat-peek">${recent.map((m) => html`<span key=${m.id} class="peek">${m.st ? html`<${St} id=${m.st} size=${44} />` : m.text}</span>`)}</div>`}
      ${quick}
      <button type="button" class="link sm" onClick=${() => setPeek(true)}>偷看一眼聊天记录</button>
    </section>`;
  }
  return html`<section class=${cx('chat', quiet && 'quiet')}>
    ${head}
    ${all.length > list.length && html`<button type="button" class="link sm center" onClick=${() => setMore(more + 200)}>看更早的消息</button>`}
    <${Messages} list=${list} />
    ${quiet
      ? html`<div class="chat-in quiet">${quick}<small class="muted center">专注时只能发表情</small></div>`
      : html`<div class="chat-in">
          ${panel && html`<div class="st-panel"><${StickerPanel} onPick=${pickSticker} size=${64} /></div>`}
          <form class="chat-row" onSubmit=${submit}>
            <button type="button" class=${cx('icon-btn st-toggle', panel && 'on')} aria-label="表情" onClick=${() => setPanel(!panel)}><${Icon} n="smile" size=${24} /></button>
            <textarea class="inp chat-ta" rows="1" maxlength="2000" placeholder=${`和 ${nameOf(app.partner)} 说点什么…`} value=${text}
              onFocus=${() => setPanel(false)}
              onInput=${(e) => { app.chatDraft = e.target.value; setText(e.target.value); }}
              onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); submit(); } }}></textarea>
            <button class="btn send" aria-label="发送" disabled=${!text.trim()}><${Icon} n="send" size=${18} /></button>
          </form>
        </div>`}
  </section>`;
}
