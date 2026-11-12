#!/usr/bin/env node
/* Joran — H-B8: Hat sich der thermische Talabwind verstärkt? Auswertung, kein Modell.
   Courtelary (Vallon de St-Imier) an ruhigen, heissen Sommertagen, Stundenwerte SwissMetNet (OGD).
   Ruhig und heiss: Juni–August, Chasseral 10–17 Uhr im Vektormittel < 10 kn, Cressier Tmax ≥ 25 °C und Tagesgang ≥ 10 K
   (wie eval/bucht.cjs, H-B6). Talabwärts = Strömung nach 70° (Wind aus 250°, Talachse WSW–ONO).
   Aufruf: node eval/courtelary.cjs [--offline]   Cache: eval/cache/<abk>.h.json
   Hypothese und Befund: eval/IDEEN.md, Abschnitt «Bieler Bucht», H-B8. */
"use strict";
const fs = require("fs"), path = require("path");
const C = require(path.join(__dirname, "..", "core.js"));
const offline = process.argv.includes("--offline"), CACHE = path.join(__dirname, "cache");
const PERIODS = ["historical_2010-2019", "historical_2020-2029", "recent"];

async function load(abk){
  const f = path.join(CACHE, abk+".h.json");
  if(offline){ if(!fs.existsSync(f)){ console.error(`Cache fehlt: ${f}`); process.exit(1); }
    return JSON.parse(fs.readFileSync(f, "utf8")).map(r=>Object.assign(r, {t:new Date(r.t)})); }
  const m = new Map();
  for(const p of PERIODS) (await C.fetchStation(abk, "h", p)).forEach(r=>m.set(+r.t, r));
  const rows = [...m.values()].sort((a,b)=>a.t-b.t);
  fs.mkdirSync(CACHE, {recursive:true}); fs.writeFileSync(f, JSON.stringify(rows));
  return rows;
}
const vec = xs => { let u=0, v=0, s=0, n=0; xs.forEach(r=>{ if(r.mean==null || r.dir==null) return; const k = r.dir*Math.PI/180; u -= r.mean*Math.sin(k); v -= r.mean*Math.cos(k); s += r.mean; n++; });
  return n ? {s:s/n, d:(Math.atan2(-u,-v)*180/Math.PI+360)%360} : null; };
const K = 70*Math.PI/180;
const tal = r => -r.mean*Math.sin(r.dir*Math.PI/180)*Math.sin(K) - r.mean*Math.cos(r.dir*Math.PI/180)*Math.cos(K);   /* Komponente talabwärts, kn */
const wsw = r => r.dir>=220 && r.dir<=280;
function trend(pts){
  const n = pts.length, mx = pts.reduce((a,p)=>a+p[0],0)/n, my = pts.reduce((a,p)=>a+p[1],0)/n;
  const sxx = pts.reduce((a,p)=>a+(p[0]-mx)**2,0), b = pts.reduce((a,p)=>a+(p[0]-mx)*(p[1]-my),0)/sxx;
  const se = Math.sqrt(pts.reduce((a,p)=>a+(p[1]-my-b*(p[0]-mx))**2,0)/(n-2)/sxx);
  return {b, se, n, my};
}

(async()=>{
  const [coy, cha, crm] = await Promise.all(["coy","cha","crm"].map(load));
  const w = coy.filter(r=>r.dir!=null);
  console.log(`Courtelary, Stundenwerte Wind ${C.dayOfDate(w[0].t)} bis ${C.dayOfDate(w[w.length-1].t)}`);
  /* Tage auswählen */
  const by = (rows, f) => { const m = {}; rows.forEach(r=>{ const d = C.dayOfDate(r.t), mo = +d.slice(5,7); if(mo>=6 && mo<=8 && f(r)) (m[d] || (m[d]=[])).push(r); }); return m; };
  const chaD = by(cha, r=>{ const h = C.localHour(r.t); return h>=10 && h<=17; }), crmD = by(crm, r=>r.temp!=null);
  const sel = new Set(Object.keys(chaD).filter(d=>{ const c = vec(chaD[d]), t = (crmD[d]||[]).map(r=>r.temp);
    return c && c.s<10 && t.length>=20 && Math.max(...t)>=25 && Math.max(...t)-Math.min(...t)>=10; }));
  /* Nacht gehört zum Vortag */
  const evDay = r => { const h = C.localHour(r.t); return h<=6 ? C.dayOfDate(new Date(+r.t-7*3600e3)) : C.dayOfDate(r.t); };
  const cw = w.filter(r=>sel.has(evDay(r)));
  console.log(`${sel.size} ruhige, heisse Sommertage\n\nTagesgang Courtelary (alle Jahre): Stunde, Mittel, Vektorrichtung, Anteil WSW 220–280°`);
  for(const h of [12,14,16,18,19,20,21,22,23,0,2,4,6]){ const xs = cw.filter(r=>C.localHour(r.t)===h), v = vec(xs);
    console.log(String(h).padStart(2), `${v.s.toFixed(1)} kn`.padStart(7), `${Math.round(v.d)}°`.padStart(5), `${Math.round(100*xs.filter(wsw).length/xs.length)} %`.padStart(6)); }
  for(const [name, h0, h1] of [["Abend 18–23 Uhr", 18, 23], ["Nacht 22–04 Uhr (Talabwind)", 22, 4]]){
    const inW = h => h0<=h1 ? h>=h0 && h<h1 : h>=h0 || h<=h1, per = {};
    cw.forEach(r=>{ if(inW(C.localHour(r.t))) (per[evDay(r)] || (per[evDay(r)]=[])).push(r); });
    const pts = [], yr = {};
    Object.entries(per).forEach(([d,xs])=>{ if(xs.length<4) return; const c = xs.reduce((a,r)=>a+tal(r),0)/xs.length, s = xs.filter(wsw).length/xs.length;
      const y = +d.slice(0,4); pts.push([y, c]); (yr[y] || (yr[y]=[])).push([c, s]); });
    console.log(`\n${name}: Jahr, Tage, talabwärts (kn), Anteil WSW`);
    Object.keys(yr).sort().forEach(y=>{ const a = yr[y]; console.log(y, String(a.length).padStart(3), (a.reduce((s,x)=>s+x[0],0)/a.length).toFixed(2).padStart(6), `${Math.round(100*a.reduce((s,x)=>s+x[1],0)/a.length)} %`.padStart(6)); });
    const t = trend(pts);
    console.log(`Trend ${(t.b*10>=0?"+":"")+(t.b*10).toFixed(2)} kn je 10 Jahre (Standardfehler ${(t.se*10).toFixed(2)}), Mittel ${t.my.toFixed(2)} kn, ${t.n} Tage`);
  }
})().catch(e=>{ console.error(e.message||e); process.exit(1); });
