// Eight original SVG mini-illustrations, drawn for the exercise picker.
// Characters are fixed by sport, not by the current user's avatar preference.
import { html } from './h.js?v=69dcf6b8ad';
import { sportArtOf } from '../lib/sports.js?v=69dcf6b8ad';

const ink = '#674738', fur = '#f3c182', cream = '#fff8ec', pink = '#f6b5c4';
const ground = '<ellipse cx="59" cy="108" rx="37" ry="5" fill="#d8c6ad" opacity=".23" stroke="none"/>';
const bearHead = (x, y, angle = 0, swim = false) => `<g transform="translate(${x} ${y}) rotate(${angle})">
  <circle cx="-17" cy="-14" r="8" fill="${fur}"/><circle cx="17" cy="-14" r="8" fill="${fur}"/>
  <path d="M-20-14q3-5 7-2M13-16q5-3 7 2" stroke="#ca945e"/>
  <path d="M-24 0c0-15 9-22 24-22s24 7 24 22c0 15-9 23-24 23S-24 15-24 0" fill="${fur}"/>
  <ellipse cy="8" rx="12" ry="10" fill="#ffe6bc" stroke="none"/>
  <g fill="#493326" stroke="none"><ellipse cx="-9" cy="-1" rx="2.7" ry="3.4"/><ellipse cx="9" cy="-1" rx="2.7" ry="3.4"/><ellipse cy="5" rx="3.2" ry="2.2"/></g>
  <g fill="white" stroke="none"><circle cx="-9.7" cy="-2" r=".9"/><circle cx="8.3" cy="-2" r=".9"/></g>
  <path d="M-4 10q4 5 8 0" fill="none" stroke-width="1.8"/>
  <g fill="${pink}" opacity=".7" stroke="none"><ellipse cx="-16" cy="8" rx="4" ry="3"/><ellipse cx="16" cy="8" rx="4" ry="3"/></g>
  ${swim ? '<path d="M-23-8q3-16 23-16t23 16" fill="#98ced5"/><path d="M-21-8h42"/><g fill="#d5f0f3" fill-opacity=".65" stroke="#497f8d"><rect x="-17" y="-6" width="13" height="11" rx="5"/><rect x="4" y="-6" width="13" height="11" rx="5"/><path d="M-4-1h8M-23-2h6M17-2h6"/></g>' : '<path d="m-13 22 13 12 14-12" fill="#91bfce"/>'}
</g>`;
const bunnyHead = (x, y, angle = 0) => `<g transform="translate(${x} ${y}) rotate(${angle})">
  <path d="M-19-13c-11-16-10-33-2-36 9-3 18 11 19 30M3-19c2-21 13-34 21-30 9 5 5 23-5 37" fill="${cream}"/>
  <path d="M-14-20c-6-13-9-23-5-25 5-1 11 11 12 24M9-22c3-15 10-25 13-22 4 3-1 15-7 24" fill="${pink}" stroke="none"/>
  <path d="M-23-1c-1-13 8-21 23-21S24-13 23-1l3 4-3 3c0 13-10 20-23 20S-23 19-23 6l-3-3z" fill="${cream}"/>
  <g fill="#493326" stroke="none"><ellipse cx="-9" cy="0" rx="2.6" ry="3.3"/><ellipse cx="9" cy="0" rx="2.6" ry="3.3"/><path d="m-2 6 2 2 2-2q-2-3-4 0"/></g>
  <g fill="white" stroke="none"><circle cx="-9.7" cy="-1" r=".9"/><circle cx="8.3" cy="-1" r=".9"/></g>
  <path d="M-5 10q3 4 5 0 2 4 5 0" fill="none" stroke-width="1.7"/>
  <g fill="${pink}" opacity=".8" stroke="none"><ellipse cx="-16" cy="8" rx="4.5" ry="3"/><ellipse cx="16" cy="8" rx="4.5" ry="3"/></g>
  <g transform="translate(15 -21) rotate(12)" fill="#ef9bb5"><path d="M0 0C-15-15-20 8-4 6M0 0C13-16 24 5 6 7"/><circle cx="1" cy="3" r="4.5" fill="#ffd39d"/></g>
</g>`;
const body = (animal, x = 56, y = 84, angle = 0) => `<g transform="translate(${x} ${y}) rotate(${angle})"><ellipse rx="16" ry="21" fill="${animal === 'bear' ? fur : cream}"/><ellipse cy="3" rx="9" ry="13" fill="${animal === 'bear' ? '#ffe5bb' : '#ffe8e4'}" stroke="none"/></g>`;
const dumbbell = (x, y, angle) => `<g transform="translate(${x} ${y}) rotate(${angle})" fill="#91b9bf"><path d="M-11 0h22" stroke-width="4"/><rect x="-15" y="-8" width="7" height="16" rx="2"/><rect x="8" y="-8" width="7" height="16" rx="2"/></g>`;
const ART = {
  run: `${ground}<g stroke="#b8c6be"><path d="M12 55h15M8 65h16M15 75h9"/></g>
    <path d="m48 87-12 12-12-2M62 88l14 8 9-10" fill="none" stroke="${fur}" stroke-width="12"/>
    <path d="m24 96-7 6q-2 5 6 6l14-5M80 88l7-4q7 2 5 8l-7 9" fill="#8ebdca"/>
    ${body('bear',54,77,-18)}<path d="m43 73-13-9-8 6M64 68l12-8 6 6" fill="none" stroke="${ink}" stroke-width="12"/><path d="m43 73-13-9-8 6M64 68l12-8 6 6" fill="none" stroke="${fur}" stroke-width="8"/>
    ${bearHead(54,43,-12)}<path d="m94 44 3-5M97 53h6" stroke="#eab66c"/>`,
  walk: `${ground}<path d="m48 91-5 13-10 1M61 91l9 13 10-1" fill="none" stroke="${ink}" stroke-width="12"/><path d="m48 91-5 13-10 1M61 91l9 13 10-1" fill="none" stroke="${fur}" stroke-width="8"/>
    ${body('bear',55,82)}<path d="m40 74-8 15M69 74l9 12" fill="none" stroke="${ink}" stroke-width="11"/><path d="m40 74-8 15M69 74l9 12" fill="none" stroke="${fur}" stroke-width="7"/>
    ${bearHead(54,43,5)}<path d="M91 105V89m0 8c-13 1-12-10-12-10 11-1 12 10 12 10m0-4c0-12 10-13 10-13 1 10-10 13-10 13" fill="#bfd3a0" stroke="#799478" stroke-width="1.7"/>`,
  hike: `<path d="m7 80 24-39 21 33 19-28 37 49" fill="#e6eddd" stroke="none"/><path d="m22 55 9-14 9 14-10-3z" fill="${cream}" stroke="none"/>
    <path d="m19 109 27-11 16 5 33-10" fill="none" stroke="#c3b492"/>${ground}<rect x="32" y="61" width="23" height="30" rx="9" fill="#98b4a2" transform="rotate(-9 40 75)"/>
    <path d="m53 91-5 14-10 1M66 89l10 12 12-1" fill="none" stroke="${ink}" stroke-width="12"/><path d="m53 91-5 14-10 1M66 89l10 12 12-1" fill="none" stroke="#bb9474" stroke-width="8"/>
    ${body('bear',59,81,12)}<path d="M85 54 91 106" fill="none" stroke="#967655" stroke-width="4"/><path d="m69 75 12 5 5-8" fill="none" stroke="${ink}" stroke-width="11"/><path d="m69 75 12 5 5-8" fill="none" stroke="${fur}" stroke-width="7"/>
    ${bearHead(58,46,8)}<path d="M36 65q5-9 10 0" fill="none" stroke="#799478" stroke-width="4"/>`,
  swim: `<ellipse cx="60" cy="94" rx="48" ry="17" fill="#e0f0f1" stroke="none"/>
    <path d="m41 82-18-5M75 80q16-22 23-11" fill="none" stroke="${ink}" stroke-width="13"/><path d="m41 82-18-5M75 80q16-22 23-11" fill="none" stroke="${fur}" stroke-width="9"/>
    ${body('bear',57,87,82)}${bearHead(53,55,-8,true)}
    <g fill="none" stroke="#83bac6"><path d="M13 91q7 6 14 0t14 0 14 0 14 0 14 0 14 0 12 0M23 101q7 5 14 0t14 0 14 0 14 0 14 0"/><path d="m98 46 3-7M104 55l7-2M17 65l-4-5"/></g>`,
  gym: `${ground}<path d="m47 96-3 10-10 1M61 96l5 10 11 1" fill="none" stroke="${ink}" stroke-width="12"/><path d="m47 96-3 10-10 1M61 96l5 10 11 1" fill="none" stroke="${cream}" stroke-width="8"/>
    ${body('bunny',55,86)}<path d="m41 81-13-7-7-14M69 80l14-8 6-16" fill="none" stroke="${ink}" stroke-width="12"/><path d="m41 81-13-7-7-14M69 80l14-8 6-16" fill="none" stroke="${cream}" stroke-width="8"/>
    ${bunnyHead(55,53)}${dumbbell(20,55,-13)}${dumbbell(91,51,13)}<path d="m9 33 3-4M102 31l4 4" stroke="#e7b36f"/>`,
  badminton: `${ground}<path d="m44 96-8 9-10 1M58 96l10 10 12 1" fill="none" stroke="${ink}" stroke-width="12"/><path d="m44 96-8 9-10 1M58 96l10 10 12 1" fill="none" stroke="${cream}" stroke-width="8"/>
    ${body('bunny',51,85,8)}<path d="m36 80-11 4M66 81l16-8" fill="none" stroke="${ink}" stroke-width="12"/><path d="m36 80-11 4M66 81l16-8" fill="none" stroke="${cream}" stroke-width="8"/>
    ${bunnyHead(48,52,-7)}<g transform="translate(96 49) rotate(23)"><ellipse rx="12" ry="17" fill="#f0f8f3" stroke="#7eaa97"/><g stroke="#b2cfc1" stroke-width="1"><path d="M-8-10H8M-11-4h22M-11 3h22M-8 10H8M-5-14v28M1-16v32M7-12v25"/></g><path d="M0 17v22" stroke-width="3"/><path d="M0 31v11" stroke="#d5a586" stroke-width="5"/></g>
    <g transform="translate(94 15) rotate(-23)"><path d="m-5 5-3-12h16L5 5" fill="white" stroke="#c7b8a3" stroke-width="1.5"/><path d="M0-7V5M-8-7l8 5 8-5" fill="none" stroke="#c7b8a3" stroke-width="1"/><path d="M-5 5q5 9 10 0" fill="#e4be8c"/></g>`,
  frisbee: `${ground}<path d="m42 94-10 10-10-2M58 95l12 10 10-1" fill="none" stroke="${ink}" stroke-width="12"/><path d="m42 94-10 10-10-2M58 95l12 10 10-1" fill="none" stroke="${cream}" stroke-width="8"/>
    ${body('bunny',51,85,-14)}<path d="m36 79-13-1M64 78l19-11" fill="none" stroke="${ink}" stroke-width="12"/><path d="m36 79-13-1M64 78l19-11" fill="none" stroke="${cream}" stroke-width="8"/>
    ${bunnyHead(49,53,-10)}<g transform="translate(95 43) rotate(-17)"><ellipse rx="17" ry="6" fill="#edac83"/><ellipse cy="-2" rx="17" ry="5" fill="#ffcf9c"/><ellipse cy="-2" rx="10" ry="2.2" fill="none" stroke="#cd8c64" stroke-width="1.4"/></g><g stroke="#b7c6bf"><path d="m81 34 8-5M84 54l13 3M102 63l8-1"/></g>`,
  other: `${ground}<path d="m48 97-3 9-9 1M63 97l4 9 10 1" fill="none" stroke="${ink}" stroke-width="12"/><path d="m48 97-3 9-9 1M63 97l4 9 10 1" fill="none" stroke="${cream}" stroke-width="8"/>
    ${body('bunny',56,86)}<path d="m42 80-11-5-7-9M69 80l12-5 7-10" fill="none" stroke="${ink}" stroke-width="12"/><path d="m42 80-11-5-7-9M69 80l12-5 7-10" fill="none" stroke="${cream}" stroke-width="8"/>
    ${bunnyHead(56,54,3)}<path d="m95 26 2 7 7 2-7 2-2 7-2-7-7-2 7-2z" fill="#f6d595" stroke="#c7a16b" stroke-width="1.5"/><path d="m17 44 2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#b6d2c0" stroke="none"/>
    <circle cx="95" cy="88" r="3" fill="#edb7bd" stroke="none"/>`,
};

export function SportIcon({ sport, size = 58 }) {
  const s = sportArtOf(sport);
  if (!s) return html`<span class="sport-legacy" aria-hidden="true">${sport || '✨'}</span>`;
  return html`<svg class="sport-icon" data-sport=${s[2]} data-character=${s[3]} width=${size} height=${size} viewBox="0 0 120 120" fill="none" stroke=${ink} stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML=${{ __html: ART[s[2]] }}></svg>`;
}
