/* The link-preview images, one composition per view, 1200×630.
 *
 * Each is an SUI window: the nav screen names the view and the link, the body
 * screen holds the subject — its portrait or its own art, a few large
 * readings, and the battle board for maps and simulator challenges. All
 * layout is in the SUI's 1× pixels inside the body's content box (BODY); the
 * window draws it at 2×.
 *
 * Every text slot is fitted against the real worst case: 20-character names,
 * unbounded guild labels, the unit ladders' longest readings. Slots step down
 * in size before anything is cut; only data past every limit ends in "...".
 */
import {
  T, BODY, AMBITS,
  previewWindow, svgDoc, hairline, outline, img, tiled, clip, line, lineOf, textWidth, wrap, fit, slot, fitRow,
  reading, screen, badge, battery, portrait, framedPortrait, structSprite, groundOf, ground, glyph, icon, iconSize, board, drawable, plain,
} from './draw.js';
import '../../public/shared/units.js';
import { verdict, clock } from '../simcode.js';

const U = globalThis.StructsUnits;

/* Counts: the loaders coalesce a missing counter to 0. */
const n = (v) => Number(v == null ? 0 : v).toLocaleString('en-US');

/* A name the pixel faces cannot draw (a script outside ASCII) shows as its id; a guild label just loses what it cannot draw. */
const nameOf = (who) => (who.name && drawable(who.name) ? who.name : who.id);
const labelOf = (s) => (s ? plain(s).replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim() : '');

/* The steps a name tries, largest first. */
const NAME = [['EH', 32], ['EH', 24], ['EH', 16], ['DZ', 16]];
const DZ16 = ['DZ', 16], DZ8 = ['DZ', 8];

/** Lines of `s` wrapped at `room` in `st`, at most `max`, the last one cut if it must be. */
function lines(s, st, room, max) {
  const ls = wrap(s, st[0], st[1], room);
  if (ls.length > max) ls.splice(max - 1, ls.length - max + 1, ls.slice(max - 1).join(' '));
  return ls;
}

/** Size first, then words: the first option that fits `room` at 16, then at 8. */
function label(options, room) {
  for (const st of [DZ16, DZ8]) for (const t of options) if (textWidth(t, st[0], st[1]) <= room) return { text: t, st };
  return { text: options[options.length - 1], st: DZ8 };
}

/** A stack of [height, draw(top)] items, `gap` apart, centred in `h` from `top` (CSS justify-content: center). */
function stack(top, h, gap, items) {
  const total = items.reduce((s, it) => s + it[0], 0) + gap * Math.max(0, items.length - 1);
  let y = top + (h - total) / 2;
  let out = '';
  for (const [ih, draw] of items) { out += draw(y); y += ih + gap; }
  return out;
}

/* ── player ───────────────────────────────────────────────────────────────── */

