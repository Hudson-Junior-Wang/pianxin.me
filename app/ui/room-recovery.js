// A locked device may back up its OWN surviving bytes locally. No old-room
// network is started and no alternate key is allowed into the app.
import { html } from './h.js?v=085b725ac5';
import { useState, useRef } from '../vendor/hooks.js';
import { app } from '../lib/ctx.js?v=085b725ac5';
import { deriveSeed, keyringFromSeed } from '../lib/crypto.js?v=085b725ac5';
import { roomAccessIssue } from '../lib/room-access.js?v=085b725ac5';
import { unlockRoomSeed } from '../lib/room-unlock.js?v=085b725ac5';
import { Store } from '../lib/store.js?v=085b725ac5';
import { openRecoverySource, recoveryCounts, exportRecoveryArchive, mergeRecoverySource } from '../lib/room-recovery.js?v=085b725ac5';

export function RoomRecovery({ oldKr = null }) {
  const sourceRef = useRef(null), working = useRef(false);
  const [counts, setCounts] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [backup, setBackup] = useState(false), [confirmed, setConfirmed] = useState(false), [password, setPassword] = useState(''), [notice, setNotice] = useState('');
  const source = async () => {
    if (!sourceRef.current) sourceRef.current = await openRecoverySource(app.me);
    return sourceRef.current;
  };
  const run = async (fn) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e?.message || '操作未完成，原有记录保留，请重试。'); }
    finally { working.current = false; setBusy(false); }
  };
  const inspect = () => run(async () => setCounts(recoveryCounts(await source())));
  const save = () => run(async () => {
    const s = await source();
    const encrypted = oldKr && await s.getMeta('room') === oldKr.room;
    if (!encrypted && !confirm('没有可用的旧钥匙，将导出包含私人文字和照片的未加密本机备份。请只保存在自己的设备，勿发送给他人。继续吗？')) return;
    const result = await exportRecoveryArchive(s, encrypted ? oldKr : null);
    setBackup(true);
    setNotice(`已生成含 ${result.records} 条记录、${result.photos} 份本机图片的${result.encrypted ? '加密' : '未加密'}备份。${result.encrypted ? '保留旧暗号用于解密。' : '请妥善保管，不要发送给他人。'}请确认下载已保存。`);
  });
  const migrate = (e) => {
    e.preventDefault();
    if (!backup || !confirmed || !password.trim()) return;
    run(async () => {
      const credential = await deriveSeed(password);
      const seed = await unlockRoomSeed(credential);
      const kr = seed ? await keyringFromSeed(seed) : null;
      const issue = await roomAccessIssue(kr);
      if (issue) throw new Error(issue);
      const s = await source();
      const target = new Store(app.me, kr.room);
      await target.open();
      try {
        const result = await mergeRecoverySource(s, target, kr);
        await target.setMeta('room', kr.room);
        await target.setMeta('recoveryResult', result);
        // Do not touch the old DB or seed until the official destination has
        // committed. Source remains a separate full local archive afterwards.
        // Switch DB first: a crash/failed write must leave the old seed intact.
        localStorage.setItem(`px:${app.me}:dbroom`, kr.room);
        localStorage.setItem(`px:${app.me}:unlock`, credential);
        localStorage.setItem(`px:${app.me}:kr`, seed);
      } finally { target.db.close(); }
      location.reload();
    });
  };
  return html`<section class="room-recovery">
    <h2>保留这台设备的旧记录</h2>
    <p class="hint">这里只读取本机，不连接旧空间，也不会用旧暗号进入网站。原记录、聊天贴纸和照片不会被清除。</p>
    ${!counts ? html`<button type="button" class="btn ghost sm" disabled=${busy} onClick=${inspect}>查看本机旧记录并备份</button>` : html`
      <p class="recovery-counts">本机 ${counts.records} 条记录，其中 ${counts.stickers} 条聊天贴纸、${counts.privateNotes} 条私人内容。</p>
      <button type="button" class="btn ghost sm" disabled=${busy} onClick=${save}>${busy ? '处理中…' : '下载完整本机备份（含现存照片）'}</button>
      ${notice && html`<p class="hint" role="status">${notice}</p>`}
      <form class="recovery-form" onSubmit=${migrate}>
        <h3>改用电脑确认的暗号</h3>
        <p class="hint">先保存上面的备份，再输入电脑正在使用的暗号。确认后，将共享历史和聊天复制到固定空间；私人记录仅留在本机。旧空间原件仍保留。</p>
        <p class="hint">仅迁入本机已保存的历史和照片，不能取回这台设备从未收到的图片；状态、计时、草稿不覆盖电脑的现状。</p>
        <label class="lbl" for="recovery-password">电脑的正确暗号</label><input id="recovery-password" class="inp" type="password" autocomplete="current-password" value=${password} disabled=${busy} onInput=${(e) => setPassword(e.target.value)} />
        <label class="check"><input type="checkbox" checked=${confirmed} disabled=${busy || !backup} onChange=${(e) => setConfirmed(e.target.checked)} /><span>备份已经保存，我同意将原共享记录和聊天迁入固定空间，私人内容仅本机保留。</span></label>
        <button type="submit" class="btn block" disabled=${busy || !backup || !confirmed || !password.trim()}>${busy ? '核验并保存中…' : '确认迁入并进入固定空间'}</button>
      </form>`}
    ${error && html`<p class="err" role="alert">${error}</p>`}
  </section>`;
}
