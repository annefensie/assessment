/**
 * Setup.gs — One-time database initialization.
 *
 * Run setupAll() once after creating the Google Sheet to:
 *   1. Create all table sheets with correct headers
 *   2. Import framework reference data from embedded constants
 *   3. Seed demo data (5 programs, sample courses, CLOs)
 *
 * Safe to re-run: checks for existing sheets before creating.
 */

// ─── table schemas ────────────────────────────────────────────────────────────

var TABLE_SCHEMAS = {
  programs: ['id','catalog_poid','name','level','college','catalog_url','last_scraped_at','status','created_by','created_at','updated_by','updated_at','source','source_document','source_date'],
  courses: ['id','code','title','description','credit_hours','modality_flags','status','created_by','created_at','updated_by','updated_at','source','source_document','source_date'],
  course_programs: ['course_id','program_id','is_required','source','created_at'],
  glos: ['id','code','text','version','status','created_by','created_at','updated_by','updated_at','source','source_document','source_date'],
  plos: ['id','program_id','number','text','status','created_by','created_at','updated_by','updated_at','source','source_document','source_date'],
  clos: ['id','course_id','number','text','proposal_number','proposal_date','status','created_by','created_at','updated_by','updated_at','source','source_document','source_date'],
  clo_plo_mappings: ['id','clo_id','plo_id','program_id','created_at'],
  glo_course_mappings: ['id','glo_id','course_id','created_at'],
  framework_verbs: ['id','verb','most_likely_behavior','internal_external','independent_interactive','preferred_context','preferred_task_type','other_task_types','learner_choice_task','preferred_deliverable','other_deliverables','learner_choice_deliverable','status','approved_by','approved_date','source_keys','confidence'],
  framework_behaviors: ['id','behavior','definition','internal_external','independent_interactive','preferred_context','preferred_task_type','other_task_types','learner_choice_task','preferred_deliverable','other_deliverables','learner_choice_deliverable','status','approved_by','approved_date','source_keys','confidence'],
  framework_task_types: ['id','task_type','description','behaviors','format_modality','learner_choice_modality','ai_resistance_affordance','recommended_scoring_evidence','discipline_affinity','status','approved_by','approved_date','source_keys','confidence'],
  framework_deliverables: ['id','name','description','behaviors','modality','learner_choice_modality','ai_resistance_affordance','status','approved_by','approved_date','source_keys','confidence'],
  framework_disciplines: ['id','discipline_cluster','appropriate_task_types','recommended_deliverables','high_value_verbs','why_fit_strong','ai_resistant_design_moves','source_keys','source_urls','status','approved_by','approved_date','confidence'],
  framework_ai_resistance_features: ['id','feature_name','why_helps','works_best_for','example_implementation','caution','source_keys','source_urls','status','approved_by','approved_date','confidence'],
  framework_sources: ['id','source_key','full_reference','assessment_implication','url','status'],
  program_disciplines: ['id','program_id','discipline_cluster_id','is_primary','notes','created_at'],
  flags: ['id','entity_type','entity_id','flagged_by','flagged_at','reason','status','resolved_by','resolved_at','resolution_note'],
  edit_log: ['id','entity_type','entity_id','action','old_value','new_value','actor','actor_role','timestamp'],
  prompts: ['id','owner','course_id','clo_id','outcome_text','behavior_classification','recommended_task_type','recommended_deliverable','prompt_text','created_at','updated_at','notes'],
  users: ['email','role','first_login_at','last_login_at','program_associations'],
};

function setupAll() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Creating table sheets...');
  _createSheets(ss);
  Logger.log('Importing framework data...');
  _importFrameworkData(ss);
  Logger.log('Seeding demo data...');
  _seedDemoData();
  Logger.log('Setup complete.');
}

/**
 * Wipe all data rows (keep headers) from every table sheet, then re-seed.
 * Run this if setupAll() was accidentally run more than once and data is doubled.
 */
