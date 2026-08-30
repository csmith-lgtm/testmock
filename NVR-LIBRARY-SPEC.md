# NVR Question Library — Specification & House Reference

**Engine v1.1.0 · 3D v1.0.0 · Composition v1.0.0 · Hard v1.1.0 · Camouflage v1.0.0 · Assembly+Calibration v1.0.0** · UK English · single-file / SVG / Netlify-friendly
Companion engine: `nvr-engine.js` · 3D: `nvr-3d.js` · Composition: `nvr-compose.js` · Hard: `nvr-hard.js` · Camouflage: `nvr-camo.js` · Visual reference: `nvr-playground.html`

This is the stored reference for building 11+ Non-Verbal Reasoning lessons and
question sets. It records (1) how the major providers actually build NVR figures,
(2) the primitive vocabulary and attributes we model, (3) the rule grammar, and
(4) the shared 0–100 difficulty model. The engine implements all of this; this
document is the design rationale and the thing to read before extending it.

---

## 1. How NVR items are really made (and why this design follows it)

Providers do not publish their exact pipelines, but the industry method is well
understood and consistent across boards:

- Trained item writers build each figure in ordinary drawing software from a
  **small, fixed library of primitives**, working to a written **specification**.
- A question is just a **logical rule over a few attributes** of those primitives.
- **Difficulty is not known until items are trialled** on real cohorts and
  calibrated statistically — empirical tryouts come after authoring.
- More modern *algorithmic item generation* tightens this by **encoding the
  cognitive sources of difficulty into the specification** rather than leaving it
  to the artist's judgement.

The art is deliberately simple and schematic so that nothing but the reasoning is
being tested. This library mirrors that exactly: a compact primitive set, an
attribute model, a declarative rule layer, and a difficulty estimator that scores
the *engineered* sources of load up front (re-fit against your own cohorts later).

### Provider landscape (current, mid-2026)

- **GL Assessment** is now the dominant paper 11+ provider. A GL NVR paper is
  typically ~80 questions in four separately-timed sections of 20. GL is the
  board that uses **Codes** questions as a signature type.
- **CEM** withdrew paper-based 11+ from September 2023; it now survives only as an
  online format (Cambridge Select Insight) used by a minority of schools. "CEM
  style" still matters as a *difficulty register* — heavier spatial/3D emphasis,
  tight timing, more novel 2D types — even though most schools that used CEM moved
  to GL. CEM-style papers historically did **not** use the lettered Codes type.
- **CGP / Bond / Examberry** publish practice material in **both GL and CEM
  styles**; their figures use the same primitive vocabulary and conventions, so
  they are a good source for calibrating what "looks right".

### Question types we support (and where each fits)

| Type | Task | Board emphasis | Engine builder |
|---|---|---|---|
| Series / Sequences | find the next figure in a progression | GL + CEM | `buildSeries` |
| Analogies | A is to B as C is to ? | GL + CEM | `buildAnalogy` |
| Odd One Out / Belongs With / Similarities | find the figure that breaks (or shares) the set rule | GL + CEM | `buildOddOneOut` |
| Matrices (2×2 / 3×3) | find the missing grid cell | GL + CEM | `buildMatrix` |
| Codes | decode letter tags to attributes | **GL** | `buildCode` |
| Rotation / Reflection | identify a rotation/reflection of a figure | GL + CEM | `T.rotate`, `T.reflect` + `buildSeries`/`buildAnalogy` |
| Hidden / complete the figure | embedded shape, complete the pattern | GL + CEM | compose manually with `prim`/`figure` |
| Cube nets (3D) | which cube folds from this net | **CEM-heavy** | `NVR3D.buildCubeNet` |

---

## 2. Primitive vocabulary

A figure is a panel containing one or more **primitive instances**. The vocabulary
is intentionally small and schematic.

```
circle  dot  triangle  square  diamond  rectangle  pentagon  hexagon
octagon  star  arrow  cross  line  raindrop  crescent  heart
semicircle  lightning
```

The regular-polygon family (triangle…octagon) shares one generator, so **number
of sides** is a genuine, rule-addressable attribute (`SIDES[shape]`). Curved
shapes report 0 sides. `SYMMETRIC` records which primitives carry an axis of
symmetry for symmetry-based rules.

To add a primitive: add a generator to `GEOMETRY` (SVG markup centred on the
origin at base radius `R`), then register its `SIDES` count and, if applicable,
add it to `SYMMETRIC`.

