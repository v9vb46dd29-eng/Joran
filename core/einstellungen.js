/* Joran — Silo «einstellungen». Push-Einstellungen eines Nutzers prüfen und übernehmen (users/<name>.json): nur
   bekannte Felder, nur gültige Werte.
   Hängt ab von: konstanten, helfer. Aufbau und Regeln: ARCHITEKTUR.md */
(function(root, make){
  const dep = n => typeof module!=="undefined" && module.exports ? require("./"+n+".js") : root.Joran[n];
  const api = make(dep);
  if(typeof module!=="undefined" && module.exports) module.exports = api; else (root.Joran = root.Joran || {}).einstellungen = api;
})(typeof self!=="undefined" ? self : this, function(dep){
"use strict";
const {SPOTS, DIRS, WINS, UPWIND, DEF} = dep("konstanten");
const {clone} = dep("helfer");

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

return {PUSH_FIELDS, pushCfg, sanitizeCfg, cleanId};
});
