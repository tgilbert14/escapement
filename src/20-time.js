/* THE ESCAPEMENT — time. The movement keeps the visitor's REAL local time
   through a real gear train:

     barrel ─ center wheel (1 rev/h) ─ third (×7.5) ─ fourth (1 rev/min)
                                                        └─ escape (×10, 15 teeth)
                                                             └─ pallet ─ balance

   18,000 A/H: the balance beats 5 times a second (period 400ms). Stepped
   wheels advance on the 200ms tick grid; the minute and hour creep
   continuously, exactly like the metal would.

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
    dieT0: 0,            /* when dying started */
    spinT0: 0, spinFrom: 0,
    amp: 1,              /* balance amplitude factor 0..1 */
    chrono: { on: false, ms: 0 },
    justTicked: false,
  };

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
    T.deficit = deficit;
    T.phase = T.reserve <= 0.001 ? 'stop' : 'run';
    T.amp = T.phase === 'run' ? 1 : 0;
    if (saved.chrono) T.chrono.ms = saved.chrono;
  }
  const persist = () => E.store.set('movement', {
    at: Date.now(), reserve: T.reserve, deficit: Math.round(T.deficit),
    phase: T.phase === 'stop' ? 'stop' : 'run', chrono: Math.round(T.chrono.ms),
  });
  setInterval(persist, 10000);
  addEventListener('pagehide', persist);

  /* ---- the display clock ---- */
  const dispMs = () => Date.now() - T.deficit;

  /* per-frame advance (called from the render loop) */
  let lastTicks = Math.floor(dispMs() / BEAT);
  function step(dt) {
    const dts = dt / 1000;
    if (T.phase === 'run' || T.phase === 'die' || T.phase === 'spin') {
      if (T.phase !== 'spin') T.reserve = Math.max(0, T.reserve - dts * DRAIN);
      if (T.chrono.on && T.phase === 'run') T.chrono.ms += dt;
    }
    if (T.phase === 'run' && T.reserve <= 0) { T.phase = 'die'; T.dieT0 = performance.now(); }
    if (T.phase === 'die') {
      const p = (performance.now() - T.dieT0) / 8000;
      T.amp = Math.max(0, 1 - p);
      if (p >= 1) { T.phase = 'stop'; T.amp = 0; E.say('The movement has stopped. Hold the crown to wind it.'); persist(); }
    }
    if (T.phase === 'stop') { T.deficit += dt; }
    if (T.phase === 'spin') {
      const p = E.clamp((performance.now() - T.spinT0) / 2400, 0, 1);
      T.deficit = T.spinFrom * (1 - E.ease(p));
      T.amp = Math.min(1, T.amp + dts * 2);
      if (p >= 1) { T.deficit = 0; T.phase = 'run'; E.say('Wound and running. The hands have caught up with your time.'); persist(); }
    }
    /* tick detection for the sound engine + escape-wheel settle */
    const ticks = Math.floor(dispMs() / BEAT);
    T.justTicked = (T.phase === 'run' || T.phase === 'die') && ticks !== lastTicks;
    lastTicks = ticks;
  }

  /* ---- winding ---- */
  function wind(clicks = 1) {
    const before = T.reserve;
    T.reserve = E.clamp(T.reserve + WIND * clicks, 0, 1);
    if ((T.phase === 'stop' || T.phase === 'die') && T.reserve > 0.06) {
      /* she wakes: wrap the deficit to the 12h dial, then spin home */
      T.spinFrom = T.deficit % 43200000;
      T.spinT0 = performance.now();
      T.phase = 'spin';
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
    const stepped = (stepsPerRev) => E.TAU * ((tick % stepsPerRev) + settle * ((T.phase === 'run' || T.phase === 'die' || T.phase === 'spin') ? 1 : 0)) / stepsPerRev;

    const s = ms / 1000;
    const running = T.phase !== 'stop';
    const d = new Date(ms);
    const secOfDay = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;

    /* balance: sinusoid on the 400ms period, ticks at the zero crossings */
    const phase = (ms % (BEAT * 2)) / (BEAT * 2);
    const balance = Math.sin(phase * E.TAU) * 2.4 * T.amp; /* ±137° at full amplitude */
    /* pallet fork: square-ish wave with soft corners, ±10° */
    const fork = Math.tanh(Math.sin(phase * E.TAU) * 6) * 0.17 * (T.amp > 0.05 ? 1 : 0);

    return {
      balance, fork,
      escape: running ? stepped(30) : E.TAU * (lastTicks % 30) / 30,
      fourth: E.TAU * ((secOfDay % 60) / 60),               /* seconds hand wheel */
      third:  -E.TAU * ((secOfDay % 450) / 450),
      center: E.TAU * ((secOfDay % 3600) / 3600),           /* minute */
      hour:   E.TAU * ((secOfDay % 43200) / 43200),
      barrel: -E.TAU * ((secOfDay % 21600) / 21600),        /* 1 rev / 6h */
      moon:   E.TAU * (((ms / 86400000 - NEWMOON) / SYNODIC) % 1) / 2, /* half turn per month (two moons on the disc) */
      chronoSec: E.TAU * ((T.chrono.ms % 60000) / 60000),
      chronoMin: E.TAU * ((T.chrono.ms % 1800000) / 1800000),
      reserve: T.reserve,
      seconds: stepped(300),                                 /* 5 steps/s over 60s — small-seconds hand */
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
