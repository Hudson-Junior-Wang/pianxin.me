// 偏心我 · 设置 — 昵称头像、声音与通知、连接状态、备份、换钥匙
import { html } from '../h.js?v=efe89b71a3';
import { useState } from '../../vendor/hooks.js';
import { app, useCols, useSyncEvent, profileOf, saveSettings, useBus, useForce, toast, nameOf } from '../../lib/ctx.js?v=efe89b71a3';
import { download, today } from '../../lib/util.js?v=efe89b71a3';
import { cx } from '../../lib/util.js?v=efe89b71a3';

const AVATARS = ['🐻', '🐰', '🐱', '🐶', '🦊', '🐼', '🐨', '🐯', '🐷', '🐸', '🐧', '🐤', '🦄', '🐹', '🐳', '🦖', '🌻', '🍓', '🍑', '⭐'];

function Profile() {
  useCols('profile');
  const p = profileOf(app.me);
  const [name, setName] = useState(p.name);
  const save = (patch) => app.store.put('profile', app.me, { ...profileOf(app.me), ...patch });
  return html`<section class="card">
    <div class="card-hd"><h3>我的样子</h3></div>
    <label class="lbl">昵称（TA 看到的名字）</label>
    <div class="row">
      <input class="inp" maxlength="16" value=${name} onInput=${(e) => setName(e.target.value)} />
      <button class="btn" disabled=${!name.trim() || name.trim() === p.name} onClick=${() => { save({ name: name.trim() }); toast('改好啦', { icon: '✨' }); }}>保存</button>
    </div>
    <label class="lbl">头像</label>
    <div class="emo-pick big">${AVATARS.map((a) => html`<button type="button" class=${cx(p.avatar === a && 'on')} onClick=${() => save({ avatar: a })}>${a}</button>`)}</div>
  </section>`;
}

function Prefs() {
  const force = useForce();
  useBus('settings', force, []);
  const s = app.settings;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const askNotify = async () => {
    if (!('Notification' in window)) return toast('这个浏览器不支持通知', { icon: '😶' });
    const r = await Notification.requestPermission();
    saveSettings({ notify: r === 'granted' });
    if (r !== 'granted') toast('没有拿到通知权限，可以在浏览器设置里打开', { icon: '🔕' });
  };
  return html`<section class="card">
    <div class="card-hd"><h3>提醒方式</h3></div>
    <label class="switch"><input type="checkbox" checked=${s.sound} onChange=${(e) => saveSettings({ sound: e.target.checked })} /><span></span> 提示音（专注时、想安静时自动静音）</label>
    <label class="switch"><input type="checkbox" checked=${s.notify && perm === 'granted'} onChange=${(e) => (e.target.checked ? askNotify() : saveSettings({ notify: false }))} /><span></span> 页面在后台时弹系统通知</label>
    ${perm === 'denied' && html`<p class="hint">通知权限被拒绝了，需要在浏览器的网站设置里重新允许。</p>`}
    <p class="hint">这里没有“已读”、没有连续打卡、也没有谁陪伴更久的比较。想回就回，打开它只是因为想念。</p>
  </section>`;
}

function Network() {
  useSyncEvent(['net', 'presence', 'sweep']);
  const st = app.sync.status();
  const [busy, setBusy] = useState(false);
  const repair = async () => {
    setBusy(true);
    const n = await app.sync.repairAll();
    setBusy(false);
    toast(`重新上传了 ${n} 条记录`, { icon: '🔁' });
  };
  const label = { up: '已连接', connecting: '连接中…', down: '重连中…', idle: '未连接', stopped: '已停止' };
  return html`<section class="card">
    <div class="card-hd"><h3>连接</h3><small class="muted">钥匙指纹 ${app.kr.fp}</small></div>
    <ul class="net-ul">${st.map((l) => html`<li><i class=${cx('dot', l.state === 'up' && 'on')}></i><b>${l.name}</b><span class="muted">${label[l.state] || l.state}</span></li>`)}</ul>
    <p class="hint">内容在离开你的设备之前就已经用你们的暗号加密（AES-256-GCM），中转服务器只看得到乱码。两边的“钥匙指纹”一样，说明暗号一致。</p>
    <p class="hint">数据存在每个人的浏览器里，并通过两条公共线路互相备份。换手机或清理浏览器之前，记得先导出备份。</p>
    <div class="row wrap">
      <button class="btn ghost sm" disabled=${busy || !app.sync.online} onClick=${repair}>${busy ? '上传中…' : '🔁 重新上传我这边的记录'}</button>
    </div>
  </section>`;
}

function Backup() {
  const exp = () => {
    const recs = app.store.exportAll(); // includes your own private notes: this file is for you
    download(`pianxin-${app.me}-${today()}.json`, JSON.stringify({ app: 'pianxin.me', v: 1, me: app.me, at: Date.now(), recs }, null, 0));
    toast(`导出了 ${recs.length} 条记录（不含图片）`, { icon: '💾' });
  };
  const imp = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'pianxin.me' || !Array.isArray(data.recs)) throw new Error('bad file');
      let n = 0;
      for (const r of data.recs) {
        if (r.c && r.c[0] === '_' && data.me !== app.me) continue;
        if (r.c && r.c[0] === '_') {
          if (!app.store.rec(r.c, r.i)) { app.store.put(r.c, r.i, r.x); n++; }
          continue;
        }
        if (app.store.importRec(r)) n++;
      }
      toast(`恢复了 ${n} 条记录`, { icon: '📦' });
    } catch {
      toast('这个文件好像不对', { icon: '😵' });
    }
  };
  return html`<section class="card">
    <div class="card-hd"><h3>备份</h3></div>
    <p class="hint">导出一份所有记录的文件（文字为主，图片不包含）。换设备时导入就能接上。</p>
    <div class="row wrap">
      <button class="btn ghost sm" onClick=${exp}>💾 导出备份</button>
      <label class="btn ghost sm">📦 导入备份<input type="file" accept="application/json,.json" hidden onChange=${imp} /></label>
    </div>
  </section>`;
}

function Danger() {
  const lock = () => {
    if (!confirm('退出后，这台设备需要重新输入暗号才能进来（记录还在）。确定吗？')) return;
    localStorage.removeItem(`px:${app.me}:kr`);
    location.reload();
  };
  const wipe = async () => {
    if (!confirm('清除这台设备上的所有数据？（已经同步到 TA 那边的不会受影响）')) return;
    localStorage.removeItem(`px:${app.me}:kr`);
    await app.store.destroy();
    location.reload();
  };
  return html`<section class="card">
    <div class="card-hd"><h3>这台设备</h3></div>
    <div class="row wrap">
      <button class="btn ghost sm" onClick=${lock}>🔒 退出（下次重新输入暗号）</button>
      <button class="btn ghost sm danger" onClick=${wipe}>🧹 清除本机数据</button>
    </div>
    <p class="hint">${nameOf(app.partner)} 的页面是 <a href=${'/' + app.partner}>pianxin.me/${app.partner}</a>，两个人用同一个暗号。</p>
  </section>`;
}

export function Me() {
  return html`<div class="page me">
    <div class="page-hd"><h2>⚙️ 设置</h2></div>
    <div class="cols">
      <div class="col-a"><${Profile} /><${Prefs} /></div>
      <div class="col-b"><${Network} /><${Backup} /><${Danger} /></div>
    </div>
  </div>`;
}
