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

## Lagebild nach Luftschichten (10.11.2026, Auswertung ohne Modelländerung)

Anstoss von Simon: Das Modell soll verstehen, wie sich der Wind in der Bieler Bucht je Lage verhält, und dafür Winde aus
verschiedenen Höhen nutzen. `node eval/schichten.cjs --T 12` wertet die Entwicklungstage aus (8–22 Uhr, 1614
Zehnminutenwerte): Wind auf Kammhöhe (Chasseral, 1594 m), am Jurasüdfuss (Cressier, 431 m) und die Temperaturabnahme
dazwischen als Mass, ob die Schichten gekoppelt sind (unter 4 K je km = stabil). Der Holdout bleibt unberührt.

| Lage auf dem Chasseral | Schichtung | Tage | Kamm | Cressier | Ipsach (Anteil ≥ 12 kn) | Vingelz (Anteil ≥ 12 kn) |
|---|---|---|---|---|---|---|
| West | gemischt | 5 | 20 kn | 11 kn SW | 18 kn (74 %) | 8 kn (15 %) |
| West | stabil | 2 | 14 kn | 0 kn | 2 kn (0 %) | 2 kn (0 %) |
| Südwest | gemischt | 5 | 20 kn | 11 kn SW | 18 kn (85 %) | 10 kn (44 %) |
| Südwest | stabil | 4 | 16 kn | 1 kn | 2 kn (0 %) | 2 kn (0 %) |
| Süd | gemischt | 4 | 33 kn | 9 kn SW | 16 kn (63 %) | 11 kn (38 %) |
| Ost (Bise) | gemischt | 9 | 22 kn | 9 kn NO | 8 kn (5 %) | 8 kn (11 %) |
| Nordost (Bise) | gemischt | 3 | 16 kn | 11 kn NO | 8 kn (6 %) | 9 kn (28 %) |
| Nord | gemischt | 3 | 25 kn | 5 kn | 8 kn (31 %) | 6 kn (0 %) |
| Nordwest | gemischt | 5 | 17 kn | 3 kn | 5 kn (27 %) | 5 kn (4 %) |
| Nordwest | stabil | 3 | 14 kn | 1 kn | 1 kn (0 %) | 1 kn (0 %) |

Was sich zeigt (wenige Tage je Zeile, die Zehnminutenwerte eines Tages hängen zusammen, also Hinweise und keine Belege):

- **Kopplung entscheidet.** Bei gleichem Höhenwind aus West oder Südwest misst Ipsach 18 kn, wenn die Luft durchmischt ist,
  und 2 kn bei stabiler Schichtung. Der Höhenwind allein sagt nichts, erst zusammen mit der Schichtung.
- **West:** Ipsach erreicht rund 0.9 des Kammwinds und das 1.7-Fache von Cressier. Vingelz liegt im Windschatten und
  bekommt nur 0.4 bis 0.6 von Ipsach.
- **Bise:** Der See misst etwa 0.8 des Winds am Jurasüdfuss und bleibt meist unter 12 kn. Vingelz ist hier gleich stark
  oder stärker als Ipsach.
- **Nordlage (17.10.):** 25 kn aus Nord auf dem Kamm, am Jurasüdfuss fast nichts, Ipsach 13 kn aus Nordost. Diese Lage sieht
  nur der Chasseral; keine Station der unteren Schicht kündigt sie an.
- **Chasseral-Signale:** Die drei Fehlalarme (16., 20., 27.10.) fielen auf 2.1, 3.7 und 1.1 K je km, die zwei Treffer
  (17., 25.10.) auf 6.1 und 7.7 K je km.

### H3: Kopplung der Luftschichten als Bedingung für Chasseral-Signale (Commits 5742fb9 und Folgecommit)

Ein Signal vom Chasseral zählt nur, wenn die Temperatur von Cressier (431 m) bis zum Chasseral (1594 m) um mindestens
4 K je km abnimmt. Fehlt eine Temperatur, zählt das Signal. Teil von Modell v2, also nicht aktiv. Kosten: keine neue
Datenquelle. Der Grenzwert ist fest und stammt aus dem Lagebild aller Entwicklungstage; er wird in der Kreuzvalidierung
nicht je Block neu bestimmt, der Gewinn bei der FPR ist deshalb nicht unabhängig gemessen.

| Messung | Schwelle | Recall See | FPR See | Vorlauf | Fälle EV/NEV |
|---|---|---|---|---|---|
| Kreuzvalidierung (`--T 12`) | 12 kn | 1.00 → 1.00 | 0.75 → 0.67 | 101 → 101 min | 4/12 |
| Kreuzvalidierung | 14 kn | 0.75 → 0.75 | 0.58 → 0.50 | 86 → 86 min | 4/12 |
| Anpassung (zu günstig) | 12 kn | 1.00 → 1.00 | 0.75 → 0.63 | 106 → 122 min | 5/16 |
| Anpassung | 14 kn | 0.75 → 1.00 | 0.53 → 0.53 | 86 → 119 min | 4/17 |
| Holdout, zweiter Lauf (von Simon freigegeben, `eval/HOLDOUT.txt`) | 12 und 14 kn | – → – | 0.00 → 0.00 | – | 0/5 |

Die Sperre entfernt die Fehlalarme vom 16. und 27.10. Am 20.10. steigt der Wert nach zehn Minuten über 4 K je km, der
Fehlalarm kommt nur später (erwartet waren drei Fehlalarme weniger, gemessen sind zwei).

