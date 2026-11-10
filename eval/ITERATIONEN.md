# Iterationslog Prognosemodell (Branch opt/modell)

Massstab ist die Baseline: `main` auf Commit 6efe43b (10.11.2026), gesichert als Branch `baseline-2026-11-10`.
Der Tag liess sich aus der Arbeitsumgebung nicht pushen (nur Branches möglich); Simon hat den Branch als Ersatz gewählt.

## Stand 10.11.2026: Bestandsaufnahme

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
- Die letzten rund 20 % der Tage (6.–10.11.) enthalten keinen foilbaren Abend. Der Recall ist im Holdout nicht messbar.
- Die Datenhosts waren zuerst gesperrt; Simon hat sie in den Netzwerkeinstellungen freigegeben.

### Datenquellen: Kosten und Nutzen

| Quelle | Nutzen | Kosten | Entscheid |
|---|---|---|---|
| Seearchiv im Branch `live` (meteoBase über die Action) | einzige Wahrheit, 27 Tagesdateien seit 15.10. | keine, läuft schon | genutzt |
| meteoBase rückwirkend | würde die Wahrheit bis 1.1. füllen | Diagrammdaten nur 24 h und mit Schlüssel geschützt | nicht möglich [OFFEN] |
| SwissMetNet `t_recent` + `t_now` | 10-min-Werte aller 12 Upwind-Stationen ab 1.1.2026 | frei, 12 Abrufe je Messlauf, Cache lokal | genutzt |
| Open-Meteo Previous Runs (archivierte Prognosen) | Prognose-Stufe der App nachspielen | frei, aber Tageskontingent am 10.11. erschöpft | nicht gemessen [OFFEN] |
| Neue Upwind-Stationen | mehr Vorlauf bei Bise oder Joran | je Station ein Abruf pro Refresh, dazu Pflege | nicht aufgenommen: Mit 1 Bise- und 0 Joran-Abenden lässt sich keine Station prüfen |
| Ersatzwahrheit aus Nachbarstationen vor dem 16.10. | mehr Tage | wäre aus 26 Tagen abgeleitet und damit zirkulär | verworfen |

Die Wahrheit reicht deshalb vom 16.10. bis 10.11.2026: 26 auswertbare Tage, alle automatisch, keine Markierung, keine Abweichung.

### Baseline, nachgespielt (T = 12 kn, Entwicklungstage 16.10.–5.11.)

- Alle 5 foilbaren Abende erhielten ein Live-Signal vor Beginn. An 12 der 16 ruhigen Abende kam ebenfalls eines (FPR 0.75).
- Auslöser der Fehlalarme: Grenchen und Wynau bei Bise an 7 Abenden (29.10.–4.11., See höchstens 8–14 kn), Chasseral an 3,
  Cressier an 1, Grenchen spät am 19.10. Das Nachspielen trifft die fünf echten Fehl-Pushes vom 31.10. bis 4.11.
- Vingelz hatte bei 12 kn keinen foilbaren Abend, alle fünf fanden an Ipsach statt. Bei West mass der See rund doppelt so
  viel wie Cressier und Neuchâtel, bei Bise etwa gleich viel wie Grenchen.
- Der Bise-Abend vom 17.10. (Ipsach 15 kn aus NNO) wurde nur vom Chasseral gemeldet. Grenchen und Wynau blieben still.

## Hypothesen

### H1: Stationsfaktor je Windsystem aus der Seemessung, unzuverlässige Stationen zählen nicht (Commit ff6eeac)

Idee: Die Stationsschwelle ist T × Faktor. Der Faktor ist der höchste Wert, mit dem die Station über 8/10/12/14 kn gemeinsam
85 % der foilbaren Abende rechtzeitig meldet, davon 90 %. Stationen über 30 % Fehlalarmen oder ohne solchen Faktor lösen keinen
Push aus. Kosten: keine neue Datenquelle, ein Parametersatz in `core.js`. Nutzen: Schwellen passen zu jeder Einstellung.

Messung (`node eval/measure.cjs --offline --T 12`, Kreuzvalidierung): 12 kn Recall Ipsach 1.00 → 1.00, FPR 0.75 → 0.75,
Vorlauf 101 → 101 min; 14 kn Recall 0.75 → 0.75, FPR 0.58 → 0.42. Bei 10 kn stieg die FPR von 0.78 auf 0.89.

Reviewer Runde 1: **ANNEHMEN, vorläufig.** Keine Regel verletzt, aber: Mit den Parametern aller Entwicklungstage fallen
Grenchen und Wynau weg, bei 10 kn blieben der 1. und 2.11. ohne Push (Recall 1.00 → 0.75). Bullet/La Frétaz erhielt aus drei
Tagen den Faktor 0.32. Beides widerspricht dem Vorrang verpasster Abende. Als eigene Regel **verworfen**, in H2 überarbeitet.

### H2: Modell v2 – wie H1, aber keine Station wird stummgeschaltet (Commits 57fae30, 11370b8, 66caa94)

Änderungen gegenüber H1: mindestens 4 Ereignistage; Faktor mindestens das 0.5-Fache des Startwerts; eine Station, die heute
Push auslöst, behält Startwert und Push, wenn sich kein brauchbarer Faktor findet, und bekommt nie eine höhere Schwelle;
Erweiterungsstationen zählen nur mit brauchbarem Faktor; eine eigene Kalibrierung im Rückblick geht vor; für den
Taubenlöchler zählen nur Abende mit Nord oder Bise am See.

