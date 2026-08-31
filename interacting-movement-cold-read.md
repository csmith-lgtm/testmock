# `interacting-movement` — cold-read record

Mechanism: **interacting-movement** (v9: Matrix · Greater Depth · 85).
Builder: `NVRElite.buildInteractingMovement` · preset `interactingMovement`.

- Mechanical battery: `node verify-mechanism.js interactingMovement 600` → **0 failures**,
  600/600 built, 0 nulls.
- Rendered examples: `movement-examples.html` (no key) and
  `movement-examples-key.html` (answers + rationale).
  Regenerate with `node render-movement-examples.js <seeds…>`.

## The mechanism

Two objects travel independent circuits, and the third thread is a *dependency*
rather than a path of its own:

- the **dot** steps one place around the four **corners** per **column**;
- the **arrow** steps one place around the four **edge midpoints** per **row**;
- the **arrow always points at the dot**, so its heading is a function of *both*
  positions and cannot be read off either circuit alone.

Machine-checked over 800 builds: tracking only the two positions always leaves at
least two options standing, and tracking only "is it aimed at the dot" always
leaves at least two standing. Neither pair of threads is sufficient — all three
are needed, which is what the Greater-Depth band is claiming.

## Cold reads

Written from the rendered pictures alone, before the intended answers were
consulted, per BRIEF §5. All four uniquely produced the intended answer.

| Item | Cold-read answer | Intended | |
|---|---|---|---|
| `interactingMovement@1000` | E | E | match |
| `interactingMovement@1001` | E | E | match |
| `interactingMovement@1002` | C | C | match |
| `interactingMovement@1003` | B | B | match |

**1 · `@1000`** — Dot at a corner, arrow at an edge midpoint. Across the top row
the arrow stays on the right edge; down the left column the dot stays at the
bottom-right corner. So the dot's corner is set by the column (SE → NE → NW, one
step anticlockwise) and the arrow's edge by the row (right → top → left,
anticlockwise); in every cell the arrow points straight at the dot. Missing cell →
dot top-left, arrow left edge, aimed steeply up → **E**. (A leaves the arrow on
the top edge; B leaves the dot at the previous corner; C points away; D points at
the previous column's dot.)

**2 · `@1001`** — Dot by column SW → SE → NE; arrow by row right → top → left;
arrow aimed at the dot. Missing → dot top-right, arrow left edge, aimed
right-and-slightly-**up** → **E**. (A aims right-and-*down*, at the old dot; B
leaves the arrow on the top edge; C leaves the dot at the old corner; D points
away.)

**3 · `@1002`** — Dot by column SE → NE → NW; arrow by row top → left → bottom.
Missing → dot top-left, arrow bottom edge, aimed up-and-**left** → **C**. (A
leaves the arrow on the left edge; B leaves the dot top-right; D points away,
down-right; E aims up-*right*, at the old dot.)

**4 · `@1003`** — Dot by column NW → SW → SE; arrow by row top → right → bottom.
Missing → dot bottom-right, arrow bottom edge, aimed right-and-slightly-up →
**B**. (A leaves the arrow on the right edge; C leaves the dot bottom-left; D
points away; E is the middle cell copied — neither object moved on.)

## Two defects found and fixed by this cold-read

**The dot was too small to read.** At the paper's grid size a 3×3 matrix draws each
cell at about a quarter of a normal panel, and the dot came out at a **2.6px
radius** — a pinprick carrying a whole thread of the rule. I could only read the
first example by magnifying it, which is the tell. The dot is now 0.9 (4.8px at
paper size) and the arrow shortened to 0.4 to buy the room; the tightest
arrow-to-dot approach is 24.7 units, so the clearance is checked, and across 8400
figures nothing overlaps or leaves the panel.

**Two distractors could be near-identical.** Options sharing both positions differ
only by the arrow's heading. The answer is always ≥48° from every distractor by
construction, but two *distractors* could land 28° apart ("points away" versus
"points at the old dot", when the old dot lies roughly opposite) — in 25% of
items. That never made an item ambiguous, but it wasted two of the five slots on
lookalikes, which I noticed as D and E being hard to tell apart in example 4.
Any two same-position options must now be 40° apart, with two spare distractors
("the dot went back to where it started", "the arrow went back to where it
started") to fall through to. Minimum distractor-to-distractor separation is now
128°, and no item loses an option.

Neither defect was visible to the battery: both builds passed it identically.

## Note for the reviewer

The item asks the pupil to hold three things at once, but each is individually
simple, and the two circuits are disjoint (corners versus edge midpoints) so the
objects can never collide or be mistaken for one another. The heading is the part
worth watching in trialling: it is a genuine relational judgement ("does it point
at the dot?") rather than an angle to measure, and the nearest wrong heading is
48° away, but it is the thread most likely to be skipped by a pupil who has
already found the two movements.
