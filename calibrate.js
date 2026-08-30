#!/usr/bin/env node
/* calibrate.js — usage: node calibrate.js <manifest.json> <responses.csv> [out.md]
   Reads a paper manifest and a wide response table, prints an item-by-item
   calibration report, and writes a markdown version. */
const fs = require('fs');
const CAL = require('./nvr-calibrate.js');

const [, , manifestPath, responsesPath, outPath = 'calibration-report.md'] = process.argv;
if (!manifestPath || !responsesPath) {
  console.error('usage: node calibrate.js <manifest.json> <responses.csv> [out.md]');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const rows = CAL.parseTable(fs.readFileSync(responsesPath, 'utf8'));
const aligned = CAL.alignResponses(rows, manifest);
const scored = CAL.score(aligned, manifest);
const stats = CAL.itemStats(scored, manifest);
const fit = CAL.refit(stats);

const totals = scored.map(s => s.total);
const pad = (s, n) => String(s).padEnd(n);
const lines = [];
lines.push(`# Calibration report`);
lines.push(`Pupils: ${scored.length} · Items: ${manifest.length} · Mean score: ${CAL.mean(totals).toFixed(1)}/${manifest.length} · SD: ${CAL.sd(totals).toFixed(2)}`);
lines.push('');
lines.push('| Q | type | band(prior) | facility | discrim | flagged | quality |');
lines.push('|---|------|-------------|----------|---------|---------|---------|');
stats.forEach(s => {
  const fl = s.flaggedDistractors.map(f => `${f.option}(${f.topRate})`).join(' ') || '—';
  lines.push(`| ${s.n} | ${s.type} | ${s.band} | ${s.facility ?? '–'} | ${s.discrimination ?? '–'} | ${fl} | ${s.quality} |`);
});
lines.push('');
if (fit) {
  lines.push(`## Refit of the difficulty prior`);
  lines.push(`facility ≈ ${fit.intercept} + ${fit.slope} × difficultyPrior   (r = ${fit.r}, r² = ${fit.r2}, n = ${fit.n})`);
  lines.push(`A clear negative slope means the structural prior tracks real difficulty; weak/positive means it does not, and the bands should be re-derived from facility directly.`);
  lines.push('');
}
const bad = stats.filter(s => /NEGATIVE|review|mis-keyed/.test(s.quality));
if (bad.length) {
  lines.push(`## Items to review first`);
  bad.forEach(s => lines.push(`- Q${s.n} (${s.id}): ${s.quality}. Distractors flagged: ${s.flaggedDistractors.map(f => f.option).join(', ') || 'none'}.`));
}

const report = lines.join('\n');
console.log(report);
fs.writeFileSync(outPath, report);
console.error(`\n[written to ${outPath}]`);
