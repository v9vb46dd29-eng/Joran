#!/usr/bin/env node
/* Joran — Lage je Stunde aus der Prognose (Regler im Windbild): Wie oft wählt die App aus der Prognose dieselbe Lage, die die
   Messung auf dem Chasseral in dieser Stunde ergibt? Auswertung, kein Modell.
   Soll: Lage nach dem Stundenmittel auf dem Chasseral (Sektor ab regeln.kammMin kn), wie data/windbild.json sie festlegt.
   Stunden mit schwachem Chasseral haben kein Soll und zählen nicht.
   Ist: vorwahl() aus app/windbild.js mit dem, was der Regler hat: Kammprognose ICON-CH2 (Chasseral) und das Modellmittel
   an Vingelz und Ipsach (ICON-CH1, ICON-CH2, ICON-D2, AROME). Zwei Vorlaufzeiten: Lauf des Tages (previous_day0, 0–24 h)
   und Lauf vom Vortag (previous_day1, 24–48 h).
   Aufruf: node eval/windbild-stunde.cjs [--bis JJJJ-MM-TT] [--kamm F] [--offline]
     --kamm F   Kammprognose probeweise mit F multiplizieren (ICON-CH2 liefert am Kamm im Median rund die Hälfte)
   Speichert die Archivprognosen in eval/data/stunde_prognose.json. Braucht den Stationscache aus eval/measure.cjs. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js"));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i>0 ? process.argv[i+1] : d; };
const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
const BIS = arg("--bis", split.devBis), VON = "2026-10-16", FK = parseFloat(arg("--kamm", "1"));
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "windbild.json"), "utf8"));
const FILE = path.join(__dirname, "data", "stunde_prognose.json");
const LEADS = ["", "_previous_day1"];

/* vorwahl und mittel aus app/windbild.js (rein), wie in eval/windbild.cjs */
const src = fs.readFileSync(path.join(ROOT, "app", "windbild.js"), "utf8");
const i0 = src.indexOf("/* ---------- Lage von heute ---------- */"), i1 = src.indexOf("function heute(){");
const app = new Function("dirOf", "DATA", src.slice(i0, i1)+"; return {vorwahl, mittel};")(C.dirOf, DATA);

async function hole(){
  const days = Math.min(92, Math.ceil((Date.now()-Date.parse(VON+"T00:00:00Z"))/864e5)+1);
  const v = LEADS.flatMap(s=>["wind_speed_10m"+s, "wind_direction_10m"+s]).join(",");
  const q = (lat, lon, m, sea) => `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${v}&models=${m}`
    + `&wind_speed_unit=kn&timezone=Europe%2FZurich&past_days=${days}&forecast_days=1${sea?"&cell_selection=sea":""}`;
  const get = async u => { const r = await fetch(u); if(!r.ok) throw new Error(r.status+" "+u); return r.json(); };
  const D = {geholt:new Date().toISOString(), kamm:(await get(q(C.CREST.lat, C.CREST.lon, "meteoswiss_icon_ch2"))).hourly, see:{}};
  for(const m of C.MODELS){ D.see[m.id] = {};
    for(const L of C.SPOTS.filter(s=>s.id!=="mit")){ try{ D.see[m.id][L.id] = (await get(q(L.lat, L.lon, m.id, true))).hourly; }catch(e){ console.error(m.id, L.id, e.message); } } }
  fs.mkdirSync(path.dirname(FILE), {recursive:true}); fs.writeFileSync(FILE, JSON.stringify(D));
  return D;
}

