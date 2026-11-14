/* Joran — Lage-Faktor messen und bestimmen (core.LAGE, inaktiv).
   Aufruf: node eval/lage-faktor.cjs [--T 12] [--kontrolle 14] [--fenster abend|tag|beide] [--teil dev|holdout] [--fest] [--tage]

   Die Kammprognose vom Vortag (eval/data/stunde_prognose.json, ICON-CH2, *_previous_day1) legt die Lage eines Tages fest
   (core.lageTag). Bestimmt wird je Lage und Spot das Verhältnis gemessen / Modell (Prognose vom Vortag, Mittel der vier
   Modelle, eval/data/prognose_vortag.json), Stunden im Zeitfenster mit Modellwind ab LAGE.minModell kn:
     - Vingelz, Ipsach: gemessen am Spot / Modell am Spot
     - Seemitte: stärkerer gemessener Spot / Modell in Seemitte (dort misst niemand)
   Grenzen wie in core/modell.js: «heben» nur ≥ 1, «senken» nur zwischen minF und 1, alle anderen Spots 1.
   Messen: Stufe der Prognose am Vortag (core.summarize, Stufe ≥ Alarmgrenze) ohne und mit Faktor gegen die Seemessung
   (core.lakeDay, Archiv in origin/live). Standard: vorwärts gerechnet, die Faktoren eines Tages kommen nur aus früheren
   Tagen (unter LAGE.minTage Tagen der Lage bleibt der Faktor 1). --fest: hinterlegte Werte aus core/modell.js (aus allen
   Entwicklungstagen bestimmt, also nicht unabhängig).
   Zusätzlich je Nutzer mit dessen Einstellung (users/*.json). Akzeptanz: Recall sinkt in keiner Zeile.
   Holdout (eval/split.json) nur mit --teil holdout. Vorab: git fetch origin "+live:refs/remotes/origin/live" */
"use strict";
const fs = require("fs"), path = require("path"), {execFileSync} = require("child_process");
const ROOT = path.join(__dirname, "..");
const C = require(path.join(ROOT, "core.js"));
const Z = require("./zeitversatz.cjs");

const o = {T:12, ctl:14, fenster:"beide", teil:"dev", fest:false, tage:false};
const argv = process.argv.slice(2);
for(let i=0; i<argv.length; i++){
  const a = argv[i], v = () => argv[++i];
  if(a==="--T") o.T = +v(); else if(a==="--kontrolle") o.ctl = +v(); else if(a==="--fenster") o.fenster = v();
  else if(a==="--teil") o.teil = v(); else if(a==="--fest") o.fest = true; else if(a==="--tage") o.tage = true;
  else if(a==="-h" || a==="--help"){ console.log(fs.readFileSync(__filename,"utf8").split("*/")[0]); process.exit(0); }
  else throw new Error("unbekannte Option "+a);
}
if(!["dev","holdout"].includes(o.teil)) throw new Error("--teil dev oder holdout");
const FENSTER = o.fenster==="beide" ? ["abend","tag"] : [o.fenster];
FENSTER.forEach(w=>{ if(!C.WINS[w]) throw new Error("unbekanntes Fenster "+w); });

const git = args => execFileSync("git", args, {cwd:ROOT, encoding:"utf8", stdio:["ignore","pipe","ignore"], maxBuffer:256<<20});
const split = JSON.parse(fs.readFileSync(path.join(__dirname,"split.json"),"utf8"));
const rd = f => { const p = path.join(__dirname,"data",f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,"utf8")) : null; };

/* ---------- Seemessung: Archiv in origin/live, nach Tag ---------- */
const DAY_CH = new Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Zurich", year:"numeric", month:"2-digit", day:"2-digit"});
const HR_CH = new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/Zurich", hour:"2-digit", hourCycle:"h23"});
const rows = Object.fromEntries(C.LAKE.map(L=>[L.id, {}]));
let ls = ""; try{ ls = git(["ls-tree","origin/live","archive/"]); }catch(e){ throw new Error("Archiv fehlt: git fetch origin \"+live:refs/remotes/origin/live\""); }
ls.split("\n").filter(Boolean).forEach(l=>{
  const j = JSON.parse(git(["cat-file","blob",l.split(/\s+/)[2]]));
  C.LAKE.forEach(L=>((j.st && j.st[L.id] && j.st[L.id].rows) || []).forEach(r=>{ if(r && r.t) rows[L.id][r.t] = r; }));
});
const per = {}, hourly = {};          /* per[Tag] wie in measure.cjs; hourly[Tag][Stunde][Spot] = Mittel */
C.LAKE.forEach(L=>Object.values(rows[L.id]).sort((a,b)=>a.t<b.t?-1:1).forEach(r=>{
  const t = new Date(r.t), d = DAY_CH.format(t), h = +HR_CH.format(t);
  const p = per[d] || (per[d] = {st:Object.fromEntries(C.LAKE.map(x=>[x.id,{rows:[]}]))}); p.st[L.id].rows.push(r);
  if(r.mean==null) return;
  const hd = hourly[d] || (hourly[d] = {}), hh = hd[h] || (hd[h] = {}), x = hh[L.id] || (hh[L.id] = {s:0, n:0});
  x.s += r.mean; x.n++;
}));
const gem = (d, h, id) => { const x = hourly[d] && hourly[d][h] && hourly[d][h][id]; return x && x.n>=3 ? x.s/x.n : null; };

