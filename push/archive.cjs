/* Joran — Seemessung zusätzlich als eine Datei pro Tag ablegen: Branch «live», archive/JJJJ-MM-TT.json.
   Liest lake.json dieses Laufs und die bisherigen Tagesdateien aus origin/live, ergänzt nur die betroffenen Tage und
   schreibt den neuen Archiv-Baum (git tree) nach ARCHIVE_TREE. Der Schritt «Messreihe veröffentlichen» hängt ihn ein.
   Jeder Fehler bricht nur das Archivieren ab: Dann bleibt der bisherige Archiv-Baum unverändert, der Push-Lauf läuft weiter.
   Startbestand: Tagesdateien im Ordner archive/ des Repos, die im Branch «live» noch fehlen. */
"use strict";
const fs = require("fs"), path = require("path"), {execFileSync} = require("child_process");
const C = require("../core.js");

const git = (args, input) => execFileSync("git", args, {encoding:"utf8", input, stdio:["pipe","pipe","pipe"], timeout:20000});
const DAY = /^\d{4}-\d{2}-\d{2}\.json$/;

/* Reine Funktion: Zeilen einer Station aus alter Tagesdatei und lake.json vereinigen (Zeitstempel eindeutig) */
function mergeDay(prev, lake, day){
  const o = {day, st:{}};
  C.LAKE.forEach(L=>{
    const m = {};
    [prev, lake].forEach(x=>{ const d = x && x.st && x.st[L.id];
      ((d && d.rows) || []).forEach(r=>{ if(r && r.t && C.dayOfDate(new Date(r.t))===day) m[r.t] = r; }); });
    o.st[L.id] = {rows: Object.values(m).sort((a,b)=>a.t<b.t?-1:1)};
  });
  return o;
}
const nRows = x => C.LAKE.reduce((a,L)=>a + (((x && x.st && x.st[L.id] && x.st[L.id].rows) || []).length), 0);
/* Tage, die lake.json berührt */
const lakeDays = lk => [...new Set(C.LAKE.flatMap(L=>((lk.st[L.id] && lk.st[L.id].rows) || []).map(r=>C.dayOfDate(new Date(r.t)))))].sort();

function main(){
  const LAKE_P = process.env.JORAN_LAKE, OUT = process.env.ARCHIVE_TREE;
  if(!LAKE_P || !OUT){ console.log("Archiv: JORAN_LAKE oder ARCHIVE_TREE fehlt — übersprungen."); return; }
  if(!fs.existsSync(LAKE_P)){ console.log("Archiv: keine Messreihe — übersprungen."); return; }
  const lake = JSON.parse(fs.readFileSync(LAKE_P, "utf8"));
  let base = null;
  try{ base = git(["rev-parse","-q","--verify","origin/live^{commit}"]).trim(); }catch(e){}
  if(!base){
    /* Ohne frisch geholten Branch «live» nichts bauen: sonst ginge ein bestehendes Archiv verloren */
    if(git(["ls-remote","origin","refs/heads/live"]).trim()){ console.log("Archiv: Branch live nicht geholt — übersprungen."); return; }
  }
  /* bestehender Archiv-Baum: Name → ls-tree-Zeile */
  const old = {};
  if(base){
    let tree = "";
    try{ tree = git(["rev-parse","-q","--verify",base+":archive"]).trim(); }catch(e){}
    if(tree) git(["ls-tree", tree]).split("\n").filter(Boolean).forEach(l=>{ old[l.split("\t")[1]] = l; });
  }
  const repoDir = path.join(__dirname, "..", "archive");
  const seed = fs.existsSync(repoDir) ? fs.readdirSync(repoDir).filter(f=>DAY.test(f) && !old[f]) : [];
  const days = [...new Set(lakeDays(lake).concat(seed.map(f=>f.slice(0,10))))].sort();
  const lines = Object.assign({}, old);
  let changed = 0;
  for(const day of days){
    const f = day+".json";
    let prev = null;
    if(old[f]){
      /* vorhandene Datei muss lesbar sein, sonst bleibt sie unangetastet */
      try{ prev = JSON.parse(git(["cat-file","blob",old[f].split(/\s+/)[2]])); }
      catch(e){ console.log(`Archiv: ${f} nicht lesbar — bleibt unverändert.`); continue; }
    } else if(seed.includes(f)){
      try{ prev = JSON.parse(fs.readFileSync(path.join(repoDir, f), "utf8")); }catch(e){ prev = null; }
    }
    const next = mergeDay(prev, lake, day);
    if(old[f] && nRows(next)===nRows(prev)) continue;          /* nichts Neues */
    if(!nRows(next)) continue;
    next.updated = lake.updated || new Date().toISOString();
    const blob = git(["hash-object","-w","--stdin"], JSON.stringify(next)+"\n").trim();
    lines[f] = `100644 blob ${blob}\t${f}`;
    changed++;
  }
  if(!changed){ console.log(`Archiv: unverändert (${Object.keys(old).length} Tage).`); return; }
  if(Object.keys(lines).length < Object.keys(old).length) throw new Error("Archiv würde schrumpfen");
  const tree = git(["mktree"], Object.keys(lines).sort().map(k=>lines[k]).join("\n")+"\n").trim();
  fs.writeFileSync(OUT, tree+"\n");
  console.log(`Archiv: ${changed} Tag(e) nachgeführt, ${Object.keys(lines).length} Tage im Archiv.`);
}

if(require.main===module){
  try{ main(); }catch(e){ console.log("Archiv: Fehler, bisheriges Archiv bleibt — "+(e.message||e)); }
}
module.exports = {mergeDay, lakeDays};
