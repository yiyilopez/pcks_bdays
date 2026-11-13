/** Package Squad TV · November only. Run as the spreadsheet owner. */
function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('BRIDGE_TOKEN');
    const request = JSON.parse(e.postData.contents);
    if (!token || token.length < 32 || !constantTimeEqual_(String(request.token || ''), token)) return json_({ error: 'UNAUTHORIZED' });
    const spreadsheetId = props.getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) return json_({ error: 'SOURCE_NOT_CONFIGURED' });
    const book = SpreadsheetApp.openById(spreadsheetId);
    const sheet = book.getSheetByName('November');
    if (!sheet) return json_({ error: 'SHEET_NOT_FOUND' });
    const birthdays = [];
    const seen = {};
    if (sheet.getLastRow() > 0) {
      // Source layout: repeated [name, day, blank] blocks, no header row.
      const rows = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getDisplayValues();
      rows.forEach(function(row) {
        for (let col = 0; col < row.length - 1; col++) {
          const name = String(row[col]).trim().replace(/\s+/g, ' ');
          const rawDay = String(row[col + 1]).trim();
          if (!name || !/[a-zA-ZÀ-ÿ]/.test(name) || name.length > 160 || name.indexOf('@') !== -1 || !/^\d{1,2}$/.test(rawDay)) continue;
          const day = Number(rawDay);
          if (day < 1 || day > 30) continue;
          const key = name.toLowerCase() + ':' + day;
          if (!seen[key]) { birthdays.push({ name: name, day: day, month: 11 }); seen[key] = true; }
          col++;
        }
      });
    }
    birthdays.sort(function(a, b) { return a.day - b.day || a.name.localeCompare(b.name); });
    return json_({ sourceMonth: 11, generatedAt: new Date().toISOString(), birthdays: birthdays });
  } catch (err) {
    // Never return spreadsheet content, exception messages, or credentials.
    return json_({ error: 'SOURCE_UNAVAILABLE' });
  }
}
function doGet() { return json_({ error: 'POST_REQUIRED' }); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function constantTimeEqual_(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
