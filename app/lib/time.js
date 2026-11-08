// Timezone helpers: instants are shared; calendar dates belong to their author's zone.
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export function validZone(zone) {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return !!zone; } catch { return false; }
}
export function zoneParts(ts = Date.now(), zone = localZone()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ts)).map((v) => [v.type, v.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function zonedStamp(ts, zone = localZone()) {
  const p = zoneParts(ts, zone);
  return `${p.day} ${p.time} · ${zone}`;
}
/** An ambiguous or nonexistent DST wall time is not silently assigned an instant. */
export function wallInstant(day, time, zone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time) || !validZone(zone)) return NaN;
  const wall = Date.parse(`${day}T${time}:00Z`);
  if (!Number.isFinite(wall)) return NaN;
  let guess = wall;
  for (let i = 0; i < 5; i++) {
    const p = zoneParts(guess, zone);
    const delta = wall - Date.parse(`${p.day}T${p.time}:00Z`);
    if (!delta) break;
    guess += delta;
  }
  const candidates = new Set();
  // Half-hour and hour DST shifts (including Lord Howe); only round-trip matches count.
  for (let d = -180; d <= 180; d += 15) {
    const ts = guess + d * 60000;
    const p = zoneParts(ts, zone);
    if (p.day === day && p.time === time) candidates.add(ts);
  }
  return candidates.size === 1 ? [...candidates][0] : NaN;
}
export function meetInstant(m) {
  return m.time && Number.isFinite(m.when) ? m.when : null;
}
export function meetUpcoming(m, now = Date.now(), localDay = zoneParts(now).day) {
  const ts = meetInstant(m);
  return ts != null ? ts >= now : m.date >= localDay;
}
