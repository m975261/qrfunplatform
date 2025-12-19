import { config, ensureDataDirectory } from "./config";
import path from "path";

const useSqlite = !process.env.DATABASE_URL;

let db: any;
let pool: any = null;
let schema: any;
let dbInitialized = false;

async function initDatabase() {
  if (dbInitialized) return;
  
  if (useSqlite) {
    ensureDataDirectory();
    const Database = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    schema = await import("@shared/schema-sqlite");
    
    const dbPath = path.join(path.resolve(config.dataPath), "qrfun.db");
    console.log(`Using SQLite database at: ${dbPath}`);
    
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    
    db = drizzle(sqlite, { schema });
    
    const initSql = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        host_id TEXT,
        game_type TEXT NOT NULL DEFAULT 'uno',
        status TEXT NOT NULL DEFAULT 'waiting',
        is_streaming_mode INTEGER DEFAULT 0,
        is_viewer_mode INTEGER DEFAULT 0,
        stream_page_connection_id TEXT,
        max_players INTEGER NOT NULL DEFAULT 4,
        current_player_index INTEGER DEFAULT 0,
        direction TEXT DEFAULT 'clockwise',
        current_color TEXT,
        deck TEXT DEFAULT '[]',
        discard_pile TEXT DEFAULT '[]',
        pending_draw INTEGER DEFAULT 0,
        position_hands TEXT DEFAULT '{}',
        active_positions TEXT DEFAULT '[]',
        host_election_active INTEGER DEFAULT 0,
        host_election_start_time INTEGER,
        host_election_votes TEXT DEFAULT '{}',
        host_election_eligible_voters TEXT DEFAULT '[]',
        host_disconnected_at INTEGER,
        host_previous_id TEXT,
        host_previous_position INTEGER,
        no_host_mode INTEGER DEFAULT 0,
        xo_state TEXT,
        xo_settings TEXT,
        created_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        room_id TEXT NOT NULL,
        hand TEXT DEFAULT '[]',
        saved_hand TEXT DEFAULT '[]',
        position INTEGER,
        is_spectator INTEGER DEFAULT 0,
        has_called_uno INTEGER DEFAULT 0,
        socket_id TEXT,
        has_left INTEGER DEFAULT 0,
        finish_position INTEGER,
        left_at INTEGER,
        joined_at INTEGER,
        last_seen_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS game_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        player_id TEXT,
        message TEXT,
        emoji TEXT,
        type TEXT NOT NULL,
        created_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT,
        totp_secret TEXT,
        is_initial_setup INTEGER DEFAULT 1,
        email_verified INTEGER DEFAULT 0,
        last_login INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        used INTEGER DEFAULT 0,
        created_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        session_token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS guru_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        player_name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        game_type TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_by TEXT NOT NULL,
        last_login INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS game_sessions (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        game_type TEXT NOT NULL,
        status TEXT NOT NULL,
        player_count INTEGER DEFAULT 0,
        started_at INTEGER,
        ended_at INTEGER,
        created_at INTEGER
      );
    `;
    
    sqlite.exec(initSql);
    console.log("SQLite database initialized with tables");
    
  } else {
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const ws = (await import("ws")).default;
    schema = await import("@shared/schema");
    
    neonConfig.webSocketConstructor = ws;
    
    console.log("Using PostgreSQL database");
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
  }
  
  dbInitialized = true;
}

await initDatabase();

export { db, pool, schema };
export const isSqlite = useSqlite;

export const {
  users,
  rooms,
  players,
  gameMessages,
  admins,
  passwordResetTokens,
  adminSessions,
  guruUsers,
  gameSessions,
} = schema;
