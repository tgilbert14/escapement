/* THE ESCAPEMENT — arrival. You come to it mid-oscillation: the camera wakes
   close on the balance (already beating your time) and pulls back to the
   whole movement. Reduced motion: no flight, the room is simply there. */
(() => {
  try {
    const BAL = E.forge.L.balanceP;

    if (!E.rm.matches) {
      document.body.classList.add('arriving');
      E.cam.x = E.cam.tx = BAL[0];
      E.cam.y = E.cam.ty = BAL[1];
      E.cam.z = E.cam.tz = 2.9;
    }

    E.render.boot();

    if (!E.rm.matches) {
      let done = false;
      const land = () => {
        if (done) return; done = true;
        E.cam.tx = 0; E.cam.ty = 0; E.cam.tz = 1;
        document.body.classList.remove('arriving');
        E.render.wake();
      };
      setTimeout(land, 2100);                 /* the pull-back begins on its own */
      addEventListener('pointerdown', land, { once: true, capture: true });
      addEventListener('keydown', land, { once: true, capture: true });
    }

    /* the movement introduces itself once */
    setTimeout(() => {
      E.say(`A mechanical watch keeping your time: ${E.time.timeLabel()}. Hold the crown to wind it; pull the slide to hear the time.`);
    }, 1200);
  } catch (err) {
    /* a boot throw must never leave a black room: surface the brochure line */
    console.error(err);
    const p = document.createElement('p');
    p.className = 'bootfail';
    p.style.cssText = 'position:fixed;inset:auto 0 40px 0;text-align:center;color:#9a958a;font:15px Georgia,serif;letter-spacing:.14em;';
    p.textContent = 'The movement failed to start. A mechanical watch the size of a room lives here — try a newer browser.';
    document.body.appendChild(p);
  }
})();
