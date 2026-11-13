#!/usr/bin/env node
/* Joran — Zeitbeschriftung der abgelegten Open-Meteo-Reihen in echte Ortszeit umrechnen (einmalig, wiederholbar).
   Open-Meteo schreibt mit timezone=Europe/Zurich die ganze Reihe mit dem Versatz vom Zeitpunkt des Abrufs. Ein Abruf im
   November beschriftet die Stunden vor dem 25.10. darum eine Stunde zu früh («14:00» war 15:00 MESZ). Neue Abrufe rechnet
   core/daten.js (ortszeit) gleich beim Laden um; dieses Skript bringt die Dateien in eval/data/ auf denselben Stand.
   Versatz: utc_offset_seconds der Antwort, sonst der Versatz von Europe/Zurich zum Zeitpunkt «geholt».
   Fertig umgerechnete Dateien tragen zeit: "ortszeit" und werden nicht ein zweites Mal verschoben.
   Aufruf: node eval/zeitversatz.cjs [--pruefen]   (--pruefen: nur melden, nichts schreiben)
   Als Modul: hourly(j) gibt die Stundenreihe einer abgelegten Open-Meteo-Antwort in Ortszeit zurück (für den Höhenwind,
   der beim Erneuern als rohe Antwort abgelegt wird). */
"use strict";
const fs = require("fs"), path = require("path");
const C = require(path.join(__dirname, "..", "core.js"));
const DIR = path.join(__dirname, "data");
const MARK = "ortszeit";

/* Versatz von Europe/Zurich in Sekunden zu einem Zeitpunkt */
const F = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Zurich",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
function versatzBei(iso){
  const t = Date.parse(iso); if(isNaN(t)) return null;
  const p = {}; F.formatToParts(new Date(t)).forEach(x=>{ p[x.type] = x.value; });
  const lokal = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  return Math.round((lokal - Math.floor(t/1000)*1000)/1000);
}
const idx = t => { const m = {}; t.forEach((x,i)=>{ m[x] = i; }); return m; };

/* Stundenreihe einer abgelegten Antwort in Ortszeit (ohne die Datei zu ändern) */
function hourly(j){
  if(!j || !j.hourly) return j ? j.hourly : null;
  if(j.zeit===MARK) return j.hourly;
  return Object.assign({}, j.hourly, {time:C.ortszeit(j.hourly.time, j.utc_offset_seconds)});
}

/* Je Datei: wie sie umgerechnet wird */
const DATEIEN = {
  "prognose_vortag.json": (D, off) => { D.models.forEach(m=>m.spots.forEach(s=>{ s.h.time = C.ortszeit(s.h.time, off); s.idx = idx(s.h.time); })); },
  "stunde_prognose.json": (D, off) => { D.kamm.time = C.ortszeit(D.kamm.time, off);
    Object.values(D.see).forEach(m=>Object.values(m).forEach(h=>{ h.time = C.ortszeit(h.time, off); })); },
  "joran_prognose.json": (D, off) => { D.punkte.forEach(h=>{ h.time = C.ortszeit(h.time, off); }); },
  "hoehenwind_icon_eu.json": (D, off) => { D.hourly.time = C.ortszeit(D.hourly.time, off); },
  "hoehenwind_ecmwf_ifs025.json": (D, off) => { D.hourly.time = C.ortszeit(D.hourly.time, off); },
};

function umrechnen(name, D){
  if(D.zeit===MARK) return {name, status:"schon in Ortszeit"};
  const off = D.utc_offset_seconds!=null ? D.utc_offset_seconds : versatzBei(D.geholt);
  if(off==null) return {name, status:"kein Versatz bekannt (weder utc_offset_seconds noch geholt), unverändert"};
  DATEIEN[name](D, off);
  D.zeit = MARK;
  return {name, status:`umgerechnet (Versatz beim Abruf ${off/3600} h)`};
}

if(require.main===module){
  const nur = process.argv.includes("--pruefen");
  Object.keys(DATEIEN).forEach(name=>{
    const f = path.join(DIR, name); if(!fs.existsSync(f)) return console.log(`${name}: fehlt`);
    const D = JSON.parse(fs.readFileSync(f, "utf8")), r = umrechnen(name, D);
    if(!nur && D.zeit===MARK && !/schon/.test(r.status)) fs.writeFileSync(f, JSON.stringify(D));
    console.log(`${name}: ${r.status}${nur && !/schon/.test(r.status) ? " (nur geprüft)" : ""}`);
  });
}
module.exports = {hourly, umrechnen, versatzBei, MARK};
