/* =============================================================================
   NVR ASSEMBLE  —  reproducible items, paper assembly & rendering
   -----------------------------------------------------------------------------
   The generators are random. To calibrate difficulty you must be able to take a
   response row from a Google Sheet and regenerate the EXACT figure the pupil
   saw. That needs two things this module provides:

     1. A deterministic PRNG (mulberry32) + a builder registry, so every item is
        stamped with an id `builder@seed` that fully reproduces it.
     2. A paper assembler that selects items to a spec, lays them out as a
        printable / deployable HTML paper with an answer key, and emits a
        MANIFEST (question number -> id, correct answer, band) — the artifact
        that links a paper to its response data.

   Node:  const A = require('./nvr-assemble.js')(NVR, {NVR3D, NVRCompose, NVRHard, NVRCamo});
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = (NVR, mods) => factory(NVR, mods || {});
  } else {
    root.NVRAssemble = factory(root.NVR, {
      NVR3D: root.NVR3D, NVRCompose: root.NVRCompose, NVRHard: root.NVRHard, NVRCamo: root.NVRCamo, NVRElite: root.NVRElite
    });
  }
})(typeof self !== 'undefined' ? self : this, function (NVR, mods) {
  'use strict';
  const { NVR3D, NVRCompose, NVRHard, NVRCamo, NVRElite } = mods;
  const V9 = (typeof require === 'function') ? require('./nvr-v9-calibration.js') : (typeof self!=='undefined'? self.NVRV9 : null);
  const LETTERS = 'ABCDE';
  const C = 60;

  // ---- deterministic PRNG -------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---- self-contained builder presets (each takes only an rng) ------------
  const pick = (a, rng) => a[Math.floor(rng() * a.length)];
  const shapes = ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'star', 'arrow', 'diamond'];
  const randFig = (rng) => NVR.figure([NVR.prim(pick(shapes, rng), { shading: pick(['white', 'black', 'grey', 'hatch'], rng) })]);

  const PRESETS = {
    // base engine, self-randomised — with degeneracy guards so the stem always
    // shows a VISIBLE change (no invisible rotations on symmetric shapes, etc.)
    series: (rng) => {
      // A length-4 series needs FOUR visibly different panels (three stem + the
      // answer), so the transform must have period >= 4 on the shape it is given.
      // Two of the transforms this preset used to draw from could never manage
      // that, and were silently rejected every time:
      //   * a reflection has period 2 — it alternates, so panels 1 and 3 match;
      //   * a three-colour cycle repeats on the fourth panel, and did nothing at
      //     all when the starting shading ('hatch') lay outside the cycle.
      // So the preset only ever emitted rotations, and burned every retry on the
      // dead branches for ~4% of seeds. Rotations are now paired only with shapes
      // whose own symmetry does not fold the four angles together (90° on a
      // square is the classic invisible-rotation bug), and the shading series is
      // a genuine four-colour cycle.
      const SH4 = ['white', 'grey', 'black', 'hatch'];
      const turnable = [];
      for (const shape of ['triangle', 'pentagon', 'hexagon', 'star', 'arrow', 'heart', 'semicircle', 'raindrop', 'crescent', 'lightning']) {
        const k = NVR.ROT_ORDER[shape];
        if (!k || k === Infinity) continue;
        const period = 360 / k;
        for (const deg of [45, 90]) {
          const seen = new Set([0, 1, 2, 3].map(i => (((deg * i) % period) + period) % period));
          if (seen.size === 4) turnable.push([shape, deg]);
        }
      }
      for (let k = 0; k < 8; k++) {
        let start, transform;
        if (turnable.length && rng() < 0.72) {
          const [shape, deg] = pick(turnable, rng);
          start = NVR.figure([NVR.prim(shape, { shading: pick(['white', 'grey', 'black'], rng) })]);
          transform = NVR.T.rotate(deg);
        } else {
          start = NVR.figure([NVR.prim(pick(shapes, rng), { shading: SH4[0] })]);
          transform = NVR.T.recolour(SH4);
        }
        const it = NVR.buildSeries({ start, transform, length: 4, rng });
        const keys = it.stem.map(NVR.figLookKey);
        if (new Set(keys).size === keys.length && !keys.includes(NVR.figLookKey(it.options[it.answerIndex]))) return it;
      }
      return null;
    },
    analogy: (rng) => {
      // rotation reads crisply only on shapes with a clear orientation; on near-
      // symmetric polygons a 90° turn is nearly invisible (the pentagon bug).
      const orientable = ['arrow', 'heart', 'semicircle', 'raindrop'];
      const anyShapes = ['arrow', 'triangle', 'pentagon', 'hexagon', 'star', 'heart', 'diamond'];
      for (let k = 0; k < 12; k++) {
        const kind = pick(['rotate', 'rotate', 'defill'], rng);   // reflection dropped: invisible on symmetric shapes
        let transform, srcShade, pool;
        if (kind === 'defill') { transform = NVR.T.recolour(['black', 'white']); srcShade = 'black'; pool = anyShapes; }
        else { transform = NVR.T.rotate(90); srcShade = pick(['black', 'grey', 'white'], rng); pool = orientable; }
        let s1 = pick(pool, rng), s2; do { s2 = pick(pool, rng); } while (s2 === s1);
        const a = NVR.figure([NVR.prim(s1, { shading: srcShade })]);
        const c = NVR.figure([NVR.prim(s2, { shading: srcShade })]);
        const it = NVR.buildAnalogy({ a, c, transform, rng });
        // transform must be visible on BOTH figures and the answer must differ from C
        if (NVR.figLookKey(it.stem[0]) !== NVR.figLookKey(it.stem[1]) &&
            NVR.figLookKey(it.stem[2]) !== NVR.figLookKey(it.options[it.answerIndex])) return it;
      }
      return null;
    },
    _analogy_old: (rng) => {
      const geoShapes = ['arrow', 'triangle', 'pentagon'];
      for (let k = 0; k < 10; k++) {
        const kind = pick(['rotate', 'reflectH', 'reflectV', 'defill'], rng);
        let transform, srcShade;
        if (kind === 'defill') { transform = NVR.T.recolour(['black', 'white']); srcShade = 'black'; }
        else {
          transform = kind === 'rotate' ? NVR.T.rotate(90) : NVR.T.reflect(kind === 'reflectH' ? 'h' : 'v');
          srcShade = pick(['black', 'grey', 'white'], rng);
        }
        const a = NVR.figure([NVR.prim(pick(geoShapes, rng), { shading: srcShade })]);
        const c = NVR.figure([NVR.prim(pick(geoShapes, rng), { shading: srcShade })]);
        const it = NVR.buildAnalogy({ a, c, transform, rng });
        // the transform must be visible (A != B) and the answer must differ from C
        if (NVR.figLookKey(it.stem[0]) !== NVR.figLookKey(it.stem[1]) &&
            NVR.figLookKey(it.stem[2]) !== NVR.figLookKey(it.options[it.answerIndex])) return it;
      }
      return null;
    },
    matrix: (rng) => {
      for (let k = 0; k < 10; k++) {
        const it = NVR.buildMatrix({ base: NVR.figure([NVR.prim(pick(['arrow', 'triangle', 'pentagon'], rng), { shading: 'white' })]),
          rowT: pick([NVR.T.rotate(90), NVR.T.recolour(['white', 'grey', 'black']), NVR.T.reflect('h')], rng),
          colT: pick([NVR.T.scaleBy(0.8), NVR.T.recolour(['white', 'hatch', 'black']), NVR.T.rotate(120)], rng), size: 3, rng });
        // EVERY cell must look distinct — this rejects any invisible transform step
        // (e.g. a 180° turn on a symmetric shape, which would make two columns identical)
        const keys = it.grid.flat().map(NVR.figLookKey);
        if (new Set(keys).size === 9) return it;
      }
      return null;
    },
    // composition
    cohesiveOddOneOut: (rng) => NVRCompose && NVRCompose.buildCohesiveOddOneOut({ rng }),
    oddOneOutClear: (rng) => NVRCompose && NVRCompose.buildCohesiveOddOneOut({ rng, ruleId: 'innerMatchesOuter' }),
    cohesiveSeries: (rng) => NVRCompose && NVRCompose.buildCohesiveSeries({ rng }),
    // hard
    xorMatrix: (rng) => NVRHard.buildXorMatrix({ rng }),
    compoundOddOneOut: (rng) => NVRHard.buildCompoundOddOneOut({ rng }),
    compositeAnalogy: (rng) => NVRHard.buildCompositeAnalogy({ rng }),
    chirality: (rng) => NVRHard.buildChiralitySeries({ rng }),
    interaction: (rng) => NVRHard.buildInteractionSeries({ rng }),
    secondOrder: (rng) => NVRHard.buildSecondOrderSeries({ rng }),
    // 3D
    cubeNet: (rng) => NVR3D.buildCubeNet({ rng }),
    // elite (combined-mechanism)
    tripleMatrix: (rng) => NVRElite && NVRElite.buildTripleMatrix({ rng }),
    crossConjunction: (rng) => NVRElite && NVRElite.buildCrossConjunction({ rng }),
    dependencySeries: (rng) => NVRElite && NVRElite.buildDependencySeries({ rng }),
    interwoven: (rng) => NVRElite && NVRElite.buildInterwovenSeries({ rng }),
    // camouflage
    conjunction: (rng) => NVRCamo.buildConjunctionOddOneOut({ rng }),
    embedded: (rng) => NVRCamo.buildEmbeddedFigure({ rng, noise: 'medium' }),
    embeddedHard: (rng) => NVRCamo.buildEmbeddedFigure({ rng, noise: 'high' })
  };

  // ---- make / regenerate an item by id ------------------------------------
  function makeItem(builder, seed) {
    const fn = PRESETS[builder];
    if (!fn) throw new Error('unknown builder: ' + builder);
    const rng = mulberry32(hashStr(builder + ':' + seed));
    const item = fn(rng);
    if (!item) return null;                         // seed unusable for this builder
    item.builder = builder; item.seed = seed; item.id = builder + '@' + seed;
    item.answerLetter = LETTERS[item.answerIndex];
    if (V9) V9.stamp(item, builder);
    return item;
  }
  const regenerate = (id) => { const [b, s] = id.split('@'); return makeItem(b, parseInt(s, 10)); };

  // ---- assemble a paper to a spec -----------------------------------------
  // spec: [{ builder, count, band? }]  band filters on the (prior) predicted band
  function assemblePaper(spec, { startSeed = 1000, title = 'NVR Practice Paper' } = {}) {
    const items = [];
    let seed = startSeed;
    for (const part of spec) {
      let got = 0, guard = 0;
      while (got < part.count && guard++ < part.count * 400) {
        const it = makeItem(part.builder, seed++);
        if (it && (!part.band || it.band === part.band)) { items.push(it); got++; }
      }
    }
    const manifest = items.map((it, i) => ({
      n: i + 1, id: it.id, builder: it.builder, seed: it.seed,
      type: it.type, answer: it.answerLetter, answerIndex: it.answerIndex,
      band: it.band, score: it.score, mechanism: it.mechanism || null, calibration: it.calibration, structuralScore: it.difficulty
    }));
    return { title, items, manifest };
  }

  // ---- render one item's stem + options (static) --------------------------
  const strip = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  function svgFig(f, size) { return NVR.renderFigure(f, { size }); }

  function stemHTML(it) {
    const q = '<div class="qmark">?</div>';
    if (it.type === 'series')
      return `<div class="stem">${it.stem.map(f => svgFig(f, 74)).join('<span class="sep"></span>')}<span class="arrow">&rarr;</span>${q}</div>`;
    if (it.type === 'analogy')
      return `<div class="stem">${svgFig(it.stem[0], 66)}<span class="op">:</span>${svgFig(it.stem[1], 66)}<span class="op">::</span>${svgFig(it.stem[2], 66)}<span class="op">:</span>${q}</div>`;
    if (it.type === 'matrix' || it.type === 'xorMatrix')
      return `<div class="stem">${NVR.renderMatrix(it, { size: 240 })}</div>`;
    if (it.type === 'code')
      return `<div class="stem">${svgFig(it.query, 74)}<span class="arrow">&rarr;</span>${q}</div>`;
    if (it.type === 'cubeNet')
      return `<div class="stem"><span class="lbl">Fold this net:</span>${NVR3D.renderNet(it.stem.net, it.stem.symbols, { size: 140 })}${q}</div>`;
    if (it.type === 'embedded')
      return `<div class="stem"><span class="lbl">Which shape is hidden?</span>${NVRCamo.renderSegments(it.stemSegments, { size: 150 })}</div>`;
    return '';   // oddOneOut has no stem
  }
  function optionsHTML(it, showAnswer) {
    return it.options.map((o, i) => {
      const correct = showAnswer && i === it.answerIndex;
      let inner;
      if (it.type === 'code') inner = `<div class="code">${o}</div>`;
      else if (it.type === 'cubeNet') inner = NVR3D.renderCube(o, { size: 84 });
      else inner = svgFig(o, 84);
      return `<div class="opt${correct ? ' correct' : ''}"><span class="ol">${LETTERS[i]}</span>${inner}</div>`;
    }).join('');
  }
  function itemHTML(it, n, showAnswer) {
    const key = showAnswer
      ? `<div class="key"><strong>Answer ${it.answerLetter}.</strong> ${it.rationale}` +
        (it.traps ? '<ul>' + it.traps.map((t, i) => (t && i !== it.answerIndex) ? `<li><b>${LETTERS[i]}</b>: ${t}</li>` : '').join('') + '</ul>' : '') +
        `</div>` : '';
    return `<section class="q" data-item-id="${it.id}">
      <div class="qhead"><span class="qn">${n}</span><span class="qtype">${it.type}${it.band ? ' &middot; ' + it.band : ''}</span><span class="qid">${it.id}</span></div>
      ${stemHTML(it)}
      <div class="opts">${optionsHTML(it, showAnswer)}</div>
      ${key}
    </section>`;
  }

  // ---- render the whole paper as a single self-contained HTML file --------
  // ---- pupil-facing paper: NO bands, mechanisms, ids, answer key, manifest ----
  //      Clean, print/PDF-ready worksheet with an answer box per question.
  // pupil-facing instruction per question type
  function instructionFor(it) {
    switch (it.type) {
      case 'series': return 'Which figure comes next in the sequence?';
      case 'analogy': return 'The first figure changes to the second in the same way the third changes to the answer. Which figure is the answer?';
      case 'matrix': case 'xorMatrix': return 'Which figure completes the pattern?';
      case 'oddOneOut': return 'Which figure is the odd one out?';
      case 'code': return 'Which code matches the figure?';
      case 'cubeNet': return 'Which cube can be made by folding this net?';
      case 'embedded': return 'Which of the shapes is hidden in the pattern above?';
      default: return 'Choose the correct option.';
    }
  }
  function pupilItemHTML(it, n) {
    return `<section class="q">
      <div class="qhead"><span class="qn">${n}</span><span class="qinstr">${instructionFor(it)}</span><span class="ans">Answer <span class="abox"></span></span></div>
      ${stemHTML(it)}
      <div class="opts">${optionsHTML(it, false)}</div>
    </section>`;
  }
  function renderPupilPaper(paper, opts = {}) {
    const title = opts.title || paper.title.replace(/\s*—.*$/, '');   // drop the "— Sample (…)" suffix
    const qs = paper.items.map((it, i) => pupilItemHTML(it, i + 1)).join('\n');
    return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  :root{--ink:#1f2933;--muted:#5f6d7a;--line:#c9d3dc}
  *{box-sizing:border-box}
  body{margin:0;color:var(--ink);font-family:'Lexend Deca',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;line-height:1.4}
  .head{border-bottom:2px solid var(--ink);padding-bottom:8px;margin-bottom:12px}
  .head h1{margin:0;font-size:20px}
  .head .row{display:flex;justify-content:space-between;gap:16px;margin-top:8px;font-size:13px;color:var(--muted)}
  .head .row .fill{border-bottom:1px solid var(--muted);flex:1;min-width:120px}
  .instr{font-size:12.5px;color:var(--muted);margin:8px 0 14px}
  .q{border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:0 0 12px;break-inside:avoid;page-break-inside:avoid}
  .qhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
  .qn{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--ink);color:#fff;font-weight:700;font-size:13px}
  .qinstr{flex:1;font-size:13px;font-weight:600;color:var(--ink);margin:0 10px}
  .ans{font-size:12px;color:var(--muted);white-space:nowrap}
  .abox{display:inline-block;width:34px;height:22px;border:1.5px solid var(--muted);border-radius:5px;vertical-align:middle;margin-left:4px}
  .stem{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0 10px}
  .stem .lbl{font-size:12.5px;color:var(--muted)}
  .arrow,.op{color:var(--muted);font-size:19px;padding:0 2px}
  .sep{width:2px}
  .qmark{width:70px;height:70px;border:2px dashed var(--line);border-radius:9px;display:grid;place-items:center;font-size:26px;font-weight:700;color:var(--muted)}
  .opts{display:flex;gap:8px;flex-wrap:wrap}
  .opt{position:relative;border:1px solid var(--line);border-radius:9px;padding:4px}
  .opt .ol{position:absolute;top:2px;left:6px;font-size:11px;font-weight:700;color:var(--muted)}
  .opt .code{font-size:22px;font-weight:700;padding:24px 22px}
  .panel svg,.opt svg,.stem svg{display:block}
</style></head>
<body>
  <div class="head"><h1>${title}</h1>
    <div class="row"><span>Name: <span class="fill">&nbsp;</span></span><span>Class: <span class="fill" style="min-width:70px">&nbsp;</span></span><span>Date: <span class="fill" style="min-width:80px">&nbsp;</span></span></div>
  </div>
  <p class="instr">Look at each pattern and work out which option (A&ndash;E) comes next or fits best. Write the letter in the answer box.</p>
  ${qs}
</body></html>`;
  }

  function renderPaper(paper) {
    const manifestJSON = JSON.stringify(paper.manifest);
    const qs = paper.items.map((it, i) => itemHTML(it, i + 1, false)).join('\n');
    const keys = paper.items.map((it, i) => itemHTML(it, i + 1, true)).join('\n');
    return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${paper.title}</title>
<style>
  :root{--ink:#1f2933;--muted:#5b6b7b;--line:#e2e8f0;--accent:#2f6f8f;--good:#2e7d5b;--bg:#f6f8fb}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'Lexend Deca',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;line-height:1.5}
  header{padding:22px clamp(14px,4vw,36px) 4px}
  h1{margin:0;font-size:22px}
  .instr{color:var(--muted);max-width:64ch;margin:6px 0 0}
  .bar{display:flex;gap:8px;flex-wrap:wrap;padding:12px clamp(14px,4vw,36px)}
  button{font:inherit;font-weight:600;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:9px;padding:8px 14px;cursor:pointer}
  button.ghost{background:#fff;color:var(--accent)}
  main{padding:0 clamp(14px,4vw,36px) 60px;max-width:900px}
  .q{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin:14px 0;break-inside:avoid}
  .qhead{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .qn{font-weight:700;background:var(--accent);color:#fff;border-radius:50%;width:28px;height:28px;display:grid;place-items:center;font-size:14px}
  .qtype{color:var(--muted);font-size:13px;text-transform:capitalize}
  .qid{margin-left:auto;color:#aeb8c2;font-size:11px;font-family:ui-monospace,monospace}
  .stem{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0 12px}
  .stem .lbl{font-size:13px;color:var(--muted)}
  .arrow,.op{color:var(--muted);font-size:20px;padding:0 2px}
  .sep{width:2px}
  .qmark{width:74px;height:74px;border:2px dashed var(--line);border-radius:10px;display:grid;place-items:center;font-size:28px;font-weight:700;color:var(--muted)}
  .opts{display:flex;gap:8px;flex-wrap:wrap}
  .opt{position:relative;border:1px solid var(--line);border-radius:10px;padding:4px}
  .opt.correct{border-color:var(--good);border-width:3px;background:#e9f5ee}
  .opt .ol{position:absolute;top:2px;left:6px;font-size:11px;font-weight:700;color:var(--muted)}
  .opt .code{font-size:22px;font-weight:700;padding:26px 24px}
  .key{margin-top:10px;border-top:1px dashed var(--line);padding-top:8px;font-size:13px;color:#41505f}
  .key ul{margin:6px 0 0;padding-left:18px}.key li{margin-bottom:3px}
  #keys{display:none}
  .manifest{font-family:ui-monospace,monospace;font-size:11px;color:#8595a3;white-space:pre-wrap;word-break:break-all;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px;margin:0 clamp(14px,4vw,36px)}
  @media print{.bar,.manifest{display:none}body{background:#fff}.q{border-color:#ccc}}
</style></head>
<body>
<header><h1>${paper.title}</h1>
<p class="instr">Choose one option (A&ndash;E) for each question. Each question is tagged with a short id so responses can be matched back for calibration.</p></header>
<div class="bar">
  <button class="ghost" onclick="document.getElementById('keys').style.display=document.getElementById('keys').style.display==='block'?'none':'block';window.scrollTo(0,document.getElementById('keys').offsetTop)">Toggle answer key</button>
  <button class="ghost" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('mf').textContent)">Copy manifest JSON</button>
  <button class="ghost" onclick="window.print()">Print</button>
</div>
<main>
  <div id="questions">${qs}</div>
  <div id="keys"><h2 style="padding-left:2px">Answer key</h2>${keys}</div>
</main>
<h3 style="padding:0 clamp(14px,4vw,36px);color:#5b6b7b;font-size:13px">Manifest (question &rarr; id &rarr; answer) — for the calibration harness</h3>
<div class="manifest" id="mf">${manifestJSON}</div>
</body></html>`;
  }

  // ---- INTERACTIVE pupil paper: pupils click A–E; responses post straight to a
  //      Google Sheet via an Apps Script Web App, with a CSV download fallback.
  //      Contains NO answers (pupil-facing), only the chosen letters. ----------
  function interactiveItemHTML(it, n) {
    const opts = it.options.map((o, i) => {
      let inner;
      if (it.type === 'code') inner = `<div class="code">${o}</div>`;
      else if (it.type === 'cubeNet') inner = NVR3D.renderCube(o, { size: 84 });
      else inner = svgFig(o, 84);
      return `<button type="button" class="opt" data-q="${n}" data-opt="${LETTERS[i]}" onclick="pick(${n},'${LETTERS[i]}',this)"><span class="ol">${LETTERS[i]}</span>${inner}</button>`;
    }).join('');
    return `<section class="q" id="q${n}">
      <div class="qhead"><span class="qn">${n}</span><span class="qinstr">${instructionFor(it)}</span><span class="chosen" id="chosen${n}"></span></div>
      ${stemHTML(it)}
      <div class="opts">${opts}</div>
    </section>`;
  }
  function renderInteractivePaper(paper, opts = {}) {
    const title = opts.title || paper.title.replace(/\s*—.*$/, '');
    const endpoint = opts.endpoint || '';            // paste your Apps Script Web App /exec URL here
    const paperId = opts.paperId || ('paper-' + paper.items.map(i => i.seed).join('-')).slice(0, 60);
    const N = paper.items.length;
    const qs = paper.items.map((it, i) => interactiveItemHTML(it, i + 1)).join('\n');
    return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>
  :root{--ink:#1f2933;--muted:#5f6d7a;--line:#c9d3dc;--accent:#2f6f8f;--good:#2e7d5b;--bg:#FFFBF0}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'Lexend Deca',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;line-height:1.45}
  header{padding:20px clamp(14px,4vw,32px) 4px}
  h1{margin:0;font-size:21px}
  .sub{color:var(--muted);font-size:13px;margin:6px 0 0}
  main{max-width:860px;margin:0 auto;padding:8px clamp(14px,4vw,32px) 140px}
  .q{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:14px 0}
  .qhead{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .qn{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;font-size:14px;flex:none}
  .qinstr{flex:1;font-size:14px;font-weight:600}
  .chosen{font-size:13px;font-weight:700;color:var(--good);white-space:nowrap}
  .stem{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0 12px}
  .stem .lbl{font-size:13px;color:var(--muted)}
  .arrow,.op{color:var(--muted);font-size:20px;padding:0 2px}.sep{width:2px}
  .qmark{width:74px;height:74px;border:2px dashed var(--line);border-radius:10px;display:grid;place-items:center;font-size:28px;font-weight:700;color:var(--muted)}
  .opts{display:flex;gap:10px;flex-wrap:wrap}
  .opt{position:relative;border:2px solid var(--line);border-radius:12px;padding:6px;background:#fff;cursor:pointer;transition:.12s;font:inherit}
  .opt:hover{border-color:var(--accent)}
  .opt.sel{border-color:var(--good);background:#e9f5ee;box-shadow:0 0 0 2px #2e7d5b33}
  .opt .ol{position:absolute;top:2px;left:7px;font-size:11px;font-weight:700;color:var(--muted)}
  .opt .code{font-size:22px;font-weight:700;padding:26px 24px}
  .bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);padding:12px clamp(14px,4vw,32px);display:flex;align-items:center;gap:14px;justify-content:space-between}
  .prog{font-size:13px;color:var(--muted)}
  button.go{font:inherit;font-weight:700;border:0;background:var(--accent);color:#fff;border-radius:10px;padding:11px 20px;cursor:pointer}
  button.go:disabled{background:#b9c4cd;cursor:not-allowed}
  .overlay{position:fixed;inset:0;background:#FFFBF0;display:grid;place-items:center;z-index:20;padding:20px}
  .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px;max-width:420px;width:100%}
  .card h2{margin:0 0 4px}.card p{color:var(--muted);font-size:13px;margin:0 0 14px}
  .card label{display:block;font-size:13px;font-weight:600;margin:10px 0 4px}
  .card input{width:100%;font:inherit;padding:9px 11px;border:1px solid var(--line);border-radius:9px}
  .done{text-align:center;padding:40px 20px}
  .done .tick{font-size:44px;color:var(--good)}
</style></head>
<body>
<div class="overlay" id="start">
  <div class="card">
    <h2>${title}</h2>
    <p>Enter your details, then answer every question by tapping one option (A&ndash;E).</p>
    <label>First name and last initial</label><input id="name" placeholder="e.g. Amara K" autocomplete="off">
    <label>Class</label><input id="klass" placeholder="e.g. 6M" autocomplete="off">
    <button class="go" style="margin-top:16px;width:100%" onclick="begin()">Start</button>
  </div>
</div>

<header><h1>${title}</h1><p class="sub" id="who"></p></header>
<main id="paper">${qs}</main>

<div class="bar">
  <span class="prog" id="prog">0 of ${N} answered</span>
  <button class="go" id="submit" disabled onclick="submit()">Submit answers</button>
</div>

<script>
  // ---- CONFIG: paste your Apps Script Web App URL between the quotes ----
  var ENDPOINT = ${JSON.stringify(endpoint)};
  var PAPER_ID = ${JSON.stringify(paperId)};
  var N = ${N};
  var answers = {}, pupil = '', klass = '';

  function begin(){
    pupil = (document.getElementById('name').value||'').trim();
    klass = (document.getElementById('klass').value||'').trim();
    if(!pupil){ document.getElementById('name').focus(); return; }
    document.getElementById('who').textContent = pupil + (klass? ' · ' + klass : '');
    document.getElementById('start').style.display='none';
  }
  function pick(q, letter, el){
    answers[q] = letter;
    var wrap = el.parentNode;
    [].forEach.call(wrap.children, function(c){ c.classList.remove('sel'); });
    el.classList.add('sel');
    document.getElementById('chosen'+q).textContent = 'Answer: ' + letter;
    var done = Object.keys(answers).length;
    document.getElementById('prog').textContent = done + ' of ' + N + ' answered';
    document.getElementById('submit').disabled = (done < N);
  }
  function payloadRows(){
    var row = { paperId: PAPER_ID, pupil: pupil, klass: klass, timestamp: new Date().toISOString() };
    for(var i=1;i<=N;i++){ row['Q'+i] = answers[i] || ''; }
    return row;
  }
  function toCSV(row){
    var keys = Object.keys(row);
    var esc = function(v){ return '"' + String(v).replace(/"/g,'""') + '"'; };
    return keys.join(',') + '\\n' + keys.map(function(k){return esc(row[k]);}).join(',') + '\\n';
  }
  function downloadCSV(row){
    var blob = new Blob([toCSV(row)], {type:'text/csv'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'response-' + (pupil.replace(/[^a-z0-9]+/gi,'_')||'pupil') + '.csv'; a.click();
  }
  function finish(msg){
    document.getElementById('paper').innerHTML =
      '<div class="done"><div class="tick">&#10003;</div><h2>All done, ' + pupil + '!</h2><p class="sub">' + msg + '</p></div>';
    document.querySelector('.bar').style.display='none';
    window.scrollTo(0,0);
  }
  function submit(){
    if(Object.keys(answers).length < N) return;
    var row = payloadRows();
    try{ localStorage.setItem('nvr_'+PAPER_ID+'_'+pupil, JSON.stringify(row)); }catch(e){}
    if(ENDPOINT){
      // fire-and-forget POST (Apps Script Web App); text/plain avoids a CORS preflight
      fetch(ENDPOINT, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(row) })
        .then(function(){ finish('Your answers have been sent to your teacher.'); })
        .catch(function(){ downloadCSV(row); finish('Saved as a file — please give it to your teacher.'); });
    } else {
      downloadCSV(row);
      finish('Saved as a file — please give it to your teacher.');
    }
  }
</script>
</body></html>`;
  }

  // ---- teacher answer key (letters + mechanism + band; for marking only) -----
  function renderAnswerKey(paper) {
    const rows = paper.items.map((it, i) =>
      `<tr><td>${i + 1}</td><td class="a">${it.answerLetter}</td><td>${it.type}${it.mechanism ? ' · ' + it.mechanism : ''}</td><td>${it.band || ''}</td></tr>`).join('');
    return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Answer key — ${paper.title}</title>
<style>
  @page{size:A4;margin:16mm}
  body{font-family:'Lexend Deca',system-ui,Arial,sans-serif;color:#1f2933}
  h1{font-size:18px;margin:0 0 2px}.sub{color:#5f6d7a;font-size:12px;margin:0 0 14px}
  table{border-collapse:collapse;width:100%;font-size:13px}
  th,td{border:1px solid #c9d3dc;padding:7px 10px;text-align:left}
  th{background:#f0f4f7}.a{font-weight:700;font-size:15px;color:#2e7d5b;text-align:center;width:60px}
  td:first-child{width:44px;text-align:center;font-weight:700}
</style></head><body>
<h1>Answer key — ${paper.title}</h1>
<p class="sub">Teacher copy. Do not distribute to pupils.</p>
<table><thead><tr><th>Q</th><th>Answer</th><th>Type / mechanism</th><th>Band (v9)</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
  }

  return { mulberry32, hashStr, PRESETS, makeItem, regenerate, assemblePaper, renderPaper, renderPupilPaper, renderInteractivePaper, renderAnswerKey, LETTERS };
});
