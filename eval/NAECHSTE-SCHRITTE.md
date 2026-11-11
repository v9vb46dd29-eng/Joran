# Nächste Schritte

Stand 11.11.2026. Verlauf und Zahlen: `eval/ITERATIONEN.md`. Ideen: `eval/IDEEN.md`.

## Was läuft

- Die Action archiviert die Seemessung täglich (Branch `live`, Ordner `archive`). Seit v17 wird auch die Richtungstreue
  gespeichert; vorher blieb sie wegen eines Lesefehlers leer.
- Die App zeigt den Höhenwind (850 hPa, ICON-EU) mit Schichtung als Hinweis.
- Vorbereitet, aber nicht aktiv (`MODEL.active = false` in `core.js`): Stationsfaktoren je Windsystem (Modell v2),
  Kopplung der Luftschichten für Chasseral-Signale (H3), Höhenwind in der Prognose (H4).

## Überprüfung Ende Dezember 2026 (automatisch geplant auf den 28.12.2026)

1. Daten holen: `git fetch origin live`, dann `node eval/measure.cjs --T 12` (holt SwissMetNet selbst).
2. `eval/split.json` neu festlegen: Entwicklungstage bis zum Datum, das rund 80 % der Tage abdeckt, Holdout danach.
   Die Tage 6.–10.11.2026 waren schon Holdout und dürfen in die Entwicklung wandern; der neue Holdout sind die jüngsten Tage.
3. Archivprognosen und Höhenwind für den neuen Zeitraum nachladen (`eval/data/prognose_vortag.json` löschen und
   `node eval/prognose.cjs` laufen lassen; `eval/data/hoehenwind_icon_eu.json` über die Historical Forecast API erneuern).
4. Parameter neu bestimmen (`node eval/measure.cjs --fit`), in `core.MODEL.f` eintragen, messen bei 10, 12 und 14 kn.
5. Ereignistage je Windsystem zählen. Liegen für West mindestens 10 vor: Aktivierung **nur für West** vorschlagen, mit
   Reviewer-Entscheid und einmaliger Holdout-Messung. Dafür braucht es Simons Entscheid, ob die 10-Tage-Regel je Windsystem
   einzeln gelten darf.
6. H3 und H4 an den neuen Tagen prüfen: Hat die Kopplung einen foilbaren Abend gesperrt? Hält die Grenze 1.1 × T auf 850 hPa?
7. Bericht mit Tabelle je Seestation und je Upwind-Station, PR auf `main`, nicht mergen.

## Wartet auf mehr Daten

| Thema | Braucht | Erwartet |
|---|---|---|
| Modell v2 für West aktivieren | 10 West-Abende (heute 4) | Ende Dezember 2026 |
| Bise: eigener Faktor, Fehlalarme senken | 10 Bise- oder Nord-Abende (heute 1) | Sommer 2027 |
| Joran: Faktoren, H3 im Sommer prüfen, Drehung Vingelz/Ipsach (`node eval/joran.cjs`) | 10 Joran-Episoden (heute 1) | Juni bis Juli 2027 |
| Taubenlöchler | Markierungen `tl:` im Rückblick und Abende mit Nord/Bise am See | offen |
| H4: Grenze je Windrichtung | mehr Abende je Richtung; echte Vortagesprognose auf 850 hPa | laufend |

## Offene Entscheide (Simon)

- Darf die Regel «10 Ereignistage» je Windsystem einzeln gelten? Sonst blockieren Süd, Südost und Taubenlöchler alles.
- Markierungen im Rückblick exportieren und als `eval/truth.json` ablegen. Sie gehen der automatischen Wahrheit vor.

## Technische Restpunkte

- Die Messung rechnet ohne Lieferverzug von SwissMetNet und ohne Sturmsperre vom See.
- Die Vorlaufzeit ist an Tagen, an denen es schon vor dem Zeitfenster weht, wenig aussagekräftig.
- Höhenwind-Archiv: ICON-CH2 liefert keine Druckflächen, Previous Runs auch nicht. Die Auswertung nutzt die jüngsten
  Läufe von ICON-EU und ist damit eher zu günstig.
