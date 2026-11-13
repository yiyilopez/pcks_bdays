import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { dailyKey, sanitizePayload, projectForTV } from './lib/birthdays.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === 'production';
const screenCode = process.env.SCREEN_CODE || '';
if (production && screenCode.length < 8) throw new Error('Set SCREEN_CODE to at least 8 characters.');
const dataFile = resolve(process.env.DATA_FILE || resolve(root, 'data/november.json'));
const secret = screenCode ? createHmac('sha256', screenCode).update('package-squad-tv-session-v1').digest() : randomBytes(32);
let snapshot = null, inFlight = null, lastDailyKey = null, bridgeFailed = false;
const attempts = new Map();
try { snapshot = sanitizePayload(JSON.parse(await readFile(dataFile, 'utf8'))); } catch { /* Empty until first authorized sync. */ }
// Optional one-time seed lives in Render secrets, never in public assets or Git.
if (!snapshot && process.env.INITIAL_BIRTHDAYS_JSON) {
  snapshot = sanitizePayload(JSON.parse(process.env.INITIAL_BIRTHDAYS_JSON));
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(snapshot), { mode: 0o600 });
}

function same(a, b) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function signature(value) { return createHmac('sha256', secret).update(value).digest('hex'); }
function authorized(req) {
  if (!production && !screenCode) return true;
  const cookie = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('ps_session='))?.slice(11);
  if (!cookie) return false;
  const [expiry, sig] = cookie.split('.');
  return /^\d+$/.test(expiry) && Number(expiry) > Date.now() && same(sig || '', signature(expiry));
}
async function refresh() {
  if (!process.env.APPS_SCRIPT_URL || !process.env.APPS_SCRIPT_TOKEN) return false;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const url = new URL(process.env.APPS_SCRIPT_URL);
      if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) throw new Error('INVALID_BRIDGE_URL');
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: process.env.APPS_SCRIPT_TOKEN }),
        signal: AbortSignal.timeout(25000), redirect: 'follow',
      });
      if (!response.ok) throw new Error('BRIDGE_UNAVAILABLE');
      const next = sanitizePayload(await response.json());
      await mkdir(dirname(dataFile), { recursive: true });
      await writeFile(`${dataFile}.tmp`, JSON.stringify(next), { mode: 0o600 });
      await rename(`${dataFile}.tmp`, dataFile);
      snapshot = next; bridgeFailed = false;
      return true;
    } catch {
      bridgeFailed = true;
      console.error('Birthday sync unavailable; retaining the last sanitized snapshot.');
      return false;
    } finally { inFlight = null; }
  })();
  return inFlight;
}
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/healthz') return send(res, 200, { ok: true });
    if (pathname === '/api/unlock' && req.method === 'POST') {
      const ip = req.socket.remoteAddress;
      const now = Date.now();
      for (const [key, entry] of attempts) if (now - entry.start > 900000) attempts.delete(key);
      const entry = attempts.get(ip) || { start: now, count: 0 };
      if (entry.count >= 10) return send(res, 429, { error: 'TOO_MANY_ATTEMPTS' });
      entry.count++; attempts.set(ip, entry);
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 1024) return send(res, 413, { error: 'TOO_LARGE' }); }
      let parsed; try { parsed = JSON.parse(body); } catch { return send(res, 400, { error: 'INVALID_REQUEST' }); }
      if (!screenCode || typeof parsed.code !== 'string' || !same(parsed.code, screenCode)) return send(res, 401, { error: 'INVALID_CODE' });
      attempts.delete(ip);
      const expiry = String(Date.now() + 30 * 86400000);
      res.setHeader('Set-Cookie', `ps_session=${expiry}.${signature(expiry)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${production ? '; Secure' : ''}`);
      return send(res, 200, { ok: true });
    }
    if (pathname.startsWith('/api/')) {
      if (!authorized(req)) return send(res, 401, { error: 'SCREEN_LOCKED' });
      if (pathname === '/api/birthdays' && req.method === 'GET') {
        if (!snapshot) return send(res, 503, { error: 'SOURCE_NOT_CONNECTED' });
        const stale = Date.now() - Date.parse(snapshot.generatedAt) > 15 * 60000;
        return send(res, 200, { ...projectForTV(snapshot), connection: bridgeFailed ? 'offline' : process.env.APPS_SCRIPT_URL ? 'live' : 'snapshot', stale });
      }
      return send(res, 404, { error: 'NOT_FOUND' });
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    const file = staticFiles.get(pathname);
    if (!file) return send(res, 404, { error: 'NOT_FOUND' });
    res.writeHead(200, { 'Content-Type': file[1] });
    res.end(req.method === 'HEAD' ? undefined : await readFile(resolve(root, 'public', file[0])));
  } catch { if (!res.headersSent) send(res, 500, { error: 'UNAVAILABLE' }); else res.end(); }
});

await new Promise(resolveListen => server.listen(Number(process.env.PORT || 3000), production ? '0.0.0.0' : '127.0.0.1', resolveListen));
console.log(`Package Squad TV · http://localhost:${server.address().port}`);
// Always-on Render instance: local 05:00 follows both EST and EDT, independent of TV.
async function dailyRefresh() {
  const key = dailyKey();
  if (key && key !== lastDailyKey && await refresh()) lastDailyKey = key;
}
void refresh().then(ok => { if (ok) lastDailyKey = dailyKey(); });
setInterval(() => { void dailyRefresh(); }, 15000).unref();
// Active screens heartbeat via their GET requests; source is refreshed every five minutes.
let lastScreenRequest = 0;
server.on('request', req => { if (req.url === '/api/birthdays' && authorized(req)) lastScreenRequest = Date.now(); });
setInterval(() => { if (Date.now() - lastScreenRequest < 6 * 60000) void refresh(); }, 5 * 60000).unref();
