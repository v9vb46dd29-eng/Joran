/* Joran — Oberfläche «live». Startseite: «Wind kommt?» und die nächsten 4 Tage, je kurz. Blatt «Erklärungen»: Tagesauswahl, Urteil mit Begründung, Diagramm, Warnungen, Messung gegen Modell, Joran-Zutaten, Höhenwind, Modelle im Detail, Upwind-Stationen, Quellen und Diagnose.
   Klassisches Skript: teilt sich die Namen mit den anderen Dateien unter app/. Reihenfolge in index.html:
   basis, see, live, einstellungen, push, rueckblick, windbild, start. Aufbau und Regeln: ARCHITEKTUR.md */
"use strict";
/* Startseite: «Wind kommt?» (heute, nach dem Zeitfenster morgen) und die nächsten 4 Tage, je kurz.
   Alles Ausführliche steht im Blatt «Erklärungen» (#detail). */
function renderLive(){
  const hour = localHourNow(), ab = restAb(hour);
  const days = [0,1,2,3].map(k=>({k, day:localDay(k)}));
  days.forEach(x=>{
    const r = x.k===0 ? ab : undefined;
    x.s = summarize(D.models, x.day, S, D.jura, {ab:r});
    x.ens = x.k<=1 ? ensShare(D.ens, x.day, S, r) : null;
    /* Restprognose: dazu die Prognose fürs ganze Zeitfenster, für den Satz «Erwartet war …» */
    if(r!=null){ x.ab = r; x.full = summarize(D.models, x.day, S, D.jura); }
  });
  const k0 = hour>WINS[S.win][1] ? 1 : 0;
  if(SEL==null) SEL = k0;
  const nc = C.nowcast(D.stations, S, undefined, LK);
  nc.lake = C.lakeNow(LK, S, undefined, nc.upSys).filter(x=>S.spots[x.L.id]);
  nc.hint = C.lageHint(nc, nc.lake);
  $("#now").innerHTML = nowHTML(days[k0], hour, nc);
  $("#days").innerHTML = days.map(dayRow).join("");
  renderDetail(days, hour, nc);
  wbUpdate();
}

/* Eine Zeile Prognose: Zeit · Stärke Richtung · Modelle */
function progLine(s){
  if(s.level<0) return "Keine Modelldaten für diesen Tag.";
  if(!s.top) return "Kein Modell zeigt Wind aus deinen Richtungen.";
  return [s.win ? winTxt(s.win) : `stärkster um ${s.top.hr} Uhr`, `${r0(s.top.v)} kn ${card(s.top.d)}`, `${s.hits}/${s.n} Modell${s.n>1?"e":""}`].join(" · ");
}
/* Eine Zeile Upwind: nur die Stationen, die ein Signal geben */
function sigLine(nc, live, h0, k){
  if(!live) return `Upwind-Signale ${k===1?"morgen ":""}ab ${h0-2} Uhr`;
  const a = [];
  if(nc.eOk) a.push(`Cressier ${r0(nc.e.mean30)} kn Joran${nc.e.since?" seit "+hhmm(nc.e.since):""}`);
  nc.trusted.forEach(x=>{ if(nc.eOk && x.up.abk==="crm") return;
    a.push(`${x.up.name} ${r0(x.u.mean30)} kn${x.u.sys?" "+x.u.sys.name:""}${x.u.since?" seit "+hhmm(x.u.since):""}`); });
  if(a.length) return `Signal: ${a.slice(0,2).join(", ")}${a.length>2?` (+${a.length-2})`:""}`;
  const weak = nc.sig.filter(x=>!nc.trusted.includes(x));
  if(weak.length) return `Ungeprüftes Signal: ${weak.slice(0,2).map(x=>x.up.name).join(", ")}`;
  return "Kein Upwind-Signal";
}
/* Restprognose für heute: Ab Fensterbeginn zählen nur die Stunden ab der laufenden (v33). Vorher und nach dem Fenster
   das ganze Fenster. Nur Anzeige: Push, Rückblick und Messung rechnen das ganze Fenster. */
const restAb = hour => { const [w0,w1] = WINS[S.win]; return hour>=w0 && hour<=w1 ? hour : undefined; };
/* Höchster Mittelwind am See heute zwischen from und to Uhr (aktive Spots), sonst null */
function seeMax(day, from, to){
  let m = null;
  C.lakeNow(LK, S).filter(x=>S.spots[x.L.id]).forEach(x=>x.rows.forEach(r=>{
    if(r.mean==null || C.dayOfDate(r.t)!==day) return;
    const h = C.localHour(r.t); if(h>=from && h<to && (m==null || r.mean>m)) m = r.mean; }));
  return m;
}
/* Ist das Prognosefenster von heute vorbei und die Stufe für den Rest tiefer: «Erwartet war 9–11 Uhr bis 12 kn, gemessen
   höchstens 8 kn.» Sonst "". */
