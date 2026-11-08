// Explicit shared-content allowlist. Never scan private collections, drafts or chat.
export const SHARE_TYPES = {
  learn: { label: '学习', icon: 'learn', group: 'learn' },
  journal: { label: '生活记录', icon: 'journal', group: 'life' },
  meal: { label: '吃了什么', icon: 'life', group: 'life' },
  recipe: { label: '菜谱', icon: 'life', group: 'life' },
  workout: { label: '运动', icon: 'spark', group: 'life' },
  wish: { label: '想吃的', icon: 'life', group: 'life' },
  plan: { label: '计划', icon: 'cal', group: 'cal' },
  meet: { label: '见面安排', icon: 'cal', group: 'cal' },
  anniv: { label: '重要日子', icon: 'cal', group: 'cal' },
};
export const SHARE_COLS = Object.keys(SHARE_TYPES);
export function safeLink(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : 'https://' + raw);
    return /^(https?:)$/.test(u.protocol) && !u.username && !u.password ? u.href : '';
  } catch { return ''; }
}
const line = (s) => String(s || '').replace(/\s+/g, ' ').trim();
export function shareTitle(col, x) {
  if (col === 'learn') return x.title || line(x.text).slice(0, 100) || (x.link ? '一份学习资料' : '学习笔记图片');
  if (col === 'journal') return line(x.text).slice(0, 100) || '分享了几张照片';
  if (col === 'meal') return line(x.text) || x.meal || '一顿好好吃的饭';
  if (col === 'workout') return `${x.name || x.sport || '运动'}${x.min ? ` · ${x.min} 分钟` : ''}`;
  if (col === 'meet') return `下次见面 · ${x.date || '日期待定'}`;
  return x.name || x.title || SHARE_TYPES[col]?.label || '分享';
}
export function sharePreview(col, x) {
  if (col === 'learn') return x.text || x.link || (x.photos?.length ? `${x.photos.length} 张笔记图片` : '');
  if (col === 'recipe') return x.ing || x.steps || '';
  if (col === 'workout') return x.note || '';
  if (col === 'journal') return x.to === 'ta' ? '一段给对方的留言' : (x.photos?.length ? `${x.photos.length} 张照片` : '生活里的小片段');
  return x.note || x.where || x.date || '';
}
export function shareRoute(col, x) {
  if (col === 'learn') return '#/learn/' + encodeURIComponent(x.id);
  if (col === 'journal') return /^\d{4}-\d{2}-\d{2}$/.test(x.day || '') ? '#/journal/' + x.day : '#/journal';
  return ({meal:'#/life/meal',recipe:'#/life/recipe',workout:'#/life/fit',wish:'#/life/wish'})[col] || '#/cal';
}
export function recentShares(store, { group = 'all', who = '', query = '' } = {}) {
  const q = line(query).toLocaleLowerCase();
  const list = [];
  for (const col of SHARE_COLS) {
    if (group !== 'all' && SHARE_TYPES[col].group !== group) continue;
    for (const x of store.list(col)) {
      if (who && x.who !== who) continue;
      // Defensive for older data: a self-only note must never enter Recent.
      if (x.to === 'me' || x.private || x._private || x._local) continue;
      if (q && !line([shareTitle(col,x),sharePreview(col,x),x.text,x.link,x.ing,x.steps,Array.isArray(x.tags) ? x.tags.join(' ') : x.tags,x.where,x.note,x.date].join(' ')).toLocaleLowerCase().includes(q)) continue;
      list.push({ col, x, key: col + '/' + x.id, updated: Math.max(0, Math.min(8640000000000000, Number(x._t || x.at) || 0)) });
    }
  }
  return list.sort((a,b) => b.updated - a.updated || a.key.localeCompare(b.key));
}
