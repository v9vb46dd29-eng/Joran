/* Joran — Silo «kalibrierung». Parameter aus der Vergangenheit bestimmen: Faktor der Prognose (Rückblick), Schwelle
   je Station (Rückblick), Modell v2 aus der Seemessung (fitModel, nur eval/). Braucht die App im Betrieb nicht für
   Push und Bewertung.
   Hängt ab von: konstanten, helfer, modell, see, prognose, messung. Aufbau und Regeln: ARCHITEKTUR.md */
(function(root, make){
  const dep = n => typeof module!=="undefined" && module.exports ? require("./"+n+".js") : root.Joran[n];
  const api = make(dep);
  if(typeof module!=="undefined" && module.exports) module.exports = api; else (root.Joran = root.Joran || {}).kalibrierung = api;
})(typeof self!=="undefined" ? self : this, function(dep){
"use strict";
const {WINS, UPWIND} = dep("konstanten");
const {dirOf, localHour, dayOfDate} = dep("helfer");
const {MODEL, CAL} = dep("modell");
const {lakeDay} = dep("see");
const {hoeheDay, summarize} = dep("prognose");
const {stSecFn, inHrs, chaWest} = dep("messung");

function contingency(days, St, models, truth){
  const c = {tp:0, fn:0, fp:0, tn:0};
  days.forEach(d=>{
    const t = truth[d]; if(t!=="y" && t!=="n") return;
    const s = summarize(models, d, St); if(!s.n) return;
    const alarm = s.level>=St.cut;
    if(t==="y") alarm ? c.tp++ : c.fn++; else alarm ? c.fp++ : c.tn++;
  });
  c.ev = c.tp+c.fn; c.nev = c.fp+c.tn;
  c.pss = (c.ev && c.nev) ? c.tp/c.ev - c.fp/c.nev : null;
  return c;
}
const K_GRID = (()=>{ const a=[]; for(let k=0.8;k<=2.0001;k+=0.05) a.push(Math.round(k*100)/100); return a; })();
function plateauMid(rows){
  const max = Math.max(...rows.map(r=>r.c.pss==null?-9:r.c.pss));
  const pl = rows.filter(r=>r.c.pss!=null && Math.abs(r.c.pss-max)<1e-9);
  return pl.length ? Object.assign({max}, pl[Math.floor((pl.length-1)/2)]) : null;   /* Mitte des besten Bereichs = robuster */
}
function calibrate(days, St, models, truth){
  const base = contingency(days, St, models, truth);
  if(base.ev<3 || base.nev<3) return {base, best:null, perDir:{}};
  let best = null;
  for(const cut of [2,3]){
    const m = plateauMid(K_GRID.map(k=>({k, c:contingency(days, Object.assign({}, St, {k, cut, kDir:{}}), models, truth)})));
    if(m && (!best || m.max>best.c.pss+1e-9 || (Math.abs(m.max-best.c.pss)<1e-9 && cut>best.cut))) best = {k:m.k, cut, c:m.c};
  }
  /* Faktor je Windsystem, nur wo genug Tage vorhanden (≥ 3 Windtage und ≥ 3 ruhige Tage) */
  const perDir = {};
  if(best){
    const St0 = Object.assign({}, St, {k:best.k, cut:best.cut, kDir:{}});
    const groups = {};
    days.forEach(d=>{
      const t = truth[d]; if(t!=="y" && t!=="n") return;
      const s = summarize(models, d, St0); if(!s.n || !s.top) return;
      const g = dirOf(s.top.d); if(!g) return;
      (groups[g.id] || (groups[g.id]={days:[], ev:0, nev:0})).days.push(d);
      t==="y" ? groups[g.id].ev++ : groups[g.id].nev++;
    });
    Object.keys(groups).forEach(id=>{
      const g = groups[id]; if(g.ev<3 || g.nev<3) return;
      const m = plateauMid(K_GRID.map(k=>({k, c:contingency(g.days, Object.assign({}, St0, {kDir:{[id]:k}}), models, truth)})));
      const b0 = contingency(g.days, St0, models, truth);
      if(m && m.max>(b0.pss==null?-9:b0.pss)+0.05 && Math.abs(m.k-best.k)>=0.1) perDir[id] = {k:m.k, c:m.c, ev:g.ev, nev:g.nev};
    });
  }
  return {base, best, perDir};
}
/* Stationsschwelle kalibrieren: bester Stunden-Mittelwind im Stationssektor, Fenster −2 h bis Ende */
function stationDayMax(rows, up, St, cha){
  const [h0,h1] = WINS[St.win];
  const inSec = stSecFn(up, St); if(!inSec) return {};
  const chaAt = {};
  if(up.tl && cha) cha.forEach(r=>chaAt[r.t.getTime()] = r);
  const by = {};
  rows.forEach(r=>{
    if(!inSec(r)) return;
    const hr = localHour(r.t); if(hr<h0-2 || hr>h1 || !inHrs(up, r.t)) return;
    if(up.tl){ const c = chaAt[r.t.getTime()]; if(c && chaWest([c])) return; }
    const d = dayOfDate(r.t);
    if(!by[d] || r.mean>by[d]) by[d] = r.mean;
  });
  return by;
}
/* Taubenlöchler-Station: Windtage = «Ja» mit Markierung «TL», ruhige Tage = «Nein». Andere Windtage zählen nicht. */
const isEv = (up, truth, d) => truth[d]==="y" && (!up.tl || !!truth["tl:"+d]);
/* Recall-Regel, getrennt nach Windsystem: Ein «Ja»-Tag zählt für eine Station nur, wenn sein Windsystem zu ihr passt
   (TL → nur Courtelary; «sys:Tag» aus dem Archiv oder der Markierung → nur Stationen mit diesem System; ohne Angabe → alle).
   Rückgabe "ev", "nev" oder null (zählt für diese Station nicht). */
function evOf(up, truth, d){
  if(truth[d]==="n") return "nev";
  if(truth[d]!=="y") return null;
  const sys = truth["tl:"+d] ? "tl" : truth["sys:"+d] || null;
  if(up.tl) return sys==="tl" ? "ev" : null;
  if(sys==="tl" || (sys && !up.sys.includes(sys))) return null;
  return "ev";
}
function calibrateStation(rows, up, St, days, truth, cha, rule){
  rule = rule || CAL.rule;
  const mx = stationDayMax(rows, up, St, cha);
  const cls = rule==="recall" ? d=>evOf(up, truth, d) : d=>isEv(up, truth, d) ? "ev" : truth[d]==="n" ? "nev" : null;
  const marked = days.filter(d=>cls(d));
  const ev = marked.filter(d=>cls(d)==="ev").length, nev = marked.length-ev;
  if(ev<3 || nev<3) return {ev, nev, best:null, tl:!!up.tl, rule};
  const rowsC = [];
  for(let ts=4; ts<=30; ts++){
    const c = {tp:0,fn:0,fp:0,tn:0};
    marked.forEach(d=>{ const a = (mx[d]||0)>=ts-0.5; cls(d)==="ev" ? (a?c.tp++:c.fn++) : (a?c.fp++:c.tn++); });
    c.ev=ev; c.nev=nev; c.pss = c.tp/ev - c.fp/nev; c.rec = c.tp/ev; c.fpr = c.fp/nev;
    rowsC.push({k:ts, c});
  }
  const rd = v => Math.round(v*100)/100;
  if(rule==="recall"){
    const ok = rowsC.filter(r=>r.c.rec>=CAL.minRecall-1e-9);
    if(!ok.length){ const top = rowsC[0];   /* tiefste Schwelle zeigt, wie weit die Station vom Ziel entfernt ist */
      return {ev, nev, tl:!!up.tl, rule, best:{ts:null, rel:0, rec:rd(top.c.rec), fpr:rd(top.c.fpr), pss:rd(top.c.pss), c:top.c}}; }
    const hi = ok[ok.length-1];
    const m = ok.filter(r=>r.c.rec===hi.c.rec).sort((a,b)=>a.c.fpr-b.c.fpr || b.k-a.k)[0];
    return {ev, nev, tl:!!up.tl, rule, best:{ts:m.k, rel:1, rec:rd(m.c.rec), fpr:rd(m.c.fpr), pss:rd(m.c.pss), c:m.c}};
  }
  const m = plateauMid(rowsC);
  /* ohne erkennbaren Zusammenhang keine eigene Schwelle — Startwert bleibt, Station gilt als nicht verlässlich */
  return {ev, nev, tl:!!up.tl, rule, best: m ? {ts: m.c.pss>0.05 ? m.k : null, pss:rd(m.c.pss), rec:rd(m.c.rec), fpr:rd(m.c.fpr), c:m.c} : null};
}

/* Modell v2 bestimmen. data = {days:[JJJJ-MM-TT], lake:{Tag: Tagesdatei der Seemessung}, S:{abk: 10-min-Zeilen, t als Date}, St}.
   Je Station und Windsystem (das die Station misst) über alle Schwellen in tGrid gemeinsam:
   Ereignis = Abend, der am See foilbar war und an dem die Station in den 2 h vor Beginn mehrheitlich dieses System mass;
   Treffer = Stationssignal (30 min im Sektor, Mittel ≥ T × Faktor, nicht abnehmend) spätestens beim Beginn am See;
   Fehlalarm = Signal an einem ruhigen Abend. Gewählt wird der höchste Faktor mit Recall ≥ minRecall, davon bleibt als
   Sicherheit der Anteil margin (verpasste Abende wiegen schwerer). Weniger als minDays Ereignistage: kein Eintrag, der
   Startwert der Station gilt weiter. Eine Station, die bisher Push auslöst, bekommt
   höchstens ihren Startwert (nie eine höhere Schwelle). Erreicht kein Faktor den Recall, liegt er unter minF × Startwert oder liegt die
   Fehlalarmrate über maxFpr, ist der Faktor unbrauchbar: Eine Erweiterungsstation (extra) zählt dann nicht (rel 0). Eine
   Station, die bisher Push auslöst, wird nie stummgeschaltet; sie behält Startwert und Push (Eintrag ohne f und rel).
   Kopplung (H3) und Höhenwind (H4) werden aus denselben Tagen bestimmt (siehe MODEL); data.hoehe = Stundenwerte wie
   fetchHoehe. opt.fest = true übernimmt stattdessen die hinterlegten Werte. */
function fitModel(data, opt){
  const P = Object.assign({}, MODEL, opt||{}), St0 = data.St, [h0,h1] = WINS[St0.win], out = {};
  const dset = new Set(data.days), cha = data.S.cha || null;
  const KP = P.kopplung || null, kRef = KP ? UPWIND.find(x=>x.abk===KP.ref) : null, kRows = kRef ? data.S[kRef.abk] : null, kSteps = {};
  const lastLE = (rows, t) => { let lo = 0, hi = rows.length-1, k = -1; while(lo<=hi){ const m = (lo+hi)>>1; if(rows[m].t<=t){ k = m; lo = m+1; } else hi = m-1; } return k; };
  const tr = {};
  P.tGrid.forEach(T=>{ const St = Object.assign({}, St0, {T}); tr[T] = {};
    data.days.forEach(d=>{ if(!data.lake[d]) return; const a = lakeDay(data.lake[d], d, St); if(a.known) tr[T][d] = a; }); });
  UPWIND.forEach(up=>{
    const rows = data.S[up.abk]; if(!rows || !rows.length) return;
    const inSec = stSecFn(up, St0); if(!inSec) return;      /* Sektor wie upwindNow: nur aktive Windsysteme */
    const sid = r => up.tl ? (inSec(r) ? "tl" : null) : (inSec(r) ? dirOf(r.dir).id : null);
    const steps = {}, all = {};                       /* Tag → mögliche Signale {t, s, v} bzw. alle Werte {t, s} */
    rows.forEach((r,i)=>{
      const d = dayOfDate(r.t); if(!dset.has(d)) return;
      (all[d] || (all[d] = [])).push({t:r.t, s:sid(r)});
      if(i<2) return;
      const hr = localHour(r.t); if(hr<6 || hr>=21 || hr<h0-2 || hr>h1 || !inHrs(up, r.t)) return;   /* wie die Push-Prüfung */
      const a = [rows[i-2], rows[i-1], r];
      if(r.t-a[0].t > 25*60000 || !a.every(inSec) || a[2].mean < a[0].mean-0.5) return;
      if(up.tl && cha){ const k = lastLE(cha, r.t); if(k>=2 && r.t-cha[k].t < 50*60000 && chaWest(cha.slice(k-2, k+1))) return; }
      const q = {t:r.t, s:sid(r), v:Math.round((a[0].mean+a[1].mean+a[2].mean)/3)};
      /* Temperaturabnahme Bodenstation → Kammstation zu diesem Zeitpunkt, wie lapseRate */
      if(KP && KP.st.includes(up.abk) && kRows && up.alt>kRef.alt){ const k = lastLE(kRows, r.t);
        q.lp = k>=0 && r.t-kRows[k].t < 50*60000 && kRows[k].temp!=null && r.temp!=null ? (kRows[k].temp-r.temp)/((up.alt-kRef.alt)/1000) : null; }
      (steps[d] || (steps[d] = [])).push(q);
    });
    if(KP && KP.st.includes(up.abk)) kSteps[up.abk] = steps;
    const dom = (d, onset) => {                        /* System, das die Station in den 2 h vor Beginn mehrheitlich mass */
      const w = (all[d]||[]).filter(x=>x.t<=onset && x.t>=onset-2*3600e3); if(w.length<6) return null;
      const n = {}; w.forEach(x=>{ if(x.s) n[x.s] = (n[x.s]||0)+1; });
      const b = Object.keys(n).sort((x,y)=>n[y]-n[x])[0];
      return b && n[b]/w.length>=0.5 ? b : null;
    };
    (up.tl ? ["tl"] : up.sys.filter(id=>St0.dirs[id])).forEach(s=>{
      const E = [], N = [];
      P.tGrid.forEach(T=>Object.keys(tr[T]).forEach(d=>{ const a = tr[T][d]; if(!all[d]) return;
        /* Taubenlöchler: nur Abende, an denen es am See aus Nord oder Bise wehte */
        if(a.ev){ if(dom(d, a.onset)===s && (!up.tl || ["n","bise"].includes((dirOf(a.dir)||{}).id))) E.push({T, d, on:a.onset}); } else N.push({T, d}); }));
      const evDays = new Set(E.map(x=>x.d)).size;
      if(evDays<P.minDays || !N.length) return;
      const at = f => { const ts = T => Math.max(3, Math.round(T*f));
        const tp = E.filter(x=>(steps[x.d]||[]).some(q=>q.s===s && q.v>=ts(x.T) && q.t<=x.on)).length;
        const fp = N.filter(x=>(steps[x.d]||[]).some(q=>q.s===s && q.v>=ts(x.T))).length;
        return {rec:tp/E.length, fpr:fp/N.length}; };
      const rd = v => Math.round(v*100)/100;
      const ext = !!(up.extra || (up.extraSys && up.extraSys.includes(s)));
      let best = null;
      for(let k=60; k>=4 && best==null; k--){ const f = k/20; if(at(f).rec>=P.minRecall-1e-9) best = f; }
      const e = {f:null, rec:null, fpr:null, ev:E.length, days:evDays};
      /* Eine Station, die bisher Push auslöst, bekommt nie eine höhere Schwelle als ihren Startwert */
      if(best!=null){ const f = ext ? rd(best*P.margin) : Math.min(rd(best*P.margin), up.f), m = at(f); e.rec = rd(m.rec); e.fpr = rd(m.fpr);
        if(f>=P.minF*up.f-1e-9 && m.fpr<=P.maxFpr+1e-9){ e.f = f; e.rel = 1; } }
      if(e.f==null && ext) e.rel = 0;
      (out[up.abk] || (out[up.abk] = {}))[s] = e;
    });
  });
  let kopplung = P.kopplung, hoehe = P.hoehe;
  if(!P.fest){
    /* H3: Grenze so, dass kein rechtzeitiges Kammsignal eines foilbaren Abends verloren geht */
    if(KP){
      const lows = [], kd = new Set();
      Object.keys(kSteps).forEach(abk=>{ const up = UPWIND.find(x=>x.abk===abk), steps = kSteps[abk];
        const ts = (T, s) => { const e = out[abk] && s ? out[abk][s] : null; return e && e.f ? Math.max(3, Math.round(T*e.f)) : Math.round(T*up.f); };
        P.tGrid.forEach(T=>Object.keys(tr[T]).forEach(d=>{ const a = tr[T][d]; if(!a.ev) return;
          const hit = (steps[d]||[]).filter(q=>q.t<=a.onset && q.s && q.v>=ts(T, q.s)); if(!hit.length) return;
          kd.add(d); if(hit[0].lp==null) return;                  /* ohne Temperatur zählt das Signal ohnehin */
          lows.push(hit[0].lp); })); });
      const m = lows.length ? Math.floor(Math.min(KP.max!=null ? KP.max : Infinity, Math.min(...lows)*P.margin)*10)/10 : null;
      kopplung = kd.size>=(KP.minDays||1) && m!=null && m>0 ? Object.assign({}, KP, {min:m, days:kd.size}) : null;
    }
    /* H4: kleinstes Verhältnis Höhenwind zu Schwelle über alle foilbaren Abende */
    if(P.hoehe && data.hoehe){
      const rs = [], hdays = new Set(); let stabil = false;
      P.tGrid.filter(T=>T>=(P.hoehe.tMin||0)).forEach(T=>Object.keys(tr[T]).forEach(d=>{ if(!tr[T][d].ev) return;
        const hd = hoeheDay(data.hoehe, d, St0); if(!hd || hd.coupled==null) return;
        hdays.add(d); if(!hd.coupled) stabil = true; else rs.push(hd.v/T); }));
      const f = rs.length ? Math.floor(Math.min(...rs)*P.margin*20+1e-9)/20 : null;
      hoehe = !stabil && hdays.size>=(P.hoehe.minDays||1) && f>0 ? Object.assign({}, P.hoehe, {f, days:hdays.size}) : null;
    }
  }
  return {active:true, kopplung, hoehe, minRecall:P.minRecall, maxFpr:P.maxFpr, margin:P.margin, minF:P.minF, tGrid:P.tGrid, minDays:P.minDays,
    fitted:data.days.length ? [data.days[0], data.days[data.days.length-1]] : null, f:out};
}

return {contingency, calibrate, stationDayMax, isEv, evOf, calibrateStation, fitModel};
});