Parameter aus den Entwicklungstagen (`node eval/measure.cjs --offline --fit`, hinterlegt in `core.MODEL.f`):
West: Cressier 0.81, Neuchâtel 0.81, La Brévine 0.86, La Chaux-de-Fonds 0.72, Chaumont 0.63; Süd: Payerne 0.63.
Kein brauchbarer Faktor: Grenchen/Bise (FPR 0.67), Wynau/Bise (FPR 0.35). Kein Eintrag: Joran, Taubenlöchler, Nord, Südost.

| Messung | Schwelle | Recall See | FPR See | Vorlauf | Fälle EV/NEV |
|---|---|---|---|---|---|
| Kreuzvalidierung (`--T 12`) | 12 kn | 1.00 → 1.00 | 0.75 → 0.75 | 101 → 101 min | 4/12 |
| Kreuzvalidierung | 14 kn | 0.75 → 0.75 | 0.58 → 0.58 | 86 → 86 min | 4/12 |
| Anpassung (`--teil anpassung`, zu günstig) | 12 kn | 1.00 → 1.00 | 0.75 → 0.75 | 106 → 122 min | 5/16 |
| Anpassung | 14 kn | 0.75 → 1.00 | 0.53 → 0.59 | 86 → 119 min | 4/17 |
| Holdout (`--teil holdout`, einmal, `eval/HOLDOUT.txt`) | 12 und 14 kn | – → – | 0.00 → 0.00 | – | 0/5 |

Reviewer Runde 2 (57fae30): **ANNEHMEN, vorläufig.** Keine blockierenden Defekte; inaktiv 40'320 Vergleiche gegen die
Baseline ohne Abweichung, aktiviert geht kein Baseline-Signal verloren. Hinweise übernommen: Startwert als Obergrenze,
eigene Kalibrierung geht vor, Taubenlöchler nur bei Nord/Bise am See.

Reviewer Runde 3 (11370b8): **ANNEHMEN, vorläufig.** Keine Regel verletzt, keine blockierenden Defekte. Eine Aktivierung
kann keinen bisherigen Push entfernen, das Risiko liegt allein bei den Fehlalarmen. Die Kreuzvalidierung belegt aber keinen
Nutzen: Alle West-Abende liegen im ersten Testblock, dessen Trainingsteil keinen enthält. Danach wurde nur noch der Wortlaut
einer Ausgabezeile geändert (66caa94), dann der Holdout einmal gemessen.

**Status: vorläufig.** `MODEL.active` bleibt `false`, die App rechnet wie die Baseline. Aktivieren: `MODEL.active = true`.

### Nicht weiterverfolgt

- Chasseral nicht mehr Push-fähig: drei Fehlalarme weniger, aber der Bise-Abend vom 17.10. wäre verpasst worden.
- Grenchen und Wynau mit höherem Bise-Faktor: Die Bise-Abende lagen am See bei 10–14 kn, also an der Schwelle. Kein Faktor
  trennt sie; bei 10 kn waren der 1. und 2.11. foilbar.
- Bestätigung durch die Seemessung vor dem Push: nähme dem Joran den Vorlauf.

## Entscheidungen und Annahmen

- Baseline als Branch statt Tag (Tag-Push aus der Arbeitsumgebung gesperrt), mit Simon abgesprochen.
- Workflow nicht geändert: Das Archivieren läuft seit dem 16.10. fehlerfrei und abgefangen.
- Die Baseline ist die App, wie sie für Simon rechnet: `users/simon.json` ohne eigene Stationsschwellen, also Startwerte.
- Aufteilung fest in `eval/split.json`: Entwicklung 16.10.–5.11., Holdout 6.–10.11.
- Gesamtmodell = Live-Signal (Upwind-Stationen und Regel E). Die Prognose-Stufe ist nicht gemessen [OFFEN].
- Die Vorlaufzeit ist kaum aussagekräftig: An den West-Abenden wehte es schon vor 16 Uhr, der Beginn ist der Fensteranfang
  und das Signal kommt beim ersten Prüfschritt um 14 Uhr. Das gilt für Baseline und Modell gleich [OFFEN].
- Das Nachspielen rechnet ohne Lieferverzug von SwissMetNet und ohne Sturmsperre vom See.
- Die Regel «höchstens +10 Punkte FPR» ist bei einer Baseline-FPR von 0.75 kaum zu verletzen.
- `core.js`: Datums-Formatierer werden einmal angelegt (gleiches Ergebnis, das Nachspielen braucht sonst mehrere GB Speicher).

## Ausblick: Wann reichen die Ereignistage?

Gefordert sind 10 Ereignistage je Station und Windsystem. Stand bei 12 kn: West 4, Bise 1, alle anderen 0 in 3.7 Wochen.

- West: bei gleicher Häufigkeit etwa 6 weitere Wochen, also gegen Ende Dezember 2026.
- Bise: bei einem Abend in 3.7 Wochen rund 33 Wochen, eher Sommer 2027.
- Joran: Regel E schlug 2026 an 27 Abenden an, davon 23 zwischen April und September. Zehn foilbare Joran-Abende sind
  frühestens im Juni oder Juli 2027 zu erwarten, in rund 30 bis 35 Wochen.
- Taubenlöchler, Süd, Südost, Nord: bisher kein Abend. Für diese Zellen ist die Regel vielleicht nie erfüllbar; sie braucht
  einen Entscheid, etwa nur West, Bise und Joran zu verlangen.
- Markierungen in `eval/truth.json` (vor allem `tl:` und `sys:`) beschleunigen die Zuordnung, ersetzen aber keine Abende.
