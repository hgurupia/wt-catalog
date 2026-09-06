/* =========================================================================
   LTC Nurse Assessment - application logic (mobile first)
   Screens: home (patient list) -> assessment (15 sections) -> plan of care
   One phone-width column: sticky top bar, section sheet, bottom action bar.
   Records are stored in localStorage; export/import moves them as JSON.
   ========================================================================= */
(function () {
  'use strict';

  var S = window.LTC_SCHEMA;
  var ENGINE = window.LTC_POC;
  var KEY = 'ltc_soc_v1';

  var db = { records: [] };
  var current = null;      // active record
  var secIndex = 0;        // active section
  var pocView = 'poc';     // poc | narrative | summary
  var lastPoc = null;
  var saveTimer = null;
  var dirty = false;       // unsaved edits to the active record
  var screen = 'home';

  /* ---------------- storage ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) db = JSON.parse(raw);
    } catch (e) { db = { records: [] }; }
    if (!db || !Array.isArray(db.records)) db = { records: [] };
  }
  function persist() {
    dirty = false;
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { toast('Could not save - browser storage is full or blocked'); }
  }
  // Writes the active record without clobbering records another tab may have
  // added: re-read what is stored, splice the active record into it, save that.
  function saveCurrent() {
    if (!current) return;
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { stored = null; }
    if (stored && Array.isArray(stored.records)) {
      var i = -1;
      stored.records.forEach(function (r, n) { if (r.id === current.id) i = n; });
      if (i >= 0) stored.records[i] = current; else stored.records.unshift(current);
      db = stored;
    }
    persist();
  }
  function scheduleSave() {
    if (current) current.updated = new Date().toISOString();
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrent, 350);
  }
  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------------- utils ---------------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(msg) {
    var t = el('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function fmtDate(s) {
    if (!s) return '';
    var d = new Date(s + 'T00:00:00');
    if (isNaN(d)) return s;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function nameOf(r) {
    var d = r.data || {};
    var n = [d.pt_last, d.pt_first].filter(Boolean).join(', ');
    return n || 'Unnamed patient';
  }
  function initials(r) {
    var d = r.data || {};
    var a = (d.pt_first || '').charAt(0), b = (d.pt_last || '').charAt(0);
    return ((a + b) || '?').toUpperCase();
  }

  /* ---------------- record lifecycle ---------------- */
  function newRecord() {
    var data = {};
    S.SECTIONS.forEach(function (sec) {
      sec.fields.forEach(function (f) { if (f.default != null) data[f.id] = f.default; });
    });
    data.soc_date = today();
    data.visit_date = today();
    var r = { id: uid(), created: new Date().toISOString(), updated: new Date().toISOString(), data: data };
    db.records.unshift(r);
    persist();
    open(r.id);
  }
  function open(id) {
    current = db.records.filter(function (r) { return r.id === id; })[0] || null;
    if (!current) return;
    secIndex = 0;
    show('assess');
    renderAssess();
  }
  function removeRecord(id) {
    var r = db.records.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    if (!confirm('Delete the record for ' + nameOf(r) + '? This cannot be undone.')) return;
    db.records = db.records.filter(function (x) { return x.id !== id; });
    if (current && current.id === id) current = null;
    persist(); renderHome(); toast('Record deleted');
  }

  /* ---------------- screens ---------------- */
  function show(which) {
    screen = which;
    ['home', 'assess', 'poc'].forEach(function (s) {
      el('screen-' + s).classList.toggle('on', s === which);
    });
    el('tbHome').classList.toggle('on', which === 'home');
    el('tbAssess').classList.toggle('on', which === 'assess');
    el('tbPoc').classList.toggle('on', which === 'poc');
    el('bbAssess').classList.toggle('on', which === 'assess');
    el('bbPoc').classList.toggle('on', which === 'poc');
    el('bottombar').style.display = which === 'home' ? 'none' : '';
    el('progWrap').style.display = which === 'assess' ? '' : 'none';
    if (which === 'poc' && current) {
      el('pocPatient').innerHTML = esc(nameOf(current)) +
        '<span class="sub">' + esc(current.data.dx_primary || 'Plan of care') + '</span>';
    }
    closeSheet();
    window.scrollTo(0, 0);
  }

  /* ---------------- home ---------------- */
  function renderHome() {
    var box = el('ptList');
    if (!db.records.length) {
      box.innerHTML = '<div class="card empty">No assessments yet. Start a new assessment to create the first record.</div>';
      return;
    }
    box.innerHTML = db.records.map(function (r) {
      var d = r.data || {};
      var pct = progressOf(r);
      return '<div class="pt-card">' +
        '<button class="pt-open" data-open="' + r.id + '">' +
        '<span class="pt-av">' + esc(initials(r)) + '</span>' +
        '<span class="pt-info"><b>' + esc(nameOf(r)) + '</b>' +
        '<span>' + (d.dx_primary ? esc(d.dx_primary) + ' &middot; ' : '') +
        'SOC ' + esc(fmtDate(d.soc_date) || 'not set') + '</span>' +
        '<span class="pt-meter"><i style="width:' + pct + '%"></i></span>' +
        '<span class="xsmall muted">' + pct + '% documented</span></span></button>' +
        '<div class="pt-acts">' +
        '<button class="btn ghost sm" data-poc="' + r.id + '">Plan of care</button>' +
        '<button class="btn ghost sm" data-del="' + r.id + '">Delete</button>' +
        '</div></div>';
    }).join('');
  }

  function progressOf(r) {
    var d = r.data || {}, total = 0, done = 0;
    S.SECTIONS.forEach(function (sec) {
      sec.fields.forEach(function (f) {
        if (f.type === 'note' || f.type === 'computed') return;
        if (!S.visible(f, d)) return;
        total++;
        var v = d[f.id];
        if (Array.isArray(v) ? v.length : (v !== undefined && v !== null && v !== '')) done++;
      });
    });
    return total ? Math.round(done / total * 100) : 0;
  }
  function sectionDone(sec, d) {
    var total = 0, done = 0;
    sec.fields.forEach(function (f) {
      if (f.type === 'note' || f.type === 'computed') return;
      if (!S.visible(f, d)) return;
      total++;
      var v = d[f.id];
      if (Array.isArray(v) ? v.length : (v !== undefined && v !== null && v !== '')) done++;
    });
    return total && done === total;
  }

  /* ---------------- assessment ---------------- */
  function renderAssess() {
    if (!current) { show('home'); return; }
    renderSheetList();
    renderSection();
    updateChrome();
  }

  function updateChrome() {
    var sec = S.SECTIONS[secIndex];
    el('pickerStep').textContent = 'Section ' + (secIndex + 1) + ' of ' + S.SECTIONS.length;
    el('pickerName').textContent = sec.title;
    el('progBar').style.width = progressOf(current) + '%';
    el('barPrev').disabled = secIndex === 0;
    var last = secIndex === S.SECTIONS.length - 1;
    el('barNext').textContent = last ? 'Generate plan of care' : 'Next section';
  }

  function renderSheetList() {
    var d = current.data;
    el('railList').innerHTML = S.SECTIONS.map(function (sec, i) {
      var done = sectionDone(sec, d);
      return '<button class="sheet-item' + (i === secIndex ? ' on' : '') + (done ? ' done' : '') +
        '" data-sec="' + i + '">' +
        '<span class="n">' + (done && i !== secIndex ? '&#10003;' : (i + 1)) + '</span>' +
        '<span class="lbl">' + esc(sec.title) + '</span></button>';
    }).join('');
  }

  // Updates completion state without replacing the buttons. Replacing them on
  // blur would destroy the very control a tap is landing on.
  function updateSheetState() {
    var d = current.data;
    Array.prototype.forEach.call(el('railList').children, function (btn, i) {
      var done = sectionDone(S.SECTIONS[i], d);
      btn.classList.toggle('done', done);
      var n = btn.querySelector('.n');
      if (n) n.innerHTML = (done && i !== secIndex) ? '&#10003;' : (i + 1);
    });
    el('progBar').style.width = progressOf(current) + '%';
  }

  function renderSection() {
    var sec = S.SECTIONS[secIndex], d = current.data;
    // the top bar already names the section, so the card goes straight to the fields
    var html = '<div class="grid">';
    sec.fields.forEach(function (f) { if (S.visible(f, d)) html += fieldHtml(f, d); });
    html += '</div>';
    el('secCard').innerHTML = html;
    wireSection();
  }

  function fieldHtml(f, d) {
    var col = ' data-col="' + (f.col || 12) + '"';
    var v = d[f.id];

    if (f.type === 'note') return '<div class="note">' + esc(f.text) + '</div>';

    if (f.type === 'computed') {
      var res = S.COMPUTERS[f.compute](d);
      return '<div class="f"' + col + '><label>' + esc(f.label) + '</label>' +
        '<div class="computed"><span>' + esc(res.text) + '</span>' +
        (res.level && res.text !== '-' ? '<span class="tag ' + res.level + '">' +
          esc(res.tag || (res.level + ' risk')) + '</span>' : '') +
        '</div></div>';
    }

    var label = '<label for="fld_' + f.id + '">' + esc(f.label) +
      (f.required ? '<span class="req">*</span>' : '') + '</label>';

    if (f.type === 'textarea') {
      return '<div class="f"' + col + '>' + label +
        '<textarea id="fld_' + f.id + '" data-f="' + f.id + '"' + (f.rows ? ' rows="' + f.rows + '"' : '') +
        (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>' + esc(v || '') + '</textarea></div>';
    }
    if (f.type === 'select') {
      return '<div class="f"' + col + '>' + label +
        '<select id="fld_' + f.id + '" data-f="' + f.id + '">' +
        '<option value="">- select -</option>' +
        f.options.map(function (o) {
          return '<option value="' + esc(o) + '"' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select></div>';
    }
    if (f.type === 'radio') {
      return '<div class="f"' + col + '>' + label + '<div class="opts">' +
        f.options.map(function (o) {
          return '<label class="opt' + (v === o ? ' on' : '') + '">' +
            '<input type="radio" name="rad_' + f.id + '" data-f="' + f.id + '" value="' + esc(o) + '"' +
            (v === o ? ' checked' : '') + '>' + esc(o) + '</label>';
        }).join('') + '</div></div>';
    }
    if (f.type === 'checks') {
      var arr = Array.isArray(v) ? v : [];
      return '<div class="f"' + col + '>' + label + '<div class="opts">' +
        f.options.map(function (o) {
          return '<label class="opt' + (arr.indexOf(o) !== -1 ? ' on' : '') + '">' +
            '<input type="checkbox" data-fc="' + f.id + '" value="' + esc(o) + '"' +
            (arr.indexOf(o) !== -1 ? ' checked' : '') + '>' + esc(o) + '</label>';
        }).join('') + '</div></div>';
    }
    var type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
    var mode = f.type === 'number' ? ' inputmode="decimal"' : '';
    return '<div class="f"' + col + '>' + label +
      '<input id="fld_' + f.id + '" data-f="' + f.id + '" type="' + type + '"' + mode +
      ' value="' + esc(v || '') + '"' +
      (f.step ? ' step="' + f.step + '"' : '') +
      (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') +
      (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '></div>';
  }

  function wireSection() {
    var card = el('secCard');

    Array.prototype.forEach.call(card.querySelectorAll('input[data-f], textarea[data-f]'), function (node) {
      if (node.type === 'radio') return;
      node.addEventListener('input', function () {
        current.data[node.dataset.f] = node.value;
        scheduleSave();
        refreshComputed();
        updateSheetState();
      });
      node.addEventListener('blur', updateSheetState);
    });

    // selects and radios can change which fields apply -> re-render the section
    Array.prototype.forEach.call(card.querySelectorAll('select[data-f]'), function (node) {
      node.addEventListener('change', function () {
        current.data[node.dataset.f] = node.value;
        scheduleSave(); renderAssess();
      });
    });
    Array.prototype.forEach.call(card.querySelectorAll('input[type=radio][data-f]'), function (node) {
      node.addEventListener('change', function () {
        current.data[node.dataset.f] = node.value;
        scheduleSave(); renderAssess();
      });
    });
    Array.prototype.forEach.call(card.querySelectorAll('input[data-fc]'), function (node) {
      node.addEventListener('change', function () {
        var id = node.dataset.fc;
        var f = S.fieldById(id);
        var arr = Array.isArray(current.data[id]) ? current.data[id].slice() : [];
        var val = node.value;
        if (node.checked) {
          if (isExclusive(val)) arr = [val];
          else arr = arr.filter(function (x) { return !isExclusive(x); }).concat([val]);
        } else {
          arr = arr.filter(function (x) { return x !== val; });
        }
        current.data[id] = f.options.filter(function (o) { return arr.indexOf(o) !== -1; });
        scheduleSave(); renderAssess();
      });
    });
  }

  // "None" style answers cannot coexist with a positive finding
  function isExclusive(val) {
    return /^none/i.test(val) || val === 'None identified' ||
      val === 'Intact / no issues' || val === 'Within normal limits';
  }

  function refreshComputed() {
    var sec = S.SECTIONS[secIndex], d = current.data;
    var comps = sec.fields.filter(function (f) { return f.type === 'computed' && S.visible(f, d); });
    if (!comps.length) return;
    var blocks = el('secCard').querySelectorAll('.computed');
    Array.prototype.forEach.call(blocks, function (n, i) {
      if (!comps[i]) return;
      var res = S.COMPUTERS[comps[i].compute](d);
      n.innerHTML = '<span>' + esc(res.text) + '</span>' +
        (res.level && res.text !== '-' ? '<span class="tag ' + res.level + '">' +
          esc(res.tag || (res.level + ' risk')) + '</span>' : '');
    });
  }

  function goSection(i) {
    if (i < 0 || i >= S.SECTIONS.length) return;
    secIndex = i;
    renderAssess();
    window.scrollTo(0, 0);
  }

  /* ---------------- section sheet ---------------- */
  function openSheet() {
    if (!current) return;
    renderSheetList();
    el('sheet').classList.add('on');
    el('backdrop').classList.add('on');
  }
  function closeSheet() {
    el('sheet').classList.remove('on');
    el('backdrop').classList.remove('on');
  }

  /* ---------------- plan of care ---------------- */
  function generatePoc() {
    if (!current) return;
    var d = current.data;
    var missing = [];
    if (!d.pt_last && !d.pt_first) missing.push('patient name');
    if (!d.dx_primary) missing.push('primary diagnosis');
    if (!d.soc_date) missing.push('start of care date');
    if (missing.length && !confirm('Not documented yet: ' + missing.join(', ') +
      '.\n\nGenerate the plan of care anyway?')) return;

    lastPoc = ENGINE.generate(d);
    current.poc = { generatedAt: lastPoc.generatedAt };
    saveCurrent();
    show('poc');
    renderPoc();
  }

  function renderPoc() {
    var d = current.data, poc = lastPoc;
    var body = el('pocBody');
    if (pocView === 'narrative') { body.innerHTML = narrativeHtml(d, poc); wirePocBody(); return; }
    if (pocView === 'summary') { body.innerHTML = summaryHtml(d); return; }

    var h = '<div class="stack">';

    if (poc.urgent.length) {
      h += '<div class="alert"><b>Immediate action required</b><ul>' +
        poc.urgent.map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') + '</ul></div>';
    }

    /* header */
    h += '<div class="card"><div class="poc-title"><h2>Personalized plan of care</h2></div>' +
      '<p class="muted small" style="margin:4px 0 12px">' + esc(nameOf(current)) +
      (d.pt_mrn ? ' &middot; MRN ' + esc(d.pt_mrn) : '') +
      (d.pt_dob ? ' &middot; DOB ' + esc(fmtDate(d.pt_dob)) : '') + '</p>' +
      '<div class="chips">' +
      '<span class="chip teal">' + poc.problems.length + ' problems</span>' +
      '<span class="chip ' + (poc.scores.morse.level === 'high' ? 'warn' : '') + '">Falls: ' + esc(poc.scores.morse.risk) + '</span>' +
      (poc.scores.braden.complete ? '<span class="chip ' + (poc.scores.braden.level === 'high' ? 'warn' : '') + '">Braden ' + poc.scores.braden.value + '</span>' : '') +
      (poc.scores.phq2.positive ? '<span class="chip warn">PHQ-2 positive</span>' : '') +
      '</div>';

    h += '<div class="kv" style="margin-top:14px">' +
      kv('Start of care', fmtDate(d.soc_date) || 'not set') +
      kv('Certification period', poc.certStart ? fmtDate(poc.certStart) + ' - ' + fmtDate(poc.certEnd) : 'set SOC date') +
      kv('Primary diagnosis', d.dx_primary || 'not documented') +
      kv('Physician', d.md_name || 'not documented') +
      kv('Payer', d.payer || 'not documented') +
      kv('Allergies', d.allergies || 'not documented') +
      kv('Emergency triage', (d.emerg_triage || 'not set').split(' - ')[0]) +
      kv('Prognosis', d.prognosis || 'not documented') +
      '</div>';

    h += '<div class="group-label">Disciplines &amp; frequency</div>' +
      '<div class="chips">' + poc.disciplines.map(function (x) {
        return '<span class="chip teal">' + esc(x.name) +
          (x.source === 'indicated' ? ' <span style="opacity:.6">indicated</span>' : '') + '</span>';
      }).join('') + '</div>' +
      '<div class="kv" style="margin-top:12px">' +
      kv('Nursing frequency', d.sn_frequency || poc.suggestedFrequency + ' (suggested)') +
      kv('Therapy frequency', d.therapy_frequency || 'per therapy evaluation') +
      kv('Aide frequency', d.aide_frequency || 'not ordered') +
      kv('Homebound', (Array.isArray(d.homebound) && d.homebound.length)
        ? d.homebound.length + ' criteria met' : 'not documented') + '</div>';

    h += '<div class="group-label">Safety measures</div><div class="chips">' +
      poc.safety.map(function (s) { return '<span class="chip">' + esc(s) + '</span>'; }).join('') + '</div>';

    var dme = (Array.isArray(d.dme_current) ? d.dme_current : []).filter(function (x) { return x !== 'None'; });
    h += '<div class="group-label">Equipment &amp; supplies</div>' +
      '<p class="small" style="margin:0">' + (dme.length ? esc(dme.join(', ')) : 'None in the home') +
      (d.dme_needed ? '<br><b>To be ordered:</b> ' + esc(d.dme_needed) : '') + '</p>';

    if (d.diet_order || d.labs_ordered) {
      h += '<div class="kv" style="margin-top:14px">' +
        (d.diet_order ? kv('Diet', d.diet_order) : '') +
        (d.labs_ordered ? kv('Labs / diagnostics', d.labs_ordered) : '') + '</div>';
    }
    h += '</div>';

    /* problem list - collapsed on a phone, priority 1 open */
    h += '<div class="card"><h2 style="font-size:17px">Problems, goals &amp; interventions</h2>' +
      '<p class="muted small" style="margin:4px 0 0">Built from the documented findings, ordered by priority. ' +
      'Tap a problem to see its goals and interventions.</p>';

    poc.problems.forEach(function (p, i) {
      h += '<details class="prob"' + (i === 0 ? ' open' : '') + '>' +
        '<summary><span class="n">' + (i + 1) + '</span>' +
        '<h3>' + esc(p.problem) + '</h3>' +
        '<span class="caret">&#9662;</span></summary>' +
        '<div class="prob-body">' +
        '<div class="chips"><span class="chip ' + (p.priority === 1 ? 'warn' : 'teal') + '">Priority ' + p.priority + '</span>' +
        p.disciplines.map(function (c) {
          return '<span class="chip">' + esc(ENGINE.DISC_NAMES[c] || c) + '</span>';
        }).join('') + '</div>' +
        '<h5>Goals / expected outcomes</h5><ul>' +
        p.goals.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' +
        '<h5>Interventions</h5><ul>' +
        p.interventions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '</div></details>';
    });
    h += '</div>';

    if (d.patient_goals || d.caregiver_goals || d.discharge_plan || d.poc_notes) {
      h += '<div class="card"><h2 style="font-size:17px">Patient-centered goals &amp; discharge plan</h2>';
      if (d.patient_goals) h += '<div class="group-label">Patient-stated goals</div><p class="small" style="margin:0">' + esc(d.patient_goals) + '</p>';
      if (d.caregiver_goals) h += '<div class="group-label">Caregiver goals &amp; learning needs</div><p class="small" style="margin:0">' + esc(d.caregiver_goals) + '</p>';
      if (d.discharge_plan) h += '<div class="group-label">Anticipated discharge plan</div><p class="small" style="margin:0">' + esc(d.discharge_plan) + '</p>';
      if (d.poc_notes) h += '<div class="group-label">Additional orders &amp; notes</div><p class="small" style="margin:0;white-space:pre-wrap">' + esc(d.poc_notes) + '</p>';
      h += '</div>';
    }

    h += '<div class="card"><div class="sig">' +
      '<div><div class="line"></div>Assessing clinician (RN) - ' + esc(d.nurse_name || '') +
      '<br>Date: ' + esc(fmtDate(d.visit_date) || '') + '</div>' +
      '<div><div class="line"></div>Physician signature - ' + esc(d.md_name || '') +
      '<br>Date: ______________</div></div></div>';

    h += '<div class="disclaimer"><h3>Review before use</h3>' +
      '<p>Generated ' + esc(new Date(poc.generatedAt).toLocaleString()) +
      '. This is clinical decision support: the assessing licensed clinician must review and individualize it, ' +
      'and the physician must sign it before it becomes the plan of care.</p></div>';

    h += '</div>';
    body.innerHTML = h;
    wirePocBody();
  }

  function kv(label, value) {
    return '<div><b>' + esc(label) + '</b><span>' + esc(value) + '</span></div>';
  }

  function narrativeHtml(d, poc) {
    var text = ENGINE.narrative(d, poc);
    return '<div class="stack"><div class="card">' +
      '<div class="poc-title"><h2>Start of care note</h2>' +
      '<button class="btn ghost sm no-print" id="btnCopy">Copy</button></div>' +
      '<p class="muted small" style="margin:4px 0 0">Assembled from the documented assessment. ' +
      'Edit as needed once it is in the clinical record.</p></div>' +
      '<pre class="narrative" id="narrativeText">' + esc(text) + '</pre></div>';
  }

  function summaryHtml(d) {
    var h = '<div class="stack"><div class="card"><h2 style="font-size:17px">Assessment summary</h2>' +
      '<p class="muted small" style="margin:4px 0 0">Everything documented for this patient. ' +
      'Unanswered items are omitted.</p></div>';
    S.SECTIONS.forEach(function (sec) {
      var rows = sec.fields.filter(function (f) {
        if (f.type === 'note') return false;
        if (!S.visible(f, d)) return false;
        if (f.type === 'computed') return S.COMPUTERS[f.compute](d).text !== '-';
        var v = d[f.id];
        return Array.isArray(v) ? v.length : (v !== undefined && v !== null && v !== '');
      });
      if (!rows.length) return;
      h += '<div class="card"><h3 style="font-size:14.5px;margin-bottom:10px">' + esc(sec.title) + '</h3>' +
        '<div class="kv">';
      rows.forEach(function (f) {
        var val = f.type === 'computed' ? S.COMPUTERS[f.compute](d).text
          : (Array.isArray(d[f.id]) ? d[f.id].join('; ') : d[f.id]);
        h += kv(f.label, val);
      });
      h += '</div></div>';
    });
    return h + '</div>';
  }

  function wirePocBody() {
    var cp = el('btnCopy');
    if (cp) cp.addEventListener('click', function () {
      var t = el('narrativeText').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(
        function () { toast('Note copied'); },
        function () { toast('Copy failed - select the text manually'); });
      else toast('Copy not supported in this browser');
    });
  }

  /* ---------------- import / export ---------------- */
  function exportRecord() {
    if (!current) return;
    var poc = lastPoc || ENGINE.generate(current.data);
    var payload = {
      format: 'ltc-soc-assessment',
      version: 1,
      exported: new Date().toISOString(),
      record: current,
      planOfCare: poc,
      narrative: ENGINE.narrative(current.data, poc)
    };
    var filename = (nameOf(current).replace(/[^a-z0-9]+/gi, '_') || 'record') +
      '_SOC_' + (current.data.soc_date || today()) + '.json';
    saveFile(filename, JSON.stringify(payload, null, 2));
  }

  // Plain download links are inert inside the Artifact viewer, so hand the file
  // to the host's download bridge when the page is running in one.
  function saveFile(filename, text) {
    function browserSave() {
      var blob = new Blob([text], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('Record exported');
    }
    if (!(window.claude && typeof window.claude.use === 'function')) return browserSave();
    window.claude.use('downloads').then(function (dl) {
      if (!dl) return browserSave();
      dl.save({ filename: filename, data: text }).then(
        function () { toast('Record exported'); },
        function (err) {
          toast(err && err.code === 'declined' ? 'Export cancelled' : 'Export unavailable here');
        }
      );
    }, browserSave);
  }

  // The print view paginates the document on screen, because an embedded browser
  // view will not let a page open a print dialog.
  function openPrintView() {
    if (!current) return;
    var poc = lastPoc || ENGINE.generate(current.data);
    lastPoc = poc;
    if (!window.LTC_PRINT) { window.print(); return; }
    window.LTC_PRINT.open(current, poc, ENGINE.narrative(current.data, poc));
  }

  function importRecord(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var p = JSON.parse(fr.result);
        var rec = p.record || p;
        if (!rec || !rec.data) throw new Error('unrecognized file');
        rec.id = uid();
        rec.updated = new Date().toISOString();
        db.records.unshift(rec);
        persist(); renderHome(); toast('Record imported');
      } catch (e) { toast('Could not read that file'); }
    };
    fr.readAsText(file);
  }

  /* ---------------- wiring ---------------- */
  function init() {
    load();
    renderHome();
    show('home');

    el('btnNew').addEventListener('click', newRecord);
    el('btnNewTop').addEventListener('click', newRecord);
    el('btnAssessBack').addEventListener('click', function () { show('home'); renderHome(); });
    el('btnPocBack').addEventListener('click', function () { show('assess'); renderAssess(); });
    el('btnImport').addEventListener('click', function () { el('fileImport').click(); });
    el('fileImport').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importRecord(e.target.files[0]);
      e.target.value = '';
    });

    el('ptList').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.open) open(b.dataset.open);
      else if (b.dataset.del) removeRecord(b.dataset.del);
      else if (b.dataset.poc) { open(b.dataset.poc); generatePoc(); }
    });

    el('btnPicker').addEventListener('click', openSheet);
    el('btnSheetClose').addEventListener('click', closeSheet);
    el('backdrop').addEventListener('click', closeSheet);
    el('railList').addEventListener('click', function (e) {
      var b = e.target.closest('.sheet-item'); if (!b) return;
      closeSheet();
      goSection(parseInt(b.dataset.sec, 10));
    });
    el('btnGenerate').addEventListener('click', function () { closeSheet(); generatePoc(); });

    el('barPrev').addEventListener('click', function () { goSection(secIndex - 1); });
    el('barNext').addEventListener('click', function () {
      if (secIndex === S.SECTIONS.length - 1) generatePoc();
      else goSection(secIndex + 1);
    });

    el('btnBackAssess').addEventListener('click', function () { show('assess'); renderAssess(); });
    el('btnExport').addEventListener('click', exportRecord);
    el('btnPrint').addEventListener('click', openPrintView);
    el('btnPrintTop').addEventListener('click', openPrintView);

    Array.prototype.forEach.call(document.querySelectorAll('.seg[data-view]'), function (t) {
      t.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.seg[data-view]'), function (x) {
          x.classList.remove('on');
        });
        t.classList.add('on');
        pocView = t.dataset.view;
        renderPoc();
        window.scrollTo(0, 0);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSheet();
    });

    // Flush only genuinely pending edits; an unconditional write here would let
    // an idle tab overwrite records saved in another tab.
    window.addEventListener('beforeunload', function () {
      if (!dirty) return;
      clearTimeout(saveTimer);
      saveCurrent();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
