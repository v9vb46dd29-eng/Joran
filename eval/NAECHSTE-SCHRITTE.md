# Nächste Schritte

Stand 11.11.2026 (v19). Verlauf und Zahlen: `eval/ITERATIONEN.md`. Ideen: `eval/IDEEN.md`.

## Was läuft

- Die Action archiviert die Seemessung täglich (Branch `live`, Ordner `archive`). Seit v17 wird auch die Richtungstreue
  gespeichert; vorher blieb sie wegen eines Lesefehlers leer.
- Die App zeigt den Höhenwind (850 hPa, ICON-EU) mit Schichtung als Hinweis.
- Vorbereitet, aber nicht aktiv (`MODEL.active = false` in `core/modell.js`): Stationsfaktoren je Windsystem (Modell v2),
  Kopplung der Luftschichten für Chasseral-Signale (H3), Höhenwind in der Prognose (H4).
- Seit v18 bestimmt die Messung auch die Grenze von H3 und den Faktor von H4 je Block, rechnet mit 10 min Lieferverzug
  der Stationsdaten und mit der Sturmsperre vom See.

## Überprüfung Ende Dezember 2026 (automatisch geplant auf den 28.12.2026)

1. Daten holen: `git fetch origin live`, dann `node eval/measure.cjs --T 12` (holt SwissMetNet selbst).
2. `eval/split.json` neu festlegen: Entwicklungstage bis zum Datum, das rund 80 % der Tage abdeckt, Holdout danach.
   Die Tage 6.–10.11.2026 waren schon Holdout und dürfen in die Entwicklung wandern; der neue Holdout sind die jüngsten Tage.
3. Archivprognosen und Höhenwind für den neuen Zeitraum nachladen (`eval/data/prognose_vortag.json` löschen und
   `node eval/prognose.cjs` laufen lassen; `eval/data/hoehenwind_icon_eu.json` über die Historical Forecast API erneuern).
   Danach `node eval/zeitversatz.cjs`: Es bringt die Zeit aller abgelegten Open-Meteo-Reihen in Ortszeit (Open-Meteo
   beschriftet eine ganze Reihe mit dem Versatz vom Abruf; über den Wechsel auf Sommer- oder Winterzeit liegt sonst eine
   Stunde daneben). Schon umgerechnete Dateien lässt es stehen.
4. Parameter neu bestimmen (`node eval/measure.cjs --fit`): alle Werte in `core/modell.js` eintragen (`MODEL.f`,
   `MODEL.kopplung.min`, `MODEL.hoehe.f`, `MODEL.fitted`). Messen bei 10, 12 und 14 kn. Den Lieferverzug mit
   `node eval/verzug.cjs` nachprüfen (heute 10 min).
5. Ereignistage je Windsystem zählen (letzte Zeile der Messung). Die Regel gilt je Windsystem einzeln (Entscheid
   11.11.2026). Liegen für West mindestens 10 vor: Aktivierung **nur für West** vorschlagen, mit Reviewer-Entscheid und
   einmaliger Holdout-Messung. Dafür braucht es einen Schalter je Windsystem (heute schaltet `MODEL.active` alles
   zusammen): Stationsfaktoren nur für West; H3 gehört zu Joran und Nord und bleibt aus; H4 wirkt auf jede Richtung und
   bleibt aus, bis es je Richtung belegt ist.
6. H3 und H4 an den neuen Tagen prüfen: Hat die Kopplung einen foilbaren Abend gesperrt? Hält der Faktor auf 850 hPa?
   Die Zeile «H3/H4 je Block» zeigt, was die Daten je Block hergeben.
7. Vor dem PR: `node eval/aufbau.cjs` und `node eval/selftest.cjs`. Version in `index.html` an allen Stellen hochzählen.
8. `node eval/bucht.cjs` laufen lassen und die Tabelle zu H-B1 bis H-B8 in `eval/IDEEN.md` nachführen.
9. `node eval/windbild.cjs --pruefen` laufen lassen: rechnet `data/windbild.json` für die Sektion «Windbild» neu (nach
   Schritt 2, damit der neue Holdout ungelesen bleibt) und vergleicht mit `eval/schichten.cjs`. Die Datei kommt in den PR.
   Hat eine Lage aus der Vorlage (`eval/windbild.vorlage.json`, «fest») inzwischen genug Tage, dort eine Regel eintragen.
10. `node eval/windbild-stunde.cjs` laufen lassen (vorher `eval/data/stunde_prognose.json` löschen): Lage je Stunde
    aus der Prognose (Regler im Windbild) gegen die Messung Chasseral. Stand 13.11.2026 (16.10.–5.11.): Bise 94 %,
    West 65 %, Nordlage 60 %, Süd 0 % (als West). Trifft Süd inzwischen, «West oder Süd» in `stunde()` aufheben.
    Seit v26 rechnet die App die Kammprognose mal `regeln.kammFaktor` (2). `--kamm F` multipliziert zusätzlich: `--kamm 1.25` entspricht Faktor 2,5.
