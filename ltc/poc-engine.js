/* =========================================================================
   Plan of Care engine
   Turns the completed LTC nurse assessment into a personalized plan of care:
   problem list, measurable goals, interventions, disciplines, frequency,
   safety measures and a Start of Care narrative note.

   Every rule is data: {id, when(ctx) -> bool, problem, priority, disciplines,
   goals[], interventions[]}.  Goals and interventions accept ${...}-free
   plain strings or functions of ctx so they can quote the patient's own data.
   ========================================================================= */
(function (root) {
  'use strict';

  var S = root.LTC_SCHEMA;

  /* ---------- small helpers over the answer set ---------- */
  function ctxOf(d) {
    var sc = S.scores(d);
    var checks = function (id) { var v = d[id]; return Array.isArray(v) ? v : (v ? [v] : []); };
    var has = function (id, opt) { return checks(id).indexOf(opt) !== -1; };
    var hasAny = function (id, opts) { return opts.some(function (o) { return has(id, o); }); };
    var dxText = ((d.dx_primary || '') + ' ' + (d.dx_secondary || '')).toLowerCase();
    var dx = function () {
      var words = Array.prototype.slice.call(arguments);
      return words.some(function (w) { return dxText.indexOf(w) !== -1; });
    };
    // ADL level as a number 0-6 (6 = not attempted)
    var adl = function (id) { return S.lead(d[id]); };
    var adlAnswered = function (id) { return !!d[id]; };
    var maxAdl = function () {
      var ids = ['adl_grooming', 'adl_bath', 'adl_dress_upper', 'adl_dress_lower', 'adl_toilet', 'adl_transfer', 'adl_ambulation', 'adl_feeding'];
      return ids.reduce(function (m, id) { return Math.max(m, adlAnswered(id) ? adl(id) : 0); }, 0);
    };
    var dependentAdls = function () {
      var ids = [
        ['adl_grooming', 'grooming'], ['adl_bath', 'bathing'], ['adl_dress_upper', 'upper body dressing'],
        ['adl_dress_lower', 'lower body dressing'], ['adl_toilet', 'toileting'], ['adl_transfer', 'transfers'],
        ['adl_ambulation', 'ambulation'], ['adl_feeding', 'eating']
      ];
      return ids.filter(function (p) { return adl(p[0]) >= 3; }).map(function (p) { return p[1]; });
    };
    return {
      d: d, sc: sc, checks: checks, has: has, hasAny: hasAny, dx: dx,
      adl: adl, maxAdl: maxAdl, dependentAdls: dependentAdls,
      num: S.num, lead: S.lead,
      livesAlone: d.living_arrangement === 'Lives alone',
      noCaregiver: d.caregiver_ability === 'No caregiver identified' || d.caregiver_ability === 'Unwilling / unavailable' || d.assistance_available === 'No assistance available'
    };
  }

  function ptName(d) {
    var n = [d.pt_first, d.pt_last].filter(Boolean).join(' ');
    return n || 'the patient';
  }

  /* ---------- the rule set ---------- */
  /* priority: 1 = highest.  Duplicated disciplines are de-duplicated later. */
  var RULES = [

    /* --- always-on core --- */
    {
      id: 'core_assessment',
      always: true,
      priority: 1,
      problem: 'Need for skilled observation and assessment of an unstable or complex condition',
      disciplines: ['SN'],
      goals: [
        function (c) { return 'Patient will remain medically stable, without unplanned emergency department visit or hospitalization, through the certification period.'; },
        'Patient or caregiver will verbalize which signs and symptoms require a call to the agency or physician by visit 3.'
      ],
      interventions: [
        'SN to perform comprehensive head-to-toe assessment each visit, including vital signs, pain, weight trend and functional change.',
        function (c) {
          var p = c.d;
          var parts = [];
          if (p.param_sbp_hi || p.param_sbp_lo) parts.push('SBP >' + (p.param_sbp_hi || '160') + ' or <' + (p.param_sbp_lo || '90'));
          if (p.param_hr_hi || p.param_hr_lo) parts.push('HR >' + (p.param_hr_hi || '110') + ' or <' + (p.param_hr_lo || '55'));
          if (p.param_temp) parts.push('temp >' + p.param_temp + 'F');
          if (p.param_o2) parts.push('SpO2 <' + p.param_o2 + '%');
          if (p.param_glucose_hi || p.param_glucose_lo) parts.push('glucose >' + (p.param_glucose_hi || '300') + ' or <' + (p.param_glucose_lo || '70'));
          if (p.param_weight) parts.push('weight gain >' + p.param_weight + ' lb in one week');
          if (p.param_other) parts.push(p.param_other);
          return 'Notify physician for: ' + (parts.length ? parts.join('; ') : 'any significant change in condition') + '.';
        },
        'Instruct patient and caregiver on the agency 24-hour on-call number and when to call 911.',
        'Coordinate care with the physician and report changes in condition, new orders and response to treatment.'
      ]
    },

    /* --- falls --- */
    {
      id: 'falls',
      when: function (c) { return c.sc.morse.value >= 25 || c.d.fall_injury === 'Yes' || (c.num(c.d.falls_number) || 0) >= 1 || c.d.gait_quality === 'Unsteady even with device' || c.d.gait_quality === 'Unsteady - requires device'; },
      priority: 1,
      problem: 'Risk for falls related to impaired gait, balance and medication effects',
      disciplines: ['SN', 'PT'],
      goals: [
        'Patient will remain free of falls and fall-related injury through the certification period.',
        'Patient or caregiver will demonstrate three fall-prevention measures in the home by visit 4.',
        'Patient will demonstrate safe and consistent use of the prescribed assistive device by visit 4.'
      ],
      interventions: [
        function (c) { return 'SN to assess fall risk each visit (Morse Fall Scale ' + c.sc.morse.value + ' - ' + c.sc.morse.risk + ') and reassess after any fall or change in medications.'; },
        'Instruct on removing throw rugs and clutter, improving lighting, wearing non-skid footwear and using nightlights on the path to the bathroom.',
        'Instruct on rising slowly from bed and chair to avoid orthostatic dizziness.',
        'Refer to PT for gait, balance, strengthening and assistive device training.',
        'Review medications contributing to fall risk (sedatives, antihypertensives, hypoglycemics, anticholinergics) and report concerns to the physician.',
        'Instruct patient and caregiver to report any fall to the agency immediately, whether or not injury occurred.'
      ]
    },

    /* --- pressure injury risk --- */
    {
      id: 'skin_risk',
      when: function (c) { return c.sc.braden.complete && c.sc.braden.value <= 18; },
      priority: 2,
      problem: 'Risk for impaired skin integrity related to reduced mobility, moisture and nutritional status',
      disciplines: ['SN'],
      goals: [
        'Patient skin will remain intact, with no new pressure injury through the certification period.',
        'Caregiver will demonstrate correct repositioning and pressure-relief technique by visit 3.'
      ],
      interventions: [
        function (c) { return 'SN to complete full skin inspection every visit, with attention to bony prominences (Braden ' + c.sc.braden.value + ' - ' + c.sc.braden.risk + ').'; },
        'Instruct on repositioning at least every 2 hours in bed and every hour in chair; use pillows to offload heels and bony prominences.',
        'Instruct on keeping skin clean and dry, applying moisture barrier after incontinence episodes and using pH-balanced cleanser.',
        'Instruct on pressure-redistribution surface for bed and chair; obtain physician order for appropriate support surface if indicated.',
        'Encourage adequate protein, calorie and fluid intake to support skin integrity.'
      ]
    },

    /* --- active wound --- */
    {
      id: 'wound',
      when: function (c) { return c.d.wound_present === 'Yes'; },
      priority: 1,
      problem: 'Impaired skin integrity - wound requiring skilled care',
      disciplines: ['SN'],
      goals: [
        'Wound will show measurable progress toward healing (decrease in size, depth or drainage) at each reassessment.',
        'Wound will remain free of clinical infection through the certification period.',
        'Patient or caregiver will demonstrate correct dressing change technique and infection signs by visit 4 if the caregiver is to perform care between visits.'
      ],
      interventions: [
        function (c) { return 'Perform wound care per physician order: ' + (c.d.wound_orders ? c.d.wound_orders.replace(/\s+/g, ' ').trim() : '[obtain and transcribe physician wound care order]') + '.'; },
        'Measure wound length, width, depth and undermining weekly; document tissue type, exudate amount and character, odor and periwound condition.',
        'Assess for signs of infection each visit: increased erythema, warmth, purulent drainage, odor, increased pain, fever; report promptly to physician.',
        'Instruct patient and caregiver on clean technique, dressing supply handling and safe disposal of soiled dressings.',
        'Instruct on offloading and pressure relief to the wound area.',
        'Report failure to progress within 2 weeks to the physician and request wound care consultation.'
      ]
    },

    /* --- pain --- */
    {
      id: 'pain',
      when: function (c) { return c.d.pain_present === 'Yes' && ((c.num(c.d.pain_score) || 0) >= 4 || (c.num(c.d.pain_worst) || 0) >= 5 || c.d.pain_effect === 'Yes'); },
      priority: 2,
      problem: 'Pain interfering with function, sleep and participation in care',
      disciplines: ['SN'],
      goals: [
        function (c) {
          var cur = c.num(c.d.pain_score);
          var target = cur != null ? Math.max(0, Math.min(3, cur - 2)) : 3;
          return 'Patient will report pain at or below ' + target + '/10, at a level that allows participation in ADLs and sleep, within 3 weeks.';
        },
        'Patient or caregiver will verbalize the prescribed pain regimen, including non-drug measures, by visit 3.'
      ],
      interventions: [
        function (c) { return 'Assess pain each visit using the ' + (c.d.pain_scale_used || 'numeric 0-10') + ' scale, including location, quality, timing and effect on function.'; },
        'Instruct on scheduled versus as-needed dosing and on taking analgesic before painful activity rather than after pain escalates.',
        'Instruct on non-pharmacologic measures: positioning, heat or cold as ordered, pacing, relaxation and activity modification.',
        'Monitor for analgesic side effects, particularly constipation, sedation and confusion; instruct on a bowel regimen when opioids are prescribed.',
        'Report uncontrolled pain or new pain pattern to the physician for regimen adjustment.'
      ]
    },

    /* --- medication management --- */
    {
      id: 'meds',
      when: function (c) {
        return (c.num(c.d.med_count) || 0) >= 5
          || (c.checks('med_issues').length && !c.has('med_issues', 'None identified'))
          || (c.checks('med_classes').length && !c.has('med_classes', 'None'))
          || c.d.iadl_meds === 'Needs assistance' || c.d.iadl_meds === 'Dependent';
      },
      priority: 1,
      problem: 'Knowledge deficit and safety risk related to a complex medication regimen (polypharmacy)',
      disciplines: ['SN'],
      goals: [
        'Patient or caregiver will state the name, purpose, dose and time of each medication, and two side effects to report, by visit 4.',
        'Patient will take medications as prescribed, with no missed or duplicated doses reported, by the end of the certification period.'
      ],
      interventions: [
        'Perform medication reconciliation at start of care and after every hospitalization, physician visit or new order; review all prescription, over-the-counter and herbal products in the home.',
        'Assess for duplicate therapy, drug-drug interactions, doses outside safe range and medications without a matching diagnosis; report findings to the physician.',
        function (c) { return 'Set up and instruct on use of a weekly pill organizer' + (c.d.med_organizer === 'Yes' ? '; verify accurate fill each visit.' : ' to support adherence.'); },
        'Instruct on safe medication storage and disposal of expired or discontinued medications.',
        'Assess adherence each visit using pill counts and patient report; identify and address barriers including cost, literacy and dexterity.'
      ]
    },
    {
      id: 'anticoag',
      when: function (c) { return c.has('med_classes', 'Anticoagulant / antiplatelet'); },
      priority: 1,
      problem: 'Risk for bleeding related to anticoagulant or antiplatelet therapy',
      disciplines: ['SN'],
      goals: ['Patient will remain free of clinically significant bleeding events through the certification period.',
        'Patient or caregiver will verbalize bleeding precautions and signs of bleeding to report by visit 3.'],
      interventions: [
        'Assess each visit for bruising, bleeding gums, epistaxis, hematuria, melena, and new or worsening headache or confusion.',
        'Instruct on bleeding precautions: soft toothbrush, electric razor, avoid NSAIDs unless approved, prevent falls and report any head injury immediately.',
        'Instruct on dietary consistency and drug interactions relevant to the prescribed anticoagulant; reinforce lab monitoring schedule.',
        'Coordinate INR or other ordered lab draws and report results to the physician for dosage adjustment.'
      ]
    },
    {
      id: 'hypoglycemia',
      when: function (c) { return c.hasAny('med_classes', ['Insulin', 'Oral hypoglycemic']); },
      priority: 1,
      problem: 'Risk for hypoglycemia and hyperglycemia related to antidiabetic therapy',
      disciplines: ['SN'],
      goals: [
        'Patient will maintain blood glucose within physician-ordered parameters, without emergency treatment for hypo- or hyperglycemia, through the certification period.',
        'Patient or caregiver will demonstrate accurate glucose monitoring and correct treatment of hypoglycemia by visit 4.'
      ],
      interventions: [
        'Instruct on signs of hypoglycemia (shakiness, sweating, confusion, hunger) and the 15-15 rule for treatment; ensure a fast-acting carbohydrate source is available in the home.',
        'Observe return demonstration of glucometer use, and of insulin preparation, injection technique and site rotation when insulin is prescribed.',
        'Instruct on sick-day management and on the relationship between meals, activity and glucose.',
        'Review glucose log each visit and report readings outside ordered parameters to the physician.',
        'Instruct on safe sharps disposal.'
      ]
    },

    /* --- disease-specific --- */
    {
      id: 'chf',
      when: function (c) { return c.dx('heart failure', 'chf', 'chronic systolic', 'chronic diastolic', 'cardiomyopathy') || c.d.weight_gain === 'Yes' || (c.has('cardiac_findings', 'Peripheral edema') && c.has('resp_findings', 'Dyspnea on exertion')); },
      priority: 1,
      problem: 'Excess fluid volume related to cardiac dysfunction',
      disciplines: ['SN'],
      goals: [
        'Patient will remain free of signs of fluid overload (no increase in edema, no weight gain beyond ordered parameters, no orthopnea) through the certification period.',
        'Patient or caregiver will demonstrate daily weight monitoring and verbalize the weight change that requires a call by visit 3.'
      ],
      interventions: [
        'Assess each visit for edema, jugular venous distention, lung sounds, orthopnea, activity tolerance and weight trend.',
        function (c) { return 'Instruct on daily weights: same time each morning, after voiding, before breakfast, in similar clothing; report gain of ' + (c.d.param_weight || '5') + ' lb in one week or 3 lb in one day.'; },
        'Instruct on sodium restriction and fluid guidance as ordered, including reading food labels and avoiding processed foods.',
        'Instruct on diuretic therapy, timing of doses and signs of dehydration or electrolyte imbalance.',
        'Instruct on energy conservation and gradual activity progression as tolerated.'
      ]
    },
    {
      id: 'copd',
      when: function (c) { return c.dx('copd', 'emphysema', 'chronic bronchitis', 'asthma', 'pulmonary fibrosis') || c.d.vs_o2_therapy === 'Yes' || c.hasAny('resp_findings', ['Dyspnea at rest', 'Wheezing', 'Uses inhalers / nebulizer']); },
      priority: 2,
      problem: 'Impaired gas exchange / ineffective breathing pattern',
      disciplines: ['SN'],
      goals: [
        function (c) { return 'Patient will maintain SpO2 at or above ' + (c.d.param_o2 || '90') + '% and report breathing adequate for ADLs through the certification period.'; },
        'Patient will demonstrate pursed-lip breathing and correct inhaler or nebulizer technique by visit 3.'
      ],
      interventions: [
        'Assess respiratory rate, effort, breath sounds, oxygen saturation and sputum characteristics each visit.',
        'Instruct on pursed-lip and diaphragmatic breathing, controlled coughing and energy conservation techniques.',
        'Observe return demonstration of inhaler, spacer and nebulizer use, including rinsing the mouth after steroid inhalers.',
        'Instruct on early signs of respiratory infection or exacerbation and when to call the physician.',
        'Reinforce oxygen safety: no smoking or open flame in the home, secure tubing, keep concentrator away from heat sources, and maintain backup supply.',
        'Reinforce smoking cessation and offer resources when applicable.'
      ]
    },
    {
      id: 'diabetes',
      when: function (c) { return c.dx('diabetes', 'dm2', 'type 2 diabetes', 'type 1 diabetes', 'hyperglycemia'); },
      priority: 2,
      problem: 'Ineffective glycemic management related to knowledge deficit of the diabetic regimen',
      disciplines: ['SN'],
      goals: [
        'Patient or caregiver will verbalize the prescribed diabetic diet, medication regimen and monitoring schedule by visit 4.',
        'Patient will demonstrate daily foot inspection technique by visit 3.'
      ],
      interventions: [
        'Instruct on the diabetic diet, carbohydrate consistency and meal timing in relation to medication.',
        'Perform and instruct on daily foot inspection; assess for neuropathy, skin breakdown, nail condition and appropriate footwear each visit.',
        'Instruct on long-term complications and the importance of glycemic control, ophthalmology and podiatry follow-up.',
        'Review glucose log and A1C results with the patient; coordinate with the physician for regimen adjustment.'
      ]
    },
    {
      id: 'catheter',
      when: function (c) { return ['Indwelling catheter', 'Intermittent catheterization', 'Suprapubic catheter'].indexOf(c.d.urinary_status) !== -1; },
      priority: 2,
      problem: 'Risk for catheter-associated urinary tract infection',
      disciplines: ['SN'],
      goals: [
        'Patient will remain free of catheter-associated urinary tract infection through the certification period.',
        'Patient or caregiver will demonstrate catheter and drainage bag care by visit 3.'
      ],
      interventions: [
        function (c) { return 'Provide catheter care and change per physician order' + (c.d.catheter_detail ? ' (' + c.d.catheter_detail.replace(/\s+/g, ' ').trim() + ')' : '') + '; maintain a closed drainage system.'; },
        'Assess urine color, clarity, odor and output each visit; assess for suprapubic pain, fever, chills or new confusion.',
        'Instruct on keeping the drainage bag below bladder level, securing tubing to prevent traction, and daily perineal hygiene.',
        'Encourage fluid intake as permitted by the plan of care to promote urinary flow.'
      ]
    },
    {
      id: 'uti',
      when: function (c) { return c.d.uti_signs === 'Yes'; },
      priority: 1,
      problem: 'Actual or suspected urinary tract infection',
      disciplines: ['SN'],
      goals: ['Signs and symptoms of urinary infection will resolve within 2 weeks, verified by clinical assessment or physician follow-up.'],
      interventions: [
        'Notify physician of urinary symptoms; obtain order for urinalysis and culture as indicated.',
        'Monitor temperature, mental status changes and urinary symptoms each visit.',
        'Instruct on completing the full antibiotic course, hydration and perineal hygiene.'
      ]
    },
    {
      id: 'incontinence',
      when: function (c) { return ['Occasional incontinence', 'Frequent / total incontinence'].indexOf(c.d.urinary_status) !== -1 || ['Occasional incontinence', 'Frequent incontinence'].indexOf(c.d.bowel_incont) !== -1; },
      priority: 3,
      problem: 'Impaired elimination with risk for incontinence-associated dermatitis',
      disciplines: ['SN'],
      goals: [
        'Perineal skin will remain intact and free of excoriation through the certification period.',
        'Patient or caregiver will verbalize a toileting schedule and skin protection routine by visit 3.'
      ],
      interventions: [
        'Instruct on a timed toileting schedule and on prompt cleansing after each incontinence episode.',
        'Instruct on use of pH-balanced cleanser and moisture barrier ointment; avoid harsh soaps and vigorous rubbing.',
        'Assess perineal and sacral skin each visit for redness, maceration or breakdown.',
        'Ensure clear, well-lit, unobstructed path to the bathroom and consider bedside commode if mobility is limited.'
      ]
    },
    {
      id: 'constipation',
      when: function (c) { return c.d.bowel_pattern === 'Constipation' || c.has('med_classes', 'Opioid analgesic'); },
      priority: 3,
      problem: 'Constipation related to immobility, medication effect and reduced fluid or fiber intake',
      disciplines: ['SN'],
      goals: ['Patient will have a soft, formed bowel movement at least every 3 days without straining, by the end of week 2.'],
      interventions: [
        'Monitor and document bowel pattern each visit; instruct patient or caregiver to keep a bowel record.',
        'Instruct on increasing dietary fiber and fluids within any ordered restrictions, and on activity to promote motility.',
        'Instruct on the ordered bowel regimen; obtain orders for a stimulant laxative and stool softener when opioids are prescribed.',
        'Report no bowel movement in 3 days, abdominal distention or vomiting to the physician.'
      ]
    },
    {
      id: 'nutrition',
      when: function (c) { return c.d.weight_loss === 'Yes' || ['Poor - eats less than half', 'Minimal / refuses'].indexOf(c.d.appetite) !== -1 || c.d.hydration === 'Signs of dehydration' || c.d.food_access === 'No' || (c.sc.bmi.value && parseFloat(c.sc.bmi.value) < 18.5); },
      priority: 2,
      problem: 'Imbalanced nutrition: less than body requirements',
      disciplines: ['SN'],
      goals: [
        'Patient will maintain or gain weight, with no further unintentional loss, through the certification period.',
        'Patient or caregiver will verbalize three strategies to increase caloric and protein intake by visit 3.'
      ],
      interventions: [
        'Weigh patient weekly and record trend; report continued loss to the physician.',
        'Assess intake pattern, food preferences, chewing and swallowing ability, and barriers to obtaining or preparing food.',
        'Instruct on small frequent nutrient-dense meals, protein at every meal and oral supplements if ordered.',
        'Encourage fluids within ordered restrictions and monitor for signs of dehydration.',
        'Refer to MSW for community nutrition resources when access or cost is a barrier.'
      ]
    },
    {
      id: 'dysphagia',
      when: function (c) { return ['Difficulty with thin liquids', 'Difficulty with solids', 'Coughing / choking with meals'].indexOf(c.d.swallowing) !== -1; },
      priority: 1,
      problem: 'Impaired swallowing with risk for aspiration',
      disciplines: ['SN', 'ST'],
      goals: [
        'Patient will remain free of aspiration and aspiration pneumonia through the certification period.',
        'Patient or caregiver will demonstrate aspiration precautions at every meal by visit 3.'
      ],
      interventions: [
        'Refer to speech therapy for swallowing evaluation and diet texture recommendations.',
        'Instruct on aspiration precautions: upright 90 degrees during meals and 30-45 minutes after, small bites, slow pace, chin tuck as recommended, no straws if contraindicated.',
        'Instruct on oral care before and after meals to reduce bacterial load.',
        'Monitor for coughing or wet vocal quality with meals, low-grade fever and changes in breath sounds; report to physician.'
      ]
    },
    {
      id: 'cognition',
      when: function (c) { return c.d.dementia_dx === 'Yes' || c.d.memory_deficit === 'Yes' || ['Requires assistance and direction in routine situations', 'Requires considerable assistance in routine situations', 'Totally dependent / cannot direct care'].indexOf(c.d.cognitive_function) !== -1 || ['During the day but not constantly', 'Constantly', 'On awakening or at night only (sundowning)'].indexOf(c.d.confusion_freq) !== -1; },
      priority: 1,
      problem: 'Impaired cognition affecting safety and the ability to self-direct care',
      disciplines: ['SN', 'MSW'],
      goals: [
        'Patient will remain free from injury related to cognitive impairment through the certification period.',
        'Caregiver will verbalize and demonstrate supervision, cueing and communication strategies by visit 4.'
      ],
      interventions: [
        'Assess cognition, orientation and behavior each visit; report acute change in mental status to the physician as it may indicate infection, dehydration or medication effect.',
        'Direct all teaching to the caregiver as the responsible party, and reinforce with written material and simple written schedules.',
        'Instruct caregiver on environmental supports: consistent routine, reduced clutter and noise, visible clocks and calendars, adequate lighting.',
        'Instruct caregiver on securing medications, chemicals, sharp objects, car keys and firearms.',
        function (c) { return c.has('behaviors', 'Wandering / elopement risk') ? 'Instruct caregiver on wandering precautions: door alarms, secured exits, identification bracelet and enrollment in a safe-return program.' : 'Instruct caregiver on redirection and de-escalation techniques rather than confrontation.'; },
        'Refer to MSW for caregiver support, community resources and long-term care planning.'
      ]
    },
    {
      id: 'depression',
      when: function (c) { return c.sc.phq2.positive || c.d.suicidal_ideation === 'Yes'; },
      priority: 1,
      problem: 'Risk for depression affecting recovery and adherence to the plan of care',
      disciplines: ['SN', 'MSW'],
      goals: [
        'Patient will report improved mood and engagement in the plan of care, with a PHQ-2 score below 3, within 4 weeks.',
        'Patient will remain safe, without self-harm, through the certification period.'
      ],
      interventions: [
        function (c) { return 'Positive PHQ-2 screen (score ' + c.sc.phq2.value + '); notify physician and request further evaluation with a full depression assessment.'; },
        'Assess mood, sleep, appetite, energy and any expression of hopelessness or self-harm each visit.',
        'Refer to medical social worker for counseling, community resources and coordination of behavioral health follow-up.',
        'Encourage participation in meaningful activity and social contact; involve family and faith or community supports as the patient wishes.',
        'If medication is prescribed for mood, instruct on adherence, expected time to effect and side effects to report.'
      ],
      urgent: function (c) { return c.d.suicidal_ideation === 'Yes' ? 'Patient expressed thoughts of self-harm - implement agency safety protocol, notify physician immediately, and do not leave the patient unsafe or unattended.' : null; }
    },
    {
      id: 'mobility',
      when: function (c) { return c.adl('adl_ambulation') >= 2 || c.adl('adl_transfer') >= 2 || ['Unsteady - requires device', 'Unsteady even with device', 'Unable to ambulate'].indexOf(c.d.gait_quality) !== -1 || ['Tires with minimal activity', 'Requires frequent rest periods', 'Bed / chair bound'].indexOf(c.d.endurance) !== -1; },
      priority: 2,
      problem: 'Impaired physical mobility and activity intolerance',
      disciplines: ['SN', 'PT'],
      goals: [
        'Patient will transfer and ambulate safely with the least restrictive assistive device and no more than supervision, within 6 weeks.',
        'Patient will increase ambulation distance sufficient to complete household activities without excessive fatigue, within 6 weeks.'
      ],
      interventions: [
        'Refer to physical therapy for evaluation, therapeutic exercise, gait training and assistive device instruction.',
        'Instruct on a home exercise program as established by therapy and reinforce at each nursing visit.',
        'Instruct on safe transfer technique and correct assistive device height and use.',
        'Instruct on energy conservation and pacing: sit for tasks, alternate activity with rest, organize supplies within reach.'
      ]
    },
    {
      id: 'selfcare',
      when: function (c) { return c.maxAdl() >= 3; },
      priority: 2,
      problem: 'Self-care deficit in activities of daily living',
      disciplines: ['SN', 'OT', 'HHA'],
      goals: [
        function (c) {
          var list = c.dependentAdls();
          return 'Patient will participate in ' + (list.length ? list.slice(0, 3).join(', ') : 'personal care') + ' with no more than supervision or setup assistance, or with adaptive equipment, within 6 weeks.';
        },
        'Caregiver will demonstrate safe assistance with personal care and transfers by visit 4.'
      ],
      interventions: [
        'Refer to occupational therapy for ADL retraining, adaptive equipment evaluation and energy conservation.',
        'Refer to home health aide for assistance with personal care per the written aide plan; supervise aide per agency policy and regulation.',
        'Instruct caregiver on safe body mechanics and assistance techniques to prevent injury to patient and caregiver.',
        'Assess for adaptive equipment needs: shower chair, long-handled sponge, reacher, sock aid, raised toilet seat, grab bars.'
      ]
    },
    {
      id: 'caregiver_gap',
      when: function (c) { return c.noCaregiver || (c.livesAlone && c.maxAdl() >= 3) || c.d.caregiver_ability === 'Limited by own health' || c.d.caregiver_ability === 'Willing but needs training'; },
      priority: 1,
      problem: 'Inadequate caregiver support for the current level of care needs',
      disciplines: ['SN', 'MSW'],
      goals: [
        'A sustainable caregiving plan will be established, with identified providers for all care the patient cannot perform, within 3 weeks.',
        'Caregiver will verbalize confidence in providing required care and will identify respite options by visit 5.'
      ],
      interventions: [
        'Refer to medical social worker to evaluate caregiver capacity and to arrange community, waiver or private-duty resources.',
        'Assess caregiver strain each visit and provide teaching in short, repeated segments with written reinforcement.',
        'Instruct on emergency response options: personal emergency response system, daily check-in call, neighbor or family contact.',
        'Coordinate meal delivery, transportation and homemaker services as available.'
      ]
    },
    {
      id: 'home_safety',
      when: function (c) { var h = c.checks('home_hazards'); return (h.length && !c.has('home_hazards', 'None identified')) || c.d.home_utilities === 'No'; },
      priority: 2,
      problem: 'Environmental hazards in the home increasing risk for injury',
      disciplines: ['SN'],
      goals: ['Identified home hazards will be corrected or mitigated, verified by clinician observation, within 3 weeks.'],
      interventions: [
        function (c) {
          var h = c.checks('home_hazards').filter(function (x) { return x !== 'None identified'; });
          return 'Instruct patient and caregiver on correcting identified hazards: ' + (h.join('; ') || 'as observed in the home') + '.';
        },
        'Verify working smoke detectors and carbon monoxide detectors; instruct on a fire escape plan.',
        'Reassess the home environment each visit and document correction of hazards.'
      ]
    },
    {
      id: 'emergency_prep',
      when: function (c) { return c.d.emerg_plan === 'No' || (c.d.vs_o2_therapy === 'Yes') || c.d.dialysis === 'Hemodialysis' || c.d.dialysis === 'Peritoneal'; },
      priority: 3,
      problem: 'Lack of an emergency preparedness plan for a patient dependent on care or equipment',
      disciplines: ['SN'],
      goals: ['Patient or caregiver will verbalize the emergency and evacuation plan, including backup power and supply plan, by visit 3.'],
      interventions: [
        function (c) { return 'Establish and document emergency triage level' + (c.d.emerg_triage ? ' (' + c.d.emerg_triage + ')' : '') + ' and review with patient and caregiver.'; },
        'Instruct on maintaining an emergency supply of medications, water, food and required supplies.',
        'Notify the utility company and register the patient for priority restoration when the patient depends on electrically powered equipment.',
        'Provide agency emergency contact information and instruct on the plan for severe weather or evacuation.'
      ]
    },
    {
      id: 'rehosp',
      when: function (c) { return c.d.ref_hosp_discharge === 'Yes' || c.hasAny('risk_rehosp', ['Multiple hospitalizations in past 6 months', 'Recent decline in mental / emotional / behavioral status', 'Frailty indicators']); },
      priority: 1,
      problem: 'Risk for avoidable rehospitalization',
      disciplines: ['SN'],
      goals: [
        'Patient will remain in the home setting without unplanned hospital readmission through the certification period.',
        'Patient or caregiver will demonstrate use of a zone tool (green / yellow / red) to identify and act on early warning signs by visit 3.'
      ],
      interventions: [
        'Complete post-hospital medication reconciliation and confirm that discharge instructions match the current physician orders.',
        'Confirm that follow-up physician appointments are scheduled and that transportation is arranged.',
        'Provide and review a condition-specific zone tool; instruct on which findings require a call to the agency and which require 911.',
        'Front-load nursing visits in the first two weeks after discharge to detect early decline.'
      ]
    },
    {
      id: 'advance_dir',
      when: function (c) { return c.d.pt_advance_dir === 'No' || c.d.pt_advance_dir === 'Unknown'; },
      priority: 3,
      problem: 'Advance directive not established or not available in the home',
      disciplines: ['SN', 'MSW'],
      goals: ['Patient will verbalize understanding of advance directive options and state a decision, with documentation placed in the home record, within 4 weeks.'],
      interventions: [
        'Provide written information on advance directives and healthcare surrogate designation per agency policy and state law.',
        'Discuss goals of care and care preferences with the patient and family; document the patient stated wishes.',
        'Refer to medical social worker to assist with completion and distribution of documents to the physician and hospital.'
      ]
    },
    {
      id: 'psychosocial',
      when: function (c) { var p = c.checks('psychosocial_factors'); return p.length && !c.has('psychosocial_factors', 'None identified'); },
      priority: 3,
      problem: 'Psychosocial and social determinant barriers affecting the plan of care',
      disciplines: ['SN', 'MSW'],
      goals: ['Identified psychosocial barriers will be addressed through referral or resource linkage, with the patient reporting reduced barrier impact, within 4 weeks.'],
      interventions: [
        function (c) {
          var p = c.checks('psychosocial_factors').filter(function (x) { return x !== 'None identified'; });
          return 'Refer to medical social worker for: ' + p.join('; ') + '.';
        },
        'Coordinate community resources: meal programs, transportation, prescription assistance, utility assistance and support groups.',
        'Reassess psychosocial status each visit and document changes.'
      ],
      urgent: function (c) { return c.has('psychosocial_factors', 'Suspected abuse or neglect') ? 'Suspected abuse or neglect identified - follow agency policy and mandatory state reporting requirements; notify supervisor and physician.' : null; }
    },
    {
      id: 'infection_prev',
      when: function (c) { return c.hasAny('immunizations', ['Unknown', 'Declined']) || c.d.wound_present === 'Yes' || c.has('med_classes', 'Chemotherapy / immunosuppressant'); },
      priority: 3,
      problem: 'Risk for infection',
      disciplines: ['SN'],
      goals: ['Patient will remain free of new infection through the certification period.'],
      interventions: [
        'Instruct on hand hygiene, respiratory etiquette and safe handling of soiled items for patient and all caregivers.',
        'Assess for fever, new confusion, wound changes, urinary symptoms and respiratory symptoms each visit.',
        'Review immunization status and provide education on influenza, pneumococcal and COVID-19 vaccination per physician direction.'
      ]
    }
  ];

  /* ---------- discipline mapping ---------- */
  var DISC_NAMES = {
    SN: 'Skilled nursing',
    PT: 'Physical therapy',
    OT: 'Occupational therapy',
    ST: 'Speech therapy',
    MSW: 'Medical social worker',
    HHA: 'Home health aide'
  };
  var DISC_FROM_LABEL = {
    'Skilled nursing (SN)': 'SN', 'Physical therapy (PT)': 'PT', 'Occupational therapy (OT)': 'OT',
    'Speech therapy (ST)': 'ST', 'Medical social worker (MSW)': 'MSW', 'Home health aide (HHA)': 'HHA'
  };

  function resolve(item, c) { return typeof item === 'function' ? item(c) : item; }

  /* ---------- suggested visit frequency ---------- */
  function suggestFrequency(c, problems) {
    var ids = problems.map(function (p) { return p.id; });
    var high = ids.indexOf('wound') !== -1 || ids.indexOf('rehosp') !== -1 || c.sc.morse.value >= 45 ||
      c.d.ref_hosp_discharge === 'Yes' || ids.indexOf('hypoglycemia') !== -1;
    if (c.d.wound_present === 'Yes' && c.d.wound_infection === 'Yes') return '1w5, 1w3, 2w2 (front-loaded for infected wound; adjust to physician orders)';
    if (high) return '1w3, 1w2, 2w2, 1w4 (front-loaded first two weeks)';
    if (problems.length >= 6) return '2w1, 1w2, 1w6';
    return '1w1, 2w1, 1w7';
  }

  /* ---------- main generator ---------- */
  function generate(d) {
    var c = ctxOf(d);
    var problems = [];
    var urgent = [];
    var disciplines = {};

    // disciplines explicitly ordered by the clinician always count
    c.checks('disciplines').forEach(function (label) {
      var code = DISC_FROM_LABEL[label];
      if (code) disciplines[code] = { code: code, name: DISC_NAMES[code], source: 'ordered' };
    });

    RULES.forEach(function (r) {
      var fires = r.always || (r.when && r.when(c));
      if (!fires) return;
      problems.push({
        id: r.id,
        priority: r.priority || 3,
        problem: r.problem,
        disciplines: r.disciplines || [],
        goals: (r.goals || []).map(function (g) { return resolve(g, c); }).filter(Boolean),
        interventions: (r.interventions || []).map(function (i) { return resolve(i, c); }).filter(Boolean)
      });
      (r.disciplines || []).forEach(function (code) {
        if (!disciplines[code]) disciplines[code] = { code: code, name: DISC_NAMES[code], source: 'indicated' };
      });
      if (r.urgent) { var u = r.urgent(c); if (u) urgent.push(u); }
    });

    problems.sort(function (a, b) { return a.priority - b.priority; });

    // certification period
    var weeks = c.num(d.cert_period_weeks) || 9;
    var socDate = d.soc_date ? new Date(d.soc_date + 'T00:00:00') : null;
    var certEnd = null;
    if (socDate && !isNaN(socDate)) {
      certEnd = new Date(socDate.getTime());
      certEnd.setDate(certEnd.getDate() + Math.round(weeks * 7) - 1);
    }

    var safety = buildSafety(c, problems);

    return {
      generatedAt: new Date().toISOString(),
      patient: ptName(d),
      scores: c.sc,
      problems: problems,
      urgent: urgent,
      disciplines: Object.keys(disciplines).map(function (k) { return disciplines[k]; })
        .sort(function (a, b) { return ['SN', 'PT', 'OT', 'ST', 'MSW', 'HHA'].indexOf(a.code) - ['SN', 'PT', 'OT', 'ST', 'MSW', 'HHA'].indexOf(b.code); }),
      suggestedFrequency: suggestFrequency(c, problems),
      safety: safety,
      certStart: d.soc_date || '',
      certEnd: certEnd ? certEnd.toISOString().slice(0, 10) : '',
      certWeeks: weeks
    };
  }

  function buildSafety(c, problems) {
    var ids = problems.map(function (p) { return p.id; });
    var out = ['Universal / standard precautions', 'Agency 24-hour emergency phone number posted in the home'];
    if (ids.indexOf('falls') !== -1) out.push('Fall precautions; clear pathways; assistive device within reach');
    if (c.d.vs_o2_therapy === 'Yes') out.push('Oxygen safety precautions; no smoking or open flame');
    if (ids.indexOf('anticoag') !== -1) out.push('Bleeding precautions');
    if (ids.indexOf('dysphagia') !== -1) out.push('Aspiration precautions');
    if (ids.indexOf('hypoglycemia') !== -1) out.push('Hypoglycemia protocol; fast-acting carbohydrate available');
    if (ids.indexOf('skin_risk') !== -1 || ids.indexOf('wound') !== -1) out.push('Pressure injury prevention; repositioning schedule');
    if (c.has('behaviors', 'Wandering / elopement risk')) out.push('Wandering / elopement precautions');
    if (ids.indexOf('cognition') !== -1) out.push('Supervision for safety; secure medications and hazardous items');
    if (c.d.dementia_dx === 'Yes' || c.d.suicidal_ideation === 'Yes') out.push('Remove or secure firearms and hazardous materials');
    if (c.d.emerg_plan === 'No') out.push('Emergency preparedness plan to be established');
    if (c.d.safety_measures_extra) out.push(c.d.safety_measures_extra);
    return out;
  }

  /* ---------- Start of Care narrative note ---------- */
  function narrative(d, poc) {
    var c = ctxOf(d);
    var L = [];
    var name = ptName(d);
    var age = '';
    if (d.pt_dob) {
      var dob = new Date(d.pt_dob + 'T00:00:00');
      var ref = d.soc_date ? new Date(d.soc_date + 'T00:00:00') : new Date();
      if (!isNaN(dob)) {
        var a = ref.getFullYear() - dob.getFullYear();
        var m = ref.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) a--;
        age = { n: a, text: a + '-year-old ' };
      }
    }
    var sex = d.pt_sex === 'Female' ? 'female' : d.pt_sex === 'Male' ? 'male' : 'patient';
    // "an 85-year-old", "a 72-year-old"
    var article = (age && /^(8|11$|18$)/.test(String(age.n))) ? 'an ' : 'a ';
    var ageText = age ? age.text : '';

    L.push('START OF CARE - SKILLED NURSING ASSESSMENT VISIT');
    L.push('');
    L.push('Admitted to home health services on ' + (d.soc_date || '[date]') + '. ' + name + ' is ' + (age ? article : 'a ') + ageText + sex +
      ' referred by ' + (d.ref_source || '[referral source]').toLowerCase() +
      (d.ref_hosp_discharge === 'Yes' ? ', discharged from an inpatient stay on ' + (d.ref_discharge_date || '[date]') : '') +
      ' with a primary diagnosis of ' + (d.dx_primary || '[primary diagnosis]') + '.' +
      (d.dx_secondary ? ' Other active diagnoses include ' + d.dx_secondary.split('\n').filter(Boolean).join(', ') + '.' : '') +
      ' Allergies: ' + (d.allergies || 'NKDA') + '.');
    L.push('');

    // homebound
    var hb = c.checks('homebound');
    L.push('HOMEBOUND STATUS: ' + (hb.length
      ? 'Patient meets homebound criteria - ' + hb.join('; ') + '.'
      : '[homebound criteria to be documented]') +
      (d.homebound_narrative ? ' ' + d.homebound_narrative : ''));
    L.push('');

    // objective
    var vs = [];
    if (d.vs_temp) vs.push('T ' + d.vs_temp + 'F');
    if (d.vs_pulse) vs.push('P ' + d.vs_pulse);
    if (d.vs_resp) vs.push('R ' + d.vs_resp);
    if (d.vs_bp_sys && d.vs_bp_dia) vs.push('BP ' + d.vs_bp_sys + '/' + d.vs_bp_dia + (d.vs_bp_position ? ' ' + d.vs_bp_position.toLowerCase() : ''));
    if (d.vs_o2) vs.push('SpO2 ' + d.vs_o2 + '%' + (d.vs_o2_therapy === 'Yes' ? ' on ' + (d.vs_o2_lpm || 'supplemental oxygen') : ' on room air'));
    if (d.vs_weight) vs.push('weight ' + d.vs_weight + ' lb');
    if (c.sc.bmi.value) vs.push('BMI ' + c.sc.bmi.value);
    if (d.vs_glucose) vs.push('glucose ' + d.vs_glucose + ' mg/dL');
    L.push('VITAL SIGNS: ' + (vs.length ? vs.join(', ') + '.' : 'not recorded.'));
    L.push('');

    var sys = [];
    if (d.orientation) sys.push('Neuro: ' + d.orientation + (d.confusion_freq && d.confusion_freq !== 'Never' ? '; confusion ' + d.confusion_freq.toLowerCase() : '') + '.');
    var cardio = c.checks('cardiac_findings').filter(function (x) { return x !== 'Within normal limits'; });
    var resp = c.checks('resp_findings').filter(function (x) { return x !== 'Within normal limits'; });
    if (cardio.length || d.edema_detail) sys.push('Cardiovascular: ' + (cardio.join(', ') || 'no acute findings') + (d.edema_detail ? '; edema ' + d.edema_detail : '') + '.');
    if (resp.length || d.dyspnea_level) sys.push('Respiratory: ' + (resp.join(', ') || 'no acute findings') + (d.dyspnea_level ? '; dyspnea ' + d.dyspnea_level.toLowerCase() : '') + '.');
    var skin = c.checks('skin_condition').filter(function (x) { return x !== 'Intact / no issues'; });
    if (skin.length || d.wound_present === 'Yes') {
      sys.push('Integumentary: ' + (skin.join(', ') || 'skin intact') +
        (d.wound_present === 'Yes' ? '. Wound present - ' + (d.wound_detail ? d.wound_detail.replace(/\s+/g, ' ').trim() : '[describe location, stage, measurements, drainage]') : '') +
        (c.sc.braden.complete ? '. Braden ' + c.sc.braden.value + ' (' + c.sc.braden.risk + ')' : '') + '.');
    }
    if (d.bowel_pattern || d.urinary_status) sys.push('Elimination: bowel ' + (d.bowel_pattern || 'not assessed').toLowerCase() + '; urinary ' + (d.urinary_status || 'not assessed').toLowerCase() + '.');
    if (d.appetite || d.diet_order) sys.push('Nutrition: ' + (d.diet_order ? d.diet_order + ' diet; ' : '') + 'appetite ' + (d.appetite || 'not assessed').toLowerCase() + (d.weight_loss === 'Yes' ? '; unintentional weight loss reported' : '') + '.');
    if (d.pain_present === 'Yes') sys.push('Pain: ' + (d.pain_score || '?') + '/10 currently, worst ' + (d.pain_worst || '?') + '/10 in 24 hours, ' + (d.pain_location || 'location not specified') + ', ' + (d.pain_frequency || 'frequency not specified').toLowerCase() + '.');
    if (sys.length) { L.push('SYSTEMS REVIEW:'); sys.forEach(function (s) { L.push('  ' + s); }); L.push(''); }

    // functional
    var deps = c.dependentAdls();
    L.push('FUNCTIONAL STATUS: ' + (deps.length
      ? 'Requires moderate to maximal assistance with ' + deps.join(', ') + '.'
      : 'Independent to supervision level with activities of daily living.') +
      (d.gait_quality ? ' Gait ' + d.gait_quality.toLowerCase() + '.' : '') +
      (c.checks('mobility_device').filter(function (x) { return x !== 'None'; }).length ? ' Uses ' + c.checks('mobility_device').filter(function (x) { return x !== 'None'; }).join(', ').toLowerCase() + '.' : '') +
      ' Morse Fall Scale ' + c.sc.morse.value + ' - ' + c.sc.morse.risk + '.');
    L.push('');

    L.push('LIVING SITUATION: ' + (d.living_arrangement || '[not documented]') + '. Assistance available: ' + (d.assistance_available || '[not documented]').toLowerCase() + '.' +
      (d.caregiver_name ? ' Primary caregiver: ' + d.caregiver_name + (d.caregiver_ability ? ' (' + d.caregiver_ability.toLowerCase() + ')' : '') + '.' : ''));
    L.push('');

    L.push('MEDICATIONS: ' + (d.med_count ? d.med_count + ' medications on the current regimen. ' : '') +
      'Medication reconciliation completed this visit.' +
      (c.checks('med_issues').filter(function (x) { return x !== 'None identified'; }).length
        ? ' Issues identified: ' + c.checks('med_issues').filter(function (x) { return x !== 'None identified'; }).join(', ') + '; physician ' + (d.md_notified_meds === 'Yes' ? 'notified' : 'to be notified') + '.'
        : ' No medication issues identified.'));
    L.push('');

    if (poc.urgent.length) {
      L.push('IMMEDIATE ACTIONS TAKEN:');
      poc.urgent.forEach(function (u) { L.push('  - ' + u); });
      L.push('');
    }

    L.push('ASSESSMENT / CLINICAL IMPRESSION: Patient requires skilled nursing for ' +
      poc.problems.slice(0, 4).map(function (p) { return p.problem.toLowerCase(); }).join('; ') + '.' +
      ' Rehabilitation prognosis ' + (d.prognosis || 'fair').toLowerCase() + '.');
    L.push('');

    L.push('PLAN: ' + poc.disciplines.map(function (x) { return x.name; }).join(', ') + ' ordered. ' +
      'Skilled nursing frequency ' + (d.sn_frequency || poc.suggestedFrequency) + '. ' +
      'Individualized plan of care established with the patient and caregiver this visit; goals reviewed and agreed to. ' +
      'Plan of care to be submitted to ' + (d.md_name || 'the physician') + ' for review and signature.' +
      (d.patient_goals ? ' Patient-stated goal: "' + d.patient_goals.replace(/\s+/g, ' ').trim() + '"' : ''));
    L.push('');
    L.push('Clinician: ' + (d.nurse_name || '____________________') + ', RN        Date: ' + (d.visit_date || d.soc_date || '__________'));

    return L.join('\n');
  }

  root.LTC_POC = {
    generate: generate,
    narrative: narrative,
    RULES: RULES,
    DISC_NAMES: DISC_NAMES
  };
})(window);
