/* Joran — Oberfläche «start». Abläufe und Start: Daten holen und auffrischen, Zwischenspeicher, Bedienelemente verdrahten, erste Anzeige. Muss als letzte Datei geladen werden.
   Klassisches Skript: teilt sich die Namen mit den anderen Dateien unter app/. Reihenfolge in index.html:
   basis, see, live, einstellungen, push, rueckblick, windbild, start. Aufbau und Regeln: ARCHITEKTUR.md */
"use strict";
/* Refresh: Modelle und ALLE Messstationen (Upwind + See) frisch laden, erst dann auswerten */
function liveStatus(){
  if(!D) return "";
  const up = UPWIND.filter(u=>D.stations[u.abk] && !D.stations[u.abk].err && C.fresh(D.stations[u.abk].rows)).length;
  const lk = C.lakeNow(LK, S).filter(x=>x.fresh).length;
  return `${lk+up}/${UPWIND.length+C.LAKE.length} Stationen live`;
}
function stamp(){ $("#stamp").innerHTML = D ? `Messung ${hhmm(D.at)} · Modelle ${D.mt>0?hhmm(D.mt):"–"}<br>${liveStatus()}` : "noch nicht geladen"; }
let BUSY = false;
/* Modelldaten ändern sich nur mit jedem Modelllauf (alle 1–3 h). Darum bis 20 min wiederverwenden —
   die Messungen (Stationen, See) werden bei jedem Refresh immer frisch geholt. */
const M_KEY = "joran.models.v1", M_MAX = 20*60000;
function loadMCache(){ try{ const c = JSON.parse(localStorage.getItem(M_KEY)); if(c && c.models){ c.mt = new Date(c.mt); return c; } }catch(e){} return null; }
function saveMCache(){ try{ localStorage.setItem(M_KEY, JSON.stringify({models:D.models, err:D.err, ens:D.ens, jura:D.jura, hoehe:D.hoehe, mt:D.mt})); }catch(e){} }
let rT = null;
/* Während des Ladens keine neue Bewertung aus halben Daten: alter Stand bleibt ausgegraut, nur der Fortschritt zählt hoch.
   Die Seekacheln (reine Messwerte) dürfen sofort erscheinen. */