export function player({ player: p, counters: c = {} }) {
  const name = nameOf(p);
  const named = name !== p.id;
  const nameSt = fit(name, BODY.w, NAME);
  const guild = labelOf(p.guildLabel);
  const guildSt = fit(guild, 384, [['DZ', 16, 1], ['DZ', 16, 2], ['DZ', 8, 1]]);
  const guildLines = guild ? lines(guild, guildSt, 384, guildSt[2] || 1) : [];
  const kills = slot(n(c.kills), 244, [['EH', 32], ['EH', 24], ['DZ', 24], ['DZ', 16]]);
  const alpha = reading(U.fmtAlpha(p.alpha));
  const reads = [
    ['alpha-matter', alpha == null ? '-' : alpha, alpha == null ? T.hint : T.body],
    ['deployed-structs', n(p.structs), T.body],
    ['attacker', n(c.raids_won) + ' raids', T.body],
  ];
  // Each reading is its icon at its own SUI size, 4px, then the value; a line is as tall as its tallest icon.
  const READ_H = Math.max(...reads.map((r) => iconSize(r[0])));
  const meta = named || p.charge != null;

  const RX = BODY.x + 152 + 16, RW = 384;
  // The readings wrap like a flex row: 12 apart, 4 between lines.
  const readRows = [[]];
  let used = 0;
  for (const r of reads) {
    const w = iconSize(r[0]) + 4 + textWidth(r[1], 'DZ', 16);
    if (readRows[readRows.length - 1].length && used + 12 + w > RW) { readRows.push([]); used = 0; }
    used += (readRows[readRows.length - 1].length ? 12 : 0) + w;
    readRows[readRows.length - 1].push([...r, w]);
  }
  const killH = Math.max(iconSize('destroyed'), lineOf(kills.st), 24) + 18;

  const right = [];
  if (guild) {
    right.push([guildLines.length * lineOf(guildSt), (y) => guildLines.map((l, i) => line(RX, y + i * lineOf(guildSt), l, guildSt, { fill: T.player, room: RW })).join('')]);
  }
  if (meta) {
    right.push([20, (y) => {
      let out = '', x = RX;
      if (named) { out += line(x, y, '#' + p.id, DZ16, { fill: T.hint }); x += textWidth('#' + p.id, 'DZ', 16) + 12; }
      if (p.charge != null) out += battery(p.charge, x, y);
      return out;
    }]);
  }
  right.push([killH, (y) => {
    const inner = killH - 18, cy = y + 9;
    return hairline(RX, y, RW) + hairline(RX, y + killH - 1, RW)
      + icon('destroyed', RX, cy + (inner - iconSize('destroyed')) / 2)
      + line(RX + iconSize('destroyed') + 8, cy + (inner - lineOf(kills.st)) / 2, kills.text, kills.st, { fill: T.player, room: 244 })
      + line(RX + RW, cy + (inner - 24) / 2, 'Kills', ['EH', 16], { lh: 24, fill: T.hint, anchor: 'end' });
  }]);
  right.push([readRows.length * READ_H + (readRows.length - 1) * 4, (y) => readRows.map((row, i) => {
    let x = RX, out = '';
    const ry = y + i * (READ_H + 4);
    for (const [ic, text, fill, w] of row) {
      const is = iconSize(ic);
      out += icon(ic, x, ry + (READ_H - is) / 2) + line(x + is + 4, ry + (READ_H - 24) / 2, text, DZ16, { fill, lh: 24 });
      x += w + 12;
    }
    return out;
  }).join('')]);

  // The row is as tall as its taller side (CSS align-items: stretch); the portrait keeps to the top.
  const rightH = right.reduce((h, it) => h + it[0], 0) + 6 * (right.length - 1);
  const rowH = Math.max(152, rightH);
  const body = stack(BODY.y, BODY.h, 8, [
    [lineOf(nameSt), (y) => line(BODY.x, y, name, nameSt, { room: BODY.w })],
    [rowH, (y) => screen(BODY.x, y, 152, 152, { fill: T.surface }) + portrait(p.pfp, BODY.x + 4, y + 4, 144) + stack(y, rowH, 6, right)],
  ]);
  return previewWindow('Player', body);
}

/* ── record ───────────────────────────────────────────────────────────────── */

/* A portrait, the name, and the guild and id under it — the header of record and tally. */
function nameBlock(p, x, room, nameSteps, subSteps) {
  const name = nameOf(p);
  const named = name !== p.id;
  const guild = labelOf(p.guildLabel);
  const sub = [guild, named ? '#' + p.id : ''].filter(Boolean).join(' ');
  return { name, named, guild, sub, nameSt: fit(name, room, nameSteps), subSt: sub ? fit(sub, room, subSteps) : null };
}

