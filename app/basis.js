/* Joran — Oberfläche «basis». Grundlage der Oberfläche: Kurzformen aus dem Rechenkern, kleine Helfer, Speicher im Browser (Einstellungen, Markierungen, GitHub-Angaben), Gesamt-Rendern.
   Klassisches Skript: teilt sich die Namen mit den anderen Dateien unter app/. Reihenfolge in index.html:
   basis, see, live, einstellungen, push, rueckblick, start. Aufbau und Regeln: ARCHITEKTUR.md */
"use strict";
const C = window.JoranCore;
const {SPOTS, MODELS, DIRS, WINS, LEVELS, UPWIND, REGEL_E, DEF} = C;
const {r0, r1, card, dirOf, dirOn, over, spotName, hhmm, localDay, dayLabel, summarize, evalHours, clsOf, ensShare} = C;

const S_KEY = "joran.settings.v2", T_KEY = "joran.truth.v2", G_KEY = "joran.github.v1";
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const localHourNow = () => C.localHour();
const shortDay = (k, day) => k===0?"Heute":k===1?"Morgen":dayLabel(day,{weekday:"short",day:"numeric"});
function arrow(dir){
  if(dir==null) return "";
  return `<svg class="arrow" viewBox="0 0 16 16" aria-hidden="true" style="transform:rotate(${dir+180}deg)"><path d="M8 1 L12.5 14 L8 11 L3.5 14 Z"/></svg>`;
}
const winTxt = w => w ? `${w.from}–${w.to} Uhr` : "";

/* ================= Speicher ================= */
function loadS(){ try{ return C.merge(JSON.parse(localStorage.getItem(S_KEY))); }catch(e){ return C.merge(null); } }
function saveS(){ try{ localStorage.setItem(S_KEY, JSON.stringify(S)); }catch(e){} }
function loadT(){ try{ return JSON.parse(localStorage.getItem(T_KEY)) || {}; }catch(e){ return {}; } }
function saveT(t){ try{ localStorage.setItem(T_KEY, JSON.stringify(t)); }catch(e){} }
function repoFromURL(){
  const h = location.hostname, p = location.pathname.split("/").filter(Boolean);
  return h.endsWith(".github.io") ? {owner:h.replace(".github.io",""), repo:p[0]||""} : {owner:"v9vb46dd29-eng", repo:"Joran"};
}
function loadG(){ const d = Object.assign(repoFromURL(), {token:"", me:""}); try{ return Object.assign(d, JSON.parse(localStorage.getItem(G_KEY))||{}); }catch(e){ return d; } }
function saveG(g){ try{ localStorage.setItem(G_KEY, JSON.stringify(g)); }catch(e){} }

let S = loadS();
let D = null, H = null, HS = null, SEL = null, LK = null, LKERR = "";
let PUSHMSG = "";

/* ================= Rendern: gesamt ================= */
function renderAll(){
  $("#thrNum").innerHTML = `${S.T}<span>kn</span>`;
  $("#thr").value = S.T;
  $("#kVal").textContent = S.k.toFixed(2);
  $("#kSl").value = S.k;
  const kd = Object.keys(S.kDir||{});
  $("#kDirOut").innerHTML = kd.length ? "Eigene Faktoren: " + kd.map(id=>`${esc((DIRS.find(d=>d.id===id)||{}).name||id)} ${S.kDir[id].toFixed(2)}`).join(", ") + ` <button class="btn2" id="kdClr" style="padding:3px 7px">entfernen</button>` : "";
  const kc = $("#kdClr"); if(kc) kc.addEventListener("click",()=>{ S.kDir = {}; saveS(); renderAll(); });
  renderSettings();
  renderPush();
  renderLake();
  if(D) renderLive();
  if(H) renderHist();
}
