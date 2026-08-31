/* Render interwoven examples to a standalone HTML sheet for the cold-read.
   House style: viewBox 0 0 120 120, ink #1f2933, NO external fonts. */
const fs = require('fs');
const NVR = require('./nvr-engine.js');
const mods = { NVR3D: require('./nvr-3d.js')(NVR), NVRCompose: require('./nvr-compose.js')(NVR),
  NVRHard: require('./nvr-hard.js')(NVR), NVRCamo: require('./nvr-camo.js')(NVR) };
mods.NVRElite = require('./nvr-elite.js')(NVR, mods.NVRCamo);
const A = require('./nvr-assemble.js')(NVR, mods);

const seeds = process.argv.slice(2).map(Number);
const showKey = process.env.SHOW_KEY === '1';
const svg = f => NVR.renderFigure(f, { size: 96 });

const blocks = seeds.map((s, n) => {
  const it = A.makeItem('interwoven', s);
  const stem = it.stem.map(f => `<div class="p">${svg(f)}</div>`).join('');
  const opts = it.options.map((f, i) =>
    `<div class="o${showKey && i === it.answerIndex ? ' ans' : ''}">
       <div class="p">${svg(f)}</div><div class="lbl">${'ABCDE'[i]}</div></div>`).join('');
  return `<section>
    <h2>Example ${n + 1} <span class="id">${it.id}</span></h2>
    <p class="q">Which figure comes next in the sequence?</p>
    <div class="row">${stem}<div class="qm">?</div></div>
    <div class="row opts">${opts}</div>
    ${showKey ? `<p class="key"><b>Answer: ${it.answerLetter}</b> — ${it.rationale}</p>` : ''}
  </section>`;
}).join('');

fs.writeFileSync(process.env.OUT || 'interwoven-examples.html', `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"><title>interwoven — examples</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
       color:#1f2933;background:#fff;margin:0;padding:28px 32px}
  h1{font-size:20px;margin:0 0 18px}
  section{border-top:1px solid #cbd2d9;padding:18px 0}
  h2{font-size:15px;margin:0 0 2px}
  .id{font-weight:400;color:#7b8794;font-size:12px;margin-left:8px}
  .q{font-size:13px;color:#52606d;margin:0 0 10px}
  .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .opts{margin-top:14px;gap:16px}
  .p{border:1px solid #cbd2d9;border-radius:6px;padding:2px;background:#fff;line-height:0}
  .qm{font-size:30px;color:#9aa5b1;padding:0 10px}
  .o{text-align:center}
  .o .lbl{font-size:12px;color:#52606d;margin-top:4px}
  .o.ans .p{border:2.5px solid #1f7a4d}
  .key{font-size:12px;color:#1f7a4d;margin:12px 0 0;max-width:760px;line-height:1.5}
</style></head><body>
<h1>interwoven — rendered examples</h1>${blocks}</body></html>`);
console.log('wrote', process.env.OUT || 'interwoven-examples.html');
