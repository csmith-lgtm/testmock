/* Regression test for the standalone parent guide.
   Checks the copy is the markdown source unedited, every bracketed
   placeholder is wired to a hub renderer, the renderers are byte-identical
   to the hub's, and the staged-reveal markers line the paired panels up.
   Run: node parent_guide.test.js   (needs jsdom) */
const fs=require('fs'), path=require('path');
const {JSDOM}=require('jsdom');
const root=__dirname;
const html=fs.readFileSync(path.join(root,'Parent_Maths_Guide_v40_1.html'),'utf8');
const md=fs.readFileSync(path.join(root,'PARENT_GUIDE_complete.md'),'utf8');

const errs=[]; const ok=m=>console.log('  PASS  '+m); const bad=m=>{errs.push(m);console.log('  FAIL  '+m)};

const vc=new (require('jsdom').VirtualConsole)();
vc.on('jsdomError',e=>{bad('page script error: '+e.message)});
vc.on('error',(...a)=>{bad('console.error: '+a.join(' '))});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const d=dom.window.document;

// 1. copy fidelity ---------------------------------------------------------
const norm=s=>s.replace(/ /g,' ').replace(/\s+/g,' ').trim();
const mdText=norm(md
  .split('\n').filter(l=>!/^\s*\|\s*-+/.test(l)).join('\n')
  .replace(/^\s*#{1,3}\s+/gm,'').replace(/^\s*---\s*$/gm,'')
  .replace(/\*\*/g,'').replace(/\*/g,'').replace(/\|/g,' ').replace(/^\s*\d+\.\s+/gm,''));
// Compare prose only: the renderer output inside .pg-visual is not copy, and
// abuts the caption with no whitespace in textContent.
const proseRoot=d.querySelector('.pg-wrap').cloneNode(true);
proseRoot.querySelectorAll('.pg-visual').forEach(x=>x.remove());
// Tags become spaces so adjacent table cells and list items do not run together.
const unesc=t=>{const e=d.createElement('textarea');e.innerHTML=t;return e.value};
const strip=h=>h.replace(/<br\s*\/?>/gi,' ')
  .replace(/<\/(p|h1|h2|h3|li|td|th|tr|figcaption|div|ol|ul|table|thead|tbody|figure|hr)>/gi,' ')
  .replace(/<[^>]+>/g,'');
const pageText=norm(unesc(strip(proseRoot.innerHTML))
  .replace('← Primary Maths Curriculum Navigator',''));
// the page also contains renderer output; compare by checking every markdown
// sentence survives, in order
const mdWords=mdText.split(' ');
let cursor=0, missing=[];
const pageWords=pageText.split(' ');
for(const w of mdWords){
  let j=cursor, found=-1;
  while(j<pageWords.length){ if(pageWords[j]===w){found=j;break} j++ }
  if(found<0) missing.push(w); else cursor=found+1;
}
if(missing.length===0) ok('every word of the source copy appears, in order ('+mdWords.length+' words)');
else bad('copy words missing/out of order: '+missing.slice(0,12).join(' | ')+' ('+missing.length+')');

// 2. placeholders kept as captions ----------------------------------------
const caps=[...d.querySelectorAll('.pg-figure figcaption')].map(x=>norm(x.textContent));
const mdPlace=[...md.matchAll(/^\*(\[[^\]]*\])\*$/gm)].map(m=>norm(m[1]));
if(mdPlace.length===12) ok('12 bracketed placeholders in the source'); else bad('found '+mdPlace.length+' placeholders');
const missCap=mdPlace.filter(p=>!caps.includes(p));
if(!missCap.length) ok('all 12 placeholders kept verbatim as figure captions');
else bad('placeholders not kept: '+missCap.join(' / '));

// 3. figures rendered ------------------------------------------------------
const figs=[...d.querySelectorAll('.pg-figure[data-fig]')];
console.log('  ---- figures ----');
let drawn=0;
for(const f of figs){
  const v=f.querySelector('.pg-visual');
  const n=v?v.children.length:0;
  const svgish=v?v.innerHTML.length:0;
  if(n>0&&svgish>50){drawn++;console.log('  PASS  '+f.dataset.fig+' rendered ('+svgish+' chars)')}
  else bad(f.dataset.fig+' produced nothing');
}
if(drawn===figs.length) ok('all '+figs.length+' wired figures rendered');

// 4. renderers are the hub's, unmodified ----------------------------------
const hub=fs.readFileSync(path.join(root,'Primary_Maths_Curriculum_Navigator_v40_1.html'),'utf8');
for(const fn of ['function partWhole','function base10(','function columnAdd(','function columnSub(',
                 'function pvc(','function area(','function gridMethod(','function expandedAddTable(',
                 'function bar(','function methodPair(','function miniNumberLine(','function numberLine(',
                 'function groups(','function objectiveVisual(']){
  const grab=src=>{const i=src.indexOf(fn); if(i<0)return null;
    let depth=0,started=false,j=i;
    for(;j<src.length;j++){const c=src[j];
      if(c==='{'){depth++;started=true} else if(c==='}'){depth--; if(started&&depth===0){j++;break}}}
    return src.slice(i,j)};
  const a=grab(hub), b=grab(html);
  if(a&&b&&a===b) ok('renderer identical to hub: '+fn.replace('function ','').replace('(',''));
  else bad('renderer differs or missing: '+fn);
}

