#!/usr/bin/env node
/* Joran — Messung der Upwind-Stationen gegen die Seemessung.
   Wahrheit: Archiv der Seestationen Vingelz/Ipsach (archive/JJJJ-MM-TT.json im Repo und im Branch «live»),
   foilbar nach core.lakeDay (Zeitfenster, Schwelle T und Mindestdauer minH aus den Einstellungen).
   eval/truth.json (Format wie «Markierungen kopieren» im Rückblick, optional «sys:Tag») überstimmt die automatische Wahrheit.
   Je Upwind-Station und Windsystem: Recall, Fehlalarmrate (FPR), Precision, mittlere Vorlaufzeit
   (Minuten vom ersten Stationssignal bis zum ersten 10-min-Wert ≥ T am See). Schwellen werden auf den früheren Tagen
   festgelegt (vorher: Peirce-Regel, nachher: Recall-Regel) und auf den späteren gemessen.

   Aufruf:  node eval/measure.cjs [Optionen]
     --user NAME        Einstellungen aus users/NAME.json (Standard: simon, sonst Grundeinstellungen)
     --archive DIR      zusätzlicher Ordner mit Tagesdateien (mehrfach möglich)
     --no-git           Archiv im Branch origin/live nicht lesen
     --stations DIR     Stationsdaten aus DIR (<abk>.t.json / <abk>.h.json oder SMN-CSV <abk>.t.csv / <abk>.h.csv)
     --offline          SwissMetNet nicht abrufen, nur Cache (eval/cache) bzw. --stations
     --truth FILE       Markierungen (Standard: eval/truth.json, falls vorhanden)
     --split 0.6        Anteil der früheren Tage für die Kalibrierung
     --vorher SPEC      core.js für «vorher»: Datei oder git:REV (Standard: dieser Stand, Regel pss)
     --nachher SPEC     core.js für «nachher» (Standard: dieser Stand, Regel recall)
     --vorher-rule R / --nachher-rule R   Kalibrierungsregel pss|recall
     --json FILE        Ergebnis zusätzlich als JSON
   Derselbe Befehl misst jeden Stand: Ohne Optionen vergleicht er die beiden Regeln dieses Stands auf denselben Tagen. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), {execFileSync} = require("child_process");
const ROOT = path.join(__dirname, "..");
const C = require(path.join(ROOT, "core.js"));

/* ================= Optionen ================= */
function parseArgs(argv){
  const o = {user:null, archive:[], git:true, stations:null, offline:false, truth:null, split:0.6,
    vorher:null, nachher:null, vorherRule:"pss", nachherRule:"recall", json:null};
  for(let i=0; i<argv.length; i++){
    const a = argv[i], v = () => argv[++i];
    if(a==="--user") o.user = v(); else if(a==="--archive") o.archive.push(v()); else if(a==="--no-git") o.git = false;
    else if(a==="--stations") o.stations = v(); else if(a==="--offline") o.offline = true; else if(a==="--truth") o.truth = v();
    else if(a==="--split") o.split = parseFloat(v()); else if(a==="--json") o.json = v();
    else if(a==="--vorher") o.vorher = v(); else if(a==="--nachher") o.nachher = v();
    else if(a==="--vorher-rule") o.vorherRule = v(); else if(a==="--nachher-rule") o.nachherRule = v();
    else if(a==="-h" || a==="--help"){ console.log(fs.readFileSync(__filename,"utf8").split("*/")[0]); process.exit(0); }
    else throw new Error("unbekannte Option "+a);
  }
  if(!(o.split>0 && o.split<1)) throw new Error("--split muss zwischen 0 und 1 liegen");
  return o;
}
const git = args => execFileSync("git", args, {cwd:ROOT, encoding:"utf8", stdio:["ignore","pipe","ignore"], maxBuffer:256<<20});
function loadCore(spec){
  if(!spec) return C;
  let file = spec;
  if(spec.startsWith("git:")){
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "joran-core-")), "core.js");
    fs.writeFileSync(file, git(["show", spec.slice(4)+":core.js"]));
  }
  return require(path.resolve(file));
}
function loadSettings(user){
  const id = user || (fs.existsSync(path.join(ROOT,"users","simon.json")) ? "simon" : null);
  if(!id) return {id:"Grundeinstellungen", St:C.merge({})};
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT,"users",id+".json"), "utf8"));
  return {id, St:C.merge(C.sanitizeCfg(raw))};
}