export function record({ player: p, counters: c }) {
  const TX = BODY.x + 74 + 12, TW = BODY.w - 74 - 12;
  const h = nameBlock(p, TX, TW, NAME, [DZ16, DZ8]);
  const STEPS = [['EH', 24], ['DZ', 24], ['DZ', 16], ['DZ', 8]], ROOM = 125;
  const top = fitRow([n(c.kills), n(c.cmd_kills), n(c.raids_won), n(c.raids_repelled)], ROOM, STEPS);
  const bottom = fitRow([reading(U.fmtOre(c.ore_seized ?? 0)) || '-', reading(U.fmtAlpha(c.alpha_refined ?? 0)) || '-', n(c.structs_built), n(c.damage_dealt)], ROOM, STEPS);
  const tiles = [
    ['Kills', ['icon', 'destroyed'], top[0], T.player, T.player],
    ['Cmd kills', ['icon', 'enemy-deployed-structs'], top[1]],
    ['Raids won', ['icon', 'attacker'], top[2]],
    ['Repelled', ['icon', 'defended'], top[3]],
    ['Seized', ['icon', 'alpha-ore'], bottom[0], T.warning],
    ['Refined', ['icon', 'alpha-matter'], bottom[1]],
    ['Built', ['icon', 'deployed-structs'], bottom[2]],
    ['Damage', ['glyph', 'icon-dmg'], bottom[3]],
  ];

  const textH = lineOf(h.nameSt) + (h.sub ? 8 + lineOf(h.subSt) : 0);
  const body = stack(BODY.y, BODY.h, 8, [
    [74, (y) => {
      let out = framedPortrait(p.pfp, BODY.x, y, 72);
      const ty = y + (74 - textH) / 2;
      out += line(TX, ty, h.name, h.nameSt, { room: TW });
      if (h.sub) {
        const sy = ty + lineOf(h.nameSt) + 8;
        const guild = h.guild ? h.guild + ' ' : '';
        out += line(TX, sy, guild, h.subSt, { fill: T.player, room: TW });
        if (h.named) {
          const gx = TX + textWidth(guild, h.subSt[0], h.subSt[1]);
          if (gx < TX + TW) out += line(gx, sy, '#' + p.id, h.subSt, { fill: T.hint, room: TX + TW - gx });
        }
      }
      return out;
    }],
    [128, (y) => tiles.map(([lab, ic, v, color, edge], i) => {
      const tx = BODY.x + (i % 4) * 139, ty = y + Math.floor(i / 4) * 66;
      return outline(tx, ty, 135, 62, edge || T.border)
        + (ic[0] === 'icon' ? icon(ic[1], tx + 5, ty + 5, 24) : glyph(ic[1], tx + 5, ty + 5, 24, T.enemy))
        + line(tx + 35, ty + 5, lab, ['EH', 8], { lh: 24, fill: T.hint })
        + line(tx + 5, ty + 31 + (24 - lineOf(v.st)) / 2, v.text, v.st, { fill: color || T.body, room: ROOM });
    }).join('')],
  ]);
  return previewWindow('Record', body);
}

/* ── tally ────────────────────────────────────────────────────────────────── */

export function tally({ player: p, hulls }) {
  // Kills by hull: the hulls that killed or were lost, most kills first (losses break ties).
  const touched = (hulls || []).filter((x) => x.kills || x.lost)
    .sort((a, b) => (b.kills || 0) - (a.kills || 0) || (b.lost || 0) - (a.lost || 0));
  const shown = touched.slice(0, 5);
  // Never a silent cut: when the player has more hulls than fit, say so.
  const scope = touched.length > shown.length ? `Top ${shown.length} of ${touched.length}` : '';
  const scopeW = Math.max(textWidth('Kills by hull', 'EH', 8), scope ? textWidth(scope, 'EH', 8) : 0);
  const TX = BODY.x + 38 + 12, TW = BODY.w - 38 - 12 - scopeW - 12;
  const h = nameBlock(p, TX, TW, [['EH', 24], ['EH', 16], DZ16, DZ8], [DZ8]);
  const ROOM = 101;
  const kills = fitRow(shown.map((x) => n(x.kills)), ROOM, [['EH', 24], ['DZ', 24], DZ16]);
  const lost = fitRow(shown.map((x) => 'lost ' + n(x.lost)), ROOM, [DZ16, DZ8]);

  const headH = Math.max(38, lineOf(h.nameSt) + (h.sub ? 14 : 0), scope ? 32 : 16);
  const header = (y) => {
    let out = framedPortrait(p.pfp, BODY.x, y + (headH - 38) / 2, 36);
    const th = lineOf(h.nameSt) + (h.sub ? 14 : 0), ty = y + (headH - th) / 2;
    out += line(TX, ty, h.name, h.nameSt, { room: TW });
    if (h.sub) out += line(TX, ty + lineOf(h.nameSt) + 2, h.sub, DZ8, { fill: T.hint, room: TW });
    const sh = scope ? 32 : 16, sy = y + (headH - sh) / 2;
    out += line(BODY.x + BODY.w, sy, 'Kills by hull', ['EH', 8], { lh: 16, fill: T.hint, anchor: 'end' });
    if (scope) out += line(BODY.x + BODY.w, sy + 16, scope, ['EH', 8], { lh: 16, fill: T.hint, anchor: 'end' });
    return out;
  };

  const columns = (y) => shown.map((hull, i) => {
    const x = Math.round(BODY.x + i * 111.6), w = Math.round(BODY.x + (i + 1) * 111.6 - 6) - x;
    const sprite = structSprite(hull.type);
    let out = outline(x, y, w, 162, i === 0 ? T.player : T.border);
    const art = ground(groundOf(hull.type), x + 1, y + 1, w - 2, 80)
      + (sprite ? img(sprite, Math.round(x + 1 + (w - 2 - 128) / 2), y + 1 - 24, 128, 128) : icon('deployed-structs', Math.round(x + 1 + (w - 2 - 48) / 2), y + 17, 48));
    out += clip(x + 1, y + 1, w - 2, 80, art);
    const cx = x + w / 2;
    const nm = lines(String(hull.type).toUpperCase(), DZ8, w - 12, 2);
    nm.forEach((l, j) => { out += line(cx, y + 85 + (24 - nm.length * 12) / 2 + j * 12, l, DZ8, { fill: T.hint, anchor: 'middle' }); });
    // Cut to its 24px row as the design's span is: a DirectiveZero comma's tail would touch the line below.
    out += clip(x + 1, y + 111, w - 2, 24, line(cx, y + 111 + (24 - lineOf(kills[i].st)) / 2, kills[i].text, kills[i].st, { fill: T.player, anchor: 'middle' }));
    out += line(cx, y + 137 + (20 - lineOf(lost[i].st)) / 2, lost[i].text, lost[i].st, { fill: T.enemy, anchor: 'middle' });
    return out;
  }).join('');

  const empty = (y) => outline(BODY.x, y, BODY.w, 164, T.borderSubtle)
    + icon('deployed-structs', BODY.x + (BODY.w - 48) / 2, y + 46, 48)
    + line(BODY.x + BODY.w / 2, y + 102, 'No kills or losses yet', ['EH', 8], { lh: 16, fill: T.hint, anchor: 'middle' });

  const body = stack(BODY.y, BODY.h, 10, [[headH, header], shown.length ? [162, columns] : [164, empty]]);
  return previewWindow('Tally', body);
}

