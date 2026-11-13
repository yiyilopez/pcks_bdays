// Birthday Board - pantalla de cumpleanos para proyectar en la estacion.
// Sin dependencias: solo Node 18 o superior.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { parseTabs, parseSheet } = require('./lib/parse');
const { withAdditionalBirthdays } = require('./lib/additional-birthdays');

const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID || '1U2SlWVjfXOuPzNR8GxVV_Y8cUGf13Gio3lvJDJbP_B4';
const TIME_ZONE = process.env.TIME_ZONE || 'America/New_York';
const REFRESH_MINUTES = Number(process.env.REFRESH_MINUTES || 10);
const ROTATE_SECONDS = Number(process.env.ROTATE_SECONDS || 10);
const TEAM_NAME = process.env.TEAM_NAME || 'Package Squad';
const FIXTURE_DIR = process.env.FIXTURE_DIR || ''; // solo para pruebas locales

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`;

let state = { people: [], month: null, tab: null, updatedAt: null, error: 'Cargando...' };
const photoSrc = new Map(); // id -> url en Google
const photoCache = new Map(); // id -> { buf, type, at }

function today() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function monthIndexOf(tabName) {
  const n = norm(tabName);
  for (let i = 0; i < 12; i++) {
    const en = norm(MONTHS_EN[i]);
    const es = norm(MONTHS_ES[i]);
    if (n.includes(en) || n.includes(es) || n === en.slice(0, 3) || n === es.slice(0, 3)) return i;
  }
  return -1;
}

async function getText(url) {
  if (FIXTURE_DIR) {
    const file = url.includes('/sheet?') ? 'sheet.html' : 'top.html';
    return fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8');
  }
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (BirthdayBoard)' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Google respondio ${res.status}. Revisa que el Sheet siga compartido como "Cualquier persona con el enlace".`);
  const text = await res.text();
  if (/accounts\.google\.com\/(v3\/)?signin|ServiceLogin/.test(res.url)) {
    throw new Error('El Sheet no es publico. Compartelo como "Cualquier persona con el enlace - Lector".');
  }
  return text;
}

async function refresh() {
  try {
    const now = today();
    const tabs = parseTabs(await getText(BASE));
    if (!tabs.length) throw new Error('No se encontraron pestanas en el Sheet.');
    const tab = tabs.find((t) => monthIndexOf(t.name) === now.month - 1);
    if (!tab) {
      state = {
        people: withAdditionalBirthdays([], now.month),
        month: now.month,
        tab: null,
        updatedAt: new Date().toISOString(),
        error: null,
        note: `No hay pestana para ${MONTHS_EN[now.month - 1]} en el Sheet.`,
      };
      return;
    }
    const people = parseSheet(await getText(`${BASE}/sheet?headers=true&gid=${tab.gid}`));
    const ids = new Set();
    for (const p of people) {
      if (p.photo) {
        ids.add(p.photo.id);
        photoSrc.set(p.photo.id, p.photo.src);
      }
    }
    for (const id of [...photoSrc.keys()]) {
      if (!ids.has(id)) {
        photoSrc.delete(id);
        photoCache.delete(id);
      }
    }
    state = {
      people: withAdditionalBirthdays(people.map((p) => ({ name: p.name, day: p.day, photo: p.photo ? `/photo/${p.photo.id}` : null })), now.month),
      month: now.month,
      tab: tab.name,
      updatedAt: new Date().toISOString(),
      error: null,
    };
    console.log(`[refresh] ${tab.name}: ${people.length} personas, ${ids.size} fotos`);
  } catch (err) {
    console.error('[refresh] error:', err.message);
    // Se conservan los ultimos datos buenos; solo se anota el error.
    state = { ...state, error: err.message };
  }
}

async function servePhoto(id, res) {
  const src = photoSrc.get(id);
  if (!src) {
    res.writeHead(404).end();
    return;
  }
  let hit = photoCache.get(id);
  const maxAge = 6 * 60 * 60 * 1000;
  if (!hit || Date.now() - hit.at > maxAge) {
    try {
      let buf;
      let type;
      if (FIXTURE_DIR) {
        buf = fs.readFileSync(path.join(FIXTURE_DIR, path.basename(src)));
        type = 'image/svg+xml';
      } else {
        const sized = /=s\d+$/.test(src) ? src.replace(/=s\d+$/, '=s900') : src;
        const r = await fetch(sized);
        if (!r.ok) throw new Error('foto ' + r.status);
        buf = Buffer.from(await r.arrayBuffer());
        type = r.headers.get('content-type') || 'image/png';
      }
      hit = { buf, type, at: Date.now(), src };
      photoCache.set(id, hit);
    } catch (err) {
      console.error('[photo]', id, err.message);
      if (!hit) {
        res.writeHead(502).end();
        return;
      }
    }
  }
  res.writeHead(200, { 'content-type': hit.type, 'cache-control': 'public, max-age=3600' });
  res.end(hit.buf);
}

const indexHtml = () => fs.readFileSync(path.join(__dirname, 'public', 'index.html'));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/birthdays') {
    const now = today();
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ...state, today: now, rotateSeconds: ROTATE_SECONDS, team: TEAM_NAME }));
  } else if (url.pathname.startsWith('/photo/')) {
    await servePhoto(decodeURIComponent(url.pathname.slice(7)), res);
  } else if (url.pathname === '/healthz') {
    res.writeHead(200).end('ok');
  } else if (url.pathname === '/assets/package-squad-logo.png') {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' });
    res.end(fs.readFileSync(path.join(__dirname, 'public', 'assets', 'package-squad-logo.png')));
  } else if (url.pathname === '/assets/kenneth-nachbar.png') {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' });
    res.end(fs.readFileSync(path.join(__dirname, 'public', 'assets', 'kenneth-nachbar.png')));
  } else if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(indexHtml());
  } else {
    res.writeHead(404).end('Not found');
  }
});

refresh().finally(() => {
  server.listen(PORT, () => console.log(`Birthday Board en el puerto ${PORT}`));
  setInterval(refresh, REFRESH_MINUTES * 60 * 1000);
});
