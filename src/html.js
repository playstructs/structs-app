/* The pages: one SUI window each — a panel holding a nav screen and a body
 * screen, centred on the game's page texture — as the design canvas draws
 * them.
 *
 * The home page gets people into the desktop app. A link's page shows its
 * subject in the game's own card frame (sui-planet-card / pc-card, the
 * markup playercard.js builds), the way into the app, the Terminal command
 * for the same thing, and the subject's other links. Where the subject is a
 * board (a map, a battle) the card carries the link's own preview picture.
 *
 * Everything is server-rendered: title, description, canonical, Open Graph,
 * Twitter, JSON-LD and the h1 are all in the HTML, and the page is complete
 * without JavaScript (site.js only brings the download forward when the app
 * is not installed, and copies the link).
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { appUrl, path as linkPath, VIEWS } from './links.js';
import { forAgent, RELEASES_PAGE } from './release.js';
import { verdict, clock } from './simcode.js';
import { reading, textWidth } from './og/draw.js';
import '../public/shared/units.js';
import '../public/shared/pfp.js';

const U = globalThis.StructsUnits;
const Pfp = globalThis.StructsPfp;

export const ORIGIN = (process.env.PUBLIC_ORIGIN || 'https://structs.app').replace(/\/$/, '');
const SITE = 'Structs';
const THEME = '#43CDB6';   // --accent-primary: also the colour of a Discord embed's edge
const PLAY_URL = 'https://beta.playstructs.com';
const ABOUT_URL = 'https://playstructs.com';

export function h(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* JSON inside <script>: `<` escaped so a name like "</script>" stays data. */
function json(v) {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/* Previews change as the game does. A ten-minute bucket in the image URL
 * lets a re-shared link pick up a fresh picture without defeating the cache
 * for everybody fetching the same unfurl at once. */
function ogImage(link) {
  const bucket = Math.floor(Date.now() / 600000).toString(36);
  const p = link.view === 'home' ? '/og/home.png' : `/og${linkPath(link)}.png`;
  return `${ORIGIN}${p}?t=${bucket}`;
}

const NAV_LABEL = { player: 'Player', map: 'Map', record: 'Record', tally: 'Tally', provider: 'Provider', reactor: 'Reactor', sim: 'Simulator' };

/* The game's own stylesheets (synced from structs-webapp and structs-universe), then ours. Each URL carries
 * a hash of its file, so a deploy never pairs new pages with a day-old cached stylesheet. */
const PUBLIC = new URL('../public/', import.meta.url);
function versioned(p) {
  try { return `${p}?v=${crypto.createHash('sha1').update(fs.readFileSync(new URL('.' + p, PUBLIC))).digest('hex').slice(0, 10)}`; } catch { return p; }
}
const STYLES = ['/css/sui/sui.css', '/css/structicons.css', '/shared/playercard.css', '/site.css'].map(versioned);
const SCRIPT = versioned('/site.js');

function head({ title, description, canonical, image, imageAlt, noindex, ld }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${h(title)}</title>
<meta name="description" content="${h(description)}">
<link rel="canonical" href="${h(canonical)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta name="theme-color" content="${THEME}">
<meta property="og:site_name" content="${SITE}">
<meta property="og:type" content="website">
<meta property="og:title" content="${h(title)}">
<meta property="og:description" content="${h(description)}">
<meta property="og:url" content="${h(canonical)}">
<meta property="og:image" content="${h(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${h(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${h(title)}">
<meta name="twitter:description" content="${h(description)}">
<meta name="twitter:image" content="${h(image)}">
<meta name="twitter:image:alt" content="${h(imageAlt)}">
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/img/sui/logo/logo-structs.gif">
<base href="/">
${STYLES.map((s) => `<link rel="stylesheet" href="${s}">`).join('\n')}
${ld ? `<script type="application/ld+json">${json(ld)}</script>` : ''}
</head>`;
}

/* ── the window ───────────────────────────────────────────────────────── */

/* `.sui-panel` > nav screen + body screen. The nav names the view; the
 * playstructs.com link is for people who have never heard of the game. */
function frame(navLabel, body, { home = false } = {}) {
  const items = navLabel
    ? `<a class="sui-screen-nav-item" href="/">Structs</a><span class="sui-screen-nav-item sui-mod-active">${h(navLabel)}</span>`
    : '<span class="sui-screen-nav-item sui-mod-active">Structs</span>';
  return `<body>
<div class="site">
  <div class="site-scale${home ? ' site-mod-home' : ''}">
    <div class="sui-panel sui-theme-player">
      <div class="sui-panel-edge-left"></div>
      <div class="sui-panel-chunk sui-mod-grow sui-mod-shrink">
        <div class="sui-screen sui-screen-full-width">
          <nav class="sui-screen-nav site-nav" aria-label="Site">
            <div class="sui-screen-nav-items">${items}</div>
            <a class="sui-screen-nav-item" href="${ABOUT_URL}" rel="noopener">${home ? 'About the game' : 'About'}</a>
          </nav>
        </div>
        <div class="sui-screen sui-screen-full-width">
          <main class="sui-page-body-screen site-body${home ? ' site-mod-home' : ''}">
${body}
          </main>
        </div>
      </div>
      <div class="sui-panel-edge-right"></div>
    </div>
  </div>
</div>
<script src="${SCRIPT}" defer></script>
</body>
</html>`;
}

/* ── downloads ────────────────────────────────────────────────────────── */

const SHORT = { 'mac-arm': 'macOS', 'mac-intel': 'Intel Mac', windows: 'Windows', 'linux-appimage': 'Linux' };

/* The other platforms, as a phrase: "Windows, Linux and Intel Mac". */
function others(release, best) {
  const links = release.downloads.filter((d) => SHORT[d.key] && d !== best).map((d) => `<a href="${h(d.url)}">${h(SHORT[d.key])}</a>`);
  if (!links.length) return '';
  return links.length === 1 ? links[0] : `${links.slice(0, -1).join(', ')} and ${links[links.length - 1]}`;
}

/* The download that suits this visitor, or the releases page. */
function getApp(release, ua, { primary, label } = {}) {
  const best = forAgent(release, ua);
  const cls = `sui-screen-btn ${primary ? 'sui-mod-primary' : 'sui-mod-secondary'}`;
  const text = label || (best ? `Download for ${SHORT[best.key] || best.label}` : 'Download Structs');
  return { best, html: `<a id="get-app" class="${cls}" href="${h(best ? best.url : release.url || RELEASES_PAGE)}"${best ? '' : ' rel="noopener"'}><i class="sui-icon-md icon-computer"></i>${h(text)}</a>` };
}

/* ── home ─────────────────────────────────────────────────────────────── */

export function homePage(release, ua) {
  const title = 'Structs — a 5X space strategy game';
  const description = 'Download Structs for macOS, Windows and Linux, or play in your browser.';
  const ld = [{
    '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: ORIGIN + '/',
  }, {
    '@context': 'https://schema.org', '@type': ['VideoGame', 'SoftwareApplication'],
    name: SITE, url: ABOUT_URL, description,
    applicationCategory: 'GameApplication', genre: ['Strategy', '4X'], gamePlatform: ['macOS', 'Windows', 'Linux', 'Web browser'],
    operatingSystem: 'macOS, Windows, Linux',
    ...(release.version ? { softwareVersion: release.version, downloadUrl: release.url } : {}),
    image: ogImage({ view: 'home' }),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    sameAs: [ABOUT_URL, 'https://github.com/playstructs'],
  }];
  const body = hero('Structs', null, release, ua);
  return head({ title, description, canonical: ORIGIN + '/', image: ogImage({ view: 'home' }), imageAlt: 'Structs', ld })
    + frame('', body, { home: true });
}

/* The mark on the starfield, a heading, an optional line, and the way in. */
function hero(heading, line, release, ua) {
  const get = getApp(release, ua, { primary: true });
  const also = others(release, get.best);
  const version = release.version
    ? `v${h(release.version)} - <a href="${h(release.url)}" rel="noopener">all releases</a> - `
    : `<a href="${h(release.url || RELEASES_PAGE)}" rel="noopener">all releases</a> - `;
  return `            <div class="site-hero"><img class="site-logo" src="/img/sui/logo/logo-structs.gif" alt="" width="128" height="124"></div>
            <div class="site-home">
              <h1 class="sui-text-display">${h(heading)}</h1>
              ${line ? `<p class="sui-text-paragraph">${h(line)}</p>` : ''}
              <div class="site-buttons">
                ${get.html}
                <a id="open-app" class="sui-screen-btn sui-mod-secondary" href="structs://" data-app-url="structs://"><i class="sui-icon-md icon-link-out"></i>Open Structs</a>
              </div>
              ${also ? `<p class="sui-text-paragraph sui-text-hint site-also">Also for ${also}</p>` : ''}
              <p class="sui-text-tiny sui-text-hint site-also">${version}<a href="${PLAY_URL}" rel="noopener">play in your browser</a></p>
            </div>`;
}

export function notFoundPage(release, ua) {
  const body = hero('Nothing at these coordinates', null, release, ua);
  return head({ title: 'Not found · Structs', description: 'That link does not point at anything in Structs.', canonical: ORIGIN + '/', image: ogImage({ view: 'home' }), imageAlt: 'Structs', noindex: true })
    + frame('', body, { home: true });
}

/* ── a link's page ────────────────────────────────────────────────────── */

const n = (v) => Number(v == null ? 0 : v).toLocaleString('en-US');
const guildLine = (tag, name) => [tag ? `[${tag}]` : '', name || ''].filter(Boolean).join(' ');

/* A portrait (`.pc-pfp`): the five pfp layers, or the placeholder. */
function portrait(attrsJson, size = 72) {
  let pfp = null;
  try { pfp = typeof attrsJson === 'string' ? JSON.parse(attrsJson) : attrsJson; } catch { pfp = null; }
  const layers = pfp && typeof pfp === 'object' && Pfp.isLayer('head', pfp.head)
    ? Pfp.PFP_LAYERS.filter((part) => Pfp.isLayer(part, pfp[part])).map((part) => '/' + Pfp.layerSrc(part, pfp[part]))
    : ['/img/portrait-placeholder.png'];
  const style = size === 72 ? '' : ` style="width: ${size}px; height: ${size}px"`;
  return `<div class="pc-pfp"${style}>${layers.map((src) => `<img class="pfp-viewer-layer" src="${h(src)}" alt=""${style}>`).join('')}</div>`;
}

/* The game's 5-chunk battery (ChargeCalculator thresholds, as playercard.js). */
const LEVELS = [0, 1, 2, 3, 5, 8];
function battery(charge) {
  if (charge == null) return '';
  let lvl = LEVELS.length - 1;
  for (let i = 0; i < LEVELS.length; i++) if (charge <= LEVELS[i]) { lvl = i; break; }
  return `<div class="sui-screen-battery pc-batt" title="Charge">${[0, 1, 2, 3, 4].map((i) => `<div class="sui-battery-chunk${i < lvl ? ' sui-mod-filled' : ''}"></div>`).join('')}</div>`;
}

const res = (value, icon, title) => `<span class="pc-res" title="${h(title)}">${h(value)} ${icon}</span>`;
/* A record figure; one too wide for its 84px column (DirectiveZero 16, measured as the previews measure) steps down to 8. */
const rec = (value, label, accent) => `<div class="pc-rec"><div class="pc-rec-v${textWidth(value, 'DZ', 16) > 84 ? ' site-mod-small' : ''}"${accent ? ' style="color: var(--text-player-primary)"' : ''}>${h(value)}</div><div class="pc-rec-l">${h(label)}</div></div>`;

/* `.sui-planet-card.pc-card`: the title block (the h1, the id, a third line), a badge, then the body. */
function card({ name, id, sub, badge, body, wrapId }) {
  return `<section class="sui-planet-card pc-card" aria-label="${h(name)}">
              <div class="sui-planet-card-header">
                <div class="sui-planet-card-header-label">
                  <div class="sui-planet-card-header-label-title">
                    <h1 class="pc-name"><span class="pc-nm">${h(name)}</span></h1>
                    ${id ? `<span class="pc-id${wrapId ? ' site-wrap' : ''}">${h(id)}</span>` : ''}
                    ${sub ? `<span class="pc-guild">${h(sub)}</span>` : ''}
                  </div>
                </div>
                ${badge ? `<span class="sui-badge ${badge.mod || 'sui-mod-solid'}">${h(badge.text)}</span>` : ''}
              </div>
              <div class="sui-planet-card-body">
${body}
              </div>
            </section>`;
}

/* The way in: open this link in the app, or get the app. */
function doors(link, release, ua, { open = 'Open in Structs', target } = {}) {
  const url = appUrl(target || link);
  return `<div class="sui-screen-btn-flex-wrapper">
                  ${getApp(release, ua, { label: 'Get the app' }).html}
                  <a id="open-app" class="sui-screen-btn sui-mod-primary" href="${h(url)}" data-app-url="${h(url)}"><i class="sui-icon-md icon-link-out"></i>${h(open)}</a>
                </div>`;
}

/* A person's card head: name (or id), id, guild. */
function who(p) {
  const named = p.name && p.name !== p.id;
  return { name: named ? p.name : p.id, id: named ? '#' + p.id : '', sub: p.guildLabel || guildLine(p.tag, '') };
}

function playerBody(p, extra) {
  const alpha = reading(U.fmtAlpha(p.alpha));
  return `                <div class="sui-planet-card-body-content pc-body">
                  ${portrait(p.pfp)}
                  <div class="pc-reads">
                    ${battery(p.charge)}
                    ${res(alpha == null ? '-' : alpha, '<i class="sui-icon sui-icon-alpha-matter"></i>', 'Alpha Matter')}
                    ${res(n(p.structs), '<i class="sui-icon sui-icon-deployed-structs"></i>', 'Structs')}
                  </div>
                </div>
${extra}`;
}

const SPRITE = (type) => {
  const k = String(type || '').toLowerCase().trim();
  const DIRS = { 'command ship': 'cmd-ship', 'high altitude interceptor': 'interceptor', 'ore extractor': 'extractor', 'ore refinery': 'refinery', 'orbital shield generator': 'orb-shield', 'jamming satellite': 'jamming-sat', 'planetary defense cannon': 'pdc', 'field generator': 'generator' };
  const slug = DIRS[k] || k.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `/img/structs/${slug}/${slug}-struct-base.png`;
};
const GROUND = { 'command ship': 'space', battleship: 'space', starfighter: 'space', frigate: 'space', 'pursuit fighter': 'air', 'stealth bomber': 'air', 'high altitude interceptor': 'air', 'mobile artillery': 'land', tank: 'land', 'sam launcher': 'land', cruiser: 'water', destroyer: 'water', submersible: 'water', 'orbital shield generator': 'space', 'jamming satellite': 'space' };
const NO_ART = new Set(['continental power plant', 'world engine']);

/* A 48×32 window onto a piece of game art on its own ground. */
function art(kind, value, ground = 'space') {
  if (kind === 'pfp') return `<span class="site-art t-${ground}">${portrait(value, 32)}</span>`;
  if (kind === 'icon') return `<span class="site-art t-${ground}"><i class="sui-icon ${value}"></i></span>`;
  return `<span class="site-art t-${ground}"><img src="${h(value)}" alt=""></span>`;
}

/* The subject's other links, each with a picture of what it opens. */
function more(title, rows) {
  const list = rows.filter(Boolean);
  if (!list.length) return '';
  return `            <section class="site-more" aria-label="${h(title)}">
              <h2 class="sui-text-header sui-text-hint">${h(title)}</h2>
${list.map((r) => `              <a class="site-row" href="${h(r.href)}">
                ${r.art}
                <span class="site-row-text">
                  <span class="sui-text-label">${h(r.label)}</span>
                  <span class="sui-text-tiny sui-text-hint site-one" data-ellipsis>${h(ORIGIN.replace(/^https?:\/\//, '') + r.href)}</span>
                </span>
                <i class="sui-icon-md icon-chevron-right"></i>
              </a>`).join('\n')}
            </section>`;
}


function playerRows(p, here) {
  return [
    here !== 'player' && { href: `/player/${p.id}`, label: 'Profile', art: art('pfp', p.pfp) },
    here !== 'map' && { href: `/map/${p.id}`, label: 'Home planet', art: art('sprite', SPRITE('Command Ship'), 'space') },
    here !== 'record' && { href: `/record/${p.id}`, label: 'Record', art: art('icon', 'sui-icon-destroyed') },
    here !== 'tally' && { href: `/tally/${p.id}`, label: 'Tally', art: art('sprite', SPRITE('Tank'), 'land') },
  ];
}

/* The view's card, and the rows of the subject's other links. */
const CARD = {
  player(link, og, ctx) {
    const p = og.player, c = og.counters || {};
    const w = who(p);
    const extra = `                <div class="pc-record">
                  ${rec(n(c.kills), 'Kills', true)}${rec(n(c.cmd_kills), 'Cmd kills')}${rec(n(c.raids_won), 'Raids won')}${rec(reading(U.fmtOre(c.ore_seized ?? 0)) || '0g', 'Seized')}
                </div>
                ${ctx.doors}`;
    return { card: card({ ...w, badge: { text: 'Player' }, body: playerBody(p, extra) }), more: more(`More on ${w.name}`, playerRows(p, 'player')) };
  },
  record(link, og, ctx) {
    const p = og.player, c = og.counters || {};
    const w = who(p);
    const extra = `                <div class="pc-record">
                  ${rec(n(c.kills), 'Kills', true)}${rec(n(c.cmd_kills), 'Cmd kills')}${rec(n(c.raids_won), 'Raids won')}${rec(n(c.raids_repelled), 'Repelled')}
                </div>
                <div class="pc-record">
                  ${rec(reading(U.fmtOre(c.ore_seized ?? 0)) || '0g', 'Seized')}${rec(reading(U.fmtAlpha(c.alpha_refined ?? 0)) || '0g', 'Refined')}${rec(n(c.structs_built), 'Built')}${rec(n(c.damage_dealt), 'Damage')}
                </div>
                ${ctx.doors}`;
    return { card: card({ ...w, badge: { text: 'Record' }, body: playerBody(p, extra) }), more: more(`More on ${w.name}`, playerRows(p, 'record')) };
  },
  tally(link, og, ctx) {
    const p = og.player;
    const w = who(p);
    // Kills by hull: the hulls that killed or were lost, most kills first (losses break ties).
    const hulls = (og.hulls || []).filter((x) => x.kills || x.lost)
      .sort((a, b) => (b.kills || 0) - (a.kills || 0) || (b.lost || 0) - (a.lost || 0));
    const list = hulls.length
      ? `<ul class="site-hulls" aria-label="Kills by hull">
${hulls.map((x) => {
    const k = String(x.type || '').toLowerCase();
    const pic = NO_ART.has(k) ? art('icon', 'sui-icon-deployed-structs', 'land') : art('sprite', SPRITE(x.type), GROUND[k] || 'land');
    return `                  <li class="site-hull">${pic}<span class="sui-text-label">${h(x.type)}</span><span class="pc-rec-v">${h(n(x.kills))}</span><span class="sui-text-tiny site-lost">lost ${h(n(x.lost))}</span></li>`;
  }).join('\n')}
                </ul>`
      : '<p class="sui-text-paragraph sui-text-hint">No kills or losses yet.</p>';
    return { card: card({ ...w, badge: { text: 'Tally' }, body: playerBody(p, `                ${list}\n                ${ctx.doors}`) }), more: more(`More on ${w.name}`, playerRows(p, 'tally')) };
  },
  map(link, og, ctx) {
    const planet = og.planet;
    const away = !planet;
    const unnamed = planet && (!planet.name || planet.name === planet.id);
    const name = away ? `Fleet ${link.id}` : unnamed ? 'Unnamed planet' : planet.name;
    const holder = og.owner ? `${og.owner.tag ? `[${og.owner.tag}] ` : ''}${og.owner.name || og.owner.id}` : null;
    const drained = planet?.status === 'complete';
    const deployed = (og.units || []).filter((u) => u.side !== 'attacker').length;
    const reads = away
      ? res(n(deployed), '<i class="sui-icon sui-icon-deployed-structs"></i>', 'Structs')
      : res(reading(U.fmtOre(planet.ore ?? 0)) || '0g', '<i class="sui-icon sui-icon-alpha-ore"></i>', 'Alpha Ore')
        + res(n(planet.shield), '<i class="sui-icon sui-icon-shield-health"></i>', 'Shield')
        + res(n(deployed), '<i class="sui-icon sui-icon-deployed-structs"></i>', 'Structs');
    const raid = og.attacker
      ? `<div class="site-raid">${portrait(og.attacker.pfp, 36)}<span class="site-row-text"><span class="sui-text-label">Under raid</span><span class="sui-text-paragraph" style="overflow-wrap: anywhere">${h(`${og.attacker.tag ? `[${og.attacker.tag}] ` : ''}${og.attacker.name || og.attacker.id}`)}</span></span></div>`
      : '';
    const body = `                <div class="sui-planet-card-body-content pc-body">
                  ${og.owner ? portrait(og.owner.pfp) : ''}
                  <div class="pc-reads">
                    ${holder ? `<span class="pc-res"><span class="pc-res-hint">${away ? 'Commanded by' : drained ? 'Last held by' : 'Held by'}</span></span><span class="pc-res" style="white-space: normal; text-align: right; overflow-wrap: anywhere">${h(holder)}</span>` : ''}
                    ${away ? '<span class="pc-res"><span class="pc-res-hint">Away from any planet</span></span>' : ''}
                    <span class="pc-res">${reads}</span>
                  </div>
                </div>
                ${raid}
                <img class="site-shot" src="${h(ctx.image)}" width="1200" height="630" alt="${h(ctx.description)}">
                ${ctx.doors}`;
    const rows = [
      og.owner && { href: `/player/${og.owner.id}`, label: away ? 'Commander' : drained ? 'Last holder' : 'Holder', art: art('pfp', og.owner.pfp) },
      og.attacker && { href: `/player/${og.attacker.id}`, label: 'Raider', art: art('pfp', og.attacker.pfp) },
    ];
    return { card: card({ name, id: away ? '' : '#' + planet.id, badge: { text: away ? 'Fleet' : 'Planet' }, body }), more: more(`More on ${name}`, rows) };
  },
  provider(link, og, ctx) {
    const p = og.provider;
    const policy = og.policy || {};
    const MOD = { default: 'sui-mod-default', warning: 'sui-mod-warning', destructive: 'sui-mod-destructive' };
    const alpha = p.rate.denomLabel === 'alpha';
    const amount = alpha ? reading(p.rate.value) : p.rate.value == null ? null : String(p.rate.value).replace(/\B(?=(\d{3})+$)/g, ',');
    const rate = amount == null ? 'No rate set' : alpha ? amount : `${amount} ${p.rate.denomLabel}`;
    const range = (r) => { const a = reading(r.min) || '-', b = reading(r.max) || '-'; return a === b ? a : `${a}-${b}`; };
    const owner = p.owner || {};
    const ownerName = `${owner.tag ? `[${owner.tag}] ` : ''}${owner.name || owner.id}`;
    const body = `                <div class="sui-planet-card-body-content pc-body">
                  <div class="site-emblem"><i class="sui-icon-xl icon-transfers"></i></div>
                  <div class="pc-reads site-mod-rows">
                    <span class="pc-res" title="Price, per mW per block"><span class="pc-res-hint">Price</span><span class="site-val" data-ellipsis style="color: var(--text-player-primary)">${h(rate)}</span></span>
                    ${amount == null ? '' : '<span class="pc-res"><span></span><span class="sui-text-paragraph sui-text-hint">per mW per block</span></span>'}
                    <span class="pc-res" title="Capacity"><span class="pc-res-hint">Capacity</span><span class="site-val" data-ellipsis>${h(range(p.capacity))}</span></span>
                    <span class="pc-res" title="Duration"><span class="pc-res-hint">Duration</span><span class="site-val" data-ellipsis>${h(range(p.duration))}</span></span>
                    <span class="pc-res" title="Agreements"><span class="pc-res-hint">Agreements</span><span class="site-val">${h(n(p.agreements))}</span></span>
                  </div>
                </div>
                <div class="site-terminal"><span class="pc-person">${portrait(owner.pfp, 24)}<span class="sui-text-hint">${/^0-/.test(String(owner.id)) ? 'Offered by guild' : 'Offered by'}</span> <span>${h(ownerName)}</span></span></div>
                ${ctx.doors}`;
    const rows = [owner.id && !/^0-/.test(String(owner.id)) && { href: `/player/${owner.id}`, label: 'Offered by', art: art('pfp', owner.pfp) }];
    return {
      card: card({ name: `Provider ${p.id}`, id: `Substation ${p.substation}`, badge: { text: policy.text || 'Closed', mod: MOD[policy.mod] || 'sui-mod-destructive' }, body }),
      more: more('More on this offer', rows),
    };
  },
  reactor(link, og, ctx) {
    const r = og.reactor;
    const fuel = reading(r.fuel), capacity = reading(r.capacity);
    const body = `                <div class="sui-planet-card-body-content pc-body">
                  <img class="site-reactor" src="/img/reactor-64x92.png" alt="" width="64" height="92">
                  <div class="pc-reads site-mod-rows">
                    <span class="pc-res" title="Alpha Matter infused"><span class="pc-res-hint">Infused</span><span class="site-val" data-ellipsis>${h(fuel || '-')}</span><i class="sui-icon sui-icon-alpha-matter"></i></span>
                    <span class="pc-res" title="Capacity"><span class="pc-res-hint">Capacity</span><span class="site-val" data-ellipsis>${h(capacity || '-')}</span><i class="sui-icon sui-icon-energy"></i></span>
                    <span class="pc-res" title="Commission"><span class="pc-res-hint">Commission</span><span class="site-val">${h(`${r.commissionPct ?? 0}%`)}</span><i class="sui-icon-md icon-guild" style="color: var(--accent-primary)"></i></span>
                    <span class="pc-res" title="Infusers"><span class="pc-res-hint">Infusers</span><span class="site-val" data-ellipsis>${h(n(r.infusers))}</span><i class="sui-icon sui-icon-players"></i></span>
                  </div>
                </div>
                ${ctx.doors}`;
    return { card: card({ name: `Reactor ${r.id}`, id: '#' + r.id, sub: r.guildLabel || '', badge: { text: 'Reactor' }, body }), more: '' };
  },
  sim(link, og, ctx) {
    const LEVEL_MOD = { Easy: 'sui-mod-default', Difficult: 'sui-mod-warning', Hard: 'sui-mod-destructive' };
    const badge = { text: og.level, mod: LEVEL_MOD[og.level] || 'sui-mod-default' };
    const count = (s) => (og.units || []).filter((u) => u.side === s).length;
    if (!og.result) {
      const body = `                <p class="sui-text-paragraph sui-text-hint">Someone built this battle. Can you win it? Your ${n(count('defender'))} structs against the computer's ${n(count('attacker'))}.</p>
                <img class="site-shot" src="${h(ctx.image)}" width="1200" height="630" alt="${h(ctx.description)}">
                ${ctx.doors}`;
      return { card: card({ name: 'Challenge', id: '', badge, body }), more: '' };
    }
    // A result: the debrief, in the third person (whoever reads it did not play it), over the battle itself.
    const r = og.result;
    const { verdict: v, reason } = verdict(r);
    const tone = { Victory: 'var(--text-player-primary)', Defeat: 'var(--text-enemy-primary)', Draw: 'var(--text-warning)' }[v];
    const sat = (x, top) => (x >= top ? `${x}+` : String(x));
    const t = r.stats || {};
    const ROWS = [
      ['Structs lost', `${t.player?.lost ?? 0} of ${count('defender')}`, `${t.computer?.lost ?? 0} of ${count('attacker')}`],
      ['Attacks', sat(t.player?.attacks ?? 0, 255), sat(t.computer?.attacks ?? 0, 255)],
      ['Damage dealt', sat(t.player?.damage ?? 0, 255), sat(t.computer?.damage ?? 0, 255)],
      ['Shots evaded', sat(t.player?.evaded ?? 0, 255), sat(t.computer?.evaded ?? 0, 255)],
      ['Blocked by defenders', sat(t.player?.blocked ?? 0, 255), sat(t.computer?.blocked ?? 0, 255)],
      ['Counter damage', sat(t.player?.countered ?? 0, 255), sat(t.computer?.countered ?? 0, 255)],
    ];
    const battle = { view: 'sim', code: link.code };
    const blocks = `${sat(r.blocks, 65535)} ${r.blocks === 1 ? 'block' : 'blocks'}`;
    const body = `                <p class="sui-text-paragraph" style="margin: 0">${h(reason)}</p>
                <div class="site-tallies" role="table" aria-label="Tallies">
                  <div class="site-tally" role="row"><span role="columnheader"></span><span class="sui-text-label" role="columnheader" style="color: var(--text-player-primary)">Player</span><span class="sui-text-label" role="columnheader" style="color: var(--text-enemy-primary)">Computer</span></div>
${ROWS.map(([label, a, b]) => `                  <div class="site-tally" role="row"><span class="sui-text-label sui-text-hint" role="rowheader">${h(label)}</span><span class="sui-text-paragraph" role="cell">${h(a)}</span><span class="sui-text-paragraph" role="cell">${h(b)}</span></div>`).join('\n')}
                </div>
                <img class="site-shot" src="${h(ogImage(battle))}" width="1200" height="630" alt="The battle: ${h(count('defender'))} structs against ${h(count('attacker'))}">
                ${doors(link, ctx.release, ctx.ua, { open: 'Play this battle', target: battle })}`;
    return {
      card: card({ name: v, id: `vs ${og.level} in ${clock(r.seconds)} - ${blocks}`, wrapId: true, sub: `Rules r${r.revision}`, badge, body }).replace('<h1 class="pc-name">', `<h1 class="pc-name" style="color: ${tone}">`),
      more: more('The battle', [{ href: linkPath(battle), label: 'Play it yourself', art: art('sprite', SPRITE('Battleship'), 'space') }]),
    };
  },
};

export function linkPage(link, data, release, ua) {
  const canonical = ORIGIN + linkPath(link);
  const heading = data.title.replace(/ · Structs.*$/, '');
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE, item: ORIGIN + '/' },
      { '@type': 'ListItem', position: 2, name: heading, item: canonical },
    ],
  };
  const ld = link.view === 'player'
    ? [crumbs, {
      '@context': 'https://schema.org', '@type': 'ProfilePage', url: canonical, name: data.title,
      mainEntity: { '@type': 'Person', name: data.model.player.name, identifier: link.id, description: data.description },
    }]
    : crumbs;
  const image = ogImage(link);
  const ctx = { image, description: data.description, release, ua, doors: doors(link, release, ua) };
  const view = CARD[link.view] ? CARD[link.view](link, data.og, ctx) : { card: `<h1 class="sui-text-display">${h(heading)}</h1>`, more: '' };
  const term = VIEWS[link.view] ? `${VIEWS[link.view].word} ${link.id}` : null;
  const best = forAgent(release, ua);
  const noApp = release.downloads.filter((d) => SHORT[d.key]).map((d) => `<a href="${h(d.url)}">${h(SHORT[d.key])}</a>`).join(' - ');
  const body = `            ${view.card}
${term ? `            <div class="site-terminal sui-text-paragraph sui-text-hint">
              <span>In the Terminal: <code>${h(term)}</code></span>
              <button class="sui-screen-btn sui-mod-secondary" type="button" data-copy="${h(canonical)}" aria-label="Copy link" title="Copy link"><i class="sui-icon-md icon-copy"></i></button>
            </div>` : ''}
${view.more}
            <p class="sui-text-tiny sui-text-hint site-also" style="margin: 0">No app yet? ${noApp || `<a href="${h(release.url || RELEASES_PAGE)}" rel="noopener">${best ? 'Download Structs' : 'all releases'}</a>`} - <a href="${PLAY_URL}" rel="noopener">play in your browser</a></p>`;
  return head({
    title: data.title, description: data.description, canonical,
    image, imageAlt: data.description, noindex: link.view === 'sim', ld,
  }) + frame(NAV_LABEL[link.view] || '', body);
}

/* ── crawler files ────────────────────────────────────────────────────────── */

export function robots() {
  // Nothing is disallowed: Twitterbot honours robots.txt, so a Disallow would
  // also stop simulator challenges unfurling. Those pages say noindex instead.
  return `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
}

export function sitemap(paths) {
  const urls = ['/', ...paths].map((p) => `<url><loc>${h(ORIGIN + p)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
