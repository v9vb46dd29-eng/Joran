/* Joran — Silo «modell». Parameter des Prognosemodells: Modell v2 (Stationsfaktoren, Kopplung H3, Höhenwind H4),
   Regel der Stationskalibrierung, Schichtung. Hier trägt eine Modellprüfung neue Werte ein (node eval/measure.cjs
   --fit). MODEL.active = false: Die App rechnet mit den Startwerten.
   Hängt ab von: nichts. Aufbau und Regeln: ARCHITEKTUR.md */
(function(root, make){
  const dep = n => typeof module!=="undefined" && module.exports ? require("./"+n+".js") : root.Joran[n];
  const api = make(dep);
  if(typeof module!=="undefined" && module.exports) module.exports = api; else (root.Joran = root.Joran || {}).modell = api;
})(typeof self!=="undefined" ? self : this, function(dep){
"use strict";
/* Schichtung für den Höhenwind (H4): 850 hPa liegt rund dz km über dem See; ab lapseMin K je km Temperaturabnahme gilt
   die Luft als durchmischt. Fester Wert, wird nicht je Block bestimmt. */
const HOEHE = {dz:1.07, lapseMin:4};
/* Modell v2 (vorläufig, siehe eval/ITERATIONEN.md): Stationsfaktor je Windsystem, aus der Seemessung bestimmt (fitModel).
   Die Stationsschwelle ist T × Faktor und gilt damit für jede einstellbare Schwelle. active = false: Die App rechnet wie
   bisher mit den Startwerten f der Stationen. Zum Messen aktiviert eval/measure.cjs das Modell über St.model.
   f[abk][system] = {f, rel, rec, fpr, ev, days}: rel 1 = löst Push aus, 0 = nicht verlässlich (zählt nicht),
   rel fehlt = kein brauchbarer Faktor gefunden, Station zählt wie bisher mit ihrem Startwert. */
const MODEL = {active:false, minRecall:0.85, maxFpr:0.30, margin:0.9, minF:0.5, tGrid:[8,10,12,14], minDays:4,
  /* Kopplung der Luftschichten (H3): Ein Signal der Kammstation zählt nur, wenn die Temperatur von der Bodenstation ref
     bis zum Kamm um mindestens min K je km abnimmt. Bei stabiler Schichtung kommt der Höhenwind nicht bis auf den See.
     min: hinterlegter Wert aus dem Lagebild der Entwicklungstage (eval/schichten.cjs). fitModel bestimmt ihn neu:
     höchste Grenze, mit der das erste rechtzeitige Signal der Kammstation an jedem foilbaren Abend bestehen bleibt (der
     Push kommt also nicht später), davon der Anteil margin. Höchstens max: Die Daten dürfen die Grenze nur lockern, nie
     über den Wert heben, ab dem die Schichtung im Lagebild als durchmischt gilt. Unter minDays solchen Abenden gibt es
     keine Grenze, das Signal zählt dann wie bisher. */
  kopplung:{min:4, ref:"crm", st:["cha"], minDays:2, max:4},
  /* Höhenwind in der Prognose (H4): Wind auf 850 hPa bei durchmischter Luft mindestens f × T. f: hinterlegter Wert aus
     node eval/measure.cjs --fit (bis 11.11.2026 fest 1.1, ohne Sicherheitsabstand). fitModel bestimmt ihn neu, wenn
     Höhendaten vorliegen: kleinstes Verhältnis Höhenwind zu T über alle foilbaren Abende (Schwellen aus tGrid ab tMin,
     der kleinsten einstellbaren Schwelle), davon der Anteil margin. Unter minDays foilbaren Abenden oder wenn einer
     davon bei stabiler Schichtung lag, gibt es keine Regel, die Prognose zählt dann wie bisher. */
  hoehe:{f:1, minDays:4, tMin:10},
  /* Stand der Parameter: node eval/measure.cjs --fit (Entwicklungstage 2026-10-16 bis 2026-11-05) */
  fitted:["2026-10-16", "2026-11-05"],
  f:{
    crm:{"w":{"f":0.81,"rec":0.89,"fpr":0.02,"ev":18,"days":5,"rel":1}},
    neu:{"w":{"f":0.81,"rec":0.89,"fpr":0,"ev":18,"days":5,"rel":1}},
    pay:{"s":{"f":0.63,"rec":0.89,"fpr":0.04,"ev":18,"days":5,"rel":1}},
    gre:{"bise":{"f":null,"rec":1,"fpr":0.67,"ev":9,"days":5}},
    wyn:{"bise":{"f":null,"rec":1,"fpr":0.35,"ev":6,"days":4}},
    chm:{"w":{"f":0.63,"rec":0.94,"fpr":0.02,"ev":18,"days":5,"rel":1}},
    cdf:{"w":{"f":0.72,"rec":1,"fpr":0.02,"ev":14,"days":4,"rel":1}},
    brl:{"w":{"f":0.86,"rec":1,"fpr":0.05,"ev":18,"days":5,"rel":1}}
  }};
/* Lage-Faktor (vorläufig, 14.11.2026, siehe eval/ITERATIONEN.md v30): Die Kammprognose (ICON-CH2, Chasseral) legt die
   Lage des Tages fest, mit denselben Sektoren wie das Windbild (nord = N, bise = NO und O). Je Lage wird der Modellwind
   an einzelnen Spots mit f multipliziert. Nordlage: Die Modelle unterschätzen Vingelz/Ipsach, Faktoren nur ≥ 1, Seemitte
   bleibt. Bise: Seemitte liegt über der Messung, Faktor nur zwischen minF und 1, Vingelz/Ipsach bleiben. So kann die
   Regel bei Nordlage nichts verpassen, was heute angekündigt wird; bei Bise kann sie es (bisher kein foilbarer Bise-Abend
   im Archiv). active = false: Die Stufe rechnet wie bisher. Messen: node eval/lage-faktor.cjs.
   f: aus allen Entwicklungstagen bestimmt und zur sicheren Seite gerundet (nicht unabhängig gemessen): Nordlage Ipsach 1.17 aus
   2 Tagen (Fenster Tag), Bise Seemitte 0.63 (Abend) und 0.69 (Tag) aus 9 Tagen.
   minTage: so viele Tage einer Lage braucht eine Neubestimmung, sonst bleibt der Faktor 1. */
const LAGE = {active:false, sek:{nord:[337.5, 22.5], bise:[22.5, 112.5]}, minKn:3, minStd:3, minF:0.5, minTage:2, minModell:5,
  heben:{nord:["vin","ips"]}, senken:{bise:["mit"]},
  f:{nord:{vin:1, ips:1.15}, bise:{mit:0.7}}};
const modelOf = St => (St && St.model) || (MODEL.active ? MODEL : null);
/* Aktive Kalibrierungsregel. "pss": Schwelle mit dem besten Peirce-Score (bisher).
   "recall": höchste Schwelle mit Recall ≥ minRecall, unter gleichwertigen die mit tieferer Fehlalarmrate; erreicht keine
   Schwelle minRecall, ist die Station nicht verlässlich. Bleibt "pss", bis je Station und Windsystem genug Ereignistage
   im Archiv liegen (eval/measure.cjs, Akzeptanzregeln in eval/README.md). */
const CAL = {rule:"pss", minRecall:0.85};

return {HOEHE, MODEL, modelOf, CAL, LAGE};
});
