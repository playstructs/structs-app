/* The link-preview images, one composition per view, 1200×630.
 *
 * Each is a SUI panel on the game's page texture: a portrait or the subject's
 * own art in a screen on the left, its figures in screens on the right, the
 * Structs mark and the link along the bottom. Maps and simulator challenges
 * draw the board itself from the real tile and struct art.
 */
import {
  T, AMBITS, AMBIT_FILL, FONT_LABEL, FONT_BODY,
  page, panel, screen, rect, text, img, glyph, portrait, structArt, battery, fit, fitSize, measure,
} from './draw.js';
import '../../public/shared/units.js';

const U = globalThis.StructsUnits;
export const W = 1200, H = 630;

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}

function frame(body, linkText, { theme = 'player' } = {}) {
  return svg(page(W, H) + panel(16, 16, W - 32, H - 32, { theme }) + body + footer(linkText));
}

function footer(linkText) {
  return img('img/sui/logo/logo-structs.gif', 48, 540, 48, 46)
    + text(108, 574, 'STRUCTS', { size: 24, font: FONT_LABEL, fill: T.body })
    + text(W - 48, 572, fit(linkText, 44), { size: 16, fill: T.hint, anchor: 'end' });
}

const n = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US'));

/* The value's face and size: the label face while it fits at 24 or more,
 * then the narrower body face — a long reading should shrink, not overflow. */
function valueStyle(value, room) {
  const big = fitSize(value, room, 40, FONT_LABEL);
  if (big >= 24) return { size: big, font: FONT_LABEL };
  return { size: fitSize(value, room, 32, FONT_BODY), font: FONT_BODY };
}

/* A figure in its own screen: glyph/icon and caption on top, the value below. */
function tile(x, y, w, h, { value, label, icon, iconImg, art, color = T.body }) {
  let out = screen(x, y, w, h);
  const ix = x + 20, iy = y + 18;
  if (art) out += structArt(art, ix - 16, iy - 16, 64);
  else if (iconImg) out += img(iconImg, ix, iy, 32, 32);
  else if (icon) out += glyph(icon, ix, iy - 2, 32, color);
  out += text(ix + 44, iy + 24, fit(label, Math.floor((w - 84) / 12)), { size: 16, fill: T.hint });
  out += text(ix, y + h - 22, value, { ...valueStyle(value, w - 40), fill: color });
  return out;
}

function grid(x, y, cols, w, h, gap, items) {
  return items.map((it, i) => tile(x + (i % cols) * (w + gap), y + Math.floor(i / cols) * (h + gap), w, h, it)).join('');
}

/* Name, guild and id beside a portrait — the player card's lines, larger. */
function who(x, p, { nameSize = 48, top = 100, extra } = {}) {
  let out = text(x, top, fit(p.name, nameSize >= 48 ? 14 : 18), { size: nameSize, font: FONT_LABEL, fill: T.body });
  if (p.guildLabel) out += text(x, top + 46, fit(p.guildLabel, 30), { size: 24, fill: T.player });
  out += text(x, top + 82, `#${p.id}` + (extra ? ` · ${extra}` : ''), { size: 16, fill: T.hint });
  return out;
}

function heading(word, icon) {
  return glyph(icon, W - 92, 52, 40, T.player)
    + text(W - 104, 86, word, { size: 32, font: FONT_LABEL, fill: T.player, anchor: 'end' });
}

/* ── player ───────────────────────────────────────────────────────────────── */

