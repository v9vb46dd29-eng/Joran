#!/usr/bin/env node
/* Joran — Messung des Prognosemodells gegen die Seemessung. Derselbe Befehl misst jeden Stand.

   Wahrheit: Archiv der Seestationen Vingelz/Ipsach (archive/JJJJ-MM-TT.json im Repo und im Branch «live»), foilbar nach
   core.lakeDay (Zeitfenster und Mindestdauer aus den Einstellungen, Schwelle T als Parameter). eval/truth.json überstimmt die
   automatische Wahrheit; jede Abweichung wird ausgewiesen.
   Modell: Das Live-Signal der App wird in 10-min-Schritten nachgespielt (core.nowcast, Push-Bedingung wie push/check.cjs,
   mit Lieferverzug der Stationsdaten und Sturmsperre vom See).
   Gemessen wird das Gesamtmodell je Seestation sowie jede Upwind-Station je Windsystem:
   Recall, Fehlalarmrate (FPR), Precision, mittlere Vorlaufzeit (Minuten vom ersten Signal bis ≥ T kn am See), Fallzahl.

   Aufruf:  node eval/measure.cjs [Optionen]
     --T 12             Schwelle in kn (Standard: aus den Einstellungen)
     --kontrolle 14     Kontrollschwelle für die Akzeptanzregeln (Standard 14; bei --T 14 entfällt sie)
     --user NAME        Einstellungen aus users/NAME.json (Standard: simon)
     --basis SPEC       core.js der Baseline: Datei oder git:REV (Standard: git:origin/baseline-2026-11-10)
     --neu SPEC         core.js des gemessenen Stands (Standard: dieser Stand)
     --teil dev|holdout Entwicklungstage mit zeitlicher Kreuzvalidierung (Standard) oder Holdout;
                        «anpassung» misst die Entwicklungstage mit Parametern aus denselben Tagen (zu günstig, nur zur Einsicht)
     --offline          SwissMetNet nicht abrufen, nur Cache (eval/cache)
     --archive DIR      zusätzlicher Ordner mit Tagesdateien;  --no-git  Archiv im Branch origin/live nicht lesen
     --truth FILE       Markierungen (Standard: eval/truth.json, falls vorhanden)
     --fit              Modellparameter aus den Entwicklungstagen ausgeben (für core.js) und beenden
     --fest             Kopplung (H3) und Höhenwind (H4) nicht je Block bestimmen, sondern die hinterlegten Werte nehmen
     --verzug MIN       Lieferverzug der Upwind-Stationen: Beim Prüfschritt liegen nur Werte vor, die mindestens so alt
                        sind (Standard 10, bestimmt mit eval/verzug.cjs; 0 = wie vor dem 11.11.2026)
     --ohne-sturm       Sturmsperre vom See nicht nachspielen (wie vor dem 11.11.2026)
     --json FILE        Ergebnis zusätzlich als JSON
   Aufteilung (eval/split.json): Entwicklungstage bis devBis, Holdout danach bis holdoutBis (letzte rund 20 % der Tage).
   Der Holdout wird nur mit --teil holdout gelesen. Kreuzvalidierung: Die Entwicklungstage nach dem ersten Block werden in
   Blöcken gemessen; kann ein Stand Parameter bestimmen (core.fitModel), legt er sie je Block nur auf früheren Tagen fest.
   Im Holdout gelten die im Stand hinterlegten Parameter (core.MODEL). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), {execFileSync} = require("child_process");
const ROOT = path.join(__dirname, "..");
const C = require(path.join(ROOT, "core.js"));

/* ================= Optionen ================= */
/* Lieferverzug in Minuten: Alter des jüngsten SwissMetNet-Werts, den die Action beim Lauf sieht (eval/verzug.cjs) */
const VERZUG = 10;
function parseArgs(argv){
  const o = {T:null, ctl:14, user:null, basis:null, neu:null, teil:"dev", offline:false, archive:[], git:true, truth:null, fit:false, json:null, fest:false, verzug:VERZUG, sturm:true};
  for(let i=0; i<argv.length; i++){
    const a = argv[i], v = () => argv[++i];
    if(a==="--T") o.T = parseFloat(v()); else if(a==="--kontrolle") o.ctl = parseFloat(v()); else if(a==="--user") o.user = v();
    else if(a==="--basis") o.basis = v(); else if(a==="--neu") o.neu = v(); else if(a==="--teil") o.teil = v();
    else if(a==="--offline") o.offline = true; else if(a==="--archive") o.archive.push(v()); else if(a==="--no-git") o.git = false;
    else if(a==="--truth") o.truth = v(); else if(a==="--fit") o.fit = true; else if(a==="--json") o.json = v();
    else if(a==="--fest") o.fest = true; else if(a==="--verzug") o.verzug = parseFloat(v()); else if(a==="--ohne-sturm") o.sturm = false;
    else if(a==="-h" || a==="--help"){ console.log(fs.readFileSync(__filename,"utf8").split("*/")[0]); process.exit(0); }
    else throw new Error("unbekannte Option "+a);
  }
  if(!["dev","holdout","anpassung"].includes(o.teil)) throw new Error("--teil dev, anpassung oder holdout");
  if(!(o.verzug>=0 && o.verzug<=120)) throw new Error("--verzug 0–120 min");
  return o;
}
const git = args => execFileSync("git", args, {cwd:ROOT, encoding:"utf8", stdio:["ignore","pipe","ignore"], maxBuffer:256<<20});
const BASE_REFS = ["origin/baseline-2026-11-10", "baseline-2026-11-10"];
function loadCore(spec){
  if(!spec) return {K:C, name:"dieser Stand"};
  let file = spec;
  if(spec.startsWith("git:")){
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "joran-core-")), "core.js");
    fs.writeFileSync(file, git(["show", spec.slice(4)+":core.js"]));
  }
  return {K:require(path.resolve(file)), name:spec};
}
function loadBase(spec){
  if(spec) return loadCore(spec);
  for(const r of BASE_REFS){ try{ return loadCore("git:"+r); }catch(e){} }
  throw new Error("Baseline nicht gefunden (git fetch origin baseline-2026-11-10 oder --basis angeben)");
}
function loadSettings(user, T){
  const id = user || "simon", f = path.join(ROOT,"users",id+".json");
  const raw = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  const St = C.merge(C.sanitizeCfg(raw));
  if(T!=null){ if(!(T>=5 && T<=40)) throw new Error("--T ausserhalb 5–40 kn"); St.T = T; }
  return {id, St};
}

