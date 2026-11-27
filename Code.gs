/**
 * International Simple English: Google Sheets backend.
 *
 * Paste this whole file into your Google Sheet's Apps Script editor
 * (Extensions > Apps Script), then follow README.md.
 *
 * Passwords are NOT written here. Add them under
 * Project Settings > Script properties:
 *   PASS_AARJIT = <Aarjit's password>
 *   PASS_MO     = <Mo's password>
 */

// One tab per section. The first column must always be "id".
const COLLECTIONS = {
  tasks: ['id', 'title', 'assignee', 'by', 'urgency', 'status', 'progress', 'added', 'due', 'notes', 'comments', 'createdAt', 'updatedAt'],
  notes: ['id', 'title', 'body', 'by', 'updatedBy', 'comments', 'createdAt', 'updatedAt'],
  logs:  ['id', 'date', 'by', 'hours', 'text', 'comments', 'at'],
  links: ['id', 'title', 'url', 'note', 'by', 'at'],
  feed:  ['id', 'events', 'readIds', 'seenAt']
};
const USERS = ['aarjit', 'mo'];
const TOKEN_DAYS = 30;      // how long a sign-in lasts on a device
const MAX_FAILS = 8;        // wrong passwords before a 15-minute lock
const CELL_LIMIT = 49000;   // Google Sheets allows 50,000 characters per cell

/** Run this once from the editor: creates the tabs and checks the passwords. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(COLLECTIONS).forEach(function (name) { sheetFor_(ss, name); });
  const props = PropertiesService.getScriptProperties();
  const missing = USERS.filter(function (u) { return !props.getProperty('PASS_' + u.toUpperCase()); });
  if (missing.length) {
    Logger.log('Tabs are ready. Now add these Script properties: ' + missing.map(function (u) { return 'PASS_' + u.toUpperCase(); }).join(', '));
  } else {
    Logger.log('Setup complete. Tabs are ready and both passwords are set.');
  }
}

/** Opening the web app address in a browser shows this, which is handy for checking the deployment. */
function doGet() {
  return out_({ ok: true, app: 'International Simple English', status: 'running' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad_request' }); }
  try {
    if (req.action === 'login') return out_(login_(req.user, req.pass));
    const user = auth_(req.token);
    if (!user) return out_({ ok: false, error: 'auth' });
    if (req.action === 'poll') return out_(poll_(req.version));
    if (req.action === 'logout') {
      PropertiesService.getScriptProperties().deleteProperty('TOKEN_' + req.token);
      return out_({ ok: true });
    }
    if (req.action === 'set' || req.action === 'update' || req.action === 'remove') return out_(write_(req, user));
    return out_({ ok: false, error: 'bad_request' });
  } catch (err) {
    return out_({ ok: false, error: (err && err.code) || 'server', message: String((err && err.message) || err) });
  }
}

/* ---------------- sign in ---------------- */

function login_(user, pass) {
  if (USERS.indexOf(user) < 0) return { ok: false, error: 'bad_password' };
  const cache = CacheService.getScriptCache();
  const failKey = 'FAILS_' + user;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_FAILS) return { ok: false, error: 'locked' };

  const props = PropertiesService.getScriptProperties();
  const real = props.getProperty('PASS_' + user.toUpperCase());
  if (!real) return { ok: false, error: 'not_configured' };
  if (String(pass) !== String(real)) {
    cache.put(failKey, String(fails + 1), 900);
    return { ok: false, error: 'bad_password' };
  }
  cache.remove(failKey);
  cleanTokens_(props);
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
  props.setProperty('TOKEN_' + token, user + '|' + (Date.now() + TOKEN_DAYS * 86400000));
  return { ok: true, token: token, user: user };
}

function auth_(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const props = PropertiesService.getScriptProperties();
  const v = props.getProperty('TOKEN_' + token);
  if (!v) return null;
  const parts = v.split('|');
  if (Date.now() > Number(parts[1])) { props.deleteProperty('TOKEN_' + token); return null; }
  return USERS.indexOf(parts[0]) >= 0 ? parts[0] : null;
}

function cleanTokens_(props) {
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('TOKEN_') === 0 && Date.now() > Number(String(all[k]).split('|')[1])) props.deleteProperty(k);
  });
}

/* ---------------- reading ---------------- */

function poll_(clientVersion) {
  const version = PropertiesService.getScriptProperties().getProperty('VERSION') || '0';
  if (clientVersion && String(clientVersion) === version) return { ok: true, version: version, changed: false };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = {};
  Object.keys(COLLECTIONS).forEach(function (name) { data[name] = readRows_(sheetFor_(ss, name)); });
  return { ok: true, version: version, changed: true, data: data };
}

function readRows_(sh) {
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0].map(String);
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row[0]) continue;
    const o = {};
    header.forEach(function (h, i) {
      if (h && row[i] !== '' && row[i] !== null) o[h] = cellOut_(row[i]);
    });
    rows.push(o);
  }
  return rows;
}

/* ---------------- writing ---------------- */

function write_(req, user) {
  const name = req.col;
  const id = String(req.id || '');
  if (!COLLECTIONS[name]) throw { code: 'bad_request' };
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw { code: 'bad_request' };
  if (name === 'feed' && id !== user) throw { code: 'forbidden' };   // each person writes only their own notifications

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = sheetFor_(SpreadsheetApp.getActiveSpreadsheet(), name);
    const values = sh.getDataRange().getValues();
    const header = values[0].map(String);
    let rowIdx = -1;
    for (let r = 1; r < values.length; r++) { if (String(values[r][0]) === id) { rowIdx = r; break; } }

    if (req.action === 'remove') {
      if (rowIdx > 0) sh.deleteRow(rowIdx + 1);
    } else {
      const data = req.data || {};
      if (typeof data !== 'object' || Array.isArray(data)) throw { code: 'bad_request' };
      const obj = {};
      if (req.action === 'update') {
        if (rowIdx < 0) throw { code: 'not_found' };
        header.forEach(function (h, i) { if (h && values[rowIdx][i] !== '') obj[h] = cellOut_(values[rowIdx][i]); });
      }
      Object.keys(data).forEach(function (k) { if (/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) obj[k] = data[k]; });
      obj.id = id;
      Object.keys(obj).forEach(function (k) {
        if (header.indexOf(k) < 0) { header.push(k); sh.getRange(1, header.length).setValue(k).setFontWeight('bold'); }
      });
      const row = header.map(function (h) { return cellIn_(obj[h]); });
      const rowNum = rowIdx > 0 ? rowIdx + 1 : sh.getLastRow() + 1;
      sh.getRange(rowNum, 1, 1, header.length).setNumberFormat('@').setValues([row]);
    }
    const version = String(Date.now());
    PropertiesService.getScriptProperties().setProperty('VERSION', version);
    return { ok: true, version: version };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- helpers ---------------- */

function sheetFor_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    const h = COLLECTIONS[name];
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:Z').setNumberFormat('@');   // keep dates and numbers as typed text
  }
  return sh;
}

function cellOut_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v);
}

function cellIn_(v) {
  if (v === undefined || v === null) return '';
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (s.length > CELL_LIMIT) throw { code: 'too_large' };
  if (s.charAt(0) === '=') s = "'" + s;   // never let typed text run as a spreadsheet formula
  return s;
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
