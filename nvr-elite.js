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
      // Four obeyers (one per level) + the breaker = the five options the item
      // contract requires. Using ALL four levels keeps the guarantee that the
      // breaker's BT and WC each coincide with some obeyer, so it is never
      // unique on either count on its own.
      const levels = shuffle([1, 2, 3, 4], rng).sort((x, y) => x - y);
      const [j, k] = shuffle([0, 1, 2, 3], rng);
      const breaker = { BT: levels[j], WC: levels[k] };
      if (breaker.BT === breaker.WC) continue;
      const obeyers = levels.map(L => ({ BT: L, WC: L }));
      const base = [breaker, ...obeyers];
      const perm = shuffle([0, 1, 2, 3, 4], rng);
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
    // On a SQUARE the 30°-multiple rotations collapse modulo its 4-fold symmetry
    // (120° ≡ 30° ≡ 300°), so 'half a turn too far' becomes the answer and
    // '×45°' becomes 'a fixed 90°' — two of the five above vanish as invisible
    // duplicates and the option set falls to four. These fallbacks are the same
    // class of misconception at angles that stay visible on every shape used here.
    if (POLY[query - 1]) pool.push({ f: depFig(query - 1), trap: 'Used one fewer side in the turn.' });
    const qShade = query % 2 ? 'grey' : 'white';
    pool.push({ f: figure([prim(POLY[query], { x: C, y: C, size: 1, rotation: (query * 60) % 360, shading: qShade })]),
                trap: 'Multiplied the sides by 60° instead of 30°.' });
    pool.push({ f: figure([prim(POLY[query], { x: C, y: C, size: 1, rotation: (query * 30 + 45) % 360, shading: qShade })]),
                trap: 'Turned an extra eighth-turn past the right answer.' });
    const seen = new Set([figLookKey(answer)]); const kept = [];
    for (const p of pool) { const k = figLookKey(p.f); if (!seen.has(k)) { seen.add(k); kept.push(p); } if (kept.length === 4) break; }
    if (kept.length < 4) return null;                   // never ship a short option set
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


  // ===========================================================================
  // 4. INTERWOVEN SERIES   (v9 mechanism "interwoven" — Series, Greater Depth)
  //    Two sequences are interleaved by position parity. The odd panels carry an
  //    orientation-unmistakable shape turning a constant quarter-turn each time
  //    it appears; the even panels carry a DIFFERENT shape running a progression
  //    on a DIFFERENT attribute (a shading cycle, or steady growth). No single
  //    reading of the strip as a whole works: the pupil must split it into two
  //    threads, see whose turn is next, and continue only that one.
  //
  //    Fairness construction (BRIEF §5):
  //      * the two threads use visibly different SHAPES, so the alternation is
  //        self-evident and the parity of the missing panel is never in doubt;
  //      * the turning thread only uses ROT_ORDER-1 shapes (arrow, heart,
  //        raindrop, semicircle) so every quarter-turn is unmistakable; the
  //        other thread is never rotated, so polygons stay safe;
  //      * the turn is CONSTANT and the growth is monotone — nothing is
  //        second-order, so no accelerating increment has to be read as a rule;
  //      * neither thread is a count, so there is no off-by-one judgement;
  //      * a shading cycle would have to WRAP to give a 4th term, which is not
  //        inferable, so the shading thread is never the one asked for.
  // ===========================================================================
  const INTER_TURN  = ['arrow', 'heart', 'raindrop', 'semicircle'];   // every turn visible
  const INTER_PLAIN = ['triangle', 'square', 'pentagon', 'hexagon', 'circle', 'diamond', 'star'];
  const INTER_SHADES = ['white', 'grey', 'black'];
  const INTER_SIZES  = [0.6, 0.9, 1.2, 1.5];
  const pickOne = (a, rng) => a[Math.floor(rng() * a.length)];

  const turnFig = (shape, rot, shading) =>
    figure([prim(shape, { x: C, y: C, size: 1, rotation: ((rot % 360) + 360) % 360, shading })]);
  const plainFig = (shape, shading, size) =>
    figure([prim(shape, { x: C, y: C, size, shading, rotation: 0 })]);

  function buildInterwovenSeries({ rng = Math.random } = {}) {
    const tShape = pickOne(INTER_TURN, rng);
    const pShape = pickOne(INTER_PLAIN, rng);
    const step   = pickOne([90, 270], rng);                       // a quarter-turn either way
    // Right angles ONLY. The 'turned it back' distractor always sits 180° from
    // the answer, and on a DIAGONAL start that pair reads as one shape on one
    // diagonal (a grey raindrop at 45° vs 225° is barely separable) — a
    // perceptual off-by-one. At right angles the pair is up-vs-down or
    // left-vs-right, which is unmistakable on all four shapes.
    const start  = pickOne([0, 90, 180, 270], rng);
    const tShade = pickOne(INTER_SHADES, rng);
    const pShade = pickOne(INTER_SHADES, rng);
    const askTurn = rng() < 0.5;                                  // which thread is asked for
    const mode = askTurn ? pickOne(['shading', 'size'], rng) : 'size';

    const T_ = i => turnFig(tShape, start + i * step, tShade);
    const P_ = i => mode === 'shading' ? plainFig(pShape, INTER_SHADES[i % 3], 1)
                                       : plainFig(pShape, pShade, INTER_SIZES[i]);
    const turnWord = step === 90 ? 'a quarter-turn clockwise' : 'a quarter-turn anticlockwise';
    const growWord = mode === 'shading' ? 'change shading white → grey → black' : 'grow a step bigger';

    let stem, answer, pool;
    if (askTurn) {
      // ... A B A B A B ?  — the last panel shown is the plain shape, so the
      // missing panel is the next term of the TURNING thread.
      stem = [T_(0), P_(0), T_(1), P_(1), T_(2), P_(2)];
      answer = T_(3);
      const otherShade = pickOne(INTER_SHADES.filter(s => s !== tShade), rng);
      pool = [
        { f: T_(2), trap: `Repeated the last ${tShape} instead of turning it one more step.` },
        { f: T_(1), trap: `Turned the ${tShape} back the way it came instead of carrying on.` },
        { f: P_(3), trap: `Carried on the ${pShape} sequence — but the last panel was already a ${pShape}, so it is the ${tShape}'s turn.` },
        { f: turnFig(tShape, start + 3 * step, otherShade), trap: `Turned correctly, but changed the shading — the ${tShape}'s shading never changes.` },
        { f: turnFig(tShape, start + 3 * step + 180, tShade), trap: 'Turned half a turn too far.' }
      ];
    } else {
      // ... A B A B A B A ?  — the last panel shown is the turning shape, so the
      // missing panel is the next term of the GROWING thread.
      stem = [T_(0), P_(0), T_(1), P_(1), T_(2), P_(2), T_(3)];
      answer = P_(3);
      const otherShade = pickOne(INTER_SHADES.filter(s => s !== pShade), rng);
      pool = [
        { f: P_(2), trap: `Repeated the last ${pShape} instead of growing it one more step.` },
        { f: P_(0), trap: `Went back to the first ${pShape} instead of continuing the growth.` },
        { f: T_(4), trap: `Carried on the ${tShape} sequence — but the last panel was already a ${tShape}, so it is the ${pShape}'s turn.` },
        { f: plainFig(pShape, otherShade, INTER_SIZES[3]), trap: `Grown correctly, but the shading changed — the ${pShape}'s shading never changes.` },
        { f: P_(1), trap: 'Went back to an earlier size in the growth.' }
      ];
    }

    const seen = new Set([figLookKey(answer)]); const kept = [];
    for (const p of pool) { const k = figLookKey(p.f); if (!seen.has(k)) { seen.add(k); kept.push(p); } if (kept.length === 4) break; }
    if (kept.length < 4) return null;                     // never ship a short option set
    const opts = shuffle([answer, ...kept.map(p => p.f)], rng);
    const answerIndex = opts.indexOf(answer);
    const traps = opts.map(f => f === answer ? null : kept.find(p => p.f === f).trap);

    const item = {
      type: 'series', elite: true, threads: 2, stem, options: opts, answerIndex, traps,
      rationale: `Two sequences are interleaved. The ${tShape}s (1st, 3rd, 5th …) turn ${turnWord} ` +
                 `each time one appears; the ${pShape}s (2nd, 4th, 6th …) ${growWord}. The last panel ` +
                 `shown is a ${askTurn ? pShape : tShape}, so the missing panel continues the ` +
                 `${askTurn ? tShape : pShape} sequence.`,
      difficulty: NVR.estimateDifficulty({ type: 'series', stem, options: opts, answerIndex })
    };
    item.band = NVR.band(item.difficulty);
    return item;
  }


  // ===========================================================================
  // 5. INTERACTING MOVEMENT  (v9 mechanism "interacting-movement" — Matrix, GD)
  //    Two objects travel independent circuits, and a third thread is a
  //    DEPENDENCY rather than a path of its own:
  //      * the dot steps once around the four CORNERS per column;
  //      * the arrow steps once around the four EDGE MIDPOINTS per row;
  //      * the arrow always points AT the dot — its heading is a function of
  //        both positions, so it cannot be read off either circuit alone.
  //    Tracking only the two positions leaves three options standing; tracking
  //    only the arrow leaves the positions unresolved. All three are needed.
  //
  //    Fairness construction (BRIEF §5):
  //      * the two circuits are disjoint (corners vs edge midpoints), so the
  //        objects can never collide or be confused for one another;
  //      * only the arrow is ever rotated, and an arrow's orientation is
  //        unmistakable (ROT_ORDER 1);
  //      * headings to two different corners differ by at least 48° from every
  //        arrow position, so "points at the dot" vs "points at the old dot" is
  //        a plain visual difference, not a fine angular judgement;
  //      * nothing is counted and nothing accelerates — each step is one place
  //        around a circuit, shown twice before the answer cell.
  // ===========================================================================
  const MOVE_CORNERS = [[36, 36], [84, 36], [84, 84], [36, 84]];   // NW NE SE SW, clockwise
  const MOVE_MIDS    = [[60, 30], [90, 60], [60, 90], [30, 60]];   // N  E  S  W,  clockwise
  const headingTo = (from, to) =>
    (Math.round(Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI) + 360) % 360;
  // A 3x3 matrix renders each cell at roughly a quarter of a normal panel, so the
  // dot has to be drawn generously: at the paper's grid size a 0.5 dot comes out
  // about 2.6px across, and it carries a whole thread of the rule. The arrow is
  // shortened a little to buy that room — the closest an arrow ever sits to the
  // dot is 24.7 units (an edge midpoint to an adjacent corner), so the arrow's
  // reach plus the dot's radius must stay under that.
  function moveCell(dotPos, arrowPos, rot) {
    return figure([
      prim('arrow', { x: arrowPos[0], y: arrowPos[1], size: 0.40, shading: 'white', rotation: rot, z: 1 }),
      prim('dot',   { x: dotPos[0],   y: dotPos[1],   size: 0.90, shading: 'black', z: 2 })
    ]);
  }

  function buildInteractingMovement({ rng = Math.random } = {}) {
    // each circuit gets its own start and direction (+1 clockwise, +3 anticlockwise)
    const cStart = Math.floor(rng() * 4), cDir = rng() < 0.5 ? 1 : 3;
    const mStart = Math.floor(rng() * 4), mDir = rng() < 0.5 ? 1 : 3;
    const dotAt   = c => MOVE_CORNERS[(cStart + cDir * c) % 4];
    const arrowAt = r => MOVE_MIDS[(mStart + mDir * r) % 4];
    const cell = (c, r) => { const d = dotAt(c), a = arrowAt(r); return moveCell(d, a, headingTo(a, d)); };

    const grid = [];
    for (let r = 0; r < 3; r++) { const row = []; for (let c = 0; c < 3; c++) row.push(cell(c, r)); grid.push(row); }

    const D = dotAt(2), A_ = arrowAt(2), aim = headingTo(A_, D);
    const Dprev = dotAt(1), Aprev = arrowAt(1);
    const answer = moveCell(D, A_, aim);
    const pool = [
      { f: moveCell(D, A_, headingTo(A_, Dprev)),
        trap: 'Both objects are in the right place, but the arrow points at where the dot was in the previous column — it must point at the dot in its own cell.' },
      { f: moveCell(Dprev, A_, headingTo(A_, Dprev)),
        trap: 'The arrow moved on but the dot did not — the dot advances one corner per column.' },
      { f: moveCell(D, Aprev, headingTo(Aprev, D)),
        trap: 'The dot moved on but the arrow did not — the arrow advances one edge per row.' },
      { f: moveCell(D, A_, (aim + 180) % 360),
        trap: 'Points directly away from the dot instead of at it.' },
      { f: moveCell(Dprev, Aprev, headingTo(Aprev, Dprev)),
        trap: 'Neither object moved on — this is the cell above and to the left, copied.' },
      // spares, used when one of the above is filtered out by the separation rule
      { f: moveCell(dotAt(0), A_, headingTo(A_, dotAt(0))),
        trap: 'The dot has gone back to the corner it started from instead of moving on.' },
      { f: moveCell(D, arrowAt(0), headingTo(arrowAt(0), D)),
        trap: 'The arrow has gone back to the edge it started from instead of moving on.' }
    ];

    // Two options that share BOTH positions differ only by the arrow's heading, so
    // they have to be far enough apart to read as different answers. The answer is
    // always at least 48° from every distractor by construction, but two
    // DISTRACTORS could land within 28° of each other (points-away vs points-at-the
    // -old-dot, when the old dot lies roughly opposite) — a quarter of items had a
    // pair like that. It never made the item ambiguous, but it wasted two of the
    // five slots on near-lookalikes. Require 40° between any two same-position
    // options, and fall through to the spares above when that rejects one.
    const MIN_SEP = 40;
    const partsOf = f => ({ a: f.items.find(i => i.shape === 'arrow'), d: f.items.find(i => i.shape === 'dot') });
    const sameSpot = (f, g) => { const x = partsOf(f), y = partsOf(g);
      return x.a.x === y.a.x && x.a.y === y.a.y && x.d.x === y.d.x && x.d.y === y.d.y; };
    const sep = (f, g) => { const x = ((partsOf(f).a.rotation % 360) + 360) % 360;
      const y = ((partsOf(g).a.rotation % 360) + 360) % 360;
      const t = Math.abs(x - y); return Math.min(t, 360 - t); };

    const seen = new Set([figLookKey(answer)]); const kept = [];
    for (const p of pool) {
      if (kept.length === 4) break;
      const k = figLookKey(p.f);
      if (seen.has(k)) continue;
      if ([answer].concat(kept.map(x => x.f)).some(f => sameSpot(f, p.f) && sep(f, p.f) < MIN_SEP)) continue;
      seen.add(k); kept.push(p);
    }
    if (kept.length < 4) return null;                      // never ship a short option set
    const opts = shuffle([answer, ...kept.map(p => p.f)], rng);
    const answerIndex = opts.indexOf(answer);
    const traps = opts.map(f => f === answer ? null : kept.find(p => p.f === f).trap);

    const item = {
      type: 'matrix', elite: true, threads: 3, size: 3, grid, missing: [2, 2],
      options: opts, answerIndex, traps,
      rationale: 'Two objects move on their own circuits: the black dot steps one corner round as you go ' +
                 'across a row, and the arrow steps one edge round as you go down a column. The arrow always ' +
                 'points at the dot, so its direction depends on where BOTH have got to. The missing cell ' +
                 'needs the dot at its next corner, the arrow at its next edge, and the arrow aimed at the dot.',
      difficulty: NVR.estimateDifficulty({ type: 'matrix', options: opts, answerIndex, stem: grid.flat() })
    };
    item.band = NVR.band(item.difficulty);
    return item;
  }

  return { buildTripleMatrix, buildCrossConjunction, buildDependencySeries,
           buildInterwovenSeries, buildInteractingMovement,
           cellFig, depFig, turnFig, plainFig, moveCell, version: '1.2.0-elite' };
});
