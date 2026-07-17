/* THE ESCAPEMENT — interaction. Every verb works three ways: pointer on the
   metal, a real button on the case, and a bare key. W winds, R chimes,
   C runs the chronograph, X resets it, P opens the plan; +/−, arrows and 0
   drive the camera without a pointer. */
(() => {
  const cv = E.cv;
  const crown = document.getElementById('crown');
  const slide = document.getElementById('slide');
  const pushA = document.getElementById('push-a');
  const pushB = document.getElementById('push-b');

  const anyGesture = () => { E.sound.arm(); E.render.wake(); };
  addEventListener('pointerdown', anyGesture, { capture: true });
  addEventListener('pointerup', anyGesture, { capture: true }); /* touch: the RELEASE is activation-bearing */
  addEventListener('keydown', anyGesture, { capture: true });

  /* ---------- camera: pan / wheel-zoom / pinch / double-tap / keys ---------- */
  const ptrs = new Map();
  let pinch0 = 0, pinchZ0 = 1, moved = 0;

  const clampCam = () => {
    const c = E.cam;
    c.tz = E.clamp(c.tz, 1, 5);
    const slack = E.forge.L.plateR * (1 - 1 / c.tz) + 30;
    c.tx = E.clamp(c.tx, -slack, slack);
    c.ty = E.clamp(c.ty, -slack, slack);
  };

  cv.addEventListener('pointerdown', (e) => {
    if (E.dismissLegendSoft) E.dismissLegendSoft(); /* hands on the metal: the plate excuses itself */
    if (E.plan.on) return;
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      moved = 99; /* a second finger is never a tap */
      const [a, b] = [...ptrs.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      pinchZ0 = E.cam.tz;
    } else {
      moved = 0;
    }
    cv.classList.add('dragging');
  });
  cv.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    const s = E.baseScale * E.cam.z / E.view.px; /* css px per world unit */
    if (ptrs.size === 1) {
      E.cam.tx -= dx / s; E.cam.ty -= dy / s;
      E.cam.x = E.cam.tx; E.cam.y = E.cam.ty; /* pan is direct, no lag */
      clampCam();
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) { E.cam.tz = E.clamp(pinchZ0 * d / pinch0, 1, 5); clampCam(); }
    }
    E.render.wake();
  });
  const release = (e) => {
    ptrs.delete(e.pointerId);
    if (!ptrs.size) cv.classList.remove('dragging');
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);

  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (E.plan.on) return;
    const r = cv.getBoundingClientRect();
    const px = (e.clientX - r.left) * E.view.px, py = (e.clientY - r.top) * E.view.px;
    const [wx, wy] = E.s2w(px, py);
    const k = Math.exp(-e.deltaY * 0.0016);
    const z0 = E.cam.tz;
    E.cam.tz = E.clamp(z0 * k, 1, 5);
    /* keep the point under the cursor fixed */
    const f = 1 - z0 / E.cam.tz;
    E.cam.tx += (wx - E.cam.tx) * f;
    E.cam.ty += (wy - E.cam.ty) * f;
    clampCam();
    E.render.wake();
  }, { passive: false });

  let lastTap = 0;
  cv.addEventListener('pointerup', (e) => {
    if (moved > 8 || E.plan.on) return;
    const t = performance.now();
    if (t - lastTap < 320) {
      const r = cv.getBoundingClientRect();
      const [wx, wy] = E.s2w((e.clientX - r.left) * E.view.px, (e.clientY - r.top) * E.view.px);
      if (E.cam.tz > 1.8) { E.cam.tz = 1; E.cam.tx = 0; E.cam.ty = 0; }
      else { E.cam.tz = 2.6; E.cam.tx = wx; E.cam.ty = wy; }
      clampCam();
      E.render.wake();
      lastTap = 0;
    } else lastTap = t;
  });

  /* ---------- the crown: hold to wind ---------- */
  let windTimer = null, crownPos = 0;
  function windOnce() {
    const wasSpinning = E.time.T.phase === 'spin';
    const took = E.time.wind(1);
    if (took > 0) {
      E.sound.ratchet();
      E.fx.ratchetSpin = 1;
      crownPos += 7;
      crown.style.backgroundPosition = `0 ${crownPos}px, 0 0`; /* flutes turn; base gradient stays */
      if (!wasSpinning && E.time.T.phase === 'spin') E.sound.whir(2400); /* once per wake, not per click */
    }
    E.render.wake();
  }
  const windStart = (e) => {
    if (E.dismissLegendSoft) E.dismissLegendSoft();
    if (e.type === 'pointerdown') {
      e.preventDefault();
      if (e.pointerId !== undefined) { try { crown.setPointerCapture(e.pointerId); } catch { } }
    }
    if (windTimer) return;
    windOnce();
    windTimer = setInterval(windOnce, 120);
  };
  const windStop = () => {
    if (!windTimer) return;           /* only a real wind announces or clears */
    clearInterval(windTimer);
    windTimer = null;
    announceReserve();
  };
  crown.addEventListener('pointerdown', windStart);
  crown.addEventListener('pointerup', windStop);
  crown.addEventListener('pointercancel', windStop);
  crown.addEventListener('lostpointercapture', windStop);
  addEventListener('pointerup', windStop);
  addEventListener('blur', windStop);
  crown.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); windStart(e); } });
  crown.addEventListener('keyup', windStop);
  crown.addEventListener('blur', windStop);

  let lastAnnounced = -1;
  function announceReserve() {
    const pct = Math.round(E.time.T.reserve * 100);
    if (pct !== lastAnnounced) { lastAnnounced = pct; E.say(`Power reserve ${pct} percent.`); }
  }

  /* crown glint when the movement is asking for it */
  setInterval(() => {
    if (document.hidden) return;
    const wants = E.time.T.phase === 'stop' || (E.time.T.phase === 'run' && E.time.T.reserve < 0.12);
    crown.classList.toggle('glint', wants && !E.rm.matches);
  }, 1200);

  /* ---------- the repeater slide ---------- */
  let slideY0 = null;
  slide.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    slide.setPointerCapture(e.pointerId);
    slideY0 = e.clientY;
    slide.classList.add('armed');
  });
  slide.addEventListener('pointermove', (e) => {
    if (slideY0 === null) return;
    const dy = E.clamp(e.clientY - slideY0, 0, 30);
    slide.style.transform = `translateY(${dy}px)`;
  });
  const slideRelease = (e) => {
    if (slideY0 === null) return;
    const dy = e.clientY - slideY0;
    slideY0 = null;
    slide.classList.remove('armed');
    slide.style.transform = '';
    if (dy > 10) E.sound.repeater();
  };
  slide.addEventListener('pointerup', slideRelease);
  slide.addEventListener('pointercancel', slideRelease);
  slide.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); E.sound.repeater(); }
  });

  /* ---------- chronograph ---------- */
  function chronoToggle() {
    const ch = E.time.T.chrono;
    if (E.time.T.phase === 'stop') { E.say('The movement is stopped — wind the crown first.'); return; }
    ch.on = !ch.on;
    pushA.setAttribute('aria-pressed', String(ch.on));
    E.sound.pusher();
    E.say(ch.on ? 'Chronograph running.' : `Chronograph stopped at ${(ch.ms / 1000).toFixed(1)} seconds.`);
    E.render.wake();
  }
  function chronoReset() {
    const ch = E.time.T.chrono;
    E.sound.pusher();
    ch.ms = 0;
    E.say(ch.on ? 'Chronograph flyback — running from zero.' : 'Chronograph reset.');
    E.render.wake();
  }
  pushA.addEventListener('click', chronoToggle);
  pushB.addEventListener('click', chronoReset);

  /* ---------- bare keys ---------- */
  const PAN = 60;
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLElement && (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT')) return;
    const k = e.key;
    if (e.repeat && !['w', 'W', '+', '=', '-', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) return;
    switch (k) {
      case 'w': case 'W':
        windOnce();
        clearTimeout(E._windSayT);
        E._windSayT = setTimeout(announceReserve, 650); /* bare-key winders hear the reserve too */
        return;
      case 'r': case 'R': E.sound.repeater(); return;
      case 'c': case 'C': chronoToggle(); return;
      case 'x': case 'X': chronoReset(); return;
      case 'p': case 'P': E.planToggle && E.planToggle(); return;
    }
    if (E.plan.on) return;
    const z = E.cam.tz;
    switch (k) {
      case '+': case '=': E.cam.tz = E.clamp(z * 1.18, 1, 5); break;
      case '-': E.cam.tz = E.clamp(z / 1.18, 1, 5); break;
      case '0': E.cam.tz = 1; E.cam.tx = 0; E.cam.ty = 0; break;
      case 'ArrowUp': E.cam.ty -= PAN / z; break;
      case 'ArrowDown': E.cam.ty += PAN / z; break;
      case 'ArrowLeft': E.cam.tx -= PAN / z; break;
      case 'ArrowRight': E.cam.tx += PAN / z; break;
      default: return;
    }
    clampCam();
    E.render.wake();
    clearTimeout(E._zoomSayT);
    E._zoomSayT = setTimeout(() => E.say(`Zoom ${E.cam.tz.toFixed(1)}×.`), 500);
  });
})();
