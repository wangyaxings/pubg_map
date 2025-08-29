# Multi-stage build: frontend (Vite) + backend (Go + SQLite3)

# 1) Build frontend assets
FROM node:18-bullseye AS frontend_builder
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# 2) Build backend Go server (with CGO for sqlite3)
FROM golang:1.21-bullseye AS backend_builder
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config sqlite3 libsqlite3-dev && rm -rf /var/lib/apt/lists/*
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=1 GOOS=linux go build -o /build/server main.go

# 3) Final runtime image
FROM debian:bookworm-slim AS runtime
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libsqlite3-0 && rm -rf /var/lib/apt/lists/*

# Copy server
COPY --from=backend_builder /build/server /app/backend/server

# Static content: tiles and built frontend
COPY backend/static/tiles /app/backend/static/tiles
COPY --from=frontend_builder /app/frontend/dist /app/backend/static

# Database: copy DB into unified data path used by backend
# backend defaults to ../data/zhouyi_map.db (from /app/backend)
COPY data/zhouyi_map.db /app/data/zhouyi_map.db

# Uploads directory (persist via volume)
RUN mkdir -p /app/backend/static/uploads
VOLUME ["/app/backend/static/uploads"]

EXPOSE 8080
ENTRYPOINT ["/app/backend/server"]
