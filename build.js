#!/usr/bin/env node
// THE ESCAPEMENT — single-file concatenation build (MITHRIL playbook §2.13).
// node build.js  →  index.html (GitHub Pages) + fragment.html (headless, for artifact embeds)
// Fails loudly if any __PLACEHOLDER__ survives.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
/* THE manifest: the one load-bearing fragment list. CSS/body/JS are derived
   from it by extension, in this order — add a fragment here and only here. */
const parts = [
  '01-tokens.css',
  '02-shell.css',
  '03-body.html',
  '10-boot.js',
  '20-time.js',
  '30-forge.js',
  '40-render.js',
  '50-sound.js',
  '60-interact.js',
  '70-plan.js',
  '80-arrival.js',
];

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

const css = parts.filter(f => f.endsWith('.css')).map(read).join('\n\n');
const body = parts.filter(f => f.endsWith('.html')).map(read).join('\n\n');
const js = parts.filter(f => f.endsWith('.js')).map(read).join('\n\n');

const fragment = `<style>\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>`;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Escapement · a Desert Data Labs experience</title>
<meta name="description" content="A grand complication the size of a room. Real gears, your real time. Wind it, chime it, take it apart.">
<meta property="og:title" content="The Escapement · Desert Data Labs">
<meta property="og:description" content="A mechanical watch the size of a room, keeping your time. Wind it. Chime it. Take it apart.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://tgilbert14.github.io/escapement/">
<meta property="og:image" content="https://tgilbert14.github.io/escapement/og-card.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://tgilbert14.github.io/escapement/og-card.jpg">
<meta name="theme-color" content="#0b0c0e">
<link rel="canonical" href="https://tgilbert14.github.io/escapement/">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='26' fill='none' stroke='%23c8a05a' stroke-width='4'/%3E%3Ccircle cx='32' cy='32' r='11' fill='none' stroke='%236c86c9' stroke-width='3'/%3E%3Cpath d='M32 32 L32 14' stroke='%236c86c9' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E">
</head>
<body>
${fragment}
</body>
</html>`;

// Placeholder failsafe (§2.13): a surviving __MARKER__ means a broken inject — fail the build.
const leftover = page.match(/__[A-Z][A-Z0-9_]+__/g);
if (leftover) {
  console.error('BUILD FAILED — surviving placeholders:', [...new Set(leftover)].join(', '));
  process.exit(1);
}

fs.writeFileSync(path.join(__dirname, 'index.html'), page);
fs.writeFileSync(path.join(__dirname, 'fragment.html'), fragment);
const kb = (n) => (Buffer.byteLength(n, 'utf8') / 1024).toFixed(1) + ' KB';
console.log(`built: index.html ${kb(page)} · fragment.html ${kb(fragment)} · css ${kb(css)} · js ${kb(js)}`);
