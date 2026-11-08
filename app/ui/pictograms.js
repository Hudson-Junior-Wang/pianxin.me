import { html } from './h.js?v=2b526ea3b9';
import { pictogramOf } from '../lib/pictograms.js?v=2b526ea3b9';
import { FP_EMOJI } from '../lib/crypto.js?v=2b526ea3b9';

export function Pic({ name, size = 28, cls = '', label = '', fallback = 'star', onClick }) {
  const art = pictogramOf(name, fallback);
  return html`<img class=${'pictogram '+cls} src=${art.src} width=${size} height=${size} alt=${label} title=${label||undefined} aria-hidden=${!label?'true':undefined} decoding="async" draggable="false" onClick=${onClick} />`;
}

// Old fingerprints carry four six-bit symbols. Preserve all 24 bits in the
// display: the two-digit index is authoritative even if artwork is reused.
// Key derivation, room IDs and the original fingerprint are not changed.
export function Fingerprint({ value, compact = false }) {
  let rest = String(value || ''); const parts = [];
  while (rest) {
    const index = FP_EMOJI.findIndex((s) => rest.startsWith(s));
    if (index < 0) return html`<code class="key-fingerprint">指纹暂不可用</code>`;
    const symbol = FP_EMOJI[index];
    parts.push({ symbol, code: index.toString(16).toUpperCase().padStart(2,'0') });
    rest = rest.slice(symbol.length);
  }
  const code = parts.map((p) => p.code).join(' ');
  return html`<span class=${'key-fingerprint'+(compact?' compact':'')} role="img" aria-label=${'钥匙指纹 '+code} title=${'请核对全部编号：'+code}>
    ${parts.map((p) => html`<span class="fingerprint-tile" aria-hidden="true"><${Pic} name=${p.symbol} size=${compact?24:36} /><code>${p.code}</code></span>`)}
  </span>`;
}
