/**
 * PromptGen.gs — Generates the structured LLM prompt from a recommendation.
 *
 * Template matches §8.1 of the PRD.
 */

function generatePrompt(params) {
  // params: { courseCode, courseTitle, courseDescription, programName,
  //           outcomeText, recommendation }
  var r = params.recommendation;
  if (!r || r.status !== 'ok') return '';

  var clusterSection = '';
  if (r.discipline_cluster) {
    var dc = r.discipline_cluster;
    var citations = (dc.source_keys || []).map(function(k) {
      var c = (r.citations || []).find(function(c2) { return c2.key === k; });
      return c ? (k + ': ' + c.url) : k;
    }).filter(Boolean).join('\n  ');
    clusterSection = [
      '',
      '--- DISCIPLINE-SPECIFIC GUIDANCE ---',
      'This course is in the ' + dc.name + ' discipline cluster. For this discipline:',
      '- Particularly appropriate task types: ' + dc.appropriate_task_types.join('; '),
      '- Recommended deliverables: ' + dc.recommended_deliverables.join('; '),
      '- High-value verbs in this discipline: ' + dc.high_value_verbs.join(', '),
      '- AI-resistant design moves for this discipline: ' + dc.ai_resistant_design_moves,
      '- Research basis:',
      '  ' + (citations || '(see framework sources)'),
    ].join('\n');
  }

  var aiFeaturesSection = '';
  if (r.selected_ai_resistance_features && r.selected_ai_resistance_features.length > 0) {
    var featureLines = r.selected_ai_resistance_features.map(function(f) {
      return '- ' + f.name + ': ' + f.why +
        '\n  Example: ' + f.example +
        '\n  Caution: ' + f.caution;
    }).join('\n');
    aiFeaturesSection = [
      '',
      '--- CROSS-CUTTING AI-RESISTANT DESIGN FEATURES ---',
      'Apply these ' + r.selected_ai_resistance_features.length + ' features chosen for this task type and discipline:',
      featureLines,
    ].join('\n');
  }

  var pairedNote = '';
  if (r.paired_external_behavior) {
    pairedNote = '\n  [Internal behavior — paired with: ' + r.paired_external_behavior +
      ' to make it externally observable]';
  }

  var prompt = [
    'You are helping a college faculty member design a formative or summative assessment for a specific learning outcome.',
    'The faculty member has used a research-based framework to determine the appropriate assessment design.',
    "Your job is to draft the actual assessment artifact based on the framework's recommendations.",
    '',
    '--- CONTEXT ---',
    'Institution: University of Maine at Presque Isle',
    'Course: ' + (params.courseCode || '') + ' ' + (params.courseTitle || ''),
    'Course description: ' + (params.courseDescription || ''),
    'Program: ' + (params.programName || 'Not specified'),
    'Discipline cluster: ' + (r.discipline_cluster ? r.discipline_cluster.name : 'interdisciplinary / not mapped'),
    '',
    '--- LEARNING OUTCOME ---',
    'The faculty member is designing assessment for this outcome:',
    '"' + params.outcomeText + '"',
    '',
    '--- FRAMEWORK CLASSIFICATION ---',
    'Identified verb(s): ' + (r.verbs || []).join(', '),
    'Identified behavior(s): ' + r.primary_behavior,
    '  - Definition/construct: ' + r.behavior_definition,
    '  - Internal/External: ' + r.internal_external,
    '  - Independent/Interactive: ' + r.independent_interactive,
    '  - Preferred context: ' + r.preferred_context,
    pairedNote,
    '',
    '--- RECOMMENDED ASSESSMENT DESIGN ---',
    'Stimulus task type: ' + (r.recommended_task_type ? r.recommended_task_type.name : ''),
    '  Description (from framework): ' + (r.recommended_task_type ? r.recommended_task_type.description : ''),
    '  Why this was recommended: ' + r.reasoning,
    '  AI-resistance affordance (from framework): ' + (r.recommended_task_type ? r.recommended_task_type.ai_resistance_affordance : ''),
    '  Recommended scoring evidence: ' + (r.recommended_task_type ? r.recommended_task_type.recommended_scoring_evidence : ''),
    '',
    'Deliverable: ' + (r.recommended_deliverable ? r.recommended_deliverable.name : ''),
    '  Description (from framework): ' + (r.recommended_deliverable ? r.recommended_deliverable.description : ''),
    '  Why this was recommended: Aligned to the ' + r.primary_behavior + ' behavior.',
    '  AI-resistance affordance (from framework): ' + (r.recommended_deliverable ? r.recommended_deliverable.ai_resistance_affordance : ''),
    '',
    'Modality: ' + (r.recommended_task_type ? r.recommended_task_type.format_modality : '') +
      ' | Learner choice: ' + r.learner_choice_task,

    clusterSection,
    aiFeaturesSection,

    '',
    '--- DRAFT THE FOLLOWING ---',
    '1. THE STIMULUS: the ' + (r.recommended_task_type ? r.recommended_task_type.name.toLowerCase() : 'task') +
      ' text, parameters, or setup — make it concrete, discipline-specific, and authentic.',
    '2. THE DELIVERABLE SPECIFICATION: exactly what the student produces, including format, length, and submission requirements.',
    '3. THE RUBRIC: 3-4 criteria aligned to the targeted behavior, with descriptors for Exemplary, Proficient, Developing, and Emerging evidence.',
    '4. NOTES ON EVIDENCE: what specifically demonstrates the targeted behavior at Exemplary and Proficient levels vs. what would be insufficient at Developing and Emerging levels.',
    '5. ACCESSIBILITY ALTERNATIVES: if the recommended modality (e.g., live oral defense, in-person observation) creates barriers for any students, propose at least one alternative format that elicits equivalent evidence.',
    '',
    "Make the assessment concrete, discipline-specific, and authentic to the learning outcome above. Reference the course context where relevant. Frame AI-resistance as supporting *valid evidence of learning*, not as surveillance or AI detection. If anything in the framework classification seems mismatched to the outcome, note your concern and offer an alternative.",
  ].join('\n');

  return prompt;
}

/**
 * Save a prompt to the prompts table.
 */
function savePrompt(owner, courseId, cloId, outcomeText, recommendation, promptText, notes) {
  return dbInsert('prompts', {
    id: '',
    owner: owner,
    course_id: courseId || '',
    clo_id: cloId || '',
    outcome_text: outcomeText,
    behavior_classification: recommendation ? recommendation.primary_behavior : '',
    recommended_task_type: recommendation && recommendation.recommended_task_type ? recommendation.recommended_task_type.name : '',
    recommended_deliverable: recommendation && recommendation.recommended_deliverable ? recommendation.recommended_deliverable.name : '',
    prompt_text: promptText,
    notes: notes || '',
    created_at: '',
    updated_at: ''
  });
}

function getMyPrompts(email) {
  return dbWhere('prompts', function(p) { return p.owner === email; });
}

function updatePromptText(promptId, newText) {
  return dbUpdate('prompts', function(p) { return p.id === promptId; }, { prompt_text: newText });
}
