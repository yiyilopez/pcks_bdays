const $ = id => document.getElementById(id);
let language = localStorage.getItem('ps-language') || 'en';
let data = null, messageIndex = 0, personIndex = 0, listPage = 0, fetching = false;
const text = (en, es) => language === 'es' ? es : en;
const messages = [
  { thanks: ['More than packages.\nYou deliver possibilities.', 'Más que paquetes.\nEntregas posibilidades.'], copy: ['Your effort makes a difference. Every single day.', 'Tu esfuerzo hace la diferencia. Todos los días.'], safe: ['The best delivery?\nGetting home safely.', '¿La mejor entrega?\nVolver a casa con bien.'], detail: ['Buckle up. Stay focused. Look out for each other.', 'Usa el cinturón. Mantente atento. Cuidémonos entre todos.'] },
  { thanks: ['Rain or shine.\nYou show up.', 'Llueva o salga el sol.\nTú estás ahí.'], copy: ['We see your dedication. And we appreciate you.', 'Vemos tu dedicación. Y te lo agradecemos.'], safe: ['Take a breath.\nThen take the next turn.', 'Respira un momento.\nDespués, sigue la ruta.'], detail: ['Park safely before checking your phone or route.', 'Estaciona con seguridad antes de revisar tu teléfono o ruta.'] },
  { thanks: ['A thousand little things.\nOne incredible squad.', 'Mil pequeños detalles.\nUn equipo increíble.'], copy: ['Every careful delivery carries a little of your heart.', 'Cada entrega con cuidado lleva un poco de tu corazón.'], safe: ['A little space.\nA lot more safety.', 'Un poco de distancia.\nMucha más seguridad.'], detail: ['Keep a safe following distance. Give yourself time.', 'Mantén una distancia segura. Date tiempo para reaccionar.'] },
];
function applyLanguage() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-en]').forEach(el => el.textContent = el.dataset[language]);
  $('language').textContent = language === 'en' ? 'ES' : 'EN';
  $('refresh').ariaLabel = text('Refresh birthdays', 'Actualizar cumpleaños');
  $('fullscreen').ariaLabel = text('Toggle fullscreen', 'Alternar pantalla completa');
  $('close-month').ariaLabel = text('Close', 'Cerrar');
  $('slide-dots').ariaLabel = text('Rotating safety message', 'Mensajes rotativos de seguridad');
  [...$('slide-dots').children].forEach((dot, i) => dot.ariaLabel = text(`Safety message ${i + 1}`, `Mensaje de seguridad ${i + 1}`));
  renderClock(); renderMessages(); if (data) renderData();
}
function renderClock() {
  const now = new Date();
  const locale = language === 'es' ? 'es-US' : 'en-US';
  const parts = new Intl.DateTimeFormat(locale, { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(now);
  $('clock').replaceChildren();
  const time = parts.filter(p => ['hour', 'minute', 'literal'].includes(p.type)).map(p => p.value).join('').trim();
  $('clock').append(document.createTextNode(time));
  const period = document.createElement('span'); period.textContent = parts.find(p => p.type === 'dayPeriod')?.value.toUpperCase() || ''; $('clock').append(period);
  const date = new Intl.DateTimeFormat(locale, { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }).format(now);
  $('current-date').textContent = `${date} · NEW JERSEY`;
}
function renderMessages() {
  const msg = messages[messageIndex]; const index = language === 'es' ? 1 : 0;
  $('thanks-title').textContent = msg.thanks[index]; $('safety-title').textContent = msg.safe[index];
  $('thanks-title').style.whiteSpace = 'pre-line'; $('safety-title').style.whiteSpace = 'pre-line';
  $('thanks-copy').textContent = msg.copy[index]; $('safety-copy').textContent = msg.detail[index];
  [...$('slide-dots').children].forEach((dot, i) => { dot.classList.toggle('active', i === messageIndex); dot.setAttribute('aria-pressed', String(i === messageIndex)); });
}
function birthdayRow(person, all = false) {
  const row = document.createElement('div'); row.className = 'birthday-row';
  const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.setAttribute('aria-hidden', 'true');
  const tokens = person.name.split(/\s+/); avatar.textContent = [tokens[0]?.[0], tokens.length > 1 ? tokens.at(-1)[0] : ''].join('').toUpperCase();
  const info = document.createElement('div'); info.className = 'birthday-person';
  const name = document.createElement('h3'); name.textContent = person.name;
  const subtitle = document.createElement('p');
  const today = data.today.month === 11 && person.day === data.today.day;
  const passed = data.today.month === 11 && person.day < data.today.day;
  subtitle.textContent = today ? text('A special day for our squad!', '¡Un día especial para el equipo!') : passed ? text('Celebrated with the squad', 'Celebramos contigo') : text('A little celebration ahead', 'Se acerca un día especial');
  info.append(name, subtitle);
  const date = document.createElement('div'); date.className = 'birthday-date';
  const day = document.createElement('strong'); day.textContent = String(person.day).padStart(2, '0');
  const month = document.createElement('span'); month.textContent = today ? text('TODAY', 'HOY') : 'NOV';
  date.append(day, month); row.append(avatar, info, date);
  if (today) row.classList.add('is-today');
  return row;
}
function renderData() {
  const inNovember = data.today.month === 11;
  const birthdays = data.birthdays;
  const today = birthdays.filter(b => b.day === data.today.day);
  const upcoming = birthdays.filter(b => b.day > data.today.day);
  const future = [...today, ...upcoming];
  let featured = today.length ? today[personIndex % today.length] : upcoming[0];
  $('hero-person').hidden = !featured; $('date-sticker').hidden = !featured;
  $('hero-title').replaceChildren();
  const title = !inNovember ? text('Great people.\nEvery season.', 'Grandes personas.\nTodo el año.') : today.length ? text('Happy birthday,\nsquad!', '¡Feliz cumpleaños,\nequipo!') : featured ? text('Next stop:\na celebration.', 'Próxima parada:\nuna celebración.') : text('Every mile.\nEvery smile.\nAll you.', 'Cada milla.\nCada sonrisa.\nGracias a ti.');
  title.split('\n').forEach((line, i, arr) => { const el = i === arr.length - 1 ? document.createElement('em') : document.createElement('span'); el.textContent = line; $('hero-title').append(el); if (i < arr.length - 1) $('hero-title').append(document.createElement('br')); });
  $('hero-label').textContent = today.length ? text('TODAY IS YOUR DAY', 'HOY ES TU DÍA') : text('A REASON TO CELEBRATE', 'UNA RAZÓN PARA CELEBRAR');
  $('hero-kicker').textContent = today.length ? text('SPECIAL DELIVERY, JUST FOR YOU', 'UNA ENTREGA ESPECIAL PARA TI') : featured ? text('NEXT UP ON THE ROUTE', 'LO PRÓXIMO EN LA RUTA') : text('THE PEOPLE BEHIND THE MILES', 'LAS PERSONAS DETRÁS DE CADA MILLA');
  document.querySelector('.hero-edition').textContent = text('THE NOVEMBER EDITION', 'EDICIÓN DE NOVIEMBRE');
  if (featured) {
    $('hero-name').textContent = featured.name;
    const days = featured.day - data.today.day;
    $('hero-detail').textContent = today.length ? text('Wishing you a day as great as you are.', 'Que tengas un día tan especial como tú.') : text(`November ${featured.day} · ${days === 1 ? 'Tomorrow' : `In ${days} days`}`, `${featured.day} de noviembre · ${days === 1 ? 'Mañana' : `En ${days} días`}`);
    $('sticker-day').textContent = String(featured.day).padStart(2, '0');
    $('sticker-caption').textContent = today.length ? text('HAPPY BIRTHDAY', 'FELIZ CUMPLEAÑOS') : text('SAVE THE DATE', 'GUARDA LA FECHA');
  }
  $('hero-description').textContent = !inNovember ? text('Our November edition returns next November. Until then, thank you for every mile.', 'La edición de noviembre regresa el próximo noviembre. Mientras tanto, gracias por cada milla.') : today.length ? text('A whole squad cheering you on. Today and every day.', 'Todo un equipo celebrándote. Hoy y cada día.') : future.length ? text('No birthdays today. Plenty of good people to celebrate.', 'Hoy no hay cumpleaños. Pero siempre hay un gran equipo para celebrar.') : text('All November birthdays celebrated. The appreciation keeps going.', 'Ya celebramos todos los cumpleaños del mes. El agradecimiento continúa.');
  $('panel-caption').textContent = inNovember ? text(`${birthdays.length} birthdays. One incredible squad.`, `${birthdays.length} cumpleaños. Un equipo increíble.`) : text('November birthdays will appear here in November.', 'Los cumpleaños aparecerán aquí en noviembre.');
  const visible = future.length ? future : birthdays;
  const perPage = window.innerWidth >= 1100 && window.innerHeight < 850 ? 3 : 4;
  const totalPages = Math.max(1, Math.ceil(visible.length / perPage));
  const pageItems = visible.slice((listPage % totalPages) * perPage, (listPage % totalPages) * perPage + perPage);
  $('birthday-list').replaceChildren(...pageItems.map(b => birthdayRow(b)));
  if (!pageItems.length) {
    const empty = document.createElement('div'); empty.className = 'empty-list';
    empty.textContent = !inNovember ? text('The November route is taking a little break. Our appreciation never does.', 'La ruta de noviembre está en pausa. Nuestro agradecimiento, nunca.') : text('No birthdays listed yet. Our squad is always worth celebrating.', 'Aún no hay cumpleaños registrados. Siempre vale la pena celebrar al equipo.');
    $('birthday-list').append(empty);
  }
  $('all-birthdays').replaceChildren(...birthdays.map(b => birthdayRow(b, true)));
  if (!birthdays.length) $('all-birthdays').textContent = text('No birthdays for this month.', 'No hay cumpleaños para este mes.');
  const offline = data.connection === 'offline'; const snapshot = data.connection === 'snapshot';
  $('source-status').textContent = offline ? text('Connection paused · saved birthdays', 'Sin conexión · cumpleaños guardados') : snapshot ? text('November · saved snapshot', 'Noviembre · copia guardada') : data.stale ? text('Live source · update delayed', 'Fuente conectada · actualización demorada') : text('Birthday route up to date', 'Ruta de cumpleaños actualizada');
  $('status-dot').className = offline || data.stale ? 'offline' : snapshot ? '' : 'live';
  const updated = new Intl.DateTimeFormat(language === 'es' ? 'es-US' : 'en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(data.sourceUpdatedAt));
  $('updated-status').textContent = text(`Updated ${updated} ET`, `Actualizado ${updated} ET`);
}
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 5000); }
async function load(manual = false) {
  if (fetching) return;
  fetching = true; $('refresh').classList.add('spinning');
  try {
    const response = await fetch('/api/birthdays', { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (response.status === 401) {
      data = null; $('hero-person').hidden = true; $('date-sticker').hidden = true;
      $('hero-name').textContent = ''; $('birthday-list').replaceChildren(); $('all-birthdays').replaceChildren();
      if (!$('unlock-dialog').open) $('unlock-dialog').showModal(); return;
    }
    if (!response.ok) {
      if (response.status === 503) { $('source-status').textContent = text('Birthday source pending connection', 'Fuente de cumpleaños pendiente'); $('birthday-list').textContent = text('The birthday route is being prepared. Thanks for being part of the squad.', 'Estamos preparando la ruta de cumpleaños. Gracias por ser parte del equipo.'); }
      throw new Error('UNAVAILABLE');
    }
    data = await response.json(); renderData();
    if (manual) toast(text('Screen refreshed.', 'Pantalla actualizada.'));
  } catch {
    if (data) { data.connection = 'offline'; renderData(); }
    if (manual) toast(text('Unable to connect. Keeping the last saved birthdays.', 'No pudimos conectar. Conservamos los últimos cumpleaños guardados.'));
  } finally { fetching = false; $('refresh').classList.remove('spinning'); }
}
$('language').addEventListener('click', () => { language = language === 'en' ? 'es' : 'en'; localStorage.setItem('ps-language', language); applyLanguage(); });
$('refresh').addEventListener('click', () => load(true));
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else { await document.documentElement.requestFullscreen(); if ('wakeLock' in navigator) await navigator.wakeLock.request('screen').catch(() => {}); } }
  catch { toast(text('Use your browser’s fullscreen option for TV mode.', 'Usa la opción de pantalla completa del navegador para el modo TV.')); }
});
$('show-month').addEventListener('click', () => $('month-dialog').showModal());
$('close-month').addEventListener('click', () => $('month-dialog').close());
$('month-dialog').addEventListener('click', e => { if (e.target === $('month-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
$('unlock-dialog').addEventListener('cancel', e => e.preventDefault());
$('unlock-form').addEventListener('submit', async e => {
  e.preventDefault(); $('unlock-error').textContent = ''; $('unlock-button').disabled = true;
  try {
    const response = await fetch('/api/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: $('screen-code').value }) });
    if (!response.ok) throw new Error(response.status === 429 ? 'RATE_LIMIT' : 'INVALID_CODE');
    $('screen-code').value = ''; $('unlock-dialog').close(); await load();
  } catch (error) { $('unlock-error').textContent = error.message === 'RATE_LIMIT' ? text('Too many attempts. Try again in 15 minutes.', 'Demasiados intentos. Intenta en 15 minutos.') : text('Check your screen code and try again.', 'Revisa el código e intenta de nuevo.'); }
  finally { $('unlock-button').disabled = false; }
});
[...$('slide-dots').children].forEach((dot, i) => dot.addEventListener('click', () => { messageIndex = i; renderMessages(); }));
setInterval(() => { messageIndex = (messageIndex + 1) % messages.length; personIndex++; listPage++; renderMessages(); if (data) renderData(); }, 20000);
setInterval(renderClock, 1000);
setInterval(() => { if (!document.hidden) void load(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderClock(); void load(); } });
window.addEventListener('online', () => load());
window.addEventListener('resize', () => { if (data) renderData(); });
applyLanguage(); void load();
