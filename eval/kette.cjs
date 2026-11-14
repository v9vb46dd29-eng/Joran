#!/usr/bin/env node
/* Joran — Kette Messung → Regeln → Prognose: Schlägt die Messung das Modell kurzfristig? Auswertung für den Regler im
   Windbild (vorwahl() und mischLage() in app/windbild.js), kein Modell.
   Je Stunde t0 (16.10. bis gestern) wird die Lage zur Zielstunde t0+h vorhergesagt, wie die App es täte:
     prog  nur Prognose der Zielstunde (Kammprognose ICON-CH2 und Modellmittel am See, Lauf des Tages, wie eval/lage-vorlauf.cjs)
     main  App auf origin/main: vorwahl() mit Fensterprognose (Abend 16–21, Restfenster wie heute()), Regler ohne Vorlauf
     neu   App im Arbeitsbaum: dasselbe mit der Reihenfolge und den Führungszeiten (FUEHRT) von jetzt
     seeF  nur zur Wahl von FUEHRT.see: Lage nur vom See F Stunden fortgeschrieben, danach Prognose
   +0 h = Lage, die die Karte jetzt zeigt. Soll: Lage, die die App aus der Messung zur Zielstunde wählen würde (vorwahl() mit
   Stundenmittel Chasseral, Vingelz und Ipsach), sonst «schwach». Gruppen nach der Messung zu t0: kamm (Chasseral ab
   kammMin oder Bise am See unter starkem Kamm), see (nur der See zeigt eine Lage), ohne (keine gemessene Lage).
   Zeiträume nach eval/split.json: Entwicklung, Holdout, danach. 95-%-Intervall: Bootstrap über Tage.
   Grenzen: ohne Upwind-Signal und Regel E (Stationen im Nachspielen nicht wie in der App); Fenster fest Abend.
   Aufruf: node eval/kette.cjs   Braucht: Cache aus eval/measure.cjs, eval/data/stunde_prognose.json, Branch live, origin/main. */
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "windbild.json"), "utf8"));
const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
const lade = src => { const i0 = src.indexOf("/* ---------- Lage von heute ---------- */"), i1 = src.indexOf("function heute(){");
  return new Function("dirOf", "DATA", src.slice(i0, i1)+"; return {vorwahl, mittel, mischLage};")(C.dirOf, DATA); };
const NEU = lade(fs.readFileSync(path.join(ROOT, "app", "windbild.js"), "utf8"));
const MAIN = lade(cp.execFileSync("git", ["show", "origin/main:app/windbild.js"], {cwd:ROOT, encoding:"utf8"}));
const V = (A, x) => A.vorwahl(x, DATA.lagen, DATA.regeln), mittel = NEU.mittel;
const H = 3600e3, keyOf = t => C.dayOfDate(t)+"T"+String(C.localHour(t)).padStart(2,"0")+":00", kk = (d, x) => d+"T"+String(x).padStart(2,"0")+":00";
const D = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "stunde_prognose.json"), "utf8")); const idx = {}; D.kamm.time.forEach((k,i)=>{ idx[k] = i; });
const c10 = JSON.parse(fs.readFileSync(path.join(__dirname, "cache", "cha.t.json"), "utf8")), c10m = new Map(c10.map(r=>[+new Date(r.t), r]));
const kammVor = t => { const rs = [0,1,2].map(i=>c10m.get(t-i*600e3)).filter(r=>r && r.mean!=null); return rs.length>=2 ? mittel(rs.map(r=>({kn:r.mean, dir:r.dir}))) : null; };
const chaStd = {}; c10.forEach(r=>{ if(r.mean==null) return; const k = keyOf(new Date(r.t)); (chaStd[k] = chaStd[k] || []).push({kn:r.mean, dir:r.dir}); });
const {lk} = M.loadArchive([], true);
const seeR = {}, seeStd = {};
["vin","ips"].forEach(id=>{ seeR[id] = lk.st[id].rows.filter(r=>r.mean!=null).map(r=>({t:+new Date(r.t), mean:r.mean, dir:r.dir})); seeStd[id] = {};
  seeR[id].forEach(r=>{ const k = keyOf(new Date(r.t)); (seeStd[id][k] = seeStd[id][k] || []).push({kn:r.mean, dir:r.dir}); }); });
