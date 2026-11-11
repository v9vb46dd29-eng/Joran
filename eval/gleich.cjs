#!/usr/bin/env node
/* Joran — Gleichheitsprüfung: Rechnet dieser Stand des Rechenkerns gleich wie ein früherer?
   Sicherheitsnetz für Umbauten, die das Verhalten nicht ändern sollen (Dateien aufteilen, umbenennen, aufräumen).
   1. Öffentliche Namen: dieselbe Liste, derselbe Quelltext je Funktion, dieselben Werte je Konstante.
   2. Verhalten: Live-Signal, Seemessung, Prognose-Stufe, Höhenwind, Einstellungen und fitModel auf den echten Daten der
      Entwicklungstage (10-min-Schritte, mehrere Einstellungen), Ergebnis für Ergebnis verglichen.
   Aufruf: node eval/gleich.cjs [--alt REV] [--voll] [--erlaubt name,name]
     --alt REV      Vergleichsstand (Standard: origin/main; auf main selbst einen früheren Stand angeben)
     --voll         alle Einstellungsvarianten (dauert einige Minuten); sonst drei
     --erlaubt …    öffentliche Namen, deren Quelltext sich mit Absicht geändert hat. Sie fallen nur aus dem
                    Quelltextvergleich; rechnen sie anders, meldet der Verhaltensteil das weiterhin.
   Grenzen: Innere Helfer werden nur über ihr Verhalten erfasst, nicht über ihren Quelltext. Nicht aufgerufen werden der
   Datenabruf samt Parsern, joranCheck, ensShare, calibrate und joranType. Die Daten enthalten bisher nur West und Bise,
   Joran-Zweige werden kaum erreicht. Wer dort umbaut, prüft zusätzlich von Hand.
   Braucht den Cache aus eval/measure.cjs und das Archiv (git fetch origin live). Der Holdout wird nicht gelesen.
   Ende mit Fehlercode 1, sobald etwas abweicht. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i>0 ? process.argv[i+1] : d; };
const rev = arg("--alt", "origin/main"), voll = process.argv.includes("--voll"), erlaubt = new Set(arg("--erlaubt", "").split(",").filter(Boolean));

const M = require("./measure.cjs"), O = M.coreAt(rev), N = require(path.join(ROOT, "core.js"));

const J = x => JSON.stringify(x, (k,v)=>v===undefined ? "__undef" : typeof v==="function" ? v.toString() : v);
const cnt = {}, bump = (k, eq, info) => { const c = cnt[k] || (cnt[k] = {n:0, diff:0, ex:[]}); c.n++; if(!eq){ c.diff++; if(c.ex.length<3 && info) c.ex.push(info); } };

/* ---------- 1. öffentliche Namen ---------- */
const kO = Object.keys(O), kN = Object.keys(N);
const fehlt = kO.filter(k=>!(k in N)), neu = kN.filter(k=>!(k in O)).filter(k=>!erlaubt.has(k));
const anders = kN.filter(k=>k in O && !erlaubt.has(k) && (typeof N[k]==="function" ? String(O[k])!==String(N[k]) : J(O[k])!==J(N[k])));
console.log(`Vergleich: ${rev} gegen diesen Stand`);
console.log(`Öffentliche Namen: alt ${kO.length}, neu ${kN.length}; fehlen ${fehlt.length}${fehlt.length?" ("+fehlt.join(", ")+")":""}, neu ${neu.length}${neu.length?" ("+neu.join(", ")+")":""}, anderer Quelltext oder Wert ${anders.length}${anders.length?" ("+anders.join(", ")+")":""}`);
if(erlaubt.size) console.log(`Mit Absicht geändert und nicht verglichen: ${[...erlaubt].join(", ")}`);

/* ---------- 2. Verhalten auf echten Daten ---------- */
const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
const St0 = N.merge(N.sanitizeCfg(JSON.parse(fs.readFileSync(path.join(ROOT, "users", "simon.json"), "utf8"))));
const {lk} = M.loadArchive([], true), per = M.lakeByDay(lk);
const days = Object.keys(per).sort().filter(d=>d<=split.devBis);
const tEnd = Date.parse(split.devBis+"T22:50:00Z");
const S = {};
N.UPWIND.forEach(u=>{ const f = path.join(__dirname, "cache", u.abk+".t.json");
  if(fs.existsSync(f)) S[u.abk] = JSON.parse(fs.readFileSync(f, "utf8")).map(r=>Object.assign({}, r, {t:new Date(r.t)})).filter(r=>r.mean!=null && +r.t<=tEnd); });
