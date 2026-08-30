# Regression test — how to use it

## Running it

```
npm install jsdom canvas     # or: npm install && npm test
node tools.test.js .
```

`canvas` is needed as well as `jsdom`. The Coordinate Lab draws on a
`<canvas>`, and jsdom's `getContext()` throws unless the optional `canvas`
package is present — that surfaces as 2 failures (`Coordinate_Transformation_Lab
— no console output` and `hub — no runtime errors under preset load`) which are
the harness missing a dependency, not the package being broken.

Pass the package root as the argument (defaults to the current directory). It finds the Navigator hub and the `Interactive_Maths_Tools_*` folder itself, so it keeps working when the version number changes. Exit code is 0 on pass, 1 on failure, so it can gate a deploy.

**Run it before every deploy.** That is the whole point.

## What it checks, and why each check exists

Every check below corresponds to a bug that actually shipped at least once in v36–v40.

| Section | Check | The bug it guards against |
|---|---|---|
| 1 | Each tool loads with no console output and renders content | Tools that loaded but drew nothing |
| 2 | Every selector in a hide rule carries the `body.imt-hide-teaching` prefix | v38 lost the prefix on all but the first selector in a comma list, making teaching notes and answer lines **permanently invisible** in eight tools |
| 2 | Each hide rule matches at least one live element | v38's rules named classes the tools didn't render, so Hide/Reveal silently did nothing in six tools |
| 3 | `querySelectorAll('[data-imt-mode]')` is scoped to buttons | `setMode` puts `data-imt-mode` on `<html>`, so the unscoped selector attached a handler to the root element; every click anywhere then bubbled up and undid Hide |
| 3 | Hide toggles on and back off; Challenge changes something; Teach reveals | v38 removed `applySharedMode` and Challenge became a no-op in seven tools |
| 4 | Hub's objective bank and mapping functions parse and run | Guards the extraction itself |
| 4 | Registry count matches the folder; every registered file exists; every emitted link resolves | Folder renames that left stale paths behind |
| 4 | No objective emits two identical links | v38 appended duplicate links; v39 fixed it by overwriting and silently destroyed correct routing |
| 5 | Every distinct preset the hub emits lands on the intended control | Renamed select ids, values with no matching option (a `<select>` set to an unknown value goes silently blank) |
| 6 | No external requests | Tools declared Lexend Deca but never loaded it, so they rendered in Arial inside Google Sites |

## What it does NOT check

jsdom is a DOM and JavaScript runtime with **no layout engine**. It cannot see:

- layout or overflow at any width (only 3 tools carry the mobile containment block — 390px is still unverified)
- touch-target sizes
- whether Fullscreen actually works
- colour, contrast, font rendering
- whether a drawn shape looks right, as opposed to computing right

Those need a real browser and your eyes. The test guards the plumbing; you guard the appearance.

`shape_criteria.test.js` is a second, browser-based check covering the Shape
Properties Lab's six mathematical acceptance criteria — Euler's formula, lines
of symmetry at rotated orientations, whether each net genuinely folds, the
diameter being twice the radius, parallel and perpendicular pairs, and stated
properties against the drawn polygon — plus a seventh covering the three viewing
orientations of every solid (which caught a tetrahedron showing a single face
and a hexagonal prism with a 0.7% sliver) and an eighth on the dropdown and the
caption never disagreeing (which catches a view silently substituting a shape it
cannot draw). It reads the rendered SVG rather than the captions, needs
Playwright and a Chromium binary rather than jsdom, and exits 1 on failure:

```
node shape_criteria.test.js            # or: npm run test:shape
```

It finds the tool relative to itself, so it can be run from anywhere and
survives a version rename. If Playwright or Chromium is missing it says which
and exits 1, rather than passing silently.

It also does not check mathematical correctness in general. Where maths has been verified — angles drawn matching angles stated, polygon interior angles against drawn vertices, rounding across place values and negatives — that was done with one-off probes. If you want any of those as permanent checks, they can be added as a section 7.

## parent_guide.test.js

Checks `Parent_Maths_Guide_v40_1.html`, the standalone parent guide, against
`PARENT_GUIDE_complete.md`, which is its source of copy:

```
node parent_guide.test.js              # or: npm run test:guide
```

It needs jsdom only, finds its files relative to itself, and exits 1 on
failure. Twelve sections:

1. **The copy is the source, unedited.** Every word of the markdown appears on
   the page, in order. Renderer output, the contents rail, the panel labels and
   the year chips are stripped out first: they are furniture, not copy.
2. **Nothing on the page that was not written for parents.** Entry 14 is the
   last thing in the page, nothing follows it, and no draft commentary survives
   anywhere — no "Open questions", no "Bute House", no notes to the author.
3. **Every method carries the same three-part strip.** Entries 1–12 each show
   three drawn panels labelled *With objects / As a picture / Written down*,
   every strip sits outside the collapsed body so the page opens showing
   pictures, and all twelve bracketed lines survive verbatim as captions.
4. **The four questions, and the year chip.** All four headings on entries
   1–13, a chip of 60 characters or fewer on each, and the full "when you'll
   see it" paragraph still present in the prose.
5. **Getting around.** Fifteen contents links that all resolve, readable and
   unique anchor ids, a back-to-contents link in every entry, every section
   collapsed at load, and `#division` opening the division entry. Also that the
   guide links back to the hub and the hub links forward to the guide.
6. **Every visual is a hub renderer, unmodified.** Twenty-three renderers are
   compared byte-for-byte with the hub's, so the page draws nothing of its own
   and a hub fix reaches the guide.
7. **Staged reveal.** `pvc` numbers its columns from the ones and `numberLine`
   marks its hops; the area model and the expanded written method light up 80
   and 12 together; the counters and the column subtraction light the same
   place together; `longMult` stages ones-row first and `longDiv` left to
   right. All read from what is actually highlighted after stepping the block.
8. **The glossary, the band and the controls.** Nineteen terms, every arrow
   reference resolving to a method anchor *and* naming the method it points at,
   the glossary collapsing like an entry and listed in the contents; the
   homework band above the contents with every link resolving; Expand all and
   Collapse all moving every section and keeping `aria-expanded` in step; every
   heading reading as "5 Addition" rather than "5Addition" when copied or read
   aloud; and printing unhiding the prose, the hidden examples and the hidden
   strategy panels *in CSS*, so it does not depend on a `beforeprint` handler.
9. **Worked examples.** Entries 5–10 each offer more than one, one shown at a
   time so the entry does not grow, each with its own step controls; the
   caption appears only with the example it describes; the control cycles.
10. **Strategy comparison.** Sixteen questions, four per operation, tabbed;
    the framing line present; and every rendered route stepped to its last step
    and read back, so the answer the copy states and the answer the calculation
    reaches cannot drift apart. Also that at least four verdicts favour the
    written method, so the set is not rigged towards mental arithmetic.
11. *(numbering continues into 12)*
12. **Self-contained.** No external requests, the font embedded, and the hub's
    `:root` custom properties inlined intact — that last one is here because
    leaving the hub's own `<style>` tags in the inlined CSS silently swallowed
    the whole `:root` block and every `var()` on the page fell back to nothing.

Sections 2, 3, 6, 7, 8, 10 and 12 have each been run against a copy with the
defect reintroduced, and fail there.

**What it does not check:** the route descriptions' step and regroup counts.
Section 10 verifies the *answer* a route reaches, not prose like "four steps,
one regroup" — three of those counts in the supplied copy do not match the
calculation as rendered, and are flagged rather than corrected.

## Maintaining it

**When a tool gains a new preset parameter**, add a line to `PRESET_TARGET` near the top of section 5, mapping the tool's registry `id` to `[url-parameter, target-select-id]`. Section 5 asserts that this table covers every registered tool, so it will fail loudly if you add a tool and forget.

**When a new tool is added**, it is picked up automatically by sections 1, 2, 3 and 6. Only `PRESET_TARGET` needs the manual line.

**If a check fails and the code is actually right**, fix the check rather than deleting it — a deleted check is a bug waiting to come back. Each one is here because it already came back at least once.