const letzter = (id, t) => { const a = seeR[id]; let lo = 0, hi = a.length-1, b = null; while(lo<=hi){ const m = (lo+hi)>>1; if(a[m].t<=t){ b = a[m]; lo = m+1; } else hi = m-1; } return b && t-b.t<=50*60000 ? b : null; };
const soll = k => { const ch = chaStd[k] && chaStd[k].length>=4 ? mittel(chaStd[k]) : null;
  const lake = ["vin","ips"].map(id=>{ const a = seeStd[id][k], m = a && a.length>=3 ? mittel(a) : null; return {L:{id, name:id}, fresh:!!m, last:m ? {mean:m.kn, dir:m.dir} : null}; });
  if(!ch && !lake.some(z=>z.fresh)) return undefined;
  return V(NEU, {kammM:ch, lake, monat:+k.slice(5,7), kammFehlt:!ch}).lage || "schwach"; };
const prog = k => { const i = idx[k]; if(i==null) return undefined; const kv = D.kamm.wind_speed_10m[i], kd = D.kamm.wind_direction_10m[i], pts = [];
  C.MODELS.forEach(m=>["vin","ips"].forEach(id=>{ const h = D.see[m.id] && D.see[m.id][id]; if(!h) return; const v = h.wind_speed_10m[i], d = h.wind_direction_10m[i]; if(v!=null && d!=null) pts.push({kn:v, dir:d}); }));
  const sm = mittel(pts); return {lage:V(NEU, {kammP:kv==null ? null : {kn:kv, dir:kd}, s:sm ? {top:{d:sm.dir, v:sm.kn}} : null, monat:+k.slice(5,7)}).lage}; };
const fenster = (day, hr) => { const ab = hr>=16 && hr<=21 ? hr : 16; let top = null;
  for(let x=ab; x<=21; x++){ const i = idx[kk(day, x)]; if(i==null) continue; C.MODELS.forEach(m=>["vin","ips"].forEach(id=>{ const h = D.see[m.id] && D.see[m.id][id];
    const v = h && h.wind_speed_10m[i], d = h && h.wind_direction_10m[i]; if(v!=null && d!=null && (!top || v>top.v)) top = {v, d}; })); }
  const kr = []; for(let x=16; x<=21; x++){ const i = idx[kk(day, x)]; if(i!=null && D.kamm.wind_speed_10m[i]!=null) kr.push({kn:D.kamm.wind_speed_10m[i], dir:D.kamm.wind_direction_10m[i]}); }
  return {s:top ? {top} : null, kammP:mittel(kr)}; };
const ws = x => x==="sued" ? "west" : x, LEADS = [0,1,2,3,4,6,9,12], FS = [0,1,3,6];
const BIS = C.dayOfDate(new Date(Date.now()-864e5)), ZEIT = [["Entwicklung", "2026-10-16", split.devBis], ["Holdout", null, split.holdoutBis], ["danach", null, BIS], ["alle", "2026-10-16", BIS]];
ZEIT[1][1] = C.dayOfDate(new Date(Date.parse(split.devBis+"T12:00:00Z")+864e5)); ZEIT[2][1] = C.dayOfDate(new Date(Date.parse(split.holdoutBis+"T12:00:00Z")+864e5));
const R = {}, TAGE = {};
const add = (z, g, m, h, ok, day) => { const Q = (((R[z] = R[z] || {})[g] = R[z][g] || {})[m] = R[z][g][m] || {})[h] = R[z][g][m][h] || {n:0, hit:0, d:{}};
  Q.n++; if(ok) Q.hit++; const dd = (Q.d[day] = Q.d[day] || [0,0]); dd[0]++; if(ok) dd[1]++; };
