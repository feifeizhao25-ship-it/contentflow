FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY src/database/prisma ./src/database/prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4000
RUN apk add --no-cache wget dumb-init openssl && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/src/database/prisma ./src/database/prisma
COPY --chown=app:app data ./data
COPY --chown=app:app package.json ./
COPY --chown=app:app docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:4000/api/v1/health/ready >/dev/null || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]
