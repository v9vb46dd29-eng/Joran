# Aufbau der App

Stand v26 (13.11.2026). Joran kommt ohne Build und ohne Abhängigkeiten aus: GitHub Pages liefert die Dateien, wie sie im
Repo liegen, die Action und die Auswertung laden denselben Rechenkern mit `require`.

## Wozu der Umbau

Bis v18 lag der Rechenkern in einer Datei (`core.js`, 973 Zeilen) und die Oberfläche in einer zweiten (`index.html`,
1130 Zeilen). Das hat drei Dinge erschwert:

- Wer eine Stelle ändern wollte, musste die ganze Datei lesen. Für die Arbeit mit Claude heisst das: Jede Sitzung lud
  60 bis 80 KB, auch für eine Änderung an fünf Zeilen.
- Im Rechenkern hingen die Teile im Kreis voneinander ab (Datenabruf ↔ Messung, Messung ↔ Kalibrierung). Regeln,
  Netzabrufe und die Parameter des Modells standen durcheinander.
- Es gab keine Prüfung, die einen Umbau absichert, ausser der Messung selbst.

## Rechenkern: neun Silos und eine Fassade

Ein Silo ist eine Datei unter `core/` mit einer klaren Aufgabe. Es zeigt nach aussen nur, was andere brauchen. Die
Reihenfolge ist die der Abhängigkeit: Ein Silo darf nur Silos brauchen, die weiter oben stehen.

| Silo | Aufgabe | braucht | Zeilen |
|---|---|---|---|
| `konstanten` | Spots, Stationen, Windsysteme, Zeitfenster, Grenzwerte, Standard-Einstellungen | – | 88 |
| `helfer` | Runden, Richtungen, Zeit in Europe/Zurich | konstanten | 42 |
| `modell` | Parameter des Prognosemodells (Modell v2, H3, H4), `MODEL.active` | – | 54 |
| `see` | Seemessung auswerten: Lage jetzt, Sturm, Wahrheit eines Tages | konstanten, helfer | 103 |
| `prognose` | Modellprognose auswerten: Stufe, Ensemble, Joran-Zutaten, Höhenwind | konstanten, helfer, modell | 141 |
| `messung` | Live-Signal: Upwind-Regel, Regel E, Böenfront, Kopplung, `nowcast` | konstanten, helfer, modell, see | 185 |
| `kalibrierung` | Parameter aus der Vergangenheit bestimmen (`fitModel`, Rückblick) | alle oben | 220 |
| `daten` | Alles, was ins Netz geht (Open-Meteo, SwissMetNet, meteoBase, `data/windbild.json`) | konstanten, see | 225 |
| `einstellungen` | Push-Einstellungen prüfen (`users/<name>.json`) | konstanten, helfer | 40 |

`core.js` ist nur noch die Fassade. Sie führt die 96 öffentlichen Namen auf (73 Funktionen, 23 Konstanten) und fasst sie zu einem Objekt zusammen
(`JoranCore` im Browser, `require("./core.js")` in Node). `push/`, `eval/` und die Oberfläche kennen nur die Fassade.
Für sie hat sich nichts geändert.

Jedes Silo hat denselben Rahmen aus fünf Zeilen. Er lädt die gebrauchten Silos in Node mit `require` und im Browser aus
`Joran.<silo>`. So läuft dieselbe Datei an beiden Orten, ohne Build.

## Oberfläche

`index.html` enthält nur noch das Gerüst der Seite. Darstellung und Programm liegen unter `app/`:

