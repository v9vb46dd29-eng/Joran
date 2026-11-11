#!/usr/bin/env node
/* Joran — Selbsttest des Messskripts und des Modells v2 mit synthetischen Daten (ohne Netz, ohne Archiv).
   Aufruf: node eval/selftest.cjs
   1. Modell nicht aktiv: upwindNow und isTrusted verhalten sich wie in der Baseline (falls sie per Git erreichbar ist).
   2. Synthetische Lage: An Windtagen misst Cressier aus West die Hälfte des Seewinds, eine Stunde früher. fitModel muss den höchsten
      Faktor finden, der bei allen Schwellen des Rasters noch alle Abende erkennt, die Messung Recall 1 und FPR 0 ergeben; ein zu hoher Startwert verpasst die Abende. */
"use strict";
const path = require("path"), os = require("os"), fs = require("fs"), {execFileSync} = require("child_process");
const ROOT = path.join(__dirname, "..");
const C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
let fail = 0;
const ok = (name, cond, info) => { console.log(`${cond ? "ok  " : "FEHL"} ${name}${info ? " — "+info : ""}`); if(!cond) fail++; };

/* ---------- synthetische Daten ---------- */
const St = C.merge({T:12, win:"abend", minH:1});
const days = []; for(let i=1; i<=20; i++) days.push(`2026-06-${String(i).padStart(2,"0")}`);
const windy = new Set(days.filter((d,i)=>i%4===1));                     /* 5 Windtage */
const lake = {}, S = {crm:[], cha:[]};
let seed = 7; const rnd = () => (seed = (seed*16807)%2147483647)/2147483647;
days.forEach(d=>{
  const t0 = Date.parse(d+"T00:00:00Z"), o = {day:d, st:{vin:{rows:[]}, ips:{rows:[]}}};
  for(let m=10*60; m<=20*60; m+=10){                                     /* 12–22 Uhr MESZ */
    const t = new Date(t0+m*60000), hrL = m/60+2;
    const w = windy.has(d) && hrL>=16.5 && hrL<=19.5 ? 18 : 3+rnd();     /* See: 18 kn von 16:30 bis 19:30 */
    const u = windy.has(d) && hrL>=15.5 && hrL<=19.5 ? 9+rnd()*0.4 : 2+rnd();   /* Cressier: 9 kn West ab 15:30 */
    o.st.ips.rows.push({t:t.toISOString(), mean:w, dir:250, gust:w+3});
    o.st.vin.rows.push({t:t.toISOString(), mean:w*0.5, dir:250, gust:w});
    S.crm.push({t, mean:u, dir:250, gust:u+2, temp:20, qff:1015});
    S.cha.push({t, mean:5, dir:180, gust:7, temp:10, qff:1015});
  }
  lake[d] = o;
});

/* ---------- 1. Modell nicht aktiv = Baseline ---------- */
let B = null;
for(const ref of ["origin/baseline-2026-11-10", "baseline-2026-11-10"]){
  try{ const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "joran-base-")), "core.js");
    fs.writeFileSync(f, execFileSync("git", ["show", ref+":core.js"], {cwd:ROOT, encoding:"utf8", stdio:["ignore","pipe","ignore"]})); B = require(f); break; }catch(e){}
}
if(B){
  let diff = 0, n = 0;
  C.UPWIND.forEach(up=>{ const ub = B.UPWIND.find(x=>x.abk===up.abk); if(!ub) return;
    for(let i=5; i<S.crm.length; i+=3){ const rows = S.crm.slice(i-5, i+1).map(r=>Object.assign({}, r, {dir:(r.dir+i*7)%360, mean:r.mean*(1+i%5)}));
      const a = C.upwindNow(rows, up, St, null), b = B.upwindNow(rows, ub, St, null); n++;
      if(a.ok!==b.ok || a.ts!==b.ts || C.isTrusted({up, u:a})!==B.isTrusted({up:ub, u:b})) diff++; } });
  ok("Modell nicht aktiv: Signale wie Baseline", diff===0, `${n} Vergleiche, ${diff} Abweichungen`);
} else console.log("—    Baseline per Git nicht erreichbar, Vergleich übersprungen");
ok("MODEL.active ist false (App rechnet wie bisher)", C.MODEL.active===false);

