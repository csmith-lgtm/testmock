/* Regression test for the hub's deep links and its objective tool presets.

   The routing reads the objective id at the fourth level of the hash
   (#curriculum/<strand>/<year>/<objective-id>), and a pasted link is only
   useful if it actually opens that objective's card. This walks every
   objective in the bank rather than sampling.

   Run: node hub_links.test.js        (needs jsdom)  */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = __dirname;
const HUB = fs.readdirSync(root).find(f => /^Primary_Maths_Curriculum_Navigator.*\.html$/.test(f));
if (!HUB) { console.error('no hub HTML found in ' + root); process.exit(1); }
const html = fs.readFileSync(path.join(root, HUB), 'utf8');

const errs = [];
const ok = m => console.log('  PASS  ' + m);
const bad = m => { errs.push(m); console.log('  FAIL  ' + m); };
const section = t => console.log('\n' + t);

const vc = new VirtualConsole();
vc.on('jsdomError', e => bad('hub script error: ' + e.message));
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
  url: 'https://x.invalid/' + HUB, virtualConsole: vc });
const w = dom.window, d = w.document;
// applyHashState re-renders the view and then expands the card from a
// setTimeout of its own. Poll rather than guess a delay: instant in a browser,
// a few tens of milliseconds under jsdom.
const tick = () => new Promise(r => setTimeout(r, 0));
function until(fn, ms = 800) {
  return new Promise(resolve => {
    const t0 = Date.now();
    (function poll() {
      const v = fn();
      if (v || Date.now() - t0 > ms) return resolve(v);
      setTimeout(poll, 5);
    })();
  });
}