export function player({ player: p, counters: c }, linkText) {
  let b = screen(48, 48, 456, 456) + portrait(p.pfp, 60, 60, 432);
  b += who(536, p);
  if (p.charge != null) b += battery(p.charge, 536, 206, 4);
  b += grid(536, 264, 3, 196, 124, 13, [
    { value: U.fmtAlpha(p.alpha), label: 'ALPHA', iconImg: 'img/sui/icon/icon-alpha-matter.png' },
    { value: n(p.structs), label: 'STRUCTS', iconImg: 'img/sui/icon/icon-deployed-structs.png' },
    { value: n(c.kills), label: 'KILLS', iconImg: 'img/sui/icon/icon-destroyed.png', color: T.player },
    { value: n(c.cmd_kills), label: 'CMD KILLS', art: 'Command Ship' },
    { value: n(c.raids_won), label: 'RAIDS WON', iconImg: 'img/sui/icon/icon-attacker.png' },
    { value: U.fmtOre(c.ore_seized ?? 0), label: 'SEIZED', iconImg: 'img/sui/icon/icon-alpha-ore.png' },
  ]);
  return frame(b, linkText);
}

/* ── record + tally ───────────────────────────────────────────────────────── */

function header(p, word, icon) {
  return screen(48, 48, 168, 168) + portrait(p.pfp, 60, 60, 144) + who(244, p, { nameSize: 40, top: 96 }) + heading(word, icon);
}

export function record({ player: p, counters: c }, linkText) {
  let b = header(p, 'RECORD', 'icon-combat-log');
  b += grid(48, 240, 4, 264, 132, 16, [
    { value: n(c.kills), label: 'KILLS', iconImg: 'img/sui/icon/icon-destroyed.png', color: T.player },
    { value: n(c.cmd_kills), label: 'CMD SHIPS', art: 'Command Ship', color: T.player },
    { value: n(c.raids_won), label: 'RAIDS WON', iconImg: 'img/sui/icon/icon-attacker.png' },
    { value: n(c.raids_repelled), label: 'RAIDS REPELLED', iconImg: 'img/sui/icon/icon-defended.png' },
    { value: U.fmtOre(c.ore_seized ?? 0), label: 'ORE SEIZED', iconImg: 'img/sui/icon/icon-alpha-ore.png' },
    { value: U.fmtAlpha(c.alpha_refined ?? 0), label: 'ALPHA REFINED', art: 'Ore Refinery' },
    { value: n(c.structs_built), label: 'STRUCTS BUILT', iconImg: 'img/sui/icon/icon-deployed-structs.png' },
    { value: n(c.damage_dealt), label: 'DAMAGE DEALT', icon: 'icon-dmg' },
  ]);
  return frame(b, linkText);
}

export function tally({ player: p, hulls }, linkText) {
  let b = header(p, 'TALLY', 'icon-wreckage');
  const top = hulls.filter((h) => h.kills || h.built).slice(0, 6);
  const w = 168, gap = 14, x0 = 48;
  top.forEach((h, i) => {
    const x = x0 + i * (w + gap), y = 240;
    b += screen(x, y, w, 284);
    b += structArt(h.type, x + 20, y + 6, 128);
    const name = h.type.toUpperCase();
    const cut = name.length > 13 ? name.lastIndexOf(' ', 13) : -1;
    if (cut > 0) {
      b += text(x + w / 2, y + 140, name.slice(0, cut), { size: 16, fill: T.hint, anchor: 'middle' });
      b += text(x + w / 2, y + 160, fit(name.slice(cut + 1), 13), { size: 16, fill: T.hint, anchor: 'middle' });
    } else {
      b += text(x + w / 2, y + 152, name, { size: 16, fill: T.hint, anchor: 'middle' });
    }
    b += text(x + w / 2, y + 206, n(h.kills ?? 0), { size: fitSize(n(h.kills ?? 0), w - 24, 40), font: FONT_LABEL, fill: T.player, anchor: 'middle' });
    b += text(x + w / 2, y + 230, 'KILLS', { size: 16, fill: T.hint, anchor: 'middle' });
    b += text(x + w / 2, y + 262, `LOST ${n(h.lost ?? 0)}`, { size: 16, fill: T.enemy, anchor: 'middle' });
  });
  if (!top.length) b += text(W / 2, 400, 'NO HULLS ON RECORD', { size: 24, font: FONT_LABEL, fill: T.hint, anchor: 'middle' });
  return frame(b, linkText);
}