if(!days.length || !Object.keys(S).length){ console.log("Keine Daten: zuerst git fetch origin live und node eval/measure.cjs --T 12 laufen lassen."); process.exit(1); }
const lastIdx = (rows, t) => { let lo = 0, hi = rows.length-1, k = -1; while(lo<=hi){ const m = (lo+hi)>>1; if(rows[m].t<=t){ k = m; lo = m+1; } else hi = m-1; } return k; };
const lakeMs = {}; N.LAKE.forEach(L=>lakeMs[L.id] = ((lk.st[L.id]||{}).rows||[]).map(r=>({ms:Date.parse(r.t), r})).sort((a,b)=>a.ms-b.ms));
const V = [{name:"T12", St:Object.assign({}, St0, {T:12})}, {name:"T14", St:Object.assign({}, St0, {T:14})},
  {name:"eigene Stationsschwellen", St:Object.assign({}, St0, {st:{crm:{ts:9, pss:0.3}, cha:{rel:0}, gre:{pss:0.1}, neu:{rel:1}}})}];
if(voll) [10, 16, 20].forEach(T=>V.push({name:"T"+T, St:Object.assign({}, St0, {T})}),
  V.push({name:"Nachmittag ohne West", St:Object.assign({}, St0, {win:Object.keys(N.WINS).find(w=>w!==St0.win) || St0.win, dirs:Object.assign({}, St0.dirs, {w:0})})},
    {name:"tiefe Sturmgrenzen", St:Object.assign({}, St0, {maxGust:20, maxMean:15})}));