function vorbeiTxt(x, hour){
  const f = x.full;
  if(!f || !f.win || !f.top || f.win.to>hour || x.s.level>=f.level) return "";
  const m = seeMax(x.day, f.win.from, f.win.to);
  return `Erwartet war ${winTxt(f.win)} bis ${r0(f.top.v)} kn${m!=null ? `, gemessen höchstens ${r0(m)} kn` : ""}.`;
}
/* «Noch kein Wind»: Die Modelle erwarten Wind spätestens in der nächsten Stunde (ab C.NKW_AB, «möglich»), das Fenster
   läuft noch, am See ist es ruhig, kein Upwind-Signal. Nur Anzeige, Stufe und Push bleiben. Gibt die frischen Seewerte
   zurück, sonst null. */
function nochKein(s, hour, live, nc){
  if(!live || s.level<C.NKW_AB || !s.win || hour<s.win.from-1 || hour>=s.win.to) return null;
  return C.nochKeinWind(nc, nc.lake, S);
}
const levelWord = lv => lv<0 ? "Keine Daten" : LEVELS[lv].charAt(0).toUpperCase()+LEVELS[lv].slice(1);
function nowHTML(cur, hour, nc){
  const s = cur.s, today = cur.k===0, [h0,h1] = WINS[S.win];
  const live = today && hour>=h0-2 && hour<=h1;
  let cls = "c"+clsOf(s.level,S), word = levelWord(s.level), l1 = progLine(s), l2 = sigLine(nc, live, h0, cur.k);
  if(live && nc.front.length){
    cls = "danger"; word = "Nicht rausfahren";
    l1 = "Sturm: " + nc.front.map(x=>x.up.name+" "+x.f.join(", ")).join("; ");
    l2 = `Sturmgrenze: ${S.maxMean} kn Mittel oder ${S.maxGust} kn Böen`;
  } else {
    const lakeOk = live ? nc.lake.filter(x=>x.ok) : [];
    if(lakeOk.length){
      cls = "c4"; word = "Jetzt foilbar";
      l2 = l1;
      l1 = lakeOk.map(x=>`${x.L.name} ${r0(x.last.mean)} kn ${card(x.last.dir)} seit ${hhmm(x.since)}`).join(", ");
    } else if(live && (nc.eOk || nc.trusted.length)){
      const strong = nc.eOk || nc.trusted.some(x=>x.u.trust!=null || x.u.rel===1);
      cls = strong ? "c4" : "c3";
      word = "Wind kommt";
    } else {
      const ruhig = nochKein(s, hour, live, nc), vt = vorbeiTxt(cur, hour);
      if(ruhig){
        cls = "c0"; word = "Noch kein Wind";
        l2 = "Modelle: " + l1;
        l1 = `${ruhig.map(x=>`${x.L.name} ${r0(x.last.mean)} kn`).join(", ")} · kein Upwind-Signal`;
      } else if(vt) l2 = vt;
    }
  }
  return `<div class="verdict ${cls}"><div class="vtop"><span class="when">${today?"Heute":"Morgen"} · ${esc(WINS[S.win][2])}</span>
      <button class="thrchip" data-open="sheet">${S.T} kn ›</button><button class="thrchip" data-info="${cur.k}">Details ›</button></div>
    <span class="word">${esc(word)}</span><div class="why">${esc(l1)}</div><div class="why">${esc(l2)}</div></div>`;
}
/* Ein Tag in der Liste: Stufe, darunter die Begründung in einer Zeile */
function dayRow(x){
  const s = x.s, c = clsOf(s.level, S), w = warnings(x).map(t=>t.short).filter(Boolean);
  const line = progLine(s) + (w.length ? " · " + w.join(", ") : "");
  return `<button class="drow c${c}" data-info="${x.k}"><b>${esc(shortDay(x.k,x.day))}</b>
    <span class="dtx"><span class="dlv">${esc(levelWord(s.level))}</span><span class="dl">${esc(line)}</span></span></button>`;
}