/* ── the board ────────────────────────────────────────────────────────────── */

/* Column kinds, left to right, as structs-webapp MapConstants lays a map out:
 * defender command · planetary ×2 · defender fleet ×2 · divider · attacker fleet ×2 · attacker command. */
const MAP_COLS = ['dcmd', 'p', 'p', 'f', 'f', 'div', 'af', 'af', 'acmd'];
const SIM_COLS = ['dcmd', 'f', 'f', 'div', 'af', 'af', 'acmd'];
const ROWS_PER_AMBIT = 2;

function terrain(ambit, row, col, cols) {
  const v = row === 0 ? 'top' : 'bottom';
  const h = col === 0 ? 'left' : col === cols - 1 ? 'right' : 'middle';
  return `img/tiles/${ambit}/${ambit}-${v === 'top' ? 1 : 3}-${h === 'left' ? 1 : h === 'middle' ? 2 : 3}-${v}-${h}.png`;
}

function board(units, x, y, t, cols, { attacker }) {
  let out = '';
  AMBITS.forEach((ambit, ai) => {
    for (let r = 0; r < ROWS_PER_AMBIT; r++) {
      const ty = y + (ai * ROWS_PER_AMBIT + r) * t;
      out += rect(x, ty, cols.length * t, t, AMBIT_FILL[ambit]);
      cols.forEach((_, c) => { out += img(terrain(ambit, r, c, cols.length), x + c * t, ty, t, t); });
    }
  });
  const totalH = AMBITS.length * ROWS_PER_AMBIT * t;
  const div = cols.indexOf('div');
  out += rect(x + div * t, y, t, totalH, '#000', 'opacity="0.35"');
  if (!attacker) {
    // Nobody on the far side: the game draws fog of war there.
    for (let c = div; c < cols.length; c++) {
      out += img(`img/tiles/fog-of-war/fog-of-war-${c === div ? 'left' : 'middle'}.png`, x + c * t, y, t, totalH);
    }
  }

  const colOf = (kind, k) => {
    const idx = cols.map((c, i) => (c === kind ? i : -1)).filter((i) => i >= 0);
    return idx[Math.min(k, idx.length - 1)];
  };
  for (const u of units) {
    const ai = AMBITS.indexOf(u.ambit);
    if (ai < 0) continue;
    let col, row;
    if (u.command) {
      col = colOf(u.side === 'attacker' ? 'acmd' : 'dcmd', 0);
      row = 0;
    } else {
      const kind = u.side === 'planet' ? 'p' : u.side === 'defender' ? 'f' : 'af';
      col = colOf(kind, u.slot % 2);
      row = Math.floor(u.slot / 2);
    }
    if (col == null) continue;
    const ux = x + col * t, uy = y + (ai * ROWS_PER_AMBIT + row) * t;
    const damaged = u.health != null && u.maxHealth && u.health < u.maxHealth;
    // The sprite fills the middle half of its 128px art, so the art is drawn
    // at twice the tile and centred: the sprite then fills its tile.
    const g = structArt(u.type, ux - t / 2, uy - t / 2, 2 * t, { flip: u.side === 'attacker', damaged });
    out += u.hidden || !u.built ? `<g opacity="0.5">${g}</g>` : g;
  }
  return screen(x - 12, y - 12, cols.length * t + 24, totalH + 24, { fill: T.page }) + out;
}

/* ── map ──────────────────────────────────────────────────────────────────── */

