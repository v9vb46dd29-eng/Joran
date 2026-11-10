#!/usr/bin/env node
/* Joran — Lagebild der Bieler Bucht nach Luftschichten (Auswertung, kein Modell).
   Fragt: Wie reagieren Vingelz und Ipsach, je nachdem woher und wie stark es auf Kammhöhe (Chasseral, 1594 m) und am
   Jurasüdfuss (Cressier/Grenchen, rund 430 m) weht, und ob die Schichten gekoppelt sind (Temperaturabnahme mit der Höhe)?
   Nutzt nur die Entwicklungstage (eval/split.json), 10-min-Werte von 8 bis 22 Uhr, Cache aus eval/measure.cjs.
   Aufruf: node eval/schichten.cjs [--T 12] */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
const T = (()=>{ const i = process.argv.indexOf("--T"); return i>0 ? parseFloat(process.argv[i+1]) : 12; })();
const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
const {lk} = M.loadArchive([], true);
const grid = t => Math.round(+new Date(t)/600e3)*600e3;
const from = Date.parse("2026-10-15T00:00:00Z");
const S = {};
["cha","chm","cdf","crm","neu","gre","coy"].forEach(a=>{ const m = new Map();
  JSON.parse(fs.readFileSync(path.join(__dirname, "cache", a+".t.json"), "utf8")).forEach(r=>{ const t = +new Date(r.t); if(t>=from) m.set(t, r); }); S[a] = m; });
const L = {}; C.LAKE.forEach(x=>{ const m = new Map(); lk.st[x.id].rows.forEach(r=>m.set(grid(r.t), r)); L[x.id] = m; });
const sec8 = d => d==null ? null : ["N","NO","O","SO","S","SW","W","NW"][Math.round(d/45)%8];
const med = a => { if(!a.length) return null; const s = [...a].sort((x,y)=>x-y); return s[s.length>>1]; };
const mode = a => { const n = {}; a.forEach(x=>{ if(x) n[x] = (n[x]||0)+1; }); const k = Object.keys(n).sort((x,y)=>n[y]-n[x])[0]; return k ? `${k} ${Math.round(100*n[k]/a.length)}%` : "–"; };
const rows = [];
for(const [t, c] of S.cha){
  const dt = new Date(t), day = C.dayOfDate(dt); if(day>split.devBis || day<"2026-10-16") continue;
  const hr = C.localHour(dt); if(hr<8 || hr>=22) continue;
  const i = L.ips.get(t), v = L.vin.get(t), f = S.crm.get(t), g = S.gre.get(t); if(!i || !v || !f) continue;
  /* Temperaturabnahme Cressier (431 m) → Chasseral (1594 m) in K je km: unter 4 = stabil (Schichten entkoppelt) */
  const lapse = c.temp!=null && f.temp!=null ? (f.temp-c.temp)/1.163 : null;
  rows.push({day, hr, cha:c, crm:f, gre:g, chm:S.chm.get(t), coy:S.coy.get(t), ips:i, vin:v, lapse});
}
const reg = r => r.cha.mean<10 ? "Kamm schwach (<10 kn)" : "Kamm "+sec8(r.cha.dir);
const groups = {}; rows.forEach(r=>{ (groups[reg(r)] || (groups[reg(r)] = [])).push(r); });
const f1 = v => v==null ? "  –" : v.toFixed(1).padStart(5), pct = (a,fn) => a.length ? String(Math.round(100*a.filter(fn).length/a.length)).padStart(3)+"%" : "  –";
console.log(`Lagebild nach Schichten — Entwicklungstage 16.10.–${split.devBis}, 8–22 Uhr, ${rows.length} Zehnminutenwerte, Schwelle ${T} kn`);
console.log("Lage (Chasseral)        Schichtung     n Tage | Kamm kn | Fuss kn (Cressier, Richtung) | Ipsach kn  ≥T  Richtung | Vingelz kn  ≥T  Richtung | Ips/Kamm Ips/Fuss Vin/Ips");
Object.keys(groups).sort().forEach(k=>{
  [["gemischt (≥4 K/km)", r=>r.lapse!=null && r.lapse>=4], ["stabil (<4 K/km)", r=>r.lapse!=null && r.lapse<4]].forEach(([name, fn])=>{
    const a = groups[k].filter(fn); if(a.length<12) return;
    const days = new Set(a.map(r=>r.day)).size;
    const mi = med(a.map(r=>r.ips.mean)), mv = med(a.map(r=>r.vin.mean)), mc = med(a.map(r=>r.cha.mean)), mf = med(a.map(r=>r.crm.mean));
    console.log(k.padEnd(23), name.padEnd(19), String(a.length).padStart(4), String(days).padStart(3), "|", f1(mc), "  |", f1(mf), mode(a.map(r=>sec8(r.crm.dir))).padEnd(8), "            |",
      f1(mi), pct(a, r=>Math.round(r.ips.mean)>=T), mode(a.map(r=>sec8(r.ips.dir))).padEnd(8), "|", f1(mv), pct(a, r=>Math.round(r.vin.mean)>=T), mode(a.map(r=>sec8(r.vin.dir))).padEnd(8), "|",
      f1(mc ? mi/mc : null), f1(mf ? mi/mf : null), f1(mi ? mv/mi : null));
  });
});
/* Wenn es an Ipsach foilbar weht: Was messen die Schichten in den 60 min davor? */
console.log(`\nIpsach ≥ ${T} kn (Zehnminutenwerte) nach Richtung am See: Schichten zur selben Zeit`);
console.log("See-Richtung   n Tage | Ipsach Vingelz | Kamm kn Richtung | Chaumont kn | Fuss Cressier kn Richtung | Grenchen kn Richtung | Courtelary kn Richtung | K/km");
const w = rows.filter(r=>Math.round(r.ips.mean)>=T), by = {};
w.forEach(r=>{ const k = sec8(r.ips.dir); (by[k] || (by[k] = [])).push(r); });
Object.keys(by).sort((a,b)=>by[b].length-by[a].length).forEach(k=>{ const a = by[k]; if(a.length<6) return;
  const m = (fn) => f1(med(a.map(fn).filter(x=>x!=null)));
  console.log(k.padEnd(12), String(a.length).padStart(4), String(new Set(a.map(r=>r.day)).size).padStart(3), "|", m(r=>r.ips.mean), m(r=>r.vin.mean), "  |", m(r=>r.cha.mean), mode(a.map(r=>sec8(r.cha.dir))).padEnd(8), "|",
    m(r=>r.chm && r.chm.mean), "     |", m(r=>r.crm.mean), mode(a.map(r=>sec8(r.crm.dir))).padEnd(8), "       |", m(r=>r.gre && r.gre.mean), mode(a.map(r=>r.gre && sec8(r.gre.dir))).padEnd(8), "  |",
    m(r=>r.coy && r.coy.mean), mode(a.map(r=>r.coy && sec8(r.coy.dir))).padEnd(8), "    |", m(r=>r.lapse)); });