/* ── boards: map, simulator ───────────────────────────────────────────────── */

const BOARD_X = BODY.x + 276 + 12, BOARD_W = BODY.w - 276 - 12;
/** Where the board sits in a map or challenge preview, in the window's 1× pixels: a page shows that piece alone. */
export const BOARD = { x: BOARD_X, y: BODY.y + (BODY.h - 216) / 2, w: BOARD_W, h: 216 };

/** Units → per-battleground [ours, theirs], command ship first. */
function bandsOf(units, ours) {
  const bands = {};
  for (const a of AMBITS) bands[a] = [[], []];
  const order = (u) => (u.command ? 0 : u.side === 'planet' ? 1 : 2) * 100 + (u.slot || 0);
  for (const u of [...units].sort((a, b) => order(a) - order(b))) {
    if (!bands[u.ambit]) continue;
    bands[u.ambit][ours(u) ? 0 : 1].push({
      type: u.type, command: !!u.command,
      damaged: u.health != null && u.maxHealth && u.health < u.maxHealth,
      dim: !!u.hidden,
    });
  }
  return bands;
}

/* ── map ──────────────────────────────────────────────────────────────────── */

export function map({ planet, owner, attacker, units, kind, id }) {
  const LW = 276;
  const away = !planet;
  const unnamed = planet && (!planet.name || planet.name === planet.id);
  // A planet whose ore is gone (status 'complete') is no longer anyone's to hold.
  const drained = planet?.status === 'complete';
  const title = away ? `Fleet ${id}` : unnamed ? 'Unnamed planet' : planet.name;
  const titleSt = fit(title, LW, [['EH', 24, 1], ['EH', 16, 2], ['DZ', 16, 2], ['DZ', 8, 2]]);
  const titleLines = lines(title, titleSt, LW, titleSt[2] || 1);
  const badgeLabel = away ? 'Fleet' : 'Planet';
  const idText = away ? '' : '#' + planet.id;

  const who = (pp, room) => {
    const bare = nameOf(pp);
    return label(pp.tag ? [`[${pp.tag}] ${bare}`, bare] : [bare], room);
  };
  const holder = owner ? who(owner, LW - 38 - 8) : null;
  const raider = attacker ? who(attacker, LW - 8 - 12 - 38 - 8) : null;

  const items = away
    ? [['deployed-structs', n(units.filter((u) => u.side !== 'attacker').length), T.body]]
    : [['alpha-ore', reading(U.fmtOre(planet.ore ?? 0)) || '-', T.warning], ['shield-health', n(planet.shield), T.body], ['deployed-structs', n(units.filter((u) => u.side !== 'attacker').length), T.body]];
  // The readings share one size: all three at 16 if they fit the column together, else all at 8.
  const together = (px) => items.reduce((w, it) => w + 28 + textWidth(it[1], 'DZ', px), 0) + 8 * (items.length - 1);
  const readSt = together(16) <= LW ? DZ16 : DZ8;

  const left = [
    [idText ? 20 : 18, (y) => {
      const b = badge(badgeLabel, 'solid', BODY.x, y + (idText ? 1 : 0));
      return b.svg + (idText ? line(BODY.x + b.w + 8, y, idText, DZ16, { fill: T.hint, room: LW - b.w - 8 }) : '');
    }],
    [titleLines.length * lineOf(titleSt), (y) => titleLines.map((l, i) => line(BODY.x, y + i * lineOf(titleSt), l, titleSt, { room: LW })).join('')],
  ];
  if (away) left.push([20, (y) => line(BODY.x, y, 'Away from any planet', DZ16, { fill: T.hint })]);
  if (holder) {
    left.push([38, (y) => {
      const ch = 16 + lineOf(holder.st), cy = y + (38 - ch) / 2;
      return framedPortrait(owner.pfp, BODY.x, y, 36)
        + line(BODY.x + 46, cy, away ? 'Commanded by' : drained ? 'Last held by' : 'Held by', ['EH', 8], { lh: 16, fill: T.hint })
        + line(BODY.x + 46, cy + 16, holder.text, holder.st, { fill: T.player, room: LW - 46 });
    }]);
  }
  left.push([24, (y) => {
    const widths = items.map((it) => 28 + textWidth(it[1], 'DZ', readSt[1]));
    const spare = items.length > 1 ? (LW - widths.reduce((a, b) => a + b, 0)) / (items.length - 1) : 0;
    let x = BODY.x, out = '';
    items.forEach(([ic, text, fill], i) => {
      out += icon(ic, x, y, 24) + line(x + 28, y + (24 - lineOf(readSt)) / 2, text, readSt, { fill });
      x += widths[i] + spare;
    });
    return out;
  }]);
  if (raider) {
    left.push([58, (y) => {
      const ch = 18 + lineOf(raider.st), cy = y + 10 + (38 - ch) / 2;
      return screen(BODY.x, y, LW, 58, { theme: 'enemy', fill: T.enemyBody })
        + framedPortrait(attacker.pfp, BODY.x + 10, y + 10, 36, { border: T.borderEnemy })
        + line(BODY.x + 56, cy, 'Under raid', ['EH', 16], { lh: 16, fill: T.enemy })
        + line(BODY.x + 56, cy + 18, raider.text, raider.st, { fill: T.enemyHighlight, room: LW - 66 });
    }]);
  }

  const body = stack(BODY.y, BODY.h, 8, left)
    + board(BOARD.x, BOARD.y, BOARD.w, bandsOf(units, (u) => u.side !== 'attacker'), { fog: !attacker });
  return previewWindow('Map', body);
}

