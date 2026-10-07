#!/usr/bin/env bash
# Copy the game's own assets and the shared card components into public/.
#
# Two sources, both from a structs-universe checkout (STRUCTS_UNIVERSE,
# default ../structs-universe):
#
#   structs-webapp/src/public/{css,fonts,img,structicons}
#       The SUI design system exactly as the game ships it — the same
#       submodule pin the desktop app builds from.
#   frontend/{pfp,units,playercard,guildcard,providercard,structs-cards,structs-achievements}.{js,css}
#       The card components every Structs surface draws with.
#
# Everything this writes is a build output: public/{css,fonts,img,structicons,shared}
# are gitignored and wiped on every run. Hand-written files live in public/
# itself (site.css, site.js) and never in those directories.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIVERSE="${STRUCTS_UNIVERSE:-$ROOT/../structs-universe}"
WEBAPP="$UNIVERSE/structs-webapp/src/public"
FRONTEND="$UNIVERSE/frontend"

[ -d "$WEBAPP/css/sui" ] || { echo "sync: no SUI at $WEBAPP (set STRUCTS_UNIVERSE, and run 'git submodule update --init' there)" >&2; exit 1; }
[ -f "$FRONTEND/playercard.js" ] || { echo "sync: no card components at $FRONTEND" >&2; exit 1; }

PUB="$ROOT/public"
for d in css fonts img structicons; do
  rm -rf "${PUB:?}/$d"
  cp -R "$WEBAPP/$d" "$PUB/$d"
done

cp "$WEBAPP/favicon.ico" "$PUB/favicon.ico"

rm -rf "$PUB/shared"
mkdir -p "$PUB/shared"
for f in pfp.js units.js playercard.js playercard.css guildcard.js guildcard.css \
         providercard.js providercard.css structs-cards.js structs-cards.css \
         structs-achievements.js structs-achievements.css; do
  cp "$FRONTEND/$f" "$PUB/shared/$f"
done

# Where the assets came from, so a deployed site can say which game it matches.
{
  echo "webapp $(git -C "$UNIVERSE/structs-webapp" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "universe $(git -C "$UNIVERSE" rev-parse --short HEAD 2>/dev/null || echo unknown)"
} > "$PUB/shared/SOURCE"

echo "sync: assets from $(cat "$PUB/shared/SOURCE" | tr '\n' ' ')"