export function map({ planet, owner, attacker, units, subject }, linkText) {
  const t = 56, cols = MAP_COLS;
  const bx = W - 48 - cols.length * t, by = 52;
  let b = board(units, bx, by, t, cols, { attacker });

  let y = 48;
  if (owner) {
    b += screen(48, y, 120, 120) + portrait(owner.pfp, 60, y + 12, 96);
    b += text(184, y + 44, fit(owner.name, 12), { size: 24, font: FONT_LABEL });
    if (owner.tag) b += text(184, y + 76, `[${owner.tag}]`, { size: 16, fill: T.player });
    b += text(184, y + 104, `#${owner.id}`, { size: 16, fill: T.hint });
    y += 140;
  }
  b += text(48, y + 32, fit(subject.toUpperCase(), 22), { size: 24, font: FONT_LABEL, fill: T.player });
  if (planet) b += text(48, y + 64, subject.includes(planet.name) ? `#${planet.id}` : fit(`${planet.name} · ${planet.id}`, 30), { size: 16, fill: T.hint });
  y += 88;
  const fig = [
    planet && { value: n(planet.shield ?? 0), label: 'SHIELD', icon: 'icon-planetary-shield' },
    planet && { value: U.fmtOre(planet.ore ?? 0), label: 'ORE', iconImg: 'img/sui/icon/icon-alpha-ore.png' },
    { value: n(units.filter((u) => u.side !== 'attacker').length), label: 'STRUCTS', iconImg: 'img/sui/icon/icon-deployed-structs.png' },
  ].filter(Boolean);
  b += grid(48, y, 2, 220, 116, 12, fig.slice(0, 2));
  if (fig[2]) b += grid(48, y + 128, 2, 220, 116, 12, fig.slice(2));
  if (attacker) {
    const ay = y + 128;
    b += screen(280, ay, 220, 116, { theme: 'enemy', fill: T.enemyBody });
    b += portrait(attacker.pfp, 292, ay + 22, 72);
    b += text(376, ay + 44, 'RAID', { size: 16, font: FONT_LABEL, fill: T.enemy });
    b += text(376, ay + 74, fit(attacker.name, 9), { size: 16, fill: T.body });
  }
  return frame(b, linkText);
}

/* ── provider + reactor ───────────────────────────────────────────────────── */

export function provider({ provider: p, policy }, linkText) {
  let b = screen(48, 48, 168, 168) + glyph('icon-transfers', 76, 64, 112, T.player);
  b += text(244, 104, `PROVIDER ${p.id}`, { size: 40, font: FONT_LABEL });
  const badge = { default: T.player, warning: T.warning, destructive: T.enemy }[policy.mod];
  const bw = measure(policy.text, 24, FONT_LABEL) + 28;
  b += rect(244, 128, bw, 36, badge);
  b += text(258, 156, policy.text, { size: 24, font: FONT_LABEL, fill: T.surface });
  b += text(244 + bw + 16, 154, `SUBSTATION ${p.substation}`, { size: 16, fill: T.hint });
  b += heading('ENERGY', 'icon-transfers');
  b += grid(48, 240, 3, 352, 132, 16, [
    { value: `${p.rate.value} ${String(p.rate.denomLabel).toUpperCase()}`, label: 'PER MW PER BLOCK', iconImg: p.rate.denomIcon ? 'img/sui/icon/icon-alpha-matter.png' : null, icon: p.rate.denomIcon ? null : 'icon-guild', color: T.player },
    { value: `${p.capacity.min}–${p.capacity.max}`, label: 'CAPACITY', iconImg: 'img/sui/icon/icon-energy.png' },
    { value: `${p.duration.min}–${p.duration.max}`, label: 'DURATION', icon: 'icon-in-progress' },
  ]);
  b += screen(48, 392, 1104, 124) + portrait(p.owner.pfp, 64, 408, 92);
  b += text(176, 446, fit(p.owner.name, 24), { size: 24, font: FONT_LABEL });
  if (p.owner.name !== p.owner.id || p.owner.tag) b += text(176, 486, `${p.owner.tag ? `[${p.owner.tag}]  ` : ''}#${p.owner.id}`, { size: 16, fill: T.hint });
  b += text(1136, 472, `${n(p.agreements)} AGREEMENTS`, { size: 24, font: FONT_LABEL, fill: T.player, anchor: 'end' });
  return frame(b, linkText);
}

