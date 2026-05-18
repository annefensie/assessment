/**
 * Framework.gs — Recommendation engine.
 *
 * Implements §10 of the PRD: verb extraction, behavior mapping,
 * internal/external pairing, task/deliverable recommendation,
 * AI-resistance affordances, and discipline overlay.
 *
 * All logic operates on FRAMEWORK_DATA constants (FrameworkData.gs)
 * rather than live sheet reads so it runs fast without quota hits.
 * During setup, the same data is written to Sheets for admin editing;
 * after edits, call refreshFrameworkCache() to reload.
 */

var _frameworkCache = null;

function _fw() {
  if (_frameworkCache) return _frameworkCache;
  // Try live sheet data first; fall back to embedded constants
  try {
    _frameworkCache = _loadFrameworkFromSheets();
  } catch(e) {
    Logger.log('Framework sheet load failed, using embedded data: ' + e.message);
    _frameworkCache = _buildFromEmbedded();
  }
  return _frameworkCache;
}

function refreshFrameworkCache() {
  _frameworkCache = null;
}

// ─── load from sheets ────────────────────────────────────────────────────────

function _loadFrameworkFromSheets() {
  // Sheet headers are snake_case; map back to the Excel column names that the
  // rest of Framework.gs uses so both code paths see the same key names.
  var rawVerbs       = dbGetAll('framework_verbs');
  var rawBehaviors   = dbGetAll('framework_behaviors');
  var rawTasks       = dbGetAll('framework_task_types');
  var rawDeliverables = dbGetAll('framework_deliverables');
  var rawDisciplines = dbGetAll('framework_disciplines');
  var rawAI          = dbGetAll('framework_ai_resistance_features');
  var rawSources     = dbGetAll('framework_sources');

  return {
    verbs: rawVerbs.map(function(v) {
      return {
        'Verb': v.verb || '',
        'Most Likely Behavior': v.most_likely_behavior || '',
        'Internal / External (from Most Likely Behavior)': v.internal_external || '',
        'Independent / Interactive (from Most Likely Behavior)': v.independent_interactive || '',
        'Preferred Context (from Most Likely Behavior)': v.preferred_context || '',
        'Preferred Stimulus Task Type (from Most Likely Behavior)': v.preferred_task_type || '',
        'Other Possible Stimulus Task Type (from Most Likely Behavior)': v.other_task_types || '',
        'Learner choice of stimulus (from Most Likely Behavior)': v.learner_choice_task || '',
        'Preferred Deliverable Task Type (from Most Likely Behavior)': v.preferred_deliverable || '',
        'Other Possible Deliverable Task Type (from Most Likely Behavior)': v.other_deliverables || '',
        'Learner choice of deliverable (from Most Likely Behavior)': v.learner_choice_deliverable || '',
      };
    }),
    behaviors: rawBehaviors.map(function(b) {
      return {
        'Behavior': b.behavior || '',
        'Definition / Construct': b.definition || '',
        'Internal / External': b.internal_external || '',
        'Independent / Interactive': b.independent_interactive || '',
        'Program Preferred Context': b.preferred_context || '',
        'Preferred Task Type': b.preferred_task_type || '',
        'Other Possible Task Type': b.other_task_types || '',
        'Learner choice of task': b.learner_choice_task || '',
        'Preferred Deliverable Task Type': b.preferred_deliverable || '',
        'Other Possible Deliverable Task Type': b.other_deliverables || '',
        'Learner choice of deliverable': b.learner_choice_deliverable || '',
      };
    }),
    tasks: rawTasks.map(function(t) {
      return {
        'Task Type': t.task_type || '',
        'Description': t.description || '',
        'Behaviors': t.behaviors || '',
        'Format / Modality': t.format_modality || '',
        'Learner choice in modality?': t.learner_choice_modality || '',
        'AI-resistance affordance': t.ai_resistance_affordance || '',
        'Recommended scoring evidence': t.recommended_scoring_evidence || '',
        'Discipline Affinity': t.discipline_affinity || '',
      };
    }),
    deliverables: rawDeliverables.map(function(d) {
      return {
        'Name': d.name || '',
        'Description': d.description || '',
        'Modality': d.modality || '',
        'Learner choice in modality?': d.learner_choice_modality || '',
        'AI-resistance affordance': d.ai_resistance_affordance || '',
      };
    }),
    disciplines: rawDisciplines.map(function(d) {
      return {
        'Discipline / Program Cluster': d.discipline_cluster || '',
        'Particularly Appropriate Task Types': d.appropriate_task_types || '',
        'Recommended Deliverables': d.recommended_deliverables || '',
        'High-value Verbs to Add / Emphasize': d.high_value_verbs || '',
        'Why this fit is strong': d.why_fit_strong || '',
        'AI-resistant design moves': d.ai_resistant_design_moves || '',
        'Primary Source Keys': d.source_keys || '',
        'Source URLs': d.source_urls || '',
      };
    }),
    aiResistance: rawAI.map(function(f) {
      return {
        'AI-resistant Design Feature': f.feature_name || '',
        'Why it helps validity/security': f.why_helps || '',
        'Works best for': f.works_best_for || '',
        'Example implementation': f.example_implementation || '',
        'Caution': f.caution || '',
        'Source Keys': f.source_keys || '',
        'Source URLs': f.source_urls || '',
      };
    }),
    sources: rawSources.map(function(s) {
      return {
        'Source Key': s.source_key || '',
        'Full Reference': s.full_reference || '',
        'Assessment Implication': s.assessment_implication || '',
        'URL': s.url || '',
      };
    }),
    // The program_disciplines sheet stores program_id and discipline_cluster_id
    // (not names), so it can't be used for name-based lookups. Fall back to the
    // embedded data which preserves the original "Program" / "Discipline Cluster"
    // name columns that getDisciplineForProgram() needs.
    programDisciplines: FRAMEWORK_DATA.PROGRAM_DISCIPLINES,
  };
}

