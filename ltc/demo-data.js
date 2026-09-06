/* =========================================================================
   Demo data - three fictional patients used to show the program working.
   Not real people and not real clinical records: every name, MRN, address
   and finding here is invented for demonstration.
   Loaded only by demo.html, never by the working app.
   ========================================================================= */
(function (root) {
  'use strict';

  var PATIENTS = [
    {
      id: 'demo-alvarez',
      created: '2026-09-06T14:10:00.000Z',
      updated: '2026-09-06T15:42:00.000Z',
      data: {
        pt_last: 'Alvarez', pt_first: 'Rosa', pt_mrn: 'DEMO-40218', pt_dob: '1941-04-12',
        pt_sex: 'Female', pt_address: '1420 Palmetto Ln, Hialeah FL', pt_phone: '(305) 555-0142',
        pt_lang: 'Spanish', pt_interpreter: 'No', pt_advance_dir: 'No',
        soc_date: '2026-09-06', visit_date: '2026-09-06', nurse_name: 'M. Ortiz',
        emerg_name: 'Ana Alvarez', emerg_rel: 'Daughter', emerg_phone: '(305) 555-0177',

        ref_source: 'Hospital discharge', ref_hosp_discharge: 'Yes', ref_discharge_date: '2026-09-04',
        md_name: 'Dr. A. Reyes', md_phone: '(305) 555-0190',
        dx_primary: 'Chronic systolic heart failure (I50.22)',
        dx_secondary: 'Type 2 diabetes mellitus (E11.9)\nStage 3 chronic kidney disease (N18.30)\nEssential hypertension (I10)',
        allergies: 'Sulfa', payer: 'Medicare', auth_visits: '18',
        homebound: ['Requires assistance of another person to leave home',
          'Requires supportive device (walker, cane, wheelchair, crutches)',
          'Leaving home requires considerable and taxing effort'],
        homebound_narrative: 'Becomes short of breath after ambulating approximately 20 feet and requires seated rest before continuing. Cannot manage the four entry steps without hands-on assistance.',

        vs_temp: '98.4', vs_pulse: '88', vs_resp: '20', vs_o2: '93',
        vs_bp_sys: '148', vs_bp_dia: '82', vs_bp_position: 'Sitting', vs_orthostatic: 'Yes',
        vs_weight: '168', vs_height: '62', vs_glucose: '184', vs_o2_therapy: 'No',
        param_sbp_hi: '160', param_sbp_lo: '90', param_hr_hi: '110', param_hr_lo: '55',
        param_temp: '100.4', param_o2: '90', param_glucose_hi: '300', param_glucose_lo: '70', param_weight: '5',

        living_arrangement: 'Lives alone', assistance_available: 'Occasional / short-term',
        caregiver_name: 'Ana Alvarez, daughter', caregiver_ability: 'Willing but needs training',
        home_type: 'House', home_stairs: 'Yes', home_utilities: 'Yes',
        home_hazards: ['Throw rugs / clutter in walkways', 'No grab bars in bathroom', 'Inadequate lighting'],
        emerg_plan: 'No', emerg_triage: 'Level 2 - not immediately life-threatening; contact within 24-48 hrs',
        env_notes: 'Bedroom and only full bathroom are on the second floor; patient has been sleeping in the living room recliner.',

        vision: 'Impaired - can see large print', hearing: 'Adequate', hearing_aid: 'No',
        speech: 'Clear and appropriate',
        pain_present: 'Yes', pain_score: '5', pain_worst: '7', pain_scale_used: 'Numeric 0-10',
        pain_location: 'Bilateral knees, aching', pain_frequency: 'With activity only', pain_effect: 'Yes',
        pain_relief: 'Acetaminophen 650 mg twice daily with partial relief; reports she waits until pain is severe before taking it.',

        skin_condition: ['Dry / flaking', 'Edema', 'Fragile / tissue-paper thin'],
        wound_present: 'Yes', wound_type: ['Venous stasis ulcer'],
        wound_detail: 'Right medial malleolus, 3.2 x 2.1 x 0.3 cm, 100% granulation, moderate serous drainage, no odor, periwound macerated.',
        wound_orders: 'Cleanse with normal saline, apply calcium alginate and compression wrap, change three times weekly.',
        wound_infection: 'No',
        braden_sensory: '3 - Slightly limited', braden_moisture: '3 - Occasionally moist',
        braden_activity: '2 - Chairfast', braden_mobility: '2 - Very limited',
        braden_nutrition: '2 - Probably inadequate', braden_friction: '2 - Potential problem',

        cardiac_findings: ['Peripheral edema', 'Anticoagulant therapy', 'Diminished peripheral pulses'],
        edema_detail: '2+ pitting, bilateral lower extremities to mid-calf', weight_gain: 'Yes',
        resp_findings: ['Dyspnea on exertion', 'Orthopnea', 'Crackles / rales'],
        dyspnea_level: 'With minimal exertion (walking >20 ft, transfers)', smoking: 'Former',
        cardio_notes: 'Sleeps on three pillows. Reports 6 lb weight gain since hospital discharge two days ago.',

        bowel_pattern: 'Constipation', bowel_incont: 'Continent', bowel_program: 'Docusate as needed, used rarely',
        urinary_status: 'Occasional incontinence', uti_signs: 'No', dialysis: 'None',

        diet_order: '2 gm sodium, carbohydrate-modified', appetite: 'Fair - eats about half',
        weight_loss: 'No', swallowing: 'No difficulty', dentition: 'Dentures - fit well',
        hydration: 'Borderline - encourage fluids', enteral: 'None', food_access: 'Yes',

        orientation: 'Oriented x3 (not time)',
        cognitive_function: 'Requires prompting in new or complex situations',
        confusion_freq: 'In new or complex situations only', memory_deficit: 'Yes', dementia_dx: 'No',
        behaviors: ['None'], phq_interest: '2 - More than half the days', phq_down: '1 - Several days',
        suicidal_ideation: 'No',
        neuro_notes: 'Requires written instructions in Spanish; teach-back is reliable when material is reviewed twice.',

        adl_grooming: '1 - Setup / clean-up assist', adl_bath: '3 - Partial / moderate assist',
        adl_dress_upper: '1 - Setup / clean-up assist', adl_dress_lower: '3 - Partial / moderate assist',
        adl_toilet: '2 - Supervision / touching assist', adl_transfer: '2 - Supervision / touching assist',
        adl_ambulation: '3 - Partial / moderate assist', adl_feeding: '0 - Independent',
        mobility_device: ['Walker'], gait_quality: 'Unsteady - requires device',
        endurance: 'Tires with minimal activity',
        iadl_meds: 'Needs assistance', iadl_meals: 'Needs assistance', iadl_phone: 'Independent',
        iadl_shopping: 'Dependent', iadl_housekeeping: 'Dependent', iadl_transport: 'Dependent',
        iadl_finances: 'Needs assistance',

        morse_history: '25 - Yes', morse_secondary: '15 - Yes',
        morse_aid: '15 - Crutches / cane / walker', morse_iv: '0 - No',
        morse_gait: '20 - Impaired', morse_mental: '15 - Overestimates or forgets limits',
        falls_number: '2', fall_injury: 'No', fear_falling: 'Yes',
        falls_notes: 'Both falls occurred at night walking to the bathroom without her walker.',

        med_list: 'Furosemide 40 mg PO daily - heart failure\nCarvedilol 6.25 mg PO twice daily - heart failure\nLisinopril 10 mg PO daily - hypertension\nApixaban 5 mg PO twice daily - atrial fibrillation\nInsulin glargine 18 units subcutaneous nightly - diabetes\nMetformin 500 mg PO twice daily - diabetes\nAtorvastatin 40 mg PO nightly - hyperlipidemia\nPotassium chloride 20 mEq PO daily - supplement\nAcetaminophen 650 mg PO twice daily - pain\nDocusate 100 mg PO as needed - constipation\nMultivitamin PO daily',
        med_count: '11',
        med_classes: ['Anticoagulant / antiplatelet', 'Insulin', 'Oral hypoglycemic', 'Diuretic'],
        med_issues: ['Non-adherence reported', 'Expired or discontinued meds in home'],
        med_admin: 'Patient with reminders', med_organizer: 'No', md_notified_meds: 'Yes',
        med_notes: 'Two discontinued bottles from a prior admission found in the kitchen and removed with the patient present.',

        disciplines: ['Skilled nursing (SN)', 'Physical therapy (PT)', 'Home health aide (HHA)'],
        sn_frequency: '1w3, 1w2, 2w2, 1w4', therapy_frequency: 'PT 2w3 then 1w4',
        aide_frequency: 'HHA 3w1 for bathing and personal care',
        skilled_services: ['Comprehensive assessment / observation', 'Medication management and teaching',
          'Wound care', 'Disease process teaching', 'Diabetic management and teaching',
          'Cardiac / respiratory monitoring'],
        dme_current: ['Walker', 'Shower chair / tub bench', 'Scale', 'Glucometer', 'Blood pressure cuff'],
        dme_needed: 'Bedside commode, bathroom grab bars',
        labs_ordered: 'BMP and INR in one week per physician order',
        safety_measures_extra: 'Night light on path from recliner to bathroom',

        psychosocial_factors: ['Social isolation', 'Transportation barrier'],
        immunizations: ['Influenza current', 'Unknown'],
        patient_goals: 'I want to walk to my mailbox again and stay out of the hospital.',
        caregiver_goals: 'Daughter wants to learn the wound dressing so she can help on weekends.',
        prognosis: 'Fair',
        risk_rehosp: ['Multiple hospitalizations in past 6 months', 'History of falls', 'Taking 5 or more medications'],
        discharge_plan: 'Discharge to caregiver management', cert_period_weeks: '9',
        poc_notes: 'All teaching to be provided in Spanish with written Spanish materials left in the home.'
      }
    },

    {
      id: 'demo-whitfield',
      created: '2026-09-05T13:00:00.000Z',
      updated: '2026-09-05T14:35:00.000Z',
      data: {
        pt_last: 'Whitfield', pt_first: 'James', pt_mrn: 'DEMO-40219', pt_dob: '1948-11-30',
        pt_sex: 'Male', pt_phone: '(954) 555-0108', pt_lang: 'English', pt_advance_dir: 'Yes - copy in home',
        soc_date: '2026-09-05', visit_date: '2026-09-05', nurse_name: 'K. Delgado',
        emerg_name: 'Margaret Whitfield', emerg_rel: 'Spouse', emerg_phone: '(954) 555-0109',

        ref_source: 'Physician office', ref_hosp_discharge: 'No',
        md_name: 'Dr. P. Nassar',
        dx_primary: 'Chronic obstructive pulmonary disease with exacerbation (J44.1)',
        dx_secondary: 'Alzheimer disease, early stage (G30.0)\nBenign prostatic hyperplasia (N40.0)',
        allergies: 'NKDA', payer: 'Medicare Advantage',
        homebound: ['Severe dyspnea / activity intolerance on exertion', 'Unsafe to leave home unattended (cognition / falls)'],
        homebound_narrative: 'Desaturates to 88% walking the length of the hallway; wife reports he becomes disoriented outside the home.',

        vs_temp: '98.1', vs_pulse: '96', vs_resp: '24', vs_o2: '91',
        vs_bp_sys: '132', vs_bp_dia: '78', vs_bp_position: 'Sitting',
        vs_weight: '152', vs_height: '70', vs_o2_therapy: 'Yes', vs_o2_lpm: '2 L/min via nasal cannula continuous',
        param_o2: '88', param_temp: '100.4', param_hr_hi: '110',

        living_arrangement: 'Lives with spouse / partner', assistance_available: 'Around the clock',
        caregiver_name: 'Margaret Whitfield, spouse', caregiver_ability: 'Limited by own health',
        home_type: 'House', home_stairs: 'No', home_utilities: 'Yes',
        home_hazards: ['Cords or tripping hazards', 'Smoking in home (with or without oxygen)'],
        emerg_plan: 'No',
        emerg_triage: 'Level 1 - life-threatening; visit or contact required during emergency',
        evac_plan: 'No backup power source for the concentrator; utility company not notified.',

        vision: 'Adequate (with or without glasses)', hearing: 'Impaired - needs repetition / raised voice',
        speech: 'Minimal difficulty finding words', pain_present: 'No',

        skin_condition: ['Intact / no issues'], wound_present: 'No',
        braden_sensory: '4 - No impairment', braden_moisture: '4 - Rarely moist',
        braden_activity: '3 - Walks occasionally', braden_mobility: '3 - Slightly limited',
        braden_nutrition: '3 - Adequate', braden_friction: '3 - No apparent problem',

        cardiac_findings: ['Within normal limits'],
        resp_findings: ['Dyspnea at rest', 'Wheezing', 'Productive cough', 'Uses inhalers / nebulizer', 'Diminished breath sounds'],
        dyspnea_level: 'With ADLs / talking', smoking: 'Current',
        cardio_notes: 'Wife reports he still smokes one or two cigarettes daily, at times while wearing the cannula.',

        bowel_pattern: 'Regular / continent', urinary_status: 'Occasional incontinence', uti_signs: 'No',
        diet_order: 'Regular', appetite: 'Fair - eats about half', weight_loss: 'Yes',
        swallowing: 'No difficulty', dentition: 'Adequate', hydration: 'Adequate', food_access: 'Yes',

        orientation: 'Oriented x2', cognitive_function: 'Requires assistance and direction in routine situations',
        confusion_freq: 'On awakening or at night only (sundowning)', memory_deficit: 'Yes', dementia_dx: 'Yes',
        behaviors: ['Wandering / elopement risk', 'Resistive to care'],
        phq_interest: '1 - Several days', phq_down: '0 - Not at all', suicidal_ideation: 'No',

        adl_grooming: '2 - Supervision / touching assist', adl_bath: '3 - Partial / moderate assist',
        adl_dress_upper: '2 - Supervision / touching assist', adl_dress_lower: '3 - Partial / moderate assist',
        adl_toilet: '2 - Supervision / touching assist', adl_transfer: '1 - Setup / clean-up assist',
        adl_ambulation: '2 - Supervision / touching assist', adl_feeding: '1 - Setup / clean-up assist',
        mobility_device: ['Cane'], gait_quality: 'Slightly unsteady - no assistive device',
        endurance: 'Requires frequent rest periods',
        iadl_meds: 'Dependent', iadl_meals: 'Dependent', iadl_phone: 'Needs assistance',
        iadl_shopping: 'Dependent', iadl_housekeeping: 'Dependent', iadl_transport: 'Dependent',
        iadl_finances: 'Dependent',

        morse_history: '0 - No', morse_secondary: '15 - Yes',
        morse_aid: '15 - Crutches / cane / walker', morse_iv: '0 - No',
        morse_gait: '10 - Weak', morse_mental: '15 - Overestimates or forgets limits',
        falls_number: '0', fall_injury: 'No', fear_falling: 'No',

        med_list: 'Tiotropium inhaler 18 mcg daily - COPD\nAlbuterol nebulizer every 6 hours as needed - COPD\nPrednisone 20 mg PO daily x 5 days - exacerbation\nAzithromycin 250 mg PO daily x 4 days - exacerbation\nDonepezil 10 mg PO nightly - Alzheimer disease\nTamsulosin 0.4 mg PO daily - BPH',
        med_count: '6', med_classes: ['Antibiotic (active course)'],
        med_issues: ['None identified'], med_admin: 'Caregiver administers', med_organizer: 'Yes',

        disciplines: ['Skilled nursing (SN)', 'Occupational therapy (OT)', 'Medical social worker (MSW)'],
        sn_frequency: '2w1, 1w6', therapy_frequency: 'OT evaluate and treat',
        skilled_services: ['Comprehensive assessment / observation', 'Disease process teaching',
          'Cardiac / respiratory monitoring', 'Medication management and teaching'],
        dme_current: ['Oxygen concentrator', 'Nebulizer', 'Cane', 'Shower chair / tub bench'],
        dme_needed: 'Portable oxygen cylinders for emergency use',
        safety_measures_extra: 'Door alarms installed by family; smoking cessation plan in progress',

        psychosocial_factors: ['Caregiver strain', 'Health literacy barrier'],
        immunizations: ['Influenza current', 'Pneumococcal up to date', 'COVID-19 up to date'],
        patient_goals: 'I want to breathe well enough to sit on the porch with my wife.',
        caregiver_goals: 'Spouse asks for respite options; she has her own back injury.',
        prognosis: 'Guarded',
        risk_rehosp: ['Recent decline in mental / emotional / behavioral status', 'Frailty indicators'],
        discharge_plan: 'Discharge to caregiver management', cert_period_weeks: '9'
      }
    },

    {
      id: 'demo-carter',
      created: '2026-09-03T16:20:00.000Z',
      updated: '2026-09-03T17:05:00.000Z',
      data: {
        pt_last: 'Carter', pt_first: 'Evelyn', pt_mrn: 'DEMO-40221', pt_dob: '1942-06-08',
        pt_sex: 'Female', pt_phone: '(561) 555-0163', pt_lang: 'English',
        pt_advance_dir: 'Yes - copy in home',
        soc_date: '2026-09-03', visit_date: '2026-09-03', nurse_name: 'M. Ortiz',
        emerg_name: 'David Carter', emerg_rel: 'Son', emerg_phone: '(561) 555-0164',

        ref_source: 'Skilled nursing facility', ref_hosp_discharge: 'Yes', ref_discharge_date: '2026-09-02',
        md_name: 'Dr. L. Menendez',
        dx_primary: 'Aftercare following surgical repair of right hip fracture (Z47.81)',
        dx_secondary: 'Osteoporosis (M81.0)\nHypothyroidism (E03.9)',
        surgical_hx: 'Right hip ORIF, 2026-08-21', allergies: 'Codeine', payer: 'Medicare',
        homebound: ['Requires supportive device (walker, cane, wheelchair, crutches)',
          'Leaving home requires considerable and taxing effort'],
        homebound_narrative: 'Weight-bearing as tolerated with a rolling walker; unable to negotiate the three entry steps without assistance.',

        vs_temp: '97.9', vs_pulse: '76', vs_resp: '18', vs_o2: '97',
        vs_bp_sys: '124', vs_bp_dia: '70', vs_bp_position: 'Sitting',
        vs_weight: '134', vs_height: '64', vs_o2_therapy: 'No',
        param_temp: '100.4', param_sbp_hi: '160', param_sbp_lo: '90',

        living_arrangement: 'Lives with family', assistance_available: 'Regular daytime',
        caregiver_name: 'David Carter, son', caregiver_ability: 'Able and willing',
        home_type: 'House', home_stairs: 'Yes', home_utilities: 'Yes',
        home_hazards: ['None identified'], emerg_plan: 'Yes',
        emerg_triage: 'Level 3 - stable; can be postponed 72+ hrs with caregiver support',

        vision: 'Adequate (with or without glasses)', hearing: 'Adequate', speech: 'Clear and appropriate',
        pain_present: 'Yes', pain_score: '4', pain_worst: '6', pain_scale_used: 'Numeric 0-10',
        pain_location: 'Right hip, incisional', pain_frequency: 'With activity only', pain_effect: 'Yes',
        pain_relief: 'Acetaminophen scheduled; declines opioids due to prior nausea.',

        skin_condition: ['Intact / no issues'], wound_present: 'Yes', wound_type: ['Surgical incision'],
        wound_detail: 'Right lateral hip incision 14 cm, staples intact, edges approximated, no drainage or erythema.',
        wound_orders: 'Keep clean and dry; staple removal scheduled at the surgeon office on 2026-09-08.',
        wound_infection: 'No',
        braden_sensory: '4 - No impairment', braden_moisture: '4 - Rarely moist',
        braden_activity: '3 - Walks occasionally', braden_mobility: '3 - Slightly limited',
        braden_nutrition: '3 - Adequate', braden_friction: '2 - Potential problem',

        cardiac_findings: ['Within normal limits'], resp_findings: ['Within normal limits'],
        dyspnea_level: 'With moderate exertion (stairs, climbing)', smoking: 'Never',

        bowel_pattern: 'Constipation', bowel_incont: 'Continent',
        urinary_status: 'Continent', uti_signs: 'No',
        diet_order: 'Regular with high protein', appetite: 'Good - eats most meals',
        weight_loss: 'No', swallowing: 'No difficulty', hydration: 'Adequate', food_access: 'Yes',

        orientation: 'Alert and oriented x4',
        cognitive_function: 'Alert; able to focus and follow directions independently',
        confusion_freq: 'Never', memory_deficit: 'No', dementia_dx: 'No', behaviors: ['None'],
        phq_interest: '1 - Several days', phq_down: '1 - Several days', suicidal_ideation: 'No',

        adl_grooming: '0 - Independent', adl_bath: '3 - Partial / moderate assist',
        adl_dress_upper: '0 - Independent', adl_dress_lower: '3 - Partial / moderate assist',
        adl_toilet: '2 - Supervision / touching assist', adl_transfer: '2 - Supervision / touching assist',
        adl_ambulation: '2 - Supervision / touching assist', adl_feeding: '0 - Independent',
        mobility_device: ['Rollator', 'Bedside commode'], gait_quality: 'Unsteady - requires device',
        endurance: 'Tires with moderate activity',
        iadl_meds: 'Independent', iadl_meals: 'Needs assistance', iadl_phone: 'Independent',
        iadl_shopping: 'Dependent', iadl_housekeeping: 'Needs assistance',
        iadl_transport: 'Dependent', iadl_finances: 'Independent',

        morse_history: '25 - Yes', morse_secondary: '15 - Yes',
        morse_aid: '15 - Crutches / cane / walker', morse_iv: '0 - No',
        morse_gait: '10 - Weak', morse_mental: '0 - Oriented to own ability',
        falls_number: '1', fall_injury: 'Yes', fear_falling: 'Yes',
        falls_notes: 'Index fall at home in August resulting in the right hip fracture.',

        med_list: 'Acetaminophen 1000 mg PO three times daily - pain\nApixaban 2.5 mg PO twice daily x 30 days - VTE prophylaxis\nLevothyroxine 88 mcg PO daily - hypothyroidism\nAlendronate 70 mg PO weekly - osteoporosis\nCalcium with vitamin D PO twice daily - supplement\nSenna PO nightly - constipation',
        med_count: '6', med_classes: ['Anticoagulant / antiplatelet'],
        med_issues: ['None identified'], med_admin: 'Patient independently', med_organizer: 'Yes',

        disciplines: ['Skilled nursing (SN)', 'Physical therapy (PT)', 'Occupational therapy (OT)'],
        sn_frequency: '1w1, 2w1, 1w7', therapy_frequency: 'PT 3w2 then 2w4, OT 2w2',
        skilled_services: ['Comprehensive assessment / observation', 'Medication management and teaching',
          'Wound care', 'Pain management'],
        dme_current: ['Walker / rollator', 'Bedside commode', 'Shower chair / tub bench', 'Grab bars'],
        dme_needed: 'Raised toilet seat',
        safety_measures_extra: 'Posterior hip precautions posted at the bedside',

        psychosocial_factors: ['None identified'],
        immunizations: ['Influenza current', 'Pneumococcal up to date', 'COVID-19 up to date'],
        patient_goals: 'I want to climb my own stairs and go back to my Thursday card game.',
        caregiver_goals: 'Son wants to learn safe transfer technique before he returns to work.',
        prognosis: 'Good', risk_rehosp: ['History of falls'],
        discharge_plan: 'Return to prior level of function; self / caregiver manages care',
        cert_period_weeks: '9'
      }
    }
  ];

  root.LTC_DEMO = {
    patients: PATIENTS,
    seed: function (key) {
      localStorage.setItem(key, JSON.stringify({ records: JSON.parse(JSON.stringify(PATIENTS)) }));
    }
  };
})(window);
