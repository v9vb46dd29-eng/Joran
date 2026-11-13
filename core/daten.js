/* Joran — Silo «daten». Alles, was ins Netz geht: Open-Meteo (Modelle, Ensemble, Höhenwind, Jura, Archiv),
   SwissMetNet (Upwind-Stationen), meteoBase (Seestationen), Messreihe aus dem Branch live, Windbild (data/windbild.json). Einziger Ort mit fetch.
   Hängt ab von: konstanten, see. Aufbau und Regeln: ARCHITEKTUR.md */
(function(root, make){
  const dep = n => typeof module!=="undefined" && module.exports ? require("./"+n+".js") : root.Joran[n];
  const api = make(dep);
  if(typeof module!=="undefined" && module.exports) module.exports = api; else (root.Joran = root.Joran || {}).daten = api;
})(typeof self!=="undefined" ? self : this, function(dep){
"use strict";
const {SPOTS, JURA, CREST, BES, NEUP, LAKE, LAKE_KEEP_H, KN, MODELS, ENS_IDS, UPWIND} = dep("konstanten");
const {parseMeteobase} = dep("see");

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
const IS_BROWSER = typeof window!=="undefined";
async function getText1252(url, ms){
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(), ms||20000);
  try{
    const r = await fetch(url, IS_BROWSER ? {signal:ctl.signal, cache:"no-store"} : {signal:ctl.signal});   /* nie aus dem Browser-Cache */
    if(!r.ok) throw new Error("HTTP "+r.status);
    return new TextDecoder("windows-1252").decode(await r.arrayBuffer());
  } catch(e){ if(e.name==="AbortError") throw new Error("Zeitüberschreitung"); throw e; }
  finally { clearTimeout(t); }
}
const coordQ = () => `latitude=${SPOTS.map(s=>s.lat).join(",")}&longitude=${SPOTS.map(s=>s.lon).join(",")}`;
function indexTimes(t){ const m = {}; t.forEach((x,i)=>m[x]=i); return m; }
/* Open-Meteo schreibt mit timezone=Europe/Zurich die ganze Reihe mit EINEM Versatz (utc_offset_seconds, der vom Zeitpunkt
   des Abrufs), nicht mit dem Versatz der jeweiligen Stunde. Liegt ein Wechsel Sommer-/Winterzeit in der Reihe, sind die
   Stunden auf der anderen Seite um eine Stunde falsch beschriftet (z. B. Abruf im November: «14:00» am 20.10. ist 15:00 MESZ).
   ortszeit() rechnet jede Beschriftung mit dem gelieferten Versatz auf UTC zurück und schreibt sie in echter Ortszeit.
   Ohne Versatz bleibt die Reihe, wie sie ist. Beim Wechsel auf Winterzeit kommt 02:00 zweimal vor, beim Wechsel auf
   Sommerzeit fehlt 02:00; die Abstände im Feld bleiben echte Stunden. */
const ORT_FMT = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const ORT_MEMO = new Map();
function ortszeit(times, off){
  if(!Array.isArray(times) || off==null || isNaN(off)) return times;
  return times.map(t=>{
    const k = t+"|"+off; let v = ORT_MEMO.get(k); if(v) return v;
    const ms = Date.parse(t+"Z") - off*1000;
    if(isNaN(ms)) return t;
    const p = {}; ORT_FMT.formatToParts(new Date(ms)).forEach(x=>{ p[x.type] = x.value; });
    v = `${p.year}-${p.month}-${p.day}T${p.hour==="24" ? "00" : p.hour}:${p.minute}`;
    if(ORT_MEMO.size>20000) ORT_MEMO.clear();
    ORT_MEMO.set(k, v); return v; });
}

function normSpots(j, suffix){
  const arr = Array.isArray(j) ? j : [j];
  return SPOTS.map((sp,i)=>{
    const o = arr[i]; if(!o || !o.hourly) return null;
    const hh = o.hourly, sf = suffix||"", time = ortszeit(hh.time, o.utc_offset_seconds);
    const h = {time, ws:hh["wind_speed_10m"+sf], wd:hh["wind_direction_10m"+sf], wg:hh["wind_gusts_10m"+sf]||null, cape:hh["cape"+sf]||null};
    if(!h.ws || !h.wd) return null;
    return {id:sp.id, h, idx:indexTimes(time), cell:{lat:o.latitude, lon:o.longitude}};
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
/* Höhenwind (ICON-EU, Punkt Seemitte): Wind auf 850 hPa (rund 1500 m) und Temperatur dort und auf 2 m, je Stunde.
   ICON-CH2 liefert im Archiv keine Druckflächen; ICON-EU ist deshalb auch die Grundlage der Auswertung (eval/hoehenwind.cjs). */
async function fetchHoehe(){
  const u = "https://api.open-meteo.com/v1/forecast" + `?latitude=${SPOTS[2].lat}&longitude=${SPOTS[2].lon}`
    + "&hourly=wind_speed_850hPa,wind_direction_850hPa,temperature_850hPa,temperature_2m&models=icon_eu&wind_speed_unit=kn&timezone=Europe%2FZurich&forecast_days=4";
  const j = await getJSON(u), h = j && j.hourly;
  if(!h || !h.time || !h.wind_speed_850hPa) throw new Error("kein Höhenwind");
  return Object.assign({}, h, {time:ortszeit(h.time, j.utc_offset_seconds)});
}
/* Joran-Zutaten (ICON-CH2): Druck Jurahochfläche minus See, Wind auf dem Chasseral-Kamm, je Stunde */
async function fetchJura(){
  const P = [JURA, CREST, SPOTS[2], BES, NEUP];
  const u = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${P.map(p=>p.lat).join(",")}&longitude=${P.map(p=>p.lon).join(",")}`
    + "&hourly=pressure_msl,wind_speed_10m,wind_direction_10m&models=meteoswiss_icon_ch2&wind_speed_unit=kn&timezone=Europe%2FZurich&forecast_days=4";
  const j = await getJSON(u);
  const arr = Array.isArray(j) ? j : [j];
  if(arr.length<3) throw new Error("zu wenige Punkte");
  const [jj, cr, lk, be, ne] = arr.map(x=>x.hourly);
  const out = {};
  ortszeit(jj.time, arr[0].utc_offset_seconds).forEach((t,i)=>{
    const a = jj.pressure_msl[i], b = lk.pressure_msl[i];
    const pb = be ? be.pressure_msl[i] : null, pn = ne ? ne.pressure_msl[i] : null;
    out[t] = {dp: a!=null && b!=null ? a-b : null, cv: cr.wind_speed_10m[i], cd: cr.wind_direction_10m[i],
      bn: pb!=null && pn!=null ? pb-pn : null};
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
  const u = `https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/${abk}/ogd-smn_${abk}_${kind||"t"}_${period||"now"}.csv`
    + ((period||"now")==="now" ? `?t=${Math.floor(Date.now()/60000)}` : "");      /* an CDN-Caches vorbei, neuester 10-min-Wert */
  return parseSMN(await getText1252(u, period==="recent"?45000:20000));
}
function parseSMN(txt){
  const lines = txt.trim().split(/\r?\n/);
  const head = lines[0].split(";").map(s=>s.trim());
  const find = re => head.findIndex(h=>re.test(h));
  const iT = head.indexOf("reference_timestamp");
  const iD = find(/^dkl010[zh]0$/), iM = find(/^fu3010[zh]0$/), iG = find(/^fu3010[zh]1$/), iTe = find(/^tre200[sh]0$/), iP = find(/^pp0qff[sh]0$/);
  const num = v => (v==null||v.trim()==="") ? null : parseFloat(v);
  const out = [];
  for(let k=1;k<lines.length;k++){
    const c = lines[k].split(";");
    if(c.length<3) continue;
    const t = parseTsUTC(c[iT]); if(!t) continue;
    const m = iM>-1 ? num(c[iM]) : null, g = iG>-1 ? num(c[iG]) : null;
    out.push({t, dir:iD>-1?num(c[iD]):null, mean:m!=null?m*KN:null, gust:g!=null?g*KN:null, temp:iTe>-1?num(c[iTe]):null, qff:iP>-1?num(c[iP]):null});
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
async function getText(url, ms){
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(), ms||20000);
  try{
    const r = await fetch(url, {signal:ctl.signal, headers:{"User-Agent":"Joran-Wingfoil (github.com/v9vb46dd29-eng/Joran)"}});
    if(!r.ok) throw new Error("HTTP "+r.status);
    return await r.text();
  } catch(e){ if(e.name==="AbortError") throw new Error("Zeitüberschreitung"); throw e; }
  finally { clearTimeout(t); }
}
/* Action: neue Werte an die gespeicherte Reihe anhängen, ältere als LAKE_KEEP_H Stunden verwerfen */
async function updateLake(prev, now){
  const o = {updated:(now||new Date()).toISOString(), st:{}};
  const lim = (now||new Date()) - LAKE_KEEP_H*3600e3;
  await Promise.all(LAKE.map(async L=>{
    const rows = ((prev && prev.st && prev.st[L.id] && prev.st[L.id].rows) || []).filter(r=>new Date(r.t)>=lim);
    let err = null;
    try{ const r = parseMeteobase(await getText(L.url)); if(!rows.some(x=>x.t===r.t)) rows.push(r); }
    catch(e){ err = e.message || "Fehler"; }
    rows.sort((a,b)=>a.t<b.t?-1:1);
    o.st[L.id] = err ? {rows, err} : {rows};
  }));
  return o;
}
/* Browser: meteoBase erlaubt keinen direkten Abruf (CORS). Darum der Reihe nach: direkt, eigener Proxy, öffentliche CORS-Proxys.
   Liefert den aktuellen Wert je Station. */
const LAKE_PROXIES = [
  u => u,
  u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  u => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
  u => "https://corsproxy.io/?url=" + encodeURIComponent(u)
];
async function fetchLakeNow(own){
  const list = (own ? [u => own + (own.includes("?") ? "" : "?url=") + encodeURIComponent(u)] : []).concat(LAKE_PROXIES);
  const out = {updated:new Date().toISOString(), st:{}, via:{}};
  const why = m => m==="Load failed"||m==="Failed to fetch"||/NetworkError/.test(m) ? "Netzwerk/CORS" : /abort/i.test(m) ? "Zeitüberschreitung" : m;
  await Promise.all(LAKE.map(async L=>{
    const errs = [];
    for(let i=0; i<list.length; i++){
      try{
        const ctl = new AbortController(), t = setTimeout(()=>ctl.abort(), i===0 && own ? 15000 : 8000);
        let txt;
        try{ const r = await fetch(list[i](L.url + "?" + Date.now()), {signal:ctl.signal}); if(!r.ok) throw new Error("HTTP "+r.status); txt = await r.text(); }
        finally{ clearTimeout(t); }
        out.st[L.id] = {rows:[parseMeteobase(txt)]}; out.via[L.id] = i; return;
      }catch(e){ errs.push(why(e.message || "Fehler")); }
    }
    out.st[L.id] = {rows:[], err: errs[0] || "nicht erreichbar", errs};   /* errs[0] = eigener Proxy, falls gesetzt */
  }));
  return out;
}
/* Browser: Reihe aus dem Branch «live» lesen (raw.githubusercontent.com erlaubt CORS) */
async function fetchLake(owner, repo){
  return getJSON(`https://raw.githubusercontent.com/${owner}/${repo}/live/lake.json?${Date.now()}`, 15000);
}

/* Windbild der Bieler Bucht: typische Werte je Lage. Die Datei liegt neben der Seite und kommt aus eval/ (data/windbild.json).
   Nur im Browser; der Zusatz hält den Zwischenspeicher höchstens eine Stunde. */
async function fetchWindbild(){
  return getJSON("data/windbild.json?t=" + Math.floor(Date.now()/3600e3), 15000);
}

/* Alle Upwind-Stationen frisch holen (für jeden Refresh) */
async function fetchStations(){
  const out = {};
  await Promise.all(UPWIND.map(s=>fetchStation(s.abk).then(rows=>out[s.abk]={rows, at:new Date()}).catch(e=>out[s.abk]={err:e.message||"blockiert"})));
  return out;
}
async function fetchAll(St, opts){
  opts = opts||{};
  const N = {models:{}, stations:{}, err:{}, ens:null, jura:null, at:new Date()};
  const jobs = [];
  MODELS.forEach(m=>jobs.push(fetchModel(m).then(x=>N.models[m.id]=x).catch(e=>N.err[m.id]=e.message||"Fehler")));
  if(opts.ens!==false) jobs.push(fetchEnsemble().then(x=>N.ens=x).catch(e=>N.err.ens=e.message||"Fehler"));
  if(opts.stations!==false) jobs.push(fetchStations().then(x=>N.stations=x));
  if(opts.jura!==false) jobs.push(fetchJura().then(x=>N.jura=x).catch(()=>{}));
  await Promise.allSettled(jobs);
  return N;
}

return {getJSON, ortszeit, fetchModel, fetchEnsemble, fetchHoehe, fetchJura, fetchHistory, fetchStation, parseSMN, updateLake,
  fetchLakeNow, fetchLake, fetchStations, fetchAll, fetchWindbild};
});