11. `node eval/lage-vorlauf.cjs --schreiben`, danach nochmals `node eval/windbild.cjs --pruefen` (übernimmt die Quoten in
    `data/windbild.json`). Prüfen: Schlägt die Mischregel des Reglers weiterhin Messung und Prognose allein? Passt τ noch
    (13.11.2026: 2,5 h)? Erkennt «max(Mischung, Modell)» an Ipsach ab 12 kn mindestens so viele Stunden wie das Modell?
12. `node eval/regel-e.cjs`, danach `node eval/joran-prognose.cjs`. Das zweite Skript hängt die Läufe von ICON-CH2 an
    `eval/data/joran_prognose.json` an. Das Archiv der API reicht nur 92 Tage zurück: spätestens alle drei Monate laufen
    lassen, sonst entsteht eine Lücke. Joran-Typ aus den Markierungen (`jt:` im Rückblick) mit `joranType` vergleichen.
13. `node eval/lage-faktor.cjs` und `node eval/lage-faktor.cjs --fest` (vorher `eval/data/prognose_vortag.json` und
    `stunde_prognose.json` neu laden): Lage-Faktor (`core.LAGE`, inaktiv). Recall darf in keiner Zeile sinken, auch
    nicht bei den Einstellungen der Nutzer (Stand 14.11.: bei 13 kn, Fenster Tag, geht der 2.11. verloren). Ist Südost
    auf dem Kamm (14.11.: Bise am See, Seemitte zu hoch) eine eigene Lage wert? Statt eines festen Faktors prüfen, ob
    ein Faktor auf die Spitze (stärkste Stunde) oder nur bei «Noch kein Wind» am Tag selbst besser trennt.
14. Bericht mit Tabelle je Seestation und je Upwind-Station, PR auf `main`, nicht mergen.

## Wartet auf mehr Daten

| Thema | Braucht | Erwartet |
|---|---|---|
| Modell v2 für West aktivieren | 10 West-Abende (heute 4) | Ende Dezember 2026 |
| Bise: eigener Faktor, Fehlalarme senken | 10 Bise- oder Nord-Abende (heute 1) | Sommer 2027 |
| Lage-Faktor aktivieren (`core.LAGE`, `node eval/lage-faktor.cjs`): Bise senkt Seemitte, Nordlage hebt Ipsach | Recall in jeder Zeile und jeder Nutzer-Einstellung unverändert (heute nicht erfüllt: 2.11. bei 13 kn, Tag); Nordlage 10 Tage (heute 2). Vor der Aktivierung Kammprognose überall übergeben: Push-Lauf (`fetchAll` mit `jura`), Rückblick, `calibrate` | offen |
| Joran: Faktoren, H3 im Sommer prüfen, Drehung Vingelz/Ipsach (`node eval/joran.cjs`) | 10 Joran-Episoden (heute 1) | Juni bis Juli 2027 |
| Taubenlöchler | Markierungen `tl:` im Rückblick und Abende mit Nord/Bise am See | offen |
| Bieler Bucht: Joran-Äste, Taubenloch, Nordlage, Seewind (H-B1 bis H-B8 in `eval/IDEEN.md`, `node eval/bucht.cjs`) | Joran-Episoden je Typ, Nordlage-Abende, Seemessung im Sommer | Sommer 2027 |
| Joran in der Prognose: Kamm-Schwelle und Druckzeichen kalibrieren (`node eval/joran-prognose.cjs`) | 15–20 Abende mit Regel E im Archiv der Läufe (heute 7) | Sommer 2027 |
| Südost: eigene Werte am See statt der Schätzung (heute 3 Tage) | 4 Tage Südost auf dem Chasseral | laufend |
| H4: Grenze je Windrichtung | mehr Abende je Richtung; echte Vortagesprognose auf 850 hPa | laufend |

## Offene Entscheide (Simon)

- Entschieden am 11.11.2026: Die Regel «10 Ereignistage» gilt je Windsystem einzeln. Simon hat den Entscheid delegiert;
  er lässt sich jederzeit umstossen. Aktiviert wird weiterhin nur über einen PR und Simons «merge».
- Markierungen im Rückblick ablegen: «Fürs Modell speichern» (mit Token) schreibt `eval/truth.json`. Sie gehen der
  automatischen Wahrheit vor. Vor allem Joran- und Taubenlöchler-Abende helfen.

## Technische Restpunkte

- Der Lieferverzug (10 min) ist aus 18 Push-Tagen bestimmt, an denen mehrere App-Versionen liefen. Seit dem 29.10.
  trifft er an allen sieben Tagen auf 10 min genau.
- In H4 bleibt die Grenze «durchmischt ab 4 K je km» (2 m bis 850 hPa) fest; je Block bestimmt wird nur der Faktor.
- Die Vorlaufzeit ist an Tagen, an denen es schon vor dem Zeitfenster weht, wenig aussagekräftig.
- Höhenwind-Archiv: ICON-CH2 liefert keine Druckflächen, Previous Runs auch nicht. Die Auswertung nutzt die jüngsten
  Läufe von ICON-EU und ist damit eher zu günstig.