/* ================= Wahrheit: Archiv ================= */
const DAYF = /^(\d{4}-\d{2}-\d{2})\.json$/;
const DAY_CH = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"});
function loadArchive(dirs, useGit){
  const src = [], files = {};
  const add = (name, txt, where) => { try{ src.push(JSON.parse(txt)); files[name] = where; }
    catch(e){ console.error(`Archiv ${where}/${name}: nicht lesbar — übersprungen`); } };
  [path.join(ROOT,"archive")].concat(dirs||[]).forEach(dir=>{
    if(!fs.existsSync(dir)) return;
    fs.readdirSync(dir).filter(f=>DAYF.test(f)).forEach(f=>add(f, fs.readFileSync(path.join(dir,f),"utf8"), path.relative(ROOT,dir)||dir));
  });
  if(useGit){
    let ls = "";
    try{ ls = git(["ls-tree","origin/live","archive/"]); }catch(e){}
    ls.split("\n").filter(Boolean).forEach(l=>{ const [meta, name] = l.split("\t"); const f = path.basename(name);
      if(DAYF.test(f)) add(f, git(["cat-file","blob",meta.split(/\s+/)[2]]), "origin/live:archive"); });
  }
  const lk = {st:{}};
  C.LAKE.forEach(L=>{ const m = {}; src.forEach(o=>((o.st && o.st[L.id] && o.st[L.id].rows) || []).forEach(r=>{ if(r && r.t) m[r.t] = r; }));
    lk.st[L.id] = {rows:Object.values(m).sort((a,b)=>a.t<b.t?-1:1)}; });
  return {lk, nFiles:Object.keys(files).length};
}
/* Seezeilen nach Tag (Europe/Zurich) */
function lakeByDay(lk){
  const per = {};
  C.LAKE.forEach(L=>((lk.st[L.id]&&lk.st[L.id].rows)||[]).forEach(r=>{ const d = DAY_CH.format(new Date(r.t));
    const o = per[d] || (per[d] = {st:Object.fromEntries(C.LAKE.map(x=>[x.id,{rows:[]}]))}); o.st[L.id].rows.push(r); }));
  return per;
}

/* Markierungen prüfen (Format «Markierungen kopieren» der App). Unbekannte Einträge werden gemeldet und nicht verwendet. */
const MARK_DAY = /^\d{4}-\d{2}-\d{2}$/;
function checkMarks(raw){
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) throw new Error("Markierungen: kein JSON-Objekt");
  const sysIds = C.DIRS.map(d=>d.id), marks = {}, bad = [], n = {y:0, n:0, k:0, tl:0, sys:0};
  Object.keys(raw).forEach(k=>{ const v = raw[k];
    if(MARK_DAY.test(k)){ if(["y","n","k"].includes(v)){ marks[k] = v; n[v]++; } else if(v!=null && v!=="") bad.push(`${k}: «${v}» (erlaubt y, n, k)`); }
    else if(/^tl:/.test(k) && MARK_DAY.test(k.slice(3))){ if(v){ marks[k] = 1; n.tl++; } }
    else if(/^sys:/.test(k) && MARK_DAY.test(k.slice(4))){ if(sysIds.includes(v)){ marks[k] = v; n.sys++; } else if(v) bad.push(`${k}: «${v}» (erlaubt ${sysIds.join(", ")})`); }
    else bad.push(`${k}: unbekannter Eintrag`); });
  /* tl: und sys: wirken nur an Tagen, die als foilbar gelten */
  return {marks, bad, n};
}

/* ================= Stationsdaten (SwissMetNet, 10 min) ================= */
const CACHE = path.join(__dirname, "cache");
const toRows = a => (a||[]).map(r=>Object.assign({}, r, {t:new Date(r.t)})).filter(r=>r.mean!=null && !isNaN(r.t)).sort((a,b)=>a.t-b.t);
const uniq = rows => { const m = new Map(); rows.forEach(r=>m.set(+r.t, r)); return [...m.values()].sort((a,b)=>a.t-b.t); };
async function loadStations(abks, offline, from){
  const S = {}, err = {};
  for(const abk of abks){
    const f = path.join(CACHE, abk+".t.json");
    const cached = fs.existsSync(f) ? toRows(JSON.parse(fs.readFileSync(f,"utf8"))) : [];
    let fresh = [];
    if(!offline){
      for(const period of ["recent","now"]){
        try{ fresh = fresh.concat(await C.fetchStation(abk, "t", period)); }
        catch(e){ err[abk] = (err[abk] ? err[abk]+"; " : "") + `${period}: ${e.message||e}`; }
      }
    }
    const t = uniq(cached.concat(fresh));
    if(fresh.length){ fs.mkdirSync(CACHE, {recursive:true}); fs.writeFileSync(f, JSON.stringify(t)); }
    /* für die Messung nur der Zeitraum des Archivs (spart Speicher); der Cache behält alles */
    const use = from ? t.filter(r=>r.t>=from) : t;
    if(use.length) S[abk] = use; else err[abk] = err[abk] || "keine Daten";
  }
  return {S, err};
}

