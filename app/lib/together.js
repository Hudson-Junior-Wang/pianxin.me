// 偏心我 · optional shared focus timer. Life activities are asynchronous records.

import { app, WHO } from './ctx.js?v=0cc8a63665';
import { uid, dayKey } from './util.js?v=0cc8a63665';

// st = sticker shown for the mode (duo sticker when there is one, else my own character)
export const MODES = {
  study: { label: '专注', emoji: '📚', st: 'd-study', focus: [25, 45, 60, 90], brk: [5, 10, 15], rounds: [1, 2, 4, 0], def: [25, 5, 4], quiet: true, on: '专注中', off: '休息一下' },
  read: { label: '阅读', emoji: '📖', st: 'read', focus: [20, 30, 45, 60], brk: [0, 5, 10], rounds: [1, 2, 0], def: [30, 5, 2], quiet: true, on: '安静阅读中', off: '伸个懒腰' },
  sport: { label: '运动', emoji: '🏃', st: 'd-run', focus: [10, 20, 30, 45], brk: [0, 2, 5], rounds: [1, 3, 5], def: [20, 0, 1], quiet: true, on: '动起来', off: '喘口气' },
  eat: { label: '吃饭', emoji: '🍚', st: 'd-eat', focus: [15, 30, 45, 60], brk: [], rounds: [], def: [30, 0, 1], quiet: false, on: '干饭中', off: '' },
  movie: { label: '观影', emoji: '🎬', st: 'd-movie', focus: [45, 90, 120, 150], brk: [], rounds: [], def: [120, 0, 1], quiet: false, on: '看片中', off: '' },
  sleep: { label: '睡觉', emoji: '😴', st: 'sleep', focus: [360, 420, 480, 540], brk: [], rounds: [], def: [480, 0, 1], quiet: true, on: '晚安，好梦', off: '' },
};
// Keep old mode descriptors to render stored sessions, not as new timer choices.
export const MODE_KEYS = ['study'];

const MIN = 60000;

export function nextPhase(phase, round, brk, rounds) {
  if (phase === 'focus') {
    if (rounds && round >= rounds) return null;
    if (brk > 0) return { phase: 'break', round };
    return { phase: 'focus', round: round + 1 };
  }
  return { phase: 'focus', round: round + 1 };
}

/** Pure view of the shared session at time `now` (phases advance without any writes). */
export function derive(s, now) {
  if (!s || !s.sid || s.ended) return { state: 'idle' };
  const off = s.clk && s.clk !== app.me ? app.sync?.skew || 0 : 0;
  const focus = s.focus * MIN;
  const brk = (s.brk || 0) * MIN;
  const rounds = s.rounds || 0;
  const durOf = (p) => (p === 'focus' ? focus : brk);
  const mode = MODES[s.mode] || MODES.study;
  // forgotten sessions (nobody pressed stop) quietly end after a while
  const maxMs = Math.max(12 * 3600e3, (focus + brk) * Math.max(1, rounds) + 3600e3);
  if (now - ((s.t0 || s.start) - off) > maxMs) return { state: 'done', endedAt: now, round: s.round, mode, s, stale: true };
  if (s.paused) {
    return { state: 'run', paused: true, phase: s.phase, round: s.round, remaining: s.remaining, dur: durOf(s.phase), mode, s };
  }
  let t = s.start - off;
  let phase = s.phase;
  let round = s.round;
  for (let i = 0; i < 1000; i++) {
    const dur = durOf(phase);
    if (now < t + dur) return { state: 'run', phase, round, remaining: t + dur - now, dur, mode, s };
    t += dur;
    const n = nextPhase(phase, round, brk, rounds);
    if (!n) return { state: 'done', endedAt: t, round, mode, s };
    phase = n.phase;
    round = n.round;
  }
  return { state: 'done', endedAt: t, round, mode, s };
}

export const session = () => app.store.get('together', 'main');

export function members(s = session()) {
  if (!s || !s.sid) return [];
  return WHO.filter((w) => app.store.get('tjoin', w)?.sid === s.sid);
}

