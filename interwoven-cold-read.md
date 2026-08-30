# `interwoven` — cold-read record

Mechanism: **interwoven** (v9: Series · Greater Depth · 77).
Builder: `NVRElite.buildInterwovenSeries` · preset `interwoven`.

- Mechanical battery: `node verify-mechanism.js interwoven 600` → **0 failures**,
  600/600 built, 0 nulls.
- Rendered examples: `interwoven-examples.html` (no key) and
  `interwoven-examples-key.html` (answers + rationale).
  Regenerate with `node render-interwoven-examples.js <seeds…>`.

The descriptions below were written from the **rendered pictures only**, before
the intended answers were consulted, per BRIEF §5. All five uniquely produced the
intended answer.

| Item | Cold-read answer | Intended | |
|---|---|---|---|
| `interwoven@1005` | A | A | match |
| `interwoven@1002` | D | D | match |
| `interwoven@1027` | C | C | match |
| `interwoven@1000` | B | B | match |
| `interwoven@1003` | D | D | match |

## 1 · `interwoven@1005`

*What I see.* Six panels. Panels 1, 3, 5 are grey teardrops with the tip pointing
right, then down, then left. Panels 2, 4, 6 are pentagons of unchanging size going
white → grey → black.

*Rule inferred.* Two sequences are plaited together. The teardrops turn a
quarter-turn clockwise each time one appears; the pentagons darken through the
cycle. The last panel shown is a pentagon, so the missing panel is the next
teardrop.

*Answer produced.* Tip turned one more quarter-turn → pointing **up**, still grey
→ **A**. B points down (the previous teardrop); C is horizontal; D is a pentagon
(wrong thread); E points up but is black, and the teardrops are never black.

## 2 · `interwoven@1002`

*What I see.* Seven panels. Odd panels are grey arrows pointing right, down, left,
up. Even panels are grey pentagons that grow: small, medium, large.

*Rule inferred.* The arrows turn a quarter-turn clockwise each appearance; the
pentagons grow a step each appearance. The last panel shown is an arrow, so the
missing panel belongs to the pentagon thread.

*Answer produced.* One step bigger again, still grey → **D**. A is the same size as
the last pentagon (no growth); C is back to the smallest; B is an arrow (wrong
thread); E is the right size but black.

## 3 · `interwoven@1027`

*What I see.* Six panels. Odd panels are black hearts: upright, then lobes to the
right, then upside-down. Even panels are white-outline circles that grow.

*Rule inferred.* The hearts turn a quarter-turn clockwise each appearance; the
circles grow. The last panel shown is a circle, so the missing panel is the next
heart.

*Answer produced.* One more quarter-turn → **lobes to the left, point to the
right, black** → **C**. A is the previous heart upside-down; B has the right
orientation but is white-outlined, and the hearts are always black; D is the heart
turned back the way it came; E continues the circles (wrong thread).

## 4 · `interwoven@1000`

*What I see.* Seven panels. Odd panels are grey semicircles with the flat edge on
the top, then left, then bottom, then right. Even panels are white-outline circles
that grow.

*Rule inferred.* The semicircles turn a quarter-turn anticlockwise each
appearance; the circles grow. The last panel shown is a semicircle, so the missing
panel continues the circles.

*Answer produced.* Bigger again, white outline → **B**. A is the same size as the
previous circle; C is the right size but filled black; D is the next semicircle
(wrong thread); E is back to the smallest.

## 5 · `interwoven@1003`

*What I see.* Seven panels. Odd panels are black teardrops pointing up, right,
down, left. Even panels are white-outline diamonds that grow.

*Rule inferred.* The teardrops turn a quarter-turn clockwise each appearance; the
diamonds grow. The last panel shown is a teardrop, so the missing panel is the
next diamond.

*Answer produced.* Bigger again, white outline → **D**. A repeats the previous
diamond's size; B is back to the smallest; C is the next teardrop (wrong thread);
E is the right size but grey-filled.

## Defect found and fixed by this cold-read

The first pass sampled the turning thread's start angle from **all** multiples of
45°. The answer always sits 180° from the "turned it back the way it came"
distractor, so on a *diagonal* start that pair became one shape on one diagonal —
a grey raindrop at 45° next to a grey raindrop at 225°. Reading `interwoven@1005`
cold, I could not tell those two options apart even magnified: the rule was
inferable but the option set was not discriminable, which is the same class of
defect as an off-by-one count.

Start angles are now restricted to right angles (0/90/180/270), so the pair is
always up-vs-down or left-vs-right. The battery passed *both* before and after
this change — it cannot see the difference, which is precisely why the cold-read
step exists.

## Note for the reviewer

The size-growth variant asks the pupil to compare an option against the last panel
of the growing thread (is it the same size, or one step bigger?). Steps are equal
absolute increments (0.6 → 0.9 → 1.2 → 1.5 of base radius, ~10px of radius each),
which read clearly at the paper's render size, but it is a judgement of relative
size rather than a categorical difference — worth an eye on paper before trialling.
