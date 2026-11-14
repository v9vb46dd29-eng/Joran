#!/usr/bin/env node
/* Joran — Windbild der Bieler Bucht: rechnet data/windbild.json für die Sektion «Windbild» der App. Auswertung, kein Modell.
   Je Lage der typische Wind an den Messstationen und der Anteil der Zeit ab jeder Schwelle (10 bis 30 kn) an Vingelz und Ipsach.
   Lage wie in eval/schichten.cjs: Sektor des Winds auf dem Chasseral (ab 10 kn) und Schichtung Cressier–Chasseral
   (ab 4 K je km durchmischt). Zehnminutenwerte von 8 bis 22 Uhr, nur Tage bis --bis (Standard: Entwicklungstage aus
   eval/split.json, der Holdout bleibt ungelesen).
   Was das Archiv nicht hergibt (Joran, Thermik), übernimmt das Skript aus eval/windbild.vorlage.json: «fest» gesetzte
   Stützpunkte oder die Vektorsumme zweier Varianten. Geschätzte Stützpunkte einer gerechneten Variante stehen dort als
   Faktor und Drehung zu einem gemessenen Bezug und wachsen so mit der Messung mit. Texte werden in der Vorlage gepflegt.
   Aufruf: node eval/windbild.cjs [--bis JJJJ-MM-TT] [--pruefen] [--trocken]
     --pruefen   vergleicht je Chasseral-Sektor mit der Ausgabe von eval/schichten.cjs (Werte, Tage, kn, Anteil ab 12 kn),
                 prüft die geschriebene Datei und spielt die Vorwahl der App (vorwahl in app/windbild.js) gegen das Archiv
                 ab: Wählt sie aus der Messung die Lage, die die Daten der Zeile geben? Fehlercode 1 bei Abweichung.
                 Nur ohne --bis sinnvoll.
     --trocken   schreibt nichts, zeigt nur die Tabelle
   Braucht den Branch «live» (git fetch origin live) und den Stationscache aus eval/measure.cjs. */
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), C = require(path.join(ROOT, "core.js")), M = require("./measure.cjs");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i>0 ? process.argv[i+1] : d; };
const has = k => process.argv.includes(k);
const split = JSON.parse(fs.readFileSync(path.join(__dirname, "split.json"), "utf8"));
const bis = arg("--bis", split.devBis), VON = "2026-10-16";
const OUT = path.join(ROOT, "data", "windbild.json"), TPL = JSON.parse(fs.readFileSync(path.join(__dirname, "windbild.vorlage.json"), "utf8"));
const SCHWELLEN = []; for(let t=10; t<=30; t++) SCHWELLEN.push(t);
const LAPSE = 4, KAMM_MIN = 10, MIN_WERTE = 12;                    /* wie eval/schichten.cjs */
/* Kammprognose ICON-CH2 mal diesen Faktor (Median Prognose/Messung 0.49, eval/windbild-stunde.cjs) */
const KAMM_FAKTOR = 2;
const MIN_TAGE = 4, TAG_WERTE = 6;                                 /* ein Tag zählt ab einer Stunde Messwerten in der Lage; ab MIN_TAGE Tagen gilt sie als gemessen */
const SEE_BISE_MIN = 4;                                            /* Bise am See geht vor: Vingelz und Ipsach je ab so viel kn im Sektor bise (vorwahl, v32) */
const LAND = ["cha","crm","gre","coy","neu"], SEE = C.LAKE.map(x=>x.id), MESS = LAND.concat(SEE);

/* ---------- Daten: gleiche Auswahl wie eval/schichten.cjs ---------- */
const {lk} = M.loadArchive([], true);
const grid = t => Math.round(+new Date(t)/600e3)*600e3;
const S = {};
LAND.forEach(a=>{ const f = path.join(__dirname, "cache", a+".t.json");
  if(!fs.existsSync(f)){ console.error(`Cache fehlt: ${a}. Zuerst node eval/measure.cjs --T 12 laufen lassen.`); process.exit(1); }
  S[a] = new Map(JSON.parse(fs.readFileSync(f, "utf8")).map(r=>[+new Date(r.t), r])); });
