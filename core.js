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
const JURA = {lat:47.083, lon:6.792};            /* Jura-Hochfläche bei La Chaux-de-Fonds */
const CREST = {lat:47.132, lon:7.054};           /* Chasseral, Kammhöhe */
/* Messstationen direkt am See (meteoBase). Kein CORS: Die GitHub Action liest sie und legt sie im Branch «live» ab. */
const LAKE = [
  {id:"vin", name:"Vingelz", url:"https://vingelz.meteobase.ch/"},
  {id:"ips", name:"Ipsach",  url:"https://wsa-ipsach.meteobase.ch/"}
];
const LAKE_KEEP_H = 18;
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
  {abk:"mub", name:"Mühleberg", sys:["s","so"],     f:0.75, role:"Mittelland, 25 km S"},
  /* Erweiterung für Joran. extra = zählt erst, wenn der Rückblick sie als verlässlich ausweist. */
  {abk:"chm", name:"Chaumont",  sys:["joran","w"],  f:1.0,  role:"erster Jurakamm 1136 m, 25 km SW", extra:true},
  {abk:"cdf", name:"La Chaux-de-Fonds", sys:["joran","w"], f:0.7, role:"Jurahochfläche 1018 m, 30 km WNW", extra:true},
  /* Taubenlöchler: abends fliesst Luft talabwärts durchs Vallon de St-Imier und die Taubenlochschlucht und kommt in der
     Bielerbucht aus Nord/Nordost an. In Courtelary weht sie entlang der Talachse aus WSW (eigener Stationssektor sec).
     Kalibriert nur an Tagen, die im Rückblick als «Taubenlöchler» markiert sind. */
  {abk:"coy", name:"Courtelary", sys:["n","bise"], f:0.6, role:"Vallon de St-Imier 695 m, Talwind Richtung Taubenloch",
   extra:true, tl:true, sec:[220,280], hrs:[15,22]}
];
/* Taubenlöchler-Signal sperren, solange auf dem Chasseral grossräumiger West/Südwest weht (dann bläst es im Tal ohnehin talabwärts).
   Erfahrungswert, nicht kalibriert. */
const TL = {chaSec:[200,290], chaMax:15};
const LAKE_LEVEL = ["crm","neu","gre","pay"];     /* für die Sturm-/Böenfront-Prüfung */
/* Böenfront braucht alle drei Merkmale gleichzeitig (Kaltluftausfluss eines Gewitters):
   Temperatursturz, sprunghaft zunehmender Mittelwind und kräftige Böen. Böenfaktor allein ist an Landstationen alltäglich. */
const FRONT = {dT:3, jump:8, gust:30};
const REGEL_E = {sector:[270,350], min:10, foil:12};
/* Joran-Zutaten aus dem Modell: Hinweis, nicht kalibriert (siehe Methode) */
const JORAN_X = {crestSector:[270,360], crest:12, dpRise:0.5, cape:500};

