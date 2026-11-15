import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline/promises';
const input = createInterface({ input: process.stdin, output: process.stdout });
try {
  const email = (process.env.ADMIN_EMAIL || await input.question('Email admin: ')).trim().toLowerCase();
  const name = (process.env.ADMIN_NAME || await input.question('Nama admin: ')).trim();
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    // Hide terminal input while reading the password; never echo or persist it.
    input.close();
    if (!process.stdin.isTTY) throw new Error('Untuk input noninteraktif, gunakan ADMIN_PASSWORD melalui environment.');
    process.stdout.write('Password (minimal 12 karakter, input disembunyikan): ');
    password = await new Promise((resolvePassword, reject) => {
      let value = ''; process.stdin.setRawMode(true); process.stdin.resume();
      const listener = chunk => {
        for (const char of chunk.toString()) {
          if (char === '\u0003') { cleanup(); reject(new Error('Dibatalkan.')); return; }
          if (char === '\r' || char === '\n') { cleanup(); resolvePassword(value); return; }
          if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
          else if (char.charCodeAt(0) >= 32) value += char;
        }
      };
      const cleanup = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', listener); process.stdout.write('\n'); };
      process.stdin.on('data', listener);
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || password.length < 12 || password.length > 256) throw new Error('Isi email dan nama yang valid, serta password 12–256 karakter.');
  const dir = resolve(process.env.CMS_DATA_DIR || './var/cms'); mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, 'content.sqlite'));
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);');
  const salt = randomBytes(16).toString('hex');
  const hash = `${salt}:${(await promisify(scrypt)(password, salt, 64)).toString('hex')}`;
  db.prepare('INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,password_hash=excluded.password_hash').run(randomUUID(), email, name, hash, new Date().toISOString());
  db.prepare('DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)').run(email);
  db.close();
  console.log('Akun admin disiapkan. Masuk melalui /admin/login/. Password tidak disimpan sebagai teks.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { input.close(); delete process.env.ADMIN_PASSWORD; }
