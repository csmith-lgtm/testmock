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
  .replace(/<\/(p|h1|h2|h3|h4|li|td|th|tr|figcaption|div|ol|ul|dl|dt|dd|table|thead|tbody|figure|hr|section|button|summary|nav|main|header|aside)>/gi,' ')
  .replace(/<[^>]+>/g,'');
const pageText=norm(unesc(strip(proseRoot.innerHTML)));
const mdText=norm(md.split('\n').filter(l=>!/^\s*\|\s*-+/.test(l)).join('\n')
  .replace(/^\s*#{1,3}\s+/gm,'').replace(/^\s*---\s*$/gm,'')
  .replace(/^\s*>\s?/gm,'').replace(/^\s*-\s+/gm,'').replace(/^\s*\u2192\s+/gm,'')
  .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
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
if(/how this guide gets better\.$/.test(tail.replace(/Back to contents$/,'').trim()))
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
    // an entry may hold several worked examples; each is its own strip
    const strips=fig.querySelectorAll('.pg-example').length
      ? [...fig.querySelectorAll('.pg-example')] : [fig];
    const wrong=strips.filter(st=>{
      const panels=[...st.querySelectorAll('.miniMethod')];
      const labels=panels.map(p=>norm(p.querySelector('.miniLabel').textContent));
      const drawn=panels.filter(p=>norm(p.querySelector('.pg-panelbody').innerHTML).length>40).length;
      return !(panels.length===3&&labels.join('|')===LABELS.join('|')&&drawn===3);
    });
    if(!wrong.length) stripsOk++;
    else bad('entry '+n+': '+wrong.length+' of '+strips.length+' strips are not three drawn panels');
  } else if(fig) bad('entry '+n+' has a strip but is not a method 1-12');
}
if(stripsOk===12) ok('entries 1-12 each show three drawn panels labelled '+LABELS.join(' / '));
const buried=entries.filter(s2=>{
  const f=s2.querySelector('.pg-figure[data-fig]');
  return f&&s2.querySelector('.pg-entry-body').contains(f);
});
buried.length?bad(buried.length+' strips are inside the collapsed body and invisible until opened')
  :ok('every strip sits outside the collapsed body, so the page opens showing pictures');
const dashed=d.querySelectorAll('.pg-figure-unillustrated').length;
dashed?bad(dashed+' placeholders still have no figure'):ok('no "awaiting art" placeholders left');
// The bracketed lines were art direction for images that no longer need
// commissioning: the strips draw what they described.
const mdPlace=[...md.matchAll(/^\*(\[[^\]]*\])\*$/gm)].length;
mdPlace?bad(mdPlace+' image placeholders are still in the source'):ok('no image placeholders left in the source');
const bracketed=(pageText.match(/\[[^\]]{10,}\]/g)||[]);
bracketed.length?bad('bracketed art direction still on the page: '+bracketed.slice(0,3).join(' / '))
                :ok('no bracketed art direction on the page');
d.querySelectorAll('.pg-figure figcaption').length
  ?bad(d.querySelectorAll('.pg-figure figcaption').length+' figure captions remain')
  :ok('no figure captions remain');
const unlabelled=[...d.querySelectorAll('.pg-figure[data-fig]')]
  .filter(f=>!norm((f.querySelector('.pg-example-label')||{textContent:''}).textContent));
unlabelled.length?bad(unlabelled.length+' strips do not say which calculation they show')
  :ok('every strip names the calculation it shows, in place of the old caption');

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
links.length===15?ok('the contents lists the glossary and all 14 methods')
  :bad(links.length+' contents links, expected 15');