/* ================= Hilfen ================= */
const inArc = (d,a,b) => d!=null && (a<=b ? d>=a && d<b : d>=a || d<b);
const lastIdx = (rows, t) => { let lo = 0, hi = rows.length-1, k = -1; while(lo<=hi){ const m = (lo+hi)>>1; if(rows[m].t<=t){ k = m; lo = m+1; } else hi = m-1; } return k; };
const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
const rate = (a,b) => b ? a/b : null;
const fmtR = v => v==null ? "–" : v.toFixed(2);
const fmtM = v => v==null ? "–" : Math.round(v)+" min";

/* 10-min-Schritte eines Tages, an denen die Action das Live-Signal prüft (wie push/check.cjs: nicht in der Ruhezeit,
   ab 2 h vor dem Zeitfenster bis zu dessen Ende) */
function stepsOf(day, St){
  const [h0,h1] = C.WINS[St.win], out = [], base = Date.parse(day+"T00:00:00Z");
  for(let t=base-3*3600e3; t<base+25*3600e3; t+=600e3){
    const dt = new Date(t); if(DAY_CH.format(dt)!==day) continue;
    const hr = C.localHour(dt); if(hr<6 || hr>=21 || hr<h0-2 || hr>h1) continue;
    out.push(dt);
  }
  return out;
}
/* Live-Signal eines Tages nachspielen. Rückgabe: erster Push, erstes Signal je Station (mit System und Push-Fähigkeit), Regel E */
/* opt.verzug (min): Die Station liefert verzögert, beim Schritt t liegen nur Werte bis t − verzug vor.
   opt.lake (Tagesdatei der Seemessung): Sturmsperre vom See wie in der Action (core.lakeStorm mit den Werten bis t). Die
   Seemessung holt die Action im selben Lauf direkt, sie zählt ohne Verzug. res.storm = erster Schritt mit Sperre,
   res.held = erster Schritt, an dem nur die Sperre den Push verhindert hat. */
function replay(K, S, St, day, opt){
  const res = {push:null, sig:{}, e:null, n:0, storm:null, held:null};
  const lag = ((opt && opt.verzug) || 0)*60000;
  const lakeRows = opt && opt.lake ? Object.fromEntries(C.LAKE.map(L=>[L.id, ((opt.lake.st[L.id]||{}).rows||[]).map(r=>({ms:Date.parse(r.t), r})).sort((a,b)=>a.ms-b.ms)])) : null;
  for(const t of stepsOf(day, St)){
    const stn = {}, tv = new Date(t-lag);
    K.UPWIND.forEach(up=>{ const rows = S[up.abk]; if(!rows) return; const i = lastIdx(rows, tv); if(i>=0) stn[up.abk] = {rows:rows.slice(Math.max(0,i-8), i+1), at:t}; });
    const nc = K.nowcast(stn, St, t, null);
    /* Sturmsperre vom See mit diesem Stand gerechnet, für Baseline und neu gleich */
    const lkT = lakeRows ? {st:Object.fromEntries(C.LAKE.map(L=>[L.id, {rows:lakeRows[L.id].filter(x=>x.ms<=+t).slice(-3).map(x=>x.r)}]))} : null;
    const front = nc.front.length || (lkT && C.lakeStorm(lkT, St, t).length);
    if(front && !res.storm) res.storm = t;
    if(Object.values(stn).some(x=>K.fresh(x.rows, t))) res.n++;
    nc.sig.forEach(s=>{ const sys = s.up.tl ? "tl" : (s.u.sys && s.u.sys.id) || null, tr = K.isTrusted(s);
      const p = res.sig[s.up.abk];
      if(!p) res.sig[s.up.abk] = {t, sys, trusted:tr, tPush: tr ? t : null};
      else if(tr && !p.tPush){ p.tPush = t; p.trusted = true; } });
    if(nc.eOk && !res.e) res.e = t;
    if(!res.push && (nc.eOk || nc.trusted.length)){ if(!front) res.push = t; else if(!res.held) res.held = t; }
  }
  return res;
}

/* Windsystem eines foilbaren Tages (automatisch): Taubenlöchler, wenn am See Nord/Bise und Courtelary in den 2 h davor
   mehrheitlich im Talsektor (ohne Westwind auf dem Chasseral); Joran, wenn Cressier um den Beginn drei Werte in Folge im
   Sektor von Regel E und ≥ deren Minimum misst; sonst Richtung am See beim Beginn. */
