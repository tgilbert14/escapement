/* THE ESCAPEMENT — sound. Zero audio files; everything is struck metal math.

   THE LAW: no sound before an activation-bearing gesture. The chip never
   claims ON until ctx.state === 'running'. An explicit opt-out is remembered.
   Hidden tabs are silent — including ticks already queued inside the
   lookahead horizon, which are muted through a dedicated tick bus.
   The tick is scheduled on the AUDIO clock against the movement's 200ms
   grid, so what you hear is what the balance does. */
E.sound = (() => {
  let ctx = null, master = null, comp = null, tickBus = null;
  let enabled = E.store.get('sound', true);   /* intent; hardware may still be off */
  let repeaterEndsAt = 0;                     /* audio-clock time the chime owns */
  let lastHourStruck = -1, pendingHour = null;
  let schedTimer = null, lastScheduledTick = 0;
  const chip = document.getElementById('sound-toggle');

  function build() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
    tickBus = ctx.createGain();
    tickBus.gain.value = 1;
    tickBus.connect(master);
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) {
        tickBus.gain.value = 0;              /* silence anything queued in the horizon */
        ctx.suspend();
      } else if (enabled) {
        ctx.resume().then(() => { setTimeout(() => { if (tickBus) tickBus.gain.value = 1; }, 420); reflect(); }).catch(reflect);
      }
    });
    ctx.onstatechange = reflect;
    /* the scheduler exists only once there is a context to schedule on */
    schedTimer = setInterval(() => { if (!document.hidden) scheduler(); }, 150);
  }

  function reflect() {
    const on = !!(ctx && ctx.state === 'running' && enabled);
    if (chip) chip.setAttribute('aria-pressed', String(on));
  }

  /* first qualifying gesture arms the context (if the visitor hasn't opted out) */
  function arm() {
    if (!enabled) return;
    build();
    if (ctx.state !== 'running') ctx.resume().then(reflect).catch(reflect);
    else reflect();
  }

  function toggle() {
    enabled = !enabled;
    E.store.set('sound', enabled);
    if (enabled) { build(); ctx.resume().then(reflect).catch(reflect); E.say('Sound on.'); }
    else { if (ctx) ctx.suspend(); reflect(); E.say('Sound off.'); }
  }
  if (chip) chip.addEventListener('click', toggle);

  const now = () => ctx.currentTime;
  const audible = () => ctx && ctx.state === 'running' && enabled;
  const chimeBusy = () => !!(ctx && now() < repeaterEndsAt);

  /* ---- voices ---- */

  /* the tick: a tiny damped metal contact — two different colors for tick/tock */
  function tickVoice(when, isTock, vel) {
    const o = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = 'square';
    o.frequency.value = isTock ? 3400 : 4300;
    bp.type = 'bandpass';
    bp.frequency.value = isTock ? 3100 : 4100;
    bp.Q.value = 9;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.06 * vel, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.028);
    o.connect(bp).connect(g);
    if (pan) { pan.pan.value = -0.25; g.connect(pan).connect(tickBus); }
    else g.connect(tickBus);
    o.start(when); o.stop(when + 0.05);
  }

  /* a struck gong: inharmonic partial stack with a bright strike transient */
  function gong(f0, when, vel = 1) {
    const partials = [[1, 1], [2.71, .42], [4.95, .2], [7.4, .09], [1.51, .18]];
    for (const [ratio, amp] of partials) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f0 * ratio * (1 + (Math.random() - .5) * 0.0015);
      const peak = 0.22 * amp * vel;
      const decay = 3.2 / Math.sqrt(ratio);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(peak, when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
      o.connect(g).connect(master);
      o.start(when); o.stop(when + decay + 0.1);
    }
    /* strike */
    const len = ctx.sampleRate * 0.02;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = ctx.createBufferSource(); n.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f0 * 4; bp.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0.12 * vel;
    n.connect(bp).connect(g).connect(master);
    n.start(when);
  }

  /* winding ratchet: one dry click per crown detent */
  function ratchet() {
    if (!audible()) return;
    const when = now();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 1500 + Math.random() * 300;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.11, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
    o.connect(g).connect(master);
    o.start(when); o.stop(when + 0.06);
    const len = ctx.sampleRate * 0.012;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = ctx.createBufferSource(); n.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
    const ng = ctx.createGain(); ng.gain.value = 0.08;
    n.connect(hp).connect(ng).connect(master);
    n.start(when);
  }

  /* pusher: a soft mechanical clunk */
  function pusher() {
    if (!audible()) return;
    const when = now();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(300, when);
    o.frequency.exponentialRampToValueAtTime(120, when + 0.05);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.16, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    o.connect(g).connect(master);
    o.start(when); o.stop(when + 0.1);
  }

  /* the catch-up whir: hands spinning home (fired ONCE per spin, by interact) */
  function whir(durMs) {
    if (!audible()) return;
    const when = now(), dur = durMs / 1000;
    const len = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 6;
    bp.frequency.setValueAtTime(900, when);
    bp.frequency.exponentialRampToValueAtTime(2600, when + dur * .6);
    bp.frequency.exponentialRampToValueAtTime(700, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.07, when + 0.08);
    g.gain.setValueAtTime(0.07, when + dur * .8);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    n.connect(bp).connect(g).connect(master);
    n.start(when); n.stop(when + dur + .05);
  }

  /* ---- the repeater: reads the display clock, strikes it out ---- */
  function strikeSequence() {
    const { hours, quarters, minutes } = E.time.repeaterCount();
    const LOW = 659, HIGH = 831;
    let t = now() + 0.25;
    const hammer = (which, when) => {
      setTimeout(() => { E.fx['hammer' + which] = 1; E.render.wake(); }, Math.max(0, (when - now()) * 1000 - 40));
    };
    for (let i = 0; i < hours; i++) { gong(LOW, t, 1); hammer('B', t); t += 0.75; }
    if (quarters) t += 0.25;
    for (let i = 0; i < quarters; i++) {
      gong(HIGH, t, .95); hammer('A', t);
      gong(LOW, t + 0.28, .95); hammer('B', t + 0.28);
      t += 0.82;
    }
    if (minutes) t += 0.2;
    for (let i = 0; i < minutes; i++) { gong(HIGH, t, .8); hammer('A', t); t += 0.42; }
    repeaterEndsAt = t + 2.2; /* audio-clock ownership: suspend extends it correctly */
    E.say(`Repeater: ${hours} ${hours === 1 ? 'hour' : 'hours'}, ${quarters} ${quarters === 1 ? 'quarter' : 'quarters'}, ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} — ${E.time.timeLabel()}.`);
  }

  function repeater() {
    if (chimeBusy()) return;
    if (!enabled) { E.say('Sound is off — the repeater is silent. ' + E.time.timeLabel()); return; }
    build();
    if (ctx.state === 'running') { strikeSequence(); return; }
    /* the first-ever gesture may BE the repeater: wait for the async unlock */
    ctx.resume().then(() => {
      reflect();
      if (audible()) strikeSequence();
      else E.say('Sound is not available — ' + E.time.timeLabel());
    }).catch(() => E.say('Sound is not available — ' + E.time.timeLabel()));
  }

  /* ---- the tick scheduler: audio-clock lookahead against the 200ms grid ---- */
  function scheduler() {
    if (!audible()) return;
    const T = E.time.T;
    if (T.phase !== 'run' && T.phase !== 'die') return;
    const BEAT = E.time.BEAT;
    const wallNow = Date.now();
    const dispNow = E.time.dispMs();
    const horizon = 340; /* ms of lookahead */
    let tick = Math.max(lastScheduledTick + 1, Math.ceil(dispNow / BEAT));
    while (tick * BEAT < dispNow + horizon) {
      const wallAt = tick * BEAT + (wallNow - dispNow); /* display grid -> wall clock */
      const at = now() + Math.max(0.01, (wallAt - Date.now()) / 1000);
      const vel = T.phase === 'die' ? Math.max(.15, T.amp) : 1;
      tickVoice(at, tick % 2 === 0, vel);
      lastScheduledTick = tick;
      tick++;
    }
    /* the passing hour: due at :00, struck the moment the chime lane is clear */
    const d = new Date(dispNow);
    if (d.getMinutes() === 0 && d.getHours() !== lastHourStruck) pendingHour = d.getHours();
    if (d.getMinutes() > 1) pendingHour = null;               /* missed its moment gracefully */
    if (pendingHour !== null && !chimeBusy()) {
      lastHourStruck = pendingHour;
      pendingHour = null;
      gong(659, now() + 0.05, .8);
    }
  }

  return { arm, toggle, ratchet, pusher, whir, repeater, reflect, get enabled() { return enabled; } };
})();