/* ── provider ─────────────────────────────────────────────────────────────── */

const POLICY_BADGE = { default: 'default', warning: 'warning', destructive: 'destructive' };

export function provider({ provider: p, policy }) {
  const title = `Provider ${p.id}`;
  const pol = badgeFor(policy);
  const TX = BODY.x + 40 + 12, TW = BODY.w - 40 - 12 - pol.w - 12;
  const titleSt = fit(title, TW, [['EH', 24], ['EH', 16], DZ16, DZ8]);

  // The price: an alpha amount as units.js prints it, or a token amount with its thousands grouped.
  const alpha = p.rate.denomLabel === 'alpha';
  const amount = alpha ? reading(p.rate.value) : p.rate.value == null ? null : String(p.rate.value).replace(/\B(?=(\d{3})+$)/g, ',');
  const rateText = amount == null ? null : alpha ? amount : [amount, p.rate.denomLabel].filter(Boolean).join(' ');
  const unitW = textWidth('per block', 'DZ', 16);
  const RATE_ROOM = BODY.w - 24 - 8 - unitW - 16;
  // DirectiveZero 32's descenders (the g of every alpha rate) would cross the band's rule: such text starts at 24.
  const RATE_STEPS = [['EH', 32], ['EH', 24], ['EH', 16], ['DZ', 32], ['DZ', 24], DZ16, DZ8];
  const rate = rateText == null ? null : slot(rateText, RATE_ROOM, /[gjpqy,;]/.test(rateText) ? RATE_STEPS.filter((st) => !(st[0] === 'DZ' && st[1] === 32)) : RATE_STEPS);

  const range = (r) => { const a = reading(r.min) || '-', b = reading(r.max) || '-'; return a === b ? a : `${a}-${b}`; };
  const ROW = BODY.w - 136 - 8;
  const rows = [
    ['Capacity', ['icon', 'energy'], range(p.capacity)],
    ['Duration', ['glyph', 'icon-in-progress'], range(p.duration)],
    ['Agreements', ['glyph', 'icon-member'], n(p.agreements)],
  ].map(([lab, ic, text]) => [lab, ic, text, fit(text, ROW, [DZ16, DZ8])]);

  const o = p.owner || {};
  const guildOwned = /^0-/.test(String(o.id));
  const bare = nameOf(o);
  const idS = bare !== o.id ? ` #${o.id}` : '';
  const ownerLabel = label([(o.tag ? `[${o.tag}] ` : '') + bare + idS, bare + idS, bare], BODY.w - 38 - 8);

  const titleH = lineOf(titleSt) + 2 + 20;
  const headH = Math.max(40, titleH);
  // The column is taller than the body, so the rate band gives way as flex-shrink does in the design: to its content.
  const bandH = Math.min(40, Math.max(rate ? 38 : 26, BODY.h - (headH + 87 + 38 + 3 * 4)));
  const body = stack(BODY.y, BODY.h, 4, [
    [headH, (y) => screen(BODY.x, y + (headH - 40) / 2, 40, 40, { fill: T.surface }) + glyph('icon-transfers', BODY.x + 4, y + (headH - 40) / 2 + 4, 32)
      + line(TX, y + (headH - titleH) / 2, title, titleSt, { room: TW })
      + line(TX, y + (headH - titleH) / 2 + lineOf(titleSt) + 2, `Energy offer - substation ${p.substation}`, DZ16, { fill: T.hint, room: TW })
      + badge(pol.label, pol.mod, BODY.x + BODY.w - pol.w, y).svg],
    [bandH, (y) => {
      const mid = y + bandH / 2;
      let out = hairline(BODY.x, y, BODY.w) + hairline(BODY.x, y + bandH - 1, BODY.w);
      if (!rate) return out + line(BODY.x, mid - 10, 'No rate set', DZ16, { fill: T.hint });
      out += alpha ? icon('alpha-matter', BODY.x, mid - 12, 24) : glyph('icon-guild', BODY.x, mid - 12, 24);
      out += line(BODY.x + 32, mid - lineOf(rate.st) / 2, rate.text, rate.st, { fill: T.player, room: BODY.w - 32 - 8 - unitW });
      out += line(BODY.x + BODY.w, mid - 16, 'per mW', DZ16, { lh: 16, fill: T.hint, anchor: 'end' })
        + line(BODY.x + BODY.w, mid, 'per block', DZ16, { lh: 16, fill: T.hint, anchor: 'end' });
      return out;
    }],
    [87, (y) => rows.map(([lab, ic, text, st], i) => {
      const ry = y + i * 29;
      return hairline(BODY.x, ry + 28, BODY.w)
        + (ic[0] === 'icon' ? icon(ic[1], BODY.x, ry + 2, 24) : glyph(ic[1], BODY.x, ry + 2, 24))
        + line(BODY.x + 30, ry + 2, lab, ['EH', 8], { lh: 24, fill: T.hint })
        + line(BODY.x + BODY.w, ry + (28 - lineOf(st)) / 2, text, st, { anchor: 'end', room: ROW });
    }).join('')],
    [38, (y) => {
      const ch = 16 + lineOf(ownerLabel.st), cy = y + (38 - ch) / 2;
      return framedPortrait(o.pfp, BODY.x, y, 36)
        + line(BODY.x + 46, cy, guildOwned ? 'Offered by guild' : 'Offered by', ['EH', 8], { lh: 16, fill: T.hint })
        + line(BODY.x + 46, cy + 16, ownerLabel.text, ownerLabel.st, { room: BODY.w - 46 });
    }],
  ]);
  return previewWindow('Provider', body);
}

