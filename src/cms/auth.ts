import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { database } from './database';

const derive = promisify(scrypt);
export const sessionCookie = 'tpd_session';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export type AdminUser = { id: string; email: string; name: string };
export type AdminSession = AdminUser & { csrf: string; token_hash: string };
export async function passwordHash(password: string) {
  if (password.length < 12 || password.length > 256) throw new Error('Password harus 12–256 karakter.');
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt, 64) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, expected] = hash.split(':');
  if (!salt || !expected || password.length > 256) return false;
  const actual = await derive(password, salt, 64) as Buffer;
  const stored = Buffer.from(expected, 'hex');
  return stored.length === actual.length && timingSafeEqual(stored, actual);
}
export function getSession(token: string | undefined): AdminSession | null {
  if (!token) return null;
  return database().prepare('SELECT u.id,u.email,u.name,s.csrf,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hashToken(token), Date.now()) as AdminSession || null;
}
export async function login(email: string, password: string) {
  const normalized = email.trim().toLowerCase().slice(0, 254);
  const key = hashToken(normalized);
  const now = Date.now();
  const db = database();
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);
  db.prepare('DELETE FROM login_limits WHERE reset_at<=?').run(now);
  const limit = db.prepare('SELECT attempts FROM login_limits WHERE key=?').get(key) as { attempts: number } | undefined;
  if ((limit?.attempts || 0) >= 8) throw new Error('Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
  // Count before awaiting the password derivation, including concurrent attempts.
  db.prepare('INSERT INTO login_limits(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key, now + 15 * 60_000);
  const user = db.prepare('SELECT id,password_hash FROM users WHERE email=?').get(normalized) as { id: string; password_hash: string } | undefined;
  const valid = await verifyPassword(password, user?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`);
  if (!user || !valid) throw new Error('Email atau password tidak sesuai.');
  db.prepare('DELETE FROM login_limits WHERE key=?').run(key);
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)').run(hashToken(token), user.id, randomBytes(32).toString('hex'), now + 12 * 60 * 60_000);
  return token;
}
