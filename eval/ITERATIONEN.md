# Iterationslog Prognosemodell (Branch opt/modell)

Massstab ist die Baseline: `main` auf Commit 6efe43b (10.11.2026), gesichert als Branch `baseline-2026-11-10`.
Der Tag liess sich aus der Arbeitsumgebung nicht pushen (nur Branches möglich); Simon hat den Branch als Ersatz gewählt.

## Stand 10.11.2026: Bestandsaufnahme, noch keine Modelländerung

### Was schon besteht (aus opt/upwind, opt/v14, opt/joran-typ, alles in main)

- Archiv: Die Action legt die Seemessung als `archive/JJJJ-MM-TT.json` im Branch `live` ab. 27 Tagesdateien, 15.10. bis 10.11.2026.
- Messskript `eval/measure.cjs` mit Selbsttest. Es vergleicht Peirce-Regel und Recall-Regel je Upwind-Station und Windsystem.
  Die Schwelle T kommt bisher aus `users/simon.json` und ist kein Parameter. Eine Auswertung pro Seestation fehlt,
  ebenso Holdout und zeitliche Kreuzvalidierung (bisher fester Schnitt 60/40).
- Recall-Regel in `core.js` vorbereitet, aktiv bleibt `CAL.rule = "pss"`. Reviewer-Entscheid vom 16.10.: ABLEHNEN, weil damals
  kein Archivtag im Abendfenster lag.
- `eval/truth.json` gibt es nicht. Es liegen keine Markierungen im Repo.

### Wahrheit aus dem Archiv (Fenster Abend 16–21, minH 1 h, Vingelz oder Ipsach)

| Schwelle | bekannte Tage | foilbar | ruhig | foilbare Tage |
|---|---|---|---|---|
| 12 kn | 26 | 5 | 21 | 17., 21., 23., 24., 25.10. |
| 14 kn | 26 | 4 | 22 | 21., 23., 24., 25.10. |

Der 15.10. ist unbekannt (zu wenige Werte). Nach der Richtung am See: 4 Tage West, 1 Tag Bise. Kein Joran- und kein
Taubenlöchler-Tag, soweit das ohne Upwind-Daten erkennbar ist [OFFEN: Zuordnung mit Stationsdaten prüfen].

### Beobachtungen

- `push/state.json` zeigt die Push-Nachricht «Wind kommt — Messung» am 31.10. sowie am 1., 2., 3. und 4.11. Alle fünf Abende
  waren am See ruhig. Das sind fünf Fehlalarme in elf Tagen [OFFEN: mit Stationsdaten nachspielen, welche Station auslöste].
- Am 1.11. meldete die App zusätzlich «Am See: 12 kn erreicht». Der Wert hielt keine Stunde, der Abend zählt als ruhig.
- Die letzten rund 20 % der Tage (6.–10.11.) enthalten keinen foilbaren Abend. Ohne rückwirkende Daten ist der Recall im
  Holdout nicht messbar.

### Blockiert

Die Arbeitsumgebung erreicht die Datenquellen nicht (Antwort 403 des Proxys): `data.geo.admin.ch` (SwissMetNet),
`api.open-meteo.com`, `archive-api.open-meteo.com`, `previous-runs-api.open-meteo.com`,
`historical-forecast-api.open-meteo.com`, `*.meteobase.ch`. Ohne Upwind-Messwerte lässt sich kein Stand messen.
Simon gibt die Hosts in den Netzwerkeinstellungen der Umgebung frei.

### Nächste Schritte, sobald die Daten erreichbar sind

1. Rückwirkend prüfen: SwissMetNet `t_recent` (10-min-Werte ab 1.1.2026), meteoBase (am 16.10. ohne ältere Werte),
   archivierte Modellprognosen (Open-Meteo Previous Runs / Historical Forecast). Kosten-Nutzen je Quelle hier festhalten.
2. Wahrheit vor dem 16.10. auffüllen. Gibt es keine Seemessung, kommt nur eine Ersatzwahrheit aus Nachbarstationen in
   Frage; sie wird getrennt ausgewiesen und nie mit der Seemessung vermischt.
3. `eval/measure.cjs`: Parameter `--T`, Kennzahlen je Seestation, Holdout (letzte 20 % der Tage, bis zur Schlussmessung
   gesperrt), zeitliche Kreuzvalidierung auf dem Rest.
4. Baseline messen (12 und 14 kn), dann eine Hypothese pro Iteration mit Reviewer-Entscheid.

## Hypothesen

Noch keine gemessen.
