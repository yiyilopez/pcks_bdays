import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { sanitizePayload, projectForTV, dailyKey } from '../lib/birthdays.mjs';

const raw = { sourceMonth: 11, generatedAt: '2026-11-13T15:00:00Z', birthdays: [
  { name: 'Test Driver', day: 18, month: 11, email: 'never@example.com', phone: '555', year: 1980, status: 'active' },
] };
test('TV projection strips all personal fields other than name/day/month', () => {
  const result = sanitizePayload(raw);
  assert.deepEqual(result.birthdays, [{ name: 'Test Driver', day: 18, month: 11 }]);
  assert.doesNotMatch(JSON.stringify(projectForTV(result, new Date('2026-11-13T15:00:00Z'))), /email|phone|1980|status|active/);
});
test('invalid November dates and malformed responses never replace the cache', () => {
  for (const day of [0, 31, -1, '18', 2.5]) assert.throws(() => sanitizePayload({ ...raw, birthdays: [{ name: 'Test Driver', day, month: 11 }] }));
  assert.throws(() => sanitizePayload({ error: 'UNAUTHORIZED' }));
  assert.throws(() => sanitizePayload({ ...raw, sourceMonth: 12 }));
});
test('New Jersey midnight controls today even when UTC is already tomorrow', () => {
  assert.equal(projectForTV(sanitizePayload(raw), new Date('2026-11-19T02:00:00Z')).today.day, 18);
  assert.equal(projectForTV(sanitizePayload(raw), new Date('2026-11-19T05:00:00Z')).today.day, 19);
});
test('daily 05:00 schedule follows EST and EDT', () => {
  assert.equal(dailyKey(new Date('2026-11-13T09:59:00Z')), null);
  assert.equal(dailyKey(new Date('2026-11-13T10:00:00Z')), '2026-11-13');
  assert.equal(dailyKey(new Date('2026-07-13T08:59:00Z')), null);
  assert.equal(dailyKey(new Date('2026-07-13T09:00:00Z')), '2026-07-13');
});
test('November birthdays do not reappear as December birthdays', () => {
  assert.deepEqual(projectForTV(sanitizePayload(raw), new Date('2026-12-01T12:00:00Z')).birthdays, []);
});
test('Apps Script bridge authorizes before reading and only emits allowed fields', () => {
  let reads = 0;
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => ({ BRIDGE_TOKEN: 'test-secret-is-at-least-32-characters', SPREADSHEET_ID: 'test-sheet' }[key]) }) },
    SpreadsheetApp: { openById: () => { reads++; return { getSheetByName: name => {
      assert.equal(name, 'November');
      return { getLastRow: () => 3, getLastColumn: () => 8, getRange: () => ({ getDisplayValues: () => [[], ['Test Driver', '18', '', 'Another Driver', '7', '', 'Invalid Driver', '31'], ['Test Driver', '18']] }) };
    } }; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ setMimeType: () => value }) },
  });
  vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), context);
  const denied = JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ token: 'wrong' }) } }));
  assert.equal(denied.error, 'UNAUTHORIZED'); assert.equal(reads, 0);
  const allowed = JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ token: 'test-secret-is-at-least-32-characters' }) } }));
  assert.deepEqual(allowed.birthdays, [{ name: 'Another Driver', day: 7, month: 11 }, { name: 'Test Driver', day: 18, month: 11 }]);
  assert.equal(reads, 1);
  assert.equal(JSON.parse(context.doGet()).error, 'POST_REQUIRED');
});
