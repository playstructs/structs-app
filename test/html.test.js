import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as samples from './fixtures/og-samples.js';
import { homePage, linkPage, notFoundPage, sitemap } from '../src/html.js';

/* Every page, for every sample the previews are tested with: complete HTML,
 * everything a crawler reads, the way into the app, and nothing leaking from
 * a missing value. (How the pages fit at phone and desktop widths is checked
 * in a browser; see README.) */

const release = {
  version: '0.1.458', url: 'https://github.com/playstructs/structs-desktop/releases/tag/v0.1.458',
  downloads: [
    { key: 'mac-arm', label: 'macOS', sub: 'Apple silicon', url: 'https://example.invalid/a.dmg', size: 1 },
    { key: 'mac-intel', label: 'macOS', sub: 'Intel', url: 'https://example.invalid/b.dmg', size: 1 },
    { key: 'windows', label: 'Windows', sub: '64-bit installer', url: 'https://example.invalid/c.exe', size: 1 },
    { key: 'linux-appimage', label: 'Linux', sub: 'AppImage', url: 'https://example.invalid/d.AppImage', size: 1 },
  ],
};
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const SIM = 'AQUJDgRkZW1vEgQACAAMQBkAHUAmACJALwA3QIQAiACMQJkAnUCmAKJArwC3QA';

const LINK = {
  player: (og) => ({ view: 'player', id: og.player.id, kind: 'player' }),
  record: (og) => ({ view: 'record', id: og.player.id, kind: 'player' }),
  tally: (og) => ({ view: 'tally', id: og.player.id, kind: 'player' }),
  map: (og) => ({ view: 'map', id: og.id, kind: og.kind }),
  provider: (og) => ({ view: 'provider', id: og.provider.id, kind: 'provider' }),
  reactor: (og) => ({ view: 'reactor', id: og.reactor.id, kind: 'reactor' }),
  sim: () => ({ view: 'sim', code: SIM }),
  simResult: () => ({ view: 'sim', code: SIM, result: 'AQABAGEAwgIOEwAAAAkMCwAAAA' }),
};

function complete(html) {
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<\/html>$/);
  for (const tag of ['<title>', 'rel="canonical"', 'property="og:image"', 'property="og:title"', 'name="twitter:card"', '<h1', '<main']) assert.ok(html.includes(tag), `missing ${tag}`);
  assert.doesNotMatch(html, /undefined|NaN|\[object Object\]|>null</);
  assert.match(html, /<link rel="stylesheet" href="\/css\/sui\/sui\.css\?v=[0-9a-f]{10}">/);
}

for (const [card, set] of Object.entries(samples)) {
  if (card === 'LINKS' || card === 'home') continue;
  for (const [name, og] of Object.entries(set)) {
    test(`${card} · ${name}: a complete page with the way into the app`, () => {
      const link = LINK[card](og);
      const html = linkPage(link, { title: 'A title · Structs', description: 'A description.', model: { player: og.player }, og }, release, MAC);
      complete(html);
      assert.match(html, /id="open-app" class="sui-screen-btn sui-mod-primary" href="structs:\/\//);
      assert.match(html, /id="get-app"[^>]*href="https:\/\/example\.invalid\/a\.dmg"/);   // the Mac download, for a Mac
      if (card !== 'sim' && card !== 'simResult') assert.match(html, /In the Terminal: <code>[A-Z]+ /);
    });
  }
}

test('a result page plays its battle, not the result', () => {
  const og = samples.simResult.typical;
  const html = linkPage(LINK.simResult(og), { title: 'Victory vs Hard in 03:14 · Structs', description: 'Lost 2 of 6 structs, 97 blocks. Can you beat it?', model: {}, og }, release, MAC);
  assert.match(html, new RegExp(`href="structs://sim/${SIM}" data-app-url="structs://sim/${SIM}"><i class="sui-icon-md icon-link-out" aria-hidden="true"></i>Play this battle`));
  assert.match(html, />Player<\/span>/);
  assert.match(html, /Computer command ship destroyed/);
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.match(html, /Share this result<\/span>\s*<button[^>]*data-copy="[^"]*\/sim\/[^"]+\/AQAB/);
});

test('a result the loader rejected is not passed on: canonical, preview and app all get the plain battle', () => {
  const og = samples.sim.typical;
  const html = linkPage({ view: 'sim', code: SIM, result: 'AAAA' }, { title: 'Simulator challenge · Hard · Structs', description: 'x', model: {}, og }, release, MAC);
  assert.doesNotMatch(html, /AAAA/);
  assert.match(html, new RegExp(`rel="canonical" href="[^"]*/sim/${SIM}"`));
  assert.match(html, /Share this battle/);
});

test('a player with no planet has no Home planet row', () => {
  const og = samples.player.typical;
  const page = (planetId) => linkPage(LINK.player(og), { title: 'x · Structs', description: 'x', model: { player: og.player }, og: { ...og, player: { ...og.player, planetId } } }, release, MAC);
  assert.match(page('2-1'), /Home planet/);
  assert.doesNotMatch(page(null), /Home planet/);
  assert.doesNotMatch(page(''), /Home planet/);
});

test("other players' names are data, never markup", () => {
  const og = { ...samples.player.typical, player: { ...samples.player.typical.player, name: '<script>alert(1)</script>', guildLabel: '[A&B] "Quoted" <b>' } };
  const html = linkPage(LINK.player(og), { title: 'x · Structs', description: 'x', model: { player: og.player }, og }, release, MAC);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('[A&amp;B] &quot;Quoted&quot; &lt;b&gt;'));
});

test('the home and not-found pages offer the app, and the platforms this visitor is not on', () => {
  const home = homePage(release, MAC);
  complete(home);
  assert.match(home, /Download for macOS/);
  assert.match(home, /Also for <a[^>]*>Windows<\/a>, <a[^>]*>Linux<\/a> and <a[^>]*>Intel Mac<\/a>/);
  assert.match(home, /v0\.1\.458/);
  assert.doesNotMatch(home, /AI agents|structs\.ai/i);
  const lost = notFoundPage(release, 'curl/8');
  complete(lost);
  assert.match(lost, /Nothing at these coordinates/);
  assert.match(lost, /Download Structs/);                 // no platform to guess from
  assert.match(lost, /noindex/);
});

test('the sitemap is a sitemap', () => {
  assert.match(sitemap(['/player/1-61']), /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"><url><loc>https?:\/\/[^<]+\/<\/loc><\/url><url><loc>[^<]+\/player\/1-61<\/loc><\/url><\/urlset>/);
});
