/* Drawing primitives for the link-preview images — SVG built from the game's
 * own art and the SUI design system, rasterised by resvg.
 *
 * A preview is drawn the way the game draws a window: an SUI panel holding a
 * nav screen and a body screen, at the game's 2× UI scale (main.css scales the
 * whole UI 2× from 1152px wide). Everything is laid out in the SUI's own 1×
 * pixels inside one `scale(2)` group, so the numbers here are the numbers in
 * sui.css, and every piece of pixel art lands on whole device pixels.
 *
 * Nothing here is invented artwork: panels and screens are the SUI
 * border-image PNGs sliced exactly as sui.css slices them, portraits are the
 * pfp layers, structs are their base sprites, glyphs come from the
 * Structicons font by the codepoints structicons.css assigns. Pixel art is
 * only ever scaled by whole numbers.
 *
 * Text is fitted, never clipped by accident: both pixel faces are measured
 * glyph by glyph (FACE below), each slot steps down through sizes until its
 * text fits, and only data past every real limit ends in an ellipsis.
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
  playerBody: '#133546',
  playerHighlight: '#1C5F6A',
  enemyBody: '#2E1F3E',
  enemyInverted: '#E64D40',
  borderPlayer: '#133546',
  borderPlayerDark: '#2E1F3E',
  borderEnemy: '#440D3A',
  border: '#5D7E90',
  borderSubtle: '#394958',
  body: '#C5D7D9',
  hint: '#A7C0C6',
  warning: '#F3C878',
  player: '#43CDB6',
  playerActive: '#C2EFDD',
  playerInverted: '#133546',
  enemy: '#EE7D69',
  enemyHighlight: '#F4A990',
  secondary: '#94A4E4',
  // img.glitch-logo (main.css) recolours the mark with a filter chain that
  // starts at brightness(0), so every opaque pixel lands on this one colour.
  logo: '#7192A3',
};

/* Tile ground colours, from main.css `.tile-<ambit>-*`. */
export const AMBIT_FILL = { space: '#222034', air: '#80B2FF', land: '#B3A38C', water: '#408BFF' };
export const AMBITS = ['space', 'air', 'land', 'water'];

export const FONT_LABEL = 'ExtremeHazard';
export const FONT_BODY = 'DirectiveZeroWid';
const FONT_ICONS = 'Structicons';
export const FONT_FILES = [
  path.join(PUBLIC, 'fonts/sui/ExtremeHazard.ttf'),
  path.join(PUBLIC, 'fonts/sui/DirectiveZeroWid.ttf'),
  path.join(PUBLIC, 'fonts/Structicons.ttf'),
];

/* The 2× scale everything below is drawn at, and the window it fills. */
export const SCALE = 2;
export const W = 1200, H = 630;

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

/* Each full-colour icon's size, read from sui.css (`i.sui-icon-<name> { width: var(--icon-md) }`). */
const ICON_PX = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48, xxl: 64 };
let ICON_SIZES = null;
export function iconSize(name) {
  if (!ICON_SIZES) {
    ICON_SIZES = {};
    const css = fs.readFileSync(path.join(PUBLIC, 'css/sui/sui.css'), 'utf8');
    for (const m of css.matchAll(/i\.sui-icon-([a-z0-9-]+)\s*\{[^}]*?width:\s*var\(--icon-(\w+)\)/g)) ICON_SIZES[m[1]] = ICON_PX[m[2]];
  }
  return ICON_SIZES[name] || 24;
}

/* ── text: measuring and fitting ──────────────────────────────────────────── */

/* Advance of every printable ASCII glyph, in em, measured in Chrome from the
 * two TTFs the game ships. Both faces are near-monospaced: ExtremeHazard is
 * 1.25em for letters and digits, DirectiveZero 0.75em. ExtremeHazard draws
 * capitals only (the SUI sets it uppercase), so it measures uppercased text.
 * `ascent`/`descent` are the faces' line metrics (hhea), which place a
 * baseline inside a CSS line box. */