const L = {}; C.LAKE.forEach(x=>{ const m = new Map(); lk.st[x.id].rows.forEach(r=>m.set(grid(r.t), r)); L[x.id] = m; });
const sec8 = d => d==null ? null : ["N","NO","O","SO","S","SW","W","NW"][Math.round(d/45)%8];
const med = a => { if(!a.length) return null; const s = [...a].sort((x,y)=>x-y); return s[s.length>>1]; };
const rows = [];
for(const [t, c] of S.cha){
  const dt = new Date(t), day = C.dayOfDate(dt); if(day>bis || day<VON) continue;
  const hr = C.localHour(dt); if(hr<8 || hr>=22) continue;
  const i = L.ips.get(t), v = L.vin.get(t), f = S.crm.get(t); if(!i || !v || !f) continue;
  const lapse = c.temp!=null && f.temp!=null ? (f.temp-c.temp)/1.163 : null; if(lapse==null) continue;
  rows.push({t, day, cha:c, crm:f, gre:S.gre.get(t), coy:S.coy.get(t), neu:S.neu.get(t), ips:i, vin:v,
    kamm:c.mean<KAMM_MIN ? null : sec8(c.dir), schicht:lapse>=LAPSE ? "gemischt" : "stabil"});
}
if(!rows.length){ console.error("Keine Daten: zuerst git fetch origin live und node eval/measure.cjs --T 12 laufen lassen."); process.exit(1); }
const pick = (kamm, schicht) => rows.filter(r=>r.kamm===kamm && r.schicht===schicht);
const share = (a, id, T) => Math.round(100*a.filter(r=>Math.round(r[id].mean)>=T).length/a.length);
/* typischer Wind einer Station: Stärke als Median, Richtung als Vektormittel */
function typ(a, id){
  const rs = a.map(r=>r[id]).filter(r=>r && r.mean!=null); if(!rs.length) return null;
  let u = 0, v = 0, n = 0; rs.forEach(r=>{ if(r.dir==null) return; const k = r.dir*Math.PI/180; u -= r.mean*Math.sin(k); v -= r.mean*Math.cos(k); n++; });
  return {kn:Math.round(med(rs.map(r=>r.mean))*10)/10, dir:n ? Math.round((Math.atan2(-u,-v)*180/Math.PI+360)%360)%360 : 0};
}

