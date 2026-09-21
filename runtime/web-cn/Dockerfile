FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 国内版不连 Supabase（境外数据库）：登录、账号、素材一律经 api-cn。
# 原来这里要求构建时提供 Supabase 地址与匿名公钥，否则拒绝构建——
# 等于国内版必须接一个境外数据库才能打包。
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# ffmpeg 是视频拼接（/api/ai/merge-videos、/api/video/generate）的运行时依赖。
# fluent-ffmpeg 只是 npm 侧的调用壳子，真正干活的是系统二进制 ——
# 此前镜像里没装，这两个端点上线即不可用。
RUN apk add --no-cache wget dumb-init ffmpeg && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
