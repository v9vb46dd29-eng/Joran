/* Joran — Oberfläche «windbild». Sektion «Windbild»: Karte der Bieler Bucht mit dem typischen Wind je Lage, Lage von heute vorgewählt, Wind von jetzt an Vingelz und Ipsach daneben. Zahlen aus data/windbild.json (über den Rechenkern geladen), Geometrie der Karte hier.
   Klassisches Skript: teilt sich die Namen mit den anderen Dateien unter app/. Reihenfolge in index.html:
   basis, see, live, einstellungen, push, rueckblick, windbild, start. Aufbau und Regeln: ARCHITEKTUR.md */
"use strict";
const WB = (function(){
/* ---------- Geografie (vereinfacht, schematisch) ---------- */
const LAT0 = 47.09, LON0 = 7.15, KX = 75.8, KY = 111.2;
const km = ([lat,lon]) => [(lon-LON0)*KX, (lat-LAT0)*KY];
const VIEWS = {
  see:   {name:"See",   lon:[7.045,7.272], lat:[47.028,47.150]},
  bucht: {name:"Bucht", lon:[7.170,7.258], lat:[47.098,47.141]}
};
const SHORE = [[47.1335,7.2365],[47.1315,7.2270],[47.1290,7.2200],[47.1268,7.2155],[47.1235,7.2100],[47.1200,7.2040],[47.1170,7.1975],[47.1135,7.1900],[47.1080,7.1810],[47.1020,7.1715],[47.0965,7.1610],[47.0935,7.1540],[47.0890,7.1445],[47.0845,7.1355],[47.0790,7.1220],[47.0730,7.1100],[47.0665,7.1000],[47.0610,7.0880],[47.0560,7.0770],[47.0525,7.0700],[47.0490,7.0720],[47.0465,7.0820],[47.0440,7.0930],[47.0405,7.1030],[47.0360,7.1110],[47.0370,7.1250],[47.0410,7.1400],[47.0450,7.1520],[47.0505,7.1680],[47.0555,7.1810],[47.0620,7.1910],[47.0700,7.2000],[47.0790,7.2085],[47.0870,7.2140],[47.0960,7.2180],[47.1040,7.2215],[47.1110,7.2245],[47.1170,7.2270],[47.1215,7.2320],[47.1250,7.2390],[47.1290,7.2410],[47.1320,7.2400]];
const ISLAND = [[47.0445,7.0985],[47.0520,7.1090],[47.0600,7.1200],[47.0680,7.1340],[47.0740,7.1450],[47.0790,7.1540],[47.0835,7.1630],[47.0815,7.1665],[47.0770,7.1600],[47.0720,7.1500],[47.0660,7.1385],[47.0590,7.1250],[47.0510,7.1130],[47.0430,7.1010]];
const RIDGES = [
  {w:5.5, p:[[47.064,7.075],[47.080,7.105],[47.096,7.132],[47.110,7.158],[47.124,7.185],[47.136,7.208],[47.147,7.235],[47.160,7.270],[47.175,7.315]]},
  {w:7, p:[[47.080,6.930],[47.105,6.990],[47.132,7.054],[47.150,7.110],[47.166,7.170],[47.180,7.225],[47.196,7.290],[47.205,7.33]]},
  {w:2.5, p:[[47.026,7.080],[47.034,7.105],[47.040,7.125]]}
];
const CANALS = [
  [[47.051,7.071],[47.035,7.045],[47.016,7.012]],
  [[47.056,7.184],[47.052,7.215],[47.048,7.250],[47.045,7.285],[47.043,7.32]],
  [[47.127,7.241],[47.135,7.262],[47.146,7.285],[47.158,7.31],[47.17,7.335]]
];
/* Ortsnamen: [Name, lat, lon, ab Ausschnitt (1 See, 2 Bucht), Art] */
const LABELS = [
  ["Bielersee",47.074,7.178,1,"lakeB"],["Biel/Bienne",47.142,7.247,1,"town"],["Nidau",47.1225,7.2475,1,"town"],
  ["La Neuveville",47.069,7.086,1,"town"],["Twann",47.0995,7.1515,1,"town"],["Erlach",47.037,7.093,1,"town"],
  ["Sutz",47.1015,7.2285,1,"town"],["Tüscherz",47.1135,7.1785,1,"town"],["Alfermée",47.1215,7.1915,2,"town"],
  ["Ligerz",47.0895,7.1275,1,"town"],["Lüscherz",47.0395,7.157,1,"town"],["Hagneck",47.0515,7.195,1,"town"],
  ["Mörigen",47.0845,7.223,1,"town"],["Magglingen",47.1395,7.2085,2,"town"],["Chasseral",47.1395,7.075,1,"peak"],
  ["St. Petersinsel",47.058,7.112,1,"lake"]
];
const MARK = {vin:[47.127,7.218], ips:[47.119,7.224]};
/* Orte der Stützpunkte in data/windbild.json */
const PT = {
  vin:[47.127,7.218], ips:[47.119,7.224], cha:[47.132,7.054], crm:[47.046,7.040], coy:[47.179,7.071],
  neuv:[47.056,7.090], lig:[47.075,7.125], twa:[47.090,7.175], sutz:[47.100,7.205], mor:[47.080,7.195], bay:[47.122,7.223],
  alf:[47.115,7.200], tus:[47.108,7.185], nid:[47.128,7.245], biel:[47.140,7.250], mag:[47.141,7.205], seel:[47.060,7.230],
  erl:[47.035,7.090], pla:[47.110,7.100], son:[47.196,7.172], val:[47.190,7.130], pery:[47.193,7.240], frin:[47.168,7.258],
  tlx:[47.153,7.266], gre:[47.180,7.330], neu:[47.020,7.000], hag:[47.050,7.270], twb:[47.105,7.140], lus:[47.042,7.150],
  bayN:[47.1265,7.231], split:[47.121,7.213]
};
/* Farbskala in kn */
const STOPS = [[0,[64,82,128]],[4,[56,124,196]],[8,[44,174,186]],[12,[92,196,96]],[16,[230,214,64]],[20,[244,146,44]],[25,[222,60,52]],[30,[186,40,136]],[35,[132,44,168]]];
const KN_MAX = 35;
function col(s){ if(s<=0) return STOPS[0][1];
  for(let i=1;i<STOPS.length;i++){ if(s<=STOPS[i][0]){ const [a,ca] = STOPS[i-1], [b,cb] = STOPS[i], t = (s-a)/(b-a); return ca.map((x,k)=>Math.round(x+(cb[k]-x)*t)); } }
  return STOPS[STOPS.length-1][1]; }
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

/* ---------- Lage von heute ---------- */
/* Windsektor (DIRS im Rechenkern) → Lage der Karte. Südost hat kein eigenes Windbild. */
const SEK = {w:"west", s:"sued", bise:"bise", n:"nord", joran:"joran"};
/* Reine Funktion, damit sie sich mit künstlichen Daten prüfen lässt.
   x = {nc: Ergebnis von nowcast (nur im Zeitfenster übergeben), s: Ergebnis von summarize für heute, lake: Ergebnis von lakeNow,
        hd: Ergebnis von hoeheDay, jc: Ergebnis von joranCheck, monat: 1–12}
   Reihenfolge: Signal «Wind kommt», sonst Prognose im Zeitfenster, sonst Seemessung. */
function vorwahl(x){
  let sek = null, quelle = "";
  const nc = x.nc;
  if(nc && nc.eOk){ sek = "joran"; quelle = "Signal «Wind kommt» (Cressier)"; }
  if(!sek && nc && (nc.trusted||[]).length){
    const t = nc.trusted.find(z=>z.u && z.u.sys);
    if(t){ sek = t.u.sys.id; quelle = `Signal «Wind kommt» (${t.up.name})`; }
  }
  if(!sek && x.s && x.s.top && x.s.top.d!=null){ const d = dirOf(x.s.top.d); if(d){ sek = d.id; quelle = "Prognose im Zeitfenster"; } }
  if(!sek){
    const f = (x.lake||[]).filter(z=>z.fresh && z.last && z.last.dir!=null && z.last.mean>=3).sort((a,b)=>b.last.mean-a.last.mean)[0];
    const d = f ? dirOf(f.last.dir) : null;
    if(d){ sek = d.id; quelle = `Seemessung ${f.L.name}`; }
  }
  if(!sek) return {lage:null, vk:null, quelle:"", grund:"Lage von heute noch offen."};
  if(!SEK[sek]) return {lage:null, vk:null, quelle, grund:"Heute Südost: Dafür gibt es noch kein Windbild."};
  const lage = SEK[sek];
  let vk = null;
  if(lage==="west") vk = x.hd && x.hd.coupled===false ? "stab" : "mix";
  if(lage==="joran") vk = x.jc && x.jc.bnOk ? "front" : x.monat>=5 && x.monat<=8 ? "abend" : "front";
  return {lage, vk, quelle, grund:""};
}
function heute(){
  const day = localDay(0), hour = C.localHour(), [h0,h1] = WINS[S.win];
  const x = {monat:+day.slice(5,7), lake:C.lakeNow(LK, S)};
  try{ if(D && D.models && Object.keys(D.models).length) x.s = summarize(D.models, day, S); }catch(e){}
  try{ if(D && D.stations && hour>=h0-2 && hour<=h1) x.nc = C.nowcast(D.stations, S, undefined, LK); }catch(e){}
  try{ if(D && D.hoehe) x.hd = C.hoeheDay(D.hoehe, day, S); }catch(e){}
  try{ if(D && D.jura) x.jc = C.joranCheck(D.jura, day, S, 0); }catch(e){}
  return vorwahl(x);
}

/* ---------- Zustand ---------- */
const V_KEY = "joran.windbild.v1";
const ST = {auto:true, type:"west", vk:{}, view:"bucht"};
try{ const v = localStorage.getItem(V_KEY); if(v && VIEWS[v]) ST.view = v; }catch(e){}
let DATA = null, LOADING = false, HEUTE = {lage:null, vk:null, quelle:"", grund:""};
let el = null, mapEl = null, base = null, flow = null, bctx = null, fctx = null, drawn = "", visible = false, raf = 0;
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const isDark = () => { const t = document.documentElement.getAttribute("data-theme"); return t ? t==="dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
const lageOf = () => DATA.lagen.find(l=>l.id===ST.type) || DATA.lagen[0];
const varOf = () => { const l = lageOf(); return l.vars.find(v=>v.key===ST.vk[l.id]) || l.vars[0]; };
/* typischer Wert eines Spots = sein Stützpunkt in dieser Lage */
const typ = id => { const a = varOf().a.find(z=>z[0]===id); return a ? {dir:a[1], kn:a[2], m:!!a[3]} : null; };
const jetzt = id => { const z = C.lakeNow(LK, S).find(q=>q.L.id===id); return z && z.fresh && z.last ? z.last : null; };

/* ---------- Feld: Stützpunkte, Interpolation mit inversen Distanzen (kein Strömungsmodell) ---------- */
let ANCH = [], W = 0, Hh = 0, DPR = 1, GW = 0, GH = 0, GU = null, GV = null, parts = [];
const T = {cx:0, cy:0, k:1}, CELL = 3;
function setAnchors(){
  ANCH = varOf().a.filter(a=>PT[a[0]]).map(([p,d,s,m])=>{ const [x,y] = km(PT[p]), r = d*Math.PI/180; return {x, y, u:-s*Math.sin(r), v:-s*Math.cos(r), m:!!m}; });
}
function fieldAt(x, y){
  let su = 0, sv = 0, sw = 0;
  for(const a of ANCH){ const dx = x-a.x, dy = y-a.y, w = 1/(dx*dx+dy*dy+0.06), w2 = w*w; su += a.u*w2; sv += a.v*w2; sw += w2; }
  return sw ? [su/sw, sv/sw] : [0,0];
}
const toPx = ([x,y]) => [W/2+(x-T.cx)*T.k, Hh/2-(y-T.cy)*T.k];
const toKm = (px,py) => [T.cx+(px-W/2)/T.k, T.cy-(py-Hh/2)/T.k];
const P = ll => toPx(km(ll));
function fit(){
  const r = mapEl.getBoundingClientRect(); W = r.width; Hh = r.height; DPR = Math.min(2, window.devicePixelRatio||1);
  [base, flow].forEach(c=>{ c.width = Math.round(W*DPR); c.height = Math.round(Hh*DPR); });
  bctx.setTransform(DPR,0,0,DPR,0,0); fctx.setTransform(DPR,0,0,DPR,0,0);
  const V = VIEWS[ST.view], [x0,y0] = km([V.lat[0],V.lon[0]]), [x1,y1] = km([V.lat[1],V.lon[1]]);
  T.cx = (x0+x1)/2; T.cy = (y0+y1)/2; T.k = Math.min(W/(x1-x0), Hh/(y1-y0));
}
function poly(ctx, pts){ ctx.moveTo(...P(pts[0])); for(let i=1;i<pts.length;i++) ctx.lineTo(...P(pts[i])); ctx.closePath(); }
function line(ctx, pts){ ctx.beginPath(); ctx.moveTo(...P(pts[0])); for(let i=1;i<pts.length;i++) ctx.lineTo(...P(pts[i])); }
function sample(px, py){
  const gx = px/CELL, gy = py/CELL, i = Math.max(0, Math.min(GW-2, Math.floor(gx))), j = Math.max(0, Math.min(GH-2, Math.floor(gy))), fx = gx-i, fy = gy-j;
  const o = j*GW+i, b = A => A[o]*(1-fx)*(1-fy)+A[o+1]*fx*(1-fy)+A[o+GW]*(1-fx)*fy+A[o+GW+1]*fx*fy;
  return [b(GU), b(GV)];
}
function drawBase(){
  const dark = isDark(), z = ST.view==="see" ? 1 : 2;
  const K = dark ? {land:"#1b2229", lake:"#1c3345", shore:"#5a7a92", ridge:"rgba(120,138,155,.05)", crest:"rgba(190,205,218,.22)", canal:"rgba(120,165,195,.6)", ink:"rgba(228,235,240,.9)", inkL:"rgba(200,225,240,.85)", halo:"rgba(10,14,18,.75)", dot:"#fff", dotE:"#0e1318"}
                 : {land:"#e6e9ec", lake:"#cfe3ef", shore:"#5f8199", ridge:"rgba(70,90,110,.055)", crest:"rgba(60,80,100,.25)", canal:"rgba(70,125,165,.7)", ink:"rgba(20,28,36,.88)", inkL:"rgba(20,60,90,.85)", halo:"rgba(255,255,255,.8)", dot:"#fff", dotE:"#1c2b30"};
  GW = Math.ceil(W/CELL)+1; GH = Math.ceil(Hh/CELL)+1; GU = new Float32Array(GW*GH); GV = new Float32Array(GW*GH);
  const off = document.createElement("canvas"); off.width = GW; off.height = GH;
  const octx = off.getContext("2d"), img = octx.createImageData(GW, GH);
  for(let j=0;j<GH;j++) for(let i=0;i<GW;i++){
    const [x,y] = toKm(i*CELL, j*CELL), [u,v] = fieldAt(x,y), c = col(Math.hypot(u,v)), o = j*GW+i;
    GU[o] = u; GV[o] = v; img.data[o*4] = c[0]; img.data[o*4+1] = c[1]; img.data[o*4+2] = c[2]; img.data[o*4+3] = 255;
  }
  octx.putImageData(img, 0, 0);
  const ctx = bctx; ctx.clearRect(0,0,W,Hh);
  ctx.fillStyle = K.land; ctx.fillRect(0,0,W,Hh);
  RIDGES.forEach(r=>{ for(let k=6;k>=1;k--){ ctx.strokeStyle = K.ridge; ctx.lineWidth = r.w*k*T.k*0.12; ctx.lineCap = "round"; ctx.lineJoin = "round"; line(ctx, r.p); ctx.stroke(); } });
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = dark ? 0.36 : 0.42; ctx.drawImage(off, 0, 0, GW*CELL, GH*CELL); ctx.globalAlpha = 1;
  ctx.save(); ctx.beginPath(); poly(ctx, SHORE); poly(ctx, ISLAND); ctx.clip("evenodd");
  ctx.fillStyle = K.lake; ctx.fillRect(0,0,W,Hh); ctx.globalAlpha = 0.88; ctx.drawImage(off, 0, 0, GW*CELL, GH*CELL); ctx.restore();
  ctx.strokeStyle = K.shore; ctx.lineWidth = 1.2; ctx.beginPath(); poly(ctx, SHORE); poly(ctx, ISLAND); ctx.stroke();
  ctx.strokeStyle = K.canal; ctx.lineWidth = 1.6; CANALS.forEach(c=>{ line(ctx, c); ctx.stroke(); });
  ctx.strokeStyle = K.crest; ctx.lineWidth = 1; RIDGES.forEach(r=>{ line(ctx, r.p); ctx.stroke(); });
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  const F = "-apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  /* Namen nur, wo sie ganz ins Bild passen und weder ein Spot-Schild noch einen anderen Namen überdecken */
  const used = badgePos().map(b=>[b.x-76, b.y-24, 152, 48]);
  LABELS.forEach(([n,lat,lon,zz,kind])=>{
    if(z<zz || (z===2 && kind==="peak")) return;
    const [x,y] = P([lat,lon]);
    ctx.font = kind==="lakeB" ? `italic 600 14px ${F}` : kind==="lake" ? `italic 500 11.5px ${F}` : kind==="peak" ? `600 12px ${F}` : `500 11.5px ${F}`;
    const tw = ctx.measureText(n).width, box = [x-tw/2-3, y-9, tw+6, 18];
    if(box[0]<4 || box[0]+box[2]>W-4 || box[1]<4 || box[1]+box[3]>Hh-26) return;
    if(used.some(u=>box[0]<u[0]+u[2] && u[0]<box[0]+box[2] && box[1]<u[1]+u[3] && u[1]<box[1]+box[3])) return;
    used.push(box);
    ctx.lineWidth = 3; ctx.strokeStyle = K.halo; ctx.fillStyle = kind==="lakeB" || kind==="lake" ? K.inkL : K.ink;
    ctx.strokeText(n, x, y); ctx.fillText(n, x, y);
  });
  Object.values(MARK).forEach(ll=>{ const [x,y] = P(ll); ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI*2); ctx.fillStyle = K.dot; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = K.dotE; ctx.stroke(); });
  if(reduce()) drawArrows(dark);
}
/* Ohne Bewegung: Pfeile im Raster statt Strömungslinien */
function drawArrows(dark){
  const ctx = bctx, st = Math.max(34, Math.min(W,Hh)/11), c = dark ? "rgba(255,255,255,.85)" : "rgba(15,25,35,.75)";
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 1.4;
  for(let py=st/2; py<Hh; py+=st) for(let px=st/2; px<W; px+=st){
    const [u,v] = sample(px,py), s = Math.hypot(u,v); if(s<1) continue;
    const L = Math.min(st*0.8, 6+s*1.1), ux = u/s, uy = -v/s, x0 = px-ux*L/2, y0 = py-uy*L/2, x1 = px+ux*L/2, y1 = py+uy*L/2;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x1-ux*6-uy*3.5, y1-uy*6+ux*3.5); ctx.lineTo(x1-ux*6+uy*3.5, y1-uy*6-ux*3.5); ctx.closePath(); ctx.fill();
  }
}
/* Strömungslinien: laufen nur, solange die Karte im Bild ist, die Seite sichtbar ist und Bewegung erwünscht ist */
const newPart = () => ({x:Math.random()*W, y:Math.random()*Hh, age:Math.floor(Math.random()*80)});
function seed(){ parts = Array.from({length:Math.round(W*Hh/430)}, newPart); fctx.clearRect(0,0,W,Hh); }
function tick(){
  raf = 0;
  if(!visible || document.hidden || reduce() || !GU) return;
  fctx.globalCompositeOperation = "destination-in"; fctx.fillStyle = "rgba(0,0,0,0.89)"; fctx.fillRect(0,0,W,Hh);
  fctx.globalCompositeOperation = "source-over"; fctx.strokeStyle = isDark() ? "rgba(255,255,255,.78)" : "rgba(15,25,35,.45)"; fctx.lineWidth = 1.1; fctx.beginPath();
  for(const p of parts){
    const [u,v] = sample(p.x,p.y), s = Math.hypot(u,v), nx = p.x+u*0.075, ny = p.y-v*0.075;
    if(s>0.6){ fctx.moveTo(p.x,p.y); fctx.lineTo(nx,ny); }
    p.x = nx; p.y = ny; p.age++;
    if(p.age>90 || p.x<0 || p.y<0 || p.x>W || p.y>Hh || (s<0.6 && Math.random()<0.05)){ Object.assign(p, newPart()); p.age = 0; }
  }
  fctx.stroke();
  raf = requestAnimationFrame(tick);
}
function play(){ if(!raf && visible && !document.hidden && !reduce() && GU) raf = requestAnimationFrame(tick); }

/* ---------- Anzeige ---------- */
const knTxt = (t, est) => t ? `${est?"~":""}${r0(t.kn)} kn ${card(t.dir)}` : "–";
function dot(dir, kn){ return `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9.5" fill="${rgb(col(kn))}"/><g transform="rotate(${(dir+180)%360})"><path d="M0-6.5 L4.2 3 L0 .8 L-4.2 3Z" fill="#0b0f13"/></g></svg>`; }
/* Ort der Spot-Schilder: Vingelz über, Ipsach unter dem Messpunkt, immer ganz im Bild */
function badgePos(){
  return C.LAKE.map(L=>{ let [x,y] = P(MARK[L.id]); if(x<0 || y<0 || x>W || y>Hh) return null;
    y += L.id==="vin" ? -24 : 24; x += L.id==="vin" ? -14 : 14;
    return {L, x:Math.max(78, Math.min(W-78, x)), y:Math.max(24, Math.min(Hh-24, y))}; }).filter(Boolean);
}
function badges(){
  const box = el.querySelector(".wbbadges"); let h = "";
  badgePos().forEach(({L, x, y})=>{
    const t = typ(L.id), n = jetzt(L.id); if(!t) return;
    /* gross der Wind von jetzt (Punkt und Pfeil dazu), klein der typische Wert der Lage */
    const now = n ? dot(n.dir, n.mean) : `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9.5" fill="#8a8a8e"/></svg>`;
    h += `<div class="wbbadge" style="left:${x}px;top:${y}px">${now}<span><b>${L.name} ${n ? r0(n.mean)+" kn "+card(n.dir) : "–"}</b><small>typisch ${t.m?"":"~"}${r0(t.kn)} kn ${card(t.dir)}</small></span></div>`;
  });
  box.innerHTML = h;
}
function besser(){
  const i = typ("ips"), v = typ("vin"); if(!i || !v) return "";
  const est = !(i.m && v.m) ? " (geschätzt)" : "";
  if(Math.max(i.kn, v.kn) < 6) return "Bei dieser Lage reicht es meist an keinem Spot.";
  if(Math.abs(i.kn-v.kn) < 2) return `Beide Spots sind ähnlich stark${est}.`;
  return `Besser bei dieser Lage: <b>${i.kn>v.kn ? "Ipsach" : "Vingelz"}</b>${est}.`;
}
function panel(){
  const l = lageOf(), V = varOf();
  const status = V.status==="m" ? ["m", `Gemessen an ${V.tage} Tagen`] : V.status==="e" ? ["e", V.tage===1 ? "Erst ein Tag gemessen" : `Erst ${V.tage} Tage gemessen`] : ["s", "Geschätzt, noch nicht gemessen"];
  /* Anteil der Zeit ab der Schwelle: für die eingestellte Schwelle, sonst für die nächste gerechnete */
  const keys = Object.keys(V.anteil||{}).map(Number), Tk = keys.length ? keys.reduce((a,b)=>Math.abs(b-S.T)<Math.abs(a-S.T) ? b : a) : null;
  const an = id => { const a = Tk!=null && V.anteil[Tk][id]; return a ? (a[0]===a[1] ? a[0] : a[0]+"–"+a[1])+" %" : "–"; };
  const rows = C.LAKE.map(L=>{ const t = typ(L.id), n = jetzt(L.id);
    return `<tr><td><b>${L.name}</b></td><td class="n">${knTxt(t, t && !t.m)}</td><td class="n">${n ? r0(n.mean)+" kn "+card(n.dir) : "–"}</td>${Tk!=null?`<td class="n">${an(L.id)}</td>`:""}</tr>`; }).join("");
  el.querySelector(".wbpanel").innerHTML = `<span class="wbstatus ${status[0]}">${status[1]}</span>
    <p><b>${esc(l.name)}${l.vars.length>1 ? ": "+esc(V.label) : ""}.</b> ${esc(V.text)}</p>
    <div class="tw"><table><tr><th>Spot</th><th class="n">typisch</th><th class="n">jetzt</th>${Tk!=null?`<th class="n">Zeit ab ${Tk} kn</th>`:""}</tr>${rows}</table></div>
    <p>${besser()}</p>
    <small>${Tk!=null && Tk!==S.T ? `Der Anteil ist erst für ${Tk} kn gerechnet, nicht für deine ${S.T} kn. ` : ""}Typisch: Mittel bei dieser Lage. Stand ${esc(DATA.stand.split("-").reverse().join("."))}.</small>`;
}
function head(){
  const h = HEUTE, hl = h.lage ? DATA.lagen.find(l=>l.id===h.lage) : null;
  const same = hl && ST.type===h.lage;
  el.querySelector(".wbtoday").innerHTML = hl
    ? `Heute: <b>${esc(hl.name)}</b> <span class="dim">· ${esc(h.quelle)}</span>${same ? "" : ` <button class="btn2 wbback">Lage von heute</button>`}`
    : `<span class="dim">${esc(h.grund)}</span>`;
  const b = el.querySelector(".wbback"); if(b) b.addEventListener("click", ()=>{ ST.auto = true; update(); });
  el.querySelectorAll(".wblagen button").forEach(c=>{ const on = c.dataset.t===ST.type, today = c.dataset.t===h.lage;
    c.setAttribute("aria-pressed", on); c.classList.toggle("today", today);
    c.setAttribute("aria-label", c.textContent.trim() + (today ? ", Lage von heute" : "")); });
  const l = lageOf(), V = varOf(), vb = el.querySelector(".wbvars");
  vb.hidden = l.vars.length<2;
  vb.innerHTML = l.vars.length<2 ? "" : l.vars.map(v=>`<button data-k="${v.key}" aria-pressed="${v.key===V.key}">${esc(v.label)}${v.status==="s"?" <i>geschätzt</i>":""}</button>`).join("");
  vb.querySelectorAll("button").forEach(b2=>b2.addEventListener("click", ()=>{ ST.auto = false; ST.vk[l.id] = b2.dataset.k; update(); }));
  el.querySelectorAll(".wbviews button").forEach(b3=>b3.setAttribute("aria-pressed", b3.dataset.v===ST.view));
  mapEl.setAttribute("aria-label", `Karte ${VIEWS[ST.view].name}: typischer Wind bei ${l.name}${l.vars.length>1 ? ", "+V.label : ""}. Ipsach ${knTxt(typ("ips"))}, Vingelz ${knTxt(typ("vin"))}.`);
  el.querySelector(".wbest").hidden = V.status!=="s";
  el.querySelector(".wbthr").style.left = `calc(${Math.min(S.T, KN_MAX)/KN_MAX*100}% - 1px)`;
  el.querySelector(".wbthrt").textContent = `Strich: ${S.T} kn`;
}
function build(){
  const g = []; for(let s=0;s<=KN_MAX;s++) g.push(`${rgb(col(s))} ${s/KN_MAX*100}%`);
  el.innerHTML = `<div class="wbtoday"></div>
    <div class="wblagen" role="group" aria-label="Windlage">${DATA.lagen.map(l=>`<button class="chip" data-t="${l.id}">${esc(l.name)}</button>`).join("")}</div>
    <div class="wbbar"><div class="wbseg wbvars" role="group" aria-label="Variante" hidden></div>
      <div class="wbseg wbviews" role="group" aria-label="Ausschnitt">${Object.keys(VIEWS).map(k=>`<button data-v="${k}">${VIEWS[k].name}</button>`).join("")}</div></div>
    <div class="wbmap" role="img"><canvas></canvas><canvas></canvas><div class="wbbadges"></div><div class="wbtip"></div>
      <div class="wbest" hidden>geschätzt</div><div class="wbnote">Schematisch · Tippen zeigt den Wert</div></div>
    <div class="wbleg"><span>kn</span><div class="wbscale"><div class="wbramp" style="background:linear-gradient(90deg,${g.join(",")})"></div>
      <div class="wbticks">${[0,5,10,15,20,25,30,35].map(s=>`<span style="left:${s/KN_MAX*100}%">${s}</span>`).join("")}</div><div class="wbthr"></div></div><span class="wbthrt"></span></div>
    <div class="note wbpanel" aria-live="polite"></div>`;
  mapEl = el.querySelector(".wbmap"); [base, flow] = mapEl.querySelectorAll("canvas"); bctx = base.getContext("2d"); fctx = flow.getContext("2d");
  el.querySelectorAll(".wblagen button").forEach(b=>b.addEventListener("click", ()=>{ ST.auto = false; ST.type = b.dataset.t; update(); }));
  el.querySelectorAll(".wbviews button").forEach(b=>b.addEventListener("click", ()=>{ ST.view = b.dataset.v; try{ localStorage.setItem(V_KEY, ST.view); }catch(e){} update(); }));
  const tip = el.querySelector(".wbtip"); let tt;
  mapEl.addEventListener("click", e=>{
    const r = mapEl.getBoundingClientRect(), px = e.clientX-r.left, py = e.clientY-r.top, [u,v] = fieldAt(...toKm(px,py)), s = Math.hypot(u,v);
    tip.textContent = s<1 ? "unter 1 kn" : `≈ ${Math.round(s)} kn aus ${card((Math.atan2(-u,-v)*180/Math.PI+360)%360)}`;
    tip.style.left = Math.max(60, Math.min(W-60, px))+"px"; tip.style.top = Math.max(34, py)+"px"; tip.style.display = "block";
    clearTimeout(tt); tt = setTimeout(()=>{ tip.style.display = "none"; }, 2600);
  });
  if("IntersectionObserver" in window) new IntersectionObserver(en=>{ visible = en[0].isIntersecting; play(); }, {rootMargin:"80px"}).observe(mapEl); else visible = true;
  document.addEventListener("visibilitychange", play);
  let rt; window.addEventListener("resize", ()=>{ clearTimeout(rt); rt = setTimeout(()=>{ drawn = ""; update(); }, 150); });
  const redraw = () => { drawn = ""; update(); };
  new MutationObserver(redraw).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
}
/* Wird nach jedem Rendern der Hauptansicht und der Seekarten aufgerufen. Zeichnet die Karte nur neu, wenn sich Lage, Variante,
   Ausschnitt, Darstellung oder Grösse ändern. */
function update(){
  el = el || $("#wb"); if(!el) return;
  if(!DATA){
    if(!LOADING){ LOADING = true;
      setTimeout(()=>C.fetchWindbild().then(j=>{ if(!j || !Array.isArray(j.lagen) || !j.lagen.length) throw new Error("leer"); DATA = j; build(); update(); })
        .catch(e=>{ el.innerHTML = `<div class="note">Das Windbild ist gerade nicht abrufbar (${esc(e.message||"Fehler")}).</div>`; }), 0); }
    return;
  }
  HEUTE = heute();
  if(ST.auto && HEUTE.lage && DATA.lagen.some(l=>l.id===HEUTE.lage)){ ST.type = HEUTE.lage; if(HEUTE.vk) ST.vk[HEUTE.lage] = HEUTE.vk; }
  head();
  const key = [ST.type, varOf().key, ST.view, isDark(), reduce(), Math.round(mapEl.getBoundingClientRect().width)].join("|");
  if(key!==drawn){ drawn = key; requestAnimationFrame(()=>{ setAnchors(); fit(); drawBase(); seed(); badges(); play(); }); }
  else badges();
  panel();
}
return {update, vorwahl, state:ST};
})();
function wbUpdate(){ try{ WB.update(); }catch(e){ const b = $("#wb"); if(b) b.innerHTML = `<div class="note">Windbild: ${esc(e.message)}</div>`; } }
