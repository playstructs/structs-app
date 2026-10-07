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