// ─── load from embedded constants ────────────────────────────────────────────

function _buildFromEmbedded() {
  var d = FRAMEWORK_DATA;
  return {
    verbs: d.VERBS,
    behaviors: d.BEHAVIORS,
    tasks: d.TASKS,
    deliverables: d.DELIVERABLES,
    disciplines: d.DISCIPLINE_MAP,
    aiResistance: d.AI_RESISTANCE,
    sources: d.SOURCES,
    programDisciplines: d.PROGRAM_DISCIPLINES,
  };
}

// ─── normalization ────────────────────────────────────────────────────────────

function _normalize(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

var LEMMA_MAP = (function() {
  // Common conjugations → base form
  var pairs = [
    ['analyzing','analyze'],['analyzed','analyze'],['analyses','analyze'],
    ['applying','apply'],['applied','apply'],['applies','apply'],
    ['evaluating','evaluate'],['evaluated','evaluate'],['evaluates','evaluate'],
    ['designing','design'],['designed','design'],['designs','design'],
    ['creating','create'],['created','create'],['creates','create'],
    ['developing','develop'],['developed','develop'],['develops','develop'],
    ['implementing','implement'],['implemented','implement'],['implements','implement'],
    ['identifying','identify'],['identified','identify'],['identifies','identify'],
    ['demonstrating','demonstrate'],['demonstrated','demonstrate'],['demonstrates','demonstrate'],
    ['explaining','explain'],['explained','explain'],['explains','explain'],
    ['describing','describe'],['described','describe'],['describes','describe'],
    ['comparing','compare'],['compared','compare'],['compares','compare'],
    ['constructing','construct'],['constructed','construct'],['constructs','construct'],
    ['assessing','assess'],['assessed','assess'],['assesses','assess'],
    ['synthesizing','synthesize'],['synthesized','synthesize'],['synthesizes','synthesize'],
    ['arguing','argue'],['argued','argue'],['argues','argue'],
    ['collaborating','collaborate'],['collaborated','collaborate'],['collaborates','collaborate'],
    ['communicating','communicate'],['communicated','communicate'],['communicates','communicate'],
    ['critiquing','critique'],['critiqued','critique'],['critiques','critique'],
    ['diagnosing','diagnose'],['diagnosed','diagnose'],['diagnoses','diagnose'],
    ['modeling','model'],['modeled','model'],['models','model'],
    ['performing','perform'],['performed','perform'],['performs','perform'],
    ['reflecting','reflect'],['reflected','reflect'],['reflects','reflect'],
    ['researching','research'],['researched','research'],['researches','research'],
    ['using','use'],['used','use'],['uses','use'],
    ['presenting','present'],['presented','present'],['presents','present'],
    ['proposing','propose'],['proposed','propose'],['proposes','propose'],
    ['solving','solve'],['solved','solve'],['solves','solve'],
    ['writing','write'],['wrote','write'],['written','write'],['writes','write'],
    ['planning','plan'],['planned','plan'],['plans','plan'],
    ['reviewing','review'],['reviewed','review'],['reviews','review'],
    ['testing','test'],['tested','test'],['tests','test'],
    ['validating','validate'],['validated','validate'],['validates','validate'],
    ['auditing','audit'],['audited','audit'],['audits','audit'],
    ['justifying','justify'],['justified','justify'],['justifies','justify'],
    ['selecting','select'],['selected','select'],['selects','select'],
    ['formulating','formulate'],['formulated','formulate'],['formulates','formulate'],
    ['calculating','calculate'],['calculated','calculate'],['calculates','calculate'],
    ['interpreting','interpret'],['interpreted','interpret'],['interprets','interpret'],
    ['generating','generate'],['generated','generate'],['generates','generate'],
    ['integrating','integrate'],['integrated','integrate'],['integrates','integrate'],
    ['investigating','investigate'],['investigated','investigate'],['investigates','investigate'],
    ['troubleshooting','troubleshoot'],['troubleshot','troubleshoot'],
    ['forecasting','forecast'],['forecasted','forecast'],['forecasts','forecast'],
    ['negotiating','negotiate'],['negotiated','negotiate'],['negotiates','negotiate'],
    ['prioritizing','prioritize'],['prioritized','prioritize'],['prioritizes','prioritize'],
  ];
  var map = {};
  pairs.forEach(function(p) { map[p[0]] = p[1]; });
  return map;
})();

function _lemmatize(word) {
  return LEMMA_MAP[word] || word;
}

// ─── multiword verb list (sorted longest-first for greedy matching) ──────────

function _getMultiwordVerbs() {
  var fw = _fw();
  return fw.verbs
    .map(function(v) { return v['Verb'] || v['verb'] || ''; })
    .filter(function(v) { return v.indexOf(' ') !== -1; })
    .sort(function(a, b) { return b.split(' ').length - a.split(' ').length; });
}

// ─── verb extraction ─────────────────────────────────────────────────────────

/**
 * Given an outcome string, returns { found: [...verbObjs], remaining: str }
 * where verbObjs come from framework_verbs.
 */
function extractVerbs(outcomeText) {
  var fw = _fw();
  var norm = _normalize(outcomeText);
  var found = [];
  var remaining = norm;

  // Pass 1: multiword verbs
  _getMultiwordVerbs().forEach(function(mv) {
    var mvNorm = _normalize(mv);
    if (remaining.indexOf(mvNorm) !== -1) {
      remaining = remaining.replace(mvNorm, ' ');
      var verbObj = fw.verbs.find(function(v) {
        return _normalize(v['Verb'] || v['verb'] || '') === mvNorm;
      });
      if (verbObj) found.push(verbObj);
    }
  });

  // Pass 2: single-word lemmatized match
  var verbSet = {};
  fw.verbs.forEach(function(v) {
    var k = _normalize(v['Verb'] || v['verb'] || '');
    verbSet[k] = v;
  });

  remaining.split(/\s+/).forEach(function(token) {
    var base = _lemmatize(_normalize(token));
    if (verbSet[base]) {
      found.push(verbSet[base]);
    }
  });

  // Deduplicate by verb name
  var seen = {};
  found = found.filter(function(v) {
    var k = v['Verb'] || v['verb'] || '';
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });

  return { found: found, hasResults: found.length > 0 };
}

// ─── behavior lookup ─────────────────────────────────────────────────────────

var INTERNAL_BEHAVIORS = [
  'Think Critically (Prospective)',
  'Think Critically (Retrospective)',
  'Know/Understand'
];

function isInternalBehavior(name) {
  return INTERNAL_BEHAVIORS.indexOf(name) !== -1;
}

function getBehaviorDetail(behaviorName) {
  var fw = _fw();
  return fw.behaviors.find(function(b) {
    return (b['Behavior'] || b['behavior'] || '').trim() === behaviorName.trim();
  }) || null;
}

function getTaskDetail(taskName) {
  var fw = _fw();
  return fw.tasks.find(function(t) {
    return (t['Task Type'] || t['task_type'] || '').trim().toLowerCase() === taskName.trim().toLowerCase();
  }) || null;
}

function getDeliverableDetail(delivName) {
  var fw = _fw();
  return fw.deliverables.find(function(d) {
    return (d['Name'] || d['name'] || '').trim().toLowerCase() === delivName.trim().toLowerCase();
  }) || null;
}

// ─── discipline lookup ───────────────────────────────────────────────────────

function getDisciplineForProgram(programName) {
  var fw = _fw();
  var pd = fw.programDisciplines.find(function(r) {
    return (r['Program'] || '').trim().toLowerCase() === (programName || '').trim().toLowerCase();
  });
  if (!pd) return null;
  var clusterName = pd['Discipline Cluster'] || pd['discipline_cluster'] || '';
  return fw.disciplines.find(function(d) {
    return (d['Discipline / Program Cluster'] || d['discipline_cluster'] || '').trim() === clusterName.trim();
  }) || null;
}

function getDisciplineByName(clusterName) {
  var fw = _fw();
  return fw.disciplines.find(function(d) {
    return (d['Discipline / Program Cluster'] || '').trim().toLowerCase() === clusterName.trim().toLowerCase();
  }) || null;
}

// ─── AI resistance feature selection ────────────────────────────────────────

function selectAiResistanceFeatures(taskType, disciplineCluster, count) {
  count = count || 3;
  var fw = _fw();
  var features = fw.aiResistance;

  // Score each feature by relevance to task type and discipline
  var scored = features.map(function(f) {
    var score = 0;
    var worksFor = _normalize(f['Works best for'] || '');
    var taskNorm = _normalize(taskType || '');
    var discNorm = _normalize(disciplineCluster || '');

    if (taskNorm && worksFor.indexOf(taskNorm.split(' ')[0]) !== -1) score += 2;
    if (discNorm && worksFor.indexOf(discNorm.split(' ')[0]) !== -1) score += 1;
    // Prefer features that mention coding/projects/oral for common cross-cutting
    if (worksFor.indexOf('project') !== -1) score += 0.5;
    if (worksFor.indexOf('oral') !== -1) score += 0.5;

    return { feature: f, score: score };
  });

  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, count).map(function(s) { return s.feature; });
}

