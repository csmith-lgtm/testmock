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
orientations of every solid, which is what caught a tetrahedron that showed a
single face and a hexagonal prism with a 0.7% sliver. It reads the rendered SVG
rather than the captions, needs Playwright rather than jsdom, and exits 1 on
failure:

```
node shape_criteria.test.js
```

It also does not check mathematical correctness in general. Where maths has been verified — angles drawn matching angles stated, polygon interior angles against drawn vertices, rounding across place values and negatives — that was done with one-off probes. If you want any of those as permanent checks, they can be added as a section 7.

## Maintaining it

**When a tool gains a new preset parameter**, add a line to `PRESET_TARGET` near the top of section 5, mapping the tool's registry `id` to `[url-parameter, target-select-id]`. Section 5 asserts that this table covers every registered tool, so it will fail loudly if you add a tool and forget.

**When a new tool is added**, it is picked up automatically by sections 1, 2, 3 and 6. Only `PRESET_TARGET` needs the manual line.

**If a check fails and the code is actually right**, fix the check rather than deleting it — a deleted check is a bug waiting to come back. Each one is here because it already came back at least once.
