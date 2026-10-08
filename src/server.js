/* structs.app — share links for Structs.
 *
 *   /                      download the desktop app
 *   /<view>/<id>           a page for a player, map, record, tally, provider, reactor
 *   /<id>, /<id>/<view>    the same, by the short and the reversed forms (301 to canonical)
 *   /sim/<code>            a simulator challenge
 *   /og/…png               the preview image for any of the above
 *
 * Reads structs-pg directly (src/db.js); renders previews with resvg (src/og).
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { parse, path as linkPath } from './links.js';
import { load } from './data.js';
import * as db from './db.js';
import { latest } from './release.js';
import { png, cached } from './og/render.js';
import { linkPage, homePage, notFoundPage, robots, sitemap, ORIGIN } from './html.js';

const app = new Hono();
const PORT = Number(process.env.PORT || 8080);

app.use('*', async (c, next) => {
  await next();
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'strict-origin-when-cross-origin');
  // Pages are framed by nobody; scripts and styles are only our own.
  c.header('content-security-policy',
    "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    + "font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'");
});

/* ── static assets ────────────────────────────────────────────────────────── */

const assets = serveStatic({
  root: './public',
  onFound: (_p, c) => c.header('cache-control', 'public, max-age=86400'),
});
for (const prefix of ['/css/*', '/fonts/*', '/img/*', '/structicons/*', '/shared/*']) app.get(prefix, assets);
for (const file of ['/site.css', '/site.js', '/favicon.ico']) app.get(file, assets);

/* ── health + crawler files ───────────────────────────────────────────────── */

app.get('/healthz', async (c) => {
  try {
    const block = await db.health();
    return c.json({ ok: true, block });
  } catch (e) {
    return c.json({ ok: false, error: e.message }, 503);
  }
});

app.get('/robots.txt', (c) => c.text(robots()));

app.get('/sitemap.xml', async (c) => {
  const top = await db.topPlayers(Number(process.env.SITEMAP_PLAYERS || 500)).catch(() => []);
  // A player with no planet has no map to link.
  const paths = top.flatMap(({ id, planet_id: planet }) => [`/player/${id}`, `/record/${id}`, `/tally/${id}`, ...(planet ? [`/map/${id}`] : [])]);
  c.header('content-type', 'application/xml; charset=utf-8');
  c.header('cache-control', 'public, max-age=3600');
  return c.body(sitemap(paths));
});

/* ── preview images ───────────────────────────────────────────────────────── */

function image(c, buf) {
  c.header('content-type', 'image/png');
  c.header('cache-control', 'public, max-age=600, stale-while-revalidate=86400');
  return c.body(buf);
}

app.get('/og/home.png', async (c) => image(c, await cached('home', () => png('home', {}))));

app.get('/og/*', async (c) => {
  const rest = c.req.path.replace(/^\/og/, '').replace(/\.png$/, '');
  const link = parse(rest);
  if (!link || link.view === 'home' || linkPath(link) !== rest) return c.notFound();
  const key = linkPath(link);
  try {
    const buf = await cached(key, async () => {
      const data = await load(link);
      return data ? png(link.view, data.og) : null;
    });
    return buf ? image(c, buf) : c.notFound();
  } catch (e) {
    console.error('og', key, e.message);
    return c.text('preview unavailable', 503);
  }
});

/* ── pages ────────────────────────────────────────────────────────────────── */

app.get('/', async (c) => {
  c.header('cache-control', 'public, max-age=300');
  c.header('vary', 'User-Agent');   // the download offered depends on the visitor's platform
  return c.html(homePage(await latest(), c.req.header('user-agent')));
});

app.get('*', async (c) => {
  const link = parse(c.req.path);
  const release = await latest();
  const ua = c.req.header('user-agent');
  if (!link) return c.html(notFoundPage(release, ua), 404);

  const canonical = linkPath(link);
  if (canonical !== c.req.path) return c.redirect(canonical, 301);

  let data;
  try {
    data = await load(link);
  } catch (e) {
    console.error('page', canonical, e.message);
    return c.text('The galaxy is not answering right now. Try again in a moment.', 503);
  }
  if (!data) return c.html(notFoundPage(release, ua), 404);
  c.header('cache-control', 'public, max-age=60');
  c.header('vary', 'User-Agent');   // the download offered depends on the visitor's platform
  return c.html(linkPage(link, data, release, ua));
});

serve({ fetch: app.fetch, port: PORT }, () => console.log(`structs.app on :${PORT} (${ORIGIN})`));
