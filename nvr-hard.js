/* =============================================================================
   NVR HARD  —  genuinely tricky items  (Secure / Greater Depth register)
   -----------------------------------------------------------------------------
   Difficulty in NVR comes from three places, and these builders lean on all
   three deliberately:
     1. COMPOUND rules   — two or three constraints must hold at once.
     2. INDIRECTION      — you must locate something before you can apply a rule.
     3. ENGINEERED distractors — every wrong option encodes a *named* plausible
        misconception, not a random perturbation. The hardest items are the ones
        where each distractor is the correct answer to a slightly-wrong reading.

   Every builder returns the standard item contract plus a `traps` array: one
   entry per option naming the misconception it targets (null for the answer).
   That doubles as a teaching key — it tells you exactly why a pupil who picked
   B was wrong.

   Load after the engine.  Browser -> window.NVRHard ; Node -> require(...)(NVR)
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = (NVR) => factory(NVR || require('./nvr-engine.js'));
  } else {
    root.NVRHard = factory(root.NVR);
  }
})(typeof self !== 'undefined' ? self : this, function (NVR) {
  'use strict';
  const { prim, figure, renderFigure } = NVR;
  const C = 60;

  // ---- geometry helpers: rotate / reflect a WHOLE composite figure ----------
  function rotateFigure(f, deg) {
    const a = deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const g = NVR.cloneFig(f);
    g.items.forEach(it => {
      const dx = it.x - C, dy = it.y - C;
      it.x = C + dx * cos - dy * sin;
      it.y = C + dx * sin + dy * cos;
      it.rotation = (it.rotation + deg) % 360;
    });
    return g;
  }
  function reflectFigure(f, axis) {            // 'h' = mirror left<->right
    const g = NVR.cloneFig(f);
    g.items.forEach(it => {
      if (axis === 'h') { it.x = 2 * C - it.x; it.flip = it.flip === 'h' ? 'none' : 'h'; }
      else { it.y = 2 * C - it.y; it.flip = it.flip === 'v' ? 'none' : 'v'; }
      it.rotation = (360 - it.rotation) % 360;
    });
    return g;
  }
  const shuffleKeepingAnswer = (opts, answer, rng) => {
    const arr = opts.slice();
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; }
    return { options: arr, answerIndex: arr.indexOf(answer) };
  };

  // ===========================================================================
  // 1. XOR / COMBINATION MATRIX
  //    In each row, the third cell = elements present in EXACTLY ONE of the
  //    first two (shared elements cancel). Distractors are the other plausible
  //    combination rules: OR (union), AND (overlap), copy-left, copy-middle.
  //    This is the classic hard CEM/GL matrix type.
  // ===========================================================================
  const SLOTS = [[44, 44], [76, 44], [44, 76], [76, 76]];   // 2x2 marker grid
  function maskFigure(mask) {
    const items = SLOTS.map(([x, y], i) =>
      (mask & (1 << i)) ? prim('square', { x, y, size: 0.3, shading: 'black', z: 1 }) : null
    ).filter(Boolean);
    return figure(items, { frame: 'box' });
  }
  function buildXorMatrix({ rng = Math.random } = {}) {
    const rnd = () => 1 + Math.floor(rng() * 14);   // non-empty, not-full-ish masks
    let A3, B3, xor, or, and;
    let tries = 0;
    do {
      A3 = rnd(); B3 = rnd();
      xor = A3 ^ B3; or = A3 | B3; and = A3 & B3;
      tries++;
    } while (tries < 200 && new Set([xor, or, and, A3, B3]).size < 5);

    // two demonstrator rows (also XOR), chosen to clearly show cancellation
    const demo = () => { let a, b; do { a = rnd(); b = rnd(); } while ((a & b) === 0 || (a ^ b) === 0); return [a, b, a ^ b]; };
    const [a1, b1, c1] = demo();
    const [a2, b2, c2] = demo();

    const grid = [
      [maskFigure(a1), maskFigure(b1), maskFigure(c1)],
      [maskFigure(a2), maskFigure(b2), maskFigure(c2)],
      [maskFigure(A3), maskFigure(B3), maskFigure(0)]   // [2][2] is the "?" cell
    ];

    const answerMask = xor;
    const optMasks = [
      { m: xor, trap: null },
      { m: or,  trap: 'Used OR — kept every marker that appears in either cell, instead of cancelling the shared ones.' },
      { m: and, trap: 'Used AND — kept only the markers shared by both cells (the opposite of the rule).' },
      { m: A3,  trap: 'Copied the left-hand cell.' },
      { m: B3,  trap: 'Copied the middle cell.' }
    ];
    // dedupe by mask, keep answer, pad if necessary
    const seen = new Set(); const chosen = [];
    for (const o of optMasks) { if (!seen.has(o.m)) { seen.add(o.m); chosen.push(o); } if (chosen.length === 5) break; }
    let pad = 1;
    while (chosen.length < 5) { const m = (xor ^ pad) & 15; if (!seen.has(m)) { seen.add(m); chosen.push({ m, trap: 'A marker in the wrong cell — close, but one slot differs.' }); } pad++; }

    const figs = chosen.map(o => maskFigure(o.m));
    const answerFig = figs[chosen.findIndex(o => o.trap === null)];
    const { options, answerIndex } = shuffleKeepingAnswer(figs, answerFig, rng);
    const traps = options.map(f => chosen[figs.indexOf(f)].trap);

    const item = {
      type: 'xorMatrix', size: 3, grid, missing: [2, 2], options, answerIndex, traps,
      rationale: 'In each row, the third cell keeps only the markers that appear in exactly one ' +
                 'of the first two cells — markers in both cells cancel out (XOR / symmetric difference).'
    };
    item.difficulty = 80 + Math.round(rng() * 8);
    item.band = NVR.band(item.difficulty);
    return item;
  }

  // ===========================================================================
  // 2. COMPOUND ODD-ONE-OUT WITH A SALIENT DECOY
  //    The real rule is a subtle count relation (shapes inside = sides of the
  //    container). Shading is pure NOISE — and one CORRECT figure is the only
  //    boldly-shaded one, to bait solvers who latch onto the obvious feature.
  // ===========================================================================
  function container(outer, count, innerShading, outerShading) {
    const A = require_interiorAnchors(count);
    const items = [prim(outer, { x: C, y: C, size: 1.32, shading: outerShading || 'white', z: 0 })];
    A.forEach(([x, y]) => items.push(prim('dot', { x, y, size: 0.42, shading: innerShading, z: 2 })));
    return figure(items);
  }
  // tidy interior anchors (kept local so this module stands alone)
  function require_interiorAnchors(k, s = 16) {
    const L = { 1: [[0, 0]], 2: [[-s, 0], [s, 0]], 3: [[0, -s], [-s, s], [s, s]],
      4: [[-s, -s], [s, -s], [-s, s], [s, s]], 5: [[-s, -s], [s, -s], [0, 0], [-s, s], [s, s]],
      6: [[-s, -s], [0, -s], [s, -s], [-s, s], [0, s], [s, s]],
      7: [[-s, -s], [0, -s], [s, -s], [0, 0], [-s, s], [0, s], [s, s]],
      8: [[-s, -s], [0, -s], [s, -s], [-s, 0], [s, 0], [-s, s], [0, s], [s, s]] };
    return (L[k] || L[8]).map(([dx, dy]) => [C + dx, C + dy]);
  }
  function buildCompoundOddOneOut({ rng = Math.random } = {}) {
    // RULE: dots inside == number of sides of the container. Exactly one figure
    // breaks it. SHADING is balanced 2-vs-2 so it can never be the rule — it
    // only draws the eye (the genuine GL way to bait without making the item
    // ambiguous: a decoy feature must be shared, so it can't single anyone out).
    const fourShapes = ['triangle', 'square', 'pentagon', 'hexagon'];
    const order = fourShapes.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[order[i], order[j]] = [order[j], order[i]]; }
    const breakerPos = Math.floor(rng() * 4);
    // balanced shading: two black, two grey, assigned at random positions
    const shading = ['black', 'black', 'grey', 'grey'];
    for (let i = shading.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[shading[i], shading[j]] = [shading[j], shading[i]]; }

    const options = order.map((shp, i) => {
      const sides = NVR.SIDES[shp];
      const n = i === breakerPos ? sides + 1 : sides;   // breaker has one too many
      return container(shp, n, shading[i], 'white');
    });

    const traps = options.map((_, i) =>
      i === breakerPos ? null
      : 'Obeys the rule (dots inside = number of sides). Shading is balanced two-and-two, so colour cannot be the odd-one-out.');

    const item = {
      type: 'oddOneOut', hard: true, options, answerIndex: breakerPos, traps,
      rationale: 'Every figure has as many dots inside as the container has sides — except the odd one, ' +
                 'which has one dot too many. Shading is split two-and-two on purpose, so the bold figures ' +
                 'are a distraction: colour is not the rule.',
      countRule: true
    };
    item.difficulty = 70 + Math.round(rng() * 10);
    item.band = NVR.band(item.difficulty);
    return item;
  }

  // ===========================================================================
  // 3. COMPOSITE ANALOGY  (three transforms at once; distractors miss one each)
  //    A -> B applies: rotate 90°, recolour, AND gain a dashed outline.
  //    C is a DIFFERENT shape, so you cannot pattern-match — you must abstract
  //    all three changes. Each distractor applies a subset.
  // ===========================================================================
  function buildCompositeAnalogy({ rng = Math.random } = {}) {
    const pick = (a) => a[Math.floor(rng() * a.length)];
    // only shapes whose 90° AND 180° rotations are visible (so rotation is a real cue)
    const rotVisibleShapes = ['arrow', 'triangle', 'pentagon', 'star'];
    const sA = pick(rotVisibleShapes);
    let sC; do { sC = pick(rotVisibleShapes); } while (sC === sA);

    const A = figure([prim(sA, { size: 1, shading: 'white', lineType: 'solid', rotation: 0 })]);
    const apply = (shape, { rot = false, col = false, dash = false }) => figure([prim(shape, {
      size: 1,
      rotation: rot ? 90 : 0,
      shading: col ? 'grey' : 'white',
      lineType: dash ? 'dashed' : 'solid'
    })]);
    const all = { rot: true, col: true, dash: true };
    const B = apply(sA, all);
    const answer = apply(sC, all);

    const opts = [
      { f: answer, trap: null },
      { f: apply(sC, { rot: true, col: false, dash: true }), trap: 'Missed the shading change.' },
      { f: apply(sC, { rot: true, col: true, dash: false }), trap: 'Missed the change to a dashed outline.' },
      { f: apply(sC, { rot: false, col: true, dash: true }), trap: 'Missed the 90° rotation.' },
      { f: figure([prim(sC, { size: 1, rotation: 180, shading: 'grey', lineType: 'dashed' })]), trap: 'Over-rotated to 180° instead of 90°.' },
      // spare distractors in case a shape's symmetry makes one of the above look identical
      { f: apply(sC, { rot: false, col: false, dash: true }), trap: 'Only changed the outline to dashed.' },
      { f: apply(sC, { rot: false, col: true, dash: false }), trap: 'Only changed the shading.' }
    ];
    // keep the answer + the first 4 distractors that look DISTINCT from it and each other
    const seen = new Set([NVR.figLookKey(answer)]);
    const kept = [opts[0]];
    for (let i = 1; i < opts.length && kept.length < 5; i++) {
      const key = NVR.figLookKey(opts[i].f);
      if (!seen.has(key)) { seen.add(key); kept.push(opts[i]); }
    }
    const { options, answerIndex } = shuffleKeepingAnswer(kept.map(o => o.f), answer, rng);
    const traps = options.map(f => kept.find(o => o.f === f).trap);

    const item = {
      type: 'analogy', hard: true, stem: [A, B, apply(sC, {})], options, answerIndex, traps,
      rationale: 'A → B applies three changes together: a 90° rotation, a change to grey shading, and a ' +
                 'change to a dashed outline. Apply all three to C. Each distractor leaves one change out.'
    };
    item.difficulty = 74 + Math.round(rng() * 10);
    item.band = NVR.band(item.difficulty);
    return item;
  }

  // ===========================================================================
  // 4. CHIRALITY TRAP  (reflection vs rotation, on an asymmetric figure)
  //    The figure is fully asymmetric (a square with a corner dot AND an edge
  //    bar), so its mirror image is reachable by NO rotation. The series rotates
  //    90° each step; the strongest distractor is the reflection of the answer.
  // ===========================================================================
  function markedSquare() {
    return figure([
      prim('square', { x: C, y: C, size: 1.2, shading: 'white', z: 0 }),
      prim('dot', { x: C - 26, y: C - 26, size: 0.5, shading: 'black', z: 2 }),      // top-left corner
      prim('square', { x: C + 30, y: C, size: 0.28, shading: 'grey', z: 2 })          // right edge
    ]);
  }
  function buildChiralitySeries({ rng = Math.random } = {}) {
    const dir = rng() < 0.5 ? 90 : -90;
    const base = markedSquare();
    const panels = [base, rotateFigure(base, dir), rotateFigure(base, dir * 2)];
    const answer = rotateFigure(base, dir * 3);

    const pool = [
      { f: reflectFigure(answer, 'h'), trap: 'A reflection of the correct figure — it looks similar but is mirror-image; no rotation produces it.' },
      { f: reflectFigure(answer, 'v'), trap: 'A vertical reflection — another mirror image, not a rotation.' },
      { f: rotateFigure(base, dir * 2), trap: 'Repeated the previous figure instead of advancing the rotation.' },
      { f: reflectFigure(rotateFigure(base, dir * 2), 'h'), trap: 'A mirror image of the previous figure.' },
      { f: rotateFigure(base, dir), trap: 'An earlier figure in the sequence, not the next one.' },
      { f: reflectFigure(base, 'h'), trap: 'A reflection of the starting figure.' }
    ];
    // keep distractors that look distinct from the answer AND from each other
    const seen = new Set([NVR.figLookKey(answer)]);
    const kept = [];
    for (const c of pool) { const key = NVR.figLookKey(c.f); if (!seen.has(key)) { seen.add(key); kept.push(c); } if (kept.length === 4) break; }

    const { options, answerIndex } = shuffleKeepingAnswer([answer, ...kept.map(c => c.f)], answer, rng);
    const traps = options.map(f => f === answer ? null : kept.find(c => c.f === f).trap);

    const item = {
      type: 'series', hard: true, stem: panels, options, answerIndex, traps,
      rationale: `Each step rotates the whole figure ${Math.abs(dir)}° ${dir > 0 ? 'clockwise' : 'anticlockwise'}. ` +
                 'Because the figure is asymmetric, its mirror images can never appear in the sequence — those are the traps.'
    };
    item.difficulty = 72 + Math.round(rng() * 8);
    item.band = NVR.band(item.difficulty);
    return item;
  }

  // ===========================================================================
  // 5. INTERACTION SERIES  (one attribute GOVERNS another)
  //    The arrow's rotation is not a fixed step — it equals (number of dots) ×
  //    45°. The dot counts are deliberately NON-monotonic across the examples
  //    so there is no positional shortcut: you must discover that the count
  //    controls the angle, then apply it to the query count. This defeats the
  //    "find the constant transformation" strategy that cracks ordinary series.
  // ===========================================================================
  function dotRow(n) {
    const gap = 12, start = C - gap * (n - 1) / 2;
    return Array.from({ length: n }, (_, i) => prim('dot', { x: start + i * gap, y: C + 36, size: 0.34, shading: 'black', z: 2 }));
  }
  function arrowWithDots(count, M) {
    return figure([prim('arrow', { x: C, y: C - 6, size: 0.7, rotation: (count * M) % 360, z: 1 }), ...dotRow(count)]);
  }
  function buildInteractionSeries({ rng = Math.random } = {}) {
    const M = 45;
    // three example counts (non-monotonic, distinct) + a distinct query count
    const pool = [1, 2, 3, 4, 5];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
    const [e1, e2, e3, q] = pool;
    const stem = [arrowWithDots(e1, M), arrowWithDots(e2, M), arrowWithDots(e3, M), figure([...dotRow(q)])]; // 4th panel: dots only, arrow is "?"

    const answerRot = (q * M) % 360;
    const candRots = [
      { r: answerRot, trap: null },
      { r: ((q - 1) * M + 360) % 360, trap: 'Used one fewer dot — counted the query panel wrongly, or applied a neighbour\u2019s count.' },
      { r: ((e3 * M) + M) % 360, trap: 'Assumed a constant +45\u00b0 step from the previous arrow, ignoring that the angle is set by the dot count.' },
      { r: ((q + 1) * M) % 360, trap: 'Used one dot too many.' },
      { r: (answerRot + 180) % 360, trap: 'Right size of turn but pointing the opposite way.' }
    ];
    const seen = new Set(); const chosen = [];
    for (const c of candRots) { if (!seen.has(c.r)) { seen.add(c.r); chosen.push(c); } if (chosen.length === 5) break; }
    let extra = 1;
    while (chosen.length < 5) { const r = (answerRot + extra * 45) % 360; if (!seen.has(r)) { seen.add(r); chosen.push({ r, trap: 'A plausible angle, but not dots \u00d7 45\u00b0.' }); } extra++; }

    const figs = chosen.map(c => figure([prim('arrow', { x: C, y: C - 6, size: 0.7, rotation: c.r, z: 1 }), ...dotRow(q)]));
    const answerFig = figs[0];
    const { options, answerIndex } = shuffleKeepingAnswer(figs, answerFig, rng);
    const traps = options.map(f => chosen[figs.indexOf(f)].trap);

    const item = {
      type: 'series', hard: true, stem, options, answerIndex, traps,
      rationale: `The arrow's turn is governed by the dots: rotation = (number of dots) \u00d7 45\u00b0. ` +
                 `The query shows ${q} dots, so the arrow turns ${answerRot}\u00b0. The counts jump about on purpose, ` +
                 `so spotting a fixed step won't work — you have to find what controls the angle.`,
      complexityPrior: 'high — requires discovering a cross-attribute dependency, not a fixed transformation'
    };
    item.difficulty = NVR.estimateDifficulty(item);     // unvalidated structural prior only
    item.band = NVR.band(item.difficulty);
    return item;
  }

  // ===========================================================================
  // 6. SECOND-ORDER SERIES  (the pattern is in the rate of change)
  //    Rotations accelerate: +30\u00b0, +60\u00b0, +90\u00b0 \u2192 +120\u00b0. The dominant distractor is
  //    the constant-step continuation that a first-order reading produces.
  // ===========================================================================
  function buildSecondOrderSeries({ rng = Math.random } = {}) {
    const inc = 30, first = 30;
    const angles = [0];
    for (let k = 0; k < 4; k++) angles.push((angles[k] + first + inc * k) % 360); // 0,30,90,180,300
    const stem = angles.slice(0, 4).map(a => figure([prim('arrow', { size: 0.85, rotation: a })]));
    const answerRot = angles[4];

    const last = angles[3], lastDelta = first + inc * 2;          // 90
    const cand = [
      { r: answerRot, trap: null },
      { r: (last + lastDelta) % 360, trap: 'Continued with a constant +90\u00b0 (a first-order reading). The step itself is growing.' },
      { r: (last + (first + inc * 1)) % 360, trap: 'Used the previous step (+60\u00b0) again.' },
      { r: (last + (first + inc * 4)) % 360, trap: 'Over-shot — grew the step too far (+150\u00b0 instead of +120\u00b0).' },
      { r: (360 - answerRot) % 360, trap: 'A reflection of the correct arrow, not a rotation.' }
    ];
    const seen = new Set(); const chosen = [];
    for (const c of cand) { if (!seen.has(c.r)) { seen.add(c.r); chosen.push(c); } if (chosen.length === 5) break; }
    let e = 1; while (chosen.length < 5) { const r = (answerRot + e * 30) % 360; if (!seen.has(r)) { seen.add(r); chosen.push({ r, trap: 'A nearby angle that doesn\u2019t fit the growing step.' }); } e++; }

    const figs = chosen.map(c => figure([prim('arrow', { size: 0.85, rotation: c.r })]));
    const { options, answerIndex } = shuffleKeepingAnswer(figs, figs[0], rng);
    const traps = options.map(f => chosen[figs.indexOf(f)].trap);

    const item = {
      type: 'series', hard: true, stem, options, answerIndex, traps,
      rationale: 'The turn grows each step: +30\u00b0, then +60\u00b0, then +90\u00b0, so the next is +120\u00b0 ' +
                 `(0\u00b0 \u2192 30\u00b0 \u2192 90\u00b0 \u2192 180\u00b0 \u2192 ${answerRot}\u00b0). The pattern lives in the differences, not the angles.`,
      complexityPrior: 'high — second-order: the rule is the changing rate, which a constant-transformation reading misses'
    };
    item.difficulty = NVR.estimateDifficulty(item);
    item.band = NVR.band(item.difficulty);
    return item;
  }

  return {
    rotateFigure, reflectFigure,
    maskFigure, buildXorMatrix,
    buildCompoundOddOneOut, buildCompositeAnalogy, buildChiralitySeries,
    buildInteractionSeries, buildSecondOrderSeries,
    version: '1.1.0-hard'
  };
});
