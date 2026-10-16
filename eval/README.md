# Messung der Upwind-Stationen

Ziel: kein foilbarer Abend soll verpasst werden (≥ 14 kn Mittelwind am See). Ein verpasster Tag wiegt schwerer als ein Fehlalarm.

```
node eval/measure.cjs            # misst diesen Stand: Peirce-Regel (vorher) gegen Recall-Regel (nachher)
node eval/measure.cjs --vorher git:baseline-2026-10-16   # «vorher» mit dem core.js eines anderen Stands
node eval/selftest.cjs           # prüft das Messskript mit synthetischen Daten
```

Vorher `git fetch origin live`: Das Skript liest das Archiv aus der lokalen Kopie von `origin/live` (und aus `archive/`).
Stationsdaten (SwissMetNet, 10-min, `t_recent` + `t_now`) holt das Skript selbst und speichert sie in `eval/cache/`
(nicht im Repo). `--offline` nutzt nur den Cache, `--stations DIR` eigene Dateien.

## Wahrheit

- **Archiv:** Die Action «Joran Push» legt die Seemessung Vingelz/Ipsach als `archive/JJJJ-MM-TT.json` im Branch `live` ab
  (Schritt «Seemessung archivieren», `push/archive.cjs`). meteoBase bietet keine älteren Werte an (geprüft 16.10.2026:
  `?date=` wird ignoriert, Diagrammdaten nur 24 h und schlüsselgeschützt). Das Archiv beginnt deshalb mit dem Merge;
  `archive/` im Repo enthält den Stand von `live/lake.json` vom 16.10.2026 als Startbestand.
- **Automatisch** (`core.lakeDay`): foilbar, wenn im Zeitfenster der Einstellungen an einer aktiven Seestation während
  mindestens `minH` Stunden jeder 10-min-Mittelwert gerundet ≥ `T` lag (Lücke höchstens 20 min, mind. 80 % der Werte).
  Ruhig nur, wenn eine Station das Fenster zu mind. 80 % abdeckt, sonst unbekannt (zählt nicht).
- **Markiert:** `eval/truth.json` im Format von «Markierungen kopieren» (`"JJJJ-MM-TT":"y"|"n"|"k"`, `"tl:JJJJ-MM-TT":1`,
  optional `"sys:JJJJ-MM-TT":"joran"|"w"|…`). Markierungen überstimmen die automatische Wahrheit; jede Abweichung wird ausgewiesen.
- **Windsystem** eines foilbaren Tages: Markierung, sonst automatisch: Taubenlöchler, wenn am See Nord/Bise und Courtelary in
  den 2 h davor mehrheitlich im Talsektor (ohne Westwind auf dem Chasseral); Joran, wenn Cressier um den Beginn drei Werte in
  Folge im Sektor von Regel E und ≥ 10 kn misst; sonst Richtung am See. Für Cressier ist die Joran-Zuordnung damit nicht
  unabhängig von der eigenen Messung.
- **Joran-Typ** eines Joran-Tages (`core.joranType`, Erfahrungswerte, nicht kalibriert): «dynamique», wenn in den 6 h davor
  West/Südwest ≥ 8 kn in Neuchâtel und dazu Druckanstieg ≥ 1.5 hPa in Neuchâtel oder Temperatursturz ≥ 3 °C in
  Cressier/Neuchâtel um den Beginn; sonst «statique» von Mai bis August; sonst unbestimmt. Markierung
  `"jtyp:JJJJ-MM-TT":"dyn"|"stat"` geht vor. Die Messung zeigt Recall und Vorlauf der Joran-Zelle je Typ; die Typen sind
  (noch) keine eigenen Zellen der Akzeptanzregeln, damit die Ereignistage nicht halbiert werden.

## Kennzahlen

Frühere 60 % der Tage legen die Schwellen fest, die späteren 40 % messen. Ein Signal wird wie in der App nachgespielt
(`core.upwindNow` auf 10-min-Werten, Fenster 2 h vor Beginn bis Ende). Je Station und Windsystem: Recall, FPR (Signal an
ruhigen Tagen, dem System des Signals zugeordnet), Precision, mittlere Vorlaufzeit (erstes Signal bis erster 10-min-Wert
≥ T am See; negativ = Signal kam zu spät). «Push» zählt einen Tag
als erkannt, wenn eine Push-fähige Station oder Regel E meldet. «ALLE» und «Push» zählen nur Stationen, die nach der
jeweiligen Regel Push auslösen dürfen, und einen Treffer nur, wenn das Signal spätestens beim Beginn am See kam; diese
Zeile ist die Grundlage der Akzeptanzregeln. Recall zählt die Windtage aller Stationen (eine stillgelegte Station verpasst
ihre Tage), FPR nur die ruhigen Tage der Push-fähigen Stationen; die Zeile «Push» zeigt dasselbe je Tag. Rundung wie in der App: 13.5 kn gilt als 14 kn (bewusst grosszügig).

## Akzeptanzregeln

Angenommen nur, wenn alle zutreffen: Recall gesamt steigt oder bleibt gleich; FPR steigt höchstens um 10 Prozentpunkte;
Vorlaufzeit ≥ 30 min; Schwellen auf früheren Tagen festgelegt, auf späteren gemessen; je Station und Windsystem
≥ 10 Ereignistage. Fehlt der letzte Punkt, ist das Ergebnis vorläufig: Die Recall-Regel liegt in `core.js` bereit
(`calibrateStation(..., "recall")`), aktiv bleibt `CAL.rule = "pss"`. Aktivieren: `CAL.rule = "recall"` setzen.

Reviewer-Entscheide: `eval/REVIEW.md`.