(async()=>{
  let D = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : null;
  if(!D || (!process.argv.includes("--offline") && C.dayOfDate(new Date(D.geholt))<BIS)) D = await hole();
  /* Soll je Stunde: Vektormittel der Zehnminutenwerte auf dem Chasseral */
  const cha = JSON.parse(fs.readFileSync(path.join(__dirname, "cache", "cha.t.json"), "utf8"));
  const std = {};
  cha.forEach(r=>{ const t = new Date(r.t), day = C.dayOfDate(t), hr = C.localHour(t); if(day<VON || day>BIS || hr<8 || hr>=22 || r.mean==null) return;
    (std[day+"T"+String(hr).padStart(2,"0")+":00"] = std[day+"T"+String(hr).padStart(2,"0")+":00"] || []).push({kn:r.mean, dir:r.dir}); });
  const sek = d => ["N","NO","O","SO","S","SW","W","NW"][Math.round(d/45)%8];
  const soll = k => { if(!k || k.kn<DATA.regeln.kammMin) return null; const l = DATA.lagen.find(z=>(z.kamm||[]).includes(sek(k.dir))); return l ? l.id : "ohne"; };
  const idx = {}; D.kamm.time.forEach((t,i)=>{ idx[t] = i; });
  const res = {};
  LEADS.forEach(s=>{ res[s] = {}; }); const zeig = {};
  let n = 0, ratio = [];
  Object.keys(std).sort().forEach(key=>{
    const ist = app.mittel(std[key]), want = soll(ist); if(!want || std[key].length<4) return;
    const i = idx[key]; if(i==null) return; n++;
    LEADS.forEach(s=>{
      const kv = D.kamm["wind_speed_10m"+s][i], kd = D.kamm["wind_direction_10m"+s][i];
      if(s==="" && kv!=null) ratio.push(kv/Math.max(ist.kn,1));
      const kammP = kv==null ? null : {kn:kv*FK, dir:kd};
      const pts = [];
      C.MODELS.forEach(m=>["vin","ips"].forEach(id=>{ const h = D.see[m.id] && D.see[m.id][id]; if(!h) return;
        const v = h["wind_speed_10m"+s][i], d = h["wind_direction_10m"+s][i]; if(v!=null && d!=null) pts.push({kn:v, dir:d}); }));
      const sm = app.mittel(pts);
      const got = app.vorwahl({kammP, s:sm ? {top:{d:sm.dir, v:sm.kn}} : null, monat:+key.slice(5,7)}, DATA.lagen, DATA.regeln);
      const R = res[s][want] = res[s][want] || {n:0, hit:0, wohin:{}};
      /* Die App fasst West und Süd im Regler zu «West oder Süd» zusammen (stunde() in app/windbild.js) */
      const ws = x => x==="sued" ? "west" : x;
      R.n++; if(got.lage===want) R.hit++; if(got.lage && ws(got.lage)===ws(want)) R.app = (R.app||0)+1;
      const w = got.lage || "keine"; R.wohin[w] = (R.wohin[w]||0)+1;
      /* andersherum: Wie oft stimmt die angezeigte Lage? (auch Stunden mit Soll «ohne» und «joran» zählen) */
      if(got.lage){ const g = ws(got.lage), Z = (zeig[s] = zeig[s] || {})[g] = (zeig[s] || {})[g] || {n:0, hit:0}; Z.n++; if(g===ws(want)) Z.hit++; }
    });
  });
  const med = a => { const b = [...a].sort((x,y)=>x-y); return b[b.length>>1]; };
  console.log(`Lage je Stunde aus der Prognose gegen die Messung Chasseral, ${VON} bis ${BIS}, 8–22 Uhr, ${n} Stunden mit Soll`);
  console.log("Soll joran = Nordwest auf dem Chasseral (ohne Joran-Zeichen im Archiv), ohne = Sektor ohne Lage (Südost): nur zur Information.");
  console.log(`Kammprognose ICON-CH2 / Messung, Median (Lauf des Tages): ${ratio.length ? med(ratio).toFixed(2) : "–"}${FK!==1 ? `, Faktor probeweise ${FK}` : ""}`);
  LEADS.forEach(s=>{
    console.log(`\n${s ? "Lauf vom Vortag (24–48 h)" : "Lauf des Tages (0–24 h)"}`);
    Object.entries(res[s]).sort((a,b)=>b[1].n-a[1].n).forEach(([id, R])=>
      console.log(`  ${id.padEnd(7)} ${String(Math.round(100*R.hit/R.n)).padStart(3)} % von ${String(R.n).padStart(3)} Stunden${["west","sued"].includes(id) ? `, als «West oder Süd» ${Math.round(100*(R.app||0)/R.n)} %` : ""}  gewählt: ${Object.entries(R.wohin).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join(", ")}`));
    console.log("  angezeigt und richtig: " + Object.entries(zeig[s]||{}).map(([g,Z])=>`${g==="west" ? "West oder Süd" : g} ${Math.round(100*Z.hit/Z.n)} % von ${Z.n}`).join(", "));
  });
})().catch(e=>{ console.error(e.message||e); process.exitCode = 1; });
