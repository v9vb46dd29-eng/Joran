#!/usr/bin/env node
/* Joran — Wie dreht der Wind in der Bieler Bucht bei Joran? (Auswertung, kein Modell)
   Sucht Joran-Episoden in Cressier (Sektor und Minimum von Regel E, mindestens 30 min) und zeigt dazu im 10-min-Takt
   Stärke und Richtung in Cressier, auf dem Chasseral, in Vingelz und Ipsach, von 1 h vor bis 1 h nach der Episode.
   Aufruf: node eval/joran.cjs [--bis JJJJ-MM-TT]   (Standard: nur Entwicklungstage aus eval/split.json; Cache aus eval/measure.cjs)
   Idee und offene Fragen: eval/IDEEN.md */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
const iB = process.argv.indexOf("--bis"), bis = iB>0 ? process.argv[iB+1] : split.devBis;
const {lk} = M.loadArchive([], true);
const grid = t => Math.round(+new Date(t)/600e3)*600e3;
const L = {}; C.LAKE.forEach(x=>{ const m = new Map(); lk.st[x.id].rows.forEach(r=>m.set(grid(r.t), r)); L[x.id] = m; });
const first = Math.min(...C.LAKE.map(x=>L[x.id].size ? Math.min(...L[x.id].keys()) : Infinity));
const load = a => JSON.parse(fs.readFileSync(path.join(__dirname, "cache", a+".t.json"), "utf8")).map(r=>Object.assign(r, {t:new Date(r.t)})).filter(r=>+r.t>=first);
const crm = load("crm"), crmAt = new Map(crm.map(r=>[+r.t, r])), cha = new Map(load("cha").map(r=>[+r.t, r]));
const E = C.REGEL_E, inE = r => r.dir!=null && r.dir>=E.sector[0] && r.dir<=E.sector[1] && r.mean>=E.min;
const ep = []; let cur = [];
for(const r of crm){ if(C.dayOfDate(r.t)>bis) break; if(inE(r)) cur.push(r); else { if(cur.length>=3) ep.push(cur); cur = []; } }
if(cur.length>=3) ep.push(cur);
const f = r => r ? `${C.r0(r.mean)} ${C.card(r.dir)}`.padEnd(9) : "–        ";
console.log(`Joran-Episoden in Cressier (${E.sector[0]}–${E.sector[1]}°, ≥ ${E.min} kn, ≥ 30 min) bis ${bis}: ${ep.length}`);
ep.forEach(e=>{
  const t0 = +e[0].t, t1 = +e[e.length-1].t;
  console.log(`\n${C.dayOfDate(e[0].t)} ${C.hhmm(e[0].t)}–${C.hhmm(e[e.length-1].t)} (${e.length*10} min)   * = Joran in Cressier`);
  console.log("Zeit    Cressier  Chasseral Vingelz   Ipsach    Ipsach−Vingelz");
  for(let t=t0-3600e3; t<=t1+3600e3; t+=600e3){ const v = L.vin.get(t), i = L.ips.get(t);
    console.log(C.hhmm(new Date(t)), t>=t0 && t<=t1 ? "*" : " ", f(crmAt.get(t)), f(cha.get(t)), f(v), f(i), v && i ? C.r0(i.mean-v.mean)+" kn" : ""); }
});
