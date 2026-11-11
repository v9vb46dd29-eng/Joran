#!/usr/bin/env node
/* Joran — Wie alt ist der jüngste SwissMetNet-Wert, den die Action bei einem Lauf sieht? (Auswertung)
   Vergleicht die echten Zeiten der Push-Nachricht «Wind kommt — Messung» (push/state.json über die Git-Geschichte) mit dem
   Nachspielen der Baseline bei verschiedenem Lieferverzug. Der Verzug mit den meisten Treffern auf 10 min genau ist der
   Standard von eval/measure.cjs (VERZUG). Die App lief in dieser Zeit in mehreren Versionen; einzelne Tage weichen deshalb
   bei jedem Verzug ab.
   Aufruf: node eval/verzug.cjs [--user simon] [--offline]
   Braucht die Geschichte von main (git fetch --depth=400 origin main) und den Cache aus eval/measure.cjs. */
"use strict";
const fs = require("fs"), path = require("path"), {execFileSync} = require("child_process");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i>0 ? process.argv[i+1] : d; };
const user = arg("--user", "simon");
const git = a => execFileSync("git", a, {cwd:ROOT, encoding:"utf8", stdio:["ignore","pipe","ignore"], maxBuffer:64<<20});

/* echte Push-Zeiten: frühester Eintrag «live:Tag» über alle Stände von push/state.json */
const real = {};
git(["log", "--format=%H", "--", "push/state.json"]).split("\n").filter(Boolean).forEach(h=>{
  let s; try{ s = JSON.parse(git(["show", h+":push/state.json"])); }catch(e){ return; }
  Object.keys((s && s.sent) || {}).forEach(k=>{ const m = k.match(/^(.+)\|live:(\d{4}-\d{2}-\d{2})$/); if(!m || m[1]!==user) return;
    const at = new Date(s.sent[k].at); if(!real[m[2]] || at<real[m[2]]) real[m[2]] = at; });
});
const days = Object.keys(real).sort();
if(!days.length){ console.log("Keine Push-Zeiten in der Git-Geschichte gefunden (git fetch --depth=400 origin main)."); process.exit(0); }

let K = C; try{ const f = path.join(require("os").tmpdir(), "joran-basis-core.js"); fs.writeFileSync(f, git(["show", "origin/baseline-2026-11-10:core.js"])); K = require(f); }catch(e){}
const St = C.merge(C.sanitizeCfg(JSON.parse(fs.readFileSync(path.join(ROOT, "users", user+".json"), "utf8"))));
const per = M.lakeByDay(M.loadArchive([], true).lk);
const S = {};
K.UPWIND.forEach(u=>{ const f = path.join(__dirname, "cache", u.abk+".t.json");
  if(fs.existsSync(f)) S[u.abk] = JSON.parse(fs.readFileSync(f, "utf8")).map(r=>Object.assign({}, r, {t:new Date(r.t)})).filter(r=>r.mean!=null); });
if(!Object.keys(S).length){ console.log("Kein Cache: zuerst node eval/measure.cjs --T 12 laufen lassen."); process.exit(0); }

const LAGS = [0, 10, 20, 30, 40], step = t => Math.floor(t/600e3)*600e3;
console.log(`Echte Push-Zeiten «Wind kommt» (${user}) gegen das Nachspielen der Baseline, ${days.length} Tage`);
console.log("Tag     echt   | " + LAGS.map(l=>("Verzug "+l).padStart(9)).join(" | "));
const hit = LAGS.map(()=>0), err = LAGS.map(()=>[]);
days.forEach(d=>{
  const cells = LAGS.map((lag,i)=>{ const R = M.replay(K, S, St, d, {verzug:lag, lake:per[d]||null});
    if(!R.push) return "kein Push".padStart(9);
    const diff = (+R.push - step(+real[d]))/60000; if(diff===0) hit[i]++; err[i].push(Math.abs(diff));
    return (C.hhmm(R.push)+(diff===0 ? " ="  : (diff>0?" +":" ")+diff)).padStart(9); });
  console.log(d.slice(5), " ", C.hhmm(real[d]), " | " + cells.join(" | "));
});
const med = a => { const s = a.slice().sort((x,y)=>x-y); return s.length ? s[s.length>>1] : null; };
console.log("\nVerzug   Treffer (auf 10 min)   mittlere Abweichung   Median");
LAGS.forEach((l,i)=>console.log(String(l).padStart(4)+" min", String(hit[i]+" von "+days.length).padStart(14), String(err[i].length ? Math.round(err[i].reduce((a,b)=>a+b,0)/err[i].length)+" min" : "–").padStart(20), String(med(err[i])!=null ? med(err[i])+" min" : "–").padStart(12)));
const best = LAGS[hit.indexOf(Math.max(...hit))];
console.log(`\nMeiste Treffer bei ${best} min. Standard in eval/measure.cjs: ${M.VERZUG} min.`);
