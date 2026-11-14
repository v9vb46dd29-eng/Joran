/* Joran — Silo «prognose». Modellprognose auswerten: Stunden und Tage je Modell, Stufe über alle Modelle, Ensemble,
   Joran-Zutaten, Höhenwind (H4), Text der Prognose-Nachricht.
   Hängt ab von: konstanten, helfer, modell. Aufbau und Regeln: ARCHITEKTUR.md */
(function(root, make){
  const dep = n => typeof module!=="undefined" && module.exports ? require("./"+n+".js") : root.Joran[n];
  const api = make(dep);
  if(typeof module!=="undefined" && module.exports) module.exports = api; else (root.Joran = root.Joran || {}).prognose = api;
})(typeof self!=="undefined" ? self : this, function(dep){
"use strict";
const {MODELS, WINS, JORAN_X} = dep("konstanten");
const {r0, card, dirOf, dirOn, over, kFor, spotName} = dep("helfer");
const {HOEHE, modelOf, LAGE} = dep("modell");

/* Höhenlage eines Tages: Mittel von 2 h vor dem Zeitfenster bis zu dessen Ende. lapse = Temperaturabnahme 2 m → 850 hPa in
   K je km; gekoppelt = durchmischte Luft, der Höhenwind kann bis auf den See. H = Stundenwerte wie daten.fetchHoehe. */
function hoeheDay(H, day, St){
  if(!H || !H.time || !H.wind_speed_850hPa) return null;
  const WD = H.wind_direction_850hPa || [], T2 = H.temperature_2m || [], T8 = H.temperature_850hPa || [];
  const [h0,h1] = WINS[St.win], ix = [];
  H.time.forEach((t,i)=>{ const hr = +t.slice(11,13); if(t.slice(0,10)===day && hr>=h0-2 && hr<h1 && H.wind_speed_850hPa[i]!=null) ix.push(i); });
  if(ix.length<3) return null;
  const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
  let x = 0, y = 0, nd = 0; ix.forEach(i=>{ const d = WD[i]; if(d!=null){ nd++; x += Math.cos(d*Math.PI/180); y += Math.sin(d*Math.PI/180); } });
  const lp = ix.filter(i=>T2[i]!=null && T8[i]!=null).map(i=>(T2[i]-T8[i])/HOEHE.dz);
  const lapse = lp.length ? avg(lp) : null;
  return {v:avg(ix.map(i=>H.wind_speed_850hPa[i])), d:nd ? (Math.atan2(y,x)*180/Math.PI+360)%360 : null, lapse, coupled:lapse==null ? null : lapse>=HOEHE.lapseMin};
}
/* H4 (vorläufig, nicht aktiv): Die Prognose zählt nur, wenn der Höhenwind bei durchmischter Luft mindestens f × T erreicht.
   Fehlen die Höhendaten, zählt die Prognose wie bisher. */
function hoeheOk(hd, St){
  const M = modelOf(St), P = M && M.hoehe;
  if(!P || !hd || hd.coupled==null) return true;
  return hd.coupled && hd.v>=P.f*St.T;
}

/* Ein Modell (oder Ensemble-Mitglied), ein Tag: stärkster aktiver Spot pro Stunde */
function evalHours(spots, day, St, h0, h1){
  const hours = []; let any = false, capeMax = 0;
  for(let hr=h0; hr<=h1; hr++){
    const key = day+"T"+String(hr).padStart(2,"0")+":00";
    let best = null, raw = null;
    for(const sp of spots){
      if(!St.spots[sp.id]) continue;
      const i = sp.idx[key]; if(i==null) continue;
      const v = sp.h.ws[i]; if(v==null) continue;
      any = true;
      const d = sp.h.wd[i], g = sp.h.wg ? sp.h.wg[i] : null;
      if(sp.h.cape && sp.h.cape[i]!=null && sp.h.cape[i]>capeMax) capeMax = sp.h.cape[i];
      const vk = v*kFor(d,St)*((St.spotF && St.spotF[sp.id]) || 1);
      if(!raw || vk>raw.v) raw = {v:vk, d};
      if(dirOn(d,St) && (!best || vk>best.v)) best = {v:vk, d, g, spot:sp.id};
    }
    hours.push({hr, best, raw});
  }
  return any ? {hours, capeMax} : null;
}
/* ab (optional): erste Stunde, die zählt. Für heute ab Fensterbeginn die laufende Stunde (Restprognose, nur Anzeige). */
function evalDay(spots, day, St, ab){
  const [w0,h1] = WINS[St.win], h0 = ab!=null ? Math.max(w0, ab) : w0;
  const r = evalHours(spots, day, St, h0, h1);
  if(!r) return null;
  let run = 0, maxRun = 0, top = null;
  const overH = [];
  r.hours.forEach(x=>{
    if(x.best && over(x.best.v,St)){ run++; overH.push(x.hr); if(run>maxRun) maxRun = run; } else run = 0;
    if(x.best && (!top || x.best.v>top.v)) top = Object.assign({hr:x.hr}, x.best);
  });
  return {top, run:maxRun, nOver:overH.length, overH, hit:maxRun>=St.minH, capeMax:r.capeMax};
}
function levelOf(hits, n, top, St){
  if(!n) return -1;
  const f = hits/n;
  if(hits>=2 && f>=0.75) return 4;
  if(f>=0.5) return 3;
  if(hits>=1) return 2;
  if(top && Math.round(top.v)>=St.T-3) return 1;
  return 0;
}
/* Zeitfenster «wann»: Stunden, in denen mindestens die Hälfte der Modelle (sonst mindestens eines) die Schwelle erreicht */
function windWindow(ok, St){
  const cnt = {};
  ok.forEach(x=>x.e.overH.forEach(h=>cnt[h]=(cnt[h]||0)+1));
  const hrs = Object.keys(cnt).map(Number).sort((a,b)=>a-b);
  if(!hrs.length) return null;
  const need = Math.max(1, Math.ceil(ok.length/2));
  const cons = hrs.filter(h=>cnt[h]>=need);
  const use = cons.length ? cons : hrs;
  return {from:use[0], to:use[use.length-1]+1, consensus:cons.length>0};
}
/* Lage des Tages aus der Kammprognose: Vektormittel der Richtung von 2 h vor dem Zeitfenster bis zu dessen Ende, nur
   Stunden ab L.minKn. Keine Lage bei streuender Richtung (Vektorlänge < L.rMin) oder nahe einer Sektorgrenze (L.band).
   kamm = {"JJJJ-MM-TTTHH:00": {cv, cd}} wie daten.fetchJura. Rückgabe "nord", "bise" oder null. */
function lageTag(kamm, day, St, L){
  L = L || LAGE;
  if(!kamm) return null;
  const [h0,h1] = WINS[St.win];
  let x = 0, y = 0, n = 0;
  for(let hr=Math.max(0,h0-2); hr<=h1; hr++){
    const k = kamm[day+"T"+String(hr).padStart(2,"0")+":00"];
    if(!k || k.cv==null || k.cd==null || k.cv<L.minKn) continue;
    x += Math.cos(k.cd*Math.PI/180); y += Math.sin(k.cd*Math.PI/180); n++;
  }
  if(n<L.minStd || Math.hypot(x,y)/n<(L.rMin||0)) return null;
  const d = (Math.atan2(y,x)*180/Math.PI+360)%360, ab = g => Math.abs(((d-g)%360+540)%360-180);
  if(L.band && Object.values(L.sek).some(([a,b])=>ab(a)<L.band || ab(b)<L.band)) return null;
  for(const id of Object.keys(L.sek)){ const [a,b] = L.sek[id]; if(a<=b ? d>=a && d<b : d>=a || d<b) return id; }
  return null;
}
/* Stufe über alle Modelle. kamm (optional): Kammprognose für den Lage-Faktor. opt.lage: Parameter wie LAGE, die auch
   bei LAGE.active = false gelten (zum Messen); opt.lage = null schaltet ihn ab. opt.ab: erste Stunde, die zählt
   (Restprognose für heute, nur Anzeige; Push, Rückblick und Messung rechnen ohne). */
function summarize(modelSpots, day, St, kamm, opt){
  const L = opt && opt.lage!==undefined ? opt.lage : (LAGE.active ? LAGE : null);
  const lage = L && kamm ? lageTag(kamm, day, St, L) : null;
  if(lage && L.f[lage]) St = Object.assign({}, St, {spotF:L.f[lage]});
  const ab = opt ? opt.ab : undefined;
  const per = MODELS.map(m=>({m, e: modelSpots[m.id] ? evalDay(modelSpots[m.id], day, St, ab) : null}));
  const ok = per.filter(x=>x.e);
  const hits = ok.filter(x=>x.e.hit).length;
  let top = null, topM = null;
  ok.forEach(x=>{ if(x.e.top && (!top || x.e.top.v>top.v)){ top = x.e.top; topM = x.m; } });
  const res = {per, ok, n:ok.length, hits, top, topM, level:levelOf(hits, ok.length, top, St), win:windWindow(ok, St)};
  if(lage) res.lage = lage;
  return res;
}
const clsOf = (lv, St) => lv<0 ? 0 : lv>=St.cut ? (lv>=4?4:3) : lv>=2 ? 2 : lv===1 ? 1 : 0;
function ensShare(ens, day, St, ab){
  if(!ens) return null;
  let n = 0, hit = 0;
  ens.members.forEach(sp=>{ const e = evalDay(sp, day, St, ab); if(e){ n++; if(e.hit) hit++; } });
  return n ? {n, hit} : null;
}

/* Joran-Zutaten für einen Tag (ab 14 Uhr bis Fensterende): NW-Strömung auf Kammhöhe,
   steigendes Druckgefälle Jura → See, Gewitterneigung. Reiner Hinweis, verändert die Stufe nicht. */
function joranCheck(J, day, St, capeMax){
  if(!J) return null;
  const h1 = WINS[St.win][1], h0 = Math.max(14, WINS[St.win][0]);
  const at = hr => J[day+"T"+String(hr).padStart(2,"0")+":00"];
  let crest = null, dpMax = null, dpHr = null, bn = null, bnHr = null;
  /* Front-Joran kann schon tagsüber kommen: Besançon − Neuchâtel ab 2 h vor dem Zeitfenster */
  for(let hr=Math.max(0, WINS[St.win][0]-2); hr<=h1; hr++){
    const x = at(hr); if(x && x.bn!=null && (bn==null || x.bn>bn)){ bn = x.bn; bnHr = hr; }
  }
  for(let hr=h0; hr<=h1; hr++){
    const x = at(hr); if(!x) continue;
    if(x.cv!=null && x.cd!=null && x.cd>=JORAN_X.crestSector[0] && x.cd<=JORAN_X.crestSector[1] && (!crest || x.cv>crest.v)) crest = {v:x.cv, d:x.cd, hr};
    if(x.dp!=null && (dpMax==null || x.dp>dpMax)){ dpMax = x.dp; dpHr = hr; }
  }
  const noon = at(12), dp12 = noon && noon.dp!=null ? noon.dp : null;
  if(dpMax==null && !crest && bn==null) return null;
  const rise = dpMax!=null && dp12!=null ? dpMax-dp12 : null;
  const c = {crest, dpMax, dpHr, rise, bn, bnHr,
    crestOk: !!(crest && crest.v>=JORAN_X.crest), dpOk: rise!=null && rise>=JORAN_X.dpRise, storm: (capeMax||0)>=JORAN_X.cape,
    bnOk: bn!=null && bn>=JORAN_X.bn};
  c.n = (c.crestOk?1:0) + (c.dpOk?1:0);
  return c;
}

/* Text der Prognose-Nachricht (Push und App) */
function describe(s, St){
  if(!s.top) return "";
  const dn = dirOf(s.top.d);
  const w = s.win ? `${s.win.from}–${s.win.to} Uhr` : `gegen ${s.top.hr} Uhr`;
  return `${r0(s.top.v)} kn ${dn?dn.name:card(s.top.d)}, ${w}, bester Spot ${spotName(s.top.spot)} (${s.hits} von ${s.n} Modellen ≥ ${St.T} kn)`;
}

return {hoeheDay, hoeheOk, lageTag, evalHours, evalDay, levelOf, windWindow, summarize, clsOf, ensShare, joranCheck,
  describe};
});
