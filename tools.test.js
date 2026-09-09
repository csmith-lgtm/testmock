#!/usr/bin/env node
/*
 * Primary Maths Curriculum Navigator — regression test
 *
 *   npm install jsdom
 *   node tools.test.js [path-to-package-root]
 *
 * Package root must contain the Navigator hub HTML and one
 * Interactive_Maths_Tools_* folder. Both are found automatically.
 *
 * Exits 0 if everything passes, 1 otherwise, so it can gate a deploy.
 *
 * WHAT THIS CATCHES: broken wiring. Dead hide selectors, unattached
 * listeners, presets that don't land, missing files, console errors,
 * tools that render nothing, mode buttons that do nothing.
 *
 * WHAT IT DOES NOT CATCH: anything visual. jsdom has no layout engine,
 * so overflow, contrast, touch-target size and "does the shape look
 * right" still need a real browser and human eyes.
 *
 * Every check below exists because that exact bug shipped at least once.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = process.argv[2] || '.';
let failures = 0, checks = 0;

function ok(msg)   { checks++; console.log('  \x1b[32mPASS\x1b[0m  ' + msg); }
function bad(msg)  { checks++; failures++; console.log('  \x1b[31mFAIL\x1b[0m  ' + msg); }
function assert(cond, msg) { cond ? ok(msg) : bad(msg); }
function section(t){ console.log('\n' + t + '\n' + '-'.repeat(t.length)); }

/* ---------- locate the package ---------- */

function findPackage(root) {
  const walk = (dir, depth = 0) => {
    if (depth > 3) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const toolsDir = entries.find(e => e.isDirectory() && /^Interactive_Maths_Tools/.test(e.name));
    const hub = entries.find(e => e.isFile() && /^Primary_Maths_Curriculum_Navigator.*\.html$/.test(e.name));
    if (toolsDir && hub) return { dir, hub: path.join(dir, hub.name), tools: path.join(dir, toolsDir.name) };
    for (const e of entries) {
      if (e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) {
        const r = walk(path.join(dir, e.name), depth + 1);
        if (r) return r;
      }
    }
    return null;
  };
  return walk(path.resolve(root));
}

const pkg = findPackage(ROOT);
if (!pkg) {
  console.error('Could not find a hub HTML plus an Interactive_Maths_Tools_* folder under ' + path.resolve(ROOT));
  process.exit(1);
}
console.log('Hub:   ' + path.relative(process.cwd(), pkg.hub));
console.log('Tools: ' + path.relative(process.cwd(), pkg.tools));

const toolFiles = fs.readdirSync(pkg.tools).filter(f => f.endsWith('.html')).sort();

/* ---------- load a page and capture everything it complains about ---------- */

function load(file, query = '') {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.message || e)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  vc.on('warn',  (...a) => errors.push('console.warn: '  + a.join(' ')));
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://local.test/' + path.basename(file) + (query ? '?' + query : ''),
    virtualConsole: vc
  });
  return { dom, window: dom.window, doc: dom.window.document, errors };
}

function renderedChars(doc) {
  let best = 0;
  doc.querySelectorAll('main, #imtToolMain, .panel, .wrap, svg').forEach(el => {
    const n = (el.innerHTML || '').length;
    if (n > best) best = n;
  });
  return best;
}

/* ---------- 1. every tool loads, renders and stays quiet ---------- */

section('1. Tools load, render and log nothing');

for (const f of toolFiles) {
  const r = load(path.join(pkg.tools, f));
  assert(r.errors.length === 0, f + ' — no console output' + (r.errors.length ? ': ' + r.errors[0] : ''));
  assert(renderedChars(r.doc) > 200, f + ' — renders visible content');
  r.dom.window.close();
}

/* ---------- 2. hide selectors point at elements that exist ---------- *
 * v38 shipped rules whose class names matched nothing, so Hide/Reveal
 * silently did nothing in six tools. Also checks the CSS prefix is on
 * every selector in the comma list — losing it on the 2nd onwards made
 * content permanently invisible.                                       */

section('2. Hide/Reveal selectors match live elements');

