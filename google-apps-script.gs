/*
Tilmelding v3 · Google Apps Script

Faner:
- Medlemmer: manuel navneliste
- Arrangementer: manuel/importeret eventliste
- Tilmeldinger: rå historik
- Køkken: automatisk oversigt opdelt pr. aften
*/

const SHEETS = {
  MEMBERS: 'Medlemmer',
  EVENTS: 'Arrangementer',
  SIGNUPS: 'Tilmeldinger',
  KITCHEN: 'Køkken'
};

const MEMBER_HEADERS = ['MedlemID', 'Navn', 'Aktiv'];
const EVENT_HEADERS = ['EventID', 'Dato', 'Tid', 'Titel', 'Kategori', 'Beskrivelse', 'GæsterTilladt'];
const SIGNUP_HEADERS = ['Tidspunkt', 'MedlemID', 'Navn', 'EventID', 'Dato', 'Tid', 'Titel', 'Deltager', 'Mad', 'Gæst', 'Gæstens navn', 'Gæst spiser', 'Bemærkning', 'UpdatedAt'];

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const members = getOrCreate_(ss, SHEETS.MEMBERS, MEMBER_HEADERS);
  const events = getOrCreate_(ss, SHEETS.EVENTS, EVENT_HEADERS);
  getOrCreate_(ss, SHEETS.SIGNUPS, SIGNUP_HEADERS);
  getOrCreate_(ss, SHEETS.KITCHEN, ['Køkkenoversigt']);

  if (members.getLastRow() < 2) {
    members.getRange(2, 1, 33, 3).setValues([
      ['1', 'Peter Andersen', 'Ja'],
      ['2', 'Lars Møller Andersen', 'Ja'],
      ['3', 'Ivar Lind Bendixen', 'Ja'],
      ['4', 'Mone Brandstrup', 'Ja'],
      ['5', 'Christian Peter Brandstrup', 'Ja'],
      ['6', 'Svend Erik Christensen', 'Ja'],
      ['7', 'Jens Carsten Kilian Christiansen', 'Ja'],
      ['8', 'Mogens Dahl', 'Ja'],
      ['9', 'Anton Edholm', 'Ja'],
      ['10', 'Per Egekjær', 'Ja'],
      ['11', 'Ib Kurt Grøn', 'Ja'],
      ['12', 'Bjarne Halleby Hansen', 'Ja'],
      ['13', 'Lars Rohde Hansen', 'Ja'],
      ['14', 'Finn Hansen', 'Ja'],
      ['15', 'Lars Bo Hansen', 'Ja'],
      ['16', 'Ole John Hansen', 'Ja'],
      ['17', 'Bent Kragh Jacobsen', 'Ja'],
      ['18', 'Kurt Jensen', 'Ja'],
      ['19', 'Claus Johnny Johansen', 'Ja'],
      ['20', 'Kim Karlsson', 'Ja'],
      ['21', 'John Kristensen', 'Ja'],
      ['22', 'Bøje Skov Larsen', 'Ja'],
      ['23', 'Niels-Ebbe Dalsø Larsen', 'Ja'],
      ['24', 'Per Henchel Madsen', 'Ja'],
      ['25', 'Bjørn Mikkelsen', 'Ja'],
      ['26', 'Hans Nielsen', 'Ja'],
      ['27', "Henry O'Connor", 'Ja'],
      ['28', 'Lars Weide Olsen', 'Ja'],
      ['29', 'Daniel Holm Olsen', 'Ja'],
      ['30', 'Freddy Tage Ottosen', 'Ja'],
      ['31', 'Gert Sunesen', 'Ja'],
      ['32', 'Henning Søndermølle', 'Ja'],
      ['33', 'Torben Møller Sørensen', 'Ja']
    ]);
  }

  if (events.getLastRow() < 2) {
    events.getRange(2, 1, 14, 7).setValues([
      ['2026-09-02','2026-09-02','19:30','Alle brødres dag','IO','Gennemgang af mødeplan. Etisk oplæg.','Nej'],
      ['2026-09-09','2026-09-09','19:30','Alm. arbejdsmøde','IO','Almindeligt arbejdsmøde.','Nej'],
      ['2026-09-16','2026-09-16','19:30','HT 25 år Freddy Ottosen','IO','Hæderstegn 25 år.','Nej'],
      ['2026-09-30','2026-09-30','19:30','Alm. arbejdsmøde · Tag en ven med','IO','Almindeligt arbejdsmøde. Tag en ven med.','Ja'],
      ['2026-10-07','2026-10-07','19:30','Indvielse','Logeaften','Indvielse.','Nej'],
      ['2026-10-14','2026-10-14','19:30','Alm. arbejdsmøde','IO','Officielt besøg af loge nr. 111 De fem Tårne Kalundborg.','Nej'],
      ['2026-10-21','2026-10-21','19:30','Alm. arbejdsmøde','IO','Almindeligt arbejdsmøde.','Nej'],
      ['2026-10-28','2026-10-28','18:30','Ældre brødres aften','IO','Almindeligt arbejdsmøde. Ældre brødres aften. Etisk indlæg.','Nej'],
      ['2026-11-04','2026-11-04','19:30','Alm. arbejdsmøde','IO','Almindeligt arbejdsmøde.','Nej'],
      ['2026-11-11','2026-11-11','19:30','Tegn og pasord','IO','Tegn og pasord ved storrepræsentanterne samt referat fra halvårs- og distriktsmødet.','Nej'],
      ['2026-11-18','2026-11-18','19:30','HT 40 år Gert Sunesen','IO','Hæderstegn 40 år.','Nej'],
      ['2026-11-25','2026-11-25','19:30','Budget','IO','Budget fremlæggelse og godkendelse.','Nej'],
      ['2026-12-02','2026-12-02','19:30','Brodermåltid','IO','Brodermåltid. Etisk indlæg.','Nej'],
      ['2026-12-09','2026-12-09','18:00','Julestemning','Festdragt','Julestemning med ledsagere og logens enker.','Ja']
    ]);
  }

  formatAll_();
  rebuildKitchenSheet_();
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'list';
  if (action === 'setup') {
    setupSheet();
    return json_({ ok: true });
  }
  return json_({ ok: true, members: getMembers_(), events: getEvents_(), rows: getLatestRows_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreate_(ss, SHEETS.SIGNUPS, SIGNUP_HEADERS);
    sheet.appendRow([
      new Date(),
      data.memberId || '',
      data.name || '',
      data.eventId || '',
      data.eventDate || '',
      data.eventTime || '',
      data.eventTitle || '',
      yn_(data.attending),
      yn_(data.meal),
      yn_(data.guest),
      data.guestName || '',
      yn_(data.guestMeal),
      data.note || '',
      data.updatedAt || new Date().toISOString()
    ]);
    rebuildKitchenSheet_();
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function rebuildKitchenSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const kitchen = getOrCreate_(ss, SHEETS.KITCHEN, ['Køkkenoversigt']);
  const events = getEvents_().sort((a,b) => String(a.date + a.time).localeCompare(String(b.date + b.time)));
  const latest = getLatestRows_();
  kitchen.clear();

  let row = 1;
  events.forEach(event => {
    const rows = latest.filter(r => r.eventId === event.id && r.attending === 'yes')
      .sort((a,b) => String(a.name).localeCompare(String(b.name), 'da'));
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
  kitchen.setFrozenRows(0);
}

function getMembers_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreate_(ss, SHEETS.MEMBERS, MEMBER_HEADERS);
  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter(r => String(r[1] || '').trim() && String(r[2] || '').toLowerCase() !== 'nej').map(r => ({ id: String(r[0] || '').trim(), name: String(r[1] || '').trim() }));
}

function getEvents_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreate_(ss, SHEETS.EVENTS, EVENT_HEADERS);
  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter(r => String(r[0] || '').trim()).map(r => ({
    id: String(r[0] || '').trim(),
    date: toIsoDate_(r[1]),
    time: String(r[2] || '').trim(),
    title: String(r[3] || '').trim(),
    category: String(r[4] || '').trim(),
    description: String(r[5] || '').trim(),
    allowGuests: String(r[6] || '').toLowerCase() === 'ja'
  }));
}

function getLatestRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreate_(ss, SHEETS.SIGNUPS, SIGNUP_HEADERS);
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const latest = {};
  values.slice(1).forEach(row => {
    const item = {};
    headers.forEach((h,i) => item[h] = row[i]);
    const normalized = {
      memberId: String(item['MedlemID'] || '').trim(),
      name: String(item['Navn'] || '').trim(),
      eventId: String(item['EventID'] || '').trim(),
      eventDate: toIsoDate_(item['Dato']),
      eventTime: String(item['Tid'] || '').trim(),
      eventTitle: String(item['Titel'] || '').trim(),
      attending: fromDa_(item['Deltager']),
      meal: fromDa_(item['Mad']),
      guest: fromDa_(item['Gæst']),
      guestName: String(item['Gæstens navn'] || '').trim(),
      guestMeal: fromDa_(item['Gæst spiser']),
      note: String(item['Bemærkning'] || '').trim(),
      updatedAt: String(item['UpdatedAt'] || item['Tidspunkt'] || new Date().toISOString())
    };
    if (!normalized.memberId || !normalized.eventId) return;
    const key = normalized.eventId + '__' + normalized.memberId;
    if (!latest[key] || new Date(normalized.updatedAt) >= new Date(latest[key].updatedAt)) latest[key] = normalized;
  });
  return Object.keys(latest).map(k => latest[k]);
}

function getOrCreate_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function formatAll_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(SHEETS).forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, Math.max(1, sh.getLastColumn()));
    if (sh.getLastColumn() > 0) sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold').setBackground('#f3eadc');
  });
}

function yn_(v) { return v === 'yes' || v === true ? 'Ja' : 'Nej'; }
function da_(v) { return v === 'yes' ? 'Ja' : 'Nej'; }
function fromDa_(v) { const s = String(v || '').toLowerCase(); return (s === 'ja' || s === 'yes' || s === 'true') ? 'yes' : 'no'; }
function toIsoDate_(v) { if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd'); return String(v || '').trim(); }
function formatDate_(iso) { const d = new Date(String(iso) + 'T12:00:00'); return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd.MM.yyyy'); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
