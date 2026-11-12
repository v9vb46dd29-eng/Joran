#!/usr/bin/env node
/* Joran — Wind in der Bieler Bucht: Hypothesen von Simon (12.11.2026) prüfen. Auswertung, kein Modell.
   Aufruf: node eval/bucht.cjs [--bis JJJJ-MM-TT]   Standard: nur Entwicklungstage aus eval/split.json.
   Braucht den Branch «live» (Seearchiv) und den Stationscache aus eval/measure.cjs (crm, cha, coy, gre, neu).
   Hypothesen H-B1 bis H-B7 und Prüffragen: eval/IDEEN.md, Abschnitt «Bieler Bucht». */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
const iB = process.argv.indexOf("--bis"), bis = iB>0 ? process.argv[iB+1] : split.devBis;

const {lk} = M.loadArchive([], true);
const grid = t => Math.round(+new Date(t)/600e3)*600e3;
const L = {}; C.LAKE.forEach(x=>{ const m = new Map(); lk.st[x.id].rows.forEach(r=>{ if(C.dayOfDate(new Date(r.t))<=bis) m.set(grid(r.t), r); }); L[x.id] = m; });
const first = Math.min(...C.LAKE.map(x=>L[x.id].size ? Math.min(...L[x.id].keys()) : Infinity));
const load = a => { const f = path.join(__dirname, "cache", a+".t.json");
  if(!fs.existsSync(f)){ console.error(`Cache fehlt: ${a}. Zuerst node eval/measure.cjs laufen lassen.`); process.exit(1); }
  return JSON.parse(fs.readFileSync(f, "utf8")).map(r=>Object.assign(r, {t:new Date(r.t)})).filter(r=>C.dayOfDate(r.t)<=bis); };
const R = {}, S = {}; for(const a of ["crm","cha","coy","gre","neu"]){ R[a] = load(a); S[a] = new Map(R[a].map(r=>[+r.t, r])); }

const inS = (d,a,b) => d!=null && (a<=b ? d>=a && d<=b : d>=a || d<=b);
const vec = rs => { let u=0, v=0, s=0, n=0; rs.forEach(r=>{ if(!r || r.mean==null || r.dir==null) return; const k = r.dir*Math.PI/180; u -= r.mean*Math.sin(k); v -= r.mean*Math.cos(k); s += r.mean; n++; });
  return n ? {s:s/n, d:(Math.atan2(-u,-v)*180/Math.PI+360)%360, n} : null; };
const fv = x => x ? `${Math.round(x.s)} ${C.card(x.d)}`.padEnd(8) : "–       ";
const span = (m, a, b) => { const o = []; for(let t=a; t<=b; t+=600e3) if(m.get(t)) o.push(m.get(t)); return o; };
const hdr = t => console.log(`\n== ${t} ==`);
const lakeDays = [...new Set([...L.vin.keys(), ...L.ips.keys()].map(t=>C.dayOfDate(new Date(t))))].sort();
console.log(`Bieler Bucht, Seearchiv ${lakeDays[0]} bis ${lakeDays[lakeDays.length-1]} (${lakeDays.length} Tage), Stationen bis ${bis}`);

/* H-B1, H-B2: Joran-Episoden (Regel E in Cressier) nach Typ. Teilung und Lee in Vingelz. */
hdr("H-B1/H-B2 Joran: Ipsach gegen Vingelz, Vingelz aus NO bis ONO");
const E = C.REGEL_E, inE = r => r.dir!=null && inS(r.dir, E.sector[0], E.sector[1]) && r.mean>=E.min;
const ep = []; let cur = [];
for(const r of R.crm){ if(+r.t<first) continue; if(inE(r)) cur.push(r); else { if(cur.length>=3) ep.push(cur); cur = []; } }
if(cur.length>=3) ep.push(cur);
if(!ep.length) console.log("keine Episode");
ep.forEach(e=>{
  const t0 = +e[0].t, t1 = +e[e.length-1].t, typ = C.joranType(e[0].t, {neu:{t:R.neu}, crm:{t:R.crm}}) || "?";
  const v = span(L.vin, t0, t1), i = span(L.ips, t0, t1), ne = v.filter(r=>r.dir!=null && inS(r.dir, 0, 80));
  const d = []; for(let t=t0; t<=t1; t+=600e3){ const a = L.ips.get(t), b = L.vin.get(t); if(a && b) d.push(a.mean-b.mean); }
  console.log(`${C.dayOfDate(e[0].t)} ${C.hhmm(e[0].t)}–${C.hhmm(e[e.length-1].t)} Typ ${typ.padEnd(4)} Cressier ${fv(vec(e))} Ipsach ${fv(vec(i))} Vingelz ${fv(vec(v))}`
    + ` Ipsach−Vingelz ${d.length ? Math.round(d.reduce((a,b)=>a+b,0)/d.length) : "–"} kn, Vingelz N–ONO ${ne.length}/${v.length}`);
});