/* ---------- je Variante ---------- */
const table = [], sektoren = [];
function regel(V){
  const groups = V.regel.kamm.map(k=>({k, a:pick(k, V.regel.schicht)})).filter(g=>g.a.length>=MIN_WERTE);
  groups.forEach(g=>sektoren.push({kamm:g.k, schicht:V.regel.schicht, n:g.a.length, tage:new Set(g.a.map(r=>r.day)).size,
    ips:med(g.a.map(r=>r.ips.mean)), ipsT:share(g.a,"ips",12), vin:med(g.a.map(r=>r.vin.mean)), vinT:share(g.a,"vin",12)}));
  const all = groups.flatMap(g=>g.a); if(!all.length) return null;
  const je = {}; all.forEach(r=>{ je[r.day] = (je[r.day]||0)+1; });
  const tage = Object.values(je).filter(n=>n>=TAG_WERTE).length, t = {}; MESS.forEach(id=>{ t[id] = typ(all, id); });
  const a = MESS.filter(id=>t[id]).map(id=>[id, t[id].dir, t[id].kn, 1]);
  /* geschätzte Punkte: Faktor mal Bezug, höchstens so stark wie die stärkste Messung ihrer Höhenlage
     (Bezug Chasseral: der Chasseral; sonst die stärkste Station unterhalb des Kamms) */
  const unten = Math.max(...MESS.filter(id=>id!=="cha" && t[id]).map(id=>t[id].kn));
  (V.schaetzung||[]).forEach(([p, ref, f, off])=>{ const r = t[ref]; if(!r) return;
    a.push([p, Math.round(r.dir+off+360)%360, Math.round(Math.min(Math.max(r.kn,0.5)*f, ref==="cha" ? r.kn : unten)*10)/10]); });
  /* Anteil ab der Schwelle: Spanne über die Chasseral-Sektoren der Lage */
  const anteil = {}; SCHWELLEN.forEach(T=>{ anteil[T] = {}; SEE.forEach(id=>{ const p = groups.map(g=>share(g.a, id, T)); anteil[T][id] = [Math.min(...p), Math.max(...p)]; }); });
  return {status:tage>=MIN_TAGE ? "m" : "e", tage, werte:all.length, schicht:V.regel.schicht, anteil, a};
}
function summe(x, y){
  const m = {}, add = ([p,d,s]) => { const r = d*Math.PI/180, o = m[p] || (m[p] = {u:0, v:0, n:0}); o.u += -s*Math.sin(r); o.v += -s*Math.cos(r); o.n++; };
  x.forEach(add); y.forEach(add);
  return Object.entries(m).filter(([,o])=>o.n===2).map(([p,o])=>[p, Math.round((Math.atan2(-o.u,-o.v)*180/Math.PI+360)%360)%360, Math.round(Math.hypot(o.u,o.v)*10)/10]);
}
const days = [...new Set(rows.map(r=>r.day))].sort();
const out = {stand:C.localDay(0), von:days[0], bis:days[days.length-1], tage:days.length,
  quelle:"Gerechnet von eval/windbild.cjs aus der Seemessung (Vingelz, Ipsach) und SwissMetNet (Chasseral, Cressier, Grenchen, Courtelary, Neuchâtel): Zehnminutenwerte 8–22 Uhr. Lage nach dem Wind auf dem Chasseral, Schichtung nach der Temperaturabnahme Cressier–Chasseral. Lagen mit fest gesetzten Stützpunkten stammen aus eval/windbild.vorlage.json.",
  format:"regeln.seeBiseMin = Bise am See geht vor, wenn Vingelz und Ipsach beide ab so viel kn aus dem Sektor bise messen (West, Süd und Nordwest auf dem Chasseral werden dann zu Bise). kamm = Sektoren des Winds auf dem Chasseral (ab regeln.kammMin kn), die zur Lage gehören; die Kammprognose zählt mal regeln.kammFaktor; schicht = durchmischt ab regeln.lapseMin K je km. tage = Tage mit mindestens regeln.tagWerte Zehnminutenwerten in der Lage, werte = Zehnminutenwerte. a = Stützpunkte [Ort, Wind aus Grad, kn, 1 = gemessen]. status: m = gemessen, e = wenige Tage, s = geschätzt. anteil = Prozent der Zeit ab der Schwelle [kleinster, grösster Wert über die Chasseral-Sektoren der Lage], je Schwelle in kn.",
  regeln:{kammMin:KAMM_MIN, lapseMin:LAPSE, tagWerte:TAG_WERTE, kammFaktor:KAMM_FAKTOR, seeBiseMin:SEE_BISE_MIN},
  lagen:[]};
const done = {};
TPL.lagen.forEach(l=>{ const Lg = {id:l.id, name:l.name, kamm:l.kamm || [...new Set(l.vars.flatMap(V=>V.regel ? V.regel.kamm : []))], vars:[]};
  l.vars.forEach(V=>{ const o = {key:V.key}; if(V.label) o.label = V.label;
    let r = null;
    if(V.regel) r = regel(V);
    else if(V.fest) r = {status:V.status, tage:V.tage, a:V.a};
    else if(V.summe){ const [x, y] = V.summe.map(k=>done[k]); if(x && y) r = {status:"s", tage:0, a:summe(x.a, y.a)}; }
    if(!r){ console.log(`${l.id}.${V.key}: keine Daten, Variante fehlt in der Ausgabe`); return; }
    Object.assign(o, {status:r.status, tage:r.tage}); if(r.werte){ o.werte = r.werte; o.schicht = r.schicht; }
    o.text = V.text; if(r.anteil) o.anteil = r.anteil; o.a = r.a;
    done[l.id+"."+V.key] = o; Lg.vars.push(o);
    const at = id => { const z = o.a.find(q=>q[0]===id); return z ? `${z[2].toFixed(1).padStart(5)} ${C.card(z[1]).padEnd(3)}` : "    –    "; };
    table.push(`${(l.id+"."+V.key).padEnd(15)} ${V.regel ? "gerechnet" : V.fest ? "fest     " : "Summe    "} ${r.status}  ${String(r.tage).padStart(3)}  ${String(r.werte||"").padStart(5)} | ${at("cha")} | ${at("crm")} | ${at("ips")} ${r.anteil ? (r.anteil[12].ips.join("–")+" %").padStart(9) : "         "} | ${at("vin")} ${r.anteil ? (r.anteil[12].vin.join("–")+" %").padStart(9) : ""}`); });
  if(Lg.vars.length) out.lagen.push(Lg); });

