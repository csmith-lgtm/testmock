/* Regression test for the standalone parent guide.
   Checks the copy is the markdown source unedited and nothing but the copy is
   on the page, that every method carries a three-panel strip built from hub
   renderers, that the contents and deep links work, and that the staged-reveal
   markers line the paired panels up.
   Run: node parent_guide.test.js   (needs jsdom) */
const fs=require('fs'), path=require('path');
const {JSDOM, VirtualConsole}=require('jsdom');
const root=__dirname;
const GUIDE=path.join(root,'Parent_Maths_Guide_v40_1.html');
const HUB=path.join(root,'Primary_Maths_Curriculum_Navigator_v40_1.html');
const SRC=path.join(root,'PARENT_GUIDE_complete.md');
const html=fs.readFileSync(GUIDE,'utf8'), hub=fs.readFileSync(HUB,'utf8'), md=fs.readFileSync(SRC,'utf8');

const errs=[]; const ok=m=>console.log('  PASS  '+m); const bad=m=>{errs.push(m);console.log('  FAIL  '+m)};
const section=t=>console.log('\n'+t);

const vc=new VirtualConsole();
vc.on('jsdomError',e=>bad('page script error: '+e.message));
vc.on('error',(...a)=>bad('console.error: '+a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const d=dom.window.document, w=dom.window;
const norm=s=>s.replace(/\s+/g,' ').trim();

/* ---------------------------------------------------------------- 1. copy -- */
section('1. The copy is the source, unedited');
// Prose only: renderer output, the contents rail, the panel labels and the
// year chip are page furniture, not copy.
const proseRoot=d.body.cloneNode(true);
proseRoot.querySelectorAll('.pg-visual,.pg-contents,.pg-chip,.pg-home,.pg-num,.pg-caret,script,style').forEach(x=>x.remove());
const unesc=t=>{const e=d.createElement('textarea');e.innerHTML=t;return e.value};
const strip=h=>h.replace(/<br\s*\/?>/gi,' ')
  .replace(/<\/(p|h1|h2|h3|li|td|th|tr|figcaption|div|ol|ul|table|thead|tbody|figure|hr|section|button|summary|nav|main|header)>/gi,' ')
  .replace(/<[^>]+>/g,'');
const pageText=norm(unesc(strip(proseRoot.innerHTML)));
const mdText=norm(md.split('\n').filter(l=>!/^\s*\|\s*-+/.test(l)).join('\n')
  .replace(/^\s*#{1,3}\s+/gm,'').replace(/^\s*---\s*$/gm,'')
  .replace(/\*\*/g,'').replace(/\*/g,'').replace(/\|/g,' ').replace(/^\s*\d+\.\s+/gm,''));
const A=mdText.split(' '), B=pageText.split(' ');
let cur=0, missing=[];
for(const word of A){
  let j=cur,f=-1;
  while(j<B.length){ if(B[j]===word){f=j;break} j++ }
  if(f<0) missing.push(word); else cur=f+1;
}
missing.length?bad('copy words missing or out of order: '+missing.slice(0,10).join(' | ')+' ('+missing.length+')')
              :ok('every word of the source appears, in order ('+A.length+' words)');

/* ------------------------------------------------- 2. nothing but the copy -- */
section('2. Nothing on the page that was not written for parents');
const entries=[...d.querySelectorAll('.pg-entry')];
if(entries.length===14) ok('14 method entries'); else bad(entries.length+' entries, expected 14');
const main=d.querySelector('.pg-main');
const last=main.lastElementChild;
if(last===entries[13]&&last.id==='at-home')
  ok('the last thing in the page is entry 14, "What actually helps at home"');
else bad('content follows the last method entry: '+(last&&(last.tagName+'#'+last.id)));
const tail=norm(unesc(strip(entries[13].innerHTML)));
if(/practice\.?$/.test(tail.replace(/Back to contents$/,'').trim()))
  ok('entry 14 ends on the copy, with only the back-to-contents link after it');
else bad('entry 14 tail: ...'+tail.slice(-90));
for(const [label,re] of [['Open questions',/open questions/i],['Bute House',/bute house/i],
                         ['editorial notes to the author',/\b(rebuke|flag if you want|change if you.d rather|worth confirming before this goes out)\b/i],
                         ['section-numbered anchors',/#section-\d/i]]){
  const hit=re.test(pageText)||re.test(html.replace(/<style[\s\S]*?<\/style>/g,''));
  hit?bad('page still contains '+label):ok('no '+label);
}
if(!/about the equipment/i.test(pageText)) ok('the standalone "About the equipment" section is gone');
else bad('"About the equipment" is still a section');
for(const frag of ['Base 10 blocks are proportional','not a beginner’s version','not a beginner\'s version']){
  // the equipment copy must survive somewhere, having moved
}
if(/Base 10 blocks/.test(pageText)&&/beginner's version of maths/.test(pageText))
  ok('the equipment copy survives, moved into entry 3 and the opening section');
else bad('equipment copy lost in the move');

/* ------------------------------------------------------- 3. every method -- */
section('3. Every method carries the same three-part strip');
const LABELS=['With objects','As a picture','Written down'];
let stripsOk=0;
for(const sec of entries){
  const n=Number(sec.dataset.entry);
  const fig=sec.querySelector('.pg-figure[data-fig]');
  if(n<=12){
    if(!fig){bad('entry '+n+' has no strip');continue}
    const panels=[...fig.querySelectorAll('.miniMethod')];
    const labels=panels.map(p=>norm(p.querySelector('.miniLabel').textContent));
    const drawn=panels.filter(p=>norm(p.querySelector('.pg-panelbody').innerHTML).length>40).length;
    if(panels.length===3&&labels.join('|')===LABELS.join('|')&&drawn===3) stripsOk++;
    else bad('entry '+n+' strip: '+panels.length+' panels, labels ['+labels.join(', ')+'], '+drawn+' drawn');
  } else if(fig) bad('entry '+n+' has a strip but is not a method 1-12');
}
if(stripsOk===12) ok('entries 1-12 each show three drawn panels labelled '+LABELS.join(' / '));
const dashed=d.querySelectorAll('.pg-figure-unillustrated').length;
dashed?bad(dashed+' placeholders still have no figure'):ok('no "awaiting art" placeholders left');
const caps=[...d.querySelectorAll('.pg-figure figcaption')].map(x=>norm(x.textContent));
const mdPlace=[...md.matchAll(/^\*(\[[^\]]*\])\*$/gm)].map(m=>norm(m[1]));
const missCap=mdPlace.filter(p=>!caps.includes(p));
missCap.length?bad('placeholders not kept as captions: '+missCap.join(' / '))
              :ok('all '+mdPlace.length+' bracketed placeholders kept verbatim as captions');

/* ------------------------------------------------------ 4. the four asks -- */
section('4. The four questions, and the year chip');
const SUBQ=['WHAT IT IS','WHY WE USE IT','HOW YOU MAY HAVE BEEN TAUGHT IT',"WHEN YOU'LL SEE IT"];
let qOk=0, chips=0;
for(const sec of entries){
  const n=Number(sec.dataset.entry);
  const qs=[...sec.querySelectorAll('.pg-q')].map(x=>norm(x.textContent).toUpperCase());
  if(n<=13){ if(SUBQ.every(q=>qs.includes(q))) qOk++; else bad('entry '+n+' headings: '+qs.join(' / ')); }
  if(sec.querySelector('.pg-chip')) chips++;
}
qOk===13?ok('entries 1-13 each show all four questions as headings'):null;
chips===13?ok('entries 1-13 each carry a year chip; entry 14 has no "when you\'ll see it" and no chip')
         :bad(chips+' chips, expected 13');
const longChips=[...d.querySelectorAll('.pg-chip')].filter(c=>norm(c.textContent).length>60);
longChips.length?bad(longChips.length+' chips are over 60 characters: '+longChips.map(c=>norm(c.textContent)).join(' / '))
                :ok('every chip is 60 characters or fewer, so it reads as orientation');
// the full "when you'll see it" paragraph is still there, unabridged
const whenParas=entries.slice(0,13).map(s=>{
  const h=[...s.querySelectorAll('.pg-q')].find(x=>/WHEN YOU/i.test(x.textContent));
  return h&&h.nextElementSibling?norm(h.nextElementSibling.textContent):'';
});
// entry 10's is the whole of "Year 6.", so length is not the test: it must be
// present and must not have been replaced by the chip.
const chipText=new Set([...d.querySelectorAll('.pg-chip')].map(c=>norm(c.textContent)));
const badWhen=whenParas.filter(t=>!t||chipText.has(t));
badWhen.length?bad(badWhen.length+' entries lost their full "when you\'ll see it" paragraph')
              :ok('the full "when you\'ll see it" paragraph is kept in every entry, chip as well as prose');

/* ----------------------------------------------------- 5. getting around -- */
section('5. Contents, anchors and deep links');
const links=[...d.querySelectorAll('.pg-toc-list a')];
links.length===14?ok('the contents lists all 14 methods'):bad(links.length+' contents links');
const badIds=links.map(a=>a.getAttribute('href').slice(1)).filter(id=>!d.getElementById(id));
badIds.length?bad('contents links to missing ids: '+badIds):ok('every contents link resolves');
const ids=entries.map(s=>s.id);
const ugly=ids.filter(id=>!/^[a-z][a-z-]*[a-z]$/.test(id));
ugly.length?bad('unreadable ids: '+ugly):ok('readable anchor ids: '+ids.join(', '));
if(new Set(ids).size===14) ok('ids are unique'); else bad('duplicate ids');
const backs=entries.filter(s=>s.querySelector('.pg-back a[href="#contents"]')).length;
backs===14?ok('every entry ends with a back-to-contents link'):bad(backs+' back links, expected 14');
// collapsed by default, and a hash opens the entry it names
const closed=entries.filter(s=>s.querySelector('.pg-entry-body').hidden).length;
closed===14?ok('all entries start collapsed'):bad(closed+' collapsed at load, expected 14');
{
  const dom2=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,
    url:'https://x.invalid/Parent_Maths_Guide_v40_1.html#division'});
  const s2=dom2.window.document.getElementById('division');
  (s2&&!s2.querySelector('.pg-entry-body').hidden)?ok('loading #division opens the division entry')
                                                  :bad('#division did not open its entry');
  dom2.window.close();
}
if(/href="Primary_Maths_Curriculum_Navigator_v40_1\.html"/.test(html)) ok('the guide links back to the hub'); else bad('no link back to the hub');
if(/<a class="navbtn navlink" href="Parent_Maths_Guide_v40_1\.html">Parent maths guide<\/a>/.test(hub))
  ok('the hub navigation links to the guide as "Parent maths guide"');
else bad('the hub does not link to the guide');

/* --------------------------------------------------- 6. renderers are the hub's */
section("6. Every visual is a hub renderer, unmodified");
const grab=(src,fn)=>{const i=src.indexOf(fn);if(i<0)return null;
  let depth=0,started=false,j=i;
  for(;j<src.length;j++){const c=src[j];
    if(c==='{'){depth++;started=true}else if(c==='}'){depth--;if(started&&depth===0){j++;break}}}
  return src.slice(i,j)};
for(const fn of ['function partWhole','function base10(','function tenframe(','function columnAdd(',
                 'function columnSub(','function pvc(','function area(','function gridMethod(',
                 'function expandedAddTable(','function expandedSubTable(','function bar(',
                 'function methodPair(','function miniNumberLine(','function numberLine(',
                 'function groups(','function array(','function objectiveVisual(',
                 'function shortMult(','function longMult(','function shortDiv(','function longDiv(']){
  const a=grab(hub,fn), b=grab(html,fn);
  (a&&b&&a===b)?ok('identical to the hub: '+fn.replace('function ','').replace('(',''))
              :bad('renderer differs or missing: '+fn);
}

/* ------------------------------------------------------ 7. staged reveal -- */
section('7. Staged reveal');
const pvcDoc=new JSDOM('<div>'+w.pvc({'Th':2,'H':4,'T':7,'O':6})+'</div>').window.document;
const pmap=[...pvcDoc.querySelectorAll('th[data-mstep]')].map(x=>x.textContent+'='+x.dataset.mstep+'/'+x.dataset.unit);
pmap.join(',')==='Th=4/thousands,H=3/hundreds,T=2/tens,O=1/ones'
  ?ok('pvc numbers its columns from the ones: '+pmap.join(' ')):bad('pvc markers: '+pmap.join(' '));
const nlDoc=new JSDOM('<div>'+w.numberLine([8,10,13],0,15)+'</div>').window.document;
const nmap=[...new Set([...nlDoc.querySelectorAll('[data-mstep]')].map(x=>x.dataset.mstep+':'+x.dataset.unit))];
nmap.join(',')==='1:starting point 8,2:hop to 10,3:hop to 13'
  ?ok('numberLine marks its hops: '+nmap.join(' | ')):bad('numberLine markers: '+nmap.join(' | '));

const fm=d.querySelector('.pg-figure[data-fig="strip-7"]');
const block=fm.querySelector('.methodblock');
const lit=()=>[...block.querySelectorAll('.method-active')].map(x=>norm(x.textContent));
w.resetWrittenMethod(block); w.revealWrittenMethodStep(block,1);
let L=lit();
(L.filter(t=>t==='12').length===2&&!L.includes('80'))
  ?ok('multiplication step 1 reveals 12 in the area model and the written record: ['+L.join(', ')+']')
  :bad('multiplication step 1 lit: ['+L.join(', ')+']');
w.revealWrittenMethodStep(block,2); L=lit();
(L.filter(t=>t==='80').length===2&&!L.includes('12'))
  ?ok('multiplication step 2 reveals 80 in both: ['+L.join(', ')+']')
  :bad('multiplication step 2 lit: ['+L.join(', ')+']');

const sb=d.querySelector('.pg-figure[data-fig="strip-6"] .methodblock');
w.resetWrittenMethod(sb); w.revealWrittenMethodStep(sb,1);
const perPanel=[...sb.querySelectorAll('.miniMethod')].map(p=>p.querySelectorAll('.method-active').length);
(perPanel[0]>0&&perPanel[2]>0)
  ?ok('subtraction step 1 lights the ones in the counters and the written method ('+perPanel.join(' + ')+')')
  :bad('subtraction step 1 lit '+perPanel.join(' + '));
ok('subtraction status: "'+sb.querySelector('.method-status').textContent+'"');

// the new column renderers stage in the order the method is worked
const lmDoc=new JSDOM('<div>'+w.longMult(['3','2','4','7'],['2','6'],
  [{digits:['1','9','4','8','2'],why:'3,247 &times; 6'},{digits:['6','4','9','4','0'],why:'3,247 &times; 20'}],
  ['8','4','4','2','2'])+'</div>').window.document;
const lmSteps=[...new Set([...lmDoc.querySelectorAll('[data-mstep]')].map(x=>x.dataset.mstep+':'+x.dataset.unit))].sort();
lmSteps.join(' | ')==='1:3,247 × 6 row | 2:3,247 × 20 row | 3:total'
  ?ok('longMult stages one step per partial product, ones row first: '+lmSteps.join(' | '))
  :bad('longMult steps: '+lmSteps.join(' | '));
const ldDoc=new JSDOM('<div>'+w.longDiv('24',['4','3','6','8'],['','1','8','2'],[
  {op:'-',cells:['2','4','',''],rule:true},{cells:['1','9','6','']},
  {op:'-',cells:['1','9','2',''],rule:true},{cells:['','','4','8']},
  {op:'-',cells:['','','4','8'],rule:true},{cells:['','','','0']}])+'</div>').window.document;
const ldSteps=[...new Set([...ldDoc.querySelectorAll('[data-mstep]')].map(x=>Number(x.dataset.mstep)))].sort((a,b)=>a-b);
ldSteps.join(',')==='1,2,3'
  ?ok('longDiv stages left to right, one step per quotient digit: '+ldSteps.join(', '))
  :bad('longDiv steps: '+ldSteps.join(','));

/* ---------------------------------------------------------- 8. self-contained */
section('8. Self-contained');
// The hub's stylesheet is inlined into a <style> of our own. Leaving its own
// tags in swallows the :root block, and every var() on the page falls back to
// nothing - which is silent, so it is checked rather than eyeballed.
const styles=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
const rootBlock=styles.find(t=>/:root\{--bg:/.test(t));
(rootBlock&&!/<style>/.test(rootBlock))?ok('the hub :root custom properties are inlined intact')
  :bad('the :root block is missing or nested inside another <style>');
for(const v of ['--bg','--card','--ink','--muted','--line','--nav','--blue','--soft']){
  if(!rootBlock||!rootBlock.includes(v+':')) bad('custom property '+v+' not defined');
}
if(rootBlock&&['--bg','--card','--ink','--muted','--line','--nav','--blue','--soft'].every(v=>rootBlock.includes(v+':')))
  ok('every custom property the page styles use is defined');
const ext=[...html.matchAll(/(?:src|href)\s*=\s*["'](https?:|\/\/)/g)].length;
ext?bad(ext+' external references'):ok('no external requests');
/@font-face\{font-family:'Lexend Deca'[\s\S]*?url\(data:font\/woff2;base64,/.test(html)
  ?ok('Lexend Deca embedded'):bad('font not embedded');

console.log(errs.length?('\n'+errs.length+' FAILED'):'\nAll guide checks passed.');
process.exit(errs.length?1:0);
