/* Joran — Rechenkern. Wird von index.html (Browser) und push/check.cjs (GitHub Action) gemeinsam genutzt.
   Keine Abhängigkeiten, keine KI: nur Open-Meteo, MeteoSchweiz und feste Regeln. */
(function(root){
"use strict";

/* ================= Konstanten ================= */
const SPOTS = [
  {id:"vin", name:"Vingelz",  lat:47.127, lon:7.218},
  {id:"ips", name:"Ipsach",   lat:47.119, lon:7.224},
  {id:"mit", name:"Seemitte", lat:47.088, lon:7.180}
];
const JURA = {lat:47.100, lon:6.830};
const KN = 1/1.852;

const MODELS = [
  {id:"meteoswiss_icon_ch1", name:"ICON-CH1", note:"MeteoSchweiz 1 km"},
  {id:"meteoswiss_icon_ch2", name:"ICON-CH2", note:"MeteoSchweiz 2 km"},
  {id:"icon_d2",             name:"ICON-D2",  note:"DWD 2 km"},
  {id:"meteofrance_arome_france_hd", name:"AROME", note:"Météo-France 1.3 km"}
];
const ENS_IDS = ["icon_d2_eps","icon_d2"];

const DIRS = [
  {id:"n",     name:"Nord",     a:340, b:20},
  {id:"bise",  name:"Bise",     a:20,  b:110},
  {id:"so",    name:"Südost",   a:110, b:160},
  {id:"s",     name:"Süd",      a:160, b:215},
  {id:"w",     name:"West/SW",  a:215, b:280},
  {id:"joran", name:"Joran/NW", a:280, b:340}
];
const WINS = {abend:[16,21,"Abend 16–21"], nami:[12,21,"Nachmittag 12–21"], tag:[9,21,"Tag 9–21"]};
const LEVELS = ["unwahrscheinlich","knapp","möglich","wahrscheinlich","sehr wahrscheinlich"];

/* Upwind-Stationen: welche Windsysteme sie früh anzeigen. f = Startwert Stationsschwelle / Seeschwelle,
   bis die Kalibrierung einen eigenen Wert liefert. Landstationen messen weniger als der See. */
const UPWIND = [
  {abk:"crm", name:"Cressier",  sys:["joran","w"],  f:0.85, role:"Jurasüdfuss, 10 km westlich"},
  {abk:"cha", name:"Chasseral", sys:["joran","n"],  f:1.15, role:"Jurakamm 1594 m, Höhenwind"},
  {abk:"neu", name:"Neuchâtel", sys:["w","s"],      f:0.85, role:"Neuenburgersee, 25 km SW"},
  {abk:"pay", name:"Payerne",   sys:["w","s","so"], f:0.8,  role:"Broyetal, 35 km SW"},
  {abk:"gre", name:"Grenchen",  sys:["bise","n"],   f:0.8,  role:"Jurasüdfuss, 15 km NO"},
  {abk:"wyn", name:"Wynau",     sys:["bise"],       f:0.75, role:"Aaretal, 40 km NO"},
  {abk:"mub", name:"Mühleberg", sys:["s","so"],     f:0.75, role:"Mittelland, 25 km S"}
];
const LAKE_LEVEL = ["crm","neu","gre","pay"];     /* für die Böenfront-Prüfung */
const REGEL_E = {sector:[270,350], min:10, foil:12};

const DEF = {T:14, win:"abend", minH:1, dirs:{n:1,bise:1,so:1,s:1,w:1,joran:1}, spots:{vin:1,ips:1,mit:1},
  k:1, kDir:{}, cut:2, st:{}, push:false, pushForecast:true, pushLive:true};

/* ================= Helfer ================= */
const clone = o => JSON.parse(JSON.stringify(o));
const r0 = v => v==null||isNaN(v) ? "–" : String(Math.round(v));
const r1 = v => v==null||isNaN(v) ? null : Math.round(v*10)/10;
const card = d => d==null ? "–" : ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(d/22.5)%16];
const inArc = (d,a,b) => d!=null && (a<=b ? d>=a && d<b : d>=a || d<b);
const dirOf = d => d==null ? null : (DIRS.find(x=>inArc(((d%360)+360)%360, x.a, x.b)) || null);
const dirOn = (d,St) => { const x = dirOf(d); return !!(x && St.dirs[x.id]); };
const over = (v,St) => v!=null && Math.round(v)>=St.T;          /* gerundet vergleichen, wie angezeigt */
const kFor = (d,St) => { const x = dirOf(d); return (x && St.kDir && St.kDir[x.id]) || St.k; };
const spotName = id => (SPOTS.find(s=>s.id===id)||{}).name || id;
const merge = s => { const o = Object.assign(clone(DEF), s||{});
  o.dirs = Object.assign({}, DEF.dirs, (s&&s.dirs)||{}); o.spots = Object.assign({}, DEF.spots, (s&&s.spots)||{});
  o.kDir = Object.assign({}, (s&&s.kDir)||{}); o.st = Object.assign({}, (s&&s.st)||{}); return o; };

function fmtCH(dt, opts){ return new Intl.DateTimeFormat("de-CH", Object.assign({timeZone:"Europe/Zurich"}, opts)).format(dt); }
const hhmm = dt => fmtCH(dt,{hour:"2-digit",minute:"2-digit"});
function localDay(off, now){
  const t = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"}).format(now||new Date());
  const [y,m,d] = t.split("-").map(Number);
  return new Date(Date.UTC(y,m-1,d+off,12)).toISOString().slice(0,10);
}
const localHour = now => parseInt(fmtCH(now||new Date(),{hour:"2-digit",hour12:false}),10) % 24;
const dayOfDate = dt => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"}).format(dt);
const dayLabel = (day, o) => fmtCH(new Date(day+"T12:00:00Z"), o||{weekday:"short",day:"numeric",month:"numeric"});

/* ================= Datenabruf ================= */
async function getJSON(url, ms){
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(), ms||20000);
  try{
    const r = await fetch(url, {signal:ctl.signal});
    if(!r.ok){
      let msg = "HTTP "+r.status;
      try{ const j = await r.json(); if(j && j.reason) msg += " — "+j.reason; }catch(e){}
      throw new Error(msg);
    }
    return await r.json();
  } catch(e){ if(e.name==="AbortError") throw new Error("Zeitüberschreitung"); throw e; }
  finally { clearTimeout(t); }
}
async function getText1252(url, ms){
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(), ms||20000);
  try{
    const r = await fetch(url, {signal:ctl.signal});
    if(!r.ok) throw new Error("HTTP "+r.status);
    return new TextDecoder("windows-1252").decode(await r.arrayBuffer());
  } catch(e){ if(e.name==="AbortError") throw new Error("Zeitüberschreitung"); throw e; }
  finally { clearTimeout(t); }
}
const coordQ = () => `latitude=${SPOTS.map(s=>s.lat).join(",")}&longitude=${SPOTS.map(s=>s.lon).join(",")}`;
function indexTimes(t){ const m = {}; t.forEach((x,i)=>m[x]=i); return m; }

