/* Joran — Rechenkern (Fassade). Wird von index.html (Browser), push/check.cjs (GitHub Action) und eval/ gemeinsam genutzt.
   Keine Abhängigkeiten, keine KI: nur Open-Meteo, MeteoSchweiz und feste Regeln.
   Der Code liegt in Silos unter core/. Diese Datei fasst ihre öffentlichen Namen zu einem Objekt zusammen (JoranCore im
   Browser, require("./core.js") in Node). Was hier nicht steht, ist innere Sache eines Silos.
   Reihenfolge = Abhängigkeit: Ein Silo darf nur Silos brauchen, die weiter oben stehen. Aufbau und Regeln: ARCHITEKTUR.md */
(function(root){
"use strict";
const SILOS = {
  konstanten: `SPOTS JURA CREST BES NEUP JTYP LAKE JORAN_X MODELS DIRS WINS LEVELS UPWIND LAKE_LEVEL REGEL_E FRONT
    TL DEF`,
  helfer: `clone merge r0 r1 card dirOf dirOn over kFor spotName fmtCH hhmm localDay localHour dayOfDate
    dayLabel`,
  modell: "CAL MODEL modelOf HOEHE",
  see: "parseMeteobase mergeLake lakeRows lakeNow lakeDay LAKE_COVER lakeStorm",
  prognose: "joranCheck evalHours evalDay levelOf windWindow summarize clsOf ensShare hoeheDay hoeheOk describe",
  messung: `joranType isExtra frontCheck fresh ruleE stTs stTrust stRel isTrusted stSecFn upwindNow nowcast
    lageHint chaWest lapseRate`,
  kalibrierung: "contingency calibrate fitModel evOf isEv stationDayMax calibrateStation",
  daten: `getJSON fetchModel updateLake fetchLake fetchLakeNow fetchEnsemble fetchJura fetchHistory
    fetchStation fetchStations fetchAll parseSMN fetchHoehe`,
  einstellungen: "PUSH_FIELDS pushCfg sanitizeCfg cleanId",
};
const node = typeof module!=="undefined" && module.exports;
const api = {};
Object.keys(SILOS).forEach(s=>{
  const silo = node ? require("./core/"+s+".js") : root.Joran && root.Joran[s];
  if(!silo) throw new Error("Joran: Silo «"+s+"» fehlt (core/"+s+".js vor core.js laden)");
  SILOS[s].split(/\s+/).forEach(n=>{ if(!(n in silo)) throw new Error("Joran: «"+n+"» fehlt im Silo «"+s+"»"); api[n] = silo[n]; });
});
if(node) module.exports = api; else root.JoranCore = api;
})(typeof self!=="undefined" ? self : this);
