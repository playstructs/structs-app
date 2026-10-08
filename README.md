# structs.app

Share links for [Structs](https://playstructs.com). Any player, planet, fleet,
record, hull tally, energy provider, reactor or simulator challenge becomes a
short link. The link unfurls as a picture drawn from the game's own art, and
opens the desktop app when it is installed. The front page offers the latest
desktop release.

The link grammar is in [docs/links.md](docs/links.md).

## How it works

- **Data** comes straight from **structs-pg**, the indexer database every guild
  runs (`src/db.js`). The app opens every transaction read-only and bounds
  every statement with a timeout.
- **Pages** are one SUI window each (sui.css and playercard.css, copied from
  structs-webapp and structs-universe), server-rendered and complete without
  JavaScript. The home page gets people into the desktop app; a link's page
  shows its subject in the game's card frame (`sui-planet-card pc-card`),
  opens it in the app, gives the Terminal command for it, and links the
  subject's other views. Maps and battles show their board, cut from the
  link's own preview image (`BOARD` in `src/og/cards.js` says where it sits).
  Stylesheet and script URLs carry a content hash, so a deploy is never
  paired with a day-old cached stylesheet.
- **Preview images** are SUI windows composed in SVG from the game's PNG art
  and pixel fonts, rasterised with resvg (`src/og/`). Every text slot is fitted
  against the real worst cases using the two pixel faces' measured glyph
  widths. They are cached for five minutes.
- **Releases** come from the GitHub API for `playstructs/structs-desktop`,
  cached for ten minutes. If GitHub can't be reached, downloads fall back to
  the releases page.

## Running it

The game's assets are not in this repo. `scripts/sync.sh` copies them from a
structs-universe checkout (default `../structs-universe`, or set
`STRUCTS_UNIVERSE`): the SUI design system from its `structs-webapp`
submodule, and the card components from its `frontend/`.

```bash
npm install
npm run sync
DATABASE_URL='postgresql://structs@127.0.0.1:5432/structs?sslmode=require' npm start
```

To run it in Docker beside a guild stack (it joins the
`docker-structs-guild_default` network and reaches the database as
`structs-pg`):

```bash
npm run sync
docker compose up -d --build
```

| Variable | Default | |
|---|---|---|
| `DATABASE_URL` | `postgresql://structs@127.0.0.1:5432/structs?sslmode=require` | `sslmode=require` encrypts without verifying (structs-pg's certificate is self-signed); `verify-full` verifies |
| `PUBLIC_ORIGIN` | `https://structs.app` | used in canonical URLs, og:image and the sitemap |
| `PORT` | `8080` | |
| `GITHUB_TOKEN` | — | optional; raises the GitHub API rate limit |
| `RELEASE_REPO` | `playstructs/structs-desktop` | |
| `DB_STATEMENT_TIMEOUT_MS` | `4000` | |
| `CACHE_TTL_MS` | `300000` | how long a rendered preview is reused |
| `SITEMAP_PLAYERS` | `500` | top players (by alpha) listed in the sitemap |

## Routes

| Path | |
|---|---|
| `/` | downloads |
| `/<view>/<id>`, `/sim/<code>`, `/sim/<code>/<result>` | link pages (short and reversed forms redirect here) |
| `/og/<view>/<id>.png`, `/og/sim/<code>[/<result>].png`, `/og/home.png` | preview images |
| `/robots.txt`, `/sitemap.xml` | for crawlers |
| `/healthz` | database reachability and chain height |

## Tests

```bash
npm test
```

The preview tests render every card with every sample in
`test/fixtures/og-samples.js` — today's data, the longest and widest real
values, missing data, and data past every limit — and check that every line
of text fits. To look at them:

```bash
npm run previews -- /tmp/previews
```

The page tests render every view with the same samples and check the HTML a
crawler reads. How the pages fit was checked in Chrome under device emulation
at 390, 800 and 1440px; headless Chrome's window will not go below 500px, so a
phone check needs emulation (DevTools `Emulation.setDeviceMetricsOverride`),
not `--window-size`.
