/* SVG → PNG, with a small time-boxed cache.
 *
 * A link posted in a busy channel is fetched by every client's unfurler at
 * once; the cache makes that one render. Entries live CACHE_TTL_MS (default
 * five minutes) — previews are a snapshot, and crawlers cache them far longer
 * than that anyway.
 */
import { Resvg } from '@resvg/resvg-js';
import { FONT_FILES, FONT_BODY } from './draw.js';
import * as cards from './cards.js';

const TTL = Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000);
const MAX = 500;
const cache = new Map();

export function png(view, og) {
  const draw = cards[view];
  if (!draw) throw Error('no preview for ' + view);
  return renderSvg(draw(og));
}

/** A preview's SVG → PNG bytes. */
export function renderSvg(svg) {
  return new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: FONT_BODY },
    shapeRendering: 0,       // crisp edges: this is pixel art
    imageRendering: 1,       // optimizeSpeed = nearest neighbour
  }).render().asPng();
}

/** Cached by key; `make` is only called on a miss. */
export async function cached(key, make) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await make();
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, until: Date.now() + TTL });
  return value;
}
