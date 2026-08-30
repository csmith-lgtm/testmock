/* =============================================================================
   NVR ELITE  —  combined-mechanism items for an able (selective-prep) cohort
   -----------------------------------------------------------------------------
   Single-mechanism items are cracked by a trained pupil running an attribute
   checklist. These require holding SEVERAL independent threads at once, or
   computing one property before a second rule can be applied — so no single
   pass of the checklist resolves them, and every distractor is the answer to a
   *partial* reading.

   Difficulty labels are deliberately NOT asserted here. Each item carries a
   `threads` count (how many independent things must be tracked) as an honest
   structural descriptor; the band is left to cohort data / expert judgement.

   Load after engine + camo.  Node: require('./nvr-elite.js')(NVR, NVRCamo)
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = (NVR, NVRCamo) => factory(NVR, NVRCamo || require('./nvr-camo.js')(NVR));
  } else { root.NVRElite = factory(root.NVR, root.NVRCamo); }
})(typeof self !== 'undefined' ? self : this, function (NVR, NVRCamo) {
  'use strict';
  const { prim, figure, figLookKey } = NVR;
  const C = 60;
  const POLY = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon' };
  const shuffle = (a, rng) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
  function anchors(k) {
    const s = 16, L = { 1: [[0, 0]], 2: [[-s, 0], [s, 0]], 3: [[0, -s], [-s, s], [s, s]], 4: [[-s, -s], [s, -s], [-s, s], [s, s]] };
    return (L[k] || L[4]).map(([x, y]) => [C + x, C + y]);
  }

  // ===========================================================================
  // 1. TRIPLE-ATTRIBUTE MATRIX  (three independent rules, held together)
  //    shape varies by column, inner-count varies by row, inner-shading follows
  //    a third rule on (row+col). The answer must satisfy ALL THREE; each main
  //    distractor satisfies exactly two, so tracking only two threads fails.
  // ===========================================================================
  function cellFig(sides, count, shading) {
    const items = [prim(POLY[sides], { x: C, y: C, size: 1.3, shading: 'white', z: 0 })];
    anchors(count).forEach(([x, y]) => items.push(prim('dot', { x, y, size: 0.4, shading, z: 2 })));
    return figure(items);
  }
  function buildTripleMatrix({ rng = Math.random } = {}) {
    const sidesByCol = shuffle([3, 4, 5], rng);
    const countByRow = shuffle([1, 2, 3], rng);
    const shadeCycle = shuffle(['white', 'grey', 'black'], rng);      // indexed by (r+c)%3
    const grid = [];
    for (let r = 0; r < 3; r++) { const row = []; for (let c = 0; c < 3; c++) row.push(cellFig(sidesByCol[c], countByRow[r], shadeCycle[(r + c) % 3])); grid.push(row); }

    const AS = sidesByCol[2], AN = countByRow[2], AH = shadeCycle[(2 + 2) % 3];   // answer attrs
    const otherSide = [3, 4, 5].filter(s => s !== AS);
    const otherCount = [1, 2, 3].filter(n => n !== AN);
    const otherShade = ['white', 'grey', 'black'].filter(h => h !== AH);
    const answer = cellFig(AS, AN, AH);
    const pool = [
      { f: cellFig(AS, AN, otherShade[0]), trap: 'Right shape and right number, but the shading rule (by diagonal) is wrong.' },
      { f: cellFig(AS, otherCount[0], AH), trap: 'Right shape and shading, but the wrong number of inner shapes (row rule).' },
      { f: cellFig(otherSide[0], AN, AH), trap: 'Right number and shading, but the wrong outer shape (column rule).' },
      { f: cellFig(otherSide[1], AN, otherShade[1]), trap: 'Matches only the number — wrong on shape and shading.' },
      { f: cellFig(AS, otherCount[1], otherShade[0]), trap: 'Matches only the shape.' }
    ];
    const seen = new Set([figLookKey(answer)]); const kept = [];
    for (const p of pool) { const k = figLookKey(p.f); if (!seen.has(k)) { seen.add(k); kept.push(p); } if (kept.length === 4) break; }
    const opts = [answer, ...kept.map(p => p.f)];
    const order = shuffle(opts, rng);
    const answerIndex = order.indexOf(answer);
    const traps = order.map(f => f === answer ? null : kept.find(p => p.f === f).trap);

    const item = {
      type: 'matrix', elite: true, threads: 3, size: 3, grid, missing: [2, 2],
      options: order, answerIndex, traps,
      rationale: 'Three rules run at once: the outer shape changes along each row (by column), the number of ' +
                 'inner shapes changes down each column (by row), and the shading follows the diagonals. ' +
                 'The answer is the only figure that obeys all three — each distractor gets one thread wrong.',
      // structural descriptor only; band deliberately left to calibration
      difficulty: NVR.estimateDifficulty({ type: 'matrix', options: order, answerIndex, stem: grid.flat() })
    };
    item.band = NVR.band(item.difficulty);
    return item;
  }

  // ===========================================================================
  // 2. CROSS-CATEGORY CONJUNCTION  (a relation between two conjunction counts)
  //    Rule: #(black triangles) == #(white circles). Not only does no single
  //    feature separate the panels — no single conjunction count does either;
  //    you must count two *different* sub-categories and compare them. Dense
  //    field (perceptual load) on top.
  // ===========================================================================
  function buildCrossConjunction({ rng = Math.random, total = 12 } = {}) {
    const counts = NVRCamo.countsOf, marg = NVRCamo.marginals, panelOf = NVRCamo.panelFromCounts;
    for (let attempt = 0; attempt < 12000; attempt++) {
      // Obeyers sit at three DISTINCT levels (Li,Li). The breaker is (Lj,Lk),
      // j != k, so BT=Lj matches obeyer j and WC=Lk matches obeyer k — the
      // breaker is never unique on BT or WC (other panels may be, as decoys).
      const levels = shuffle([1, 2, 3, 4], rng).slice(0, 3).sort((x, y) => x - y);
      const [j, k] = shuffle([0, 1, 2], rng);
      const breaker = { BT: levels[j], WC: levels[k] };
      if (breaker.BT === breaker.WC) continue;
      const obeyers = levels.map(L => ({ BT: L, WC: L }));
      const base = [breaker, ...obeyers];
      const perm = shuffle([0, 1, 2, 3], rng);
      const breakerPos = perm.indexOf(0);
      const chosen = perm.map(i => base[i]);

      // distribute WT/BC to keep total fixed
      const cts = chosen.map(({ BT, WC }) => {
        const rem = total - BT - WC; if (rem < 0) return null;
        const WT = Math.floor(rng() * (rem + 1));
        return { BT, WT, BC: rem - WT, WC };
      });
      if (cts.some(c => !c)) continue;
      if (!cts.every((c, i) => (i === breakerPos) ? c.BT !== c.WC : c.BT === c.WC)) continue;

      // the ANSWER must not be uniquely identifiable by any single natural count
      const ms = cts.map(c => Object.assign({}, marg(counts(panelStub(c))), c));
      const feats = ['total', 'black', 'white', 'triangles', 'circles', 'BT', 'WC'];
      const answerUnique = feats.some(kf => { const v = ms.map(m => m[kf]); return v.filter(x => x === ms[breakerPos][kf]).length === 1; });
      if (answerUnique) continue;

      const panels = cts.map(c => panelOf(c, rng));
      const traps = panels.map((_, i) => i === breakerPos ? null :
        'Obeys the rule. The odd one cannot be found by counting any single thing — not colour, not shape, not even black triangles alone; only comparing black triangles with white circles works.');
      const item = {
        type: 'oddOneOut', elite: true, threads: 2, camouflaged: true,
        options: panels, answerIndex: breakerPos, traps,
        rationale: 'In every figure the number of black triangles equals the number of white circles — except the ' +
                   'odd one. No single count singles it out, so you must count two different groups and compare them.',
        countRule: true,
        difficulty: NVR.estimateDifficulty({ type: 'oddOneOut', options: panels, answerIndex: breakerPos })
      };
      item.band = NVR.band(item.difficulty);
      return item;
    }
    return null;
  }
  // build a bare figure from counts without shuffling positions (for marginal checks)
  function panelStub(c) {
    const items = [];
    for (let i = 0; i < c.BT; i++) items.push(prim('triangle', { shading: 'black' }));
    for (let i = 0; i < c.WT; i++) items.push(prim('triangle', { shading: 'white' }));
    for (let i = 0; i < c.BC; i++) items.push(prim('circle', { shading: 'black' }));
    for (let i = 0; i < c.WC; i++) items.push(prim('circle', { shading: 'white' }));
    return figure(items);
  }

  // ===========================================================================
  // 3. DEPENDENCY SERIES  (a property of the figure sets the transformation)
  //    Across the examples: rotation = (number of sides) × 30°, AND the shape is
  //    grey iff its number of sides is odd. Two linked rules keyed off the same
  //    property. Three examples establish the dependency; apply it to the query.
  // ===========================================================================
  function depFig(sides, extraRot = 0, forceShade) {
    const rot = ((sides * 30) + extraRot) % 360;
    const shade = forceShade !== undefined ? forceShade : (sides % 2 === 1 ? 'grey' : 'white');
    return figure([prim(POLY[sides], { x: C, y: C, size: 1, rotation: rot, shading: shade })]);
  }
  function buildDependencySeries({ rng = Math.random } = {}) {
    // choose shapes whose (sides×30) rotation is visible; hexagon(180) invisible-ish on 6-fold -> skip
    const all = [3, 4, 5];                          // triangle, square, pentagon (all visible turns)
    const order = shuffle(all, rng);
    const examples = order.slice(0, 2);             // two worked examples
    const query = order[2];
    const stem = examples.map(s => depFig(s)).concat([/* query shown as bare shape upright, unshaded */
      figure([prim(POLY[query], { x: C, y: C, size: 1, rotation: 0, shading: 'white' })])]);
    const answer = depFig(query);

    const pool = [
      { f: figure([prim(POLY[query], { x: C, y: C, size: 1, rotation: 90, shading: query % 2 ? 'grey' : 'white' })]), trap: 'Turned it a fixed 90° instead of (sides × 30°).' },
      { f: depFig(query, 0, query % 2 ? 'white' : 'grey'), trap: 'Right turn, but the shading rule (grey if the number of sides is odd) is applied the wrong way.' },
      { f: depFig(query + 1), trap: 'Used the wrong number of sides in the turn.' },
      { f: figure([prim(POLY[query], { x: C, y: C, size: 1, rotation: (query * 45) % 360, shading: query % 2 ? 'grey' : 'white' })]), trap: 'Multiplied the sides by 45° instead of 30°.' },
      { f: depFig(query, 180), trap: 'Turned it half a turn too far.' }
    ];
    const seen = new Set([figLookKey(answer)]); const kept = [];
    for (const p of pool) { const k = figLookKey(p.f); if (!seen.has(k)) { seen.add(k); kept.push(p); } if (kept.length === 4) break; }
    const opts = shuffle([answer, ...kept.map(p => p.f)], rng);
    const answerIndex = opts.indexOf(answer);
    const traps = opts.map(f => f === answer ? null : kept.find(p => p.f === f).trap);

    const item = {
      type: 'series', elite: true, threads: 2, stem, options: opts, answerIndex, traps,
      rationale: 'Two linked rules, both set by the number of sides: the shape turns (number of sides) × 30°, ' +
                 'and it is shaded grey only when the number of sides is odd. Work out the query shape\u2019s sides, ' +
                 'then apply both.',
      difficulty: NVR.estimateDifficulty({ type: 'series', stem, options: opts, answerIndex })
    };
    item.band = NVR.band(item.difficulty);
    return item;
  }

  return { buildTripleMatrix, buildCrossConjunction, buildDependencySeries, cellFig, depFig, version: '1.0.0-elite' };
});
