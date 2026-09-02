/*
 * Shape Properties Lab - mathematical acceptance criteria.
 *
 *   node shape_criteria.test.js
 *
 * Checks the six criteria in SHAPE_LAB_SPEC.md, plus a seventh on the three
 * solid orientations and an eighth on dropdown/caption agreement, against what
 * the SVG actually
 * draws, not against what the caption claims. Needs a browser, so it is kept
 * separate from tools.test.js, which runs under jsdom and has no geometry.
 * Exits 1 on failure.
 */
const fs=require('fs'), path=require('path'), {pathToFileURL}=require('url');

let chromium;
try{ ({chromium}=require('playwright')); }
catch(e){
  console.error('This check drives a real browser and needs Playwright:\n' +
                '  npm install            (installs it from package.json)\n' +
                'Then, unless a Chromium is already present, either\n' +
                '  npx playwright install chromium\n' +
                'or point CHROMIUM_PATH at an existing binary.');
  process.exit(1);
}

/* Locate the tool relative to this script, so the check keeps working when the
   package is moved or the version in the folder name changes. */
function findTool(root){
  const walk=(dir,depth)=>{
    if(depth>3) return null;
    let entries; try{ entries=fs.readdirSync(dir,{withFileTypes:true}); }catch(e){ return null; }
    for(const e of entries){
      if(e.isFile() && e.name==='Shape_Properties_Lab_v1.html') return path.join(dir,e.name);
    }
    for(const e of entries){
      if(e.isDirectory() && e.name!=='node_modules' && !e.name.startsWith('.')){
        const r=walk(path.join(dir,e.name),depth+1); if(r) return r;
      }
    }
    return null;
  };
  return walk(path.resolve(root),0);
}
const file=findTool(process.argv[2]||__dirname);
if(!file){
  console.error('Could not find Shape_Properties_Lab_v1.html under ' +
                path.resolve(process.argv[2]||__dirname) +
                '\nRun this from the package root, or pass the path as an argument.');
  process.exit(1);
}
const D=pathToFileURL(file).href;
console.log('Tool: '+path.relative(process.cwd(),file)+'\n');

