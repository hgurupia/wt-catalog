#!/usr/bin/env python3
"""Build demo.html: the whole program inlined into one file, preloaded with the
fictional sample patients from demo-data.js.

Run from this directory after changing index.html, schema.js, poc-engine.js,
app.js or demo-data.js:

    python3 build-demo.py

Pass --artifact PATH to also write a copy without the <!doctype>/<html>/<head>/
<body> wrapper, for hosts that supply their own document shell.
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

DEMO_KEY = 'ltc_soc_demo_v1'

STRIP_HTML = '''
      <div class="demo-strip">
        <span class="demo-chip">Demo</span>
        <span class="demo-text">Three fictional patients are preloaded. No real people, no real records &mdash; nothing leaves this browser.</span>
        <button class="demo-reset" id="btnResetDemo">Reset</button>
      </div>
'''

STRIP_CSS = '''
/* ---------- demo strip ---------- */
.demo-strip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  background:var(--teal-soft);border:1px solid #cfe4f4;border-radius:var(--radius);
  padding:11px 13px;margin-bottom:14px;color:var(--navy);font-size:13px}
.demo-chip{background:var(--teal);color:#fff;font-size:10px;font-weight:800;letter-spacing:.09em;
  text-transform:uppercase;padding:3px 9px;border-radius:999px;flex:none}
.demo-text{flex:1;min-width:180px;line-height:1.4}
.demo-reset{background:#fff;border:1px solid var(--line);color:var(--navy);font-size:12.5px;
  font-weight:600;padding:0 14px;min-height:36px;border-radius:999px;flex:none}
.demo-reset:active{border-color:var(--teal);color:var(--teal)}
@media print{.demo-strip{display:none}}
'''

SEED_JS = '''
(function () {
  var KEY = '%s';
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) { stored = null; }
  var empty = true;
  if (stored) { try { empty = !(JSON.parse(stored).records || []).length; } catch (e) { empty = true; } }
  if (empty) { try { window.LTC_DEMO.seed(KEY); } catch (e) {} }
})();
''' % DEMO_KEY

RESET_JS = '''
document.getElementById('btnResetDemo').addEventListener('click', function () {
  if (!confirm('Reset the demo back to the three sample patients? Anything you changed here is discarded.')) return;
  try { window.LTC_DEMO.seed('%s'); } catch (e) {}
  location.reload();
});
''' % DEMO_KEY


def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as fh:
        return fh.read()


def build():
    html = read('index.html')
    app = read('app.js')

    # the demo keeps its own records so it can never disturb the working app
    app_demo = app.replace("var KEY = 'ltc_soc_v1';", "var KEY = '%s';" % DEMO_KEY)
    if app_demo == app:
        sys.exit('build-demo: could not find the storage key in app.js')

    out = html
    out = out.replace(
        '<title>LTC Nurse Assessment - Start of Care &amp; Plan of Care</title>',
        '<title>LTC Start of Care Demo</title>')
    # the demo is one file, so drop the manifest link rather than ship a 404
    out = out.replace('<link rel="manifest" href="manifest.json">\n', '')
    out = out.replace('/* ---------- print ---------- */',
                      STRIP_CSS.strip() + '\n\n/* ---------- print ---------- */')

    anchor = '    <section class="screen on" id="screen-home">\n'
    if anchor not in out:
        sys.exit('build-demo: could not find the home screen in index.html')
    out = out.replace(anchor, anchor + STRIP_HTML)

    scripts = ('<script src="schema.js"></script>\n'
               '<script src="poc-engine.js"></script>\n'
               '<script src="app.js"></script>')
    if scripts not in out:
        sys.exit('build-demo: could not find the script tags in index.html')
    out = out.replace(scripts, '\n'.join([
        '<script>', read('schema.js'), '</script>',
        '<script>', read('poc-engine.js'), '</script>',
        '<script>', read('demo-data.js'), '</script>',
        '<script>' + SEED_JS + '</script>',
        '<script>', app_demo, '</script>',
        '<script>' + RESET_JS + '</script>',
    ]))
    return out


def strip_shell(doc):
    for tag in ('<!doctype html>\n<html lang="en">\n<head>\n',
                '<meta charset="utf-8">\n',
                '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n',
                '</head>\n<body>\n'):
        doc = doc.replace(tag, '')
    doc = doc.replace('\n</body>\n</html>\n', '\n')
    for bad in ('<!doctype', '<html', '</html>', '<head>', '</head>', '<body>', '</body>'):
        if bad in doc:
            sys.exit('build-demo: %s survived the strip' % bad)
    return doc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--artifact', help='also write a copy without the document shell')
    args = ap.parse_args()

    doc = build()
    target = os.path.join(HERE, 'demo.html')
    with open(target, 'w', encoding='utf-8') as fh:
        fh.write(doc)
    print('wrote %s (%d bytes)' % (target, len(doc)))

    if args.artifact:
        body = strip_shell(doc)
        with open(args.artifact, 'w', encoding='utf-8') as fh:
            fh.write(body)
        print('wrote %s (%d bytes)' % (args.artifact, len(body)))


if __name__ == '__main__':
    main()