function badgeFor(policy) {
  const label = String(policy?.text || 'Closed');
  const mod = POLICY_BADGE[policy?.mod] || 'destructive';
  return { label, mod, w: textWidth(label, 'EH', 8) + 18 };
}

/* ── reactor ──────────────────────────────────────────────────────────────── */

export function reactor({ reactor: r }) {
  const RX = BODY.x + 152 + 16, RW = BODY.w - 152 - 16;
  const title = `Reactor ${r.id}`;
  const titleSt = fit(title, RW, [['EH', 24], ['EH', 16], DZ16, DZ8]);
  const guild = r.guildLabel || '';
  const guildSt = guild ? fit(guild, RW, [DZ16, DZ8]) : null;
  const ROOM = (RW - 6) / 2 - 14, STEPS = [['EH', 24], ['DZ', 24], DZ16, DZ8];
  const fuel = reading(r.fuel), capacity = reading(r.capacity);
  const mass = fitRow([fuel || '-', capacity || '-'], ROOM, STEPS);
  const share = fitRow([`${r.commissionPct ?? 0}%`, n(r.infusers)], ROOM, STEPS);
  const tiles = [
    ['Alpha infused', ['icon', 'alpha-matter'], mass[0], fuel ? T.player : T.hint, T.player],
    ['Capacity', ['icon', 'energy'], mass[1], capacity ? T.body : T.hint],
    ['Commission', ['glyph', 'icon-guild'], share[0], T.body],
    ['Infusers', ['icon', 'players'], share[1], T.body],
  ];
  const TILE_W = (RW - 6) / 2;

  const right = [[lineOf(titleSt), (y) => line(RX, y, title, titleSt, { room: RW })]];
  if (guild) right.push([lineOf(guildSt), (y) => line(RX, y, guild, guildSt, { fill: T.player, room: RW })]);
  right.push([132, (y) => tiles.map(([lab, ic, v, color, edge], i) => {
    const tx = RX + (i % 2) * (TILE_W + 6), ty = y + 2 + Math.floor(i / 2) * 68;
    return outline(tx, ty, TILE_W, 62, edge || T.border)
      + (ic[0] === 'icon' ? icon(ic[1], tx + 7, ty + 5, 24) : glyph(ic[1], tx + 7, ty + 5, 24))
      + line(tx + 37, ty + 5, lab, ['EH', 8], { lh: 24, fill: T.hint })
      + line(tx + 7, ty + 31 + (24 - lineOf(v.st)) / 2, v.text, v.st, { fill: color, room: ROOM });
  }).join('')]);

  const AY = BODY.y + (BODY.h - 200) / 2;
  const body = screen(BODY.x, AY, 152, 200)
    + tiled('img/tiles/space/space-2-2-middle-middle.png', BODY.x + 4, AY + 4, 144, 192, 128, { fill: T.surface })
    + img('img/reactor-64x92.png', BODY.x + 12, AY + 8, 128, 184)
    + stack(BODY.y, BODY.h, 6, right);
  return previewWindow('Reactor', body);
}