const HIDE_RULE = /body\.imt-hide-teaching[^{]*\{visibility:hidden!important\}/g;

for (const f of toolFiles) {
  const src = fs.readFileSync(path.join(pkg.tools, f), 'utf8');
  const rules = (src.match(HIDE_RULE) || []).filter(r => !r.includes('imt-hide-target'));
  if (!rules.length) continue;

  const r = load(path.join(pkg.tools, f));
  for (const rule of rules) {
    const selectorList = rule.slice(0, rule.indexOf('{'));
    const parts = selectorList.split(',').map(s => s.trim());

    const unprefixed = parts.filter(s => !s.startsWith('body.imt-hide-teaching'));
    assert(unprefixed.length === 0,
      f + ' — every selector carries the body.imt-hide-teaching prefix' +
      (unprefixed.length ? ' (unprefixed: ' + unprefixed.join(', ') + ')' : ''));

    let matched = 0;
    for (const p of parts) {
      const sel = p.replace(/^body\.imt-hide-teaching\s*/, '');
      try { matched += r.doc.querySelectorAll(sel).length; } catch (e) { /* invalid selector */ }
    }
    assert(matched > 0, f + ' — hide rule matches at least one element in the default view');
  }
  r.dom.window.close();
}

/* ---------- 3. classroom controls do something ---------- *
 * The <html> element carries data-imt-mode once setMode runs, so an
 * unscoped querySelectorAll('[data-imt-mode]') attaches a handler to the
 * root. Every click then bubbled to it and undid Hide. Guard both the
 * selector and the observable behaviour.                              */

section('3. Classroom controls behave');

for (const f of toolFiles) {
  const file = path.join(pkg.tools, f);
  const src = fs.readFileSync(file, 'utf8');

  if (/querySelectorAll\('\[data-imt-mode\]'\)/.test(src)) {
    bad(f + ' — mode selector is scoped (unscoped [data-imt-mode] also matches <html>)');
  }

  const r = load(file);
  const doc = r.doc;
  const hide = doc.getElementById('imtHide');

  if (hide) {
    hide.click();
    const on = doc.body.classList.contains('imt-hide-teaching');
    hide.click();
    const off = !doc.body.classList.contains('imt-hide-teaching');
    assert(on && off, f + ' — Hide toggles on and back off');
  }

  const modeBtn = m => [...doc.querySelectorAll('button[data-imt-mode], button[data-mode]')]
    .find(b => (b.dataset.imtMode || b.dataset.mode) === m);

  const challenge = modeBtn('challenge'), teach = modeBtn('teach');
  if (challenge && teach) {
    const main = doc.querySelector('main, #imtToolMain, .wrap');
    const before = { html: main ? main.innerHTML : '', body: doc.body.className };
    challenge.click();
    const after = { html: main ? main.innerHTML : '', body: doc.body.className };
    assert(before.html !== after.html || before.body !== after.body,
      f + ' — Challenge changes something observable');
    teach.click();
    assert(!doc.body.classList.contains('imt-hide-teaching'),
      f + ' — returning to Teach reveals again');
  }
  r.dom.window.close();
}

/* ---------- 4. pull the hub's objective bank and mapping layer ---------- */

section('4. Hub mapping layer');

const hubSrc = fs.readFileSync(pkg.hub, 'utf8');

function slice(startMarker, endMarker) {
  const a = hubSrc.indexOf(startMarker);
  if (a < 0) return null;
  const b = hubSrc.indexOf(endMarker, a);
  if (b < 0) return null;
  return hubSrc.slice(a, b);
}

// objectives array: from its declaration to the first line-start "];"
const objSrc = (() => {
  const a = hubSrc.indexOf('const objectives = [');
  if (a < 0) return null;
  const b = hubSrc.indexOf('\n];', a);
  return b < 0 ? null : hubSrc.slice(a, b + 3);
})();

// tool registry through the link builder, stopping before renderTools
const mapSrc = slice('const interactiveTools=[', '\nfunction renderTools(');

let hub = null;
if (!objSrc || !mapSrc) {
  bad('hub — objective bank and mapping functions could be located');
} else {
  try {
    hub = new Function(objSrc + '\n' + mapSrc +
      '\nreturn {objectives,interactiveTools,toolPresetParams,toolsForObjective,toolHref,renderObjectiveTools};')();
    ok('hub — objective bank and mapping functions parse and run');
  } catch (e) {
    bad('hub — mapping layer threw: ' + e.message);
  }
}

if (hub) {
  assert(hub.objectives.length > 0, 'hub — objective bank is non-empty (' + hub.objectives.length + ' objectives)');
  assert(hub.interactiveTools.length === toolFiles.length,
    'hub — registry lists ' + hub.interactiveTools.length + ' tools, folder holds ' + toolFiles.length);

  // every registered file exists on disk
  const missing = hub.interactiveTools.map(t => t.file).filter(f => !toolFiles.includes(f));
  assert(missing.length === 0, 'hub — every registered tool file exists' + (missing.length ? ': missing ' + missing.join(', ') : ''));

  // every href the hub emits resolves, and no objective links the same tool twice
  // with the same preset (distinct presets on one tool are deliberate)
  let brokenHref = 0, sameTargets = 0;
  const folderName = path.basename(pkg.tools);
  for (const o of hub.objectives) {
    const html = hub.renderObjectiveTools(o);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    for (const h of hrefs) {
      const file = h.split('?')[0].split('/').pop();
      if (!toolFiles.includes(file)) brokenHref++;
      if (!h.startsWith(folderName + '/')) brokenHref++;
    }
    const keys = hrefs.map(h => h.split('/').pop());     // file + query
    if (keys.length !== new Set(keys).size) sameTargets++;
  }
  assert(brokenHref === 0, 'hub — every emitted link points at a file that exists in ' + folderName);
  assert(sameTargets === 0, 'hub — no objective emits two identical links');
}

/* ---------- 5. every preset the hub emits lands in its tool ---------- *
 * Map each tool id to [url param, target select id]. Add a line here
 * when a tool gains a preset. null target = nothing to assert.        */

section('5. Presets land on the intended control');

const PRESET_TARGET = {
  'place-value':         ['preset',    'preset'],
  'bar-model':           ['type',      'type'],
  'fraction':            ['view',      'view'],
  'written-calculation': ['operation', 'op'],
  'number-line':         ['purpose',   'purpose'],
  'array-area':          ['view',      'view'],
  'division':            ['view',      'view'],
  'powers-10':           ['op',        'op'],
  'clock':               ['view',      'view'],
  'scale':               ['unit',      'unit'],
  'coordinates':         ['action',    null],
  'data':                ['chart',     'chartType'],
  'angle-shape':         ['view',      'view'],
  'perimeter-area':      ['view',      'view'],
  'shape-properties':    ['view',      'view']
};

if (hub) {
  const unknown = hub.interactiveTools.map(t => t.id).filter(id => !(id in PRESET_TARGET));
  assert(unknown.length === 0,
    'test — PRESET_TARGET covers every registered tool' + (unknown.length ? '; add: ' + unknown.join(', ') : ''));

  // one representative load per distinct (tool, preset value, year)
  const combos = new Map();
  for (const o of hub.objectives) {
    const html = hub.renderObjectiveTools(o);
    for (const m of html.matchAll(/\/([A-Za-z_0-9]+\.html)\?([^"]+)/g)) {
      const tool = hub.interactiveTools.find(t => t.file === m[1]);
      if (!tool) continue;
      const params = new URLSearchParams(m[2].replace(/&amp;/g, '&'));
      const [pk] = PRESET_TARGET[tool.id] || [];
      const key = tool.id + '|' + (params.get(pk) || '') + '|' + params.get('year');
      if (!combos.has(key)) combos.set(key, { tool, params });
    }
  }

  let landed = 0, notLanded = [], runtime = [];
  for (const [key, { tool, params }] of combos) {
    const [pk, selId] = PRESET_TARGET[tool.id];
    const want = params.get(pk);
    const r = load(path.join(pkg.tools, tool.file), params.toString());
    if (r.errors.length) runtime.push(key + ' :: ' + r.errors[0]);
    if (selId && want) {
      const sel = r.doc.getElementById(selId);
      if (!sel) notLanded.push(key + ' :: no #' + selId);
      else if (sel.value !== want) notLanded.push(key + ' :: sent ' + pk + '=' + want + ', control shows "' + sel.value + '"');
      else landed++;
    }
    r.dom.window.close();
  }
  assert(notLanded.length === 0,
    'hub — all ' + combos.size + ' preset combinations land (' + landed + ' asserted)' +
    (notLanded.length ? '\n         ' + notLanded.slice(0, 8).join('\n         ') : ''));
  assert(runtime.length === 0,
    'hub — no runtime errors under preset load' +
    (runtime.length ? '\n         ' + runtime.slice(0, 8).join('\n         ') : ''));
}

/* ---------- 6. self-contained ---------- *
 * The tools are embedded in Google Sites; an external font request
 * meant they silently fell back to Arial.                            */

section('6. Tools are self-contained');

for (const f of toolFiles) {
  const src = fs.readFileSync(path.join(pkg.tools, f), 'utf8').replace(/base64,[^)"']*/g, 'base64,');
  const external = [...src.matchAll(/https?:\/\/[^"')\s]+/g)].map(m => m[0])
    .filter(u => !/^https?:\/\/(www\.)?(w3\.org|github\.com)/.test(u));
  assert(external.length === 0, f + ' — no external requests' + (external.length ? ': ' + external[0] : ''));
}

/* ---------- summary ---------- */

console.log('\n' + '='.repeat(60));
console.log(failures === 0
  ? `All ${checks} checks passed.`
  : `${failures} of ${checks} checks FAILED.`);
console.log('='.repeat(60));
console.log('Reminder: this covers wiring, not appearance. Layout at 390px,');
console.log('touch targets, Fullscreen and visual correctness still need a browser.');
process.exit(failures === 0 ? 0 : 1);
