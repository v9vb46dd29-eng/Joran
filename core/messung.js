/* Joran — Silo «messung». Live-Signal aus den Upwind-Stationen: Böenfront, Regel E (Joran), Upwind-Regel je
   Station, Verlässlichkeit, Kopplung der Luftschichten (H3), Gesamtlage (nowcast), Hinweise.
   Hängt ab von: konstanten, helfer, modell, see. Aufbau und Regeln: ARCHITEKTUR.md */
(function(root, make){
  const dep = n => typeof module!=="undefined" && module.exports ? require("./"+n+".js") : root.Joran[n];
  const api = make(dep);
  if(typeof module!=="undefined" && module.exports) module.exports = api; else (root.Joran = root.Joran || {}).messung = api;
})(typeof self!=="undefined" ? self : this, function(dep){
"use strict";
const {UPWIND, TL, LAKE_LEVEL, FRONT, REGEL_E, JTYP, DEF} = dep("konstanten");
const {r1, inArc, dirOf, localHour, dayOfDate} = dep("helfer");
const {modelOf, CAL} = dep("modell");
const {lakeStorm} = dep("see");

/* Nicht rausfahren nur bei Sturm: Messung über deinen Grenzen oder echte Böenfront (alle Merkmale zugleich) */
function frontCheck(rows, St){
  St = St || DEF;
  const fr = [];
  if(!rows || rows.length<3) return fr;
  const mm = St.maxMean||DEF.maxMean, mg = St.maxGust||DEF.maxGust;
  for(let i=Math.max(2,rows.length-3); i<rows.length; i++){
    const c=rows[i], pp=rows[i-2], p=rows[i-1];
    if(c.gust!=null && Math.round(c.gust)>mg) fr.push(`Böen ${Math.round(c.gust)} kn über deiner Grenze ${mg} kn`);
    if(c.mean!=null && Math.round(c.mean)>mm) fr.push(`Mittelwind ${Math.round(c.mean)} kn über deiner Grenze ${mm} kn`);
    const ref = [p,pp].filter(r=>r && r.temp!=null && r.mean!=null);
    if(c.temp!=null && ref.length){
      const warm = Math.max(...ref.map(r=>r.temp)), calm = Math.min(...ref.map(r=>r.mean));
      if(warm-c.temp>=FRONT.dT && c.mean-calm>=FRONT.jump && c.gust!=null && c.gust>=FRONT.gust)
        fr.push(`Böenfront: ${r1(warm-c.temp)} °C kälter, Wind +${Math.round(c.mean-calm)} kn in 20 min, Böen ${Math.round(c.gust)} kn`);
    }
  }
  return [...new Set(fr)];
}
function fresh(rows, now){ return rows && rows.length && ((now||new Date()) - rows[rows.length-1].t) < 50*60000; }

/* Regel E (Joran, Cressier) — retrospektiv an 1030 Abenden geprüft */
const inSectorE = d => d!=null && d>=REGEL_E.sector[0] && d<=REGEL_E.sector[1];
function ruleE(rows, St){
  const res = {ok:false, front:[], fail:[], last:null, since:null, mean30:null};
  if(!rows || rows.length<3){ res.fail.push("zu wenig Messwerte"); return res; }
  const last3 = rows.slice(-3);
  res.last = rows[rows.length-1];
  res.front = frontCheck(rows, St);
  const dirOK = last3.every(r=>inSectorE(r.dir));
  const lvlOK = last3.every(r=>r.mean>=REGEL_E.min);
  const riseOK = last3[2].mean >= last3[0].mean;
  res.mean30 = last3.reduce((a,r)=>a+r.mean,0)/3;
  if(!dirOK) res.fail.push("Richtung nicht durchgehend 270–350°");
  if(!lvlOK) res.fail.push("Mittelwind nicht durchgehend ≥ 10 kn");
  if(!riseOK) res.fail.push("Mittelwind nicht zunehmend");
  if(res.front.length) res.fail.push("Sturm oder Böenfront gemessen");
  res.ok = dirOK && lvlOK && riseOK && !res.front.length;
  if(dirOK && lvlOK){
    let i = rows.length-1;
    while(i>0 && inSectorE(rows[i-1].dir) && rows[i-1].mean>=REGEL_E.min) i--;
    res.since = rows[i].t;
  }
  return res;
}
function modelF(up, St, sysId){
  /* eigene Kalibrierung im Rückblick geht vor, auch wenn sie die Station als nicht verlässlich einstuft */
  const c = St.st && St.st[up.abk]; if(c && (c.ts || c.pss!=null || c.rel===0 || c.rel===1)) return null;
  const M = modelOf(St), e = M && M.f && M.f[up.abk] && sysId ? M.f[up.abk][sysId] : null;
  return e || null;
}
function stTs(up, St, sysId){
  const c = St.st && St.st[up.abk]; if(c && c.ts) return c.ts;
  const e = modelF(up, St, sysId);
  return e && e.f ? Math.max(3, Math.round(St.T*e.f)) : Math.round(St.T*up.f);
}
function stTrust(up, St){ const c = St.st && St.st[up.abk]; return c && c.pss!=null ? c.pss : null; }
/* Verlässlich nach Recall-Regel: 1 / 0, fehlt (undefined), solange die Station so nicht kalibriert ist */
function stRel(up, St){ const c = St.st && St.st[up.abk]; return c && (c.rel===0 || c.rel===1) ? c.rel : undefined; }
/* Richtung an der Station: eigener Sektor (z. B. Talachse) oder die Windsysteme, die sie ankündigt */
function stSecFn(up, St){
  const sys = up.sys.filter(id=>St.dirs[id]);
  if(!sys.length) return null;
  if(up.sec) return r => r.dir!=null && inArc(r.dir, up.sec[0], up.sec[1]);
  return r => { const x = dirOf(r.dir); return !!(x && sys.includes(x.id)); };
}
const inHrs = (up, t) => { if(!up.hrs) return true; const h = localHour(t); return h>=up.hrs[0] && h<=up.hrs[1]; };
/* Grossräumiger West/Südwest auf dem Chasseral (letzte 30 min bzw. diese Stunde) */
const chaWest = rows => !!(rows && rows.length && rows.every(r=>r.dir!=null && inArc(r.dir, TL.chaSec[0], TL.chaSec[1]))
  && rows.reduce((a,r)=>a+r.mean,0)/rows.length>=TL.chaMax);
/* Upwind-Regel je Station: 30 min im Sektor, Mittel ≥ Stationsschwelle, nicht abnehmend */
function upwindNow(rows, up, St, cha){
  const inSec = stSecFn(up, St);
  const res = {ok:false, off:!inSec, ts:stTs(up,St), trust:stTrust(up,St), rel:stRel(up,St), last:null, mean30:null, since:null, sys:null, block:null};
  if(res.off || !rows || rows.length<3) return res;
  const last3 = rows.slice(-3);
  res.last = rows[rows.length-1];
  res.mean30 = last3.reduce((a,r)=>a+r.mean,0)/3;
  res.sys = up.tl ? {id:"tl", name:"Talwind → Taubenlöchler"} : dirOf(res.last.dir);
  /* Modell v2: Schwelle und Verlässlichkeit nach dem Windsystem, das die Station gerade misst */
  const mf = modelF(up, St, res.sys && res.sys.id);
  if(mf){ res.ts = stTs(up, St, res.sys.id); res.mrel = mf.rel; }
  const dirOK = last3.every(inSec), lvlOK = Math.round(res.mean30)>=res.ts, riseOK = last3[2].mean >= last3[0].mean-0.5;
  if(!inHrs(up, res.last.t)) res.block = `nur ${up.hrs[0]}–${up.hrs[1]} Uhr`;
  else if(up.tl && cha && chaWest(cha.slice(-3))) res.block = "Westwind auf dem Chasseral";
  res.ok = dirOK && lvlOK && riseOK && !res.block;
  res.near = dirOK && !res.ok && !res.block && Math.round(res.mean30)>=res.ts-2;
  if(dirOK){
    let i = rows.length-1;
    while(i>0 && inSec(rows[i-1]) && rows[i-1].mean>=res.ts*0.85) i--;
    res.since = rows[i].t;
  }
  return res;
}
/* Station oder ihr gemeldetes Windsystem gilt als Erweiterung: zählt ungeprüft nicht */
const isExtra = s => !!(s.up.extra || (s.up.extraSys && s.u.sys && s.up.extraSys.includes(s.u.sys.id)));
/* Signal zählt für Push. Recall-Regel aktiv und Station so kalibriert → nur wenn verlässlich;
   sonst wie bisher Peirce ≥ 0.25 oder ungeprüft (nicht extra). rule: zum Messen einer nicht aktiven Regel. */
const isTrusted = (s, rule) => s.u.mrel!==undefined ? s.u.mrel===1
  : (rule||CAL.rule)==="recall" && s.u.rel!==undefined ? s.u.rel===1
  : (s.u.trust==null && !isExtra(s)) || (s.u.trust!=null && s.u.trust>=0.25);
/* Temperaturabnahme zwischen Bodenstation und Kammstation in K je km, aus den letzten frischen Werten; null, wenn etwas fehlt */
function lapseRate(stations, up, ref, now){
  if(!ref || !up) return null;
  const a = stations[ref.abk], b = stations[up.abk];
  if(!a || !b || a.err || b.err || !fresh(a.rows, now) || !fresh(b.rows, now) || !(up.alt>ref.alt)) return null;
  const ta = a.rows[a.rows.length-1].temp, tb = b.rows[b.rows.length-1].temp;
  return ta==null || tb==null ? null : (ta-tb)/((up.alt-ref.alt)/1000);
}
/* Messlage jetzt: alle Upwind-Signale plus Regel E plus Böenfront */
function nowcast(stations, St, now, lk){
  const sig = [], front = [];
  const MM = modelOf(St), KP = MM && MM.kopplung ? MM.kopplung : null;
  const ch = stations.cha && !stations.cha.err && fresh(stations.cha.rows, now) ? stations.cha.rows : null;
  UPWIND.forEach(up=>{
    const d = stations[up.abk]; if(!d || d.err || !fresh(d.rows, now)) return;
    const u = upwindNow(d.rows, up, St, ch);
    /* Modell v2, Kopplung: Signal aus der Höhe nur bei durchmischter Luft. Fehlt eine Temperatur, zählt das Signal. */
    if(u.ok && KP && KP.st.includes(up.abk)){
      const lp = lapseRate(stations, up, UPWIND.find(x=>x.abk===KP.ref), now);
      if(lp!=null){ u.lapse = lp; if(lp<KP.min){ u.ok = false; u.block = `stabile Schichtung (${r1(lp)} K je km)`; } }
    }
    if(u.ok) sig.push({up, u});
    if(LAKE_LEVEL.includes(up.abk)){ const f = frontCheck(d.rows, St); if(f.length) front.push({up, f}); }
  });
  const crm = stations.crm;
  const e = crm && !crm.err && fresh(crm.rows, now) ? ruleE(crm.rows, St) : null;
  const trusted = sig.filter(s=>isTrusted(s));
  if(lk) lakeStorm(lk, St).forEach(x=>front.push(x));     /* gegen die Uhr, wie bisher; now nur fürs Nachspielen */
  const eOk = !!(e && e.ok && St.dirs.joran);
  /* Windsystem nach den Upwind-Stationen: Joran, wenn Regel E oder eine verlässliche Joran-Station ihn gerade meldet */
  const joran = !!St.dirs.joran && (eOk || trusted.some(s=>s.u.sys && s.u.sys.id==="joran"));
  return {sig, trusted, e, eOk, front, upSys: joran ? "joran" : null};
}
/* Hinweis bei Joran-Lage: Fallböen teilen sich zwischen Vingelz und Alfermée, Vingelz liegt oft im Windschatten
   (Beobachtung Simon, Oktober 2026). lake = Ergebnis von lakeNow. */
function lageHint(nc, lake){
  const f = (lake||[]).filter(x=>x.fresh);
  const v = f.find(x=>x.L.id==="vin"), i = f.find(x=>x.L.id==="ips");
  const diff = v && i ? i.last.mean - v.last.mean : null;
  if(!(nc && nc.upSys==="joran") && !(diff!=null && diff>=4 && nc && nc.sig.some(s=>s.up.sys.includes("joran") && !(s.up.extraSys||[]).includes("joran")))) return "";
  let t = "Joran-Lage: Die Fallböen teilen sich oft zwischen Vingelz und Alfermée, Vingelz liegt dann im Windschatten. Draussen und Richtung Ipsach weht es meist stärker — vom Hafen Vingelz lohnt sich das Rausfahren auch, wenn Vingelz wenig zeigt.";
  if(diff!=null && diff>=4) t += ` Ipsach misst jetzt ${Math.round(diff)} kn mehr als Vingelz.`;
  return t;
}

/* Typ eines Joran-Tages aus Messwerten (Hinweis, nicht kalibriert). onset = Beginn am See, S = {abk: Zeilen mit t als Date}.
   «dyn» (Joran dynamique, Kaltfront): in den 6 h davor West/Südwest in Neuchâtel (≥ JTYP.sw kn, mind. 3 Werte) und dazu
     Druckanstieg in Neuchâtel ≥ JTYP.dp hPa oder Temperatursturz ≥ JTYP.dT °C in Cressier/Neuchâtel um den Beginn.
   «stat» (Joran statique, thermisch oder Gewitter): sonst, wenn der Tag zwischen Mai und August liegt.
   null: unbestimmt. */
function joranType(onset, S){
  if(!onset) return null;
  const t0 = +onset, H = 3600e3;
  const win = (a,b,rows) => (rows||[]).filter(r=>r.t>=t0+a && r.t<=t0+b);
  const neu = S.neu && S.neu.t, crm = S.crm && S.crm.t;
  const sw = win(-6*H, -H, neu).filter(r=>r.dir!=null && inArc(r.dir, JTYP.swSec[0], JTYP.swSec[1]) && r.mean>=JTYP.sw).length>=3;
  const val = (rows, k) => rows.map(r=>r[k]).filter(v=>v!=null);
  const qa = val(win(-3*H, -H, neu), "qff"), qb = val(win(-H, H, neu), "qff");
  const pRise = qa.length && qb.length ? Math.max(...qb) - Math.min(...qa) : null;
  const drop = rows => { const a = val(win(-2*H, -H/2, rows), "temp"), b = val(win(0, 1.5*H, rows), "temp");
    return a.length && b.length ? Math.max(...a) - Math.min(...b) : null; };
  const dT = Math.max(drop(crm) ?? -99, drop(neu) ?? -99);
  if(sw && ((pRise!=null && pRise>=JTYP.dp) || dT>=JTYP.dT)) return "dyn";
  const m = +dayOfDate(onset).slice(5,7);
  return m>=JTYP.months[0] && m<=JTYP.months[1] ? "stat" : null;
}

return {frontCheck, fresh, ruleE, stTs, stTrust, stRel, stSecFn, inHrs, chaWest, upwindNow, isExtra, isTrusted,
  lapseRate, nowcast, lageHint, joranType};
});
