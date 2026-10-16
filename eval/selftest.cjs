/* Selbsttest für eval/measure.cjs mit SYNTHETISCHEN Daten (keine Messwerte!). Prüft Wahrheit, Aufteilung,
   Kalibrierung (Peirce vs. Recall), Signal-Nachspielen, Zählung und Vorlaufzeit gegen von Hand gerechnete Werte.
   Aufruf: node eval/selftest.cjs */
"use strict";
const assert = require("assert");
const C = require("../core.js"), M = require("./measure.cjs");

/* 30 Tage im Juni 2026 (MESZ = UTC+2). Tag i: foilbar, wenn i%3==0 (See 16 kn ab 18:00, sonst 5 kn).
   Cressier: bis 17:00 5 kn, ab 17:00 v kn aus 300°. v = 15 an Windtagen, 10 an den schwachen Windtagen 9 und 24,
   10 an ruhigen Tagen mit i%4==1 (Fehlalarm-Kandidaten 1,5,13,17,25,29), sonst 6. */
const Z = (day, hh, mm) => new Date(Date.UTC(2026, 5, day, hh-2, mm));
const lk = {st:{vin:{rows:[]}, ips:{rows:[]}}}, crm = [];
for(let i=0; i<30; i++){
  const day = i+1, ev = i%3===0, weak = i===9 || i===24, fpc = !ev && i%4===1;
  for(let m=15*60; m<=21*60+30; m+=10){
    const t = Z(day, Math.floor(m/60), m%60), v = ev && m>=18*60 ? 16 : 5;
    lk.st.vin.rows.push({t:t.toISOString(), mean:v, dir:240, gust:v+4});
    lk.st.ips.rows.push({t:new Date(+t+60e3).toISOString(), mean:v-1, dir:240, gust:v+3});
  }
  for(let m=0; m<24*60; m+=10){
    const t = Z(day, Math.floor(m/60), m%60);
    const v = m<17*60 ? 5 : ev ? (weak ? 10 : 15) : fpc ? 10 : 6;
    crm.push({t, mean:v, dir:300, gust:v+5, temp:20, qff:1015});
  }
}
const S = {crm:{t:crm, h:M.hourly(crm)}};
const St = C.merge({T:14, win:"abend", minH:1});
const R = M.measure({lk, S, marks:null, St, split:0.6,
  cores:{vorher:{label:"vorher", core:C, rule:"pss"}, nachher:{label:"nachher", core:C, rule:"recall"}}});

assert.strictEqual(R.truth.known, 30); assert.strictEqual(R.truth.y, 10); assert.strictEqual(R.truth.n, 20);
assert.deepStrictEqual(R.truth.sys, {joran:10});
assert.deepStrictEqual(R.truth.jtyp, {stat:10});                      /* Juni, kein Südwest vorher → statique */
assert.strictEqual(R.split.train, 18); assert.strictEqual(R.split.trainRange[1], "2026-06-18"); assert.strictEqual(R.split.testRange[0], "2026-06-19");
const v = R.vorher.stations.find(s=>s.abk==="crm"), n = R.nachher.stations.find(s=>s.abk==="crm");
/* Kalibrierung auf 18 Tagen: Peirce-Plateau 11–15 → Mitte 13; Recall-Regel: höchste Schwelle mit Recall ≥ 0.85 = 10 */
assert.strictEqual(v.ts, 13); assert.strictEqual(n.ts, 10); assert.strictEqual(n.cal.rel, 1);
/* Messung auf 12 Tagen (4 Windtage, davon 1 schwach; 8 ruhige, davon 2 mit 10 kn) */
assert.strictEqual(v.total.ev, 4); assert.strictEqual(v.total.nev, 8);
assert.strictEqual(v.total.tp, 3); assert.strictEqual(v.total.fp, 0);
assert.strictEqual(n.total.tp, 4); assert.strictEqual(n.total.fp, 2);
assert.strictEqual(n.cells.joran.fp, 2); assert.strictEqual(n.cells.w.fp, 0);
/* Vorlauf: See ab 18:00; vorher Signal 17:20 (40 min); nachher 17:10 an starken (50), 17:20 am schwachen Tag (40) */
assert.strictEqual(v.total.lead, 40); assert.strictEqual(n.total.lead, 47.5);
assert.strictEqual(R.nachher.regelE.tp, 4); assert.strictEqual(R.nachher.regelE.fp, 2);
assert.deepStrictEqual(R.accept.map(a=>a.ok), [true, false, true, true, false]);
assert.ok(R.verdict.startsWith("NICHT ERFÜLLT — VORLÄUFIG"));
assert.strictEqual(R.vorher.pooled.tp, 3); assert.strictEqual(R.nachher.pooled.tp, 4);   /* alle Signale vor 18:00 */
/* nicht verlässliche Station zählt in ALLE nicht: Recall-Ziel unerreichbar machen */
assert.strictEqual(C.isTrusted({u:{rel:0, trust:0.9}, up:C.UPWIND[0]}), true);            /* Recall-Regel nicht aktiv: rel wirkt nicht */
assert.strictEqual(C.isTrusted({u:{rel:0, trust:0.9}, up:C.UPWIND[0]}, "recall"), false);
/* Markierung überstimmt: Tag 2026-06-28 (i=27, automatisch foilbar) als «Nein» markiert → Abweichung ausgewiesen */
const R2 = M.measure({lk, S, marks:{"2026-06-28":"n", "2026-06-02":"n"}, St, split:0.6,
  cores:{vorher:{core:C, rule:"pss"}, nachher:{core:C, rule:"recall"}}});