/* ================= Wahrheit: Archiv ================= */
const DAYF = /^(\d{4}-\d{2}-\d{2})\.json$/;
function loadArchive(dirs, useGit){
  const src = [], files = {};
  const add = (name, txt, where) => { try{ const o = JSON.parse(txt); src.push(o); (files[name] = files[name] || []).push(where); }
    catch(e){ console.error(`Archiv ${where}/${name}: nicht lesbar — übersprungen`); } };
  [path.join(ROOT,"archive")].concat(dirs).forEach(dir=>{
    if(!fs.existsSync(dir)) return;
    fs.readdirSync(dir).filter(f=>DAYF.test(f)).forEach(f=>add(f, fs.readFileSync(path.join(dir,f),"utf8"), path.relative(ROOT,dir)||dir));
  });
  if(useGit){
    let ls = "";
    try{ ls = git(["ls-tree","origin/live","archive/"]); }catch(e){}
    ls.split("\n").filter(Boolean).forEach(l=>{ const [meta, name] = l.split("\t"); const f = path.basename(name);
      if(DAYF.test(f)) add(f, git(["cat-file","blob",meta.split(/\s+/)[2]]), "origin/live:archive"); });
  }
  /* Zeilen je Station vereinigen (Zeitstempel eindeutig) */
  const lk = {st:{}};
  C.LAKE.forEach(L=>{ const m = {}; src.forEach(o=>((o.st && o.st[L.id] && o.st[L.id].rows) || []).forEach(r=>{ if(r && r.t) m[r.t] = r; }));
    lk.st[L.id] = {rows:Object.values(m).sort((a,b)=>a.t<b.t?-1:1)}; });
  return {lk, nFiles:Object.keys(files).length};
}

/* ================= Stationsdaten (SwissMetNet) ================= */
const CACHE = path.join(__dirname, "cache");
const toRows = a => (a||[]).map(r=>Object.assign({}, r, {t:new Date(r.t)})).filter(r=>r.mean!=null && !isNaN(r.t)).sort((a,b)=>a.t-b.t);
const uniq = rows => { const m = new Map(); rows.forEach(r=>m.set(+r.t, r)); return [...m.values()].sort((a,b)=>a.t-b.t); };
function readRows(dir, abk, kind){
  const j = path.join(dir, `${abk}.${kind}.json`), c = path.join(dir, `${abk}.${kind}.csv`);
  if(fs.existsSync(j)) return toRows(JSON.parse(fs.readFileSync(j,"utf8")));
  if(fs.existsSync(c)) return C.parseSMN(fs.readFileSync(c,"latin1"));
  return null;
}
/* Stundenwerte aus 10-min-Werten (Uhrzeit-Stunde, Zeitstempel = Stundenende wie bei SwissMetNet), Richtung als Vektormittel */
function hourly(rows){
  const by = new Map();
  rows.forEach(r=>{ const k = Math.floor(r.t/3600e3)*3600e3; (by.get(k) || by.set(k, []).get(k)).push(r); });
  return [...by.entries()].filter(([,a])=>a.length>=4).map(([k,a])=>{
    const mean = a.reduce((s,r)=>s+r.mean,0)/a.length;
    const d = a.filter(r=>r.dir!=null), x = d.reduce((s,r)=>s+r.mean*Math.sin(r.dir*Math.PI/180),0), y = d.reduce((s,r)=>s+r.mean*Math.cos(r.dir*Math.PI/180),0);
    return {t:new Date(k+3600e3), mean, dir: d.length ? (Math.atan2(x,y)*180/Math.PI+360)%360 : null, gust:Math.max(...a.map(r=>r.gust||0))};
  }).sort((a,b)=>a.t-b.t);
}
async function loadStations(o){
  const out = {}, err = {};
  for(const up of C.UPWIND){
    const abk = up.abk;
    let t = o.stations ? readRows(o.stations, abk, "t") : null, h = o.stations ? readRows(o.stations, abk, "h") : null;
    if(!o.stations){
      const cached = fs.existsSync(path.join(CACHE, abk+".t.json")) ? readRows(CACHE, abk, "t") : [];
      let fresh = [];
      if(!o.offline){
        for(const period of ["recent","now"]){
          try{ fresh = fresh.concat(await C.fetchStation(abk, "t", period)); }
          catch(e){ err[abk] = (err[abk] ? err[abk]+"; " : "") + `${period}: ${e.message||e}`; }
        }
      }
      t = uniq(cached.concat(fresh));
      if(fresh.length){ fs.mkdirSync(CACHE, {recursive:true}); fs.writeFileSync(path.join(CACHE, abk+".t.json"), JSON.stringify(t)); }
    }
    if(t && t.length) out[abk] = {t, h: h && h.length ? h : hourly(t)};
    else err[abk] = err[abk] || "keine Daten";
  }
  return {S:out, err};
}

