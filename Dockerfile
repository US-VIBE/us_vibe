# Railway: API only. Railpack monorepo build-plan errors are avoided with Docker.
FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY . .

ENV NPM_CONFIG_PRODUCTION=false
RUN npm ci --include=dev \
  && npm run build -w @us-vibe/backend \
  && npm run build -w api

ENV NODE_ENV=production
# Railway (and many hosts) probe $PORT; default to 8080 when unset so ingress matches the app.
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "run", "start", "-w", "api"]