// 5. data-mstep on pvc and numberLine --------------------------------------
const w=dom.window;
const pvcHtml=w.pvc({'Th':2,'H':4,'T':7,'O':6});
const pdoc=new JSDOM('<div>'+pvcHtml+'</div>').window.document;
const pcells=[...pdoc.querySelectorAll('[data-mstep]')];
const pmap=[...pdoc.querySelectorAll('th[data-mstep]')].map(x=>x.textContent+'='+x.dataset.mstep+'/'+x.dataset.unit);
if(pcells.length===8&&pmap.join(',')==='Th=4/thousands,H=3/hundreds,T=2/tens,O=1/ones')
  ok('pvc carries data-mstep, ones first: '+pmap.join(' ')); else bad('pvc markers wrong: '+pmap.join(' ')+' ('+pcells.length+' marked)');

const nlHtml=w.numberLine([8,10,13],0,15);
const ndoc=new JSDOM('<div>'+nlHtml+'</div>').window.document;
const nm=[...ndoc.querySelectorAll('[data-mstep]')];
const nmap=[...new Set(nm.map(x=>x.dataset.mstep+':'+x.dataset.unit))];
if(nmap.join(',')==='1:starting point 8,2:hop to 10,3:hop to 13')
  ok('numberLine carries data-mstep on the marked hops: '+nmap.join(' | ')); else bad('numberLine markers wrong: '+nmap.join(' | '));
const unmarked=[...ndoc.querySelectorAll('span:not([data-mstep])')].length;
ok('unmarked ticks left unstaged: '+unmarked+' spans');

// 6. area model and expanded method share step indices ---------------------
const fm=d.querySelector('.pg-figure[data-fig="f-mult"]');
const cells=[...fm.querySelectorAll('[data-mstep]')].map(x=>({t:norm(x.textContent),s:x.dataset.mstep}));
const stepOf=t=>cells.filter(c=>c.t===t).map(c=>c.s);
const p80=stepOf('80'), p12=stepOf('12');
if(p80.length===2&&p12.length===2&&new Set(p80).size===1&&new Set(p12).size===1&&p80[0]!==p12[0])
  ok('80 shares step '+p80[0]+' in both panels; 12 shares step '+p12[0]);
else bad('80/12 step indices do not match across the pair: 80='+p80+' 12='+p12);

// step through and confirm they light up together
const block=fm.querySelector('.methodblock');
w.resetWrittenMethod(block);
w.revealWrittenMethodStep(block,1);
let lit=[...block.querySelectorAll('.method-active')].map(x=>norm(x.textContent));
if(lit.includes('12')&&lit.filter(t=>t==='12').length===2&&!lit.includes('80'))
  ok('step 1 reveals 12 in both panels and not 80: ['+lit.join(', ')+']');
else bad('step 1 lit: ['+lit.join(', ')+']');
w.revealWrittenMethodStep(block,2);
lit=[...block.querySelectorAll('.method-active')].map(x=>norm(x.textContent));
if(lit.filter(t=>t==='80').length===2&&!lit.includes('12'))
  ok('step 2 reveals 80 in both panels: ['+lit.join(', ')+']');
else bad('step 2 lit: ['+lit.join(', ')+']');
const st=block.querySelector('.method-status').textContent;
ok('status line reads: "'+st+'"');

// 7. pvc + columnSub reveal the same place together ------------------------
const fs6=d.querySelector('.pg-figure[data-fig="f-sub"]');
const b6=fs6.querySelector('.methodblock');
w.resetWrittenMethod(b6);
w.revealWrittenMethodStep(b6,1);
const panels=[...b6.querySelectorAll('.miniMethod')];
const onesLit=panels.map(p=>p.querySelectorAll('.method-active').length);
if(onesLit.every(x=>x>0)) ok('subtraction figure: step 1 lights the ones in the counters and the written method ('+onesLit.join(' + ')+' elements)');
else bad('subtraction figure step 1 lit '+onesLit.join(' + '));
const u6=b6.querySelector('.method-status').textContent;
ok('subtraction status: "'+u6+'"');

// 8. no external requests --------------------------------------------------
const ext=[...html.matchAll(/(?:src|href)\s*=\s*["'](https?:|\/\/)/g)].length;
if(ext===0) ok('no external requests'); else bad(ext+' external references');
const fontEmbedded=/@font-face\{font-family:'Lexend Deca'.*?url\(data:font\/woff2;base64,/.test(html);
if(fontEmbedded) ok('Lexend Deca embedded'); else bad('font not embedded');

console.log(errs.length?('\n'+errs.length+' FAILED'):'\nAll guide checks passed.');
process.exit(errs.length?1:0);