/* Blatt «Erklärungen»: gewählter Tag ausführlich, Modelle, Upwind-Stationen, Quellen */
function renderDetail(days, hour, nc){
  const cur = days[SEL] || days[0];
  let h = `<div class="days" role="tablist">`;
  days.forEach(x=>{
    const c = clsOf(x.s.level, S);
    h += `<button class="dbtn c${c}${x.k===SEL?" sel":""}" role="tab" aria-selected="${x.k===SEL}" data-k="${x.k}">
      <b>${esc(shortDay(x.k,x.day))}</b><span class="kn">${x.s.top?r0(x.s.top.v):"–"}<small> kn</small></span>
      <span class="lv">${x.s.level<0?"keine Daten":["unwahrsch.","knapp","möglich","wahrsch.","sehr wahrsch."][x.s.level]}</span>
      <span class="tm">${x.s.win?esc(winTxt(x.s.win)):"&nbsp;"}</span></button>`;
  });
  h += `</div>`;
  h += verdictHTML(cur, hour, nc);
  const jc = S.dirs.joran && D.jura ? C.joranCheck(D.jura, cur.day, S, Math.max(0, ...cur.s.ok.map(x=>x.e.capeMax||0))) : null;
  const warn = warnings(cur);
  if(warn.length) h += `<div class="note bad"><b>Was die Lage kippen kann</b><ul>${warn.map(w=>`<li>${esc(w.text)}</li>`).join("")}</ul></div>`;

  h += `<h2>${esc(dayLabel(cur.day,{weekday:"long",day:"numeric",month:"long"}))} im Modell</h2>`;
  h += chartHTML(cur.day);
  h += `<small class="cap">Balken: Modellwind am besten Spot, Strich: schwächstes bis stärkstes Modell. Blau reicht, Grün ist knapp (bis 3 kn darunter), Grau zu wenig. Gestrichelt: abgewählte Richtung. ${cur.k===0?"Punkte: am See gemessen. ":""}Hell hinterlegt: dein Zeitfenster.</small>`;
  if(cur.k===0){ const ab = abgleich(cur.day); if(ab) h += ab; }
  if(jc) h += joranHTML(jc, cur, nc);
  h += hoeheHTML(cur);

  h += `<details class="sub"><summary>Modelle im Detail <span class="dim">${cur.s.hits} von ${cur.s.n} treffen</span></summary>${modelTable(cur)}</details>`;
  const nSig = nc.sig.length;
  h += `<details class="sub"><summary>Upwind-Stationen <span class="dim">${nSig?nSig+" Signal"+(nSig>1?"e":""):"kein Signal"}</span></summary>
    <p style="font-size:.82rem;margin-top:6px">Diese Stationen zeigen den Wind oft 30 bis 90 Minuten, bevor er am See ankommt. Am Ende zählt die Messung am See.</p>${stationsHTML(nc)}</details>`;

  h += `<details class="sub"><summary>Quellen und Diagnose</summary><div class="chips">`;
  MODELS.forEach(m=>{ const d = D.err[m.id]; h += `<span class="chip ${d?"fail":"ok"}">${m.name}${d?": "+esc(d):""}</span>`; });
  h += `<span class="chip ${D.ens?"ok":"fail"}">Ensemble${D.ens?" ("+D.ens.members.length+" Läufe)":": "+esc(D.err.ens||"fehlt")}</span>`;
  C.LAKE.forEach(L=>{ const ok = LK && LK.st[L.id] && LK.st[L.id].rows.length; h += `<span class="chip ${ok?"ok":"fail"}">${L.name}${ok?"":": nicht abrufbar"}</span>`; });
  UPWIND.forEach(s=>{ const d = D.stations[s.abk]; h += `<span class="chip ${d&&!d.err?"ok":"fail"}">${s.name}${d&&d.err?": "+esc(d.err):""}</span>`; });
  h += `<span class="chip ${D.jura?"ok":"fail"}">Joran-Zutaten</span><span class="chip ${D.hoehe?"ok":"fail"}">Höhenwind</span></div>`;
  h += `<div class="chips" style="margin-top:10px">
    <a class="chip" href="https://www.windguru.cz/56996" target="_blank" rel="noopener">Windguru</a>
    <a class="chip" href="https://www.meteoschweiz.admin.ch/service-und-publikationen/applikationen/niederschlag.html" target="_blank" rel="noopener">Radar</a></div>`;
  h += diagHTML() + `</details>`;

  const el = $("#detail"), open = [...el.querySelectorAll("details.sub")].map(d=>d.open);
  el.innerHTML = h;
  /* aufgeklappte Teile bleiben beim Auffrischen offen */
  el.querySelectorAll("details.sub").forEach((d,i)=>{ if(open[i]) d.open = true; });
  el.querySelectorAll(".dbtn").forEach(b=>b.addEventListener("click",()=>{ SEL = +b.dataset.k; renderDetail(days, hour, nc); }));
}

