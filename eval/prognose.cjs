#!/usr/bin/env node
/* Joran — Prognose-Stufe der App nachspielen (Auswertung). Für jeden Entwicklungstag: Hätte die Prognose mit 24 h Vorlauf
   (Open-Meteo Previous Runs, wie der Rückblick der App) den Abend angekündigt? Kriterium wie push/check.cjs:
   core.summarize(...).level ≥ cut aus den Einstellungen. Speichert die Archivprognosen in eval/data/prognose_vortag.json.
   Aufruf: node eval/prognose.cjs [--T 12] [--bise 0.8] [--offline] */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i>0 ? process.argv[i+1] : d; };
const T = parseFloat(arg("--T", "12")), offline = process.argv.includes("--offline");
const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
const file = path.join(__dirname, "data", "prognose_vortag.json");
(async()=>{
  let D = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  if(!D && !offline){
    D = {geholt:new Date().toISOString(), models:[]};
    const days = Math.min(92, Math.ceil((Date.now()-Date.parse("2026-10-15T00:00:00Z"))/864e5)+1);
    for(const m of C.MODELS){ try{ D.models.push({id:m.id, spots:await C.fetchHistory(m, days)}); }catch(e){ console.error(`${m.id}: ${e.message||e}`); } }
    if(D.models.length){ fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, JSON.stringify(D)); } else D = null;
  }
  if(!D){ console.log("Keine Archivprognosen verfügbar."); process.exitCode = 1; return; }
  const St = Object.assign(C.merge(C.sanitizeCfg(JSON.parse(fs.readFileSync(path.join(ROOT, "users", "simon.json"), "utf8")))), {T});
  /* --bise 0.8: Korrekturfaktor der App für Bise (Einstellung kDir.bise) probeweise setzen */
  const kb = parseFloat(arg("--bise", "")); if(kb>0) St.kDir = Object.assign({}, St.kDir, {bise:kb});
  const per = M.lakeByDay(M.loadArchive([], true).lk);
  const ms = Object.fromEntries(D.models.map(x=>[x.id, x.spots]));
  let ev = 0, tp = 0, nev = 0, fp = 0; const out = [];
  Object.keys(per).sort().forEach(d=>{
    if(d>split.devBis || d<"2026-10-16") return;
    const a = C.lakeDay(per[d], d, St); if(!a.known) return;
    let s = null; try{ s = C.summarize(ms, d, St); }catch(e){}
    if(!s || s.level==null){ out.push(`${d.slice(5)} ${a.ev?"JA":"–"} keine Prognose`); return; }
    const alarm = s.level>=St.cut;
    if(a.ev){ ev++; if(alarm) tp++; } else { nev++; if(alarm) fp++; }
    out.push(`${d.slice(5)} ${a.ev?"JA":"– "} Stufe ${s.level}${alarm?" Alarm":""}`);
  });
  console.log(`Prognose-Stufe (24 h Vorlauf, Modelle ${Object.keys(ms).join(", ")}), Schwelle ${T} kn, Alarm ab Stufe ${St.cut}`);
  console.log(`Recall ${ev ? (tp/ev).toFixed(2) : "–"} (${tp}/${ev}), FPR ${nev ? (fp/nev).toFixed(2) : "–"} (${fp}/${nev})`);
  console.log(out.join("; "));
})();