Reviewer (5742fb9): **ANNEHMEN, vorläufig.** Keine Regel verletzt, keine blockierenden Defekte, inaktiv 4410
`nowcast`-Schritte ohne Abweichung zur Baseline. Der Recall ist robust (Grenzwerte von 3 bis 6 K je km verpassen keinen
Abend), der Grenzwert selbst ist mit vier Chasseral-Tagen schwach belegt. Vor dem Aktivieren fehlen die riskanten Lagen:
Bise oder Nordlage unter einer Inversion (am 17.10. meldete nur der Chasseral), Joran im Sommer, Inversion mit Durchbruch
[OFFEN]. Als Test taugen erst Tage nach dem 10.11. Nach dem Entscheid kam nur eine Absicherung in `lapseRate` dazu
(fehlende Bezugsstation), danach der Holdout-Lauf.

Weitere Höhenquelle: Modellwind auf 850 und 700 hPa über Open-Meteo (frei, ohne Schlüssel). Nutzen: Höhenwind als Prognose
für den nächsten Tag statt nur als Messung. Kosten: ein zusätzlicher Abruf je Refresh. Am 10.11. nicht prüfbar, das
Tageskontingent war erschöpft [OFFEN].

## 11.11.2026: Höhenwind aus dem Modell und Prognose-Stufe (Auswertung, keine Modelländerung)

Open-Meteo antwortete wieder. Alles auf den Entwicklungstagen (16.10.–5.11., 21 Tage), der Holdout bleibt unberührt.

### Datenquellen: Kosten und Nutzen

| Quelle | Befund | Entscheid |
|---|---|---|
| Open-Meteo Previous Runs, 10 m, 24 h Vorlauf (vier Modelle der App) | verfügbar, in `eval/data/prognose_vortag.json` abgelegt | genutzt: Prognose-Stufe ist jetzt messbar |
| Wind auf 850/700 hPa von ICON-CH2 | im Archiv leer; Previous Runs kennt keine Druckflächen | nicht nutzbar |
| Wind auf 850/700 hPa von ICON-EU und ECMWF IFS (Historical Forecast) | verfügbar, in `eval/data/hoehenwind_*.json` | genutzt für die Auswertung. Es sind aneinandergereihte jüngste Läufe, also eher zu günstig gegenüber einer echten Vortagesprognose |
| In der App: ein Abruf mehr je Refresh (ICON-EU, Punkt Seemitte, 850 hPa und 2 m) | siehe H4 | noch nicht eingebaut |

### Prognose-Stufe der App nachgespielt (`node eval/prognose.cjs --T 12 --offline`)

| Schwelle | Recall | FPR |
|---|---|---|
| 10 kn | 1.00 (8/8) | 0.69 (9/13) |
| 12 kn | 1.00 (5/5) | 0.50 (8/16) |
| 14 kn | 1.00 (4/4) | 0.35 (6/17) |

Die Prognose am Vortag kündigte jeden foilbaren Abend an. Alle acht Fehlalarme bei 12 kn fielen auf Bise-Tage (19.10. und
29.10.–4.11.): Die Modelle sehen bei Bise mehr Wind auf dem See, als ankommt. Damit ist die Prognose-Stufe nicht mehr [OFFEN].

### Höhenwind plus Schichtung (`node eval/hoehenwind.cjs --T 12`)

Merkmal je Tag: Mittel 14–20 Uhr des Winds auf 850 hPa (rund 1500 m), gezählt nur bei durchmischter Luft
(Temperaturabnahme 2 m → 850 hPa mindestens 4 K je km). Verglichen mit dem Modellwind auf 10 m und auf 700 hPa.

| Merkmal (ICON-EU, 12 kn) | Grenze ohne verpassten Abend | FPR auf allen 21 Tagen | Zeitlich geprüft: Recall, FPR |
|---|---|---|---|
| Wind 10 m | 3.1 kn | 0.69 | 1.00, 0.83 |
| Wind 850 hPa | 13.8 kn | 0.50 | 1.00, 0.75 |
| Wind 700 hPa | 6.6 kn | 0.81 | 1.00, 0.92 |
| Wind 850 hPa, nur gekoppelt | 13.8 kn | 0.25 | 1.00 (4/4), 0.42 (5/12) |

Mit ECMWF IFS ergibt das gekoppelte Merkmal dieselben Werte (0.25 und 0.42). Bei 14 kn: FPR 0.12 auf allen Tagen.
«Zeitlich geprüft» heisst: Grenze aus früheren Tagen (Blöcke wie in `eval/measure.cjs`), 90 % davon, gemessen auf späteren.

- Der Wind auf 850 hPa trennt besser als der Modellwind auf 10 m, aber erst zusammen mit der Schichtung deutlich.
- 700 hPa hilft nicht; diese Schicht liegt zu hoch über dem Jura.
- Die verbleibenden Fehlalarme sind wieder Bise-Tage (30.10., 1. und 2.11. mit 24–34 kn auf 850 hPa, See 10–14 kn) und der
  22.10. Bei West kommt rund 0.8 des 850-hPa-Winds in Ipsach an, bei Bise rund 0.4.

### Kandidat H4 (noch nicht gebaut): Höhenwind und Schichtung in der Prognose-Stufe