let DONE = 0, TOTAL = 0;
function progress(){ const o = $("#now"); o.classList.add("loading"); o.dataset.prog = `Wird aktualisiert … (${DONE}/${TOTAL})`; $("#days").classList.add("loading"); }
function renderSoon(){ DONE++; progress(); }
async function run(full){
  if(BUSY) return; BUSY = true;
  const b = $("#go"); b.disabled = true; b.classList.add("busy"); b.classList.remove("stale"); $("#goTxt").textContent = "Lädt …";
  lastLake = lastRun = Date.now();
  if(!D){ const c = loadMCache(); D = c ? Object.assign(c, {stations:{}, at:new Date()}) : null; }
  const needModels = full!==false && (!D || Date.now()-D.mt > M_MAX);
  const first = !D;
  if(!D){ D = {models:{}, err:{}, ens:null, jura:null, hoehe:null, stations:{}, mt:new Date(0), at:new Date()}; $("#now").innerHTML = `<div class="skel">Modelle und Messwerte werden geholt …</div>`; }
  else if(!$("#now .verdict")){ try{ renderLive(); }catch(e){} }   /* letzter Stand aus dem Speicher, ausgegraut */
  DONE = 0; TOTAL = 2 + (needModels ? MODELS.length + 3 : 0);
  if(!first) progress();
  const jobs = [
    C.fetchStations().then(st=>{ D.stations = st; D.at = new Date(); }).then(renderSoon, renderSoon),
    loadLake(true).then(renderSoon, renderSoon)
  ];
  const N = {models:{}, err:{}};
  if(needModels){
    jobs.push(...MODELS.map(m=>C.fetchModel(m).then(x=>{ N.models[m.id] = x; }).catch(e=>{ N.err[m.id] = e.message||"Fehler"; }).then(renderSoon)));
    jobs.push(C.fetchEnsemble().then(x=>{ D.ens = x; delete D.err.ens; }).catch(e=>{ D.err.ens = e.message||"Fehler"; }).then(renderSoon));
    jobs.push(C.fetchJura().then(x=>{ D.jura = x; }).catch(()=>{}).then(renderSoon));
    jobs.push(C.fetchHoehe().then(x=>{ D.hoehe = x; }).catch(()=>{}).then(renderSoon));
  }
  try{
    await Promise.allSettled(jobs);
    if(needModels){
      /* Modelle nur ersetzen, wenn der neue Lauf nicht schlechter ist; sonst alten Stand behalten und Fehler zeigen */
      if(Object.keys(N.models).length >= Object.keys(D.models).length || Date.now()-D.mt > 3*3600e3){ D.models = N.models; D.err = Object.assign({}, N.err, D.err.ens?{ens:D.err.ens}:{}); D.mt = new Date(); }
      else Object.assign(D.err, N.err);
      saveMCache();
    }
  }
  finally {
    $("#now").classList.remove("loading"); $("#days").classList.remove("loading");
    clearTimeout(rT);
    if(!Object.keys(D.models).length && !Object.keys(D.err).length) D.err.all = "keine Antwort";
    try{ renderLive(); }catch(e){ $("#now").innerHTML = `<div class="note bad">Auswertung fehlgeschlagen: ${esc(e.message)}</div>`; }
    stamp();
    b.disabled = false; b.classList.remove("busy"); $("#goTxt").textContent = "Aktualisieren";
    BUSY = false;
  }
}
async function runHist(){
  const b = $("#hgo"); b.disabled = true; b.textContent = "Lade Archiv …";
  const N = {models:{}, err:{}, days:45};
  await Promise.allSettled(MODELS.map(m=>C.fetchHistory(m, N.days).then(x=>N.models[m.id]=x).catch(e=>N.err[m.id]=e.message||"Fehler")));
  H = N;
  if(!Object.keys(H.models).length) $("#hout").innerHTML = `<div class="note bad">Das Prognosearchiv ist nicht erreichbar: ${esc(Object.values(H.err).join("; "))}</div>`;
  else renderHist();
  b.disabled = false; b.textContent = "Rückblick neu laden";
}
async function runStations(){
  const sg = $("#sgo"); if(sg){ sg.disabled = true; sg.textContent = "Lade Stationsarchiv …"; }
  const N = {rows:{}, err:{}};
  await Promise.allSettled(UPWIND.map(up=>C.fetchStation(up.abk, "h", "recent").then(r=>N.rows[up.abk]=r).catch(e=>N.err[up.abk]=e.message||"Fehler")));
  HS = N; renderHist();
}

