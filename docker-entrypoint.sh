#!/bin/sh

# Run Prisma migrations (create/update database tables)
echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy 2>&1 || echo "[entrypoint] WARNING: prisma migrate deploy failed — server will start anyway"

echo "[entrypoint] Starting server..."
exec node server.js
