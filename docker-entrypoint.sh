#!/bin/sh
# ─── Docker Entrypoint ───────────────────────────────────────
# Ensures the SQLite database exists and is migrated before
# starting the application. On first run with a fresh volume
# the DB file won't exist yet, so we run prisma migrate deploy.

set -e

DB_PATH="./data/wwv.db"

if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] Database not found, running migrations..."
  mkdir -p ./data
  npx prisma migrate deploy
  echo "[entrypoint] Database initialised."
else
  echo "[entrypoint] Database found, skipping migration."
fi

exec node server.js
