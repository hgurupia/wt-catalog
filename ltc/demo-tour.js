/* =========================================================================
   Guided demo - drives the real interface so a viewer can watch the program
   document a patient, watch the risk scores move, and see the plan of care
   assemble itself. Nothing is faked: every step taps the same controls a
   clinician taps, on the same fields.
   Loaded only by demo.html.
   ========================================================================= */
(function (root) {
  'use strict';

  var state = { running: false, paused: false, cancel: null, skip: null, step: 0, total: 0 };
  var bar, capEl, countEl, pauseBtn;

  /* ---------------- chrome ---------------- */
  function buildBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'tour-bar';
    bar.innerHTML =
      '<div class="tour-top"><span class="tour-count" id="tourCount">1 / 1</span>' +
      '<button class="tour-x" id="tourExit" aria-label="End the guided demo">&#10005;</button></div>' +
      '<p class="tour-cap" id="tourCap"></p>' +
      '<div class="tour-acts">' +
      '<button class="tour-btn" id="tourPause">Pause</button>' +
      '<button class="tour-btn" id="tourSkip">Skip step</button>' +
      '</div>';
    document.body.appendChild(bar);
    capEl = document.getElementById('tourCap');
    countEl = document.getElementById('tourCount');
    pauseBtn = document.getElementById('tourPause');
    document.getElementById('tourExit').addEventListener('click', stop);
    pauseBtn.addEventListener('click', togglePause);
    document.getElementById('tourSkip').addEventListener('click', function () {
      if (state.skip) state.skip();
    });
  }

  function fitBar() {
    if (!bar) return;
    document.documentElement.style.setProperty('--tour-h', bar.offsetHeight + 'px');
  }

  function togglePause() {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
    bar.classList.toggle('paused', state.paused);
  }

  /* ---------------- timing ---------------- */
  function sleep(ms) {
    return new Promise(function (resolve, reject) {
      var left = ms, last = Date.now(), timer;
      state.cancel = function () { clearInterval(timer); reject(new Error('cancelled')); };
      state.skip = function () { clearInterval(timer); state.skip = null; resolve(); };
      timer = setInterval(function () {
        var now = Date.now();
        if (!state.paused) left -= now - last;
        last = now;
        if (left <= 0) { clearInterval(timer); state.skip = null; resolve(); }
      }, 50);
    });
  }

  function caption(text, ms) {
    state.step++;
    capEl.textContent = text;
    countEl.textContent = state.step + ' / ' + state.total;
    fitBar();
    return sleep(ms == null ? 2600 : ms);
  }

  /* ---------------- dom helpers ---------------- */
  function q(sel) { return document.querySelector(sel); }

  function waitFor(sel, ms) {
    var limit = ms || 3000, waited = 0;
    return new Promise(function (resolve, reject) {
      (function poll() {
        var el = q(sel);
        if (el) return resolve(el);
        waited += 60;
        if (waited >= limit) return reject(new Error('missing ' + sel));
        setTimeout(poll, 60);
      })();
    });
  }

  function reveal(el) {
    if (!el) return;
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
  }

  function spot(el, ms) {
    if (!el) return Promise.resolve();
    reveal(el);
    el.classList.add('tour-spot');
    return sleep(ms || 700).then(function () { el.classList.remove('tour-spot'); },
      function (e) { el.classList.remove('tour-spot'); throw e; });
  }

  function tap(sel, ms) {
    var el = typeof sel === 'string' ? q(sel) : sel;
    if (!el) return sleep(120);
    return spot(el, ms || 620).then(function () { el.click(); return sleep(320); });
  }

  // native setter + events, so the app's own handlers run exactly as they would
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }

  function setValue(el, value) {
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, value); else el.value = value;
  }

  function typeInto(sel, text, perChar) {
    return waitFor(sel).then(function (el) {
      reveal(el);
      el.classList.add('tour-spot');
      var i = 0;
      return new Promise(function (resolve, reject) {
        state.cancel = function () { el.classList.remove('tour-spot'); reject(new Error('cancelled')); };
        (function tick() {
          if (state.paused) return setTimeout(tick, 120);
          i++;
          setValue(el, text.slice(0, i));
          fire(el, 'input');
          if (i >= text.length) {
            el.classList.remove('tour-spot');
            return setTimeout(resolve, 260);
          }
          setTimeout(tick, perChar || 26);
        })();
      });
    }, function () { return sleep(100); });
  }

  function fill(sel, value) {
    return waitFor(sel).then(function (el) {
      return spot(el, 420).then(function () {
        setValue(el, value); fire(el, 'input'); return sleep(240);
      });
    }, function () { return sleep(100); });
  }

  function choose(sel, value) {
    return waitFor(sel).then(function (el) {
      return spot(el, 480).then(function () {
        el.value = value; fire(el, 'change'); return sleep(420);
      });
    }, function () { return sleep(100); });
  }

  function tick(fieldId, optionValue) {
    var sel = 'input[data-fc="' + fieldId + '"][value="' + cssEscape(optionValue) + '"]';
    return waitFor(sel).then(function (el) {
      return spot(el.closest('.opt') || el, 420).then(function () {
        el.click(); return sleep(360);
      });
    }, function () { return sleep(100); });
  }

  function cssEscape(v) { return String(v).replace(/"/g, '\\"'); }

  function toSection(index) {
    return tap('#btnPicker', 520)
      .then(function () { return waitFor('.sheet-item[data-sec="' + index + '"]'); })
      .then(function (el) { return tap(el, 520); })
      .then(function () { return sleep(260); });
  }

  /* ---------------- the script ---------------- */
  function run() {
    var S = 0;
    return Promise.resolve()
      .then(function () {
        return caption('This is a start of care visit. The nurse opens a new assessment at the bedside.', 2600);
      })
      .then(function () { return tap('#btnNew'); })
      .then(function () {
        return caption('Section 1 is the patient and the visit. Typing here is all the setup there is.', 2400);
      })
      .then(function () { return typeInto('#fld_pt_last', 'Rivera'); })
      .then(function () { return typeInto('#fld_pt_first', 'Marta'); })
      .then(function () { return fill('#fld_pt_dob', '1945-03-02'); })
      .then(function () { return choose('#fld_pt_sex', 'Female'); })
      .then(function () {
        return caption('Section 2 carries the referral, the diagnoses and why the patient is homebound.', 2400);
      })
      .then(function () { return toSection(1); })
      .then(function () { return typeInto('#fld_dx_primary', 'Chronic systolic heart failure (I50.22)', 18); })
      .then(function () { return tick('homebound', 'Requires assistance of another person to leave home'); })
      .then(function () { return tick('homebound', 'Severe dyspnea / activity intolerance on exertion'); })
      .then(function () {
        return caption('Now fall risk. Watch the Morse score and its risk level move as each answer lands.', 2800);
      })
      .then(function () { return toSection(11); })
      .then(function () { return choose('#fld_morse_history', '25 - Yes'); })
      .then(function () { return choose('#fld_morse_secondary', '15 - Yes'); })
      .then(function () { return choose('#fld_morse_aid', '15 - Crutches / cane / walker'); })
      .then(function () { return choose('#fld_morse_iv', '0 - No'); })
      .then(function () { return choose('#fld_morse_gait', '20 - Impaired'); })
      .then(function () { return choose('#fld_morse_mental', '15 - Overestimates or forgets limits'); })
      .then(function () { return spot(q('#secCard .computed'), 1600); })
      .then(function () {
        return caption('High fall risk. That one score will pull physical therapy and fall precautions into the plan.', 2800);
      })
      .then(function () {
        return caption('The Braden Scale works the same way for pressure injury risk.', 2200);
      })
      .then(function () { return toSection(5); })
      .then(function () { return choose('#fld_braden_activity', '2 - Chairfast'); })
      .then(function () { return choose('#fld_braden_mobility', '2 - Very limited'); })
      .then(function () { return choose('#fld_braden_nutrition', '2 - Probably inadequate'); })
      .then(function () { return choose('#fld_braden_sensory', '3 - Slightly limited'); })
      .then(function () { return choose('#fld_braden_moisture', '3 - Occasionally moist'); })
      .then(function () { return choose('#fld_braden_friction', '2 - Potential problem'); })
      .then(function () { return spot(q('#secCard .computed:last-of-type') || q('#secCard .computed'), 1500); })
      .then(function () {
        return caption('Medications next. Marking the high-alert classes is what triggers the safety teaching.', 2600);
      })
      .then(function () { return toSection(12); })
      .then(function () { return fill('#fld_med_count', '11'); })
      .then(function () { return tick('med_classes', 'Anticoagulant / antiplatelet'); })
      .then(function () { return tick('med_classes', 'Insulin'); })
      .then(function () {
        return caption('That is enough documentation. The plan of care is built from it - nothing is typed twice.', 2800);
      })
      .then(function () { return tap('#btnPicker', 520); })
      .then(function () { return tap('#btnGenerate', 700); })
      .then(function () { return sleep(700); })
      .then(function () {
        return caption('Here it is: the problem list, ordered by priority, with the scores that drove it.', 3000);
      })
      .then(function () { return spot(q('#pocBody .chips'), 1500); })
      .then(function () {
        return caption('Every problem opens to measurable goals and skilled interventions, written from this patient’s own findings.', 3000);
      })
      .then(function () {
        var probs = document.querySelectorAll('#pocBody details.prob');
        return tap(probs[1] ? probs[1].querySelector('summary') : null, 700);
      })
      .then(function () { return sleep(1600); })
      .then(function () {
        return caption('The start of care note is written from the same assessment, ready for the chart.', 2600);
      })
      .then(function () { return tap('.seg[data-view="narrative"]', 620); })
      .then(function () { return sleep(2200); })
      .then(function () {
        return caption('That is the whole visit: assess once, and the plan of care and the note come with it. Explore it yourself from here.', 4200);
      });
  }

  /* ---------------- lifecycle ---------------- */
  function start() {
    if (state.running) return;
    buildBar();
    state.running = true; state.paused = false; state.step = 0; state.total = 12;
    pauseBtn.textContent = 'Pause';
    document.body.classList.add('tour-on');
    bar.classList.add('on');
    capEl.textContent = 'Starting the guided demo…';
    countEl.textContent = '0 / ' + state.total;
    fitBar();
    window.addEventListener('resize', fitBar);

    run().then(finish, function (e) {
      if (e && e.message === 'cancelled') return;
      finish();
    });
  }

  function finish() {
    if (!state.running) return;
    capEl.textContent = 'Demo complete. Tap anything to keep exploring, or run it again.';
    countEl.textContent = state.total + ' / ' + state.total;
    bar.querySelector('.tour-acts').innerHTML =
      '<button class="tour-btn" id="tourAgain">Run it again</button>' +
      '<button class="tour-btn" id="tourDone">Close</button>';
    document.getElementById('tourAgain').addEventListener('click', function () { stop(); setTimeout(start, 260); });
    document.getElementById('tourDone').addEventListener('click', stop);
    fitBar();
    state.running = false;
  }

  function stop() {
    var wasRunning = state.running;
    state.running = false; state.paused = false;
    if (state.cancel && wasRunning) { try { state.cancel(); } catch (e) {} }
    state.cancel = null; state.skip = null;
    Array.prototype.forEach.call(document.querySelectorAll('.tour-spot'), function (n) {
      n.classList.remove('tour-spot');
    });
    document.body.classList.remove('tour-on');
    if (bar) { bar.classList.remove('on'); bar.remove(); bar = null; }
    document.documentElement.style.removeProperty('--tour-h');
    window.removeEventListener('resize', fitBar);
  }

  root.LTC_TOUR = { start: start, stop: stop, isRunning: function () { return state.running; } };
})(window);