assert.strictEqual(R2.truth.deviations.length, 1); assert.strictEqual(R2.truth.deviations[0].day, "2026-06-28");
assert.strictEqual(R2.truth.y, 9); assert.strictEqual(R2.truth.marked, 2);
/* Wahrheit: «während minH Stunden ≥ T» — 30 min 22 kn + 30 min 7 kn ist kein Ereignis (Mittel 14.5 genügt nicht) */
const day1 = (vals, step) => ({st:{vin:{rows:vals.map((v,k)=>({t:Z(1, 17, 0+k*(step||10)).toISOString(), mean:v, dir:300}))}, ips:{rows:[]}}});
assert.strictEqual(C.lakeDay(day1([22,22,22,7,7,7]), "2026-06-01", St).ev, false);
assert.strictEqual(C.lakeDay(day1([15,15,15,15,15,15]), "2026-06-01", St).ev, true);                /* 6 Werte = 60 min */
assert.strictEqual(C.lakeDay(day1([15,15,15,15,15]), "2026-06-01", St).ev, false);                  /* 50 min */
assert.strictEqual(C.lakeDay(day1([15,15,13,15,15,15]), "2026-06-01", St).ev, false);               /* Einbruch unter T */
assert.strictEqual(C.lakeDay(day1([13.5,14,14,14,14,14]), "2026-06-01", St).ev, true);              /* gerundet wie in der App */
const gap = {st:{vin:{rows:[0,10,30,40,50].map(m=>({t:Z(1,17,m).toISOString(), mean:15, dir:300}))}, ips:{rows:[]}}};
assert.strictEqual(C.lakeDay(gap, "2026-06-01", St).ev, true);                                       /* ein fehlender Wert */
const gap2 = {st:{vin:{rows:[0,10,40,50,60,70].map(m=>({t:Z(1,17,m).toISOString(), mean:15, dir:300}))}, ips:{rows:[]}}};
assert.strictEqual(C.lakeDay(gap2, "2026-06-01", St).ev, false);                                     /* Lücke 30 min trennt */
/* Joran-Typ: Südwest 12 kn in Neuchâtel vorher + Druckanstieg 2 hPa → dynamique; ohne Südwest im Oktober → unbestimmt */
const on = Z(10, 18, 0), neuRows = [];
for(let m=-7*60; m<=2*60; m+=10) neuRows.push({t:new Date(+on+m*60e3), mean:m<-60?12:8, dir:m<-60?240:300, temp:15, qff: m<-60 ? 1010 : 1012});
assert.strictEqual(C.joranType(on, {neu:{t:neuRows}}), "dyn");
assert.strictEqual(C.joranType(on, {neu:{t:neuRows.map(r=>Object.assign({}, r, {qff:1010}))}}), "stat");      /* Juni ohne Front */
assert.strictEqual(C.joranType(new Date(Date.UTC(2026,9,10,16)), {}), null);                                  /* Oktober ohne Front */
const marksT = {"2026-06-04":"y", "jtyp:2026-06-04":"dyn"};
assert.strictEqual(M.measure({lk, S, marks:marksT, St, split:0.6, cores:{vorher:{core:C, rule:"pss"}, nachher:{core:C, rule:"recall"}}}).truth.jtyp.dyn, 1);
/* Neuchâtel: Joran-Signal zählt ungeprüft nicht, West-Signal schon */
const neuUp = C.UPWIND.find(u=>u.abk==="neu");
assert.strictEqual(C.isTrusted({up:neuUp, u:{trust:null, sys:{id:"joran"}}}), false);
assert.strictEqual(C.isTrusted({up:neuUp, u:{trust:null, sys:{id:"w"}}}), true);
console.log("Selbsttest bestanden (synthetische Daten).");
