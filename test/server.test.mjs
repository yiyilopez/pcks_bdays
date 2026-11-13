import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('production protects birthday data and keeps the authorized session across restarts', { timeout: 20000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'ps-tv-test-'));
  const children = [];
  t.after(async () => {
    await Promise.all(children.filter(child => child.exitCode === null && child.signalCode === null).map(child => new Promise(resolve => { child.once('exit', resolve); child.kill(); })));
    await rm(dir, { recursive: true, force: true });
  });
  async function launch() {
    const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
      env: { ...process.env, NODE_ENV: 'production', PORT: '0', SCREEN_CODE: 'a-test-code-never-used-in-production', DATA_FILE: join(dir, 'snapshot.json'), APPS_SCRIPT_URL: '', APPS_SCRIPT_TOKEN: '', INITIAL_BIRTHDAYS_JSON: JSON.stringify({ sourceMonth: 11, generatedAt: '2026-11-13T15:00:00Z', birthdays: [{ name: 'Test Driver', day: 18, month: 11 }] }) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    const url = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Server did not start')), 10000);
      child.stdout.on('data', chunk => { output += chunk; const match = output.match(/http:\/\/localhost:(\d+)/); if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); } });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); if (!output.includes('http://localhost:')) reject(new Error(`Server exited ${code}`)); });
    });
    return { child, url };
  }
  const first = await launch();
  assert.equal((await fetch(first.url + '/')).status, 200);
  assert.equal((await fetch(first.url + '/api/birthdays')).status, 401);
  assert.equal((await fetch(first.url + '/data/november.json')).status, 404);
  assert.equal((await fetch(first.url + '/.env')).status, 404);
  const denied = await fetch(first.url + '/api/unlock', { method: 'POST', body: JSON.stringify({ code: 'wrong' }) });
  assert.equal(denied.status, 401);
  const unlocked = await fetch(first.url + '/api/unlock', { method: 'POST', body: JSON.stringify({ code: 'a-test-code-never-used-in-production' }) });
  assert.equal(unlocked.status, 200);
  const cookieHeader = unlocked.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict']) assert.ok(cookieHeader.includes(flag));
  const cookie = cookieHeader.split(';')[0];
  const response = await fetch(first.url + '/api/birthdays', { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  assert.equal(payload.connection, 'snapshot');
  assert.equal(JSON.stringify(payload).includes('a-test-code'), false);
  assert.equal((await fetch(first.url + '/api/birthdays', { headers: { cookie: cookie + 'tampered' } })).status, 401);
  await new Promise(resolve => { first.child.once('exit', resolve); first.child.kill(); });
  const second = await launch();
  assert.equal((await fetch(second.url + '/api/birthdays', { headers: { cookie } })).status, 200);
});
