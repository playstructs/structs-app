/* The pages: the game's own menu-page frame (structs-webapp
 * templates/game/index.html.twig), with the link's preview image as the hero,
 * the open/download actions, and the subject drawn by the shared card
 * components underneath.
 *
 * Everything a crawler needs is in the server-rendered HTML — title,
 * description, canonical, Open Graph, Twitter, JSON-LD, the h1 and the image
 * with its alt text. The card components are progressive: they read the
 * model embedded in the page and draw the same thing the desktop app draws.
 */
import { appUrl, path as linkPath, VIEWS } from './links.js';
import { forAgent, RELEASES_PAGE } from './release.js';

export const ORIGIN = (process.env.PUBLIC_ORIGIN || 'https://structs.app').replace(/\/$/, '');
const SITE = 'Structs';
const THEME = '#43CDB6';   // --accent-primary: also the colour of a Discord embed's edge

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

const STYLES = [
  '/css/normalize.css', '/css/structicons.css', '/css/sui/sui.css', '/css/main.css',
  '/shared/playercard.css', '/shared/guildcard.css', '/shared/providercard.css',
  '/shared/structs-cards.css', '/shared/structs-achievements.css', '/site.css',
];
const SCRIPTS = [
  '/shared/units.js', '/shared/pfp.js', '/shared/playercard.js', '/shared/guildcard.js',
  '/shared/providercard.js', '/shared/structs-cards.js', '/shared/structs-achievements.js', '/site.js',
];

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

function frame(navLabel, body) {
  return `<body>
<div id="menu-page-layout">
  <div id="menu-page-panel" class="sui-panel sui-theme-player">
    <div class="sui-panel-top-fill-background"></div>
    <div class="sui-panel-bottom-fill-background"></div>
    <div class="sui-panel-edge-left"></div>
    <div id="menu-page-panel-chunk" class="sui-panel-chunk sui-mod-grow sui-mod-shrink">
      <div id="menu-page-nav" class="sui-screen sui-screen-full-width">
        <nav class="sui-screen-nav">
          <div id="menu-page-nav-items" class="sui-screen-nav-items">
            <a class="sui-screen-nav-item${navLabel ? '' : ' sui-mod-active'}" href="/">Structs</a>
            ${navLabel ? `<a class="sui-screen-nav-item sui-mod-active" href="javascript:void(0)">${h(navLabel)}</a>` : ''}
          </div>
          <div class="site-nav-links">
            <a class="sui-screen-nav-item" href="https://playstructs.com" rel="noopener">playstructs.com</a>
            <a class="sui-screen-nav-item" href="https://structs.ai" rel="noopener">structs.ai</a>
          </div>
        </nav>
      </div>
      <div class="height-100 sui-screen sui-screen-full-width sui-screen-shrink">
        <main id="menu-page-screen-body" class="height-100 sui-page-body-screen">
          ${body}
        </main>
      </div>
    </div>
    <div class="sui-panel-edge-right"></div>
  </div>
</div>
${SCRIPTS.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

function sizeOf(bytes) {
  return bytes ? `${Math.round(bytes / 1e6)} MB` : '';
}

/* Open in the app, and the download that suits this visitor (all of them
 * one step away). `structs://` only works once the app is installed, so the
 * open button is the primary action and the download follows it — site.js
 * brings the download forward if the open did nothing. */
function actions(link, release, ua) {
  const best = forAgent(release, ua);
  const open = link ? `<a id="open-app" class="sui-screen-btn fixed-256 sui-mod-primary" href="${h(appUrl(link))}" data-app-url="${h(appUrl(link))}">Open in Structs</a>` : '';
  const get = best
    ? `<a id="get-app" class="sui-screen-btn fixed-256 sui-mod-secondary" href="${h(best.url)}">Download for ${h(best.label)}</a>`
    : `<a id="get-app" class="sui-screen-btn fixed-256 sui-mod-secondary" href="${h(release.url || RELEASES_PAGE)}" rel="noopener">Download Structs</a>`;
  const others = release.downloads.length
    ? `<ul class="site-downloads">${release.downloads.map((d) => `<li><a href="${h(d.url)}"><span class="sui-text-label">${h(d.label)}</span> <span class="sui-text-tiny sui-text-hint">${h(d.sub)} · ${h(sizeOf(d.size))}</span></a></li>`).join('')}</ul>`
    : '';
  const version = release.version ? `<a class="site-version sui-text-tiny sui-text-hint" href="${h(release.url)}" rel="noopener">v${h(release.version)}</a>` : '';
  return `<div class="site-actions">${open}${get}</div>${others}${version}`;
}

function footer() {
  return `<footer class="site-footer">
    <a class="sui-text-label" href="https://playstructs.com" rel="noopener">Play in your browser</a>
    <a class="sui-text-label" href="https://structs.ai" rel="noopener">Structs for AI agents</a>
    <a class="sui-text-label" href="${RELEASES_PAGE}" rel="noopener">All releases</a>
  </footer>`;
}

/* ── pages ────────────────────────────────────────────────────────────────── */

export function linkPage(link, data, release, ua) {
  const canonical = ORIGIN + linkPath(link);
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE, item: ORIGIN + '/' },
      { '@type': 'ListItem', position: 2, name: data.title.replace(/ · Structs.*$/, ''), item: canonical },
    ],
  };
  const ld = link.view === 'player'
    ? [crumbs, {
      '@context': 'https://schema.org', '@type': 'ProfilePage', url: canonical, name: data.title,
      mainEntity: { '@type': 'Person', name: data.model.player.name, identifier: link.id, description: data.description },
    }]
    : crumbs;
  const heading = data.title.replace(/ · Structs.*$/, '');
  const body = `
  <div class="sui-page-body-screen-content sui-screen-body site-page">
    <h1 class="sui-text-display site-title">${h(heading)}</h1>
    <img class="site-preview" src="${h(ogImage(link))}" width="1200" height="630" alt="${h(data.description)}">
    ${actions(link, release, ua)}
    <section id="site-detail" class="site-detail" aria-label="Details"></section>
    <script id="site-model" type="application/json">${json({ view: link.view, id: link.id || null, model: data.model, terminal: VIEWS[link.view] ? VIEWS[link.view].word + ' ' + link.id : null })}</script>
    ${footer()}
  </div>`;
  return head({
    title: data.title, description: data.description, canonical,
    image: ogImage(link), imageAlt: data.description, noindex: link.view === 'sim', ld,
  }) + frame(NAV_LABEL[link.view] || '', body);
}

