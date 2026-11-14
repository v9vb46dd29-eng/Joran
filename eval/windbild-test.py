#!/usr/bin/env python3
"""Joran — Sektion «Windbild» im Browser prüfen. Kein Teil der Pflichtprüfungen (braucht Python-Playwright und Chrome).
Lädt die Seite von einem lokalen Server in 390×844, hell und dunkel. Modelle und Seemessung sind künstlich, alle anderen
Abrufe ins Netz werden abgebrochen. Prüft: Vorwahl der Lage je Quelle (nach dem Wind auf dem Chasseral, wie die Daten), Wind von jetzt, fehlende Messung, Südost,
Regler (Messung fortschreiben, Stärke mischen, Quote), Chasseral in See und Bucht, Mathod in der Region,
alle Lagen und Varianten, reduzierte Bewegung, Animation nur im Bild, Konsolenfehler.
Aufruf: python3 eval/windbild-test.py [Ordner für Screenshots]   Chrome: Umgebungsvariable CHROME, sonst /usr/bin/google-chrome"""
import json, sys, time, datetime, re, threading, http.server, functools, os, tempfile
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT=sys.argv[1] if len(sys.argv)>1 else tempfile.mkdtemp(prefix="windbild-"); os.makedirs(OUT, exist_ok=True)
CHROME=os.environ.get("CHROME","/usr/bin/google-chrome")
h=functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
class Q(h.func):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",8765), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever,daemon=True).start()
fails=[]
def ok(name, cond, info=""):
    print(("ok   " if cond else "FEHL ")+name+("" if cond else " — "+str(info)))
    if not cond: fails.append(name)
def model_json(wd, ws):
    base=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).replace(hour=0,minute=0,second=0,microsecond=0)-datetime.timedelta(days=1)
    times=[(base+datetime.timedelta(hours=i)).strftime("%Y-%m-%dT%H:00") for i in range(24*6)]
    n=len(times)
    return [{"latitude":47.1,"longitude":7.2,"hourly":{"time":times,"wind_speed_10m":[ws]*n,"wind_direction_10m":[wd]*n,"wind_gusts_10m":[ws*1.4]*n,"cape":[0]*n}} for _ in range(3)]
def punkt_json(wd, ws):
    # fetchPunkt (La Neuveville): ein Punkt, alle Modelle mit Suffix
    base=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).replace(hour=0,minute=0,second=0,microsecond=0)-datetime.timedelta(days=1)
    times=[(base+datetime.timedelta(hours=i)).strftime("%Y-%m-%dT%H:00") for i in range(24*3)]; n=len(times); h={"time":times}
    for k,m in enumerate(["meteoswiss_icon_ch1","meteoswiss_icon_ch2","icon_d2","meteofrance_arome_france_hd"]):
        h["wind_speed_10m_"+m]=[ws-2+k]*n; h["wind_direction_10m_"+m]=[wd]*n
    return {"latitude":47.063,"longitude":7.1,"utc_offset_seconds":0,"hourly":h}
def jura_json(kamm):
    base=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).replace(hour=0,minute=0,second=0,microsecond=0)-datetime.timedelta(days=1)
    times=[(base+datetime.timedelta(hours=i)).strftime("%Y-%m-%dT%H:00") for i in range(24*6)]; n=len(times)
    return [{"hourly":{"time":times,"pressure_msl":[1015]*n,"wind_speed_10m":[kamm[1]]*n,"wind_direction_10m":[kamm[0]]*n}} for _ in range(5)]
