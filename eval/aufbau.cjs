#!/usr/bin/env node
/* Joran — Aufbauprüfung: Hält der Code die Regeln aus ARCHITEKTUR.md ein? Ohne Netz, ohne Daten, unter einer Sekunde.
   Aufruf: node eval/aufbau.cjs
   Ende mit Fehlercode 1, sobald eine Regel verletzt ist. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const ls = (d, re) => fs.readdirSync(path.join(ROOT, d)).filter(f=>re.test(f)).sort();
let fail = 0;
const ok = (name, cond, info) => { console.log(`${cond ? "ok  " : "FEHL"} ${name}${!cond && info ? " — "+info : ""}`); if(!cond) fail++; };
/* Kommentare und Zeichenketten entfernen, damit nur Code geprüft wird */
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1").replace(/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, m=>/^["'](?:[a-z]+|\.\.?\/[\w./-]+)["']$/.test(m) ? m : '""');

/* ---------- Rechenkern: Silos und Fassade ---------- */
const fac = read("core.js");
const siloBlock = (fac.match(/const SILOS = \{([\s\S]*?)\n\};/) || [])[1] || "";
const order = [...siloBlock.matchAll(/^\s{2}(\w+):/gm)].map(m=>m[1]);
const files = ls("core", /\.js$/).map(f=>f.replace(/\.js$/, ""));
ok("Jede Datei unter core/ steht in der Fassade, jede Zeile der Fassade hat eine Datei", order.length>0 && files.every(f=>order.includes(f)) && order.every(s=>files.includes(s)),
  `Fassade: ${order.join(", ")} | Dateien: ${files.join(", ")}`);
const deps = {};
order.forEach(s=>{ const src = read(`core/${s}.js`); deps[s] = [...new Set([...code(src).matchAll(/\bdep\("(\w+)"\)/g)].map(m=>m[1]))]; });
const wrong = order.flatMap(s=>deps[s].filter(d=>order.indexOf(d)<0 || order.indexOf(d)>=order.indexOf(s)).map(d=>`${s} → ${d}`));
ok("Ein Silo braucht nur Silos, die in der Fassade weiter oben stehen (keine Kreise)", wrong.length===0, wrong.join(", "));
const head = order.filter(s=>{ const m = read(`core/${s}.js`).match(/Hängt ab von: ([^.]*)\./); const said = m ? m[1].split(",").map(x=>x.trim()).filter(x=>x && x!=="nichts").sort() : null;
  return !said || said.join()!==deps[s].slice().sort().join(); });
ok("Kopfkommentar «Hängt ab von» stimmt mit dem Code überein", head.length===0, head.join(", "));
const net = order.filter(s=>s!=="daten" && /\bfetch\s*\(|XMLHttpRequest/.test(code(read(`core/${s}.js`))));
ok("Nur das Silo «daten» geht ins Netz", net.length===0, net.join(", "));
const dom = order.filter(s=>/\bdocument\.|\blocalStorage\b|\bwindow\./.test(code(read(`core/${s}.js`))));
ok("Der Rechenkern kennt weder Seite noch Browser-Speicher", dom.length===0, dom.join(", "));
let C = null, err = "";
try{ C = require(path.join(ROOT, "core.js")); }catch(e){ err = e.message; }
ok("Fassade lädt, jeder öffentliche Name ist vorhanden", !!C, err);
ok("MODEL.active ist false (App rechnet mit den Startwerten)", !!C && C.MODEL.active===false);
const inner = [];
["push", "eval", "proxy"].forEach(d=>{ if(!fs.existsSync(path.join(ROOT, d))) return; ls(d, /\.(c?js)$/).forEach(f=>{ if(/require\([^)]*core\/\w+\.js/.test(read(`${d}/${f}`))) inner.push(`${d}/${f}`); }); });
ok("Action und Auswertung brauchen nur die Fassade core.js, nie ein Silo direkt", inner.length===0, inner.join(", "));

/* ---------- Oberfläche ---------- */
const html = read("index.html");
const tags = [...html.matchAll(/<script src="([^"?]+)\?v=(\d+)"><\/script>/g)].map(m=>({src:m[1], v:m[2]}));
const want = order.map(s=>`core/${s}.js`).concat("core.js");
ok("index.html lädt die Silos in der Reihenfolge der Fassade, danach core.js", tags.slice(0, want.length).map(t=>t.src).join()===want.join(), tags.slice(0, want.length).map(t=>t.src).join(", "));
const app = tags.slice(want.length).map(t=>t.src), appFiles = ls("app", /\.js$/).map(f=>"app/"+f);
ok("index.html lädt jede Datei unter app/, start.js zuletzt", app.every(a=>appFiles.includes(a)) && appFiles.every(a=>app.includes(a)) && app[app.length-1]==="app/start.js",
  `geladen: ${app.join(", ")} | vorhanden: ${appFiles.join(", ")}`);
const css = (html.match(/href="app\/app\.css\?v=(\d+)"/) || [])[1], shown = (html.match(/Wingfoil Bielersee · v(\d+)/) || [])[1];
const vs = [...new Set(tags.map(t=>t.v).concat(css || "?", shown || "?"))];
ok("Eine Version für alle Dateien und die Kopfzeile", vs.length===1, `gefunden: ${vs.join(", ")}`);
ok("index.html enthält keinen eigenen Programmcode ausser der Darstellung vor dem ersten Zeichnen", (html.match(/<script>/g) || []).length===1 && !/<style>/.test(html));
const said = appFiles.filter(f=>{ const m = read(f).match(/Reihenfolge in index\.html:\s*([^.]*)\./); return !m || m[1].split(",").map(x=>"app/"+x.trim()+".js").join()!==app.join(); });
ok("Kopfkommentar der Dateien unter app/ nennt die Reihenfolge aus index.html", said.length===0, said.join(", "));
const gh = appFiles.filter(f=>f!=="app/push.js" && /api\.github\.com/.test(read(f)));
ok("Nur app/push.js spricht mit der GitHub-API", gh.length===0, gh.join(", "));
const direct = appFiles.filter(f=>/\bfetch\s*\(/.test(code(read(f))) && !["app/push.js"].includes(f));
ok("Die Oberfläche holt Wetterdaten nur über den Rechenkern", direct.length===0, direct.join(", "));

console.log(fail ? `\n${fail} Regel(n) verletzt` : "\nAufbau in Ordnung");
process.exitCode = fail ? 1 : 0;