function classify(a, S){
  if(!a.onset) return null;
  const t0 = a.onset, from = new Date(t0-2*3600e3), to = new Date(+t0+30*60e3);
  const lakeSys = (C.dirOf(a.dir)||{}).id || null;
  const win = (rows, f, t) => rows ? rows.filter(r=>r.t>=f && r.t<=t) : [];
  const coy = C.UPWIND.find(u=>u.tl);
  if(coy && ["n","bise"].includes(lakeSys) && S[coy.abk]){
    const w = win(S[coy.abk], from, t0), hit = w.filter(r=>inArc(r.dir, coy.sec[0], coy.sec[1])).length;
    const cha = S.cha ? win(S.cha, from, t0).slice(-3) : [];
    if(w.length>=3 && hit/w.length>=2/3 && !(cha.length && C.chaWest(cha))) return "tl";
  }
  if(S.crm){
    let run = 0;
    for(const r of win(S.crm, from, to)){
      if(r.dir!=null && r.dir>=C.REGEL_E.sector[0] && r.dir<=C.REGEL_E.sector[1] && r.mean>=C.REGEL_E.min){ if(++run>=3) return "joran"; }
      else run = 0;
    }
  }
  return lakeSys;
}

/* ================= Wahrheit je Schwelle ================= */
function buildTruth(per, days, St, marks, S){
  const spots = C.LAKE.map(L=>L.id);
  const one = id => Object.assign({}, St, {spots:Object.fromEntries(spots.map(x=>[x, x===id?1:0]))});
  const T = {see:{}, st:Object.fromEntries(spots.map(id=>[id,{}])), sys:{}, dev:[], nAuto:0, nMarked:0};
  days.forEach(d=>{
    const a = C.lakeDay(per[d], d, St);
    let v = a.known ? (a.ev ? "y" : "n") : null;
    const m = marks && marks[d];
    if(v) T.nAuto++;
    if(["y","n","k"].includes(m)){
      T.nMarked++;
      if(m==="k"){ if(v) T.dev.push({day:d, auto:v, marked:"k (zählt nicht)"}); v = null; }
      else { if(v!==m) T.dev.push({day:d, auto:v || "unbekannt", marked:m}); v = m; }
    }
    if(!v) return;
    T.see[d] = {v, onset: v==="y" && a.ev ? a.onset : null};
    spots.forEach(id=>{ const b = C.lakeDay(per[d], d, one(id));
      /* je Seestation nur die eigene Messung; eine Markierung gilt für den See als Ganzes und überstimmt hier nicht */
      if(b.known) T.st[id][d] = {v: b.ev ? "y" : "n", onset:b.onset}; });
    if(v==="y") T.sys[d] = (marks && marks["tl:"+d]) ? "tl" : (marks && marks["sys:"+d]) || (a.ev ? classify(a, S) : null);
  });
  return T;
}

/* ================= Messung eines Stands auf Testtagen ================= */
function score(K, S, St, T, testDays, modelFor, opt){
  const cnt = () => ({ev:0, tp:0, late:0, nev:0, fp:0, leads:[]});
  const fin = c => Object.assign(c, {rec:rate(c.tp,c.ev), fpr:rate(c.fp,c.nev), prec:rate(c.tp,c.tp+c.fp), lead:mean(c.leads)});
  const lake = {see:cnt()}; C.LAKE.forEach(L=>lake[L.id] = cnt());
  const up = {}; K.UPWIND.forEach(u=>{ up[u.abk] = {abk:u.abk, name:u.name, data:!!S[u.abk], cells:{}, push:0, nSig:0};
    (u.tl ? ["tl"] : u.sys.filter(id=>St.dirs[id])).forEach(s=>up[u.abk].cells[s] = cnt()); });
  const E = cnt(), log = [];
  testDays.forEach(d=>{
    const M = modelFor ? modelFor(d) : null;
    const R = replay(K, S, M ? Object.assign({}, St, {model:M}) : St, d, opt && {verzug:opt.verzug, lake:opt.sturm ? opt.per[d] : null});
    const add = (c, tr) => { if(!tr) return;
      if(tr.v==="y"){ c.ev++; if(R.push){ if(!tr.onset || R.push<=tr.onset) c.tp++; else c.late++; if(tr.onset) c.leads.push((tr.onset-R.push)/60000); } }
      else { c.nev++; if(R.push) c.fp++; } };
    add(lake.see, T.see[d]); C.LAKE.forEach(L=>add(lake[L.id], T.st[L.id][d]));
    const tr = T.see[d]; if(!tr) return;
    const sys = T.sys[d] || null;
    K.UPWIND.forEach(u=>{
      const row = up[u.abk], sg = R.sig[u.abk] || null;
      if(sg){ row.nSig++; if(sg.trusted) row.push++; }
      if(tr.v==="y"){ const c = row.cells[sys]; if(!c) return;
        c.ev++; if(sg){ if(!tr.onset || sg.t<=tr.onset) c.tp++; else c.late++; if(tr.onset) c.leads.push((tr.onset-sg.t)/60000); } }
      else Object.keys(row.cells).forEach(s=>{ const c = row.cells[s]; c.nev++; if(sg && sg.sys===s) c.fp++; });
    });
    if(tr.v==="y"){ if(sys==="joran"){ E.ev++; if(R.e){ if(!tr.onset || R.e<=tr.onset) E.tp++; else E.late++; if(tr.onset) E.leads.push((tr.onset-R.e)/60000); } } }
    else { E.nev++; if(R.e) E.fp++; }
    log.push({day:d, v:tr.v, sys, onset:tr.onset, push:R.push, storm:R.storm, held:R.held, by:Object.keys(R.sig).filter(k=>R.sig[k].trusted).join(",") + (R.e ? (Object.keys(R.sig).some(k=>R.sig[k].trusted)?",":"")+"E" : "")});
  });
  Object.values(lake).forEach(fin); fin(E);
  Object.values(up).forEach(r=>Object.values(r.cells).forEach(fin));
  return {lake, up, regelE:E, log};
}

