/*
Tilmelding v3-v4 · Google Apps Script

Denne version er lavet til et selvstændigt Apps Script-projekt.
Den bruger derfor fast SHEET_ID og ikke getActiveSpreadsheet().

Faner:
- Medlemmer: id | navn
- Arrangementer: id | dato | tid | titel | beskrivelse | allowGuests
- Tilmeldinger: timestamp | memberId | navn | eventId | deltager | mad | guest | guestName | guestFood | note
- Køkken: genereres automatisk
*/

const SHEET_ID = '1gO9jUqyXwwhmqZqS0r3-XRcGkx_zwFU1Fvs7QVGE4_Q';

const SHEETS = {
  MEMBERS: 'Medlemmer',
  EVENTS: 'Arrangementer',
  SIGNUPS: 'Tilmeldinger',
  KITCHEN: 'Køkken'
};

const MEMBER_HEADERS = ['id', 'navn'];
const EVENT_HEADERS = ['id', 'dato', 'tid', 'titel', 'beskrivelse', 'allowGuests'];
const SIGNUP_HEADERS = ['timestamp', 'memberId', 'navn', 'eventId', 'deltager', 'mad', 'guest', 'guestName', 'guestFood', 'note'];

function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'list';

  if (action === 'setup') {
    setupSheet();
    return json_({ ok: true, message: 'Sheet sat op' });
  }

  if (action === 'kitchen') {
    rebuildKitchenSheet_();
    return json_({ ok: true, message: 'Køkken opdateret' });
  }

  return json_({
    ok: true,
    members: getMembers_(),
    events: getEvents_(),
    rows: getLatestRows_()
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getOrCreate_(ss, SHEETS.SIGNUPS, SIGNUP_HEADERS);

    ensureHeaders_(sheet, SIGNUP_HEADERS);

    sheet.appendRow([
      new Date(),
      String(data.memberId || '').trim(),
      String(data.navn || data.name || '').trim(),
      String(data.eventId || '').trim(),
      ynText_(data.deltager || data.attending),
      ynText_(data.mad || data.meal),
      ynText_(data.guest),
      String(data.guestName || '').trim(),
      ynText_(data.guestFood || data.guestMeal),
      String(data.note || '').trim()
    ]);

    rebuildKitchenSheet_();

    return json_({ ok: true, success: true });
  } catch (err) {
    return json_({ ok: false, success: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function setupSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  getOrCreate_(ss, SHEETS.MEMBERS, MEMBER_HEADERS);
  getOrCreate_(ss, SHEETS.EVENTS, EVENT_HEADERS);
  getOrCreate_(ss, SHEETS.SIGNUPS, SIGNUP_HEADERS);
  getOrCreate_(ss, SHEETS.KITCHEN, ['Køkkenoversigt']);
  formatAll_();
  rebuildKitchenSheet_();
}

function getMembers_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getOrCreate_(ss, SHEETS.MEMBERS, MEMBER_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = normalizeHeaders_(values[0]);
  const idCol = findCol_(headers, ['id', 'medlemid', 'memberid']);
  const nameCol = findCol_(headers, ['navn', 'name']);
  const activeCol = findCol_(headers, ['aktiv', 'active']);

  return values.slice(1)
    .filter(r => String(r[nameCol] || '').trim())
    .filter(r => activeCol === -1 || !['nej', 'no', 'false', '0'].includes(String(r[activeCol] || '').trim().toLowerCase()))
    .map((r, i) => ({
      id: String(idCol === -1 ? i + 1 : r[idCol]).trim(),
      name: String(r[nameCol]).trim()
    }));
}

function getEvents_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getOrCreate_(ss, SHEETS.EVENTS, EVENT_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = normalizeHeaders_(values[0]);
  const idCol = findCol_(headers, ['id', 'eventid']);
  const dateCol = findCol_(headers, ['dato', 'date']);
  const timeCol = findCol_(headers, ['tid', 'time']);
  const titleCol = findCol_(headers, ['titel', 'title']);
  const descCol = findCol_(headers, ['beskrivelse', 'description']);
  const categoryCol = findCol_(headers, ['kategori', 'category', 'type']);
  const guestsCol = findCol_(headers, ['allowguests', 'gæstertilladt', 'gaestertilladt']);

  return values.slice(1)
    .filter(r => String(idCol === -1 ? r[dateCol] : r[idCol] || '').trim())
    .map(r => ({
      id: String(idCol === -1 ? toIsoDate_(r[dateCol]) : r[idCol]).trim(),
      date: toIsoDate_(r[dateCol]),
      time: String(r[timeCol] || '').trim(),
      title: String(r[titleCol] || '').trim(),
      category: categoryCol === -1 ? '' : String(r[categoryCol] || '').trim(),
      description: descCol === -1 ? '' : String(r[descCol] || '').trim(),
      allowGuests: isYes_(guestsCol === -1 ? false : r[guestsCol])
    }));
}

function getLatestRows_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getOrCreate_(ss, SHEETS.SIGNUPS, SIGNUP_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = normalizeHeaders_(values[0]);

  const timestampCol = findCol_(headers, ['timestamp', 'tidspunkt']);
  const memberIdCol = findCol_(headers, ['memberid', 'medlemid']);
  const nameCol = findCol_(headers, ['navn', 'name']);
  const eventIdCol = findCol_(headers, ['eventid']);
  const attendingCol = findCol_(headers, ['deltager', 'attending']);
  const mealCol = findCol_(headers, ['mad', 'meal']);
  const guestCol = findCol_(headers, ['guest', 'gæst', 'gaest']);
  const guestNameCol = findCol_(headers, ['guestname', 'gæstensnavn', 'gaestensnavn']);
  const guestFoodCol = findCol_(headers, ['guestfood', 'guestmeal', 'gæstspiser', 'gaestspiser']);
  const noteCol = findCol_(headers, ['note', 'bemærkning', 'bemaerkning']);

  const latest = {};

  values.slice(1).forEach((row, index) => {
    const normalized = {
      memberId: String(memberIdCol === -1 ? '' : row[memberIdCol]).trim(),
      name: String(nameCol === -1 ? '' : row[nameCol]).trim(),
      eventId: String(eventIdCol === -1 ? '' : row[eventIdCol]).trim(),
      attending: ynValue_(attendingCol === -1 ? '' : row[attendingCol]),
      meal: ynValue_(mealCol === -1 ? '' : row[mealCol]),
      guest: ynValue_(guestCol === -1 ? '' : row[guestCol]),
      guestName: String(guestNameCol === -1 ? '' : row[guestNameCol]).trim(),
      guestMeal: ynValue_(guestFoodCol === -1 ? '' : row[guestFoodCol]),
      note: String(noteCol === -1 ? '' : row[noteCol]).trim(),
      updatedAt: toIsoDateTime_(timestampCol === -1 ? new Date() : row[timestampCol]),
      sortIndex: index
    };

    if (!normalized.memberId || !normalized.eventId) return;

    const key = normalized.eventId + '__' + normalized.memberId;
    if (!latest[key] || normalized.sortIndex >= latest[key].sortIndex) {
      latest[key] = normalized;
    }
  });

  return Object.keys(latest).map(k => latest[k]);
}

function rebuildKitchenSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const kitchen = getOrCreate_(ss, SHEETS.KITCHEN, ['Køkkenoversigt']);
  const events = getEvents_().sort((a, b) => String(a.date + a.time).localeCompare(String(b.date + b.time)));
  const latest = getLatestRows_();

  kitchen.clear();

  let row = 1;

  events.forEach(event => {
    const rows = latest
      .filter(r => r.eventId === event.id && r.attending === 'yes')
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'da'));

    const brotherMeals = rows.filter(r => r.meal === 'yes').length;
    const guests = rows.filter(r => r.guest === 'yes').length;
    const guestMeals = rows.filter(r => r.guestMeal === 'yes').length;
    const totalMeals = brotherMeals + guestMeals;

    kitchen.getRange(row, 1, 1, 6).merge().setValue(`${formatDate_(event.date)} kl. ${event.time} · ${event.title}`);
    kitchen.getRange(row, 1).setFontWeight('bold').setFontSize(13).setBackground('#8f2733').setFontColor('#ffffff');
    row++;

    kitchen.getRange(row, 1, 1, 5).setValues([['Deltagere', 'Brødre spiser', 'Gæster', 'Gæster spiser', 'Kuverter i alt']]).setFontWeight('bold').setBackground('#f3eadc');
    row++;

    kitchen.getRange(row, 1, 1, 5).setValues([[rows.length, brotherMeals, guests, guestMeals, totalMeals]]);
    row += 2;

    kitchen.getRange(row, 1, 1, 6).setValues([['Navn', 'Mad', 'Gæst', 'Gæstens navn', 'Gæst spiser', 'Bemærkning']]).setFontWeight('bold').setBackground('#f3eadc');
    row++;

    if (rows.length) {
      const values = rows.map(r => [r.name, da_(r.meal), da_(r.guest), r.guestName || '', da_(r.guestMeal), r.note || '']);
      kitchen.getRange(row, 1, values.length, 6).setValues(values);
      row += values.length;
    } else {
      kitchen.getRange(row, 1).setValue('Ingen tilmeldte endnu').setFontStyle('italic');
      row++;
    }

    row += 2;
  });

  kitchen.setColumnWidths(1, 6, 145);
}

function getOrCreate_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function formatAll_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Object.values(SHEETS).forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    sh.setFrozenRows(1);
    if (sh.getLastColumn() > 0) {
      sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#f3eadc');
      sh.autoResizeColumns(1, Math.max(1, sh.getLastColumn()));
    }
  });
}

function normalizeHeaders_(headers) {
  return headers.map(h => normalizeKey_(h));
}

function normalizeKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .replace(/[^a-z0-9]/g, '');
}

function findCol_(headers, names) {
  const normalizedNames = names.map(normalizeKey_);
  return headers.findIndex(h => normalizedNames.includes(h));
}

function isYes_(v) {
  const s = String(v || '').trim().toLowerCase();
  return ['yes', 'ja', 'true', '1', 'x'].includes(s);
}

function ynText_(v) {
  return isYes_(v) ? 'yes' : 'no';
}

function ynValue_(v) {
  return isYes_(v) ? 'yes' : 'no';
}

function da_(v) {
  return v === 'yes' ? 'Ja' : 'Nej';
}

function toIsoDate_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '').trim();
}

function toIsoDateTime_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }
  return String(v || '').trim();
}

function formatDate_(iso) {
  const d = new Date(String(iso) + 'T12:00:00');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd.MM.yyyy');
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
