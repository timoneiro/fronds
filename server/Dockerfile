# fronds sync & reminder server. Build from the repo root:
#   docker build -f server/Dockerfile -t fronds-server .
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8787

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

# The server runs its TypeScript directly (Node type stripping) and shares the
# app's domain logic, so only those source files are copied in.
RUN echo '{"type":"module"}' > package.json
COPY src/db/types.ts ./src/db/types.ts
COPY src/domain ./src/domain
COPY server/src ./server/src

# Runs as root so a bind-mounted ./data folder created by Docker (e.g. from a
# NAS GUI) is always writable.
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=1m --timeout=5s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "server/src/main.ts"]