(async () => {
  await tick();
  const objectives = w.eval('objectives');
  const hubHashFor = w.eval('hubHashFor');
  const objectiveSlug = w.eval('objectiveSlug');

  /* ------------------------------------------------------- 1. the ids --- */
  section('1. Frozen objective ids');
  const ids = objectives.map(o => o.id);
  ids.every(Boolean)
    ? ok(objectives.length + ' objectives, every one carrying an id')
    : bad(ids.filter(x => !x).length + ' objectives have no id');
  new Set(ids).size === ids.length
    ? ok('all ' + ids.length + ' ids are distinct')
    : bad((ids.length - new Set(ids).size) + ' ids are shared by more than one objective');
  const derived = objectives.filter(o => objectiveSlug(o) !== o.id);
  derived.length ? bad(derived.length + ' slugs are not the frozen id')
                 : ok('the slug used in a link is the frozen id, not something re-derived');

  /* ------------------------------------------ 2. every link opens its card */
  section('2. Every objective link opens that objective, expanded');
  const shape = hubHashFor(objectives[0]).split('/');
  shape.length === 4
    ? ok('a link is four levels: ' + shape[0] + '/<strand>/<year>/<id>')
    : bad('a link is ' + shape.length + ' levels: ' + hubHashFor(objectives[0]));

  let opened = 0, failures = [];
  for (const o of objectives) {
    w.location.hash = '#curriculum';           // so every id is a real change
    await tick();
    w.location.hash = hubHashFor(o);
    const el = await until(() => {
      const c = d.querySelector('.obj[data-slug="' + o.id + '"]');
      return c && c.classList.contains('open') ? c : null;
    });
    const head = el && el.querySelector('.obj-head');
    if (el && head && head.getAttribute('aria-expanded') === 'true') opened++;
    else failures.push(o.id + (d.querySelector('.obj[data-slug="' + o.id + '"]') ? ' (rendered, never expanded)' : ' (card not rendered)'));
    // if the routing is broken every link waits out the poll, so stop early
    if (failures.length >= 5) { failures.push('... stopped after 5'); break; }
  }
  failures.length
    ? bad(failures.length + ' of ' + objectives.length + ' links did not open their card: ' + failures.slice(0, 4).join('; '))
    : ok('all ' + opened + ' objective links open the right card, expanded, with aria-expanded set');

  // and the view really did follow the strand and year in the link
  {
    const o = objectives.find(x => x.strand === 'geo' && /Year 6/.test(x.year));
    w.location.hash = hubHashFor(o);
    await until(() => w.eval('currentStrand') === o.strand);
    const state = { strand: w.eval('currentStrand'), year: w.eval('currentYear') };
    (state.strand === o.strand && state.year === o.year)
      ? ok('the link also selects the strand and year: ' + state.strand + ' / ' + state.year)
      : bad('link left the view on ' + state.strand + ' / ' + state.year + ', not ' + o.strand + ' / ' + o.year);
  }

  /* --------------------------------------------------- 3. bad links ----- */
  section('3. A link that does not resolve falls back rather than erroring');
  const fallbacks = [
    ['#curriculum/geo/Year%206/not-a-real-objective', 'unknown id'],
    ['#curriculum/notastrand/Year%206/' + ids[0],     'unknown strand'],
    ['#curriculum/geo/Year%209/' + ids[0],            'unknown year'],
    ['#curriculum/geo',                               'no year or id'],
    ['#notaview/geo/Year%206',                        'unknown view'],
  ];
  for (const [hash, label] of fallbacks) {
    w.location.hash = hash;
    await tick();
    const cards = d.querySelectorAll('#curriculumView .obj').length;
    const open = d.querySelectorAll('#curriculumView .obj.open').length;
    (cards > 0)
      ? ok(label + ': falls back to a populated view (' + cards + ' cards, ' + open + ' expanded)')
      : bad(label + ': left the curriculum view empty');
  }

  /* ------------------------------------------- 4. the copy-link control -- */
  section('4. The copy-link control hands out the same link');
  {
    const o = objectives[42];
    w.location.hash = '#curriculum';
    await tick();
    w.location.hash = hubHashFor(o);
    const card = await until(() => d.querySelector('.obj[data-slug="' + o.id + '"]'));
    const btn = card && card.querySelector('button[onclick*="copyObjectiveLink"]');
    if (!btn) { bad('no copy-link control on the objective card'); }
    else {
      // the control uses the clipboard API where it can and a textarea where it
      // cannot, as on file://; capture whichever path this context takes
      let captured = null;
      Object.defineProperty(w.navigator, 'clipboard', { configurable: true,
        value: { writeText: t => { captured = t; return Promise.resolve(); } } });
      w.document.execCommand = () => {
        const ta = d.querySelector('textarea[style*="-2000px"]');
        if (ta) captured = ta.value;
        return true;
      };
      btn.click();
      await until(() => captured !== null);
      const want = w.eval('objectiveLink')(o);
      captured === want
        ? ok('the button copies exactly the link the router understands: #' + String(captured).split('#')[1])
        : bad('the button copied ' + captured + ', the router wants ' + want);
      // and that link, pasted back, opens the card
      if (captured) {
        w.location.hash = '#curriculum';
        await tick();
        w.location.hash = '#' + String(captured).split('#')[1];
        const back = await until(() => {
          const c = d.querySelector('.obj[data-slug="' + o.id + '"]');
          return c && c.classList.contains('open') ? c : null;
        });
        back ? ok('and pasting that link back opens the card it came from')
             : bad('the copied link did not reopen its own card');
      }
    }
  }

  /* -------------------------------------- 5. coordinate tool presets ----- */
  section('5. Coordinate presets stay on the visible grid');
  {
    const renderTools = w.eval('renderObjectiveTools');
    const rows = [];
    objectives.forEach((o, i) => {
      const h = renderTools(o);
      if (!h) return;
      const doc = new JSDOM('<div>' + h + '</div>').window.document;
      doc.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (!/Coordinate/.test(href)) return;
        const q = new URLSearchParams(href.split('?')[1]);
        rows.push({ n: i + 1, year: o.year, action: q.get('action'), qYear: q.get('year') });
      });
    });
    rows.length ? ok(rows.length + ' coordinate links across ' + new Set(rows.map(r => r.n)).size + ' objectives') : bad('no coordinate links at all');
    // the lab opens four quadrants only from Year 6; a reflection negates a
    // coordinate, so below Year 6 the image would be off the grid entirely
    const offGrid = rows.filter(r => /^reflect/.test(r.action || '') && !/Year 6/.test(r.year));
    offGrid.length
      ? bad(offGrid.length + ' reflection link(s) below Year 6, where the image lands off a first-quadrant grid: '
            + offGrid.map(r => '#' + r.n + ' ' + r.year + ' ' + r.action).join(', '))
      : ok('no reflection preset below Year 6 (' + rows.filter(r => /^reflect/.test(r.action || '')).length
           + ' reflection links, all Year 6)');
    const y6 = rows.filter(r => /Year 6/.test(r.year) && /reflect/.test(r.action || '')).map(r => r.action);
    (y6.includes('reflect-x') && y6.includes('reflect-y'))
      ? ok('Year 6 "reflect them in the axes" still offers both axes: ' + y6.join(', '))
      : bad('Year 6 reflection links: ' + (y6.join(', ') || 'none'));
    const mismatched = rows.filter(r => r.qYear !== objectives[r.n - 1].year);
    mismatched.length ? bad(mismatched.length + ' links send a year that is not the objective\'s')
                      : ok('every link sends the objective\'s own year, which is what sets the grid');
  }

  console.log(errs.length ? ('\n' + errs.length + ' FAILED') : '\nAll hub link checks passed.');
  process.exit(errs.length ? 1 : 0);
})();