// ─── main recommendation function ────────────────────────────────────────────

/**
 * Given an outcome text (and optional programName for discipline lookup),
 * returns a full recommendation object matching §10.4 of the PRD.
 *
 * Returns one of:
 *   { status: 'needs_verb_picker', verbs: [...all verbs grouped by behavior] }
 *   { status: 'needs_disambiguation', verb, behaviors: [...] }
 *   { status: 'needs_pairing', primary_behavior, external_behaviors: [...] }
 *   { status: 'ok', ...full recommendation }
 */
function recommend(outcomeText, programName, forcedBehaviorName, forcedPairedBehaviorName) {
  var fw = _fw();

  // 1. Verb extraction
  var extracted = extractVerbs(outcomeText);
  if (!extracted.hasResults) {
    return {
      status: 'needs_verb_picker',
      message: 'No recognized verbs found. Please select the intended behavior below.',
      verbPickerGroups: _buildVerbPickerGroups()
    };
  }

  // 2. Behavior mapping — check for ambiguity
  var verbObjs = extracted.found;
  var behaviorNames = [];
  verbObjs.forEach(function(v) {
    var b = v['Most Likely Behavior'] || v['most_likely_behavior'] || '';
    b.split(',').forEach(function(name) {
      name = name.trim();
      if (name && behaviorNames.indexOf(name) === -1) behaviorNames.push(name);
    });
  });

  // If caller forced a behavior, use it
  if (forcedBehaviorName) {
    behaviorNames = [forcedBehaviorName];
  } else if (behaviorNames.length > 1) {
    return {
      status: 'needs_disambiguation',
      message: 'This outcome contains verbs that could map to multiple behaviors. Which best describes the intended student action?',
      verbs: verbObjs.map(function(v) { return v['Verb'] || v['verb']; }),
      behaviors: behaviorNames.map(function(name) {
        var detail = getBehaviorDetail(name);
        return {
          name: name,
          definition: detail ? (detail['Definition / Construct'] || '') : '',
          internal_external: detail ? (detail['Internal / External'] || '') : ''
        };
      })
    };
  }

  var primaryBehaviorName = behaviorNames[0];
  var primaryBehavior = getBehaviorDetail(primaryBehaviorName);
  if (!primaryBehavior) {
    return { status: 'error', message: 'Behavior not found in framework: ' + primaryBehaviorName };
  }

  // 3. Internal/External pairing check
  var isInternal = isInternalBehavior(primaryBehaviorName);
  var pairedBehaviorName = null;
  var pairedBehavior = null;

  if (isInternal) {
    if (forcedPairedBehaviorName) {
      pairedBehaviorName = forcedPairedBehaviorName;
      pairedBehavior = getBehaviorDetail(pairedBehaviorName);
    } else {
      var externalBehaviors = fw.behaviors.filter(function(b) {
        return (b['Internal / External'] || '') === 'External';
      });
      return {
        status: 'needs_pairing',
        message: 'This outcome describes an Internal behavior (' + primaryBehaviorName + '). For assessment, pair it with an External behavior that makes the thinking observable:',
        primary_behavior: {
          name: primaryBehaviorName,
          definition: primaryBehavior['Definition / Construct'] || ''
        },
        external_behaviors: externalBehaviors.map(function(b) {
          return {
            name: b['Behavior'] || '',
            definition: b['Definition / Construct'] || '',
            preferred_task: b['Preferred Task Type'] || '',
            preferred_deliverable: b['Preferred Deliverable Task Type'] || ''
          };
        })
      };
    }
  }

  // 4. Task type recommendation
  var drivingBehavior = pairedBehavior || primaryBehavior;
  var recommendedTaskName = (drivingBehavior['Preferred Task Type'] || '').split(',')[0].trim();
  var altTaskNames = (drivingBehavior['Other Possible Task Type'] || '')
    .split(',').map(function(t) { return t.trim(); }).filter(Boolean);
  var recommendedTask = getTaskDetail(recommendedTaskName);

  // 5. Deliverable recommendation
  var recommendedDeliverableName = (drivingBehavior['Preferred Deliverable Task Type'] || '')
    .replace('*None: Must be paired with External Behavior*', '')
    .split(',')[0].trim();
  var altDeliverableNames = (drivingBehavior['Other Possible Deliverable Task Type'] || '')
    .split(',').map(function(d) { return d.trim(); }).filter(Boolean);
  var recommendedDeliverable = recommendedDeliverableName ? getDeliverableDetail(recommendedDeliverableName) : null;

  // 6. Context from behavior
  var preferredContext = drivingBehavior['Program Preferred Context'] || primaryBehavior['Program Preferred Context'] || '';
  var independentInteractive = drivingBehavior['Independent / Interactive'] || primaryBehavior['Independent / Interactive'] || '';

  // 7. AI-resistance affordances from task and deliverable
  var taskAiAffordance = recommendedTask ? (recommendedTask['AI-resistance affordance'] || '') : '';
  var deliverableAiAffordance = recommendedDeliverable ? (recommendedDeliverable['AI-resistance affordance'] || '') : '';

  // 8. Discipline overlay
  var disciplineCluster = null;
  if (programName) {
    disciplineCluster = getDisciplineForProgram(programName);
  }

  // 9. Cross-cutting AI-resistance features
  var selectedAiFeatures = selectAiResistanceFeatures(
    recommendedTaskName,
    disciplineCluster ? (disciplineCluster['Discipline / Program Cluster'] || '') : '',
    3
  );

  // Assemble citations from all source_keys referenced
  var allSourceKeys = [];
  if (recommendedTask && recommendedTask['Discipline Affinity']) {
    // discipline affinity is free text, not source keys
  }
  if (disciplineCluster) {
    (disciplineCluster['Primary Source Keys'] || '').split(',').forEach(function(k) {
      k = k.trim();
      if (k && allSourceKeys.indexOf(k) === -1) allSourceKeys.push(k);
    });
  }
  selectedAiFeatures.forEach(function(f) {
    (f['Source Keys'] || '').split(';').forEach(function(k) {
      k = k.trim();
      if (k && allSourceKeys.indexOf(k) === -1) allSourceKeys.push(k);
    });
  });

  var citations = allSourceKeys.map(function(key) {
    var src = fw.sources.find(function(s) { return (s['Source Key'] || '').trim() === key; });
    return src ? {
      key: key,
      reference: src['Full Reference'] || '',
      implication: src['Assessment Implication'] || '',
      url: src['URL'] || ''
    } : { key: key, reference: '', implication: '', url: '' };
  }).filter(function(c) { return c.reference; });

  // Build reasoning narrative
  var reasoning = _buildReasoning(
    verbObjs, primaryBehaviorName, isInternal, pairedBehaviorName,
    recommendedTaskName, recommendedDeliverableName, disciplineCluster
  );

  return {
    status: 'ok',
    verbs: verbObjs.map(function(v) { return v['Verb'] || v['verb'] || ''; }),
    primary_behavior: primaryBehaviorName,
    behavior_definition: primaryBehavior['Definition / Construct'] || '',
    internal_external: primaryBehavior['Internal / External'] || '',
    independent_interactive: independentInteractive,
    preferred_context: preferredContext,
    paired_external_behavior: pairedBehaviorName,
    paired_external_behavior_definition: pairedBehavior ? (pairedBehavior['Definition / Construct'] || '') : null,
    recommended_task_type: recommendedTask ? {
      name: recommendedTaskName,
      description: recommendedTask['Description'] || '',
      ai_resistance_affordance: taskAiAffordance,
      recommended_scoring_evidence: recommendedTask['Recommended scoring evidence'] || '',
      discipline_affinity: recommendedTask['Discipline Affinity'] || '',
      format_modality: recommendedTask['Format / Modality'] || ''
    } : { name: recommendedTaskName, description: '', ai_resistance_affordance: '', recommended_scoring_evidence: '' },
    alternative_task_types: altTaskNames,
    recommended_deliverable: recommendedDeliverable ? {
      name: recommendedDeliverableName,
      description: recommendedDeliverable['Description'] || '',
      ai_resistance_affordance: deliverableAiAffordance,
      modality: recommendedDeliverable['Modality'] || ''
    } : (recommendedDeliverableName ? { name: recommendedDeliverableName, description: '', ai_resistance_affordance: '' } : null),
    alternative_deliverables: altDeliverableNames,
    learner_choice_task: drivingBehavior['Learner choice of task'] || '',
    learner_choice_deliverable: drivingBehavior['Learner choice of deliverable'] || '',
    discipline_cluster: disciplineCluster ? {
      name: disciplineCluster['Discipline / Program Cluster'] || '',
      appropriate_task_types: (disciplineCluster['Particularly Appropriate Task Types'] || '').split(';').map(function(t) { return t.trim(); }).filter(Boolean),
      recommended_deliverables: (disciplineCluster['Recommended Deliverables'] || '').split(';').map(function(d) { return d.trim(); }).filter(Boolean),
      high_value_verbs: (disciplineCluster['High-value Verbs to Add / Emphasize'] || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean),
      ai_resistant_design_moves: disciplineCluster['AI-resistant design moves'] || '',
      why_fit_strong: disciplineCluster['Why this fit is strong'] || '',
      source_keys: (disciplineCluster['Primary Source Keys'] || '').split(',').map(function(k) { return k.trim(); }).filter(Boolean)
    } : null,
    selected_ai_resistance_features: selectedAiFeatures.map(function(f) {
      return {
        name: f['AI-resistant Design Feature'] || '',
        why: f['Why it helps validity/security'] || '',
        works_best_for: f['Works best for'] || '',
        example: f['Example implementation'] || '',
        caution: f['Caution'] || '',
        source_keys: (f['Source Keys'] || '').split(';').map(function(k) { return k.trim(); }).filter(Boolean)
      };
    }),
    citations: citations,
    reasoning: reasoning
  };
}