let bad=0; const chk=(ok,msg)=>{if(!ok)bad++;console.log((ok?'  OK   ':'  BAD  ')+msg)};
(async()=>{
 /* Use a bundled Chromium if Playwright has one; otherwise fall back to a
    known sandbox path or CHROMIUM_PATH. */
 const candidates=[process.env.CHROMIUM_PATH,'/opt/pw-browsers/chromium-1194/chrome-linux/chrome']
   .filter(Boolean).filter(p=>fs.existsSync(p));
 let b;
 try{ b=await chromium.launch(candidates.length?{executablePath:candidates[0]}:{}); }
 catch(e){
   console.error('Could not start Chromium: '+e.message.split('\n')[0]+
     '\nInstall one with "npx playwright install chromium", or set CHROMIUM_PATH.');
   process.exit(1);
 }
 const ctx=await b.newContext();
 await ctx.route('**',r=>{const u=r.request().url();(u.startsWith('file:')||u.startsWith('data:'))?r.continue():r.abort()});
 const p=await ctx.newPage();
 const set=async(o)=>{await p.evaluate(o=>{for(const k of Object.keys(o)){const el=document.getElementById(k);
   if(el.type==='checkbox')el.checked=o[k];else el.value=o[k];el.dispatchEvent(new Event('input',{bubbles:true}));}},o);
   await p.waitForTimeout(140);};
 await p.goto(D,{waitUntil:'load'});await p.waitForTimeout(300);

 console.log('1. Euler V - E + F = 2, read from the stated counts');
 for(const s of ['cube','cuboid','pyramid','tetrahedron','triprism','hexprism']){
  await set({view:'properties3d',solid:s});
  const v=await p.evaluate(()=>[...document.querySelectorAll('.prop')].reduce((a,r)=>
    (a[r.querySelector('.propkey').textContent]=r.querySelector('.propval').textContent,a),{}));
  const F=+v.Faces,E=+v.Edges,V=+v.Vertices;
  chk(V-E+F===2, `${s.padEnd(12)} V=${V} E=${E} F=${F}  V-E+F=${V-E+F}`);
 }
 console.log('2. Lines of symmetry, counted from the mirror lines actually drawn');
 for(const [sh,want] of [['square',4],['rectangle',2],['parallelogram',0],['scalene',0],['kite',1],['hexagon',6],['trapezium',1]]){
  for(const rot of [0,37]){
   await set({view:'properties2d',shape:sh,orient:rot});
   const drawn=await p.evaluate(()=>document.querySelectorAll('#stage .mirror').length);
   const stated=await p.evaluate(()=>{const r=[...document.querySelectorAll('.prop')]
     .find(x=>x.querySelector('.propkey').textContent==='Lines of symmetry');return r?+r.querySelector('.propval').textContent:-1});
   chk(drawn===want&&stated===want, `${sh.padEnd(14)} at ${String(rot).padStart(2)}°: drawn=${drawn} stated=${stated} expected=${want}`);
  }
 }
 console.log('3. Nets: claim matches a real fold');
 const TRUTH={cross:true,stair:true,tee:true,rect23:false,line:false};
 for(const n of Object.keys(TRUTH)){
  await set({view:'nets',net:n});
  const r=await p.evaluate(()=>({ans:document.getElementById('answerline').textContent,
    squares:document.querySelectorAll('#stage rect').length}));
  const claims=/does not/.test(r.ans)?false:true;
  chk(claims===TRUTH[n]&&r.squares===6, `${n.padEnd(8)} squares=${r.squares} claims folds=${claims} truth=${TRUTH[n]}`);
 }
 console.log('4. Diameter is twice the radius in the drawing');
 await set({view:'circle'});
 const c=await p.evaluate(()=>{
  const circ=document.querySelector('#stage circle.shape');
  const d=document.querySelector('#stage .diameter'),ra=document.querySelector('#stage .radius');
  const len=l=>Math.hypot(l.x2.baseVal.value-l.x1.baseVal.value, l.y2.baseVal.value-l.y1.baseVal.value);
  return {r:circ.r.baseVal.value,dLen:len(d),rLen:len(ra)};});
 chk(Math.abs(c.dLen-2*c.rLen)<1e-6 && Math.abs(c.rLen-c.r)<1e-6,
   `circle r=${c.r}  radius line=${c.rLen}  diameter line=${c.dLen}  ratio=${(c.dLen/c.rLen).toFixed(3)}`);
 console.log('5. Parallel and perpendicular hold for the coordinates drawn');
 for(const [sh,rot] of [['rectangle',0],['rectangle',41],['parallelogram',0],['trapezium',23]]){
  await set({view:'lines',shape:sh,orient:rot});
  const r=await p.evaluate(()=>{
   const g=cls=>[...document.querySelectorAll('#stage .'+cls)].map(l=>
     [l.x2.baseVal.value-l.x1.baseVal.value, l.y2.baseVal.value-l.y1.baseVal.value]);
   return {par:g('parallel'),perp:g('perp')};});
  const u=v=>{const m=Math.hypot(v[0],v[1]);return [v[0]/m,v[1]/m]};
  let okp=true,oke=true;
  if(r.par.length===2){const a=u(r.par[0]),bb=u(r.par[1]);okp=Math.abs(a[0]*bb[1]-a[1]*bb[0])<1e-4;}
  if(r.perp.length===2){const a=u(r.perp[0]),bb=u(r.perp[1]);oke=Math.abs(a[0]*bb[0]+a[1]*bb[1])<1e-4;}
  chk(okp&&oke, `${sh.padEnd(14)} at ${String(rot).padStart(2)}°: parallel pair cross~0 ${okp}, perpendicular pair dot~0 ${oke}`);
 }
 console.log('6. Stated properties match the rendered shape');
 for(const [sh,sides] of [['triangle',3],['square',4],['pentagon',5],['hexagon',6],['octagon',8],['kite',4]]){
  await set({view:'properties2d',shape:sh,orient:0});
  const r=await p.evaluate(()=>{
   const pts=document.querySelector('#stage polygon').getAttribute('points').trim().split(/\s+/).length;
   const row=k=>{const x=[...document.querySelectorAll('.prop')].find(e=>e.querySelector('.propkey').textContent===k);
     return x?x.querySelector('.propval').textContent:null};
   return {drawn:pts,sides:row('Sides'),verts:row('Vertices'),dots:document.querySelectorAll('#stage .vtx').length};});
  chk(r.drawn===sides && +r.sides===sides && +r.verts===sides && r.dots===sides,
    `${sh.padEnd(10)} polygon points=${r.drawn} vertex dots=${r.dots} stated sides=${r.sides} vertices=${r.verts} expected=${sides}`);
 }
 console.log('7. Every solid reads as a solid in all three orientations');
 {
  const SOL=['cube','cuboid','pyramid','tetrahedron','triprism','hexprism'];
  const area=pp=>{let a=0;for(let i=0;i<pp.length;i++){const q=pp[(i+1)%pp.length];a+=pp[i][0]*q[1]-q[0]*pp[i][1];}return Math.abs(a)/2;};
  const hull=pts=>{const t=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
   const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
   const lo=[];for(const q of t){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}
   const up=[];for(let i=t.length-1;i>=0;i--){const q=t[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
   return lo.slice(0,-1).concat(up.slice(0,-1));};
  for(const sname of SOL)for(let o=0;o<3;o++){
   /* Fresh page per combination: the orientation counter lives in the page, so
      clicking cumulatively wraps 0 -> 1 -> 3 = 0 and silently retests 0. */
   const q=await ctx.newPage();
   await q.goto(D+'?view=properties3d',{waitUntil:'load'});await q.waitForTimeout(200);
   const polys=await q.evaluate(({sname,o})=>{
    for(let i=0;i<o;i++)document.getElementById('imtNew').click();
    document.getElementById('solid').value=sname;
    document.getElementById('solid').dispatchEvent(new Event('input',{bubbles:true}));
    return [...document.querySelectorAll('#stage polygon.face')].map(el=>
      el.getAttribute('points').trim().split(/\s+/).map(t=>t.split(',').map(Number)));
   },{sname,o});
   await q.close();
   const areas=polys.map(area).sort((x,y)=>x-y);
   const H=area(hull([].concat.apply([],polys)));
   const sum=areas.reduce((a,c)=>a+c,0);
   const thin=areas.length?areas[0]/H:0, tile=Math.abs(sum-H)/H;
   chk(areas.length>=2&&thin>=0.03&&tile<0.02,
     `${sname.padEnd(12)} orientation ${o}: ${areas.length} faces, thinnest ${(thin*100).toFixed(1)}% of silhouette`);
  }
 }
 console.log('8. The dropdown and the caption never disagree');
 {
  /* A view that cannot draw the selected shape must say so, not swap silently.
     The circle has no polygon points, which is where this went wrong. */
  const SH=['circle','square','rectangle','kite','hexagon','scalene'];
  for(const v of ['name','properties2d','symmetry','lines']){
   for(const sh of SH){
    const q=await ctx.newPage();
    await q.goto(D+'?view='+v,{waitUntil:'load'});await q.waitForTimeout(180);
    const r=await q.evaluate(sh=>{
      const el=document.getElementById('shape');
      const opt=[...el.options].find(o=>o.value===sh);
      if(!opt.disabled){el.value=sh;el.dispatchEvent(new Event('input',{bubbles:true}));}
      const sel=[...el.options].find(o=>o.value===el.value);
      return {picked:el.value,pickedLabel:sel?sel.textContent.trim():'',disabled:opt.disabled,
        answer:document.getElementById('answerline').textContent.trim(),
        note:document.getElementById('shapeNote').hidden?null:document.getElementById('shapeNote').textContent};
    },sh);
    await q.close();
    /* The caption must name whatever the dropdown is currently showing. The
       original bug left the dropdown on "Circle" while the caption read
       "Regular hexagon", so comparing the dropdown against itself proves
       nothing — it has to be compared against the caption. */
    const agrees = r.answer.toLowerCase().indexOf(r.pickedLabel.toLowerCase())>=0;
    const honest = r.disabled || agrees || !!r.note;
    chk(honest, `${v.padEnd(13)} ${sh.padEnd(10)} -> dropdown "${r.pickedLabel}", caption "${r.answer}"` +
      (r.disabled?'  (option disabled here)':r.note?'  + note explains the swap':agrees?'':'  MISMATCH'));
   }
  }
 }
 console.log(bad?`\n${bad} CRITERIA FAILURES`:'\nAll eight acceptance checks hold against the rendered SVG.');
 await b.close();
 process.exit(bad?1:0);
})();