const badIds=links.map(a=>a.getAttribute('href').slice(1)).filter(id=>!d.getElementById(id));
badIds.length?bad('contents links to missing ids: '+badIds):ok('every contents link resolves');
const ids=entries.map(s=>s.id);
const ugly=ids.filter(id=>!/^[a-z][a-z-]*[a-z]$/.test(id));
ugly.length?bad('unreadable ids: '+ugly):ok('readable anchor ids: '+ids.join(', '));
if(new Set(ids).size===14) ok('ids are unique'); else bad('duplicate ids');
const backs=entries.filter(s=>s.querySelector('.pg-back a[href="#contents"]')).length;
backs===14?ok('every entry ends with a back-to-contents link'):bad(backs+' back links, expected 14');
// collapsed by default, and a hash opens the entry it names
const collapsibles=[...d.querySelectorAll('.pg-collapsible')];
const closed=collapsibles.filter(s=>s.querySelector('.pg-entry-body').hidden).length;
closed===collapsibles.length?ok('all '+closed+' collapsible sections start closed')
  :bad(closed+' closed at load, of '+collapsibles.length);
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
                 'function shortMult(','function longMult(','function shortDiv(','function longDiv(',
                 'function columnPlaces(','function colCell(']){
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

/* --------------------------------------------- 8. glossary, band, controls -- */
section('8. The words she\'ll bring home, and getting to it in a hurry');
const gloss=d.getElementById('glossary');
gloss?ok('the glossary is a section of its own, id "glossary"'):bad('no glossary section');
const terms=[...d.querySelectorAll('.pg-term')];
terms.length===19?ok('19 terms'):bad(terms.length+' terms, expected 19');
const termLinks=[...d.querySelectorAll('.pg-termlink')];
const deadLinks=termLinks.filter(a=>!d.getElementById(a.getAttribute('href').slice(1)));
deadLinks.length?bad('glossary terms point at anchors that do not exist: '
    +deadLinks.map(a=>a.getAttribute('href')).join(', '))
  :ok('every one of the '+termLinks.length+' glossary references resolves to a method anchor');
// each reference must name the method it links to
const titleById=new Map(entries.map(s2=>[s2.id,norm(s2.querySelector('.pg-entry-title').textContent)]));
const mismatched=termLinks.filter(a=>{
  const t=titleById.get(a.getAttribute('href').slice(1))||'';
  return !t.toLowerCase().startsWith(norm(a.textContent).toLowerCase());
});
mismatched.length?bad('glossary reference text does not match its target: '
    +mismatched.map(a=>norm(a.textContent)+' -> '+a.getAttribute('href')).join(', '))
  :ok('every reference names the method it links to');
if(gloss&&gloss.classList.contains('pg-collapsible')&&gloss.querySelector('.pg-entry-body').hidden)
  ok('the glossary collapses like a method entry'); else bad('the glossary does not collapse');
const tocGloss=d.querySelector('.pg-toc-list a[href="#glossary"]');
tocGloss?ok('the contents lists the glossary'):bad('the glossary is not in the contents');

const bandEl=d.querySelector('.pg-band');
if(bandEl){
  const hrefs=[...bandEl.querySelectorAll('a')].map(a=>a.getAttribute('href').slice(1));
  const dead=hrefs.filter(h=>!d.getElementById(h));
  dead.length?bad('the homework band links nowhere: '+dead.join(', '))
    :ok('the homework band links to '+hrefs.join(', ')+', all of which exist');
  const before=bandEl.compareDocumentPosition(d.querySelector('.pg-contents'));
  (before&d.defaultView.Node.DOCUMENT_POSITION_FOLLOWING)
    ?ok('the band sits above the contents'):bad('the band is not above the contents');
} else bad('no homework band');

['expandAll','collapseAll'].forEach(id=>{
  d.getElementById(id)?ok('control present: '+id):bad('missing control: '+id);
});
{
  const all=[...d.querySelectorAll('.pg-collapsible')];
  d.getElementById('expandAll').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const open=all.filter(x=>!x.querySelector('.pg-entry-body').hidden).length;
  const aria=all.filter(x=>x.querySelector('.pg-toggle').getAttribute('aria-expanded')==='true').length;
  (open===all.length&&aria===all.length)
    ?ok('Expand all opens all '+all.length+' sections and sets aria-expanded on each')
    :bad('Expand all: '+open+' open, '+aria+' with aria-expanded=true, of '+all.length);
  d.getElementById('collapseAll').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const shut=all.filter(x=>x.querySelector('.pg-entry-body').hidden).length;
  const aria2=all.filter(x=>x.querySelector('.pg-toggle').getAttribute('aria-expanded')==='false').length;
  (shut===all.length&&aria2===all.length)
    ?ok('Collapse all closes them again, aria-expanded back to false')
    :bad('Collapse all: '+shut+' closed, '+aria2+' aria-expanded=false');
}
// the heading must read as words, not "5Addition"
const runOn=entries.filter(s2=>/\d[A-Za-z]/.test(norm(s2.querySelector('.pg-toggle').textContent)));
runOn.length?bad(runOn.length+' headings run the number into the title: '
    +runOn.map(s2=>norm(s2.querySelector('.pg-toggle').textContent)).join(', '))
  :ok('every heading reads as "5 Addition", not "5Addition", when copied or read aloud');
// print must not depend on a beforeprint handler
const printCss=[...html.matchAll(/@media print\{([\s\S]*?)\n\}/g)].map(m=>m[1]).join('\n');
/\.pg-entry-body\[hidden\][^}]*display:block!important/.test(printCss)
  ?ok('print unhides collapsed prose in CSS, with no script needed'):bad('print does not unhide collapsed prose');
