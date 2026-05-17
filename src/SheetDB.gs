/**
 * SheetDB.gs — Google Sheets database access layer.
 *
 * Convention: each "table" is a named sheet in SPREADSHEET_ID.
 * All rows have a header row; data starts at row 2.
 * No hard deletes — status changes only.
 */

var SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');

// ─── low-level helpers ──────────────────────────────────────────────────────

function _getSheet(name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function _getHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function _rowToObj(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) { obj[h] = row[i]; });
  return obj;
}

function _objToRow(headers, obj) {
  return headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
}

/** Return all non-empty rows as an array of objects. */
function dbGetAll(tableName) {
  var sheet = _getSheet(tableName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headers = _getHeaders(sheet);
  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return data
    .filter(function(row) { return row.some(function(v) { return v !== ''; }); })
    .map(function(row) { return _rowToObj(headers, row); });
}

/** Return rows matching a predicate. */
function dbWhere(tableName, predicate) {
  return dbGetAll(tableName).filter(predicate);
}

/** Return first matching row or null. */
function dbFindOne(tableName, predicate) {
  var rows = dbGetAll(tableName);
  for (var i = 0; i < rows.length; i++) {
    if (predicate(rows[i])) return rows[i];
  }
  return null;
}

/**
 * Append a row. Generates a UUID for `id` if the table has an id column
 * and the object doesn't supply one. Returns the inserted object.
 */
function dbInsert(tableName, obj) {
  var sheet = _getSheet(tableName);
  var headers = _getHeaders(sheet);
  var now = new Date().toISOString();
  var email = _currentEmail();

  if (headers.indexOf('id') !== -1 && !obj.id) obj.id = _uuid();
  if (headers.indexOf('created_at') !== -1 && !obj.created_at) obj.created_at = now;
  if (headers.indexOf('updated_at') !== -1) obj.updated_at = now;
  if (headers.indexOf('created_by') !== -1 && !obj.created_by) obj.created_by = email;
  if (headers.indexOf('updated_by') !== -1) obj.updated_by = email;

  sheet.appendRow(_objToRow(headers, obj));
  return obj;
}

/**
 * Update the first row where predicate(row) is true.
 * Merges updates into the existing object.
 */
function dbUpdate(tableName, predicate, updates) {
  var sheet = _getSheet(tableName);
  var headers = _getHeaders(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var now = new Date().toISOString();
  var email = _currentEmail();

  for (var i = 0; i < data.length; i++) {
    var obj = _rowToObj(headers, data[i]);
    if (predicate(obj)) {
      Object.assign(obj, updates);
      if (headers.indexOf('updated_at') !== -1) obj.updated_at = now;
      if (headers.indexOf('updated_by') !== -1) obj.updated_by = email;
      sheet.getRange(i + 2, 1, 1, headers.length).setValues([_objToRow(headers, obj)]);
      return obj;
    }
  }
  return null;
}

// ─── auth helpers ───────────────────────────────────────────────────────────

function _currentEmail() {
  try { return Session.getActiveUser().getEmail(); } catch(e) { return 'system'; }
}

function _uuid() {
  return Utilities.getUuid();
}

// ─── audit log ──────────────────────────────────────────────────────────────

function auditLog(entityType, entityId, action, oldValue, newValue) {
  try {
    dbInsert('edit_log', {
      id: _uuid(),
      entity_type: entityType,
      entity_id: entityId,
      action: action,
      old_value: JSON.stringify(oldValue || null),
      new_value: JSON.stringify(newValue || null),
      actor: _currentEmail(),
      actor_role: _currentRole(),
      timestamp: new Date().toISOString()
    });
  } catch(e) {
    Logger.log('auditLog error: ' + e.message);
  }
}

function _currentRole() {
  var email = _currentEmail();
  var user = dbFindOne('users', function(u) { return u.email === email; });
  return user ? user.role : 'faculty';
}

// ─── user record ────────────────────────────────────────────────────────────

function ensureUser(email) {
  var existing = dbFindOne('users', function(u) { return u.email === email; });
  if (existing) {
    dbUpdate('users', function(u) { return u.email === email; }, {
      last_login_at: new Date().toISOString()
    });
    return existing;
  }
  return dbInsert('users', {
    email: email,
    role: 'faculty',
    first_login_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
    program_associations: '[]'
  });
}

function getUserRole(email) {
  var user = dbFindOne('users', function(u) { return u.email === email; });
  return user ? user.role : 'faculty';
}
