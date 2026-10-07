import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, path, appUrl, terminalLine, kindOf } from '../src/links.js';

const canon = (p) => { const l = parse(p); return l && path(l); };

test('a bare id opens its kind\'s default view', () => {
  assert.equal(canon('/1-61'), '/player/1-61');
  assert.equal(canon('/2-21740'), '/map/2-21740');
  assert.equal(canon('/9-61'), '/map/9-61');
  assert.equal(canon('/10-1'), '/provider/10-1');
  assert.equal(canon('/3-1'), '/reactor/3-1');
});

test('both orders are the same link, like the Terminal', () => {
  for (const [a, b] of [['/map/1-61', '/1-61/map'], ['/record/1-61', '/1-61/record'], ['/tally/1-61', '/1-61/tally']]) {
    assert.equal(canon(a), canon(b));
    assert.equal(canon(a), a);
  }
});

test('Terminal aliases resolve to the canonical view', () => {
  assert.equal(canon('/awards/1-61'), '/record/1-61');
  assert.equal(canon('/1-61/achievements'), '/record/1-61');
  assert.equal(canon('/hulls/1-61'), '/tally/1-61');
  assert.equal(canon('/profile/1-61'), '/player/1-61');
  assert.equal(canon('/MAP/1-61'), '/map/1-61');
});

test('a view refuses kinds it cannot show', () => {
  assert.equal(parse('/record/2-5'), null);
  assert.equal(parse('/map/10-1'), null);
  assert.equal(parse('/provider/1-61'), null);
  assert.equal(parse('/5-100'), null);       // structs have no page (yet)
  assert.equal(parse('/1-61/map/extra'), null);
  assert.equal(parse('/nope'), null);
});

test('ids are matched whole, never by prefix', () => {
  // The desktop's prefix-collision bug class: 1-195 must never match 1-1950.
  assert.equal(kindOf('1-195x'), null);
  assert.equal(kindOf('01-61'), 'player');
  assert.equal(kindOf('1-'), null);
  assert.equal(kindOf('99-1'), null);
});

test('structs:// and full https URLs parse to the same link', () => {
  assert.equal(canon('structs://tally/1-61'), '/tally/1-61');
  assert.equal(canon('https://structs.app/1-61/map?x=1#y'), '/map/1-61');
  assert.equal(appUrl(parse('/1-61')), 'structs://player/1-61');
  assert.equal(appUrl(parse('/')), 'structs://');
});

test('every link names the Terminal command that shows it', () => {
  assert.equal(terminalLine(parse('/1-61/record')), 'RECORD 1-61');
  assert.equal(terminalLine(parse('/9-61')), 'MAP 9-61');
});

test('simulator codes are bounded base64url', () => {
  assert.deepEqual(parse('/sim/AQYJ_-x0'), { view: 'sim', code: 'AQYJ_-x0' });
  assert.equal(parse('/sim/abc'), null);
  assert.equal(parse('/sim/a+b/'), null);
  assert.equal(parse('/sim/' + 'A'.repeat(2001)), null);
});