/* Prognose-Stufe: Hätte die Prognose mit 24 h Vorlauf den Abend angekündigt (core.summarize, Stufe ≥ cut wie push/check.cjs)?
   Kann der Stand den Höhenwind prüfen (core.hoeheOk, H4), zählt die Prognose nur, wenn auch diese Bedingung erfüllt ist.
   Daten: eval/data/prognose_vortag.json (Open-Meteo Previous Runs) und eval/data/hoehenwind_icon_eu.json (Historical
   Forecast, kurze Vorlaufzeit, also eher zu günstig). Tage ohne Daten zählen nicht. */
function forecastStage(K, St, T, testDays, FC, modelFor){
  if(!FC || !FC.models) return null;
  const c = {ev:0, tp:0, nev:0, fp:0, skip:0};
  testDays.forEach(d=>{
    const tr = T.see[d]; if(!tr) return;
    let s = null; try{ s = K.summarize(FC.models, d, St); }catch(e){}
    if(!s || s.level==null || s.level<0){ c.skip++; return; }
    let alarm = s.level>=St.cut;
    /* Regel H4 mit den Parametern des Blocks; hat der Block keine Regel (zu wenige Abende), zählt die Prognose wie bisher */
    const P = K.hoeheDay && K.hoeheOk && K.MODEL ? (modelFor ? (modelFor(d)||{}).hoehe : K.MODEL.hoehe) : null;
    if(alarm && P && FC.hoehe){
      const hd = K.hoeheDay(FC.hoehe, d, St);
      if(!hd){ c.skip++; return; }
      alarm = K.hoeheOk(hd, Object.assign({}, St, {model:{hoehe:P}}));
    }
    if(tr.v==="y"){ c.ev++; if(alarm) c.tp++; } else { c.nev++; if(alarm) c.fp++; }
  });
  return Object.assign(c, {rec:rate(c.tp,c.ev), fpr:rate(c.fp,c.nev), prec:rate(c.tp,c.tp+c.fp)});
}

/* Kreuzvalidierung auf den Entwicklungstagen: erster Block nur zum Festlegen, danach Blöcke von je rund einem Fünftel */
function folds(dev){
  const n = dev.length; if(n<8) return [];
  const first = Math.max(3, Math.round(n*0.25)), k = 3, rest = n-first, out = [];
  for(let i=0; i<k; i++){ const a = first + Math.round(rest*i/k), b = first + Math.round(rest*(i+1)/k);
    if(b>a) out.push({train:dev.slice(0,a), test:dev.slice(a,b)}); }
  return out;
}

function measureAll({per, S, marks, St, ctl, cores, split, teil, FC, fest, verzug, sturm}){
  const nArchive = Object.keys(per).length;
  /* im Entwicklungslauf werden Tage nach devBis gar nicht angefasst */
  const all = Object.keys(per).sort().filter(d=>d<=(teil!=="holdout" ? split.devBis : split.holdoutBis));
  const known = all.filter(d=>C.lakeDay(per[d], d, St).known || (marks && ["y","n"].includes(marks[d])));
  const dev = known.filter(d=>d<=split.devBis), hold = known.filter(d=>d>split.devBis && d<=split.holdoutBis);
  const F = teil==="dev" ? folds(dev) : teil==="anpassung" ? [{train:dev, test:dev}] : [{train:dev, test:hold}];
  const test = F.flatMap(f=>f.test);
  const fitData = days => ({days, lake:per, S, St, hoehe:FC ? FC.hoehe : null});
  const ropt = {verzug:verzug||0, sturm:!!sturm, per};
  const one = (T, core) => {
    const Stt = Object.assign({}, St, {T}), TR = buildTruth(per, known, Stt, marks, S);
    let modelFor = null, models = [];
    if(core.K.fitModel && core.K.MODEL){
      if(teil!=="holdout"){ models = F.map(f=>core.K.fitModel(fitData(f.train), fest ? {fest:true} : null)); modelFor = d => models[F.findIndex(f=>f.test.includes(d))]; }
      else { const M = Object.assign({}, core.K.MODEL, {active:true}); models = [M]; modelFor = () => M; }
    }
    /* Prognose-Stufe nur auf Entwicklungstagen: Für den Holdout sind keine Höhendaten abgelegt */
    return {T, truth:TR, res:score(core.K, S, Stt, TR, test, modelFor, ropt), models, fc: teil!=="holdout" ? forecastStage(core.K, Stt, TR, test, FC, modelFor) : null};
  };
  const run = T => ({basis:one(T, cores.basis), neu:one(T, cores.neu)});
  const main = run(St.T), control = ctl && ctl!==St.T ? run(ctl) : null;

  /* Akzeptanzregeln (gegenüber der Baseline, bei der Hauptschwelle; Kontrollschwelle nur Recall) */
  const A = [], chk = (name, val, ok) => A.push({name, val, ok});
  const b = main.basis.res.lake, n = main.neu.res.lake;
  C.LAKE.forEach(L=>chk(`Recall ${L.name} steigt oder bleibt gleich`, `${fmtR(b[L.id].rec)} → ${fmtR(n[L.id].rec)} (${n[L.id].ev} Abende)`,
    b[L.id].rec==null || n[L.id].rec==null ? null : n[L.id].rec>=b[L.id].rec-1e-9));
  chk("FPR insgesamt steigt um höchstens 10 Prozentpunkte", `${fmtR(b.see.fpr)} → ${fmtR(n.see.fpr)}`, b.see.fpr==null||n.see.fpr==null ? null : n.see.fpr-b.see.fpr<=0.10+1e-9);
  chk("Mittlere Vorlaufzeit mindestens 30 min", fmtM(n.see.lead), n.see.lead==null ? null : n.see.lead>=30);
  if(control){ const cb = control.basis.res.lake.see, cn = control.neu.res.lake.see;
    chk(`Recall bei ${ctl} kn sinkt nicht`, `${fmtR(cb.rec)} → ${fmtR(cn.rec)} (${cn.ev} Abende)`, cb.rec==null||cn.rec==null ? null : cn.rec>=cb.rec-1e-9); }
  /* Ereignistage je Station und Windsystem: alle bekannten Tage des gemessenen Zeitraums */
  const sysN = {}; Object.values(main.neu.truth.sys).forEach(s=>{ if(s) sysN[s] = (sysN[s]||0)+1; });
  const cells = cores.neu.K.UPWIND.flatMap(u=>(u.tl ? ["tl"] : u.sys.filter(id=>St.dirs[id])).map(s=>({st:u.name, sys:s, ev:sysN[s]||0})));
  const few = cells.filter(c=>c.ev<10);
  chk("Je Station und Windsystem mindestens 10 Ereignistage", `${cells.length-few.length} von ${cells.length} Zellen (Ereignistage: ${Object.entries(sysN).map(([k,v])=>k+" "+v).join(", ")||"keine"})`, few.length===0);
  const core = A.slice(0,-1).map(a=>a.ok);
  const base = core.some(x=>x===false) ? "NICHT ERFÜLLT" : core.some(x=>x===null) ? "TEILWEISE NICHT AUSWERTBAR (keine Ereignisse)" : "ERFÜLLT";
  const verdict = A[A.length-1].ok ? base : `${base} — VORLÄUFIG (zu wenige Ereignistage: committen, nicht aktiv setzen)`;
  return {teil, settings:{T:St.T, ctl:control?ctl:null, win:St.win, minH:St.minH, verzug:ropt.verzug, sturm:ropt.sturm, fest:!!fest}, days:{archive:nArchive, known:known.length, dev:dev.length, hold:hold.length,
    devRange:[dev[0]||null, dev[dev.length-1]||null], holdRange:[hold[0]||null, hold[hold.length-1]||null], test:test.length, testRange:[test[0]||null, test[test.length-1]||null],
    folds:F.map(f=>({train:[f.train[0], f.train[f.train.length-1]], test:[f.test[0], f.test[f.test.length-1]], n:f.test.length}))},
    main, control, accept:A, fewCells:few, sysDays:sysN, verdict};
}