/* ---------- 2. fitModel und Messung ---------- */
const Mo = C.fitModel({days, lake, S, St});
const e = Mo.f.crm && Mo.f.crm.w;
ok("fitModel findet Cressier/West", !!e, e ? JSON.stringify(e) : "kein Eintrag");
/* Station misst 9 kn, höchste Schwelle im Raster 14 kn: 9/14 = 0.64, davon 90 % Sicherheit */
ok("Faktor rund 0.6 und verlässlich", !!e && e.f>=0.5 && e.f<=0.65 && e.rel===1 && e.rec===1 && e.fpr===0);
ok("Schwelle folgt T", !!e && C.stTs(C.UPWIND[0], Object.assign({}, St, {T:20, model:Mo}), "w")===Math.round(20*e.f));
const T = M.buildTruth(lake, days, St, null, S);
ok("Wahrheit: 5 foilbare, 15 ruhige Abende", Object.values(T.see).filter(x=>x.v==="y").length===5 && Object.values(T.see).filter(x=>x.v==="n").length===15);
ok("Wahrheit je Seestation: Ipsach 5, Vingelz 0", Object.values(T.st.ips).filter(x=>x.v==="y").length===5 && Object.values(T.st.vin).filter(x=>x.v==="y").length===0);
const base = M.score(C, S, St, T, days, null), neu = M.score(C, S, St, T, days, () => Mo);
ok("Startwert (10 kn) verpasst die Abende", base.lake.see.rec===0 && base.lake.see.fpr===0, `Recall ${base.lake.see.rec}`);
ok("Modell v2 erkennt alle, ohne Fehlalarm", neu.lake.see.rec===1 && neu.lake.see.fpr===0 && neu.lake.ips.rec===1, `Recall ${neu.lake.see.rec}, FPR ${neu.lake.see.fpr}`);
ok("Vorlaufzeit rund 30–60 min", neu.lake.see.lead>=20 && neu.lake.see.lead<=70, `${Math.round(neu.lake.see.lead)} min`);
ok("Zelle Cressier/West: Recall 1", neu.up.crm.cells.w.rec===1 && neu.up.crm.cells.w.ev===5);
/* ---------- 3. Kopplung der Schichten (H3) ---------- */
{
  const now = new Date("2026-06-10T15:00:00Z"), mk = (mean, dir, temp) => [20,10,0].map(m=>({t:new Date(now-m*60000), mean, dir, gust:mean+3, temp, qff:1015}));
  const st = (tCha, tCrm) => ({cha:{rows:mk(20, 320, tCha)}, crm:{rows:mk(2, 90, tCrm)}});
  const Sm = Object.assign({}, St, {model:C.fitModel({days:[], lake:{}, S:{}, St})});
  const sig = (stn, S2) => C.nowcast(stn, S2, now, null).sig.some(x=>x.up.abk==="cha");
  ok("Kopplung: durchmischt (8.6 K/km) → Chasseral-Signal zählt", sig(st(8, 18), Sm));
  ok("Kopplung: stabil (1.7 K/km) → Chasseral-Signal gesperrt", !sig(st(16, 18), Sm));
  ok("Kopplung: Temperatur fehlt → Signal zählt", sig(st(null, 18), Sm));
  ok("Kopplung: Modell nicht aktiv → Signal zählt wie bisher", sig(st(16, 18), St));
}
/* ---------- 4. Archiv, Höhenwind (H4) und Prognose-Stufe ---------- */
{
  const page = `<b>11.11.2026 (CET) 10:39</b> Wind-10min-Ø: 8.3km/h (4.5kn, 2Bf) SW Wind-10min-Max: 10.4km/h (5.6kn, 2Bf) SW Gust-Factor (GF): 1.6 / Richtungstreue: 98&#037; Wassertemperatur: 11.0&deg;C`;
  const r = C.parseMeteobase(page);
  ok("Seemessung: Richtungstreue wird gelesen (auch als &#037;)", r.steady===98 && r.mean===4.5, `steady ${r.steady}`);
  ok("Seemessung: Richtungstreue mit %-Zeichen", C.parseMeteobase(page.replace("&#037;", "%")).steady===98);
  const time = [], w = [], d = [], t8 = [], t2 = [];
  for(let h=0; h<24; h++){ time.push(`2026-06-10T${String(h).padStart(2,"0")}:00`); w.push(20); d.push(250); t8.push(10); t2.push(18); }
  const H = {time, wind_speed_850hPa:w, wind_direction_850hPa:d, temperature_850hPa:t8, temperature_2m:t2};
  const hd = C.hoeheDay(H, "2026-06-10", St), Sm = Object.assign({}, St, {model:{hoehe:C.MODEL.hoehe}});
  ok("Höhenwind: Tagesmittel, Richtung und Kopplung", !!hd && Math.round(hd.v)===20 && Math.round(hd.d)===250 && hd.coupled===true, hd ? `${hd.v} kn, ${hd.lapse.toFixed(1)} K/km` : "null");
  ok("H4 nicht aktiv: Prognose zählt immer", C.hoeheOk(Object.assign({}, hd, {coupled:false}), St)===true);
  ok("H4 aktiv: durchmischt und stark genug zählt, stabil oder zu schwach nicht",
    C.hoeheOk(hd, Sm) && !C.hoeheOk(Object.assign({}, hd, {coupled:false}), Sm) && !C.hoeheOk(Object.assign({}, hd, {v:10}), Sm));
  ok("H4: fehlende Höhendaten sperren nichts", C.hoeheOk(null, Sm)===true);
  const part = C.hoeheDay({time, wind_speed_850hPa:w}, "2026-06-10", St);
  ok("Höhenwind: fehlende Felder brechen nichts", !!part && part.d===null && part.coupled===null && C.hoeheOk(part, Sm)===true);
  ok("Prognose-Stufe ohne Archivprognosen: nicht gemessen", M.forecastStage(C, St, T, days, null)===null);
}
const F = M.folds(days);
ok("Kreuzvalidierung: Blöcke zeitlich nach dem Trainingsteil", F.length===3 && F.every(f=>f.train[f.train.length-1] < f.test[0]));
const R = M.measureAll({per:lake, S, marks:{"2026-06-01":"y"}, St, ctl:14, cores:{basis:{K:C}, neu:{K:C}}, split:{devBis:"2026-06-16", holdoutBis:"2026-06-20"}, teil:"dev"});
ok("Markierung überstimmt und wird ausgewiesen", R.main.neu.truth.dev.length===1 && R.main.neu.truth.see["2026-06-01"].v==="y");
ok("Holdout bleibt im Entwicklungslauf ungelesen", !Object.keys(R.main.neu.truth.see).some(d=>d>"2026-06-16"));
ok("Zu wenige Ereignistage → vorläufig", /VORLÄUFIG/.test(R.verdict));

console.log(fail ? `\n${fail} Test(s) fehlgeschlagen` : "\nAlle Tests bestanden");
process.exitCode = fail ? 1 : 0;
