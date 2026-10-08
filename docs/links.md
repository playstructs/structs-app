# Structs links

One grammar for three places: the web (`https://structs.app/…`), the desktop
app (`structs://…`) and the Terminal (`WORD subject`). A link is a view and a
subject; the path is the same in all three.

| Link | Shows | Terminal |
|---|---|---|
| `structs.app/player/1-61` | a player's profile | `PLAYER 1-61` |
| `structs.app/map/1-61` | a player's home planet, on the map | `MAP 1-61` |
| `structs.app/map/2-21740` | a planet, with its fleets and any raider | `MAP 2-21740` |
| `structs.app/map/9-61` | a fleet, wherever it is | `MAP 9-61` |
| `structs.app/record/1-61` | a player's achievements | `RECORD 1-61` |
| `structs.app/tally/1-61` | a player's kills and losses by hull | `TALLY 1-61` |
| `structs.app/provider/10-1` | an energy provider's offer | `PROVIDER 10-1` |
| `structs.app/reactor/3-1` | a reactor | `REACTOR 3-1` |
| `structs.app/sim/<code>` | a simulator challenge | — |

## Short forms

A chain id names its own kind (the prefix is the object type), so the id alone
is a complete link. It opens that kind's default view:

| Id | Opens |
|---|---|
| `structs.app/1-61` | `/player/1-61` |
| `structs.app/2-21740`, `/9-61` | `/map/…` |
| `structs.app/10-1` | `/provider/10-1` |
| `structs.app/3-1` | `/reactor/3-1` |

Like the Terminal, both orders work: `/1-61/record` is `/record/1-61`. The
Terminal's aliases work too (`awards`, `achievements` → `record`; `hulls`,
`kills` → `tally`; `profile`, `p` → `player`). Every short or aliased form
redirects (301) to the canonical `/<view>/<id>`, so search engines and
unfurlers see one URL per thing.

Ids are matched whole: `1-195` never matches `1-1950`.

## Simulator challenges

`/sim/<code>` carries a whole battle — both fleets, who guards whom, the
difficulty, the charge and the block time — in about 110 characters for a
full 34-unit battle (the simulator's layout JSON is ~3,400). Discord's message
limit is 2,000 characters.

The code is base64url of a versioned byte layout (`src/simcode.js`):

```
0      version (1)
1      difficulty (bits 0-1) · block time (bit 2)
2, 3   charge: player, computer (0-30)
4      seed length n (0-60), then n ASCII bytes
…      unit count, then 2 bytes per unit:
         side 1 · type 5 · ambit 2 · slot 2 · protects 6 (0 = none, else index + 1)
```

Decoding returns the simulator's own version-3 layout JSON, so the
simulator's `validate()` still decides whether a layout is legal.

### Results

`/sim/<code>/<result>` is the same battle plus how it went, for sharing a
score. Strip the last segment and you have the battle, so every result link is
also "play this battle". The result is 19 bytes, always 26 characters of
base64url (`encodeResult` / `decodeResult` in `src/simcode.js`, copied from
structs-universe `frontend/simcode.js`; spec in
`proposals/sim-results-link.md` there):

```
0      version (1)
1      winner (bits 0-1: player · computer · draw) · forfeit (bit 2) · stalemate (bits 3-4: none · moves · quiet)
2      rules revision
3, 4   blocks played (uint16)
5, 6   battle seconds (uint16)
7-12   player tallies: lost, attacks, damage, evaded, blocked, counter damage
13-18  computer tallies: the same six
```

Numbers saturate rather than wrap. A result is a claim, not a proof: battles
are not replayable. A result that does not decode, or claims more losses than
a side fielded, is dropped and the link shows its battle; a good battle never
404s. The page is titled in the debrief's own words ("Victory vs Difficult in
03:14") and the preview shows the verdict, the time and blocks, and each
side's losses over the battle board.

## In the desktop app

The app registers the `structs` URL scheme. `structs://record/1-61` should do
what typing `RECORD 1-61` into the Terminal does; `structs://sim/<code>` opens
the simulator with that layout loaded. `src/links.js` and `src/simcode.js` are
pure modules with no dependencies, so the app can carry the same parser, and
`terminalLine(link)` gives the Terminal command for any link.

## Unfurls

Every link has a 1200×630 preview at `/og/<view>/<id>.png`, drawn as the
game draws a window — an SUI panel with a nav screen (the view and the link)
and a body screen, at the game's 2× UI scale — from the game's own art (SUI
frames and icons, portraits, struct sprites, battleground tiles) and live
data from structs-pg. Text is fitted against the real worst cases (20-character
names, the unit ladders' longest readings) with the pixel faces' measured
glyph widths; see `npm run previews`. Pages carry Open Graph and Twitter tags, so Discord,
Slack, X, iMessage and the rest show the picture, a title and a one-line
summary. The image URL has a ten-minute bucket in its query string, so a link
shared again later unfurls with a fresh picture.

## Ideas for later

- `structs.app/guild/0-1`: a guild's page (members, reactor, substations).
- `structs.app/struct/5-380966`: one struct, on its tile.
- `structs.app/raid/2-16116`: a live raid that opens the Raid View spectator.
- `structs.app/substation/4-1`: a substation's load and connections.
