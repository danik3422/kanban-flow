# KanbanHub in one image: the web app and the API at one address.
# Build:  docker compose build      Run: docker compose up -d      (see SELF_HOSTING.md)

# 1. The web app. No API address is baked in: it talks to the server it was loaded from.
FROM node:24-bookworm-slim AS web
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Optional Google / Microsoft / Apple sign-in (Firebase web config); empty hides those buttons.
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN=""
ARG VITE_FIREBASE_PROJECT_ID=""
ARG VITE_FIREBASE_APP_ID=""
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
	VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
	VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
	VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
	VITE_DEV_AUTH_BYPASS=false
RUN npm run build

# 2. The server, with only what it needs to run.
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
	PORT=5001 \
	FRONTEND_DIST=/app/web \
	UPLOADS_DIR=/data/uploads \
	DATA_DIR=/data
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY backend/ ./
COPY --from=web /build/frontend/dist /app/web
COPY docker/entrypoint.mjs /app/entrypoint.mjs
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5001) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["node", "/app/entrypoint.mjs"]
