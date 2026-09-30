/* Joran — gemeinsame Hilfen für die GitHub-Actions: Nutzer laden, ntfy senden */
"use strict";
const fs = require("fs"), path = require("path");
const C = require("../core.js");
const ROOT = path.join(__dirname, "..");
const USERS = path.join(ROOT, "users");
const PAGE = process.env.JORAN_URL || "";

function readJSON(p, d){ try{ return JSON.parse(fs.readFileSync(p, "utf8")); }catch(e){ return d; } }

/* Secret NTFY_TOPICS: {"name":"ntfy-thema", …}. Nur wer hier steht, bekommt Push. */
function topics(){
  let t = {};
  try{ t = JSON.parse(process.env.NTFY_TOPICS || "{}"); }catch(e){ console.log("NTFY_TOPICS ist kein gültiges JSON."); }
  const out = {};
  Object.keys(t).forEach(k=>{ const id = C.cleanId(k); if(id && typeof t[k]==="string" && t[k].trim()) out[id] = t[k].trim(); });
  return out;
}
function loadUsers(){
  const out = [];
  if(fs.existsSync(USERS)) fs.readdirSync(USERS).filter(f=>/^[a-z0-9-]+\.json$/.test(f)).forEach(f=>{
    const id = f.replace(/\.json$/,"");
    try{ out.push({id, cfg:C.sanitizeCfg(readJSON(path.join(USERS,f)))}); }
    catch(e){ console.log(`users/${f} übersprungen: ${e.message}`); }
  });
  return out;
}
async function send(topic, title, message, priority, tags){
  console.log(`PUSH [${priority}] ${title}: ${message}`);
  if(!topic){ console.log("  (kein Thema — nur Log)"); return; }
  const r = await fetch("https://ntfy.sh/", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify(Object.assign({topic, title, message, priority, tags}, PAGE?{click:PAGE}:{}))});
  if(!r.ok) throw new Error("ntfy HTTP "+r.status);
}
module.exports = {C, ROOT, USERS, readJSON, topics, loadUsers, send};