/* Modell zugeschaltet, damit auch die inaktiven Zweige (Modell v2, H3, H4) verglichen werden */
const withModel = (K, St) => K.MODEL ? Object.assign({}, St, {model:Object.assign({}, K.MODEL, {active:true})}) : St;
const t0 = Date.parse(days[0]+"T00:00:00Z");
for(const v of V){
  for(const [tag, StO, StN] of [["", v.St, v.St], [" mit Modell", withModel(O, v.St), withModel(N, v.St)]]){
    for(let ms=t0; ms<=tEnd; ms+=600e3){
      const t = new Date(ms), stn = {};
      N.UPWIND.forEach(up=>{ const rows = S[up.abk]; if(!rows) return; const i = lastIdx(rows, t); if(i>=0) stn[up.abk] = {rows:rows.slice(Math.max(0,i-8), i+1), at:t}; });
      const lkT = {st:Object.fromEntries(N.LAKE.map(L=>[L.id, {rows:lakeMs[L.id].filter(x=>x.ms<=ms && x.ms>ms-3*3600e3).map(x=>x.r)}]))};
      const a = O.nowcast(stn, StO, t, null), b = N.nowcast(stn, StN, t, null);
      bump("nowcast"+tag, J(a)===J(b), v.name+" "+t.toISOString());
      bump("nowcast mit Seemessung"+tag, J(O.nowcast(stn, StO, t, lkT))===J(N.nowcast(stn, StN, t, lkT)), v.name+" "+t.toISOString());
      if(tag) continue;
      bump("lageHint", O.lageHint(a, O.lakeNow(lkT, StO, t, a.upSys))===N.lageHint(b, N.lakeNow(lkT, StN, t, b.upSys)), v.name+" "+t.toISOString());
      bump("lakeNow", J(O.lakeNow(lkT, StO, t, a.upSys))===J(N.lakeNow(lkT, StN, t, b.upSys)), v.name+" "+t.toISOString());
      if(O.lakeStorm.length>=3 && N.lakeStorm.length>=3) bump("lakeStorm", J(O.lakeStorm(lkT, StO, t))===J(N.lakeStorm(lkT, StN, t)), v.name+" "+t.toISOString());
      const ch = stn.cha ? stn.cha.rows : null;
      N.UPWIND.forEach((up,i)=>{ const d = stn[up.abk], uo = O.UPWIND[i]; if(!d || !uo) return;
        const x = O.upwindNow(d.rows, uo, StO, ch), y = N.upwindNow(d.rows, up, StN, ch);
        bump("upwindNow", J(x)===J(y), v.name+" "+up.abk+" "+t.toISOString());
        bump("isTrusted", O.isTrusted({up:uo, u:x})===N.isTrusted({up, u:y}) && O.isTrusted({up:uo, u:x}, "recall")===N.isTrusted({up, u:y}, "recall"), up.abk);
        bump("frontCheck, ruleE", J(O.frontCheck(d.rows, StO))===J(N.frontCheck(d.rows, StN)) && J(O.ruleE(d.rows, StO))===J(N.ruleE(d.rows, StN)), up.abk); });
    }
  }
}
const rd = f => { const q = path.join(__dirname, "data", f); return fs.existsSync(q) ? JSON.parse(fs.readFileSync(q, "utf8")) : null; };
const pv = rd("prognose_vortag.json"), hw = rd("hoehenwind_icon_eu.json");
const models = pv ? Object.fromEntries(pv.models.map(x=>[x.id, x.spots])) : null;
for(const v of V) days.forEach(d=>{
  bump("lakeDay", J(O.lakeDay(per[d], d, v.St))===J(N.lakeDay(per[d], d, v.St)), v.name+" "+d);
  if(models){ const a = O.summarize(models, d, v.St), b = N.summarize(models, d, v.St);
    bump("summarize, describe", J(a)===J(b) && O.describe(a, v.St)===N.describe(b, v.St) && O.clsOf(a.level, v.St)===N.clsOf(b.level, v.St), v.name+" "+d);
    Object.keys(models).forEach(m=>bump("evalDay", J(O.evalDay(models[m], d, v.St))===J(N.evalDay(models[m], d, v.St)), m+" "+d)); }
  if(hw){ const a = O.hoeheDay(hw.hourly, d, v.St), b = N.hoeheDay(hw.hourly, d, v.St);
    bump("hoeheDay, hoeheOk", J(a)===J(b) && O.hoeheOk(a, v.St)===N.hoeheOk(b, v.St) && O.hoeheOk(a, withModel(O, v.St))===N.hoeheOk(b, withModel(N, v.St)), v.name+" "+d); }
});
bump("sanitizeCfg, pushCfg, merge", J(O.sanitizeCfg(St0))===J(N.sanitizeCfg(St0)) && J(O.pushCfg(St0))===J(N.pushCfg(St0)) && J(O.merge({T:13}))===J(N.merge({T:13})), "");
{ const data = {days, lake:per, S, St:St0, hoehe:hw ? hw.hourly : null};
  bump("fitModel", J(O.fitModel(data))===J(N.fitModel(data)), "je Block bestimmt");
  bump("fitModel", J(O.fitModel(data, {fest:true}))===J(N.fitModel(data, {fest:true})), "fest");
  bump("calibrateStation", N.UPWIND.every((up,i)=>!S[up.abk] || J(O.calibrateStation(S[up.abk], O.UPWIND[i], St0, days, Object.fromEntries(days.map((d,k)=>[d, k%3 ? "n" : "y"])), S.cha))
    ===J(N.calibrateStation(S[up.abk], up, St0, days, Object.fromEntries(days.map((d,k)=>[d, k%3 ? "n" : "y"])), S.cha))), ""); }

let tot = 0, td = 0;
console.log(`\nVerhalten auf ${days.length} Entwicklungstagen (${days[0]} bis ${days[days.length-1]}), ${V.length} Einstellungen:`);
Object.keys(cnt).forEach(k=>{ tot += cnt[k].n; td += cnt[k].diff; console.log("  "+k.padEnd(30), String(cnt[k].n).padStart(8), " Abweichungen", cnt[k].diff, cnt[k].ex.length ? " z. B. "+cnt[k].ex.join(" | ") : ""); });
const bad = fehlt.length + neu.length + anders.length + td;
console.log(`\n${tot} Vergleiche, ${td} Abweichungen. ${bad ? "NICHT GLEICH" : "Gleich: Dieser Stand rechnet wie "+rev+"."}`);
process.exitCode = bad ? 1 : 0;
