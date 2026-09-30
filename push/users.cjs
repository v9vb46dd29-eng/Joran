/* Joran — speichert Push-Einstellungen aus einem GitHub-Issue.
   Geschrieben wird ausschliesslich users/<Issue-Autor>.json: Niemand kann fremde Einstellungen ändern.
   Nur Nutzer mit Thema im Secret NTFY_TOPICS werden angenommen (Freigabe durch die Repo-Besitzerin/den Besitzer). */
"use strict";
const fs = require("fs"), path = require("path");
const {C, USERS, topics, send} = require("./lib.cjs");

const body = process.env.ISSUE_BODY || "";
const id = C.cleanId(process.env.ISSUE_USER);
const RES = process.env.RESULT_FILE || "/tmp/joran_result.md";
const out = (ok, msg) => { fs.writeFileSync(RES, msg); fs.writeFileSync(RES+".ok", ok?"1":"0"); console.log(msg); };

async function main(){
  const T = topics();
  if(!id) return out(false, "Kein gültiger GitHub-Name.");
  if(!T[id]) return out(false, `@${process.env.ISSUE_USER}, du bist für Joran-Push noch nicht freigeschaltet. Schick dem Repo-Besitzer deinen GitHub-Namen und dein ntfy-Thema. Sobald du freigeschaltet bist, schliesse dieses Issue und öffne es wieder — dann wird es erneut verarbeitet.`);
  const aktion = (body.match(/###\s*Aktion\s+([^\n]+)/) || [])[1] || "Speichern";
  const file = path.join(USERS, id+".json");
  if(/l[öo]schen/i.test(aktion)){
    if(fs.existsSync(file)) fs.unlinkSync(file);
    await send(T[id], "Joran: abgemeldet", "Deine Push-Einstellungen sind gelöscht.", 2, ["wave"]).catch(()=>{});
    return out(true, `Push-Einstellungen von @${process.env.ISSUE_USER} gelöscht.`);
  }
  const a = body.indexOf("{"), b = body.lastIndexOf("}");
  if(a<0 || b<a) return out(false, "Im Issue steht kein Einstellungs-Code. Bitte den Code aus der Joran-App einfügen.");
  let cfg;
  try{ cfg = C.sanitizeCfg(JSON.parse(body.slice(a, b+1))); }
  catch(e){ return out(false, "Der Einstellungs-Code ist ungültig: "+e.message); }
  fs.mkdirSync(USERS, {recursive:true});
  fs.writeFileSync(file, JSON.stringify(C.pushCfg(cfg), null, 1)+"\n");
  const txt = `Schwelle ${cfg.T} kn, ${C.WINS[cfg.win][2]}, Push ${cfg.push?"ein":"aus"}.`;
  await send(T[id], "Joran: Einstellungen gespeichert", txt, 3, ["white_check_mark"]).catch(e=>console.log(e.message));
  return out(true, `Gespeichert für @${process.env.ISSUE_USER}: ${txt}`);
}
main().catch(e=>out(false, "Fehler: "+e.message));