Die Prognose zählt einen Abend nur, wenn zusätzlich der Wind auf 850 hPa bei durchmischter Luft über einer Grenze liegt, die
von der Windrichtung abhängt (West anders als Bise). Kosten: ein zusätzlicher Abruf je Refresh in App und Action (ICON-EU),
ein Merkmal mehr in `core.summarize`, Messung der Prognose-Stufe in `eval/measure.cjs`. Nutzen nach der Auswertung: FPR der
Prognose bei 12 kn von 0.50 auf rund 0.25, ohne verpassten Abend. Vorbehalt: 21 Tage, 5 Abende, kurze Vorlaufzeit der
Archivdaten, kein Joran. Der Einbau ändert `core.summarize`, `index.html` und `push/check.cjs` und braucht den
Build-Review-Loop; er steht noch aus.

### Geprüft und nicht weiterverfolgt: Korrekturfaktor für Bise in der Prognose

Die App kennt einen Korrekturfaktor je Windrichtung (`kDir`). `node eval/prognose.cjs --T 12 --bise 0.75 --offline`:
FPR 0.50 → 0.06, aber Recall 1.00 → 0.80. Der Abend vom 17.10. (Nordlage, Ipsach 15 kn) ginge verloren, schon bei
Faktor 0.85. Das widerspricht dem Vorrang verpasster Abende. Bei 10 und 14 kn bliebe der Recall bei 1.00.

### H4: Höhenwind und Schichtung in der Prognose-Stufe (11.11.2026, vorläufig, nicht aktiv)

Gebaut: `core.fetchHoehe` (ein Abruf ICON-EU, Punkt Seemitte), `core.hoeheDay` (Mittel von 2 h vor dem Zeitfenster bis
zu dessen Ende), `core.hoeheOk` (Wind auf 850 hPa bei durchmischter Luft mindestens 1.1 × T). Die App zeigt den Höhenwind
als Hinweis. Die Regel wirkt nur mit aktivem Modell; die Action ruft den Höhenwind nicht ab, der Push-Lauf wird nicht
langsamer. `eval/measure.cjs` misst neu auch die Prognose-Stufe (Zeile «Prognose am Vortag»).

Kosten: ein Abruf mehr je Refresh in der App. Nutzen: Lagebild für jede Windlage; in der Messung deutlich weniger
Fehlalarme der Prognose. Der Faktor 1.1 ist fest und stammt aus allen Entwicklungstagen, der Gewinn ist also nicht
unabhängig gemessen; die Höhendaten haben kurze Vorlaufzeit.

| Kreuzvalidierung, Prognose am Vortag | Recall Baseline → neu | FPR Baseline → neu | Fälle EV/NEV |
|---|---|---|---|
| 10 kn | 1.00 → 1.00 | 0.78 → 0.22 | 7/9 |
| 12 kn | 1.00 → 1.00 | 0.58 → 0.25 | 4/12 |
| 14 kn | 1.00 → 1.00 | 0.50 → 0.25 | 4/12 |

Dazu behoben: Die Richtungstreue der Seestationen wurde nie gespeichert, weil meteoBase das Prozentzeichen als `&#037;`
schreibt. Ab jetzt steht sie im Archiv; sie wird für die Auswertung der Joran-Drehung gebraucht.

Der Holdout wurde für H4 nicht gemessen: Für die Tage 6.–10.11. sind keine Höhendaten abgelegt, und es gab dort keinen
foilbaren Abend.

Reviewer (19539c4): **ANNEHMEN, H4 vorläufig.** Keine blockierenden Defekte; Push und Bewertung verhalten sich wie v16,
der Holdout blieb unberührt. Der Faktor 1.1 ist knapp: Die Grenze liegt bei 13.2 kn, der schwächste foilbare Abend
(17.10.) hatte 14 kn auf 850 hPa. Zeitlich geprüft liegt die FPR bei 0.42 statt 0.25. Vor dem Aktivieren je Block
bestimmen und mit echten Vortagesläufen messen. Übernommene Hinweise: `hoeheDay` verträgt fehlende Felder, der Höhenwind
wird im Browser zwischengespeichert, Texte zu «knapp», «sehr wahrscheinlich» und «Wann?» präzisiert.

## 11.11.2026, zweiter Teil: Messung näher an der Wirklichkeit, H3/H4 je Block (v18)

Auftrag von Simon: Entscheid zur 10-Tage-Regel eintragen, H3 und H4 je Block bestimmen, Lieferverzug und Sturmsperre ins
Nachspielen, Markierungen einlesbar machen, Texte im Dashboard. Das Modell bleibt inaktiv, Push und Bewertung der App
ändern sich nicht. Der Holdout wurde nicht angefasst.

### Entscheid: 10 Ereignistage je Windsystem einzeln

Simon hat den Entscheid delegiert. Die Regel gilt je Windsystem einzeln: Ein System mit 10 Abenden kann für sich zur
Aktivierung vorgeschlagen werden. Begründung: Süd, Südost und Taubenlöchler hatten in 3.7 Wochen keinen Abend und würden
West sonst auf unbestimmte Zeit blockieren. Die Messung zeigt den Stand je System in der letzten Zeile (heute: West 4,
Bise 1, bereit keines). Kosten: Eine Aktivierung je System braucht einen Schalter je System, der noch fehlt.

### Lieferverzug der Stationsdaten (`node eval/verzug.cjs`)

