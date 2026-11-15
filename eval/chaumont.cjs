#!/usr/bin/env node
/* Joran — Messung Chaumont (chm) als Upwind-Station für West. Nur Messung, ändert nichts an der App.

   Frage: Soll Chaumont für «Wind kommt» zählen? Heute ist die Station eine Erweiterung (extra) und zählt erst, wenn sie
   als verlässlich ausgewiesen ist. Anlass: 15.11.2026, Karte zeigte «Ungeprüftes Signal: Chaumont», kurz danach SW in Ipsach.

   Je Tag wird das Live-Signal wie in eval/measure.cjs nachgespielt (10-min-Schritte, Lieferverzug, core.nowcast):
     - Chaumont: erstes Signal (Richtung und Schwelle wie in der App, Windsystem West)
     - App heute: erster Push (Regel E oder verlässliche Station)
   Wahrheit: core.lakeDay (Seemessung Vingelz/Ipsach, Fenster und Mindestdauer aus den Einstellungen).
   Gezählt werden Treffer (Signal spätestens beim Beginn am See), zu spät, verpasst, Fehlalarme an ruhigen Tagen und der
   Gewinn gegenüber heute: foilbare Tage, an denen Chaumont früher kommt als der Push der App oder die App keinen Push hat.
   Fehlalarme zählen doppelt: «neu» heisst, an dem Tag hatte die App sonst keinen Push.

   Aufruf:  node eval/chaumont.cjs [--T 12] [--user simon] [--offline] [--holdout] [--verzug 10]
   Der Holdout (eval/split.json) bleibt ohne --holdout ungelesen. Getrennt ausgewiesen: Entwicklung, neue Tage (nach dem
   Holdout) und der laufende Tag (unvollständig). Entscheid nach eval/README.md: mindestens 10 West-Ereignistage. */
"use strict";
const fs = require("fs"), path = require("path"), {execFileSync} = require("child_process");
const ROOT = path.join(__dirname, "..");
const C = require(path.join(ROOT, "core.js"));

const o = {T:12, user:"simon", offline:false, holdout:false, verzug:10};
for(let i=2; i<process.argv.length; i++){
  const a = process.argv[i], v = () => process.argv[++i];
  if(a==="--T") o.T = parseFloat(v()); else if(a==="--user") o.user = v(); else if(a==="--offline") o.offline = true;
  else if(a==="--holdout") o.holdout = true; else if(a==="--verzug") o.verzug = parseFloat(v());
  else if(a==="-h" || a==="--help"){ console.log(fs.readFileSync(__filename,"utf8").split("*/")[0]); process.exit(0); }
  else throw new Error("unbekannte Option "+a);
}
const St = C.merge(C.sanitizeCfg(JSON.parse(fs.readFileSync(path.join(ROOT,"users",o.user+".json"),"utf8"))));
St.T = o.T;
const split = JSON.parse(fs.readFileSync(path.join(__dirname,"split.json"),"utf8"));
const ABK = "chm", UP = C.UPWIND.find(u=>u.abk===ABK);

/* Seemessung: Archiv im Repo und im Branch origin/live, dazu lake.json (laufender Tag) */
const git = args => execFileSync("git", args, {cwd:ROOT, encoding:"utf8", stdio:["ignore","pipe","ignore"], maxBuffer:256<<20});
const DAY_CH = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"});
function loadLake(){
  const src = [];
  const dir = path.join(ROOT,"archive");
  if(fs.existsSync(dir)) fs.readdirSync(dir).filter(f=>/\.json$/.test(f)).forEach(f=>src.push(JSON.parse(fs.readFileSync(path.join(dir,f),"utf8"))));
  try{
    git(["ls-tree","origin/live","archive/"]).split("\n").filter(Boolean).forEach(l=>{
      src.push(JSON.parse(git(["cat-file","blob",l.split("\t")[0].split(/\s+/)[2]]))); });
    src.push(JSON.parse(git(["show","origin/live:lake.json"])));
  }catch(e){ console.error("Branch origin/live nicht lesbar: git fetch origin live"); }
  const per = {};
  C.LAKE.forEach(L=>{ const m = {};
    src.forEach(s=>((s.st && s.st[L.id] && s.st[L.id].rows) || []).forEach(r=>{ if(r && r.t) m[r.t] = r; }));
    Object.values(m).sort((a,b)=>a.t<b.t?-1:1).forEach(r=>{ const d = DAY_CH.format(new Date(r.t));
      const x = per[d] || (per[d] = {st:Object.fromEntries(C.LAKE.map(z=>[z.id,{rows:[]}]))}); x.st[L.id].rows.push(r); }); });
  return per;
}