console.log(`Windbild — ${days.length} Tage (${days[0]} bis ${days[days.length-1]}), 8–22 Uhr, ${rows.length} Zehnminutenwerte`);
console.log("Variante        Herkunft  St Tage  Werte | Chasseral | Cressier  | Ipsach     ab 12 kn | Vingelz    ab 12 kn");
table.forEach(t=>console.log(t));

/* Regler: wie lange die Messung von jetzt hält und wie oft die Prognose trifft (eval/lage-vorlauf.cjs --schreiben) */
const VL = path.join(__dirname, "data", "vorlauf.json");
if(fs.existsSync(VL)){ const v = JSON.parse(fs.readFileSync(VL, "utf8")); out.vorlauf = {stand:v.stand, von:v.von, bis:v.bis, jahre:v.jahre, leads:v.leads, fort:v.fort, prog:v.prog, tau:v.tau}; }
else console.log("Hinweis: eval/data/vorlauf.json fehlt (node eval/lage-vorlauf.cjs --schreiben). Der Regler zeigt dann keine Quote.");
/* kompakt schreiben: eine Zeile je Stützpunktliste und je Schwelle */
const text = JSON.stringify(out, null, 1)
  .replace(/\[\s+("[a-zA-Z]+"),\s+([\d.]+),\s+([\d.]+)(?:,\s+(1))?\s+\]/g, (m,a,b,c,d)=>`[${a},${b},${c}${d?",1":""}]`)
  .replace(/\],\s+\[/g, "],[").replace(/"a": \[\s+\[/g, '"a": [[').replace(/\]\s+\]/g, "]]")
  .replace(/\{\s+"(\w+)": \[\s+(\d+),\s+(\d+)\s+\],\s+"(\w+)": \[\s+(\d+),\s+(\d+)\s+\]\s+\}/g, '{"$1":[$2,$3],"$4":[$5,$6]}') + "\n";
JSON.parse(text);
if(!has("--trocken")){ fs.mkdirSync(path.dirname(OUT), {recursive:true}); fs.writeFileSync(OUT, text); console.log(`\ngeschrieben: data/windbild.json (${out.lagen.length} Lagen, ${out.lagen.reduce((n,l)=>n+l.vars.length,0)} Varianten)`); }

