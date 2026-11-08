// Keep floating UI inside Safari's visual viewport when the software keyboard opens.
// Do not disable page/pinch zoom or resize the whole document around a text field.
export function initViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let frame = 0;
  const update = () => {
    frame = 0;
    if (viewport && Math.abs(viewport.scale - 1) > 0.02) return;
    const h = viewport?.height || innerHeight;
    const top = viewport?.offsetTop || 0;
    root.style.setProperty('--visual-h', `${h}px`);
    root.style.setProperty('--visual-top', `${top}px`);
    const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    root.classList.toggle('keyboard-open', editing && innerHeight - h > 120);
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
