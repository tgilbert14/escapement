# The Escapement

**A mechanical watch the size of a room, keeping your time.**

An interactive showcase by [Desert Data Labs](https://desertdatalabs.com): a grand-complication
movement rendered entirely in procedural canvas — no frameworks, no images, no audio files.
The gear train is real: barrel → center wheel (1 rev/h) → third (×8) → fourth (×7.5, 1 rev/min) →
escape wheel (×10, fifteen club teeth) → pallet fork → balance, beating 18,000 A/H against the
visitor's actual local clock. The moonphase is computed from the real synodic month. The
chronograph is a chronograph.

And the mainspring is honest theater: it drains — even while you're away — and when it empties
the balance dies and the hands stop where they were. Hold the crown and she wakes: the balance
kicks, the ratchet clicks, and the hands **spin forward to catch up with the true time**,
because the movement always knows what time it really is.

Pull the repeater slide and two synthesized gongs chime the current time the way the racks
would: hours on the low gong, quarter-hours in high-low pairs, minutes on the high gong.
One quiet gong passes each hour. The dial grades itself by your local hour; after dark, the
lume comes up.

**Live:** https://tgilbert14.github.io/escapement/

## The controls

| Verb | On the metal | On the case | Bare key |
|---|---|---|---|
| Wind | — | hold the crown (right flank) | `W` |
| Chime the time | — | pull the repeater slide (left flank) | `R` |
| Chronograph start/stop | — | upper pusher | `C` |
| Chronograph reset / flyback | — | lower pusher | `X` |
| The plan (exploded view) | — | PLAN chip | `P` |
| Look closer | drag / wheel / pinch / double-tap | — | — |

## Build

```
node build.js     # src/ fragments -> index.html (+ fragment.html, headless)
```

Fragments concatenate in order: tokens → shell → body → boot → time → forge → render →
sound → interact → plan → arrival. The build fails loudly if any `__PLACEHOLDER__` survives.

## House rules it honors

- THE JOURNEY IS VISUAL. The room holds one headline and three chips; everything else is metal — even the legend is caseback engraving.
- Real math everywhere: mesh distances are solved from pitch-circle tangency, wheel rates from
  the true train ratios, the moon from the synodic month, the repeater from the display clock.
- No JS = a complete brochure (static movement SVG + one line). Reduced motion = no camera
  flight, no glint loops; the movement holds a designed pose.
- Every interaction is keyboard-reachable; the canvas is `aria-hidden` scenery; a polite live
  region announces arrival, winding state, chronograph state, and every repeater reading —
  the repeater slide (or `R`) is the on-demand "what time is it," and it answers honestly
  even with sound off.
- The sound chip never claims ON until the AudioContext is truly running; an explicit opt-out
  is remembered; hidden tabs are silent. Ticks are scheduled on the audio clock against the
  movement's 200 ms grid.
- DPR capped at 2, one rAF ticker that parks when the movement is stopped and the camera is
  still, sprites baked once per zoom tier, hidden tabs freeze.

Forged by the MITHRIL guild (Desert Data Labs' web-experience crew), July 2026.
