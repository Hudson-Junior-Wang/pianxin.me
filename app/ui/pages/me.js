// 偏心我 · 设置 — 昵称和角色、声音与通知、连接状态、备份
import { html } from '../h.js?v=2b526ea3b9';
import { useState, useEffect } from '../../vendor/hooks.js';
import { app, useCols, useSyncEvent, profileOf, saveSettings, useBus, useForce, toast, nameOf, chOf, CHARS, stId } from '../../lib/ctx.js?v=2b526ea3b9';
import { download, today, cx } from '../../lib/util.js?v=2b526ea3b9';
import { St } from '../common.js?v=2b526ea3b9';
import { Fingerprint } from '../pictograms.js?v=2b526ea3b9';
import { installPlatform } from '../../lib/install.js?v=2b526ea3b9';
import { roomBindingCode, roomIsBound } from '../../lib/room-access.js?v=2b526ea3b9';

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
  </section>`;
}

function Network() {
  useSyncEvent(['net', 'presence', 'sweep']);
  const st = app.sync.status();
  const [busy, setBusy] = useState(false);
  const [binding, setBinding] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { let active = true; roomBindingCode(app.kr).then((value) => { if (active) setBinding(value); }).catch(() => {}); return () => { active = false; }; }, []);
  const copyBinding = async () => {
    if (!binding) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(binding);
      setCopied(true);
      toast('固定空间校验码已复制；不用提供暗号', { icon: stId(app.me, 'ok') });
    } catch { setCopied(false); toast('自动复制不可用，请长按或选中下方校验码复制', { icon: stId(app.me, 'idea') }); }
  };
  const repair = async () => {
    setBusy(true);
    const n = await app.sync.repairAll();
    setBusy(false);
    toast(`重新上传了 ${n} 条记录`, { icon: stId(app.me, 'ok') });
  };
  const label = { up: '已连接', connecting: '连接中…', down: '重连中…', idle: '未连接', stopped: '已停止' };
  return html`<section class="card">
    <div class="card-hd network-hd"><h3>连接</h3><span class="network-fingerprint"><small class="muted">钥匙指纹</small><${Fingerprint} value=${app.kr.fp} compact /></span></div>
    <ul class="net-ul">${st.map((l) => html`<li><i class=${cx('dot', l.state === 'up' && 'on')}></i><b>${l.name}</b><span class="muted">${label[l.state] || l.state}</span></li>`)}</ul>
    <p class="hint">内容在离开你的设备之前就已经用你们的暗号加密（AES-256-GCM），中转服务器只看得到乱码。两边的“钥匙指纹”四组编号一模一样，说明暗号一致。</p>
    <div class="room-binding">
      <b>${roomIsBound() ? '固定空间已绑定' : '固定空间待绑定'}</b>
      <p class="hint">${roomIsBound() ? '网站只接受已确认的暗号；错误暗号不会另建空间。' : '请只在保留正确记录的电脑上复制此校验码，用于绑定唯一空间。手机原来的记录先保留，不要退出或清除数据。'}</p>
      <button type="button" class="btn ghost sm" disabled=${!binding} onClick=${copyBinding}>${copied ? '已复制固定空间校验码' : '复制固定空间校验码'}</button>
      <label class="lbl" for="room-binding-code">固定空间校验码（不是暗号）</label><textarea id="room-binding-code" class="inp room-binding-code" readonly rows="3" value=${binding} spellcheck="false" aria-label="固定空间校验码" onFocus=${(e) => e.target.select()}></textarea>
      <p class="hint">这里只包含单向校验值，不含暗号、解密钥匙或房间地址。无需发送暗号，也不要复制浏览器里的其他数据。</p>
    </div>
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
  const platform = installPlatform();
  const copyEntry = async () => {
    const url = `${location.origin}/${app.me}/`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      toast('入口链接已复制', { icon: stId(app.me, 'ok') });
    } catch { prompt('长按或选中复制自己的入口链接', url); }
  };
  return html`<section class="card install-card">
    <div class="card-hd"><h3>${standalone ? '已从桌面打开' : '放到手机桌面'}</h3><img src="/app/icons/icon-180-v3.png" width="44" height="44" alt="偏心我，小熊和小兔图标" style="border-radius:11px" /></div>
    ${standalone ? html`<p class="hint">这个图标打开的是 ${nameOf(app.me)} 的入口。仍需要联网加载页面和同步，不是离线应用。</p>` : html`<p class="hint">先用手机浏览器打开自己的入口，再从浏览器菜单添加。网页不能替你创建系统桌面图标。</p>`}
    <p class="hint">自己的入口：<a class="install-entry" href=${'/' + app.me + '/'}>pianxin.me/${app.me}/</a></p>
    <button class="btn ghost sm" type="button" onClick=${copyEntry}>复制自己的入口链接</button>
    <details class="install-help" data-platform="huawei" open=${!standalone && platform !== 'safari'}>
      <summary>华为浏览器 / HarmonyOS</summary>
      <ol class="install-guide"><li>在华为浏览器里打开上面的入口，不要停留在微信等应用的内置网页。</li><li>HarmonyOS 5.0 及以上：点菜单「∷（四个点）」→「添加至桌面」。更早的鸿蒙 / EMUI：点「∷」→「添加至」→「桌面」。</li><li>确认名称「偏心我」及自己的入口，再点确认勾选按钮或「添加」。添加后会保留自己的入口。</li></ol>
      <p class="hint">这可能只是网页快捷方式，打开时仍有浏览器工具栏，不一定是独立 App。菜单名称、图标外观由系统版本决定。</p>
      <p class="hint">没有这个菜单？先更新华为浏览器和系统。鸿蒙 5.0 及以上还可在「我的 → 书签收藏 → 书签」长按已收藏的网址，选择「添加至桌面」。官方当前说明该版本的浏览器桌面快捷方式上限为 10 个。</p>
      <p class="hint"><a href="https://consumer.huawei.com/cn/support/content/zh-cn16032141/" target="_blank" rel="noopener noreferrer">华为官方：鸿蒙 5.0 及以上</a> · <a href="https://consumer.huawei.com/cn/support/content/zh-cn00448896/" target="_blank" rel="noopener noreferrer">较早版本指引</a></p>
    </details>
    <details class="install-help" data-platform="safari" open=${!standalone && platform === 'safari'}>
      <summary>iPhone / iPad 的 Safari</summary>
      <ol class="install-guide"><li>在 Safari 里打开自己的专属入口，点「分享」。</li><li>选择「添加到主屏幕」（部分版本在「更多」里）。</li><li>保留名称「偏心我」，点「添加」。若有「作为 Web App 打开」，可保持开启。</li></ol>
    </details>
    <p class="hint">其他浏览器：在菜单中找「添加到主屏幕」「安装应用」或类似选项；没有时可先保存书签。是否提供安装，由浏览器决定。</p>
    <p class="hint">添加桌面不会变成离线应用，也不能保证关闭网页后提醒。旧图标若没有更新，先导出备份、另存照片，再考虑移除旧快捷方式重加。不要清除浏览器网站数据；更换浏览器或独立桌面环境时，私人记录不会自动搬家；若要求暗号，使用原来的暗号。</p>
  </section>`;
}

