/**
 * Admin.gs — Admin-only server functions.
 *
 * All public functions here check for admin role before executing.
 */

function _requireAdmin() {
  var email = _currentEmail();
  var role = getUserRole(email);
  if (role !== 'admin') throw new Error('Admin access required.');
}

// ─── flag management ──────────────────────────────────────────────────────────

function getOpenFlags() {
  _requireAdmin();
  return dbWhere('flags', function(f) { return f.status === 'open'; });
}

function resolveFlag(flagId, resolutionNote) {
  _requireAdmin();
  var email = _currentEmail();
  return dbUpdate('flags', function(f) { return f.id === flagId; }, {
    status: 'resolved',
    resolved_by: email,
    resolved_at: new Date().toISOString(),
    resolution_note: resolutionNote || ''
  });
}

function dismissFlag(flagId, note) {
  _requireAdmin();
  var email = _currentEmail();
  return dbUpdate('flags', function(f) { return f.id === flagId; }, {
    status: 'dismissed',
    resolved_by: email,
    resolved_at: new Date().toISOString(),
    resolution_note: note || ''
  });
}

// ─── CLO management ──────────────────────────────────────────────────────────

function adminEditClo(cloId, newText, reason) {
  _requireAdmin();
  var existing = dbFindOne('clos', function(c) { return c.id === cloId; });
  if (!existing) throw new Error('CLO not found: ' + cloId);
  auditLog('clo', cloId, 'edit', { text: existing.text }, { text: newText, reason: reason });
  return dbUpdate('clos', function(c) { return c.id === cloId; }, { text: newText });
}

// ─── coverage dashboard ───────────────────────────────────────────────────────

function getCoverageDashboard() {
  _requireAdmin();
  var courses = dbGetAll('courses').filter(function(c) { return c.status === 'active'; });
  var clos = dbGetAll('clos');
  var programs = dbGetAll('programs').filter(function(p) { return p.status === 'active'; });
  var plos = dbGetAll('plos');
  var flags = dbWhere('flags', function(f) { return f.status === 'open'; });
  var users = dbGetAll('users');

  var coursesWithClos = {};
  clos.forEach(function(c) { coursesWithClos[c.course_id] = true; });

  var coursesNoClos = courses.filter(function(c) { return !coursesWithClos[c.id]; });

  var programsNoPlos = programs.filter(function(p) {
    return !plos.some(function(pl) { return pl.program_id === p.id; });
  });

  return {
    total_programs: programs.length,
    programs_no_plos: programsNoPlos.map(function(p) { return { id: p.id, name: p.name }; }),
    total_courses: courses.length,
    courses_no_clos: coursesNoClos.map(function(c) { return { id: c.id, code: c.code, title: c.title }; }),
    open_flags: flags.length,
    total_users: users.length,
    faculty_users: users.filter(function(u) { return u.role === 'faculty'; }).length,
    admin_users: users.filter(function(u) { return u.role === 'admin'; }).length,
  };
}

// ─── edit log ─────────────────────────────────────────────────────────────────

function getEditLog(limit) {
  _requireAdmin();
  var log = dbGetAll('edit_log');
  log.sort(function(a, b) { return b.timestamp > a.timestamp ? 1 : -1; });
  return log.slice(0, limit || 100);
}

// ─── user management ─────────────────────────────────────────────────────────

function promoteToAdmin(email) {
  _requireAdmin();
  var existing = dbFindOne('users', function(u) { return u.email === email; });
  if (!existing) throw new Error('User not found: ' + email);
  return dbUpdate('users', function(u) { return u.email === email; }, { role: 'admin' });
}

function getAllUsers() {
  _requireAdmin();
  return dbGetAll('users');
}

// ─── framework editor stubs ───────────────────────────────────────────────────

function adminUpdateFrameworkRow(tableName, rowId, updates) {
  _requireAdmin();
  var allowed = ['framework_verbs','framework_behaviors','framework_task_types','framework_deliverables','framework_disciplines','framework_ai_resistance_features'];
  if (allowed.indexOf(tableName) === -1) throw new Error('Not a framework table: ' + tableName);
  var existing = dbFindOne(tableName, function(r) { return r.id === rowId; });
  auditLog(tableName, rowId, 'edit', existing, updates);
  var result = dbUpdate(tableName, function(r) { return r.id === rowId; }, updates);
  refreshFrameworkCache();
  return result;
}
