import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as samples from './fixtures/og-samples.js';
import * as cards from '../src/og/cards.js';
import { renderSvg } from '../src/og/render.js';
import { FACE, textWidth } from '../src/og/draw.js';

/* Every preview card, with every sample from today's typical data to the
 * worst cases, must render, and every line of text must fit: inside the
 * window, clear of every other line, and cut with "..." only when the data
 * is past every real limit (the overflow samples). Text is measured with the
 * same glyph table the cards fit with — the faces' own advances. */

const FAMILY = Object.fromEntries(Object.entries(FACE).map(([k, f]) => [f.family, k]));
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Every pixel-font text run in a card's SVG, as a box in the window's 1× pixels. */
function runs(svg) {
  const out = [];
  for (const m of svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
    const attr = Object.fromEntries([...m[1].matchAll(/([a-z:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    const face = FAMILY[attr['font-family']];
    if (!face) continue;                         // a Structicons glyph, not text
    const text = unescape(m[2]);
    const px = Number(attr['font-size']);
    const w = textWidth(text, face, px) + (Number(attr['letter-spacing']) || 0) * text.length;
    const x = Number(attr.x), y = Number(attr.y);
    const left = attr['text-anchor'] === 'end' ? x - w : attr['text-anchor'] === 'middle' ? x - w / 2 : x;
    out.push({ text, left, right: left + w, top: y - FACE[face].ascent * px, bottom: y + FACE[face].descent * px });
  }
  return out;
}

const VIEW = { simResult: 'sim' };
for (const [card, set] of Object.entries(samples)) {
  for (const [name, og] of Object.entries(set)) {
    test(`${card} · ${name}: renders, and every line fits`, () => {
      const svg = cards[VIEW[card] || card](og);
      const png = renderSvg(svg);
      assert.equal(png.readUInt32BE(16), 1200);
      assert.equal(png.readUInt32BE(20), 630);

      const all = runs(svg);
      assert.ok(all.length > 0 || card === 'home');
      assert.ok(!all.some((r) => /structs\.app/i.test(r.text)), 'the nav names the view, not the link');
      const nav = (r) => r.top < 52;
      for (const r of all) {
        // The nav sits in its screen (12–588); the body's text stays inside the body screen (12–588 × 58–299).
        assert.ok(r.left >= 12 - 0.01 && r.right <= 588 + 0.01, `"${r.text}" runs off the side: ${r.left.toFixed(1)}–${r.right.toFixed(1)}`);
        if (!nav(r) && card !== 'home') assert.ok(r.top >= 58 - 0.01 && r.bottom <= 299 + 0.01, `"${r.text}" runs off the body: ${r.top.toFixed(1)}–${r.bottom.toFixed(1)}`);
        if (name !== 'overflow' && !nav(r)) assert.ok(!r.text.endsWith('...'), `"${r.text}" is cut, but ${name} data is within limits`);
      }
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i], b = all[j];
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          assert.ok(!(w > 0.5 && h > 0.5), `"${a.text}" overlaps "${b.text}"`);
        }
      }
    });
  }
}

test('the measured faces: letters and digits are 1.25em in ExtremeHazard, 0.75em in DirectiveZero', () => {
  assert.equal(textWidth('JPEG', 'EH', 32), 160);
  assert.equal(textWidth('jpeg', 'EH', 32), 160);         // drawn as capitals
  assert.equal(textWidth('Kills', 'EH', 16), 88);          // I is half width
  assert.equal(textWidth('MMMM', 'DZ', 16), 64);           // M is a full em in DirectiveZero
  assert.equal(textWidth('108g', 'DZ', 16), 48);
});

test('a name the pixel faces cannot draw falls back: accents to their letters, other scripts to the id', () => {
  const base = samples.player.typical;
  const accented = cards.player({ ...base, player: { ...base.player, name: 'Ölmaz-Çelik' } }, 'x');
  assert.match(accented, />OLMAZ-CELIK</);
  const cyrillic = cards.player({ ...base, player: { ...base.player, name: 'Иван' } }, 'x');
  assert.match(cyrillic, />1-61</);
  assert.doesNotMatch(cyrillic, /Иван/);
  const guild = cards.player({ ...base, player: { ...base.player, guildLabel: '[ÖH] Орбита Hydro' } }, 'x');
  assert.match(guild, />\[OH\] Hydro</);
});