/* H-B3: Vingelz aus N bis ONO ohne Bise am Jurasüdfuss: Wind aus dem Taubenloch? */
hdr("H-B3 Vingelz aus N bis ONO (0–80°, ≥ 3 kn, ≥ 30 min), keine Bise (Grenchen nicht 30–110° ≥ 6 kn, Chasseral nicht 45–135° ≥ 12 kn)");
{ const keys = [...L.vin.keys()].sort((a,b)=>a-b), ph = []; let c = null;
  for(const t of keys){ const r = L.vin.get(t), g = S.gre.get(t);
    const ch = S.cha.get(t);
    const ok = r.mean>=3 && inS(r.dir, 0, 80) && !(g && inS(g.dir, 30, 110) && g.mean>=6) && !(ch && inS(ch.dir, 45, 135) && ch.mean>=12);
    if(ok){ if(c && t-c.t1<=1200e3){ c.t1 = t; c.n++; } else { c = {t0:t, t1:t, n:1}; ph.push(c); } } }
  const use = ph.filter(p=>p.n>=3);
  console.log("Phase                    Vingelz  Ipsach   Chasser. Courtel. Cressier Grenchen");
  use.forEach(p=>console.log(`${C.dayOfDate(new Date(p.t0))} ${C.hhmm(new Date(p.t0))}–${C.hhmm(new Date(p.t1))}  `
    + [L.vin, L.ips, S.cha, S.coy, S.crm, S.gre].map(m=>fv(vec(span(m, p.t0, p.t1)))).join(" ")));
  if(!use.length) console.log("keine Phase"); }

/* H-B4: Nordlage-Abende: Nord auf dem Chasseral, still am Jurasüdfuss */
hdr("H-B4 Nordlage-Abende (16–21 Uhr): Chasseral 330–30° ≥ 15 kn, Grenchen und Cressier < 6 kn");
{ let n = 0;
  lakeDays.forEach(day=>{
    const at = m => [...m.values()].filter(r=>C.dayOfDate(r.t ? new Date(r.t) : r.t)===day && C.localHour(new Date(r.t))>=16 && C.localHour(new Date(r.t))<21);
    const ch = vec(at(S.cha)), gr = vec(at(S.gre)), cr = vec(at(S.crm));
    if(!ch || !(inS(ch.d, 330, 30) && ch.s>=15) || !gr || gr.s>=6 || !cr || cr.s>=6) return;
    n++; const iv = at(L.ips), vv = at(L.vin);
    console.log(`${day}  Chasseral ${fv(ch)} Grenchen ${fv(gr)} Cressier ${fv(cr)} Courtelary ${fv(vec(at(S.coy)))} Ipsach ${fv(vec(iv))} (max ${iv.length ? Math.round(Math.max(...iv.map(r=>r.mean))) : "–"}) Vingelz ${fv(vec(vv))}`);
  });
  if(!n) console.log("kein Abend"); }

