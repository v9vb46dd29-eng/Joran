#!/usr/bin/env node
/* Joran — Prüfung von Regel E (Joran, Cressier) gegen die Lage auf dem Chasseral. Auswertung, kein Modell.
   Regel E (core/messung.js, ruleE): 30 min Wind aus 270–350° in Cressier, durchgehend ab 10 kn, nicht abnehmend, keine Böenfront.
   Fragen: 1. Bei welcher Lage auf dem Chasseral feuert Regel E am Nachmittag und Abend (14–21 Uhr)? Feuert sie bei West,
   wählt die App im Windbild Joran, obwohl es West ist (vorwahl: Regel E geht allem vor).
   2. Wie oft feuert sie an Abenden, an denen der Chasseral Nordwest misst? 3. Welcher Typ (joranType)? 4. Seit dem 16.10.:
   Was mass der See danach?
   Daten: Zehnminutenwerte Cressier, Chasseral, Neuchâtel 2020 bis gestern (SwissMetNet). Lädt die Jahre 2020–2025 einmal nach
   eval/cache/ (je rund 35 MB), 2026 aus dem Stationscache von eval/measure.cjs.
   Aufruf: node eval/regel-e.cjs */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
const CACHE = path.join(__dirname, "cache"), H = 3600e3;
async function reihe(abk){
  const f = path.join(CACHE, `${abk}_t_2020.csv`);
  if(!fs.existsSync(f)){ const r = await fetch(`https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/${abk}/ogd-smn_${abk}_t_historical_2020-2029.csv`);
    if(!r.ok) throw new Error(r.status+" "+abk); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); }
  const alt = C.parseSMN(new TextDecoder("latin1").decode(fs.readFileSync(f)));
  const neu = JSON.parse(fs.readFileSync(path.join(CACHE, abk+".t.json"), "utf8")).map(r=>Object.assign(r, {t:new Date(r.t)}));
  const m = new Map(); alt.concat(neu).forEach(r=>m.set(+r.t, r));
  return [...m.values()].sort((a,b)=>a.t-b.t);
}
const sek = d => d==null ? "–" : ["N","NO","O","SO","S","SW","W","NW"][Math.round(d/45)%8];
const mittel = rs => { let u = 0, v = 0, s = 0, n = 0; rs.forEach(r=>{ if(r.mean==null || r.dir==null) return; const k = r.dir*Math.PI/180;
  u -= r.mean*Math.sin(k); v -= r.mean*Math.cos(k); s += r.mean; n++; });
  return n ? {kn:s/n, dir:(Math.atan2(-u,-v)*180/Math.PI+360)%360} : null; };

(async()=>{
  const [crm, cha, neu] = [await reihe("crm"), await reihe("cha"), await reihe("neu")];
  const chaAt = new Map(cha.map(r=>[+r.t, r]));
  const chaMittel = t => mittel([0,1,2].map(i=>chaAt.get(t-i*600e3)).filter(Boolean));
  /* Regel E im Nachspielen: je Abend der erste Zeitpunkt, an dem sie feuert */
  const tage = {};
  for(let i=12; i<crm.length; i++){
    const r = crm[i], d = C.dayOfDate(r.t), h = C.localHour(r.t); if(h<14 || h>21) continue;
    if(tage[d] && tage[d].e) continue;
    const e = C.ruleE(crm.slice(i-12, i+1));
    if(e.ok) tage[d] = {e:+r.t};
  }
  /* Abende mit Nordwest auf dem Chasseral: mindestens eine Stunde (6 Werte) ab 15 kn aus 293–338° zwischen 14 und 21 Uhr */
  const nw = {};
  cha.forEach(r=>{ const h = C.localHour(r.t); if(h<14 || h>21 || r.mean==null || r.dir==null) return;
    if(sek(r.dir)==="NW" && r.mean>=15){ const d = C.dayOfDate(r.t); nw[d] = (nw[d]||0)+1; } });
  const nwTage = Object.keys(nw).filter(d=>nw[d]>=6);
  const von = C.dayOfDate(crm[0].t), bis = C.dayOfDate(crm[crm.length-1].t);
  const eTage = Object.keys(tage).sort();
  const proSek = {}, typ = {}, sNeu = {t:neu}, sCrm = {t:crm};
  eTage.forEach(d=>{ const t = tage[d].e, k = chaMittel(t), s = k && k.kn>=10 ? sek(k.dir) : "schwach";
    tage[d].kamm = s; proSek[s] = (proSek[s]||0)+1;
    const ty = C.joranType(new Date(t), {neu:sNeu, crm:sCrm}) || "unbestimmt"; tage[d].typ = ty;
    (typ[s] = typ[s] || {})[ty] = (typ[s][ty]||0)+1; });
  const n = eTage.length;
  console.log(`Regel E in Cressier, ${von} bis ${bis}, 14–21 Uhr: feuert an ${n} Abenden`);
  console.log("Lage auf dem Chasseral beim ersten Signal (Mittel 30 min, ab 10 kn):");
  Object.entries(proSek).sort((a,b)=>b[1]-a[1]).forEach(([s,c])=>console.log(`  ${s.padEnd(8)} ${String(c).padStart(4)}  ${String(Math.round(100*c/n)).padStart(3)} %   Typ: ${Object.entries(typ[s]).map(([k,v])=>k+" "+v).join(", ")}`));
  const mitNW = nwTage.filter(d=>tage[d]).length;
  console.log(`\nAbende mit Nordwest auf dem Chasseral (≥ 1 h ab 15 kn, 14–21 Uhr): ${nwTage.length}; davon feuert Regel E an ${mitNW} (${Math.round(100*mitNW/nwTage.length)} %)`);
  /* je Monat: Joran-Abende (E und Chasseral NW) */
  const mon = {}; eTage.forEach(d=>{ const m = d.slice(5,7); const o = mon[m] = mon[m] || {e:0, nw:0}; o.e++; if(tage[d].kamm==="NW") o.nw++; });
  console.log("Je Monat (alle Jahre): Abende mit Regel E / davon Chasseral NW: " + Object.keys(mon).sort().map(m=>`${m}: ${mon[m].e}/${mon[m].nw}`).join(", "));
  /* Seit Beginn der Seemessung */
  const {lk} = M.loadArchive([], true);
  const seeMax = (id, d) => { const rs = lk.st[id].rows.filter(r=>C.dayOfDate(new Date(r.t))===d && C.localHour(new Date(r.t))>=16 && C.localHour(new Date(r.t))<=21 && r.mean!=null);
    return rs.length ? Math.max(...rs.map(r=>r.mean)) : null; };
  console.log("\nSeit dem 16.10. (Seemessung, Maximum 16–21 Uhr):");
  eTage.filter(d=>d>="2026-10-16").forEach(d=>console.log(`  ${d} ${C.hhmm(new Date(tage[d].e))} Chasseral ${tage[d].kamm}, Typ ${tage[d].typ}: Ipsach ${C.r0(seeMax("ips", d)??NaN)} kn, Vingelz ${C.r0(seeMax("vin", d)??NaN)} kn`));
  const oE = nwTage.filter(d=>d>="2026-10-16" && !tage[d]);
  if(oE.length) console.log("  Chasseral NW ohne Regel E: " + oE.map(d=>`${d} (Ipsach ${C.r0(seeMax("ips", d)??NaN)} kn)`).join(", "));
  fs.writeFileSync(path.join(CACHE, "regel-e.json"), JSON.stringify({tage, nwTage}));
})().catch(e=>{ console.error(e.stack||e); process.exitCode = 1; });
