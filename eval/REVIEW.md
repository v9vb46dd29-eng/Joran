# Reviewer-Entscheide (Upwind-Kalibrierung, Branch opt/upwind)

Je Runde ein separater Reviewer ohne Kenntnis des Build-Verlaufs. Er erhielt nur Diff, Messskript und Daten und führte
`node eval/measure.cjs --offline` und `node eval/selftest.cjs` selbst aus. Massgebend ist Runde 3.

| Runde | Stand | Entscheid | Status der Regel | Blockierende Defekte |
|---|---|---|---|---|
| 1 | 1dfc329 | ABLEHNEN | vorläufig (nur committen) | keine |
| 2 | e2bff21 | ABLEHNEN | vorläufig (nur committen) | `lakeDay` prüfte gleitendes Mittel statt «während minH Stunden ≥ T» → behoben in ac26578 |
| 3 | ac26578 | **ABLEHNEN** | **vorläufig (nur committen)** | keine |

**Begründung Runde 3:** Keine Akzeptanzregel ist durch Daten belegt. Die zwei Archivtage enthalten keinen Wert im
Abendfenster, also 0 bekannte Tage, keine Aufteilung früh/spät und 0 von 19 Zellen mit ≥ 10 Ereignistagen.
`CAL.rule` bleibt `"pss"`, die App verhält sich wie im Ausgangsstand. Archiv, Messskript und Recall-Regel sind ohne
blockierende Fehler umgesetzt (Workflow nachgestellt, Peirce-Pfad und `isTrusted` gegen den Ausgangsstand geprüft,
Recall-Regel gegen eine Brute-Force-Gegenrechnung).

Messung Runde 3:
```
[?] Recall gesamt steigt oder bleibt gleich: – → –
[?] FPR steigt um höchstens 10 Prozentpunkte: – → –
[?] Vorlaufzeit mindestens 30 min: –
[?] Schwellen auf früheren Tagen festgelegt, auf späteren gemessen: keine Aufteilung möglich
[ ] Je Station und Windsystem ≥ 10 Ereignistage: 0 von 19 Zellen
Ergebnis nach Regeln: NICHT AUSWERTBAR — VORLÄUFIG
```

## Übernommen aus den Hinweisen

- Runde 1: Gesamt-Recall nur mit Push-fähigen Stationen und rechtzeitigen Signalen; `rel` wirkt nur bei aktiver
  Recall-Regel; Ergebnis nennt verfehlte Regeln auch bei zu wenigen Ereignistagen.
- Runde 2: Wahrheit «jeder 10-min-Wert ≥ T während minH Stunden»; Abruf von `live` wieder wie im Ausgangsstand
  (Teilabruf hätte einen Roundtrip mehr gekostet); FPR gesamt nur über Push-fähige Stationen; Stundenstempel am Stundenende.

## Offen (nicht blockierend, vor dem Aktivieren klären)

1. Vorlaufzeit in «ALLE» mittelt auch negative Werte verspäteter Signale, der Recall zählt dort nur rechtzeitige Treffer.
2. «≥ 10 Ereignistage» zählt auch Tage ohne Stationsdaten; Tage ohne erkanntes Windsystem zählen in keiner Zelle.
3. Rundung wie in der App: 13.5 kn zählt als 14 kn.
4. Seltene Zellen (z. B. Payerne/so, Mühleberg/so, Wynau/bise) erreichen 10 Ereignistage vielleicht nie; dann ist die
   Regel «je Station und Windsystem» faktisch nicht erfüllbar und braucht einen Entscheid (z. B. nur Hauptsysteme).
5. `measure.cjs` wird auf grossen Datenmengen langsam (`Intl` in `localHour`/`dayOfDate`).
