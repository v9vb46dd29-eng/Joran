#!/usr/bin/env node
/* Joran — Messung oder Prognose? Wie lange taugt die Messung von jetzt für eine kommende Stunde, und ab wann ist die Prognose
   besser? Auswertung, kein Modell. Grundlage für den Regler im Windbild (stunde() in app/windbild.js).
   1. Lage: Lage jetzt aus der Messung auf dem Chasseral, einfach fortgeschrieben, gegen die Lage, die der Chasseral h Stunden
      später misst. Lange Reihe: Stundenwerte 2010 bis gestern (SwissMetNet, Chasseral). Kurze Reihe: Entwicklungstage.
   2. Lage aus der Prognose (vorwahl() mit Kammprognose ICON-CH2 und Modellmittel am See, wie eval/windbild-stunde.cjs),
      Lauf des Tages (previous_day0) und Lauf vom Vortag (previous_day1), dazu die Mischregel der App: Messung fortschreiben,
      ausser die Prognose sagt selbst einen Wechsel der Lage voraus.
   3. Stärke an Ipsach und Vingelz: Seemessung jetzt fortgeschrieben gegen Modellmittel, und die Mischung
      w·Messung + (1−w)·Modell mit w = exp(−h/τ). τ wird auf den Entwicklungstagen bestimmt.
   Ziele: 8–22 Uhr. Soll der Lage: Sektor auf dem Chasseral ab regeln.kammMin kn (wie data/windbild.json).
   Aufruf: node eval/lage-vorlauf.cjs [--bis JJJJ-MM-TT] [--schreiben]
     --schreiben  legt die Kennzahlen in eval/data/vorlauf.json ab (eval/windbild.cjs übernimmt sie in data/windbild.json)
   Braucht: Stationscache aus eval/measure.cjs, eval/data/stunde_prognose.json (eval/windbild-stunde.cjs), Branch «live».
   Lädt einmal die Stundenreihe des Chasseral nach eval/cache/cha.h.json. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i>0 ? process.argv[i+1] : d; };
const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
const BIS = arg("--bis", split.devBis), VON = "2026-10-16";
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "windbild.json"), "utf8"));
const LEADS = [1,2,3,4,6,9,12,18,24];
const src = fs.readFileSync(path.join(ROOT, "app", "windbild.js"), "utf8");
const i0 = src.indexOf("/* ---------- Lage von heute ---------- */"), i1 = src.indexOf("function heute(){");
const app = new Function("dirOf", "DATA", src.slice(i0, i1)+"; return {vorwahl, mittel};")(C.dirOf, DATA);
const KMIN = DATA.regeln.kammMin;
const sek = d => ["N","NO","O","SO","S","SW","W","NW"][Math.round(d/45)%8];
/* Soll: Lage nach dem Chasseral. «suedost» auch dann, wenn die Datei Südost noch nicht als Lage führt */
const lageVon = k => { if(!k || k.kn==null || k.dir==null || k.kn<KMIN) return null; const s = sek(k.dir);
  const l = DATA.lagen.find(z=>(z.kamm||[]).includes(s)); return l ? l.id : s==="SO" ? "suedost" : "ohne"; };
const H = 3600e3, keyOf = t => C.dayOfDate(t)+"T"+String(C.localHour(t)).padStart(2,"0")+":00";
const pct = (a, n) => n ? Math.round(100*a/n) : null, f = x => x==null ? "  –" : String(x).padStart(3);

(async()=>{
  /* ---------- Chasseral je Stunde: lange Reihe ---------- */
  const HF = path.join(__dirname, "cache", "cha.h.json");
  let cha = fs.existsSync(HF) ? JSON.parse(fs.readFileSync(HF, "utf8")) : null;
  if(!cha){
    const get = async n => { const r = await fetch(`https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/cha/ogd-smn_cha_h_${n}.csv`);
      if(!r.ok) throw new Error(r.status+" "+n); return C.parseSMN(new TextDecoder("latin1").decode(await r.arrayBuffer())); };
    const rows = [].concat(await get("historical_2010-2019"), await get("historical_2020-2029"), await get("recent"));
    const m = new Map(); rows.forEach(r=>m.set(+r.t, {t:+r.t, kn:r.mean, dir:r.dir}));
    cha = [...m.values()].sort((a,b)=>a.t-b.t); fs.writeFileSync(HF, JSON.stringify(cha));
  }
  /* Stundenwert = Mittel der Stunde, die zur vollen Stunde endet; wie in eval/windbild-stunde.cjs gilt er für die Stunde davor */
  const chaH = new Map(cha.map(r=>[r.t-H, r]));
  const pers = {}, persN = {};
  for(const [t, r] of chaH){ const hr = C.localHour(new Date(t)); const a = lageVon(r); if(!a) continue;
    LEADS.forEach(h=>{ const z = chaH.get(t+h*H); if(!z) return; const hz = C.localHour(new Date(t+h*H)); if(hz<8 || hz>=22) return;
      const b = lageVon(z); if(!b) return; const P = (pers[a] = pers[a] || {}); const Q = (P[h] = P[h] || {n:0, hit:0}); Q.n++; if(a===b) Q.hit++; }); }
  const jahre = `${C.dayOfDate(new Date(cha[0].t)).slice(0,4)}–${C.dayOfDate(new Date(cha[cha.length-1].t))}`;
  console.log(`1) Lage fortgeschrieben, Chasseral ${jahre}, Ziel 8–22 Uhr. Anteil gleiche Lage nach h Stunden (nur Stunden, in denen der Chasseral ab ${KMIN} kn misst)`);
  console.log("   Lage      n(1h)  " + LEADS.map(h=>("+"+h+"h").padStart(5)).join(""));
  const LAGEN = ["west","sued","bise","nord","joran","suedost"];
  LAGEN.forEach(id=>{ const P = pers[id]; if(!P) return; console.log(`   ${id.padEnd(9)} ${String(P[1] ? P[1].n : 0).padStart(6)}  ` + LEADS.map(h=>(f(P[h] && pct(P[h].hit, P[h].n))+" %").padStart(5)).join("")); });

  /* ---------- Entwicklungstage: Prognose, Fortschreiben und Mischregel ---------- */
  const D = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "stunde_prognose.json"), "utf8"));
  const idx = {}; D.kamm.time.forEach((k,i)=>{ idx[k] = i; });
  const c10 = JSON.parse(fs.readFileSync(path.join(__dirname, "cache", "cha.t.json"), "utf8"));
  const std = {}; c10.forEach(r=>{ const t = new Date(r.t), k = keyOf(t); if(r.mean==null) return; (std[k] = std[k] || []).push({kn:r.mean, dir:r.dir}); });
  const ist = k => std[k] && std[k].length>=4 ? app.mittel(std[k]) : null;
  const prog = (k, s) => { const i = idx[k]; if(i==null) return null;
    const kv = D.kamm["wind_speed_10m"+s][i], kd = D.kamm["wind_direction_10m"+s][i], pts = [];
    C.MODELS.forEach(m=>["vin","ips"].forEach(id=>{ const h = D.see[m.id] && D.see[m.id][id]; if(!h) return;
      const v = h["wind_speed_10m"+s][i], d = h["wind_direction_10m"+s][i]; if(v!=null && d!=null) pts.push({kn:v, dir:d}); }));
    const sm = app.mittel(pts);
    const g = app.vorwahl({kammP:kv==null ? null : {kn:kv, dir:kd}, s:sm ? {top:{d:sm.dir, v:sm.kn}} : null, monat:+k.slice(5,7)}, DATA.lagen, DATA.regeln);
    return g.lage; };
  const ws = x => x==="sued" ? "west" : x;   /* Regler: «West oder Süd» */
  const R = {}; const add = (m, h, ok) => { const Q = ((R[m] = R[m] || {})[h] = R[m][h] || {n:0, hit:0}); Q.n++; if(ok) Q.hit++; };
  /* Stunden als Zeitpunkte (UTC), damit der Wechsel auf die Winterzeit stimmt */
  const STD = []; for(let t=Date.parse(VON+"T00:00:00Z")-2*H; C.dayOfDate(new Date(t))<=BIS; t+=H) if(C.dayOfDate(new Date(t))>=VON) STD.push(t);
  STD.forEach(t0=>{ const k = keyOf(new Date(t0));
    const jetzt = lageVon(ist(k)); if(!jetzt || jetzt==="ohne") return;
    LEADS.forEach(h=>{ const kz = keyOf(new Date(t0+h*H)), hz = +kz.slice(11,13); if(hz<8 || hz>=22 || kz.slice(0,10)>BIS) return;
      const soll = lageVon(ist(kz)); if(!soll) return;
      add("fort", h, ws(jetzt)===ws(soll));
      ["", "_previous_day1"].forEach(s=>{ const p = prog(kz, s), p0 = prog(k, s);
        add("prog"+s, h, !!p && ws(p)===ws(soll));
        /* Mischregel: Prognose nur, wenn sie selbst einen Wechsel voraussagt */
        const misch = p && p0!==p ? p : jetzt;
        add("misch"+s, h, ws(misch)===ws(soll)); });
    }); });
  console.log(`\n2) Entwicklungstage ${VON}–${BIS}, Lage richtig (West und Süd zusammen wie im Regler), Ziel 8–22 Uhr`);
  console.log("   Methode                          " + LEADS.map(h=>("+"+h+"h").padStart(5)).join("") + "   n(+1h)");
  [["fort","Messung fortgeschrieben"],["prog","Prognose, Lauf des Tages"],["prog_previous_day1","Prognose, Lauf vom Vortag"],
   ["misch","Mischregel, Lauf des Tages"],["misch_previous_day1","Mischregel, Lauf vom Vortag"]].forEach(([m, name])=>
    console.log(`   ${name.padEnd(32)} ` + LEADS.map(h=>(f(R[m] && R[m][h] && pct(R[m][h].hit, R[m][h].n))+" %").padStart(5)).join("") + `   ${R[m] && R[m][1] ? R[m][1].n : 0}`));

  /* ---------- Stärke am See ---------- */
  const {lk} = M.loadArchive([], true);
  const see = {}; C.LAKE.forEach(L=>{ const m = {}; lk.st[L.id].rows.forEach(r=>{ if(r.mean==null) return; const k = keyOf(new Date(r.t)); (m[k] = m[k] || []).push(r.mean); });
    see[L.id] = Object.fromEntries(Object.entries(m).filter(([,a])=>a.length>=3).map(([k,a])=>[k, a.reduce((x,y)=>x+y,0)/a.length])); });
  const modell = (id, k, s) => { const i = idx[k]; if(i==null) return null; const v = [];
    C.MODELS.forEach(m=>{ const h = D.see[m.id] && D.see[m.id][id]; const x = h && h["wind_speed_10m"+s][i]; if(x!=null) v.push(x); });
    return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
  const paare = [];
  ["vin","ips"].forEach(id=>STD.forEach(t0=>{ const k = keyOf(new Date(t0)), a = see[id][k]; if(a==null) return;
    LEADS.forEach(h=>{ const kz = keyOf(new Date(t0+h*H)), hz = +kz.slice(11,13); if(hz<8 || hz>=22 || kz.slice(0,10)>BIS) return;
      const b = see[id][kz], m0 = modell(id, kz, ""), m1 = modell(id, kz, "_previous_day1"); if(b==null || m0==null) return;
      paare.push({id, h, jetzt:a, soll:b, m0, m1}); }); }));
  const mae = (h, fn) => { const p = paare.filter(x=>x.h===h); return p.length ? p.reduce((s,x)=>s+Math.abs(fn(x)-x.soll),0)/p.length : null; };
  let best = null;
  for(let tau=0.25; tau<=24; tau+=0.25){ const e = LEADS.reduce((s,h)=>s+mae(h, x=>{ const w = Math.exp(-h/tau); return w*x.jetzt+(1-w)*x.m0; }),0);
    if(!best || e<best.e) best = {tau, e}; }
  const T = 12, klass = (h, fn) => { const p = paare.filter(x=>x.h===h && x.id==="ips"); let tp = 0, fn_ = 0, fp = 0, tn = 0;
    p.forEach(x=>{ const ja = fn(x)>=T, ist_ = x.soll>=T; if(ja && ist_) tp++; else if(!ja && ist_) fn_++; else if(ja) fp++; else tn++; });
    return {rec:tp+fn_ ? tp/(tp+fn_) : null, fpr:fp+tn ? fp/(fp+tn) : null, ev:tp+fn_}; };
  const mix = h => x => { const w = Math.exp(-h/best.tau); return w*x.jetzt+(1-w)*x.m0; };
  console.log(`\n3) Stärke am See, Stundenmittel, mittlerer Fehler in kn (Vingelz und Ipsach, ${VON}–${BIS}). Mischung w = exp(−h/τ), τ = ${best.tau} h`);
  console.log("   Methode                          " + LEADS.map(h=>("+"+h+"h").padStart(6)).join(""));
  [["Messung fortgeschrieben", h=>x=>x.jetzt], ["Modellmittel, Lauf des Tages", ()=>x=>x.m0], ["Modellmittel, Lauf vom Vortag", ()=>x=>x.m1==null ? x.m0 : x.m1], ["Mischung (Lauf des Tages)", mix]]
    .forEach(([name, fn])=>console.log(`   ${name.padEnd(32)} ` + LEADS.map(h=>{ const e = mae(h, fn(h)); return (e==null ? "–" : e.toFixed(1)).padStart(6); }).join("")));
  console.log(`   Gewicht der Messung w           ` + LEADS.map(h=>Math.exp(-h/best.tau).toFixed(2).padStart(6)).join(""));
  console.log(`   Ipsach ab ${T} kn, Recall/FPR: ` + LEADS.map(h=>{ const a = klass(h, x=>x.jetzt), b = klass(h, x=>x.m0), c = klass(h, mix(h));
    const r = v => v==null ? "–" : v.toFixed(2); return `\n     +${h}h (${a.ev} Std. ab ${T} kn): fortgeschrieben ${r(a.rec)}/${r(a.fpr)}, Modell ${r(b.rec)}/${r(b.fpr)}, Mischung ${r(c.rec)}/${r(c.fpr)}`; }).join(""));

  /* Variante: nie unter dem Modell (ein verpasster Abend wiegt schwerer als ein Fehlalarm) */
  const hoch = h => x => Math.max(mix(h)(x), x.m0);
  console.log("   Variante max(Mischung, Modell): MAE " + LEADS.map(h=>mae(h, hoch(h)).toFixed(1)).join(" ") + "\n     Recall/FPR " + LEADS.map(h=>{ const c = klass(h, hoch(h)); return `+${h}h ${c.rec.toFixed(2)}/${c.fpr.toFixed(2)}`; }).join(", "));
  if(process.argv.includes("--schreiben")){
    const out = {hinweis:"Erzeugt von eval/lage-vorlauf.cjs. Nicht von Hand ändern.", stand:C.dayOfDate(new Date()), von:VON, bis:BIS, jahre, leads:LEADS,
      fort:Object.fromEntries(Object.entries(pers).map(([id,P])=>[id, LEADS.map(h=>P[h] ? pct(P[h].hit, P[h].n) : null)])),
      prog:LEADS.map(h=>R.prog && R.prog[h] ? pct(R.prog[h].hit, R.prog[h].n) : null),
      misch:LEADS.map(h=>R.misch && R.misch[h] ? pct(R.misch[h].hit, R.misch[h].n) : null),
      tau:best.tau};
    fs.writeFileSync(path.join(__dirname, "data", "vorlauf.json"), JSON.stringify(out, null, 1)+"\n");
    console.log("\ngeschrieben: eval/data/vorlauf.json");
  }
})().catch(e=>{ console.error(e.stack||e); process.exitCode = 1; });
