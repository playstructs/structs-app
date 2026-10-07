# structs.app — share-link pages and preview images, served next to structs-pg.
#
# The game's assets are copied in by scripts/sync.sh BEFORE the build (they come
# from a structs-universe checkout, not from this repo):
#
#   scripts/sync.sh && docker build -t structs/structs-app .
#
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public
# Fail the build, not the first request, when the assets were not synced.
RUN test -f public/css/sui/sui.css && test -f public/shared/playercard.js \
    || (echo "public/ has no game assets: run scripts/sync.sh before docker build" >&2; exit 1)

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