/* ================= Hilfen ================= */
const inArc = (d,a,b) => d!=null && (a<=b ? d>=a && d<b : d>=a || d<b);
const lastIdx = (rows, t) => { let lo = 0, hi = rows.length-1, k = -1; while(lo<=hi){ const m = (lo+hi)>>1; if(rows[m].t<=t){ k = m; lo = m+1; } else hi = m-1; } return k; };
const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
const median = a => { if(!a.length) return null; const s = [...a].sort((x,y)=>x-y), m = s.length>>1; return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
const rate = (a,b) => b ? a/b : null;
/* Tageszuordnung (Europe/Zurich) einmal je Messreihe berechnen: Tag → Indizes */
const DAYF_CH = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"});
const dayIdx = new WeakMap();
function byDay(rows){
  if(!dayIdx.has(rows)){ const m = {}; rows.forEach((r,i)=>{ const d = DAYF_CH.format(r.t); (m[d] || (m[d]=[])).push(i); }); dayIdx.set(rows, m); }
  return dayIdx.get(rows);
}
const trustedFn = K => K.isTrusted || (s => (s.u.trust==null && !s.up.extra) || (s.u.trust!=null && s.u.trust>=0.25));

/* Erstes Signal einer Station an einem Tag (Fenster 2 h vor Beginn bis Ende), wie nowcast es live auslösen würde */
function stationSignal(K, rows, up, St, ts, cha, day){
  const [h0,h1] = K.WINS[St.win];
  const St2 = Object.assign({}, St, {st:{[up.abk]:{ts}}});
  let n = 0, sig = null;
  for(const i of byDay(rows)[day] || []){
    const r = rows[i];
    const hr = K.localHour(r.t); if(hr<h0-2 || hr>h1) continue;
    n++;
    if(sig) continue;
    let ch = null;
    if(cha){ const k = lastIdx(cha, r.t); if(k>=0 && r.t-cha[k].t < 50*60000) ch = cha.slice(Math.max(0,k-5), k+1); }
    const u = K.upwindNow(rows.slice(Math.max(0,i-5), i+1), up, St2, ch);
    if(u.ok) sig = {t:r.t, sys: up.tl ? "tl" : ((K.dirOf(u.last.dir)||{}).id || null)};
  }
  /* zu wenige Werte im Fenster: Tag für diese Station nicht auswertbar */
  return n >= 0.5*(h1-h0+2)*6 ? {sig} : null;
}
function ruleESignal(K, rows, St, day){
  const [h0,h1] = K.WINS[St.win];
  let n = 0, sig = null;
  for(const i of byDay(rows)[day] || []){
    const r = rows[i];
    const hr = K.localHour(r.t); if(hr<h0-2 || hr>h1) continue;
    n++;
    if(!sig && St.dirs.joran && K.ruleE(rows.slice(Math.max(0,i-5), i+1), St).ok) sig = {t:r.t, sys:"joran"};
  }
  return n >= 0.5*(h1-h0+2)*6 ? {sig} : null;
}

/* Windsystem eines foilbaren Tages (automatisch). Annahmen, siehe eval/README.md:
   Taubenlöchler: am See Nord/Bise und Courtelary in den 2 h davor mehrheitlich im Talsektor, ohne Westwind auf dem Chasseral.
   Joran: Cressier zwischen 2 h vor und 30 min nach Beginn drei Werte in Folge im Sektor von Regel E und ≥ deren Minimum.
   Sonst: Richtung am See beim Beginn. */
function classify(a, S){
  if(!a.onset) return null;
  const t0 = a.onset, from = new Date(t0-2*3600e3), to = new Date(+t0+30*60e3);
  const lakeSys = (C.dirOf(a.dir)||{}).id || null;
  const win = (rows, f, t) => rows ? rows.filter(r=>r.t>=f && r.t<=t) : [];
  const coy = C.UPWIND.find(u=>u.tl);
  if(coy && ["n","bise"].includes(lakeSys) && S[coy.abk]){
    const w = win(S[coy.abk].t, from, t0), hit = w.filter(r=>inArc(r.dir, coy.sec[0], coy.sec[1])).length;
    const cha = S.cha ? win(S.cha.t, from, t0).slice(-3) : [];
    if(w.length>=3 && hit/w.length>=2/3 && !(cha.length && C.chaWest(cha))) return "tl";
  }
  if(S.crm){
    let run = 0;
    for(const r of win(S.crm.t, from, to)){
      if(r.dir!=null && r.dir>=C.REGEL_E.sector[0] && r.dir<=C.REGEL_E.sector[1] && r.mean>=C.REGEL_E.min){ if(++run>=3) return "joran"; }
      else run = 0;
    }
  }
  return lakeSys;
}

/* ================= Messung (rein, ohne Ein-/Ausgabe) ================= */
function measure({lk, S, marks, St, split, cores}){
  /* 1. Wahrheit */
  /* Seezeilen nach Tag gruppieren, dann je Tag core.lakeDay */
  const perDay = {};
  C.LAKE.forEach(L=>((lk.st[L.id]&&lk.st[L.id].rows)||[]).forEach(r=>{ const d = DAYF_CH.format(new Date(r.t));
    const o = perDay[d] || (perDay[d] = {st:Object.fromEntries(C.LAKE.map(x=>[x.id,{rows:[]}]))}); o.st[L.id].rows.push(r); }));
  const days = Object.keys(perDay).sort();
  const auto = {}; days.forEach(d=>{ auto[d] = C.lakeDay(perDay[d], d, St); });
  const truth = {}, info = {}, dev = [];
  days.forEach(d=>{ const a = auto[d]; if(a.known) { truth[d] = a.ev ? "y" : "n"; info[d] = {src:"auto", onset:a.onset}; } });
  const nAuto = {y:days.filter(d=>truth[d]==="y").length, n:days.filter(d=>truth[d]==="n").length};
  let nMarked = 0;
  Object.keys(marks||{}).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort().forEach(d=>{
    const m = marks[d]; if(!["y","n","k"].includes(m)) return;
    nMarked++;
    const a = truth[d] || null;
    if(m==="k"){ if(a) dev.push({day:d, auto:a, marked:"k (zählt nicht)"}); delete truth[d]; delete info[d]; return; }
    if(a!==m) dev.push({day:d, auto:a || (auto[d] ? "unbekannt (zu wenige Werte)" : "kein Archiv"), marked:m});
    truth[d] = m; info[d] = {src:"markiert", onset: m==="y" && auto[d] && auto[d].ev ? auto[d].onset : null};
  });
  /* Windsystem der foilbaren Tage */
  const tmap = {}, sysOf = {}, jtyp = {};
  Object.keys(truth).forEach(d=>{
    tmap[d] = truth[d];
    if(truth[d]!=="y") return;
    const s = marks && marks["tl:"+d] ? "tl" : (marks && marks["sys:"+d]) || (auto[d] ? classify(auto[d], S) : null);
    sysOf[d] = s; if(s==="tl") tmap["tl:"+d] = 1; else if(s) tmap["sys:"+d] = s;
    /* Joran-Typ: Markierung «jtyp:Tag» = "dyn"|"stat", sonst core.joranType aus den Messwerten */
    if(s==="joran") jtyp[d] = (marks && ["dyn","stat"].includes(marks["jtyp:"+d]) && marks["jtyp:"+d])
      || (auto[d] && auto[d].onset && C.joranType ? C.joranType(auto[d].onset, S) : null) || "?";
  });
  const tdays = Object.keys(truth).sort();
  /* 2. Aufteilung: frühere Tage kalibrieren, spätere messen */
  const nTrain = tdays.length>=2 ? Math.min(tdays.length-1, Math.max(1, Math.floor(tdays.length*split))) : tdays.length;
  const train = tdays.slice(0, nTrain), test = tdays.slice(nTrain);

  /* 3. je Konfiguration (vorher / nachher): Schwellen auf train, Messung auf test */
  const run = cfg => {
    const K = cfg.core, trusted = trustedFn(K), st = {};
    const res = {label:cfg.label, rule:cfg.rule, stations:[], pooled:null, push:null, regelE:null};
    const pushSig = {};   /* Tag → frühestes Signal einer Push-fähigen Station */
    const note = (d, s) => { if(s && (!pushSig[d] || s.t<pushSig[d].t)) pushSig[d] = s; };
    K.UPWIND.forEach(up=>{
      const D = S[up.abk], cha = S.cha;
      const start = Math.round(St.T*up.f);
      const row = {abk:up.abk, name:up.name, systems: up.tl ? ["tl"] : up.sys.filter(id=>St.dirs[id]), data:!!D};
      if(D){
        const cal = K.calibrateStation(D.h, up, St, train, tmap, cha ? cha.h : null, cfg.rule);
        const b = cal.best;
        row.cal = {ev:cal.ev, nev:cal.nev, rule:cal.rule || "pss", ts:b && b.ts ? b.ts : null, rel:b ? b.rel : undefined,
          pss:b ? b.pss : null, recTrain:b && b.c ? Math.round(b.c.tp/b.c.ev*100)/100 : null};
        row.ts = b && b.ts ? b.ts : start;
        row.tsSrc = b && b.ts ? "kalibriert" : b && b.rel===0 ? "Startwert, nicht verlässlich" : "Startwert";
        /* wie nach «Stationsschwellen übernehmen» in der App: pss immer, rel nur nach Recall-Regel */
        row.trusted = trusted({u:{trust: b ? b.pss : null, rel: cal.rule==="recall" && b ? b.rel : undefined}, up}, cfg.rule);
      }
      /* Zählung je System und gesamt */
      const cells = {}; row.systems.forEach(x=>cells[x] = {ev:0, evAll:0, tp:0, nev:0, fp:0, leads:[], nodata:0});
      /* Joran-Tage getrennt nach Typ (nur zur Auswertung, nicht Teil der Akzeptanzregeln) */
      const jt = {}; if(cells.joran) ["dyn","stat","?"].forEach(k=>jt[k] = {ev:0, tp:0, leads:[]});
      const tot = {ev:0, tp:0, nev:0, fp:0, leads:[], nodata:0, tpIn:0};   /* tpIn: Signal spätestens beim Beginn am See */
      tdays.forEach(d=>{ if(truth[d]==="y" && cells[sysOf[d]]) cells[sysOf[d]].evAll++; });
      test.forEach(d=>{
        const e = K.evOf ? K.evOf(up, tmap, d) : C.evOf(up, tmap, d);
        if(!e) return;
        const sg = D ? stationSignal(K, D.t, up, St, row.ts, cha ? cha.t : null, d) : null;
        const cell = e==="ev" ? cells[sysOf[d]] : null;
        if(!sg){ tot.nodata++; if(cell) cell.nodata++; return; }
        const s = sg.sig;
        if(s && row.trusted) note(d, s);
        if(e==="ev"){
          tot.ev++; if(cell) cell.ev++;
          const J = sysOf[d]==="joran" && jt[jtyp[d]] ? jt[jtyp[d]] : null;
          if(J) J.ev++;
          if(s){ tot.tp++; if(cell) cell.tp++;
            const on = info[d] && info[d].onset;
            if(!on || s.t<=on) tot.tpIn++;
            if(J) J.tp++;
            if(on){ const L = (on - s.t)/60000; tot.leads.push(L); if(cell) cell.leads.push(L); if(J) J.leads.push(L); } }
        } else {
          tot.nev++; Object.values(cells).forEach(c=>c.nev++);
          if(s){ tot.fp++; if(cells[s.sys]) cells[s.sys].fp++; }
        }
      });
      const fin = c => Object.assign(c, {rec:rate(c.tp,c.ev), fpr:rate(c.fp,c.nev), prec:rate(c.tp,c.tp+c.fp), lead:mean(c.leads), leadMed:median(c.leads)});
      row.total = fin(tot); row.cells = Object.fromEntries(Object.entries(cells).map(([k,c])=>[k, fin(c)]));
      if(cells.joran) row.jtyp = Object.fromEntries(Object.entries(jt).map(([k,c])=>[k, Object.assign(c, {rec:rate(c.tp,c.ev), lead:mean(c.leads)})]));
      res.stations.push(row);
    });
    /* Regel E (fest, nicht kalibriert) */
    if(S.crm){
      const c = {ev:0, tp:0, nev:0, fp:0, leads:[]};
      test.forEach(d=>{
        const e = truth[d]==="y" ? (sysOf[d]==="joran" || !sysOf[d] ? "ev" : null) : "nev"; if(!e) return;
        const sg = ruleESignal(K, S.crm.t, St, d); if(!sg) return;
        if(sg.sig) note(d, sg.sig);
        if(e==="ev"){ c.ev++; if(sg.sig){ c.tp++; const on = info[d] && info[d].onset; if(on) c.leads.push((on-sg.sig.t)/60000); } }
        else { c.nev++; if(sg.sig) c.fp++; }
      });
      res.regelE = Object.assign(c, {rec:rate(c.tp,c.ev), fpr:rate(c.fp,c.nev), prec:rate(c.tp,c.tp+c.fp), lead:mean(c.leads)});
    }
    /* über alle Stationen zusammen: Summe der Stationen, die nach der Regel Push auslösen dürfen; Treffer nur, wenn das
       Signal spätestens beim Beginn am See kam (ein späteres Signal kündigt nichts mehr an). Fehlalarme und Vorlauf wie gezählt. */
    const P = {ev:0, tp:0, nev:0, fp:0, leads:[]};
    /* Recall: Windtage aller Stationen (eine stillgelegte Station verpasst ihre Tage); FPR: nur Push-fähige Stationen */
    res.stations.forEach(r=>{ P.ev+=r.total.ev;
      if(r.data && r.trusted){ P.tp+=r.total.tpIn; P.fp+=r.total.fp; P.nev+=r.total.nev; P.leads.push(...r.total.leads); } });
    res.pooled = Object.assign(P, {rec:rate(P.tp,P.ev), fpr:rate(P.fp,P.nev), prec:rate(P.tp,P.tp+P.fp), lead:mean(P.leads), leadMed:median(P.leads)});
    /* Push-Sicht: Tag erkannt, wenn eine Push-fähige Station oder Regel E meldet */
    const Q = {ev:0, tp:0, nev:0, fp:0, leads:[]};
    test.forEach(d=>{ const s = pushSig[d], on = info[d] && info[d].onset;
      if(truth[d]==="y"){ Q.ev++; if(s && (!on || s.t<=on)){ Q.tp++; const on = info[d] && info[d].onset; if(on) Q.leads.push((on-s.t)/60000); } }
      else { Q.nev++; if(s) Q.fp++; } });
    res.push = Object.assign(Q, {rec:rate(Q.tp,Q.ev), fpr:rate(Q.fp,Q.nev), prec:rate(Q.tp,Q.tp+Q.fp), lead:mean(Q.leads)});
    return res;
  };
  const V = run(cores.vorher), N = run(cores.nachher);

  /* 4. Akzeptanzregeln */
  const cellsN = N.stations.flatMap(r=>r.systems.map(x=>({st:r.name, sys:x, ev:r.cells[x].evAll})));
  const few = cellsN.filter(c=>c.ev<10);
  const A = [];
  const chk = (name, val, ok) => A.push({name, val, ok});
  const pv = V.pooled, pn = N.pooled;
  chk("Recall gesamt steigt oder bleibt gleich", `${fmtR(pv.rec)} → ${fmtR(pn.rec)}`, pv.rec==null||pn.rec==null ? null : pn.rec>=pv.rec-1e-9);
  chk("FPR steigt um höchstens 10 Prozentpunkte", `${fmtR(pv.fpr)} → ${fmtR(pn.fpr)}`, pv.fpr==null||pn.fpr==null ? null : pn.fpr-pv.fpr<=0.10+1e-9);
  chk("Vorlaufzeit mindestens 30 min", `${fmtM(pn.lead)}`, pn.lead==null ? null : pn.lead>=30);
  chk("Schwellen auf früheren Tagen festgelegt, auf späteren gemessen",
    train.length && test.length ? `${train[0]}–${train[train.length-1]} | ${test[0]}–${test[test.length-1]}` : "keine Aufteilung möglich",
    train.length && test.length ? train[train.length-1] < test[0] : null);
  chk("Je Station und Windsystem ≥ 10 Ereignistage", `${cellsN.length-few.length} von ${cellsN.length} Zellen`, few.length===0);
  const core4 = A.slice(0,4).map(a=>a.ok);
  const base = core4.some(x=>x===false) ? "NICHT ERFÜLLT" : core4.some(x=>x===null) ? "NICHT AUSWERTBAR" : "ERFÜLLT";
  const verdict = A[4].ok ? base : `${base} — VORLÄUFIG (zu wenige Ereignistage: Regel nur committen, nicht aktiv setzen)`;
  return {settings:{T:St.T, win:St.win, minH:St.minH, spots:C.LAKE.filter(L=>St.spots[L.id]).map(L=>L.id)},
    truth:{days:days.length, known:tdays.length, auto:nAuto, marked:nMarked, deviations:dev, y:tdays.filter(d=>truth[d]==="y").length,
      n:tdays.filter(d=>truth[d]==="n").length, sys:countBy(Object.values(sysOf)), jtyp:countBy(Object.values(jtyp))},
    split:{train:train.length, test:test.length, trainRange:[train[0]||null, train[train.length-1]||null], testRange:[test[0]||null, test[test.length-1]||null]},
    vorher:V, nachher:N, accept:A, fewCells:few, verdict};
}
const countBy = a => a.reduce((o,x)=>(o[x||"unbekannt"]=(o[x||"unbekannt"]||0)+1, o), {});
const fmtR = v => v==null ? "–" : v.toFixed(2);
const fmtM = v => v==null ? "–" : Math.round(v)+" min";

/* ================= Ausgabe ================= */
function report(R, meta){
  const L = [];
  const p = (...a) => L.push(a.join(""));
  p(`Joran — Messung Upwind-Stationen (Stand ${meta.rev}; vorher: ${meta.vorher}, nachher: ${meta.nachher})`);
  p(`Einstellungen ${meta.user}: Schwelle ${R.settings.T} kn, Fenster ${C.WINS[R.settings.win][2]}, Mindestdauer ${R.settings.minH} h, Seestationen ${R.settings.spots.join("/")}`);
  const t = R.truth;
  p(`Wahrheit: ${t.known} Tage (${t.y} foilbar, ${t.n} ruhig) aus ${t.days} Archivtagen — automatisch ${t.auto.y+t.auto.n} (${t.auto.y} foilbar, ${t.auto.n} ruhig), markiert ${t.marked}, Abweichungen ${t.deviations.length}`);
  t.deviations.forEach(d=>p(`  Abweichung ${d.day}: automatisch ${d.auto}, markiert ${d.marked}`));
  if(t.y) p(`Windsysteme der foilbaren Tage: ${Object.entries(t.sys).map(([k,v])=>k+" "+v).join(", ")}`);
  if(t.jtyp && Object.keys(t.jtyp).length) p(`Joran-Typ: ${Object.entries(t.jtyp).map(([k,v])=>({dyn:"dynamique",stat:"statique","?":"unbestimmt"}[k]||k)+" "+v).join(", ")}`);
  p(`Aufteilung: Kalibrierung ${R.split.train} Tage (${R.split.trainRange.join(" – ")}), Messung ${R.split.test} Tage (${R.split.testRange.join(" – ")})`);
  if(meta.err && Object.keys(meta.err).length) p(`Stationsdaten fehlen/teilweise: ${Object.entries(meta.err).map(([k,v])=>k+" ("+v+")").join("; ")}`);
  p("");
  const pad = (s,n) => String(s).padEnd(n), lp = (s,n) => String(s).padStart(n);
  const pair = (a,b,f) => `${f(a)} | ${f(b)}`;
  p(pad("Station",18), pad("System",8), lp("Schwelle v|n",14), lp("Recall v|n",14), lp("FPR v|n",14), lp("Precision v|n",15), lp("Vorlauf v|n",17), lp("Fälle Test (EV/NEV) | gesamt EV",33));
  R.nachher.stations.forEach((n,i)=>{
    const v = R.vorher.stations[i];
    const tsTxt = r => r.data ? `${r.ts}${r.cal && r.cal.rel===0 ? "!" : r.tsSrc==="kalibriert" ? "" : "*"}` : "–";
    p(pad(n.name,18), pad("alle",8), lp(`${tsTxt(v)} | ${tsTxt(n)}`,14), lp(pair(v.total.rec,n.total.rec,fmtR),14), lp(pair(v.total.fpr,n.total.fpr,fmtR),14),
      lp(pair(v.total.prec,n.total.prec,fmtR),15), lp(pair(v.total.lead,n.total.lead,fmtM),17), lp(`${n.total.ev}/${n.total.nev} | ${n.systems.reduce((a,x)=>a+n.cells[x].evAll,0)}`,33),
      n.data ? (n.trusted ? "" : "  (löst nach Regel keinen Push aus)") : "  keine Stationsdaten");
    n.systems.forEach(x=>{ const a = v.cells[x], b = n.cells[x];
      p(pad("",18), pad(x,8), lp("",14), lp(pair(a.rec,b.rec,fmtR),14), lp(pair(a.fpr,b.fpr,fmtR),14), lp(pair(a.prec,b.prec,fmtR),15), lp(pair(a.lead,b.lead,fmtM),17), lp(`${b.ev}/${b.nev} | ${b.evAll}`,33));
      if(x==="joran" && n.jtyp) ["dyn","stat"].forEach(k=>{ const a2 = v.jtyp[k], b2 = n.jtyp[k]; if(!b2.ev) return;
        p(pad("",18), pad("  "+k,8), lp("",14), lp(pair(a2.rec,b2.rec,fmtR),14), lp("",14), lp("",15), lp(pair(a2.lead,b2.lead,fmtM),17), lp(`${b2.ev} Test`,33)); }); });
  });
  const pv = R.vorher.pooled, pn = R.nachher.pooled;
  p(pad("ALLE (Push-fähig)",26), lp("",14), lp(pair(pv.rec,pn.rec,fmtR),14), lp(pair(pv.fpr,pn.fpr,fmtR),14), lp(pair(pv.prec,pn.prec,fmtR),15), lp(pair(pv.lead,pn.lead,fmtM),17), lp(`${pn.ev}/${pn.nev}`,33));
  const qv = R.vorher.push, qn = R.nachher.push;
  p(pad("Push (Tag erkannt)",26), lp("",14), lp(pair(qv.rec,qn.rec,fmtR),14), lp(pair(qv.fpr,qn.fpr,fmtR),14), lp(pair(qv.prec,qn.prec,fmtR),15), lp(pair(qv.lead,qn.lead,fmtM),17), lp(`${qn.ev}/${qn.nev}`,33));
  if(R.nachher.regelE){ const e = R.nachher.regelE;
    p(pad("Regel E Cressier",18), pad("joran",8), lp("fest",14), lp(fmtR(e.rec),14), lp(fmtR(e.fpr),14), lp(fmtR(e.prec),15), lp(fmtM(e.lead),17), lp(`${e.ev}/${e.nev}`,33)); }
  p("Schwelle: * = Startwert (nicht kalibriert), ! = Startwert, Station nach Recall-Regel nicht verlässlich. Vorlauf = Mittel, negativ = Signal nach Seebeginn.");
  p("ALLE / Push: nur Stationen, die nach der Regel Push auslösen; Treffer nur mit Signal spätestens beim Beginn am See (Grundlage der Akzeptanz).");
  p("");
  p("Akzeptanzregeln:");
  R.accept.forEach(a=>p(`  [${a.ok===null?"?":a.ok?"x":" "}] ${a.name}: ${a.val}`));
  if(R.fewCells.length) p(`  Zellen unter 10 Ereignistagen: ${R.fewCells.map(c=>`${c.st}/${c.sys} ${c.ev}`).join(", ")}`);
  p(`Ergebnis nach Regeln: ${R.verdict}`);
  return L.join("\n");
}

async function main(){
  const o = parseArgs(process.argv.slice(2));
  const {id, St} = loadSettings(o.user);
  const {lk, nFiles} = loadArchive(o.archive, o.git);
  const tf = o.truth || path.join(__dirname, "truth.json");
  const marks = fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, "utf8")) : null;
  if(o.truth && !marks) throw new Error("Markierungsdatei fehlt: "+o.truth);
  const {S, err} = await loadStations(o);
  const cores = {vorher:{label:"vorher", core:loadCore(o.vorher), rule:o.vorherRule}, nachher:{label:"nachher", core:loadCore(o.nachher), rule:o.nachherRule}};
  const R = measure({lk, S, marks, St, split:o.split, cores});
  let rev = "?"; try{ rev = git(["rev-parse","--short","HEAD"]).trim() + (git(["status","--porcelain","core.js","eval"]).trim() ? "+lokal" : ""); }catch(e){}
  console.log(report(R, {rev, user:id, vorher:`${o.vorher||"dieser Stand"}/${o.vorherRule}`, nachher:`${o.nachher||"dieser Stand"}/${o.nachherRule}`, err}));
  console.log(`Archiv: ${nFiles} Tagesdateien; Markierungen: ${marks ? path.relative(ROOT, tf) : "keine (nur automatische Wahrheit)"}`);
  if(o.json) fs.writeFileSync(o.json, JSON.stringify(R, (k,v)=>k==="leads"?undefined:v, 1)+"\n");
}
if(require.main===module) main().catch(e=>{ console.error(e.message||e); process.exitCode = 1; });
module.exports = {measure, classify, stationSignal, ruleESignal, hourly, loadArchive, report};
