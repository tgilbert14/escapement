/* THE ESCAPEMENT — render. One loop: advance the movement, lerp the camera,
   composite baked sprites, draw the living parts (balance, hairspring, fork,
   hands) as vectors so they stay crisp at any zoom.

   The plan view lifts the movement into its layers: every draw group takes a
   lift index; E.plan.p fans them apart.

   After dark the order matters: the night multiply lays its blue weight over
   the metal FIRST, then the lume is painted with 'lighter' so it actually
   glows out of the darkness instead of drowning in it. */
E.fx = {
  hammerA: 0, hammerB: 0,      /* repeater hammers, 0..1 strike pose (sound sets, render decays) */
  ratchetSpin: 0,              /* radians/s of ratchet wheel from winding */
};
E.plan = { p: 0, on: false };  /* exploded factor */

E.render = (() => {
  const F = () => E.forge.sprites;
  const L = () => E.forge.L;
  const TAU = E.TAU;

  const LIFT_GAP = 148;        /* world units between exploded layers */
  const LAYERS = ['MAINPLATE', 'BARREL & MOONWORK', 'GOING TRAIN', 'GONGWORK', 'BRIDGEWORK', 'ESCAPEMENT', 'DIALWORK', 'HANDS'];

  function drawSprite(ctx, spr, wx, wy, rot, lift) {
    const s = E.baseScale * E.cam.z;
    const [sx, sy] = E.w2s(wx, wy - lift);
    const d = spr.r * 2 * s;
    ctx.save();
    ctx.translate(sx, sy);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(spr.c, -d / 2, -d / 2, d, d);
    ctx.restore();
  }

  /* live hairspring: a breathing Archimedean spiral in blued steel.
     The collet end swings with the balance; the outer terminal stays pinned
     at the stud — the rotation decays to zero along the spiral's length. */
  function drawHairspring(ctx, wx, wy, balanceA, lift) {
    const s = E.baseScale * E.cam.z;
    const [sx, sy] = E.w2s(wx, wy - lift);
    ctx.save();
    ctx.translate(sx, sy);
    const breathe = 1 + Math.sin(balanceA) * 0.05;
    ctx.strokeStyle = 'rgba(127,160,239,.75)';
    ctx.lineWidth = Math.max(.7, 1.15 * s);
    ctx.beginPath();
    const turns = 6.5, r0 = 15, r1 = 46 * breathe;
    for (let t = 0; t <= 1; t += 1 / 140) {
      const a = t * turns * TAU + balanceA * 0.28 * (1 - t);
      const r = (r0 + (r1 - r0) * t) * s;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    /* the stud: where the outer terminal is pinned to the cock */
    const aEnd = (turns * TAU) % TAU;
    ctx.fillStyle = '#8b93a0';
    ctx.beginPath(); ctx.arc(Math.cos(aEnd) * 46 * s, Math.sin(aEnd) * 46 * s, Math.max(1.5, 3 * s), 0, TAU); ctx.fill();
    ctx.restore();
  }

  function handPath(ctx, s, len, tail, w) {
    ctx.beginPath();
    ctx.moveTo(-w * .55 * s, 0);
    ctx.lineTo(-w * .16 * s, -len * .72 * s);
    ctx.lineTo(0, -len * s);
    ctx.lineTo(w * .16 * s, -len * .72 * s);
    ctx.lineTo(w * .55 * s, 0);
    ctx.lineTo(w * .3 * s, tail * s);
    ctx.lineTo(-w * .3 * s, tail * s);
    ctx.closePath();
  }

  function hand(ctx, wx, wy, angle, len, tail, w, color, lift) {
    const s = E.baseScale * E.cam.z;
    const [sx, sy] = E.w2s(wx, wy - lift);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    /* cheap drop shadow: the same silhouette, offset, no blur raster cost */
    ctx.save();
    ctx.translate(0, 3 * s);
    handPath(ctx, s, len, tail, w);
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.fill();
    ctx.restore();
    handPath(ctx, s, len, tail, w);
    ctx.fillStyle = color;
    ctx.fill();
    /* boss */
    ctx.fillStyle = '#22252b';
    ctx.beginPath(); ctx.arc(0, 0, Math.max(2.5, w * .5 * s), 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* the lume pass: painted AFTER the night multiply, additive, so it glows */
  function lumePass(ctx, A, nf, lift) {
    const glow = nf * 0.9;
    if (glow < 0.03) return;
    const s = E.baseScale * E.cam.z;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const stroke = (wx, wy, angle, from, to, width, alpha) => {
      const [sx, sy] = E.w2s(wx, wy - lift);
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(angle);
      ctx.strokeStyle = `rgba(185,230,200,${alpha})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -from * s); ctx.lineTo(0, -to * s); ctx.stroke();
      ctx.restore();
    };
    /* halo then core, minute + hour */
    stroke(0, 0, A.center, 384 * .3, 384 * .92, Math.max(3, 5.2 * s), .12 * glow);
    stroke(0, 0, A.center, 384 * .3, 384 * .92, Math.max(1, 1.6 * s), .8 * glow);
    stroke(L().hourP[0], L().hourP[1], A.hour, 66 * .28, 66 * .9, Math.max(3, 4.6 * s), .12 * glow);
    stroke(L().hourP[0], L().hourP[1], A.hour, 66 * .28, 66 * .9, Math.max(1, 1.5 * s), .8 * glow);
    /* twelve pips on the chapter ring */
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU - Math.PI / 2;
      const [sx, sy] = E.w2s(Math.cos(a) * 390, Math.sin(a) * 390 - lift);
      ctx.fillStyle = `rgba(185,230,200,${.5 * glow})`;
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(1.4, 2.6 * s), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawHammers(ctx, lift) {
    const s = E.baseScale * E.cam.z;
    const P = L().hammerP;
    for (const [which, dy, pose] of [['A', -26, E.fx.hammerA], ['B', 26, E.fx.hammerB]]) {
      const [sx, sy] = E.w2s(P[0], P[1] + dy - lift);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.5 + pose * 0.55); /* cocked back, snaps toward the gong */
      ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-34 * s, -20 * s); ctx.stroke();
      ctx.fillStyle = which === 'A' ? '#cfd6df' : '#c8a05a';
      ctx.beginPath(); ctx.arc(-40 * s, -24 * s, 10 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#31343b';
      ctx.beginPath(); ctx.arc(0, 0, 6 * s, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function nightFactor() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    if (h >= 8 && h <= 18) return 0;
    if (h > 18 && h < 22) return (h - 18) / 4;
    if (h >= 22 || h < 5) return 1;
    return 1 - (h - 5) / 3; /* 5..8 dawn */
  }

  let quiet = 0;

  function loop(dt) {
    const cv = E.cv, ctx = E.cx;
    if (!E.view.w) { E.resize(); if (!E.view.w) return; } /* boot raced layout: keep trying */

    E.time.step();
    const T = E.time.T;

    /* camera easing */
    const c = E.cam;
    c.x = E.lerp(c.x, c.tx, .12); c.y = E.lerp(c.y, c.ty, .12);
    c.z = E.lerp(c.z, c.tz, .14);
    const camMoving = Math.abs(c.z - c.tz) > .002 || Math.abs(c.x - c.tx) > .4 || Math.abs(c.y - c.ty) > .4;
    if (!camMoving) E.forge.maybeRetier();

    /* plan fan */
    E.plan.p = E.lerp(E.plan.p, E.plan.on ? 1 : 0, .1);
    const planMoving = Math.abs(E.plan.p - (E.plan.on ? 1 : 0)) > .004;

    /* FX decays */
    E.fx.hammerA = Math.max(0, E.fx.hammerA - dt / 90);
    E.fx.hammerB = Math.max(0, E.fx.hammerB - dt / 90);

    /* park the frame loop when nothing can move (stopped + settled + idle) */
    if (T.phase === 'stop' && !camMoving && !planMoving &&
        E.fx.hammerA === 0 && E.fx.hammerB === 0 && E.fx.ratchetSpin < 0.02) {
      if (quiet++ > 4) { E.render.parked = true; return false; } /* leave the ticker; wake() rejoins */
    } else quiet = 0;

    const A = E.time.angles();
    const P = E.plan.p;
    const lift = (i) => P * LIFT_GAP * i;
    const nf = nightFactor();

    ctx.clearRect(0, 0, cv.width, cv.height);

    /* ---- 0 mainplate ---- */
    drawSprite(ctx, F().plate, 0, 0, 0, lift(0));

    /* ---- 1 barrel + moon ---- */
    const BP = L().barrelP;
    drawSprite(ctx, F().barrel, BP[0], BP[1], A.barrel, lift(1));
    drawSprite(ctx, F().moon, BP[0], BP[1], A.moon, lift(1));
    drawSprite(ctx, F().cover, BP[0], BP[1], 0, lift(1));
    E.fx.ratchetSpin *= .92;
    E.fx._ratchetA = (E.fx._ratchetA || 0) + E.fx.ratchetSpin * dt / 400 + (T.phase !== 'stop' ? dt / 90000 : 0);

    /* ---- 2 going train ---- */
    drawSprite(ctx, F().hourW, L().hourP[0], L().hourP[1], A.hour, lift(2));
    drawSprite(ctx, F().centerW, 0, 0, A.center, lift(2));
    drawSprite(ctx, F().thirdW, L().thirdP[0], L().thirdP[1], A.third, lift(2));
    drawSprite(ctx, F().fourthW, L().fourthP[0], L().fourthP[1], A.seconds, lift(2));
    drawSprite(ctx, F().escapeW, L().escapeP[0], L().escapeP[1], A.escape, lift(2));

    /* ---- 3 gongs + hammers ---- */
    drawSprite(ctx, F().gongs, 0, 0, 0, lift(3));
    drawHammers(ctx, lift(3));

    /* ---- 4 bridges (the ratchet rides the barrel strap) ---- */
    drawSprite(ctx, F().bridges, 0, 0, 0, lift(4));
    drawSprite(ctx, F().ratchet, BP[0], BP[1], E.fx._ratchetA, lift(4));

    /* ---- 5 escapement: fork + balance + hairspring + cock ---- */
    const FP = L().forkP, EP = L().escapeP, BAL = L().balanceP;
    const forkBase = Math.atan2(EP[1] - FP[1], EP[0] - FP[0]) - Math.PI / 2;
    drawSprite(ctx, F().fork, FP[0], FP[1], forkBase + A.fork, lift(5));
    drawSprite(ctx, F().balance, BAL[0], BAL[1], A.balance, lift(5));
    drawHairspring(ctx, BAL[0], BAL[1], A.balance, lift(5));
    drawSprite(ctx, F().cock, BAL[0], BAL[1], 0, lift(5));

    /* ---- 6 dial furniture + reserve pointer ---- */
    drawSprite(ctx, F().furniture, 0, 0, 0, lift(6));
    {
      const { r, a0, a1 } = L().reserveArc;
      const a = a0 + (a1 - a0) * A.reserve;
      const s = E.baseScale * E.cam.z;
      const [sx, sy] = E.w2s(Math.cos(a) * (r - 20), Math.sin(a) * (r - 20) - lift(6));
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(a);
      ctx.fillStyle = '#7fa0ef';
      ctx.beginPath();
      ctx.moveTo(14 * s, 0); ctx.lineTo(-8 * s, -6 * s); ctx.lineTo(-8 * s, 6 * s);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    /* ---- 7 hands ---- */
    hand(ctx, L().hourP[0], L().hourP[1], A.hour, 66, 16, 10, '#3e5fb8', lift(7));
    hand(ctx, L().fourthP[0], L().fourthP[1], A.seconds, 64, 20, 6, '#3e5fb8', lift(7));
    hand(ctx, L().chronoP[0], L().chronoP[1], A.chronoMin, 46, 12, 6, '#9aa3ad', lift(7));
    /* chrono center seconds — only when it has ever run */
    if (T.chrono.ms > 0 || T.chrono.on) {
      hand(ctx, 0, 0, A.chronoSec, 386, 60, 7, '#c9ced6', lift(7));
    }
    hand(ctx, 0, 0, A.center, 384, 66, 13, '#3e5fb8', lift(7));

    /* ---- plan labels (CSS-pixel sized, backed, so they read on any screen) ---- */
    if (P > 0.03) {
      ctx.save();
      ctx.globalAlpha = P;
      const px = E.view.px;
      const fs = Math.max(11, 12 * E.baseScale * E.cam.z * 2 / px) * px;
      ctx.font = `${fs}px Georgia, serif`;
      ctx.textAlign = 'left';
      for (let i = 0; i < LAYERS.length; i++) {
        const [sx, sy] = E.w2s(L().plateR * 0.78, -lift(i));
        const wtext = ctx.measureText(LAYERS[i]).width;
        ctx.fillStyle = 'rgba(11,12,14,.62)';
        ctx.fillRect(sx + 16, sy - fs * .72, wtext + 10, fs * 1.5);
        ctx.strokeStyle = 'rgba(232,226,212,.28)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx - 30, sy); ctx.lineTo(sx + 14, sy); ctx.stroke();
        ctx.fillStyle = 'rgba(232,226,212,.78)';
        ctx.fillText(LAYERS[i], sx + 20, sy + fs * .32);
      }
      ctx.restore();
    }

    /* ---- night: the room dims, then the lume answers ---- */
    if (nf > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(70,86,130,${0.22 * nf})`;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.restore();
      lumePass(ctx, A, nf, lift(7));
    }

    /* vignette (cached per canvas size) */
    if (!E._vg || E._vgW !== cv.width) {
      E._vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * .32, cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * .52);
      E._vg.addColorStop(0, 'rgba(0,0,0,0)');
      E._vg.addColorStop(1, 'rgba(0,0,0,.5)');
      E._vgW = cv.width;
    }
    ctx.fillStyle = E._vg;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }

  function wake() {
    quiet = 0;
    if (E.render.parked) { E.render.parked = false; E.ticker.add(loop); }
    E.ticker.kick();
  }

  function boot() {
    E.resize();                                /* resize rebakes if already baked */
    if (!E.forge.sprites) E.forge.bake(1);     /* exactly one boot bake */
    E.ticker.add(loop);
  }

  return { boot, wake, nightFactor, frame: loop };
})();
