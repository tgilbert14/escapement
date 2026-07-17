/* THE ESCAPEMENT — the plan. One press lifts the movement into its eight
   layers, still running, each named with a hairline callout. */
(() => {
  const btn = document.getElementById('plan-toggle');

  E.planToggle = () => {
    E.plan.on = !E.plan.on;
    btn.setAttribute('aria-pressed', String(E.plan.on));
    if (E.plan.on) {
      E.cam.tz = 0.44; E.cam.tx = 70; E.cam.ty = -480;
      E.say('Plan view: the movement lifted into eight layers — mainplate, barrel and moonwork, going train, gongwork, bridgework, escapement, dialwork, hands. Still running.');
    } else {
      E.cam.tz = 1; E.cam.tx = 0; E.cam.ty = 0;
      E.say('Plan closed.');
    }
    E.render.wake();
  };
  btn.addEventListener('click', E.planToggle);

  /* ---------- the caseback legend ---------- */
  const legendBtn = document.getElementById('legend-toggle');
  const legend = document.getElementById('legend');
  const legendClose = document.getElementById('legend-close');
  E.showLegend = (open) => {
    legend.hidden = !open;
    legendBtn.setAttribute('aria-expanded', String(open));
    if (open) legendClose.focus();
  };
  legendBtn.addEventListener('click', () => E.showLegend(legend.hidden));
  legendClose.addEventListener('click', () => E.showLegend(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !legend.hidden) E.showLegend(false); });
})();
