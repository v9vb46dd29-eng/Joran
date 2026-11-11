/* Joran — Oberfläche «see». Karten «Am See jetzt»: Messung Vingelz und Ipsach.
   Klassisches Skript: teilt sich die Namen mit den anderen Dateien unter app/. Reihenfolge in index.html:
   basis, see, live, einstellungen, push, rueckblick, start. Aufbau und Regeln: ARCHITEKTUR.md */
"use strict";
function ago(t){ const m = Math.round((Date.now()-t)/60000); return m<1 ? "gerade" : m<60 ? `vor ${m} min` : `vor ${Math.floor(m/60)} h ${m%60} min`; }
function spark(rows){
  const r = rows.filter(x=>Date.now()-x.t < 3*3600e3);
  if(r.length<2) return "";
  const W = 200, Hh = 34, t0 = Date.now()-3*3600e3, maxV = Math.max(S.T+3, ...r.map(x=>x.gust||x.mean))*1.05;
  const X = t => ((t-t0)/(3*3600e3))*W, Y = v => Hh-2-(v/maxV)*(Hh-4);
  const line = k => r.filter(x=>x[k]!=null).map((x,i)=>(i?"L":"M")+X(x.t).toFixed(1)+" "+Y(x[k]).toFixed(1)).join(" ");
  return `<svg class="sp" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" x2="${W}" y1="${Y(S.T)}" y2="${Y(S.T)}" stroke="currentColor" stroke-dasharray="3 3" opacity=".5"/>
    <path d="${line("gust")}" fill="none" stroke="currentColor" stroke-width="1" opacity=".4"/>
    <path d="${line("mean")}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}
function renderLake(){
  const el = $("#lake"); if(!el) return;
  const lk = C.lakeNow(LK, S);
  el.innerHTML = lk.map(x=>{
    const l = x.last;
    if(!l) return `<a class="lk old" href="${x.L.url}" target="_blank" rel="noopener"><div class="lh"><b>${x.L.name}</b><small>Station öffnen ↗</small></div>
      <div class="lv">–</div><div class="ls dim">${LKBUSY?"lädt …":"Nicht abrufbar"+(x.err?` (${esc(x.err)})`:"")+". Tippen öffnet die Station."}</div></a>`;
    const dn = dirOf(l.dir), on = x.fresh && over(l.mean,S) && dirOn(l.dir,S);
    return `<a class="lk${on?" on":""}${x.fresh?"":" old"}" href="${x.L.url}" target="_blank" rel="noopener" title="Station ${x.L.name} öffnen">
      <div class="lh"><b>${x.L.name}</b><small>${hhmm(l.t)}${x.fresh?"":" · veraltet"}</small></div>
      <div class="lv">${r0(l.mean)}<small> kn</small></div>
      <div class="ld">${arrow(l.dir)} ${card(l.dir)}${dn?` <span class="dim" style="font-weight:400">${dn.name}</span>`:""}</div>
      <div class="ls">Böen ${r0(l.gust)} kn${l.steady!=null?` · Richtung ${l.steady}% stabil`:""}${l.water!=null?` · Wasser ${l.water}°`:""}</div>
      <div class="ls dim">${x.ok?`≥ ${S.T} kn seit ${hhmm(x.since)}`:ago(l.t)}</div>
      ${spark(x.rows)}</a>`;
  }).join("");
  $("#lakeStamp").textContent = LKBUSY ? "lädt …" : LK && LK.updated ? "geholt " + hhmm(new Date(LK.updated)) : "";
  const dg = $("#lakeDiag");
  if(dg) dg.textContent = C.LAKE.map(L=>{ const d = LKNOW && LKNOW.st[L.id];
    const names = (S_PROXY() ? ["eigenen Proxy"] : []).concat(["direkt","allorigins","codetabs","corsproxy"]);
    return `${L.name}: ${!d ? "–" : d.err ? "nicht erreichbar (" + (d.errs||[d.err]).map((e,i)=>names[i]+": "+e).join(", ") + ")" : "ok über " + names[LKNOW.via[L.id]]}`; }).join(" · ")
    + (LKERR ? ` · Verlauf (Branch live): ${LKERR}` : "");
}
/* Seemessung: aktueller Wert direkt über CORS-Proxy, Verlauf aus dem Branch «live» und aus dem eigenen Browser-Speicher */
const L_KEY = "joran.lake.v1", P_KEY = "joran.proxy.v1";
const DEF_PROXY = "https://joran.rfjhvvs9p2.workers.dev/";      /* eigener Cloudflare Worker, siehe Ordner proxy */
const S_PROXY = () => { try{ const v = localStorage.getItem(P_KEY); return v==null || v==="" ? DEF_PROXY : v; }catch(e){ return DEF_PROXY; } };
let LKBUSY = false, LKNOW = null;
async function loadLake(quiet){
  const g = loadG();
  LKBUSY = true; renderLake();
  let cache = null; try{ cache = JSON.parse(localStorage.getItem(L_KEY)); }catch(e){}
  const [hist, now] = await Promise.all([
    C.fetchLake(g.owner, g.repo).then(x=>{ LKERR = ""; return x; }).catch(e=>{ LKERR = /404/.test(e.message) ? "noch keine Daten" : e.message; return null; }),
    C.fetchLakeNow(S_PROXY()).catch(()=>null)
  ]);
  LKNOW = now;
  LK = C.mergeLake(cache, hist, now);
  try{ localStorage.setItem(L_KEY, JSON.stringify(LK)); }catch(e){}
  LKBUSY = false;
  renderLake();
  if(D && !quiet){ renderLive(); stamp(); }
}
