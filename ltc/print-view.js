/* =========================================================================
   Print view - lays the plan of care and the start of care note onto real
   letter-size pages, on screen. Browsers embedded in another page often
   refuse window.print(), so the preview is the document: same pagination,
   same running header and footer, same page numbering that comes out of the
   printer. The Print button still calls window.print() where it is allowed.
   ========================================================================= */
(function (root) {
  'use strict';

  var PAGE_W = 816;     // 8.5in at 96dpi
  var PAGE_H = 1056;    // 11in
  var MARGIN = 56;
  var HEAD_H = 52;   // running header plus the gap under it
  var FOOT_H = 34;
  var BODY_H = PAGE_H - (MARGIN * 2) - HEAD_H - FOOT_H;
  var BODY_W = PAGE_W - (MARGIN * 2);

  var host = null, measure = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(s) {
    if (!s) return '';
    var d = new Date(s + 'T00:00:00');
    if (isNaN(d)) return s;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function ptName(rec) {
    var d = rec.data || {};
    return [d.pt_last, d.pt_first].filter(Boolean).join(', ') || 'Unnamed patient';
  }

  /* ---------------- content, as atoms that can be packed onto pages ------- */
  function atom(html, opts) {
    opts = opts || {};
    return { html: html, keepWithNext: !!opts.keepWithNext, newPage: !!opts.newPage };
  }

  function buildAtoms(rec, poc, narrative) {
    var d = rec.data, out = [];

    out.push(atom('<h1 class="pv-h1">Plan of Care</h1>' +
      '<p class="pv-sub">Home health start of care &middot; certification period ' +
      esc(poc.certStart ? fmtDate(poc.certStart) + ' to ' + fmtDate(poc.certEnd) : 'not set') + '</p>',
      { keepWithNext: true }));

    out.push(atom(kvTable([
      ['Patient', ptName(rec)],
      ['Medical record #', d.pt_mrn || '-'],
      ['Date of birth', fmtDate(d.pt_dob) || '-'],
      ['Start of care', fmtDate(d.soc_date) || '-'],
      ['Physician', d.md_name || '-'],
      ['Physician phone', d.md_phone || '-'],
      ['Payer', d.payer || '-'],
      ['Allergies', d.allergies || 'NKDA'],
      ['Primary diagnosis', d.dx_primary || '-'],
      ['Other diagnoses', (d.dx_secondary || '-').split('\n').filter(Boolean).join('; ')],
      ['Emergency contact', [d.emerg_name, d.emerg_rel, d.emerg_phone].filter(Boolean).join(', ') || '-'],
      ['Emergency triage', d.emerg_triage || '-']
    ])));

    out.push(atom('<h2 class="pv-h2">Homebound status</h2>', { keepWithNext: true }));
    var hb = Array.isArray(d.homebound) ? d.homebound : [];
    out.push(atom('<p class="pv-p">' + (hb.length ? esc(hb.join('; ')) + '.' : 'Not documented.') +
      (d.homebound_narrative ? ' ' + esc(d.homebound_narrative) : '') + '</p>'));

    out.push(atom('<h2 class="pv-h2">Orders: disciplines and frequency</h2>', { keepWithNext: true }));
    out.push(atom(kvTable([
      ['Disciplines', poc.disciplines.map(function (x) { return x.name; }).join(', ') || '-'],
      ['Skilled nursing', d.sn_frequency || poc.suggestedFrequency + ' (suggested)'],
      ['Therapy', d.therapy_frequency || 'per therapy evaluation'],
      ['Home health aide', d.aide_frequency || 'not ordered'],
      ['Diet', d.diet_order || '-'],
      ['Labs / diagnostics', d.labs_ordered || '-'],
      ['Equipment in the home', (Array.isArray(d.dme_current) ? d.dme_current : [])
        .filter(function (x) { return x !== 'None'; }).join(', ') || 'None'],
      ['Equipment to order', d.dme_needed || '-']
    ])));

    out.push(atom('<h2 class="pv-h2">Risk scores</h2>', { keepWithNext: true }));
    out.push(atom(kvTable([
      ['Morse Fall Scale', poc.scores.morse.value + ' - ' + poc.scores.morse.risk],
      ['Braden Scale', poc.scores.braden.complete ? poc.scores.braden.value + ' - ' + poc.scores.braden.risk : 'not completed'],
      ['PHQ-2', poc.scores.phq2.text === '-' ? 'not completed' : poc.scores.phq2.text],
      ['BMI', poc.scores.bmi.text === '-' ? 'not calculated' : poc.scores.bmi.text]
    ])));

    out.push(atom('<h2 class="pv-h2">Safety measures</h2>', { keepWithNext: true }));
    out.push(atom('<ul class="pv-ul">' + poc.safety.map(function (s) {
      return '<li>' + esc(s) + '</li>';
    }).join('') + '</ul>'));

    if (poc.urgent.length) {
      out.push(atom('<h2 class="pv-h2">Immediate actions</h2>', { keepWithNext: true }));
      poc.urgent.forEach(function (u) { out.push(atom('<p class="pv-p pv-urgent">' + esc(u) + '</p>')); });
    }

    /* problem list */
    out.push(atom('<h2 class="pv-h2 pv-rule">Problems, goals and interventions</h2>', { keepWithNext: true }));
    poc.problems.forEach(function (p, i) {
      out.push(atom('<h3 class="pv-h3"><span class="pv-num">' + (i + 1) + '</span>' + esc(p.problem) +
        '<span class="pv-pri">Priority ' + p.priority + ' &middot; ' +
        esc(p.disciplines.map(function (c) { return c; }).join(', ')) + '</span></h3>',
        { keepWithNext: true }));
      out.push(atom('<p class="pv-label">Goals / expected outcomes</p>', { keepWithNext: true }));
      p.goals.forEach(function (g, n) {
        out.push(atom('<ul class="pv-ul"><li>' + esc(g) + '</li></ul>',
          { keepWithNext: n === 0 && p.goals.length > 1 }));
      });
      out.push(atom('<p class="pv-label">Interventions</p>', { keepWithNext: true }));
      p.interventions.forEach(function (x, n) {
        out.push(atom('<ul class="pv-ul"><li>' + esc(x) + '</li></ul>',
          { keepWithNext: n === 0 && p.interventions.length > 1 }));
      });
    });

    /* goals in the patient's words */
    if (d.patient_goals || d.caregiver_goals || d.discharge_plan || d.poc_notes) {
      out.push(atom('<h2 class="pv-h2 pv-rule">Patient-centered goals and discharge plan</h2>', { keepWithNext: true }));
      if (d.patient_goals) {
        out.push(atom('<p class="pv-label">Patient-stated goals</p>', { keepWithNext: true }));
        out.push(atom('<p class="pv-p">' + esc(d.patient_goals) + '</p>'));
      }
      if (d.caregiver_goals) {
        out.push(atom('<p class="pv-label">Caregiver goals and learning needs</p>', { keepWithNext: true }));
        out.push(atom('<p class="pv-p">' + esc(d.caregiver_goals) + '</p>'));
      }
      if (d.discharge_plan) {
        out.push(atom('<p class="pv-label">Anticipated discharge plan</p>', { keepWithNext: true }));
        out.push(atom('<p class="pv-p">' + esc(d.discharge_plan) + ' Rehabilitation prognosis ' +
          esc((d.prognosis || 'not documented').toLowerCase()) + '.</p>'));
      }
      if (d.poc_notes) {
        out.push(atom('<p class="pv-label">Additional orders and clinician notes</p>', { keepWithNext: true }));
        out.push(atom('<p class="pv-p">' + esc(d.poc_notes) + '</p>'));
      }
    }

    /* signatures */
    out.push(atom('<h2 class="pv-h2 pv-rule">Signatures</h2>', { keepWithNext: true }));
    out.push(atom('<div class="pv-sig">' +
      '<div><div class="pv-line"></div>Assessing clinician (RN)' +
      (d.nurse_name ? ' - ' + esc(d.nurse_name) : '') +
      '<br>Date: ' + esc(fmtDate(d.visit_date) || '______________') + '</div>' +
      '<div><div class="pv-line"></div>Physician' +
      (d.md_name ? ' - ' + esc(d.md_name) : '') +
      '<br>Date: ______________</div></div>'));
    out.push(atom('<p class="pv-fine">Clinical decision support only. Reviewed and individualized by the ' +
      'assessing licensed clinician; requires physician review and signature before implementation. ' +
      'Generated ' + esc(new Date(poc.generatedAt).toLocaleString()) + '.</p>'));

    /* start of care note, on its own page */
    out.push(atom('<h1 class="pv-h1">Start of Care Note</h1>', { newPage: true, keepWithNext: true }));
    narrative.split('\n\n').forEach(function (para) {
      if (!para.trim()) return;
      out.push(atom('<p class="pv-p pv-pre">' + esc(para.trim()) + '</p>'));
    });

    return out;
  }

  function kvTable(rows) {
    return '<table class="pv-kv">' + rows.map(function (r) {
      return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>';
    }).join('') + '</table>';
  }

  /* ---------------- pack atoms onto pages ---------------- */
  function paginate(atoms) {
    measure.style.width = BODY_W + 'px';
    var pages = [], page = [], used = 0;

    function flush() { if (page.length) { pages.push(page); page = []; used = 0; } }

    for (var i = 0; i < atoms.length; i++) {
      var a = atoms[i];
      if (a.newPage) flush();
      measure.innerHTML = a.html;
      var h = measure.offsetHeight;

      if (used + h > BODY_H && page.length) { flush(); }

      // a label must not be stranded as the last line on a page
      if (a.keepWithNext && page.length) {
        var next = atoms[i + 1];
        if (next) {
          measure.innerHTML = next.html;
          var hNext = measure.offsetHeight;
          if (used + h + hNext > BODY_H) flush();
        }
      }
      page.push(a.html);
      used += h;
    }
    flush();
    return pages;
  }

  /* ---------------- render ---------------- */
  function open(rec, poc, narrative) {
    close();
    var pages = [];
    host = document.createElement('div');
    host.className = 'pv';
    host.innerHTML =
      '<div class="pv-bar no-print">' +
      '<button class="pv-x" id="pvClose" aria-label="Close print view">&#8249;</button>' +
      '<div class="pv-bar-t"><b>Print view</b><span id="pvCount">paginating…</span></div>' +
      '<button class="pv-print" id="pvPrint">Print</button>' +
      '</div>' +
      '<div class="pv-scroll"><div class="pv-stage" id="pvStage"><div class="pv-pages" id="pvPages"></div></div>' +
      '<p class="pv-hint no-print" id="pvHint">Letter, portrait. This is exactly what comes out of the printer or the PDF.</p></div>';
    document.body.appendChild(host);
    document.body.classList.add('pv-open');

    measure = document.createElement('div');
    measure.className = 'pv-measure';
    document.body.appendChild(measure);

    pages = paginate(buildAtoms(rec, poc, narrative));

    var head = esc(ptName(rec)) + (rec.data.pt_mrn ? ' &middot; MRN ' + esc(rec.data.pt_mrn) : '') +
      ' &middot; SOC ' + esc(fmtDate(rec.data.soc_date) || 'not set');
    document.getElementById('pvPages').innerHTML = pages.map(function (blocks, i) {
      return '<div class="pv-page"><div class="pv-page-in">' +
        '<div class="pv-head"><span>' + head + '</span><span>Plan of Care</span></div>' +
        '<div class="pv-body">' + blocks.join('') + '</div>' +
        '<div class="pv-foot"><span>' + esc(rec.data.md_name ? 'For physician review and signature' : 'Requires physician signature') + '</span>' +
        '<span>Page ' + (i + 1) + ' of ' + pages.length + '</span></div>' +
        '</div></div>';
    }).join('');
    document.getElementById('pvCount').textContent = pages.length + (pages.length === 1 ? ' page' : ' pages');

    measure.remove(); measure = null;
    fit();
    window.addEventListener('resize', fit);
    document.getElementById('pvClose').addEventListener('click', close);
    var printed = false;
    var onBefore = function () { printed = true; };
    window.addEventListener('beforeprint', onBefore);
    document.getElementById('pvPrint').addEventListener('click', function () {
      printed = false;
      try { window.print(); } catch (e) { /* handled below */ }
      // an embedded viewer refuses silently, so say so instead of leaving them waiting
      setTimeout(function () { if (!printed) blocked(); }, 700);
    });
  }

  function blocked() {
    var hint = document.getElementById('pvHint');
    if (hint) {
      hint.textContent = 'This browser view will not let a page start a print job. ' +
        'Open the app in its own tab to print or save as PDF - the pages above are what it produces.';
      hint.classList.add('pv-hint-warn');
    }
  }

  // scale the fixed-width pages down to whatever the screen actually is
  function fit() {
    if (!host) return;
    var wrap = host.querySelector('.pv-scroll');
    var stage = host.querySelector('.pv-stage');
    var pages = host.querySelector('.pv-pages');
    if (!wrap || !stage || !pages) return;
    var avail = wrap.clientWidth - 24;
    var scale = Math.min(1, avail / PAGE_W);
    pages.style.transform = 'scale(' + scale + ')';
    pages.style.marginLeft = Math.max(0, (avail - PAGE_W * scale) / 2) + 'px';
    stage.style.height = (pages.scrollHeight * scale) + 'px';
  }

  function close() {
    window.removeEventListener('resize', fit);
    if (host) { host.remove(); host = null; }
    if (measure) { measure.remove(); measure = null; }
    document.body.classList.remove('pv-open');
  }

  root.LTC_PRINT = { open: open, close: close };
})(window);