/* H-B5: Taubenlöchler-Regel (Courtelary talabwärts) – bei welcher Lage schlägt sie an? */
hdr("H-B5 Taubenlöchler-Regel: Courtelary 220–280° ≥ 4 kn, 15–22 Uhr, Chasseral nicht West ≥ 15 kn");
{ const by = {}, days = {}; let n = 0;
  R.coy.forEach(r=>{ if(+r.t<first) return; const hr = C.localHour(r.t), c = S.cha.get(+r.t);
    if(!(r.mean>=4 && inS(r.dir, 220, 280) && hr>=15 && hr<22) || (c && inS(c.dir, 200, 290) && c.mean>=15)) return;
    n++; const k = c ? C.card(c.dir) : "–"; by[k] = (by[k]||0)+1; days[C.dayOfDate(r.t)] = 1; });
  console.log(`${n} Zehnminutenwerte an ${Object.keys(days).length} Tagen. Richtung auf dem Chasseral dabei:`,
    Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join(", ") || "–"); }

/* H-B6: Seewind im Sommer (braucht Seemessung Juni–August) */
hdr("H-B6 Seewind: ruhige, heisse Sommertage (Jun–Aug, Chasseral 10–17 Uhr < 10 kn, Cressier Tmax ≥ 25 °C, Tagesgang ≥ 10 K)");
{ const days = lakeDays.filter(d=>{ const m = +d.slice(5,7); if(m<6 || m>8) return false;
    const ch = vec(R.cha.filter(r=>C.dayOfDate(r.t)===d && C.localHour(r.t)>=10 && C.localHour(r.t)<=17));
    const tc = R.crm.filter(r=>C.dayOfDate(r.t)===d && r.temp!=null).map(r=>r.temp);
    return ch && ch.s<10 && tc.length>100 && Math.max(...tc)>=25 && Math.max(...tc)-Math.min(...tc)>=10; });
  if(!days.length) console.log("noch keine Sommertage im Seearchiv (Archiv ab 15.10.2026). Prüfbar ab Juni 2027.");
  else { console.log(`${days.length} Tage. Stunde: Vingelz, Ipsach, Cressier (Vektormittel)`);
    for(const h of [9,11,13,15,17,19]){ const at = m => [...m.values()].filter(r=>days.includes(C.dayOfDate(new Date(r.t))) && C.localHour(new Date(r.t))===h);
      console.log(String(h).padStart(2), fv(vec(at(L.vin))), fv(vec(at(L.ips))), fv(vec(at(S.crm)))); } } }

/* H-B7: Landwind am Abend: ruhige Abende (19–23 Uhr), See und Landstationen */
hdr("H-B7 Landwind: ruhige Abende 19–23 Uhr (Chasseral < 10 kn, Grenchen und Cressier < 5 kn)");
{ const rows = [];
  lakeDays.forEach(day=>{
    const at = (m, h0, h1) => [...m.values()].filter(r=>{ const t = new Date(r.t); return C.dayOfDate(t)===day && C.localHour(t)>=h0 && C.localHour(t)<h1; });
    const ch = vec(at(S.cha,19,23)), gr = vec(at(S.gre,19,23)), cr = vec(at(S.crm,19,23));
    if(!ch || ch.s>=10 || !gr || gr.s>=5 || !cr || cr.s>=5) return;
    const v = at(L.vin,19,23), i = at(L.ips,19,23); if(v.length<12) return;
    const sh = (a, x, y) => a.filter(r=>r.mean>=2 && inS(r.dir, x, y)).length / a.length;
    rows.push({day, v, i, ch});
    console.log(`${day}  Vingelz ${fv(vec(v))} N–O ${Math.round(100*sh(v,0,100))} %   Ipsach ${fv(vec(i))} N–O ${i.length ? Math.round(100*sh(i,0,100)) : "–"} %   Chasseral ${fv(ch)}`);
  });
  if(!rows.length) console.log("kein ruhiger Abend");
  else { const all = k => rows.flatMap(r=>r[k]); const v = all("v"), i = all("i");
    const sh = (a, x, y) => Math.round(100*a.filter(r=>r.mean>=2 && inS(r.dir, x, y)).length/a.length);
    console.log(`${rows.length} Abende. Anteil der Werte ≥ 2 kn aus N bis O (0–100°): Vingelz ${sh(v,0,100)} %, Ipsach ${sh(i,0,100)} %. Aus S bis W (160–280°): Vingelz ${sh(v,160,280)} %, Ipsach ${sh(i,160,280)} %.`); } }
