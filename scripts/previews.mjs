// Render every preview card with every sample in test/fixtures/og-samples.js,
// through the same resvg call the server makes.
//
//   node scripts/previews.mjs [out-dir] [card,card…]
//
// Writes <card>-<sample>.png (and .svg) to out-dir (default ./previews), for
// looking at the cards against their worst cases without a database.
import fs from 'node:fs';
import path from 'node:path';
import * as samples from '../test/fixtures/og-samples.js';
import * as cards from '../src/og/cards.js';
import { renderSvg } from '../src/og/render.js';

const out = path.resolve(process.argv[2] || 'previews');
const only = process.argv[3] ? process.argv[3].split(',') : null;
fs.mkdirSync(out, { recursive: true });

// The simulator result is the sim card given a result.
const VIEW = { simResult: 'sim' };
let count = 0;
for (const [card, set] of Object.entries(samples)) {
  if (only && !only.includes(card)) continue;
  for (const [name, og] of Object.entries(set)) {
    const view = VIEW[card] || card;
    const svg = cards[view](og);
    fs.writeFileSync(path.join(out, `${card}-${name}.svg`), svg);
    fs.writeFileSync(path.join(out, `${card}-${name}.png`), renderSvg(svg));
    count++;
  }
}
console.log(`${count} previews in ${out}`);