function resetAndReseed() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(TABLE_SCHEMAS).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
      Logger.log('Cleared ' + (lastRow - 1) + ' rows from ' + name);
    }
  });
  Logger.log('All tables cleared. Re-seeding...');
  _importFrameworkData(ss);
  _seedDemoData();
  Logger.log('Reset complete.');
}

function _createSheets(ss) {
  Object.keys(TABLE_SCHEMAS).forEach(function(name) {
    var existing = ss.getSheetByName(name);
    if (!existing) {
      var sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, TABLE_SCHEMAS[name].length)
        .setValues([TABLE_SCHEMAS[name]])
        .setFontWeight('bold')
        .setBackground('#e8f0fe');
      sheet.setFrozenRows(1);
      Logger.log('Created sheet: ' + name);
    } else {
      Logger.log('Sheet already exists: ' + name);
    }
  });
  // Remove default Sheet1 if present
  var default_ = ss.getSheetByName('Sheet1');
  if (default_ && ss.getSheets().length > 1) ss.deleteSheet(default_);
}

function _importFrameworkData(ss) {
  var d = FRAMEWORK_DATA;
  var now = new Date().toISOString();

  // framework_verbs
  _bulkInsert('framework_verbs', d.VERBS.map(function(v) {
    return {
      id: Utilities.getUuid(),
      verb: v['Verb'] || '',
      most_likely_behavior: v['Most Likely Behavior'] || '',
      internal_external: v['Internal / External (from Most Likely Behavior)'] || '',
      independent_interactive: v['Independent / Interactive (from Most Likely Behavior)'] || '',
      preferred_context: v['Preferred Context (from Most Likely Behavior)'] || '',
      preferred_task_type: v['Preferred Stimulus Task Type (from Most Likely Behavior)'] || '',
      other_task_types: v['Other Possible Stimulus Task Type (from Most Likely Behavior)'] || '',
      learner_choice_task: v['Learner choice of stimulus (from Most Likely Behavior)'] || '',
      preferred_deliverable: v['Preferred Deliverable Task Type (from Most Likely Behavior)'] || '',
      other_deliverables: v['Other Possible Deliverable Task Type (from Most Likely Behavior)'] || '',
      learner_choice_deliverable: v['Learner choice of deliverable (from Most Likely Behavior)'] || '',
      status: 'approved', approved_by: 'psychometrician', approved_date: now, source_keys: '', confidence: 'high'
    };
  }));

  // framework_behaviors
  _bulkInsert('framework_behaviors', d.BEHAVIORS.map(function(b) {
    return {
      id: Utilities.getUuid(),
      behavior: b['Behavior'] || '',
      definition: b['Definition / Construct'] || '',
      internal_external: b['Internal / External'] || '',
      independent_interactive: b['Independent / Interactive'] || '',
      preferred_context: b['Program Preferred Context'] || '',
      preferred_task_type: b['Preferred Task Type'] || '',
      other_task_types: b['Other Possible Task Type'] || '',
      learner_choice_task: b['Learner choice of task'] || '',
      preferred_deliverable: b['Preferred Deliverable Task Type'] || '',
      other_deliverables: b['Other Possible Deliverable Task Type'] || '',
      learner_choice_deliverable: b['Learner choice of deliverable'] || '',
      status: 'approved', approved_by: 'psychometrician', approved_date: now, source_keys: '', confidence: 'high'
    };
  }));

  // framework_task_types
  _bulkInsert('framework_task_types', d.TASKS.map(function(t) {
    return {
      id: Utilities.getUuid(),
      task_type: t['Task Type'] || '',
      description: t['Description'] || '',
      behaviors: t['Behaviors'] || '',
      format_modality: t['Format / Modality'] || '',
      learner_choice_modality: t['Learner choice in modality?'] || '',
      ai_resistance_affordance: t['AI-resistance affordance'] || '',
      recommended_scoring_evidence: t['Recommended scoring evidence'] || '',
      discipline_affinity: t['Discipline Affinity'] || '',
      status: 'approved', approved_by: 'psychometrician', approved_date: now, source_keys: '', confidence: 'high'
    };
  }));

  // framework_deliverables
  _bulkInsert('framework_deliverables', d.DELIVERABLES.map(function(d2) {
    return {
      id: Utilities.getUuid(),
      name: d2['Name'] || '',
      description: d2['Description'] || '',
      behaviors: d2['Behaviors1'] || '',
      modality: d2['Modality'] || '',
      learner_choice_modality: d2['Learner choice in modality?'] || '',
      ai_resistance_affordance: d2['AI-resistance affordance'] || '',
      status: 'approved', approved_by: 'psychometrician', approved_date: now, source_keys: '', confidence: 'high'
    };
  }));

  // framework_disciplines
  _bulkInsert('framework_disciplines', d.DISCIPLINE_MAP.map(function(dm) {
    return {
      id: Utilities.getUuid(),
      discipline_cluster: dm['Discipline / Program Cluster'] || '',
      appropriate_task_types: dm['Particularly Appropriate Task Types'] || '',
      recommended_deliverables: dm['Recommended Deliverables'] || '',
      high_value_verbs: dm['High-value Verbs to Add / Emphasize'] || '',
      why_fit_strong: dm['Why this fit is strong'] || '',
      ai_resistant_design_moves: dm['AI-resistant design moves'] || '',
      source_keys: dm['Primary Source Keys'] || '',
      source_urls: dm['Source URLs'] || '',
      status: 'approved', approved_by: 'psychometrician', approved_date: now, confidence: 'high'
    };
  }));

  // framework_ai_resistance_features
  _bulkInsert('framework_ai_resistance_features', d.AI_RESISTANCE.map(function(f) {
    return {
      id: Utilities.getUuid(),
      feature_name: f['AI-resistant Design Feature'] || '',
      why_helps: f['Why it helps validity/security'] || '',
      works_best_for: f['Works best for'] || '',
      example_implementation: f['Example implementation'] || '',
      caution: f['Caution'] || '',
      source_keys: f['Source Keys'] || '',
      source_urls: f['Source URLs'] || '',
      status: 'approved', approved_by: 'psychometrician', approved_date: now, confidence: 'high'
    };
  }));

  // framework_sources
  _bulkInsert('framework_sources', d.SOURCES.map(function(s) {
    return {
      id: Utilities.getUuid(),
      source_key: s['Source Key'] || '',
      full_reference: s['Full Reference'] || '',
      assessment_implication: s['Assessment Implication'] || '',
      url: s['URL'] || '',
      status: 'approved'
    };
  }));

  Logger.log('Framework data import complete.');
}