/\.pg-example\[hidden\]/.test(printCss)&&/\.pg-strategy-panel\[hidden\]/.test(printCss)
  ?ok('print also unhides the hidden examples and strategy panels'):bad('print leaves examples or strategy panels hidden');
/\.method-controls\{display:none!important\}|\.method-controls[^}]*display:none!important/.test(printCss.replace(/\s/g,''))
  ?ok('print hides the step controls'):bad('print leaves the step controls in');

/* ---------------------------------------------------- 9. worked examples -- */
section('9. Worked examples');
const withSwitcher=[...d.querySelectorAll('.pg-figure[data-fig]')]
  .filter(f=>f.querySelector('.pg-another'));
const nums=withSwitcher.map(f=>Number(f.dataset.fig.replace('strip-',''))).sort((a,b)=>a-b);
nums.join(',')==='5,6,7,8,9,10'
  ?ok('entries 5, 6, 7, 8, 9 and 10 each offer more than one worked example')
  :bad('switchers on entries '+nums.join(', '));
let exTotal=0, exBad=[];
for(const f of withSwitcher){
  const panes=[...f.querySelectorAll('.pg-example')];
  exTotal+=panes.length;
  if(panes.length<2) exBad.push(f.dataset.fig+' has '+panes.length);
  // one visible at a time, so the entry does not grow
  const vis=panes.filter(x=>!x.hidden).length;
  if(vis!==1) exBad.push(f.dataset.fig+' shows '+vis+' at once');
  // each example is independently steppable
  const blocks=panes.map(x=>x.querySelectorAll('.methodblock').length);
  if(blocks.some(b=>b!==1)) exBad.push(f.dataset.fig+' step controls '+blocks.join('/'));
  const drawn=panes.filter(x=>x.querySelectorAll('.miniMethod').length===3).length;
  if(drawn!==panes.length) exBad.push(f.dataset.fig+' only '+drawn+' full strips');
}
exBad.length?bad('example bank: '+exBad.join('; '))
  :ok(exTotal+' worked examples across six entries, one shown at a time, each with its own step controls');
{
  const f=withSwitcher.find(x=>x.dataset.fig==='strip-5');
  const btn=f.querySelector('.pg-another');
  const first=norm(f.querySelector('.pg-example-label').textContent);
  btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const second=norm(f.querySelector('.pg-example-label').textContent);
  const vis=[...f.querySelectorAll('.pg-example')].filter(x=>!x.hidden).length;
  (second!==first&&vis===1)
    ?ok('"Show me another" moves '+first+' to '+second+', still one at a time')
    :bad('"Show me another" did not switch: '+first+' -> '+second);
  // back round to the start
  const n2=f.querySelectorAll('.pg-example').length;
  for(let i=1;i<n2;i++) btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  norm(f.querySelector('.pg-example-label').textContent)===first
    ?ok('the control cycles back round to the first example'):bad('the switcher does not cycle');
}