/* ── simulator: challenge and result ──────────────────────────────────────── */

const LEVEL_BADGE = { Easy: 'default', Difficult: 'warning', Hard: 'destructive' };

export function sim(og) {
  return og.result ? simResult(og) : simChallenge(og);
}

function simBoard(units, top = BOARD.y) {
  return board(BOARD.x, top, BOARD.w, bandsOf(units, (u) => u.side !== 'attacker'));
}

function simChallenge({ layout, units, level }) {
  const LW = 276;
  const count = (s) => units.filter((u) => u.side === s).length;
  const you = count('defender'), cpu = count('attacker');
  const charge = layout.charge || {};
  const sideBox = (x, y, who, num, chg, color, edge) => outline(x, y, 135, 70, edge)
    + line(x + 9, y + 7, who, ['EH', 8], { lh: 16, fill: color })
    + line(x + 9, y + 25, String(num), ['EH', 24], { fill: color })
    + glyph('icon-in-progress', x + 126 - 4 - textWidth(String(chg ?? 0), 'DZ', 16) - 24, y + 25, 24)
    + line(x + 126, y + 27, String(chg ?? 0), DZ16, { anchor: 'end' })
    + line(x + 9, y + 51, num === 1 ? 'struct' : 'structs', DZ8, { fill: T.hint });
  const blockS = `${Math.round((layout.blockMs || 6000) / 1000)}s blocks`;

  const body = stack(BODY.y, BODY.h, 8, [
    [18, (y) => badge(level, LEVEL_BADGE[level] || 'default', BODY.x, y).svg],
    [24, (y) => line(BODY.x, y, 'Challenge', ['EH', 24])],
    [70, (y) => sideBox(BODY.x, y, 'You', you, charge.player, T.player, T.player) + sideBox(BODY.x + 141, y, 'Computer', cpu, charge.computer, T.enemy, T.enemy)],
    [24, (y) => glyph('icon-refresh-12', BODY.x, y, 24) + line(BODY.x + 28, y + 2, blockS, DZ16)],
  ]) + simBoard(units);
  return previewWindow('Simulator', body);
}

