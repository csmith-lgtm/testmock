# Build spec — Shape Properties Lab

A brief for Claude Code. This is the largest remaining gap in the Navigator: 13 unmapped objectives spanning Year 1 to Year 6, more than any other cluster.

**File:** `Shape_Properties_Lab_v1.html`, in the tools folder alongside the others.

## Objectives it must serve

Numbers are zero-based indices into the hub's `objectives` array.

| # | Year | Objective (abbreviated) | View needed |
|---|---|---|---|
| 186 | Y1 | recognise and name common 2-D and 3-D shapes | `name` |
| 188 | Y2 | properties of 2-D shapes: number of sides, line symmetry in a vertical line | `properties2d` |
| 189 | Y2 | properties of 3-D shapes: edges, vertices, faces | `properties3d` |
| 190 | Y2 | identify 2-D shapes on the surface of 3-D shapes | `properties3d` |
| 191 | Y2 | compare and sort common 2-D and 3-D shapes and everyday objects | `sort` |
| 194 | Y3 | draw 2-D shapes, make 3-D shapes, recognise 3-D shapes in different orientations | `properties3d` |
| 197 | Y3 | horizontal and vertical lines; perpendicular and parallel pairs | `lines` |
| 200 | Y4 | lines of symmetry in 2-D shapes in different orientations | `symmetry` |
| 201 | Y4 | complete a symmetric figure with respect to a given line | `symmetry` |
| 205 | Y5 | identify 3-D shapes, including cubes and cuboids, from 2-D representations | `properties3d` |
| 213 | Y6 | recognise, describe and build simple 3-D shapes, including making nets | `nets` |
| 215 | Y6 | name parts of circles: radius, diameter, circumference; diameter is twice radius | `circle` |
| 198, 214 | Y4/Y6 | compare and classify shapes by properties and sizes | `sort` (currently on Angle Lab's polygon view; a second link here would be better) |

Eight views: `name`, `properties2d`, `properties3d`, `sort`, `lines`, `symmetry`, `nets`, `circle`.

## Non-negotiable conventions

Match the existing tools exactly — read `Angle_Shape_Lab_v2.html` first and mirror its structure.

- **Single self-contained HTML file.** No external requests of any kind. Copy the embedded base64 Lexend Deca `@font-face` block from any existing tool; do not add a Google Fonts link.
- **The shared classroom bar**: `imtFreeze`, `imtHide`, `imtNew`, `imtFullscreen`, `imtClassStatus`, plus Teach / Explore / Challenge.
- **Scope the mode selector to buttons**: `document.querySelectorAll('button[data-imt-mode]')`. The unscoped form also matches `<html>`, which carries `data-imt-mode` after `setMode` runs, and every click then bubbles to the root and undoes Hide. This bug shipped once already.
- **Hide rule**: put `body.imt-hide-teaching` on *every* selector in the comma list. `body.imt-hide-teaching .a, .b` does not do what it looks like — `.b` becomes permanently invisible.
- **Hide conceals the outcome, keeps the question.** Hide the property counts, the classification, the answer line. Keep the shape, its labels and the axes. Test: could a child still answer with what remains on screen?
- **URL parameters**: read `view`, `year`, `focus`, `mode`. Every value the hub can emit must match a real `<option>`; a `<select>` set to an unknown value goes silently blank.
- **Year-sensitive defaults**, as the other tools now have: a Year 1 default example and a Year 6 default example should not be the same shape.
- Cream background, Lexend Deca, `lang="en"`, viewport meta, one `h1`, labelled form controls, mobile containment block (`.grid>*{min-width:0}` plus the 720px rule) — copy from an existing tool.

## What each view needs

**`name`** (Y1) — a shape with its name. 2-D: circle, triangle, square, rectangle. 3-D: cube, cuboid, sphere, cylinder, cone, pyramid. Keep it to naming; no property counts at Y1.

**`properties2d`** (Y2) — sides, vertices, and whether there is a vertical line of symmetry. Must include irregular examples, not just regular ones, or it teaches that "triangle" means "equilateral".

**`properties3d`** (Y2–Y5) — faces, edges, vertices, and *which 2-D shapes appear on the surfaces* (objective 190 asks for exactly this). Needs at least two orientations of the same solid, because objective 194 is about recognising a shape when it has been rotated, and objective 205 is about reading a solid from a 2-D drawing.

**`sort`** (Y2, Y4, Y6) — two or three shapes side by side with their properties, so a class can say what is the same and what is different. This is the comparison view; it does not need drag-and-drop.

**`lines`** (Y3) — horizontal, vertical, perpendicular and parallel. Show the pairs on a shape as well as in isolation, and rotate the shape so pupils see that "horizontal" is about the page, not about the shape.

**`symmetry`** (Y4) — two things: show the lines of symmetry on a given shape *in a non-standard orientation* (objective 200 says so explicitly), and let half a figure be completed across a given mirror line (objective 201). The second is the harder and more valuable one.

**`nets`** (Y6) — a net that folds to a named solid. Cube, cuboid, triangular prism, square-based pyramid at minimum. Include at least one arrangement of six squares that is **not** a valid cube net; being able to reject one is the point of the objective.

**`circle`** (Y6) — radius, diameter, circumference labelled on a circle, with the diameter shown as twice the radius by construction rather than only asserted in text.

## Mathematical checks it must pass

State these as acceptance criteria; they are the things I will verify:

1. Face, edge and vertex counts correct for every solid offered. Euler's formula (F − V + E = 2) holds for every polyhedron in the bank — a cheap self-check to build in.
2. Lines of symmetry correct for every 2-D shape, including irregular ones and including at non-standard orientations. A rectangle has 2, not 4.
3. Every net offered as valid genuinely folds to the named solid; every net offered as invalid genuinely does not.
4. Diameter is exactly twice the radius, in the drawing as well as the label.
5. Perpendicular and parallel relationships are true of the coordinates actually drawn, not just of the caption.
6. Stated properties match the shape as rendered. The Angle Lab shipped a version where the stated angle and the drawn angle differed by 90°; every claim must be checked against the SVG, not against the intent.

## Hub changes

In `interactiveTools`, add:

```js
{id:'shape-properties', name:'Shape Properties Lab', file:'Shape_Properties_Lab_v1.html',
 icon:'◇', cat:'Geometry', years:'Y1–Y6',
 desc:'Name, sort and describe 2-D and 3-D shapes, symmetry, nets and parts of a circle.',
 strands:['geo']}
```

In `toolPresetParams`, add a `view` branch keyed off the objective wording — circle terms → `circle`, net → `nets`, symmetr → `symmetry`, perpendicular/parallel/horizontal/vertical → `lines`, edges/vertices/faces/3-D → `properties3d`, sort/compare/classify → `sort`, sides/properties → `properties2d`, else `name`.

In `toolsForObjective`, route `geo` strand objectives matching those terms here.

Then add `'shape-properties': ['view','view']` to `PRESET_TARGET` in `tools.test.js` — section 5 of the test asserts the table covers every registered tool and will fail if you forget.

## Definition of done

`node tools.test.js .` passes with the new tool included, all 13 objectives above show a Shape Properties Lab link in the hub, and the six mathematical checks hold when spot-checked against the rendered SVG.
