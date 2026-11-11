/* Joran — Silo «konstanten». Feste Angaben: Spots, Seestationen, Modelle, Windsysteme, Zeitfenster,
   Upwind-Stationen, Grenzwerte der Regeln, Standard-Einstellungen. Neue Station oder neues Windsystem: hier
   eintragen.
   Hängt ab von: nichts. Aufbau und Regeln: ARCHITEKTUR.md */
(function(root, make){
  const dep = n => typeof module!=="undefined" && module.exports ? require("./"+n+".js") : root.Joran[n];
  const api = make(dep);
  if(typeof module!=="undefined" && module.exports) module.exports = api; else (root.Joran = root.Joran || {}).konstanten = api;
})(typeof self!=="undefined" ? self : this, function(dep){
"use strict";
const SPOTS = [
  {id:"vin", name:"Vingelz",  lat:47.127, lon:7.218},
  {id:"ips", name:"Ipsach",   lat:47.119, lon:7.224},
  {id:"mit", name:"Seemitte", lat:47.088, lon:7.180}
];
const JURA = {lat:47.083, lon:6.792};            /* Jura-Hochfläche bei La Chaux-de-Fonds */
const CREST = {lat:47.132, lon:7.054};           /* Chasseral, Kammhöhe */
/* Druckunterschied über den Jura wie bei MeteoSchweiz: Besançon − Neuchâtel. Positiv = Kaltluft staut sich westlich (Front-Joran) */
const BES = {lat:47.24, lon:6.02}, NEUP = {lat:47.00, lon:6.95};
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
  {abk:"crm", name:"Cressier",  sys:["joran","w"],  f:0.85, role:"Jurasüdfuss, 10 km westlich", alt:431},
  {abk:"cha", name:"Chasseral", sys:["joran","n"],  f:1.15, role:"Jurakamm 1594 m, Höhenwind", alt:1594},
  /* Joran zählt in Neuchâtel erst, wenn der Rückblick die Station als verlässlich ausweist (extraSys) */
  {abk:"neu", name:"Neuchâtel", sys:["w","s","joran"], f:0.85, role:"Neuenburgersee, 25 km SW", extraSys:["joran"]},
  {abk:"pay", name:"Payerne",   sys:["w","s","so"], f:0.8,  role:"Broyetal, 35 km SW"},
  {abk:"gre", name:"Grenchen",  sys:["bise","n"],   f:0.8,  role:"Jurasüdfuss, 15 km NO"},
  {abk:"wyn", name:"Wynau",     sys:["bise"],       f:0.75, role:"Aaretal, 40 km NO"},
  {abk:"mub", name:"Mühleberg", sys:["s","so"],     f:0.75, role:"Mittelland, 25 km S"},
  /* Erweiterung für Joran. extra = zählt erst, wenn der Rückblick sie als verlässlich ausweist. */
  {abk:"chm", name:"Chaumont",  sys:["joran","w"],  f:1.0,  role:"erster Jurakamm 1136 m, 25 km SW", extra:true},
  {abk:"cdf", name:"La Chaux-de-Fonds", sys:["joran","w"], f:0.7, role:"Jurahochfläche 1018 m, 30 km WNW", extra:true},
  /* Weiter westlich: Ein Front-Joran (dynamique) zieht mit der Kaltfront von West nach Ost und erreicht sie früher. Startwerte geschätzt. */
  {abk:"fre", name:"Bullet/La Frétaz", sys:["joran","w"], f:1.0, role:"Jurakamm 1205 m über Grandson, 55 km WSW", extra:true},
  {abk:"brl", name:"La Brévine", sys:["joran","w"], f:0.7, role:"Jurahochtal 1042 m, 50 km W", extra:true},
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
const JORAN_X = {crestSector:[270,360], crest:12, dpRise:0.5, cape:500, bn:2};
/* Joran-Typ eines Tages aus Messwerten (Erfahrungswerte, nicht kalibriert; siehe joranType) */
const JTYP = {dp:1.5, dT:3, sw:8, swSec:[215,280], months:[5,8]};

const DEF = {T:14, maxMean:30, maxGust:39, win:"abend", minH:1, dirs:{n:1,bise:1,so:1,s:1,w:1,joran:1}, spots:{vin:1,ips:1,mit:1},
  k:1, kDir:{}, cut:2, st:{}, push:false, pushForecast:true, pushLive:true};

return {SPOTS, JURA, CREST, BES, NEUP, LAKE, LAKE_KEEP_H, KN, MODELS, ENS_IDS, DIRS, WINS, LEVELS, UPWIND, TL,
  LAKE_LEVEL, FRONT, REGEL_E, JORAN_X, JTYP, DEF};
});
