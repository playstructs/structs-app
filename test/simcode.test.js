import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { encode, decode, COMMAND_TYPE } from '../src/simcode.js';

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