function _buildReasoning(verbObjs, primaryBehavior, isInternal, pairedBehavior, taskName, deliverableName, discipline) {
  var verbNames = verbObjs.map(function(v) { return v['Verb'] || v['verb'] || ''; }).join(', ');
  var parts = [
    'The verb' + (verbNames.indexOf(',') !== -1 ? 's' : '') + ' "' + verbNames + '" map to the behavior <strong>' + primaryBehavior + '</strong>.'
  ];
  if (isInternal) {
    parts.push('This is an <em>Internal</em> behavior — it describes cognitive processing that is not directly observable. It has been paired with <strong>' + (pairedBehavior || '(none selected)') + '</strong> as the External behavior that produces observable evidence.');
  }
  if (taskName) {
    parts.push('The framework recommends a <strong>' + taskName + '</strong> task type as the stimulus, which elicits the kind of reasoning this behavior requires.');
  }
  if (deliverableName) {
    parts.push('The recommended deliverable is <strong>' + deliverableName + '</strong>, which produces evidence aligned to this behavior.');
  }
  if (discipline) {
    var dName = discipline['Discipline / Program Cluster'] || '';
    parts.push('Given the <strong>' + dName + '</strong> discipline cluster, discipline-specific task types and design moves have been layered onto this recommendation.');
  }
  return parts.join(' ');
}