/* ---------- Prognose vom Vortag und Kammprognose vom Vortag ---------- */
const pv = rd("prognose_vortag.json"), sp = rd("stunde_prognose.json");
if(!pv || !sp) throw new Error("eval/data/prognose_vortag.json oder stunde_prognose.json fehlt");
if(pv.zeit!=="ortszeit" || sp.zeit!=="ortszeit") throw new Error("Archive nicht in Ortszeit: node eval/zeitversatz.cjs");
const MODELS = Object.fromEntries(pv.models.map(x=>[x.id, x.spots]));
const K = sp.kamm, kamm = {};
K.time.forEach((t,i)=>{ kamm[t] = {cv:K.wind_speed_10m_previous_day1[i], cd:K.wind_direction_10m_previous_day1[i]}; });
const modell = (day, h, id) => {
  const key = day+"T"+String(h).padStart(2,"0")+":00", v = [];
  Object.values(MODELS).forEach(sps=>{ const s = sps.find(x=>x.id===id); if(!s) return; const i = s.idx ? s.idx[key] : s.h.time.indexOf(key);
    if(i!=null && i>=0 && s.h.ws[i]!=null) v.push(s.h.ws[i]); });
  return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null;
};
Object.values(MODELS).forEach(sps=>sps.forEach(s=>{ s.idx = {}; s.h.time.forEach((t,i)=>s.idx[t]=i); }));

/* ---------- Tage ---------- */
const modelDays = new Set(); Object.values(MODELS).forEach(sps=>sps.forEach(s=>s.h.time.forEach(t=>modelDays.add(t.slice(0,10)))));
const bis = o.teil==="dev" ? split.devBis : split.holdoutBis, von = o.teil==="dev" ? "0000" : split.devBis;
const alleTage = Object.keys(per).sort().filter(d=>modelDays.has(d) && d<=bis);
const tage = alleTage.filter(d=>d>von);
const L0 = C.LAGE;

/* Faktoren aus den Tagen «train» bestimmen */
function fit(train, St){
  const [h0,h1] = C.WINS[St.win], f = {}, info = {};
  Object.keys(L0.sek).forEach(lage=>{
    const ds = train.filter(d=>C.lageTag(kamm, d, St, L0)===lage);
    const frei = (L0.heben[lage]||[]).map(id=>[id,"heben"]).concat((L0.senken[lage]||[]).map(id=>[id,"senken"]));
    f[lage] = {}; info[lage] = {tage:ds.length};
    frei.forEach(([id, art])=>{
      let m = 0, p = 0, n = 0;
      ds.forEach(d=>{ for(let h=h0; h<=h1; h++){
        const mo = modell(d, h, id); if(mo==null || mo<L0.minModell) continue;
        const g = id==="mit" ? Math.max(gem(d,h,"vin")||0, gem(d,h,"ips")||0) || null : gem(d, h, id);
        if(g==null) continue; m += g; p += mo; n++; } });
      let q = n && p ? m/p : 1;
      if(ds.length<L0.minTage || !n) q = 1;
      else if(art==="heben") q = Math.max(1, q); else q = Math.min(1, Math.max(L0.minF, q));
      f[lage][id] = Math.round(q*100)/100; info[lage][id] = {roh:n&&p?Math.round(m/p*100)/100:null, std:n};
    });
  });
  return {f, info};
}
const LAGE_MIT = f => Object.assign({}, L0, {f});