/* ================= Start ================= */
function debounce(f, ms){ let t; return ()=>{ clearTimeout(t); t = setTimeout(f, ms); }; }
$("#go").addEventListener("click", run);
$("#hgo").addEventListener("click", runHist);
$("#thr").addEventListener("input", e=>{ S.T = +e.target.value; $("#thrNum").innerHTML = `${S.T}<span>kn</span>`; });
$("#thr").addEventListener("input", debounce(()=>{ saveS(); if(D) renderLive(); if(H) renderHist(); renderPush(); }, 120));
$("#kSl").addEventListener("input", e=>{ S.k = +e.target.value; $("#kVal").textContent = S.k.toFixed(2); });
$("#kSl").addEventListener("change", ()=>{ saveS(); renderAll(); });
$("#reset").addEventListener("click", ()=>{ const p = S.push; S = C.merge(null); S.push = p; saveS(); renderAll(); });
/* Darstellung: Automatisch → Hell → Dunkel */
const TH_KEY = "joran.theme.v1";
const TH_ICON = {
  auto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>`,
  light: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  dark: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`
};
const TH_NAME = {auto:"Automatisch (wie System)", light:"Hell", dark:"Dunkel"};
function getTheme(){ try{ return localStorage.getItem(TH_KEY) || "auto"; }catch(e){ return "auto"; } }
function applyTheme(t){
  if(t==="auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  const dark = t==="dark" || (t==="auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  $("#tc").setAttribute("content", dark ? "#000000" : "#f2f2f7");
  const b = $("#theme"); b.innerHTML = TH_ICON[t]; b.setAttribute("aria-label", "Darstellung: " + TH_NAME[t] + ", tippen zum Wechseln"); b.title = TH_NAME[t];
}
$("#theme").addEventListener("click", ()=>{
  const n = {auto:"light", light:"dark", dark:"auto"}[getTheme()];
  try{ localStorage.setItem(TH_KEY, n); }catch(e){}
  applyTheme(n);
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ()=>applyTheme(getTheme()));
applyTheme(getTheme());

/* Blätter: Einstellungen und Erklärungen */
const sheet = $("#sheet"), info = $("#info");
function openDlg(d){ if(d.showModal) d.showModal(); else d.setAttribute("open",""); document.body.style.overflow = "hidden"; }
function closeDlg(d){ if(d.close) d.close(); else d.removeAttribute("open"); }
const openSheet = () => openDlg(sheet), closeSheet = () => closeDlg(sheet);
[sheet, info].forEach(d=>{
  d.addEventListener("close", ()=>{ if(!sheet.open && !info.open) document.body.style.overflow = ""; });
  d.addEventListener("click", e=>{ if(e.target===d) closeDlg(d); });
});
/* Die Karte zieht beim Öffnen ins Blatt «Erklärungen» und zeigt dort alle Lagen mit Filtern; beim Schliessen kommt sie zurück
   auf die Startseite und zeigt wieder die Lage von heute. */
function openInfo(k){
  if(k!=null && k!==""){ SEL = +k; if(D) renderLive(); }
  const wb = $("#wb"); if(wb) $("#wbSlot").appendChild(wb);
  openDlg(info); info.querySelector(".shb").scrollTop = 0;
  WB.mode(true);
}
info.addEventListener("close", ()=>{ const wb = $("#wb"); if(wb) $("#wbHome").appendChild(wb); WB.mode(false); });
$("#menu").addEventListener("click", openSheet);
$("#done").addEventListener("click", closeSheet);
info.querySelector(".done").addEventListener("click", ()=>closeDlg(info));
document.addEventListener("click", e=>{
  if(e.target.closest("[data-open=sheet]")){ openSheet(); return; }
  const b = e.target.closest("[data-info]"); if(b) openInfo(b.dataset.info);
});
$("#proxy").value = S_PROXY();
$("#proxyS").addEventListener("click", async ()=>{
  const b = $("#proxyS"); let v = $("#proxy").value.trim();
  if(v && !/^https?:\/\//.test(v)) v = "https://" + v;
  try{ localStorage.setItem(P_KEY, v); }catch(e){}
  $("#proxy").value = S_PROXY();
  b.disabled = true; b.textContent = "Teste …"; $("#lakeDiag").textContent = "Lade Vingelz und Ipsach …";
  await loadLake();
  b.disabled = false; b.textContent = "Gespeichert ✓"; setTimeout(()=>{ b.textContent = "Speichern"; }, 2500);
});
/* Zurück in die App (iOS): sofort alle Messwerte neu */
window.addEventListener("pageshow", e=>{ if(e.persisted) run(false); });
window.addEventListener("scroll", ()=>$("#nav").classList.toggle("scrolled", scrollY>30), {passive:true});

let lastRun = Date.now(), lastLake = Date.now();
renderAll();
readMine();
run();
/* Auto-Aktualisierung alle 5 min, nur wenn die Seite sichtbar ist: Messungen immer frisch, Modelle nur, wenn älter als 20 min (M_MAX) */
function tick(){
  $("#go").classList.toggle("stale", !$("#go").disabled && Date.now()-lastRun > 20*60000);
  if(document.hidden) return;
  if(Date.now()-lastLake > 5*60000) run();
}
setInterval(tick, 60000);
document.addEventListener("visibilitychange", tick);