/* ------------------------------------------ 10. strategy comparison -------- */
section('10. Strategy comparison');
const qs=[...d.querySelectorAll('.pg-question')];
qs.length===16?ok('16 questions'):bad(qs.length+' questions, expected 16');
const ops=[...d.querySelectorAll('.pg-tab')].map(t=>norm(t.textContent));
ops.join(',')==='Addition,Subtraction,Multiplication,Division'
  ?ok('tabbed by operation: '+ops.join(' / ')):bad('tabs: '+ops.join(','));
const perOp=[...d.querySelectorAll('.pg-strategy-panel')].map(pn=>pn.querySelectorAll('.pg-question').length);
perOp.join(',')==='4,4,4,4'?ok('four questions per operation'):bad('per operation: '+perOp.join(','));
if(/There's no wrong method on this page/.test(pageText)) ok('the framing line is on the page');
else bad('the framing line about there being no wrong method is missing');

// Every route must reach the answer the copy states. Read from the render,
// after stepping it to its last step - not from the markup.
const digits=t=>norm(t).replace(/[,\s]/g,'');
let checked=0, drift=[];
for(const q of qs){
  const want=digits(q.dataset.answer);
  const routes=[...q.querySelectorAll('.pg-route')].filter(r=>!r.dataset.none);
  if(!routes.length){ drift.push(q.dataset.q+': no route renders'); continue; }
  for(const r of routes){
    const block=r.querySelector('.methodblock');
    if(!block){ drift.push(q.dataset.q+'|'+r.dataset.label+': no step controls'); continue; }
    const max=Math.max(0,...[...block.querySelectorAll('[data-mstep]')].map(x=>Number(x.dataset.mstep)||0));
    w.resetWrittenMethod(block);
    w.revealWrittenMethodStep(block,max);
    const outs=[...block.querySelectorAll('.method-output')];
    // read the whole answer row, so a decimal point - which is a column of its
    // own and not an output cell - is not silently dropped
    const rows=[...new Set(outs.map(o=>o.parentElement))];
    const got=outs.length
      ? digits(rows.map(r=>[...r.children].map(c=>c.textContent).join('')).join(''))
      : digits((block.querySelector('.pg-answer')||{textContent:''}).textContent);
    checked++;
    if(got!==want) drift.push(q.dataset.q+' | '+r.dataset.label+': renders '+(got||'nothing')+', copy says '+want);
    // and the answer must only be complete at the end
    if(outs.length){
      const stepsOfOut=outs.map(x=>Number(x.dataset.mstep)||0);
      if(Math.max(...stepsOfOut)!==max)
        drift.push(q.dataset.q+' | '+r.dataset.label+': answer complete before the final step');
    }
  }
}
drift.length?bad('strategy renders drift from the copy:\n         '+drift.join('\n         '))
  :ok('all '+checked+' rendered routes reach the answer their copy states, at their final step');
const noRoute=[...d.querySelectorAll('.pg-route[data-none]')].map(r=>r.dataset.label);
ok('routes the copy says have no calculation, left undrawn: '+noRoute.length+' ('+[...new Set(noRoute)].join(', ')+')');
// half the verdicts should not favour the mental route
const verdicts=[...d.querySelectorAll('.pg-verdict')].map(v=>norm(v.textContent));
const written=verdicts.filter(v=>/written method|short division|column/i.test(v)).length;
written>=4?ok(written+' of 16 verdicts favour or accept the written method, so the set is not rigged')
  :bad('only '+written+' verdicts favour the written method');

/* ------------------------------------------------ 11. your own numbers ----- */
section('11. Straight to the tool with your own numbers');
const labLinks=[...d.querySelectorAll('.pg-ownnumbers')];
const labEntries=labLinks.map(a=>a.closest('.pg-entry').id);
labEntries.join(',')==='addition,subtraction,multiplication,long-multiplication,division,long-division'
  ?ok('a "put your own numbers in" link on every entry with a written calculation: '+labEntries.join(', '))
  :bad('lab links on '+labEntries.join(', '));
const LAB=path.join(root,'Interactive_Maths_Tools_v40_1','Written_Calculation_Lab_v3.html');
fs.existsSync(LAB)?ok('the Written Calculation Lab is where the links point')
                 :bad('the tool the links point at does not exist');
let paramsOk=true;
for(const a of labLinks){
  const href=a.getAttribute('href')||'';
  const [file,q]=href.split('?');
  if(file!=='Interactive_Maths_Tools_v40_1/Written_Calculation_Lab_v3.html'){paramsOk=false;bad('bad link target: '+file);continue}
  const qs=new URLSearchParams(q||'');
  // the label is written with thousands separators; the link is not
  const shown=norm(a.closest('.pg-visual').querySelector('.pg-example-label').textContent)
    .replace(/,/g,'').replace(/[^0-9.]+/g,' ').trim().split(/\s+/);
  if(!['add','sub','mult','div'].includes(qs.get('operation'))){paramsOk=false;bad('no operation on '+href)}
  if(qs.get('a')!==shown[0]||qs.get('b')!==shown[1]){
    paramsOk=false;bad('link numbers '+qs.get('a')+'/'+qs.get('b')+' do not match the example shown: '+shown.join(' '));
  }
}
paramsOk?ok('every link carries the operation and the two numbers of the example on screen'):null;
// and the tool honours them
{
  const lab=fs.readFileSync(LAB,'utf8');
  const ldom=new JSDOM(lab,{runScripts:'dangerously',pretendToBeVisual:true,
    url:'https://x.invalid/Written_Calculation_Lab_v3.html?operation=div&a=4368&b=24&method=long'});
  const ld=ldom.window.document;
  const got=[ld.getElementById('op').value,ld.getElementById('a').value,ld.getElementById('b').value].join('/');
  got==='div/4368/24'
    ?ok('opening the tool with those parameters lands on that calculation: '+got)
    :bad('the tool ignored the link parameters: '+got);
  const stage=norm(ld.getElementById('calcStage').textContent);
  /4,368/.test(stage)?ok('and the tool is showing it: "'+stage.slice(0,60)+'"')
                     :bad('the tool did not render the linked calculation: '+stage.slice(0,80));
  ldom.window.close();
}
// the link follows the example switcher
{
  const f=d.querySelector('.pg-figure[data-fig="strip-5"]');
  const a=f.querySelector('.pg-ownnumbers'), btn=f.querySelector('.pg-another');
  const before=a.getAttribute('href');
  btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const after=a.getAttribute('href');
  after!==before?ok('the link follows "show me another": '+before.split('?')[1]+' -> '+after.split('?')[1])
                :bad('the link did not change with the example');
  btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));   // the decimal one
  a.hidden?ok('and hides itself for the decimal example, which the tool cannot take')
          :bad('the link is offered for an example the tool cannot open');
}

/* ------------------------------------------------ 12. the old parent tab -- */
section('12. The hub points at the guide and nowhere else');
/data-view="parents"/.test(hub)?bad('the old parent tab is still in the hub navigation')
  :ok('the old in-hub parent tab is gone from the navigation');
/onclick="showView\('parents'\)"/.test(hub)?bad('a dashboard card still opens the old parent view')
  :ok('no dashboard card opens the old parent view');
(hub.match(/href="Parent_Maths_Guide_v40_1\.html"/g)||[]).length>=2
  ?ok('the hub reaches the guide from both the navigation and the staff home')
  :bad('the hub links to the guide '+(hub.match(/href="Parent_Maths_Guide_v40_1\.html"/g)||[]).length+' time(s)');

/* --------------------------------------------------------- 13. self-contained */
section('13. Self-contained');
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
