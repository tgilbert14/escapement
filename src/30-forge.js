/* THE ESCAPEMENT — forge. Bakes every piece of metal once (per zoom tier),
   so the frame loop only transforms sprites. All positions are SOLVED from
   real mesh constraints: two wheels touch where pitch circles are tangent.

   Layers, bottom to top: plate → barrel+moon → train wheels → gongs →
   fork → bridges → balance → cock → dial furniture → hands (live). */
E.forge = (() => {
  const TAU = E.TAU;

  /* ---------- the layout (world units, plate radius 480) ---------- */
  const L = {};
  L.plateR = 480;
  /* wheel radii: wheel = toothed pitch radius, pinion = its arbor pinion */
  L.barrel = { r: 150, pinion: 0 };
  L.center = { r: 140, pinion: 38 };
  L.third  = { r: 105, pinion: 26 };
  L.fourth = { r: 90,  pinion: 24 };
  L.escape = { r: 52,  pinion: 20 };
  L.balanceR = 125;

  /* positions: center wheel at origin; fourth fixed at 6 o'clock;
     third solved from tangency to both; barrel + escape placed on tangent circles */
  L.centerP = [0, 0];
  L.fourthP = [0, 240];
  {
    const d1 = L.center.r + L.third.pinion;       /* |C→third| */
    const d2 = L.third.r + L.fourth.pinion;       /* |third→fourth| */
    const D = 240;
    const y = (d1 * d1 - d2 * d2 + D * D) / (2 * D);
    const x = Math.sqrt(Math.max(0, d1 * d1 - y * y));
    L.thirdP = [x, y];                            /* right of the line, arcing east */
  }
  {
    const a = 233 * Math.PI / 180;                /* barrel at 10:30 */
    const d = L.barrel.r + L.center.pinion;
    L.barrelP = [Math.cos(a) * d, Math.sin(a) * d];
  }
  {
    const a = 205 * Math.PI / 180;                /* escape swings down-left off fourth */
    const d = L.fourth.r + L.escape.pinion;
    L.escapeP = [L.fourthP[0] + Math.cos(a) * d, L.fourthP[1] + Math.sin(a) * d];
  }
  {
    const a = 187 * Math.PI / 180;                /* fork reaches on toward the balance */
    L.forkP    = [L.escapeP[0] + Math.cos(a) * 75,  L.escapeP[1] + Math.sin(a) * 75];
    L.balanceP = [L.forkP[0] + Math.cos(a) * 100,   L.forkP[1] + Math.sin(a) * 100];
  }
  L.hourP   = [0, -228];    /* regulator hour ring, floating dial furniture */
  L.chronoP = [252, -6];    /* 30-minute counter */
  L.moonP   = L.barrelP;    /* moon lives in the barrel cover aperture */
  L.reserveArc = { r: 434, a0: 155 * Math.PI / 180, a1: 205 * Math.PI / 180 }; /* west rim */
  L.hammerP = [-386, 118];  /* repeater hammers, west rim inside the gongs */

  /* ---------- tiny paint helpers ---------- */
  const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rnd = E.mulberry(20260716);

  function metal(ctx, r, base, hi, lo) {
    const g = ctx.createRadialGradient(-r * .4, -r * .5, r * .1, 0, 0, r * 1.25);
    g.addColorStop(0, hi); g.addColorStop(.45, base); g.addColorStop(1, lo);
    return g;
  }

  /* Geneva stripes: parallel light bands, clipped by the caller */
  function stripes(ctx, w, h, step, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.rotate(-0.42);
    for (let x = -w; x < w; x += step) {
      const g = ctx.createLinearGradient(x, 0, x + step, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(.5, 'rgba(255,255,255,.13)');
      g.addColorStop(.62, 'rgba(0,0,0,.14)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, -h, step, h * 2);
    }
    ctx.restore();
  }

  /* perlage: overlapping brushed circles on the mainplate */
  function perlage(ctx, R, step, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let y = -R; y < R; y += step * .82) {
      for (let x = -R; x < R; x += step) {
        const ox = x + ((Math.round(y / (step * .82)) % 2) ? step / 2 : 0) + (rnd() - .5) * 2;
        if (ox * ox + y * y > R * R) continue;
        const g = ctx.createRadialGradient(ox - step * .18, y - step * .18, 0, ox, y, step * .62);
        g.addColorStop(0, 'rgba(255,255,255,.05)');
        g.addColorStop(.8, 'rgba(255,255,255,.012)');
        g.addColorStop(1, 'rgba(0,0,0,.03)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ox, y, step * .62, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function screw(ctx, x, y, r, slotA) {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createRadialGradient(-r * .3, -r * .4, 0, 0, 0, r);
    g.addColorStop(0, '#8fa6e8'); g.addColorStop(.55, '#3e5fb8'); g.addColorStop(1, '#1c2c60');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = r * .16; ctx.stroke();
    ctx.rotate(slotA);
    ctx.strokeStyle = 'rgba(8,10,20,.9)'; ctx.lineWidth = r * .3;
    ctx.beginPath(); ctx.moveTo(-r * .78, 0); ctx.lineTo(r * .78, 0); ctx.stroke();
    ctx.restore();
  }

  function jewel(ctx, x, y, r) {
    ctx.save(); ctx.translate(x, y);
    /* gold chaton */
    ctx.fillStyle = metal(ctx, r * 1.8, '#c8a05a', '#f0d9a2', '#6d5426');
    ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.2; ctx.stroke();
    const g = ctx.createRadialGradient(-r * .35, -r * .4, 0, 0, 0, r);
    g.addColorStop(0, '#ff97a8'); g.addColorStop(.5, '#b0263c'); g.addColorStop(1, '#570e1c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.arc(-r * .3, -r * .35, r * .22, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* a toothed wheel sprite: rim, teeth, face, crescent spoke cutouts, arbor */
  function bakeWheel(spec) {
    const { r, teeth, spokes, style, pinion, px, leaves = 8 } = spec;
    const pad = 6;
    const S = Math.ceil((r + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);

    const toothH = Math.max(5, r * 0.075);
    const rootR = r - toothH * 0.4;

    /* teeth: rounded trapezoids around the rim */
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * TAU;
      const w = (TAU / teeth);
      const t0 = a - w * .26, t1 = a - w * .10, t2 = a + w * .10, t3 = a + w * .26;
      ctx.lineTo(Math.cos(t0) * rootR, Math.sin(t0) * rootR);
      ctx.lineTo(Math.cos(t1) * (r + toothH * .6), Math.sin(t1) * (r + toothH * .6));
      ctx.lineTo(Math.cos(t2) * (r + toothH * .6), Math.sin(t2) * (r + toothH * .6));
      ctx.lineTo(Math.cos(t3) * rootR, Math.sin(t3) * rootR);
    }
    ctx.closePath();
    const brass = style === 'steel'
      ? { base: '#9aa3ad', hi: '#dfe6ee', lo: '#4b5157' }
      : { base: '#c8a05a', hi: '#f0d9a2', lo: '#6d5426' };
    ctx.fillStyle = metal(ctx, r, brass.base, brass.hi, brass.lo);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();

    /* face ring + inner web */
    ctx.beginPath(); ctx.arc(0, 0, rootR * .995, 0, TAU);
    ctx.fillStyle = metal(ctx, rootR, brass.base, brass.hi, brass.lo);
    ctx.fill();

    /* crescent cutouts between spokes (see the plate through the wheel) */
    if (spokes > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const inner = Math.max(pinion + 14, r * .24), outer = rootR * .82;
      for (let i = 0; i < spokes; i++) {
        const a0 = (i / spokes) * TAU + 0.16, a1 = ((i + 1) / spokes) * TAU - 0.16;
        ctx.beginPath();
        ctx.arc(0, 0, outer, a0, a1);
        ctx.arc(0, 0, inner, a1, a0, true);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      /* bevel the spoke edges with a hairline */
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.1;
      for (let i = 0; i < spokes; i++) {
        const a0 = (i / spokes) * TAU + 0.16, a1 = ((i + 1) / spokes) * TAU - 0.16;
        ctx.beginPath(); ctx.arc(0, 0, outer, a0, a1); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, inner, a0, a1); ctx.stroke();
      }
    }

    /* pinion + arbor */
    if (pinion) {
      ctx.fillStyle = metal(ctx, pinion, '#9aa3ad', '#dfe6ee', '#4b5157');
      ctx.beginPath(); ctx.arc(0, 0, pinion, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
      /* pinion leaves */
      ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < leaves; i++) {
        const a = (i / leaves) * TAU;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * pinion * .35, Math.sin(a) * pinion * .35);
        ctx.lineTo(Math.cos(a) * pinion * .95, Math.sin(a) * pinion * .95); ctx.stroke();
      }
    }
    ctx.fillStyle = '#22252b';
    ctx.beginPath(); ctx.arc(0, 0, Math.max(3.4, r * .03), 0, TAU); ctx.fill();
    return { c, r: r + pad, px };
  }

  /* escape wheel: 15 club-shaped teeth, unmistakable at close zoom */
  function bakeEscape(px) {
    const r = L.escape.r, pad = 8;
    const S = Math.ceil((r + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);
    ctx.beginPath();
    const n = 15;
    for (let i = 0; i < n; i++) {
      /* rake mirrored: the wheel now turns clockwise-negative against the fourth */
      const a = (i / n) * TAU;
      const tip = a, heel = a - 0.16, root = a - (TAU / n) * .55;
      ctx.lineTo(Math.cos(root) * (r * .8), Math.sin(root) * (r * .8));
      ctx.lineTo(Math.cos(heel) * (r + 2), Math.sin(heel) * (r + 2));
      ctx.lineTo(Math.cos(tip) * (r + 7), Math.sin(tip) * (r + 7));
    }
    ctx.closePath();
    ctx.fillStyle = metal(ctx, r, '#c9b078', '#f4e3b0', '#6d5426');
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = .9; ctx.stroke();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(0, 0, r * .52, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * .52, 0, TAU); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      ctx.strokeStyle = 'rgba(201,176,120,1)'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .1, Math.sin(a) * r * .1);
      ctx.lineTo(Math.cos(a) * r * .78, Math.sin(a) * r * .78); ctx.stroke();
    }
    ctx.fillStyle = '#22252b';
    ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
    return { c, r: r + pad, px };
  }

  /* balance wheel sprite: two-arm wheel with a polished rim + timing screws */
  function bakeBalance(px) {
    const r = L.balanceR, pad = 10;
    const S = Math.ceil((r + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);
    /* rim */
    ctx.lineWidth = r * .13;
    ctx.strokeStyle = metal(ctx, r, '#c8a05a', '#f0d9a2', '#6d5426');
    ctx.beginPath(); ctx.arc(0, 0, r * .9, 0, TAU); ctx.stroke();
    /* timing screws on the rim */
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + .13;
      const sr = i % 3 === 0 ? r * .052 : r * .038;
      ctx.save();
      ctx.translate(Math.cos(a) * r * .9, Math.sin(a) * r * .9);
      ctx.fillStyle = i % 3 === 0 ? '#e9d6a4' : '#8a6f38';
      ctx.beginPath(); ctx.arc(0, 0, sr, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    /* two crossing arms */
    ctx.lineWidth = r * .085; ctx.lineCap = 'round';
    ctx.strokeStyle = metal(ctx, r, '#b6924e', '#e3c887', '#5d4720');
    ctx.beginPath(); ctx.moveTo(-r * .86, 0); ctx.lineTo(r * .86, 0); ctx.stroke();
    /* roller + staff */
    ctx.fillStyle = metal(ctx, 14, '#9aa3ad', '#dfe6ee', '#4b5157');
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
    /* impulse jewel on the roller (drives the fork horns) */
    ctx.fillStyle = '#d84a60';
    ctx.beginPath(); ctx.arc(0, -17, 4.2, 0, TAU); ctx.fill();
    return { c, r: r + pad, px };
  }

  /* pallet fork sprite (drawn pointing +y toward the escape wheel) */
  function bakeFork(px) {
    const len = 78, pad = 26;
    const S = Math.ceil((len + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);
    ctx.strokeStyle = metal(ctx, len, '#9aa3ad', '#dfe6ee', '#4b5157');
    ctx.lineWidth = 9; ctx.lineCap = 'round';
    /* the stem: pivot at origin; horns toward -y (balance); pallets toward +y (escape) */
    ctx.beginPath(); ctx.moveTo(0, -len * .48); ctx.lineTo(0, len * .58); ctx.stroke();
    /* fork horns */
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, -len * .48); ctx.lineTo(-11, -len * .78); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -len * .48); ctx.lineTo(11, -len * .78); ctx.stroke();
    /* pallet arms + ruby pallet stones */
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, len * .58); ctx.lineTo(-30, len * .82); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, len * .58); ctx.lineTo(26, len * .86); ctx.stroke();
    for (const [x, y, a] of [[-33, len * .86, .6], [29, len * .9, -.6]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = '#c23049';
      ctx.fillRect(-3.6, -7, 7.2, 14);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(-3.6, -7, 7.2, 14);
      ctx.restore();
    }
    ctx.fillStyle = '#22252b';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    return { c, r: len + pad, px, pivotShift: 0 };
  }

  /* ---------- the static plates ---------- */
  function engravedArc(ctx, text, cx, cy, r, a0, a1, size, color, flip) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const n = text.length;
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (n === 1 ? .5 : i / (n - 1));
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.rotate(a + (flip ? -1 : 1) * Math.PI / 2);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function bakePlate(px) {
    const R = L.plateR, pad = 40;
    const S = Math.ceil((R + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);

    /* mainplate: dark rhodium, vignetted */
    const g = ctx.createRadialGradient(-R * .3, -R * .4, R * .1, 0, 0, R * 1.05);
    g.addColorStop(0, '#2e3138'); g.addColorStop(.6, '#212429'); g.addColorStop(1, '#141619');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
    perlage(ctx, R, 46, .8);
    ctx.restore();

    /* rim step */
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, R - 9, 0, TAU); ctx.stroke();

    /* minute chapter ring: 60 ticks, applied brass dots each 5 */
    const cr = 402;
    ctx.strokeStyle = 'rgba(232,226,212,.5)';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU - Math.PI / 2;
      const long = i % 5 === 0;
      ctx.lineWidth = long ? 3 : 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (cr - (long ? 16 : 9)), Math.sin(a) * (cr - (long ? 16 : 9)));
      ctx.lineTo(Math.cos(a) * cr, Math.sin(a) * cr);
      ctx.stroke();
    }

    /* engravings */
    engravedArc(ctx, 'DESERT DATA LABS', 0, 0, 422, Math.PI * .5 + .62, Math.PI * .5 - .62, 21, 'rgba(232,226,212,.42)', true);
    engravedArc(ctx, 'CAL. DDL-1 · 18000 A/H · 23 JEWELS', 0, 0, 428, -Math.PI * .5 - .58, -Math.PI * .5 + .58, 16, 'rgba(200,160,90,.62)', false);

    /* power reserve track along the west rim */
    const { r: rr, a0, a1 } = L.reserveArc;
    ctx.strokeStyle = 'rgba(232,226,212,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, rr, a0, a1); ctx.stroke();
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (a1 - a0) * (i / 8);
      ctx.lineWidth = i % 4 === 0 ? 2.6 : 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (rr - 8), Math.sin(a) * (rr - 8));
      ctx.lineTo(Math.cos(a) * (rr + 8), Math.sin(a) * (rr + 8));
      ctx.stroke();
    }
    ctx.font = '13px Georgia, serif'; ctx.fillStyle = 'rgba(232,226,212,.45)';
    ctx.textAlign = 'center';
    ctx.fillText('▲', Math.cos(a1) * (rr - 24), Math.sin(a1) * (rr - 24) + 4);
    ctx.fillText('▽', Math.cos(a0) * (rr - 24), Math.sin(a0) * (rr - 24) + 4);

    return { c, r: R + pad, px };
  }

  /* a soft blob bridge through anchor points, striped + beveled + jeweled */
  function bridgePath(ctx, pts) {
    ctx.beginPath();
    const n = pts.length;
    ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  }

  function bakeBridges(px) {
    const R = L.plateR, pad = 40;
    const S = Math.ceil((R + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);

    const drawBridge = (pts, jewels, screws_) => {
      ctx.save();
      bridgePath(ctx, pts);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#3a3e46';
      ctx.fill();
      ctx.restore();
      bridgePath(ctx, pts);
      const g = ctx.createLinearGradient(-R, -R, R, R);
      g.addColorStop(0, '#4b505a'); g.addColorStop(.5, '#3c4048'); g.addColorStop(1, '#2c2f35');
      ctx.fillStyle = g; ctx.fill();
      ctx.clip();
      stripes(ctx, R * 1.5, R * 1.5, 44, .5);
      ctx.restore();
      /* anglage: polished bevel edge */
      bridgePath(ctx, pts);
      ctx.strokeStyle = 'rgba(240,217,162,.5)'; ctx.lineWidth = 2.6; ctx.stroke();
      bridgePath(ctx, pts);
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 5.6; ctx.save();
      ctx.globalCompositeOperation = 'destination-over'; ctx.stroke(); ctx.restore();
      for (const [x, y, r] of jewels) jewel(ctx, x, y, r);
      for (const [x, y, r] of screws_) screw(ctx, x, y, r, rnd() * TAU);
    };

    const B = L.barrelP, T3 = L.thirdP, F = L.fourthP, ES = L.escapeP;

    /* center bridge: a waisted arm from under the hour ring to the center arbor */
    drawBridge(
      [[-10, -352], [58, -308], [56, -196], [30, -120], [52, -48], [-4, -18], [-56, -60], [-40, -170], [-62, -290]],
      [[0, 0, 8]],
      [[8, -308, 12], [12, -66, 11]]
    );

    /* barrel strap: a slim bar across the barrel's south, seat for the ratchet */
    drawBridge(
      [[B[0] - 118, B[1] + 6], [B[0], B[1] - 26], [B[0] + 118, B[1] + 8], [B[0] + 96, B[1] + 62], [B[0] - 96, B[1] + 60]],
      [[B[0], B[1], 7]],
      [[B[0] - 92, B[1] + 34, 10], [B[0] + 92, B[1] + 36, 10]]
    );

    /* train bridge: a kidney over the third + fourth arbors, nothing more */
    drawBridge(
      [[T3[0] - 34, T3[1] - 34], [T3[0] + 62, T3[1] - 44], [T3[0] + 74, T3[1] + 40], [F[0] + 88, F[1] + 20], [F[0] + 52, F[1] + 88], [F[0] - 34, F[1] + 62], [T3[0] - 58, T3[1] + 42]],
      [[T3[0], T3[1], 6], [F[0], F[1], 6]],
      [[T3[0] + 44, T3[1] - 16, 10], [F[0] + 46, F[1] + 52, 10]]
    );

    /* escape cock: small tapered plate */
    drawBridge(
      [[ES[0] + 66, ES[1] - 60], [ES[0] + 96, ES[1] + 40], [ES[0] - 8, ES[1] + 66], [ES[0] - 40, ES[1] - 20]],
      [[ES[0], ES[1], 5]],
      [[ES[0] + 62, ES[1] + 18, 9]]
    );

    return { c, r: R + pad, px };
  }

  /* balance cock: its own sprite, drawn ABOVE the balance */
  function bakeCock(px) {
    const R = 250, pad = 20;
    const S = Math.ceil((R + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);
    /* authored around origin = balance staff; a slim arm reaching SW to the rim */
    const pts = [[-8, -34], [24, -18], [26, 20], [-6, 34], [-96, 84], [-168, 112], [-182, 74], [-100, 26], [-44, -14]];
    bridgePath(ctx, pts);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 7;
    ctx.fillStyle = '#3d414a'; ctx.fill();
    ctx.restore();
    bridgePath(ctx, pts);
    const g = ctx.createLinearGradient(-160, -40, 40, 60);
    g.addColorStop(0, '#4d525c'); g.addColorStop(1, '#31343b');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); bridgePath(ctx, pts); ctx.clip();
    stripes(ctx, 260, 260, 36, .5);
    ctx.restore();
    bridgePath(ctx, pts);
    ctx.strokeStyle = 'rgba(240,217,162,.5)'; ctx.lineWidth = 2.4; ctx.stroke();
    /* regulator index over the staff */
    ctx.strokeStyle = '#b8bfc9'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(34, -22); ctx.stroke();
    ctx.font = '11px Georgia, serif'; ctx.fillStyle = 'rgba(232,226,212,.55)';
    ctx.fillText('A', 40, -30); ctx.fillText('R', 46, -8);
    jewel(ctx, 0, 0, 6);
    screw(ctx, -150, 100, 12, rnd() * TAU);
    return { c, r: R + pad, px };
  }

  /* barrel assembly: drum sprite (rotates), moon disc (rotates), cover (static) */
  function bakeBarrel(px) {
    const r = L.barrel.r, pad = 8;
    const S = Math.ceil((r + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);
    /* toothed rim */
    const teeth = 96, toothH = 7;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * TAU, w = TAU / teeth;
      ctx.lineTo(Math.cos(a) * (r - toothH), Math.sin(a) * (r - toothH));
      ctx.lineTo(Math.cos(a + w * .3) * r, Math.sin(a + w * .3) * r);
      ctx.lineTo(Math.cos(a + w * .7) * r, Math.sin(a + w * .7) * r);
    }
    ctx.closePath();
    ctx.fillStyle = metal(ctx, r, '#c8a05a', '#f0d9a2', '#6d5426');
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
    return { c, r: r + pad, px };
  }

  function bakeMoonDisc(px) {
    const r = 118, pad = 4; /* sized so the moons ride the SAME radius as the cover aperture */
    const S = Math.ceil((r + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);
    /* midnight-blue disc, gold stars, two moons opposite */
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, r);
    g.addColorStop(0, '#17224e'); g.addColorStop(1, '#0a1030');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    const rr = E.mulberry(7);
    ctx.fillStyle = '#e9d9a8';
    for (let i = 0; i < 26; i++) {
      const a = rr() * TAU, d = 18 + rr() * (r - 26);
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, .9 + rr() * 1.3, 0, TAU); ctx.fill();
    }
    for (const s of [1, -1]) {
      ctx.save(); ctx.translate(0, s * 74);
      const mg = ctx.createRadialGradient(-7, -8, 2, 0, 0, 27);
      mg.addColorStop(0, '#fdf6dd'); mg.addColorStop(1, '#cfb264');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
      /* a quiet face: two craters */
      ctx.fillStyle = 'rgba(140,110,50,.4)';
      ctx.beginPath(); ctx.arc(-7, -3, 3.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 6, 4.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
    return { c, r: r + pad, px };
  }

  function bakeBarrelCover(px) {
    const r = L.barrel.r, pad = 8;
    const S = Math.ceil((r + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);
    const face = r - 9;
    ctx.beginPath(); ctx.arc(0, 0, face, 0, TAU);
    ctx.fillStyle = metal(ctx, face, '#b6924e', '#e3c887', '#5d4720');
    ctx.fill();
    /* sunray brushing */
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, face, 0, TAU); ctx.clip();
    ctx.globalAlpha = .16;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.45)';
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 26, Math.sin(a) * 26);
      ctx.lineTo(Math.cos(a) * face, Math.sin(a) * face); ctx.stroke();
    }
    ctx.restore();
    /* moon aperture: a round window at the exact radius the disc's moons ride */
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(0, -74, 26, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(240,217,162,.7)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, -74, 26, 0, TAU); ctx.stroke();
    /* ratchet wheel at center (spins while winding) is drawn live; leave a seat */
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
    return { c, r: r + pad, px };
  }

  function bakeRatchet(px) {
    const r = 42, pad = 4;
    const S = Math.ceil((r + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);
    const teeth = 24;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * TAU;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + (TAU / teeth) * .55) * (r - 7), Math.sin(a + (TAU / teeth) * .55) * (r - 7));
    }
    ctx.closePath();
    ctx.fillStyle = metal(ctx, r, '#9aa3ad', '#dfe6ee', '#4b5157');
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
    screw(ctx, 0, 0, 12, .7);
    return { c, r: r + pad, px };
  }

  /* dial furniture: floating engraved rings (hour, seconds, chrono) — static */
  function ring(ctx, cx, cy, r, opts) {
    const { numerals, ticks, label } = opts;
    ctx.save(); ctx.translate(cx, cy);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    ctx.strokeStyle = '#d8d2c2'; ctx.lineWidth = Math.max(7, r * .1);
    ctx.globalAlpha = .92;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r + Math.max(3.5, r * .05), 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r - Math.max(3.5, r * .05), 0, TAU); ctx.stroke();
    ctx.fillStyle = '#1a1c20';
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * TAU - Math.PI / 2;
      const w = i % (ticks / Math.min(12, ticks)) === 0 ? 2.4 : 1.1;
      ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a);
      ctx.fillRect(-Math.max(3, r * .045), -w / 2, Math.max(6, r * .09), w);
      ctx.restore();
    }
    if (numerals) {
      ctx.font = `${Math.max(11, r * .21)}px Georgia, serif`;
      ctx.fillStyle = '#e8e2d4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const list = numerals;
      for (let i = 0; i < list.length; i++) {
        const a = (i / list.length) * TAU - Math.PI / 2;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
        ctx.fillText(list[i], Math.cos(a) * r * .74, Math.sin(a) * r * .74);
        ctx.restore();
      }
    }
    if (label) {
      ctx.font = `${Math.max(9, r * .13)}px Georgia, serif`;
      ctx.fillStyle = 'rgba(232,226,212,.55)';
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, r * .42);
    }
    ctx.restore();
  }

  function bakeFurniture(px) {
    const R = L.plateR, pad = 40;
    const S = Math.ceil((R + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);
    ring(ctx, L.hourP[0], L.hourP[1], 96, { numerals: ['XII', 'II', 'IIII', 'VI', 'VIII', 'X'], ticks: 12 });
    ring(ctx, L.fourthP[0], L.fourthP[1], 74, { numerals: ['60', '20', '40'], ticks: 12 });
    ring(ctx, L.chronoP[0], L.chronoP[1], 66, { numerals: ['30', '10', '20'], ticks: 6, label: 'MIN.' });
    return { c, r: R + pad, px };
  }

  /* the two repeater gongs circling the movement + their hammers (static; hammers live) */
  function bakeGongs(px) {
    const R = L.plateR, pad = 40;
    const S = Math.ceil((R + pad) * 2 * px);
    const c = cvs(S, S), ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2); ctx.scale(px, px);
    for (const [r, tint] of [[452, '#cfd6df'], [438, '#a7852f']]) {
      ctx.strokeStyle = tint; ctx.globalAlpha = .9;
      ctx.lineWidth = 4.2;
      ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * .62, Math.PI * .62 + TAU * .9, false);
      ctx.stroke();
      ctx.globalAlpha = .3; ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, r - 1.6, Math.PI * .62, Math.PI * .62 + TAU * .9, false);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    /* gong block anchor: west rim, where the hammers reach */
    ctx.fillStyle = '#3c4048';
    ctx.beginPath(); ctx.arc(-432, 46, 15, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(240,217,162,.4)'; ctx.lineWidth = 2; ctx.stroke();
    return { c, r: R + pad, px };
  }

  /* ---------- bake set: capped pixels, cached per tier, hysteretic swap ----------
     E.baseScale is DEVICE px per world unit (it already includes DPR), so it is
     the ONLY scale factor here — multiplying by DPR again was the old bug.
     Absolute pixel caps keep the four plate-class sprites under iOS canvas
     limits on any display. A tier is built once and kept until resize. */
  const tiers = {};
  let current = null, bakedTier = 0;
  const CAP_FLAT = 2800, CAP_WHEEL = 1400;
  const capped = (units, s, cap) => Math.min(s, cap / units);

  function buildSet(tier) {
    const base = (E.baseScale || .5);
    const flat = capped(1040, base * tier, CAP_FLAT);
    const w = (units) => capped(units, base * Math.min(tier * 1.4, 3), CAP_WHEEL);
    const set = {};
    set.plate = bakePlate(flat);
    set.bridges = bakeBridges(flat);
    set.furniture = bakeFurniture(flat);
    set.gongs = bakeGongs(flat);
    set.centerW = bakeWheel({ r: L.center.r, teeth: 80, spokes: 5, style: 'brass', pinion: L.center.pinion, leaves: 16, px: w(292) });
    set.thirdW = bakeWheel({ r: L.third.r, teeth: 75, spokes: 4, style: 'brass', pinion: L.third.pinion, leaves: 10, px: w(222) });
    set.fourthW = bakeWheel({ r: L.fourth.r, teeth: 80, spokes: 4, style: 'brass', pinion: L.fourth.pinion, leaves: 10, px: w(192) });
    set.hourW = bakeWheel({ r: 78, teeth: 60, spokes: 4, style: 'brass', pinion: 0, px: w(168) });
    set.escapeW = bakeEscape(w(120));
    set.balance = bakeBalance(w(270));
    set.fork = bakeFork(w(208));
    set.barrel = bakeBarrel(w(316));
    set.moon = bakeMoonDisc(w(244));
    set.cover = bakeBarrelCover(w(316));
    set.ratchet = bakeRatchet(w(92));
    set.cock = bakeCock(w(540));
    return set;
  }

  function bake(tier) {
    tiers[tier] = buildSet(tier);
    current = tiers[tier];
    bakedTier = tier;
  }
  function rebake() { for (const k in tiers) delete tiers[k]; bake(bakedTier || 1); }

  /* hysteresis: sharpen past 2.4, soften below 1.9 — no ping-pong at the line */
  function maybeRetier() {
    const t = E.cam.z > 2.4 ? 2.5 : (E.cam.z < 1.9 ? 1 : bakedTier);
    if (t === bakedTier) return;
    if (!tiers[t]) tiers[t] = buildSet(t);
    current = tiers[t];
    bakedTier = t;
  }

  return { L, get sprites() { return current; }, bake, rebake, maybeRetier };
})();
