# Messung des Prognosemodells

Ziel: Kein foilbarer Abend an Vingelz oder Ipsach soll verpasst werden. Ein verpasster Abend wiegt schwerer als ein Fehlalarm.
Foilbar ist ein Abend, wenn an einer der beiden Seestationen im Zeitfenster der Einstellungen das 10-min-Mittel während
mindestens `minH` Stunden bei ≥ T kn liegt. T ist die Schwelle aus der App und hier ein Parameter.

```
git fetch origin live baseline-2026-11-10:refs/remotes/origin/baseline-2026-11-10
node eval/measure.cjs --T 12              # Hauptmass, Kontrolle bei 14 kn, Entwicklungstage mit Kreuzvalidierung
node eval/measure.cjs --T 14 --kontrolle 14
node eval/measure.cjs --T 12 --teil holdout   # Schlussmessung, nur einmal nach der letzten Codeänderung
node eval/measure.cjs --fit               # Modellparameter aus den Entwicklungstagen (für core/modell.js), mit Kopplung und Höhenwind
node eval/measure.cjs --T 12 --fest       # H3/H4 mit den hinterlegten Werten statt je Block bestimmt
node eval/measure.cjs --T 12 --verzug 0 --ohne-sturm   # Nachspielen wie vor dem 11.11.2026
node eval/verzug.cjs                      # Lieferverzug aus den echten Push-Zeiten bestimmen
node eval/selftest.cjs                    # prüft Messskript und Modell mit synthetischen Daten
node eval/aufbau.cjs                      # prüft die Regeln aus ARCHITEKTUR.md (Silos, Reihenfolge, Version)
node eval/gleich.cjs                      # rechnet der Rechenkern wie origin/main? Für Umbauten ohne Verhaltensänderung
```

Derselbe Befehl misst jeden Stand: `--neu git:REV` oder `--neu pfad/core.js` misst einen anderen Rechenkern, `--basis` ersetzt die
Baseline (Standard: Branch `baseline-2026-11-10`). `--offline` nutzt nur den Cache.

## Daten

- **Seemessung:** Die Action «Joran Push» legt Vingelz und Ipsach als `archive/JJJJ-MM-TT.json` im Branch `live` ab
  (`push/archive.cjs`). Das Skript liest das Archiv aus der lokalen Kopie von `origin/live` und aus `archive/`.
  Das Archiv beginnt am 15.10.2026. meteoBase gibt keine älteren Werte frei (Diagrammdaten nur 24 h und mit Schlüssel
  geschützt). Vor dem 16.10.2026 gibt es deshalb keine Wahrheit [OFFEN].
- **Upwind-Stationen:** SwissMetNet, 10-min-Werte (`t_recent` ab 1.1. des Jahres und `t_now`). Das Skript holt sie selbst und
  speichert sie in `eval/cache/` (nicht im Repo).
- **Markierungen:** `eval/truth.json` im Format von «Markierungen kopieren» (`"JJJJ-MM-TT":"y"|"n"|"k"`, `"tl:JJJJ-MM-TT":1`,
  `"sys:JJJJ-MM-TT":"joran"|"w"|…`). Sie überstimmen die automatische Wahrheit, jede Abweichung wird ausgewiesen.
  Die Datei fehlt im Repo, bisher gilt nur die automatische Wahrheit. Ablegen: im Rückblick «Fürs Modell speichern»
  (mit Token, schreibt `eval/truth.json` ins Repo) oder «Markierungen kopieren» und den Text als Datei ablegen. Das
  Skript prüft die Einträge und meldet, was es nicht verwendet.
- **Modellprognosen:** nicht gemessen. Die Prognose-Stufe der App (Open-Meteo) liesse sich über die Previous Runs API
  nachspielen; am 10.11.2026 war das Tageskontingent von Open-Meteo erschöpft [OFFEN].

## Was gemessen wird

- **Wahrheit** (`core.lakeDay`): foilbar, wenn im Zeitfenster jeder 10-min-Wert (gerundet wie angezeigt) während `minH`
  Stunden ≥ T lag, Lücke höchstens 20 min. Ruhig nur, wenn eine Station das Fenster zu 80 % abdeckt, sonst unbekannt.
  Je Seestation zählt nur die eigene Messung.
- **Gesamtmodell:** Das Live-Signal der App wird in 10-min-Schritten nachgespielt (`core.nowcast`, Push-Bedingung wie
  `push/check.cjs`: eine Push-fähige Upwind-Station oder Regel E, keine Sturmwarnung, ab 2 h vor dem Zeitfenster).
  Beim Prüfschritt liegen nur Stationswerte vor, die mindestens 10 min alt sind (Lieferverzug, bestimmt mit
  `eval/verzug.cjs` aus den echten Push-Zeiten). Die Sturmsperre vom See zählt mit: Liegt die Seemessung über den eigenen
  Grenzen, kommt kein Push; solche Tage weist die Ausgabe aus.
  Je Seestation und für «Vingelz oder Ipsach»: Recall (Signal spätestens beim Beginn am See), FPR (Signal an ruhigen
  Abenden), Precision, mittlere Vorlaufzeit (erstes Signal bis erster Wert des foilbaren Zeitraums), Fallzahl.
  Der foilbare Zeitraum beginnt frühestens mit dem Zeitfenster. Weht es schon vorher, ist die Vorlaufzeit höchstens 2 h.
- **Upwind-Stationen:** je Station und Windsystem dasselbe. Ein foilbarer Abend zählt für die Zelle seines Windsystems
  (Taubenlöchler, Joran nach Regel E in Cressier, sonst Richtung am See), ein Fehlalarm für das System des Signals.
  Joran (Regel E) und Taubenlöchler (Courtelary) stehen in eigenen Zeilen.

## Aufteilung und Validierung

`eval/split.json` hält die Grenze fest: Entwicklungstage bis 5.11.2026, Holdout 6.–10.11.2026 (letzte rund 20 %).
Der Holdout wird nur mit `--teil holdout` gelesen. Auf den Entwicklungstagen misst das Skript in drei zeitlichen Blöcken;
Parameter (`core.fitModel`) werden je Block nur aus den Tagen davor bestimmt. Im Holdout gelten die Parameter, die im Stand
hinterlegt sind (`core.MODEL`). Das gilt seit dem 11.11.2026 auch für die Grenze der Kopplung (H3) und den Faktor des
Höhenwinds (H4); `--fest` misst mit den hinterlegten Werten.

## Akzeptanzregeln

Angenommen wird ein Stand, wenn gegenüber der Baseline bei T = 12 kn gilt: Recall je Seestation steigt oder bleibt gleich;
FPR steigt insgesamt um höchstens 10 Prozentpunkte; mittlere Vorlaufzeit ≥ 30 min; bei 14 kn sinkt der Recall nicht;
je Station und Windsystem liegen mindestens 10 Ereignistage vor. Fehlt nur der letzte Punkt, ist der Stand vorläufig: Er
wird committet, aber nicht aktiv gesetzt (`MODEL.active` bleibt `false`). Die 10 Ereignistage gelten je Windsystem einzeln
(Entscheid 11.11.2026): Ein System mit 10 Abenden kann für sich zur Aktivierung vorgeschlagen werden. Die letzte Zeile der
Ausgabe zeigt den Stand je System.

Iterationen und Reviewer-Entscheide: `eval/ITERATIONEN.md`. Entscheide des Laufs vom 16.10.2026: `eval/REVIEW.md`.