def lake_json(vals):
    now=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None); st={}
    for k in ("vin","ips"):
        v=vals.get(k); st[k]={"rows":[{"t":(now-datetime.timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:00.000Z"),"mean":v[0],"dir":v[1],"gust":v[0]*1.3} for m in (25,15,5)] if v else []}
    return {"updated":now.isoformat()+"Z","st":st}
def run(p, name, scheme, wd, ws, lake, reduced=False, shots=True, kamm=None, vh=844):
    b=p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx=b.new_context(viewport={"width":390,"height":vh}, device_scale_factor=2, color_scheme=scheme, reduced_motion="reduce" if reduced else "no-preference", locale="de-CH", timezone_id="Europe/Zurich")
    pg=ctx.new_page(); errs=[]
    pg.on("console", lambda m: errs.append(m.text) if m.type=="error" and "Failed to load resource" not in m.text else None)
    pg.on("pageerror", lambda e: errs.append("pageerror: "+str(e)))
    def route(r):
        u=r.request.url
        if u.startswith("http://127.0.0.1"): return r.continue_()
        if "api.open-meteo.com/v1/forecast" in u and "latitude=47.063&" in u:
            return r.fulfill(status=200, content_type="application/json", body=json.dumps(punkt_json(wd,ws)))
        if "api.open-meteo.com/v1/forecast" in u and "models=" in u and "850hPa" not in u and "pressure_msl" not in u:
            return r.fulfill(status=200, content_type="application/json", body=json.dumps(model_json(wd,ws)))
        if kamm and "api.open-meteo.com/v1/forecast" in u and "pressure_msl" in u:
            return r.fulfill(status=200, content_type="application/json", body=json.dumps(jura_json(kamm)))
        if "raw.githubusercontent.com" in u and "lake.json" in u:
            return r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin":"*"}, body=json.dumps(lake_json(lake)))
        return r.abort()
    pg.route("**/*", route)
    t0=time.time(); pg.goto("http://127.0.0.1:8765/index.html"); pg.wait_for_selector("#now .verdict", timeout=30000); tmain=time.time()-t0
    pg.wait_for_selector("#wb .wbpanel table", state="attached", timeout=10000); pg.wait_for_timeout(1200)
    info=pg.evaluate("""()=>({today:document.querySelector('.wbtoday').innerText+' | '+document.querySelector('.wbtoday').dataset.quelle, pressed:[...document.querySelectorAll('.wblagen button[aria-pressed=true]')].map(b=>b.dataset.t),
      panel:document.querySelector('.wbpanel').innerText, badges:document.querySelector('.wbbadges').innerText, ver:document.querySelector('.large .sub').innerText,
      small:[...document.querySelectorAll('#wb button')].filter(b=>b.offsetParent && (b.getBoundingClientRect().height<40||b.getBoundingClientRect().width<40)).map(b=>b.innerText+' '+Math.round(b.getBoundingClientRect().width)+'x'+Math.round(b.getBoundingClientRect().height)),
      over:document.documentElement.scrollWidth>document.documentElement.clientWidth,
      px:(()=>{const c=document.querySelector('.wbmap canvas'); const d=c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data; return [...d];})()})""")
    if shots:
        pg.locator("#wb").scroll_into_view_if_needed(); pg.evaluate("window.scrollBy(0,-70)"); pg.wait_for_timeout(900)
        pg.screenshot(path=f"{OUT}/{name}-1.png")
        pg.evaluate("document.querySelector('.wbmap').scrollIntoView({block:'start'}); window.scrollBy(0,-60)"); pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/{name}-2.png")
    return b, pg, info, errs, tmain

with sync_playwright() as p:
    # A: West, hell
    b,pg,i,errs,tm=run(p,"west-hell","light",240,16,{"ips":(17,235),"vin":(8,240)}, kamm=(250,20))
    print(i["today"].replace("\n"," | ")); print(i["badges"].replace("\n"," | "))
    want="v"+re.search(r"app/windbild\.js\?v=(\d+)", open(os.path.join(ROOT,"index.html"),encoding="utf8").read()).group(1)
    ok("A Kopfzeile zeigt die Version der Dateien ("+want+")", want in i["ver"], i["ver"])
    ok("A Vorwahl West aus der Prognose (Chasseral)", i["pressed"]==["west"] and "Prognose, Wind auf dem Chasseral" in i["today"], i)
    ok("A Karte zeigt nur Gemessenes: Wind von jetzt mit Uhrzeit, kein typischer Wert", "17 kn SW" in i["panel"] and "8 kn WSW" in i["panel"] and "Ipsach 17 kn SW" in i["badges"] and re.search(r"gemessen \d\d:\d\d", i["badges"]) is not None and "typisch" not in i["badges"], i["badges"])
    ok("A Bucht: Chasseral in der Ecke beschriftet", pg.evaluate("()=>{const c=document.querySelector('.wbcorner'); return !!c && c.textContent.startsWith('Chasseral');}"))
    pg.click(".wbviews button[data-v=see]"); pg.wait_for_timeout(500)
    ok("A See: Chasseral als Station beschriftet", pg.evaluate("()=>document.querySelectorAll('.wbst').length===2 && [...document.querySelectorAll('.wbstl')].some(x=>x.textContent.startsWith('Chasseral'))"))
    j=pg.evaluate("()=>({l:[...document.querySelectorAll('.wbstl.mod')].map(x=>x.textContent), m:document.querySelectorAll('.wbst.mod').length})")
    ok("A See: La Neuveville mit Modellwert, als «Modell» und mit «~» gekennzeichnet", j["m"]==1 and any(t.startswith("La Neuveville ~") and t.endswith("Modell") for t in j["l"]), j)
    pg.click(".wbviews button[data-v=bucht]"); pg.wait_for_timeout(300)
    # Regler: Messung fortschreiben, ausser die Prognose sagt einen Wechsel; Stärke gemischt, nie unter dem Modell
    res=pg.evaluate("""()=>{ const P=(lage)=>({lage, vk:lage==='west'?'mix':null}), J={lage:'bise', vk:'mix', kamm:true};
      const v={leads:[1,2,3], fort:{bise:[90,80,70]}, prog:[60,62,64]};
      const T=[
       ['Messung, Prognose ohne Wechsel → Messung', WB.mischLage(J, P('bise'), P('bise')), 'bise', 'messung'],
       ['Messung, Prognose ohne Lage → Messung', WB.mischLage(J, P('bise'), P(null)), 'bise', 'messung'],
       ['Messung, Prognose sagt Wechsel → Prognose', WB.mischLage(J, P('bise'), P('west')), 'west', 'wechsel'],
       ['Messung Süd, Prognose West jetzt und später → Süd bleibt', WB.mischLage({lage:'sued'}, P('west'), P('west')), 'sued', 'messung'],
       ['ohne Messung → Prognose', WB.mischLage(null, P('bise'), P('nord')), 'nord', 'prognose'],
       ['Prognose jetzt ohne Lage, später wie die Messung → kein Wechsel', WB.mischLage(J, P(null), P('bise')), 'bise', 'messung'] ];
      const k1=WB.mischKn({kn:20,dir:240},{kn:10,dir:240},1,3.75), k2=WB.mischKn({kn:4,dir:240},{kn:12,dir:240},2,3.75), k3=WB.mischKn(null,{kn:9,dir:60},2,3.75);
      return T.map(([n,r,l,a])=>[n, r.lage===l && r.aus===a, JSON.stringify(r)]).concat([
       ['Stärke +1 h: Messung zählt mehr', k1.kn>17 && k1.kn<20, JSON.stringify(k1)],
       ['Stärke nie unter dem Modell', k2.kn===12, JSON.stringify(k2)],
       ['Stärke ohne Messung = Modell', k3.kn===9 && k3.w===0, JSON.stringify(k3)],
       ['Quote fortgeschrieben, zwischen den Stützstellen linear', WB.quote(v,'messung','bise',2.5)===75, String(WB.quote(v,'messung','bise',2.5))],
       ['Quote Prognose', WB.quote(v,'prognose','bise',2)===62, String(WB.quote(v,'prognose','bise',2))] ]); }""")
    for n,c,r in res: ok("Regler: "+n, c, r)
    ok("A Anteil für die eingestellte Schwelle (14 kn), ohne Hinweis auf eine andere", "Zeit ab 14 kn" in i["panel"] and re.search(r"\d+(–\d+)? %", i["panel"]) is not None and "erst für" not in i["panel"], i["panel"])
    ok("A Karte gezeichnet", i["px"][3]==255, i["px"])
    ok("A Ziele ab 40 px, kein Querscrollen", not i["small"] and not i["over"], i["small"])
    ok("A keine Konsolenfehler", not errs, errs)
    # Vorwahl mit künstlichen Daten, je Lage und Quelle
    res=pg.evaluate("""()=>{ const lk=(d,kn)=>[{fresh:true,L:{name:'Ipsach'},last:{dir:d,mean:kn}}]; const sig=(id,n)=>({eOk:false,trusted:[{up:{name:n},u:{sys:id?{id}:null}}]});
      const K=(dir,kn)=>({dir,kn}), jo={crestOk:true,dpOk:true};
      const lk2=(dv,kv,di,ki,alt)=>[{fresh:!alt,L:{id:'vin',name:'Vingelz'},last:{dir:dv,mean:kv}},{fresh:true,L:{id:'ips',name:'Ipsach'},last:{dir:di,mean:ki}}];
      const T=[
       // Lage nach dem Wind auf dem Chasseral, auch wenn der Wind am See gedreht ankommt
       ['Prognose: Chasseral N, am See NO → Nordlage', {kammP:K(5,24), s:{top:{d:50,v:13}}}, 'nord',null,'Chasseral'],
       ['Prognose: Chasseral S, am See SW → Süd', {kammP:K(185,33), s:{top:{d:240,v:16}}}, 'sued',null,'Chasseral'],
       ['Prognose: Chasseral SW durchmischt → West', {kammP:K(230,20), mixP:true}, 'west','mix','Chasseral'],
       ['Prognose: Chasseral W stabil → West Inversion', {kammP:K(265,15), mixP:false}, 'west','stab','Chasseral'],
       ['Prognose: Chasseral O → Bise', {kammP:K(80,22)}, 'bise',null,'Chasseral'],
       ['Prognose: Chasseral NO → Bise', {kammP:K(50,16)}, 'bise',null,'Chasseral'],
       ['Prognose: Chasseral SO → Südost', {kammP:K(135,18), s:{top:{d:60,v:9}}}, 'suedost','mix','Chasseral'],
       ['Prognose: Chasseral NW ohne Joran-Zeichen → Joran-Lage, Front im November', {kammP:K(315,17), monat:11}, 'joran','front','ohne Joran-Zeichen'],
       ['Prognose: Kammprognose 6 kn zählt mal 2 → West', {kammP:K(240,6), s:{top:{d:60,v:9}}, mixP:true}, 'west','mix','Chasseral'],
       ['Prognose: Chasseral NW mit Joran-Zeichen, Juli → Abend-Joran', {kammP:K(315,17), monat:7, jc:jo}, 'joran','abend','Chasseral'],
       ['Prognose: Chasseral NW, Front → Front-Joran', {kammP:K(300,30), monat:7, jc:{crestOk:true,bnOk:true}}, 'joran','front','Chasseral'],
       // Chasseral schwach oder ohne Angabe: Sektor am Boden
       ['Prognose: Chasseral schwach, am See West', {kammP:K(240,4), s:{top:{d:240,v:9}}, mixP:true}, 'west','mix','Prognose im Zeitfenster'],
       ['Prognose: ohne Chasseral, am See Bise', {s:{top:{d:60,v:9}}}, 'bise',null,'Prognose im Zeitfenster'],
       ['Prognose: ohne Chasseral, am See Südost', {s:{top:{d:135,v:9}}}, 'suedost','mix','Prognose im Zeitfenster'],
       ['Prognose unter 3 kn zählt nicht', {s:{top:{d:240,v:2}}}, null,null,''],
       // Signal geht vor
       ['Signal Regel E → Joran', {nc:{eOk:true,trusted:[]}, monat:7, kammP:K(240,20)}, 'joran','abend','Cressier'],
       ['Signal Grenchen, Chasseral gemessen N → Nordlage', {nc:sig('bise','Grenchen'), kammM:K(10,25), kammP:K(80,20)}, 'nord',null,'Grenchen'],
       ['Signal Neuchâtel, Chasseral gemessen SW stabil → Inversion', {nc:sig('w','Neuchâtel'), kammM:K(230,18), mixM:false}, 'west','stab','Neuchâtel'],
       ['Signal Grenchen ohne Chasseral → Bise', {nc:sig('bise','Grenchen')}, 'bise',null,'Grenchen'],
       ['Signal ohne bekanntes System → weiter zur Prognose', {nc:sig(null,'Courtelary'), kammP:K(5,24)}, 'nord',null,'Prognose'],
       ['Signal mit System tl → weiter zur Prognose', {nc:sig('tl','Courtelary'), kammP:K(5,24)}, 'nord',null,'Prognose'],
       // Messung auf dem Chasseral geht der Prognose vor (22.10.: gemessen Süd, Modell schwach aus Südwest)
       ['Messung Chasseral S vor Prognose SW → Süd', {kammM:K(195,13), kammP:K(223,4.8), s:{top:{d:231,v:9.8}}}, 'sued',null,'Messung Chasseral'],
       ['Messung Chasseral N vor Kammprognose O → Nordlage', {kammM:K(5,18), kammP:K(80,14)}, 'nord',null,'Messung Chasseral'],
       ['Chasseral gemessen schwach → Prognose entscheidet', {kammM:K(195,6), kammP:K(250,14), mixP:true}, 'west','mix','Prognose, Wind auf dem Chasseral'],
       ['Nordwest am See ohne Joran-Zeichen → kein Windbild', {s:{top:{d:310,v:9}}, monat:11}, null,null,'Prognose im Zeitfenster'],
       ['Nordwest am See mit Joran-Zeichen → Joran', {s:{top:{d:310,v:9}}, monat:11, jc:jo}, 'joran','front','Prognose im Zeitfenster'],
       // Seemessung zuletzt
       ['Messung Chasseral N, am See NO → Nordlage', {kammM:K(0,22), lake:lk(45,13)}, 'nord',null,'Messung Chasseral'],
       ['Ältere Datei ohne Sektoren: Sektor am Boden', {kammM:K(0,22), s:{top:{d:60,v:9}}, _alt:true}, 'bise',null,'Prognose im Zeitfenster'],
       ['Seemessung West, Chasseral schwach', {kammM:K(250,5), lake:lk(250,9)}, 'west','mix','Seemessung Ipsach'],
       ['Seemessung zu schwach', {lake:lk(250,2)}, null,null,''],
       // Bise am See geht vor (v32): beide Seestationen Bise ab 4 kn, Chasseral West, Süd oder Nordwest
       ['See Bise, Chasseral SW gemessen (14.11.) → Bise', {kammM:K(225,16), mixM:false, lake:lk2(80,6,75,5)}, 'bise',null,'Seemessung Vingelz und Ipsach'],
       ['See Bise, Chasseral S gemessen → Bise', {kammM:K(190,13), lake:lk2(70,7,85,8)}, 'bise',null,'Seemessung Vingelz und Ipsach'],
       ['See Bise, Kammprognose W → Bise', {kammP:K(260,12), lake:lk2(70,5,60,6)}, 'bise',null,'Seemessung Vingelz und Ipsach'],
       ['See Bise, Chasseral NW ohne Zeichen → Bise', {kammM:K(315,14), monat:11, lake:lk2(70,5,60,6)}, 'bise',null,'Seemessung Vingelz und Ipsach'],
       ['See Bise nur an Ipsach → West bleibt', {kammM:K(225,16), mixM:false, lake:lk2(200,5,75,6)}, 'west','stab','Messung Chasseral'],
       ['See Bise unter 4 kn → West bleibt', {kammM:K(225,16), mixM:false, lake:lk2(80,6,75,3)}, 'west','stab','Messung Chasseral'],
       ['See Bise, Vingelz nicht frisch → West bleibt', {kammM:K(225,16), mixM:false, lake:lk2(80,6,75,6,true)}, 'west','stab','Messung Chasseral'],
       ['See Bise, Chasseral N → Nordlage bleibt', {kammM:K(5,22), lake:lk2(60,6,40,9)}, 'nord',null,'Messung Chasseral'],
       ['See Bise, Chasseral SO → Südost bleibt', {kammM:K(120,20), lake:lk2(60,6,50,6)}, 'suedost','mix','Messung Chasseral'],
       ['See Bise, Signal Neuchâtel West → West bleibt', {nc:sig('w','Neuchâtel'), kammM:K(230,18), mixM:false, lake:lk2(80,6,75,6)}, 'west','stab','Neuchâtel'],
       ['See Bise, Regel E → Joran bleibt', {nc:{eOk:true,trusted:[]}, monat:11, lake:lk2(80,6,75,6)}, 'joran','front','Cressier'],
       ['nichts', {}, null,null,''] ];
      const alt=[{id:'west',vars:[{key:'mix'}]},{id:'bise',vars:[{key:'mix'}]}];
      return T.map(([n,x,l,v,q])=>{ const r=x._alt ? WB.vorwahl(x, alt, {}) : WB.vorwahl(x); return [n, r.lage===l && r.vk===v && r.quelle.includes(q), JSON.stringify(r)]; }); }""")
    for n,c,r in res: ok("Vorwahl: "+n, c, r)
    # Messung heisst «jetzt», Prognose «heute»; ohne Chasseral ist die Wahl als unsicher gekennzeichnet
    res=pg.evaluate("""()=>{ const K=(dir,kn)=>({dir,kn}), lk=(d,kn)=>[{fresh:true,L:{name:'Ipsach'},last:{dir:d,mean:kn}}];
      const sig=(id,n)=>({eOk:false,trusted:[{up:{name:n},u:{sys:{id}}}]});
      const T=[
       ['Messung Chasseral → jetzt, sicher', {kammM:K(195,13), kammFehlt:false}, 'messung', false],
       ['Prognose bei schwachem Chasseral → heute, sicher', {kammM:K(195,6), kammP:K(250,14), kammFehlt:false}, 'prognose', false],
       ['Prognose ohne Chasseral → heute, unsicher', {kammP:K(223,14), kammFehlt:true}, 'prognose', true],
       ['Seeprognose ohne Chasseral → heute, unsicher', {s:{top:{d:231,v:9.8}}, kammFehlt:true}, 'prognose', true],
       ['Seemessung ohne Chasseral → jetzt, unsicher', {lake:lk(250,9), kammFehlt:true}, 'messung', true],
       ['Signal Grenchen ohne Chasseral → jetzt, unsicher', {nc:sig('bise','Grenchen'), kammFehlt:true}, 'messung', true],
       ['Signal Grenchen mit Chasseral → jetzt, sicher, Quelle nennt die Messung', {nc:sig('bise','Grenchen'), kammM:K(10,25), kammFehlt:false}, 'messung', false],
       ['Regel E ohne Chasseral → jetzt, sicher', {nc:{eOk:true,trusted:[]}, monat:7, kammFehlt:true}, 'messung', false],
       ['Kein Windbild ohne Chasseral → unsicher', {s:{top:{d:135,v:9}}, kammFehlt:true}, 'prognose', true],
       ['See Bise bei Kammprognose West → jetzt, sicher', {kammP:K(260,12), kammFehlt:false, lake:[{fresh:true,L:{id:'vin'},last:{dir:70,mean:5}},{fresh:true,L:{id:'ips'},last:{dir:60,mean:6}}]}, 'messung', false] ];
      return T.map(([n,x,a,u])=>{ const r=WB.vorwahl(x); return [n, r.art===a && r.unsicher===u && (!n.includes('Quelle nennt') || r.quelle.startsWith('Messung Chasseral')), JSON.stringify(r)]; }); }""")
    for n,c,r in res: ok("Vorwahl: "+n, c, r)
    # Muster an der Messung ausrichten: Punkte mit Wert übernehmen ihn, die übrigen folgen dem Verhältnis der nahen Punkte
    r=pg.evaluate("""()=>WB.ausrichten([["vin",240,9,1],["ips",244,18,1],["twa",240,17],["mag",250,5]], {vin:{kn:18,dir:250}, ips:{kn:36,dir:254}})""")
    ok("Ausrichten: Messpunkte übernommen, Seepunkte skaliert und gedreht, Jurahöhe ohne Chasseral typisch", r[0][2]==18 and r[1][2]==36 and 30<=r[2][2]<=36 and r[2][1]==250 and r[3][2]==5, r)
    # Review PR #30, B1: Drehung um rund 180° (Westmuster, am See Bise) darf sich nicht aufheben
    r=pg.evaluate("""()=>WB.ausrichten([["vin",249,9,1],["ips",244,18,1],["bay",240,14],["sutz",235,17],["twa",235,17]], {vin:{kn:8,dir:60}, ips:{kn:9,dir:65}})""")
    ok("Ausrichten B1: Drehung nahe 180° als Vektor gemittelt (Fläche zeigt NO wie die Messung)", all(30<=z[1]<=90 for z in r[2:]), r)
    # B2: geschätzte Punkte nie stärker als die stärkste Messung ihrer Höhenlage; Höhenpunkte ohne Chasseral bleiben typisch
    r=pg.evaluate("""()=>WB.ausrichten([["cha",234,15.3,1],["vin",191,1.9,1],["ips",198,2.3,1],["pla",230,6],["twa",200,3]], {vin:{kn:10,dir:200}, ips:{kn:12,dir:200}})""")
    ok("Ausrichten B2: Seepunkte höchstens wie die stärkste Messung unten, Jurahöhen ohne Chasseral typisch", r[0][2]==15.3 and r[3][2]==6 and r[4][2]<=12, r)
    ok("Ausrichten ohne Werte: Muster bleibt typisch", pg.evaluate("""()=>JSON.stringify(WB.ausrichten([["vin",240,9,1]], {}))""")=='[["vin",240,9,1]]')
    # Regler: kommende Stunde aus der Prognose, West heisst «West oder Süd»
    pg.evaluate("()=>{const r=document.querySelector('.wbtime input'); r.value=6; r.dispatchEvent(new Event('input'));}"); pg.wait_for_timeout(700)
    j=pg.evaluate("()=>({t:document.querySelector('.wbtoday').innerText, b:document.querySelector('.wbbadges').innerText, est:document.querySelector('.wbest').hidden?'':document.querySelector('.wbest').innerText})")
    ok("Regler +6 h: Prognose mit Uhrzeit, «West oder Süd», Modellwerte an den Spots", "Uhr" in j["t"] and "West oder Süd" in j["t"] and "Prognose" in j["t"] and "Modell" in j["b"] and j["est"]=="Prognose", j)
    pg.click(".wbviews button[data-v=region]"); pg.wait_for_timeout(700)
    j=pg.evaluate("()=>({n:document.querySelectorAll('.wbst').length, b:document.querySelector('.wbbadges').innerText})")
    ok("Regler in der Region: keine Upwind-Stationen, nur Ipsach und La Neuveville mit «~»", j["n"]==2 and "Ipsach ~" in j["b"] and "La Neuveville ~" in j["b"], j)
    pg.evaluate("()=>{const r=document.querySelector('.wbtime input'); r.value=0; r.dispatchEvent(new Event('input'));}"); pg.wait_for_timeout(700)
    j=pg.evaluate("()=>({n:document.querySelectorAll('.wbst').length, t:document.querySelector('.wbtoday').innerText})")
    ok("Region jetzt: alle Upwind-Stationen und Mathod als Punkte", j["n"]>=12 and "Uhr" not in j["t"], j)
    if True: pg.screenshot(path=f"{OUT}/region-hell.png")
    pg.click(".wbviews button[data-v=bucht]"); pg.wait_for_timeout(400)
    ok("Regler und Region ohne Konsolenfehler", not errs, errs)
    # Startseite: Karte ohne Filter; im Blatt «Erklärungen» mit allen Lagen
    ok("Startseite: Lagen-Filter ausgeblendet", pg.evaluate("()=>!document.querySelector('.wblagen').offsetParent && !document.querySelector('.wbpanel').offsetParent"))
    pg.click("#infoBtn"); pg.wait_for_timeout(700)
    ok("Erklärungen: Karte mit Filtern im Blatt, ohne Regler", pg.evaluate("()=>!!document.querySelector('#info #wb.wbfull') && !!document.querySelector('.wblagen').offsetParent && !document.querySelector('.wbtime').offsetParent"))
    # Lage wählen, Variante, Ausschnitt, zurück
    pg.click(".wblagen button[data-t=joran]"); pg.wait_for_timeout(500)
    j=pg.evaluate("()=>({est:!document.querySelector('.wbest').hidden, vars:document.querySelector('.wbvars').innerText, panel:document.querySelector('.wbpanel').innerText, back:!!document.querySelector('.wbback')})")
    ok("Andere Lage gewählt: Knopf zurück zur Lage von heute", "Joran" in j["panel"] and j["back"], j)
    pg.click(".wbvars button[data-k=abend]"); pg.wait_for_timeout(500)
    j=pg.evaluate("()=>({est:!document.querySelector('.wbest').hidden, panel:document.querySelector('.wbpanel').innerText})")
    ok("Abend-Joran als geschätzt markiert", j["est"] and "Geschätzt" in j["panel"] and "~14 kn" in j["panel"], j)
    pg.evaluate("document.querySelector('.wbmap').scrollIntoView({block:'start'}); window.scrollBy(0,-150)"); pg.wait_for_timeout(700); pg.screenshot(path=f"{OUT}/joran-abend-hell.png")
    pg.click(".wbviews button[data-v=see]"); pg.wait_for_timeout(700); pg.screenshot(path=f"{OUT}/joran-see-hell.png")
    pg.click(".wbback"); pg.wait_for_timeout(400)
    ok("Zurück zur Lage von heute", pg.evaluate("()=>document.querySelector('.wblagen button[aria-pressed=true]').dataset.t")=="west")
    for t in ["sued","bise","nord","thermik"]:
        pg.click(f".wblagen button[data-t={t}]"); pg.wait_for_timeout(250)
        n=pg.evaluate("()=>document.querySelectorAll('.wbvars button').length")
        for k in range(n): pg.click(f".wbvars button >> nth={k}"); pg.wait_for_timeout(150)
    ok("Alle Lagen und Varianten ohne Fehler", not errs, errs)
    # B3: nach dem Regler zeigt das Blatt typische Werte und in der Region alle Stationen
    pg.click("#info .done"); pg.wait_for_timeout(400)
    pg.evaluate("()=>{const r=document.querySelector('.wbtime input'); r.value=6; r.dispatchEvent(new Event('input'));}"); pg.wait_for_timeout(500)
    pg.click("#infoBtn"); pg.wait_for_timeout(700)
    j=pg.evaluate("()=>({b:document.querySelector('.wbbadges').innerText})")
    ohne_nv="\n".join(x for x in j["b"].split("\n") if not x.startswith("La Neuveville"))   # La Neuveville zeigt immer das Modell
    ok("Erklärungen nach dem Regler: gemessene Werte, kein «Modell» an den Spots, kein typischer Wert auf der Karte", "Modell" not in ohne_nv and "typisch" not in j["b"] and "gemessen" in j["b"], j)
    pg.click(".wbviews button[data-v=region]"); pg.wait_for_timeout(600)
    ok("Erklärungen nach dem Regler: Region mit allen Stationen", pg.evaluate("()=>document.querySelectorAll('.wbst').length")>=11)
    pg.click(".wbviews button[data-v=bucht]"); pg.wait_for_timeout(300)
    pg.click("#info .done"); pg.wait_for_timeout(500)
    ok("Erklärungen zu: Karte zurück, wieder Lage von heute", pg.evaluate("()=>!!document.querySelector('#wbHome #wb:not(.wbfull)') && document.querySelector('.wblagen button[aria-pressed=true]').dataset.t==='west'"))
    pg.evaluate("localStorage.clear()"); b.close()
    # B: Bise, dunkel, Vingelz ohne Messung
    b,pg,i,errs,tm=run(p,"bise-dunkel","dark",60,10,{"ips":(7,50)})
    ok("B Vorwahl Bise (Sektor am Boden, Chasseral ohne Angabe)", i["pressed"]==["bise"] and "Prognose im Zeitfenster" in i["today"], i["today"])
    ok("B fehlende Messung als Strich", "Vingelz" in i["panel"] and re.search(r"Vingelz\s*\d+ kn [NOSW]+\s*–", i["panel"]) is not None and re.search(r"Vingelz –\s+keine Messung", i["badges"]) is not None, i["panel"]+i["badges"])
    ok("B keine Konsolenfehler", not errs, errs); b.close()
    # C: Südost am Boden, Chasseral ohne Angabe
    b,pg,i,errs,tm=run(p,"so","light",135,9,{}, shots=False)
    ok("C Südost wird als eigene Lage vorgewählt", "Südost" in i["today"] and i["pressed"]==["suedost"], i["today"])
    pg.evaluate("()=>{const r=document.querySelector('.wbtime input'); r.value=3; r.dispatchEvent(new Event('input'));}"); pg.wait_for_timeout(600)
    j=pg.evaluate("()=>({t:document.querySelector('.wbtoday').innerText, b:document.querySelector('.wbbadges').innerText})")
    ok("C Regler bei Südost: Lage aus der Prognose mit Quote, Modell an den Spots", "Südost" in j["t"] and "Prognose" in j["t"] and "stimmt ~" in j["t"] and "Modell" in j["b"], j); b.close()
    # F: Nordlage: Chasseral Nord, am See Nordost (Bodenwind allein ergäbe Bise)
    b,pg,i,errs,tm=run(p,"nord-hell","light",50,13,{"ips":(13,40),"vin":(6,65)}, kamm=(5,24))
    ok("F Nordlage trotz Nordost am See", i["pressed"]==["nord"] and "Nordlage" in i["today"], i["today"])
    ok("F besserer Spot nach Anteil der Zeit", "Ipsach" in i["panel"] and "öfter ab" in i["panel"], i["panel"])
    ok("F keine Konsolenfehler", not errs, errs); b.close()
    # I: Bise am See unter Südwest auf dem Kamm (v32, Fall 14.11.): Bise vorgewählt, Kopfzeile «am See», höchstens 2 Zeilen,
    #    Regler ab +1 h wieder aus der Prognose
    b,pg,i,errs,tm=run(p,"see-bise","light",225,7,{"vin":(6,80),"ips":(5,75)}, kamm=(225,8))
    ok("I See Bise geht vor Kamm Südwest", i["pressed"]==["bise"] and "Jetzt: Bise am See" in " ".join(i["today"].split()) and "Seemessung Vingelz und Ipsach" in i["today"], i["today"])
    j=pg.evaluate("()=>{const t=document.querySelector('.wbtoday'); return {h:t.getBoundingClientRect().height, lh:parseFloat(getComputedStyle(t).lineHeight)||20};}")
    ok("I Kopfzeile höchstens 2 Zeilen", j["h"] <= 2*j["lh"]+2, j)
    pg.evaluate("()=>{const r=document.querySelector('.wbtime input'); r.value=2; r.dispatchEvent(new Event('input'));}"); pg.wait_for_timeout(600)
    j=pg.evaluate("()=>document.querySelector('.wbtoday').innerText")
    ok("I Regler +2 h: Lage aus der Prognose, Bise nicht fortgeschrieben", "West oder Süd" in j and "fortgeschrieben" not in j, j)
    ok("I keine Konsolenfehler", not errs, errs); b.close()
    # G: Datei fehlt oder ist unvollständig: Hauptansicht steht, Meldung in der Sektion
    for nm,body in (("fehlt",None),("unvollständig",'{"stand":"2026-11-12","lagen":[{"id":"west","name":"West","vars":[]}]}')):
        bb=p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]); pg=bb.new_page(viewport={"width":390,"height":844}); er=[]
        pg.on("pageerror", lambda e: er.append(str(e)))
        def rt(r, _req=None, body=body):
            u=r.request.url
            if "data/windbild.json" in u: return r.fulfill(status=404, body="") if body is None else r.fulfill(status=200, content_type="application/json", body=body)
            if u.startswith("http://127.0.0.1"): return r.continue_()
            if "api.open-meteo.com/v1/forecast" in u and "models=" in u and "850hPa" not in u and "pressure_msl" not in u: return r.fulfill(status=200, content_type="application/json", body=json.dumps(model_json(240,16)))
            return r.abort()
        pg.route("**/*", rt); pg.goto("http://127.0.0.1:8765/index.html"); pg.wait_for_selector("#now .verdict", timeout=30000); pg.wait_for_timeout(800)
        ok("G Datei "+nm+": Meldung statt Karte, kein Fehler", "nicht abrufbar" in pg.inner_text("#wb") and not er, (pg.inner_text("#wb"), er)); bb.close()
    # H: Stufenwörter (v31). Grenze fest ab «wahrscheinlich»; «Noch kein Wind» schon ab «möglich»; «Wind kommt» bei jedem Signal
    b,pg,i,errs,tm=run(p,"stufen","dark",60,16,{"ips":(5,90),"vin":(6,90)}, shots=False)
    r=pg.evaluate("""()=>{ const days=D?Object.keys(D.models).length:0; const cur={k:0, s:Object.assign({}, C.summarize(D.models, C.localDay(0), S), {level:2})};
      const ruhig={front:[], eOk:false, trusted:[], sig:[], lake:[{fresh:true, ok:false, L:{name:'Vingelz'}, last:{mean:6, dir:90}}]};
      const w=(nc,h)=>{ const d=document.createElement('div'); d.innerHTML=nowHTML(cur, h, nc); return d.querySelector('.word').textContent; };
      const hr=cur.s.win?cur.s.win.from:16;
      const sig=Object.assign({}, ruhig, {trusted:[{up:{name:'Grenchen', abk:'gre'}, u:{mean30:12, trust:5}}], sig:[{}]});
      const sturm=Object.assign({}, ruhig, {front:[{up:{name:'Cressier'}, f:['Böen 45 kn (Sturmgrenze 45 kn)']}]});
      const c0=Object.assign({}, cur, {s:Object.assign({}, cur.s, {level:0})});
      const d=document.createElement('div'); d.innerHTML=nowHTML(c0, hr, sig);
      return {cut:S.cut, mm:S.maxMean, mg:S.maxGust, nkw:w(ruhig, hr), sig:w(sig, hr), sigTief:d.querySelector('.word').textContent, sturm:w(sturm, hr),
        chips:!!document.querySelector('#setCut,#setMax')}; }""")
    ok("H Grenze und Sturm fest (wahrscheinlich, 35/45), keine Einstellung dafür", r["cut"]==3 and r["mm"]==35 and r["mg"]==45 and not r["chips"], r)
    ok("H «Noch kein Wind» schon bei «möglich»", r["nkw"]=="Noch kein Wind", r)
    ok("H «Wind kommt» bei Signal, auch bei tiefer Stufe", r["sig"]=="Wind kommt" and r["sigTief"]=="Wind kommt", r)
    ok("H Sturm geht vor", r["sturm"]=="Nicht rausfahren", r)
    ok("H keine Konsolenfehler", not errs, errs); b.close()
    # D: reduzierte Bewegung
    b,pg,i,errs,tm=run(p,"west-ruhig","dark",240,16,{"ips":(17,235),"vin":(8,240)}, reduced=True)
    f=pg.evaluate("()=>{const c=document.querySelectorAll('.wbmap canvas')[1]; const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let k=3;k<d.length;k+=4) if(d[k]) n++; return n;}")
    ok("D reduzierte Bewegung: keine Strömungslinien", f==0, f); ok("D keine Konsolenfehler", not errs, errs); b.close()
    # E: Animation nur im Bild
    b,pg,i,errs,tm=run(p,"x","light",240,16,{}, shots=False, vh=420)
    pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(500)
    cnt="""()=>new Promise(res=>{ const o=CanvasRenderingContext2D.prototype.stroke; let n=0; CanvasRenderingContext2D.prototype.stroke=function(){ n++; return o.apply(this,arguments); }; setTimeout(()=>{ CanvasRenderingContext2D.prototype.stroke=o; res(n); },700); })"""
    off=pg.evaluate(cnt); pg.locator(".wbmap").scroll_into_view_if_needed(); pg.wait_for_timeout(300); on=pg.evaluate(cnt)
    ok("E Animation steht ausserhalb des Bildschirms, läuft im Bild", off==0 and on>10, (off,on)); b.close()
print("\nScreenshots: "+OUT); print("%d Fehler" % len(fails)); sys.exit(1 if fails else 0)
