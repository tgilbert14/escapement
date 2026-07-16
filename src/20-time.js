/* THE ESCAPEMENT — time. The movement keeps the visitor's REAL local time
   through a real gear train:

     barrel ─ center wheel (1 rev/h) ─ third (×8) ─ fourth (×7.5, 1 rev/min)
                                                      └─ escape (×10, 15 teeth)
                                                           └─ pallet ─ balance

   18,000 A/H: the balance beats 5 times a second (period 400ms). Stepped
   wheels advance on the 200ms tick grid; the minute and hour creep
   continuously, exactly like the metal would.

   EVERYTHING IS ANCHORED TO THE WALL CLOCK, never integrated frame-by-frame:
   the reserve drains, the chronograph counts, and the stopped watch stays
   exactly where it died — through parked frames, hidden tabs, and jank.

   The mainspring is real theater: it drains (even while you are away),
   the balance dies when it empties, and winding the crown brings the watch
   back — then the hands SPIN to catch up with the true time, because the
   movement always knows what time it really is. */
E.time = (() => {
  const BEAT = 200;                    /* ms per tick */
  const DRAIN = 1 / 480;               /* full reserve = 8 minutes of run */
  const WIND = 0.05;                   /* reserve per crown click */
  const SYNODIC = 29.530588853;        /* days */
  const NEWMOON = Date.UTC(2000, 0, 6, 18, 14) / 86400000; /* epoch, in days */

  const T = {
    phase: 'run',        /* run | die | stop | spin */
    reserve: 0.55,
    deficit: 0,          /* ms the display lags true time (grows while stopped) */
    stopAtDisp: 0,       /* wall ms of the display instant the watch stopped at */
    dieT0: 0,
    spinT0: 0, spinFrom: 0,
    amp: 1,              /* balance amplitude factor 0..1 */
    chrono: { on: false, ms: 0 },
    justTicked: false,
    _tzo: new Date().getTimezoneOffset(),
  };

  const wrap12 = (ms) => ((ms % 43200000) + 43200000) % 43200000;

  function enterStop(deficitMs) {
    T.phase = 'stop';
    T.amp = 0;
    T.deficit = deficitMs;
    T.stopAtDisp = Date.now() - deficitMs;
  }
  function enterSpin(fromMs) {
    T.spinFrom = wrap12(fromMs);
    T.deficit = T.spinFrom;
    T.spinT0 = performance.now();
    T.phase = 'spin';
  }

  /* ---- persistence: the watch remembers being left alone ---- */
  const saved = E.store.get('movement', null);
  if (saved && saved.at) {
    const gone = Math.max(0, Date.now() - saved.at) / 1000;
    const wasRunning = saved.phase !== 'stop';
    let reserve = saved.reserve, deficit = saved.deficit || 0;
    if (wasRunning) {
      const ranFor = Math.min(gone, reserve / DRAIN);
      reserve -= ranFor * DRAIN;
      deficit += (gone - ranFor) * 1000;
    } else {
      deficit += gone * 1000;
    }
    T.reserve = E.clamp(reserve, 0, 1);
    if (T.reserve <= 0.001) enterStop(deficit);
    else if (deficit > 800) { T.amp = 1; enterSpin(deficit); } /* interrupted catch-up finishes itself */
    else { T.phase = 'run'; T.amp = 1; T.deficit = 0; }
    if (saved.chrono) T.chrono.ms = saved.chrono;
  }
  const persist = () => E.store.set('movement', {
    at: Date.now(), reserve: T.reserve,
    /* a spin persists as a running watch that still owes its catch-up */
    deficit: T.phase === 'spin' ? Math.round(T.deficit) : (T.phase === 'stop' ? Math.round(T.deficit) : 0),
    phase: T.phase === 'stop' ? 'stop' : 'run', chrono: Math.round(T.chrono.ms),
  });
  setInterval(() => { if (!document.hidden) persist(); }, 10000);
  addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

  /* ---- the display clock ---- */
  const dispMs = () => Date.now() - T.deficit;

  /* per-frame advance — every quantity anchored to Date.now(), so a parked
     loop or a hidden tab settles the books on its first frame back */
  let lastWall = Date.now();
  let lastTicks = Math.floor(dispMs() / BEAT);
  function step() {
    const wallNow = Date.now();
    const gap = Math.max(0, wallNow - lastWall);
    lastWall = wallNow;

    if (T.phase === 'run' || T.phase === 'die') {
      if (T.chrono.on && T.phase === 'run') T.chrono.ms += gap;
      const drained = (gap / 1000) * DRAIN;
      if (T.reserve - drained <= 0) {
        /* she died somewhere in the gap — place the death exactly */
        const ranMs = (T.reserve / DRAIN) * 1000;
        const deathWall = wallNow - gap + ranMs;
        T.reserve = 0;
        if (T.phase === 'run' && gap < 2000) {
          T.phase = 'die'; T.dieT0 = performance.now();
        } else if (T.phase === 'run') {
          enterStop(wallNow - deathWall);
          E.say('The movement has stopped. Hold the crown to wind it.');
          persist();
        }
      } else {
        T.reserve -= drained;
      }
    }
    if (T.phase === 'die') {
      const p = (performance.now() - T.dieT0) / 8000;
      T.amp = Math.max(0, 1 - p);
      if (p >= 1) {
        enterStop(T.deficit);
        E.say('The movement has stopped. Hold the crown to wind it.');
        persist();
      }
    }
    if (T.phase === 'stop') {
      T.deficit = Date.now() - T.stopAtDisp; /* wall-anchored: park-proof */
    }
    if (T.phase === 'spin') {
      const p = E.clamp((performance.now() - T.spinT0) / 2400, 0, 1);
      T.deficit = T.spinFrom * (1 - E.ease(p));
      T.amp = Math.min(1, T.amp + gap / 500);
      if (p >= 1) { T.deficit = 0; T.phase = 'run'; E.say('Wound and running. The hands have caught up with your time.'); persist(); }
    }

    /* DST / timezone change: route the jump through the spin, never a teleport */
    const tzo = new Date().getTimezoneOffset();
    if (tzo !== T._tzo) {
      const shift = (T._tzo - tzo) * 60000;
      T._tzo = tzo;
      if (T.phase === 'run' && Math.abs(shift) > 1000) enterSpin(shift);
    }

    /* tick detection for the sound engine */
    const ticks = Math.floor(dispMs() / BEAT);
    T.justTicked = (T.phase === 'run' || T.phase === 'die') && ticks !== lastTicks;
    lastTicks = ticks;
  }

  /* ---- winding ---- */
  function wind(clicks = 1) {
    const before = T.reserve;
    T.reserve = E.clamp(T.reserve + WIND * clicks, 0, 1);
    if ((T.phase === 'stop' || T.phase === 'die') && T.reserve > 0.06) {
      T.amp = Math.max(T.amp, 0.05);
      enterSpin(T.deficit);
    }
    return T.reserve - before; /* how much actually took (0 at full wind) */
  }

  /* ---- angles (radians) for every rotating part, from the display clock ---- */
  function angles() {
    const ms = dispMs();
    const tick = Math.floor(ms / BEAT);
    const tIn = (ms % BEAT) / BEAT;                 /* 0..1 inside the beat */
    /* stepped advance with a fast settle (the wheel lands, it doesn't glide) */
    const settle = Math.min(1, tIn * 6);
    const stepped = (stepsPerRev) => E.TAU * ((tick % stepsPerRev) + settle * (T.phase !== 'stop' ? 1 : 0)) / stepsPerRev;

    const running = T.phase !== 'stop';
    const d = new Date(ms);
    const secOfDay = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;

    /* balance: sinusoid on the 400ms period, ticks at the zero crossings.
       Reduced motion: the balance holds its pose and the seconds hand steps
       once a second — the movement is composed, not stripped. */
    const rm = E.rm.matches;
    const phase = (ms % (BEAT * 2)) / (BEAT * 2);
    const balance = rm ? 0 : Math.sin(phase * E.TAU) * 2.4 * T.amp; /* ±137° at full amplitude */
    /* pallet fork: square-ish wave with soft corners, ±10° */
    const fork = rm ? 0 : Math.tanh(Math.sin(phase * E.TAU) * 6) * 0.17 * (T.amp > 0.05 ? 1 : 0);

    return {
      balance, fork,
      /* escape turns AGAINST the fourth wheel — meshed metal, opposite spins */
      escape: -(running ? stepped(30) : E.TAU * (lastTicks % 30) / 30),
      third:  -E.TAU * ((secOfDay % 450) / 450),
      center: E.TAU * ((secOfDay % 3600) / 3600),           /* minute */
      hour:   E.TAU * ((secOfDay % 43200) / 43200),
      barrel: -E.TAU * ((secOfDay % 21600) / 21600),        /* 1 rev / 6h */
      /* the disc turns half a revolution per synodic month; the quarter-turn
         offset centers a moon in the aperture at FULL moon (age = half month) */
      moon:   E.TAU * (((ms / 86400000 - NEWMOON) / SYNODIC) % 1) / 2 + Math.PI / 2,
      chronoSec: E.TAU * ((T.chrono.ms % 60000) / 60000),
      chronoMin: E.TAU * ((T.chrono.ms % 1800000) / 1800000),
      reserve: T.reserve,
      seconds: rm ? E.TAU * Math.floor(secOfDay % 60) / 60 : stepped(300), /* rm: 1 step/s */
      secOfDay,
    };
  }

  /* the repeater reads the display clock the way the racks would */
  function repeaterCount() {
    const d = new Date(dispMs());
    let h = d.getHours() % 12; if (h === 0) h = 12;
    const q = Math.floor(d.getMinutes() / 15);
    const m = d.getMinutes() % 15;
    return { hours: h, quarters: q, minutes: m };
  }

  function timeLabel() {
    const d = new Date(dispMs());
    const h = d.getHours(), m = d.getMinutes();
    const h12 = (h % 12) || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  return { T, step, wind, angles, repeaterCount, dispMs, timeLabel, persist, BEAT };
})();