const sat = (v, top) => (v >= top ? `${v}+` : String(v));

function simResult({ units, level, result }) {
  const LW = 276;
  const { verdict: v, reason } = verdict(result);
  const tone = { Victory: T.player, Defeat: T.enemy, Draw: T.warning }[v];
  const blocks = sat(result.blocks, 65535) + (result.blocks === 1 ? ' block' : ' blocks');
  const meta = `${clock(result.seconds)} - ${blocks}`;
  const b = badge(level, LEVEL_BADGE[level] || 'default', 0, 0);
  const metaInline = b.w + 8 + textWidth(meta, 'DZ', 16) <= LW;
  const reasonLines = lines(reason, DZ16, LW, 3);
  const fielded = { player: units.filter((u) => u.side === 'defender').length, computer: units.filter((u) => u.side === 'attacker').length };
  const st = result.stats || {};
  const rows = [
    ['Lost', [String(st.player?.lost ?? 0), ` of ${fielded.player}`], [String(st.computer?.lost ?? 0), ` of ${fielded.computer}`]],
    ['Attacks', [sat(st.player?.attacks ?? 0, 255), ''], [sat(st.computer?.attacks ?? 0, 255), '']],
    ['Damage', [sat(st.player?.damage ?? 0, 255), ''], [sat(st.computer?.damage ?? 0, 255), '']],
  ];
  const YOU_END = BODY.x + 76 + 16 + 84, CPU_END = YOU_END + 16 + 84;
  const pair = (end, y, [main, rest]) => {
    const wm = textWidth(main, 'DZ', 16), wr = textWidth(rest, 'DZ', 16);
    return line(end - wm - wr, y, main, DZ16) + (rest ? line(end - wr, y, rest, DZ16, { fill: T.hint }) : '');
  };

  let y = BODY.y;
  let body = badge(level, LEVEL_BADGE[level] || 'default', BODY.x, metaInline ? y + 1 : y).svg;
  if (metaInline) { body += line(BODY.x + b.w + 8, y, meta, DZ16, { fill: T.hint }); y += 20 + 6; }
  else { body += line(BODY.x, y + 22, meta, DZ16, { fill: T.hint }); y += 42 + 6; }
  body += line(BODY.x, y, v, ['EH', 32], { fill: tone });
  y += 32 + 6;
  body += reasonLines.map((l, i) => line(BODY.x, y + i * 20, l, DZ16)).join('');

  // The tallies sit at the foot of the column (margin-top: auto).
  let ty = BODY.y + BODY.h - 79;
  body += line(YOU_END, ty, 'Player', ['EH', 8], { lh: 16, fill: T.player, anchor: 'end' })
    + line(CPU_END, ty, 'Computer', ['EH', 8], { lh: 16, fill: T.enemy, anchor: 'end' });
  ty += 16;
  for (const [lab, you, cpu] of rows) {
    body += hairline(BODY.x, ty, LW) + line(BODY.x, ty + 3, lab, ['EH', 8], { lh: 16, fill: T.hint })
      + pair(YOU_END, ty + 1, you) + pair(CPU_END, ty + 1, cpu);
    ty += 21;
  }
  body += simBoard(units, BODY.y);
  return previewWindow('Simulator', body);
}

/* ── home ─────────────────────────────────────────────────────────────────── */

/* The generic card: the mark and the name on the game's starfield, nothing else. */
export function home() {
  const logo = img('img/sui/logo/logo-structs.gif', 204, 36.5, 192, 186, 'filter="url(#logo)"');
  const word = 'Structs';
  const ww = textWidth(word, 'EH', 32) + 7 * 8 - 16;
  return svgDoc(
    tiled('img/tiles/space/space-2-2-middle-middle.png', 0, 0, 1200, 630, 256, { fill: T.surface, ox: 216, oy: 59 })
    + `<defs><filter id="logo" x="0" y="0" width="1" height="1"><feFlood flood-color="${T.logo}"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs>`
    + '<g transform="scale(2)">'
    + logo
    + line((600 - ww) / 2, 228.5, word, ['EH', 32], { spacing: 8 })
    + '</g>',
  );
}