function messe(win, T, St){
  St = St || C.merge(C.sanitizeCfg({T, win, minH:1, cut:2}));
  const c = {b:{tp:0,fp:0}, n:{tp:0,fp:0}, ev:0, nev:0, diff:[]};
  tage.forEach(d=>{
    const tr = C.lakeDay(per[d], d, St); if(!tr.known) return;
    const f = o.fest ? L0.f : fit(alleTage.filter(x=>x<d), St).f;
    const a = C.summarize(MODELS, d, St, kamm, {lage:null}), b = C.summarize(MODELS, d, St, kamm, {lage:LAGE_MIT(f)});
    if(a.level<0 || b.level<0) return;
    const A = a.level>=St.cut, B = b.level>=St.cut;
    if(tr.ev){ c.ev++; if(A) c.b.tp++; if(B) c.n.tp++; } else { c.nev++; if(A) c.b.fp++; if(B) c.n.fp++; }
    if(A!==B || o.tage) c.diff.push({d, lage:b.lage||"–", ev:tr.ev, a:a.level, b:b.level, f:b.lage?f[b.lage]:null});
  });
  return c;
}
const r2 = x => x==null ? "–" : x.toFixed(2);
const rate = (a,n) => n ? a/n : null;

console.log(`Lage-Faktor, ${o.teil==="dev"?"Entwicklungstage":"Holdout"} ${tage[0]||"–"} bis ${tage[tage.length-1]||"–"}, `
  + (o.fest ? "hinterlegte Faktoren (aus allen Entwicklungstagen, nicht unabhängig)" : "Faktoren nur aus früheren Tagen"));
FENSTER.forEach(win=>{
  const St = C.merge(C.sanitizeCfg({T:o.T, win, minH:1, cut:2}));
  const F = fit(alleTage.filter(d=>d<=split.devBis), St);
  console.log(`\nFenster ${C.WINS[win][2]}. Faktoren aus allen Entwicklungstagen: ` + Object.keys(F.f).map(l=>`${l} (${F.info[l].tage} Tage) `
    + Object.keys(F.f[l]).map(id=>`${id} ${F.f[l][id]} [roh ${r2(F.info[l][id].roh)}, ${F.info[l][id].std} h]`).join(", ")).join("; "));
  console.log("Schwelle  Recall B|neu   FPR B|neu      EV/NEV");
  [o.T, o.ctl].forEach(T=>{
    const c = messe(win, T);
    console.log(`${String(T).padStart(5)} kn  ${r2(rate(c.b.tp,c.ev))} | ${r2(rate(c.n.tp,c.ev))}    ${r2(rate(c.b.fp,c.nev))} | ${r2(rate(c.n.fp,c.nev))}    ${c.ev}/${c.nev}`);
    c.diff.forEach(x=>console.log(`          ${x.d} ${x.lage.padEnd(5)} ${x.ev?"foilbar":"ruhig  "} Stufe ${x.a} → ${x.b}${x.f?"  "+JSON.stringify(x.f):""}`));
  });
});
/* Einstellungen der Nutzer (users/*.json): Schwelle, Fenster, Mindestdauer und Alarmgrenze wie im Push */
const UD = path.join(ROOT,"users");
const users = fs.existsSync(UD) ? fs.readdirSync(UD).filter(f=>f.endsWith(".json")) : [];
if(users.length) console.log("\nEinstellungen der Nutzer\nNutzer    Schwelle  Fenster  Recall B|neu   FPR B|neu      EV/NEV");
users.forEach(f=>{
  let St; try{ St = C.merge(C.sanitizeCfg(JSON.parse(fs.readFileSync(path.join(UD,f),"utf8")))); }catch(e){ console.log(f, "nicht lesbar:", e.message); return; }
  const c = messe(St.win, St.T, St);
  console.log(`${f.replace(".json","").padEnd(9)} ${String(St.T).padStart(5)} kn  ${St.win.padEnd(7)}  ${r2(rate(c.b.tp,c.ev))} | ${r2(rate(c.n.tp,c.ev))}    ${r2(rate(c.b.fp,c.nev))} | ${r2(rate(c.n.fp,c.nev))}    ${c.ev}/${c.nev}`);
  c.diff.forEach(x=>console.log(`          ${x.d} ${x.lage.padEnd(5)} ${x.ev?"foilbar":"ruhig  "} Stufe ${x.a} → ${x.b}${x.f?"  "+JSON.stringify(x.f):""}`));
});
console.log("\nB = ohne Lage-Faktor (wie die App heute), neu = mit. Stufe ≥ Alarmgrenze (möglich) zählt als Alarm.");
