export const TIME_ZONE = 'America/New_York';

export function newJerseyParts(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}

export function dailyKey(date = new Date()) {
  const p = newJerseyParts(date);
  return Number(p.hour) >= 5 ? `${p.year}-${p.month}-${p.day}` : null;
}

// Deliberately rebuild every object. No extra source fields can reach the TV.
export function sanitizePayload(raw) {
  if (!raw || raw.sourceMonth !== 11 || !Array.isArray(raw.birthdays) || raw.birthdays.length > 1000) throw new Error('INVALID_DATA');
  if (!raw.generatedAt || !Number.isFinite(Date.parse(raw.generatedAt))) throw new Error('INVALID_TIMESTAMP');
  const seen = new Set();
  const birthdays = raw.birthdays.map(item => {
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 160 || item.month !== 11 || !Number.isInteger(item.day) || item.day < 1 || item.day > 30) throw new Error('INVALID_BIRTHDAY');
    return { name: item.name.trim().replace(/\s+/g, ' '), day: item.day, month: 11 };
  }).filter(item => {
    const key = `${item.name.toLowerCase()}:${item.day}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
  return { sourceMonth: 11, generatedAt: new Date(raw.generatedAt).toISOString(), birthdays };
}

export function projectForTV(snapshot, now = new Date()) {
  const p = newJerseyParts(now);
  const birthdays = Number(p.month) === 11 ? snapshot.birthdays : [];
  return {
    sourceMonth: 11, sourceUpdatedAt: snapshot.generatedAt,
    today: { year: Number(p.year), month: Number(p.month), day: Number(p.day) },
    birthdays, timeZone: TIME_ZONE,
  };
}