function _buildVerbPickerGroups() {
  var fw = _fw();
  var groups = {};
  fw.behaviors.forEach(function(b) {
    var name = b['Behavior'] || '';
    groups[name] = {
      behavior: name,
      definition: b['Definition / Construct'] || '',
      internal_external: b['Internal / External'] || '',
      verbs: []
    };
  });
  fw.verbs.forEach(function(v) {
    var b = v['Most Likely Behavior'] || '';
    if (groups[b]) {
      groups[b].verbs.push(v['Verb'] || v['verb'] || '');
    }
  });
  return Object.values(groups);
}

// ─── convenience getters for UI ──────────────────────────────────────────────

function getAllBehaviors() {
  return _fw().behaviors.map(function(b) {
    return {
      name: b['Behavior'] || '',
      definition: b['Definition / Construct'] || '',
      internal_external: b['Internal / External'] || '',
      independent_interactive: b['Independent / Interactive'] || '',
      preferred_context: b['Program Preferred Context'] || '',
      preferred_task: b['Preferred Task Type'] || '',
      preferred_deliverable: b['Preferred Deliverable Task Type'] || ''
    };
  });
}

function getAllTaskTypes() {
  return _fw().tasks.map(function(t) {
    return {
      name: t['Task Type'] || '',
      description: t['Description'] || '',
      ai_resistance_affordance: t['AI-resistance affordance'] || '',
      discipline_affinity: t['Discipline Affinity'] || ''
    };
  });
}

function getAllDeliverables() {
  return _fw().deliverables.map(function(d) {
    return {
      name: d['Name'] || '',
      description: d['Description'] || '',
      ai_resistance_affordance: d['AI-resistance affordance'] || ''
    };
  });
}

function getAllDisciplines() {
  return _fw().disciplines.map(function(d) {
    return {
      name: d['Discipline / Program Cluster'] || '',
      appropriate_task_types: (d['Particularly Appropriate Task Types'] || '').split(';').map(function(t) { return t.trim(); }).filter(Boolean),
      recommended_deliverables: (d['Recommended Deliverables'] || '').split(';').map(function(d2) { return d2.trim(); }).filter(Boolean),
      high_value_verbs: (d['High-value Verbs to Add / Emphasize'] || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean),
      ai_resistant_design_moves: d['AI-resistant design moves'] || ''
    };
  });
}