---

## 3. Attributes (the only things a rule may read)

Every primitive instance carries:

| Attribute | Values | Notes |
|---|---|---|
| `shape` | one of the vocabulary | |
| `size` | scale multiplier (≈0.4 small, 1 medium, 1.4 large) | |
| `shading` | `white` `black` `grey` `hatch` `crosshatch` `stipple` `halfLeft` `halfRight` `halfTop` `halfBottom` | half-fills are clipped to the shape |
| `lineType` | `solid` `dashed` `dotted` | the outline style |
| `rotation` | degrees clockwise | fine angles (45/30) read as harder than right angles |
| `flip` | `none` `h` `v` | reflection axis |
| `x`, `y` | panel coordinates (panel is 120×120, centre 60,60) | use `layoutRing` / `layoutGrid` for tidiness |
| `colour` | ink for stroke / solid fill | greyscale-first, schematic |
| `z` | draw order | higher = in front (needed for overlap / "black in front" rules) |

Figure-level: `frame` (`none`/`box`/`circle`) and `bg`.

Derived attributes are read **only** through the `attr` (`A`) accessors —
`count`, `countShape`, `countShading`, `countLineType`, `sidesTotal`,
`hasBlackFront`, `anyOverlap`, `allSymmetric`, `distinctShadings`,
`distinctSizes`. Rules should never poke at `figure.items` directly; this keeps
rule logic stable if the model grows.

---

## 4. Rule grammar

Three rule families, all plain serialisable objects so a question set saves as
JSON.

**(a) Set rules** — a predicate true of every member of a unified set, used for
Odd One Out / Belongs With. Each has `id`, a `describe` string that becomes the
answer rationale, and `test(figure)`. Shipped examples (all drawn from genuine GL
rationale patterns):

- `dotsEqualLines` — "the number of dots equals the number of straight lines"
- `raindropsEqualDashed` — "raindrops equal the number of dashed-outline shapes"
- `oneBlackInFront` — "exactly one black shape, and it sits in front"
- `evenCount`, `allSameSides`, `shadedMajority`, `sidesEqualCount`

Add new ones to `SET_RULES` — keep `describe` phrased as the child-facing
rationale.

**(b) Transforms** — `figure → figure` maps for Series / Analogies / Matrices.
Built via the `T` factory: `T.rotate(deg)`, `T.reflect('h'|'v')`,
`T.scaleBy(k)`, `T.recolour(order)`, `T.addShape(shape)`, `T.translate(dx,dy)`.
Each carries a `describe` for the rationale. Transforms always return fresh
figures, so chaining a series never mutates earlier panels.

**(c) Codes** — `makeCodec(dimensions)` where each dimension maps one attribute's
values to letters, e.g. `{ attribute:'shading', letters:{white:'X', black:'Y'} }`.
This is the GL signature type. Codes deliberately vary only a few attributes
(classically: flipping, lines, shading, rotation), which is why their difficulty
scales mainly with the number of code dimensions.

---

## 5. Difficulty model (shared 0–100, tunable)

Difficulty is **engineered, not guessed** — the estimator scores the cognitive
sources of load that calibration repeatedly surfaces. Treat the output as a
**prior** for banding a set *before* trial; after a cohort sits it, re-fit by
adjusting `WEIGHTS` so the model's bands match observed facility values.

Scored features (`WEIGHTS` keys):

- `varyingAttributes` — how many attributes change across the stem (the dominant
  driver: one rule is easy, three simultaneous rules is hard)
- `elementLoad` — shapes per panel beyond the first
- `rotationFine` vs `rotationRight` — non-right angles cost more than 90/180
- `overlap` — overlapping shapes raise visual segmentation load
- `shadingVariety` — distinct shadings beyond the first
- `distractorCloseness` — **the single biggest lever**: if the nearest distractor
  differs from the answer on only one attribute, the item discriminates hard
- `countRule` — counting-based rules add load over a single salient cue
- `threeDimensional` — flag for spatial/3D framing

Bands: `Foundation` <25 · `Developing` 25–49 · `Secure` 50–71 · `Greater Depth` ≥72.

This intentionally matches the Greater Depth / Secure / Working-Towards register
used elsewhere in the maths resources, so NVR difficulty bands line up with the
assessment language pupils and staff already see.

---

## 6. Distractors