const thrChip = () => `<button class="thrchip" data-open="sheet">Schwelle ${S.T} kn · ${esc(WINS[S.win][2])} ›</button>`;
function verdictHTML(cur, hour, nc){
  const s = cur.s, today = cur.k===0;
  const [h0,h1] = WINS[S.win];
  const live = today && hour>=h0-2 && hour<=h1;

  if(live && nc.front.length){
    return `<div class="verdict danger"><span class="word">Nicht rausfahren</span>
      <div class="why">Sturm gemessen: ${esc(nc.front.map(x=>x.up.name+": "+x.f.join(", ")).join("; "))}.</div>
      <div class="basis">Messung ab der Sturmgrenze (${S.maxMean} kn Mittel oder ${S.maxGust} kn Böen). Geht der Prognose vor.</div>${thrChip()}</div>`;
  }
  if(s.level<0) return `<div class="verdict"><span class="word">Keine Daten</span><div class="why">Kein Modell liefert Werte für diesen Tag und dieses Zeitfenster.</div></div>`;

  let cls = "c"+clsOf(s.level,S), word = LEVELS[s.level].charAt(0).toUpperCase()+LEVELS[s.level].slice(1), why = "", basis;
  if(s.top){
    const dn = dirOf(s.top.d);
    why = s.win ? `Ab ${S.T} kn von ${winTxt(s.win)}${s.win.consensus?"":" (nur einzelne Modelle)"}. ` : "";
    if(s.level===1) why += `Kein Modell hält ${S.T} kn lange genug, das stärkste liegt höchstens 3 kn darunter. `;
    why += `${s.hits} von ${s.n} Modellen treffen. Stärkstes: ${r0(s.top.v)} kn ${dn?dn.name:card(s.top.d)} in ${spotName(s.top.spot)} um ${s.top.hr} Uhr (${s.topM.name}).`;
  } else why = "Kein Modell zeigt Wind aus deinen Richtungen.";
  if(cur.ens) why += ` Ensemble: ${cur.ens.hit} von ${cur.ens.n} Läufen erreichen die Schwelle.`;
  if(s.n===1) why += " Nur ein Modell reicht so weit, die Aussage ist unsicher.";
  basis = cur.ab!=null ? `Prognose für den Rest des Tages (ab ${cur.ab} Uhr), ${WINS[S.win][2]}` : `Prognose, ${WINS[S.win][2]}`;
  const vt = vorbeiTxt(cur, hour);
  if(vt) why = vt + " " + why;

  const lakeOk = live ? nc.lake.filter(x=>x.ok) : [];
  if(lakeOk.length){
    return `<div class="verdict c4"><span class="word">Jetzt foilbar</span>
      <div class="why">${esc("Gemessen am See: " + lakeOk.map(x=>`${x.L.name} ${r0(x.last.mean)} kn ${x.viaUp?"Joran (am See umgelenkt, "+card(x.last.dir)+")":dirOf(x.last.dir)?dirOf(x.last.dir).name:card(x.last.dir)}, Böen ${r0(x.last.gust)} kn, seit ${hhmm(x.since)}`).join("; ") + ". " + why + (nc.hint?" "+nc.hint:""))}</div>
      <div class="basis">Messung am See plus Prognose</div>${thrChip()}</div>`;
  }
  if(live && (nc.eOk || nc.trusted.length)){
    const parts = [];
    if(nc.eOk) parts.push(`Joran-Regel E in Cressier: ${r1(nc.e.mean30)} kn seit ${nc.e.since?hhmm(nc.e.since):"–"}`);
    nc.trusted.forEach(x=>{ if(nc.eOk && x.up.abk==="crm") return;
      parts.push(`${x.up.name} ${r0(x.u.mean30)} kn ${x.u.sys?x.u.sys.name:""}${x.u.since?" seit "+hhmm(x.u.since):""}${x.u.trust==null&&x.u.rel===undefined?" (ungeprüft)":""}`); });
    const strong = nc.eOk || nc.trusted.some(x=>x.u.trust!=null || x.u.rel===1);
    cls = strong ? "c4" : "c3";
    word = "Wind kommt";
    why = `Messung: ${parts.join("; ")}. ` + why;
    basis = "Messung an Upwind-Stationen plus Prognose";
  }
  const ruhig = nochKein(s, hour, live, nc);
  if(ruhig && !(live && (nc.eOk || nc.trusted.length))){
    cls = "c0"; word = "Noch kein Wind";
    why = `Gemessen am See: ${ruhig.map(x=>`${x.L.name} ${r0(x.last.mean)} kn ${card(x.last.dir)}`).join(", ")}. Kein Upwind-Signal. `
      + `Die Modelle sagen «${LEVELS[s.level]}»: ` + why;
    basis = "Messung am See und an den Upwind-Stationen. Die Prognose ist noch nicht eingetroffen.";
  }
  if(today && hour>h1) why += " Dein Zeitfenster heute ist vorbei.";
  if(live && nc.hint) why += " " + nc.hint;
  return `<div class="verdict ${cls}"><span class="word">${esc(word)}</span>
    <div class="why">${esc(why)}</div><div class="basis">${esc(basis)}</div>${thrChip()}</div>`;
}