const DEF = {T:14, maxMean:30, maxGust:39, win:"abend", minH:1, dirs:{n:1,bise:1,so:1,s:1,w:1,joran:1}, spots:{vin:1,ips:1,mit:1},
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
/* Joran-Zutaten (ICON-CH2): Druck Jurahochfläche minus See, Wind auf dem Chasseral-Kamm, je Stunde */
async function fetchJura(){
  const P = [JURA, CREST, SPOTS[2]];
  const u = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${P.map(p=>p.lat).join(",")}&longitude=${P.map(p=>p.lon).join(",")}`
    + "&hourly=pressure_msl,wind_speed_10m,wind_direction_10m&models=meteoswiss_icon_ch2&wind_speed_unit=kn&timezone=Europe%2FZurich&forecast_days=4";
  const j = await getJSON(u);
  const arr = Array.isArray(j) ? j : [j];
  if(arr.length<3) throw new Error("zu wenige Punkte");
  const [jj, cr, lk] = arr.map(x=>x.hourly);
  const out = {};
  jj.time.forEach((t,i)=>{
    const a = jj.pressure_msl[i], b = lk.pressure_msl[i];
    out[t] = {dp: a!=null && b!=null ? a-b : null, cv: cr.wind_speed_10m[i], cd: cr.wind_direction_10m[i]};
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
/* ---- Seestationen (meteoBase): HTML-Seite auslesen ---- */
const DIR16 = ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const dir16 = s => { const i = DIR16.indexOf(String(s||"").toUpperCase().replace(/E/g,"O")); return i<0 ? null : i*22.5; };
function parseMeteobase(html){
  const txt = String(html).replace(/&nbsp;/g," ").replace(/&Oslash;|&#216;/g,"Ø");   /* «Ø» nicht voraussetzen: Kodierung kann es verstümmeln */
  const m = txt.match(/(\d{2})\.(\d{2})\.(\d{4})\s*\((CEST|CET|MESZ|MEZ)\)\s*(\d{1,2}):(\d{2})/);
  if(!m) throw new Error("kein Zeitstempel");
  const off = /CEST|MESZ/.test(m[4]) ? 2 : 1;
  const t = new Date(Date.UTC(+m[3], +m[2]-1, +m[1], +m[5]-off, +m[6]));
  const w = re => { const x = txt.match(re); return x ? {kn:parseFloat(x[1]), dir:x[2]} : null; };
  const mean = w(/Wind-10min-(?!Max)[^:<]{1,6}:\s*[\d.]+\s*km\/h\s*\(([\d.]+)\s*kn[^)]*\)\s*([A-Z]{1,3})/);
  const gust = w(/Wind-10min-Max:\s*[\d.]+\s*km\/h\s*\(([\d.]+)\s*kn[^)]*\)\s*([A-Z]{1,3})/);
  if(!mean) throw new Error("kein Windwert");
  const n = re => { const x = txt.match(re); return x ? parseFloat(x[1]) : null; };
  return {t:t.toISOString(), mean:mean.kn, dir:dir16(mean.dir), gust:gust?gust.kn:null,
    steady:n(/Richtungstreue:\s*(\d+)\s*%/), air:n(/Lufttemperatur:\s*(-?[\d.]+)/), water:n(/Wassertemperatur:\s*(-?[\d.]+)/)};
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
/* Zwei Messreihen zusammenführen (Branch «live» + Direktabruf + bisher im Browser gesammelt) */
function mergeLake(...src){
  const o = {updated:null, st:{}};
  const lim = Date.now() - LAKE_KEEP_H*3600e3;
  LAKE.forEach(L=>{
    const m = {}; let err = null;
    src.forEach(x=>{ const d = x && x.st && x.st[L.id]; if(!d) return; (d.rows||[]).forEach(r=>{ if(new Date(r.t)>=lim) m[r.t] = r; }); if(d.err && !err) err = d.err; });
    const rows = Object.values(m).sort((a,b)=>a.t<b.t?-1:1);
    o.st[L.id] = rows.length ? {rows} : {rows, err};
  });
  src.forEach(x=>{ if(x && x.updated && (!o.updated || x.updated>o.updated)) o.updated = x.updated; });
  return o;
}
/* Browser: Reihe aus dem Branch «live» lesen (raw.githubusercontent.com erlaubt CORS) */
async function fetchLake(owner, repo){
  return getJSON(`https://raw.githubusercontent.com/${owner}/${repo}/live/lake.json?${Date.now()}`, 15000);
}
const lakeRows = (lk, id) => ((lk && lk.st && lk.st[id] && lk.st[id].rows) || []).map(r=>Object.assign({}, r, {t:new Date(r.t)}));
/* Messlage am See: letzter Wert frisch (< 40 min), die letzten (bis zu zwei) frischen Werte ≥ Schwelle in aktiver Richtung */
/* upSys: Windsystem, das die Upwind-Stationen gerade melden (nowcast().upSys). Am See wird der Joran umgelenkt
   (Teilung zwischen Vingelz und Alfermée), darum zählt dann jede Richtung am See als dieses System. */
function lakeNow(lk, St, now, upSys){
  const dOk = d => dirOn(d,St) || !!(upSys && St.dirs[upSys]);
  return LAKE.map(L=>{
    const rows = lakeRows(lk, L.id), last = rows[rows.length-1] || null;
    const fr = !!(last && ((now||new Date()) - last.t) < 40*60000);
    const k2 = rows.slice(-2).filter(r=>((now||new Date()) - r.t) < 40*60000);
    const ok = fr && k2.length>=1 && k2.every(r=>over(r.mean,St) && dOk(r.dir));   /* ein Wert, wenn nur der Direktabruf vorliegt */
    let since = null;
    if(ok){ let i = rows.length-1; while(i>0 && over(rows[i-1].mean,St) && dOk(rows[i-1].dir) && rows[i].t-rows[i-1].t < 40*60000) i--; since = rows[i].t; }
    const viaUp = ok && !k2.every(r=>dirOn(r.dir,St));
    return {L, rows, last, fresh:fr, ok, since, viaUp, err: lk && lk.st && lk.st[L.id] ? lk.st[L.id].err : null};
  });
}

/* Wahrheit aus der Seemessung (Archiv, eine Datei pro Tag): Ein Tag ist foilbar, wenn im Zeitfenster der Einstellungen
   an einer aktiven Seestation das gleitende Mittel über minH Stunden gerundet ≥ T kn lag. Ein Mittel zählt nur mit
   mindestens 80 % der 10-min-Werte. «Ruhig» nur, wenn eine Station das Fenster zu mindestens 80 % abdeckt; sonst unbekannt.
   onset = erster 10-min-Wert ≥ T im ersten foilbaren Zeitraum (frühester über beide Stationen). */
const LAKE_COVER = 0.8;
function lakeDay(lk, day, St){
  St = St || DEF;
  const [h0,h1] = WINS[St.win], span = St.minH*3600e3, need = St.minH*6*LAKE_COVER;
  const inWin = t => { const m = localHour(t)*60 + t.getUTCMinutes(); return dayOfDate(t)===day && m>=h0*60 && m<=h1*60; };
  const out = {day, known:false, ev:false, onset:null, dir:null, st:{}};
  LAKE.forEach(L=>{
    if(!St.spots[L.id]) return;
    const rows = lakeRows(lk, L.id).filter(r=>r.mean!=null && inWin(r.t));
    const s = out.st[L.id] = {n:rows.length, cover:rows.length/((h1-h0)*6), max:null, ev:false, onset:null};
    if(s.cover>=LAKE_COVER) out.known = true;
    for(let i=0, j=0; i<rows.length; i++){
      while(rows[i].t - rows[j].t >= span) j++;
      const w = rows.slice(j, i+1);
      if(w.length<need) continue;
      const m = w.reduce((a,r)=>a+r.mean,0)/w.length;
      if(s.max==null || m>s.max) s.max = r1(m);
      if(!s.ev && over(m, St)){ const f = w.find(r=>over(r.mean, St)) || w[0]; s.ev = true; s.onset = f.t; s.dir = f.dir; }
    }
    if(s.ev){ out.ev = out.known = true; if(!out.onset || s.onset<out.onset){ out.onset = s.onset; out.dir = s.dir; } }
  });
  return out;
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

/* Joran-Zutaten für einen Tag (ab 14 Uhr bis Fensterende): NW-Strömung auf Kammhöhe,
   steigendes Druckgefälle Jura → See, Gewitterneigung. Reiner Hinweis, verändert die Stufe nicht. */
function joranCheck(J, day, St, capeMax){
  if(!J) return null;
  const h1 = WINS[St.win][1], h0 = Math.max(14, WINS[St.win][0]);
  const at = hr => J[day+"T"+String(hr).padStart(2,"0")+":00"];
  let crest = null, dpMax = null, dpHr = null;
  for(let hr=h0; hr<=h1; hr++){
    const x = at(hr); if(!x) continue;
    if(x.cv!=null && x.cd!=null && x.cd>=JORAN_X.crestSector[0] && x.cd<=JORAN_X.crestSector[1] && (!crest || x.cv>crest.v)) crest = {v:x.cv, d:x.cd, hr};
    if(x.dp!=null && (dpMax==null || x.dp>dpMax)){ dpMax = x.dp; dpHr = hr; }
  }
  const noon = at(12), dp12 = noon && noon.dp!=null ? noon.dp : null;
  if(dpMax==null && !crest) return null;
  const rise = dpMax!=null && dp12!=null ? dpMax-dp12 : null;
  const c = {crest, dpMax, dpHr, rise,
    crestOk: !!(crest && crest.v>=JORAN_X.crest), dpOk: rise!=null && rise>=JORAN_X.dpRise, storm: (capeMax||0)>=JORAN_X.cape};
  c.n = (c.crestOk?1:0) + (c.dpOk?1:0);
  return c;
}

/* ================= Messung auswerten ================= */
/* Nicht rausfahren nur bei Sturm: Messung über deinen Grenzen oder echte Böenfront (alle Merkmale zugleich) */
function frontCheck(rows, St){
  St = St || DEF;
  const fr = [];
  if(!rows || rows.length<3) return fr;
  const mm = St.maxMean||DEF.maxMean, mg = St.maxGust||DEF.maxGust;
  for(let i=Math.max(2,rows.length-3); i<rows.length; i++){
    const c=rows[i], pp=rows[i-2], p=rows[i-1];
    if(c.gust!=null && Math.round(c.gust)>mg) fr.push(`Böen ${Math.round(c.gust)} kn über deiner Grenze ${mg} kn`);
    if(c.mean!=null && Math.round(c.mean)>mm) fr.push(`Mittelwind ${Math.round(c.mean)} kn über deiner Grenze ${mm} kn`);
    const ref = [p,pp].filter(r=>r && r.temp!=null && r.mean!=null);
    if(c.temp!=null && ref.length){
      const warm = Math.max(...ref.map(r=>r.temp)), calm = Math.min(...ref.map(r=>r.mean));
      if(warm-c.temp>=FRONT.dT && c.mean-calm>=FRONT.jump && c.gust!=null && c.gust>=FRONT.gust)
        fr.push(`Böenfront: ${r1(warm-c.temp)} °C kälter, Wind +${Math.round(c.mean-calm)} kn in 20 min, Böen ${Math.round(c.gust)} kn`);
    }
  }
  return [...new Set(fr)];
}
/* Seestationen: 10-min-Spitze bzw. -Mittel über den eigenen Grenzen */
function lakeStorm(lk, St){
  const out = [];
  lakeNow(lk, St).forEach(x=>{
    if(!x.fresh) return;
    const l = x.last, f = [];
    if(l.gust!=null && Math.round(l.gust)>St.maxGust) f.push(`Böen ${Math.round(l.gust)} kn über deiner Grenze ${St.maxGust} kn`);
    if(Math.round(l.mean)>St.maxMean) f.push(`Mittelwind ${Math.round(l.mean)} kn über deiner Grenze ${St.maxMean} kn`);
    if(f.length) out.push({up:{name:x.L.name}, f});
  });
  return out;
}
function fresh(rows, now){ return rows && rows.length && ((now||new Date()) - rows[rows.length-1].t) < 50*60000; }

/* Regel E (Joran, Cressier) — retrospektiv an 1030 Abenden geprüft */
const inSectorE = d => d!=null && d>=REGEL_E.sector[0] && d<=REGEL_E.sector[1];
function ruleE(rows, St){
  const res = {ok:false, front:[], fail:[], last:null, since:null, mean30:null};
  if(!rows || rows.length<3){ res.fail.push("zu wenig Messwerte"); return res; }
  const last3 = rows.slice(-3);
  res.last = rows[rows.length-1];
  res.front = frontCheck(rows, St);
  const dirOK = last3.every(r=>inSectorE(r.dir));
  const lvlOK = last3.every(r=>r.mean>=REGEL_E.min);
  const riseOK = last3[2].mean >= last3[0].mean;
  res.mean30 = last3.reduce((a,r)=>a+r.mean,0)/3;
  if(!dirOK) res.fail.push("Richtung nicht durchgehend 270–350°");
  if(!lvlOK) res.fail.push("Mittelwind nicht durchgehend ≥ 10 kn");
  if(!riseOK) res.fail.push("Mittelwind nicht zunehmend");
  if(res.front.length) res.fail.push("Sturm oder Böenfront gemessen");
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
/* Verlässlich nach Recall-Regel: 1 / 0, fehlt (undefined), solange die Station so nicht kalibriert ist */
function stRel(up, St){ const c = St.st && St.st[up.abk]; return c && (c.rel===0 || c.rel===1) ? c.rel : undefined; }
/* Richtung an der Station: eigener Sektor (z. B. Talachse) oder die Windsysteme, die sie ankündigt */
function stSecFn(up, St){
  const sys = up.sys.filter(id=>St.dirs[id]);
  if(!sys.length) return null;
  if(up.sec) return r => r.dir!=null && inArc(r.dir, up.sec[0], up.sec[1]);
  return r => { const x = dirOf(r.dir); return !!(x && sys.includes(x.id)); };
}
const inHrs = (up, t) => { if(!up.hrs) return true; const h = localHour(t); return h>=up.hrs[0] && h<=up.hrs[1]; };
/* Grossräumiger West/Südwest auf dem Chasseral (letzte 30 min bzw. diese Stunde) */
const chaWest = rows => !!(rows && rows.length && rows.every(r=>r.dir!=null && inArc(r.dir, TL.chaSec[0], TL.chaSec[1]))
  && rows.reduce((a,r)=>a+r.mean,0)/rows.length>=TL.chaMax);
function upwindNow(rows, up, St, cha){
  const inSec = stSecFn(up, St);
  const res = {ok:false, off:!inSec, ts:stTs(up,St), trust:stTrust(up,St), rel:stRel(up,St), last:null, mean30:null, since:null, sys:null, block:null};
  if(res.off || !rows || rows.length<3) return res;
  const last3 = rows.slice(-3);
  res.last = rows[rows.length-1];
  res.mean30 = last3.reduce((a,r)=>a+r.mean,0)/3;
  res.sys = up.tl ? {id:"tl", name:"Talwind → Taubenlöchler"} : dirOf(res.last.dir);
  const dirOK = last3.every(inSec), lvlOK = Math.round(res.mean30)>=res.ts, riseOK = last3[2].mean >= last3[0].mean-0.5;
  if(!inHrs(up, res.last.t)) res.block = `nur ${up.hrs[0]}–${up.hrs[1]} Uhr`;
  else if(up.tl && cha && chaWest(cha.slice(-3))) res.block = "Westwind auf dem Chasseral";
  res.ok = dirOK && lvlOK && riseOK && !res.block;
  res.near = dirOK && !res.ok && !res.block && Math.round(res.mean30)>=res.ts-2;
  if(dirOK){
    let i = rows.length-1;
    while(i>0 && inSec(rows[i-1]) && rows[i-1].mean>=res.ts*0.85) i--;
    res.since = rows[i].t;
  }
  return res;
}
/* Signal zählt für Push: nach Recall-Regel kalibriert → nur wenn verlässlich; sonst wie bisher Peirce ≥ 0.25 oder ungeprüft (nicht extra) */
const isTrusted = s => s.u.rel!==undefined ? s.u.rel===1 : (s.u.trust==null && !s.up.extra) || (s.u.trust!=null && s.u.trust>=0.25);
/* Messlage jetzt: alle Upwind-Signale plus Regel E plus Böenfront */
function nowcast(stations, St, now, lk){
  const sig = [], front = [];
  const ch = stations.cha && !stations.cha.err && fresh(stations.cha.rows, now) ? stations.cha.rows : null;
  UPWIND.forEach(up=>{
    const d = stations[up.abk]; if(!d || d.err || !fresh(d.rows, now)) return;
    const u = upwindNow(d.rows, up, St, ch);
    if(u.ok) sig.push({up, u});
    if(LAKE_LEVEL.includes(up.abk)){ const f = frontCheck(d.rows, St); if(f.length) front.push({up, f}); }
  });
  const crm = stations.crm;
  const e = crm && !crm.err && fresh(crm.rows, now) ? ruleE(crm.rows, St) : null;
  const trusted = sig.filter(isTrusted);
  if(lk) lakeStorm(lk, St).forEach(x=>front.push(x));
  const eOk = !!(e && e.ok && St.dirs.joran);
  /* Windsystem nach den Upwind-Stationen: Joran, wenn Regel E oder eine verlässliche Joran-Station ihn gerade meldet */
  const joran = !!St.dirs.joran && (eOk || trusted.some(s=>s.u.sys && s.u.sys.id==="joran"));
  return {sig, trusted, e, eOk, front, upSys: joran ? "joran" : null};
}
/* Hinweis bei Joran-Lage: Fallböen teilen sich zwischen Vingelz und Alfermée, Vingelz liegt oft im Windschatten
   (Beobachtung Simon, Oktober 2026). lake = Ergebnis von lakeNow. */
function lageHint(nc, lake){
  const f = (lake||[]).filter(x=>x.fresh);
  const v = f.find(x=>x.L.id==="vin"), i = f.find(x=>x.L.id==="ips");
  const diff = v && i ? i.last.mean - v.last.mean : null;
  if(!(nc && nc.upSys==="joran") && !(diff!=null && diff>=4 && nc && nc.sig.some(s=>s.up.sys.includes("joran")))) return "";
  let t = "Joran-Lage: Die Fallböen teilen sich oft zwischen Vingelz und Alfermée, Vingelz liegt dann im Windschatten. Draussen und Richtung Ipsach weht es meist stärker — vom Hafen Vingelz lohnt sich das Rausfahren auch, wenn Vingelz wenig zeigt.";
  if(diff!=null && diff>=4) t += ` Ipsach misst jetzt ${Math.round(diff)} kn mehr als Vingelz.`;
  return t;
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
function stationDayMax(rows, up, St, cha){
  const [h0,h1] = WINS[St.win];
  const inSec = stSecFn(up, St); if(!inSec) return {};
  const chaAt = {};
  if(up.tl && cha) cha.forEach(r=>chaAt[r.t.getTime()] = r);
  const by = {};
  rows.forEach(r=>{
    if(!inSec(r)) return;
    const hr = localHour(r.t); if(hr<h0-2 || hr>h1 || !inHrs(up, r.t)) return;
    if(up.tl){ const c = chaAt[r.t.getTime()]; if(c && chaWest([c])) return; }
    const d = dayOfDate(r.t);
    if(!by[d] || r.mean>by[d]) by[d] = r.mean;
  });
  return by;
}
/* Taubenlöchler-Station: Windtage = «Ja» mit Markierung «TL», ruhige Tage = «Nein». Andere Windtage zählen nicht. */
const isEv = (up, truth, d) => truth[d]==="y" && (!up.tl || !!truth["tl:"+d]);
/* Recall-Regel, getrennt nach Windsystem: Ein «Ja»-Tag zählt für eine Station nur, wenn sein Windsystem zu ihr passt
   (TL → nur Courtelary; «sys:Tag» aus dem Archiv oder der Markierung → nur Stationen mit diesem System; ohne Angabe → alle).
   Rückgabe "ev", "nev" oder null (zählt für diese Station nicht). */
function evOf(up, truth, d){
  if(truth[d]==="n") return "nev";
  if(truth[d]!=="y") return null;
  const sys = truth["tl:"+d] ? "tl" : truth["sys:"+d] || null;
  if(up.tl) return sys==="tl" ? "ev" : null;
  if(sys==="tl" || (sys && !up.sys.includes(sys))) return null;
  return "ev";
}
/* Aktive Kalibrierungsregel. "pss": Schwelle mit dem besten Peirce-Score (bisher).
   "recall": höchste Schwelle mit Recall ≥ minRecall, unter gleichwertigen die mit tieferer Fehlalarmrate; erreicht keine
   Schwelle minRecall, ist die Station nicht verlässlich. Bleibt "pss", bis je Station und Windsystem genug Ereignistage
   im Archiv liegen (eval/measure.cjs, Akzeptanzregeln in eval/README.md). */
const CAL = {rule:"pss", minRecall:0.85};
function calibrateStation(rows, up, St, days, truth, cha, rule){
  rule = rule || CAL.rule;
  const mx = stationDayMax(rows, up, St, cha);
  const cls = rule==="recall" ? d=>evOf(up, truth, d) : d=>isEv(up, truth, d) ? "ev" : truth[d]==="n" ? "nev" : null;
  const marked = days.filter(d=>cls(d));
  const ev = marked.filter(d=>cls(d)==="ev").length, nev = marked.length-ev;
  if(ev<3 || nev<3) return {ev, nev, best:null, tl:!!up.tl, rule};
  const rowsC = [];
  for(let ts=4; ts<=30; ts++){
    const c = {tp:0,fn:0,fp:0,tn:0};
    marked.forEach(d=>{ const a = (mx[d]||0)>=ts-0.5; cls(d)==="ev" ? (a?c.tp++:c.fn++) : (a?c.fp++:c.tn++); });
    c.ev=ev; c.nev=nev; c.pss = c.tp/ev - c.fp/nev; c.rec = c.tp/ev; c.fpr = c.fp/nev;
    rowsC.push({k:ts, c});
  }
  const rd = v => Math.round(v*100)/100;
  if(rule==="recall"){
    const ok = rowsC.filter(r=>r.c.rec>=CAL.minRecall-1e-9);
    if(!ok.length){ const top = rowsC[0];   /* tiefste Schwelle zeigt, wie weit die Station vom Ziel entfernt ist */
      return {ev, nev, tl:!!up.tl, rule, best:{ts:null, rel:0, rec:rd(top.c.rec), fpr:rd(top.c.fpr), pss:rd(top.c.pss), c:top.c}}; }
    const hi = ok[ok.length-1];
    const m = ok.filter(r=>r.c.rec===hi.c.rec).sort((a,b)=>a.c.fpr-b.c.fpr || b.k-a.k)[0];
    return {ev, nev, tl:!!up.tl, rule, best:{ts:m.k, rel:1, rec:rd(m.c.rec), fpr:rd(m.c.fpr), pss:rd(m.c.pss), c:m.c}};
  }
  const m = plateauMid(rowsC);
  /* ohne erkennbaren Zusammenhang keine eigene Schwelle — Startwert bleibt, Station gilt als nicht verlässlich */
  return {ev, nev, tl:!!up.tl, rule, best: m ? {ts: m.c.pss>0.05 ? m.k : null, pss:rd(m.c.pss), rec:rd(m.c.rec), fpr:rd(m.c.fpr), c:m.c} : null};
}

/* ================= Push-Einstellungen: nur geprüfte Felder übernehmen ================= */
const PUSH_FIELDS = ["T","maxMean","maxGust","win","minH","dirs","spots","k","kDir","cut","st","push","pushForecast","pushLive"];
function pushCfg(St){ const o = {}; PUSH_FIELDS.forEach(k=>o[k]=clone(St[k])); return o; }
function sanitizeCfg(x){
  if(!x || typeof x!=="object" || Array.isArray(x)) throw new Error("kein Einstellungs-Objekt");
  const o = clone(DEF);
  const num = (v,a,b) => typeof v==="number" && isFinite(v) && v>=a && v<=b;
  if(x.T!=null){ if(!num(x.T,10,30)) throw new Error("Schwelle muss 10–30 kn sein"); o.T = Math.round(x.T); }
  if(x.maxMean!=null){ if(!num(x.maxMean,15,60)) throw new Error("Mittelwind-Grenze 15–60 kn"); o.maxMean = Math.round(x.maxMean); }
  if(x.maxGust!=null){ if(!num(x.maxGust,20,70)) throw new Error("Böen-Grenze 20–70 kn"); o.maxGust = Math.round(x.maxGust); }
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
    o.st[u.abk] = {ts: num(v.ts,3,40) ? Math.round(v.ts) : null, pss: num(v.pss,-1,1) ? Math.round(v.pss*100)/100 : null, n: num(v.n,0,1000) ? Math.round(v.n) : 0};
    if(v.rel===0 || v.rel===1) o.st[u.abk].rel = v.rel; });
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

const api = {SPOTS, JURA, CREST, LAKE, JORAN_X, MODELS, DIRS, WINS, LEVELS, UPWIND, LAKE_LEVEL, REGEL_E, FRONT, TL, DEF,
  clone, merge, r0, r1, card, dirOf, dirOn, over, kFor, spotName, fmtCH, hhmm, localDay, localHour, dayOfDate, dayLabel,
  getJSON, fetchModel, parseMeteobase, updateLake, fetchLake, fetchLakeNow, mergeLake, lakeRows, lakeNow, lakeDay, LAKE_COVER, joranCheck, fetchEnsemble, fetchJura, fetchHistory, fetchStation, fetchStations, fetchAll, parseSMN,
  evalHours, evalDay, levelOf, windWindow, summarize, clsOf, ensShare,
  frontCheck, lakeStorm, fresh, ruleE, stTs, stTrust, stRel, isTrusted, stSecFn, upwindNow, nowcast, lageHint, chaWest,
  contingency, calibrate, CAL, evOf, isEv, stationDayMax, calibrateStation, describe, PUSH_FIELDS, pushCfg, sanitizeCfg, cleanId};
if(typeof module!=="undefined" && module.exports) module.exports = api; else root.JoranCore = api;
})(typeof self!=="undefined" ? self : this);
