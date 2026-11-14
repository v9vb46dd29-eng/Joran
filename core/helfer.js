/* Joran — Silo «helfer». Kleine reine Funktionen: Runden, Richtungen, Zeit in Europe/Zurich, Einstellungen
   zusammenführen.
   Hängt ab von: konstanten. Aufbau und Regeln: ARCHITEKTUR.md */
(function(root, make){
  const dep = n => typeof module!=="undefined" && module.exports ? require("./"+n+".js") : root.Joran[n];
  const api = make(dep);
  if(typeof module!=="undefined" && module.exports) module.exports = api; else (root.Joran = root.Joran || {}).helfer = api;
})(typeof self!=="undefined" ? self : this, function(dep){
"use strict";
const {SPOTS, DIRS, DEF, FEST} = dep("konstanten");

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
  o.kDir = Object.assign({}, (s&&s.kDir)||{}); o.st = Object.assign({}, (s&&s.st)||{}); return Object.assign(o, FEST); };

function fmtCH(dt, opts){ return new Intl.DateTimeFormat("de-CH", Object.assign({timeZone:"Europe/Zurich"}, opts)).format(dt); }
const hhmm = dt => fmtCH(dt,{hour:"2-digit",minute:"2-digit"});
function localDay(off, now){
  const t = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"}).format(now||new Date());
  const [y,m,d] = t.split("-").map(Number);
  return new Date(Date.UTC(y,m-1,d+off,12)).toISOString().slice(0,10);
}
/* Formatierer einmal anlegen: Sie werden beim Nachspielen vieler Tage sehr oft gebraucht */
const HOUR_FMT = new Intl.DateTimeFormat("de-CH",{timeZone:"Europe/Zurich",hour:"2-digit",hour12:false});
const DAY_FMT = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit"});
const localHour = now => parseInt(HOUR_FMT.format(now||new Date()),10) % 24;
const dayOfDate = dt => DAY_FMT.format(dt);
const dayLabel = (day, o) => fmtCH(new Date(day+"T12:00:00Z"), o||{weekday:"short",day:"numeric",month:"numeric"});

return {clone, r0, r1, card, inArc, dirOf, dirOn, over, kFor, spotName, merge, fmtCH, hhmm, localDay, localHour,
  dayOfDate, dayLabel};
});