/* ================= Ausgabe ================= */
function report(R, meta){
  const L = [], p = (...a) => L.push(a.join(""));
  const pad = (s,n) => String(s).padEnd(n), lp = (s,n) => String(s).padStart(n), pair = (a,b,f) => `${f(a)} | ${f(b)}`;
  p(`Joran — Messung Prognosemodell (Stand ${meta.rev}; Baseline: ${meta.basis}; neu: ${meta.neu})`);
  p(`Einstellungen ${meta.user}: Fenster ${C.WINS[R.settings.win][2]}, Mindestdauer ${R.settings.minH} h; Schwelle ${R.settings.T} kn${R.settings.ctl?`, Kontrolle ${R.settings.ctl} kn`:""}`);
  p(`Nachspielen: Lieferverzug der Stationsdaten ${R.settings.verzug} min, Sturmsperre vom See ${R.settings.sturm ? "ein" : "aus"}`);
  const d = R.days;
  p(`Tage: ${d.archive} im Archiv, ${d.known} auswertbar; Entwicklung ${d.dev} (${d.devRange.join(" – ")})` + (R.teil==="holdout" ? `, Holdout ${d.hold} (${d.holdRange.join(" – ")})` : ", Holdout nicht ausgewertet"));
  p(R.teil==="anpassung" ? `Gemessen: ${d.test} Entwicklungstage mit Parametern aus denselben Tagen — zu günstig, zählt nicht für die Akzeptanz`
    : R.teil==="dev" ? `Gemessen: ${d.test} Entwicklungstage in ${d.folds.length} Blöcken (${d.folds.map(f=>f.test.join("–")).join("; ")}), Parameter jeweils nur aus früheren Tagen`
    : `Gemessen: Holdout, ${d.test} Tage, Parameter wie im Stand hinterlegt${meta.fitted ? ` (bestimmt auf ${meta.fitted.join(" – ")})` : ""}`);
  if(meta.err && Object.keys(meta.err).length) p(`Stationsdaten fehlen/teilweise: ${Object.entries(meta.err).map(([k,v])=>k+" ("+v+")").join("; ")}`);
  const block = (X, T) => {
    const t = X.neu.truth, tv = Object.values(t.see);
    p(""); p(`=== Schwelle ${T} kn ===`);
    p(`Wahrheit (alle Tage des Zeitraums): ${tv.length} Tage, ${tv.filter(x=>x.v==="y").length} foilbar, ${tv.filter(x=>x.v==="n").length} ruhig — automatisch ${t.nAuto}, markiert ${t.nMarked}, Abweichungen ${t.dev.length}`
      + (Object.keys(t.sys).length ? `; Windsysteme: ${Object.entries(Object.values(t.sys).reduce((o,s)=>(o[s||"unbekannt"]=(o[s||"unbekannt"]||0)+1,o),{})).map(([k,v])=>k+" "+v).join(", ")}` : ""));
    t.dev.forEach(x=>p(`  Abweichung ${x.day}: automatisch ${x.auto}, markiert ${x.marked}`));
    p(pad("Gesamtmodell",22), lp("Recall B|neu",15), lp("FPR B|neu",15), lp("Precision B|neu",17), lp("Vorlauf B|neu",19), lp("Fälle EV/NEV",14), lp("zu spät B|neu",15));
    [["see","See (Vingelz oder Ipsach)"]].concat(C.LAKE.map(x=>[x.id, x.name])).forEach(([id,name])=>{ const a = X.basis.res.lake[id], b = X.neu.res.lake[id];
      p(pad(name,22).slice(0,22)+(name.length>22?"":""), lp(pair(a.rec,b.rec,fmtR),15), lp(pair(a.fpr,b.fpr,fmtR),15), lp(pair(a.prec,b.prec,fmtR),17), lp(pair(a.lead,b.lead,fmtM),19), lp(`${b.ev}/${b.nev}`,14), lp(`${a.late} | ${b.late}`,15)); });
    if(X.basis.fc && X.neu.fc){ const a = X.basis.fc, b = X.neu.fc;
      p(pad("Prognose am Vortag",22), lp(pair(a.rec,b.rec,fmtR),15), lp(pair(a.fpr,b.fpr,fmtR),15), lp(pair(a.prec,b.prec,fmtR),17), lp("–",19), lp(`${b.ev}/${b.nev}`,14),
        `   (Stufe ≥ Alarmgrenze; neu zusätzlich Höhenwind 850 hPa bei durchmischter Luft${b.skip ? `; ${b.skip} Tage ohne Daten` : ""})`); }
    else p(pad("Prognose am Vortag",22), "  nicht gemessen (keine Archivprognosen für diesen Zeitraum)");
    p(pad("Upwind-Station",18), pad("System",7), lp("Schwelle B|neu",15), lp("Recall B|neu",15), lp("FPR B|neu",15), lp("Vorlauf B|neu",19), lp("EV/NEV",8), R.teil==="dev" ? "  Status neu (Parameter des letzten Blocks; frühere Blöcke können leer sein)" : "  Status neu");
    const Mn = X.neu.models[X.neu.models.length-1] || null;
    const ids = [...new Set(Object.keys(X.basis.res.up).concat(Object.keys(X.neu.res.up)))];
    ids.forEach(abk=>{ const a = X.basis.res.up[abk], b = X.neu.res.up[abk], r = b || a;
      const uB = meta.KB.UPWIND.find(u=>u.abk===abk), uN = meta.KN.UPWIND.find(u=>u.abk===abk);
      Object.keys(r.cells).forEach((s,i)=>{ const ca = a && a.cells[s], cb = b && b.cells[s];
        const e = Mn && uN && Mn.f[abk] && Mn.f[abk][s];
        const tsB = uB ? Math.round(T*uB.f) : "–", tsN = !uN ? "–" : e && e.f ? Math.max(3, Math.round(T*e.f)) : Math.round(T*uN.f);
        const status = !uN ? "entfernt" : !uB ? "neu" : !r.data ? "keine Daten" : e && e.rel===1 ? "vorläufig, Faktor "+e.f : e && e.rel===0 ? "vorläufig, nicht verlässlich" : (uN.extra ? "Startwert, zählt nicht" : e ? "Startwert (kein brauchbarer Faktor)" : "Startwert");
        p(pad(i?"":r.name,18), pad(s,7), lp(`${tsB} | ${tsN}`,15), lp(pair(ca&&ca.rec,cb&&cb.rec,fmtR),15), lp(pair(ca&&ca.fpr,cb&&cb.fpr,fmtR),15), lp(pair(ca&&ca.lead,cb&&cb.lead,fmtM),19), lp(`${(cb||ca).ev}/${(cb||ca).nev}`,8), "  "+status); }); });
    const ea = X.basis.res.regelE, eb = X.neu.res.regelE;
    p(pad("Regel E Cressier",18), pad("joran",7), lp("fest",15), lp(pair(ea.rec,eb.rec,fmtR),15), lp(pair(ea.fpr,eb.fpr,fmtR),15), lp(pair(ea.lead,eb.lead,fmtM),19), lp(`${eb.ev}/${eb.nev}`,8), "  aktiv (unverändert)");
    p("Tage (neu): " + X.neu.res.log.map(x=>`${x.day.slice(5)} ${x.v==="y"?"JA":"–"}${x.sys?"/"+x.sys:""}${x.push?" Push "+C.hhmm(x.push)+" ["+x.by+"]":""}${x.held?" Sturmsperre ab "+C.hhmm(x.held):""}${x.onset?" See "+C.hhmm(x.onset):""}`).join("; "));
    const held = X.neu.res.log.filter(x=>x.held);
    if(held.length) p(`Sturmsperre: an ${held.length} Tag(en) hielt sie den Push zurück (${held.map(x=>x.day.slice(5)+(x.push?", Push dann "+C.hhmm(x.push):", kein Push")).join("; ")})`);
    if(X.neu.models.length && X.neu.models[0]){ const fm = M => `Kopplung ${M.kopplung ? "ab "+M.kopplung.min+" K je km" : "keine Grenze"}, Höhenwind ${M.hoehe ? "ab "+M.hoehe.f+" × T" : "keine Regel"}`;
      p((R.settings.fest || R.teil==="holdout" ? "H3/H4 hinterlegt: " : "H3/H4 je Block: ") + (R.settings.fest || R.teil==="holdout" ? fm(X.neu.models[0]) : X.neu.models.map((M,i)=>`${i+1}) ${fm(M)}`).join("; "))); }
  };
  block(R.main, R.settings.T);
  if(R.control) block(R.control, R.settings.ctl);
  p(""); p("B = Baseline. Recall: Signal spätestens beim Beginn am See. Vorlauf: Mittel über alle foilbaren Abende mit Signal (negativ = zu spät).");
  p("FPR je Upwind-Station: Signal an ruhigen Abenden, dem Windsystem des Signals zugeordnet. Schwelle in kn bei dieser Seeschwelle.");
  p(""); p(`Akzeptanzregeln (${R.teil==="dev" ? "Entwicklungstage, Kreuzvalidierung" : R.teil==="anpassung" ? "nur zur Einsicht, Parameter aus denselben Tagen" : "Holdout"}):`);
  R.accept.forEach(a=>p(`  [${a.ok===null?"?":a.ok?"x":" "}] ${a.name}: ${a.val}`));
  p(`Ergebnis nach Regeln: ${R.verdict}`);
  /* Entscheid 11.11.2026: Die Regel «10 Ereignistage» gilt je Windsystem einzeln. Ein System mit 10 Abenden kann für sich
     zur Aktivierung vorgeschlagen werden, auch wenn andere Systeme noch zu wenige haben. */
  const sysAll = [...new Set(meta.KN.UPWIND.flatMap(u=>u.tl ? ["tl"] : u.sys))];
  p(`Ereignistage je Windsystem (Regel gilt je System einzeln, nötig 10): ${sysAll.map(s=>`${s} ${(R.sysDays||{})[s]||0}`).join(", ")}`
    + ` — bereit: ${sysAll.filter(s=>((R.sysDays||{})[s]||0)>=10).join(", ") || "keines"}`);
  return L.join("\n");
}

