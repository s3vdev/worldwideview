import Database from 'better-sqlite3';
import path from 'path';

// Define the path for the SQLite database. Note Docker volume mounts to /app/packages/wwv-data-engine/data
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'engine.db');

export const db = new Database(dbPath, {
  // Use verbose logging if needed for debugging
  // verbose: console.log
});

// Enable Write-Ahead Logging for better concurrent read/write performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000'); // Wait up to 5 seconds if DB is locked

/**
 * Initialize all required tables for the different seeders.
 * This runs synchronously on boot.
 */
export function initDB() {
  console.log(`[DB] Initializing SQLite database at ${dbPath}`);

  // IranWarLive table
  db.exec(`
    CREATE TABLE IF NOT EXISTS iranwar_events (
      event_id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      timestamp TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  // Earthquakes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS earthquakes (
      id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      source_ts INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  // Wildfires table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wildfires (
      id TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      source_ts INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    )
  `);

  // Maritime AIS history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS maritime_history (
      mmsi TEXT NOT NULL,
      ts INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      hdg REAL,
      spd REAL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (mmsi, ts)
    )
  `);
  
  // Index for fast maritime history lookups by MMSI + time range
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_maritime_history_mmsi_ts ON maritime_history(mmsi, ts);
  `);

  console.log('[DB] All tables initialized successfully.');
}
