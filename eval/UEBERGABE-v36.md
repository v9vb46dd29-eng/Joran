# Übergabe: Joran, Windbild nach v36

15.11.2026 · Thread: Punkt 1 aus «Windbild: offen nach v35» umsetzen (Abendlage neben der Lage vom See), messen, Review, PR.

## Ziel

Die Prognose kurzfristig schlagen (Simon). Kette: Live-Messung (Upwind-Stationen, Chasseral, See) → Regeln → Prognose
der Modelle. Kurzfristig führt die Messung, dann die Kombination, ab 24 h die Synthese der Modelle.

## Aktueller Stand

v36 ist gemergt (PR #41, Merge-Commit `b464b64`, auf Simons «merge»). Im Windbild gilt zusätzlich zu v35
(`eval/UEBERGABE-v35.md`):
- Kommt die Lage von jetzt aus der Seemessung, misst der Chasseral schwach (unter `kammMin`) und weicht die Lage fürs
  Zeitfenster aus der Prognose ab (West und Süd gleich), steht in der Kopfzeile «Jetzt: Bise · Abend: West oder Süd
  (Prognose)». Nur von 8 Uhr bis Fensterende. Nicht bei Bise am See unter starkem Chasseral (dort steht «darüber …»),
  nicht ohne Chasseral (Lage unsicher). Code: `heute()` und `head()` in `app/windbild.js`.
- Nur Anzeige: Vorwahl, Regler, Kern unverändert (`eval/gleich.cjs`: 0 Abweichungen).

## Entscheide (und warum)

- Abendlage anzeigen: Bei Abweichung trifft sie 71 %, die Lage vom See 15 % (siehe «Wörtlich»).
- Nur bei schwachem Chasseral: Bei Bise am See unter starkem Chasseral wurde die Kopfzeile dreizeilig (Browser-Test J),
  und «darüber …» zeigt den Wind oben schon.
- Erst ab 8 Uhr (Reviewer-Hinweis 1): gemessen ist nur 8–21 Uhr.
- Weiterhin: jede Regeländerung messen, dann unabhängiger Reviewer; bei ANNEHMEN PR, Merge nur auf Simons Wort.

## Sackgassen, nicht erneut versuchen

Aus v35 weiterhin gültig (`eval/UEBERGABE-v35.md`): Lage vom See 6 h fortschreiben; Mischregel für Lagen vom See.
In diesem Thread kam keine neue Sackgasse dazu.

## Artefakte

- `eval/kette.cjs`, letzter Abschnitt «Abendlage»: Messung der Abendlage. Läuft erst nach `node eval/measure.cjs --T 12`
  (füllt `eval/cache`; braucht `git fetch origin baseline-2026-11-10` und die Tags).
- `eval/ITERATIONEN.md`, Abschnitt v36: Zahlen, Review ANNEHMEN, offene Hinweise.
- `eval/windbild-test.py`, Fall N: Abendlage, höchstens 2 Zeilen, Gegentest. Läuft mit `pip install playwright` und
  `CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`.
- `eval/NAECHSTE-SCHRITTE.md`: Punkt 1 als umgesetzt markiert, Überprüfung Ende Dezember Schritt 16 ergänzt
  (Abendlage nachmessen, sonst Anzeige entfernen).

## Wörtlich (nicht ändern)

- `eval/kette.cjs`, 16.10.–13.11., Lage richtig bei Abweichung (Lage vom See / Abendlage): alle 15 % / 71 % (140 Paare,
  24 Std., 6 Tage, +40…+81 Punkte über Tage); Entwicklung 21/78 (3 Tage); Holdout 0/40 (2 Tage); 11.–13.11. 14/86 (1 Tag).
- Split (`eval/split.json`): Entwicklung bis 5.11., Holdout 6.–10.11.

## Arbeitspräferenzen aus diesem Thread

- Simon will, dass Claude prüft und auf dem eigenen Kenntnisstand entscheidet, statt Optionen vorzulegen.
- Unabhängiger Reviewer vor jedem PR; nur bei ANNEHMEN umsetzen. Merge erst auf Simons Wort («merge»).
- Antworten auf Deutsch, knapp, mit Zahlen.

## Offene Punkte

- Nächster Schritt: Punkt 2 aus `eval/NAECHSTE-SCHRITTE.md` («Jetzt» ohne gemessene Lage). Braucht zuerst Simons
  Entscheid: Soll die Karte bei «jetzt» die laufende Stunde zeigen (Prognose der Stunde trifft 83 %, heutige Anzeige
  der Abendlage 31 %; 41 Stunden, 10 Tage) und die Abendlage nur in der Kopfzeile stehen?
- Dann: Punkt 3 (Führungszeit je Lage aus der langen Chasseral-Reihe, mit `eval/kette.cjs` gegen Holdout prüfen).
- Nicht blockierend aus dem Review v36: Fenster «Nachmittag» und «Tag» ungemessen, Beschriftung «Später» unscharf;
  Zweig «nach dem Fenster» im Browser nur nach 21 Uhr geprüft; «· live» steht bei 390 px allein auf der zweiten Zeile.
- Daten: `eval/data/stunde_prognose.json` reicht bis 13.11.; für neue Tage die Datei löschen und
  `node eval/windbild-stunde.cjs` laufen lassen.

## Startprompt für den neuen Chat

> Joran-Repo (`v9vb46dd29-eng/Joran`). Lies `eval/UEBERGABE-v36.md`, `ARCHITEKTUR.md` und in `eval/NAECHSTE-SCHRITTE.md`
> den Abschnitt «Windbild: offen nach v35». Nächster Schritt ist Punkt 2 («Jetzt» ohne gemessene Lage). Lege mir zuerst
> den Entscheid mit Zahlen aus `eval/kette.cjs` (Gruppe «ohne») vor: Soll die Karte bei «jetzt» die laufende Stunde
> zeigen und die Abendlage nur in der Kopfzeile stehen? Nach meinem Entscheid: umsetzen, mit allen Prüfungen aus
> ARCHITEKTUR.md prüfen, unabhängigen Reviewer entscheiden lassen, bei ANNEHMEN PR auf `main`, mergen erst nach meinem
> Okay. Passende Skills: `modell-messen`, `app-bauen`.
