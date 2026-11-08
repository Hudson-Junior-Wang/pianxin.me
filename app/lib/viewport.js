// Keep floating UI inside the available viewport on Safari and Huawei Browser.
// Do not disable page/pinch zoom or resize the whole document around a text field.
export function initViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let frame = 0;
  let idleHeight = innerHeight, lastWidth = innerWidth;
  const update = () => {
    frame = 0;
    if (viewport && Math.abs(viewport.scale - 1) > 0.02) return;
    const h = viewport?.height || innerHeight;
    const top = viewport?.offsetTop || 0;
    root.style.setProperty('--visual-h', `${h}px`);
    root.style.setProperty('--visual-top', `${top}px`);
    const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    // Some Android/HarmonyOS versions resize the layout viewport as well, or
    // do not expose visualViewport. Remember the idle height for that path.
    if (!editing || Math.abs(innerWidth - lastWidth) > 80) idleHeight = Math.max(innerHeight, h);
    lastWidth = innerWidth;
    root.classList.toggle('keyboard-open', editing && Math.max(innerHeight, idleHeight) - h > 120);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  addEventListener('resize', schedule);
  addEventListener('pageshow', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  update();
}
