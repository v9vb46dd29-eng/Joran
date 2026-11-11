/* Joran — Oberfläche «rueckblick». Rückblick: Tage markieren, Prognose und Stationen kalibrieren, Markierungen kopieren, einfügen und fürs Modell speichern.
   Klassisches Skript: teilt sich die Namen mit den anderen Dateien unter app/. Reihenfolge in index.html:
   basis, see, live, einstellungen, push, rueckblick, start. Aufbau und Regeln: ARCHITEKTUR.md */
"use strict";
function histDays(){ const out = []; for(let k=1;k<=H.days;k++) out.push(localDay(-k)); return out; }
function renderHist(){
  const el = $("#hout");
  const days = histDays(), truth = loadT();
  const cal = C.calibrate(days, S, H.models, truth);
  const b = cal.base;
  let h = "";
  const fails = MODELS.filter(m=>H.err[m.id]);
  if(fails.length) h += `<div class="note bad">Nicht geladen: ${fails.map(m=>m.name+" ("+esc(H.err[m.id])+")").join(", ")}.</div>`;

  h += `<h2>Prognose</h2><div class="note"><b>Bilanz mit den aktuellen Einstellungen</b> (Schwelle ${S.T} kn, Faktor ${S.k.toFixed(2)}, lohnt sich ab «${LEVELS[S.cut]}»):<br>
    ${b.ev+b.nev===0 ? "Noch keine Tage markiert." :
    `Windtage erkannt: <b>${b.tp} von ${b.ev}</b>. Fehlalarme: <b>${b.fp} von ${b.nev}</b>.${b.pss!=null?` Peirce-Score ${b.pss.toFixed(2)} (1 = perfekt, 0 = wertlos).`:""}`}</div>`;
  if(cal.best){
    const c = cal.best.c, pd = cal.perDir, pdk = Object.keys(pd);
    const isSet = Math.abs(cal.best.k-S.k)<1e-9 && cal.best.cut===S.cut && JSON.stringify(Object.fromEntries(pdk.map(id=>[id,pd[id].k])))===JSON.stringify(S.kDir||{});
    h += `<div class="note"><b>Beste Einstellung:</b> Faktor ${cal.best.k.toFixed(2)}, lohnt sich ab «${LEVELS[cal.best.cut]}». Erkannt ${c.tp} von ${c.ev}, Fehlalarme ${c.fp} von ${c.nev}, Peirce ${c.pss.toFixed(2)}.
      ${pdk.length?`<br>Eigener Faktor je Windsystem: ${pdk.map(id=>`${(DIRS.find(d=>d.id===id)||{}).name} ${pd[id].k.toFixed(2)} (${pd[id].ev} Windtage)`).join(", ")}.`:""}
      ${b.ev<10?"<br><small>Weniger als zehn Windtage markiert, das Ergebnis ist vorläufig.</small>":""}
      ${isSet?"<br><small>Ist bereits eingestellt.</small>":`<br><button class="btn2" id="apply" style="margin-top:8px">Übernehmen</button>`}</div>`;
  } else h += `<div class="note">Für eine Kalibrierung braucht es mindestens drei foilbare und drei nicht foilbare Tage. Markiert: ${b.ev} foilbar, ${b.nev} nicht foilbar.</div>`;

  h += `<h2>Upwind-Stationen</h2>`;
  if(!HS) h += `<p style="font-size:.85rem">Lädt die Stundenwerte aller Stationen seit Januar (einige Megabyte, am besten im WLAN) und sucht je Station die Schwelle, die deine markierten Tage am besten trennt.</p><button class="btn2" id="sgo">Stationen kalibrieren</button>`;
  else {
    const RC = C.CAL.rule==="recall";
    const res = UPWIND.map(up=>({up, r: HS.rows[up.abk] ? C.calibrateStation(HS.rows[up.abk], up, S, days, truth, HS.rows.cha) : null}));
    h += `<div class="tw"><table><tr><th>Station</th><th class="n">Schwelle</th><th class="n">erkannt</th><th class="n">Fehlalarm</th><th class="n">${RC?"Recall":"Peirce"}</th></tr>`;
    res.forEach(x=>{
      if(!x.r){ h += `<tr><td>${x.up.name}</td><td class="n dim" colspan="4">${esc(HS.err[x.up.abk]||"keine Daten")}</td></tr>`; return; }
      if(!x.r.best){ h += `<tr><td>${x.up.name}</td><td class="n dim" colspan="4">${x.r.tl?`zu wenige Tage: ${x.r.ev} TL (3 nötig), ${x.r.nev} Nein`:"zu wenige markierte Tage"}</td></tr>`; return; }
      const c = x.r.best.c;
      h += `<tr><td>${x.up.name}</td><td class="n">${x.r.best.ts!=null?x.r.best.ts+" kn":RC?"nicht verlässlich":"kein Bezug"}</td><td class="n">${c.tp}/${c.ev}</td><td class="n">${c.fp}/${c.nev}</td><td class="n"><b>${(RC?x.r.best.rec:x.r.best.pss).toFixed(2)}</b></td></tr>`;
    });
    h += `</table></div><small>${RC?`Je Station gilt die höchste Schwelle, die mindestens ${Math.round(C.CAL.minRecall*100)} % der passenden Windtage erkennt; unter gleichwertigen die mit weniger Fehlalarmen. Erreicht keine Schwelle das, ist die Station nicht verlässlich und löst keinen Push aus. Windtage zählen nur für Stationen ihres Windsystems.`:"Peirce unter 0.25: Station löst keinen Push aus, wird aber angezeigt."} Werte als Stunden-Mittelwind, Fenster ab 2 h vor deinem Zeitfenster. Courtelary zählt nur «Ja»-Tage mit TL gegen «Nein»-Tage, ab 15 Uhr und ohne Westwind auf dem Chasseral.</small>`;
    if(res.some(x=>x.r && x.r.best)) h += `<div><button class="btn2" id="sapply" style="margin-top:8px">Stationsschwellen übernehmen</button></div>`;
    HS.res = res;
  }

  h += `<h2>Tage markieren</h2><div>`;
  days.forEach(d=>{
    const s = summarize(H.models, d, S), t = truth[d], lv = s.level, c = clsOf(lv,S);
    const col = ["#c8d4d6","#34a853","#6fa7b3","#0a84c7","#0a4e5d"][c];
    let out = "";
    if((t==="y"||t==="n") && s.n){
      const alarm = lv>=S.cut;
      out = t==="y" ? (alarm?`<span class="out tp">Treffer</span>`:`<span class="out fn">verpasst</span>`) : (alarm?`<span class="out fp">Fehlalarm</span>`:`<span class="out tn">richtig ruhig</span>`);
    }
    const tp = s.top, dn = tp ? dirOf(tp.d) : null;
    h += `<div class="hrow"><div><b>${esc(dayLabel(d))}</b></div>
      <div class="fc"><span class="dot" style="background:${col}"></span><b>${tp?r0(tp.v)+" kn":"–"}</b> ${tp?(dn?dn.name:card(tp.d))+", "+(s.win?winTxt(s.win):tp.hr+":00"):""}
        <span class="dim">${lv<0?"keine Daten":LEVELS[lv]}</span>${out}</div>
      <div class="mk" data-d="${d}">
        <button class="y" aria-pressed="${t==="y"}" data-t="y" title="war foilbar">Ja</button>
        <button class="k" aria-pressed="${t==="k"}" data-t="k" title="knapp, zählt nicht">~</button>
        <button class="n" aria-pressed="${t==="n"}" data-t="n" title="nicht foilbar">Nein</button>
        <button class="tl" aria-pressed="${!!truth["tl:"+d]}" data-tl="1" title="Taubenlöchler: Wind aus Nord/Nordost in der Bielerbucht">TL</button></div></div>`;
  });
  h += `</div><div class="chips" style="margin-top:14px"><button class="btn2" id="exp">Markierungen kopieren</button><button class="btn2" id="imp">Markierungen einfügen</button>${loadG().token?`<button class="btn2" id="expM">Fürs Modell speichern</button>`:""}</div>
    <small>Werte = Vortagesprognose, bester Spot, mit aktuellem Faktor. «~» = knapp, zählt nicht mit. «TL» = Taubenlöchler (Wind aus Nord oder Nordost in der Bucht), zusätzlich zu «Ja» markieren.${loadG().token?" «Fürs Modell speichern» legt die Markierungen im Repo ab (eval/truth.json). Dort bleiben auch Tage stehen, die du hier wieder entfernst.":""}</small>`;
  el.innerHTML = h;

  el.querySelectorAll(".mk button").forEach(bt=>bt.addEventListener("click",()=>{
    const d = bt.parentElement.dataset.d, tv = bt.dataset.t, tr = loadT();
    if(bt.dataset.tl){ if(tr["tl:"+d]) delete tr["tl:"+d]; else tr["tl:"+d] = 1; }
    else if(tr[d]===tv) delete tr[d]; else tr[d] = tv;
    saveT(tr); renderHist();
  }));
  const ap = $("#apply");
  if(ap) ap.addEventListener("click",()=>{ S.k = cal.best.k; S.cut = cal.best.cut; S.kDir = Object.fromEntries(Object.keys(cal.perDir).map(id=>[id,cal.perDir[id].k])); saveS(); renderAll(); });
  const sg = $("#sgo"); if(sg) sg.addEventListener("click", runStations);
  const sa = $("#sapply");
  if(sa) sa.addEventListener("click",()=>{ const st = {}; HS.res.forEach(x=>{ if(x.r && x.r.best) st[x.up.abk] = Object.assign({ts:x.r.best.ts, pss:x.r.best.pss, n:x.r.ev}, x.r.best.rel!=null ? {rel:x.r.best.rel} : {});  /* ts null = Startwert behalten */ }); S.st = st; saveS(); renderAll(); });
  $("#exp").addEventListener("click", async ()=>{
    const txt = JSON.stringify(loadT());
    try{ await navigator.clipboard.writeText(txt); $("#exp").textContent = "Kopiert"; } catch(e){ window.prompt("Markierungen kopieren:", txt); }
  });
  /* Repo-Besitz: Markierungen als eval/truth.json ablegen; das Messskript liest sie von dort */
  const em = $("#expM"); if(em) em.addEventListener("click", async ()=>{
    const tr = loadT(), n = Object.keys(tr).length;
    if(!n){ alert("Noch keine Tage markiert."); return; }
    em.disabled = true; em.textContent = "Speichert …";
    try{
      const cur = await gh("contents/eval/truth.json");
      /* bereits abgelegte Tage bleiben, was hier markiert ist, geht vor */
      let old = {}; if(cur){ try{ old = JSON.parse(unb64(cur.content)); }catch(e){ throw new Error("eval/truth.json im Repo ist nicht lesbar. Bitte dort zuerst prüfen."); } }
      const all = Object.assign({}, old, tr), keys = Object.keys(all).sort();
      const body = {message:"Joran: Markierungen aus dem Rückblick", content:b64(JSON.stringify(Object.fromEntries(keys.map(k=>[k, all[k]])), null, 1)+"\n")};
      if(cur) body.sha = cur.sha;
      const res = await gh("contents/eval/truth.json", {method:"PUT", body:JSON.stringify(body)});
      if(!res || !res.content) throw new Error("Repo nicht gefunden oder Token ohne Schreibrecht");
      em.textContent = `Gespeichert (${keys.length} Einträge)`;
    }catch(e){ em.disabled = false; em.textContent = "Fürs Modell speichern"; alert("Nicht gespeichert: "+(e.message||e)); }
  });
  $("#imp").addEventListener("click", ()=>{
    const txt = window.prompt("Markierungen einfügen (JSON):"); if(!txt) return;
    try{
      const o = JSON.parse(txt), tr = loadT(); let n = 0;
      Object.keys(o).forEach(k=>{ if(/^\d{4}-\d{2}-\d{2}$/.test(k) && ["y","n","k"].includes(o[k])){ tr[k] = o[k]; n++; }
        else if(/^tl:\d{4}-\d{2}-\d{2}$/.test(k) && o[k]===1){ tr[k] = 1; n++; } });
      saveT(tr); renderHist(); alert(n+" Markierungen übernommen.");
    }catch(e){ alert("Das ist kein gültiger Markierungs-Text."); }
  });
}
