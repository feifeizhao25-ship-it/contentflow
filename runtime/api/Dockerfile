# Node 22 on Debian (glibc), not Alpine: the C2PA Content Credentials library (@contentauth/c2pa-node, used to mark
# AI-generated images/video under EU AI Act Art. 50) needs Node >= 22.12 and ships glibc binaries only.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
# npm ci also downloads the c2pa native binary (optional dependency; needs access to github.com at build time).
RUN npm ci
# Set --build-arg REQUIRE_C2PA=1 for the global edition image: the build fails instead of silently producing an
# image that cannot sign generated media.
ARG REQUIRE_C2PA=0
RUN if [ "$REQUIRE_C2PA" = "1" ]; then node -e "require('@contentauth/c2pa-node'); console.log('c2pa engine ok')"; fi
COPY src/database/prisma ./src/database/prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4000
RUN apt-get update && apt-get install -y --no-install-recommends wget dumb-init openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/src/database/prisma ./src/database/prisma
COPY --chown=app:app data ./data
# Weekly PDF fonts. Noto Sans is OFL; Droid Sans Fallback is Apache-2.0. Licenses sit beside the files.
COPY --chown=app:app assets ./assets
COPY --chown=app:app package.json ./
COPY --chown=app:app docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
# Signed generated media is written here (MEDIA_STORE_DIR). Mount a volume / shared disk in production.
RUN mkdir -p /app/data/generated-media && chown app:app /app/data/generated-media
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:4000/health/ready >/dev/null || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]
