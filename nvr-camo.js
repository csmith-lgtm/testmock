/* =============================================================================
   NVR CAMO  —  perceptual-load camouflage  (the missing difficulty lever)
   -----------------------------------------------------------------------------
   Stacking independent rules does NOT make an item hard: a pupil who checks
   attributes systematically still cracks it. Real perceptual difficulty comes
   from making the rule-bearing feature hard to SEE:

     A. CONJUNCTION SEARCH  — the target shares every *individual* feature with
        the distractors, so nothing "pops out" and the eye must scan serially
        (Treisman feature-integration). Implemented so that all single-feature
        marginals are identical across panels: counting black, white, triangles
        or circles tells you NOTHING. Only the conjunction (black triangles vs
        white triangles) separates them.

     B. EMBEDDED FIGURE — the target shape's outline is present inside a tangle
        of lines whose extensions and crossings create false junctions, so the
        contour does not segment out. Verified GEOMETRICALLY: the answer is
        provably embedded, and every distractor is provably NOT embedded at that
        size, over a search of rotations and positions.

   Both properties are machine-checked, not asserted — see camoverify.js.

   Load after the engine.  Browser -> window.NVRCamo ; Node -> require(...)(NVR)
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = (NVR) => factory(NVR || require('./nvr-engine.js'));
  } else {
    root.NVRCamo = factory(root.NVR);
  }
})(typeof self !== 'undefined' ? self : this, function (NVR) {
  'use strict';
  const { prim, figure } = NVR;
  const C = 60, INK = NVR.INK;

  // ===========================================================================
  // A. CONJUNCTION SEARCH ODD-ONE-OUT
  // ---------------------------------------------------------------------------
  // Elements are one of four kinds: black/white x triangle/circle.
  // RULE: #(black triangles) == #(white triangles).
  // Camouflage: every panel is given the SAME total count, and the battery of
  // simple single-feature readings is checked so that none of them singles out
  // any panel. If one did, that panel would be a competing answer and the item
  // would be both ambiguous and easy — so we regenerate.
  // ===========================================================================
  const GRID = (() => {                       // 4x3 tidy grid of slots
    const xs = [30, 46, 62, 78], ys = [34, 56, 78];
    const out = [];
    ys.forEach(y => xs.forEach(x => out.push([x, y])));
    return out;                                // 12 slots
  })();

  function panelFromCounts({ BT, WT, BC, WC }, rng) {
    const kinds = [];
    for (let i = 0; i < BT; i++) kinds.push(['triangle', 'black']);
    for (let i = 0; i < WT; i++) kinds.push(['triangle', 'white']);
    for (let i = 0; i < BC; i++) kinds.push(['circle', 'black']);
    for (let i = 0; i < WC; i++) kinds.push(['circle', 'white']);
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    const slots = GRID.slice();
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[slots[i], slots[j]] = [slots[j], slots[i]]; }
    const items = kinds.map(([shape, shading], i) =>
      prim(shape, { x: slots[i][0], y: slots[i][1], size: 0.2, shading, z: 1 }));
    return figure(items, { frame: 'box' });
  }

  // read the four conjunction counts back off a panel (used by the verifier too)
  function countsOf(f) {
    const c = { BT: 0, WT: 0, BC: 0, WC: 0 };
    f.items.forEach(i => {
      if (i.shape === 'triangle') (i.shading === 'black' ? c.BT++ : c.WT++);
      else if (i.shape === 'circle') (i.shading === 'black' ? c.BC++ : c.WC++);
    });
    return c;
  }
  // simple single-feature readings a solver might try
  function marginals(c) {
    return {
      total: c.BT + c.WT + c.BC + c.WC,
      black: c.BT + c.BC,
      white: c.WT + c.WC,
      triangles: c.BT + c.WT,
      circles: c.BC + c.WC,
      blackMinusWhite: (c.BT + c.BC) - (c.WT + c.WC),
      triMinusCirc: (c.BT + c.WT) - (c.BC + c.WC)
    };
  }
  // is any panel uniquely identified by a single-feature reading?
  function hasSingleFeatureGiveaway(panels) {
    const ms = panels.map(p => marginals(countsOf(p)));
    return Object.keys(ms[0]).some(key => {
      const vals = ms.map(m => m[key]);
      return vals.some((v, i) => vals.filter(x => x === v).length === 1);   // a unique value = a giveaway
    });
  }

  function buildConjunctionOddOneOut({ rng = Math.random, total = 12 } = {}) {
    for (let attempt = 0; attempt < 4000; attempt++) {
      // four obeyers: BT == WT ; one breaker: BT != WT. Keep total fixed.
      // (five panels in all — the item contract is a five-option set.)
      const mk = (obey) => {
        const nTri = 2 * (2 + Math.floor(rng() * 3));            // 4, 6 or 8 (even either way)
        let BT, WT;
        if (obey) { BT = WT = nTri / 2; }
        else { const d = 1 + Math.floor(rng() * 2); BT = nTri / 2 + d; WT = nTri - BT; }
        if (WT < 0) return null;
        const nCirc = total - nTri;
        const BC = Math.floor(rng() * (nCirc + 1));
        return { BT, WT, BC, WC: nCirc - BC };
      };
      const breakerPos = Math.floor(rng() * 5);
      const counts = [];
      let ok = true;
      for (let i = 0; i < 5; i++) { const c = mk(i !== breakerPos); if (!c) { ok = false; break; } counts.push(c); }
      if (!ok) continue;
      // breaker must genuinely break, obeyers must genuinely obey
      if (!counts.every((c, i) => (i === breakerPos) ? c.BT !== c.WT : c.BT === c.WT)) continue;

      const panels = counts.map(c => panelFromCounts(c, rng));
      if (hasSingleFeatureGiveaway(panels)) continue;            // reject easy shortcuts

      const traps = panels.map((_, i) => i === breakerPos ? null :
        'Obeys the rule (equal numbers of black and white triangles). Every panel has the same total, ' +
        'and the same counts of black, white, triangles and circles — so no single feature can separate them.');

      const item = {
        type: 'oddOneOut', hard: true, camouflaged: true, options: panels, answerIndex: breakerPos, traps,
        rationale: 'In every figure the black triangles and white triangles are equal in number — except the ' +
                   'odd one, which has more black triangles than white. Counting only colour, or only shape, ' +
                   'will not work: you have to count the two together.',
        complexityPrior: 'high — conjunction search: no single feature pops out, so the eye must scan serially',
        countRule: true
      };
      item.difficulty = NVR.estimateDifficulty(item);
      item.band = NVR.band(item.difficulty);
      return item;
    }
    return null;    // caller should retry with a different seed (rare)
  }

  // ===========================================================================
  // B. EMBEDDED FIGURE  (geometry, verified)
  // ---------------------------------------------------------------------------
  const EPS = 0.7;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const len = (a) => Math.hypot(a[0], a[1]);
  const dotp = (a, b) => a[0] * b[0] + a[1] * b[1];

  function collinear(s1, s2) {
    const d1 = sub(s1[1], s1[0]), d2 = sub(s2[1], s2[0]);
    if (Math.abs(cross(d1, d2)) > EPS * Math.max(len(d1), len(d2)) * 0.06) return false;
    return Math.abs(cross(d1, sub(s2[0], s1[0]))) <= EPS * Math.max(len(d1), 1);
  }
  // merge all collinear-overlapping segments into maximal ones
  function mergeSegments(segs) {
    const groups = [];
    segs.forEach(s => {
      const g = groups.find(gr => collinear(gr[0], s));
      if (g) g.push(s); else groups.push([s]);
    });
    const out = [];
    groups.forEach(gr => {
      const base = gr[0], d = sub(base[1], base[0]), L = len(d);
      const u = [d[0] / L, d[1] / L];
      // project every endpoint, then merge overlapping intervals
      let iv = gr.map(s => {
        const t0 = dotp(sub(s[0], base[0]), u), t1 = dotp(sub(s[1], base[0]), u);
        return [Math.min(t0, t1), Math.max(t0, t1)];
      }).sort((a, b) => a[0] - b[0]);
      const merged = [iv[0].slice()];
      for (let i = 1; i < iv.length; i++) {
        const last = merged[merged.length - 1];
        if (iv[i][0] <= last[1] + EPS) last[1] = Math.max(last[1], iv[i][1]);
        else merged.push(iv[i].slice());
      }
      merged.forEach(([t0, t1]) => out.push([
        [base[0][0] + u[0] * t0, base[0][1] + u[1] * t0],
        [base[0][0] + u[0] * t1, base[0][1] + u[1] * t1]
      ]));
    });
    return out;
  }
  // is edge e fully covered by one of the merged segments?
  function edgeCovered(e, merged) {
    return merged.some(m => {
      if (!collinear(m, e)) return false;
      const d = sub(m[1], m[0]), L = len(d); if (L < EPS) return false;
      const u = [d[0] / L, d[1] / L];
      const t0 = dotp(sub(e[0], m[0]), u), t1 = dotp(sub(e[1], m[0]), u);
      const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
      // endpoints must lie on the line (perp distance) and within the extent
      const perp = (p) => Math.abs(cross(u, sub(p, m[0])));
      return perp(e[0]) <= EPS && perp(e[1]) <= EPS && lo >= -EPS && hi <= L + EPS;
    });
  }
  const polyEdges = (pts) => pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
  function polygonPts(sides, radius, rotDeg, cx = C, cy = C) {
    return Array.from({ length: sides }, (_, i) => {
      const a = (rotDeg - 90 + (360 / sides) * i) * Math.PI / 180;
      return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
    });
  }
  // Is a shape (given sides+radius) embedded anywhere in `merged`? Searches
  // rotations and a grid of centres — this is what proves a distractor is safe.
  function isEmbeddedAnywhere(sides, radius, merged, { rotStep = 15, posStep = 6, span = 24 } = {}) {
    for (let rot = 0; rot < 360 / sides + 0.001; rot += rotStep) {
      for (let dx = -span; dx <= span; dx += posStep) {
        for (let dy = -span; dy <= span; dy += posStep) {
          const pts = polygonPts(sides, radius, rot, C + dx, C + dy);
          if (polyEdges(pts).every(e => edgeCovered(e, merged))) return true;
        }
      }
    }
    return false;
  }

  function buildEmbeddedFigure({ rng = Math.random, noise = 'medium' } = {}) {
    const NOISE = { low: [2, 1], medium: [3, 2], high: [5, 3] }[noise] || [3, 2];
    const candidateSides = [3, 4, 5, 6, 8];
    for (let attempt = 0; attempt < 600; attempt++) {
      const targetSides = candidateSides[Math.floor(rng() * candidateSides.length)];
      const R = 30, rot = Math.floor(rng() * 4) * 15;
      const tPts = polygonPts(targetSides, R, rot);
      const segs = polyEdges(tPts).map(([a, b]) => {
        // extend each edge past both ends -> false junctions, contour no longer pops
        const d = sub(b, a), L = len(d), u = [d[0] / L, d[1] / L];
        const k = 8 + rng() * 12;
        return [[a[0] - u[0] * k, a[1] - u[1] * k], [b[0] + u[0] * k, b[1] + u[1] * k]];
      });
      // free-standing crossing lines; count set by the noise level
      const nNoise = NOISE[0] + Math.floor(rng() * (NOISE[1] + 1));
      for (let i = 0; i < nNoise; i++) {
        const a = 16 + rng() * 88, b = 16 + rng() * 88, c2 = 16 + rng() * 88, d2 = 16 + rng() * 88;
        segs.push([[a, b], [c2, d2]]);
      }
      const merged = mergeSegments(segs);

      // the target MUST be embedded (sanity — it is by construction)
      if (!polyEdges(tPts).every(e => edgeCovered(e, merged))) continue;

      // every distractor MUST NOT be embedded anywhere at this size
      const distractorSides = candidateSides.filter(s => s !== targetSides);
      if (distractorSides.some(s => isEmbeddedAnywhere(s, R, merged, { rotStep: 5, posStep: 3, span: 26 }))) continue;   // finer search: reject any accidental second target

      const optShapes = [targetSides, ...distractorSides];
      const figs = optShapes.map(s => figure([prim(
        { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon', 8: 'octagon' }[s],
        { x: C, y: C, size: 0.78, shading: 'white' })]));
      const answerFig = figs[0];
      const order = figs.slice();
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[order[i], order[j]] = [order[j], order[i]]; }
      const answerIndex = order.indexOf(answerFig);

      const item = {
        type: 'embedded', hard: true, camouflaged: true,
        stemSegments: segs, options: order, answerIndex,
        traps: order.map((f, i) => i === answerIndex ? null :
          'This shape is not present in the tangle — verified by geometry, not just by eye.'),
        rationale: 'One of the shapes is hidden in the pattern: all of its sides are drawn, but the lines run ' +
                   'past the corners and cross each other, so the outline does not stand out. The other shapes ' +
                   'cannot be found anywhere in it.',
        complexityPrior: 'high — perceptual: the contour is broken up by false junctions, defeating visual pop-out'
      };
      item.difficulty = NVR.estimateDifficulty(item);
      item.band = NVR.band(item.difficulty);
      return item;
    }
    return null;
  }

  // render raw segments (the embedded-figure stem)
  function renderSegments(segs, opts = {}) {
    const size = opts.size || 150;
    const body = segs.map(([a, b]) =>
      `<line x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}" ` +
      `stroke="${INK.line}" stroke-width="2" stroke-linecap="round"/>`).join('');
    return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
           `<rect x="3" y="3" width="114" height="114" rx="8" fill="#fff" stroke="${INK.light}" stroke-width="1.5"/>${body}</svg>`;
  }

  return {
    // conjunction
    buildConjunctionOddOneOut, countsOf, marginals, hasSingleFeatureGiveaway, panelFromCounts,
    // embedded
    buildEmbeddedFigure, renderSegments,
    mergeSegments, edgeCovered, polyEdges, polygonPts, isEmbeddedAnywhere,
    version: '1.0.0-camo'
  };
});