async function main(){
  const o = parseArgs(process.argv.slice(2));
  const {id, St} = loadSettings(o.user, o.T);
  const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
  const {lk, nFiles} = loadArchive(o.archive, o.git);
  const tf = o.truth || path.join(__dirname, "truth.json");
  if(o.truth && !fs.existsSync(tf)) throw new Error("Markierungsdatei fehlt: "+o.truth);
  const mk = fs.existsSync(tf) ? checkMarks(JSON.parse(fs.readFileSync(tf, "utf8"))) : null, marks = mk ? mk.marks : null;
  if(mk && mk.bad.length) console.error(`Markierungen: ${mk.bad.length} Eintrag/Einträge nicht verwendet — ${mk.bad.join("; ")}`);
  const cores = {basis:loadBase(o.basis), neu:loadCore(o.neu)};
  const abks = [...new Set(cores.basis.K.UPWIND.concat(cores.neu.K.UPWIND).map(u=>u.abk))];
  const per = lakeByDay(lk);
  const rd = f => { const q = path.join(__dirname, "data", f); return fs.existsSync(q) ? JSON.parse(fs.readFileSync(q, "utf8")) : null; };
  const first = Object.keys(per).sort()[0];
  const {S, err} = await loadStations(abks, o.offline, first ? new Date(Date.parse(first+"T00:00:00Z")-2*864e5) : null);
  if(o.fit){
    if(!cores.neu.K.fitModel) throw new Error("dieser Stand kann keine Parameter bestimmen");
    const dev = Object.keys(per).sort().filter(d=>d<=split.devBis && C.lakeDay(per[d], d, St).known);
    const M = cores.neu.K.fitModel({days:dev, lake:per, S, St, hoehe:rd("hoehenwind_icon_eu.json") ? rd("hoehenwind_icon_eu.json").hourly : null}, o.fest ? {fest:true} : null);
    console.log(JSON.stringify({fitted:M.fitted, kopplung:M.kopplung, hoehe:M.hoehe, f:M.f}));
    return;
  }
  const pv = rd("prognose_vortag.json"), hw = rd("hoehenwind_icon_eu.json");
  const FC = pv ? {models:Object.fromEntries(pv.models.map(x=>[x.id, x.spots])), hoehe:hw ? hw.hourly : null} : null;
  const R = measureAll({per, S, marks, St, ctl:o.ctl, cores, split, teil:o.teil, FC, fest:o.fest, verzug:o.verzug, sturm:o.sturm});
  let rev = "?"; try{ rev = git(["rev-parse","--short","HEAD"]).trim() + (git(["status","--porcelain","core.js","eval"]).trim() ? "+lokal" : ""); }catch(e){}
  const KN = cores.neu.K;
  console.log(report(R, {rev, user:id, basis:cores.basis.name, neu:cores.neu.name, err, KB:cores.basis.K, KN, fitted:KN.MODEL && KN.MODEL.fitted}));
  console.log(`Archiv: ${nFiles} Tagesdateien; Markierungen: ${mk ? `${path.relative(ROOT, tf)} (foilbar ${mk.n.y}, ruhig ${mk.n.n}, zählt nicht ${mk.n.k}, Taubenlöchler ${mk.n.tl}, Windsystem ${mk.n.sys})` : "keine (nur automatische Wahrheit)"}`);
  if(o.json) fs.writeFileSync(o.json, JSON.stringify(R, (k,v)=>k==="leads"||k==="models"?undefined:v, 1)+"\n");
}
if(require.main===module) main().catch(e=>{ console.error(e.message||e); process.exitCode = 1; });
module.exports = {VERZUG, checkMarks, measureAll, buildTruth, score, forecastStage, replay, folds, stepsOf, classify, loadArchive, lakeByDay, report};