`makeDistractors(correct, k)` builds near-misses by perturbing **exactly one
attribute** (rotation, shading, line type, flip, size) — the standard NVR
strategy. Closeness is deliberate: a distractor that differs on one attribute is
what forces genuine discrimination rather than elimination by gross difference.
The difficulty estimator reads this back via `distractorCloseness`, so harder
distractor sets automatically score higher.

---

## 7. Using the library

**Browser / single-file lesson (house workflow):** paste the contents of
`nvr-engine.js` into the lesson's `<script>` (it self-attaches to `window.NVR`),
then call the builders and drop `renderFigure(...)` output into the DOM. This
keeps the lesson a single deployable file for Netlify + Google Sites iframe.

**Node validation pipeline:** `const NVR = require('./nvr-engine.js')`. Generate a
set, assert every item's `answerIndex` is reproducible, that set rules hold for
members and fail for the odd one, that codes round-trip (`encode` then decode),
and that difficulty bands fall where intended before export.

**Worked patterns:**

```js
// Series — rotate an arrow 45° each step
const item = NVR.buildSeries({
  start: NVR.figure([NVR.prim('arrow', { shading: 'grey' })]),
  transform: NVR.T.rotate(45),
  length: 4
});

// Odd one out — four figures share "dots = lines", one breaks it
const rule = NVR.SET_RULES.dotsEqualLines;
const ooo = NVR.buildOddOneOut({ rule, members, oddBuilder });

// Codes — two dimensions (shape, shading)
const codec = NVR.makeCodec([
  { attribute: 'shape',   letters: { circle:'P', square:'Q', triangle:'R' } },
  { attribute: 'shading', letters: { white:'X', black:'Y', grey:'Z' } }
]);
const code = NVR.buildCode({ codec, figures: examples, queryFigure: q });

// Every item carries: type, options, answerIndex, rationale, difficulty, band
```

---

## 8. Matrix builder (3×3, two interacting rules)

`buildMatrix({ base, rowT, colT, size = 3, missing, rng })` builds an *n*×*n*
grid where one transform runs **along the rows** and another **down the
columns**. Formally `cell(r,c) = colT` applied `r` times to (`rowT` applied `c`
times to `base`), so the rules compose consistently. The missing cell defaults
to bottom-right; the answer is the true contents of that cell, with four
single-attribute distractors. The rationale names both rules. Because two rules
interact, matrices score higher than single-rule series on the shared model
(`scoreMatrix` adds a two-rule base load plus the per-rule varying-attribute
weight). `renderMatrix(item, { size })` draws the whole grid as one SVG with the
missing cell as a dashed accent "?".

```js
const m = NVR.buildMatrix({
  base: NVR.figure([NVR.prim('arrow', { shading: 'white' })]),
  rowT: NVR.T.rotate(90),                       // each step across a row
  colT: NVR.T.recolour(['white','grey','black']) // each step down a column
});                                              // answer: bottom-right cell
```

## 9. 3D module — cube nets (`nvr-3d.js`)

Load the engine first, then `nvr-3d.js` (browser → `window.NVR3D`; Node →
`require('./nvr-3d.js')(NVR)`). It models the **"which cube folds from this
net?"** family.

- **`foldNet(net)`** rolls a cube across the net grid tracking a full integer
  rotation, returning, for every net cell, the cube face it becomes (`F/B/U/D/
  L/R`) **and** the symbol's rotation within that face. Validity is asserted —
  all six faces must be distinct — so a malformed layout is rejected at load,
  never silently shipped. Seven layouts ship, covering the 1-4-1, 2-2-2, 2-3-1
  and 3-3 net families; all verified so that opposite faces are never adjacent.
- **`renderNet(net, symbols)`** draws the flat net with a symbol on each face;
  **`renderCube(faces)`** draws an isometric cube showing the front, top and
  right faces (which meet at one vertex) with symbols painted onto each face at
  the correct orientation.
- **`buildCubeNet({ netName, rng })`** assigns distinct symbols to the net,
  folds it, builds the correct cube, and four *principled* distractors: a
  face-swap, a visibly-rotated symbol, and an **opposite-face** lure (a face that
  can never be adjacent to the others on the real cube). Distractor rotations are
  **symmetry-aware** — a 90° turn is only used where it actually changes the
  symbol (so a 4-fold cross is never "rotated" into an identical-looking trap).
  Options are deduped on what is *visually* distinct.