for(let t0 = Date.parse("2026-10-16T00:00:00Z")-2*H; C.dayOfDate(new Date(t0))<=BIS; t0 += H){
  const k = keyOf(new Date(t0)), day = k.slice(0,10), hr = +k.slice(11,13); if(day<"2026-10-16") continue;
  const zs = ZEIT.filter(([, a, b])=>day>=a && day<=b).map(z=>z[0]);
  const lake = ["vin","ips"].map(id=>{ const r = letzter(id, t0); return {L:{id, name:id}, fresh:!!r, last:r ? {mean:r.mean, dir:r.dir} : null}; });
  const km = kammVor(t0), base = {kammM:km, lake, monat:+k.slice(5,7), kammFehlt:!km}, f = Object.assign({}, base, fenster(day, hr));
  const vM = V(MAIN, f), vN = V(NEU, f), mess = V(NEU, base);
  const g = !mess.lage ? "ohne" : mess.kamm ? "kamm" : "see";
  zs.forEach(z=>((TAGE[z] = TAGE[z] || {})[g] = TAGE[z][g] || new Set()).add(day));
  const p0 = prog(k); if(!p0) continue;
  const jM = vM.lage && vM.kamm && vM.art==="messung" && !vM.unsicher ? {lage:vM.lage} : null;
  const jN = vN.lage && vN.art==="messung" ? {lage:vN.lage, kamm:!!vN.kamm && !vN.unsicher} : null;
  LEADS.forEach(h=>{ const kz = keyOf(new Date(t0+h*H)), hz = +kz.slice(11,13); if(hz<8 || hz>=22 || kz.slice(0,10)>BIS) return;
    const s = soll(kz), p = prog(kz); if(s===undefined || !p) return;
    const hit = x => x ? ws(x)===ws(s) : s==="schwach";
    const res = {prog:hit(p.lage), main:hit(h===0 ? vM.lage : MAIN.mischLage(jM, p0, p).lage), neu:hit(h===0 ? vN.lage : NEU.mischLage(jN, p0, p, h).lage)};
    FS.forEach(F=>{ res["see"+F] = hit(h===0 ? (mess.lage || p.lage) : mess.lage && !mess.kamm && h<=F ? mess.lage : NEU.mischLage(jN && jN.kamm ? jN : null, p0, p, h).lage); });
    zs.forEach(z=>Object.entries(res).forEach(([m, ok])=>{ add(z, g, m, h, ok, day); add(z, "alle", m, h, ok, day); })); }); }
const pct = Q => Q ? String(Math.round(100*Q.hit/Q.n)).padStart(4)+"%" : "    –";
const boot = (Qa, Qb) => { if(!Qa || !Qb) return "–"; const days = Object.keys(Qa.d); if(days.length<2) return "–"; const r = []; let seed = 7; const rnd = () => (seed = (seed*16807)%2147483647)/2147483647;
  for(let b=0; b<2000; b++){ let n = 0, ha = 0, hb = 0; for(let i=0; i<days.length; i++){ const d = days[Math.floor(rnd()*days.length)]; n += Qa.d[d][0]; ha += Qa.d[d][1]; hb += Qb.d[d][1]; } r.push(n ? 100*(ha-hb)/n : 0); }
  r.sort((a,b)=>a-b); return `${r[50]>=0?"+":""}${r[50].toFixed(0)}…${r[1949]>=0?"+":""}${r[1949].toFixed(0)}`; };
ZEIT.forEach(([z, a, b])=>{ if(!R[z]) return; console.log(`\n=== ${z} ${a}–${b}  (Soll: Lage aus der Messung zur Zielstunde, sonst «schwach»)`);
  ["alle","kamm","see","ohne"].forEach(g=>{ const Rg = R[z][g]; if(!Rg) return;
    console.log(`  ${g}${g!=="alle" && TAGE[z][g] ? ` (${TAGE[z][g].size} Tage)` : ""}`.padEnd(30) + LEADS.map(h=>("+"+h+"h").padStart(5)).join("") + "  n(+1h)");
    Object.keys(Rg).filter(m=>g==="see" || !/^see/.test(m)).forEach(m=>console.log("    "+m.padEnd(26)+LEADS.map(h=>pct(Rg[m][h])).join("")+"  "+(Rg[m][1] ? Rg[m][1].n : 0)));
    console.log("    neu−prog, 95 % über Tage: "+[0,1,2,3,6].map(h=>`+${h}h ${boot(Rg.neu[h], Rg.prog[h])}`).join("  ")); }); });
