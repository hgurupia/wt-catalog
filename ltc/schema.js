/* =========================================================================
   LTC Nurse Assessment — assessment schema + standardized scoring scales
   Home health Start of Care (SOC) comprehensive nursing assessment.
   Field types: text, textarea, date, time, number, select, radio, checks,
                note, computed
   Every field: {id, label, type, ...}  ids are flat and stable (used by the
   plan-of-care rules engine, so do not rename without updating poc-engine.js)
   ========================================================================= */
(function (root) {
  'use strict';

  /* ---------- shared option sets ---------- */
  var YN = ['No', 'Yes'];
  var YNU = ['No', 'Yes', 'Unknown'];

  // Functional assistance levels used for ADL items
  var ADL_LEVELS = [
    '0 - Independent',
    '1 - Setup / clean-up assist',
    '2 - Supervision / touching assist',
    '3 - Partial / moderate assist',
    '4 - Substantial / maximal assist',
    '5 - Dependent',
    '6 - Not attempted (safety / refused)'
  ];
  var IADL_LEVELS = ['Independent', 'Needs assistance', 'Dependent', 'Not applicable'];

  function adl(id, label) {
    return { id: id, label: label, type: 'select', options: ADL_LEVELS, col: 6 };
  }
  function iadl(id, label) {
    return { id: id, label: label, type: 'select', options: IADL_LEVELS, col: 6 };
  }

  /* ---------- assessment sections ---------- */
  var SECTIONS = [
    /* 1 ------------------------------------------------------------------ */
    {
      id: 'demographics',
      title: 'Patient & Visit Information',
      icon: '1',
      fields: [
        { id: 'pt_last', label: 'Last name', type: 'text', col: 4, required: true },
        { id: 'pt_first', label: 'First name', type: 'text', col: 4, required: true },
        { id: 'pt_mi', label: 'MI', type: 'text', col: 4 },
        { id: 'pt_mrn', label: 'Medical record #', type: 'text', col: 4 },
        { id: 'pt_dob', label: 'Date of birth', type: 'date', col: 4 },
        { id: 'pt_sex', label: 'Sex', type: 'select', options: ['Female', 'Male', 'Other / not specified'], col: 4 },
        { id: 'pt_address', label: 'Home address', type: 'text', col: 8 },
        { id: 'pt_phone', label: 'Phone', type: 'text', col: 4 },
        { id: 'pt_lang', label: 'Primary language', type: 'text', col: 4 },
        { id: 'pt_interpreter', label: 'Interpreter needed', type: 'radio', options: YN, col: 4 },
        { id: 'pt_advance_dir', label: 'Advance directive on file', type: 'select', options: ['No', 'Yes - copy in home', 'Yes - copy requested', 'Unknown'], col: 4 },
        { id: 'soc_date', label: 'Start of care date', type: 'date', col: 4, required: true },
        { id: 'visit_date', label: 'Assessment visit date', type: 'date', col: 4 },
        { id: 'nurse_name', label: 'Assessing clinician (RN)', type: 'text', col: 4 },
        { id: 'emerg_name', label: 'Emergency contact - name', type: 'text', col: 4 },
        { id: 'emerg_rel', label: 'Relationship', type: 'text', col: 4 },
        { id: 'emerg_phone', label: 'Emergency contact - phone', type: 'text', col: 4 }
      ]
    },

    /* 2 ------------------------------------------------------------------ */
    {
      id: 'referral',
      title: 'Referral, Diagnoses & Homebound Status',
      icon: '2',
      fields: [
        { id: 'ref_source', label: 'Referral source', type: 'select', options: ['Hospital discharge', 'Skilled nursing facility', 'Physician office', 'Assisted living / LTC facility', 'Family / self', 'Other'], col: 4 },
        { id: 'ref_hosp_discharge', label: 'Inpatient discharge within last 14 days', type: 'radio', options: YN, col: 4 },
        { id: 'ref_discharge_date', label: 'Discharge date', type: 'date', col: 4, showIf: { ref_hosp_discharge: 'Yes' } },
        { id: 'md_name', label: 'Physician following plan of care', type: 'text', col: 6 },
        { id: 'md_phone', label: 'Physician phone / fax', type: 'text', col: 6 },
        { id: 'dx_primary', label: 'Primary diagnosis (with ICD-10 if known)', type: 'text', col: 12, required: true },
        { id: 'dx_secondary', label: 'Other pertinent diagnoses (one per line)', type: 'textarea', col: 12 },
        { id: 'surgical_hx', label: 'Recent surgical procedure / date', type: 'text', col: 6 },
        { id: 'allergies', label: 'Allergies (drug, food, environmental) - write NKDA if none', type: 'text', col: 6 },
        { id: 'payer', label: 'Primary payer', type: 'select', options: ['Medicare', 'Medicare Advantage', 'Medicaid / LTC waiver', 'Commercial', 'Private pay', 'Other'], col: 4 },
        { id: 'auth_number', label: 'Authorization #', type: 'text', col: 4 },
        { id: 'auth_visits', label: 'Authorized visits', type: 'text', col: 4 },
        { id: 'homebound', label: 'Homebound status', type: 'checks', col: 12, options: [
          'Requires assistance of another person to leave home',
          'Requires supportive device (walker, cane, wheelchair, crutches)',
          'Leaving home requires considerable and taxing effort',
          'Unsafe to leave home unattended (cognition / falls)',
          'Medically restricted from leaving home',
          'Severe dyspnea / activity intolerance on exertion'
        ] },
        { id: 'homebound_narrative', label: 'Homebound narrative (why leaving home is taxing)', type: 'textarea', col: 12 }
      ]
    },

    /* 3 ------------------------------------------------------------------ */
    {
      id: 'vitals',
      title: 'Vital Signs & Parameters',
      icon: '3',
      fields: [
        { id: 'vs_temp', label: 'Temp (F)', type: 'number', step: '0.1', col: 3 },
        { id: 'vs_pulse', label: 'Pulse (bpm)', type: 'number', col: 3 },
        { id: 'vs_resp', label: 'Respirations', type: 'number', col: 3 },
        { id: 'vs_o2', label: 'SpO2 (%)', type: 'number', col: 3 },
        { id: 'vs_bp_sys', label: 'BP systolic', type: 'number', col: 3 },
        { id: 'vs_bp_dia', label: 'BP diastolic', type: 'number', col: 3 },
        { id: 'vs_bp_position', label: 'Position', type: 'select', options: ['Sitting', 'Lying', 'Standing'], col: 3 },
        { id: 'vs_orthostatic', label: 'Orthostatic drop noted', type: 'radio', options: YN, col: 3 },
        { id: 'vs_weight', label: 'Weight (lb)', type: 'number', step: '0.1', col: 3 },
        { id: 'vs_height', label: 'Height (in)', type: 'number', step: '0.1', col: 3 },
        { id: 'vs_bmi', label: 'BMI (calculated)', type: 'computed', compute: 'bmi', col: 3 },
        { id: 'vs_glucose', label: 'Blood glucose (mg/dL)', type: 'number', col: 3 },
        { id: 'vs_o2_therapy', label: 'On supplemental oxygen', type: 'radio', options: YN, col: 4 },
        { id: 'vs_o2_lpm', label: 'O2 liters/min and delivery device', type: 'text', col: 8, showIf: { vs_o2_therapy: 'Yes' } },
        { id: 'note_params', type: 'note', text: 'Physician notification parameters below are transcribed onto the plan of care.' },
        { id: 'param_sbp_hi', label: 'Notify MD - systolic above', type: 'number', col: 3, default: '160' },
        { id: 'param_sbp_lo', label: 'Notify MD - systolic below', type: 'number', col: 3, default: '90' },
        { id: 'param_hr_hi', label: 'Notify MD - pulse above', type: 'number', col: 3, default: '110' },
        { id: 'param_hr_lo', label: 'Notify MD - pulse below', type: 'number', col: 3, default: '55' },
        { id: 'param_temp', label: 'Notify MD - temp above (F)', type: 'number', step: '0.1', col: 3, default: '100.4' },
        { id: 'param_o2', label: 'Notify MD - SpO2 below (%)', type: 'number', col: 3, default: '90' },
        { id: 'param_glucose_hi', label: 'Notify MD - glucose above', type: 'number', col: 3, default: '300' },
        { id: 'param_glucose_lo', label: 'Notify MD - glucose below', type: 'number', col: 3, default: '70' },
        { id: 'param_weight', label: 'Notify MD - weight gain (lb in 1 wk)', type: 'number', col: 3, default: '5' },
        { id: 'param_other', label: 'Other notification parameters', type: 'text', col: 9 }
      ]
    },

    /* 4 ------------------------------------------------------------------ */
    {
      id: 'environment',
      title: 'Living Situation, Home Safety & Emergency Plan',
      icon: '4',
      fields: [
        { id: 'living_arrangement', label: 'Living arrangement', type: 'select', options: ['Lives alone', 'Lives with spouse / partner', 'Lives with family', 'Lives with paid caregiver', 'Assisted living / group home', 'Other'], col: 6 },
        { id: 'assistance_available', label: 'Availability of assistance in the home', type: 'select', options: ['Around the clock', 'Regular daytime', 'Regular nighttime', 'Occasional / short-term', 'No assistance available'], col: 6 },
        { id: 'caregiver_name', label: 'Primary caregiver name / relationship', type: 'text', col: 6 },
        { id: 'caregiver_ability', label: 'Caregiver ability / willingness', type: 'select', options: ['Able and willing', 'Willing but needs training', 'Limited by own health', 'Unwilling / unavailable', 'No caregiver identified'], col: 6 },
        { id: 'home_type', label: 'Residence type', type: 'select', options: ['House', 'Apartment', 'Mobile home', 'Assisted living', 'Other'], col: 4 },
        { id: 'home_stairs', label: 'Stairs to enter or within home', type: 'radio', options: YN, col: 4 },
        { id: 'home_utilities', label: 'Utilities adequate (heat, water, electricity)', type: 'radio', options: YN, col: 4 },
        { id: 'home_hazards', label: 'Safety hazards identified', type: 'checks', col: 12, options: [
          'Throw rugs / clutter in walkways',
          'Inadequate lighting',
          'No grab bars in bathroom',
          'Unsafe stairs / no handrail',
          'Cords or tripping hazards',
          'No working smoke detector',
          'Pets underfoot',
          'Firearms in home',
          'Smoking in home (with or without oxygen)',
          'Infestation / sanitation concerns',
          'Unsafe medication storage',
          'None identified'
        ] },
        { id: 'emerg_plan', label: 'Emergency / disaster plan in place', type: 'radio', options: YN, col: 4 },
        { id: 'emerg_triage', label: 'Emergency triage classification', type: 'select', col: 8, options: [
          'Level 1 - life-threatening; visit or contact required during emergency',
          'Level 2 - not immediately life-threatening; contact within 24-48 hrs',
          'Level 3 - stable; can be postponed 72+ hrs with caregiver support'
        ] },
        { id: 'evac_plan', label: 'Evacuation plan / backup power for equipment', type: 'text', col: 12 },
        { id: 'env_notes', label: 'Environmental notes', type: 'textarea', col: 12 }
      ]
    },

    /* 5 ------------------------------------------------------------------ */
    {
      id: 'sensory_pain',
      title: 'Sensory Status & Pain',
      icon: '5',
      fields: [
        { id: 'vision', label: 'Vision', type: 'select', options: ['Adequate (with or without glasses)', 'Impaired - can see large print', 'Severely impaired / legally blind'], col: 6 },
        { id: 'hearing', label: 'Hearing', type: 'select', options: ['Adequate', 'Impaired - needs repetition / raised voice', 'Severely impaired / deaf'], col: 6 },
        { id: 'hearing_aid', label: 'Uses hearing aid(s)', type: 'radio', options: YN, col: 4 },
        { id: 'speech', label: 'Speech / expression of ideas', type: 'select', options: ['Clear and appropriate', 'Minimal difficulty finding words', 'Requires prompting / limited to phrases', 'Nonverbal or unintelligible'], col: 8 },
        { id: 'pain_present', label: 'Pain reported', type: 'radio', options: YN, col: 4 },
        { id: 'pain_score', label: 'Current pain (0-10)', type: 'number', min: 0, max: 10, col: 4, showIf: { pain_present: 'Yes' } },
        { id: 'pain_worst', label: 'Worst pain in last 24 hrs (0-10)', type: 'number', min: 0, max: 10, col: 4, showIf: { pain_present: 'Yes' } },
        { id: 'pain_scale_used', label: 'Pain scale used', type: 'select', options: ['Numeric 0-10', 'Wong-Baker FACES', 'PAINAD (nonverbal)', 'Verbal descriptor'], col: 4, showIf: { pain_present: 'Yes' } },
        { id: 'pain_location', label: 'Location / quality', type: 'text', col: 8, showIf: { pain_present: 'Yes' } },
        { id: 'pain_frequency', label: 'Frequency', type: 'select', options: ['Intermittent', 'Constant', 'With activity only', 'At night only'], col: 4, showIf: { pain_present: 'Yes' } },
        { id: 'pain_effect', label: 'Pain interferes with activity or sleep', type: 'radio', options: YN, col: 4, showIf: { pain_present: 'Yes' } },
        { id: 'pain_relief', label: 'Current relief measures and effectiveness', type: 'textarea', col: 12, showIf: { pain_present: 'Yes' } }
      ]
    },

    /* 6 ------------------------------------------------------------------ */
    {
      id: 'integumentary',
      title: 'Integumentary, Wounds & Braden Scale',
      icon: '6',
      fields: [
        { id: 'skin_condition', label: 'General skin condition', type: 'checks', col: 12, options: [
          'Intact / no issues', 'Dry / flaking', 'Fragile / tissue-paper thin', 'Bruising', 'Rash', 'Edema', 'Pallor', 'Jaundice', 'Skin tears', 'Excoriation / maceration'
        ] },
        { id: 'wound_present', label: 'Wound, ulcer, incision or ostomy present', type: 'radio', options: YN, col: 4 },
        { id: 'wound_type', label: 'Wound type(s)', type: 'checks', col: 8, showIf: { wound_present: 'Yes' }, options: [
          'Pressure ulcer / injury', 'Venous stasis ulcer', 'Arterial ulcer', 'Diabetic / neuropathic ulcer', 'Surgical incision', 'Skin tear / trauma', 'Ostomy site', 'Other'
        ] },
        { id: 'wound_detail', label: 'Wound detail - location, stage, measurements (L x W x D), drainage, odor, periwound', type: 'textarea', col: 12, showIf: { wound_present: 'Yes' } },
        { id: 'wound_orders', label: 'Current wound treatment orders', type: 'textarea', col: 12, showIf: { wound_present: 'Yes' } },
        { id: 'wound_infection', label: 'Signs of wound infection', type: 'radio', options: YN, col: 4, showIf: { wound_present: 'Yes' } },
        { id: 'note_braden', type: 'note', text: 'Braden Scale for Predicting Pressure Sore Risk. Total 6-23; lower scores indicate higher risk.' },
        { id: 'braden_sensory', label: 'Sensory perception', type: 'select', col: 6, options: ['1 - Completely limited', '2 - Very limited', '3 - Slightly limited', '4 - No impairment'] },
        { id: 'braden_moisture', label: 'Moisture', type: 'select', col: 6, options: ['1 - Constantly moist', '2 - Very moist', '3 - Occasionally moist', '4 - Rarely moist'] },
        { id: 'braden_activity', label: 'Activity', type: 'select', col: 6, options: ['1 - Bedfast', '2 - Chairfast', '3 - Walks occasionally', '4 - Walks frequently'] },
        { id: 'braden_mobility', label: 'Mobility', type: 'select', col: 6, options: ['1 - Completely immobile', '2 - Very limited', '3 - Slightly limited', '4 - No limitation'] },
        { id: 'braden_nutrition', label: 'Nutrition', type: 'select', col: 6, options: ['1 - Very poor', '2 - Probably inadequate', '3 - Adequate', '4 - Excellent'] },
        { id: 'braden_friction', label: 'Friction and shear', type: 'select', col: 6, options: ['1 - Problem', '2 - Potential problem', '3 - No apparent problem'] },
        { id: 'braden_total', label: 'Braden total / risk level', type: 'computed', compute: 'braden', col: 12 }
      ]
    },

    /* 7 ------------------------------------------------------------------ */
    {
      id: 'cardiopulm',
      title: 'Cardiopulmonary Status',
      icon: '7',
      fields: [
        { id: 'cardiac_findings', label: 'Cardiovascular findings', type: 'checks', col: 12, options: [
          'Within normal limits', 'Irregular pulse', 'Peripheral edema', 'Chest pain / angina', 'Dizziness / syncope', 'Palpitations', 'Diminished peripheral pulses', 'Pacemaker / ICD', 'Anticoagulant therapy'
        ] },
        { id: 'edema_detail', label: 'Edema location / severity', type: 'text', col: 6 },
        { id: 'weight_gain', label: 'Weight gain of 3+ lb in 1 day or 5+ lb in 1 week', type: 'radio', options: YNU, col: 6 },
        { id: 'resp_findings', label: 'Respiratory findings', type: 'checks', col: 12, options: [
          'Within normal limits', 'Dyspnea on exertion', 'Dyspnea at rest', 'Orthopnea', 'Productive cough', 'Nonproductive cough', 'Wheezing', 'Crackles / rales', 'Diminished breath sounds', 'Uses inhalers / nebulizer', 'CPAP / BiPAP'
        ] },
        { id: 'dyspnea_level', label: 'When is the patient short of breath', type: 'select', col: 12, options: [
          'Never short of breath',
          'With moderate exertion (stairs, climbing)',
          'With minimal exertion (walking >20 ft, transfers)',
          'With ADLs / talking',
          'At rest'
        ] },
        { id: 'smoking', label: 'Tobacco use', type: 'select', options: ['Never', 'Former', 'Current'], col: 4 },
        { id: 'cardio_notes', label: 'Cardiopulmonary notes', type: 'textarea', col: 12 }
      ]
    },

    /* 8 ------------------------------------------------------------------ */
    {
      id: 'elimination',
      title: 'Elimination - GI / GU',
      icon: '8',
      fields: [
        { id: 'bowel_pattern', label: 'Bowel pattern', type: 'select', options: ['Regular / continent', 'Constipation', 'Diarrhea', 'Alternating', 'Ostomy'], col: 6 },
        { id: 'last_bm', label: 'Date of last bowel movement', type: 'date', col: 6 },
        { id: 'bowel_incont', label: 'Bowel incontinence', type: 'select', options: ['Continent', 'Occasional incontinence', 'Frequent incontinence', 'Ostomy'], col: 6 },
        { id: 'bowel_program', label: 'Bowel program / laxative use', type: 'text', col: 6 },
        { id: 'urinary_status', label: 'Urinary status', type: 'select', options: ['Continent', 'Occasional incontinence', 'Frequent / total incontinence', 'Indwelling catheter', 'Intermittent catheterization', 'Suprapubic catheter', 'Urostomy'], col: 6 },
        { id: 'uti_signs', label: 'Signs or symptoms of UTI', type: 'radio', options: YN, col: 6 },
        { id: 'catheter_detail', label: 'Catheter type, size, last change date, drainage', type: 'text', col: 12, showIf: { urinary_status: ['Indwelling catheter', 'Intermittent catheterization', 'Suprapubic catheter'] } },
        { id: 'dialysis', label: 'Dialysis', type: 'select', options: ['None', 'Hemodialysis', 'Peritoneal'], col: 6 },
        { id: 'elim_notes', label: 'Elimination notes', type: 'textarea', col: 12 }
      ]
    },

    /* 9 ------------------------------------------------------------------ */
    {
      id: 'nutrition',
      title: 'Nutrition & Hydration',
      icon: '9',
      fields: [
        { id: 'diet_order', label: 'Prescribed diet', type: 'text', col: 6 },
        { id: 'appetite', label: 'Appetite / intake', type: 'select', options: ['Good - eats most meals', 'Fair - eats about half', 'Poor - eats less than half', 'Minimal / refuses'], col: 6 },
        { id: 'weight_loss', label: 'Unintentional weight loss (5% in 30 days or 10% in 180 days)', type: 'radio', options: YNU, col: 6 },
        { id: 'swallowing', label: 'Swallowing', type: 'select', options: ['No difficulty', 'Difficulty with thin liquids', 'Difficulty with solids', 'Coughing / choking with meals', 'NPO'], col: 6 },
        { id: 'dentition', label: 'Dentition / oral status', type: 'select', options: ['Adequate', 'Dentures - fit well', 'Dentures - poor fit', 'Missing teeth / poor dentition', 'Oral lesions'], col: 6 },
        { id: 'hydration', label: 'Hydration status', type: 'select', options: ['Adequate', 'Borderline - encourage fluids', 'Signs of dehydration', 'Fluid restriction ordered'], col: 6 },
        { id: 'enteral', label: 'Enteral / parenteral nutrition', type: 'select', options: ['None', 'Gastrostomy tube', 'Jejunostomy tube', 'NG tube', 'TPN'], col: 6 },
        { id: 'enteral_detail', label: 'Formula, rate, flush schedule', type: 'text', col: 6, showIf: { enteral: ['Gastrostomy tube', 'Jejunostomy tube', 'NG tube', 'TPN'] } },
        { id: 'food_access', label: 'Able to obtain and prepare adequate food', type: 'radio', options: YN, col: 6 },
        { id: 'nutrition_notes', label: 'Nutrition notes', type: 'textarea', col: 12 }
      ]
    },

    /* 10 ----------------------------------------------------------------- */
    {
      id: 'neuro',
      title: 'Neurological, Cognitive & Behavioral',
      icon: '10',
      fields: [
        { id: 'orientation', label: 'Orientation', type: 'select', options: ['Alert and oriented x4', 'Oriented x3 (not time)', 'Oriented x2', 'Oriented to self only', 'Disoriented / nonresponsive'], col: 6 },
        { id: 'cognitive_function', label: 'Cognitive functioning', type: 'select', col: 6, options: [
          'Alert; able to focus and follow directions independently',
          'Requires prompting in new or complex situations',
          'Requires assistance and direction in routine situations',
          'Requires considerable assistance in routine situations',
          'Totally dependent / cannot direct care'
        ] },
        { id: 'confusion_freq', label: 'Frequency of confusion', type: 'select', col: 6, options: [
          'Never', 'In new or complex situations only', 'On awakening or at night only (sundowning)', 'During the day but not constantly', 'Constantly'
        ] },
        { id: 'memory_deficit', label: 'Memory deficit noted', type: 'radio', options: YN, col: 6 },
        { id: 'dementia_dx', label: 'Diagnosed dementia / Alzheimer disease', type: 'radio', options: YN, col: 6 },
        { id: 'behaviors', label: 'Behaviors demonstrated', type: 'checks', col: 12, options: [
          'None', 'Wandering / elopement risk', 'Verbal aggression', 'Physical aggression', 'Resistive to care', 'Socially inappropriate behavior', 'Delusions / hallucinations', 'Impaired decision-making'
        ] },
        { id: 'note_phq', type: 'note', text: 'PHQ-2 depression screen: over the last 2 weeks, how often has the patient been bothered by the following?' },
        { id: 'phq_interest', label: 'Little interest or pleasure in doing things', type: 'select', col: 6, options: ['0 - Not at all', '1 - Several days', '2 - More than half the days', '3 - Nearly every day'] },
        { id: 'phq_down', label: 'Feeling down, depressed or hopeless', type: 'select', col: 6, options: ['0 - Not at all', '1 - Several days', '2 - More than half the days', '3 - Nearly every day'] },
        { id: 'phq_total', label: 'PHQ-2 total / result', type: 'computed', compute: 'phq2', col: 12 },
        { id: 'suicidal_ideation', label: 'Expresses thoughts of self-harm', type: 'radio', options: YN, col: 6 },
        { id: 'neuro_notes', label: 'Neuro / behavioral notes', type: 'textarea', col: 12 }
      ]
    },

    /* 11 ----------------------------------------------------------------- */
    {
      id: 'functional',
      title: 'Functional Status - ADLs & IADLs',
      icon: '11',
      fields: [
        { id: 'note_adl', type: 'note', text: 'Rate current ability, considering the patient\'s ability on the day of assessment and safety.' },
        adl('adl_grooming', 'Grooming'),
        adl('adl_bath', 'Bathing'),
        adl('adl_dress_upper', 'Dressing - upper body'),
        adl('adl_dress_lower', 'Dressing - lower body'),
        adl('adl_toilet', 'Toileting / toilet transfer'),
        adl('adl_transfer', 'Bed-to-chair transfer'),
        adl('adl_ambulation', 'Ambulation / locomotion'),
        adl('adl_feeding', 'Eating / feeding'),
        { id: 'mobility_device', label: 'Mobility device used', type: 'checks', col: 12, options: ['None', 'Cane', 'Walker', 'Rollator', 'Crutches', 'Wheelchair', 'Hospital bed', 'Mechanical lift', 'Bedbound'] },
        { id: 'gait_quality', label: 'Gait / balance', type: 'select', col: 6, options: ['Steady', 'Slightly unsteady - no assistive device', 'Unsteady - requires device', 'Unsteady even with device', 'Unable to ambulate'] },
        { id: 'endurance', label: 'Activity tolerance', type: 'select', col: 6, options: ['Full activity', 'Tires with moderate activity', 'Tires with minimal activity', 'Requires frequent rest periods', 'Bed / chair bound'] },
        { id: 'note_iadl', type: 'note', text: 'Instrumental activities of daily living' },
        iadl('iadl_meds', 'Managing medications'),
        iadl('iadl_meals', 'Meal preparation'),
        iadl('iadl_phone', 'Using telephone / calling for help'),
        iadl('iadl_shopping', 'Shopping'),
        iadl('iadl_housekeeping', 'Light housekeeping / laundry'),
        iadl('iadl_transport', 'Transportation'),
        iadl('iadl_finances', 'Managing finances'),
        { id: 'functional_notes', label: 'Functional notes', type: 'textarea', col: 12 }
      ]
    },

    /* 12 ----------------------------------------------------------------- */
    {
      id: 'falls',
      title: 'Fall Risk - Morse Fall Scale',
      icon: '12',
      fields: [
        { id: 'note_morse', type: 'note', text: 'Morse Fall Scale. Score 0-24 low risk, 25-44 moderate risk, 45 or higher high risk.' },
        { id: 'morse_history', label: 'History of falling (within 3 months)', type: 'select', col: 6, options: ['0 - No', '25 - Yes'] },
        { id: 'morse_secondary', label: 'Secondary diagnosis (more than one medical diagnosis)', type: 'select', col: 6, options: ['0 - No', '15 - Yes'] },
        { id: 'morse_aid', label: 'Ambulatory aid', type: 'select', col: 6, options: ['0 - None / bedrest / nurse assist', '15 - Crutches / cane / walker', '30 - Furniture'] },
        { id: 'morse_iv', label: 'IV access or saline lock', type: 'select', col: 6, options: ['0 - No', '20 - Yes'] },
        { id: 'morse_gait', label: 'Gait / transferring', type: 'select', col: 6, options: ['0 - Normal / bedrest / immobile', '10 - Weak', '20 - Impaired'] },
        { id: 'morse_mental', label: 'Mental status', type: 'select', col: 6, options: ['0 - Oriented to own ability', '15 - Overestimates or forgets limits'] },
        { id: 'morse_total', label: 'Morse total / risk level', type: 'computed', compute: 'morse', col: 12 },
        { id: 'falls_number', label: 'Number of falls in the past 12 months', type: 'number', col: 4 },
        { id: 'fall_injury', label: 'Any fall with injury', type: 'radio', options: YN, col: 4 },
        { id: 'fear_falling', label: 'Patient reports fear of falling', type: 'radio', options: YN, col: 4 },
        { id: 'falls_notes', label: 'Circumstances of recent falls', type: 'textarea', col: 12 }
      ]
    },

    /* 13 ----------------------------------------------------------------- */
    {
      id: 'medications',
      title: 'Medications & Reconciliation',
      icon: '13',
      fields: [
        { id: 'med_list', label: 'Current medications - one per line (drug, dose, route, frequency, indication)', type: 'textarea', rows: 10, col: 12 },
        { id: 'med_count', label: 'Total number of medications', type: 'number', col: 4 },
        { id: 'med_classes', label: 'High-alert / high-risk classes in regimen', type: 'checks', col: 12, options: [
          'None', 'Anticoagulant / antiplatelet', 'Insulin', 'Oral hypoglycemic', 'Opioid analgesic', 'Benzodiazepine / sedative-hypnotic', 'Antipsychotic', 'Digoxin', 'Diuretic', 'Antiarrhythmic', 'Chemotherapy / immunosuppressant', 'Antibiotic (active course)'
        ] },
        { id: 'med_issues', label: 'Medication issues identified', type: 'checks', col: 12, options: [
          'None identified', 'Duplicate therapy', 'Significant drug-drug interaction', 'Dose outside safe range', 'Ineffective drug therapy', 'Missing indication / no matching diagnosis', 'Expired or discontinued meds in home', 'Cannot afford medications', 'Non-adherence reported'
        ] },
        { id: 'med_admin', label: 'Who administers medications', type: 'select', col: 6, options: ['Patient independently', 'Patient with reminders', 'Caregiver administers', 'Nurse administers', 'No reliable administrator'] },
        { id: 'med_organizer', label: 'Uses pill box / organizer', type: 'radio', options: YN, col: 6 },
        { id: 'md_notified_meds', label: 'Physician notified of medication issues', type: 'radio', options: YNU, col: 6 },
        { id: 'med_notes', label: 'Medication reconciliation notes', type: 'textarea', col: 12 }
      ]
    },

    /* 14 ----------------------------------------------------------------- */
    {
      id: 'services',
      title: 'Skilled Services, Equipment & Frequency',
      icon: '14',
      fields: [
        { id: 'disciplines', label: 'Disciplines to be ordered', type: 'checks', col: 12, options: [
          'Skilled nursing (SN)', 'Physical therapy (PT)', 'Occupational therapy (OT)', 'Speech therapy (ST)', 'Medical social worker (MSW)', 'Home health aide (HHA)'
        ] },
        { id: 'sn_frequency', label: 'SN visit frequency', type: 'text', col: 6, placeholder: 'e.g. 2w1, 1w3 then 1w2 x 4 wks' },
        { id: 'therapy_frequency', label: 'Therapy frequency', type: 'text', col: 6, placeholder: 'e.g. PT 2w4, OT eval and treat' },
        { id: 'aide_frequency', label: 'Aide frequency / tasks', type: 'text', col: 12 },
        { id: 'skilled_services', label: 'Skilled interventions required', type: 'checks', col: 12, options: [
          'Comprehensive assessment / observation', 'Medication management and teaching', 'Wound care', 'Injections', 'Catheter care', 'Ostomy care', 'IV / infusion therapy', 'Enteral feeding management', 'Disease process teaching', 'Diabetic management and teaching', 'Cardiac / respiratory monitoring', 'Pain management', 'Venipuncture / lab draws'
        ] },
        { id: 'dme_current', label: 'DME / supplies in the home', type: 'checks', col: 12, options: [
          'None', 'Hospital bed', 'Wheelchair', 'Walker / rollator', 'Cane', 'Bedside commode', 'Shower chair / tub bench', 'Grab bars', 'Oxygen concentrator', 'Nebulizer', 'CPAP / BiPAP', 'Glucometer', 'Blood pressure cuff', 'Scale', 'Mechanical lift', 'Wound care supplies'
        ] },
        { id: 'dme_needed', label: 'DME / supplies needed (to be ordered)', type: 'text', col: 12 },
        { id: 'labs_ordered', label: 'Labs / diagnostics ordered', type: 'text', col: 12 },
        { id: 'safety_measures_extra', label: 'Additional safety measures ordered', type: 'text', col: 12 }
      ]
    },

    /* 15 ----------------------------------------------------------------- */
    {
      id: 'psychosocial',
      title: 'Psychosocial, Goals & Discharge Planning',
      icon: '15',
      fields: [
        { id: 'psychosocial_factors', label: 'Psychosocial / social determinants', type: 'checks', col: 12, options: [
          'None identified', 'Financial strain', 'Food insecurity', 'Transportation barrier', 'Social isolation', 'Caregiver strain', 'Recent loss / grief', 'Housing instability', 'Suspected abuse or neglect', 'Substance use concern', 'Health literacy barrier', 'Language barrier'
        ] },
        { id: 'immunizations', label: 'Immunization status', type: 'checks', col: 12, options: ['Influenza current', 'Pneumococcal up to date', 'COVID-19 up to date', 'Tdap up to date', 'Declined', 'Unknown'] },
        { id: 'patient_goals', label: 'Patient-stated goals (in the patient\'s own words)', type: 'textarea', col: 12, placeholder: 'e.g. "I want to walk to the mailbox again and stay out of the hospital."' },
        { id: 'caregiver_goals', label: 'Caregiver / family goals and learning needs', type: 'textarea', col: 12 },
        { id: 'prognosis', label: 'Rehabilitation prognosis', type: 'select', col: 6, options: ['Excellent', 'Good', 'Fair', 'Guarded', 'Poor'] },
        { id: 'risk_rehosp', label: 'Risk factors for hospitalization', type: 'checks', col: 12, options: [
          'None', 'Recent decline in mental / emotional / behavioral status', 'Multiple hospitalizations in past 6 months', 'History of falls', 'Taking 5 or more medications', 'Currently reports exhaustion', 'Other unhealthy behaviors', 'Frailty indicators'
        ] },
        { id: 'discharge_plan', label: 'Anticipated discharge plan', type: 'select', col: 6, options: ['Return to prior level of function; self / caregiver manages care', 'Discharge to caregiver management', 'Transfer to community services / LTC waiver', 'Long-term custodial placement anticipated', 'Hospice referral anticipated'] },
        { id: 'cert_period_weeks', label: 'Certification period (weeks)', type: 'number', col: 4, default: '9' },
        { id: 'poc_notes', label: 'Additional orders or clinician notes for the plan of care', type: 'textarea', col: 12 }
      ]
    }
  ];

  /* ---------- scoring ---------- */
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; }
  function lead(v) { // leading integer of an option like "25 - Yes"
    if (!v) return 0;
    var m = String(v).match(/^\s*(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function bmi(d) {
    var w = num(d.vs_weight), h = num(d.vs_height);
    if (!w || !h) return { value: '', text: '-' };
    var v = (703 * w) / (h * h);
    var cat = v < 18.5 ? 'underweight' : v < 25 ? 'normal' : v < 30 ? 'overweight' : 'obese';
    var out = { value: v.toFixed(1), text: v.toFixed(1) + ' (' + cat + ')' };
    if (v < 18.5 || v >= 30) { out.level = 'moderate'; out.tag = 'out of range'; }
    return out;
  }

  function braden(d) {
    var keys = ['braden_sensory', 'braden_moisture', 'braden_activity', 'braden_mobility', 'braden_nutrition', 'braden_friction'];
    var answered = 0, total = 0;
    keys.forEach(function (k) { if (d[k]) { answered++; total += lead(d[k]); } });
    if (answered < keys.length) return { value: total, text: total ? total + ' (incomplete - ' + answered + '/6 answered)' : '-', level: 'low', complete: false };
    var risk = total <= 9 ? 'Very high risk' : total <= 12 ? 'High risk' : total <= 14 ? 'Moderate risk' : total <= 18 ? 'Mild risk' : 'No risk';
    var level = total <= 12 ? 'high' : total <= 18 ? 'moderate' : 'low';
    return { value: total, text: total + ' - ' + risk, risk: risk, level: level, complete: true };
  }

  function morse(d) {
    var keys = ['morse_history', 'morse_secondary', 'morse_aid', 'morse_iv', 'morse_gait', 'morse_mental'];
    var answered = 0, total = 0;
    keys.forEach(function (k) { if (d[k]) { answered++; total += lead(d[k]); } });
    var risk = total >= 45 ? 'High risk' : total >= 25 ? 'Moderate risk' : 'Low risk';
    var level = total >= 45 ? 'high' : total >= 25 ? 'moderate' : 'low';
    return {
      value: total,
      text: total + ' - ' + risk + (answered < keys.length ? ' (' + answered + '/6 answered)' : ''),
      risk: risk, level: level, complete: answered === keys.length
    };
  }

  function phq2(d) {
    if (!d.phq_interest && !d.phq_down) return { value: 0, text: '-', level: 'low', positive: false };
    var total = lead(d.phq_interest) + lead(d.phq_down);
    var pos = total >= 3;
    return {
      value: total,
      text: total + ' - ' + (pos ? 'Positive screen; further evaluation indicated' : 'Negative screen'),
      level: pos ? 'moderate' : 'low',
      positive: pos
    };
  }

  var COMPUTERS = { bmi: bmi, braden: braden, morse: morse, phq2: phq2 };

  function scores(d) {
    return { bmi: bmi(d), braden: braden(d), morse: morse(d), phq2: phq2(d) };
  }

  /* ---------- helpers used by the engine and UI ---------- */
  function fieldById(id) {
    for (var i = 0; i < SECTIONS.length; i++) {
      var f = SECTIONS[i].fields;
      for (var j = 0; j < f.length; j++) if (f[j].id === id) return f[j];
    }
    return null;
  }

  function visible(field, d) {
    if (!field.showIf) return true;
    for (var k in field.showIf) {
      var want = field.showIf[k], have = d[k];
      if (Array.isArray(want)) { if (want.indexOf(have) === -1) return false; }
      else if (have !== want) return false;
    }
    return true;
  }

  root.LTC_SCHEMA = {
    SECTIONS: SECTIONS,
    ADL_LEVELS: ADL_LEVELS,
    IADL_LEVELS: IADL_LEVELS,
    COMPUTERS: COMPUTERS,
    scores: scores,
    fieldById: fieldById,
    visible: visible,
    num: num,
    lead: lead
  };
})(window);
