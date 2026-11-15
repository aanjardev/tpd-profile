import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';

const dir = await mkdtemp(join(tmpdir(), 'tpd-contact-'));
const probe = createServer(); await new Promise(done => probe.listen(0, '127.0.0.1', done));
const port = probe.address().port; await new Promise(done => probe.close(done));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/server/entry.mjs'], { cwd: resolve('.'), env: { ...process.env, CMS_DATA_DIR: dir, CMS_ORIGIN: origin, HOST: '127.0.0.1', PORT: String(port) }, stdio: 'ignore', windowsHide: true });
let db;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${origin}/id/kontak/`)).status === 200) break; } catch {} await new Promise(done => setTimeout(done, 100)); }
  const page = await fetch(`${origin}/id/kontak/`); assert.equal(page.status, 200); assert.match(page.headers.get('set-cookie') || '', /tpd_visitor=/);
  const body = new URLSearchParams({ return_to: '/id/kontak/', locale: 'id', name: 'Smoke Test', email: 'smoke@example.test', message: 'Pesan smoke test untuk inbox.' });
  const sent = await fetch(`${origin}/api/contact/`, { method: 'POST', headers: { Origin: origin }, body, redirect: 'manual' });
  assert.equal(sent.status, 303); assert.equal(sent.headers.get('location'), '/id/kontak/?contact=success');
  db = new DatabaseSync(join(dir, 'content.sqlite'));
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM contact_messages').get().total, 1);
  assert.ok(db.prepare('SELECT COUNT(*) AS total FROM analytics_daily').get().total >= 1);
  console.log('PASS contact form and visitor analytics.');
} finally {
  db?.close();
  if (server.exitCode === null) { const exited = new Promise(done => server.once('exit', done)); server.kill(); await exited; }
  await rm(dir, { recursive: true, force: true });
}
