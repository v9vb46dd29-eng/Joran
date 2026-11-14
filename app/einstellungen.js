/* Joran — Oberfläche «einstellungen». Einstellungsblatt: Schwelle, Zeitfenster, Richtungen, Spots, Grenzen.
   Klassisches Skript: teilt sich die Namen mit den anderen Dateien unter app/. Reihenfolge in index.html:
   basis, see, live, einstellungen, push, rueckblick, windbild, start. Aufbau und Regeln: ARCHITEKTUR.md */
"use strict";
function chipGroup(el, items, isOn, onClick){
  el.innerHTML = items.map(it=>`<button class="chip" aria-pressed="${isOn(it)}" data-v="${esc(it.v)}">${esc(it.t)}</button>`).join("");
  el.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{ onClick(b.dataset.v); saveS(); renderAll(); }));
}
function renderSettings(){
  chipGroup($("#setWin"), Object.keys(WINS).map(k=>({v:k,t:WINS[k][2]})), it=>S.win===it.v, v=>{ S.win=v; });
  chipGroup($("#setMin"), [{v:"1",t:"1 Stunde"},{v:"2",t:"2 Stunden"}], it=>String(S.minH)===it.v, v=>{ S.minH=+v; });
  chipGroup($("#setDir"), DIRS.map(d=>({v:d.id,t:`${d.name} ${d.a}–${d.b}°`})), it=>!!S.dirs[it.v], v=>{
    S.dirs[v] = S.dirs[v]?0:1; if(!Object.values(S.dirs).some(Boolean)) S.dirs[v] = 1; });
  chipGroup($("#setSpot"), SPOTS.map(s=>({v:s.id,t:s.name})), it=>!!S.spots[it.v], v=>{
    S.spots[v] = S.spots[v]?0:1; if(!Object.values(S.spots).some(Boolean)) S.spots[v] = 1; });
}
