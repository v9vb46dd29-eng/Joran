#!/usr/bin/env node
/* Joran — Trennt der Modellwind in der Höhe (850 und 700 hPa) zusammen mit der Schichtung foilbare Abende? (Auswertung)
   Daten: Open-Meteo Historical Forecast, Punkt Seemitte, in eval/data/hoehenwind_<modell>.json (Entwicklungstage 16.10.–5.11.2026).
   Das sind aneinandergereihte jüngste Modellläufe, also kurze Vorlaufzeit; eine echte Vortagesprognose ist etwas schlechter.
   Je Tag: Mittel 14–20 Uhr von Wind 850 hPa, 700 hPa, 10 m und Temperaturabnahme 2 m → 850 hPa (rund 1.07 km über dem See).
   Aufruf: node eval/hoehenwind.cjs [--T 12] [--modell icon_eu|ecmwf_ifs025] */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i>0 ? process.argv[i+1] : d; };
const T = parseFloat(arg("--T", "12")), model = arg("--modell", "icon_eu");
const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
const H = JSON.parse(fs.readFileSync(path.join(__dirname, "data", `hoehenwind_${model}.json`), "utf8")).hourly;
const St = Object.assign(C.merge(C.sanitizeCfg(JSON.parse(fs.readFileSync(path.join(ROOT, "users", "simon.json"), "utf8")))), {T});
const per = M.lakeByDay(M.loadArchive([], true).lk);
const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
const dirMean = (ds) => { let x = 0, y = 0; ds.forEach(d=>{ x += Math.cos(d*Math.PI/180); y += Math.sin(d*Math.PI/180); }); return (Math.atan2(y, x)*180/Math.PI+360)%360; };
const rows = [];
Object.keys(per).sort().forEach(d=>{
  if(d>split.devBis || d<"2026-10-16") return;
  const a = C.lakeDay(per[d], d, St); if(!a.known) return;
  const idx = H.time.map((t,i)=>t.slice(0,10)===d && +t.slice(11,13)>=14 && +t.slice(11,13)<=20 ? i : -1).filter(i=>i>=0);
  const g = k => idx.map(i=>H[k][i]).filter(v=>v!=null);
  const lapse = mean(idx.map(i=>H.temperature_2m[i]!=null && H.temperature_850hPa[i]!=null ? (H.temperature_2m[i]-H.temperature_850hPa[i])/1.07 : null).filter(v=>v!=null));
  rows.push({d, ev:a.ev, mx:Math.max(...C.LAKE.map(L=>a.st[L.id] ? a.st[L.id].max||0 : 0)), w850:mean(g("wind_speed_850hPa")), d850:dirMean(g("wind_direction_850hPa")),
    w700:mean(g("wind_speed_700hPa")), w10:mean(g("wind_speed_10m")), lapse});
});
console.log(`Höhenwind ${model}, Entwicklungstage, Mittel 14–20 Uhr, Schwelle ${T} kn`);
console.log("Tag    foilbar See max | 850 hPa kn Richtung | 700 hPa kn | 10 m kn | K/km 2 m→850 | 850 hPa × gekoppelt");
rows.forEach(r=>console.log(r.d.slice(5), r.ev ? "  JA  " : "  –   ", String(C.r0(r.mx)).padStart(5), "   |", String(C.r0(r.w850)).padStart(6), "  ", C.card(r.d850).padEnd(8), "|", String(C.r0(r.w700)).padStart(6), "    |",
  String(C.r0(r.w10)).padStart(4), "   |", r.lapse.toFixed(1).padStart(6), "      |", r.lapse>=4 ? C.r0(r.w850) : 0));
/* einfache Trennregeln: Abend gemeldet, wenn Merkmal ≥ Grenze. Zeigt je Merkmal die beste Grenze, die keinen Abend verpasst. */
const feats = {"10 m": r=>r.w10, "850 hPa": r=>r.w850, "700 hPa": r=>r.w700, "850 hPa, nur gekoppelt (≥ 4 K/km)": r=>r.lapse>=4 ? r.w850 : 0};
const ev = rows.filter(r=>r.ev), nev = rows.filter(r=>!r.ev);
console.log(`\nTrennung (${ev.length} foilbare, ${nev.length} ruhige Abende): höchste Grenze ohne verpassten Abend und Fehlalarme dabei`);
Object.keys(feats).forEach(k=>{ const f = feats[k], thr = Math.min(...ev.map(f)), fp = nev.filter(r=>f(r)>=thr).length;
  console.log(`  ${k.padEnd(34)} Grenze ${thr.toFixed(1).padStart(5)} kn → Fehlalarme ${fp} von ${nev.length} (FPR ${(fp/nev.length).toFixed(2)})`); });
/* Zeitlich geprüft: Grenze nur aus früheren Tagen (dieselben Blöcke wie eval/measure.cjs), gemessen auf späteren */
const F = M.folds(rows.map(r=>r.d)), by = Object.fromEntries(rows.map(r=>[r.d, r]));
console.log("\nZeitlich geprüft (Grenze aus früheren Tagen, 90 % davon als Sicherheit):");
Object.keys(feats).forEach(k=>{ const f = feats[k]; let tp = 0, e = 0, fp = 0, n = 0, skip = 0;
  F.forEach(fo=>{ const tr = fo.train.map(d=>by[d]).filter(r=>r.ev); if(!tr.length){ skip += fo.test.length; return; }
    const thr = 0.9*Math.min(...tr.map(f));
    fo.test.map(d=>by[d]).forEach(r=>{ const hit = f(r)>=thr && f(r)>0; if(r.ev){ e++; if(hit) tp++; } else { n++; if(hit) fp++; } }); });
  console.log(`  ${k.padEnd(34)} Recall ${e ? (tp/e).toFixed(2) : "–"} (${tp}/${e}), FPR ${n ? (fp/n).toFixed(2) : "–"} (${fp}/${n})${skip ? `, ${skip} Tage ohne Grenze` : ""}`); });