function normSpots(j, suffix){
  const arr = Array.isArray(j) ? j : [j];
  return SPOTS.map((sp,i)=>{
    const o = arr[i]; if(!o || !o.hourly) return null;
    const hh = o.hourly, sf = suffix||"";
    const h = {time:hh.time, ws:hh["wind_speed_10m"+sf], wd:hh["wind_direction_10m"+sf], wg:hh["wind_gusts_10m"+sf]||null, cape:hh["cape"+sf]||null};
    if(!h.ws || !h.wd) return null;
    return {id:sp.id, h, idx:indexTimes(hh.time), cell:{lat:o.latitude, lon:o.longitude}};
  }).filter(Boolean);
}
async function fetchModel(m){
  const u = "https://api.open-meteo.com/v1/forecast?" + coordQ()
    + "&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape"
    + `&models=${m.id}&wind_speed_unit=kn&timezone=Europe%2FZurich&forecast_days=4&cell_selection=sea`;
  const sp = normSpots(await getJSON(u));
  if(!sp.length) throw new Error("keine Stundenwerte");
  return sp;
}
async function fetchEnsemble(){
  let lastErr = null;
  for(const id of ENS_IDS){
    try{
      const u = "https://ensemble-api.open-meteo.com/v1/ensemble?" + coordQ()
        + `&hourly=wind_speed_10m,wind_direction_10m&models=${id}&wind_speed_unit=kn&timezone=Europe%2FZurich&forecast_days=3&cell_selection=sea`;
      const j = await getJSON(u);
      const arr = Array.isArray(j) ? j : [j];
      const keys = Object.keys(arr[0].hourly||{}).filter(k=>/^wind_speed_10m(_member\d+)?$/.test(k));
      if(keys.length<5) throw new Error("zu wenige Mitglieder");
      const members = keys.map(k=>normSpots(arr, k.replace("wind_speed_10m",""))).filter(x=>x.length);
      return {id, members};
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error("kein Ensemble");
}
async function fetchJura(){
  const u = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${JURA.lat},${SPOTS[2].lat}&longitude=${JURA.lon},${SPOTS[2].lon}`
    + "&hourly=pressure_msl&models=meteoswiss_icon_ch2&timezone=Europe%2FZurich&forecast_days=4";
  const j = await getJSON(u);
  const arr = Array.isArray(j) ? j : [j];
  if(arr.length<2) throw new Error("nur ein Punkt");
  const out = {};
  arr[0].hourly.time.forEach((t,i)=>{
    const a = arr[0].hourly.pressure_msl[i], b = arr[1].hourly.pressure_msl[i];
    if(t.slice(11,13)==="18" && a!=null && b!=null) out[t.slice(0,10)] = a-b;
  });
  return out;
}
/* Vergangene Prognosen mit 24 h Vorlauf (Previous Runs API) */
async function fetchHistory(m, days){
  const v = ["wind_speed_10m","wind_direction_10m","wind_gusts_10m"].map(x=>x+"_previous_day1").join(",");
  const u = "https://previous-runs-api.open-meteo.com/v1/forecast?" + coordQ()
    + `&hourly=${v}&models=${m.id}&wind_speed_unit=kn&timezone=Europe%2FZurich&past_days=${days}&forecast_days=1&cell_selection=sea`;
  const sp = normSpots(await getJSON(u, 30000), "_previous_day1");
  if(!sp.length) throw new Error("keine Archivwerte");
  return sp;
}
/* Messwerte SwissMetNet: kind "t" = 10 min, "h" = Stunde; period "now" oder "recent" */
async function fetchStation(abk, kind, period){
  const u = `https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/${abk}/ogd-smn_${abk}_${kind||"t"}_${period||"now"}.csv`;
  return parseSMN(await getText1252(u, period==="recent"?45000:20000));
}
function parseSMN(txt){
  const lines = txt.trim().split(/\r?\n/);
  const head = lines[0].split(";").map(s=>s.trim());
  const find = re => head.findIndex(h=>re.test(h));
  const iT = head.indexOf("reference_timestamp");
  const iD = find(/^dkl010[zh]0$/), iM = find(/^fu3010[zh]0$/), iG = find(/^fu3010[zh]1$/), iTe = find(/^tre200[sh]0$/);
  const num = v => (v==null||v.trim()==="") ? null : parseFloat(v);
  const out = [];
  for(let k=1;k<lines.length;k++){
    const c = lines[k].split(";");
    if(c.length<3) continue;
    const t = parseTsUTC(c[iT]); if(!t) continue;
    const m = iM>-1 ? num(c[iM]) : null, g = iG>-1 ? num(c[iG]) : null;
    out.push({t, dir:iD>-1?num(c[iD]):null, mean:m!=null?m*KN:null, gust:g!=null?g*KN:null, temp:iTe>-1?num(c[iTe]):null});
  }
  return out.filter(r=>r.mean!=null).sort((a,b)=>a.t-b.t);
}
function parseTsUTC(s){
  if(!s) return null; s = s.trim();
  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
  if(m) return new Date(Date.UTC(+m[3],+m[2]-1,+m[1],+m[4],+m[5]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if(m) return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]));
  return null;
}
async function fetchAll(St, opts){
  opts = opts||{};
  const N = {models:{}, stations:{}, err:{}, ens:null, jura:null, at:new Date()};
  const jobs = [];
  MODELS.forEach(m=>jobs.push(fetchModel(m).then(x=>N.models[m.id]=x).catch(e=>N.err[m.id]=e.message||"Fehler")));
  if(opts.ens!==false) jobs.push(fetchEnsemble().then(x=>N.ens=x).catch(e=>N.err.ens=e.message||"Fehler"));
  UPWIND.forEach(s=>jobs.push(fetchStation(s.abk).then(rows=>N.stations[s.abk]={rows}).catch(e=>N.stations[s.abk]={err:e.message||"blockiert"})));
  if(opts.jura!==false) jobs.push(fetchJura().then(x=>N.jura=x).catch(()=>{}));
  await Promise.allSettled(jobs);
  return N;
}

/* ================= Prognose auswerten ================= */
/* Ein Modell (oder Ensemble-Mitglied), ein Tag: stärkster aktiver Spot pro Stunde */
function evalHours(spots, day, St, h0, h1){
  const hours = []; let any = false, capeMax = 0;
  for(let hr=h0; hr<=h1; hr++){
    const key = day+"T"+String(hr).padStart(2,"0")+":00";
    let best = null, raw = null;
    for(const sp of spots){
      if(!St.spots[sp.id]) continue;
      const i = sp.idx[key]; if(i==null) continue;
      const v = sp.h.ws[i]; if(v==null) continue;
      any = true;
      const d = sp.h.wd[i], g = sp.h.wg ? sp.h.wg[i] : null;
      if(sp.h.cape && sp.h.cape[i]!=null && sp.h.cape[i]>capeMax) capeMax = sp.h.cape[i];
      const vk = v*kFor(d,St);
      if(!raw || vk>raw.v) raw = {v:vk, d};
      if(dirOn(d,St) && (!best || vk>best.v)) best = {v:vk, d, g, spot:sp.id};
    }
    hours.push({hr, best, raw});
  }
  return any ? {hours, capeMax} : null;
}
function evalDay(spots, day, St){
  const [h0,h1] = WINS[St.win];
  const r = evalHours(spots, day, St, h0, h1);
  if(!r) return null;
  let run = 0, maxRun = 0, top = null;
  const overH = [];
  r.hours.forEach(x=>{
    if(x.best && over(x.best.v,St)){ run++; overH.push(x.hr); if(run>maxRun) maxRun = run; } else run = 0;
    if(x.best && (!top || x.best.v>top.v)) top = Object.assign({hr:x.hr}, x.best);
  });
  return {top, run:maxRun, nOver:overH.length, overH, hit:maxRun>=St.minH, capeMax:r.capeMax};
}
function levelOf(hits, n, top, St){
  if(!n) return -1;
  const f = hits/n;
  if(hits>=2 && f>=0.75) return 4;
  if(f>=0.5) return 3;
  if(hits>=1) return 2;
  if(top && Math.round(top.v)>=St.T-3) return 1;
  return 0;
}
/* Zeitfenster «wann»: Stunden, in denen mindestens die Hälfte der Modelle (sonst mindestens eines) die Schwelle erreicht */
function windWindow(ok, St){
  const cnt = {};
  ok.forEach(x=>x.e.overH.forEach(h=>cnt[h]=(cnt[h]||0)+1));
  const hrs = Object.keys(cnt).map(Number).sort((a,b)=>a-b);
  if(!hrs.length) return null;
  const need = Math.max(1, Math.ceil(ok.length/2));
  const cons = hrs.filter(h=>cnt[h]>=need);
  const use = cons.length ? cons : hrs;
  return {from:use[0], to:use[use.length-1]+1, consensus:cons.length>0};
}
function summarize(modelSpots, day, St){
  const per = MODELS.map(m=>({m, e: modelSpots[m.id] ? evalDay(modelSpots[m.id], day, St) : null}));
  const ok = per.filter(x=>x.e);
  const hits = ok.filter(x=>x.e.hit).length;
  let top = null, topM = null;
  ok.forEach(x=>{ if(x.e.top && (!top || x.e.top.v>top.v)){ top = x.e.top; topM = x.m; } });
  return {per, ok, n:ok.length, hits, top, topM, level:levelOf(hits, ok.length, top, St), win:windWindow(ok, St)};
}
const clsOf = (lv, St) => lv<0 ? 0 : lv>=St.cut ? (lv>=4?4:3) : lv>=2 ? 2 : lv===1 ? 1 : 0;
function ensShare(ens, day, St){
  if(!ens) return null;
  let n = 0, hit = 0;
  ens.members.forEach(sp=>{ const e = evalDay(sp, day, St); if(e){ n++; if(e.hit) hit++; } });
  return n ? {n, hit} : null;
}

/* ================= Messung auswerten ================= */
function frontCheck(rows){
  const fr = [];
  if(!rows || rows.length<3) return fr;
  for(let i=Math.max(2,rows.length-3); i<rows.length; i++){
    const c=rows[i], p=rows[i-1], pp=rows[i-2];
    if(c.gust && c.mean && c.mean>2 && c.gust/c.mean>2 && c.gust>=14) fr.push("Böenfaktor über 2");
    if(c.temp!=null && p && p.temp!=null && p.temp-c.temp>2) fr.push("Temperatursturz über 2 °C in 10 min");
    else if(c.temp!=null && pp && pp.temp!=null && pp.temp-c.temp>2) fr.push("Temperatursturz über 2 °C in 20 min");
  }
  return [...new Set(fr)];
}
function fresh(rows, now){ return rows && rows.length && ((now||new Date()) - rows[rows.length-1].t) < 50*60000; }

/* Regel E (Joran, Cressier) — retrospektiv an 1030 Abenden geprüft */
const inSectorE = d => d!=null && d>=REGEL_E.sector[0] && d<=REGEL_E.sector[1];
function ruleE(rows){
  const res = {ok:false, front:[], fail:[], last:null, since:null, mean30:null};
  if(!rows || rows.length<3){ res.fail.push("zu wenig Messwerte"); return res; }
  const last3 = rows.slice(-3);
  res.last = rows[rows.length-1];
  res.front = frontCheck(rows);
  const dirOK = last3.every(r=>inSectorE(r.dir));
  const lvlOK = last3.every(r=>r.mean>=REGEL_E.min);
  const riseOK = last3[2].mean >= last3[0].mean;
  res.mean30 = last3.reduce((a,r)=>a+r.mean,0)/3;
  if(!dirOK) res.fail.push("Richtung nicht durchgehend 270–350°");
  if(!lvlOK) res.fail.push("Mittelwind nicht durchgehend ≥ 10 kn");
  if(!riseOK) res.fail.push("Mittelwind nicht zunehmend");
  if(res.front.length) res.fail.push("Böenfront-Merkmale erfüllt");
  res.ok = dirOK && lvlOK && riseOK && !res.front.length;
  if(dirOK && lvlOK){
    let i = rows.length-1;
    while(i>0 && inSectorE(rows[i-1].dir) && rows[i-1].mean>=REGEL_E.min) i--;
    res.since = rows[i].t;
  }
  return res;
}
/* Upwind-Regel je Station: 30 min im Sektor, Mittel ≥ Stationsschwelle, nicht abnehmend */
function stTs(up, St){ const c = St.st && St.st[up.abk]; return c && c.ts ? c.ts : Math.round(St.T*up.f); }
function stTrust(up, St){ const c = St.st && St.st[up.abk]; return c && c.pss!=null ? c.pss : null; }
function upwindNow(rows, up, St){
  const sys = up.sys.filter(id=>St.dirs[id]);
  const res = {ok:false, off:!sys.length, ts:stTs(up,St), trust:stTrust(up,St), last:null, mean30:null, since:null, sys:null};
  if(res.off || !rows || rows.length<3) return res;
  const inSec = r => { const x = dirOf(r.dir); return !!(x && sys.includes(x.id)); };
  const last3 = rows.slice(-3);
  res.last = rows[rows.length-1];
  res.mean30 = last3.reduce((a,r)=>a+r.mean,0)/3;
  res.sys = dirOf(res.last.dir);
  const dirOK = last3.every(inSec), lvlOK = Math.round(res.mean30)>=res.ts, riseOK = last3[2].mean >= last3[0].mean-0.5;
  res.ok = dirOK && lvlOK && riseOK;
  res.near = dirOK && !res.ok && Math.round(res.mean30)>=res.ts-2;
  if(dirOK){
    let i = rows.length-1;
    while(i>0 && inSec(rows[i-1]) && rows[i-1].mean>=res.ts*0.85) i--;
    res.since = rows[i].t;
  }
  return res;
}
/* Messlage jetzt: alle Upwind-Signale plus Regel E plus Böenfront */
function nowcast(stations, St, now){
  const sig = [], front = [];
  UPWIND.forEach(up=>{
    const d = stations[up.abk]; if(!d || d.err || !fresh(d.rows, now)) return;
    const u = upwindNow(d.rows, up, St);
    if(u.ok) sig.push({up, u});
    if(LAKE_LEVEL.includes(up.abk)){ const f = frontCheck(d.rows); if(f.length) front.push({up, f}); }
  });
  const crm = stations.crm;
  const e = crm && !crm.err && fresh(crm.rows, now) ? ruleE(crm.rows) : null;
  const trusted = sig.filter(s=>s.u.trust==null || s.u.trust>=0.25);
  return {sig, trusted, e, eOk: !!(e && e.ok && St.dirs.joran), front};
}

/* ================= Kalibrierung ================= */
function contingency(days, St, models, truth){
  const c = {tp:0, fn:0, fp:0, tn:0};
  days.forEach(d=>{
    const t = truth[d]; if(t!=="y" && t!=="n") return;
    const s = summarize(models, d, St); if(!s.n) return;
    const alarm = s.level>=St.cut;
    if(t==="y") alarm ? c.tp++ : c.fn++; else alarm ? c.fp++ : c.tn++;
  });
  c.ev = c.tp+c.fn; c.nev = c.fp+c.tn;
  c.pss = (c.ev && c.nev) ? c.tp/c.ev - c.fp/c.nev : null;
  return c;
}
const K_GRID = (()=>{ const a=[]; for(let k=0.8;k<=2.0001;k+=0.05) a.push(Math.round(k*100)/100); return a; })();
function plateauMid(rows){
  const max = Math.max(...rows.map(r=>r.c.pss==null?-9:r.c.pss));
  const pl = rows.filter(r=>r.c.pss!=null && Math.abs(r.c.pss-max)<1e-9);
  return pl.length ? Object.assign({max}, pl[Math.floor((pl.length-1)/2)]) : null;   /* Mitte des besten Bereichs = robuster */
}
function calibrate(days, St, models, truth){
  const base = contingency(days, St, models, truth);
  if(base.ev<3 || base.nev<3) return {base, best:null, perDir:{}};
  let best = null;
  for(const cut of [2,3]){
    const m = plateauMid(K_GRID.map(k=>({k, c:contingency(days, Object.assign({}, St, {k, cut, kDir:{}}), models, truth)})));
    if(m && (!best || m.max>best.c.pss+1e-9 || (Math.abs(m.max-best.c.pss)<1e-9 && cut>best.cut))) best = {k:m.k, cut, c:m.c};
  }
  /* Faktor je Windsystem, nur wo genug Tage vorhanden (≥ 3 Windtage und ≥ 3 ruhige Tage) */
  const perDir = {};
  if(best){
    const St0 = Object.assign({}, St, {k:best.k, cut:best.cut, kDir:{}});
    const groups = {};
    days.forEach(d=>{
      const t = truth[d]; if(t!=="y" && t!=="n") return;
      const s = summarize(models, d, St0); if(!s.n || !s.top) return;
      const g = dirOf(s.top.d); if(!g) return;
      (groups[g.id] || (groups[g.id]={days:[], ev:0, nev:0})).days.push(d);
      t==="y" ? groups[g.id].ev++ : groups[g.id].nev++;
    });
    Object.keys(groups).forEach(id=>{
      const g = groups[id]; if(g.ev<3 || g.nev<3) return;
      const m = plateauMid(K_GRID.map(k=>({k, c:contingency(g.days, Object.assign({}, St0, {kDir:{[id]:k}}), models, truth)})));
      const b0 = contingency(g.days, St0, models, truth);
      if(m && m.max>(b0.pss==null?-9:b0.pss)+0.05 && Math.abs(m.k-best.k)>=0.1) perDir[id] = {k:m.k, c:m.c, ev:g.ev, nev:g.nev};
    });
  }
  return {base, best, perDir};
}
/* Stationsschwelle kalibrieren: bester Stunden-Mittelwind im Stationssektor, Fenster −2 h bis Ende */
function stationDayMax(rows, up, St){
  const [h0,h1] = WINS[St.win];
  const sys = up.sys.filter(id=>St.dirs[id]);
  const by = {};
  rows.forEach(r=>{
    const x = dirOf(r.dir); if(!x || !sys.includes(x.id)) return;
    const hr = localHour(r.t); if(hr<h0-2 || hr>h1) return;
    const d = dayOfDate(r.t);
    if(!by[d] || r.mean>by[d]) by[d] = r.mean;
  });
  return by;
}
function calibrateStation(rows, up, St, days, truth){
  const mx = stationDayMax(rows, up, St);
  const marked = days.filter(d=>truth[d]==="y"||truth[d]==="n");
  const ev = marked.filter(d=>truth[d]==="y").length, nev = marked.length-ev;
  if(ev<3 || nev<3) return {ev, nev, best:null};
  const rowsC = [];
  for(let ts=4; ts<=30; ts++){
    const c = {tp:0,fn:0,fp:0,tn:0};
    marked.forEach(d=>{ const a = (mx[d]||0)>=ts-0.5; truth[d]==="y" ? (a?c.tp++:c.fn++) : (a?c.fp++:c.tn++); });
    c.ev=ev; c.nev=nev; c.pss = c.tp/ev - c.fp/nev;
    rowsC.push({k:ts, c});
  }
  const m = plateauMid(rowsC);
  /* ohne erkennbaren Zusammenhang keine eigene Schwelle — Startwert bleibt, Station gilt als nicht verlässlich */
  return {ev, nev, best: m ? {ts: m.c.pss>0.05 ? m.k : null, pss:Math.round(m.c.pss*100)/100, c:m.c} : null};
}

/* ================= Push-Einstellungen: nur geprüfte Felder übernehmen ================= */
const PUSH_FIELDS = ["T","win","minH","dirs","spots","k","kDir","cut","st","push","pushForecast","pushLive"];
function pushCfg(St){ const o = {}; PUSH_FIELDS.forEach(k=>o[k]=clone(St[k])); return o; }
function sanitizeCfg(x){
  if(!x || typeof x!=="object" || Array.isArray(x)) throw new Error("kein Einstellungs-Objekt");
  const o = clone(DEF);
  const num = (v,a,b) => typeof v==="number" && isFinite(v) && v>=a && v<=b;
  if(x.T!=null){ if(!num(x.T,10,30)) throw new Error("Schwelle muss 10–30 kn sein"); o.T = Math.round(x.T); }
  if(x.win!=null){ if(!WINS[x.win]) throw new Error("unbekanntes Zeitfenster"); o.win = x.win; }
  if(x.minH!=null){ if(![1,2].includes(x.minH)) throw new Error("Mindestdauer 1 oder 2"); o.minH = x.minH; }
  if(x.cut!=null){ if(![2,3].includes(x.cut)) throw new Error("Stufe 2 oder 3"); o.cut = x.cut; }
  if(x.k!=null){ if(!num(x.k,0.8,2)) throw new Error("Faktor 0.8–2"); o.k = Math.round(x.k*100)/100; }
  if(x.dirs){ DIRS.forEach(d=>{ if(x.dirs[d.id]!=null) o.dirs[d.id] = x.dirs[d.id] ? 1 : 0; }); if(!Object.values(o.dirs).some(Boolean)) throw new Error("keine Richtung aktiv"); }
  if(x.spots){ SPOTS.forEach(s=>{ if(x.spots[s.id]!=null) o.spots[s.id] = x.spots[s.id] ? 1 : 0; }); if(!Object.values(o.spots).some(Boolean)) throw new Error("kein Spot aktiv"); }
  o.kDir = {};
  if(x.kDir) DIRS.forEach(d=>{ const v = x.kDir[d.id]; if(v!=null){ if(!num(v,0.8,2)) throw new Error("Faktor je Windsystem 0.8–2"); o.kDir[d.id] = Math.round(v*100)/100; } });
  o.st = {};
  if(x.st) UPWIND.forEach(u=>{ const v = x.st[u.abk]; if(!v || typeof v!=="object") return;
    o.st[u.abk] = {ts: num(v.ts,3,40) ? Math.round(v.ts) : null, pss: num(v.pss,-1,1) ? Math.round(v.pss*100)/100 : null, n: num(v.n,0,1000) ? Math.round(v.n) : 0}; });
  ["push","pushForecast","pushLive"].forEach(k=>{ if(x[k]!=null) o[k] = !!x[k]; });
  return o;
}
const cleanId = s => String(s||"").trim().toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,39);

/* ================= Push-Texte ================= */
function describe(s, St){
  if(!s.top) return "";
  const dn = dirOf(s.top.d);
  const w = s.win ? `${s.win.from}–${s.win.to} Uhr` : `gegen ${s.top.hr} Uhr`;
  return `${r0(s.top.v)} kn ${dn?dn.name:card(s.top.d)}, ${w}, bester Spot ${spotName(s.top.spot)} (${s.hits} von ${s.n} Modellen ≥ ${St.T} kn)`;
}

const api = {SPOTS, JURA, MODELS, DIRS, WINS, LEVELS, UPWIND, LAKE_LEVEL, REGEL_E, DEF,
  clone, merge, r0, r1, card, dirOf, dirOn, over, kFor, spotName, fmtCH, hhmm, localDay, localHour, dayOfDate, dayLabel,
  getJSON, fetchModel, fetchEnsemble, fetchJura, fetchHistory, fetchStation, fetchAll, parseSMN,
  evalHours, evalDay, levelOf, windWindow, summarize, clsOf, ensShare,
  frontCheck, fresh, ruleE, stTs, stTrust, upwindNow, nowcast,
  contingency, calibrate, calibrateStation, describe, PUSH_FIELDS, pushCfg, sanitizeCfg, cleanId};
if(typeof module!=="undefined" && module.exports) module.exports = api; else root.JoranCore = api;
})(typeof self!=="undefined" ? self : this);