/* ---------- Prüfung gegen eval/schichten.cjs und der geschriebenen Datei ---------- */
if(has("--pruefen")){
  let fail = 0; const ok = (name, cond, info) => { console.log(`${cond ? "ok  " : "FEHL"} ${name}${!cond && info ? " — "+info : ""}`); if(!cond) fail++; };
  const txt = cp.execFileSync("node", [path.join(__dirname, "schichten.cjs"), "--T", "12"], {encoding:"utf8"});
  const ref = {};
  txt.split("\n").forEach(l=>{ const m = l.match(/^Kamm (\w+)\s+(gemischt|stabil) \([^)]*\)\s+(\d+)\s+(\d+) \|[^|]*\|[^|]*\|\s+([\d.]+)\s+(\d+)%[^|]*\|\s+([\d.]+)\s+(\d+)%/);
    if(m) ref[m[1]+"."+m[2]] = {n:+m[3], tage:+m[4], ips:+m[5], ipsT:+m[6], vin:+m[7], vinT:+m[8]}; });
  ok("Ausgabe von eval/schichten.cjs gelesen", Object.keys(ref).length>=5, Object.keys(ref).join(", "));
  sektoren.forEach(s=>{ const r = ref[s.kamm+"."+s.schicht];
    const same = r && r.n===s.n && r.tage===s.tage && r.ips===+s.ips.toFixed(1) && r.vin===+s.vin.toFixed(1) && r.ipsT===s.ipsT && r.vinT===s.vinT;
    ok(`Kamm ${s.kamm}, ${s.schicht}: wie eval/schichten.cjs`, same, `hier ${JSON.stringify({n:s.n, tage:s.tage, ips:+s.ips.toFixed(1), ipsT:s.ipsT, vin:+s.vin.toFixed(1), vinT:s.vinT})}, dort ${JSON.stringify(r)}`); });
  ["west","bise","nord"].forEach(id=>ok(`Lage ${id} gerechnet`, out.lagen.some(l=>l.id===id && l.vars.some(v=>v.anteil))));
  const vars = out.lagen.flatMap(l=>l.vars.map(v=>[l.id+"."+v.key, v]));
  ok("Jede Variante der Vorlage steht in der Ausgabe", vars.length===TPL.lagen.reduce((n,l)=>n+l.vars.length,0));
  ok("Jede Variante hat Stützpunkte für Vingelz und Ipsach", vars.every(([,v])=>SEE.every(id=>v.a.some(a=>a[0]===id))), vars.filter(([,v])=>!SEE.every(id=>v.a.some(a=>a[0]===id))).map(x=>x[0]).join(", "));
  ok("Stützpunkte plausibel (Richtung 0–359°, 0–60 kn)", vars.every(([,v])=>v.a.every(a=>a[1]>=0 && a[1]<360 && a[2]>=0 && a[2]<=60)));
  ok("Geschätztes ist nie als gemessen markiert: geschätzte Lagen ohne gemessene Seestation und ohne Anteil, gemessen nur an Stationen",
    vars.every(([,v])=>v.status!=="s" || (!v.anteil && v.a.every(a=>!a[3] || !SEE.includes(a[0])))) && vars.every(([,v])=>v.a.filter(a=>a[3]).every(a=>MESS.includes(a[0]))));
  /* geschätzte Punkte am See und im Flachland dürfen nicht über der stärksten Messung unterhalb des Jurakamms liegen;
     Punkte mit Bezug Chasseral (Höhenlagen) nicht über dem Chasseral */
  const bezug = {}; TPL.lagen.forEach(l=>l.vars.forEach(V=>(V.schaetzung||[]).forEach(z=>{ bezug[l.id+"."+V.key+"."+z[0]] = z[1]; })));
  const hoch = vars.filter(([,v])=>v.werte).flatMap(([k,v])=>{ const m = id => (v.a.find(a=>a[0]===id)||[0,0,0])[2], unten = Math.max(...v.a.filter(a=>a[3] && a[0]!=="cha").map(a=>a[2]));
    return v.a.filter(a=>!a[3]).filter(a=>a[2] > (bezug[k+"."+a[0]]==="cha" ? m("cha") : unten)+0.05).map(a=>`${k} ${a[0]} ${a[2]}`); });
  ok("Kein geschätzter Stützpunkt liegt über der stärksten Messung seiner Höhenlage", hoch.length===0, hoch.join(", "));
  const sek = out.lagen.flatMap(l=>l.kamm);
  ok("Jeder Chasseral-Sektor gehört zu höchstens einer Lage, jede gerechnete Lage nennt ihre Sektoren", new Set(sek).size===sek.length && out.lagen.every(l=>l.kamm.length || !l.vars.some(v=>v.werte)), sek.join(", "));
  ok("Kennzahlen für den Regler vorhanden (vorlauf, aus eval/lage-vorlauf.cjs)", !!(out.vorlauf && out.vorlauf.leads && out.vorlauf.prog && out.vorlauf.tau>0));
  ok("Anteil fällt mit steigender Schwelle nicht", vars.filter(([,v])=>v.anteil).every(([,v])=>SEE.every(id=>SCHWELLEN.slice(1).every(T=>v.anteil[T][id][1]<=v.anteil[T-1][id][1] && v.anteil[T][id][0]<=v.anteil[T-1][id][0]))));
  /* Vorwahl der App gegen das Archiv: Funktion aus app/windbild.js herauslösen (sie ist rein) und je Zeile so füttern, wie
     heute() es mit Messwerten tut: Chasseral als Mittel der letzten drei Zehnminutenwerte, Seestationen als frische Werte.
     Die Prognose fehlt im Archiv; sie kommt in der App erst zum Zug, wenn der Chasseral unter kammMin misst oder fehlt. */
  const src = fs.readFileSync(path.join(ROOT, "app", "windbild.js"), "utf8");
  const i0 = src.indexOf("/* ---------- Lage von heute ---------- */"), i1 = src.indexOf("function heute(){");
  let app = null; try{ app = new Function("dirOf", "DATA", src.slice(i0, i1)+"; return {vorwahl, mittel};")(C.dirOf, out); }catch(e){ ok("vorwahl aus app/windbild.js gelesen", false, e.message); }
  if(app){
    const soll = r => { if(!r.kamm) return null; const l = out.lagen.find(z=>z.kamm.includes(r.kamm)); return l && l.vars.some(v=>v.werte) ? l.id : null; };
    const hit = {}, all = {};
    rows.forEach(r=>{ const want = soll(r); if(!want) return;
      const letzte = [0,1,2].map(k=>S.cha.get(r.t-k*600e3)).filter(Boolean).map(c=>({kn:c.mean, dir:c.dir}));
      const lake = C.LAKE.map(Lk=>({fresh:true, L:Lk, last:r[Lk.id]}));
      const got = app.vorwahl({kammM:app.mittel(letzte), mixM:r.schicht==="gemischt", lake, monat:+r.day.slice(5,7)}, out.lagen, out.regeln);
      all[want] = (all[want]||0)+1; if(got.lage===want) hit[want] = (hit[want]||0)+1; });
    Object.keys(all).forEach(id=>{ const p = Math.round(100*(hit[id]||0)/all[id]);
      ok(`Vorwahl aus der Messung trifft die Lage ${id} (${p} % von ${all[id]} Werten, verlangt 80 %)`, p>=80); });
    /* Bise am See (v32): Die Regel darf nur greifen, wenn beide Seestationen Bise ab seeBiseMin kn messen und der Chasseral
       West, Südwest, Süd oder Nordwest zeigt. Nordlage und Südost bleiben, sonst wird die Nordlage wieder zu Bise. */
    const istB = z => z && z.dir!=null && z.mean>=SEE_BISE_MIN && C.dirOf(z.dir).id==="bise";
    let biseN = 0, biseFalsch = 0; const biseTage = new Set(), biseKamm = {};
    rows.forEach(r=>{ const letzte = [0,1,2].map(k=>S.cha.get(r.t-k*600e3)).filter(Boolean).map(c=>({kn:c.mean, dir:c.dir}));
      const lake = C.LAKE.map(Lk=>({fresh:true, L:Lk, last:r[Lk.id]})), kM = app.mittel(letzte);
      const got = app.vorwahl({kammM:kM, mixM:r.schicht==="gemischt", lake, monat:+r.day.slice(5,7)}, out.lagen, out.regeln);
      if(!got.seeBise) return; biseN++; biseTage.add(r.day); const k = kM ? sec8(kM.dir) : "–"; biseKamm[k] = (biseKamm[k]||0)+1;
      if(got.lage!=="bise" || !istB(r.ips) || !istB(r.vin) || !["W","SW","S","NW"].includes(k)) biseFalsch++; });
    ok(`Bise am See greift nur bei Bise an beiden Seestationen und West, Süd oder Nordwest auf dem Chasseral (${biseN} Werte an ${biseTage.size} Tagen: ${Object.entries(biseKamm).map(([k,n])=>k+" "+n).join(", ")||"keine"})`, biseFalsch===0, `${biseFalsch} Werte ausserhalb`);
    const nordSo = rows.filter(r=>r.kamm==="N" || r.kamm==="SO").filter(r=>{ const lake = C.LAKE.map(Lk=>({fresh:true, L:Lk, last:r[Lk.id]}));
      return app.vorwahl({kammM:{kn:r.cha.mean, dir:r.cha.dir}, mixM:r.schicht==="gemischt", lake, monat:+r.day.slice(5,7)}, out.lagen, out.regeln).seeBise; }).length;
    ok("Bise am See überschreibt nie Nordlage oder Südost", nordSo===0, `${nordSo} Werte`);
    const sig = app.vorwahl({nc:{trusted:[{up:{name:"Neuchâtel"}, u:{sys:{id:"w"}}}]}, kammM:{kn:16, dir:225}, lake:C.LAKE.map(Lk=>({fresh:true, L:Lk, last:{mean:6, dir:80}})), monat:11}, out.lagen, out.regeln);
    const ohneSig = app.vorwahl({kammM:{kn:16, dir:225}, mixM:false, lake:C.LAKE.map(Lk=>({fresh:true, L:Lk, last:{mean:6, dir:80}})), monat:11}, out.lagen, out.regeln);
    const sigB = app.vorwahl({nc:{trusted:[{up:{name:"Grenchen"}, u:{sys:{id:"bise"}}}]}, kammM:{kn:16, dir:225}, lake:C.LAKE.map(Lk=>({fresh:true, L:Lk, last:{mean:12, dir:45}})), monat:11}, out.lagen, out.regeln);
    ok("Bise-Signal (Grenchen) blockiert Bise am See nicht (Review v32, A1)", sigB.lage==="bise" && sigB.seeBise, JSON.stringify([sigB.lage, sigB.quelle]));
    ok("Fall 14.11. 12:03 (See 5–6 kn O, Chasseral 16 kn SW): Bise, darüber Südwest; mit West-Signal bleibt West",
      ohneSig.lage==="bise" && ohneSig.seeBise && ohneSig.ueber && ohneSig.ueber.name==="Südwest" && ohneSig.art==="messung" && !ohneSig.kamm && sig.lage==="west" && !sig.seeBise,
      JSON.stringify({ohneSig:[ohneSig.lage, ohneSig.ueber], sig:sig.lage}));
    ok("Vorwahl gegen das Archiv für West, Süd, Bise und Nordlage geprüft", ["west","sued","bise","nord"].every(id=>all[id]>0), Object.keys(all).join(", "));
    /* Vorbehalt: Eingabe und Soll stammen aus derselben Messung auf dem Chasseral. Die Quoten oben zeigen, was Mittelung und
       Sektorgrenzen kosten, nicht, ob die Lage bis zum Abend hält. Signal, Prognose und Joran-Zeichen fehlen im Archiv.
       Fall ohne Chasseral (Station fällt aus): Es bleibt nur die Seemessung. Verlangt ist, dass die App jede solche Wahl
       als unsicher kennzeichnet; die Trefferquote steht zur Information da. */
    const hitO = {}, allO = {}; let offen = 0, messung = 0, n = 0;
    rows.forEach(r=>{ const want = soll(r); if(!want) return; n++;
      const lake = C.LAKE.map(Lk=>({fresh:true, L:Lk, last:r[Lk.id]}));
      const got = app.vorwahl({kammFehlt:true, mixM:null, lake, monat:+r.day.slice(5,7)}, out.lagen, out.regeln);
      if((got.lage || got.quelle) && !got.unsicher) offen++;
      const mit = app.vorwahl({kammM:{kn:r.cha.mean, dir:r.cha.dir}, kammFehlt:false, lake, monat:+r.day.slice(5,7)}, out.lagen, out.regeln);
      if(mit.art==="messung" && !mit.unsicher) messung++;
      allO[want] = (allO[want]||0)+1; if(got.lage===want) hitO[want] = (hitO[want]||0)+1; });
    ok(`Ohne Chasseral ist jede Vorwahl als unsicher gekennzeichnet (${n} Werte)`, offen===0, `${offen} ohne Kennzeichen`);
    ok("Mit Chasseral gilt die Vorwahl als Messung von jetzt und nicht als unsicher", messung===n, `${messung} von ${n}`);
    console.log("     ohne Chasseral, nur Seemessung: " + Object.keys(allO).map(id=>`${id} ${Math.round(100*(hitO[id]||0)/allO[id])} %`).join(", ") + " (Information, keine Vorgabe)");
  }
  console.log(fail ? `\n${fail} Prüfung(en) nicht bestanden` : "\nWindbild stimmt mit eval/schichten.cjs überein");
  process.exitCode = fail ? 1 : 0;
}
