/* Drawing primitives for the link-preview images — SVG built from the game's
 * own art, rasterised by resvg.
 *
 * Nothing here is invented artwork: panels and screens are the SUI
 * border-image PNGs sliced exactly as sui.css slices them, portraits are the
 * pfp layers, structs are their base sprites, glyphs come from the
 * Structicons font by the codepoints structicons.css assigns. Pixel art is
 * only ever scaled by whole numbers, and drawn with `image-rendering:
 * pixelated`.
 *
 * Every string that reaches the SVG goes through `esc` — names, guild tags
 * and portraits are other players' data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../public/shared/pfp.js';

export const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const Pfp = globalThis.StructsPfp;

/* SUI semantic tokens (sui.css :root). Colours are only ever named here. */
export const T = {
  page: '#1A2029',
  surface: '#222034',
  panel: '#5D7E90',
  panelMedium: '#4C6475',
  playerBody: '#133546',
  playerHighlight: '#1C5F6A',
  enemyBody: '#2E1F3E',
  enemyHighlight: '#5D0C15',
  border: '#5D7E90',
  borderSubtle: '#394958',
  borderStrong: '#A7C0C6',
  body: '#C5D7D9',
  hint: '#A7C0C6',
  warning: '#F3C878',
  player: '#43CDB6',
  playerLight: '#86DFC6',
  enemy: '#EE7D69',
  secondary: '#94A4E4',
};

/* Tile ground colours, from main.css `.tile-<ambit>-*`. */
export const AMBIT_FILL = { space: '#222034', air: '#80B2FF', land: '#B3A38C', water: '#408BFF' };
export const AMBITS = ['space', 'air', 'land', 'water'];

export const FONT_LABEL = 'ExtremeHazard';
export const FONT_BODY = 'DirectiveZeroWid';
export const FONT_FILES = [
  path.join(PUBLIC, 'fonts/sui/ExtremeHazard.ttf'),
  path.join(PUBLIC, 'fonts/sui/DirectiveZeroWid.ttf'),
  path.join(PUBLIC, 'fonts/Structicons.ttf'),
];

