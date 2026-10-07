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
- **Pages** use the game's own menu-page frame and SUI stylesheets, copied
  from structs-webapp. The subject is drawn by the same card components the
  desktop app uses (player card, achievement rack, hull matrix, provider and
  reactor cards).
- **Preview images** are SVG composed from the game's PNG art and pixel
  fonts, rasterised with resvg (`src/og/`). They are cached for five minutes.
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
| `/<view>/<id>`, `/sim/<code>` | link pages (short and reversed forms redirect here) |
| `/og/<view>/<id>.png`, `/og/home.png` | preview images |
| `/robots.txt`, `/sitemap.xml` | for crawlers |
| `/healthz` | database reachability and chain height |

## Tests

```bash
npm test
```