/* SwissMetNet, 10 min: Cache eval/cache (wie measure.cjs), sonst nachladen */
const CACHE = path.join(__dirname,"cache");
const toRows = a => (a||[]).map(r=>Object.assign({}, r, {t:new Date(r.t)})).filter(r=>r.mean!=null && !isNaN(r.t)).sort((a,b)=>a.t-b.t);
async function loadStations(){
  const S = {};
  for(const up of C.UPWIND){
    const f = path.join(CACHE, up.abk+".t.json");
    let rows = fs.existsSync(f) ? toRows(JSON.parse(fs.readFileSync(f,"utf8"))) : [];
    if(!o.offline){
      let fresh = [];
      for(const p of ["recent","now"]){ try{ fresh = fresh.concat(await C.fetchStation(up.abk,"t",p)); }catch(e){} }
      if(fresh.length){ const m = new Map(); rows.concat(toRows(fresh)).forEach(r=>m.set(+r.t, r)); rows = [...m.values()].sort((a,b)=>a.t-b.t);
        fs.mkdirSync(CACHE,{recursive:true}); fs.writeFileSync(f, JSON.stringify(rows)); }
    }
    if(rows.length) S[up.abk] = rows;
  }
  return S;
}
const lastIdx = (rows, t) => { let lo = 0, hi = rows.length-1, k = -1; while(lo<=hi){ const m = (lo+hi)>>1; if(rows[m].t<=t){ k = m; lo = m+1; } else hi = m-1; } return k; };

/* Schritte wie push/check.cjs: 6–21 Uhr, ab 2 h vor dem Fenster bis zu dessen Ende */
function steps(day){
  const [h0,h1] = C.WINS[St.win], out = [], base = Date.parse(day+"T00:00:00Z");
  for(let t=base-3*3600e3; t<base+25*3600e3; t+=600e3){
    const dt = new Date(t); if(DAY_CH.format(dt)!==day) continue;
    const hr = C.localHour(dt); if(hr<6 || hr>=21 || hr<h0-2 || hr>h1) continue;
    if(dt>Date.now()) break;
    out.push(dt);
  }
  return out;
}
function replay(S, day){
  const r = {chm:null, chmSys:null, push:null, by:""};
  const lag = o.verzug*60000;
  for(const t of steps(day)){
    const stn = {}, tv = new Date(t-lag);
    C.UPWIND.forEach(up=>{ const rows = S[up.abk]; if(!rows) return; const i = lastIdx(rows, tv); if(i>=0) stn[up.abk] = {rows:rows.slice(Math.max(0,i-8), i+1)}; });
    const nc = C.nowcast(stn, St, t, null);
    const c = nc.sig.find(s=>s.up.abk===ABK);
    if(c && !r.chm){ r.chm = t; r.chmSys = c.u.sys ? c.u.sys.id : null; }
    if(!r.push && (nc.eOk || nc.trusted.length)){ r.push = t; r.by = nc.trusted.map(s=>s.up.abk).concat(nc.eOk?["E"]:[]).join(","); }
  }
  return r;
}

