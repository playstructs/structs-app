/* Simulator challenge codes, small enough for a chat message.
 *
 * The simulator's own layout code (frontend/simulator.js `layoutCode`) is the
 * whole config as JSON — fine for copy/paste, far too long for a link that has
 * to survive Discord's 2,000-character message. This packs the same config
 * into bytes and base64url:
 *
 *   0      version (1)
 *   1      difficulty (bits 0-1: easy|difficult|hard) · block time (bit 2: 2 s|6 s)
 *   2, 3   charge: player, computer (0-30)
 *   4      seed length n (0-60), then n bytes of printable ASCII
 *   …      unit count, then 2 bytes per unit, big-endian:
 *            side 1 · type 5 · ambit 2 · slot 2 · protects 6 (0 = none, else index + 1)
 *
 * A full 34-unit battle is ~110 characters. Decoding returns the version-3
 * layout JSON the simulator already loads, so its own `validate()` remains the
 * judge of whether a layout is legal; this only refuses what it cannot
 * represent.
 *
 * Pure, browser and Node alike (btoa/atob are global in both).
 */

export const VERSION = 1;
const LEVELS = ['easy', 'difficult', 'hard'];
const BLOCK_MS = [2000, 6000];
const SIDES = ['player', 'computer'];
const AMBITS = ['space', 'air', 'land', 'water'];
/* The Command Ship's struct type id (structs-pg struct_type, simulator-types.js).
 * Its unit id is `<side>-cmd` rather than `<side>-<ambit>-<slot>`. */
export const COMMAND_TYPE = 1;
const MAX_CHARGE = 30;
const MAX_UNITS = 34;

function unitId(side, type, ambit, slot) {
  return side + '-' + (type === COMMAND_TYPE ? 'cmd' : ambit + '-' + slot);
}

function toB64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Layout config (as the simulator holds it) → compact code. Throws on anything unrepresentable. */
export function encode(c) {
  const lvl = LEVELS.indexOf(c.difficulty);
  const blk = BLOCK_MS.indexOf(c.blockMs);
  if (lvl < 0 || blk < 0) throw Error('unsupported difficulty or block time');
  const seed = String(c.seed || '');
  if (seed.length > 60 || !/^[\x21-\x7e]*$/.test(seed)) throw Error('unsupported seed');
  const units = c.units || [];
  if (units.length > MAX_UNITS) throw Error('too many units');
  const index = new Map(units.map((u, i) => [u.id, i]));

  const out = [VERSION, lvl | (blk << 2), charge(c.charge.player), charge(c.charge.computer), seed.length];
  for (const ch of seed) out.push(ch.charCodeAt(0));
  out.push(units.length);
  for (const u of units) {
    const side = SIDES.indexOf(u.side), ambit = AMBITS.indexOf(u.ambit);
    const prot = u.protects == null ? 0 : (index.has(u.protects) ? index.get(u.protects) + 1 : -1);
    if (side < 0 || ambit < 0 || !(u.type >= 1 && u.type <= 31) || !(u.slot >= 0 && u.slot <= 3) || prot < 0) {
      throw Error('unsupported unit');
    }
    const v = (side << 15) | (u.type << 10) | (ambit << 8) | (u.slot << 6) | prot;
    out.push(v >> 8, v & 0xff);
  }
  return toB64url(out);
}

function charge(n) {
  if (!Number.isInteger(n) || n < 0 || n > MAX_CHARGE) throw Error('unsupported charge');
  return n;
}

/** Compact code → version-3 layout JSON, or null if it is not a code. */
export function decode(code) {
  let b;
  try { b = fromB64url(String(code)); } catch { return null; }
  let i = 0;
  const next = () => { if (i >= b.length) throw Error('short'); return b[i++]; };
  try {
    if (next() !== VERSION) return null;
    const flags = next();
    const difficulty = LEVELS[flags & 3], blockMs = BLOCK_MS[(flags >> 2) & 1];
    const player = next(), computer = next();
    if (!difficulty || player > MAX_CHARGE || computer > MAX_CHARGE) return null;
    const n = next();
    if (n > 60) return null;
    let seed = '';
    for (let k = 0; k < n; k++) {
      const ch = next();
      if (ch < 0x21 || ch > 0x7e) return null;
      seed += String.fromCharCode(ch);
    }
    const count = next();
    if (count > MAX_UNITS) return null;
    const raw = [];
    for (let k = 0; k < count; k++) {
      const v = (next() << 8) | next();
      raw.push({
        side: SIDES[v >> 15], type: (v >> 10) & 31, ambit: AMBITS[(v >> 8) & 3],
        slot: (v >> 6) & 3, prot: v & 63,
      });
    }
    if (i !== b.length) return null;
    const units = raw.map((u) => ({
      id: unitId(u.side, u.type, u.ambit, u.slot), side: u.side, type: u.type, ambit: u.ambit, slot: u.slot, protects: null,
    }));
    raw.forEach((u, k) => {
      if (u.prot === 0) return;
      const target = units[u.prot - 1];
      if (!target) throw Error('bad protects');
      units[k].protects = target.id;
    });
    return { version: 3, seed, difficulty, blockMs, charge: { player, computer }, units };
  } catch {
    return null;
  }
}