| Datei | Inhalt | Zeilen |
|---|---|---|
| `app.css` | Darstellung (hell, dunkel, automatisch) | 215 |
| `basis.js` | Kurzformen, Speicher im Browser, Gesamt-Rendern | 50 |
| `see.js` | Karten «Am See jetzt» | 59 |
| `live.js` | Startseite: «Wind kommt?» und die nächsten 4 Tage, kurz. Blatt «Erklärungen»: Urteil mit Begründung, Diagramm, Hinweise, Stationen, Quellen | 343 |
| `einstellungen.js` | Einstellungsblatt | 19 |
| `push.js` | Push für mehrere Nutzer, Verwaltung, GitHub-API | 159 |
| `rueckblick.js` | Tage markieren, kalibrieren, Markierungen ablegen | 108 |
| `windbild.js` | Sektion «Windbild»: Karte der Bieler Bucht. Startseite: Lage von jetzt, an den Messungen ausgerichtet, Zahlen nur, wo gemessen wird (Chasseral in See und Bucht); Ausschnitt Region mit allen Upwind-Stationen und Mathod; Regler 24 h aus Messung und Prognose (`mischLage`, `mischKn`, `quote`). Blatt «Erklärungen»: typisches Muster jeder Lage mit Filtern (`WB.mode`) | 604 |
| `start.js` | Daten holen, auffrischen, Blätter Einstellungen und Erklärungen, Bedienelemente verdrahten | 164 |

Das sind klassische Skripte. Sie teilen sich ihre Namen und werden in dieser Reihenfolge geladen. Die Grenzen sind hier
also Ordnung und keine Mauer: Eine Datei kann auf Funktionen einer anderen zugreifen.

## Regeln

`node eval/aufbau.cjs` prüft sie in unter einer Sekunde:

1. Ein Silo braucht nur Silos, die in der Fassade weiter oben stehen. Kreise gibt es nicht. Es holt sie nur über
   `const {…} = dep("name")`, und jeder geholte Name steht im `return` des anderen Silos.
2. Nur `daten` geht ins Netz. Der Rechenkern kennt weder Seite noch Browser-Speicher.
3. Action, Auswertung und Oberfläche brauchen nur die Fassade, nie ein Silo direkt.
4. `index.html` lädt die Silos in der Reihenfolge der Fassade, danach `core.js`, danach `app/`, `start.js` zuletzt.
5. Alle Dateien und die Kopfzeile tragen dieselbe Version (`?v=26`, «v26»). Bei jeder Änderung an allen Stellen
   gleich hochzählen, sonst mischt der Browser alte und neue Dateien.
6. Nur `app/push.js` spricht mit der GitHub-API. Wetterdaten holt die Oberfläche nur über den Rechenkern.
7. `MODEL.active` ist `false`, bis Simon eine Aktivierung mergt.

## Wo ändere ich was

| Vorhaben | Ort |
|---|---|
| Neue Upwind-Station, neues Windsystem, anderer Grenzwert | `core/konstanten.js` |
| Neue Parameter nach einer Modellprüfung (`--fit`) | `core/modell.js` |
| Regel des Live-Signals ändern oder ergänzen | `core/messung.js` |
| Regel der Prognose-Stufe, Höhenwind | `core/prognose.js` |
| Wie Parameter bestimmt werden | `core/kalibrierung.js` |
| Neue Datenquelle, anderer Abruf | `core/daten.js` |
| Text oder Anzeige der Startseite und der Erklärungen | `app/live.js` |
| Text «Methode und Quellen» | `index.html`, Blatt `#info` |
| Rückblick, Markierungen | `app/rueckblick.js` |
| Windbild: Karte, Vorwahl der Lage, Texte der Sektion | `app/windbild.js` |
| Windbild: Zahlen und Stützpunkte je Lage | nie von Hand: `node eval/windbild.cjs` schreibt `data/windbild.json` |
| Windbild: Texte, geschätzte Lagen, Faktoren der geschätzten Stützpunkte, Chasseral-Sektoren je Lage | `eval/windbild.vorlage.json` |
| Farben, Abstände | `app/app.css` |
| Wann welcher Push kommt | `push/check.cjs` |

Ein neuer öffentlicher Name kommt ins `return` seines Silos und in die Liste der Fassade. Ein neues Silo bekommt eine
Zeile in der Fassade und ein `<script>` in `index.html`.

## Prüfungen vor einem PR