function _bulkInsert(tableName, rows) {
  if (!rows || rows.length === 0) return;
  var sheet = _getSheet(tableName);
  var headers = _getHeaders(sheet);
  var data = rows.map(function(row) { return _objToRow(headers, row); });
  sheet.getRange(sheet.getLastRow() + 1, 1, data.length, headers.length).setValues(data);
  Logger.log('Inserted ' + rows.length + ' rows into ' + tableName);
}

// ─── demo seed data ───────────────────────────────────────────────────────────

function _seedDemoData() {
  var now = new Date().toISOString();
  var sys = 'system';

  // 5 demo programs
  var programs = [
    { id: 'prog-swbsw', catalog_poid: '1306', name: 'Social Work, B.S.W.', level: 'Undergraduate', college: 'Professional Programs', catalog_url: 'https://catalog.umpi.edu/preview_program.php?catoid=10&poid=1306', last_scraped_at: '', status: 'active' },
    { id: 'prog-edbs', catalog_poid: '1284', name: 'Education, B.S. (Elementary)', level: 'Undergraduate', college: 'Professional Programs', catalog_url: 'https://catalog.umpi.edu/preview_program.php?catoid=10&poid=1284', last_scraped_at: '', status: 'active' },
    { id: 'prog-busbs', catalog_poid: '1265', name: 'Business Administration, B.S.', level: 'Undergraduate', college: 'Professional Programs', catalog_url: 'https://catalog.umpi.edu/preview_program.php?catoid=10&poid=1265', last_scraped_at: '', status: 'active' },
    { id: 'prog-nurbs', catalog_poid: '1302', name: 'Nursing, B.S.N.', level: 'Undergraduate', college: 'Professional Programs', catalog_url: 'https://catalog.umpi.edu/preview_program.php?catoid=10&poid=1302', last_scraped_at: '', status: 'active' },
    { id: 'prog-csbs',  catalog_poid: '1271', name: 'Computer Information Systems, B.S.', level: 'Undergraduate', college: 'Arts & Sciences', catalog_url: 'https://catalog.umpi.edu/preview_program.php?catoid=10&poid=1271', last_scraped_at: '', status: 'active' },
  ];
  programs.forEach(function(p) {
    Object.assign(p, { created_by: sys, created_at: now, updated_by: sys, updated_at: now, source: 'demo_seed', source_document: '', source_date: now });
    dbInsert('programs', p);
  });

  // GLOs
  var glos = [
    { id: 'glo-1', code: 'GLO 1', text: 'Communicate effectively in written, oral, and visual forms for diverse audiences and purposes.', version: '2022' },
    { id: 'glo-2', code: 'GLO 2', text: 'Think critically and creatively to analyze problems, evaluate evidence, and propose solutions.', version: '2022' },
    { id: 'glo-3', code: 'GLO 3', text: 'Demonstrate information literacy and use technology ethically and effectively.', version: '2022' },
    { id: 'glo-4', code: 'GLO 4', text: 'Apply quantitative reasoning to interpret data and draw evidence-based conclusions.', version: '2022' },
    { id: 'glo-5', code: 'GLO 5', text: 'Engage with diverse perspectives and demonstrate ethical and civic responsibility.', version: '2022' },
  ];
  glos.forEach(function(g) {
    Object.assign(g, { status: 'active', created_by: sys, created_at: now, updated_by: sys, updated_at: now, source: 'demo_seed', source_document: 'UMPI Catalog 2024-25', source_date: now });
    dbInsert('glos', g);
  });

  // PLOs per program
  var plosData = {
    'prog-swbsw': [
      'Demonstrate professional social work values and ethical decision-making in practice.',
      'Apply human behavior theory to assess individuals, families, groups, organizations, and communities.',
      'Engage with diverse client populations using culturally responsive, anti-oppressive practice.',
      'Intervene at micro, mezzo, and macro levels using evidence-based approaches.',
      'Evaluate practice effectiveness and engage in continuous professional development.',
    ],
    'prog-edbs': [
      'Design and implement developmentally appropriate, standards-aligned instructional plans.',
      'Use formative and summative assessment data to differentiate instruction.',
      'Create inclusive learning environments that support diverse learners.',
      'Apply knowledge of child development to inform instructional decisions.',
      'Demonstrate professional dispositions and collaborate with families and communities.',
    ],
    'prog-busbs': [
      'Analyze business environments and formulate strategic recommendations.',
      'Apply financial principles to evaluate organizational performance.',
      'Demonstrate effective written and oral communication in business contexts.',
      'Use data analysis tools to support evidence-based business decisions.',
      'Apply ethical frameworks to complex business dilemmas.',
    ],
    'prog-nurbs': [
      'Provide patient-centered, evidence-based care across the lifespan.',
      'Apply clinical reasoning to assess, plan, implement, and evaluate nursing interventions.',
      'Collaborate with interprofessional teams to promote safe, quality patient outcomes.',
      'Demonstrate professional nursing values, ethics, and accountability.',
      'Use healthcare informatics and technology to support practice and improve outcomes.',
    ],
    'prog-csbs': [
      'Design and develop software solutions using appropriate programming paradigms.',
      'Analyze and apply data structures and algorithms to solve computational problems.',
      'Apply cybersecurity principles to protect systems and information.',
      'Collaborate in team-based software development projects using professional practices.',
      'Evaluate emerging technologies and assess their organizational and ethical implications.',
    ],
  };
  Object.keys(plosData).forEach(function(progId) {
    plosData[progId].forEach(function(text, i) {
      dbInsert('plos', {
        id: progId + '-plo-' + (i+1),
        program_id: progId,
        number: i + 1,
        text: text,
        status: 'active',
        created_by: sys, created_at: now, updated_by: sys, updated_at: now,
        source: 'demo_seed', source_document: 'UMPI Catalog 2024-25', source_date: now
      });
    });
  });

  // Sample courses
  var courses = [
    { id: 'crs-sw301', code: 'SWK 301', title: 'Social Work Practice I', description: 'Introduction to generalist social work practice at the micro level. Students develop skills in engagement, assessment, intervention, and evaluation with individuals and families.', credit_hours: 3, modality_flags: '{"live":true,"online":true,"hybrid":false,"yourpace":false}' },
    { id: 'crs-sw405', code: 'SWK 405', title: 'Social Work Practice III: Macro', description: 'Community organizing, policy advocacy, and organizational change. Students apply generalist practice skills at the community and policy levels.', credit_hours: 3, modality_flags: '{"live":true,"online":false,"hybrid":false,"yourpace":false}' },
    { id: 'crs-edu310', code: 'EDU 310', title: 'Curriculum Design and Assessment', description: 'Principles of curriculum design, instructional planning, and assessment in K-8 settings. Emphasis on backward design and standards alignment.', credit_hours: 3, modality_flags: '{"live":true,"online":true,"hybrid":false,"yourpace":false}' },
    { id: 'crs-bus503', code: 'BUS 503', title: 'Corporate Strategy', description: 'Strategic analysis of complex business environments. Students analyze industry forces, organizational capabilities, and competitive dynamics to formulate strategy.', credit_hours: 3, modality_flags: '{"live":false,"online":true,"hybrid":false,"yourpace":true}' },
    { id: 'crs-bus320', code: 'BUS 320', title: 'Business Analytics', description: 'Applied data analysis for business decision-making. Topics include descriptive analytics, regression, forecasting, and visualization using industry tools.', credit_hours: 3, modality_flags: '{"live":true,"online":true,"hybrid":false,"yourpace":false}' },
    { id: 'crs-nur301', code: 'NUR 301', title: 'Pathophysiology', description: 'Mechanisms of disease across body systems. Students apply pathophysiological principles to clinical case analysis.', credit_hours: 3, modality_flags: '{"live":true,"online":false,"hybrid":false,"yourpace":false}' },
    { id: 'crs-nur420', code: 'NUR 420', title: 'Clinical Practicum III', description: 'Advanced clinical experience in acute care settings. Students demonstrate integration of assessment, planning, and intervention skills under supervision.', credit_hours: 6, modality_flags: '{"live":true,"online":false,"hybrid":false,"yourpace":false}' },
    { id: 'crs-cis250', code: 'CIS 250', title: 'Data Structures and Algorithms', description: 'Fundamental data structures and algorithm design. Topics include lists, trees, graphs, sorting, searching, and complexity analysis.', credit_hours: 3, modality_flags: '{"live":true,"online":false,"hybrid":false,"yourpace":false}' },
    { id: 'crs-cis410', code: 'CIS 410', title: 'Cybersecurity Fundamentals', description: 'Principles of information security, threat modeling, network security, and incident response. Students apply security frameworks to organizational scenarios.', credit_hours: 3, modality_flags: '{"live":true,"online":true,"hybrid":false,"yourpace":false}' },
    { id: 'crs-gen101', code: 'ENG 101', title: 'Composition I', description: 'Introduction to academic writing. Students develop skills in argumentation, evidence use, source integration, and revision across multiple drafts.', credit_hours: 3, modality_flags: '{"live":true,"online":true,"hybrid":true,"yourpace":false}' },
  ];
  courses.forEach(function(c) {
    Object.assign(c, { status: 'active', created_by: sys, created_at: now, updated_by: sys, updated_at: now, source: 'demo_seed', source_document: '', source_date: now });
    dbInsert('courses', c);
  });

  // course_programs join
  var cpJoins = [
    { course_id: 'crs-sw301', program_id: 'prog-swbsw', is_required: true },
    { course_id: 'crs-sw405', program_id: 'prog-swbsw', is_required: true },
    { course_id: 'crs-edu310', program_id: 'prog-edbs', is_required: true },
    { course_id: 'crs-bus503', program_id: 'prog-busbs', is_required: true },
    { course_id: 'crs-bus320', program_id: 'prog-busbs', is_required: true },
    { course_id: 'crs-nur301', program_id: 'prog-nurbs', is_required: true },
    { course_id: 'crs-nur420', program_id: 'prog-nurbs', is_required: true },
    { course_id: 'crs-cis250', program_id: 'prog-csbs', is_required: true },
    { course_id: 'crs-cis410', program_id: 'prog-csbs', is_required: true },
  ];
  cpJoins.forEach(function(j) {
    dbInsert('course_programs', { course_id: j.course_id, program_id: j.program_id, is_required: j.is_required, source: 'demo_seed', created_at: now });
  });

  // CLOs (2-3 per course)
  var closData = [
    // SWK 301
    { id: 'clo-sw301-1', course_id: 'crs-sw301', number: 1, text: 'Assess client systems by gathering, organizing, and interpreting biopsychosocial information to identify strengths and challenges.', proposal_number: 'C0301', proposal_date: '2023-09-01' },
    { id: 'clo-sw301-2', course_id: 'crs-sw301', number: 2, text: 'Demonstrate engagement skills with diverse client populations using active listening, empathy, and cultural humility.', proposal_number: 'C0301', proposal_date: '2023-09-01' },
    { id: 'clo-sw301-3', course_id: 'crs-sw301', number: 3, text: 'Apply evidence-based intervention strategies appropriate to client goals and context.', proposal_number: 'C0301', proposal_date: '2023-09-01' },
    // SWK 405
    { id: 'clo-sw405-1', course_id: 'crs-sw405', number: 1, text: 'Analyze community needs using asset-based and deficit frameworks to identify priorities for change.', proposal_number: 'C0405', proposal_date: '2023-09-01' },
    { id: 'clo-sw405-2', course_id: 'crs-sw405', number: 2, text: 'Design a community organizing or policy advocacy plan aligned with identified community strengths and needs.', proposal_number: 'C0405', proposal_date: '2023-09-01' },
    // EDU 310
    { id: 'clo-edu310-1', course_id: 'crs-edu310', number: 1, text: 'Design standards-aligned instructional units using backward design principles.', proposal_number: 'C0310', proposal_date: '2023-01-15' },
    { id: 'clo-edu310-2', course_id: 'crs-edu310', number: 2, text: 'Select and justify assessment methods that produce valid evidence of student learning for specific learning outcomes.', proposal_number: 'C0310', proposal_date: '2023-01-15' },
    { id: 'clo-edu310-3', course_id: 'crs-edu310', number: 3, text: 'Evaluate student work samples to differentiate instruction for diverse learners.', proposal_number: 'C0310', proposal_date: '2023-01-15' },
    // BUS 503
    { id: 'clo-bus503-1', course_id: 'crs-bus503', number: 1, text: 'Analyze competitive industry environments using frameworks such as Porter\'s Five Forces and PESTEL.', proposal_number: 'C0503', proposal_date: '2022-08-20' },
    { id: 'clo-bus503-2', course_id: 'crs-bus503', number: 2, text: 'Formulate a strategic recommendation supported by financial analysis and competitive rationale.', proposal_number: 'C0503', proposal_date: '2022-08-20' },
    // BUS 320
    { id: 'clo-bus320-1', course_id: 'crs-bus320', number: 1, text: 'Apply regression and forecasting models to analyze business data and support decision-making.', proposal_number: 'C0320', proposal_date: '2023-05-10' },
    { id: 'clo-bus320-2', course_id: 'crs-bus320', number: 2, text: 'Interpret data visualizations and dashboards to communicate analytical findings to non-technical audiences.', proposal_number: 'C0320', proposal_date: '2023-05-10' },
    // NUR 301
    { id: 'clo-nur301-1', course_id: 'crs-nur301', number: 1, text: 'Explain the pathophysiological mechanisms underlying common disease processes across body systems.', proposal_number: 'C0301N', proposal_date: '2023-01-01' },
    { id: 'clo-nur301-2', course_id: 'crs-nur301', number: 2, text: 'Apply pathophysiological principles to analyze clinical case scenarios and prioritize nursing assessment findings.', proposal_number: 'C0301N', proposal_date: '2023-01-01' },
    // NUR 420
    { id: 'clo-nur420-1', course_id: 'crs-nur420', number: 1, text: 'Perform comprehensive patient assessment and document findings using clinical notation standards.', proposal_number: 'C0420N', proposal_date: '2023-01-01' },
    { id: 'clo-nur420-2', course_id: 'crs-nur420', number: 2, text: 'Implement evidence-based nursing interventions and evaluate patient responses in the acute care setting.', proposal_number: 'C0420N', proposal_date: '2023-01-01' },
    // CIS 250
    { id: 'clo-cis250-1', course_id: 'crs-cis250', number: 1, text: 'Implement fundamental data structures including linked lists, stacks, queues, trees, and graphs in a compiled language.', proposal_number: 'C0250C', proposal_date: '2022-06-01' },
    { id: 'clo-cis250-2', course_id: 'crs-cis250', number: 2, text: 'Analyze algorithm efficiency using Big-O notation and select appropriate algorithms for problem constraints.', proposal_number: 'C0250C', proposal_date: '2022-06-01' },
    // CIS 410
    { id: 'clo-cis410-1', course_id: 'crs-cis410', number: 1, text: 'Evaluate system vulnerabilities using threat modeling frameworks and propose mitigations.', proposal_number: 'C0410C', proposal_date: '2023-03-15' },
    { id: 'clo-cis410-2', course_id: 'crs-cis410', number: 2, text: 'Apply security controls and incident response procedures to simulated network scenarios.', proposal_number: 'C0410C', proposal_date: '2023-03-15' },
    // ENG 101
    { id: 'clo-eng101-1', course_id: 'crs-gen101', number: 1, text: 'Construct well-reasoned arguments supported by credible evidence and clear analysis.', proposal_number: 'C0101E', proposal_date: '2021-08-01' },
    { id: 'clo-eng101-2', course_id: 'crs-gen101', number: 2, text: 'Revise drafts in response to instructor and peer feedback to improve clarity, organization, and argument.', proposal_number: 'C0101E', proposal_date: '2021-08-01' },
  ];
  closData.forEach(function(c) {
    Object.assign(c, { status: 'active', created_by: sys, created_at: now, updated_by: sys, updated_at: now, source: 'demo_seed', source_document: 'Curriculum Proposal', source_date: c.proposal_date });
    dbInsert('clos', c);
  });

  // GLO-course mappings
  var gloCourse = [
    { glo_id: 'glo-1', course_id: 'crs-gen101' },
    { glo_id: 'glo-2', course_id: 'crs-bus503' },
    { glo_id: 'glo-2', course_id: 'crs-cis250' },
    { glo_id: 'glo-3', course_id: 'crs-cis410' },
    { glo_id: 'glo-4', course_id: 'crs-bus320' },
    { glo_id: 'glo-5', course_id: 'crs-sw301' },
  ];
  gloCourse.forEach(function(m) {
    dbInsert('glo_course_mappings', { id: Utilities.getUuid(), glo_id: m.glo_id, course_id: m.course_id, created_at: now });
  });

  Logger.log('Demo data seed complete: ' + programs.length + ' programs, ' + courses.length + ' courses, ' + closData.length + ' CLOs.');
}
