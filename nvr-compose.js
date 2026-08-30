/* =============================================================================
   NVR COMPOSE  —  rule-first composition layer  (raises items to GL register)
   -----------------------------------------------------------------------------
   The base engine is PRIMITIVE-first: scatter primitives, then test a rule.
   Real GL figures are RULE-first: the rule determines a deliberate composition
   inside a fixed scene template, and a whole option set shares one motif so the
   five pictures read as a family. This module adds that.

   Three ideas:
     1. ANCHORS  — tidy, grid-snapped interior positions (no more ring scatter).
     2. SCENE TEMPLATES — a container-with-interior / pointer / pair motif that
        produces a standard `figure` (so renderFigure works unchanged).
     3. RELATIONAL RULES — generators that BUILD a figure obeying a relation,
        plus a matched near-miss that breaks exactly that relation while keeping
        the motif and palette identical (the GL-style discriminating distractor).

   Load after the engine.  Browser -> window.NVRCompose ; Node -> require(...)(NVR)
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = (NVR) => factory(NVR || require('./nvr-engine.js'));
  } else {
    root.NVRCompose = factory(root.NVR);
  }
})(typeof self !== 'undefined' ? self : this, function (NVR) {
  'use strict';
  const { prim, figure } = NVR;
  const C = 60;

  // --------------------------------------------------------------------------
  // 1. ANCHORS — tidy interior arrangements, grid-snapped. k items -> positions.
  //    These replace ring-scatter: items sit on a disciplined sub-grid so the
  //    interior of a container reads as intentional.
  // --------------------------------------------------------------------------
  const snap = (v) => Math.round(v / 2) * 2;
  function interiorAnchors(k, spread = 18, cy = C) {
    const s = spread;
    const layouts = {
      1: [[0, 0]],
      2: [[-s, 0], [s, 0]],
      3: [[0, -s], [-s, s], [s, s]],
      4: [[-s, -s], [s, -s], [-s, s], [s, s]],
      5: [[-s, -s], [s, -s], [0, 0], [-s, s], [s, s]],
      6: [[-s, -s], [0, -s], [s, -s], [-s, s], [0, s], [s, s]],
      7: [[-s, -s], [0, -s], [s, -s], [0, 0], [-s, s], [0, s], [s, s]],
      8: [[-s, -s], [0, -s], [s, -s], [-s, 0], [s, 0], [-s, s], [0, s], [s, s]]
    };
    return (layouts[k] || layouts[8]).map(([dx, dy]) => [snap(C + dx), snap(cy + dy)]);
  }
  // a neat horizontal row (used for dot tallies), centred at (C, y)
  function rowAnchors(k, y, gap = 13) {
    const start = C - (gap * (k - 1)) / 2;
    return Array.from({ length: k }, (_, i) => [snap(start + i * gap), snap(y)]);
  }

  // --------------------------------------------------------------------------
  // 2. SCENE TEMPLATES — each returns a standard figure (container drawn first).
  // --------------------------------------------------------------------------
  // container + interior shapes + optional dot tally inside the base
  function sceneContainer(opts) {
    const o = Object.assign({
      outer: 'hexagon', inner: 'triangle', count: 3, dots: 0,
      outerShading: 'white', innerShading: 'grey', innerSize: 0.3,
      outerSize: 1.55, frontBlack: false
    }, opts);
    const items = [prim(o.outer, { x: C, y: C, size: o.outerSize, shading: o.outerShading, z: 0 })];
    // interior shapes sit in the UPPER part so the bottom tally has clear space
    const interiorCY = o.dots > 0 ? C - 10 : C;
    interiorAnchors(o.count, 16, interiorCY).forEach(([x, y], i) => {
      const black = o.frontBlack && i === 0;
      items.push(prim(o.inner, { x, y, size: o.innerSize, shading: black ? 'black' : o.innerShading, z: black ? 3 : 2 }));
    });
    if (o.dots > 0) rowAnchors(o.dots, C + 36, 12).forEach(([x, y]) =>
      items.push(prim('dot', { x, y, size: 0.26, shading: 'black', z: 2 })));
    return figure(items);
  }

  // a central shape with a black dot to one side and an arrow that points at it
  const DIRS = { E: [34, 0, 0], S: [0, 34, 90], W: [-34, 0, 180], N: [0, -34, 270] };
  function scenePointer(opts) {
    const o = Object.assign({ base: 'circle', dir: 'E', pointsToward: true, baseShading: 'white' }, opts);
    const [dx, dy, ang] = DIRS[o.dir];
    const items = [
      prim(o.base, { x: C, y: C, size: 0.62, shading: o.baseShading, z: 1 }),
      prim('dot', { x: snap(C + dx), y: snap(C + dy), size: 0.42, shading: 'black', z: 2 }),
      prim('arrow', { x: snap(C + dx * 0.42), y: snap(C + dy * 0.42), size: 0.5,
        rotation: o.pointsToward ? ang : (ang + 180) % 360, z: 2 })
    ];
    return figure(items);
  }

  // two overlapping shapes, the front one shaded (motif: "front shape is black")
  function sceneOverlap(opts) {
    const o = Object.assign({ a: 'circle', b: 'square', frontShading: 'black', backShading: 'white', frontIsA: true }, opts);
    const back = prim(o.frontIsA ? o.b : o.a, { x: C + 12, y: C, size: 0.78, shading: o.backShading, z: 0 });
    const front = prim(o.frontIsA ? o.a : o.b, { x: C - 12, y: C, size: 0.78, shading: o.frontShading, z: 2 });
    return figure([back, front]);
  }

  // --------------------------------------------------------------------------
  // 3. RELATIONAL RULES — rule-first. Each rule knows how to GENERATE an obeying
  //    figure for a given parameter, and how to BREAK itself minimally. The set
  //    builder holds the palette fixed so all options share one motif.
  // --------------------------------------------------------------------------
  const RULES = {
    // "as many dots as shapes inside the container"
    dotsMatchInner: {
      describe: 'there are exactly as many dots as shapes inside the container',
      // palette fixes outer/inner shape & shading; param = inner count
      obey:  (p, pal) => sceneContainer({ ...pal, count: p, dots: p }),
      break: (p, pal) => sceneContainer({ ...pal, count: p, dots: p + 1 }),
      params: [2, 3, 4, 5, 6]         // five DISTINCT counts (5-option odd-one-out)
    },
    // "the inner shapes are the same shape as the container"
    innerMatchesOuter: {
      describe: 'the shapes inside are the same shape as the container',
      obey:  (sh, pal) => sceneContainer({ ...pal, outer: sh, inner: sh, count: 2, innerSize: 0.42 }),
      break: (sh, pal) => sceneContainer({ ...pal, outer: sh, inner: pal.oddInner, count: 2, innerSize: 0.42 }),
      params: ['triangle', 'square', 'pentagon', 'hexagon', 'star']
    },
    // "the arrow points towards the black dot"
    arrowToDot: {
      describe: 'the arrow points towards the black dot',
      obey:  (dir, pal) => scenePointer({ ...pal, dir, pointsToward: true }),
      break: (dir, pal) => scenePointer({ ...pal, dir, pointsToward: false }),
      params: ['E', 'S', 'W', 'N']
    },
    // "the number of shapes inside equals the number of sides of the container"
    innerEqualsSides: {
      describe: 'the number of shapes inside equals the number of sides of the container',
      obey:  (sh, pal) => sceneContainer({ ...pal, outer: sh, count: NVR.SIDES[sh], inner: pal.inner }),
      break: (sh, pal) => sceneContainer({ ...pal, outer: sh, count: NVR.SIDES[sh] + 1, inner: pal.inner }),
      params: ['triangle', 'square', 'pentagon', 'hexagon']
    }
  };

  // a sensible fixed palette per rule, so the set is a visual family
  function paletteFor(ruleId, rng = Math.random) {
    const innerShades = ['grey', 'black', 'hatch'];
    const pick = (a) => a[Math.floor(rng() * a.length)];
    switch (ruleId) {
      case 'dotsMatchInner':
        return { outer: pick(['hexagon', 'square', 'circle']), inner: pick(['triangle', 'circle', 'diamond']),
                 innerShading: pick(innerShades), outerShading: 'white' };
      case 'innerMatchesOuter':
        return { innerShading: 'grey', outerShading: 'white', oddInner: pick(['circle', 'diamond']) };  // never a container shape, always distinct
      case 'arrowToDot':
        return { base: pick(['circle', 'square', 'pentagon']), baseShading: 'white' };
      case 'innerEqualsSides':
        return { inner: pick(['dot', 'circle']), innerShading: 'black', outerShading: 'white' };
      default: return {};
    }
  }

  // --------------------------------------------------------------------------
  // 4. SET BUILDERS — cohesive by construction.
  // --------------------------------------------------------------------------
  // Odd-one-out: 4 figures obey the relation, 1 breaks it; all share the motif.
  function buildCohesiveOddOneOut({ ruleId, rng = Math.random } = {}) {
    const ids = Object.keys(RULES);
    for (let attempt = 0; attempt < 30; attempt++) {
      const id = ruleId && RULES[ruleId] ? ruleId : ids[Math.floor(rng() * ids.length)];
      const rule = RULES[id];
      const pal = paletteFor(id, rng);
      const params = rule.params;
      const oddPos = Math.floor(rng() * params.length);
      const options = params.map((p, i) =>
        i === oddPos ? rule.break(p, pal) : rule.obey(p, pal));
      // reject if any two options look identical (keeps every option distinct)
      if (new Set(options.map(NVR.figLookKey)).size !== options.length) continue;
      const item = {
        type: 'oddOneOut', cohesive: true, ruleId: id,
        options, answerIndex: oddPos,
        rationale: `Every figure shares one rule: ${rule.describe}. The odd one keeps the same ` +
                   `style but breaks it.`,
        countRule: /number|many|equals/.test(rule.describe)
      };
      item.difficulty = NVR.estimateDifficulty(item);
      item.band = NVR.band(item.difficulty);
      return item;
    }
    return null;
  }

  // Series with the container motif: a relation steps across the panels, and the
  // distractors are near-misses that keep the motif (one feature wrong).
  function buildCohesiveSeries({ rng = Math.random } = {}) {
    const pal = paletteFor('dotsMatchInner', rng);
    const counts = [1, 2, 3, 4];                 // inner & dots grow together
    const panels = counts.map(n => sceneContainer({ ...pal, count: n, dots: n }));
    const correct = panels[panels.length - 1];
    const stem = panels.slice(0, -1);
    // near-miss distractors: same motif, one thing off
    const last = counts[counts.length - 1];
    const distractors = [
      sceneContainer({ ...pal, count: last, dots: last - 1 }),   // dots lag
      sceneContainer({ ...pal, count: last - 1, dots: last }),   // inner lags
      sceneContainer({ ...pal, count: last, dots: last, innerShading: pal.innerShading === 'black' ? 'grey' : 'black' }),
      sceneContainer({ ...pal, count: last + 1, dots: last + 1 })// over-counts
    ];
    const opts = [correct, ...distractors];
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[opts[i], opts[j]] = [opts[j], opts[i]]; }
    const item = {
      type: 'series', cohesive: true, stem, options: opts, answerIndex: opts.indexOf(correct),
      rationale: 'Each step adds one shape inside and one dot, so the two counts always match.'
    };
    item.difficulty = NVR.estimateDifficulty(item);
    item.band = NVR.band(item.difficulty);
    return item;
  }

  return {
    interiorAnchors, rowAnchors,
    sceneContainer, scenePointer, sceneOverlap,
    RULES, paletteFor,
    buildCohesiveOddOneOut, buildCohesiveSeries,
    version: '1.0.0-compose'
  };
});