export const FACE = {
  EH: {
    family: FONT_LABEL, base: 1.25, caps: true, ascent: 1, descent: 0,
    w: { ' ': 0.5, '!': 0.5, "'": 0.5, ',': 0.5, '.': 0.5, ':': 0.5, ';': 0.5, I: 0.5, '`': 0.5, '|': 0.2, '{': 0.48, '}': 0.48, '~': 0.541, '<': 0.75, '=': 0.75, '>': 0.75, '[': 0.75, ']': 0.75, '"': 0.875, '(': 0.875, ')': 0.875, '*': 1, '+': 1, '-': 1, '^': 1, '?': 1.125, '/': 1.5, '\\': 1.5 },
  },
  DZ: {
    family: FONT_BODY, base: 0.75, caps: false, ascent: 0.875, descent: 0.125,
    w: { '!': 0.25, "'": 0.25, '.': 0.25, ':': 0.25, I: 0.25, i: 0.25, l: 0.25, '|': 0.25, ' ': 0.5, '"': 0.5, '(': 0.5, ')': 0.5, '*': 0.5, '+': 0.5, ',': 0.5, '-': 0.5, '/': 0.5, ';': 0.5, '<': 0.5, '=': 0.5, '>': 0.5, '[': 0.5, '\\': 0.5, ']': 0.5, '`': 0.5, f: 0.5, j: 0.5, t: 0.5, '{': 0.625, '}': 0.625, M: 1, _: 1, '~': 1 },
  },
};

/* The two pixel faces cover ASCII only: a middle dot, an em dash or a mu
 * draws as a system glyph. These are the ones our own copy and the unit
 * ladders produce; anything else outside ASCII is somebody's name and is left
 * to the font. */
