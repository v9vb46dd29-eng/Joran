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
