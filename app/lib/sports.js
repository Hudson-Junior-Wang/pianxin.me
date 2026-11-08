// Stable record keys: retained sports keep their original keys. Removed choices
// remain valid historical records; never migrate or relabel those records.
export const SPORTS = [
  ['🏃', '跑步', 'run', 'bear'],
  ['🚶', '散步', 'walk', 'bear'],
  ['🥾', '爬山', 'hike', 'bear'],
  ['🏊', '游泳', 'swim', 'bear'],
  ['gym', '健身', 'gym', 'bunny'],
  ['🏸', '羽毛球', 'badminton', 'bunny'],
  ['🥏', '飞盘', 'frisbee', 'bunny'],
  ['✨', '其他', 'other', 'bunny'],
];
export const sportOf = (key) => SPORTS.find((s) => s[0] === key);
// Only the illustration is reused for historical strength workouts. Their
// original sport key and name stay untouched, including when editing notes.
export const sportArtOf = (key) => sportOf(key) || (key === '🏋️' ? SPORTS[4] : null);
