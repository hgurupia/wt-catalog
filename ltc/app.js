/* =========================================================================
   LTC Nurse Assessment - application logic
   Screens: home (patient list) -> assessment (15 sections) -> plan of care
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
  var dirty = false;      // unsaved edits to the active record

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
    ['home', 'assess', 'poc'].forEach(function (s) {
      el('screen-' + s).classList.toggle('on', s === which);
    });
    el('navPt').textContent = current && which !== 'home' ? nameOf(current) : '';
    window.scrollTo(0, 0);
  }

  /* ---------------- home ---------------- */
  function renderHome() {
    var box = el('ptList');
    if (!db.records.length) {
      box.innerHTML = '<div class="empty">No assessments yet. Start a new assessment to create the first record.</div>';
      return;
    }
    box.innerHTML = db.records.map(function (r) {
      var d = r.data || {};
      var pct = progressOf(r);
      return '<div class="pt-row">' +
        '<div class="pt-av">' + esc(initials(r)) + '</div>' +
        '<div class="pt-main">' +
        '<b>' + esc(nameOf(r)) + '</b>' +
        '<span>' + (d.dx_primary ? esc(d.dx_primary) + ' &middot; ' : '') +
        'SOC ' + esc(fmtDate(d.soc_date) || 'not set') + ' &middot; ' + pct + '% complete</span>' +
        '</div>' +
        '<div class="pt-acts">' +
        '<button class="btn ghost small" data-open="' + r.id + '">Open</button>' +
        '<button class="btn ghost small" data-poc="' + r.id + '">Plan of care</button>' +
        '<button class="btn ghost small" data-del="' + r.id + '">Delete</button>' +
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
    renderRail();
    renderSection();
  }

  function renderRail() {
    var d = current.data;
    el('railList').innerHTML = S.SECTIONS.map(function (sec, i) {
      var done = sectionDone(sec, d);
      return '<button class="rail-item' + (i === secIndex ? ' on' : '') + (done ? ' done' : '') + '" data-sec="' + i + '">' +
        '<span class="n">' + (done && i !== secIndex ? '&#10003;' : (i + 1)) + '</span>' +
        '<span class="lbl">' + esc(sec.title) + '</span></button>';
    }).join('');
    el('progBar').style.width = progressOf(current) + '%';
  }

  // Updates rail completion state without replacing the buttons. Replacing them
  // on blur would destroy the very button a click is landing on, swallowing the
  // first section click after typing in a field.
  function updateRailState() {
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
    var html = '<div class="sec-head"><div class="n">' + (secIndex + 1) + '</div><h2>' + esc(sec.title) + '</h2></div>';
    html += '<div class="grid">';
    sec.fields.forEach(function (f) { if (S.visible(f, d)) html += fieldHtml(f, d); });
    html += '</div>';
    html += '<div class="sec-nav">' +
      '<button class="btn ghost" id="btnPrev"' + (secIndex === 0 ? ' disabled' : '') + '>Previous</button>' +
      (secIndex === S.SECTIONS.length - 1
        ? '<button class="btn primary" id="btnFinish">Generate plan of care</button>'
        : '<button class="btn primary" id="btnNext">Next section</button>') +
      '</div>';
    el('secCard').innerHTML = html;
    wireSection();
  }

  function fieldHtml(f, d) {
    var span = 'grid-column:span ' + (f.col || 12);
    var v = d[f.id];

    if (f.type === 'note') return '<div class="note" style="' + span + '">' + esc(f.text) + '</div>';

    if (f.type === 'computed') {
      var res = S.COMPUTERS[f.compute](d);
      return '<div class="f" style="' + span + '"><label>' + esc(f.label) + '</label>' +
        '<div class="computed">' + esc(res.text) +
        (res.level && res.text !== '-' ? '<span class="tag ' + res.level + '">' + esc(res.tag || (res.level + ' risk')) + '</span>' : '') +
        '</div></div>';
    }

    var label = '<label for="fld_' + f.id + '">' + esc(f.label) + (f.required ? '<span class="req">*</span>' : '') + '</label>';

    if (f.type === 'textarea') {
      return '<div class="f" style="' + span + '">' + label +
        '<textarea id="fld_' + f.id + '" data-f="' + f.id + '"' + (f.rows ? ' rows="' + f.rows + '"' : '') +
        (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>' + esc(v || '') + '</textarea></div>';
    }
    if (f.type === 'select') {
      return '<div class="f" style="' + span + '">' + label +
        '<select id="fld_' + f.id + '" data-f="' + f.id + '" data-rerender="1">' +
        '<option value="">- select -</option>' +
        f.options.map(function (o) {
          return '<option value="' + esc(o) + '"' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select></div>';
    }
    if (f.type === 'radio') {
      return '<div class="f" style="' + span + '">' + label + '<div class="opts">' +
        f.options.map(function (o) {
          return '<label class="opt' + (v === o ? ' on' : '') + '">' +
            '<input type="radio" name="rad_' + f.id + '" data-f="' + f.id + '" data-rerender="1" value="' + esc(o) + '"' +
            (v === o ? ' checked' : '') + '>' + esc(o) + '</label>';
        }).join('') + '</div></div>';
    }
    if (f.type === 'checks') {
      var arr = Array.isArray(v) ? v : [];
      return '<div class="f" style="' + span + '">' + label + '<div class="opts">' +
        f.options.map(function (o) {
          return '<label class="opt' + (arr.indexOf(o) !== -1 ? ' on' : '') + '">' +
            '<input type="checkbox" data-fc="' + f.id + '" data-rerender="1" value="' + esc(o) + '"' +
            (arr.indexOf(o) !== -1 ? ' checked' : '') + '>' + esc(o) + '</label>';
        }).join('') + '</div></div>';
    }
    // text / number / date
    var type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
    return '<div class="f" style="' + span + '">' + label +
      '<input id="fld_' + f.id + '" data-f="' + f.id + '" type="' + type + '" value="' + esc(v || '') + '"' +
      (f.step ? ' step="' + f.step + '"' : '') +
      (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') +
      (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '></div>';
  }

  function wireSection() {
    var card = el('secCard');

    // free text / numbers / dates: save while typing, refresh computed values
    Array.prototype.forEach.call(card.querySelectorAll('input[data-f], textarea[data-f]'), function (node) {
      if (node.type === 'radio') return;
      node.addEventListener('input', function () {
        current.data[node.dataset.f] = node.value;
        scheduleSave();
        refreshComputed();
        updateRailState();
      });
      node.addEventListener('blur', updateRailState);
    });

    // selects and radios change conditional visibility -> re-render the section
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
        // "None"-style answers are exclusive
        var isNone = /^none/i.test(val) || val === 'None identified' || val === 'Intact / no issues' || val === 'Within normal limits';
        if (node.checked) {
          if (isNone) arr = [val];
          else arr = arr.filter(function (x) { return !(/^none/i.test(x) || x === 'None identified' || x === 'Intact / no issues' || x === 'Within normal limits'); }).concat([val]);
        } else {
          arr = arr.filter(function (x) { return x !== val; });
        }
        // keep the schema order
        current.data[id] = f.options.filter(function (o) { return arr.indexOf(o) !== -1; });
        scheduleSave(); renderAssess();
      });
    });

    var prev = el('btnPrev'), next = el('btnNext'), fin = el('btnFinish');
    if (prev) prev.addEventListener('click', function () { if (secIndex > 0) { secIndex--; renderAssess(); } });
    if (next) next.addEventListener('click', function () { if (secIndex < S.SECTIONS.length - 1) { secIndex++; renderAssess(); } });
    if (fin) fin.addEventListener('click', generatePoc);
  }

  function refreshComputed() {
    var sec = S.SECTIONS[secIndex], d = current.data;
    var comps = sec.fields.filter(function (f) { return f.type === 'computed' && S.visible(f, d); });
    if (!comps.length) return;
    var blocks = el('secCard').querySelectorAll('.computed');
    Array.prototype.forEach.call(blocks, function (n, i) {
      if (!comps[i]) return;
      var res = S.COMPUTERS[comps[i].compute](d);
      n.innerHTML = esc(res.text) +
        (res.level && res.text !== '-' ? '<span class="tag ' + res.level + '">' + esc(res.tag || (res.level + ' risk')) + '</span>' : '');
    });
  }

  /* ---------------- plan of care ---------------- */
  function generatePoc() {
    if (!current) return;
    var d = current.data;
    var missing = [];
    if (!d.pt_last && !d.pt_first) missing.push('patient name');
    if (!d.dx_primary) missing.push('primary diagnosis');
    if (!d.soc_date) missing.push('start of care date');
    if (missing.length && !confirm('The following are not documented: ' + missing.join(', ') +
      '.\n\nGenerate the plan of care anyway?')) return;

    lastPoc = ENGINE.generate(d);
    current.poc = { generatedAt: lastPoc.generatedAt };
    persist();
    show('poc');
    renderPoc();
  }

  function renderPoc() {
    var d = current.data, poc = lastPoc;
    var body = el('pocBody');
    if (pocView === 'narrative') { body.innerHTML = narrativeHtml(d, poc); wirePocBody(); return; }
    if (pocView === 'summary') { body.innerHTML = summaryHtml(d); return; }

    var h = '';

    if (poc.urgent.length) {
      h += '<div class="alert"><b>Immediate action required</b><ul>' +
        poc.urgent.map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') + '</ul></div>';
    }

    /* header block */
    h += '<div class="card"><div class="poc-head">' +
      '<div><h2 style="font-size:22px">Personalized Plan of Care</h2>' +
      '<p class="muted small" style="margin:4px 0 0">' + esc(nameOf(current)) +
      (d.pt_mrn ? ' &middot; MRN ' + esc(d.pt_mrn) : '') +
      (d.pt_dob ? ' &middot; DOB ' + esc(fmtDate(d.pt_dob)) : '') + '</p></div>' +
      '<div class="chips">' +
      '<span class="chip teal">' + poc.problems.length + ' problems</span>' +
      '<span class="chip ' + (poc.scores.morse.level === 'high' ? 'warn' : '') + '">Fall risk: ' + esc(poc.scores.morse.risk) + '</span>' +
      (poc.scores.braden.complete ? '<span class="chip ' + (poc.scores.braden.level === 'high' ? 'warn' : '') + '">Braden ' + poc.scores.braden.value + '</span>' : '') +
      (poc.scores.phq2.positive ? '<span class="chip warn">PHQ-2 positive</span>' : '') +
      '</div></div>';

    h += '<div class="kv">' +
      kv('Start of care', fmtDate(d.soc_date) || 'not set') +
      kv('Certification period', poc.certStart ? fmtDate(poc.certStart) + ' - ' + fmtDate(poc.certEnd) : 'set SOC date') +
      kv('Primary diagnosis', d.dx_primary || 'not documented') +
      kv('Physician', d.md_name || 'not documented') +
      kv('Payer', d.payer || 'not documented') +
      kv('Allergies', d.allergies || 'not documented') +
      kv('Emergency triage', (d.emerg_triage || 'not set').split(' - ')[0]) +
      kv('Prognosis', d.prognosis || 'not documented') +
      '</div>';

    /* orders */
    h += '<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:20px 0 8px">Disciplines &amp; frequency</h3>';
    h += '<div class="chips">' + poc.disciplines.map(function (x) {
      return '<span class="chip teal">' + esc(x.name) + (x.source === 'indicated' ? ' <span style="opacity:.6">(indicated)</span>' : '') + '</span>';
    }).join('') + '</div>';
    h += '<div class="kv" style="margin-top:12px">' +
      kv('Skilled nursing frequency', d.sn_frequency || poc.suggestedFrequency + ' (suggested)') +
      kv('Therapy frequency', d.therapy_frequency || 'per therapy evaluation') +
      kv('Aide frequency', d.aide_frequency || 'not ordered') +
      kv('Homebound', (function () {
        var hb = Array.isArray(d.homebound) ? d.homebound : [];
        return hb.length ? hb.length + ' criteria met' : 'not documented';
      })()) + '</div>';

    /* safety */
    h += '<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:20px 0 8px">Safety measures</h3>' +
      '<div class="chips">' + poc.safety.map(function (s) { return '<span class="chip">' + esc(s) + '</span>'; }).join('') + '</div>';

    /* DME */
    var dme = (Array.isArray(d.dme_current) ? d.dme_current : []).filter(function (x) { return x !== 'None'; });
    h += '<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:20px 0 8px">Equipment &amp; supplies</h3>' +
      '<p class="small" style="margin:0">' + (dme.length ? esc(dme.join(', ')) : 'None in the home') +
      (d.dme_needed ? '<br><b>To be ordered:</b> ' + esc(d.dme_needed) : '') + '</p>';

    if (d.diet_order || d.labs_ordered) {
      h += '<div class="kv" style="margin-top:16px">' +
        (d.diet_order ? kv('Diet', d.diet_order) : '') +
        (d.labs_ordered ? kv('Labs / diagnostics', d.labs_ordered) : '') + '</div>';
    }
    h += '</div>'; // header card

    /* problem list */
    h += '<div class="card" style="margin-top:16px">' +
      '<h2 style="font-size:19px">Problem list, goals &amp; interventions</h2>' +
      '<p class="muted small" style="margin:4px 0 0">Generated from the documented assessment findings and ordered by priority. ' +
      'Review, individualize and obtain physician approval before implementation.</p>';

    poc.problems.forEach(function (p, i) {
      h += '<div class="prob"><div class="prob-h"><div class="n">' + (i + 1) + '</div>' +
        '<h3>' + esc(p.problem) + '</h3>' +
        '<span class="chip ' + (p.priority === 1 ? 'warn' : 'teal') + '">Priority ' + p.priority + '</span></div>';
      if (p.disciplines.length) {
        h += '<div class="chips" style="margin-bottom:4px">' + p.disciplines.map(function (c) {
          return '<span class="chip">' + esc(ENGINE.DISC_NAMES[c] || c) + '</span>';
        }).join('') + '</div>';
      }
      h += '<h5>Goals / expected outcomes</h5><ul>' +
        p.goals.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>';
      h += '<h5>Interventions</h5><ul>' +
        p.interventions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      h += '</div>';
    });

    if (d.poc_notes) {
      h += '<div class="prob"><div class="prob-h"><div class="n">+</div><h3>Additional orders and clinician notes</h3></div>' +
        '<p style="margin:0;white-space:pre-wrap;font-size:14px">' + esc(d.poc_notes) + '</p></div>';
    }

    /* goals in the patient's words + discharge */
    if (d.patient_goals || d.caregiver_goals || d.discharge_plan) {
      h += '<div class="prob"><div class="prob-h"><div class="n">&#9733;</div><h3>Patient-centered goals &amp; discharge plan</h3></div>';
      if (d.patient_goals) h += '<h5>Patient-stated goals</h5><p style="margin:0;font-size:14px">' + esc(d.patient_goals) + '</p>';
      if (d.caregiver_goals) h += '<h5>Caregiver goals &amp; learning needs</h5><p style="margin:0;font-size:14px">' + esc(d.caregiver_goals) + '</p>';
      if (d.discharge_plan) h += '<h5>Anticipated discharge plan</h5><p style="margin:0;font-size:14px">' + esc(d.discharge_plan) + '</p>';
      h += '</div>';
    }

    /* signatures */
    h += '<div class="sig">' +
      '<div><div class="line"></div>Assessing clinician (RN) - ' + esc(d.nurse_name || '') + '<br>Date: ' + esc(fmtDate(d.visit_date) || '') + '</div>' +
      '<div><div class="line"></div>Physician signature - ' + esc(d.md_name || '') + '<br>Date: ______________</div>' +
      '</div>';
    h += '<p class="xsmall muted" style="margin-top:18px">Generated ' + new Date(poc.generatedAt).toLocaleString() +
      '. Clinical decision support only - content must be reviewed by the assessing licensed clinician and signed by the physician before it becomes the plan of care.</p>';
    h += '</div>';

    /* CTA */
    h += '<div class="cta no-print"><div><h3>Ready for the chart</h3>' +
      '<p>Print or save this plan of care as a PDF for the physician signature packet, or export the full record as JSON to move it into your clinical system.</p></div>' +
      '<div style="display:flex;gap:10px"><button class="btn" id="ctaPrint">Print / save as PDF</button>' +
      '<button class="btn ghost" id="ctaBack" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.35)">Edit assessment</button></div></div>';

    body.innerHTML = h;
    wirePocBody();
  }

  function kv(label, value) {
    return '<div><b>' + esc(label) + '</b><span>' + esc(value) + '</span></div>';
  }

  function narrativeHtml(d, poc) {
    var text = ENGINE.narrative(d, poc);
    return '<div class="card"><div class="poc-head"><div><h2 style="font-size:20px">Start of care narrative note</h2>' +
      '<p class="muted small" style="margin:4px 0 0">Assembled from the documented assessment. Edit as needed after copying into the clinical record.</p></div>' +
      '<button class="btn ghost small no-print" id="btnCopy">Copy text</button></div>' +
      '<pre class="narrative" id="narrativeText">' + esc(text) + '</pre></div>';
  }

  function summaryHtml(d) {
    var h = '<div class="card"><h2 style="font-size:20px">Assessment summary</h2>' +
      '<p class="muted small" style="margin:4px 0 14px">Everything documented for this patient. Unanswered items are omitted.</p>';
    S.SECTIONS.forEach(function (sec) {
      var rows = sec.fields.filter(function (f) {
        if (f.type === 'note') return false;
        if (!S.visible(f, d)) return false;
        if (f.type === 'computed') return true;
        var v = d[f.id];
        return Array.isArray(v) ? v.length : (v !== undefined && v !== null && v !== '');
      });
      if (!rows.length) return;
      h += '<h3 style="font-size:14px;margin:18px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line)">' + esc(sec.title) + '</h3>';
      h += '<div class="kv" style="grid-template-columns:repeat(2,1fr)">';
      rows.forEach(function (f) {
        var val;
        if (f.type === 'computed') { val = S.COMPUTERS[f.compute](d).text; if (val === '-') return; }
        else val = Array.isArray(d[f.id]) ? d[f.id].join('; ') : d[f.id];
        h += kv(f.label, val);
      });
      h += '</div>';
    });
    return h + '</div>';
  }

  function wirePocBody() {
    var c = el('ctaPrint'); if (c) c.addEventListener('click', function () { window.print(); });
    var b = el('ctaBack'); if (b) b.addEventListener('click', function () { show('assess'); renderAssess(); });
    var cp = el('btnCopy');
    if (cp) cp.addEventListener('click', function () {
      var t = el('narrativeText').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('Narrative copied'); },
        function () { toast('Copy failed - select the text manually'); });
      else toast('Copy not supported in this browser');
    });
  }

  /* ---------------- import / export ---------------- */
  function exportRecord() {
    if (!current) return;
    var payload = {
      format: 'ltc-soc-assessment',
      version: 1,
      exported: new Date().toISOString(),
      record: current,
      planOfCare: lastPoc || ENGINE.generate(current.data),
      narrative: ENGINE.narrative(current.data, lastPoc || ENGINE.generate(current.data))
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (nameOf(current).replace(/[^a-z0-9]+/gi, '_') || 'record') + '_SOC_' + (current.data.soc_date || today()) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Record exported');
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

    el('btnNew').addEventListener('click', newRecord);
    el('navNew').addEventListener('click', newRecord);
    el('navHome').addEventListener('click', function () { show('home'); renderHome(); });
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

    el('railList').addEventListener('click', function (e) {
      var b = e.target.closest('.rail-item'); if (!b) return;
      secIndex = parseInt(b.dataset.sec, 10);
      renderAssess();
    });

    el('btnGenerate').addEventListener('click', generatePoc);
    el('btnBackAssess').addEventListener('click', function () { show('assess'); renderAssess(); });
    el('btnExport').addEventListener('click', exportRecord);
    el('btnPrint').addEventListener('click', function () { window.print(); });

    Array.prototype.forEach.call(document.querySelectorAll('.tab[data-view]'), function (t) {
      t.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.tab[data-view]'), function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        pocView = t.dataset.view;
        renderPoc();
      });
    });

    window.addEventListener('beforeprint', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (s) {
        s.classList.toggle('print-me', s.classList.contains('on'));
      });
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
