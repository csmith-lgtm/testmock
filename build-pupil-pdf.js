const NVR=require('./nvr-engine.js');
const NVR3D=require('./nvr-3d.js')(NVR);
const NVRCompose=require('./nvr-compose.js')(NVR);
const NVRHard=require('./nvr-hard.js')(NVR);
const NVRCamo=require('./nvr-camo.js')(NVR);
const NVRElite=require('./nvr-elite.js')(NVR,NVRCamo);
const A=require('./nvr-assemble.js')(NVR,{NVR3D,NVRCompose,NVRHard,NVRCamo,NVRElite});
const fs=require('fs');
// PUPIL-SAFE spec: only mechanisms a child can fairly infer from a static item,
// all 5-option, replacing the flagged Q2/Q7/Q8/Q9/Q11/Q12.
const paper=A.assemblePaper([
  {builder:'series',count:1},              // warm-up: what comes next
  {builder:'cohesiveSeries',count:1},      // growth series
  {builder:'analogy',count:1},             // simple analogy
  {builder:'oddOneOutClear',count:1},      // obvious odd-one-out (inner = container), 5 opts
  {builder:'cubeNet',count:1},             // spatial / fold
  {builder:'matrix',count:1},              // clear pattern-completion (replaces interaction, which reads as malformed in print)
  {builder:'compositeAnalogy',count:1},    // 3-change analogy
  {builder:'chirality',count:1},           // clean rotation series
  {builder:'tripleMatrix',count:1},        // three-rule matrix
  {builder:'embedded',count:1},            // hidden shape, 5 opts, single-target verified
],{title:'Non-Verbal Reasoning — Practice Paper', startSeed:7100});

// audit BEFORE writing
const NAME={triangle:3,square:4,pentagon:5,hexagon:6,octagon:8};
let problems=[];
paper.items.forEach((it,i)=>{
  const n=i+1;
  const optN = it.options.length;
  if(optN!==5) problems.push(`Q${n} (${it.type}) has ${optN} options, not 5`);
});
console.log("items:",paper.items.length,"| option-count problems:", problems.length?problems.join('; '):'NONE');
console.log("types:",paper.manifest.map(m=>m.type).join(', '));

fs.writeFileSync('pupil-paper.html', A.renderPupilPaper(paper,{title:'Non-Verbal Reasoning — Practice Paper'}));
fs.writeFileSync('sample-paper.html', A.renderPaper(paper));         // matching teacher version
fs.writeFileSync('sample-paper-manifest.json', JSON.stringify(paper.manifest,null,2));
console.log("written pupil-paper.html + teacher sample + manifest");
