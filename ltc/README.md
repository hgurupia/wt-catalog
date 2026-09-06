# LTC Nurse Assessment — Start of Care & Plan of Care

A self-contained web program for a home health agency. The long term care nurse
completes the comprehensive **Start of Care (SOC) assessment** at the bedside, and the
program builds the **personalized Plan of Care** from what was documented.

Open `ltc/index.html` in a browser — no build step, no server, no dependencies.

It is built mobile first: a phone-width column with a sticky header, a section sheet,
a bottom action bar, 48px touch targets, 16px inputs (so iOS does not zoom on focus)
and safe-area insets. On a tablet or desktop the same column centers and short fields
pair up two per row. `manifest.json` lets a clinician add it to the home screen and run
it full screen.

**Want to see it working first?** Open `ltc/demo.html` — one self-contained file with
three fictional patients already documented, so the assessment, the scores and the
generated plan of care are all populated on open. It uses a separate storage key, so
nothing you do in the demo touches real records. Rebuild it with `python3 build-demo.py` after changing any source file (it inlines
them); see `demo-data.js` for the sample patients.

## What it does

**1. Assess** — 15 sections covering the comprehensive SOC assessment:

| # | Section | # | Section |
|---|---------|---|---------|
| 1 | Patient & visit information | 9 | Nutrition & hydration |
| 2 | Referral, diagnoses & homebound status | 10 | Neurological, cognitive & behavioral |
| 3 | Vital signs & physician notification parameters | 11 | Functional status — ADLs & IADLs |
| 4 | Living situation, home safety & emergency plan | 12 | Fall risk — Morse Fall Scale |
| 5 | Sensory status & pain | 13 | Medications & reconciliation |
| 6 | Integumentary, wounds & Braden Scale | 14 | Skilled services, equipment & frequency |
| 7 | Cardiopulmonary status | 15 | Psychosocial, goals & discharge planning |
| 8 | Elimination — GI / GU | | |

Fields appear and disappear conditionally (a wound description only appears once a wound
is documented), and the section rail shows what is complete.

**2. Score** — calculated live as documentation is entered, with risk level shown inline:

- **Morse Fall Scale** (0–24 low / 25–44 moderate / ≥45 high)
- **Braden Scale** for pressure injury risk (6–23, lower is higher risk)
- **PHQ-2** depression screen (≥3 is a positive screen)
- **BMI** from height and weight

**3. Generate** — a personalized plan of care assembled from the findings:

- Prioritized **problem list** with measurable, time-bound **goals** and **skilled interventions**
- **Disciplines** (SN, PT, OT, ST, MSW, HHA) — both those ordered and those the findings indicate
- **Suggested visit frequency**, front-loaded when the patient is high risk or recently discharged
- **Certification period** dates, **safety measures**, **DME**, diet and labs
- **Immediate action alerts** (e.g. expressed thoughts of self-harm, suspected abuse or neglect)
- A **Start of Care narrative note** written from the documented findings, ready to copy
- An **assessment summary** of everything documented
- Signature lines for the assessing clinician and the physician

Print or save as PDF for the physician signature packet, or export the record as JSON.

## How the plan of care is built

`poc-engine.js` holds the rules. Each rule is data — a condition over the assessment,
a problem statement, goals, interventions and the disciplines it indicates:

```js
{
  id: 'falls',
  when: function (c) { return c.sc.morse.value >= 25 || c.d.fall_injury === 'Yes' || ... },
  priority: 1,
  problem: 'Risk for falls related to impaired gait, balance and medication effects',
  disciplines: ['SN', 'PT'],
  goals: [ 'Patient will remain free of falls and fall-related injury ...' ],
  interventions: [ 'Instruct on removing throw rugs and clutter ...' ]
}
```

Goals and interventions may be functions of the assessment, so the generated text quotes
the patient's own data (the Morse score, the physician notification parameters, the
specific hazards found in the home, the ADLs the patient cannot perform).

To add or change clinical content, edit the `RULES` array — no other file needs to change.
To add assessment fields, add them to `SECTIONS` in `schema.js`; the form renders itself
from the schema. Field ids are referenced by the rules, so keep them stable.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell, styles, three screens (patients / assessment / plan of care) |
| `schema.js` | The 15 assessment sections, field definitions and the scoring scales |
| `poc-engine.js` | Plan of care rules engine and the SOC narrative generator |
| `app.js` | Rendering, navigation, autosave, JSON import/export, print |
| `demo-data.js` | Three fictional sample patients used by the demo |
| `demo.html` | Single-file demo: the whole program plus the sample patients inlined |
| `build-demo.py` | Rebuilds `demo.html` from the sources — run it after changing any of them |
| `manifest.json` | Web app manifest for add-to-home-screen / standalone display |

## Data

Records are stored in the browser's `localStorage` on the device that entered them —
nothing is transmitted anywhere. Export a record as JSON to move it into the clinical
record, and import it on another device. Because storage is per-browser, clearing site
data removes the records: export anything that must be kept.

For multi-clinician use with a shared backend, replace the `load`/`persist` pair in
`app.js` with API calls; nothing else in the program touches storage.

## Clinical note

This is clinical decision support, not a clinical decision. Everything the program
generates is a starting draft that must be reviewed and individualized by the assessing
licensed clinician, and the plan of care requires physician review and signature before
implementation. The assessment follows common home health SOC practice and standard
published scales; it is not a certified OASIS instrument and does not submit data to CMS.
Verify content against your agency's policies, your state's practice act and current
payer requirements before use.
