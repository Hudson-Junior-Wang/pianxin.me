// 偏心我 · 设置 — 昵称和角色、声音与通知、连接状态、备份
import { html } from '../h.js?v=baab30bfc4';
import { useState } from '../../vendor/hooks.js';
import { app, useCols, useSyncEvent, profileOf, saveSettings, useBus, useForce, toast, nameOf, chOf, CHARS, stId } from '../../lib/ctx.js?v=baab30bfc4';
import { download, today, cx } from '../../lib/util.js?v=baab30bfc4';
import { St } from '../common.js?v=baab30bfc4';

function Profile() {
  useCols('profile');
  const p = profileOf(app.me);
  const [name, setName] = useState(p.name);
  const save = (patch) => app.store.put('profile', app.me, { ...profileOf(app.me), ...patch });
  const ch = chOf(app.me);
  return html`<section class="card">
    <div class="card-hd"><h3>我的样子</h3></div>
    <label class="lbl">昵称（TA 看到的名字）</label>
    <div class="row">
      <input class="inp" maxlength="16" value=${name} onInput=${(e) => setName(e.target.value)} />
      <button class="btn" disabled=${!name.trim() || name.trim() === p.name} onClick=${() => { save({ name: name.trim() }); toast('改好啦', { icon: stId(app.me, 'ok') }); }}>保存</button>
    </div>
    <label class="lbl">我的角色（表情包和头像都会跟着换）</label>
    <div class="ch-pick">
      ${Object.entries(CHARS).map(([k, c]) => html`<button type="button" class=${cx('ch-b', ch === k && 'on')} onClick=${() => save({ ch: k, roleV: 2, chCustom: true })}>
        <${St} id=${k === 'bear' ? 'av-bear' : 'av-bunny'} size=${72} title="" /><span>${c.name}</span>
      </button>`)}
    </div>
  </section>`;
}