const ASCII_FOR = { '·': '-', '–': '-', '—': '-', '…': '...', 'μ': 'u', '’': "'", '‘': "'", '“': '"', '”': '"' };
export function plain(s) {
  return String(s == null ? '' : s).replace(/[·–—…μ’‘“”]/g, (c) => ASCII_FOR[c])
    // The chain allows any letter in a name; an accented one falls back to its base letter.
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** True when the pixel faces can draw all of `s` (after plain()). */
export const drawable = (s) => /^[\x20-\x7e]*$/.test(plain(s));

/** A units.js reading made drawable: '—' (no value) is null, a zero needs no prefix ('0μg' → '0g', '0mW' → '0W'). */
export function reading(s) {
  if (s == null || s === '—') return null;
  return plain(String(s).replace(/^0(μ|u|m)?(g|W)$/, '0$2'));
}

/** Width of `s` in `face` ('EH' | 'DZ') at `px`. */
export function textWidth(s, face, px) {
  const f = FACE[face];
  let em = 0;
  for (const ch of f.caps ? plain(s).toUpperCase() : plain(s)) {
    em += ch in f.w ? f.w[ch] : ch.charCodeAt(0) > 126 ? 1.25 : f.base;
  }
  return em * px;
}

/** Greedy word wrap at `room`. */
export function wrap(s, face, px, room) {
  const out = [];
  let cur = '';
  for (const word of String(s).split(' ')) {
    const t = cur ? cur + ' ' + word : word;
    if (!cur || textWidth(t, face, px) <= room) cur = t;
    else { out.push(cur); cur = word; }
  }
  if (cur) out.push(cur);
  return out;
}

/** The first [face, px, lines?] step at which `s` fits `room`; the last step otherwise. */
export function fit(s, room, steps) {
  for (const st of steps) {
    const ls = wrap(s, st[0], st[1], room);
    if (ls.length <= (st[2] || 1) && ls.every((l) => textWidth(l, st[0], st[1]) <= room)) return st;
  }
  return steps[steps.length - 1];
}

/* ExtremeHazard draws capitals only, so a unit symbol (mW, Kg) stays in
 * DirectiveZero; so does a missing value, whose dash is a full-width bar in
 * that face. */
export const cased = (s) => String(s) === '-' || /[a-z\u0080-\uffff]/.test(String(s));
/* ExtremeHazard's comma reads as a full stop: in that face thousands group with a space. */
export const shown = (s, st) => (st[0] === 'EH' ? String(s).replace(/,/g, ' ') : String(s));
const fits = (s, room, st) => textWidth(shown(s, st), st[0], st[1]) <= room;

/** One value in one slot → { text, st }. */
export function slot(s, room, steps) {
  const ok = cased(s) ? steps.filter((st) => st[0] !== 'EH') : steps;
  const st = ok.find((x) => fits(s, room, x)) || ok[ok.length - 1];
  return { text: shown(s, st), st };
}

/** A row of like slots shares one step, down to DirectiveZero 16; a value that still does not fit drops below on its own. */
export function fitRow(values, room, steps) {
  const ok = values.some(cased) ? steps.filter((st) => st[0] !== 'EH') : steps;
  const floor = Math.max(0, ok.findIndex((st) => st[0] === 'DZ' && st[1] === 16));
  const r = ok.find((st, i) => i <= floor && values.every((v) => fits(v, room, st))) || ok[floor];
  return values.map((v) => {
    const st = fits(v, room, r) ? r : ok.slice(ok.indexOf(r) + 1).find((x) => fits(v, room, x)) || ok[ok.length - 1];
    return { text: shown(v, st), st };
  });
}

/** Cut `s` to `room` with '...', as CSS text-overflow: ellipsis does. */
export function ellipsize(s, face, px, room) {
  const str = String(s);
  if (textWidth(str, face, px) <= room) return str;
  let cut = str;
  while (cut && textWidth(cut + '...', face, px) > room) cut = cut.slice(0, -1);
  return cut + '...';
}

/** The CSS line-box height a step gets (the cards' font() rule). */
export function lineOf(st) {
  return st[1] >= 24 ? st[1] : st[1] >= 16 ? 20 : 12;
}

/**
 * One line of text whose CSS line box starts at `top` (height `lh`), so text
 * sits exactly where the SUI's own line boxes put it.
 * opts: fill, anchor ('start' | 'middle' | 'end'), lh, spacing, room (ellipsis).
 */
export function line(x, top, s, st, opts = {}) {
  const [face, px] = st;
  const f = FACE[face];
  const lh = opts.lh ?? lineOf(st);
  const baseline = top + (lh - px * (f.ascent + f.descent)) / 2 + px * f.ascent;
  let str = plain(s);
  if (f.caps) str = str.toUpperCase();
  if (opts.room != null) str = ellipsize(str, face, px, opts.room);
  // xml:space keeps a run's own leading spaces (" of 17"), which SVG would otherwise drop.
  return `<text x="${x}" y="${baseline}" xml:space="preserve" font-family="${f.family}" font-size="${px}" fill="${opts.fill || T.body}"`
    + (opts.anchor && opts.anchor !== 'start' ? ` text-anchor="${opts.anchor}"` : '')
    + (opts.spacing ? ` letter-spacing="${opts.spacing}"` : '')
    + `>${esc(str)}</text>`;
}

/* ── primitives ───────────────────────────────────────────────────────────── */

export function rect(x, y, w, h, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
}

/** A 1px line along one edge of a box. */
export function hairline(x, y, w, fill = T.borderSubtle) {
  return rect(x, y, w, 1, fill);
}

/** A 1px box outline (CSS `border: 1px solid`). */
export function outline(x, y, w, h, color) {
  return rect(x, y, w, 1, color) + rect(x, y + h - 1, w, 1, color) + rect(x, y, 1, h, color) + rect(x + w - 1, y, 1, h, color);
}

export function img(rel, x, y, w, h, extra = '') {
  const uri = asset(rel);
  if (!uri) return '';
  return `<image href="${uri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" style="image-rendering:pixelated" ${extra}/>`;
}

let uid = 0;
const nextId = (p) => `${p}${++uid}`;

/** A box filled with a tiled piece of art (CSS background: url() repeat), tiles anchored at the box. */
export function tiled(rel, x, y, w, h, size, { fill, ox = 0, oy = 0 } = {}) {
  const uri = asset(rel);
  const id = nextId('p');
  return (fill ? rect(x, y, w, h, fill) : '')
    + (uri ? `<defs><pattern id="${id}" x="${x + ox}" y="${y + oy}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">`
      + `<image href="${uri}" width="${size}" height="${size}" style="image-rendering:pixelated"/></pattern></defs>${rect(x, y, w, h, `url(#${id})`)}` : '');
}

/** Children drawn inside a box and cut at its edges (CSS overflow: hidden). */
export function clip(x, y, w, h, body) {
  const id = nextId('c');
  return `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#${id})">${body}</g>`;
}

/** A full-colour SUI icon (img/sui/icon/icon-<name>.png) at its sui.css size, or `size` where a design sets one (background-size: cover). */
export function icon(name, x, y, size = iconSize(name)) {
  return img(`img/sui/icon/icon-${name}.png`, x, y, size, size);
}

/** A Structicons glyph by its class name (icon-raid, icon-member, …), in a size × size box (line-height 1, as structicons.css sets it). */
export function glyph(name, x, y, size, fill = T.player) {
  const ch = glyphs()[name];
  if (!ch) return '';
  return `<text x="${x}" y="${y + size * 0.75}" font-family="${FONT_ICONS}" font-size="${size}" fill="${fill}">${esc(ch)}</text>`;
}

/* One piece of a sprite: source rect (sx,sy,sw,sh) of an image (iw×ih) into dest rect. The whole image is
 * drawn at the piece's scale and cut to the dest rect — not a nested <svg viewBox>, which resvg 2.6 panics on
 * inside a clipped, scaled group. */
function crop(uri, iw, ih, sx, sy, sw, sh, dx, dy, dw, dh) {
  if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return '';
  const kx = dw / sw, ky = dh / sh;
  const id = nextId('k');
  return `<defs><clipPath id="${id}"><rect x="${dx}" y="${dy}" width="${dw}" height="${dh}"/></clipPath></defs>`
    + `<image href="${uri}" x="${dx - sx * kx}" y="${dy - sy * ky}" width="${iw * kx}" height="${ih * ky}" preserveAspectRatio="none" clip-path="url(#${id})" style="image-rendering:pixelated"/>`;
}

/** CSS border-image, as sui.css writes it: slices [top, right, bottom, left] in source px, drawn at `scale`. */
export function nineSlice(rel, iw, ih, [t, r, b, l], x, y, w, h, scale = 1, { fill = false } = {}) {
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

/* ── SUI pieces ───────────────────────────────────────────────────────────── */

/** `.sui-panel` with one `.sui-panel-chunk`: left edge · chunk · right edge, player or enemy art. */
export function panel(x, y, w, h, { theme = 'player' } = {}) {
  const v = theme === 'enemy' ? 'medium' : 'default';
  return rect(x + 6, y + 6, w - 12, h - 14, T.panel)
    + nineSlice(`img/sui/panel/panel-edge-left-${v}.png`, 6, 92, [6, 0, 12, 6], x, y, 6, h)
    + nineSlice(`img/sui/panel/panel-edge-top-bottom-${v}.png`, 48, 14, [6, 0, 8, 0], x + 6, y, w - 12, h)
    + nineSlice(`img/sui/panel/panel-edge-right-${v}.png`, 6, 92, [6, 6, 12, 0], x + w - 6, y, 6, h);
}

/** `.sui-screen`: a 4px border drawn with the frame art (border-image 4 4 5 4), player or enemy.
 * `fill` is its background (padding box); content drawn after it paints over the frame's 5px bottom slice, as in CSS. */
export function screen(x, y, w, h, { theme = 'player', fill } = {}) {
  const v = theme === 'player' ? 'default' : 'medium';
  return (fill ? rect(x + 4, y + 4, w - 8, h - 8, fill) : '')
    + nineSlice(`img/sui/screen/screen-frame-${v}.png`, 10, 10, [4, 4, 5, 4], x, y, w, h);
}

/** `.sui-badge` (sui-mod-solid | default | warning | destructive) at x, y → { svg, w }. Height 18. */
export function badge(label, mod, x, y) {
  const COL = { solid: T.player, default: T.player, warning: T.warning, destructive: T.enemy };
  const c = COL[mod] || T.player;
  const w = textWidth(label, 'EH', 8) + 18;
  const svg = (mod === 'solid' ? rect(x, y, w, 18, c) : outline(x, y, w, 18, c))
    + line(x + 9, y + 1, label, ['EH', 8], { lh: 16, fill: mod === 'solid' ? T.playerInverted : c });
  return { svg, w };
}

/** The game's 5-chunk battery (`.sui-screen-battery`, player theme): a 40×20 well with a 2px border, 4×16 chunks 4 apart. */
const CHARGE_LEVELS = [0, 1, 2, 3, 5, 8];
export function battery(charge, x, y) {
  let lvl = CHARGE_LEVELS.length - 1;
  for (let i = 0; i < CHARGE_LEVELS.length; i++) if (charge <= CHARGE_LEVELS[i]) { lvl = i; break; }
  let out = rect(x, y, 40, 20, T.borderPlayerDark) + rect(x + 2, y + 2, 36, 16, T.playerBody);
  for (let i = 0; i < 5; i++) out += img(`img/sui/battery/battery-chunk-${i < lvl ? 'player' : 'empty'}.png`, x + 2 + i * 8, y + 2, 4, 16);
  return out;
}

/** The 5-layer portrait (72px art) at size × size; the placeholder when the attrs are not a portrait. */
export function portrait(attrsJson, x, y, size) {
  let pfp = null;
  try { pfp = typeof attrsJson === 'string' ? JSON.parse(attrsJson) : attrsJson; } catch { pfp = null; }
  if (!pfp || typeof pfp !== 'object' || !Pfp.isLayer('head', pfp.head)) {
    return img('img/portrait-placeholder.png', x, y, size, size);
  }
  return Pfp.PFP_LAYERS.filter((part) => Pfp.isLayer(part, pfp[part]))
    .map((part) => img(Pfp.layerSrc(part, pfp[part]), x, y, size, size)).join('');
}

/** A portrait in its frame (`.pc-pfp`): surface fill and a 1px subtle border, the art inside. */
export function framedPortrait(attrsJson, x, y, size, { border = T.borderSubtle } = {}) {
  return rect(x, y, size + 2, size + 2, T.surface) + outline(x, y, size + 2, size + 2, border) + portrait(attrsJson, x + 1, y + 1, size);
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

/** The struct's base sprite path (damaged variant when asked and present), or null when the type has no art. */
export function structSprite(typeName, damaged = false) {
  const slug = artSlug(typeName);
  const dmg = `img/structs/${slug}/${slug}-struct-dmg.png`;
  const base = `img/structs/${slug}/${slug}-struct-base.png`;
  if (damaged && asset(dmg)) return dmg;
  return asset(base) ? base : null;
}

/** A struct's sprite (128px art) at size × size. `flip` mirrors it — the far side faces left. */
export function structArt(typeName, x, y, size, { flip = false, damaged = false, extra = '' } = {}) {
  const rel = structSprite(typeName, damaged);
  if (!rel) return '';
  const t = flip ? ` transform="translate(${2 * x + size} 0) scale(-1 1)"` : '';
  return `<g${t}${extra ? ' ' + extra : ''}>${img(rel, x, y, size, size)}</g>`;
}

/* The ground art each struct type fights on (struct_type possibleAmbit: 16 space,
 * 8 air, 4 land, 2 water). Planetary structs stand on land. */
const GROUND = {
  'command ship': 'space', battleship: 'space', starfighter: 'space', frigate: 'space',
  'pursuit fighter': 'air', 'stealth bomber': 'air', 'high altitude interceptor': 'air',
  'mobile artillery': 'land', tank: 'land', 'sam launcher': 'land',
  cruiser: 'water', destroyer: 'water', submersible: 'water',
  'orbital shield generator': 'space', 'jamming satellite': 'space',
};
export function groundOf(typeName) {
  return GROUND[String(typeName || '').toLowerCase().trim()] || 'land';
}

/** A battleground's own tile, filling a box (the middle tile of each ambit's set, 128px art at 128). */
export function ground(ambit, x, y, w, h) {
  return tiled(`img/tiles/${ambit}/${ambit}-2-2-middle-middle.png`, x, y, w, h, 128, { fill: AMBIT_FILL[ambit] });
}

/* ── the window ───────────────────────────────────────────────────────────── */

/* The body screen's content box (inside its border and 12px padding), in 1× pixels. */
export const BODY = { x: 24, y: 70, w: 552, h: 217 };

/**
 * A whole preview: the page, an SUI panel, the nav screen (Structs · <view>,
 * the link on the right) and the body screen; `body` is drawn inside, in 1×
 * pixels. Returns the SVG document.
 */
export function previewWindow(view, linkText, body) {
  const nav = navScreen(view, linkText);
  return svgDoc(
    tiled('img/sui/page/page-background.png', 0, 0, W, H, 8, { fill: T.page })
    + `<g transform="scale(${SCALE})">`
    + panel(0, 0, 600, 315)
    + nav
    + screen(6, 52, 588, 253) + rect(10, 56, 580, 245, T.borderPlayerDark) + rect(12, 58, 576, 241, T.playerBody)
    // Not clipped: every slot is fitted to stay inside the body, and resvg 2.6
    // panics on a stretched frame slice inside a clipped, scaled group.
    + body
    + '</g>',
  );
}

export function svgDoc(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}

/* `.sui-screen-nav` inside a `.sui-screen`: items 16 apart, the active one underlined. */
function navScreen(view, linkText) {
  let out = screen(6, 4, 588, 46) + rect(10, 8, 580, 38, T.borderPlayer) + rect(12, 10, 576, 34, T.playerHighlight);
  const items = [['Structs', false]];
  if (view) items.push([view, true]);
  let x = 20;
  for (const [label, active] of items) {
    const w = textWidth(label, 'EH', 8) + 20;
    out += line(x + 10, 18, label, ['EH', 8], { lh: 16, fill: active ? T.playerActive : T.player });
    if (active) out += rect(x, 40, w, 2, T.playerActive);
    x += w + 16;
  }
  if (linkText) {
    const room = 578 - (x - 16 + 10);
    out += line(578, 18, linkText, ['EH', 8], { lh: 16, fill: T.player, anchor: 'end', room });
  }
  return out;
}

/* ── the board ────────────────────────────────────────────────────────────── */

/* A battle board in its screen: the four battlegrounds as bands of their own
 * tiles, our side left of the divider, theirs right and facing left.
 *
 * Each side spreads over half the board; 32px of each 64px sprite is the
 * struct itself. A crowded side staggers up and down so every unit stays
 * countable, the command ship always paints on top, and a side with more than
 * five structs in one battleground shows the rest as "+N" rather than
 * dropping them silently. `fog` covers their side when nobody is there. */
const BAND = 52, VIS = 32, PAD = 4, MAX_SHOWN = 5;
export function board(x, y, w, bands, { fog = false } = {}) {
  const inner = w - 8, half = inner / 2;
  let out = screen(x, y, w, 4 * BAND + 8, { fill: T.page });
  const bx = x + 4, by = y + 4;
  AMBITS.forEach((ambit, i) => {
    const top = by + i * BAND;
    let band = ground(ambit, bx, top, inner, BAND) + rect(bx + half - 1, top, 2, BAND, T.enemyInverted);
    const [ours = [], theirs = []] = bands[ambit] || [];
    band += side(ours, false, bx, top, half) + side(theirs, true, bx + inner, top, half);
    out += clip(bx, top, inner, BAND, band);
  });
  if (fog) out += clip(bx + half, by, half, 4 * BAND, tiled('img/tiles/fog-of-war/fog-of-war-left.png', bx + half, by, half, 4 * BAND, 128));
  return out;
}

function side(units, far, edge, top, half) {
  const shown = units.slice(0, MAX_SHOWN);
  const n = shown.length;
  // A side with more than it can show keeps a strip by the divider for its "+N".
  const more = units.length - n;
  const label = more > 0 ? '+' + more : '';
  const lw = label ? textWidth(label, 'DZ', 8) + 4 : 0;
  const span = label ? half - lw - 4 : half;
  const step = n > 1 ? Math.min(44, Math.floor((span - VIS - 2 * PAD) / (n - 1))) : 0;
  const crowded = n > 1 && step < VIS - 4;
  // Paint order: everyone else by position, the command ship last.
  const order = shown.map((u, i) => [u, i]).sort((a, b) => (a[0].command ? 1 : 0) - (b[0].command ? 1 : 0) || a[1] - b[1]);
  let out = '';
  for (const [u, i] of order) {
    const off = PAD + i * step - 16;
    const sx = far ? edge - off - 64 : edge + off;
    const sy = top + (crowded ? (i % 2 ? -10 : -2) : -6);
    // Stealthed structs are drawn faded, as the game draws them (main.css .struct-stealth-active).
    const extra = u.dim ? 'opacity="0.5"' : '';
    // A type with no art of its own (World Engine, an unknown type) still holds its place: the struct icon, 2×.
    out += structArt(u.type, sx, sy, 64, { flip: far, damaged: u.damaged, extra })
      || `<g ${extra}>${icon('deployed-structs', sx + 20, sy + 20, 24)}</g>`;
  }
  if (label) {
    const bx = far ? edge - half + 2 : edge + half - 2 - lw, by = top + (BAND - 12) / 2;
    out += rect(bx, by, lw, 12, T.page, 'opacity="0.7"') + line(bx + 2, by, label, ['DZ', 8], { fill: T.body });
  }
  return out;
}
