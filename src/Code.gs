/**
 * Code.gs — Main entry point for the Apps Script web app.
 *
 * doGet() serves the HTML shell.
 * All data functions are called via google.script.run from the frontend.
 */

// ─── web app entry point ──────────────────────────────────────────────────────

function doGet(e) {
  var email = Session.getActiveUser().getEmail();
  ensureUser(email);

  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .setTitle('UMPI Assessment Design Tool')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ─── bootstrap data (called once on page load) ────────────────────────────────

function getBootstrapData() {
  var email = _currentEmail();
  var user = ensureUser(email);
  var programs = dbGetAll('programs').filter(function(p) { return p.status === 'active'; });
  var glos = dbGetAll('glos').filter(function(g) { return g.status === 'active'; });

  return {
    user: { email: email, role: user.role },
    programs: programs,
    glos: glos,
  };
}

// ─── course / outcome data ────────────────────────────────────────────────────

function getCoursesByProgram(programId) {
  var cpRows = dbWhere('course_programs', function(cp) { return cp.program_id === programId; });
  var courseIds = cpRows.map(function(cp) { return cp.course_id; });
  return dbWhere('courses', function(c) { return courseIds.indexOf(c.id) !== -1 && c.status === 'active'; });
}

function getAllCourses() {
  return dbGetAll('courses').filter(function(c) { return c.status === 'active'; });
}

function getCourseContext(courseId) {
  try {
    var allCourses = dbGetAll('courses');
    var course = null;
    for (var i = 0; i < allCourses.length; i++) {
      if (String(allCourses[i].id).trim() === String(courseId).trim()) {
        course = allCourses[i];
        break;
      }
    }
    if (!course) {
      return { _error: true, message: 'Course not found: ' + courseId + ' (checked ' + allCourses.length + ' rows)' };
    }

    var cpRows = dbWhere('course_programs', function(cp) { return cp.course_id === courseId; });
    var programIds = cpRows.map(function(cp) { return cp.program_id; });
    var programs = dbWhere('programs', function(p) { return programIds.indexOf(p.id) !== -1; });

    var clos = dbWhere('clos', function(c) {
      return c.course_id === courseId && c.status === 'active';
    });

    var gloMappings = dbWhere('glo_course_mappings', function(m) { return m.course_id === courseId; });
    var gloIds = gloMappings.map(function(m) { return m.glo_id; });
    var glos = dbWhere('glos', function(g) { return gloIds.indexOf(g.id) !== -1; });

    var programsWithPlos = programs.map(function(p) {
      var plos = dbWhere('plos', function(pl) { return pl.program_id === p.id && pl.status === 'active'; });
      return { program: p, plos: plos };
    });

    var result = {
      course: course,
      programs: programs,
      clos: clos,
      glos: glos,
      programsWithPlos: programsWithPlos
    };

    // Force JSON round-trip: converts Date objects → ISO strings and removes
    // any non-serializable values that cause google.script.run to return null.
    return JSON.parse(JSON.stringify(result));
  } catch(e) {
    return { _error: true, message: 'Exception in getCourseContext: ' + e.message + ' | stack: ' + e.stack };
  }
}

// ─── server-side diagnostic (run directly in Apps Script editor) ──────────────

function testCourseContext() {
  var courses = dbGetAll('courses');
  Logger.log('Total courses: ' + courses.length);
  if (courses.length === 0) { Logger.log('No courses found — run resetAndReseed()'); return; }
  var id = courses[0].id;
  Logger.log('Testing with course id: ' + id);
  var result = getCourseContext(id);
  Logger.log(JSON.stringify(result));
}

// ─── recommendation engine ────────────────────────────────────────────────────

function getRecommendation(outcomeText, programName, forcedBehavior, forcedPairedBehavior) {
  return recommend(outcomeText, programName, forcedBehavior, forcedPairedBehavior);
}

function getVerbPickerGroups() {
  return _buildVerbPickerGroups ? _buildVerbPickerGroups() : [];
}

function getFrameworkBehaviors() {
  return getAllBehaviors();
}

function getFrameworkTaskTypes() {
  return getAllTaskTypes();
}

function getFrameworkDeliverables() {
  return getAllDeliverables();
}

// ─── prompt generation ────────────────────────────────────────────────────────

function buildPrompt(courseCode, courseTitle, courseDescription, programName, outcomeText, recommendation) {
  return generatePrompt({
    courseCode: courseCode,
    courseTitle: courseTitle,
    courseDescription: courseDescription,
    programName: programName,
    outcomeText: outcomeText,
    recommendation: recommendation
  });
}

function savePromptRecord(courseId, cloId, outcomeText, recommendation, promptText, notes) {
  var email = _currentEmail();
  return savePrompt(email, courseId, cloId, outcomeText, recommendation, promptText, notes);
}

function getMyPromptsData() {
  return getMyPrompts(_currentEmail());
}

function updateMyPrompt(promptId, newText) {
  var email = _currentEmail();
  // Verify ownership
  var prompt = dbFindOne('prompts', function(p) { return p.id === promptId; });
  if (!prompt || prompt.owner !== email) throw new Error('Prompt not found or not yours.');
  return updatePromptText(promptId, newText);
}

// ─── CLO/flag management (faculty) ───────────────────────────────────────────

function addClo(courseId, number, text, proposalNumber, proposalDate, sourceDescription) {
  var email = _currentEmail();
  var clo = dbInsert('clos', {
    id: '',
    course_id: courseId,
    number: number,
    text: text,
    proposal_number: proposalNumber || '',
    proposal_date: proposalDate || '',
    status: 'active',
    source: 'faculty_added',
    source_document: sourceDescription || '',
    source_date: new Date().toISOString()
  });
  auditLog('clo', clo.id, 'add', null, clo);
  return clo;
}

function flagEntity(entityType, entityId, reason) {
  var email = _currentEmail();
  return dbInsert('flags', {
    id: '',
    entity_type: entityType,
    entity_id: entityId,
    flagged_by: email,
    flagged_at: new Date().toISOString(),
    reason: reason,
    status: 'open',
    resolved_by: '',
    resolved_at: '',
    resolution_note: ''
  });
}

// ─── admin endpoints ──────────────────────────────────────────────────────────

function adminGetFlags()         { return getOpenFlags(); }
function adminResolveFlag(id, note) { return resolveFlag(id, note); }
function adminDismissFlag(id, note) { return dismissFlag(id, note); }
function adminGetDashboard()    { return getCoverageDashboard(); }
function adminGetEditLog()      { return getEditLog(200); }
function adminGetUsers()        { return getAllUsers(); }
function adminPromoteUser(email){ return promoteToAdmin(email); }
function adminUpdateFramework(tableName, rowId, updates) {
  return adminUpdateFrameworkRow(tableName, rowId, updates);
}