function modelTable(cur){
  if(!cur.s.n) return "";
  let h = `<div class="tw"><table style="margin-top:6px"><tr><th>Modell</th><th class="n">max</th><th>Richtung</th><th class="n">h ≥ ${S.T}</th><th class="n">Zeit, Spot</th></tr>`;
  cur.s.per.forEach(x=>{
    if(!x.e){ h += `<tr><td>${x.m.name}</td><td class="n dim" colspan="4">${D.err[x.m.id]?"nicht erreichbar":"reicht nicht bis hier"}</td></tr>`; return; }
    const t = x.e.top, dn = t ? dirOf(t.d) : null;
    h += `<tr><td>${x.m.name}<br><small>${x.m.note}</small></td>
      <td class="n"><b>${t?r0(t.v):"–"}</b> kn${t&&t.g!=null?`<br><small>Böe ${r0(t.g)}</small>`:""}</td>
      <td>${t?arrow(t.d)+" "+(dn?dn.name:card(t.d)):"–"}</td>
      <td class="n">${x.e.nOver}</td>
      <td class="n">${t?t.hr+":00<br><small>"+spotName(t.spot)+"</small>":"–"}</td></tr>`;
  });
  h += `</table></div>`;
  if(cur.s.lage){ const f = C.LAGE.f[cur.s.lage]||{};
    h += `<div class="note">Lage-Faktor (${cur.s.lage==="nord"?"Nordlage":"Bise"} nach der Kammprognose): ${esc(Object.keys(f).filter(id=>f[id]!==1).map(id=>`${spotName(id)} × ${f[id]}`).join(", "))}.</div>`; }
  if(cur.ens) h += `<div class="note">ICON-D2-Ensemble: <b>${cur.ens.hit} von ${cur.ens.n}</b> Läufen erreichen ${S.T} kn. ${cur.ens.hit/cur.ens.n>=0.5?"Die Läufe sind sich weitgehend einig.":cur.ens.hit>0?"Nur ein Teil der Läufe zeigt das Signal.":"Kein Lauf zeigt das Signal."}</div>`;
  return h;
}

function warnings(cur){
  const w = [], s = cur.s;
  const cape = Math.max(0, ...s.ok.map(x=>x.e.capeMax||0));
  if(cape>=1000) w.push({short:"Gewitter möglich", text:`CAPE bis ${Math.round(cape)} J/kg: Gewitter möglich. Eine Böenfront zeigt sich an den Upwind-Stationen zuerst (Temperatursturz, Windsprung).`});
  const gMax = Math.max(0, ...s.ok.map(x=>x.e.top && x.e.top.g!=null ? x.e.top.g : 0));
  if(gMax*S.k >= S.maxGust) w.push({short:`Böen bis ${r0(gMax*S.k)} kn`, text:`Böen bis ${r0(gMax*S.k)} kn möglich (mit Modellfaktor), ab der Sturmgrenze von ${S.maxGust} kn.`});
  const tops = s.ok.filter(x=>x.e.top).map(x=>x.e.top.v);
  if(tops.length>1 && Math.max(...tops)-Math.min(...tops)>=6) w.push({short:"", text:`Modelle uneinig: ${r0(Math.max(...tops)-Math.min(...tops))} kn Spannweite.`});
  return w;
}

