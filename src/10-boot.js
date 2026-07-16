'use strict';
/* THE ESCAPEMENT — boot. One namespace, one rAF ticker (stops when the tab
   hides or nothing animates), one DPR-capped canvas, storage with a seatbelt. */
const E = {};

/* ---- storage (private mode / blocked storage must never throw) ---- */
E.store = {
  get(k, d) { try { const v = localStorage.getItem('esc-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('esc-' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

/* ---- environment ---- */
E.rm = matchMedia('(prefers-reduced-motion: reduce)');
E.DPR = () => Math.min(devicePixelRatio || 1, 2); /* the phone-cook cap */

/* ---- the one ticker ---- */
E.ticker = (() => {
  const tasks = new Set();
  let rafId = null, last = 0;
  function frame(now) {
    rafId = null;
    const dt = Math.min(50, now - last) || 16; last = now;
    for (const t of [...tasks]) { if (t(dt, now) === false) tasks.delete(t); }
    if (tasks.size && !document.hidden) rafId = requestAnimationFrame(frame);
  }
  function kick() { if (rafId === null && tasks.size && !document.hidden) { last = performance.now(); rafId = requestAnimationFrame(frame); } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  return {
    add(t) { tasks.add(t); kick(); return () => tasks.delete(t); },
    kick,
  };
})();

/* ---- the movement canvas ---- */
E.cv = document.getElementById('movement');
E.cx = E.cv.getContext('2d');

/* World space: the movement is authored in a fixed unit square, radius R=520
   (plate 480 + margin). Camera maps world -> canvas pixels. */
E.R = 520;
E.cam = { x: 0, y: 0, z: 1, tz: 1, tx: 0, ty: 0 }; /* current + targets, lerped in render */

E.view = { w: 0, h: 0, px: 1 }; /* css size + device pixel ratio actually applied */
E.resize = () => {
  const r = E.cv.getBoundingClientRect();
  if (!r.width) return;
  const px = E.DPR();
  const w = Math.round(r.width * px), h = Math.round(r.height * px);
  if (w === E.cv.width && h === E.cv.height) return;
  E.cv.width = w; E.cv.height = h;
  E.view = { w: r.width, h: r.height, px };
  E.baseScale = (Math.min(w, h) / 2) / E.R; /* world fits the circle at z=1 */
  if (E.forge && E.forge.sprites) E.forge.rebake(); /* only rebake what was baked */
  if (E.render) E.render.wake(); else E.ticker.kick(); /* a parked loop must repaint */
};
addEventListener('resize', () => { clearTimeout(E._rzT); E._rzT = setTimeout(E.resize, 120); });

/* world -> device px */
E.w2s = (wx, wy) => {
  const s = E.baseScale * E.cam.z;
  return [E.cv.width / 2 + (wx - E.cam.x) * s, E.cv.height / 2 + (wy - E.cam.y) * s];
};
/* device px -> world */
E.s2w = (sx, sy) => {
  const s = E.baseScale * E.cam.z;
  return [(sx - E.cv.width / 2) / s + E.cam.x, (sy - E.cv.height / 2) / s + E.cam.y];
};

/* ---- helpers ---- */
E.TAU = Math.PI * 2;
E.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
E.lerp = (a, b, t) => a + (b - a) * t;
E.ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/* seeded PRNG for stable decorative randomness (screw slot angles, perlage jitter) */
E.mulberry = (seed) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

/* announce to screen readers (rate-limited by callers) */
E.say = (msg) => { const el = document.getElementById('sr-status'); if (el) el.textContent = msg; };