export function esc(s) {
  return String(s == null ? '' : s)
    // Control characters are not valid XML at all.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── assets ───────────────────────────────────────────────────────────────── */

const uris = new Map();
const MIME = { '.png': 'image/png', '.gif': 'image/gif' };

/** A public/ asset as a data URI (cached), or null if it does not ship. */
export function asset(rel) {
  if (uris.has(rel)) return uris.get(rel);
  const file = path.join(PUBLIC, rel);
  let uri = null;
  if (file.startsWith(PUBLIC + path.sep) && fs.existsSync(file)) {
    uri = `data:${MIME[path.extname(file)] || 'image/png'};base64,${fs.readFileSync(file).toString('base64')}`;
  }
  uris.set(rel, uri);
  return uri;
}

/* Structicons codepoints, read from the stylesheet the game ships. */
let GLYPHS = null;
function glyphs() {
  if (GLYPHS) return GLYPHS;
  GLYPHS = {};
  const css = fs.readFileSync(path.join(PUBLIC, 'css/structicons.css'), 'utf8');
  for (const m of css.matchAll(/\.(icon-[a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-f]+)"/g)) {
    GLYPHS[m[1]] = String.fromCodePoint(parseInt(m[2], 16));
  }
  return GLYPHS;
}

/* ── primitives ───────────────────────────────────────────────────────────── */

export function rect(x, y, w, h, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
}

/* The two pixel faces cover ASCII only: a middle dot or an en dash draws as a
 * missing-glyph box. These are the ones our own copy and the unit ladders
 * produce; anything else outside ASCII is somebody's name and is left to the
 * font. */
const ASCII_FOR = { '·': '-', '–': '-', '—': '-', '…': '...', 'μ': 'u', '’': "'", '‘': "'", '“': '"', '”': '"' };
export function plain(s) {
  return String(s == null ? '' : s).replace(/[·–—…μ’‘“”]/g, (c) => ASCII_FOR[c]);
}

export function text(x, y, s, { size = 16, fill = T.body, font = FONT_BODY, anchor = 'start', spacing = 0, opacity } = {}) {
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"`
    + (spacing ? ` letter-spacing="${spacing}"` : '') + (opacity != null ? ` opacity="${opacity}"` : '')
    + `>${esc(plain(s))}</text>`;
}

/* Advance per character as a fraction of the font size — both faces are
 * near-monospaced, measured off rendered output. */
const ADVANCE = { [FONT_LABEL]: 1.12, [FONT_BODY]: 0.75 };

export function measure(s, size, font = FONT_BODY) {
  return plain(s).length * size * (ADVANCE[font] || 0.8);
}

/** The largest pixel-clean size (multiples of 8) at which `s` fits `width`. */
export function fitSize(s, width, max = 32, font = FONT_LABEL) {
  for (let size = max; size > 8; size -= 8) if (measure(s, size, font) <= width) return size;
  return 8;
}

/** Clip a string to n characters — the pixel faces are fixed-width enough for this to be the honest fit. */
export function fit(s, n) {
  const str = plain(s);
  return str.length > n ? str.slice(0, n - 3) + '...' : str;
}

export function img(rel, x, y, w, h, extra = '') {
  const uri = asset(rel);
  if (!uri) return '';
  return `<image href="${uri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" style="image-rendering:pixelated" ${extra}/>`;
}

/** A Structicons glyph by its class name (icon-raid, icon-fleet-tile, …). */
export function glyph(name, x, y, size, fill = T.body) {
  const ch = glyphs()[name];
  if (!ch) return '';
  return `<text x="${x}" y="${y + size}" font-family="Structicons" font-size="${size}" fill="${fill}">${esc(ch)}</text>`;
}

/* One piece of a sprite: source rect (sx,sy,sw,sh) of an image (iw×ih) into dest rect. */
function crop(uri, iw, ih, sx, sy, sw, sh, dx, dy, dw, dh) {
  if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return '';
  return `<svg x="${dx}" y="${dy}" width="${dw}" height="${dh}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none">`
    + `<image href="${uri}" width="${iw}" height="${ih}" style="image-rendering:pixelated"/></svg>`;
}

/** CSS border-image, as sui.css writes it: slices [top, right, bottom, left] in source px, drawn at `scale`. */
export function nineSlice(rel, iw, ih, [t, r, b, l], x, y, w, h, scale, { fill = false } = {}) {
  const uri = asset(rel);
  if (!uri) return '';
  const [T_, R, B, L] = [t * scale, r * scale, b * scale, l * scale];
  const mw = iw - l - r, mh = ih - t - b;
  let out = '';
  const parts = [
    [0, 0, l, t, x, y, L, T_], [l, 0, mw, t, x + L, y, w - L - R, T_], [iw - r, 0, r, t, x + w - R, y, R, T_],
    [0, t, l, mh, x, y + T_, L, h - T_ - B], [iw - r, t, r, mh, x + w - R, y + T_, R, h - T_ - B],
    [0, ih - b, l, b, x, y + h - B, L, B], [l, ih - b, mw, b, x + L, y + h - B, w - L - R, B], [iw - r, ih - b, r, b, x + w - R, y + h - B, R, B],
  ];
  if (fill) parts.push([l, t, mw, mh, x + L, y + T_, w - L - R, h - T_ - B]);
  for (const p of parts) out += crop(uri, iw, ih, ...p);
  return out;
}

/* ── SUI frames ───────────────────────────────────────────────────────────── */

/**
 * `.sui-panel` with one `.sui-panel-chunk`: left edge · chunk · right edge,
 * the player theme (default art) or the enemy one (medium art).
 */
export function panel(x, y, w, h, { theme = 'player', scale = 3 } = {}) {
  const v = theme === 'enemy' ? 'medium' : 'default';
  const edge = 6 * scale;
  return rect(x + edge, y + 6 * scale, w - 2 * edge, h - 14 * scale, theme === 'enemy' ? T.panelMedium : T.panel)
    + nineSlice(`img/sui/panel/panel-edge-left-${v}.png`, 6, 92, [6, 0, 12, 6], x, y, edge, h, scale)
    + nineSlice(`img/sui/panel/panel-edge-top-bottom-${v}.png`, 48, 14, [6, 0, 8, 0], x + edge, y, w - 2 * edge, h, scale)
    + nineSlice(`img/sui/panel/panel-edge-right-${v}.png`, 6, 92, [6, 6, 12, 0], x + w - edge, y, edge, h, scale);
}

/** `.sui-screen`: the inset display inside a panel. */
export function screen(x, y, w, h, { theme = 'player', scale = 3, fill = T.surface } = {}) {
  const v = theme === 'player' ? 'default' : 'medium';
  return rect(x + 2 * scale, y + 2 * scale, w - 4 * scale, h - 4 * scale, fill)
    + nineSlice(`img/sui/screen/screen-frame-${v}.png`, 10, 10, [4, 4, 5, 4], x, y, w, h, scale);
}

/** The page behind everything: the game's own 8px texture. */
export function page(w, h) {
  const uri = asset('img/sui/page/page-background.png');
  return rect(0, 0, w, h, T.page)
    + (uri ? `<defs><pattern id="pg" width="24" height="24" patternUnits="userSpaceOnUse"><image href="${uri}" width="24" height="24" style="image-rendering:pixelated"/></pattern></defs>${rect(0, 0, w, h, 'url(#pg)')}` : '');
}

/* ── game pieces ──────────────────────────────────────────────────────────── */

/** The 5-layer portrait (72px art) at size×size; the placeholder when the attrs are not a portrait. */
export function portrait(attrsJson, x, y, size) {
  let pfp = null;
  try { pfp = JSON.parse(attrsJson); } catch { pfp = null; }
  if (!pfp || typeof pfp !== 'object' || !Pfp.isLayer('head', pfp.head)) {
    return img('img/portrait-placeholder.png', x, y, size, size);
  }
  return Pfp.PFP_LAYERS.filter((part) => Pfp.isLayer(part, pfp[part]))
    .map((part) => img(Pfp.layerSrc(part, pfp[part]), x, y, size, size)).join('');
}

/* Struct art folders whose name is not the type's slug — the same table as
 * structs-achievements.js ART_DIRS. */
const ART_DIRS = {
  'command ship': 'cmd-ship', 'high altitude interceptor': 'interceptor', 'ore extractor': 'extractor',
  'ore refinery': 'refinery', 'orbital shield generator': 'orb-shield', 'jamming satellite': 'jamming-sat',
  'planetary defense cannon': 'pdc', 'field generator': 'generator',
};
export function artSlug(typeName) {
  const k = String(typeName || '').toLowerCase().trim();
  return ART_DIRS[k] || k.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** A struct's base sprite (128px art). `flip` mirrors it — the attacker faces left. */
export function structArt(typeName, x, y, size, { flip = false, damaged = false } = {}) {
  const slug = artSlug(typeName);
  const rel = `img/structs/${slug}/${slug}-struct-${damaged ? 'dmg' : 'base'}.png`;
  const base = asset(rel) ? rel : `img/structs/${slug}/${slug}-struct-base.png`;
  if (!asset(base)) return '';
  const t = flip ? ` transform="translate(${2 * x + size} 0) scale(-1 1)"` : '';
  return `<g${t}>${img(base, x, y, size, size)}</g>`;
}

/** The game's 5-chunk battery (ChargeCalculator thresholds, as playercard.js). */
const CHARGE_LEVELS = [0, 1, 2, 3, 5, 8];
export function battery(charge, x, y, scale = 3, theme = 'player') {
  let lvl = CHARGE_LEVELS.length - 1;
  for (let i = 0; i < CHARGE_LEVELS.length; i++) if (charge <= CHARGE_LEVELS[i]) { lvl = i; break; }
  let out = '';
  for (let i = 0; i < 5; i++) {
    // The chunk art is 2×8; the game spaces them a pixel apart.
    out += img(`img/sui/battery/battery-chunk-${i < lvl ? theme : 'empty'}.png`, x + i * 3 * scale, y, 2 * scale, 8 * scale);
  }
  return out;
}

/** A labelled figure: big value over a small caption, with an optional glyph. */
export function figure(x, y, value, label, { icon, iconImg, color = T.body, size = 32 } = {}) {
  let out = '';
  let vx = x;
  if (icon) { out += glyph(icon, x, y - size + 4, size, color); vx += size + 10; }
  if (iconImg) { out += img(iconImg, x, y - size + 4, size, size); vx += size + 10; }
  out += text(vx, y, value, { size, fill: color, font: FONT_LABEL });
  out += text(x, y + 28, label, { size: 16, fill: T.hint });
  return out;
}