/* Abgleich: letzte Stunde gemessen am See vs. Modelle (gleicher Spot, gleiche Stunde) */
function abgleich(day){
  const lk = C.lakeNow(LK, S).filter(x=>x.fresh && S.spots[x.L.id]);
  if(!lk.length) return "";
  const hr = C.localHour(), key = day+"T"+String(hr).padStart(2,"0")+":00";
  const rows = [];
  lk.forEach(x=>{
    const meas = x.rows.filter(r=>Date.now()-r.t < 60*60000); if(!meas.length) return;
    const m = meas.reduce((a,r)=>a+r.mean,0)/meas.length;
    const mv = MODELS.map(md=>{ const sp = D.models[md.id] && D.models[md.id].find(z=>z.id===x.L.id); const i = sp && sp.idx[key];
      return i!=null && sp.h.ws[i]!=null ? sp.h.ws[i]*C.kFor(sp.h.wd[i],S) : null; }).filter(v=>v!=null);
    if(!mv.length) return;
    const mm = mv.reduce((a,v)=>a+v,0)/mv.length;
    rows.push({n:x.L.name, m, mm, d:m-mm});
  });
  if(!rows.length) return "";
  const d = rows.reduce((a,r)=>a+r.d,0)/rows.length;
  const txt = Math.abs(d)<2 ? "Die Modelle liegen gerade richtig." : d>0 ? `Am See weht es ${r0(d)} kn mehr als im Modell. Die Prognose für die nächsten Stunden eher höher lesen.` : `Am See weht es ${r0(-d)} kn weniger als im Modell. Die Prognose für die nächsten Stunden eher tiefer lesen.`;
  return `<div class="note"><b>Messung gegen Modell, ${hr}–${hr+1} Uhr</b><br>${rows.map(r=>`${r.n}: gemessen ${r0(r.m)} kn, Modelle ${r0(r.mm)} kn`).join(" · ")}<br>${txt}</div>`;
}
function joranHTML(jc, cur, nc){
  const live = cur.k===0;
  const li = [];
  li.push(`<li class="${jc.crestOk?"y":""}">Nordwest auf dem Chasseral: ${jc.crest?`${r0(jc.crest.v)} kn um ${jc.crest.hr} Uhr`:"nein"}${jc.crestOk?"":` <span class="dim">(nötig: ${C.JORAN_X.crest} kn)</span>`}</li>`);
  li.push(`<li class="${jc.dpOk?"y":""}">Druck über dem Jura steigt: ${jc.rise!=null?`${jc.rise>=0?"+":""}${r1(jc.rise)} hPa seit Mittag`:"keine Angabe"}</li>`);
  if(live){
    const cdf = D.stations.cdf, neu = D.stations.neu;
    const lq = r => r && !r.err && r.rows.length ? r.rows[r.rows.length-1] : null;
    const a = lq(cdf), b = lq(neu);
    if(a && b && a.qff!=null && b.qff!=null && C.fresh(cdf.rows) && C.fresh(neu.rows))
      li.push(`<li>Gemessen um ${hhmm(a.t)}: Druck Jura − See ${a.qff-b.qff>=0?"+":""}${r1(a.qff-b.qff)} hPa</li>`);
  }
  if(jc.bn!=null) li.push(`<li class="${jc.bnOk?"y":""}">Kaltluft westlich des Juras: ${jc.bn>0?"+":""}${r1(jc.bn)} hPa um ${jc.bnHr} Uhr${jc.bnOk?"":` <span class="dim">(nötig: +${C.JORAN_X.bn} hPa)</span>`}</li>`);
  if(jc.storm) li.push(`<li class="w">Gewitter möglich: Joran kann als Böenfront kommen</li>`);
  const hint = jc.bnOk ? `<br><b>Front-Joran möglich.</b> Er kommt von Westen; Bullet, La Brévine und Neuchâtel melden ihn zuerst.`
    : jc.n===2 && cur.s.level<S.cut ? `<br><b>Beide Zeichen sind da, die Modelle zeigen wenig.</b> Abend-Joran wird oft unterschätzt: ab 16 Uhr die Messung beobachten.`
    : jc.n===0 && cur.s.top && dirOf(cur.s.top.d) && dirOf(cur.s.top.d).id==="joran" ? `<br>Die Modelle zeigen Joran, die Zeichen fehlen. Eher vorsichtig sein.` : "";
  return `<div class="note"><b>Joran-Zutaten</b> <span class="dim">(Hinweis)</span><ul class="ing">${li.join("")}</ul>${hint}</div>`;
}
/* Höhenwind auf 850 hPa und Schichtung: Hinweis zur Lage, ändert die Bewertung nicht */
function hoeheHTML(cur){
  const hd = D.hoehe ? C.hoeheDay(D.hoehe, cur.day, S) : null; if(!hd) return "";
  const dn = hd.d!=null ? dirOf(hd.d) : null, wo = hd.d==null ? "Wind" : dn ? dn.name : card(hd.d);
  let txt = hd.coupled==null ? "" : hd.coupled ? "Luft durchmischt: Der Wind kann bis auf den See." : "Luft stabil geschichtet: Der Wind bleibt eher oben.";
  if(hd.coupled && dn && dn.id==="bise") txt += " Bei Bise kommt am See oft viel weniger an.";
  if(hd.coupled && dn && dn.id==="w") txt += " Bei West hat Ipsach meist mehr als Vingelz.";
  let now = "";
  if(cur.k===0){
    const up = UPWIND.find(u=>u.abk==="cha"), ref = UPWIND.find(u=>u.abk==="crm");
    const lp = C.lapseRate(D.stations, up, ref, new Date());
    /* die Messung nur nennen, wenn sie dem Modell widerspricht */
    const mix = lp!=null ? lp>=C.MODEL.kopplung.min : null;
    if(mix!=null && hd.coupled!=null && mix!==hd.coupled) now = `<br><b>Die Messung zeigt es anders:</b> zwischen Cressier und Chasseral jetzt ${mix?"durchmischt":"stabil geschichtet"}.`;
  }
  return `<div class="note"><b>Höhenwind</b> <span class="dim">(1500 m, Hinweis)</span><br>${esc(wo)} ${r0(hd.v)} kn. ${txt}${now}</div>`;
}

