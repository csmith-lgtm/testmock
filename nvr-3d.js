/* =============================================================================
   NVR 3D  —  cube nets module  (extends the NVR engine; same item contract)
   -----------------------------------------------------------------------------
   Provides the "which cube folds from this net?" family and the geometry to
   render both a cube net (6 faces, each carrying a symbol) and an isometric
   cube (showing three mutually-adjacent faces).

   The hard part is correctness: foldNet() rolls a cube across the net grid,
   tracking a full integer rotation so every net cell is assigned the right
   cube face AND the right in-face symbol rotation. Validity is asserted (all
   six distinct faces) so a malformed layout can never silently ship.

   Items expose the same shape as the 2D engine:
     { type, stem, options, answerIndex, rationale, difficulty, band, threeD }
   ...but stem/options are 3D descriptors rendered by renderNet / renderCube.

   Load order:  nvr-engine.js  THEN  nvr-3d.js   ->  window.NVR3D
   Node:        const NVR = require('./nvr-engine'); const NVR3D = require('./nvr-3d')(NVR);
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = (NVR) => factory(NVR || require('./nvr-engine.js'));   // Node
  } else {
    root.NVR3D = factory(root.NVR);                                          // browser
  }
})(typeof self !== 'undefined' ? self : this, function (NVR) {
  'use strict';
  const { GEOMETRY, INK } = NVR;
  const PANEL = 120;

  // --- tiny integer 3-vector helpers (cube rotations are integer matrices) ---
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const eq  = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

  // Rolling a cube one net-cell in a direction = a 90° world rotation.
  // Net frame: right = +x, up(= toward smaller row) = +y, viewer = +z.
  const ROLL = {
    right: (v) => [-v[2], v[1], v[0]],   // about +Y by -90
    left:  (v) => [ v[2], v[1], -v[0]],  // about +Y by +90
    up:    (v) => [ v[0], -v[2], v[1]],  // about +X by +90
    down:  (v) => [ v[0], v[2], -v[1]]   // about +X by -90
  };

  // Cube-local face normals -> labels. A cell's visible (in-plane) face is the
  // local axis that the orientation maps to world +z.
  const LOCAL_FACES = [
    { n: [0, 0, 1], label: 'F' }, { n: [0, 0, -1], label: 'B' },
    { n: [0, 1, 0], label: 'U' }, { n: [0, -1, 0], label: 'D' },
    { n: [1, 0, 0], label: 'R' }, { n: [-1, 0, 0], label: 'L' }
  ];
  // Canonical in-face tangent frame (local coords): u = face "right", v = "up".
  const FACE_FRAME = {
    F: { u: [1, 0, 0],  v: [0, 1, 0]  },
    B: { u: [-1, 0, 0], v: [0, 1, 0]  },
    U: { u: [1, 0, 0],  v: [0, 0, -1] },
    D: { u: [1, 0, 0],  v: [0, 0, 1]  },
    R: { u: [0, 0, -1], v: [0, 1, 0]  },
    L: { u: [0, 0, 1],  v: [0, 1, 0]  }
  };

  // Orientation is stored as the three world-axis images of local x,y,z.
  // We only ever need world->local for a few unit vectors, done by projection.
  function worldToLocal(orient, w) {
    // orient.cols = images of local +x,+y,+z in world. local = orient^T * w.
    return [dot(orient.x, w), dot(orient.y, w), dot(orient.z, w)];
  }
  function applyRoll(orient, dir) {
    const f = ROLL[dir];
    return { x: f(orient.x), y: f(orient.y), z: f(orient.z) };
  }
  const labelOf = (localNormal) =>
    (LOCAL_FACES.find(F => eq(F.n, localNormal)) || {}).label;

  // rotation (0/90/180/270) taking canonical (u,v) to the symbol's (right,up)
  function faceRotation(orient, label) {
    const symRightLocal = worldToLocal(orient, [1, 0, 0]); // net +x in local
    const symUpLocal    = worldToLocal(orient, [0, 1, 0]); // net +y in local
    const { u, v } = FACE_FRAME[label];
    // find k so that rot(u,v by k°) == (symRight, symUp)
    let cu = u.slice(), cv = v.slice();
    for (let k = 0; k < 4; k++) {
      if (eq(cu, symRightLocal) && eq(cv, symUpLocal)) return k * 90;
      // rotate (cu,cv) by +90 in the face plane: u' = v, v' = -u
      const nu = cv.slice();
      const nv = cu.map(x => -x);
      cu = nu; cv = nv;
    }
    return 0; // should not happen for a valid fold
  }

  // --------------------------------------------------------------------------
  // foldNet — BFS over net cells, assign cube face + symbol rotation to each.
  // net: array of {r,c}; cell 0 is the base (= Front, rotation 0).
  // returns { byCell:[{face,rot}], byFace:{F:{cell,rot}, ...}, valid:boolean }
  // --------------------------------------------------------------------------
  function foldNet(net) {
    const key = (r, c) => `${r},${c}`;
    const index = new Map(net.map((p, i) => [key(p.r, p.c), i]));
    const orient = new Array(net.length);
    const byCell = new Array(net.length);
    orient[0] = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    const queue = [0], seen = new Set([0]);
    const dirs = [
      { dr: 0, dc: 1, roll: 'right' }, { dr: 0, dc: -1, roll: 'left' },
      { dr: -1, dc: 0, roll: 'up' },   { dr: 1, dc: 0, roll: 'down' }
    ];
    while (queue.length) {
      const i = queue.shift();
      const { r, c } = net[i];
      const faceLocalNormal = worldToLocal(orient[i], [0, 0, 1]);
      const label = labelOf(faceLocalNormal);
      byCell[i] = { face: label, rot: faceRotation(orient[i], label) };
      for (const d of dirs) {
        const j = index.get(key(r + d.dr, c + d.dc));
        if (j != null && !seen.has(j)) {
          seen.add(j);
          orient[j] = applyRoll(orient[i], d.roll);
          queue.push(j);
        }
      }
    }
    const byFace = {};
    byCell.forEach((b, i) => { if (b) byFace[b.face] = { cell: i, rot: b.rot }; });
    const valid = Object.keys(byFace).length === 6 && byCell.every(Boolean);
    return { byCell, byFace, valid };
  }

  // --------------------------------------------------------------------------
  // Net layouts (validated at module load; only valid ones are kept).
  // --------------------------------------------------------------------------
  const RAW_NETS = {
    // Latin cross — vertical 1-4-1
    latinCross:  [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }, { r: 3, c: 1 }],
    // horizontal 1-4-1, caps aligned at the left
    t141Aligned: [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 2, c: 0 }],
    // horizontal 1-4-1, caps at opposite ends (spread)
    t141Spread:  [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 2, c: 3 }],
    // horizontal 1-4-1, caps offset by one
    offset141:   [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 2, c: 2 }],
    // 2-2-2 staircase
    staircase:   [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 2 }, { r: 2, c: 3 }],
    // 2-3-1
    twoThreeOne: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 2, c: 3 }],
    // 3-3 offset (two rows of three, shifted by one)
    threeThree:  [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 1, c: 4 }]
  };
  const NETS = {};
  for (const [name, cells] of Object.entries(RAW_NETS)) {
    if (foldNet(cells).valid) NETS[name] = cells;
  }

  // --------------------------------------------------------------------------
  // Symbol drawing — reuse the engine's primitive geometry inside a transform.
  // Symbols are chosen so orientation is legible (arrow, triangle especially).
  // --------------------------------------------------------------------------
  const SYMBOLS = ['arrow', 'triangle', 'circle', 'cross', 'star', 'heart', 'dot', 'diamond'];

  // Rotational-symmetry order: a rotation is only *visible* if it isn't a
  // multiple of 360/order. (circle/dot look identical at any angle; cross,
  // square & diamond are 4-fold so 90/180/270 are invisible — a common trap.)
  const SYM_ORDER = {
    circle: Infinity, dot: Infinity, cross: 4, square: 4, diamond: 4,
    triangle: 3, star: 5, arrow: 1, heart: 1, raindrop: 1, crescent: 1
  };
  const rotVisible = (shape, deg) => {
    const o = SYM_ORDER[shape] != null ? SYM_ORDER[shape] : 1;
    return o !== Infinity && (deg % (360 / o)) !== 0;
  };
  // canonical rotation for dedup (collapses symmetry-equivalent angles)
  const rotCanon = (shape, deg) => {
    const o = SYM_ORDER[shape] != null ? SYM_ORDER[shape] : 1;
    return o === Infinity ? 0 : ((deg % (360 / o)) + (360 / o)) % (360 / o);
  };
  // a visible rotation amount for this symbol, or null if it has none
  const someVisibleRot = (shape) => [90, 180, 270].find(d => rotVisible(shape, d)) || null;
  function symbolMarkup(shape, transform, scale = 0.5) {
    const geo = (GEOMETRY[shape] || GEOMETRY.circle)();
    const attrs = Object.entries(geo.attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    const fill = (shape === 'dot' || shape === 'circle') ? INK.line : 'none';
    return `<g transform="${transform} scale(${scale})">` +
           `<${geo.tag} ${attrs} fill="${fill}" stroke="${INK.line}" stroke-width="${shape==='dot'?0:4}" ` +
           `stroke-linejoin="round" stroke-linecap="round"/></g>`;
  }

  // --------------------------------------------------------------------------
  // renderNet — draw the flat net, each cell a square with its symbol+rotation.
  // symbols: array aligned to net cells -> { shape } ; rotations come from caller
  // --------------------------------------------------------------------------
  function renderNet(net, symbols, opts = {}) {
    const size = opts.size || 150;
    const maxR = Math.max(...net.map(p => p.r)) + 1;
    const maxC = Math.max(...net.map(p => p.c)) + 1;
    const s = 100 / Math.max(maxR, maxC);                // cell side
    const offX = (120 - s * maxC) / 2, offY = (120 - s * maxR) / 2;
    let body = '';
    net.forEach((p, i) => {
      const x = offX + p.c * s, y = offY + p.r * s;
      const cx = x + s / 2, cy = y + s / 2;
      body += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#fff" ` +
              `stroke="${INK.line}" stroke-width="2"/>`;
      const sym = symbols[i];
      if (sym) {
        const tf = `translate(${cx},${cy}) rotate(${sym.rot || 0})`;
        body += symbolMarkup(sym.shape, tf, (s / 72) * 0.62);
      }
    });
    return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" ` +
           `xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  }

  // --------------------------------------------------------------------------
  // renderCube — isometric cube showing F (front), U (top), R (right).
  // faces: { F:{shape,rot}, U:{...}, R:{...} }  (rot in degrees within the face)
  // --------------------------------------------------------------------------
  // cabinet-style projection corners
  const P = {
    ftl: [34, 44], ftr: [82, 44], fbr: [82, 92], fbl: [34, 92],   // front square
    btl: [54, 28], btr: [102, 28], bbr: [102, 76]                  // back (depth = +20,-16)
  };
  const mid = (...pts) => [
    pts.reduce((a, p) => a + p[0], 0) / pts.length,
    pts.reduce((a, p) => a + p[1], 0) / pts.length
  ];
  // For each face: centre, screen vector for symbol-right (Ru) and symbol-down (Dv)
  const FACE_VIEW = {
    F: { quad: [P.ftl, P.ftr, P.fbr, P.fbl],
         c: mid(P.ftl, P.ftr, P.fbr, P.fbl),
         ru: [ (P.ftr[0]-P.ftl[0])/2, (P.ftr[1]-P.ftl[1])/2 ],
         dv: [ (P.fbl[0]-P.ftl[0])/2, (P.fbl[1]-P.ftl[1])/2 ] },
    U: { quad: [P.btl, P.btr, P.ftr, P.ftl],
         c: mid(P.btl, P.btr, P.ftr, P.ftl),
         ru: [ (P.btr[0]-P.btl[0])/2, (P.btr[1]-P.btl[1])/2 ],
         dv: [ (P.ftl[0]-P.btl[0])/2, (P.ftl[1]-P.btl[1])/2 ] },
    R: { quad: [P.ftr, P.btr, P.bbr, P.fbr],
         c: mid(P.ftr, P.btr, P.bbr, P.fbr),
         ru: [ (P.btr[0]-P.ftr[0])/2, (P.btr[1]-P.ftr[1])/2 ],
         dv: [ (P.fbr[0]-P.ftr[0])/2, (P.fbr[1]-P.ftr[1])/2 ] }
  };
  function faceTransform(view, rot, R = NVR.R) {
    // map symbol-local (right=+x, down=+y, radius R) onto the face, then spin rot
    const sc = 0.62;
    const a = view.ru[0] * sc / R, b = view.ru[1] * sc / R;
    const c = view.dv[0] * sc / R, d = view.dv[1] * sc / R;
    return `matrix(${r2(a)} ${r2(b)} ${r2(c)} ${r2(d)} ${r2(view.c[0])} ${r2(view.c[1])}) rotate(${rot})`;
  }
  const r2 = (x) => Math.round(x * 1000) / 1000;

  function renderCube(faces, opts = {}) {
    const size = opts.size || 120;
    const poly = (pts, fill) => `<polygon points="${pts.map(p => p.join(',')).join(' ')}" ` +
      `fill="${fill}" stroke="${INK.line}" stroke-width="2.4" stroke-linejoin="round"/>`;
    // draw back faces first (none visible) then U, R, F so front overlays
    let body = poly(FACE_VIEW.U.quad, '#f3f6fa') + poly(FACE_VIEW.R.quad, '#e9eef4') +
               poly(FACE_VIEW.F.quad, '#ffffff');
    for (const lbl of ['U', 'R', 'F']) {
      const f = faces[lbl];
      if (f && f.shape) {
        body += symbolMarkup(f.shape, faceTransform(FACE_VIEW[lbl], f.rot || 0), 1.0)
                  .replace('scale(1)', '');   // scale already in the matrix
      }
    }
    return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" ` +
           `xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  }

  // --------------------------------------------------------------------------
  // buildCubeNet — full item: a net + five candidate cubes (one correct).
  // --------------------------------------------------------------------------
  function pick(a, rng) { return a[Math.floor(rng() * a.length)]; }

  function buildCubeNet({ netName, rng = Math.random } = {}) {
    const names = Object.keys(NETS);
    const name = netName && NETS[netName] ? netName : pick(names, rng);
    const net = NETS[name];

    // assign distinct symbols to each net cell
    const pool = SYMBOLS.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
    const symbols = net.map((_, i) => ({ shape: pool[i] }));

    const fold = foldNet(net);
    // symbol+rotation that lands on each visible cube face
    const faceOf = (lbl) => {
      const { cell, rot } = fold.byFace[lbl];
      return { shape: symbols[cell].shape, rot };
    };
    const correct = { F: faceOf('F'), U: faceOf('U'), R: faceOf('R'), _net: name };

    // distractors: principled wrongness, deduped on what's actually VISIBLE
    const distractors = [];
    const visualKey = (c) => ['F', 'U', 'R'].map(l =>
      `${c[l].shape}@${rotCanon(c[l].shape, c[l].rot || 0)}`).join('|');
    const seenKey = new Set([visualKey(correct)]);
    const tryAdd = (cube) => {
      const k = visualKey(cube);
      if (!seenKey.has(k)) { seenKey.add(k); distractors.push(cube); return true; }
      return false;
    };

    // (1) swap two visible faces' symbols (impossible orientation of the trio)
    tryAdd({ F: correct.R, U: correct.U, R: correct.F });
    // (2) rotate one visible symbol by an amount that is actually visible
    for (const lbl of ['F', 'U', 'R']) {
      if (distractors.length >= 2) break;
      const d = someVisibleRot(correct[lbl].shape);
      if (d != null) {
        const spun = Object.assign({}, correct);
        spun[lbl] = { shape: correct[lbl].shape, rot: ((correct[lbl].rot || 0) + d) % 360 };
        tryAdd(spun);
      }
    }
    // (3) bring an OPPOSITE face into view (impossible adjacency) — strong lure
    const opp = { F: 'B', U: 'D', R: 'L' };
    const oppShape = (lbl) => symbols[fold.byFace[opp[lbl]].cell].shape;
    tryAdd({ F: { shape: oppShape('F'), rot: correct.F.rot }, U: correct.U, R: correct.R });
    tryAdd({ F: correct.F, U: { shape: oppShape('U'), rot: correct.U.rot }, R: correct.R });
    // (4) backfill: swap a different pair, then random visible rotations
    tryAdd({ F: correct.U, U: correct.F, R: correct.R });
    let guard = 0;
    while (distractors.length < 4 && guard++ < 40) {
      const lbl = pick(['F', 'U', 'R'], rng);
      const d = someVisibleRot(correct[lbl].shape);
      const cand = Object.assign({}, correct);
      if (d != null) cand[lbl] = { shape: oppShape(lbl), rot: (correct[lbl].rot || 0) + d };
      else cand[lbl] = { shape: oppShape(lbl), rot: correct[lbl].rot };
      tryAdd(cand);
    }

    const options = [correct, ...distractors.slice(0, 4)];
    for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[options[i], options[j]] = [options[j], options[i]]; }
    const answerIndex = options.indexOf(correct);

    const item = {
      type: 'cubeNet', threeD: true,
      stem: { net, symbols }, options, answerIndex,
      rationale: 'Track which symbols meet at one corner when the net folds: ' +
                 'the front, top and right faces must show the correct symbols and orientations. ' +
                 'Faces on opposite sides of the net can never be adjacent on the cube.'
    };
    item.difficulty = scoreCube(net, options, answerIndex);
    item.band = NVR.band(item.difficulty);
    return item;
  }

  const cubeKey = (c) => ['F', 'U', 'R'].map(l => `${c[l].shape}@${c[l].rot || 0}`).join('|');

  // Difficulty: 3D base + load from net length + nearest-distractor closeness.
  function scoreCube(net, options, ai) {
    let s = NVR.WEIGHTS.threeDimensional + 18;   // 3D + cube-net base
    const correct = options[ai];
    const diff = (a, b) => ['F', 'U', 'R'].reduce((t, l) =>
      t + ((a[l].shape !== b[l].shape) ? 1 : 0) + ((((a[l].rot||0)!==(b[l].rot||0))) ? 0.5 : 0), 0);
    const nearest = options.filter((_, i) => i !== ai).reduce((m, o) => Math.min(m, diff(correct, o)), 9);
    if (nearest <= 0.5) s += 16; else if (nearest <= 1) s += 9;
    return Math.max(0, Math.min(100, Math.round(s)));
  }

  return {
    foldNet, NETS, RAW_NETS, SYMBOLS,
    renderNet, renderCube, buildCubeNet,
    FACE_FRAME, FACE_VIEW,
    version: '1.0.0-3d'
  };
});