function Danger() {
  const lock = () => {
    if (!roomIsBound()) return toast('固定空间绑定前请保留当前登录，先复制电脑校验码并导出备份。', { icon: stId(app.me, 'idea') });
    if (!confirm('退出后，这台设备需要重新输入原来的暗号才能进来（记录还在）。确定吗？')) return;
    localStorage.removeItem(`px:${app.me}:kr`);
    location.reload();
  };
  const wipe = async () => {
    if (!roomIsBound()) return toast('正在保留两台设备的记录，请先完成空间绑定与备份。', { icon: stId(app.me, 'idea') });
    if (!confirm('清除这台设备上的所有数据？（已经同步到 TA 那边的不会受影响）')) return;
    localStorage.removeItem(`px:${app.me}:kr`);
    await app.store.destroy();
    location.reload();
  };
  return html`<section class="card">
    <div class="card-hd"><h3>这台设备</h3></div>
    <div class="row wrap">
      <button class="btn ghost sm" disabled=${!roomIsBound()} onClick=${lock}>退出（下次重新输入暗号）</button>
      <button class="btn ghost sm danger" disabled=${!roomIsBound()} onClick=${wipe}>清除本机数据</button>
    </div>
    ${!roomIsBound() && html`<p class="hint">固定空间绑定前暂不退出或清除数据，以便先备份手机和电脑各自的历史。</p>`}
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