Die echten Zeiten der Nachricht «Wind kommt — Messung» stehen in der Git-Geschichte von `push/state.json` (18 Tage). Das
Nachspielen der Baseline trifft sie je nach angenommenem Verzug so:

| Verzug | Treffer auf 10 min genau | Median der Abweichung |
|---|---|---|
| 0 min | 6 von 18 | 10 min |
| 10 min | 11 von 18 | 0 min |
| 20 min | 6 von 18 | 10 min |
| 30 min | 5 von 18 | 20 min |
| 40 min | 8 von 18 | 10 min |

Die Action sieht also Werte, die rund 10 min alt sind. Seit dem 29.10. trifft das an allen sieben Tagen. Die Abweichungen
davor fallen in die Zeit älterer App-Versionen. Wirklich unterscheiden nur rund fünf Tage: Ein Push um 14:00 (erster
Prüfschritt) passt zu fast jedem Verzug. Standard im Messskript: `--verzug 10`.

### Sturmsperre vom See

Das Nachspielen prüft jetzt bei jedem Schritt die Seemessung gegen die eigenen Grenzen (`core.lakeStorm`), wie die Action.
Dafür nimmt `lakeStorm` neu einen Zeitpunkt entgegen. Nur das Messskript übergibt ihn; App und Action rufen die Funktion
wie bisher auf und rechnen unverändert. Auf den Entwicklungstagen griff
die Sperre an einem Tag: am 25.10. (Sturmlage) von 14:00 bis 14:20, der Push kam trotzdem rechtzeitig.

### H3 und H4 je Block bestimmt (`core.fitModel`)

- **H3, Kopplung:** höchste Grenze, mit der das erste rechtzeitige Chasseral-Signal an jedem foilbaren Abend bestehen
  bleibt, davon 90 %, höchstens 4 K je km. Die Daten dürfen die Grenze also nur lockern. Unter 2 solchen Abenden gibt es
  keine Grenze. Ohne die Obergrenze läge der Wert bei 5.4 K je km (aus den zwei Abenden 17. und 25.10.); die
  hinterlegten 4 sind vorsichtiger.
- **H4, Höhenwind:** kleinstes Verhältnis von Höhenwind zu Schwelle über alle foilbaren Abende bei 10, 12 und 14 kn, davon
  90 %. Unter 4 Abenden oder wenn ein foilbarer Abend bei stabiler Schichtung lag, gibt es keine Regel. 8 kn zählt hier
  nicht mit, weil sich die Schwelle erst ab 10 kn einstellen lässt: Bei 8 kn waren der 19. und der 29.10. foilbar und
  stabil geschichtet, H4 hätte beide gesperrt.
- Aus allen Entwicklungstagen ergibt `--fit` Kopplung 4 K je km (unverändert) und Höhenwind **1.0 × T** statt 1.1. Der
  alte Wert hatte keinen Sicherheitsabstand (Grenze 13.2 kn, schwächster Abend 13.8 kn). Hinterlegt ist neu 1.0.

Je Block: Block 1 (Training 16.–20.10., ein foilbarer Abend) bekommt weder Grenze noch Regel. Blöcke 2 und 3 bekommen
4 K je km und 1.0 × T.

| Kreuzvalidierung, neues Nachspielen | Schwelle | Recall B → neu | FPR B → neu | Vorlauf | Fälle EV/NEV |
|---|---|---|---|---|---|
| Live-Signal, See | 10 kn | 1.00 → 1.00 | 0.78 → 0.78 | 135 min | 7/9 |
| Live-Signal, See | 12 kn | 1.00 → 1.00 | 0.75 → 0.67 | 91 min | 4/12 |
| Live-Signal, See | 14 kn | 0.75 → 0.75 | 0.58 → 0.50 | 76 min | 4/12 |
| Prognose am Vortag | 10 kn | 1.00 → 1.00 | 0.78 → 0.22 | – | 7/9 |
| Prognose am Vortag | 12 kn | 1.00 → 1.00 | 0.58 → 0.33 | – | 4/12 |
| Prognose am Vortag | 14 kn | 1.00 → 1.00 | 0.50 → 0.25 | – | 4/12 |

Was sich gegenüber dem ersten Teil des Tages ändert:

- H3 hält: Der Gewinn beim Live-Signal bleibt (0.75 → 0.67), auch wenn die Grenze je Block bestimmt wird.
- H4 bei 12 kn: FPR 0.33 statt 0.25. Der tiefere Faktor lässt den 3.11. durch (12.9 kn auf 850 hPa, Bise).
- Vorlauf 91 statt 101 min bei 12 kn: je 10 min Lieferverzug, dazu am 25.10. die Sturmsperre. Recall und FPR ändern sich
  durch Verzug und Sperre nicht. Mit `--verzug 0 --ohne-sturm --fest` kommen beim Live-Signal die Zahlen vom Vormittag
  wieder heraus (0.75 → 0.67, 101 min). Die Prognose bleibt bei 0.33, weil der hinterlegte Faktor jetzt 1.0 ist.
- Die Kreuzvalidierung kann weiterhin nicht zeigen, ob H3 oder H4 einen Abend verpassen würden: Alle foilbaren Abende
  bei 12 kn liegen im ersten Testblock, und der hat keine Regel.

