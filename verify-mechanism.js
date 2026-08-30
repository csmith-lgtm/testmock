/* =============================================================================
   verify-mechanism.js — the verification battery every new builder must pass.
   -----------------------------------------------------------------------------
   Usage:   node verify-mechanism.js <builderName> [seeds]
   e.g.     node verify-mechanism.js tripleMatrix 800
            node verify-mechanism.js interwoven 500

   Runs, over many seeds, the checks that catch the MECHANICAL faults we hit
   repeatedly. Passing this is NECESSARY BUT NOT SUFFICIENT — it does not judge
   whether a pupil can fairly infer the rule. That is the human cold-read step
   (see BRIEF-for-code.md). A builder is only "done" when this reports 0 failures
   AND a cold read of rendered examples uniquely yields the intended answer.
   ========================================================================== */
const NVR = require('./nvr-engine.js');
const NVR3D = require('./nvr-3d.js')(NVR);
const NVRCompose = require('./nvr-compose.js')(NVR);
const NVRHard = require('./nvr-hard.js')(NVR);
const NVRCamo = require('./nvr-camo.js')(NVR);
const NVRElite = require('./nvr-elite.js')(NVR, NVRCamo);
const A = require('./nvr-assemble.js')(NVR, { NVR3D, NVRCompose, NVRHard, NVRCamo, NVRElite });
const fk = NVR.figLookKey;

const builder = process.argv[2];
const SEEDS = parseInt(process.argv[3] || '600', 10);
if (!builder || !A.PRESETS[builder]) {
  console.error('unknown builder. Available:\n  ' + Object.keys(A.PRESETS).join(', '));
  process.exit(1);
}

// visual key for ANY option type (figures, code strings, cube-face objects)
function optKey(o) {
  if (typeof o === 'string') return 'code:' + o;
  if (o && o.items) return fk(o);
  if (o && (o.F || o.U || o.R)) return ['F', 'U', 'R'].map(l => o[l] ? o[l].shape + '@' + (o[l].rot || 0) : '').join('|');
  return JSON.stringify(o);
}

let built = 0, nul = 0;
const fail = { optionCount: 0, duplicateOptions: 0, answerCollision: 0, badAnswerIndex: 0, degenerateStem: 0, notReproducible: 0 };
const examples = [];

for (let s = 1000; s < 1000 + SEEDS; s++) {
  const it = A.makeItem(builder, s);
  if (!it) { nul++; continue; }
  built++;

  // 1. exactly 5 options
  if (!Array.isArray(it.options) || it.options.length !== 5) fail.optionCount++;

  // 2. all options visually distinct
  const keys = it.options.map(optKey);
  if (new Set(keys).size !== keys.length) { fail.duplicateOptions++; if (examples.length < 5) examples.push(it.id + ' duplicate options'); }

  // 3. valid answer index, and no distractor equal to the answer
  if (it.answerIndex == null || it.answerIndex < 0 || it.answerIndex >= it.options.length) fail.badAnswerIndex++;
  else {
    const ak = keys[it.answerIndex];
    if (keys.filter((k, i) => i !== it.answerIndex && k === ak).length > 0) fail.answerCollision++;
  }

  // 4. no degenerate stem (every step / relationship must be VISIBLE)
  if (it.type === 'series' && Array.isArray(it.stem)) {
    const sk = it.stem.map(fk);
    if (new Set(sk).size !== sk.length) fail.degenerateStem++;
  } else if (it.type === 'analogy' && Array.isArray(it.stem) && it.stem.length >= 3) {
    if (fk(it.stem[0]) === fk(it.stem[1])) fail.degenerateStem++;                     // A->B invisible
    if (it.answerIndex != null && fk(it.stem[2]) === optKey(it.options[it.answerIndex])) fail.degenerateStem++; // C->answer invisible
  } else if ((it.type === 'matrix' || it.type === 'xorMatrix') && it.grid) {
    if (fk(it.grid[0][0]) === fk(it.grid[0][1]) || fk(it.grid[0][0]) === fk(it.grid[1][0])) fail.degenerateStem++;
  }

  // 5. reproducible from its id
  const re = A.regenerate(it.id);
  if (!re || JSON.stringify(re.options.map(optKey)) !== JSON.stringify(keys) || re.answerIndex !== it.answerIndex) fail.notReproducible++;
}

const total = Object.values(fail).reduce((a, b) => a + b, 0);
console.log(`\nbuilder: ${builder}   built ${built}/${SEEDS}   (returned null: ${nul})`);
console.log('-------------------------------------------------------------');
Object.entries(fail).forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v === 0 ? 'OK' : '*** ' + v + ' FAILURES'}`));
console.log('-------------------------------------------------------------');
console.log(total === 0
  ? 'MECHANICAL CHECKS PASSED.  Now do the human cold-read before calling it done.'
  : '*** MECHANICAL FAILURES — fix before cold-read.');
if (examples.length) console.log('examples:', examples.join(' | '));
if (nul > SEEDS * 0.3) console.log(`note: high null rate (${nul}/${SEEDS}) — the builder rejects many seeds; make sure that's intended, not a constraint that's too tight.`);
process.exit(total === 0 ? 0 : 1);