export function reactor({ reactor: r }, linkText) {
  let b = screen(48, 48, 216, 300) + img('img/reactor-64x92.png', 60, 60, 192, 276);
  b += text(296, 104, `REACTOR ${r.id}`, { size: 48, font: FONT_LABEL });
  if (r.guildLabel) b += text(296, 150, fit(r.guildLabel, 34), { size: 24, fill: T.player });
  b += text(296, 186, fit(r.validator, 60), { size: 16, fill: T.hint });
  b += grid(296, 220, 2, 420, 132, 16, [
    { value: r.fuel, label: 'ALPHA INFUSED', iconImg: 'img/sui/icon/icon-alpha-matter.png', color: T.player },
    { value: r.capacity, label: 'CAPACITY', iconImg: 'img/sui/icon/icon-energy.png' },
    { value: `${r.commissionPct}%`, label: 'COMMISSION', icon: 'icon-guild' },
    { value: n(r.infusers), label: 'INFUSERS', icon: 'icon-member' },
  ]);
  return frame(b, linkText);
}

/* ── simulator ────────────────────────────────────────────────────────────── */

export function sim({ layout, units, level }, linkText) {
  const t = 60, cols = SIM_COLS;
  const bx = W - 48 - cols.length * t, by = 52;
  let b = board(units, bx, by, t, cols, { attacker: true });
  b += text(48, 100, 'SIMULATOR', { size: 24, font: FONT_LABEL, fill: T.player });
  b += text(48, 156, 'CHALLENGE', { size: 48, font: FONT_LABEL });
  const levelColor = { Easy: T.player, Difficult: T.warning, Hard: T.enemy }[level];
  b += rect(48, 180, measure(level, 24, FONT_LABEL) + 28, 40, levelColor);
  b += text(62, 210, level.toUpperCase(), { size: 24, font: FONT_LABEL, fill: T.surface });
  const count = (s) => units.filter((u) => u.side === s).length;
  b += grid(48, 248, 2, 252, 124, 12, [
    { value: n(count('defender')), label: 'YOUR FLEET', art: 'Command Ship', color: T.player },
    { value: n(count('attacker')), label: 'ENEMY FLEET', art: 'Battleship', color: T.enemy },
    { value: `${layout.charge.player}`, label: 'YOUR CHARGE', icon: 'icon-in-progress' },
    { value: `${layout.blockMs / 1000}S`, label: 'BLOCK TIME', icon: 'icon-in-progress' },
  ]);
  return frame(b, linkText);
}

/* ── home ─────────────────────────────────────────────────────────────────── */

export function home(_, linkText) {
  let b = img('img/sui/logo/logo-structs.gif', 64, 72, 256, 248);
  b += text(360, 170, 'STRUCTS', { size: 80, font: FONT_LABEL });
  b += text(364, 226, 'A 5X SPACE STRATEGY GAME', { size: 24, fill: T.player });
  b += text(364, 266, 'BUILD  MINE  RAID  CONQUER', { size: 24, fill: T.hint });
  // A strip of the board across the bottom: a fleet on land, drawn as the game draws it.
  const lineup = ['Command Ship', 'Battleship', 'Starfighter', 'Tank', 'Mobile Artillery', 'Submersible', 'Stealth Bomber', 'Cruiser'];
  const t = 64, cols = lineup.length * 2, x0 = (W - cols * t) / 2, y0 = 384;
  let strip = '';
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 2; r++) strip += rect(x0 + c * t, y0 + r * t, t, t, AMBIT_FILL.land) + img(terrain('land', r, c, cols), x0 + c * t, y0 + r * t, t, t);
  }
  b += screen(x0 - 12, y0 - 12, cols * t + 24, 2 * t + 24, { fill: T.page }) + strip;
  lineup.forEach((ty, i) => { b += structArt(ty, x0 + i * 2 * t, y0, 2 * t); });
  return frame(b, linkText);
}
