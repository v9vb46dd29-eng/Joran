# Übergabe: Joran, Windbild nach v35

14.11.2026 · Thread: «Heute 19 Uhr: keine Lage erkennbar» im Windbild prüfen und beheben, Kette Messung → Regeln → Prognose.

## Ziel

Die Prognose kurzfristig schlagen (Simon). Kette: Live-Messung (Upwind-Stationen, Chasseral, See) → Regeln → Prognose
der Modelle. Kurzfristig führt die Messung, dann die Kombination, ab 24 h die Synthese der Modelle.

## Aktueller Stand

v35 ist gemergt (PR #40). Im Windbild gilt:
- Lage von jetzt: Messung vor Prognose. Chasseral ab 10 kn bestimmt die Lage; misst er schwächer, gilt der See (ab 3 kn),
  danach die Prognose. Fehlt der Chasseral ganz, geht die Prognose vor dem See.
- Regler: Lage vom Chasseral oder Regel E führt 2 h fest, danach Messung, ausser die Prognose sagt einen Wechsel. Lage
  nur vom See oder Upwind-Signal gilt nur jetzt, ab +1 h Prognose (`FUEHRT = {kamm:2, see:0}` in `app/windbild.js`).
- «kaum Wind» statt «keine Lage erkennbar», wenn die angezeigte Stärke an den Spots unter 3 kn liegt.

## Entscheide (und warum)

- Lage vom See gilt nur jetzt: Fortgeschrieben schlägt sie die Prognose ab +1 h auf Holdout und neuen Tagen nicht.
- Seemessung vor der Prognose nur bei schwachem, nicht bei fehlendem Chasseral: Ohne Chasseral trifft der See Süd 0 %,
  Nordlage 4 % (`eval/windbild.cjs --pruefen`).
- Keine feine Abstimmung je Vorlauf (1, 3, 6, 12 h): 11 Tage mit Lage nur vom See, Regel ist bei 1, 3, 6 h schon die beste.
- Jede Regeländerung: messen, dann unabhängiger Reviewer; bei ANNEHMEN PR, Merge nur auf Simons Wort.

## Sackgassen, nicht erneut versuchen

- Lage vom See 6 h fortschreiben (v35 Runde 1): Reviewer ABLEHNEN. Gemessen auf Stunden, in denen die App wegen der
  Reihenfolge in `vorwahl()` gar keine Lage vom See wählte; auf dem Holdout schlechter.
- Mischregel (Messung, ausser Prognose sagt Wechsel) für Lagen vom See: bei +2 bis +4 h schlechter als die Prognose allein.

## Artefakte

- `eval/kette.cjs`: Messung der Kette (Prognose allein, `origin/main`, neu; Entwicklung, Holdout, danach; Bootstrap über
  Tage). Massgebend für Änderungen an `vorwahl()`, `mischLage()`, `FUEHRT`.
- `eval/ITERATIONEN.md`, Abschnitt v35: Zahlen, beide Review-Runden, offene Reviewer-Hinweise.
- `eval/NAECHSTE-SCHRITTE.md`, Abschnitt «Windbild: offen nach v35»: die drei Punkte für später.
- `eval/windbild-test.py`: Browser-Test, Fälle K (14.11.), L (See vor Prognose), M (Gegentest «kaum Wind»). Läuft mit
  `pip install playwright` und `CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`.

## Wörtlich (nicht ändern)

- Kernzahlen (`eval/kette.cjs`, 16.10.–13.11., Lage richtig): Chasseral +1 h neu 88 %, Prognose 75 % (95 % über Tage
  +5…+21 Punkte). Nur See, jetzt: neu 76 %, main 54 %, Prognose 52 % (53 Stunden, 11 Tage).
- Split (`eval/split.json`): Entwicklung bis 5.11., Holdout 6.–10.11.

## Arbeitspräferenzen aus diesem Thread

- Simon will, dass Claude prüft und auf dem eigenen Kenntnisstand entscheidet, statt Optionen vorzulegen.
- Unabhängiger Reviewer vor jedem PR; nur bei ANNEHMEN umsetzen.
- Antworten auf Deutsch, knapp, mit Zahlen.

## Offene Punkte

- Nächster Schritt: Punkt 1 aus `eval/NAECHSTE-SCHRITTE.md` («Abendlage neben der Lage vom See»).
- Dann: Punkt 2 («Jetzt» ohne gemessene Lage, braucht Simons Entscheid), Punkt 3 (Führungszeit je Lage).
- Daten: `eval/data/stunde_prognose.json` reicht bis 13.11.; für neue Tage `node eval/windbild-stunde.cjs` nach Löschen
  der Datei. Der Fall vom 14.11. ist erst dann im Archiv messbar.

## Startprompt für den neuen Chat

> Joran-Repo (`v9vb46dd29-eng/Joran`). Lies `eval/UEBERGABE-v35.md`, `ARCHITEKTUR.md` und in `eval/NAECHSTE-SCHRITTE.md`
> den Abschnitt «Windbild: offen nach v35». Setze Punkt 1 um: Zeigt das Windbild bei schwachem Chasseral die Lage vom
> See, soll zusätzlich die Abendlage aus der Prognose stehen, wenn sie abweicht. Miss vorher mit `eval/kette.cjs`, wie oft
> die Abendlage dabei stimmt, prüfe danach mit allen Prüfungen aus ARCHITEKTUR.md und lass einen unabhängigen Reviewer
> entscheiden. Bei ANNEHMEN PR auf `main`, mergen erst nach meinem Okay. Passende Skills: `modell-messen`, `app-bauen`.
