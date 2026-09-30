/* Joran — Push-Prüfung für alle Nutzer. Keine KI: feste Regeln aus core.js.
   Jeder Nutzer: eigene Datei users/<name>.json, eigenes ntfy-Thema im Secret NTFY_TOPICS. */
"use strict";
const fs = require("fs"), path = require("path");
const {C, readJSON, topics, loadUsers, send} = require("./lib.cjs");

const STATE_P = path.join(__dirname, "state.json");
const state = readJSON(STATE_P, {sent:{}}); state.sent = state.sent || {};
const before = JSON.stringify(state);
const NOW = process.env.JORAN_NOW ? new Date(process.env.JORAN_NOW) : new Date();

async function main(){
  const hb = state.heartbeat ? (NOW - new Date(state.heartbeat))/864e5 : 99;
  if(hb>25) state.heartbeat = NOW.toISOString();     /* hält den Zeitplan aktiv (60-Tage-Regel) */

  const T = topics(), users = loadUsers();
  const withTopic = users.filter(u=>T[u.id]);
  users.filter(u=>!T[u.id]).forEach(u=>console.log(`${u.id}: kein Thema in NTFY_TOPICS — übersprungen.`));

  if(process.env.JORAN_TEST==="1"){
    const only = C.cleanId(process.env.JORAN_USER||"");
    const list = only ? withTopic.filter(u=>u.id===only) : withTopic;
    if(!list.length) console.log("Kein passender Nutzer mit Thema für den Test.");
    for(const u of list) await send(T[u.id], "Joran: Test", `Push funktioniert. Dein Push ist ${u.cfg.push?"eingeschaltet":"ausgeschaltet"}, Schwelle ${u.cfg.T} kn.`, 3, ["white_check_mark"]);
    return;
  }
  const hour = C.localHour(NOW);
  if(hour<6 || hour>=21){ console.log("Ruhezeit."); return; }
  const active = withTopic.filter(u=>u.cfg.push);
  if(!active.length){ console.log("Kein Nutzer mit eingeschaltetem Push."); return; }

  const D = await C.fetchAll(active[0].cfg, {ens:false, jura:false});     /* Daten einmal für alle */
  console.log(`Modelle ${Object.keys(D.models).length}/4, Fehler:`, D.err, `— ${active.length} aktive Nutzer`);
  for(const u of active){
    try{ await checkUser(u, T[u.id], D); }
    catch(e){ console.log(`${u.id}: ${e.message}`); process.exitCode = 1; }
  }
}

async function checkUser(u, topic, D){
  const cfg = u.cfg, id = u.id, today = C.localDay(0, NOW), hour = C.localHour(NOW);
  const [h0,h1] = C.WINS[cfg.win];
  const K = k => `${id}|${k}`;
  const nModels = Object.keys(D.models).length;

  if(cfg.pushForecast && nModels){
    for(const off of [0,1]){
      if(off===0 && hour>=h0) continue;
      if(off===1 && hour<16) continue;
      const day = C.localDay(off, NOW), s = C.summarize(D.models, day, cfg);
      const key = K("fc:"+day), prev = state.sent[key];
      if(s.level>=cfg.cut && (!prev || s.level>prev.level)){
        await send(topic, `${off?"Morgen":"Heute"}: Wind ${C.LEVELS[s.level]}`, C.describe(s, cfg), s.level>=4?4:3, ["wind_face"]);
        state.sent[key] = {level:s.level, at:NOW.toISOString()};
      } else if(off===0 && prev && prev.level>=cfg.cut && s.level<cfg.cut && !state.sent[K("fx:"+day)]){
        await send(topic, "Heute: Entwarnung", `Die Modelle sehen ${cfg.T} kn nicht mehr. ${C.describe(s, cfg)||"Kaum Wind."}`, 2, ["cloud"]);
        state.sent[K("fx:"+day)] = {at:NOW.toISOString()};
      }
    }
  }
  if(cfg.pushLive && hour>=h0-2 && hour<=h1){
    const nc = C.nowcast(D.stations, cfg, NOW);
    if(nc.front.length && (state.sent[K("live:"+today)] || state.sent[K("fc:"+today)]) && !state.sent[K("front:"+today)]){
      await send(topic, "Böenfront — nicht rausfahren", nc.front.map(x=>`${x.up.name}: ${x.f.join(", ")}`).join("; "), 5, ["warning"]);
      state.sent[K("front:"+today)] = {at:NOW.toISOString()};
    } else if(!state.sent[K("live:"+today)] && !nc.front.length && (nc.eOk || nc.trusted.length)){
      const parts = [];
      if(nc.eOk) parts.push(`Joran-Regel E in Cressier: ${C.r0(nc.e.mean30)} kn seit ${C.hhmm(nc.e.since)}`);
      nc.trusted.forEach(x=>{ if(nc.eOk && x.up.abk==="crm") return;
        parts.push(`${x.up.name} ${C.r0(x.u.mean30)} kn ${x.u.sys?x.u.sys.name:C.card(x.u.last.dir)}${x.u.since?" seit "+C.hhmm(x.u.since):""}${x.u.trust==null?" (ungeprüft)":""}`); });
      await send(topic, "Wind kommt — Messung", parts.join("; "), 4, ["ocean"]);
      state.sent[K("live:"+today)] = {at:NOW.toISOString()};
    }
  }
}

function finish(){
  const lim = C.localDay(-10, NOW);
  Object.keys(state.sent).forEach(k=>{ const d = k.split(":").pop(); if(!/^\d{4}-\d{2}-\d{2}$/.test(d) || d<lim) delete state.sent[k]; });
  if(JSON.stringify(state)!==before){ fs.writeFileSync(STATE_P, JSON.stringify(state, null, 1)+"\n"); console.log("state.json aktualisiert."); }
}
main().then(finish).catch(e=>{ console.error(e); finish(); process.exitCode = 1; });