function chartHTML(day){
  const h0 = 8, h1 = 22, [w0,w1] = WINS[S.win];
  const cols = [];
  for(let hr=h0; hr<=h1; hr++) cols.push({hr, vals:[], raw:[], dirs:[]});
  MODELS.forEach(m=>{
    const sp = D.models[m.id]; if(!sp) return;
    const r = evalHours(sp, day, S, h0, h1); if(!r) return;
    r.hours.forEach((x,i)=>{ if(x.best){ cols[i].vals.push(x.best.v); cols[i].dirs.push(x.best.d); } if(x.raw) cols[i].raw.push(x.raw.v); });
  });
  if(day===localDay(0) && LK){
    const lk = C.lakeNow(LK, S).filter(x=>S.spots[x.L.id]);
    cols.forEach(c=>{
      lk.forEach(x=>{
        const r = x.rows.filter(z=>C.localHour(z.t)===c.hr && C.dayOfDate(z.t)===day);
        if(!r.length) return;
        const m = r.reduce((a,z)=>a+z.mean,0)/r.length;
        if(c.lake==null || m>c.lake) c.lake = m;
      });
    });
  }
  if(!cols.some(c=>c.vals.length||c.raw.length)) return `<div class="note">Keine Stundenwerte für diesen Tag.</div>`;
  const med = a => { const b = [...a].sort((x,y)=>x-y); const n = b.length; return n%2 ? b[(n-1)/2] : (b[n/2-1]+b[n/2])/2; };
  const W=600, Hh=190, PL=28, PR=8, PT=22, PB=22;
  const maxV = Math.max(S.T+4, 20, ...cols.map(c=>Math.max(0,c.lake||0,...c.vals,...c.raw)))*1.08;
  const bw = (W-PL-PR)/cols.length;
  const y = v => Hh-PB-(v/maxV)*(Hh-PT-PB);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Windverlauf ${esc(day)}">`;
  const xw0 = PL+(w0-h0)*bw, xw1 = PL+(w1-h0+1)*bw;
  s += `<rect x="${xw0}" y="${PT-4}" width="${xw1-xw0}" height="${Hh-PB-PT+4}" style="fill:var(--ch-win)"/>`;
  [S.T-3, S.T].forEach((v,j)=>{
    s += `<line x1="${PL}" x2="${W-PR}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(${j?"--ch-on":"--ch-near"})" stroke-width="1.5" stroke-dasharray="${j?"":"4 3"}"/>`;
    s += `<text x="2" y="${y(v)+4}" font-size="11" font-weight="600" style="fill:var(${j?"--ch-on":"--ch-near"})">${v}</text>`;
  });
  cols.forEach((c,i)=>{
    const x = PL+i*bw+2, w = Math.max(3,bw-5);
    if(c.vals.length){
      const m = med(c.vals), lo = Math.min(...c.vals), hi = Math.max(...c.vals);
      const col = over(m,S) ? "--ch-on" : Math.round(m)>=S.T-3 ? "--ch-near" : "--ch-off";
      s += `<rect x="${x}" y="${y(m)}" width="${w}" height="${Hh-PB-y(m)}" rx="2" style="fill:var(${col})"/>`;
      if(hi>lo){ const cx = x+w/2, cw = Math.min(5, w/3);   /* Spannweite der Modelle: Strich mit Endkappen */
        s += `<g style="stroke:var(--ch-range)" stroke-width="2" stroke-linecap="round"><line x1="${cx}" x2="${cx}" y1="${y(hi)}" y2="${y(lo)}"/><line x1="${cx-cw}" x2="${cx+cw}" y1="${y(hi)}" y2="${y(hi)}"/><line x1="${cx-cw}" x2="${cx+cw}" y1="${y(lo)}" y2="${y(lo)}"/></g>`; }
      const d = c.dirs[0];
      if(d!=null) s += `<g transform="translate(${x+w/2},${PT-11}) rotate(${d+180})"><path d="M0 -6 L4 6 L0 3.5 L-4 6 Z" style="fill:var(--ch-ink)"/></g>`;
    } else if(c.raw.length){
      const m = med(c.raw);
      s += `<rect x="${x}" y="${y(m)}" width="${w}" height="${Hh-PB-y(m)}" fill="none" style="stroke:var(--ch-off)" stroke-dasharray="3 2"/>`;
    }
    if(c.lake!=null) s += `<circle cx="${x+w/2}" cy="${y(c.lake)}" r="4.5" style="fill:var(--card);stroke:var(--orange)" stroke-width="2.5"/>`;
    if(c.hr%2===0) s += `<text x="${x+w/2}" y="${Hh-6}" font-size="11" style="fill:var(--muted)" text-anchor="middle">${c.hr}</text>`;
  });
  return s + `</svg>`;
}

