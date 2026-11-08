// 偏心我 · small rounded line icons (24×24, stroke = currentColor)
import { html } from './h.js?v=6970b80344';

const P = {
  learn: '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zM12 6v14"/>',
  folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  link: '<path d="m10 14 4-4M8.5 15.5l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M15.5 8.5l1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0"/>',
  today: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.2V19a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1V9.2"/>',
  together: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2"/><path d="M9.5 3h5"/><path d="M18.5 6.5l1.2-1.2"/>',
  journal: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 3.5v17"/><path d="M12 8.5h4M12 12h4"/>',
  life: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"/><path d="M8 8.5c0-1.4.9-1.8.9-3.2M12 8.5c0-1.4.9-1.8.9-3.2M16 8.5c0-1.4.9-1.8.9-3.2"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M8 14h.01M12 14h.01M16 14h.01"/>',
  chat: '<path d="M20.5 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.4A8 8 0 1 1 20.5 11.5z"/><path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01"/>',
  gear: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  send: '<path d="M4.5 12 3 4.5l17.5 7.5L3 19.5z"/><path d="M4.5 12h6"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.2s1.2 1.6 3.5 1.6 3.5-1.6 3.5-1.6"/><path d="M9.2 9.6h.01M14.8 9.6h.01"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  play: '<path d="M8 5.2v13.6L18.5 12z"/>',
  skip: '<path d="M6 5.5v13l8.5-6.5zM18 5.5v13"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/>',
  leave: '<path d="M14 4.5h4.5v15H14"/><path d="M10 8.5 6.5 12l3.5 3.5M6.5 12h8.5"/>',
  left: '<path d="m14.5 6-6 6 6 6"/>',
  right: '<path d="m9.5 6 6 6-6 6"/>',
  down: '<path d="m6 9.5 6 6 6-6"/>',
  check: '<path d="m5.5 12.5 4.5 4.5 8.5-9.5"/>',
  edit: '<path d="M5 19h3.5L18.5 9 15 5.5 5 15.5z"/><path d="M13 7.5l3.5 3.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-8.5 8.5"/>',
  bell: '<path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 6 2.5 8 2.5 8H4s2.5-2 2.5-8"/><path d="M10 20.5h4"/>',
  quiet: '<path d="M6.5 9a5.5 5.5 0 0 1 9.4-3.9M17.5 9c0 6 2.5 8 2.5 8H8"/><path d="M10 20.5h4"/><path d="M4 4l16 16"/>',
  refresh: '<path d="M19.5 11.5a7.5 7.5 0 1 0-2.2 5.3"/><path d="M19.5 4.5v7h-7"/>',
  pin: '<path d="M12 16.5V21"/><path d="M8.5 3.5h7l-1 5 3 4h-11l3-4z"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 19.5h14"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  spark: '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6.2 6.2l2.6 2.6M15.2 15.2l2.6 2.6M6.2 17.8l2.6-2.6M15.2 8.8l2.6-2.6"/>',
  more: '<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
  pen: '<path d="M4 20l1.2-4.2L16 5l3 3L8.2 18.8z"/>',
  type: '<path d="M5 6.5V5h14v1.5M12 5v14M9 19h6"/>',
};

export function Icon({ n, size = 22, cls = '', sw = 2 }) {
  return html`<svg class=${'ic ' + cls} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${sw}
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: P[n] || '' }}></svg>`;
}