/* ── Results: https://structs.app/sim/<code>/<result> ─────────────────────
 * How a battle went, appended to the battle's own link as one more path
 * segment (structs-universe proposals/sim-results-link.md; the codec is
 * frontend/simcode.js's, copied as it is). 19 bytes, 26 characters:
 *
 *   0      version (1)
 *   1      outcome: bits 0-1 winner (0 player · 1 computer · 2 draw),
 *          bit 2 forfeit, bits 3-4 stalemate (0 none · 1 moves · 2 quiet)
 *   2      rules revision (the simulator's combat + computer tuning)
 *   3, 4   blocks played, uint16
 *   5, 6   battle seconds, uint16
 *   7-12   player:   lost, attacks, damage, evaded, blocked, counter damage
 *   13-18  computer: the same six
 *
 * Numbers saturate (255 / 65535) rather than wrap. Self-reported: a result
 * is a claim, not a proof — battles are not replayable. */
export const RESULT_VERSION = 1;
export const RULES_REVISION = 1;            // 2026-10-07: land opening, tuned computer
const WINNERS = ['player', 'computer', 'draw'];
const STALEMATES = [null, 'moves', 'quiet'];
const TALLY = ['lost', 'attacks', 'damage', 'evaded', 'blocked', 'countered'];
const u8 = (n) => { n = Math.floor(Number(n) || 0); return n < 0 ? 0 : n > 255 ? 255 : n; };
const u16 = (n) => { n = Math.floor(Number(n) || 0); return n < 0 ? 0 : n > 65535 ? 65535 : n; };

/** A result → its 26-character code. Throws on an outcome the format cannot hold. */
export function encodeResult(r) {
  const w = WINNERS.indexOf(r.winner), st = STALEMATES.indexOf(r.stalemate || null);
  if (w < 0 || st < 0) throw Error('unsupported result');
  const out = [RESULT_VERSION, w | (r.forfeit ? 4 : 0) | (st << 3), u8(r.revision == null ? RULES_REVISION : r.revision)];
  const blocks = u16(r.blocks), secs = u16(r.seconds);
  out.push(blocks >> 8, blocks & 0xff, secs >> 8, secs & 0xff);
  for (const side of ['player', 'computer']) {
    const t = (r.stats && r.stats[side]) || {};
    for (const k of TALLY) out.push(u8(t[k]));
  }
  return toB64url(out);
}

/** A result code → the result, or null for anything that is not a valid version-1 result. */
export function decodeResult(code) {
  let b;
  try { b = fromB64url(String(code)); } catch { return null; }
  if (b.length !== 19 || b[0] !== RESULT_VERSION || (b[1] & 0xe0)) return null;
  const winner = WINNERS[b[1] & 3], stalemate = STALEMATES[(b[1] >> 3) & 3], forfeit = !!(b[1] & 4);
  if (!winner || stalemate === undefined) return null;
  if (forfeit && winner !== 'computer') return null;
  if (stalemate && winner !== 'draw') return null;
  const stats = {};
  let i = 7;
  for (const side of ['player', 'computer']) { stats[side] = {}; for (const k of TALLY) stats[side][k] = b[i++]; }
  return { version: RESULT_VERSION, winner, forfeit, stalemate, revision: b[2], blocks: (b[3] << 8) | b[4], seconds: (b[5] << 8) | b[6], stats };
}

/* The debrief's own words (structs-universe frontend/simulator.js showDebrief), told in the third person:
 * a shared result is read by people who did not play it, so "you" becomes "player". */
const QUIET_MOVES = 10, QUIET_BLOCKS = 100;
export function verdict(r) {
  const v = r.winner === 'player' ? 'Victory' : r.winner === 'computer' ? 'Defeat' : 'Draw';
  const reason = r.forfeit ? 'Player ended the battle'
    : v === 'Victory' ? 'Computer command ship destroyed'
    : v === 'Defeat' ? 'Player command ship destroyed'
    : r.stalemate === 'quiet' ? `Stalemate - ${QUIET_BLOCKS} blocks without a hit`
    : r.stalemate === 'moves' ? `Stalemate - ${QUIET_MOVES} command ship moves without a hit`
    : 'Both command ships destroyed';
  return { verdict: v, reason };
}

/** The simulator's clock, mm:ss with unbounded minutes; the saturated top value reads "at least". */
export function clock(sec) {
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0') + (sec >= 65535 ? '+' : '');
}
