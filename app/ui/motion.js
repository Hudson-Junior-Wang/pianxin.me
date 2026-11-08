// Short, interruptible UI motion. Never remount a route or delay a data write.
import { useEffect, useLayoutEffect, useRef } from '../vendor/hooks.js';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Manual dismissals stay mounted until their short exit completes, keeping the
// existing focus trap, inert background and draft state intact during the exit.
export function useLayerClose(selector, onClose, kind = 'modal') {
  const callback = useRef(onClose), pending = useRef(false), work = useRef(null);
  callback.current = onClose;
  useEffect(() => () => {
    if (work.current) {
      clearTimeout(work.current.timer);
      work.current.animations.forEach((a) => a.cancel());
      work.current = null;
    }
  }, []);
  return () => {
    if (pending.current) return;
    const nodes = [...document.querySelectorAll(selector)];
    const node = nodes[nodes.length - 1];
    if (!node || reducedMotion() || typeof node.animate !== 'function') return callback.current();
    pending.current = true;
    const layer = kind === 'lightbox' ? node : node.parentElement;
    const animations = [];
    const finish = () => {
      if (!work.current) return;
      clearTimeout(work.current.timer);
      work.current = null;
      pending.current = false;
      delete layer.dataset.closing;
      animations.forEach((a) => a.cancel());
      callback.current();
    };
    try {
      layer.dataset.closing = 'true';
      animations.push(layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' }));
      if (kind !== 'lightbox') animations.push(node.animate([
        { transform: 'translateY(0) scale(1)' },
        { transform: kind === 'sheet' ? 'translateY(48px)' : 'translateY(14px) scale(.96)' },
      ], { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }));
      work.current = { animations, timer: setTimeout(finish, 230) };
      Promise.all(animations.map((a) => a.finished)).then(finish, finish);
    } catch {
      animations.forEach((a) => a.cancel());
      work.current = null;
      pending.current = false;
      delete layer.dataset.closing;
      callback.current();
    }
  };
}

export function useRouteMotion(ref, routeKey) {
  useLayoutEffect(() => {
    const node = ref.current?.querySelector('.page');
    if (!node || reducedMotion() || typeof node.animate !== 'function') return;
    const animation = node.animate([
      { opacity: .25, transform: 'translateY(18px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)' });
    return () => animation.cancel();
  }, [routeKey]);
}
