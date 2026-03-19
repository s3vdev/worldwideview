#!/bin/sh

# Run Prisma migrations (create/update database tables)
# Pass --url directly because the runner container cannot load prisma.config.ts (TypeScript)
echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy --url "$DATABASE_URL" 2>&1 || echo "[entrypoint] WARNING: prisma migrate deploy failed — server will start anyway"

echo "[entrypoint] Starting server..."
exec node server.js