Items carry the standard contract (`type, stem, options, answerIndex, rationale,
difficulty, band`) with `threeD: true`; `stem` is `{ net, symbols }` and options
are face descriptors, rendered via the 3D renderers rather than `renderFigure`.

```js
const NVR3D = require('./nvr-3d.js')(NVR);
const item = NVR3D.buildCubeNet();            // random net + symbols
// item.stem -> NVR3D.renderNet(item.stem.net, item.stem.symbols)
// item.options[i] -> NVR3D.renderCube(item.options[i])
```

## 10. Composition layer — reaching the GL register (`nvr-compose.js`)

The base engine is **primitive-first**: scatter primitives, then test a rule.
That produces panels that read as a *random collection of objects*. Real GL
figures are **rule-first**: the rule dictates a deliberate composition inside a
fixed scene template, and a whole option set shares one motif so the five
pictures read as a family. This module supplies that. Load it after the engine
(browser → `window.NVRCompose`; Node → `require('./nvr-compose.js')(NVR)`).

What changes, concretely:

1. **Anchors, not scatter.** `interiorAnchors(k)` and `rowAnchors(k, y)` place
   interior elements on a tidy, grid-snapped sub-layout (singles centred, pairs
   level, threes as a triangle, fours as a 2×2). The ring-scatter is gone.
