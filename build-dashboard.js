const fs=require('fs');
const CAL_SRC=fs.readFileSync('nvr-calibrate.js','utf8').replace(/<\/script/g,'<\\/script');
const manifest=JSON.parse(fs.readFileSync('sample-paper-manifest.json','utf8'));
// teacher dashboard embeds the answer key (manifest) — TEACHER ONLY.
const MANIFEST_JSON=JSON.stringify(manifest);

const html=`<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>NVR — Class Dashboard (teacher)</title>
<style>
  :root{--ink:#1f2933;--muted:#5f6d7a;--line:#dce4ea;--accent:#2f6f8f;--good:#2e7d5b;--warn:#c07a1e;--bad:#c0392b;--bg:#f4f7f9}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'Lexend Deca',system-ui,-apple-system,'Segoe UI',Arial,sans-serif}
  header{background:#fff;border-bottom:1px solid var(--line);padding:14px clamp(14px,4vw,28px);display:flex;flex-wrap:wrap;gap:12px;align-items:center}
  header h1{font-size:17px;margin:0;flex:1}
  .warnbar{background:#fff7e6;color:#8a5a12;font-size:12px;padding:6px clamp(14px,4vw,28px);border-bottom:1px solid #f0e0c0}
  main{max-width:1000px;margin:0 auto;padding:16px clamp(14px,4vw,28px) 60px}
  .src{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:16px}
  .src input[type=text]{flex:1;min-width:200px;font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:8px}
  button{font:inherit;font-weight:600;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:9px;padding:8px 14px;cursor:pointer}
  button.ghost{background:#fff;color:var(--accent)}
  .summary{display:flex;gap:18px;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:16px}
  .stat{min-width:90px}.stat .v{font-size:22px;font-weight:700}.stat .l{font-size:12px;color:var(--muted)}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
  th,td{padding:9px 11px;text-align:left;border-bottom:1px solid var(--line);font-size:13px;vertical-align:middle}
  th{background:#eef3f6;font-size:12px}
  td.q{font-weight:700;text-align:center;width:36px}
  .bar{position:relative;height:16px;background:#eef2f5;border-radius:8px;min-width:120px;overflow:hidden}
  .bar > i{position:absolute;left:0;top:0;bottom:0;border-radius:8px}
  .pill{display:inline-block;padding:1px 8px;border-radius:20px;font-size:12px;font-weight:700}
  .g{background:#e6f4ec;color:var(--good)}.a{background:#fbf0dd;color:var(--warn)}.b{background:#f7e2df;color:var(--bad)}
  .flag{font-size:12px;color:var(--warn)}
  .muted{color:var(--muted)}
  .review{background:#fff;border:1px solid var(--line);border-left:4px solid var(--bad);border-radius:10px;padding:12px 14px;margin-top:16px}
  .review h3{margin:0 0 6px;font-size:14px}
  #gate{position:fixed;inset:0;background:#f4f7f9;display:grid;place-items:center;z-index:30}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px;max-width:340px;width:90%}
  .card input{width:100%;font:inherit;padding:9px 11px;border:1px solid var(--line);border-radius:9px;margin:10px 0}
  .empty{color:var(--muted);text-align:center;padding:40px}
</style></head>
<body>
<div id="gate"><div class="card"><h2 style="margin:0 0 4px">Teacher dashboard</h2>
  <p class="muted" style="font-size:13px;margin:0">This page contains the answer key. Keep it to yourself — don't deploy it anywhere pupils can reach.</p>
  <input id="pin" type="password" placeholder="PIN" onkeydown="if(event.key==='Enter')unlock()">
  <button style="width:100%" onclick="unlock()">Open</button></div></div>

<header><h1>Non-Verbal Reasoning — Class Dashboard</h1>
  <span class="muted" id="updated" style="font-size:12px"></span></header>
<div class="warnbar">Teacher tool · shows live item statistics as responses arrive · the PIN is a courtesy lock, not security.</div>

<main>
  <div class="src">
    <button class="ghost" onclick="document.getElementById('file').click()">Load CSV export…</button>
    <input id="file" type="file" accept=".csv,.tsv,.txt" style="display:none" onchange="loadFile(this.files[0])">
    <span class="muted">or live:</span>
    <input id="url" type="text" placeholder="Apps Script /exec URL (for auto-refresh)">
    <button onclick="loadLive()">Connect</button>
    <label class="muted" style="font-size:12px"><input type="checkbox" id="auto" onchange="toggleAuto()"> auto-refresh</label>
    <button class="ghost" onclick="refresh()">Refresh</button>
  </div>
  <div id="out"><div class="empty">Load a CSV export, or connect the live URL, to see item statistics.</div></div>
</main>

<script>
${CAL_SRC}
</script>
<script>
  var MANIFEST = ${MANIFEST_JSON};
  var CAL = window.NVRCalibrate;
  var PIN = "1234";                 // change me
  var lastRows = null, timer = null, liveUrl = "";

  function unlock(){ if(document.getElementById('pin').value === PIN){ document.getElementById('gate').style.display='none'; } else { document.getElementById('pin').value=''; document.getElementById('pin').placeholder='Try again'; } }

  function rowsFromObjects(objs){ render(objs); }
  function loadFile(f){ if(!f) return; var r=new FileReader(); r.onload=function(){ lastRows = CAL.parseTable(r.result); render(lastRows); document.getElementById('auto').checked=false; toggleAuto(); }; r.readAsText(f); }

  function loadLive(){ liveUrl = document.getElementById('url').value.trim(); if(liveUrl){ refresh(); } }
  function refresh(){
    if(lastRows && !liveUrl){ render(lastRows); return; }
    if(!liveUrl) return;
    var cbName = 'nvrcb_' + Date.now();
    window[cbName] = function(data){
      try{ document.head.removeChild(s); }catch(e){}
      delete window[cbName];
      if(!data || !data.header){ return; }
      var objs = data.rows.map(function(r){ var o={}; data.header.forEach(function(h,i){ o[h]=r[i]; }); return o; });
      lastRows = objs; render(objs);
    };
    var s=document.createElement('script');
    s.src = liveUrl + (liveUrl.indexOf('?')>-1?'&':'?') + 'action=rows&callback=' + cbName;
    document.head.appendChild(s);
  }
  function toggleAuto(){ var on=document.getElementById('auto').checked; if(timer){clearInterval(timer);timer=null;} if(on && liveUrl){ timer=setInterval(refresh, 20000); } }

  function cls(v, good, warnLo){ if(v==null) return 'muted'; if(v<0) return 'b'; if(v<warnLo) return 'a'; return 'g'; }
  function facCls(f){ if(f==null) return 'muted'; if(f>0.9||f<0.15) return 'a'; return 'g'; }
  function barColor(f){ if(f==null) return '#ccc'; if(f>0.9||f<0.15) return '#c07a1e'; return '#2f6f8f'; }

  function render(rows){
    var aligned = CAL.alignResponses(rows, MANIFEST);
    var scored  = CAL.score(aligned, MANIFEST);
    var stats   = CAL.itemStats(scored, MANIFEST);
    var totals  = scored.map(function(s){return s.total;});
    var mean = totals.length? (totals.reduce(function(a,b){return a+b;},0)/totals.length):0;
    var sd = totals.length? Math.sqrt(totals.reduce(function(a,b){return a+Math.pow(b-mean,2);},0)/totals.length):0;

    var head = '<div class="summary">'+
      stat(scored.length,'pupils')+ stat(mean.toFixed(1)+'/'+MANIFEST.length,'mean score')+ stat(sd.toFixed(2),'spread (SD)')+
      stat(MANIFEST.length,'questions')+'</div>';

    var rowsH = stats.map(function(s){
      var fac = s.facility, disc = s.discrimination;
      var facPct = fac==null? 0 : Math.round(fac*100);
      var flags = (s.flaggedDistractors||[]).map(function(f){return f.option+' ('+Math.round(f.topRate*100)+'% of top)';}).join(', ');
      return '<tr>'+
        '<td class="q">'+s.n+'</td>'+
        '<td>'+s.type+'<div class="muted" style="font-size:11px">'+(s.band||'')+'</div></td>'+
        '<td><div class="bar"><i style="width:'+facPct+'%;background:'+barColor(fac)+'"></i></div><span class="muted" style="font-size:12px">'+(fac==null?'–':facPct+'%')+'</span></td>'+
        '<td><span class="pill '+cls(disc,0,0.2)+'">'+(disc==null?'–':disc.toFixed(2))+'</span></td>'+
        '<td class="muted">'+s.attempted+'</td>'+
        '<td class="flag">'+(flags||'<span class="muted">—</span>')+'</td>'+
        '</tr>';
    }).join('');
    var table='<table><thead><tr><th>Q</th><th>Type / band</th><th>Facility (% correct)</th><th>Discrim.</th><th>n</th><th>Distractor pulling ablest pupils</th></tr></thead><tbody>'+rowsH+'</tbody></table>';

    var bad = stats.filter(function(s){return /NEGATIVE|review|mis-keyed/.test(s.quality);});
    var review = bad.length? '<div class="review"><h3>Review first</h3>'+bad.map(function(s){return '• Q'+s.n+' ('+s.type+') — '+s.quality;}).join('<br>')+'</div>' : '';

    document.getElementById('out').innerHTML = head+table+review;
    document.getElementById('updated').textContent = 'updated '+new Date().toLocaleTimeString()+(liveUrl?' · live':'');
  }
  function stat(v,l){ return '<div class="stat"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>'; }
</script>
</body></html>`;
fs.writeFileSync('class-dashboard.html', html);
console.log('class-dashboard.html written ('+(html.length/1024).toFixed(0)+'KB), NVRCalibrate inlined:', html.includes('NVRCalibrate'));
