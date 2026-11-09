// One reviewed room only. This public verifier is NOT the passphrase, seed or
// MQTT room address. Do not let the first visitor choose it or use query/local
// storage overrides. Deployment pins the owner's existing desktop key.
// Empty means provisioning: only already-unlocked devices may open to export
// their records and obtain the desktop binding code; new rooms stay disabled.
export const OFFICIAL_VERIFIER = 'PX1-d19147527d966549bbc8009b550bbb43134b6030fc226df4537765869c03a842';
const PREFIX = 'PX1-';

export async function roomBindingCode(kr) {
  if (!/^[a-f0-9]{24}$/.test(kr?.room || '')) throw new Error('bad room');
  const bytes = new TextEncoder().encode('pianxin.me/official-room/v1/' + kr.room);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return PREFIX + Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const roomIsBound = () => /^PX1-[a-f0-9]{64}$/.test(OFFICIAL_VERIFIER);

export async function roomAccessIssue(kr, { existing = false } = {}) {
  if (OFFICIAL_VERIFIER && !roomIsBound()) return '固定空间校验配置异常，已暂停解锁。原有记录保留，请联系维护者。';
  if (!roomIsBound()) return existing ? '' : '正在绑定电脑上的固定暗号，暂不开放新解锁，也不会创建新空间。请先从仍已登录的电脑「设置 → 连接」复制固定空间校验码。';
  if (!kr || await roomBindingCode(kr) !== OFFICIAL_VERIFIER) return '暗号不正确，无法解锁这个网站。这里只使用电脑确认的固定空间，不会另建空间；本机原有记录仍然保留。';
  return '';
}
