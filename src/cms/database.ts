import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { globalDefaults, localeDefaults } from './defaults';

export const dataDirectory = () => resolve(process.env.CMS_DATA_DIR || join(process.cwd(), 'var', 'cms'));
let connection: DatabaseSync | undefined;
export function database() {
  if (connection) return connection;
  const dir = dataDirectory();
  mkdirSync(join(dir, 'uploads'), { recursive: true });
  connection = new DatabaseSync(join(dir, 'content.sqlite'));
  connection.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS login_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS content (scope TEXT PRIMARY KEY, draft TEXT NOT NULL, published TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS content_history (id INTEGER PRIMARY KEY, scope TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, user_id TEXT REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name_id TEXT NOT NULL, name_en TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, locale TEXT NOT NULL CHECK(locale IN ('en','id')), translation_group TEXT NOT NULL, draft TEXT NOT NULL, published TEXT, version INTEGER NOT NULL DEFAULT 1, first_published_at TEXT, updated_at TEXT NOT NULL, deleted_at TEXT, UNIQUE(translation_group, locale));
    CREATE TABLE IF NOT EXISTS post_routes (locale TEXT NOT NULL, slug TEXT NOT NULL, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, PRIMARY KEY(locale, slug));
    CREATE INDEX IF NOT EXISTS posts_locale ON posts(locale, deleted_at, first_published_at);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, filename TEXT NOT NULL, original_name TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, user_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS analytics_daily (day TEXT NOT NULL, visitor_id TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(day, visitor_id));
    CREATE INDEX IF NOT EXISTS analytics_daily_day ON analytics_daily(day);
    CREATE TABLE IF NOT EXISTS contact_messages (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', message TEXT NOT NULL, locale TEXT NOT NULL CHECK(locale IN ('en','id')), created_at TEXT NOT NULL, read_at TEXT);
    CREATE INDEX IF NOT EXISTS contact_messages_unread ON contact_messages(read_at, created_at);
  `);
  const insert = connection.prepare('INSERT OR IGNORE INTO content(scope,draft,published,updated_at) VALUES(?,?,?,?)');
  for (const [scope, value] of Object.entries({ global: globalDefaults, en: localeDefaults('en'), id: localeDefaults('id') })) {
    const json = JSON.stringify(value);
    insert.run(scope, json, json, new Date().toISOString());
  }
  return connection;
}
export function transaction<T>(callback: () => T): T {
  const db = database();
  db.exec('BEGIN IMMEDIATE');
  try { const value = callback(); db.exec('COMMIT'); return value; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function audit(userId: string, action: string, entity: string) {
  database().prepare('INSERT INTO audit(user_id,action,entity,created_at) VALUES(?,?,?,?)').run(userId, action, entity, new Date().toISOString());
}
