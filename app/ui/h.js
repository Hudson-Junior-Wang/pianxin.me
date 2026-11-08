import { h as createElement, render, Fragment } from '../vendor/preact.js';
import htm from '../vendor/htm.js';
import { emojiParts, emojiText, symbolCode } from '../lib/pictograms.js?v=84b24374a3';

// Substitute rendered text and human-facing labels only. Never touch stored
// records, editable form values, URLs, IDs or cryptographic material. Native
// text controls retain their original editable values.
const nativeText = new Set(['textarea', 'option', 'title', 'script', 'style']);
function illustratedText(child) {
  if (Array.isArray(child)) return child.map(illustratedText);
  if (typeof child !== 'string') return child;
  const parts = emojiParts(child);
  if (!parts) return child;
  return parts.map((part) => typeof part === 'string' ? part : createElement('img', {
    class: 'inline-pictogram', src: part.art.src, alt: part.art.label,
    title: part.art.label+' · '+symbolCode(part.value), 'data-original-symbol': part.value,
    width: 24, height: 24, decoding: 'async', draggable: false,
  }));
}
export function h(type, props, ...children) {
  if (typeof type !== 'string') return createElement(type, props, ...children);
  // Only human-facing labels: never alter values, href/src, IDs or event data.
  if (props) {
    for (const key of ['title', 'alt', 'aria-label', 'placeholder']) {
      if (typeof props[key] === 'string') {
        const shown = emojiText(props[key]);
        if (shown !== props[key]) props = { ...props, [key]: shown };
      }
    }
  }
  const optionText = (child) => Array.isArray(child) ? child.map(optionText) : typeof child === 'string' ? emojiText(child) : child;
  return createElement(type, props, ...(type === 'option' ? children.map(optionText) : !nativeText.has(type) ? children.map(illustratedText) : children));
}
// Copying a displayed record must return the exact original symbols, not
// omit them or replace them with the illustration's descriptive label.
if (typeof document !== 'undefined') document.addEventListener('copy', (event) => {
  if (!event.clipboardData || document.activeElement?.matches('input,textarea,[contenteditable="true"]')) return;
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const box = document.createElement('div');
  for (let i=0; i<selection.rangeCount; i++) box.append(selection.getRangeAt(i).cloneContents());
  const pictures = box.querySelectorAll('img[data-original-symbol]');
  if (!pictures.length) return;
  for (const image of pictures) image.replaceWith(document.createTextNode(image.dataset.originalSymbol));
  for (const br of box.querySelectorAll('br')) br.replaceWith(document.createTextNode('\n'));
  for (const block of box.querySelectorAll('p,div,li,article,section')) block.append(document.createTextNode('\n'));
  try { event.clipboardData.setData('text/plain', box.textContent); event.preventDefault(); } catch {}
});
export const html = htm.bind(h);
export { render, Fragment };
