// Sports use the same warm die-cut sticker style as the original bear/bunny pack.
// Characters are fixed by sport, never by the current user's avatar preference.
import { html } from './h.js?v=f8c0c1b1d6';
import { sportArtOf } from '../lib/sports.js?v=f8c0c1b1d6';

export function SportIcon({ sport, size = 58 }) {
  const s = sportArtOf(sport);
  if (!s) return html`<span class="sport-legacy" aria-hidden="true">${sport || '✨'}</span>`;
  return html`<img class="sport-icon" data-sport=${s[2]} data-character=${s[3]} src=${`/app/sports/${s[3]}-${s[2]}-v2.webp`} width=${size} height=${size} alt="" aria-hidden="true" decoding="async" draggable="false" />`;
}
