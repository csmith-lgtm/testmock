const NVR=require('./nvr-engine.js');
const NVR3D=require('./nvr-3d.js')(NVR);
const NVRCompose=require('./nvr-compose.js')(NVR);
const NVRHard=require('./nvr-hard.js')(NVR);
const NVRCamo=require('./nvr-camo.js')(NVR);
const NVRElite=require('./nvr-elite.js')(NVR,NVRCamo);
const A=require('./nvr-assemble.js')(NVR,{NVR3D,NVRCompose,NVRHard,NVRCamo,NVRElite});
const fs=require('fs');

// SAME spec/seed as the confirmed pupil paper, so interactive == PDF == manifest
const spec=[
  {builder:'series',count:1},{builder:'cohesiveSeries',count:1},{builder:'analogy',count:1},
  {builder:'oddOneOutClear',count:1},{builder:'cubeNet',count:1},{builder:'matrix',count:1},
  {builder:'compositeAnalogy',count:1},{builder:'chirality',count:1},{builder:'tripleMatrix',count:1},{builder:'embedded',count:1},
];
const paper=A.assemblePaper(spec,{title:'Non-Verbal Reasoning — Practice Paper', startSeed:7100});

// interactive (endpoint left blank -> she pastes her Apps Script URL; CSV fallback works immediately)
fs.writeFileSync('interactive-paper.html', A.renderInteractivePaper(paper,{title:'Non-Verbal Reasoning — Practice Paper', endpoint:''}));
fs.writeFileSync('answer-key.html', A.renderAnswerKey(paper));
fs.writeFileSync('sample-paper-manifest.json', JSON.stringify(paper.manifest,null,2));

console.log('paperId:', ('paper-'+paper.items.map(i=>i.seed).join('-')).slice(0,60));
console.log('interactive + answer-key written; manifest', paper.manifest.length, 'questions');
console.log('answers:', paper.manifest.map(m=>m.n+m.answer).join(' '));