function stationsHTML(nc){
  const any = UPWIND.some(s=>D.stations[s.abk] && !D.stations[s.abk].err);
  if(!any) return `<div class="note bad">Keine Messwerte abrufbar. Massgebend ist ohnehin die Messung am See oben.</div>`;
  let h = "";
  UPWIND.forEach(up=>{
    const d = D.stations[up.abk];
    if(!d || d.err){ h += `<div class="row"><div class="nm"><b>${up.name}</b><em>${esc(up.role)}</em></div><div class="val off">nicht erreichbar</div></div>`; return; }
    const cha = D.stations.cha && !D.stations.cha.err ? D.stations.cha.rows : null;
    const u = C.upwindNow(d.rows, up, S, cha), l = d.rows[d.rows.length-1], dn = dirOf(l.dir);
    const old = !C.fresh(d.rows);
    const sysTxt = up.tl ? `Taubenlöchler (Nord/Nordost in der Bucht), Signal bei Talwind ${up.sec[0]}–${up.sec[1]}° ab ${up.hrs[0]} Uhr` : up.sys.map(id=>(DIRS.find(x=>x.id===id)||{}).name + ((up.extraSys||[]).includes(id) ? " (erst nach Prüfung)" : "")).join(", ");
    const trust = u.rel!==undefined ? (u.rel ? "verlässlich (Recall-Regel)" : "nicht verlässlich (Recall unter 0.85)")
      : u.trust==null ? "ungeprüft" : `geprüft, Peirce ${u.trust.toFixed(2)}`;
    const tag = u.off ? `<span class="sig off">Richtung abgewählt</span>` : old ? `<span class="sig off">veraltet</span>`
      : u.ok ? (!C.isTrusted({u, up}) ? `<span class="sig near">Signal, ${u.trust==null&&u.rel===undefined?"ungeprüft":"unzuverlässig"}</span>` : `<span class="sig on">Signal</span>`)
      : u.block && u.last && Math.round(u.mean30)>=u.ts ? `<span class="sig off">gesperrt: ${esc(u.block)}</span>` : u.near ? `<span class="sig near">fast</span>` : "";
    h += `<div class="row"><div class="nm"><b>${up.name}</b>${tag}<em>${esc(up.role)}. Zeigt ${esc(sysTxt)}. Schwelle ${u.ts} kn, ${trust}. ${hhmm(l.t)}</em></div>
      <div class="val ${u.ok?"on":"off"}">${arrow(l.dir)} ${dn?dn.name:card(l.dir)} ${r0(l.mean)}<span class="dim"> / ${r0(l.gust)} kn</span></div></div>`;
  });
  if(nc.e){
    const e = nc.e;
    h += `<div class="note${e.front.length?" bad":""}"><b>Joran-Regel E in Cressier:</b> ${e.ok?"ausgelöst":"nicht ausgelöst"}.
      ${e.ok?`Mittelwind über 30 min ${r1(e.mean30)} kn, gehalten seit ${e.since?hhmm(e.since):"–"}.`:`<ul>${e.fail.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>`}</div>`;
  }
  if(!Object.keys(S.st||{}).length) h += `<div class="note">Die Stationsschwellen sind Startwerte. Im Rückblick kannst du sie an deinen markierten Tagen kalibrieren.</div>`;
  return h;
}

function diagHTML(){
  let h = `<details><summary>Diagnose: verwendete Modellzellen</summary><div class="tw"><table><tr><th>Modell</th>${SPOTS.map(s=>`<th>${s.name}</th>`).join("")}</tr>`;
  MODELS.forEach(m=>{
    const sp = D.models[m.id];
    h += `<tr><td>${m.name}</td>` + SPOTS.map(s=>{
      const c = sp && sp.find(x=>x.id===s.id);
      return `<td><small>${c&&c.cell.lat!=null?`${c.cell.lat.toFixed(3)}, ${c.cell.lon.toFixed(3)}`:"–"}</small></td>`;
    }).join("") + `</tr>`;
  });
  return h + `</table></div><small>Gleiche Koordinaten bei zwei Spots heissen: Das Modell löst die beiden Spots nicht getrennt auf. Liegt eine Zelle weit weg vom Spot, fehlt dort eine Wasserzelle.</small></details>`;
}