export function homePage(release, ua) {
  const title = 'Structs — a 5X space strategy game';
  const description = 'Download Structs for macOS, Windows and Linux. Build a fleet, mine your planet, raid your rivals — and share any player, planet, fleet or battle as a link.';
  const ld = [{
    '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: ORIGIN + '/',
  }, {
    '@context': 'https://schema.org', '@type': ['VideoGame', 'SoftwareApplication'],
    name: SITE, url: 'https://playstructs.com', description,
    applicationCategory: 'GameApplication', genre: ['Strategy', '4X'], gamePlatform: ['macOS', 'Windows', 'Linux', 'Web browser'],
    operatingSystem: 'macOS, Windows, Linux',
    ...(release.version ? { softwareVersion: release.version, downloadUrl: release.url } : {}),
    image: ogImage({ view: 'home' }),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    sameAs: ['https://playstructs.com', 'https://structs.ai', 'https://github.com/playstructs'],
  }];
  const body = `
  <div class="sui-page-body-screen-content sui-screen-body justified-centered site-home">
    <img class="glitch-logo" src="/img/sui/logo/logo-structs.gif" alt="Structs">
    <h1 class="sui-text-display">Structs</h1>
    <p class="sui-text-paragraph sui-text-hint site-tagline">A 5X space strategy game</p>
    ${actions(null, release, ua)}
    ${footer()}
  </div>`;
  return head({ title, description, canonical: ORIGIN + '/', image: ogImage({ view: 'home' }), imageAlt: 'Structs', ld })
    + frame('', body);
}

export function notFoundPage(release, ua) {
  const body = `
  <div class="sui-page-body-screen-content sui-screen-body justified-centered site-home">
    <img class="glitch-logo" src="/img/sui/logo/logo-structs.gif" alt="Structs">
    <h1 class="sui-text-display">Nothing at these coordinates</h1>
    <p class="sui-text-paragraph sui-text-hint site-tagline">That link does not point at anything in the galaxy.</p>
    ${actions(null, release, ua)}
    ${footer()}
  </div>`;
  return head({ title: 'Not found · Structs', description: 'That link does not point at anything in Structs.', canonical: ORIGIN + '/', image: ogImage({ view: 'home' }), imageAlt: 'Structs', noindex: true })
    + frame('', body);
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
