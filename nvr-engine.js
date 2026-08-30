/* =============================================================================
   NVR ENGINE  —  Non-Verbal Reasoning primitives, attributes, rules & difficulty
   -----------------------------------------------------------------------------
   House style: Lexend Deca, #f6f8fb, single-file friendly, SVG-rendered.
   Author context: Bute House maths resources — 11+ NVR question generation.

   WHAT THIS IS
     A compact "industry model" of how NVR items are actually built:
       primitives  -> a small fixed vocabulary of schematic shapes
       attributes  -> count, shading, size, rotation, flip, position, overlap,
                      line type, number of sides, symmetry, colour
       figure      -> one panel = a list of primitive instances
       rule        -> a logical predicate (set rules) OR a transform (series/
                      analogy/code) expressed declaratively over those attributes
       item        -> stem figure(s) + options (one correct, the rest near-miss
                      distractors), with a machine-estimated 0–100 difficulty

   This mirrors how GL / CGP / CEM-style items work: the art is deliberately
   schematic so only the reasoning is tested. Difficulty is encoded into the
   SPEC (cognitive sources), not left to the artist — see estimateDifficulty().

   USAGE
     Browser (single-file):  <script src="nvr-engine.js"></script>  -> window.NVR
     Node (validation):      const NVR = require('./nvr-engine.js');

   All output is UK English. All geometry is centred & deterministic so rendered
   panels can be visually QA'd and diffed.
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; // Node
  root.NVR = api;                                                          // browser
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 0. CONSTANTS & PALETTE  (schematic, dyslexia-friendly, greyscale-first)
  // ---------------------------------------------------------------------------
  const PANEL = 120;            // panel viewBox is PANEL x PANEL
  const C = PANEL / 2;          // centre (60,60)
  const R = 36;                 // base "radius" of a unit primitive at size 1
  const STROKE = 2.2;

  const INK = {
    line:   '#1f2933',          // outline / solid black-ish
    grey:   '#9aa6b2',          // mid grey shading
    light:  '#d7dee6',          // light fill
    accent: '#2f6f8f',          // schematic blue accent (used sparingly)
    paper:  '#ffffff',
    bg:     '#f6f8fb'           // house background
  };

  // The fixed primitive vocabulary. `sides` is used by the regular-polygon
  // family so "number of sides" is a first-class, rule-addressable attribute.
  const SHAPES = [
    'circle', 'dot', 'triangle', 'square', 'diamond', 'rectangle',
    'pentagon', 'hexagon', 'octagon', 'star', 'arrow', 'cross',
    'line', 'raindrop', 'crescent', 'heart', 'semicircle', 'lightning'
  ];

  const SHADINGS = [
    'white', 'black', 'grey', 'hatch', 'crosshatch', 'stipple',
    'halfLeft', 'halfRight', 'halfTop', 'halfBottom'
  ];

  const LINE_TYPES = { solid: null, dashed: '6 4', dotted: '1.5 4' };

  // ---------------------------------------------------------------------------
  // 1. GEOMETRY  —  each primitive returns SVG inner markup centred on origin,
  //    drawn at base radius R. Transform (translate/rotate/scale) is applied by
  //    the renderer, so shapes themselves stay clean and reusable.
  // ---------------------------------------------------------------------------
  function regularPolygon(n, radius, rotation = -90) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (rotation + (360 / n) * i) * Math.PI / 180;
      pts.push([radius * Math.cos(a), radius * Math.sin(a)]);
    }
    return pts;
  }
  const ptsStr = (pts) => pts.map(p => `${r2(p[0])},${r2(p[1])}`).join(' ');
  const r2 = (x) => Math.round(x * 100) / 100;

  // Each generator returns { tag, attrs } describing the path/polygon/etc.
  // `sides` lets the regular-polygon family share one generator.
  const GEOMETRY = {
    circle:  () => ({ tag: 'circle', attrs: { cx: 0, cy: 0, r: R } }),
    dot:     () => ({ tag: 'circle', attrs: { cx: 0, cy: 0, r: R * 0.28 } }),
    triangle:() => ({ tag: 'polygon', attrs: { points: ptsStr(regularPolygon(3, R)) } }),
    square:  () => ({ tag: 'rect', attrs: { x: -R * 0.8, y: -R * 0.8, width: R * 1.6, height: R * 1.6 } }),
    diamond: () => ({ tag: 'polygon', attrs: { points: ptsStr(regularPolygon(4, R, -90)) } }),
    rectangle:() => ({ tag: 'rect', attrs: { x: -R, y: -R * 0.6, width: R * 2, height: R * 1.2 } }),
    pentagon:() => ({ tag: 'polygon', attrs: { points: ptsStr(regularPolygon(5, R)) } }),
    hexagon: () => ({ tag: 'polygon', attrs: { points: ptsStr(regularPolygon(6, R, 0)) } }),
    octagon: () => ({ tag: 'polygon', attrs: { points: ptsStr(regularPolygon(8, R, 22.5)) } }),
    star: () => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? R : R * 0.42;
        const a = (-90 + 36 * i) * Math.PI / 180;
        pts.push([rr * Math.cos(a), rr * Math.sin(a)]);
      }
      return { tag: 'polygon', attrs: { points: ptsStr(pts) } };
    },
    arrow: () => ({ tag: 'polygon', attrs: { points: ptsStr([
      [-R, -R * 0.3], [R * 0.2, -R * 0.3], [R * 0.2, -R * 0.6], [R, 0],
      [R * 0.2, R * 0.6], [R * 0.2, R * 0.3], [-R, R * 0.3]
    ]) } }),
    cross: () => { const w = R * 0.34; return { tag: 'polygon', attrs: { points: ptsStr([
      [-w, -R], [w, -R], [w, -w], [R, -w], [R, w], [w, w], [w, R],
      [-w, R], [-w, w], [-R, w], [-R, -w], [-w, -w]
    ]) } }; },
    line: () => ({ tag: 'line', attrs: { x1: -R, y1: 0, x2: R, y2: 0 } }),
    raindrop: () => ({ tag: 'path', attrs: { d:
      `M 0 ${-R} C ${R * 0.75} ${-R * 0.2} ${R * 0.62} ${R * 0.85} 0 ${R} ` +
      `C ${-R * 0.62} ${R * 0.85} ${-R * 0.75} ${-R * 0.2} 0 ${-R} Z` } }),
    crescent: () => ({ tag: 'path', attrs: { d:
      `M 0 ${-R} A ${R} ${R} 0 1 0 0 ${R} A ${R * 0.78} ${R * 0.78} 0 1 1 0 ${-R} Z` } }),
    heart: () => ({ tag: 'path', attrs: { d:
      `M 0 ${R * 0.8} C ${-R * 1.4} ${-R * 0.2} ${-R * 0.5} ${-R} 0 ${-R * 0.35} ` +
      `C ${R * 0.5} ${-R} ${R * 1.4} ${-R * 0.2} 0 ${R * 0.8} Z` } }),
    semicircle: () => ({ tag: 'path', attrs: { d:
      `M ${-R} 0 A ${R} ${R} 0 0 1 ${R} 0 Z` } }),
    lightning: () => ({ tag: 'polygon', attrs: { points: ptsStr([
      [R * 0.15, -R], [-R * 0.5, R * 0.1], [-R * 0.02, R * 0.1],
      [-R * 0.15, R], [R * 0.5, -R * 0.1], [R * 0.02, -R * 0.1]
    ]) } })
  };

  // Sides count per primitive (for "number of sides" rules; 0 = curved/none).
  const SIDES = {
    triangle: 3, square: 4, diamond: 4, rectangle: 4, pentagon: 5,
    hexagon: 6, octagon: 8, cross: 12, star: 10, arrow: 7,
    circle: 0, dot: 0, line: 0, raindrop: 0, crescent: 0, heart: 0,
    semicircle: 0, lightning: 6
  };

  // Which primitives have an axis of symmetry by default (for symmetry rules).
  const SYMMETRIC = new Set([
    'circle', 'dot', 'triangle', 'square', 'diamond', 'rectangle', 'pentagon',
    'hexagon', 'octagon', 'star', 'cross', 'line', 'raindrop', 'heart', 'semicircle'
  ]);

  // ---------------------------------------------------------------------------
  // 2. FIGURE MODEL  —  immutable-ish factories. A figure is a panel + a list of
  //    primitive instances. Helpers always return fresh copies so transforms in
  //    series/analogies never mutate earlier panels.
  // ---------------------------------------------------------------------------
  function prim(shape, opts = {}) {
    return Object.assign({
      shape,
      size: 1,                 // scale multiplier
      shading: 'white',        // see SHADINGS
      lineType: 'solid',       // solid | dashed | dotted
      rotation: 0,             // degrees, clockwise
      flip: 'none',            // none | h | v   (reflection)
      x: C, y: C,              // centre position in panel coords
      colour: INK.line,        // stroke / solid-fill ink
      z: 0                     // draw order (higher = in front)
    }, opts);
  }

  function figure(items = [], opts = {}) {
    return Object.assign({
      items: items.map(it => Object.assign({}, it)),
      frame: opts.frame || 'none',   // none | box | circle
      bg: opts.bg || 'transparent'
    }, opts);
  }

  const cloneFig = (f) => figure(f.items.map(it => Object.assign({}, it)),
                                 { frame: f.frame, bg: f.bg });

  // ----- attribute accessors (rules read figures only through these) ---------
  const A = {
    count:        (f) => f.items.length,
    countShape:   (f, s) => f.items.filter(i => i.shape === s).length,
    countShading: (f, sh) => f.items.filter(i => i.shading === sh).length,
    countLineType:(f, lt) => f.items.filter(i => i.lineType === lt).length,
    sidesTotal:   (f) => f.items.reduce((t, i) => t + (SIDES[i.shape] || 0), 0),
    hasBlackFront:(f) => {
      const top = [...f.items].sort((a, b) => b.z - a.z)[0];
      return top && (top.shading === 'black');
    },
    anyOverlap:   (f) => {
      for (let i = 0; i < f.items.length; i++)
        for (let j = i + 1; j < f.items.length; j++) {
          const a = f.items[i], b = f.items[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < R * (a.size + b.size) * 0.5) return true;
        }
      return false;
    },
    allSymmetric: (f) => f.items.every(i => SYMMETRIC.has(i.shape)),
    distinctShadings: (f) => new Set(f.items.map(i => i.shading)).size,
    distinctSizes: (f) => new Set(f.items.map(i => r2(i.size))).size
  };

  // ---------------------------------------------------------------------------
  // 3. RULE GRAMMAR
  //    (a) SET RULES  — predicates true of every member of a unified set (used
  //        for Odd One Out / Similarities / Belongs With). describe() yields a
  //        GL-style answer rationale.
  //    (b) TRANSFORMS — figure -> figure maps (Series / Analogies / Matrices /
  //        Rotation / Reflection).
  //    (c) CODES      — attribute -> letter mappings (GL "codes" items).
  //    Rules are plain serialisable objects so question sets store as JSON.
  // ---------------------------------------------------------------------------

  // (a) Library of named set-rules. Each: { id, describe, test(figure) }.
  const SET_RULES = {
    dotsEqualLines: {
      id: 'dotsEqualLines',
      describe: 'the number of dots equals the number of straight lines',
      test: (f) => A.countShape(f, 'dot') === A.countShape(f, 'line')
    },
    raindropsEqualDashed: {
      id: 'raindropsEqualDashed',
      describe: 'the number of raindrops equals the number of dashed-outline shapes',
      test: (f) => A.countShape(f, 'raindrop') ===
                   f.items.filter(i => i.lineType === 'dashed' && i.shape !== 'raindrop').length
    },
    oneBlackInFront: {
      id: 'oneBlackInFront',
      describe: 'there is exactly one black shape, and it sits in front',
      test: (f) => A.countShading(f, 'black') === 1 && A.hasBlackFront(f)
    },
    evenCount: {
      id: 'evenCount',
      describe: 'the figure contains an even number of shapes',
      test: (f) => A.count(f) % 2 === 0
    },
    allSameSides: {
      id: 'allSameSides',
      describe: 'every shape has the same number of sides',
      test: (f) => new Set(f.items.map(i => SIDES[i.shape])).size === 1
    },
    shadedMajority: {
      id: 'shadedMajority',
      describe: 'more than half of the shapes are shaded (not white)',
      test: (f) => f.items.filter(i => i.shading !== 'white').length > A.count(f) / 2
    },
    sidesEqualCount: {
      id: 'sidesEqualCount',
      describe: 'the largest shape has as many sides as there are shapes in total',
      test: (f) => {
        if (!f.items.length) return false;
        const big = [...f.items].sort((a, b) => b.size - a.size)[0];
        return SIDES[big.shape] === A.count(f);
      }
    }
  };

  // (b) Transform builders. Each returns { id, describe, apply(figure) }.
  const T = {
    rotate: (deg) => ({
      id: `rotate(${deg})`,
      describe: `rotate by ${deg}° clockwise`,
      apply: (f) => { const g = cloneFig(f); g.items.forEach(i => i.rotation = (i.rotation + deg) % 360); return g; }
    }),
    reflect: (axis) => ({   // 'h' = mirror left-right, 'v' = mirror top-bottom
      id: `reflect(${axis})`,
      describe: `reflect ${axis === 'h' ? 'horizontally (left↔right)' : 'vertically (top↔bottom)'}`,
      apply: (f) => {
        const g = cloneFig(f);
        g.items.forEach(i => {
          i.flip = i.flip === axis ? 'none' : axis;
          if (axis === 'h') i.x = PANEL - i.x; else i.y = PANEL - i.y;
        });
        return g;
      }
    }),
    scaleBy: (k) => ({
      id: `scaleBy(${k})`,
      describe: `change size by ×${k}`,
      apply: (f) => { const g = cloneFig(f); g.items.forEach(i => i.size = r2(i.size * k)); return g; }
    }),
    recolour: (order) => ({   // cycle shading through an ordered list
      id: `cycleShading(${order.join('>')})`,
      describe: `advance shading: ${order.join(' → ')}`,
      apply: (f) => {
        const g = cloneFig(f);
        g.items.forEach(i => {
          const idx = order.indexOf(i.shading);
          if (idx !== -1) i.shading = order[(idx + 1) % order.length];
        });
        return g;
      }
    }),
    addShape: (shape) => ({
      id: `addShape(${shape})`,
      describe: `add one more ${shape}`,
      apply: (f) => {
        const g = cloneFig(f);
        const n = A.countShape(g, shape) + 1;
        g.items = layoutRing(g.items.filter(i => i.shape !== shape).concat(
          Array.from({ length: n }, () => prim(shape, { size: 0.6 }))));
        return g;
      }
    }),
    translate: (dx, dy) => ({
      id: `translate(${dx},${dy})`,
      describe: `move by (${dx}, ${dy})`,
      apply: (f) => { const g = cloneFig(f); g.items.forEach(i => { i.x += dx; i.y += dy; }); return g; }
    })
  };

  // (c) Codes. A code maps each chosen attribute to a letter from its own set.
  //     Classic GL codes vary a small handful: shading, lines, rotation, flip.
  function makeCodec(dimensions) {
    // dimensions: [{ attribute, letters: {value: 'A', ...} }]
    return {
      dimensions,
      encode(f) {
        const it = f.items[0] || prim('square');
        return dimensions.map(d => d.letters[readAttr(it, d.attribute)] ?? '?').join('');
      },
      describe() {
        return dimensions.map(d =>
          `${d.attribute}: ` + Object.entries(d.letters).map(([v, L]) => `${L}=${v}`).join(', ')
        ).join('; ');
      }
    };
  }
  function readAttr(it, attribute) {
    if (attribute === 'shading') return it.shading;
    if (attribute === 'lineType') return it.lineType;
    if (attribute === 'shape') return it.shape;
    if (attribute === 'rotation') return String(it.rotation);
    if (attribute === 'flip') return it.flip;
    if (attribute === 'size') return String(it.size);
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // 4. LAYOUT HELPERS  —  deterministic placement so panels are diffable.
  // ---------------------------------------------------------------------------
  function layoutRing(items, radius = R * 0.62) {
    const n = items.length;
    return items.map((it, i) => {
      if (n === 1) return Object.assign({}, it, { x: C, y: C });
      const a = (-90 + (360 / n) * i) * Math.PI / 180;
      return Object.assign({}, it, { x: C + radius * Math.cos(a), y: C + radius * Math.sin(a), size: it.size || 0.55 });
    });
  }
  function layoutGrid(items, cols = 3) {
    const pad = PANEL / (cols + 1);
    return items.map((it, i) => Object.assign({}, it, {
      x: pad * (1 + (i % cols)), y: pad * (1 + Math.floor(i / cols)), size: it.size || 0.42
    }));
  }

  // ---------------------------------------------------------------------------
  // 5. RENDERER  —  figure -> SVG string. Handles shading patterns, half-fills,
  //    line types, rotation/flip, draw order. Pattern <defs> are emitted once.
  // ---------------------------------------------------------------------------
  function defs() {
    return `
    <defs>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="${INK.line}" stroke-width="1.6"/>
      </pattern>
      <pattern id="crosshatch" width="7" height="7" patternUnits="userSpaceOnUse">
        <path d="M0 0 L7 0 M0 0 L0 7" stroke="${INK.line}" stroke-width="1.1"/>
      </pattern>
      <pattern id="stipple" width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.1" fill="${INK.line}"/>
      </pattern>
    </defs>`;
  }

  function fillFor(shading) {
    switch (shading) {
      case 'black': return INK.line;
      case 'grey':  return INK.grey;
      case 'hatch': return 'url(#hatch)';
      case 'crosshatch': return 'url(#crosshatch)';
      case 'stipple': return 'url(#stipple)';
      default: return 'none';        // white + half* handled separately
    }
  }

  let _uid = 0;
  function renderItem(it) {
    const geo = (GEOMETRY[it.shape] || GEOMETRY.square)();
    const dash = LINE_TYPES[it.lineType];
    const isLine = it.shape === 'line';
    const half = it.shading.startsWith('half');

    // transform: position -> rotate -> flip -> scale
    const flip = it.flip === 'h' ? ' scale(-1,1)' : it.flip === 'v' ? ' scale(1,-1)' : '';
    const tf = `translate(${r2(it.x)},${r2(it.y)}) rotate(${it.rotation})${flip} scale(${it.size})`;

    const baseAttrs = Object.entries(geo.attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    const stroke = `stroke="${it.colour}" stroke-width="${STROKE}" ` +
                   (dash ? `stroke-dasharray="${dash}" ` : '') +
                   `stroke-linejoin="round" stroke-linecap="round"`;

    if (isLine) return `<g transform="${tf}"><${geo.tag} ${baseAttrs} ${stroke}/></g>`;

    if (half) {
      // outline + a half-rectangle of black, clipped to the shape itself
      const cid = `clip${_uid++}`;
      const halfRect = ({
        halfLeft:  `x="${-R}" y="${-R}" width="${R}" height="${2 * R}"`,
        halfRight: `x="0" y="${-R}" width="${R}" height="${2 * R}"`,
        halfTop:   `x="${-R}" y="${-R}" width="${2 * R}" height="${R}"`,
        halfBottom:`x="${-R}" y="0" width="${2 * R}" height="${R}"`
      })[it.shading];
      return `<g transform="${tf}">
        <clipPath id="${cid}"><${geo.tag} ${baseAttrs}/></clipPath>
        <rect ${halfRect} fill="${INK.line}" clip-path="url(#${cid})"/>
        <${geo.tag} ${baseAttrs} fill="none" ${stroke}/>
      </g>`;
    }

    return `<g transform="${tf}"><${geo.tag} ${baseAttrs} fill="${fillFor(it.shading)}" ${stroke}/></g>`;
  }

  function renderFigure(f, opts = {}) {
    const size = opts.size || 110;
    const frame =
      f.frame === 'box'
        ? `<rect x="4" y="4" width="${PANEL - 8}" height="${PANEL - 8}" fill="none" stroke="${INK.light}" stroke-width="2"/>`
        : f.frame === 'circle'
          ? `<circle cx="${C}" cy="${C}" r="${C - 6}" fill="none" stroke="${INK.light}" stroke-width="2"/>`
          : '';
    const items = [...f.items].sort((a, b) => a.z - b.z).map(renderItem).join('\n');
    const bg = f.bg && f.bg !== 'transparent'
      ? `<rect width="${PANEL}" height="${PANEL}" fill="${f.bg}"/>` : '';
    return `<svg viewBox="0 0 ${PANEL} ${PANEL}" width="${size}" height="${size}" ` +
           `xmlns="http://www.w3.org/2000/svg" role="img">${defs()}${bg}${frame}${items}</svg>`;
  }

  // ---------------------------------------------------------------------------
  // 6. DIFFICULTY MODEL  (shared 0–100, tunable)
  //    Difficulty is engineered, not guessed: we score the cognitive sources of
  //    load that calibration studies repeatedly surface. These are PRIORS — true
  //    difficulty still needs cohort trialling — but they let a set be banded
  //    consistently before trial and re-fitted afterwards by adjusting WEIGHTS.
  // ---------------------------------------------------------------------------
  const WEIGHTS = {
    varyingAttributes: 9,   // per attribute that changes across the stem set
    elementLoad:       2.5, // per element beyond the first in a panel (mean)
    rotationFine:      14,  // rotation present and not a right angle (45/30 etc.)
    rotationRight:     6,   // rotation present at 90/180
    overlap:           8,   // any overlapping shapes
    shadingVariety:    4,   // per distinct shading beyond the first
    distractorCloseness: 22,// nearest distractor differs on only 1 attribute
    countRule:         5,   // rule depends on counting (vs. single salient cue)
    threeDimensional:  18   // spatial/3D framing flag
  };

  function attrDistance(a, b) {
    let d = 0;
    ['shape', 'shading', 'lineType', 'rotation', 'flip'].forEach(k => { if (a[k] !== b[k]) d++; });
    if (r2(a.size) !== r2(b.size)) d++;
    return d;
  }

  function estimateDifficulty(item, w = WEIGHTS) {
    let s = 0;
    const stem = item.stem || (item.series || []).slice(0, -1) || [];
    const panels = Array.isArray(stem) ? stem : [stem];

    // attributes that vary across the stem panels
    if (panels.length > 1 && panels[0].items) {
      const keys = ['shape', 'shading', 'lineType', 'rotation', 'flip', 'size'];
      const varied = keys.filter(k => {
        const vals = new Set(panels.map(p => (p.items[0] || {})[k]));
        return vals.size > 1;
      }).length;
      s += varied * w.varyingAttributes;
    }
    // element load
    const meanN = panels.reduce((t, p) => t + (p.items ? p.items.length : 0), 0) / Math.max(panels.length, 1);
    s += Math.max(0, meanN - 1) * w.elementLoad;

    // rotation register
    const rots = panels.flatMap(p => (p.items || []).map(i => i.rotation)).filter(Boolean);
    if (rots.some(r => r % 90 !== 0)) s += w.rotationFine;
    else if (rots.length) s += w.rotationRight;

    // overlap & shading variety
    if (panels.some(p => p.items && A.anyOverlap(p))) s += w.overlap;
    const shadeVar = Math.max(...panels.map(p => p.items ? A.distinctShadings(p) : 1));
    s += Math.max(0, shadeVar - 1) * w.shadingVariety;

    // distractor closeness (the single biggest lever in real items)
    if (item.options && item.answerIndex != null && item.options[0].items) {
      const correct = item.options[item.answerIndex];
      const nearest = item.options
        .filter((_, i) => i !== item.answerIndex)
        .reduce((m, o) => Math.min(m, attrDistance(correct.items[0] || {}, o.items[0] || {})), 99);
      if (nearest <= 1) s += w.distractorCloseness;
      else if (nearest === 2) s += w.distractorCloseness * 0.45;
    }
    if (item.countRule) s += w.countRule;
    if (item.threeD) s += w.threeDimensional;

    return Math.max(0, Math.min(100, Math.round(s)));
  }
  // Band thresholds are RELATIVE TO A COHORT. The same item sits in a lower band
  // for a more able group. 'general' is a broad-population prior; 'selective' is
  // calibrated to a selective-prep cohort (per subject-lead judgement: items that
  // are "standard fare" for such pupils should read as Secure/Developing, not
  // Greater Depth). Switch with setCohort(); override thresholds directly if you
  // have your own facility data from the calibration harness.
  const BAND_PRESETS = {
    general:   [25, 50, 72],   // Foundation < 25 ≤ Developing < 50 ≤ Secure < 72 ≤ Greater Depth
    selective: [40, 70, 92]    // shifts the whole scale up for an able cohort
  };
  let COHORT = 'selective';
  let THRESHOLDS = BAND_PRESETS[COHORT].slice();
  function setCohort(name) {
    if (!BAND_PRESETS[name]) throw new Error('unknown cohort: ' + name);
    COHORT = name; THRESHOLDS = BAND_PRESETS[name].slice(); return THRESHOLDS;
  }
  function band(score) {
    const [f, d, s] = THRESHOLDS;
    return score < f ? 'Foundation' : score < d ? 'Developing'
         : score < s ? 'Secure' : 'Greater Depth';
  }

  // ---------------------------------------------------------------------------
  // 7. DISTRACTORS  —  near-misses by perturbing exactly one attribute (the
  //    standard NVR strategy). Closeness is what makes an item discriminating.
  // ---------------------------------------------------------------------------
  // Rotational-symmetry order per shape (how many rotations look identical).
  const ROT_ORDER = {
    circle: Infinity, dot: Infinity, triangle: 3, square: 4, diamond: 4, rectangle: 2,
    pentagon: 5, hexagon: 6, octagon: 8, star: 5, cross: 4, line: 2,
    raindrop: 1, crescent: 1, heart: 1, semicircle: 1, arrow: 1, lightning: 1
  };
  const CHIRAL = new Set(['crescent', 'lightning']);   // reflection not reachable by rotation

  // Base outline points (unit coords) used to fingerprint orientation.
  function basePoints(shape) {
    const geo = (GEOMETRY[shape] || GEOMETRY.square)();
    if (geo.tag === 'polygon') return geo.attrs.points.trim().split(/\s+/).map(p => p.split(',').map(Number));
    if (geo.tag === 'rect') { const { x, y, width: w, height: h } = geo.attrs; return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
    if (geo.tag === 'line') return [[geo.attrs.x1, geo.attrs.y1], [geo.attrs.x2, geo.attrs.y2]];
    return null;   // circle / path
  }
  // A signature that is identical for two items iff they LOOK identical.
  function lookKey(it) {
    const base = `${it.shape}|${it.shading}|${it.lineType}|${r2(it.size)}|${Math.round(it.x)},${Math.round(it.y)}`;
    const pts = basePoints(it.shape);
    if (!pts) {                                   // circle/dot or path shape
      if ((ROT_ORDER[it.shape] || 1) === Infinity) return base + '|iso';
      const period = 360 / (ROT_ORDER[it.shape] || 1);
      const rot = ((Math.round(it.rotation) % period) + period) % period;
      const chir = CHIRAL.has(it.shape) ? (it.flip || 'none') : '';
      return `${base}|${rot}|${chir}`;
    }
    // transform points by flip then rotation, quantise, sort -> orientation class
    const a = it.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const fx = it.flip === 'h' ? -1 : 1, fy = it.flip === 'v' ? -1 : 1;
    const tp = pts.map(([x, y]) => {
      const px = x * fx, py = y * fy;
      return [Math.round((px * cos - py * sin) / 2) * 2, Math.round((px * sin + py * cos) / 2) * 2];
    }).map(p => p.join(',')).sort().join(' ');
    return base + '|' + tp;
  }
  const figLookKey = (f) => f.items.map(lookKey).sort().join(' || ');

  function variant(f, changes) {
    const g = cloneFig(f);
    g.items.forEach(i => Object.assign(i, changes));
    return g;
  }

  // Symmetry-aware distractors: build a rich candidate pool, then keep only
  // figures that look DISTINCT from the answer and from each other.
  function makeDistractors(correct, k = 4, rng = Math.random) {
    const head = correct.items[0] || prim('square');
    const otherShadings = SHADINGS.filter(s => s !== head.shading);
    const otherLines = Object.keys(LINE_TYPES).filter(l => l !== head.lineType);
    const singles = [
      ...[45, 90, 135, 180, 225, 270].map(d => ({ rotation: (head.rotation + d) % 360 })),
      ...otherShadings.map(s => ({ shading: s })),
      ...otherLines.map(l => ({ lineType: l })),
      { size: r2(head.size * 0.7) }, { size: r2(head.size * 1.35) },
      { flip: head.flip === 'h' ? 'none' : 'h' }, { flip: head.flip === 'v' ? 'none' : 'v' }
    ];
    // two-attribute combos as a fallback for highly symmetric shapes
    const combos = [];
    otherShadings.slice(0, 3).forEach(s => [90, 180].forEach(d =>
      combos.push({ shading: s, rotation: (head.rotation + d) % 360 })));

    const correctKey = figLookKey(correct);
    const seen = new Set([correctKey]);
    const out = [];
    for (let i = singles.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[singles[i], singles[j]] = [singles[j], singles[i]]; }
    for (const changes of [...singles, ...combos]) {
      if (out.length >= k) break;
      const cand = variant(correct, changes);
      const key = figLookKey(cand);
      if (!seen.has(key)) { seen.add(key); out.push(cand); }
    }
    return out;   // may be < k only for pathological shapes; callers request k=4
  }

  // ---------------------------------------------------------------------------
  // 8. ITEM BUILDERS  —  assemble complete questions with rationale + difficulty.
  // ---------------------------------------------------------------------------
  function shuffleWithAnswer(correct, distractors, rng = Math.random) {
    const opts = [correct, ...distractors];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));[opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return { options: opts, answerIndex: opts.indexOf(correct) };
  }

  function buildSeries({ start, transform, length = 4, rng = Math.random }) {
    const panels = [start];
    for (let i = 1; i < length; i++) panels.push(transform.apply(panels[i - 1]));
    const correct = panels[panels.length - 1];
    const { options, answerIndex } = shuffleWithAnswer(correct, makeDistractors(correct, 4, rng), rng);
    const item = {
      type: 'series', stem: panels.slice(0, -1), options, answerIndex,
      rationale: `Each step applies one rule — ${transform.describe}.`
    };
    item.difficulty = estimateDifficulty(item);
    item.band = band(item.difficulty);
    return item;
  }

  function buildAnalogy({ a, transform, c, rng = Math.random }) {
    const b = transform.apply(a);
    const correct = transform.apply(c);
    const { options, answerIndex } = shuffleWithAnswer(correct, makeDistractors(correct, 4, rng), rng);
    const item = {
      type: 'analogy', stem: [a, b, c], options, answerIndex,
      rationale: `A is to B as C is to ? — the rule is to ${transform.describe}.`
    };
    item.difficulty = estimateDifficulty(item);
    item.band = band(item.difficulty);
    return item;
  }

  function buildOddOneOut({ rule, members, oddBuilder, rng = Math.random }) {
    // members: figures that all satisfy `rule`; oddBuilder: makes one that breaks it
    const odd = oddBuilder();
    const all = [...members, odd];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));[all[i], all[j]] = [all[j], all[i]];
    }
    const item = {
      type: 'oddOneOut', options: all, answerIndex: all.indexOf(odd),
      countRule: /number|equal|count|even/.test(rule.describe),
      rationale: `Four figures share a rule: ${rule.describe}. The odd one breaks it.`
    };
    item.difficulty = estimateDifficulty(item);
    item.band = band(item.difficulty);
    return item;
  }

  function buildCode({ codec, figures, queryFigure, rng = Math.random }) {
    const correctCode = codec.encode(queryFigure);
    const wrongs = new Set();
    while (wrongs.size < 4) {
      const w = codec.dimensions.map(d => {
        const letters = Object.values(d.letters);
        return letters[Math.floor(rng() * letters.length)];
      }).join('');
      if (w !== correctCode) wrongs.add(w);
    }
    const opts = [correctCode, ...wrongs];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));[opts[i], opts[j]] = [opts[j], opts[i]];
    }
    const item = {
      type: 'code', examples: figures, query: queryFigure,
      options: opts, answerIndex: opts.indexOf(correctCode),
      rationale: `Each letter encodes one attribute — ${codec.describe()}.`,
      countRule: false
    };
    // codes vary only a few attributes; difficulty scales with dimension count
    item.difficulty = Math.min(100, 18 + codec.dimensions.length * 16);
    item.band = band(item.difficulty);
    return item;
  }

  // ---------------------------------------------------------------------------
  // 8b. MATRIX BUILDER  —  an n×n grid where one transform runs along the rows
  //     and another down the columns; the missing cell (default bottom-right) is
  //     the answer. cell(r,c) = colT applied r times to (rowT applied c times to
  //     base). Two interacting rules makes matrices the hardest 2D type, which
  //     the difficulty scorer reflects.
  // ---------------------------------------------------------------------------
  function buildMatrix({ base, rowT, colT, size = 3, missing, rng = Math.random }) {
    const applyN = (f, t, n) => { let g = f; for (let i = 0; i < n; i++) g = t.apply(g); return g; };
    const grid = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) row.push(applyN(applyN(base, rowT, c), colT, r));
      grid.push(row);
    }
    const mr = missing ? missing[0] : size - 1;
    const mc = missing ? missing[1] : size - 1;
    const correct = grid[mr][mc];
    const { options, answerIndex } = shuffleWithAnswer(correct, makeDistractors(correct, 4, rng), rng);

    const item = {
      type: 'matrix', size, grid, missing: [mr, mc], options, answerIndex,
      rationale: `Across each row: ${rowT.describe}. Down each column: ${colT.describe}. ` +
                 `Apply both to find the missing cell.`
    };
    item.difficulty = scoreMatrix(grid, [mr, mc], rowT, colT, options, answerIndex);
    item.band = band(item.difficulty);
    return item;
  }

  function scoreMatrix(grid, missing, rowT, colT, options, ai) {
    let s = 14;                                   // two-rule matrix base load
    // attributes that visibly change along a row / down a column
    const head = (f) => f.items[0] || {};
    const variedKeys = (a, b) => ['shape','shading','lineType','rotation','flip']
      .filter(k => head(a)[k] !== head(b)[k]).length + (r2(head(a).size) !== r2(head(b).size) ? 1 : 0);
    s += variedKeys(grid[0][0], grid[0][grid.length - 1]) * WEIGHTS.varyingAttributes;
    s += variedKeys(grid[0][0], grid[grid.length - 1][0]) * WEIGHTS.varyingAttributes;
    // element + distractor-closeness load (reuse the shared estimator's logic)
    const correct = options[ai];
    const nearest = options.filter((_, i) => i !== ai)
      .reduce((m, o) => Math.min(m, attrDistance(correct.items[0] || {}, o.items[0] || {})), 99);
    if (nearest <= 1) s += WEIGHTS.distractorCloseness;
    else if (nearest === 2) s += WEIGHTS.distractorCloseness * 0.45;
    return Math.max(0, Math.min(100, Math.round(s)));
  }

  // renderMatrix — full grid as one SVG, the missing cell drawn as a "?" box.
  function renderMatrix(item, opts = {}) {
    const n = item.size, gap = 8, cell = 96;
    const W = n * cell + (n + 1) * gap;
    let body = `<rect width="${W}" height="${W}" fill="transparent"/>`;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = gap + c * (cell + gap), y = gap + r * (cell + gap);
      const isMissing = r === item.missing[0] && c === item.missing[1];
      body += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="10" ` +
              `fill="#fff" stroke="${isMissing ? INK.accent : INK.light}" ` +
              `stroke-width="2"${isMissing ? ' stroke-dasharray="6 5"' : ''}/>`;
      if (isMissing) {
        body += `<text x="${x + cell / 2}" y="${y + cell / 2 + 14}" text-anchor="middle" ` +
                `font-size="40" font-weight="700" fill="${INK.accent}" ` +
                `font-family="Lexend Deca, sans-serif">?</text>`;
      } else {
        const inner = renderFigure(item.grid[r][c], { size: cell - 12 })
          .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
        body += `<svg x="${x + 6}" y="${y + 6}" width="${cell - 12}" height="${cell - 12}" ` +
                `viewBox="0 0 ${PANEL} ${PANEL}">${inner}</svg>`;
      }
    }
    return `<svg viewBox="0 0 ${W} ${W}" width="${opts.size || W}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  }

  // ---------------------------------------------------------------------------
  // 9. PUBLIC API
  // ---------------------------------------------------------------------------
  return {
    // constants / vocabulary
    PANEL, C, R, INK, SHAPES, SHADINGS, LINE_TYPES, SIDES, SYMMETRIC,
    // geometry
    GEOMETRY, regularPolygon,
    // model
    prim, figure, cloneFig, attr: A,
    layoutRing, layoutGrid,
    // rules
    SET_RULES, T, makeCodec,
    // render
    renderFigure, renderItem,
    // difficulty
    WEIGHTS, estimateDifficulty, band, attrDistance,
    // items
    makeDistractors, buildSeries, buildAnalogy, buildOddOneOut, buildCode, buildMatrix,
    renderMatrix, lookKey, figLookKey, ROT_ORDER,
    setCohort, BAND_PRESETS,
    // meta
    version: '1.1.0'
  };
});
