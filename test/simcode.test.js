import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { encode, decode, COMMAND_TYPE, encodeResult, decodeResult, verdict, clock } from '../src/simcode.js';

const AMBITS = ['space', 'air', 'land', 'water'];

function fullBattle() {
  const units = [];
  for (const side of ['player', 'computer']) {
    units.push({ id: `${side}-cmd`, side, type: COMMAND_TYPE, ambit: 'land', slot: 0, protects: null });
    for (const ambit of AMBITS) {
      for (let slot = 0; slot < 4; slot++) {
        units.push({ id: `${side}-${ambit}-${slot}`, side, type: 2 + ((slot + AMBITS.indexOf(ambit)) % 12), ambit, slot, protects: slot ? `${side}-cmd` : null });
      }
    }
  }
  return { version: 3, seed: 'k3j9x0aa', difficulty: 'hard', blockMs: 6000, charge: { player: 9, computer: 30 }, units };
}

test('a full battle round-trips exactly and fits a chat message', () => {
  const c = fullBattle();
  const code = encode(c);
  assert.deepEqual(decode(code), c);
  assert.ok(code.length < 130, `code is ${code.length} chars`);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
});

test('every difficulty and block time survives', () => {
  for (const difficulty of ['easy', 'difficult', 'hard']) {
    for (const blockMs of [2000, 6000]) {
      const c = { ...fullBattle(), difficulty, blockMs, units: fullBattle().units.slice(0, 3) };
      c.units[2] = { ...c.units[2], protects: null };
      assert.deepEqual(decode(encode(c)), { ...c, units: c.units });
    }
  }
});

test('junk is refused, never half-decoded', () => {
  const code = encode(fullBattle());
  assert.equal(decode(code.slice(0, -2)), null);          // truncated
  assert.equal(decode(code + 'AA'), null);                // trailing bytes
  assert.equal(decode('Ag' + code.slice(2)), null);       // version 2
  assert.equal(decode('!!!'), null);
  assert.throws(() => encode({ ...fullBattle(), seed: 'has space' }));
  assert.throws(() => encode({ ...fullBattle(), charge: { player: 31, computer: 0 } }));
});

/* The codec hard-codes the Command Ship's type id and the fleet type range.
 * Pin both against the simulator's own generated catalogue, when a
 * structs-universe checkout is beside this repo. */
test('type ids agree with the simulator catalogue', (t) => {
  const file = path.resolve(process.env.STRUCTS_UNIVERSE || '../structs-universe', 'frontend/simulator-types.js');
  if (!fs.existsSync(file)) return t.skip('no structs-universe checkout');
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx);
  const types = ctx.window.SimulatorTypes.types;
  assert.equal(types.find((x) => x.type === 'Command Ship').id, COMMAND_TYPE);
  assert.ok(types.every((x) => x.id >= 1 && x.id <= 31), 'type ids fit in 5 bits');
});

/* Results (structs-universe proposals/sim-results-link.md). */
const RESULT = {
  version: 1, winner: 'player', forfeit: false, stalemate: null, revision: 1, blocks: 97, seconds: 194,
  stats: { player: { lost: 2, attacks: 14, damage: 19, evaded: 3, blocked: 2, countered: 5 }, computer: { lost: 4, attacks: 12, damage: 11, evaded: 1, blocked: 1, countered: 4 } },
};

test("a result is the spec's 26 characters and round-trips", () => {
  const code = encodeResult(RESULT);
  assert.equal(code, 'AQABAGEAwgIOEwMCBQQMCwEBBA');   // the spec's own example
  assert.deepEqual(decodeResult(code), RESULT);
});

test('result numbers saturate, never wrap', () => {
  const r = decodeResult(encodeResult({ ...RESULT, blocks: 70000, seconds: 1e9, stats: { player: { lost: 300 }, computer: {} } }));
  assert.equal(r.blocks, 65535);
  assert.equal(r.seconds, 65535);
  assert.equal(r.stats.player.lost, 255);
});

test('impossible results are refused', () => {
  const bytes = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const base = [1, 0, 1, 0, 97, 0, 194, 2, 14, 19, 3, 2, 5, 4, 12, 11, 1, 1, 4];
  assert.ok(decodeResult(bytes(base)));
  assert.equal(decodeResult(bytes([2, ...base.slice(1)])), null);           // unknown version
  assert.equal(decodeResult(bytes([1, 0 | 4, ...base.slice(2)])), null);    // a forfeit the player won
  assert.equal(decodeResult(bytes([1, 0 | (1 << 3), ...base.slice(2)])), null); // a stalemate that is not a draw
  assert.equal(decodeResult(bytes([1, 0x20, ...base.slice(2)])), null);     // reserved bits set
  assert.equal(decodeResult(bytes(base.slice(0, 18))), null);              // short
  assert.equal(decodeResult('!!!'), null);
});

test("a result reads in the debrief's own words", () => {
  assert.deepEqual(verdict(RESULT), { verdict: 'Victory', reason: 'Computer command ship destroyed' });
  assert.equal(verdict({ ...RESULT, winner: 'computer', forfeit: true }).reason, 'Player ended the battle');
  assert.equal(verdict({ ...RESULT, winner: 'draw', stalemate: 'quiet' }).reason, 'Stalemate - 100 blocks without a hit');
  assert.equal(clock(194), '03:14');
  assert.equal(clock(65535), '1092:15+');
});
