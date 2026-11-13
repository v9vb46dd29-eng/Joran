#!/usr/bin/env node
/* Joran — Erkennt die Prognose einen Joran-Abend? Auswertung, kein Modell.
   Baut die Joran-Zutaten (joranCheck in core/prognose.js) aus archivierten Läufen von ICON-CH2 nach (Previous Runs API,
   gleiche Punkte wie fetchJura in core/daten.js: Jurahochfläche, Chasseral, Seemitte, Besançon, Neuchâtel) und vergleicht
   sie mit dem, was gemessen wurde: Abend mit Regel E in Cressier (eval/regel-e.cjs) und Abend mit Nordwest auf dem Chasseral.
   Zwei Läufe: Lauf des Tages und Lauf vom Vortag. Zeitraum: so weit das Archiv reicht (92 Tage).
   Die Bedingung der App: Kamm-NW ab JORAN_X.crest kn und (Druckanstieg Jura–See oder Besançon − Neuchâtel ab JORAN_X.bn hPa).
   Aufruf: node eval/joran-prognose.cjs [--offline]   (zuerst node eval/regel-e.cjs, legt eval/cache/regel-e.json an)
   Speichert die Archivprognosen in eval/data/joran_prognose.json und hängt bei jedem Aufruf die neuen Läufe an. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), Z = require("./zeitversatz.cjs");
const FILE = path.join(__dirname, "data", "joran_prognose.json"), SUF = ["", "_previous_day1"];
async function hole(){
  const P = [C.JURA, C.CREST, C.SPOTS[2], C.BES, C.NEUP];
  const v = SUF.flatMap(s=>["pressure_msl"+s, "wind_speed_10m"+s, "wind_direction_10m"+s]).join(",");
  const u = "https://previous-runs-api.open-meteo.com/v1/forecast" + `?latitude=${P.map(p=>p.lat).join(",")}&longitude=${P.map(p=>p.lon).join(",")}`
    + `&hourly=${v}&models=meteoswiss_icon_ch2&wind_speed_unit=kn&timezone=Europe%2FZurich&past_days=92&forecast_days=1`;
  const r = await fetch(u); if(!r.ok) throw new Error(r.status+" "+await r.text());
  const neu = (await r.json()).map(x=>Z.hourly(x));   /* Zeit in echter Ortszeit (eval/zeitversatz.cjs) */
  /* an die abgelegten Läufe anhängen: Das Archiv der API reicht nur 92 Tage zurück, die Datei wächst mit jedem Aufruf */
  const altD = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : null;
  if(altD) Z.umrechnen("joran_prognose.json", altD);   /* ältere Ablage ohne Umrechnung zuerst in Ortszeit */
  const alt = altD ? altD.punkte : null;
  const punkte = neu.map((h, p)=>{ const m = new Map();
    [alt && alt[p], h].filter(Boolean).forEach(o=>o.time.forEach((t,i)=>{ const z = {}; Object.keys(o).forEach(k=>{ if(k!=="time") z[k] = o[k][i]; });
      if(!m.has(t) || Object.values(z).some(v=>v!=null)) m.set(t, z); }));
    const ts = [...m.keys()].sort(), out = {time:ts}; Object.keys(h).filter(k=>k!=="time").forEach(k=>{ out[k] = ts.map(t=>m.get(t)[k] ?? null); }); return out; });
  const D = {geholt:new Date().toISOString(), zeit:Z.MARK, punkte};
  fs.writeFileSync(FILE, JSON.stringify(D)); return D;
}
(async()=>{
  const D = fs.existsSync(FILE) && process.argv.includes("--offline") ? JSON.parse(fs.readFileSync(FILE, "utf8")) : await hole();
  const RE = JSON.parse(fs.readFileSync(path.join(__dirname, "cache", "regel-e.json"), "utf8"));
  const [jj, cr, lk, be, ne] = D.punkte, St = C.clone(C.DEF);
  const J = s => { const out = {}; jj.time.forEach((t,i)=>{ const a = jj["pressure_msl"+s][i], b = lk["pressure_msl"+s][i], pb = be["pressure_msl"+s][i], pn = ne["pressure_msl"+s][i];
    out[t] = {dp:a!=null && b!=null ? a-b : null, cv:cr["wind_speed_10m"+s][i], cd:cr["wind_direction_10m"+s][i], bn:pb!=null && pn!=null ? pb-pn : null}; }); return out; };
  const tage = [...new Set(jj.time.map(t=>t.slice(0,10)))].filter(d=>d<C.dayOfDate(new Date())).sort();
  console.log(`Joran-Zutaten aus ICON-CH2 gegen die Messung, ${tage[0]} bis ${tage[tage.length-1]}, Zeitfenster Abend 16–21 Uhr`);
  const eT = new Set(Object.keys(RE.tage).filter(d=>RE.tage[d].e)), nwT = new Set(RE.nwTage);
  SUF.forEach(s=>{
    const JJ = J(s); let n = 0;
    const R = {}; const add = (k, ja, wahr) => { const o = R[k] = R[k] || {tp:0, fn:0, fp:0, tn:0}; o[ja ? (wahr ? "tp" : "fp") : (wahr ? "fn" : "tn")]++; };
    const detail = [];
    tage.forEach(d=>{ const jc = C.joranCheck(JJ, d, St, 0); if(!jc) return; n++;
      const app = jc.crestOk && (jc.dpOk || jc.bnOk), e = eT.has(d), nw = nwT.has(d);
      add("App (Kamm + Druck)", app, e); add("Kamm NW allein", jc.crestOk, e); add("Kamm + Druckanstieg", jc.crestOk && jc.dpOk, e); add("Kamm + Besançon", jc.crestOk && jc.bnOk, e);
      add("App gegen Chasseral NW", app, nw);
      if(e || app) detail.push(`${d}${e ? " E" : "  "}${nw ? " NW" : "   "} Prognose: Kamm ${jc.crest ? C.r0(jc.crest.v)+" kn" : "–"}, Druckanstieg ${jc.rise==null ? "–" : C.r1(jc.rise)}, Bes−Neu ${jc.bn==null ? "–" : C.r1(jc.bn)} → ${app ? (jc.bnOk ? "Front-Joran" : "Joran") : "kein Joran"}`); });
    console.log(`\n${s ? "Lauf vom Vortag" : "Lauf des Tages"} (${n} Tage, Abende mit Regel E: ${tage.filter(d=>eT.has(d)).length})`);
    Object.entries(R).forEach(([k,o])=>console.log(`  ${k.padEnd(24)} erkannt ${o.tp}/${o.tp+o.fn}, Fehlalarme ${o.fp}/${o.fp+o.tn}`));
    detail.forEach(x=>console.log("   "+x));
  });
})().catch(e=>{ console.error(e.stack||e); process.exitCode = 1; });
