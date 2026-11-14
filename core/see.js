/* Joran — Silo «see». Seemessung Vingelz und Ipsach auswerten: Seite von meteoBase lesen, Messreihe führen, Lage
   jetzt, Sturm am See, Wahrheit eines Tages (foilbar oder ruhig).
   Hängt ab von: konstanten, helfer. Aufbau und Regeln: ARCHITEKTUR.md */
(function(root, make){
  const dep = n => typeof module!=="undefined" && module.exports ? require("./"+n+".js") : root.Joran[n];
  const api = make(dep);
  if(typeof module!=="undefined" && module.exports) module.exports = api; else (root.Joran = root.Joran || {}).see = api;
})(typeof self!=="undefined" ? self : this, function(dep){
"use strict";
const {LAKE, LAKE_KEEP_H, WINS, DEF} = dep("konstanten");
const {dirOn, over, localHour, dayOfDate} = dep("helfer");

/* ---- Seestationen (meteoBase): HTML-Seite auslesen ---- */
const DIR16 = ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const dir16 = s => { const i = DIR16.indexOf(String(s||"").toUpperCase().replace(/E/g,"O")); return i<0 ? null : i*22.5; };
function parseMeteobase(html){
  const txt = String(html).replace(/&nbsp;/g," ").replace(/&Oslash;|&#216;/g,"Ø");   /* «Ø» nicht voraussetzen: Kodierung kann es verstümmeln */
  const m = txt.match(/(\d{2})\.(\d{2})\.(\d{4})\s*\((CEST|CET|MESZ|MEZ)\)\s*(\d{1,2}):(\d{2})/);
  if(!m) throw new Error("kein Zeitstempel");
  const off = /CEST|MESZ/.test(m[4]) ? 2 : 1;
  const t = new Date(Date.UTC(+m[3], +m[2]-1, +m[1], +m[5]-off, +m[6]));
  const w = re => { const x = txt.match(re); return x ? {kn:parseFloat(x[1]), dir:x[2]} : null; };
  const mean = w(/Wind-10min-(?!Max)[^:<]{1,6}:\s*[\d.]+\s*km\/h\s*\(([\d.]+)\s*kn[^)]*\)\s*([A-Z]{1,3})/);
  const gust = w(/Wind-10min-Max:\s*[\d.]+\s*km\/h\s*\(([\d.]+)\s*kn[^)]*\)\s*([A-Z]{1,3})/);
  if(!mean) throw new Error("kein Windwert");
  const n = re => { const x = txt.match(re); return x ? parseFloat(x[1]) : null; };
  return {t:t.toISOString(), mean:mean.kn, dir:dir16(mean.dir), gust:gust?gust.kn:null,
    steady:n(/Richtungstreue:\s*(\d+)\s*(?:%|&#0*37;|&percnt;)/), air:n(/Lufttemperatur:\s*(-?[\d.]+)/), water:n(/Wassertemperatur:\s*(-?[\d.]+)/)};
}
/* Zwei Messreihen zusammenführen (Branch «live» + Direktabruf + bisher im Browser gesammelt) */
function mergeLake(...src){
  const o = {updated:null, st:{}};
  const lim = Date.now() - LAKE_KEEP_H*3600e3;
  LAKE.forEach(L=>{
    const m = {}; let err = null;
    src.forEach(x=>{ const d = x && x.st && x.st[L.id]; if(!d) return; (d.rows||[]).forEach(r=>{ if(new Date(r.t)>=lim) m[r.t] = r; }); if(d.err && !err) err = d.err; });
    const rows = Object.values(m).sort((a,b)=>a.t<b.t?-1:1);
    o.st[L.id] = rows.length ? {rows} : {rows, err};
  });
  src.forEach(x=>{ if(x && x.updated && (!o.updated || x.updated>o.updated)) o.updated = x.updated; });
  return o;
}
const lakeRows = (lk, id) => ((lk && lk.st && lk.st[id] && lk.st[id].rows) || []).map(r=>Object.assign({}, r, {t:new Date(r.t)}));
/* Messlage am See: letzter Wert frisch (< 40 min), die letzten (bis zu zwei) frischen Werte ≥ Schwelle in aktiver Richtung */
/* upSys: Windsystem, das die Upwind-Stationen gerade melden (nowcast().upSys). Am See wird der Joran umgelenkt
   (Teilung zwischen Vingelz und Alfermée), darum zählt dann jede Richtung am See als dieses System. */
function lakeNow(lk, St, now, upSys){
  const dOk = d => dirOn(d,St) || !!(upSys && St.dirs[upSys]);
  return LAKE.map(L=>{
    const rows = lakeRows(lk, L.id), last = rows[rows.length-1] || null;
    const fr = !!(last && ((now||new Date()) - last.t) < 40*60000);
    const k2 = rows.slice(-2).filter(r=>((now||new Date()) - r.t) < 40*60000);
    const ok = fr && k2.length>=1 && k2.every(r=>over(r.mean,St) && dOk(r.dir));   /* ein Wert, wenn nur der Direktabruf vorliegt */
    let since = null;
    if(ok){ let i = rows.length-1; while(i>0 && over(rows[i-1].mean,St) && dOk(rows[i-1].dir) && rows[i].t-rows[i-1].t < 40*60000) i--; since = rows[i].t; }
    const viaUp = ok && !k2.every(r=>dirOn(r.dir,St));
    return {L, rows, last, fresh:fr, ok, since, viaUp, err: lk && lk.st && lk.st[L.id] ? lk.st[L.id].err : null};
  });
}

/* Wahrheit aus der Seemessung (Archiv, eine Datei pro Tag): Ein Tag ist foilbar, wenn im Zeitfenster der Einstellungen
   an einer aktiven Seestation während mindestens minH Stunden jeder 10-min-Mittelwert (gerundet, wie angezeigt) ≥ T kn lag.
   Zusammenhängend heisst: höchstens ein fehlender Wert in Folge (Lücke ≤ 20 min) und mindestens 80 % der Werte vorhanden.
   «Ruhig» nur, wenn eine Station das Fenster zu mindestens 80 % abdeckt; sonst unbekannt.
   onset = erster Wert des ersten foilbaren Zeitraums (frühester über beide Stationen). */
const LAKE_COVER = 0.8;
function lakeDay(lk, day, St){
  St = St || DEF;
  const [h0,h1] = WINS[St.win], span = St.minH*3600e3, need = St.minH*6*LAKE_COVER;
  const inWin = t => { const m = localHour(t)*60 + t.getUTCMinutes(); return dayOfDate(t)===day && m>=h0*60 && m<=h1*60; };
  const out = {day, known:false, ev:false, onset:null, dir:null, st:{}};
  LAKE.forEach(L=>{
    if(!St.spots[L.id]) return;
    const rows = lakeRows(lk, L.id).filter(r=>r.mean!=null && inWin(r.t));
    const s = out.st[L.id] = {n:rows.length, cover:Math.min(1, rows.length/((h1-h0)*6)), max:null, ev:false, onset:null};
    if(s.cover>=LAKE_COVER) out.known = true;
    let a = -1;                                   /* Beginn der laufenden Folge von Werten ≥ T */
    rows.forEach((r,i)=>{
      if(s.max==null || r.mean>s.max) s.max = r.mean;
      if(!over(r.mean, St) || (a>=0 && r.t - rows[i-1].t > 20*60000)) a = over(r.mean, St) ? i : -1;
      else if(a<0) a = i;
      /* Dauer: jeder Wert steht für 10 min */
      if(!s.ev && a>=0 && r.t - rows[a].t + 10*60000 >= span && i-a+1 >= need){ s.ev = true; s.onset = rows[a].t; s.dir = rows[a].dir; }
    });
    if(s.ev){ out.ev = out.known = true; if(!out.onset || s.onset<out.onset){ out.onset = s.onset; out.dir = s.dir; } }
  });
  return out;
}
/* Seestationen: 10-min-Spitze bzw. -Mittel über den eigenen Grenzen */
function lakeStorm(lk, St, now){
  const out = [];
  lakeNow(lk, St, now).forEach(x=>{
    if(!x.fresh) return;
    const l = x.last, f = [];
    if(l.gust!=null && Math.round(l.gust)>=St.maxGust) f.push(`Böen ${Math.round(l.gust)} kn (Sturmgrenze ${St.maxGust} kn)`);
    if(Math.round(l.mean)>=St.maxMean) f.push(`Mittelwind ${Math.round(l.mean)} kn (Sturmgrenze ${St.maxMean} kn)`);
    if(f.length) out.push({up:{name:x.L.name}, f});
  });
  return out;
}

return {parseMeteobase, mergeLake, lakeRows, lakeNow, LAKE_COVER, lakeDay, lakeStorm};
});