2. **Scene templates** produce a standard `figure` (so `renderFigure` is
   unchanged) with the container drawn first (`z=0`) and the interior layered
   above:
   - `sceneContainer` — a large outline shape holding *k* interior shapes and an
     optional dot tally. Backbone of "as many dots as shapes inside", "inner =
     outer", "shapes inside = sides of the container".
   - `scenePointer` — a central shape with a black dot to one side and an arrow
     that points toward (or away from) it. Backbone of directional relations.
   - `sceneOverlap` — two overlapping shapes with the front one shaded ("the
     black shape is in front").
3. **Relational, rule-first rules.** Each entry in `RULES` is not a predicate
   over a finished panel but a generator: `obey(param, palette)` *builds* a
   figure that satisfies the relation, and `break(param, palette)` builds the
   matched near-miss that violates exactly that relation while keeping the motif
   and palette identical. Shipped rules: `dotsMatchInner`, `innerMatchesOuter`,
   `arrowToDot`, `innerEqualsSides` — all phrased as the child-facing rationale.
4. **Cohesion by construction.** `buildCohesiveOddOneOut({ ruleId })` fixes one
   palette via `paletteFor`, then emits four obeying figures and one breaker —
   all the same kind of picture, differing only in the rule-relevant feature.
   `buildCohesiveSeries()` steps a relation across container panels with
   near-miss distractors that keep the motif but get one thing wrong (dots lag,
   inner lags, shading off, over-counts).

```js
const NC = require('./nvr-compose.js')(NVR);
const item = NC.buildCohesiveOddOneOut({ ruleId: 'dotsMatchInner' });
// item.options -> standard figures; render with NVR.renderFigure
```

**Authoring guidance for new types.** When adding a question type, write it as a
template + a relation, not as a scatter. Hold the palette fixed across the option
set. Make the distractors *minimal* near-misses of the relation, not gross
visual differences. Keep the element count small and reused. If a panel can't be
described in one sentence ("a square holding three dots with an arrow pointing
out of the top"), it is probably scattering rather than composing.

## 11. Genuinely tricky items (`nvr-hard.js`)

Difficulty that *discriminates at the top end* doesn't come from busier figures —
it comes from defeating a strong solver's first hypothesis. Three levers:
**compound rules** (several constraints at once), **indirection** (you must find
something before you can apply the rule), and above all **engineered
distractors** where every wrong option is the right answer to a slightly-wrong
reading. Each builder here returns a `traps` array — one entry per option naming
the misconception it targets (null for the answer) — which doubles as a marking
key. Load after the engine (browser → `window.NVRHard`).

- **`buildXorMatrix`** — the classic hard combination matrix. Each cell holds
  markers in a 2×2 slot grid; the third cell in a row keeps only the markers
  present in *exactly one* of the first two (XOR / symmetric difference — shared
  markers cancel). Two demonstrator rows establish the rule. Distractors are the
  competing combination rules: OR (union), AND (intersection), copy-left,
  copy-middle. Verified across 800 builds: answer always equals A⊕B, options
  always distinct. Band ≈ Greater Depth.
- **`buildCompoundOddOneOut`** — the rule is a multi-step count relation (dots
  inside = number of *sides* of the container). Shading is a deliberate decoy,
  but split **two-and-two** so it can *never* itself single out a figure — this
  is the principled way to bait the eye without making the item ambiguous (a
  decoy feature that uniquely identified one figure would give two defensible
  answers, which GL never does). Verified: exactly one count-breaker, always at
  the answer; decoy colour is 50/50 on the breaker so it carries no signal.
- **`buildCompositeAnalogy`** — A→B applies *three* changes at once (90°
  rotation, grey shading, dashed outline) and C is a different shape, so visual
  pattern-matching fails and the rule must be abstracted. Each distractor omits
  exactly one change, plus an over-rotation (180° not 90°).
- **`buildChiralitySeries`** — a fully asymmetric figure (a square with a corner
  dot *and* an edge bar, so no rotation maps it to its mirror) rotated 90° per
  step. The strongest distractors are its reflections — they look almost right
  but can never appear in a rotation sequence. Tests careful tracking and the
  rotation-vs-reflection distinction (chirality).

```js
const H = require('./nvr-hard.js')(NVR);
const item = H.buildXorMatrix();
item.traps.forEach((t, i) => t && console.log('ABCDE'[i], '→', t));  // marking key
```

A note on fairness: "tricky" must never mean "ambiguous". Every builder is
checked so exactly one option is defensible; the difficulty lives entirely in the
distractors and the rule, not in genuine doubt about the answer.

### What actually makes an instance hard (not just the type)

A trained pupil solves NVR by *systematically checking attributes*, so a clean
conjunction of independent rules ("rotate + grey + dashed") is cracked by
elimination regardless of how many attributes are stacked. Genuine difficulty
needs one of: **interaction** (one attribute governs another), **second-order**
structure (the rule is in the rate of change), **perceptual load** (the relevant
feature is hard to *see*), or **near-identical distractors** (differing by one
easily-missed feature). The first four hard builders above lean mostly on near
distractors and known-hard *types*; the two below target the reasoning itself:

- **`buildInteractionSeries`** — the arrow's rotation equals (number of dots) ×
  45°. The dot counts are non-monotonic across the examples, so there is no
  constant transformation to find: the default strategy fails, and you must
  discover that one attribute *controls* another, then apply it to the query
  count. Verified over 1000 builds: answer rotation always equals q × 45°.
- **`buildSecondOrderSeries`** — rotations accelerate (+30°, +60°, +90° → +120°).
  The dominant distractor is the constant-step continuation a first-order reading
  produces. The pattern lives in the differences, not the items.

**Perceptual load is the lever still missing.** Hiding the rule-bearing feature
among camouflage (overlapping outlines, embedded shapes, many similar elements)
needs a deliberate "messy" rendering mode rather than the clean schematic one,
and is the honest next build — not something to fake with a clean figure.


### Perceptual-load camouflage (`nvr-camo.js`)

This is the lever the earlier "hard" builders were missing. Stacking independent
rules doesn't defeat a pupil who checks attributes systematically; making the
rule-bearing feature **hard to see** does. Both builders here have their
camouflage *machine-verified* rather than asserted.

**A. Conjunction search — `buildConjunctionOddOneOut`.** Each panel holds twelve
small elements drawn from four kinds (black/white × triangle/circle). The rule is
a **conjunction**: the black triangles and white triangles are equal in number.
The camouflage is that every panel is generated with the *same* total, and the
generator then rejects any set where a single-feature reading (total, #black,
#white, #triangles, #circles, black−white, triangles−circles) gives any panel a
unique value. So counting colour alone, or shape alone, tells you nothing —
nothing "pops out", and the eye must scan serially and count a pair of features
together. Verified over 596 builds: zero single-feature giveaways, answer always
the sole rule-breaker.

**B. Embedded figure — `buildEmbeddedFigure`.** A target polygon is drawn, but
each edge is *extended past its corners* and free-standing lines are laid across
it, so the outline no longer segments out — the corners stop being corners. The
geometry is then verified: collinear segments are merged into maximal ones, and
a candidate shape counts as embedded only if every one of its edges is covered.
The answer is confirmed embedded, and **every distractor is confirmed absent**,
searched over rotations (15° steps) and a grid of centre positions at that size.
Verified over 200 builds: zero false answers, zero accidentally-embedded
distractors. `noise: 'low' | 'medium' | 'high'` tunes the load — measured at
roughly 8, 11 and 17 interior line-crossings (false junctions) respectively, with
the camouflage guarantees holding at every level.

```js
const CAMO = require('./nvr-camo.js')(NVR);
const conj = CAMO.buildConjunctionOddOneOut();          // may return null; retry
const emb  = CAMO.buildEmbeddedFigure({ noise: 'high' });
// emb.stemSegments -> CAMO.renderSegments(...)   (raw line rendering)
```

Both builders can return `null` when constraints can't be met on a given seed —
call in a short retry loop (the playground does this).

**On the difficulty numbers.** The `difficulty` field and bands are *structural
priors*, not measurements. As the project brief itself notes, true difficulty is
only known after items are trialled on a real cohort and calibrated. Treat the
score as "how much machinery the rule involves", weight a top-end set by *type*
and by expert eye, and re-fit `WEIGHTS` once you have facility data. Items now
also carry a plain-language `complexityPrior` string where relevant.

## 12. Calibration & paper assembly (`nvr-assemble.js`, `nvr-calibrate.js`)

This closes the loop the whole project points at: replacing *predicted* bands
with *measured* difficulty. It has three parts.

**Reproducible items.** `nvr-assemble.js` wraps every self-contained builder in a
deterministic PRNG so each item is stamped `builder@seed` and regenerated
exactly with `regenerate(id)`. This is the prerequisite for everything else: a
response row in a Sheet can be mapped back to the precise figure a pupil saw.
Verified byte-identical over 560 regenerations across all 15 presets.

**Paper assembly.** `assemblePaper(spec, opts)` selects items to a spec
(`[{ builder, count, band? }]`), and `renderPaper` lays them out as a single,
self-contained, print-and-deploy HTML paper (house style) with a toggleable
answer key built from the rationales and `traps`, and an embedded **manifest**
(question → id → correct answer → prior band). The manifest is the artifact that
links a paper to its response data.

**Calibration.** `nvr-calibrate.js` + the `calibrate.js` CLI take the manifest
plus a wide response table exported from your Google Sheet (one row per pupil,
one column per question, cells A–E) and compute, per item:
- **facility** — proportion correct (is a "Greater Depth" item actually hard?);
- **discrimination** — corrected point-biserial against the rest-score (does it
  sort pupils by ability? negative = broken or ambiguous, review first);
- **distractor analysis** — who chose each wrong option, split into ability
  thirds; a wrong option that pulls the *top* third is flagged, with its `trap`
  text, as a likely second-defensible reading or a real misconception to teach.
It also **refits the prior**: regresses observed facility on the structural
difficulty score, so the bands can be corrected to your cohort.

Correctness is proven end-to-end by `sim-calibrate.js`: it invents pupils with
known abilities and items with known true difficulties (correlated with, but not
equal to, the prior), simulates responses, plants one deliberately ambiguous
item, then runs the real calibration. It recovers facility-vs-true-difficulty at
r ≈ −0.8 and flags the planted item by its negative discrimination and the exact
lure distractor. See `example-calibration-report.md`.

### Running the loop

```bash
# 1. assemble a paper (edit the spec in build-deliverables.js), deploy/print it
node build-deliverables.js            # -> sample-paper.html + *-manifest.json

# 2. collect responses in a Sheet: columns  pupil, Q1, Q2, ... (cells A–E)
#    export as CSV  (responses-template.csv shows the exact format)

# 3. calibrate
node calibrate.js sample-paper-manifest.json responses.csv report.md
```

Practical notes: facility needs ~30+ responses per item to be stable, so this is
an accumulate-over-a-term exercise; discrimination is the better early signal of
a *bad* item even at smaller n. The flagged-distractor threshold (top-third rate
≥ 0.15) is deliberately sensitive — treat flags as "look at this", not "broken".


### Cohort banding (important)

Attainment bands are **relative to a cohort** — the same item sits in a lower band
for a more able group. The library ships two presets and defaults to `selective`:

- `general`   thresholds [25, 50, 72] — a broad-population prior.
- `selective` thresholds [40, 70, 92] — calibrated to a selective-prep cohort, on
  subject-lead judgement that items which are standard fare for such pupils (XOR
  matrices, conjunction search, composite analogies) should read as **Secure**,
  not Greater Depth.

`NVR.setCohort('general'|'selective')` switches globally; pass your own facility
data through the calibration harness to replace the presets entirely.

Two honest limits of the underlying score, unchanged by re-banding:
1. It is a **structural prior**, not a measurement — only cohort data makes bands real.
2. Its **per-item ordering is unreliable**: it cannot see perceptual load, so the
   camouflage items (conjunction, embedded) are under-scored and land too low,
   while the interaction rule is over-scored. Under `selective`, no current
   builder reaches Greater Depth — a deliberate, honest signal that a true top
   tier for an able cohort needs *combined-mechanism* items beyond what these
   single-mechanism builders produce.


### Combined-mechanism tier (`nvr-elite.js`)

Single-mechanism items are cracked by a trained pupil running an attribute
checklist, which is why the earlier "hard" builders read as standard for an able
cohort. These require holding several *independent* threads at once, or computing
a property before a second rule can be applied — so no single checklist pass
resolves them. Each carries a `threads` count as an honest structural descriptor.

- `buildTripleMatrix` — three independent rules run at once: outer shape by
  column, inner count by row, inner shading by diagonal. The answer is the ONLY
  option obeying all three; each main distractor matches exactly two, so tracking
  two threads (the common shortcut) fails. Verified: exactly one option satisfies
  all three rules, over 800 builds.
- `buildCrossConjunction` — odd-one-out on a *relation between two conjunction
  counts*: #black-triangles = #white-circles. Constructed so the answer is never
  unique on any single count (colour, shape, or either rule-count), so you must
  count two different sub-groups and compare — on a dense 12-element field.
  Verified: answer never single-count-identifiable, over 800 builds.
- `buildDependencySeries` — two rules keyed off the same property: turn =
  (number of sides) × 30°, and grey iff the number of sides is odd. Compute the
  property, then apply both. Verified answer correctness over 800 builds.

**Caveat, stated plainly:** the structural difficulty estimator *underrates these
badly* — it bands the 3-thread matrix as "Developing" and the cross-conjunction
as "Foundation", because it cannot see combinatorial or perceptual load. Trust
the `threads` descriptor and your own eye, not the band, until cohort data speaks.
Whether these hit a selective cohort's top tier is a question for trialling, not
for the estimator (or for me) to assert.


### v9 calibration (replaces the structural estimator for banding)

`nvr-v9-calibration.js` encodes the mechanism → score/band table taken from the
human-reviewed v9 production bank, and the assembler stamps every generated item
with it (`V9.stamp`). This supersedes the structural estimator, which ranked
items badly — most starkly, it scored a triple-attribute matrix "Developing"
when the bank rates it 91 (Greater Depth), and rated a count-controls-turn series
top-tier when the bank rates it 69 (Secure). Items keep their `structuralScore`
for reference; the shown `band`/`score` are now the bank's.

Mechanisms the bank has no anchor for — the perceptual/relational family the
generator adds (conjunction search, embedded figure, cross-category conjunction)
— are flagged `library-only` and floored at Secure with an explicit
"trial before trusting" note, because the bank cannot calibrate them.

The generator currently produces **10 of the bank's 24 mechanisms** (calibrated
directly); the remaining 14 are listed as build targets in `v9-gap-analysis.md`,
ranked by score. Ten of those are Greater-Depth mechanisms (interwoven,
interacting-movement, reflect-turn-alternation, the second-order and
count-controls variants, diagonal-shading, count-addition, cube-corner); building
them would bring the generator to parity with the bank's difficulty range while
adding fresh-instance generation the static bank can't provide.

## 13. Extension roadmap

- **Delivered:** dedicated 3×3 matrix builder; 3D cube-nets module with verified
  fold geometry, isometric rendering and symmetry-aware distractors; rule-first
  composition layer (scene templates + relational rules) that lifts items to the
  GL register.
- **Next 3D types** — net-from-cube (the inverse task), plans & elevations, and
  block-building/combining solids, all emitting the same item contract so they
  interleave with 2D items. (Dovetails with the existing nets-of-3D-shapes
  resource and the D4 rotation/reflection engine.)
- **Set-rule library growth** — add the rationale patterns seen in real GL answer
  keys as named `SET_RULES`, each phrased as the child-facing explanation.
- **Calibration loop** — after each cohort, store observed facility per item and
  least-squares-fit `WEIGHTS` so pre-trial bands track reality.
