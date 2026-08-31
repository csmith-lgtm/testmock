# Brief: extend the NVR question-generation library

You are extending a modular JavaScript library that generates Non-Verbal
Reasoning (11+) questions and outputs self-contained HTML/PDF papers. Work in
this directory. **Do one mechanism at a time and stop for human review after
each** — do not batch.

---

## 1. Read these first

| File | What it is |
|---|---|
| `NVR-LIBRARY-SPEC.md` | Full spec: architecture, item schema, rendering, calibration. Start here. |
| `v9-gap-analysis.md` | The build targets — mechanisms in the production bank the generator can't yet produce, ranked by difficulty. |
| `nvr-engine.js` | Primitives, attributes, transforms (`T.rotate/reflect/recolour`), `renderFigure`, and **`figLookKey`** — a geometry-based visual-identity key that accounts for rotational/reflective symmetry. Use it for all distinctness checks. |
| `nvr-compose.js`, `nvr-hard.js`, `nvr-camo.js`, `nvr-elite.js` | Existing builders. Copy their structure. `nvr-elite.js` (triple-attribute, cross-conjunction, dependency) is the closest model for new Greater-Depth mechanisms. |
| `nvr-assemble.js` | The `PRESETS` registry, `makeItem`/`regenerate` (seed→reproducible item), and paper rendering. Every builder must be registered here. |
| `nvr-v9-calibration.js` | Mechanism→band table and the builder→mechanism crosswalk. New builders join the crosswalk so they inherit the right band. |
| `nvr-calibrate.js` | Item statistics (facility, discrimination) — context for how items are later calibrated. |
| `verify-mechanism.js` | The verification battery every builder must pass. Run it (see §4). |
| `build-pupil-pdf.js` | How a paper is assembled and rendered — use its pattern to render your examples for the cold-read. |

---

## 2. Task

Implement the missing Greater-Depth mechanisms from `v9-gap-analysis.md`, **one at
a time**, starting with **`interwoven`** (two interleaved sequences: odd and even
positions each follow their own progression), then **`interacting-movement`**
(two objects moving on independent paths, plus a dependent attribute).

For each: add the builder to the appropriate module, register it in
`nvr-assemble.js` `PRESETS`, and add it to the crosswalk in
`nvr-v9-calibration.js`. Then verify, cold-read, and hand back before starting
the next.

---

## 3. Construction standard (mechanical — must be provably true)

Every item, over ≥500 seeds, must have:

- **exactly 5 options**, all visually distinct (dedupe with `NVR.figLookKey`);
- **no distractor equal to the answer**;
- **exactly one defensible answer**;
- **no degenerate stem** — every step or relationship produces a *visible*
  change. Never rely on a transform that is invisible on the chosen shape:
  - **rotations only on shapes whose orientation is unmistakable** (arrow, heart,
    semicircle, raindrop). Never rotate a near-symmetric polygon — a 90° turn on a
    square/pentagon/hexagon is invisible or near-invisible and is a known bug.
  - **reflections only where visible and not equivalent to a rotation** (most
    regular polygons are mirror-symmetric, so reflection does nothing — avoid).
- **seed-reproducible** via `makeItem`/`regenerate`.

## 4. Verify

```
node verify-mechanism.js <yourBuilderName> 600
```

Must report `MECHANICAL CHECKS PASSED` with 0 failures. If it rejects many seeds
(high null rate), your constraints may be too tight — check that's intended.

**A passing test suite is necessary but NOT sufficient.** It cannot tell whether a
child can infer the rule. That is §5.

## 5. Fairness standard (the part the tests can't check — do not skip)

The rule must be inferable by a Year-6 pupil from the **static item alone**, not
merely correct by construction. Every real defect this library has shipped passed
all automated checks and was still unfair. Avoid specifically:

- **accelerating / second-order rotations** — the changing increment reads as
  noise, not a rule;
- **off-by-one counts** — a difference of one dot among many is not perceptible;
- **a query panel that looks like a malformed sequence term** (e.g. a
  count-controls-turn item where the last shown panel is dots-only);
- **a stem that admits a simpler competing rule** — e.g. example shapes that
  accidentally form a trivial side-count sequence, letting the pupil "solve" it
  the wrong way;
- **perceptual load that leaves the target no more findable than a distractor**
  (the hidden-figure trap: geometrically embedded ≠ perceptually findable).

### Required cold-read (per mechanism)

Render 3–5 examples to image or standalone HTML. Then, **without looking at the
code or the intended answer**, write down in plain words:

1. what you see in each figure,
2. the single rule you infer,
3. the answer that rule produces.

If your cold description does **not** uniquely produce the intended answer, the
item is not done — **fix or replace it; do not rationalise why it is technically
correct.** (That rationalisation is the exact failure mode to avoid.)

A quick way to render an item to standalone HTML for the cold-read:

```js
const NVR = require('./nvr-engine.js');
const mods = { NVR3D: require('./nvr-3d.js')(NVR), NVRCompose: require('./nvr-compose.js')(NVR),
  NVRHard: require('./nvr-hard.js')(NVR), NVRCamo: require('./nvr-camo.js')(NVR) };
mods.NVRElite = require('./nvr-elite.js')(NVR, mods.NVRCamo);
const A = require('./nvr-assemble.js')(NVR, mods);
const it = A.makeItem('yourBuilder', 1234);
const svg = f => NVR.renderFigure(f, { size: 120 });
// concatenate svg(it.stem[i]) and svg(it.options[i]) into an .html file and open it.
// Or add 'yourBuilder' to the spec in build-pupil-pdf.js and run it to get the PDF.
```

The environment may lack a PNG rasteriser; standalone HTML opened in a browser is
the reliable path.

## 6. Definition of done (per mechanism)

- builder implemented, following the existing module patterns;
- `node verify-mechanism.js <builder> 600` → 0 failures;
- 3–5 rendered examples, each with a written cold-read description that uniquely
  yields the intended answer;
- registered in `nvr-assemble.js` `PRESETS` and in the `nvr-v9-calibration.js`
  crosswalk;
- `NVR-LIBRARY-SPEC.md` updated with a short entry.

**Then stop and hand back for human review.** House style: `viewBox="0 0 120 120"`,
transform groups, ink `#1f2933`, and **self-contained HTML with no external fonts**
(an external font link previously broke rendering — do not add one).

---

## The one thing to remember

The hard part of an NVR item is not the code — it is whether a child can fairly
infer the rule from a static picture. You share the author's blind spot: you know
the intended rule, so you cannot see the item cold the way a pupil does. Treating
"tests pass" as "item is good" is the mistake to avoid. Verify mechanically, then
read it as a stranger would, then hand it to a human — every time.
