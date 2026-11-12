#!/usr/bin/env python3
"""Joran — Sektion «Windbild» im Browser prüfen. Kein Teil der Pflichtprüfungen (braucht Python-Playwright und Chrome).
Lädt die Seite von einem lokalen Server in 390×844, hell und dunkel. Modelle und Seemessung sind künstlich, alle anderen
Abrufe ins Netz werden abgebrochen. Prüft: Vorwahl der Lage je Quelle, Wind von jetzt, fehlende Messung, Südost,
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
def lake_json(vals):
    now=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None); st={}
    for k in ("vin","ips"):
        v=vals.get(k); st[k]={"rows":[{"t":(now-datetime.timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:00.000Z"),"mean":v[0],"dir":v[1],"gust":v[0]*1.3} for m in (25,15,5)] if v else []}
    return {"updated":now.isoformat()+"Z","st":st}
def run(p, name, scheme, wd, ws, lake, reduced=False, shots=True):
    b=p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx=b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, color_scheme=scheme, reduced_motion="reduce" if reduced else "no-preference", locale="de-CH", timezone_id="Europe/Zurich")
    pg=ctx.new_page(); errs=[]
    pg.on("console", lambda m: errs.append(m.text) if m.type=="error" and "Failed to load resource" not in m.text else None)
    pg.on("pageerror", lambda e: errs.append("pageerror: "+str(e)))
    def route(r):
        u=r.request.url
        if u.startswith("http://127.0.0.1"): return r.continue_()
        if "api.open-meteo.com/v1/forecast" in u and "models=" in u and "850hPa" not in u and "pressure_msl" not in u:
            return r.fulfill(status=200, content_type="application/json", body=json.dumps(model_json(wd,ws)))
        if "raw.githubusercontent.com" in u and "lake.json" in u:
            return r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin":"*"}, body=json.dumps(lake_json(lake)))
        return r.abort()
    pg.route("**/*", route)
    t0=time.time(); pg.goto("http://127.0.0.1:8765/index.html"); pg.wait_for_selector("#out .verdict", timeout=30000); tmain=time.time()-t0
    pg.wait_for_selector("#wb .wbpanel table", timeout=10000); pg.wait_for_timeout(1200)
    info=pg.evaluate("""()=>({today:document.querySelector('.wbtoday').innerText, pressed:[...document.querySelectorAll('.wblagen button[aria-pressed=true]')].map(b=>b.dataset.t),
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
    b,pg,i,errs,tm=run(p,"west-hell","light",240,16,{"ips":(17,235),"vin":(8,240)})
    print(i["today"].replace("\n"," | ")); print(i["badges"].replace("\n"," | "))
    ok("A Version v20", "v20" in i["ver"], i["ver"])
    ok("A Vorwahl West aus der Prognose", i["pressed"]==["west"] and "Prognose im Zeitfenster" in i["today"], i)
    ok("A Wind von jetzt neben typisch", "17 kn SW" in i["panel"] and "8 kn WSW" in i["panel"] and "Ipsach 17 kn SW" in i["badges"] and re.search(r"typisch \d+ kn [NOSW]+", i["badges"]) is not None, i["panel"])
    ok("A Anteil für die eingestellte Schwelle (14 kn), ohne Hinweis auf eine andere", "Zeit ab 14 kn" in i["panel"] and re.search(r"\d+(–\d+)? %", i["panel"]) is not None and "erst für" not in i["panel"], i["panel"])
    ok("A Karte gezeichnet", i["px"][3]==255, i["px"])
    ok("A Ziele ab 40 px, kein Querscrollen", not i["small"] and not i["over"], i["small"])
    ok("A keine Konsolenfehler", not errs, errs)
    # Vorwahl mit künstlichen Daten, je Lage und Quelle
    res=pg.evaluate("""()=>{ const lk=(d,kn)=>[{fresh:true,L:{name:'Ipsach'},last:{dir:d,mean:kn}}]; const sig=(id,n)=>({eOk:false,trusted:[{up:{name:n},u:{sys:{id}}}]});
      const T=[
       ['Signal West', {nc:sig('w','Neuchâtel'), s:{top:{d:60}}}, 'west','mix','Signal'],
       ['Signal Regel E', {nc:{eOk:true,trusted:[]}, monat:7, s:{top:{d:240}}}, 'joran','abend','Cressier'],
       ['Signal Bise', {nc:sig('bise','Grenchen')}, 'bise',null,'Grenchen'],
       ['Signal Nord', {nc:sig('n','Chasseral')}, 'nord',null,'Chasseral'],
       ['Prognose West durchmischt', {s:{top:{d:240}}, hd:{coupled:true}}, 'west','mix','Prognose'],
       ['Prognose West Inversion', {s:{top:{d:240}}, hd:{coupled:false}}, 'west','stab','Prognose'],
       ['Prognose Süd', {s:{top:{d:190}}}, 'sued',null,'Prognose'],
       ['Prognose Bise', {s:{top:{d:60}}}, 'bise',null,'Prognose'],
       ['Prognose Nord', {s:{top:{d:5}}}, 'nord',null,'Prognose'],
       ['Prognose Joran November', {s:{top:{d:310}}, monat:11}, 'joran','front','Prognose'],
       ['Prognose Joran Juli', {s:{top:{d:310}}, monat:7}, 'joran','abend','Prognose'],
       ['Prognose Joran Juli mit Front', {s:{top:{d:310}}, monat:7, jc:{bnOk:true}}, 'joran','front','Prognose'],
       ['Prognose Südost', {s:{top:{d:135}}}, null,null,'Prognose'],
       ['Seemessung West', {s:{top:null}, lake:lk(250,9)}, 'west','mix','Seemessung Ipsach'],
       ['Seemessung zu schwach', {lake:lk(250,2)}, null,null,''],
       ['nichts', {}, null,null,''] ];
      return T.map(([n,x,l,v,q])=>{ const r=WB.vorwahl(x); return [n, r.lage===l && r.vk===v && r.quelle.includes(q), JSON.stringify(r)]; }); }""")
    for n,c,r in res: ok("Vorwahl: "+n, c, r)
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
    pg.evaluate("localStorage.clear()"); b.close()
    # B: Bise, dunkel, Vingelz ohne Messung
    b,pg,i,errs,tm=run(p,"bise-dunkel","dark",60,10,{"ips":(7,50)})
    ok("B Vorwahl Bise", i["pressed"]==["bise"], i["today"])
    ok("B fehlende Messung als Strich", "Vingelz" in i["panel"] and re.search(r"Vingelz\s+\d+ kn [NOSW]+\s+–", i["panel"]) is not None and re.search(r"Vingelz –\s+typisch \d+ kn", i["badges"]) is not None, i["panel"]+i["badges"])
    ok("B keine Konsolenfehler", not errs, errs); b.close()
    # C: Südost
    b,pg,i,errs,tm=run(p,"so","light",135,9,{}, shots=False)
    ok("C Südost: keine Vorwahl, Hinweis", "kein Windbild" in i["today"], i["today"]); b.close()
    # D: reduzierte Bewegung
    b,pg,i,errs,tm=run(p,"west-ruhig","dark",240,16,{"ips":(17,235),"vin":(8,240)}, reduced=True)
    f=pg.evaluate("()=>{const c=document.querySelectorAll('.wbmap canvas')[1]; const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let k=3;k<d.length;k+=4) if(d[k]) n++; return n;}")
    ok("D reduzierte Bewegung: keine Strömungslinien", f==0, f); ok("D keine Konsolenfehler", not errs, errs); b.close()
    # E: Animation nur im Bild
    b,pg,i,errs,tm=run(p,"x","light",240,16,{}, shots=False)
    pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(500)
    cnt="""()=>new Promise(res=>{ const o=CanvasRenderingContext2D.prototype.stroke; let n=0; CanvasRenderingContext2D.prototype.stroke=function(){ n++; return o.apply(this,arguments); }; setTimeout(()=>{ CanvasRenderingContext2D.prototype.stroke=o; res(n); },700); })"""
    off=pg.evaluate(cnt); pg.locator(".wbmap").scroll_into_view_if_needed(); pg.wait_for_timeout(300); on=pg.evaluate(cnt)
    ok("E Animation steht ausserhalb des Bildschirms, läuft im Bild", off==0 and on>10, (off,on)); b.close()
print("\nScreenshots: "+OUT); print("%d Fehler" % len(fails)); sys.exit(1 if fails else 0)