Kosten: keine neue Datenquelle, kein zusätzlicher Abruf. `core.js` wächst um rund 25 Zeilen, die nur das Messskript
braucht. Nutzen: Die Messung sagt jetzt ehrlich, was sich aus früheren Tagen ableiten lässt, und der hinterlegte Faktor
für H4 hat einen Sicherheitsabstand.

### Markierungen

`eval/measure.cjs` prüft `eval/truth.json` beim Einlesen (gültige Tage, `tl:`, `sys:`) und meldet, was es nicht verwendet.
Im Rückblick gibt es mit Token den Knopf «Fürs Modell speichern»: Er legt die Markierungen als `eval/truth.json` im Repo
ab und behält bereits abgelegte Tage. Markierungen liegen noch keine vor; sie stehen nur in Simons Browser.

### Dashboard (v18)

Kürzere Texte bei Höhenwind, Legende und «Messung gegen Modell». Der Höhenwind nennt die Messung zwischen Cressier und
Chasseral nur noch, wenn sie dem Modell widerspricht. Gedankenstriche in den sichtbaren Texten sind ersetzt.

### Reviewer (4ede9d8): **ANNEHMEN, vorläufig.**

Keine blockierenden Defekte. Die Zahlen oben sind nachgemessen. Mit inaktivem Modell 1'443'635 Vergleiche gegen v17 über
22 Tage ohne Abweichung; Gegenrechnung der gefitteten Grenzen auf den Trainingstagen: kein Push verloren oder später, ab
10 kn keine Prognose gesperrt. `push/`, `users/`, `.github/` und `archive/` sind unberührt. West 4, Bise 1 Ereignistage,
also nicht aktivieren.

Übernommene Hinweise: `nowcast` ruft `lakeStorm` wieder ohne Zeitpunkt auf (sonst hielte die Sturmsperre in der Action
einige Sekunden länger als in v17); «Fürs Modell speichern» meldet einen fehlgeschlagenen Schreibversuch und überschreibt
keine unlesbare Datei; `eval/verzug.cjs` spielt nur Entwicklungstage nach; zwei Sätze in diesem Log berichtigt.

Offen bleibt: H4 hängt am Abend vom 17.10. (Verhältnis 1.15, der nächste liegt bei 1.53), H3 an zwei Abenden. Die feste
Grenze «durchmischt ab 4 K je km» in H4 ist die Schwachstelle für schwache Abende: Bei 8 kn hätte sie den 19. und den
29.10. gesperrt.

## 11.11.2026, dritter Teil: Aufbau in Silos (v19, keine Modelländerung)

Auftrag von Simon: Architektur prüfen und bei Bedarf anpassen, feste Silos, ohne Einbusse bei der Qualität. Aufbau,
Regeln und Begründung stehen in `ARCHITEKTUR.md`.

- `core.js` ist in neun Silos unter `core/` zerlegt, `core.js` bleibt als Fassade mit denselben 95 Namen. Die zwei
  Kreise in den Abhängigkeiten sind aufgelöst, die Parameter des Modells stehen allein in `core/modell.js`.
- `index.html` enthält nur noch das Gerüst. Darstellung und Programm liegen unter `app/`.
- Neu: `eval/aufbau.cjs` (prüft die Regeln) und `eval/gleich.cjs` (Gleichheitsprüfung gegen einen früheren Stand).
- `push/`, `users/`, `.github/` und `archive/` sind unberührt. `push/check.cjs` lädt weiterhin `../core.js`.

Nachweis, dass sich nichts ändert: Alle 95 öffentlichen Namen (72 Funktionen, 23 Konstanten) haben denselben Quelltext
oder Wert wie in v18. 389'392 Ergebnisse auf den Entwicklungstagen stimmen überein, auch mit zugeschaltetem Modell. Die Messung bei 12 kn gibt Zeile
für Zeile dieselbe Ausgabe. Die Seite zeigt in Chrome denselben Text wie v18 (Hauptansicht, alle aufklappbaren Teile,
Einstellungsblatt), ohne Skriptfehler.

Kosten: 19 Dateien beim ersten Laden statt 2; eine Version, die an allen Stellen gleich hochgezählt werden muss
(`aufbau.cjs` prüft das). Nutzen: Eine Änderung braucht nur noch die betroffene Datei von 19 bis 279 Zeilen, und die
Regeln des Aufbaus prüft ein Befehl.

### Reviewer (7efec0f): **ANNEHMEN mit Auflagen.**