| Befehl | Prüft | Wann |
|---|---|---|
| `node eval/aufbau.cjs` | Regeln oben | immer |
| `node eval/selftest.cjs` | Modell und Messskript mit künstlichen Daten | immer |
| `node eval/gleich.cjs` | rechnet der Kern wie `origin/main`? Quelltext und rund 390'000 Ergebnisse auf echten Daten | bei Umbauten, die nichts ändern sollen |
| `node eval/measure.cjs --T 12` | Recall, FPR, Vorlauf gegen die Baseline | bei Modelländerungen, mit Reviewer |
| `node eval/windbild.cjs --pruefen` | `data/windbild.json` neu rechnen, Abgleich mit `eval/schichten.cjs`, Vorwahl der App gegen das Archiv | bei jeder Modellprüfung und nach Änderungen an Skript oder Vorlage |
| `node eval/lage-vorlauf.cjs` | Regler: Messung fortgeschrieben gegen Prognose und Mischregel, je Vorlauf; `--schreiben` legt die Quoten für `data/windbild.json` ab | bei Änderungen an `stunde()`, `mischLage()`, `mischKn()` und bei jeder Modellprüfung |
| `node eval/windbild-stunde.cjs` | Lage je Stunde aus der Prognose (Regler) gegen die Messung auf dem Chasseral | bei Änderungen an `stunde()` oder `vorwahl()` und bei jeder Modellprüfung |
| `python3 eval/windbild-test.py` | Sektion «Windbild» im Browser (390×844, hell und dunkel, künstliche Daten) | bei Änderungen an `app/windbild.js`; braucht Python-Playwright und Chrome |

Ändert sich der Quelltext eines öffentlichen Namens mit Absicht, nennt man ihn: `node eval/gleich.cjs --erlaubt nowcast`.
Rechnet er auch anders, meldet die Prüfung das weiterhin, und alles andere muss gleich bleiben. Ihre Grenzen stehen im
Kopf des Skripts: Datenabruf, Parser und Joran-Zweige deckt sie kaum ab.

## Bewusst nicht gemacht

- **Kein Build, kein Bundler, kein TypeScript.** Die App läuft so, wie sie im Repo liegt, und das soll so bleiben. Der
  Preis: Beim ersten Laden holt der Browser 21 Dateien statt 2. GitHub Pages liefert sie parallel und hält sie im
  Zwischenspeicher. Fällt eine einzelne Datei aus, bleibt die Seite heute stumm stehen.
- **Keine festen Grenzen in der Oberfläche.** Dafür bräuchte es Module mit `import`. Das lohnt sich erst, wenn die
  Oberfläche weiter wächst oder Tests bekommt.
- **Kein Umbau im Push-Lauf.** `push/check.cjs` ist unverändert. Die Bedingung «Wind kommt» steht dort und noch einmal
  im Nachspielen von `eval/measure.cjs`.
- **Kein Verhalten geändert.** Jede Funktion steht Zeichen für Zeichen so im Silo, wie sie in v18 stand.

## Nächste Schritte, erst wenn sie gebraucht werden

1. Eine sichtbare Meldung, wenn ein Skript nicht lädt. Bei 17 Skripten statt 2 ist ein Teilausfall wahrscheinlicher.
2. Reine Parser an einen Ort: `parseSMN` liegt in `daten`, `parseMeteobase` in `see`; `merge` gehört eher zu
   `einstellungen` als zu `helfer`.
3. Die Push-Bedingung als eine Funktion im Silo `messung`, die Action und Messung gemeinsam brauchen. Dann misst die
   Messung sicher dasselbe, was die Action tut. Braucht einen Reviewer, weil es den Push-Lauf berührt.
4. Die Uhr als Parameter: Einige Funktionen holen sich die Zeit selbst (`new Date()`). Das hat am 11.11.2026 die
   Sturmsperre im Nachspielen unsichtbar gemacht. Wer eine solche Funktion anfasst, reicht die Zeit durch.
5. Ein Schalter je Windsystem im Silo `modell`, sobald West 10 Ereignistage hat (siehe `eval/NAECHSTE-SCHRITTE.md`).