export const isMember = (s = session(), who = app.me) => !!s && !!s.sid && app.store.get('tjoin', who)?.sid === s.sid;

/** quiet = chat collapsed, muted and emoji-only */
export function quietOf(d, s = session()) {
  return d.state === 'run' && d.phase === 'focus' && !d.paused && d.mode.quiet && isMember(s);
}

export function phaseText(d) {
  if (d.state !== 'run') return '';
  if (d.paused) return '暂停中';
  return d.phase === 'focus' ? d.mode.on : d.mode.off;
}

function write(s) {
  app.store.put('together', 'main', { ...s, clk: app.me, by: app.me });
}

export function start(mode, focus, brk, rounds) {
  if (!MODE_KEYS.includes(mode)) return null;
  const previous = session();
  const before = derive(previous, Date.now());
  if (before.state === 'run') return null;
  // Explicitly starting a new slot may archive the cached finished one, without
  // automatically rewriting shared session state during startup/catch-up.
  if (before.state === 'done' && !before.stale && isMember(previous)) logSession(previous, before.round, before.endedAt);
  const now = Date.now();
  const s = { sid: uid(8), mode, focus, brk, rounds, phase: 'focus', round: 1, start: now, t0: now, paused: false, owner: app.me };
  write(s);
  app.store.put('tjoin', app.me, { sid: s.sid, at: now });
  return s;
}

export function join(expectedSid) {
  const s = session();
  if (!s || !s.sid || (expectedSid && s.sid !== expectedSid) || derive(s, Date.now()).state !== 'run') return false;
  app.store.put('tjoin', app.me, { sid: s.sid, at: Date.now() });
  return true;
}

/** Optional focus shortcut; never join an unrelated or expired session. */
export function quickStart(mode = 'study') {
  if (!MODE_KEYS.includes(mode)) return false;
  const s = session();
  const d = derive(s, Date.now());
  if (d.state === 'run') {
    if (s.mode !== mode) return false;
    return isMember(s) || join(s.sid);
  }
  const [f, b, r] = MODES[mode].def;
  start(mode, f, b, r);
}

export function leave() {
  const s = session();
  app.store.put('tjoin', app.me, { sid: null, at: Date.now() });
  if (s && s.sid && members(s).length === 0) end(s, Date.now() - (s.t0 || s.start) > 180000);
}

export function pause(d) {
  const s = session();
  if (!s || d.state !== 'run' || d.paused) return;
  write({ ...s, paused: true, phase: d.phase, round: d.round, remaining: d.remaining });
}

export function resume() {
  const s = session();
  if (!s || !s.paused) return;
  const dur = (s.phase === 'focus' ? s.focus : s.brk) * MIN;
  write({ ...s, paused: false, start: Date.now() - (dur - s.remaining), remaining: 0 });
}

export function skip(d) {
  const s = session();
  if (!s || d.state !== 'run') return;
  const n = nextPhase(d.phase, d.round, s.brk || 0, s.rounds || 0);
  if (!n) return end(s, true, d.round);
  write({ ...s, phase: n.phase, round: n.round, start: Date.now(), paused: false });
}

export function logSession(s, rounds, endedAt = Date.now()) {
  if (!s || !s.sid || app.store.rec('tsess', s.sid)) return;
  const who = members(s);
  app.store.put('tsess', s.sid, {
    mode: s.mode,
    t0: s.t0 || s.start,
    t1: Math.max(s.t0 || s.start, endedAt),
    day: dayKey(s.t0 || s.start),
    who: who.length ? who : [app.me],
    rounds: rounds || s.round || 1,
    focus: s.focus,
  });
}

/** natural = the timer simply ran out (both sides already celebrate on their own) */
export function end(s = session(), log = true, rounds, natural = false) {
  if (!s || !s.sid) return;
  if (log) logSession(s, rounds);
  write({ ...s, ended: true, endedAt: Date.now(), natural });
}