Keine blockierenden Defekte in App, Push-Lauf oder Rechenkern. Unabhängig nachgewiesen: Alle 116 Deklarationen des alten
`core.js` stehen genau einmal und mit gleichem Quelltext in einem Silo, dazugekommen sind nur Rahmen, Importe und
`return`. Die Dateien unter `app/` ergeben verkettet Zeichen für Zeichen das alte Skript (57'737 Zeichen), `app.css` den
alten Stilblock. Im Browser ohne Netz: kein Skriptfehler, gleiche Seite in neun Zuständen. `push/`, `users/`, `.github/`,
`archive/` und `proxy/` sind unberührt.

Auflage erfüllt: `eval/measure.cjs` erkennt lokale Änderungen jetzt auch unter `core/` (Stempel «+lokal»).

Übernommene Hinweise: `eval/aufbau.cjs` prüft neu jeden geholten Namen gegen das `return` des Quell-Silos und verbietet
Wege am `dep` vorbei; die Fassade meldet einen Namen in zwei Silos; `eval/gleich.cjs` vergleicht `nowcast` auch mit
Seemessung und nennt seine Grenzen; Zahlen in der Doku berichtigt. Für den Übergang lädt die Fassade einmal neu, wenn
eine Seite aus dem Zwischenspeicher sie noch ohne Silos lädt.

Offen (in `ARCHITEKTUR.md` unter «Nächste Schritte»): sichtbare Meldung bei einem Skript, das nicht lädt; Parser an einen
Ort; `gleich.cjs` deckt Datenabruf, Parser und Joran-Zweige kaum ab.


## 13.11.2026: Regler aus Messung und Prognose, Südost, Joran-Lage (v26)

Auslöser: Simon will alle Windlagen erkennen, auch Front- und Abend-Joran, und kurzfristig der Messung mehr trauen als
der Prognose. Keine Änderung an Push, Bewertung oder Rechenkern (`eval/gleich.cjs`: 0 Abweichungen). Geändert hat die
Sektion «Windbild».

**Messung oder Prognose** (`node eval/lage-vorlauf.cjs`, Lage richtig, West und Süd zusammen, Entwicklungstage; «jetzt»
wie in der App: Mittel der letzten 30 min auf dem Chasseral, letzter Wert am See):

| Vorlauf | +1 h | +3 h | +6 h | +12 h | +18 h | +24 h |
|---|---|---|---|---|---|---|
| Messung fortgeschrieben | 88 % | 85 % | 75 % | 69 % | 62 % | 60 % |
| Prognose, Lauf des Tages (Kamm × 2) | 74 % | 76 % | 76 % | 73 % | 72 % | 77 % |
| Mischregel (Messung, ausser die Prognose sagt einen Wechsel) | 87 % | 88 % | 79 % | 76 % | 72 % | 77 % |
| Mischregel, Lauf vom Vortag | 86 % | 86 % | 79 % | 77 % | 73 % | 77 % |

Bis 12.11. (mit Holdout): Mischregel 90 / 90 / 83 / 80 / 77 / 81 %. Der Holdout ist fast nur West und prüft den Fall
«Prognose sagt Wechsel» kaum.

Lange Reihe Chasseral 2010–2026 (jetzt = Stunde bis jetzt), Lage nach 6 h gleich: Bise 75 %, West 68 %, Joran 65 %,
Nordlage 53 %, Süd 36 %, Südost 32 %.

Stärke am See: Mischung w = exp(−h/τ) mit τ = 2,5 h, nie unter dem Modell. Mittlerer Fehler +1 h 1,8 kn (Modell 2,0).
An Ipsach ab 12 kn erkannt / Fehlalarme: +1 h 0,85 / 0,04 (Modell 0,75 / 0,02), +3 h 0,81 / 0,03 (0,76 / 0,02),
+6 h 0,82 / 0,03 (0,80 / 0,03). Mehr erkannte Stunden kosten in den ersten Stunden etwas mehr Fehlalarme. Auf dem
Holdout gab es an Ipsach nur 2 Stunden ab 12 kn: für die Stärke kein Nachweis.

**Kammprognose × 2:** ICON-CH2 liefert auf dem Chasseral im Median 0,49 der Messung (Holdout 0,39). Der Faktor kommt
aus dem Median, nicht aus der Trefferquote. Mit Faktor 2 trifft die Prognose je Stunde Nordlage 80 statt 60 %, Joran
32 statt 11 %, Bise 96 statt 94 %, «West oder Süd» 80 statt 77 %. Angezeigt und richtig: Bise 80 statt 75 %, «West oder
Süd» 84 statt 90 %. Holdout 6.–12.11., alle Lagen: 79 statt 39 % (Reviewer: ×2,5 wäre dort 89 %).

**Südost** ist eine eigene Lage (Chasseral SO). Am See kommt er als schwacher Nordost an (Ipsach 6 kn, 3 Tage). Die
Prognose wählt ihn erst selten (17 %), meist zeigt sie Bise; die Mischregel hilft, sobald der Chasseral Südost misst.

**Regel E** (`node eval/regel-e.cjs`, 2020–2026, 14–21 Uhr): feuert an 249 Abenden, davon 80 % mit Nordwest auf dem
Chasseral, 12 % mit West (meist Front-Joran im Anzug), 3 % mit Nord. An 535 Abenden mit Nordwest auf dem Kamm feuert sie
an 39 %. Seit dem 16.10. zwei NW-Abende ohne Regel E: Ipsach 8 und 3 kn, also zu Recht still. `joranType` trennt kaum:
«stat» kommt nur aus dem Monat. **Folge:** Nordwest auf dem Kamm gilt im Windbild neu als Joran-Lage, auch ohne
Zeichen (Quelle «ohne Joran-Zeichen»). Regel E bleibt unverändert.

**Joran in der Prognose** (`node eval/joran-prognose.cjs`, 13.8.–12.11., 7 Abende mit Regel E): Bedingung der App
(Kamm-NW ab 12 kn und Druckzeichen) 3/7 erkannt, 9/85 Fehlalarme; Kamm-NW allein 5/7, 9/85. Gegen Nordwest auf dem
Chasseral: 11/24, 1 Fehlalarm. Front-Joran über Besançon − Neuchâtel: 16.9., 8.10., 25.10. Zu wenig Abende, um Schwellen
zu ändern. Das Skript hängt die Läufe an und baut so ein eigenes Archiv auf.

**Bekannte Grenze:** Open-Meteo liefert die Zeiten der Archivläufe mit festem Versatz +1 h (Reviewer, geprüft über den
25.10.). Vor dem 25.10. liegen die Prognosen in `windbild-stunde.cjs` und `lage-vorlauf.cjs` damit eine Stunde daneben.
Korrigiert ändert sich die Mischregel um höchstens 2 Punkte. Betrifft schon `main`, nicht behoben. → Behoben in v27, siehe unten.

**Review** (separater Reviewer, rechnet selbst nach): ANNEHMEN mit Auflagen, keine blockierenden Defekte. Auflagen
umgesetzt: Messung mit der Eingabe der App (Fehlalarme ehrlich, τ von 3,75 auf 2,5 h), Skript nutzt `mischLage` aus der
App, Fehlbeschriftung «Prognose sagt Wechsel» bei fehlender Prognose-Lage behoben, Zahlen in Kommentaren berichtigt.

## 13.11.2026: Zeitversatz der Open-Meteo-Reihen behoben (v27)

Auslöser: Befund des Reviewers zu v26. Open-Meteo schreibt mit `timezone=Europe/Zurich` die ganze Reihe mit dem Versatz
vom Zeitpunkt des Abrufs (`utc_offset_seconds`), nicht mit dem der jeweiligen Stunde. Geprüft: Abruf vom 13.11.,
624 Stunden ab 19.10., Versatz +1 h, keine doppelte Stunde am 25.10.; gegen denselben Abruf in UTC liegt «14:00» am
20.10. eine Stunde früh. Betroffen waren alle Abrufe, nicht nur die zwei Skripte: Rückblick der App (`fetchHistory`),
Prognose, Ensemble, Höhenwind und Joran-Zutaten über einen Wechsel der Sommerzeit, dazu alle Archive in `eval/data/`.

**Behebung:** `ortszeit(times, off)` in `core/daten.js` rechnet jede Beschriftung mit dem gelieferten Versatz auf UTC
zurück und schreibt sie in echter Ortszeit. Alle Open-Meteo-Abrufe im Rechenkern und in `eval/` laufen darüber.
`node eval/zeitversatz.cjs` hat die abgelegten Archive einmal umgerechnet (Versatz aus `utc_offset_seconds` oder aus
«geholt») und markiert sie mit `zeit: "ortszeit"`. Gegenprobe: 695 von 696 Stunden der Kammprognose stimmen mit einem
frischen Abruf in UTC überein; die eine Abweichung ist 02:00 am 25.10., die es zweimal gibt.
`eval/gleich.cjs --erlaubt ortszeit,fetchJura,fetchHoehe`: 0 Abweichungen. Push und Bewertung rechnen wie bisher.

**Zahlen vorher → nachher** (Entwicklungstage 16.10.–5.11.):

| Auswertung | vorher | nachher |
|---|---|---|
| `measure.cjs --T 12` und `--T 14` (Live-Signal, Prognose am Vortag, Höhenwind) | | unverändert |
| Mischregel, Lauf des Tages, +1 / +3 / +6 / +12 / +24 h | 87 / 88 / 79 / 76 / 77 % | 86 / 86 / 79 / 75 / 76 % |
| Mischregel, Lauf vom Vortag, +1 / +3 / +6 / +12 / +24 h | 86 / 86 / 79 / 77 / 77 % | 88 / 88 / 81 / 78 / 78 % |
| Prognose, Lauf des Tages (Quote im Regler), +1 / +12 / +24 h | 74 / 73 / 77 % | 74 / 74 / 76 % |
| Lage je Stunde, Lauf des Tages: West / Süd als «West oder Süd» / Nordlage / Joran | 71 / 80 / 80 / 32 % | 70 / 87 / 70 / 34 % |
| Joran in der Prognose, Lauf des Tages: App / Kamm-NW allein / gegen Chasseral NW | 3/7, 5/7, 11/24 | unverändert |
| Höhenwind ECMWF, 850 hPa gekoppelt, FPR | 0.42 | 0.50 |

Die Abweichungen liegen bei höchstens 2 Punkten je Vorlauf, wie vom Reviewer geschätzt; Nordlage stützt sich auf
10 Stunden. `data/windbild.json` neu gerechnet (`lage-vorlauf.cjs --schreiben`, `windbild.cjs`): nur die Quote der
Prognose im Regler ändert sich um höchstens 1 Punkt. Keine Regel und kein Parameter angepasst.


## v29 (14.11.2026): «Noch kein Wind»; Seemitte bleibt in der Stufe

Auslöser: Am 14.11. zeigte die App am Morgen «wahrscheinlich» (Bise, 9–11 Uhr). Gemessen: Vingelz 4–6 kn, Ipsach
4–6 kn, kein Upwind-Signal (Grenchen 5 kn, Wynau 2 kn; Chasseral 20 kn OSO). Die Modelle an Vingelz und Ipsach lagen
bei 6–9 kn, die zwei Treffer kamen nur aus Seemitte (AROME 12 kn, ICON-CH1 10–11 kn). Messung und Upwind konnten die
Stufe bisher nur heben, nie senken.

**Gebaut:** `nochKeinWind(nc, lake, St)` in `core/messung.js`. Startkarte und Blatt zeigen «Noch kein Wind», wenn heute
die Modelle Wind spätestens in der nächsten Stunde erwarten (Stufe ≥ Alarmgrenze), kein Sturm, kein Upwind-Signal und
keine Regel E vorliegt und alle frischen Seewerte unter der Schwelle liegen. Die Modellstufe steht darunter. Nur
Anzeige: Stufe, Push, Bewertung und Rückblick unverändert (`eval/gleich.cjs`: 0 Abweichungen).

**Verworfen: Seemitte nur als Hinweis** (Stufe nur aus Vingelz und Ipsach). Prognose am Vortag, alle Tage im Archiv:

| Fenster | Schwelle | Tage mit anderer Stufe | davon foilbar |
|---|---|---|---|
| Abend | 12 kn | 17.10., 19.10., 4.11. | 17.10. (Bise/Nord) |
| Tag | 12 kn | 17.10., 19.10. | 17.10. |
| Abend/Tag | 14 kn | 6–8 Tage, alle fallen von «möglich» oder höher auf «knapp» | |

Am 17.10. lagen die Modelle an Ipsach bei 11 kn, in Seemitte bei 13–14 kn, gemessen wurden an Ipsach 11–15 kn. Ohne
Seemitte wäre der Abend verpasst. Ein fester Abschlag auf Seemitte trennt den 14.11. (12 kn) nicht vom 17.10.
(13–14 kn).

**Nachgerechnet je Lage** (Stunden 9–21 Uhr mit Wind aus N bis O an Ipsach, Prognose vom Vortag, Mittel der 4 Modelle,
16.10.–10.11.; Lage nach der Kammprognose vom Vortag, 9–20 Uhr):

| Lage (Kammprognose) | Tage | gemessen Ipsach / Modell Ipsach | gemessen Ipsach / Modell Seemitte |
|---|---|---|---|
| Nordlage (Kamm 355°, 1°): 17.10., 28.10. | 2 | 1.25, 1.15 | 1.15, 0.94 |
| Bise (Kamm 63–114°): 18., 19., 29.10.–4.11. | 9 | 0.80–1.04 | 0.56–0.66 |

Bei Bise treffen die Modelle Ipsach gut, Seemitte liegt rund 40 % zu hoch. Unterschätzt wird nur die Nordlage, und
die Kammprognose vom Vortag erkennt sie. Mögliche Regel: Nordlage → Ipsach × rund 1.2, Bise → Seemitte × rund 0.6.
Nicht gebaut: Nordlage hat 2 Tage und 1 foilbaren Abend, der Faktor käme aus genau dem Abend, den er retten soll.

## v30 (14.11.2026): Lage-Faktor aus der Kammprognose, inaktiv

Auslöser: Seemitte liegt bei Bise rund 40 % über der Messung (v29), wird aber für den 17.10. (Nordlage) gebraucht.
Entscheid Simon: Regel nach Lage inaktiv bauen, mit Reviewer.

**Gebaut:** `LAGE` in `core/modell.js` (`active:false`), `lageTag` in `core/prognose.js`. `summarize(modelSpots, day,
St, kamm, opt)` nimmt die Kammprognose (`fetchJura`) und multipliziert bei aktiver Regel den Modellwind je Spot.
Lage nach dem Vektormittel der Kammrichtung von 2 h vor dem Zeitfenster bis zu dessen Ende (Stunden ab 3 kn,
mindestens 3), Sektoren wie im Windbild: Nordlage N, Bise NO und O.
- Nordlage: Vingelz/Ipsach nur heben (≥ 1), Seemitte bleibt. Kann nichts verpassen, was heute angekündigt wird.
- Bise: Seemitte nur senken (0.5–1), Vingelz/Ipsach bleiben.
- Hinterlegt: Nordlage Ipsach × 1.15, Bise Seemitte × 0.7 (aus allen Entwicklungstagen, zur sicheren Seite gerundet).
- App übergibt `D.jura`; Push-Lauf noch nicht (lädt die Kammprognose nicht). `gleich.cjs`: 0 Abweichungen.

**Messung** (`node eval/lage-faktor.cjs`, Prognose am Vortag, Entwicklungstage, Faktoren nur aus früheren Tagen):

| Fenster | Schwelle | Recall B → neu | FPR B → neu | EV/NEV |
|---|---|---|---|---|
| Abend 16–21 | 12 kn | 1.00 → 1.00 | 0.50 → 0.44 | 5/16 |
| Abend 16–21 | 14 kn | 1.00 → 1.00 | 0.35 → 0.00 | 4/17 |
| Tag 9–21 | 12 kn | 1.00 → 1.00 | 0.42 → 0.42 | 9/12 |
| Tag 9–21 | 14 kn | 1.00 → 1.00 | 0.47 → 0.07 | 6/15 |

Mit den hinterlegten Werten (`--fest`, nicht unabhängig): 12 kn Abend FPR 0.50 → 0.38, Tag 0.42 → 0.33.
Alle geänderten Tage sind Bise-Tage, alle ruhig. Der Nordlage-Faktor ändert an keinem Tag die Stufe.

**Was die Messung nicht zeigt:** Es gibt keinen foilbaren Bise-Abend im Archiv. Ob der Faktor einen solchen Abend
verpasst, ist ungeprüft. Nordlage: 2 Tage, 1 foilbarer Abend. Der 14.11. (Bise am See, Kamm Südost, Seemitte zu hoch)
fällt nicht unter die Regel; Südost auf dem Kamm gab es im Archiv erst an einem Tag (Seemitte roh 0.55).
