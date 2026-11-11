/* Joran — Oberfläche «push». Push für mehrere Nutzer: eigene Einstellungen speichern (GitHub-Formular oder Code), Verwaltung für den Repo-Besitz. Einziger Ort mit Zugriff auf die GitHub-API.
   Klassisches Skript: teilt sich die Namen mit den anderen Dateien unter app/. Reihenfolge in index.html:
   basis, see, live, einstellungen, push, rueckblick, start. Aufbau und Regeln: ARCHITEKTUR.md */
"use strict";
/* Jeder Nutzer hat users/<name>.json. Mit Token (Repo-Besitz) wird direkt geschrieben,
   sonst über ein GitHub-Issue (nur die eigene Datei) oder per Code an die Besitzerin/den Besitzer. */
let MINE = undefined, ADMIN = null, PENDING = null;
const same = (a,b) => JSON.stringify(C.pushCfg(C.sanitizeCfg(a)))===JSON.stringify(C.pushCfg(C.sanitizeCfg(b)));
function b64(str){ const b = new TextEncoder().encode(str); let s = ""; b.forEach(x=>s+=String.fromCharCode(x)); return btoa(s); }
function unb64(s){ const bin = atob(s.replace(/\n/g,"")); return new TextDecoder().decode(Uint8Array.from(bin, c=>c.charCodeAt(0))); }
async function gh(path, opt){
  const g = loadG();
  const r = await fetch(`https://api.github.com/repos/${g.owner}/${g.repo}/${path}`, Object.assign({headers:{
    "Authorization":"Bearer "+g.token, "Accept":"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28"}}, opt||{}));
  if(r.status===404) return null;
  if(!r.ok){ let m = "HTTP "+r.status; try{ const j = await r.json(); if(j.message) m += ": "+j.message; }catch(e){} throw new Error(m); }
  return r.status===204 ? {} : r.json();
}
async function readUserFile(id){
  const g = loadG();
  if(g.token){ const j = await gh("contents/users/"+id+".json"); return j ? {cfg:JSON.parse(unb64(j.content)), sha:j.sha} : null; }
  const r = await fetch(`users/${id}.json?${Date.now()}`);
  return r.ok ? {cfg:await r.json()} : null;
}
async function writeUserFile(id, cfg, msg){
  const cur = await gh("contents/users/"+id+".json");
  const body = {message:msg, content:b64(JSON.stringify(C.pushCfg(C.sanitizeCfg(cfg)), null, 1)+"\n")};
  if(cur) body.sha = cur.sha;
  await gh("contents/users/"+id+".json", {method:"PUT", body:JSON.stringify(body)});
}
async function readMine(){
  const me = loadG().me;
  if(!me){ MINE = undefined; renderPush(); return; }
  try{ MINE = await readUserFile(me); }catch(e){ MINE = null; PUSHMSG = "Push-Stand nicht lesbar: "+e.message; }
  renderPush();
}
function myCode(pushOn){ const c = C.pushCfg(S); c.push = pushOn; return c; }
function issueURL(pushOn){
  const g = loadG();
  return `https://github.com/${g.owner}/${g.repo}/issues/new?template=joran.yml&title=${encodeURIComponent("Joran Push-Einstellungen")}&code=${encodeURIComponent(JSON.stringify(myCode(pushOn)))}`;
}
async function sendMine(pushOn){
  const g = loadG();
  if(!g.me){ PUSHMSG = "Zuerst deinen Namen eintragen."; renderPush(); return; }
  if(g.token){
    PUSHMSG = "Übertrage …"; renderPush();
    try{ await writeUserFile(g.me, myCode(pushOn), `Joran: Einstellungen ${g.me}`); MINE = {cfg:myCode(pushOn)}; PENDING = null; PUSHMSG = `Gespeichert, ${hhmm(new Date())}.`; }
    catch(e){ PUSHMSG = "Übertragen fehlgeschlagen: "+e.message; }
    renderPush(); return;
  }
  PENDING = {push:pushOn}; PUSHMSG = ""; renderPush();
}
async function testPush(user){
  PUSHMSG = "Starte Testlauf …"; renderPush();
  try{
    await gh("actions/workflows/joran-push.yml/dispatches", {method:"POST", body:JSON.stringify({ref:"main", inputs:{test:true, user:user||""}})});
    PUSHMSG = "Testlauf gestartet. Die Nachricht kommt in 1–2 Minuten.";
  }catch(e){ PUSHMSG = "Testlauf nicht gestartet: "+e.message; }
  renderPush();
}
async function loadAdmin(){
  ADMIN = {list:[], msg:"Lade …"}; renderPush();
  try{
    const dir = await gh("contents/users") || [];
    const files = dir.filter(f=>/^[a-z0-9-]+\.json$/.test(f.name));
    const list = await Promise.all(files.map(async f=>{ const j = await gh("contents/users/"+f.name); return {id:f.name.replace(".json",""), cfg:JSON.parse(unb64(j.content))}; }));
    ADMIN = {list, msg:""};
  }catch(e){ ADMIN = {list:[], msg:"Nutzerliste nicht lesbar: "+e.message}; }
  renderPush();
}
function renderPush(){
  const el = $("#pushOut"); if(!el) return;
  const g = loadG();
  if(!g.topicHint){ g.topicHint = "joran-"+Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>x.toString(36).padStart(2,"0")).join("").slice(0,12); saveG(g); }
  const rc = MINE && MINE.cfg ? (()=>{ try{ return C.sanitizeCfg(MINE.cfg); }catch(e){ return null; } })() : null;
  const on = PENDING ? PENDING.push : rc ? rc.push : false;
  let h = `<div class="fld"><label class="lab" for="gMe">Dein Name für Push (bei GitHub: dein GitHub-Name)</label>
    <div style="display:flex;gap:6px"><input type="text" id="gMe" value="${esc(g.me||"")}" placeholder="z. B. anna" autocomplete="off"><button class="btn2" id="gMeS">OK</button></div></div>`;
  if(g.me){
    h += `<div class="sw" style="margin-top:10px"><input type="checkbox" id="pushSw" ${on?"checked":""} aria-label="Push ein oder aus">
      <div class="t"><b>${on?"Dein Push ist eingeschaltet":"Dein Push ist ausgeschaltet"}</b>
      <small>${PENDING?"Noch nicht gespeichert, unten senden":rc?`Stand in GitHub: Schwelle ${rc.T} kn, ${WINS[rc.win][2]}`:MINE===null?"Für diesen Namen ist noch nichts gespeichert":"Wird geladen …"}</small></div></div>`;
    h += `<div class="chips" style="margin-top:10px">
      <button class="chip" id="pF" aria-pressed="${!!S.pushForecast}">Prognose-Push</button>
      <button class="chip" id="pL" aria-pressed="${!!S.pushLive}">Mess-Push (Upwind)</button></div>`;
    if(!PENDING && (!rc || !same(rc, myCode(rc?rc.push:false))))
      h += `<div class="note">${rc?"Deine App-Einstellungen weichen von deinem gespeicherten Push ab.":"Deine Einstellungen sind noch nicht für Push gespeichert."} <button class="btn2" id="pSync" style="margin-top:6px">Einstellungen für Push speichern</button></div>`;
    if(PENDING){
      h += `<div class="note"><b>Speichern, wähle einen Weg:</b>
        <div class="chips"><a class="chip ok" href="${esc(issueURL(PENDING.push))}" target="_blank" rel="noopener">Mit GitHub-Konto senden</a>
        <button class="chip" id="pCode">Code kopieren (ohne GitHub)</button></div>
        <small>Mit GitHub: Es öffnet sich ein vorausgefülltes Formular, du tippst nur auf «Create». Nach etwa einer Minute kommt eine Bestätigung aufs Handy. Ohne GitHub: Code kopieren und dem Repo-Besitzer schicken.</small></div>`;
    }
  }
  if(PUSHMSG) h += `<div class="note">${esc(PUSHMSG)}</div>`;
  h += `<details><summary>So kommst du zu Push</summary><ol class="steps">
    <li>App <b>ntfy</b> installieren (iOS/Android, gratis, ohne Konto) und ein Thema mit zufälligem Namen abonnieren, z. B. <code>${esc(g.topicHint)}</code>. Wer das Thema kennt, sieht deine Nachrichten. Darum zufällig wählen und privat halten.</li>
    <li>Dem Repo-Besitzer <b>privat</b> deinen Namen (bei GitHub: GitHub-Name) und dein Thema schicken. Er schaltet dich frei.</li>
    <li>Oben deinen Namen eintragen, Schwelle und Einstellungen wählen, Schalter einschalten und speichern.</li>
    <li>Pausieren geht jederzeit auch direkt in der ntfy-App (Thema stummschalten).</li></ol></details>`;

  /* Verwaltung: nur mit Token (Repo-Besitz) */
  h += `<details${g.token?" open":""}><summary>${g.token?"Verwaltung (Repo-Besitz)":"Verwaltung (nur für den Repo-Besitzer)"}</summary>`;
  if(g.token){
    h += `<p style="font-size:.85rem">Freischalten: Im Repo unter Settings → Secrets and variables → Actions das Secret <code>NTFY_TOPICS</code> pflegen, Format <code>{"anna":"joran-…","ben":"joran-…"}</code>. Nur wer dort steht, bekommt Push oder kann über GitHub speichern.</p>`;
    if(!ADMIN) h += `<button class="btn2" id="aLoad">Nutzer anzeigen</button>`;
    else {
      if(ADMIN.msg) h += `<div class="note">${esc(ADMIN.msg)}</div>`;
      h += `<div class="tw"><table><tr><th>Name</th><th>Push</th><th class="n">Schwelle</th><th></th></tr>` + ADMIN.list.map(u=>{
        let c; try{ c = C.sanitizeCfg(u.cfg); }catch(e){ c = null; }
        return `<tr><td>${esc(u.id)}</td><td>${c?(c.push?"ein":"aus"):"ungültig"}</td><td class="n">${c?c.T+" kn":"–"}</td>
          <td class="n"><button class="btn2" data-test="${esc(u.id)}" style="padding:3px 7px">Test</button> <button class="btn2" data-del="${esc(u.id)}" style="padding:3px 7px">Löschen</button></td></tr>`;
      }).join("") + `</table></div>`;
      h += `<div class="fld" style="margin-top:10px"><div class="lab">Code eines Freundes ohne GitHub eintragen</div>
        <input type="text" id="aId" placeholder="Name, z. B. ben" autocomplete="off">
        <input type="text" id="aCode" placeholder="Einstellungs-Code einfügen" autocomplete="off">
        <div><button class="btn2" id="aSave">Für diesen Namen speichern</button></div></div>`;
    }
  }
  h += `<div class="fld" style="margin-top:10px">
      <input type="text" id="gOwner" value="${esc(g.owner)}" aria-label="GitHub-Besitzer des Repos" placeholder="GitHub-Besitzer">
      <input type="text" id="gRepo" value="${esc(g.repo)}" aria-label="Repository" placeholder="Repository">
      <input type="password" id="gTok" value="${esc(g.token)}" aria-label="Token" placeholder="Fine-grained Token (Contents und Actions: Read and write)" autocomplete="off">
      <div class="chips"><button class="btn2" id="gSave">Verbinden</button>${g.token?`<button class="btn2" id="gTest">Test an alle</button><button class="btn2" id="gDel">Token löschen</button>`:""}</div>
    </div></details>`;
  el.innerHTML = h;

  $("#gMeS").addEventListener("click", ()=>{ const x = loadG(); x.me = C.cleanId($("#gMe").value); saveG(x); PENDING = null; PUSHMSG = ""; MINE = undefined; readMine(); });
  const sw = $("#pushSw"); if(sw) sw.addEventListener("change", e=>sendMine(e.target.checked));
  const pf = $("#pF"); if(pf) pf.addEventListener("click", ()=>{ S.pushForecast = !S.pushForecast; saveS(); renderPush(); });
  const pl = $("#pL"); if(pl) pl.addEventListener("click", ()=>{ S.pushLive = !S.pushLive; saveS(); renderPush(); });
  const ps = $("#pSync"); if(ps) ps.addEventListener("click", ()=>sendMine(rc ? rc.push : true));
  const pc = $("#pCode"); if(pc) pc.addEventListener("click", async ()=>{
    const txt = JSON.stringify(Object.assign({name:g.me}, myCode(PENDING.push)));
    try{ await navigator.clipboard.writeText(txt); pc.textContent = "Kopiert, jetzt schicken"; }catch(e){ window.prompt("Code kopieren:", txt); }
  });
  $("#gSave").addEventListener("click", ()=>{ saveG(Object.assign(loadG(), {owner:$("#gOwner").value.trim(), repo:$("#gRepo").value.trim(), token:$("#gTok").value.trim()})); PUSHMSG = ""; ADMIN = null; readMine(); });
  const gt = $("#gTest"); if(gt) gt.addEventListener("click", ()=>testPush(""));
  const gd = $("#gDel"); if(gd) gd.addEventListener("click", ()=>{ const x = loadG(); x.token = ""; saveG(x); ADMIN = null; PUSHMSG = "Token gelöscht."; renderPush(); });
  const al = $("#aLoad"); if(al) al.addEventListener("click", loadAdmin);
  el.querySelectorAll("[data-test]").forEach(b=>b.addEventListener("click", ()=>testPush(b.dataset.test)));
  el.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click", async ()=>{
    if(!confirm(`Push-Einstellungen von «${b.dataset.del}» löschen?`)) return;
    try{ const cur = await gh("contents/users/"+b.dataset.del+".json");
      if(cur) await gh("contents/users/"+b.dataset.del+".json", {method:"DELETE", body:JSON.stringify({message:"Joran: "+b.dataset.del+" gelöscht", sha:cur.sha})});
      PUSHMSG = `«${b.dataset.del}» gelöscht. Thema auch aus NTFY_TOPICS entfernen.`; }catch(e){ PUSHMSG = "Löschen fehlgeschlagen: "+e.message; }
    loadAdmin();
  }));
  const asv = $("#aSave"); if(asv) asv.addEventListener("click", async ()=>{
    try{
      const code = JSON.parse($("#aCode").value);
      const id = C.cleanId($("#aId").value || code.name);
      if(!id) throw new Error("Name fehlt");
      await writeUserFile(id, code, "Joran: Einstellungen "+id);
      PUSHMSG = `Gespeichert für «${id}». Nicht vergessen: Thema in NTFY_TOPICS eintragen.`;
    }catch(e){ PUSHMSG = "Nicht gespeichert: "+e.message; }
    loadAdmin();
  });
}