(async()=>{
  const per = loadLake(), S = await loadStations();
  if(!S[ABK]){ console.log("Keine Daten von Chaumont."); return; }
  const today = DAY_CH.format(new Date());
  const days = Object.keys(per).sort().filter(d=>S[ABK].some(r=>DAY_CH.format(r.t)===d));
  const grp = d => d===today ? "heute" : d<=split.devBis ? "dev" : d<=split.holdoutBis ? "holdout" : "neu";
  const G = {};
  const hm = t => t ? C.hhmm(t) : "–";
  console.log(`Chaumont (${UP.name}, Startfaktor ${UP.f}, ${UP.extra?"Erweiterung, zählt heute nicht":"zählt"}) · Seeschwelle ${St.T} kn · Fenster ${C.WINS[St.win][2]} · Verzug ${o.verzug} min`);
  console.log("Tag         Teil     See         Chaumont      App-Push            Urteil");
  for(const d of days){
    const g = grp(d); if(g==="holdout" && !o.holdout) continue;
    const a = C.lakeDay(per[d], d, St); if(!a.known && g!=="heute") continue;
    const R = replay(S, d), sys = a.ev ? ((C.dirOf(a.dir)||{}).id || "?") : null;
    const x = G[g] || (G[g] = {ev:0, evW:0, hit:0, late:0, miss:0, nev:0, fa:0, faNeu:0, gain:0, leads:[]});
    let u;
    if(a.ev){
      x.ev++; if(sys==="w") x.evW++;
      if(R.chm && R.chm<=a.onset){ x.hit++; x.leads.push((a.onset-R.chm)/60000);
        const besser = !R.push || R.chm<R.push; if(besser) x.gain++;
        u = `Treffer, ${Math.round((a.onset-R.chm)/60000)} min vorher${besser ? (R.push ? `, ${Math.round((R.push-R.chm)/60000)} min vor der App` : ", App ohne Push") : ""}`; }
      else if(R.chm){ x.late++; u = "zu spät"; }
      else { x.miss++; u = "kein Signal"; }
    } else if(g==="heute" && !a.ev){
      u = R.chm ? "Signal, See bisher unter der Schwelle" : "–";
    } else {
      x.nev++;
      if(R.chm){ x.fa++; if(!R.push) x.faNeu++; u = R.push ? "Fehlalarm (App hatte auch Push)" : "Fehlalarm, neu"; }
      else u = "ruhig, kein Signal";
    }
    console.log(`${d}  ${g.padEnd(7)}  ${a.ev ? ("JA "+hm(a.onset)+" "+sys).padEnd(11) : (g==="heute"?"bisher –":"–").padEnd(11)} ${(hm(R.chm)+(R.chmSys?" "+R.chmSys:"")).padEnd(13)} ${(hm(R.push)+(R.by?" ["+R.by+"]":"")).padEnd(19)} ${u}`);
  }
  console.log("\nTeil     foilbar (West)  Treffer  zu spät  verpasst  ruhig  Fehlalarme (neu)  früher als App  Vorlauf");
  ["dev","holdout","neu","heute"].forEach(g=>{ const x = G[g]; if(!x) return;
    const lead = x.leads.length ? Math.round(x.leads.reduce((s,v)=>s+v,0)/x.leads.length)+" min" : "–";
    console.log(`${g.padEnd(8)} ${(x.ev+" ("+x.evW+")").padEnd(15)} ${String(x.hit).padEnd(8)} ${String(x.late).padEnd(8)} ${String(x.miss).padEnd(9)} ${String(x.nev).padEnd(6)} ${(x.fa+" ("+x.faNeu+")").padEnd(17)} ${String(x.gain).padEnd(15)} ${lead}`); });
  const evW = Object.entries(G).filter(([g])=>g!=="heute").reduce((s,[,x])=>s+x.evW,0);
  console.log(`\nWest-Ereignistage gesamt (ohne heute${o.holdout?"":", ohne Holdout"}): ${evW} von nötig 10 (eval/README.md).`);
})();