function Prefs() {
  const force = useForce();
  useBus('settings', force, []);
  const s = app.settings;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const askNotify = async () => {
    if (!('Notification' in window)) return toast('这个浏览器不支持通知', { icon: stId(app.me, 'what') });
    try {
      const r = await Notification.requestPermission();
      saveSettings({ notify: r === 'granted' });
      if (r !== 'granted') toast('没有拿到通知权限，可以在浏览器设置里打开', { icon: stId(app.me, 'sorry') });
    } catch {
      saveSettings({ notify: false });
      toast('这个浏览器暂时不能开启系统通知，页面内提示仍可用', { icon: stId(app.me, 'sorry') });
    }
  };
  return html`<section class="card">
    <div class="card-hd"><h3>提醒方式</h3></div>
    <label class="switch"><input type="checkbox" checked=${s.sound} onChange=${(e) => saveSettings({ sound: e.target.checked })} /><span></span> 消息提示音（专注时静音，计时切换仍轻声提醒）</label>
    <label class="switch"><input type="checkbox" checked=${s.notify && perm === 'granted'} onChange=${(e) => (e.target.checked ? askNotify() : saveSettings({ notify: false }))} /><span></span> 页面在后台时弹系统通知</label>
    ${perm === 'denied' && html`<p class="hint">通知权限被拒绝了，需要在浏览器的网站设置里重新允许。</p>`}
    <p class="hint">选「想安静」时，消息、戳一下和计时切换都不响。网页关闭后不能保证系统提醒，重要安排请另设手机闹钟。</p>
    <p class="hint">这里没有“已读”、没有连续打卡、也没有谁陪伴更久的比较。想回就回，不用有负担。</p>
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
    toast(`重新上传了 ${n} 条记录`, { icon: stId(app.me, 'ok') });
  };
  const label = { up: '已连接', connecting: '连接中…', down: '重连中…', idle: '未连接', stopped: '已停止' };
  return html`<section class="card">
    <div class="card-hd"><h3>连接</h3><small class="muted">钥匙指纹 ${app.kr.fp}</small></div>
    <ul class="net-ul">${st.map((l) => html`<li><i class=${cx('dot', l.state === 'up' && 'on')}></i><b>${l.name}</b><span class="muted">${label[l.state] || l.state}</span></li>`)}</ul>
    <p class="hint">内容在离开你的设备之前就已经用你们的暗号加密（AES-256-GCM），中转服务器只看得到乱码。两边的“钥匙指纹”一样，说明暗号一致。</p>
    <p class="hint">数据主要存在每个人的浏览器里，通过公共中转线路同步。公共服务不保证长期保存，不能代替备份；换手机或清理浏览器前，请先导出文字记录，照片另行保存。</p>
    <div class="row wrap">
      <button class="btn ghost sm" disabled=${busy || !app.sync.online} onClick=${repair}>${busy ? '上传中…' : '重新上传我这边的记录'}</button>
    </div>
  </section>`;
}

function Backup() {
  const exp = () => {
    const recs = app.store.exportAll(); // includes your own private notes: this file is for you
    download(`pianxin-${app.me}-${today()}.json`, JSON.stringify({ app: 'pianxin.me', v: 1, me: app.me, at: Date.now(), recs }, null, 0));
    toast(`导出了 ${recs.length} 条记录（不含图片）`, { icon: stId(app.me, 'ok') });
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
      toast(`恢复了 ${n} 条记录`, { icon: stId(app.me, 'done') });
    } catch {
      toast('这个文件好像不对', { icon: stId(app.me, 'dizzy') });
    }
  };
  return html`<section class="card">
    <div class="card-hd"><h3>备份</h3></div>
    <p class="hint">导出一份所有记录的文件（文字为主，图片不包含）。换设备时导入就能接上。</p>
    <div class="row wrap">
      <button class="btn ghost sm" onClick=${exp}>导出备份</button>
      <label class="btn ghost sm">导入备份<input type="file" accept="application/json,.json" hidden onChange=${imp} /></label>
    </div>
  </section>`;
}

function Install() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return html`<section class="card install-card">
    <div class="card-hd"><h3>${standalone ? '已从桌面打开' : '放到手机桌面'}</h3><img src="/app/icons/icon-180-v2.png" width="44" height="44" alt="偏心我，小熊和小兔图标" style="border-radius:11px" /></div>
    ${standalone ? html`<p class="hint">这个图标打开的是 ${nameOf(app.me)} 的入口。仍需要联网加载页面和同步，不是离线应用。</p>` : html`<p class="hint">在 iPhone / iPad 的 Safari 里，先打开自己的专属入口，再添加到主屏幕。</p><ol class="install-guide"><li>点 Safari 的「分享」按钮。</li><li>选择「添加到主屏幕」（部分版本在「更多」里）。</li><li>保留名称「偏心我」，点「添加」。若有「作为 Web App 打开」，可保持开启。</li></ol>`}
    <p class="hint">当前入口：<b>pianxin.me/${app.me}/</b>。添加后会保留这个入口，不会变成对方的身份。</p>
    <p class="hint">旧图标若没有更新，先导出备份、另存照片，再考虑移除旧快捷方式重加。不要清除 Safari 网站数据；桌面版若要求暗号，输入原来的即可。私人记录只在原设备与浏览器中保存，不会自动搬到桌面版。</p>
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
      <button class="btn ghost sm" onClick=${lock}>退出（下次重新输入暗号）</button>
      <button class="btn ghost sm danger" onClick=${wipe}>清除本机数据</button>
    </div>
    <p class="hint">${nameOf(app.partner)} 的页面是 <a href=${'/' + app.partner}>pianxin.me/${app.partner}</a>，两个人用同一个暗号。</p>
  </section>`;
}

export function Me() {
  return html`<div class="page me">
    <div class="page-hd"><h2>设置</h2></div>
    <div class="cols">
      <div class="col-a"><${Profile} /><${Install} /><${Prefs} /></div>
      <div class="col-b"><${Network} /><${Backup} /><${Danger} /></div>
    </div>
  </div>`;
}
