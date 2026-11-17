/* Joran — Oberfläche «windbild». Sektion «Windbild»: Karte der Bieler Bucht mit dem typischen Wind je Lage, Lage von heute vorgewählt, Wind von jetzt an Vingelz und Ipsach daneben. Startseite kompakt, im Blatt «Erklärungen» mit allen Lagen (mode). Zahlen aus data/windbild.json (über den Rechenkern geladen), Geometrie der Karte hier.
   Klassisches Skript: teilt sich die Namen mit den anderen Dateien unter app/. Reihenfolge in index.html:
   basis, see, live, einstellungen, push, rueckblick, windbild, start. Aufbau und Regeln: ARCHITEKTUR.md */
"use strict";
const WB = (function(){
/* ---------- Geografie (vereinfacht, schematisch) ---------- */
const LAT0 = 47.09, LON0 = 7.15, KX = 75.8, KY = 111.2;
const km = ([lat,lon]) => [(lon-LON0)*KX, (lat-LAT0)*KY];
const VIEWS = {
  region:{name:"Region", lon:[6.53,7.83], lat:[46.71,47.29]},
  see:   {name:"See",   lon:[7.045,7.272], lat:[47.028,47.150]},
  bucht: {name:"Bucht", lon:[7.170,7.258], lat:[47.098,47.141]}
};
const SHORE = [[47.1335,7.2365],[47.1315,7.2270],[47.1290,7.2200],[47.1268,7.2155],[47.1235,7.2100],[47.1200,7.2040],[47.1170,7.1975],[47.1135,7.1900],[47.1080,7.1810],[47.1020,7.1715],[47.0965,7.1610],[47.0935,7.1540],[47.0890,7.1445],[47.0845,7.1355],[47.0790,7.1220],[47.0730,7.1100],[47.0665,7.1000],[47.0610,7.0880],[47.0560,7.0770],[47.0525,7.0700],[47.0490,7.0720],[47.0465,7.0820],[47.0440,7.0930],[47.0405,7.1030],[47.0360,7.1110],[47.0370,7.1250],[47.0410,7.1400],[47.0450,7.1520],[47.0505,7.1680],[47.0555,7.1810],[47.0620,7.1910],[47.0700,7.2000],[47.0790,7.2085],[47.0870,7.2140],[47.0960,7.2180],[47.1040,7.2215],[47.1110,7.2245],[47.1170,7.2270],[47.1215,7.2320],[47.1250,7.2390],[47.1290,7.2410],[47.1320,7.2400]];
const ISLAND = [[47.0445,7.0985],[47.0520,7.1090],[47.0600,7.1200],[47.0680,7.1340],[47.0740,7.1450],[47.0790,7.1540],[47.0835,7.1630],[47.0815,7.1665],[47.0770,7.1600],[47.0720,7.1500],[47.0660,7.1385],[47.0590,7.1250],[47.0510,7.1130],[47.0430,7.1010]];
/* nur im Ausschnitt Region: Neuenburgersee und Murtensee, grob */
const NEUSEE = [[46.778,6.640],[46.800,6.680],[46.830,6.735],[46.865,6.785],[46.900,6.830],[46.935,6.870],[46.965,6.905],[46.990,6.935],[47.005,6.965],[47.015,7.000],[47.012,7.040],
  [46.995,7.055],[46.972,7.030],[46.945,6.990],[46.915,6.950],[46.885,6.905],[46.850,6.855],[46.815,6.790],[46.790,6.725],[46.772,6.665]];
const MURTEN = [[46.958,7.100],[46.948,7.130],[46.930,7.120],[46.905,7.075],[46.900,7.045],[46.915,7.045],[46.935,7.070]];
const RIDGES_REGION = [
  {w:7, p:[[46.835,6.520],[46.880,6.600],[46.930,6.690],[46.985,6.775],[47.035,6.860],[47.080,6.930]]},
  {w:7, p:[[47.205,7.33],[47.225,7.420],[47.250,7.520],[47.270,7.620]]}
];
/* SwissMetNet-Stationen (Koordinaten aus den Metadaten von MeteoSchweiz) */
const STAT = {crm:[47.0476,7.0591], cha:[47.1318,7.0544], neu:[47.0001,6.9533], pay:[46.8116,6.9425], gre:[47.1791,7.4151], wyn:[47.2550,7.7875],
  mub:[46.9733,7.2782], chm:[47.0492,6.9788], cdf:[47.0829,6.7923], fre:[46.8406,6.5764], brl:[46.9838,6.6103], coy:[47.1808,7.0907],
  mah:[46.7370,6.5680]};
/* Nur zur Anzeige im Ausschnitt Region, kein Upwind-Signal: Am Westende des Neuenburgersees (Yverdon, Estavayer) gibt es keine
   öffentliche Station mit Wind; am nächsten liegt Mathod in der Orbe-Ebene, 7 km südwestlich von Yverdon. */
const ANZEIGE = [{abk:"mah", name:"Mathod", voll:"Mathod (Orbe-Ebene bei Yverdon)"}];
/* La Neuveville: Live misst dort nur Windfinder, ohne offene Schnittstelle. Angezeigt wird darum das Modellmittel der vier
   Modelle der App (Seezelle vor dem Hafen), immer als «Modell» gekennzeichnet. Es richtet die Karte nicht aus. */
const NEUV = {ll:[47.063,7.100], name:"La Neuveville", voll:"La Neuveville (Modell, keine öffentliche Messung)"};
let NEUV_D = null;
/* Weitere Wingfoil-Spots (Simon, 17.11.2026): keine Messung, Wert geschätzt aus dem Windbild an ihrem Ort, immer mit «~» und
   blass. La Neuveville hat auf der Startseite den Modellwert (NEUV), auf der Musterkarte die Schätzung. */
const SPOTS_KARTE = [
  {id:"neuv", name:"La Neuveville", ll:[47.063,7.100]},
  {id:"wing", name:"Wingreis", ll:[47.103,7.174]},
  {id:"stbl", name:"St-Blaise", ll:[47.008,6.985], voll:"St-Blaise (Neuenburgersee)"}
];
function holeNeuv(){
  const e = NEUV_D; if(e && (e.busy || Date.now()-e.at<30*60000)) return;
  NEUV_D = Object.assign(e || {}, {busy:true});
  C.fetchPunkt(NEUV.ll[0], NEUV.ll[1], 2).then(d=>{ NEUV_D = {d, at:Date.now()}; }).catch(err=>{ NEUV_D = {d:e && e.d, err:err.message||"Fehler", at:Date.now()}; })
    .then(()=>{ if(ST.view!=="bucht") drawn = ""; update(); });
}
/* Modellmittel an La Neuveville für eine Stunde (h Stunden ab jetzt) */
function neuvAm(h){
  const d = NEUV_D && NEUV_D.d; if(!d) return null;
  const i = d.idx[stundeKey(h||0).key]; if(i==null) return null;
  return mittel(Object.values(d.m).filter(x=>x.ws[i]!=null && x.wd[i]!=null).map(x=>({kn:x.ws[i], dir:x.wd[i]})));
}
const EXTRA = {};
function holeExtra(){
  ANZEIGE.forEach(a=>{ const e = EXTRA[a.abk]; if(e && (e.busy || Date.now()-e.at<10*60000)) return;
    EXTRA[a.abk] = Object.assign(e || {}, {busy:true});
    C.fetchStation(a.abk).then(rows=>{ EXTRA[a.abk] = {rows, at:Date.now()}; }).catch(err=>{ EXTRA[a.abk] = {err:err.message||"Fehler", at:Date.now()}; })
      .then(()=>{ if(ST.view==="region"){ drawn = ""; update(); } }); });
}
const RIDGES = [
  {w:5.5, p:[[47.064,7.075],[47.080,7.105],[47.096,7.132],[47.110,7.158],[47.124,7.185],[47.136,7.208],[47.147,7.235],[47.160,7.270],[47.175,7.315]]},
  {w:7, p:[[47.080,6.930],[47.105,6.990],[47.132,7.054],[47.150,7.110],[47.166,7.170],[47.180,7.225],[47.196,7.290],[47.205,7.33]]},
  {w:2.5, p:[[47.026,7.080],[47.034,7.105],[47.040,7.125]]}
];
const CANALS = [
  [[47.051,7.071],[47.035,7.045],[47.016,7.012]],
  [[47.056,7.184],[47.052,7.215],[47.048,7.250],[47.045,7.285],[47.043,7.32]],
  [[47.127,7.241],[47.135,7.262],[47.146,7.285],[47.158,7.31],[47.17,7.335]]
];
/* Ortsnamen: [Name, lat, lon, ab Ausschnitt (1 See, 2 Bucht), Art] */
const LABELS = [
  ["Bielersee",47.074,7.178,1,"lakeB"],["Biel/Bienne",47.142,7.247,1,"town"],["Nidau",47.1225,7.2475,1,"town"],
  ["La Neuveville",47.069,7.086,1,"town"],["Twann",47.0995,7.1515,1,"town"],["Erlach",47.037,7.093,1,"town"],
  ["Sutz",47.1015,7.2285,1,"town"],["Tüscherz",47.1135,7.1785,1,"town"],["Alfermée",47.1215,7.1915,2,"town"],
  ["Ligerz",47.0895,7.1275,1,"town"],["Lüscherz",47.0395,7.157,1,"town"],["Hagneck",47.0515,7.195,1,"town"],
  ["Mörigen",47.0845,7.223,1,"town"],["Magglingen",47.1395,7.2085,2,"town"],["Chasseral",47.1395,7.075,1,"peak"],
  ["St. Petersinsel",47.058,7.112,1,"lake"],
  ["Bielersee",47.085,7.165,0,"lakeR"],["Neuenburgersee",46.905,6.900,0,"lakeR"],["Murtensee",46.928,7.155,0,"lakeR"]
];
const MARK = {vin:[47.127,7.218], ips:[47.119,7.224]};
/* Orte der Stützpunkte in data/windbild.json */
const PT = {
  vin:[47.127,7.218], ips:[47.119,7.224], cha:[47.132,7.054], crm:[47.046,7.040], coy:[47.179,7.071],
  neuv:[47.056,7.090], lig:[47.075,7.125], twa:[47.090,7.175], sutz:[47.100,7.205], mor:[47.080,7.195], bay:[47.122,7.223],
  alf:[47.115,7.200], tus:[47.108,7.185], nid:[47.128,7.245], biel:[47.140,7.250], mag:[47.141,7.205], seel:[47.060,7.230],
  erl:[47.035,7.090], pla:[47.110,7.100], son:[47.196,7.172], val:[47.190,7.130], pery:[47.193,7.240], frin:[47.168,7.258],
  tlx:[47.153,7.266], gre:[47.180,7.330], neu:[47.020,7.000], hag:[47.050,7.270], twb:[47.105,7.140], lus:[47.042,7.150],
  bayN:[47.1265,7.231], split:[47.121,7.213]
};
/* Namen der Stützpunkte für die Musterkarte im Blatt «Erklärungen» */
const PTNAME = {vin:"Vingelz", ips:"Ipsach", cha:"Chasseral", crm:"Cressier", coy:"Courtelary", neuv:"La Neuveville", lig:"Ligerz",
  twa:"Twann", sutz:"Sutz", mor:"Mörigen", bay:"Bucht", alf:"Alfermée", tus:"Tüscherz", nid:"Nidau", biel:"Biel", mag:"Magglingen",
  seel:"Seeland", erl:"Erlach", pla:"Plateau de Diesse", son:"Sonceboz", val:"Vallon de St-Imier", pery:"Péry", frin:"Frinvillier",
  tlx:"Taubenloch", gre:"Grenchen", neu:"Neuchâtel", hag:"Hagneck", twb:"Twannberg", lus:"Lüscherz", bayN:"Bucht Nord", split:"Gabelung"};
/* Farbskala in kn */
const STOPS = [[0,[64,82,128]],[4,[56,124,196]],[8,[44,174,186]],[12,[92,196,96]],[16,[230,214,64]],[20,[244,146,44]],[25,[222,60,52]],[30,[186,40,136]],[35,[132,44,168]]];
const KN_MAX = 35;
function col(s){ if(s<=0) return STOPS[0][1];
  for(let i=1;i<STOPS.length;i++){ if(s<=STOPS[i][0]){ const [a,ca] = STOPS[i-1], [b,cb] = STOPS[i], t = (s-a)/(b-a); return ca.map((x,k)=>Math.round(x+(cb[k]-x)*t)); } }
  return STOPS[STOPS.length-1][1]; }
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

/* ---------- Lage von heute ---------- */
/* Eine Lage ist in data/windbild.json über den Wind auf dem Chasseral festgelegt (Sektor ab regeln.kammMin kn, je Lage das
   Feld kamm) und über die Schichtung (durchmischt ab regeln.lapseMin K je km). Die Vorwahl braucht dieselbe Festlegung,
   sonst steht bei Nordlage «Bise» und bei Süd «West», weil der Wind am See gedreht ankommt. Nur wenn es auf dem Chasseral
   schwach weht oder die Angabe fehlt, zählt der Sektor am Boden (DIRS im Rechenkern). */
const sec8 = d => ["N","NO","O","SO","S","SW","W","NW"][Math.round(d/45)%8];
const SEKNAME = {N:"Nord", NO:"Nordost", O:"Ost", SO:"Südost", S:"Süd", SW:"Südwest", W:"West", NW:"Nordwest"};
const BODEN = {w:"west", s:"sued", so:"suedost", bise:"bise", n:"nord", joran:"joran"};
/* Reine Funktion, damit sie sich mit künstlichen Daten prüfen lässt.
   x = {nc: Ergebnis von nowcast (nur im Zeitfenster übergeben), kammP: {kn, dir} Chasseral in der Prognose im Zeitfenster,
        kammM: {kn, dir} Chasseral jetzt gemessen, mixP / mixM: Luft durchmischt laut Prognose / Messung (true, false, null),
        s: Ergebnis von summarize für heute, lake: Ergebnis von lakeNow, jc: Ergebnis von joranCheck, monat: 1–12,
        kammFehlt: true, wenn der Chasseral keinen frischen Wert liefert}
   Reihenfolge der Quellen (v35): Upwind-Signal, Messung auf dem Chasseral, Seemessung (nur wenn der Chasseral schwach misst,
   nicht wenn er fehlt), Kamm- und Fensterprognose, danach die Seemessung ohne Chasseral. Die Messung geht der Prognose vor:
   ICON-CH2 sagt auf dem Chasseral im Mittel nur halb so viel Wind voraus, wie gemessen wird, und zeigt bei Süd Südwest.
   Ergebnis: art = "messung" (Lage von jetzt) oder "prognose" (Lage fürs Zeitfenster); unsicher = true, wenn die Lage ohne
   Messung auf dem Chasseral gewählt ist. Dann kann hinter «West» auch Süd stehen und hinter «Bise» die Nordlage: Keine
   andere Station zeigt den Unterschied (im Archiv 16.10.–5.11. trifft ohne Chasseral Süd 2 %, Nordlage 73 %).
   eval/windbild.cjs --pruefen spielt diese Funktion gegen das Archiv ab. */
function vorwahl(x, lagen, regeln){
  lagen = lagen || (DATA && DATA.lagen) || [];
  const R = Object.assign({kammMin:10}, regeln || (DATA && DATA.regeln) || {});
  /* ohne Sektoren in der Datei (ältere Fassung im Zwischenspeicher) zählt nur der Sektor am Boden */
  const stark = k => !!(k && k.dir!=null && k.kn>=R.kammMin) && lagen.some(z=>(z.kamm||[]).length);
  /* ICON-CH2 sagt auf dem Chasseral im Median 0.49 der Messung voraus (eval/windbild-stunde.cjs): Kammprognose mit
     regeln.kammFaktor hochrechnen, bevor sie mit kammMin verglichen wird. Mit Faktor 2 trifft die Prognose je Stunde Nordlage
     80 statt 60 %, Joran 32 statt 11 %, «West oder Süd» 80 statt 77 % (Lauf des Tages, 16.10.–5.11.; Holdout 6.–12.11.
     gesamt 79 statt 39 %). */
  if(x.kammP && x.kammP.kn!=null) x = Object.assign({}, x, {kammP:{kn:x.kammP.kn*(R.kammFaktor||1), dir:x.kammP.dir}});
  const nc = x.nc, joranOk = !!(nc && nc.eOk) || !!(x.jc && x.jc.crestOk && (x.jc.dpOk || x.jc.bnOk));
  const ohne = (quelle, was) => ({lage:null, quelle, was});
  const vonKamm = (k, quelle, mix) => { const sek = sec8(k.dir), l = lagen.find(z=>(z.kamm||[]).includes(sek));
    if(!l) return ohne(quelle, `${SEKNAME[sek]} auf dem Jura`);
    /* Nordwest auf dem Kamm ist Joran-Lage, auch ohne Joran-Zeichen. Ohne Zeichen kommt er am See oft schwach an
       (eval/regel-e.cjs: Regel E feuert an 39 % der Abende mit Nordwest auf dem Chasseral). */
    if(l.id==="joran" && !joranOk) return {lage:l.id, quelle:quelle+", ohne Joran-Zeichen", mix};
    return {lage:l.id, quelle, mix}; };
  const vonBoden = (d, quelle, mix) => !d ? null : !BODEN[d.id] ? ohne(quelle, d.name)
    : BODEN[d.id]==="joran" && !joranOk ? ohne(quelle, "Nordwest am See, ohne Zeichen für Joran") : {lage:BODEN[d.id], quelle, mix};
  let r = null;
  let art = "messung", kamm = false;   /* kamm: Lage aus der Messung auf dem Chasseral oder aus Regel E */
  if(nc && nc.eOk){ r = {lage:"joran", quelle:"Upwind-Signal (Cressier)", mix:x.mixM}; kamm = true; }
  else if(nc && (nc.trusted||[]).length){
    const t = nc.trusted.find(z=>z.u && z.u.sys) || nc.trusted[0], q = `Upwind-Signal (${t.up.name})`;
    if(stark(x.kammM)){ r = vonKamm(x.kammM, `Messung Chasseral, ${q}`, x.mixM); kamm = true; }
    else if(t.u && t.u.sys && BODEN[t.u.sys.id]) r = {lage:BODEN[t.u.sys.id], quelle:q, mix:x.mixM};
  }
  if(!r && stark(x.kammM)){ r = vonKamm(x.kammM, "Messung Chasseral", x.mixM); kamm = true; }
  /* Seemessung vor der Prognose (v35, Simon 14.11.: «Messung, dann Regeln, dann Prognose»). Die Lage von jetzt kommt aus
     der Messung, die Prognose fürs Zeitfenster zeigt der Regler. eval/kette.cjs, 16.10.–13.11., Lage der laufenden Stunde
     richtig, wenn nur der See misst: 76 % statt 54 % (Entwicklung 83/60, Holdout 56/44, 11.–13.11. 60/20; 11 Tage).
     Ergibt der See keine Lage (Nordwest ohne Joran-Zeichen), geht es mit der Prognose weiter. Nur wenn der Chasseral misst
     (schwach): Fehlt er, trennt erst die Kammprognose Nordlage von Bise und Süd von West (ohne Chasseral trifft die Seemessung
     Süd 0 %, Nordlage 4 %, eval/windbild.cjs --pruefen). */
  let seeOhne = null;
  if(!r && x.kammM && x.kammM.kn!=null){
    const f = (x.lake||[]).filter(z=>z.fresh && z.last && z.last.dir!=null && z.last.mean>=3).sort((a,b)=>b.last.mean-a.last.mean)[0];
    const b = f ? vonBoden(dirOf(f.last.dir), `Seemessung ${f.L.name}`, x.mixM) : null;
    if(b && b.lage) r = b; else seeOhne = b;
  }
  if(!r && stark(x.kammP)){ r = vonKamm(x.kammP, "Prognose, Wind auf dem Chasseral", x.mixP); art = "prognose"; }
  if(!r && x.s && x.s.top && x.s.top.d!=null && x.s.top.v>=3){ r = vonBoden(dirOf(x.s.top.d), "Prognose im Zeitfenster", x.mixP); art = "prognose"; }
  if(!r && seeOhne){ r = seeOhne; art = "messung"; }
  if(!r && !(x.kammM && x.kammM.kn!=null)){
    const f = (x.lake||[]).filter(z=>z.fresh && z.last && z.last.dir!=null && z.last.mean>=3).sort((a,b)=>b.last.mean-a.last.mean)[0];
    if(f) r = vonBoden(dirOf(f.last.dir), `Seemessung ${f.L.name}`, x.mixM);
  }
  /* Bise am See geht vor (v32, Simon 14.11.): Messen Vingelz und Ipsach beide frisch Bise (Sektor «bise» am Boden, je ab
     regeln.seeBiseMin kn), gilt Bise, auch wenn der Chasseral West, Süd oder Nordwest misst. Die Bise liegt dann unter einer
     Inversion, darüber weht ein anderer Wind (14.11., 10–12 Uhr: See 5–8 kn O, Chasseral 12–17 kn S bis W, stabil).
     Nordlage und Südost bleiben: Bei diesen Lagen kommt der Wind am See ohnehin aus Nordost (Muster passt).
     Regel E und ein Upwind-Signal mit anderer Lage (West, Süd, Südost, Joran) gehen weiter vor: Dann kommt Wind, der die
     Bise ablöst. Ein Signal für Bise oder Nordlage (Grenchen, Wynau) blockiert die Regel nicht (Review v32, A1).
     Die Regel greift auch gegen die Kammprognose und die Prognose am Boden, wenn der Chasseral schwach misst oder fehlt. Im Archiv 16.10.–14.11. greift die
     Regel bei der Einführung an 13 von 2255 Zehnminutenwerten, 10 davon am 14.11.; nie foilbar (höchstens 8.5 kn).
     eval/windbild.cjs --pruefen prüft sie auf den Entwicklungstagen. */
  const signal = !!(nc && (nc.eOk || (nc.trusted||[]).some(t=>t.u && t.u.sys && !["bise","n"].includes(t.u.sys.id))));
  if(r && !signal && ["west","sued","joran"].includes(r.lage)){
    const see = ["vin","ips"].map(id=>(x.lake||[]).find(z=>z.L && z.L.id===id));
    const bise = z => !!(z && z.fresh && z.last && z.last.dir!=null && z.last.mean>=(R.seeBiseMin ?? 4) && dirOf(z.last.dir).id==="bise");
    if(see.every(bise)){
      const k = stark(x.kammM) ? x.kammM : null;
      r = {lage:"bise", quelle:"Seemessung Vingelz und Ipsach", mix:false, see:true, ueber:k ? {name:SEKNAME[sec8(k.dir)], kn:Math.round(k.kn)} : null};
      art = "messung"; kamm = false; }   /* Lage vom See: der Regler schreibt sie nicht fort (nur jetzt) */
  }
  if(!r) return {lage:null, vk:null, quelle:"", grund:"Lage von heute noch offen.", art:null, unsicher:false, kamm:false};
  const unsicher = !kamm && !!x.kammFehlt;
  if(!r.lage) return {lage:null, vk:null, quelle:r.quelle, art, unsicher, kamm,
    grund:`${art==="messung" ? "Jetzt" : "Heute"} ${r.was}: Dafür gibt es noch kein Windbild.`};
  const l = lagen.find(z=>z.id===r.lage); let vk = null;
  if(r.lage==="joran") vk = x.jc && x.jc.bnOk ? "front" : x.monat>=5 && x.monat<=8 ? "abend" : "front";
  else if(l && l.vars.length>1){ const v = l.vars.find(z=>z.schicht===(r.mix===false ? "stabil" : "gemischt")); vk = v ? v.key : l.vars[0].key; }
  return {lage:r.lage, vk, quelle:r.quelle, grund:"", art, unsicher, kamm, ueber:r.ueber || null, seeBise:!!r.see};
}
/* Regler: Lage einer kommenden Stunde, in drei Phasen (v35, Simon 14.11.: «kurzfristig führt die Messung, dann die
   Kombination, ab 24 h die Modelle»). jetzt: Lage aus der Messung ({lage, vk, kamm}) oder null, p0 / ph: vorwahl() aus der
   Prognose für jetzt und für die Stunde h. West und Süd zählen als eine Lage: Die Prognose trennt sie nicht.
   1. Die Messung führt FUEHRT Stunden, gleich was die Prognose sagt: so lange, wie sie die Prognose nachweislich schlägt.
   2. Danach, bei einer Lage vom Chasseral (kamm): Messung, ausser die Prognose sagt selbst einen Wechsel voraus (Lage der
      Stunde anders als ihre Lage von jetzt und als die Messung). Bei einer Lage nur aus der Seemessung oder dem Upwind-Signal
      gilt die Prognose.
   3. Ab +24 h (Startseite «Nächste 4 Tage») nur noch die Modelle.
   eval/kette.cjs, 16.10.–13.11., Soll: Lage aus der Messung zur Zielstunde, Lage richtig nach +1/+2/+3/+6 h:
     Chasseral (312 Std.): Prognose 75/76/76/77 %, Regler 88/85/85/78 % (95 % über Tage für +1 h: +5…+21 Punkte).
     nur See (53 Std., 11 Tage): Prognose 55/58/57/59 %, fortgeschrieben 1 h 62 %, 3 h 48 %, 6 h 54 %; auf Holdout und
     neuen Tagen schon ab +1 h nicht besser. Darum FUEHRT.see = 0: Der See bestimmt nur die Lage von jetzt.
   Ohne h (ältere Aufrufe) gilt nur Phase 2 mit der Regel für den Chasseral. */
const FUEHRT = {kamm:2, see:0};
const wsGleich = (a, b) => (a==="sued" ? "west" : a)===(b==="sued" ? "west" : b);
function mischLage(jetzt, p0, ph, h){
  const nurSee = !!(jetzt && jetzt.lage && jetzt.kamm===false);
  if(jetzt && jetzt.lage && h!=null && h<=FUEHRT[nurSee ? "see" : "kamm"]) return {lage:jetzt.lage, vk:jetzt.vk, aus:"messung"};
  if(nurSee && h!=null) return ph && ph.lage ? {lage:ph.lage, vk:ph.vk, aus:wsGleich(ph.lage, jetzt.lage) ? "prognose" : "wechsel"} : {lage:null, vk:null, aus:"prognose"};
  /* Wechsel nur, wenn die Prognose für die Stunde eine andere Lage hat als für jetzt und als die Messung */
  const wechsel = !!(ph && ph.lage) && !wsGleich(ph.lage, p0 && p0.lage) && !(jetzt && wsGleich(ph.lage, jetzt.lage));
  if(jetzt && jetzt.lage && !wechsel) return {lage:jetzt.lage, vk:jetzt.vk, aus:"messung"};
  return ph && ph.lage ? {lage:ph.lage, vk:ph.vk, aus:jetzt && jetzt.lage ? "wechsel" : "prognose"} : {lage:null, vk:null, aus:"prognose"};
}
/* Stärke einer kommenden Stunde: Messung jetzt und Modell gemischt, Gewicht der Messung exp(−h/tau). Nie unter dem Modell:
   Ein verpasster Abend wiegt schwerer als ein Fehlalarm (eval/lage-vorlauf.cjs: so erkennt der Regler an Ipsach ab 12 kn
   bis +6 h mehr Stunden als das Modell, auf Kosten von etwas mehr Fehlalarmen in den ersten Stunden). m, p: {kn, dir} oder null. */
function mischKn(m, p, h, tau){
  if(!p) return h<=1 && m ? {kn:m.kn, dir:m.dir, w:1} : null;
  if(!m) return {kn:p.kn, dir:p.dir, w:0};
  const w = Math.exp(-h/(tau||2.5)), r = mittel([{kn:m.kn*w, dir:m.dir}, {kn:p.kn*(1-w), dir:p.dir}]);
  return {kn:Math.max(w*m.kn+(1-w)*p.kn, p.kn), dir:r && (w*m.kn+(1-w)*p.kn)>0 ? r.dir : p.dir, w};
}
/* Wie oft stimmt die Lage nach h Stunden? v = vorlauf aus data/windbild.json. aus = "messung" (fortgeschrieben, lange Reihe
   des Chasseral je Lage) oder sonst (Prognose, Entwicklungstage). Zwischen den gemessenen Vorlaufzeiten linear. */
function quote(v, aus, lage, h){
  if(!v || !v.leads) return null;
  const a = aus==="messung" ? v.fort && v.fort[lage] : v.prog; if(!a) return null;
  const L = v.leads; if(h<=L[0]) return a[0];
  for(let i=1;i<L.length;i++) if(h<=L[i]){ const x = a[i-1], y = a[i]; return x==null || y==null ? (y ?? x) : Math.round(x+(y-x)*(h-L[i-1])/(L[i]-L[i-1])); }
  return a[a.length-1];
}
/* Stärke als Mittel, Richtung als Vektormittel */
function mittel(rs){
  let u = 0, v = 0, s = 0, n = 0;
  rs.forEach(r=>{ if(r.kn==null || r.dir==null) return; const k = r.dir*Math.PI/180; u -= r.kn*Math.sin(k); v -= r.kn*Math.cos(k); s += r.kn; n++; });
  return n ? {kn:s/n, dir:(Math.atan2(-u,-v)*180/Math.PI+360)%360} : null;
}
function heute(){
  const day = localDay(0), hour = C.localHour(), [h0,h1] = WINS[S.win], now = new Date();
  const x = {monat:+day.slice(5,7), lake:C.lakeNow(LK, S), mixP:null, mixM:null, kammFehlt:true};
  const R = Object.assign({lapseMin:4}, DATA.regeln || {});
  /* Restprognose wie auf der Startseite (restAb in live.js): vergangene Stunden wählen keine Lage mehr */
  try{ if(D && D.models && Object.keys(D.models).length) x.s = summarize(D.models, day, S, D.jura, {ab:restAb(hour)}); }catch(e){}
  try{ if(D && D.stations && hour>=h0-2 && hour<=h1) x.nc = C.nowcast(D.stations, S, undefined, LK); }catch(e){}
  try{ if(D && D.jura){ x.jc = C.joranCheck(D.jura, day, S, 0);
    const rs = []; for(let hr=h0; hr<=h1; hr++){ const j = D.jura[day+"T"+String(hr).padStart(2,"0")+":00"]; if(j) rs.push({kn:j.cv, dir:j.cd}); }
    x.kammP = mittel(rs); } }catch(e){}
  try{ const hd = D && D.hoehe ? C.hoeheDay(D.hoehe, day, S) : null; if(hd) x.mixP = hd.coupled; }catch(e){}
  try{ const c = D && D.stations && D.stations.cha;
    if(c && !c.err && C.fresh(c.rows, now)){
      /* nur Werte der letzten halben Stunde: Bei einer Lücke in der Reihe zählen ältere nicht mit */
      x.kammM = mittel(c.rows.slice(-3).filter(r=>now-r.t<=35*60000).map(r=>({kn:r.mean, dir:r.dir})));
      x.kammFehlt = !x.kammM;
      const lp = C.lapseRate(D.stations, UPWIND.find(u=>u.abk==="cha"), UPWIND.find(u=>u.abk==="crm"), now);
      if(lp!=null) x.mixM = lp>=R.lapseMin; } }catch(e){}
  const r = vorwahl(x); r.nc = x.nc || null;
  /* Abendlage neben der Lage vom See (v36): Kommt die Lage von jetzt aus der Seemessung (Chasseral schwach), steht die Lage
     fürs Zeitfenster aus der Prognose daneben, wenn sie abweicht. Nur Anzeige, der Regler bleibt. eval/kette.cjs, 16.10.–13.11.,
     Soll: Lage aus der Messung je Stunde 16–21: weicht sie ab, trifft die Fensterprognose 71 %, die Lage vom See 15 %
     (140 Paare, 24 Stunden, 6 Tage; Holdout 40 % zu 0 %, 2 Tage). Gemessen 8–21 Uhr: davor und nach dem Fenster nichts. */
  /* nur bei schwachem Chasseral: Misst er stark (Bise am See, «darüber …»), zeigt die Kopfzeile den Wind darüber; fehlt er, ist die Lage unsicher */
  if(r.lage && r.art==="messung" && !r.kamm && /^Seemessung/.test(r.quelle) && x.kammM && !r.ueber && !r.unsicher && hour>=8 && hour<=h1){
    const p = vorwahl({monat:x.monat, s:x.s, kammP:x.kammP, jc:x.jc, mixP:x.mixP});
    if(p.lage && !wsGleich(p.lage, r.lage)){ const l = DATA.lagen.find(z=>z.id===p.lage);
      r.fenster = {lage:p.lage, name:p.lage==="west" || p.lage==="sued" ? "West oder Süd" : l ? l.name : p.lage,
        wort:{abend:"Abend", nami:"Nachmittag", tag:"Später"}[S.win] || "Später"}; }
  }
  return r;
}
/* Lage einer kommenden Stunde aus der Prognose. Die Kammprognose ICON-CH2 zeigt Süd als Südwest: aus der Prognose gewählt
   trifft Süd 0 %, West 71 %, Bise 96 %, Nordlage 80 % (eval/windbild-stunde.cjs, 16.10.–5.11., mit regeln.kammFaktor). Darum
   heissen West und Süd aus der Prognose zusammen «West oder Süd» und zeigen das Muster von West. */
const MOD_SPOTS = ["vin","ips"];
function modellAm(id, key){
  const pts = [];
  MODELS.forEach(m=>{ const sp = D && D.models[m.id] && D.models[m.id].find(z=>z.id===id); const i = sp && sp.idx[key];
    if(i!=null && sp.h.ws[i]!=null && sp.h.wd[i]!=null) pts.push({kn:sp.h.ws[i]*C.kFor(sp.h.wd[i],S), dir:sp.h.wd[i]}); });
  return mittel(pts);
}
function stundeKey(h){ const t = new Date(Date.now()+h*3600e3); return {t, day:C.dayOfDate(t), hr:C.localHour(t), key:C.dayOfDate(t)+"T"+String(C.localHour(t)).padStart(2,"0")+":00"}; }
function prognoseLage(h){
  const T = stundeKey(h), R = Object.assign({lapseMin:4}, DATA.regeln || {});
  const x = {monat:+T.day.slice(5,7)};
  const ref = {}; MOD_SPOTS.forEach(id=>{ const m = modellAm(id, T.key); if(m) ref[id] = m; });
  const sm = mittel(Object.values(ref)); if(sm) x.s = {top:{d:sm.dir, v:sm.kn}};
  try{ const j = D && D.jura && D.jura[T.key]; if(j && j.cv!=null) x.kammP = {kn:j.cv, dir:j.cd}; }catch(e){}
  try{ if(D && D.jura) x.jc = C.joranCheck(D.jura, T.day, S, 0); }catch(e){}
  try{ const H = D && D.hoehe, i = H ? H.time.indexOf(T.key) : -1;
    if(i>=0 && H.temperature_2m[i]!=null && H.temperature_850hPa[i]!=null) x.mixP = (H.temperature_2m[i]-H.temperature_850hPa[i])/C.HOEHE.dz>=R.lapseMin; }catch(e){}
  return {r:vorwahl(x), ref, T};
}
/* Regler: Lage und Stärke einer kommenden Stunde aus Messung und Prognose (mischLage, mischKn). h0 = Ergebnis von heute() */
function stunde(h, h0){
  const P = prognoseLage(h), P0 = prognoseLage(0);
  /* gemessene Lage von jetzt; wie lange sie führt, entscheidet mischLage (Chasseral und Regel E: FUEHRT.kamm, sonst
     FUEHRT.see). Die Quote «fortgeschrieben» gilt nur für Lagen vom Chasseral (lange Reihe). */
  const j = h0 && h0.lage && h0.art==="messung" ? {lage:h0.lage, vk:h0.vk, kamm:!!h0.kamm && !h0.unsicher} : null;
  const m = mischLage(j, P0.r, P.r, h);
  const r = {lage:m.lage, vk:m.vk, aus:m.aus, T:P.T, ref:{}};
  if(m.aus!=="messung" && (r.lage==="west" || r.lage==="sued")){ r.lage = "west"; r.vk = "mix"; r.westSued = true; }
  const tau = DATA.vorlauf && DATA.vorlauf.tau;
  MOD_SPOTS.forEach(id=>{ const n = jetzt(id), k = mischKn(n && n.mean!=null && n.dir!=null ? {kn:n.mean, dir:n.dir} : null, P.ref[id] || null, h, tau); if(k) r.ref[id] = k; });
  r.quote = r.lage && !(m.aus==="messung" && !j.kamm) ? quote(DATA.vorlauf, m.aus, m.lage, h) : null;
  return r;
}

/* ---------- Zustand ---------- */
const V_KEY = "joran.windbild.v1";
const ST = {auto:true, type:"west", vk:{}, view:"bucht", full:false, h:0, hyp:true};
try{ const v = localStorage.getItem(V_KEY); if(v && VIEWS[v]) ST.view = v; }catch(e){}
let HYP = null, DATA = null, LOADING = false, FAILED = 0, HEUTE = {lage:null, vk:null, quelle:"", grund:"", art:null, unsicher:false};
/* Was die Karte gerade zeigt: Lage (null = keine erkannt) und die Werte, an denen das Muster ausgerichtet wird */
let BILD = {art:"typisch", lage:null, ref:{}, name:""};
let panelHtml = "";
let el = null, mapEl = null, base = null, flow = null, bctx = null, fctx = null, drawn = "", visible = false, raf = 0;
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const isDark = () => { const t = document.documentElement.getAttribute("data-theme"); return t ? t==="dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
const lageOf = () => DATA.lagen.find(l=>l.id===ST.type) || DATA.lagen[0];
const varOf = () => { const l = lageOf(); return l.vars.find(v=>v.key===ST.vk[l.id]) || l.vars[0]; };
/* typischer Wert eines Spots = sein Stützpunkt in dieser Lage */
const typ = id => { const a = varOf().a.find(z=>z[0]===id); return a ? {dir:a[1], kn:a[2], m:!!a[3]} : null; };
const jetzt = id => { const z = C.lakeNow(LK, S).find(q=>q.L.id===id); return z && z.fresh && z.last ? z.last : null; };
/* Station jetzt: Mittel der Werte der letzten halben Stunde, nur wenn frisch */
function station(abk){
  const d = (D && D.stations && D.stations[abk]) || EXTRA[abk], now = new Date();
  if(!d || d.err || !d.rows || !d.rows.length || !C.fresh(d.rows, now)) return null;
  const m = mittel(d.rows.slice(-3).filter(r=>now-r.t<=35*60000).map(r=>({kn:r.mean, dir:r.dir})));
  return m ? Object.assign(m, {gust:d.rows[d.rows.length-1].gust, t:d.rows[d.rows.length-1].t}) : null;
}
/* gemessene Stützpunkte live: Seestationen und die Stationen, die in data/windbild.json gemessen sind */
function liveRef(){
  const ref = {};
  ["vin","ips"].forEach(id=>{ const n = jetzt(id); if(n && n.mean!=null && n.dir!=null) ref[id] = {kn:n.mean, dir:n.dir}; });
  ["cha","crm","gre","coy","neu"].forEach(a=>{ const m = station(a); if(m) ref[a] = {kn:m.kn, dir:m.dir}; });
  return ref;
}

/* ---------- Feld: Stützpunkte, Interpolation mit inversen Distanzen (kein Strömungsmodell) ---------- */
let ANCH = [], W = 0, Hh = 0, DPR = 1, GW = 0, GH = 0, GU = null, GV = null, parts = [];
/* Zoom mit zwei Fingern (oder Trackpad, Ctrl + Mausrad): Z hält Massstab (1 bis ZMAX) und Mitte in km. Während der Geste
   verschiebt und vergrössert CSS die gezeichnete Karte (G), beim Loslassen zeichnet fit() sie im neuen Ausschnitt scharf neu. */
const ZMAX = 8;
let Z = null, G = null;
const T = {cx:0, cy:0, k:1}, CELL = 3;
/* Muster an Werte von jetzt oder aus dem Modell anpassen: Punkte mit eigenem Wert übernehmen ihn, die übrigen werden mit dem
   Verhältnis jetzt/typisch und der Drehung der nahen Punkte angepasst (gewichtet nach inverser Distanz). Ohne Werte bleibt das Muster typisch. */
const drehung = (a, b) => ((a-b+540)%360)-180;
/* Höhenlage: Punkte auf Jurakamm und Jurahöhen (Bezug Chasseral in eval/windbild.vorlage.json) gehen nur mit dem Chasseral,
   Punkte am See und im Flachland nur mit den Stationen unten. So wird kein geschätzter Punkt stärker als die stärkste Messung
   seiner Höhenlage (dieselbe Regel, die eval/windbild.cjs --pruefen für die Datei verlangt). */
const HOCH = new Set(["cha","mag","pla","val","son","pery","twb","frin","tlx"]);
function ausrichten(a, ref){
  const pts = a.filter(z=>ref[z[0]] && PT[z[0]]).map(z=>{ const r = ref[z[0]], [x,y] = km(PT[z[0]]);
    return {x, y, hoch:HOCH.has(z[0]), kn:r.kn, f:Math.max(0.15, Math.min(4, r.kn/Math.max(z[2], 2))), dd:r.kn>=2 && z[2]>=2 ? drehung(r.dir, z[1]) : null}; });
  if(!pts.length) return a;
  const maxKn = hoch => { const m = pts.filter(q=>q.hoch===hoch).map(q=>q.kn); return m.length ? Math.max(...m) : null; };
  return a.map(z=>{
    const r = ref[z[0]]; if(r) return [z[0], Math.round(r.dir)%360, Math.round(r.kn*10)/10, 1];
    if(!PT[z[0]]) return z;
    const hoch = HOCH.has(z[0]), nah = pts.filter(q=>q.hoch===hoch);
    if(!nah.length) return [z[0], z[1], z[2], 0];
    const [x,y] = km(PT[z[0]]); let sf = 0, sw = 0, su = 0, sc = 0;
    nah.forEach(q=>{ const w = 1/((x-q.x)**2+(y-q.y)**2+0.5); sf += q.f*w; sw += w;
      /* Drehung als Vektor mitteln: Werte nahe ±180° heben sich sonst gegenseitig auf */
      if(q.dd!=null){ su += w*Math.sin(q.dd*Math.PI/180); sc += w*Math.cos(q.dd*Math.PI/180); } });
    const rot = su||sc ? Math.atan2(su, sc)*180/Math.PI : 0;
    const kn = Math.min(z[2]*sf/sw, maxKn(hoch));
    return [z[0], Math.round((z[1]+rot+720)%360)%360, Math.round(kn*10)/10, 0];
  });
}
function setAnchors(){
  if(!BILD.lage){ ANCH = []; return; }
  const a = BILD.art==="typisch" ? varOf().a : ausrichten(varOf().a, BILD.ref);
  ANCH = a.filter(z=>PT[z[0]]).map(([p,d,s,m])=>{ const [x,y] = km(PT[p]), r = d*Math.PI/180; return {x, y, u:-s*Math.sin(r), v:-s*Math.cos(r), m:!!m}; });
  /* Ausschnitt Region, Wind von jetzt: alle gemessenen Stationen der Region tragen das Feld mit, damit es weit weg vom See
     auf Messungen beruht und nicht nur das Muster der Bucht fortschreibt. Dazwischen bleibt es geschätzt. */
  const da = new Set(a.map(z=>z[0]));
  Object.entries(regionRef()).forEach(([abk, w])=>{ if(da.has(abk)) return;
    const [x,y] = km(STAT[abk]), r = w.dir*Math.PI/180; ANCH.push({x, y, u:-w.kn*Math.sin(r), v:-w.kn*Math.cos(r), m:true}); });
}
function regionRef(){
  if(ST.view!=="region" || BILD.art!=="live") return {};
  const ref = {}; Object.keys(STAT).forEach(abk=>{ const m = station(abk); if(m && m.kn!=null && m.dir!=null) ref[abk] = m; });
  return ref;
}
function fieldAt(x, y){
  let su = 0, sv = 0, sw = 0;
  for(const a of ANCH){ const dx = x-a.x, dy = y-a.y, w = 1/(dx*dx+dy*dy+0.06), w2 = w*w; su += a.u*w2; sv += a.v*w2; sw += w2; }
  return sw ? [su/sw, sv/sw] : [0,0];
}
const toPx = ([x,y]) => [W/2+(x-T.cx)*T.k, Hh/2-(y-T.cy)*T.k];
const toKm = (px,py) => [T.cx+(px-W/2)/T.k, T.cy-(py-Hh/2)/T.k];
const P = ll => toPx(km(ll));
function fit(){
  const r = mapEl.getBoundingClientRect(); W = r.width; Hh = r.height; DPR = Math.min(2, window.devicePixelRatio||1);
  [base, flow].forEach(c=>{ c.width = Math.round(W*DPR); c.height = Math.round(Hh*DPR); });
  bctx.setTransform(DPR,0,0,DPR,0,0); fctx.setTransform(DPR,0,0,DPR,0,0);
  const V = VIEWS[ST.view], [x0,y0] = km([V.lat[0],V.lon[0]]), [x1,y1] = km([V.lat[1],V.lon[1]]);
  T.cx = (x0+x1)/2; T.cy = (y0+y1)/2; T.k = Math.min(W/(x1-x0), Hh/(y1-y0));
  if(Z){
    /* gezoomt: Mitte so begrenzen, dass der Ausschnitt im Rahmen der gewählten Ansicht bleibt */
    const cl = (v, lo, hi) => lo>hi ? (lo+hi)/2 : Math.max(lo, Math.min(hi, v));
    T.k *= Z.s; const hw = W/2/T.k, hh = Hh/2/T.k;
    T.cx = Z.cx = cl(Z.cx, x0+hw, x1-hw); T.cy = Z.cy = cl(Z.cy, y0+hh, y1-hh);
  }
}
function poly(ctx, pts){ ctx.moveTo(...P(pts[0])); for(let i=1;i<pts.length;i++) ctx.lineTo(...P(pts[i])); ctx.closePath(); }
function line(ctx, pts){ ctx.beginPath(); ctx.moveTo(...P(pts[0])); for(let i=1;i<pts.length;i++) ctx.lineTo(...P(pts[i])); }
function sample(px, py){
  const gx = px/CELL, gy = py/CELL, i = Math.max(0, Math.min(GW-2, Math.floor(gx))), j = Math.max(0, Math.min(GH-2, Math.floor(gy))), fx = gx-i, fy = gy-j;
  const o = j*GW+i, b = A => A[o]*(1-fx)*(1-fy)+A[o+1]*fx*(1-fy)+A[o+GW]*(1-fx)*fy+A[o+GW+1]*fx*fy;
  return [b(GU), b(GV)];
}
function drawBase(){
  const dark = isDark(), z = ST.view==="region" ? 0 : ST.view==="see" ? 1 : 2, feld = ANCH.length>0;
  const K = dark ? {land:"#1b2229", lake:"#1c3345", shore:"#5a7a92", ridge:"rgba(120,138,155,.05)", crest:"rgba(190,205,218,.22)", canal:"rgba(120,165,195,.6)", ink:"rgba(228,235,240,.9)", inkL:"rgba(200,225,240,.85)", halo:"rgba(10,14,18,.75)", dot:"#fff", dotE:"#0e1318"}
                 : {land:"#e6e9ec", lake:"#cfe3ef", shore:"#5f8199", ridge:"rgba(70,90,110,.055)", crest:"rgba(60,80,100,.25)", canal:"rgba(70,125,165,.7)", ink:"rgba(20,28,36,.88)", inkL:"rgba(20,60,90,.85)", halo:"rgba(255,255,255,.8)", dot:"#fff", dotE:"#1c2b30"};
  GW = Math.ceil(W/CELL)+1; GH = Math.ceil(Hh/CELL)+1; GU = new Float32Array(GW*GH); GV = new Float32Array(GW*GH);
  const off = document.createElement("canvas"); off.width = GW; off.height = GH;
  const octx = off.getContext("2d"), img = octx.createImageData(GW, GH);
  for(let j=0;j<GH;j++) for(let i=0;i<GW;i++){
    const [x,y] = toKm(i*CELL, j*CELL), [u,v] = fieldAt(x,y), c = col(Math.hypot(u,v)), o = j*GW+i;
    GU[o] = u; GV[o] = v; img.data[o*4] = c[0]; img.data[o*4+1] = c[1]; img.data[o*4+2] = c[2]; img.data[o*4+3] = 255;
  }
  octx.putImageData(img, 0, 0);
  const ctx = bctx; ctx.clearRect(0,0,W,Hh);
  ctx.fillStyle = K.land; ctx.fillRect(0,0,W,Hh);
  const ridges = z===0 ? RIDGES.concat(RIDGES_REGION) : RIDGES;
  ridges.forEach(r=>{ for(let k=6;k>=1;k--){ ctx.strokeStyle = K.ridge; ctx.lineWidth = r.w*k*T.k*0.12; ctx.lineCap = "round"; ctx.lineJoin = "round"; line(ctx, r.p); ctx.stroke(); } });
  ctx.imageSmoothingEnabled = true;
  /* Farbfeld über Land nur in See und Bucht; im Ausschnitt Region nur auf dem Bielersee (weiter weg trägt das Muster nicht) */
  /* Region: Neuenburger- und Murtensee zuerst, das Farbfeld liegt über der ganzen Karte (auch über Land und Jura) */
  if(z===0){ ctx.fillStyle = K.lake; [NEUSEE, MURTEN].forEach(L=>{ ctx.beginPath(); poly(ctx, L); ctx.fill(); }); }
  if(feld){ ctx.globalAlpha = dark ? 0.36 : 0.42; ctx.drawImage(off, 0, 0, GW*CELL, GH*CELL); ctx.globalAlpha = 1; }
  if(z===0){ ctx.strokeStyle = K.shore; ctx.lineWidth = 1; [NEUSEE, MURTEN].forEach(L=>{ ctx.beginPath(); poly(ctx, L); ctx.stroke(); }); }
  ctx.save(); ctx.beginPath(); poly(ctx, SHORE); poly(ctx, ISLAND); ctx.clip("evenodd");
  ctx.fillStyle = K.lake; ctx.fillRect(0,0,W,Hh); if(feld){ ctx.globalAlpha = 0.88; ctx.drawImage(off, 0, 0, GW*CELL, GH*CELL); } ctx.restore();
  ctx.strokeStyle = K.shore; ctx.lineWidth = 1.2; ctx.beginPath(); poly(ctx, SHORE); poly(ctx, ISLAND); ctx.stroke();
  ctx.strokeStyle = K.canal; ctx.lineWidth = 1.6; CANALS.forEach(c=>{ line(ctx, c); ctx.stroke(); });
  ctx.strokeStyle = K.crest; ctx.lineWidth = 1; ridges.forEach(r=>{ line(ctx, r.p); ctx.stroke(); });
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  const F = "-apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  /* Namen nur, wo sie ganz ins Bild passen und weder ein Spot-Schild noch einen anderen Namen überdecken */
  const used = badgePos().map(b=>[b.x-76, b.y-24, 152, 48]).concat(statPos().flatMap(b=>[[b.x-11, b.y-11, 22, 22]].concat(b.lx!=null ? [[b.lx, b.ly, b.txt.length*7.2+14, 18]] : [])));
  LABELS.forEach(([n,lat,lon,zz,kind])=>{
    if(z<zz || (z===2 && kind==="peak") || (z>0 && kind==="lakeR")) return;
    const [x,y] = P([lat,lon]);
    ctx.font = kind==="lakeR" ? `italic 500 11px ${F}` : kind==="lakeB" ? `italic 600 14px ${F}` : kind==="lake" ? `italic 500 11.5px ${F}` : kind==="peak" ? `600 12px ${F}` : `500 11.5px ${F}`;
    const tw = ctx.measureText(n).width, box = [x-tw/2-3, y-9, tw+6, 18];
    if(box[0]<4 || box[0]+box[2]>W-4 || box[1]<4 || box[1]+box[3]>Hh-26) return;
    if(used.some(u=>box[0]<u[0]+u[2] && u[0]<box[0]+box[2] && box[1]<u[1]+u[3] && u[1]<box[1]+box[3])) return;
    used.push(box);
    ctx.lineWidth = 3; ctx.strokeStyle = K.halo; ctx.fillStyle = kind==="lakeB" || kind==="lake" || kind==="lakeR" ? K.inkL : K.ink;
    ctx.strokeText(n, x, y); ctx.fillText(n, x, y);
  });
  if(z>0) Object.values(MARK).forEach(ll=>{ const [x,y] = P(ll); ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI*2); ctx.fillStyle = K.dot; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = K.dotE; ctx.stroke(); });
  if(reduce() && feld) drawArrows(dark);
}
/* Ohne Bewegung: Pfeile im Raster statt Strömungslinien */
function drawArrows(dark){
  const ctx = bctx, st = Math.max(34, Math.min(W,Hh)/11), c = dark ? "rgba(255,255,255,.85)" : "rgba(15,25,35,.75)";
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 1.4;
  for(let py=st/2; py<Hh; py+=st) for(let px=st/2; px<W; px+=st){
    const [u,v] = sample(px,py), s = Math.hypot(u,v); if(s<1) continue;
    const L = Math.min(st*0.8, 6+s*1.1), ux = u/s, uy = -v/s, x0 = px-ux*L/2, y0 = py-uy*L/2, x1 = px+ux*L/2, y1 = py+uy*L/2;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x1-ux*6-uy*3.5, y1-uy*6+ux*3.5); ctx.lineTo(x1-ux*6+uy*3.5, y1-uy*6-ux*3.5); ctx.closePath(); ctx.fill();
  }
}
/* Strömungslinien: laufen nur, solange die Karte im Bild ist, die Seite sichtbar ist und Bewegung erwünscht ist */
const newPart = () => ({x:Math.random()*W, y:Math.random()*Hh, age:Math.floor(Math.random()*80)});
function seed(){ parts = Array.from({length:Math.round(W*Hh/430)}, newPart); fctx.clearRect(0,0,W,Hh); }
function tick(){
  raf = 0;
  if(!visible || document.hidden || reduce() || !GU || !ANCH.length) return;
  fctx.globalCompositeOperation = "destination-in"; fctx.fillStyle = "rgba(0,0,0,0.89)"; fctx.fillRect(0,0,W,Hh);
  fctx.globalCompositeOperation = "source-over"; fctx.strokeStyle = isDark() ? "rgba(255,255,255,.78)" : "rgba(15,25,35,.45)"; fctx.lineWidth = 1.1; fctx.beginPath();
  for(const p of parts){
    const [u,v] = sample(p.x,p.y), s = Math.hypot(u,v), nx = p.x+u*0.075, ny = p.y-v*0.075;
    if(s>0.6){ fctx.moveTo(p.x,p.y); fctx.lineTo(nx,ny); }
    p.x = nx; p.y = ny; p.age++;
    if(p.age>90 || p.x<0 || p.y<0 || p.x>W || p.y>Hh || (s<0.6 && Math.random()<0.05)){ Object.assign(p, newPart()); p.age = 0; }
  }
  fctx.stroke();
  raf = requestAnimationFrame(tick);
}
function play(){ if(!raf && visible && !document.hidden && !reduce() && GU && ANCH.length) raf = requestAnimationFrame(tick); }

/* ---------- Anzeige ---------- */
const zeit = T => T ? `${T.day===localDay(0) ? "Heute" : T.day===localDay(1) ? "Morgen" : T.day} ${T.hr} Uhr` : "";
function inSee(px, py){ bctx.save(); bctx.setTransform(1,0,0,1,0,0); bctx.beginPath(); poly(bctx, SHORE); const r = bctx.isPointInPath(px, py); bctx.restore(); return r; }
const knTxt = (t, est) => t ? `${est?"~":""}${r0(t.kn)} kn ${card(t.dir)}` : "–";
function dot(dir, kn){ return `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9.5" fill="${rgb(col(kn))}"/><g transform="rotate(${(dir+180)%360})"><path d="M0-6.5 L4.2 3 L0 .8 L-4.2 3Z" fill="#0b0f13"/></g></svg>`; }
/* Ort der Spot-Schilder: Vingelz über, Ipsach unter dem Messpunkt, immer ganz im Bild (nicht im Ausschnitt Region) */
function badgePos(){
  if(ST.view==="region") return [];
  return C.LAKE.map(L=>{ let [x,y] = P(MARK[L.id]); if(x<0 || y<0 || x>W || y>Hh) return null;
    y += L.id==="vin" ? -24 : 24; x += L.id==="vin" ? -14 : 14;
    return {L, x:Math.max(78, Math.min(W-78, x)), y:Math.max(ST.view==="bucht" ? 52 : 24, Math.min(Hh-24, y))}; }).filter(Boolean);
}
/* Ausschnitt Region: alle Upwind-Stationen, Mathod und die Seestationen mit dem Wind von jetzt (im Regler: nur Ipsach aus
   Messung und Modell). Ausschnitt See: der Chasseral mit dem Wind von jetzt. Nur gemessene Werte, keine typischen.
   Ausnahme La Neuveville in See und Region: Modellmittel, als «Modell» gekennzeichnet (auch im Regler, für die gewählte Stunde).
   Ein Signal ist hervorgehoben. Beschriftung rechts, sonst links, sonst nur die Zahl. */
const KURZ = {fre:"Bullet", cdf:"Chaux-de-Fonds", brl:"La Brévine", vin:"Vingelz", ips:"Ipsach"};
/* Spots ohne Messung: Wind aus dem Feld an ihrem Ort (Richtung, aus der er kommt), ohne erkannte Lage kein Wert */
function spotsGeschaetzt(ids){
  return SPOTS_KARTE.filter(sp=>ids.includes(sp.id)).map(sp=>{
    let w = null; if(ANCH.length){ const [u,v] = fieldAt(...km(sp.ll)), kn = Math.hypot(u,v); w = {kn, dir:(Math.atan2(-u,-v)*180/Math.PI+360)%360}; }
    return {id:sp.id, name:sp.name, ll:sp.ll, w, sig:"", voll:`${sp.voll||sp.name}: Spot ohne Messung, geschätzt aus dem Windbild`, modell:true, est:true, spot:true};
  });
}
function statPos(){
  if(!W) return [];
  if(ST.full) return musterPos();
  if(ST.view==="bucht") return platziere(spotsGeschaetzt(["wing"]));
  const nc = HEUTE.nc, sig = abk => nc && (nc.eOk && abk==="crm" || nc.trusted.some(x=>x.up.abk===abk)) ? "on" : nc && nc.sig.some(x=>x.up.abk===abk) ? "near" : "";
  const vor = !ST.full && ST.h>0;
  holeNeuv();
  const nv = {id:"neuv", name:NEUV.name, ll:NEUV.ll, w:neuvAm(vor ? ST.h : 0), sig:"", voll:NEUV.voll, modell:true, tag:"Modell", spot:true};
  if(ST.view==="see"){
    const L1 = vor ? [nv] : [{id:"cha", name:"Chasseral", ll:STAT.cha, w:station("cha"), sig:sig("cha"), voll:"Chasseral, Jurakamm 1594 m"}, nv]; return platziere(L1.concat(spotsGeschaetzt(["wing","stbl"]))); }
  if(!vor) holeExtra();
  const L = vor ? [] : UPWIND.filter(u=>STAT[u.abk]).map(u=>({id:u.abk, name:KURZ[u.abk]||u.name, ll:STAT[u.abk], w:station(u.abk), sig:sig(u.abk), voll:u.name}))
    .concat(ANZEIGE.map(a=>({id:a.abk, name:a.name, ll:STAT[a.abk], w:station(a.abk), sig:"", voll:a.voll})));
  if(vor){ const m = BILD.ref.ips; L.push({id:"ips", name:"Ipsach", ll:MARK.ips, w:m ? {kn:m.kn, dir:m.dir} : null, sig:"", voll:"Ipsach (Messung und Modell)", modell:true}); }
  L.push(nv);
  return platziere(L.concat(spotsGeschaetzt(["wing","stbl"])));
}
/* Blatt «Erklärungen»: keine Live-Werte und, damit die Karte lesbar bleibt, nur die Messstationen des Musters (DATA.stationen
   aus eval/windbild.cjs; ältere Dateien: jeder Punkt, der irgendwo gemessen ist). Eine neue Station erscheint so von selbst,
   sobald die Auswertung sie führt; ihr Ort kommt aus PT, sonst aus STAT. Gemessen (Median) voll, geschätzt blass (Hypothesen).
   Vingelz und Ipsach stehen in See und Bucht als grosse Schilder, in der Region als Punkte. */
const ortVon = id => PT[id] || STAT[id];
function messstationen(){
  if(Array.isArray(DATA.stationen) && DATA.stationen.length) return new Set(DATA.stationen);
  return new Set(DATA.lagen.flatMap(l=>l.vars.flatMap(v=>v.a.filter(z=>z[3]).map(z=>z[0]))));
}
function musterPos(){
  const gross = ST.view!=="region", mess = messstationen();
  /* Beschriftungen nicht unter die Schilder von Vingelz und Ipsach legen */
  const frei = badgePos().map(b=>[b.x-80, b.y-20, 160, 40]);
  return platziere(spotsGeschaetzt(["neuv","wing","stbl"]).concat(varOf().a.filter(z=>mess.has(z[0]) && ortVon(z[0]) && !(gross && (z[0]==="vin" || z[0]==="ips"))).map(([id,dir,kn,m])=>{
    const u = UPWIND.find(q=>q.abk===id), name = KURZ[id] || PTNAME[id] || (u && u.name) || id;
    return {id, name, ll:ortVon(id), w:{dir, kn}, sig:"", voll:`${name} (${m ? "gemessen" : "geschätzt"})`, modell:!m, est:!m};
  })), frei);
}
function platziere(L, frei){
  const out = L.map(s=>{ const [x,y] = P(s.ll); return Object.assign({x, y}, s); }).filter(s=>s.x>=0 && s.y>=0 && s.x<=W && s.y<=Hh);
  /* Beschriftungen meiden immer die grossen Schilder von Vingelz und Ipsach */
  const used = out.map(s=>[s.x-11, s.y-11, 22, 22]).concat(frei || badgePos().map(b=>[b.x-80, b.y-20, 160, 40]));
  const fits = b => b[0]>=2 && b[0]+b[2]<=W-2 && b[1]>=2 && b[1]+b[3]<=Hh-24 && !used.some(u=>b[0]<u[0]+u[2] && u[0]<b[0]+b[2] && b[1]<u[1]+u[3] && u[1]<b[1]+b[3]);
  /* Signale zuerst beschriften, dann in der Reihenfolge der Stationsliste (Cressier, Chasseral, Neuchâtel, …) */
  /* Spots ohne Messung gleich nach den Signalen: Sie sind die Orte, an denen jemand foilt */
  const rang = s => s.sig ? 0 : s.spot ? 1 : 2;
  out.slice().sort((a,b)=>rang(a)-rang(b)).forEach(s=>{
    const kn = s.w ? (s.modell ? "~" : "") + r0(s.w.kn) : "–";
    for(const txt of (s.tag ? [`${s.name} ${kn} ${s.tag}`, `${s.name} ${kn}`, `${kn} ${s.tag}`] : []).concat([`${s.name} ${kn}`, String(kn)])){
      const tw = txt.length*7.2+14, at = [[s.x+13, s.y-9], [s.x-13-tw, s.y-9], [s.x-tw/2, s.y+13], [s.x-tw/2, s.y-31],
        [s.x+13, s.y+9], [s.x-13-tw, s.y+9], [s.x+13, s.y-27], [s.x-13-tw, s.y-27]];
      const b = at.map(o=>[o[0], o[1], tw, 18]).find(fits);
      if(b){ used.push(b); Object.assign(s, {lx:b[0], ly:b[1], txt}); break; }
    }
  });
  return out.map(s=>Object.assign({lx:null, ly:null, txt:""}, s, {w:s.w}));
}
function badges(){
  const box = el.querySelector(".wbbadges"); let h = "";
  const grau = `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9.5" fill="#8a8a8e"/></svg>`;
  const sp = statPos();
  sp.forEach(s=>{
    const k = (s.sig ? " "+s.sig : "") + (s.tag ? " mod" : "") + (s.est ? " est" : "");
    h += `<div class="wbst${k}" style="left:${s.x}px;top:${s.y}px" title="${esc(s.voll||s.name)}">${s.w ? dot(s.w.dir, s.w.kn) : grau}</div>`;
    if(s.lx!=null) h += `<div class="wbstl${k}" style="left:${s.lx}px;top:${s.ly}px">${esc(s.txt)}</div>`;
  });
  /* Ausschnitt Bucht: Der Chasseral liegt ausserhalb, sein Wind von jetzt steht in der Ecke */
  if(ST.view==="bucht" && ST.full){ const c = typ("cha");
    h += `<div class="wbcorner">Chasseral typisch ${c ? knTxt(c, !c.m) : "–"}</div>`; }
  else if(ST.view==="bucht" && !(!ST.full && ST.h>0)){ const c = station("cha");
    h += `<div class="wbcorner">Chasseral ${c ? r0(c.kn)+" kn "+card(c.dir) : "–"}</div>`; }
  badgePos().forEach(({L, x, y})=>{
    if(ST.full){
      /* Musterkarte: typischer Wert, ob gemessen oder geschätzt */
      const t = typ(L.id);
      h += `<div class="wbbadge${t && !t.m ? " est" : ""}" style="left:${x}px;top:${y}px">${t ? dot(t.dir, t.kn) : grau}<span><b>${L.name} ${t ? knTxt(t, !t.m) : "–"}</b><small>${!t ? "kein Wert" : t.m ? "typisch, gemessen" : "typisch, geschätzt"}</small></span></div>`;
      return;
    }
    if(!ST.full && ST.h>0){
      /* Regler: gross das Modell, klein die Quelle */
      const m = BILD.ref[L.id];
      h += `<div class="wbbadge" style="left:${x}px;top:${y}px">${m ? dot(m.dir, m.kn) : grau}<span><b>${L.name} ${m ? "~"+r0(m.kn)+" kn "+card(m.dir) : "–"}</b><small>${m && m.w>=0.1 ? "Messung und Modell" : "Modell"}</small></span></div>`;
      return;
    }
    const n = jetzt(L.id);
    /* nur gemessene Werte: gross der Wind von jetzt, klein die Uhrzeit der Messung */
    const now = n ? dot(n.dir, n.mean) : grau;
    const klein = n && n.t ? `gemessen ${C.hhmm(new Date(n.t))}` : "keine Messung";
    h += `<div class="wbbadge" style="left:${x}px;top:${y}px">${now}<span><b>${L.name} ${n ? r0(n.mean)+" kn "+card(n.dir) : "–"}</b><small>${klein}</small></span></div>`;
  });
  /* Hypothesen-Beschriftungen meiden die Schilder (hart) und die Beschriftungen der Punkte (wenn möglich) */
  const schilder = badgePos().map(b=>[b.x-80, b.y-20, 160, 40]).concat(ST.view==="bucht" ? [[0, 0, 200, 34]] : []);
  const hy = hypSchicht(schilder, sp.filter(q=>q.lx!=null).map(q=>[q.lx, q.ly, q.txt.length*7.2+14, 18]));
  /* Pfeile unter den Schildern, ihre Beschriftungen darüber */
  box.innerHTML = hy.svg + h + hy.lab;
  spotZeile();
}
/* Startseite: die Spots ohne Messung immer unter der Karte, egal welcher Ausschnitt (La Neuveville aus dem Modellmittel,
   Wingreis und St-Blaise aus dem Windbild), für jetzt oder die Stunde im Regler */
function spotZeile(){
  const z = el.querySelector(".wbspots"); if(!z) return;
  if(ST.full){ z.innerHTML = ""; return; }
  holeNeuv();
  const vor = ST.h>0, nvw = neuvAm(vor ? ST.h : 0);
  /* ohne Modellwert (Abruf fehlgeschlagen) auch La Neuveville aus dem Windbild */
  const sp = (nvw ? [{name:NEUV.name, w:nvw, art:"Modell"}] : spotsGeschaetzt(["neuv"]).map(q=>({name:q.name, w:q.w, art:"geschätzt"})))
    .concat(spotsGeschaetzt(["wing","stbl"]).map(q=>({name:q.name, w:q.w, art:"geschätzt"})));
  const html = sp.map(q=>`<span class="wbsp">${q.w ? dot(q.w.dir, q.w.kn) : `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9.5" fill="#8a8a8e"/></svg>`}<b>${esc(q.name)}</b> ${q.w ? `~${r0(q.w.kn)} kn ${card(q.w.dir)}` : "–"} <small>${q.art}</small></span>`).join("");
  if(z.innerHTML!==html) z.innerHTML = html;
}
/* ---------- Hypothesen (Blatt «Erklärungen») ---------- */
const URTEIL = {passt:"passt", teilweise:"passt teilweise", offen:"offen"};
function hypFor(){
  if(!HYP || !ST.full) return [];
  const l = lageOf(), V = varOf();
  return HYP.hyp.filter(x=>(x.zu||[]).some(z=>z===l.id || z===l.id+":"+V.key));
}
/* Wege als Pfeile in Windrichtung, Zonen als gestrichelte Kreise. Farbe nach Urteil, offen zusätzlich gestrichelt. */
function hypSchicht(hart, weich){
  const hs = ST.hyp ? hypFor() : []; if(!hs.length) return {svg:"", lab:""};
  let svg = "", lab = ""; const used = hart.slice(), soft = weich||[];
  const frei = (b, L) => !L.some(u=>b[0]<u[0]+u[2] && u[0]<b[0]+b[2] && b[1]<u[1]+u[3] && u[1]<b[1]+b[3]);
  /* Plätze rund um den Ankerpunkt; zuerst einer, der auch keine Punktbeschriftung deckt */
  const setze = (anker, txt, cls) => { const w = txt.length*6.6+22;
    const at = anker.flatMap(([x,y])=>[[0,0],[0,-18],[0,18],[w/2+8,0],[-w/2-8,0]].map(([dx,dy])=>[x+dx-w/2, y+dy-10, w, 20]))
      .filter(b=>b[0]>=2 && b[0]+w<=W-2 && b[1]>=2 && b[1]+20<=Hh-24);
    const b = at.find(q=>frei(q, used) && frei(q, soft)) || at.find(q=>frei(q, used)); if(!b) return;
    used.push(b); lab += `<div class="wbhyl ${cls}" style="left:${b[0]+w/2}px;top:${b[1]+10}px"><span></span>${esc(txt)}</div>`; };
  hs.forEach(x=>{
    const cls = "u-"+(URTEIL[x.urteil] ? x.urteil : "offen"), dash = x.urteil==="offen" ? ` stroke-dasharray="7 6"` : "";
    (x.zonen||[]).forEach(z=>{ const [cx, cy] = P(z.c), r = Math.max(10, z.r*T.k);
      svg += `<circle class="${cls}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" stroke-dasharray="4 4"/>`;
      setze([[cx, cy-r-2], [cx, cy+r+2], [cx, cy]], z.label ? `${x.id} ${z.label}` : x.id, cls); });
    (x.wege||[]).forEach((w, i)=>{
      const pts = w.p.map(P), sw = 1.5+(w.staerke||1)*1.25, d = pts.map((q,k)=>(k?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join(" ");
      const [ax, ay] = pts[pts.length-1], [bx, by] = pts[pts.length-2], L = Math.hypot(ax-bx, ay-by)||1, ux = (ax-bx)/L, uy = (ay-by)/L, k = 5+sw*1.6;
      const head = `M${(ax+ux*k*0.4).toFixed(1)} ${(ay+uy*k*0.4).toFixed(1)} L${(ax-ux*k+uy*k*0.6).toFixed(1)} ${(ay-uy*k-ux*k*0.6).toFixed(1)} L${(ax-ux*k-uy*k*0.6).toFixed(1)} ${(ay-uy*k+ux*k*0.6).toFixed(1)}Z`;
      svg += `<path class="halo" d="${d}" stroke-width="${sw+3}"/><path class="${cls}" d="${d}" stroke-width="${sw}"${dash}/><path class="${cls} kopf" d="${head}"/>`;
      /* Anker: Mitten der Abschnitte, vom mittleren nach aussen */
      const mid = pts.slice(1).map((q,k)=>[(q[0]+pts[k][0])/2, (q[1]+pts[k][1])/2]), c0 = (mid.length-1)/2;
      setze(mid.map((q,k)=>[q, Math.abs(k-c0)]).sort((a,b)=>a[1]-b[1]).map(q=>q[0]), w.label ? `${x.id} ${w.label}` : x.id, cls);
    });
  });
  return {svg:`<svg class="wbhyp" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" aria-hidden="true">${svg}</svg>`, lab};
}
/* Welcher Spot ist besser? Zuerst nach dem Anteil der Zeit ab der Schwelle (Tk), sonst nach dem typischen Wert. */
function besser(Tk){
  const i = typ("ips"), v = typ("vin"); if(!i || !v) return "";
  const V = varOf(), est = !(i.m && v.m) ? " (geschätzt)" : "";
  if(Tk!=null){ const mid = id => (V.anteil[Tk][id][0]+V.anteil[Tk][id][1])/2, ai = mid("ips"), av = mid("vin");
    if(Math.max(ai, av) < 5) return `Ab ${Tk} kn reicht es bei dieser Lage selten, an beiden Spots.`;
    if(Math.abs(ai-av) >= 10) return `Besser bei dieser Lage: <b>${ai>av ? "Ipsach" : "Vingelz"}</b>, dort weht es öfter ab ${Tk} kn.`;
    return `Beide Spots erreichen ${Tk} kn etwa gleich oft.`; }
  if(Math.max(i.kn, v.kn) < 6) return "Bei dieser Lage reicht es meist an keinem Spot.";
  if(Math.abs(i.kn-v.kn) < 2) return `Beide Spots sind ähnlich stark${est}.`;
  return `Besser bei dieser Lage: <b>${i.kn>v.kn ? "Ipsach" : "Vingelz"}</b>${est}.`;
}
const datum = d => d ? d.split("-").reverse().map(Number).join(".") : "";
function hypListe(){
  const hs = hypFor(); if(!hs.length) return "";
  return `<div class="wbhyli"><b>Hypothesen zu dieser Lage</b>${hs.map(x=>`<div class="u-${URTEIL[x.urteil] ? x.urteil : "offen"}">
      <p><span class="wbhyd"></span><b>${esc(x.id)} ${esc(x.titel)}</b> <span class="wbhyu">${esc(URTEIL[x.urteil]||x.urteil)}${x.belege ? ", "+esc(x.belege) : ""}</span></p>
      <p>${esc(x.aussage)}</p><p class="dim">Befund: ${esc(x.befund)}</p></div>`).join("")}
    <small>Stand ${esc(datum(HYP.stand))}, aus <code>eval/IDEEN.md</code>. Die Wege sind schematisch eingezeichnet.</small></div>`;
}
function panel(){
  const l = lageOf(), V = varOf();
  const std = V.werte ? ` (${Math.round(V.werte/6)} Stunden)` : "";
  const status = V.status==="m" ? ["m", `Gemessen an ${V.tage} Tagen${std}`] : V.status==="e" ? ["e", (V.tage===1 ? "Erst ein Tag gemessen" : `Erst ${V.tage} Tage gemessen`)+std] : ["s", "Hypothese, noch nicht gemessen"];
  /* Anteil der Zeit ab der Schwelle: für die eingestellte Schwelle, sonst für die nächste gerechnete */
  const keys = Object.keys(V.anteil||{}).map(Number), Tk = keys.length ? keys.reduce((a,b)=>Math.abs(b-S.T)<Math.abs(a-S.T) ? b : a) : null;
  const an = id => { const a = Tk!=null && V.anteil[Tk][id]; return a ? (a[0]===a[1] ? a[0] : a[0]+"–"+a[1])+" %" : "–"; };
  const rows = C.LAKE.map(L=>{ const t = typ(L.id);
    return `<tr><td><b>${L.name}</b></td><td class="n">${knTxt(t, t && !t.m)}</td>${Tk!=null?`<td class="n">${an(L.id)}</td>`:""}</tr>`; }).join("");
  const ms = messstationen(), nm = V.a.filter(z=>ms.has(z[0])), gm = nm.filter(z=>z[3]).length;
  const dat = d => d ? d.split("-").reverse().map(Number).join(".") : "";
  const fuss = V.werte || V.anteil ? `Typisch: Median der Messwerte von 8 bis 22 Uhr, ${dat(DATA.von).replace(/\.\d{4}$/, ".")}–${dat(DATA.bis)}.`
    : V.status==="s" ? "Schätzung, von Hand gesetzt." : "Aus einzelnen Tagen, von Hand gesetzt.";
  const html = `<span class="wbstatus ${status[0]}">${status[1]}</span>
    <p><b>${esc(l.name)}${l.vars.length>1 ? ": "+esc(V.label) : ""}.</b> ${esc(V.text)}</p>
    <div class="tw"><table><tr><th>Spot</th><th class="n">typisch</th>${Tk!=null?`<th class="n">Zeit ab ${Tk} kn</th>`:""}</tr>${rows}</table></div>
    <p>${besser(Tk)}</p>
    <p class="wblegm"><span class="wbdot"></span>gemessen (Median) <span class="wbdot est"></span>geschätzt <span class="dim">· ${gm===nm.length ? `${nm.length} Messstationen` : `${gm} von ${nm.length} Messstationen gemessen`}, die Fläche dazwischen ist geschätzt</span></p>
    ${hypListe()}
    <small>${Tk!=null && Tk!==S.T ? `Der Anteil ist erst für ${Tk} kn gerechnet, nicht für deine ${S.T} kn. ` : ""}${fuss} Stand ${esc(dat(DATA.stand))}.</small>`;
  /* nur schreiben, wenn sich etwas ändert: sonst liest ein Screenreader den Kasten bei jedem Auffrischen neu vor */
  if(html!==panelHtml){ panelHtml = html; el.querySelector(".wbpanel").innerHTML = html; }
}
/* Ohne Lage: Liegt die angezeigte Stärke (Messung und Modell gemischt, nie unter dem Modell) an jedem Spot mit Wert unter
   3 kn, heisst das «kaum Wind», nicht «keine Lage erkennbar» */
const kaum = () => { const v = ["vin","ips"].map(id=>BILD.ref[id]).filter(Boolean); return v.length>0 && v.every(z=>z.kn<3); };
function head(){
  const h = HEUTE, hl = h.lage ? DATA.lagen.find(l=>l.id===h.lage) : null;
  /* «Jetzt» bei einer Messung, «Heute» bei der Prognose fürs Zeitfenster: Am Vormittag kann die Lage bis zum Abend drehen */
  const wann = h.art==="messung" ? "Jetzt" : "Heute", zurueck = h.art==="messung" ? "Lage von jetzt" : "Lage von heute";
  /* Startseite kurz: Lage und woher das Bild kommt; im Blatt «Erklärungen» mit Quelle */
  const wie = BILD.art==="live" ? "live" : BILD.art==="modell" ? "Prognose" : "typisch";
  /* Bise am See, darüber anderer Wind (vorwahl, seeBise): «Jetzt: Bise am See · darüber Südwest (Chasseral 16 kn)» */
  const lname = (!hl ? "" : h.seeBise ? `<span><b>${esc(hl.name)}</b> am See</span>` : `<b>${esc(hl.name)}</b>`)
    /* Lage vom See, Prognose fürs Fenster anders (heute, v36): «Jetzt: Bise · Abend: West oder Süd (Prognose)» */
    + (hl && h.fenster ? ` · ${h.fenster.wort}: <b>${esc(h.fenster.name)}</b> <span class="dim">(Prognose)</span>` : "");
  const ueber = h.ueber ? ` · darüber ${esc(h.ueber.name)} (Chasseral ${h.ueber.kn} kn)` : "";
  el.querySelector(".wbtoday").innerHTML = !ST.full && ST.h>0
    ? `${esc(zeit(BILD.T))}: ${BILD.lage ? `<b>${esc(BILD.name)}</b>` : kaum() ? "kaum Wind" : "keine Lage erkennbar"} <span class="dim">· ${BILD.aus==="messung" ? "Messung fortgeschrieben" : BILD.aus==="wechsel" ? "Prognose sagt Wechsel" : "Prognose"}${BILD.lage && BILD.quote!=null ? `, stimmt ~${BILD.quote} %` : ""}</span>`
    : !ST.full ? (hl ? `${wann}: ${lname} <span class="dim">${ueber ? ueber.slice(3)+" · " : "· "}${wie}${h.unsicher ? ", Chasseral fehlt" : ""}</span>`
      : `<span class="dim">${esc(h.grund)}${h.unsicher ? " Chasseral misst nicht." : ""}</span>`)
    : `<b>${esc(lageOf().name)}</b> <span class="dim">· Muster ${datum(DATA.von).replace(/\.\d{4}$/, ".")}–${datum(DATA.bis)}</span>`;
  const rg = el.querySelector(".wbtime input"); if(rg){ if(+rg.value!==ST.h) rg.value = ST.h; rg.setAttribute("aria-valuetext", ST.h>0 ? zeit(BILD.T)+", Prognose" : "jetzt"); }
  el.querySelector(".wbtoday").dataset.quelle = h.quelle || "";
  el.querySelectorAll(".wblagen button").forEach(c=>{ const on = c.dataset.t===ST.type, today = !ST.full && c.dataset.t===h.lage;
    c.setAttribute("aria-pressed", on); c.classList.toggle("today", today);
    c.setAttribute("aria-label", c.textContent.trim() + (today ? ", "+zurueck : "")); });
  const l = lageOf(), V = varOf(), vb = el.querySelector(".wbvars");
  vb.hidden = l.vars.length<2;
  vb.innerHTML = l.vars.length<2 ? "" : l.vars.map(v=>`<button data-k="${v.key}" aria-pressed="${v.key===V.key}">${esc(v.label)}${v.status==="s"?" <i>Hypothese</i>":""}</button>`).join("");
  vb.querySelectorAll("button").forEach(b2=>b2.addEventListener("click", ()=>{ ST.auto = false; ST.vk[l.id] = b2.dataset.k; update();
    const again = el.querySelector(`.wbvars button[data-k="${b2.dataset.k}"]`); if(again) again.focus(); }));
  el.querySelectorAll(".wbviews button").forEach(b3=>b3.setAttribute("aria-pressed", b3.dataset.v===ST.view));
  mapEl.setAttribute("aria-label", !BILD.lage ? `Karte ${VIEWS[ST.view].name}: keine Lage erkannt, nur der Wind an den Stationen.` : `Karte ${VIEWS[ST.view].name}: ${BILD.art==="typisch" ? "typischer" : BILD.art==="modell" ? "vorhergesagter" : "an der Messung ausgerichteter"} Wind bei ${BILD.name||l.name}${l.vars.length>1 && !ST.h ? ", "+V.label : ""}${V.status==="s" ? ", geschätzt" : ""}. ${["ips","vin"].map(id=>{ const n = BILD.ref[id], t = typ(id), nm = id==="ips" ? "Ipsach " : "Vingelz ";
    if(BILD.art!=="typisch") return nm+(n ? (BILD.art==="modell" ? "Modell " : "gemessen ")+r0(n.kn)+" kn "+card(n.dir) : "ohne Wert");
    return nm+(t ? (t.m ? "" : "geschätzt ")+r0(t.kn)+" kn "+card(t.dir) : "ohne Wert"); }).join(", ")}.`);
  const hb = el.querySelector(".wbhyb"); if(hb) hb.hidden = !hypFor().length;
  const est = el.querySelector(".wbest"); est.textContent = BILD.art==="modell" ? "Prognose" : ST.full ? "Hypothese" : "geschätzt";
  est.hidden = !(BILD.art==="modell" || (BILD.lage && V.status==="s"));
  el.querySelector(".wbthr").style.left = `calc(${Math.min(S.T, KN_MAX)/KN_MAX*100}% - 1px)`;
  el.querySelector(".wbthrt").textContent = `Strich: ${S.T} kn`;
}
function build(){
  const g = []; for(let s=0;s<=KN_MAX;s++) g.push(`${rgb(col(s))} ${s/KN_MAX*100}%`);
  el.innerHTML = `<div class="wbtoday"></div>
    <div class="wblagen" role="group" aria-label="Windlage">${DATA.lagen.map(l=>{ const t = l.vars.reduce((n,v)=>n+(v.tage||0), 0);
      return `<button class="chip" data-t="${l.id}">${esc(l.name)}<i>${t ? t+(t===1 ? " Tag" : " Tage") : "Hypothese"}</i></button>`; }).join("")}</div>
    <div class="wbbar"><div class="wbseg wbvars" role="group" aria-label="Variante" hidden></div>
      <button class="btn2 wbhyb" type="button" aria-pressed="true" hidden>Hypothesen</button>
      <div class="wbseg wbviews" role="group" aria-label="Ausschnitt">${Object.keys(VIEWS).map(k=>`<button data-v="${k}">${VIEWS[k].name}</button>`).join("")}</div></div>
    <div class="wbmap" role="img"><div class="wbpan"><canvas></canvas><canvas></canvas><div class="wbbadges"></div></div><div class="wbtip"></div>
      <div class="wbest" hidden>geschätzt</div><div class="wbnote">Schematisch · Tippen zeigt den Wert</div>
      <button class="wbreset" type="button" hidden>Ganze Karte</button></div>
    <div class="wbspots" aria-label="Spots ohne Messung"></div>
    <div class="wbtime"><input type="range" min="0" max="24" step="1" value="${ST.h}" aria-label="Vorspulen: Stunden ab jetzt">
      <div class="wbtl"><span>jetzt</span><span>+6 h</span><span>+12 h</span><span>+18 h</span><span>+24 h</span></div></div>
    <div class="wbleg"><span>kn</span><div class="wbscale"><div class="wbramp" style="background:linear-gradient(90deg,${g.join(",")})"></div>
      <div class="wbticks">${[0,5,10,15,20,25,30,35].map(s=>`<span style="left:${s/KN_MAX*100}%">${s}</span>`).join("")}</div><div class="wbthr"></div></div><span class="wbthrt"></span></div>
    <div class="note wbpanel" aria-live="polite"></div>`;
  mapEl = el.querySelector(".wbmap"); [base, flow] = mapEl.querySelectorAll("canvas"); bctx = base.getContext("2d"); fctx = flow.getContext("2d");
  el.querySelectorAll(".wblagen button").forEach(b=>b.addEventListener("click", ()=>{ ST.auto = false; ST.type = b.dataset.t; update(); }));
  el.querySelectorAll(".wbviews button").forEach(b=>b.addEventListener("click", ()=>{ Z = null; ST.view = b.dataset.v; try{ localStorage.setItem(V_KEY, ST.view); }catch(e){} update(); }));
  el.querySelector(".wbtime input").addEventListener("input", e=>{ ST.h = +e.target.value; update(); });
  const tip = el.querySelector(".wbtip"); let tt;
  zoomen();
  el.querySelector(".wbhyb").addEventListener("click", e=>{ ST.hyp = !ST.hyp; e.currentTarget.setAttribute("aria-pressed", ST.hyp); badges(); panelHtml = ""; panel(); });
  el.querySelector(".wbreset").addEventListener("click", e=>{ e.stopPropagation(); Z = null; update(); });
  mapEl.addEventListener("click", e=>{
    if(Date.now()-gesteEnde < 400) return;
    const r = mapEl.getBoundingClientRect(), px = e.clientX-r.left, py = e.clientY-r.top, [u,v] = fieldAt(...toKm(px,py)), s = Math.hypot(u,v);
    const st = statPos().map(q=>Object.assign({d:Math.hypot(q.x-px, q.y-py)}, q)).sort((a,b)=>a.d-b.d)[0];
    tip.textContent = st && st.d<26 ? `${st.voll}: ${st.w ? r0(st.w.kn)+" kn "+card(st.w.dir) : "keine Messung"}${st.sig==="on" ? " · Signal" : st.sig==="near" ? " · ungeprüftes Signal" : ""}`
      : !ANCH.length ? "keine Lage erkannt" : s<1 ? "unter 1 kn" : `≈ ${Math.round(s)} kn aus ${card((Math.atan2(-u,-v)*180/Math.PI+360)%360)}${ST.view==="region" && !inSee(px, py) ? " · geschätzt" : ""}`;
    tip.style.left = Math.max(60, Math.min(W-60, px))+"px"; tip.style.top = Math.max(34, py)+"px"; tip.style.display = "block";
    clearTimeout(tt); tt = setTimeout(()=>{ tip.style.display = "none"; }, 2600);
  });
  if("IntersectionObserver" in window) new IntersectionObserver(en=>{ visible = en[0].isIntersecting; play(); }, {rootMargin:"80px"}).observe(mapEl); else visible = true;
  document.addEventListener("visibilitychange", play);
  let rt; window.addEventListener("resize", ()=>{ clearTimeout(rt); rt = setTimeout(()=>{ drawn = ""; update(); }, 150); });
  const redraw = () => { drawn = ""; update(); };
  new MutationObserver(redraw).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
}
/* ---------- Zoom und Verschieben ---------- */
let gesteEnde = 0;
const pan = () => mapEl.querySelector(".wbpan");
function zeige(){ pan().style.transform = G ? `translate(${G.tx}px,${G.ty}px) scale(${G.f})` : ""; }
/* um den Punkt (qx, qy) um den Faktor df vergrössern, Massstab bleibt zwischen 1 und ZMAX */
function zoomUm(qx, qy, df){
  const s0 = Z ? Z.s : 1, f = Math.max(1/s0, Math.min(ZMAX/s0, G.f*df)); df = f/G.f;
  G.tx = df*(G.tx-qx)+qx; G.ty = df*(G.ty-qy)+qy; G.f = f;
}
/* Geste übernehmen: der Punkt in der Mitte des Bildes wird die neue Mitte, der Massstab wächst um G.f */
function uebernehme(){
  if(!G) return;
  const moved = Math.abs(G.f-1)>0.01 || Math.hypot(G.tx, G.ty)>3, s = (Z ? Z.s : 1)*G.f;
  if(moved){
    const [cx, cy] = toKm((W/2-G.tx)/G.f, (Hh/2-G.ty)/G.f);
    Z = s>1.02 ? {s, cx, cy} : null; gesteEnde = Date.now();
  }
  G = null;
  if(moved){ drawn = ""; update(); } else zeige();
}
function zoomen(){
  const P2 = new Map(); let start = null, wt = 0;
  const lokal = e => { const r = mapEl.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; };
  const beginne = () => {
    const p = [...P2.values()];
    if(p.length>=2) start = {mx:(p[0][0]+p[1][0])/2, my:(p[0][1]+p[1][1])/2, d:Math.hypot(p[0][0]-p[1][0], p[0][1]-p[1][1])||1, tx:G.tx, ty:G.ty, f:G.f};
    else if(p.length===1 && Z) start = {mx:p[0][0], my:p[0][1], d:0, tx:G.tx, ty:G.ty, f:G.f};
    else start = null;
  };
  mapEl.addEventListener("pointerdown", e=>{
    if(e.pointerType==="mouse" && e.button!==0) return;
    P2.set(e.pointerId, lokal(e));
    if(P2.size===1 && !Z && e.pointerType!=="touch") return;    /* Maus ohne Zoom: nur Tippen */
    if(!G) G = {f:1, tx:0, ty:0};
    try{ mapEl.setPointerCapture(e.pointerId); }catch(x){}
    beginne();
  });
  mapEl.addEventListener("pointermove", e=>{
    if(!P2.has(e.pointerId)) return;
    P2.set(e.pointerId, lokal(e));
    if(!G || !start) return;
    const p = [...P2.values()];
    if(p.length>=2 && start.d){
      const mx = (p[0][0]+p[1][0])/2, my = (p[0][1]+p[1][1])/2, d = Math.hypot(p[0][0]-p[1][0], p[0][1]-p[1][1]);
      G.f = start.f; G.tx = start.tx + mx-start.mx; G.ty = start.ty + my-start.my;
      zoomUm(mx, my, d/start.d);
    } else if(p.length===1 && !start.d){ G.tx = start.tx + p[0][0]-start.mx; G.ty = start.ty + p[0][1]-start.my; }
    else return;
    mapEl.classList.add("zooming"); zeige();
  });
  const los = e => {
    if(!P2.delete(e.pointerId)) return;
    if(!G) return;
    if(P2.size) beginne();                       /* ein Finger bleibt: weiter verschieben */
    else { mapEl.classList.remove("zooming"); start = null; uebernehme(); }
  };
  mapEl.addEventListener("pointerup", los); mapEl.addEventListener("pointercancel", los);
  /* Trackpad-Pinch und Ctrl + Mausrad am Computer */
  mapEl.addEventListener("wheel", e=>{
    if(!e.ctrlKey) return;
    e.preventDefault();
    if(!G) G = {f:1, tx:0, ty:0};
    const [qx, qy] = lokal(e); zoomUm(qx, qy, Math.exp(-Math.max(-40, Math.min(40, e.deltaY))*0.01)); zeige();
    clearTimeout(wt); wt = setTimeout(uebernehme, 160);
  }, {passive:false});
  /* Safari: kein Zoom der ganzen Seite, solange die Finger auf der Karte liegen */
  ["gesturestart","gesturechange"].forEach(t=>mapEl.addEventListener(t, e=>e.preventDefault(), {passive:false}));
}
/* Die Datei muss vollständig sein, sonst zeigt die Sektion lieber eine Meldung als eine halbe Karte */
function pruefe(j){
  const ok = j && typeof j.stand==="string" && Array.isArray(j.lagen) && j.lagen.length && j.lagen.every(l=>l.id && l.name && Array.isArray(l.vars) && l.vars.length
    && l.vars.every(v=>v.key && Array.isArray(v.a) && ["ips","vin"].every(id=>v.a.some(a=>a[0]===id))));
  if(!ok) throw new Error("Datei unvollständig");
}
/* Wird nach jedem Rendern der Hauptansicht und der Seekarten aufgerufen. Zeichnet die Karte nur neu, wenn sich Lage, Variante,
   Ausschnitt, Darstellung oder Grösse ändern. */
function update(){
  el = el || $("#wb"); if(!el) return;
  if(!DATA){
    /* nach einem Fehler frühestens nach einer Minute erneut versuchen (beim nächsten Auffrischen) */
    if(!LOADING && Date.now()-FAILED > 60000){ LOADING = true;
      /* Hypothesen sind eine Zugabe: fehlen sie, zeigt die Karte das Muster ohne sie */
      C.fetchHypothesen().then(j=>{ if(j && Array.isArray(j.hyp)){ HYP = j; if(DATA){ drawn = ""; update(); } } }).catch(()=>{});
      setTimeout(()=>C.fetchWindbild().then(j=>{ pruefe(j); DATA = j; build(); update(); })
        .catch(e=>{ FAILED = Date.now(); el.innerHTML = `<div class="note">Das Windbild ist gerade nicht abrufbar (${esc(e.message||"Fehler")}).</div>`; })
        .then(()=>{ LOADING = false; }), 0); }
    return;
  }
  HEUTE = heute();
  const bekannt = id => id && DATA.lagen.some(l=>l.id===id);
  if(ST.full || ST.h===0){
    if(!ST.full && ST.auto && bekannt(HEUTE.lage)){ ST.type = HEUTE.lage; if(HEUTE.vk) ST.vk[HEUTE.lage] = HEUTE.vk; }
    if(ST.full) BILD = {art:"typisch", lage:ST.type, ref:{}, name:lageOf().name};
    else { const ref = liveRef(); BILD = {art:Object.keys(ref).length ? "live" : "typisch", lage:bekannt(HEUTE.lage) ? HEUTE.lage : null, ref, name:lageOf().name}; }
  } else {
    const r = stunde(ST.h, HEUTE);
    if(bekannt(r.lage)){ ST.type = r.lage; if(r.vk) ST.vk[r.lage] = r.vk; }
    BILD = {art:"modell", lage:bekannt(r.lage) ? r.lage : null, ref:r.ref, T:r.T, name:r.westSued ? "West oder Süd" : lageOf().name, aus:r.aus, quote:r.quote};
  }
  head();
  const refKey = Object.entries(Object.assign({}, regionRef(), BILD.ref)).map(([k,v])=>k+Math.round(v.kn)+"/"+Math.round(v.dir/5)).join(",");
  const key = [BILD.art, BILD.lage, ST.type, varOf().key, ST.view, ST.h, refKey, isDark(), reduce(), Math.round(mapEl.getBoundingClientRect().width)].join("|");
  const zk = Z ? [Z.s.toFixed(3), Z.cx.toFixed(3), Z.cy.toFixed(3)].join("/") : "";
  const rs = el.querySelector(".wbreset"); if(rs) rs.hidden = !Z;
  const nt = el.querySelector(".wbnote"); if(nt) nt.textContent = Z ? `Schematisch · ${Z.s.toFixed(1)}×` : ST.full ? "Typisches Muster · Tippen zeigt den Punkt" : "Schematisch · Tippen zeigt den Wert · Zoom mit zwei Fingern"; mapEl.classList.toggle("zoomed", !!Z);
  if(key+"|"+zk!==drawn){ drawn = key+"|"+zk; requestAnimationFrame(()=>{ try{ setAnchors(); fit(); drawBase(); seed(); badges(); if(!G) zeige(); play(); }catch(e){ drawn = ""; } }); }
  else badges();
  panel();
}
/* Startseite: nur die Lage von heute (ohne Filter, ohne Tabelle). Blatt «Erklärungen»: alle Lagen und Varianten mit Tabelle.
   Zurück auf der Startseite gilt wieder die Lage von heute. */
function mode(full){
  Z = null; G = null;
  ST.full = !!full; if(!ST.full) ST.auto = true;
  el = el || $("#wb"); if(el) el.classList.toggle("wbfull", ST.full);
  drawn = ""; update();
}
return {update, vorwahl, mischLage, mischKn, quote, mode, ausrichten, state:ST};
})();
function wbUpdate(){ try{ WB.update(); }catch(e){ const b = $("#wb"); if(b) b.innerHTML = `<div class="note">Windbild: ${esc(e.message)}</div>`; } }
