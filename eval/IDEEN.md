# Ideen für künftige Auswertungen

## Wie dreht der Wind bei Joran in der Bieler Bucht? (Simon, 10.11.2026)

**Ziel:** Das Modell soll verstehen, wie der Wind an Joran-Abenden in der Bucht dreht, und Vingelz und Ipsach dabei getrennt
betrachten. Daraus soll später eine Aussage je Spot werden («Joran kommt, Ipsach fahrbar, Vingelz im Windschatten»).

**Stand:** zu wenig Daten. Zwischen dem 16.10. und dem 5.11.2026 gab es in Cressier eine einzige Joran-Episode
(25.10., 16:20–17:20 Uhr, mitten in einer stürmischen Westlage, also eher ein Front-Joran). `node eval/joran.cjs` zeigt sie.

**Was diese eine Episode andeutet (kein Muster, nur eine Spur):**

- Schon als der Wind auf dem Chasseral von West auf Nordwest drehte (15:40–16:00), fiel Vingelz von 20 auf rund 10 kn.
  Ipsach blieb bei 22–29 kn.
- Während Cressier Joran mass (WNW, 18–21 kn), drehte Ipsach von Südwest auf West bis Westnordwest und ging auf 13–18 kn zurück.
- Vingelz brach auf 4–8 kn ein und drehte von Südwest über Nord auf Ostsüdost. Das passt zu einem Lee-Wirbel hinter dem
  Hang; Ipsach lag 6–10 kn über Vingelz.
- Als Cressier wieder auf West drehte, kamen beide Stationen auf Südwest zurück.

**Fragen für die Auswertung, sobald genug Abende vorliegen (Richtwert: 10 Joran-Episoden, erwartet im Sommer 2027):**

1. Dreht Ipsach bei Joran regelmässig von Südwest auf West bis Nordwest, und um wie viele Minuten nach Cressier?
2. Bricht Vingelz ein oder dreht es zurück (Nord bis Ost)? Wie gross ist der Unterschied Ipsach minus Vingelz?
3. Unterscheiden sich Front-Joran (dynamique) und Abend-Joran (statique) in Drehung und Stärke?
4. Kündigt die Drehung auf dem Chasseral (West → Nordwest) den Einbruch in Vingelz an, und mit wie viel Vorlauf?
5. Hilft die Richtungstreue der Seestationen (Feld `steady` im Archiv, bisher leer) als Zeichen für Wirbel?

**Vorgehen:** `node eval/joran.cjs --bis JJJJ-MM-TT` laufen lassen (nur Tage, die nicht zum Holdout gehören), Episoden nach
Typ trennen (`core.joranType`), je Typ den mittleren Verlauf von Richtung und Stärke für Vingelz und Ipsach bilden. Erst
danach eine Hypothese für das Modell formulieren und durch den Build-Review-Loop schicken. Markierungen im Rückblick
(`sys:Tag` = `joran`, `jtyp:Tag`) helfen bei der Zuordnung.

## Bieler Bucht: Joran-Äste, Taubenloch und Seewind (Simon, 12.11.2026)

**Hypothesen von Simon**

- **H-B1 Abend-Joran (statique):** Die Böen nehmen gegen das Südufer zu und gabeln sich zwischen Vingelz und Alfermée:
  Ast a) Richtung Ipsach, Ast b) Richtung Nidau. Vingelz liegt im Windschatten.
- **H-B2 Front-Joran (dynamique, Westlage):** Meist zieht nur ein Ast über den See, dafür stärker. Vingelz ist weniger
  abgedeckt. Die Gabelung kommt also nicht immer vor.
- **H-B3 Taubenloch-Ast:** Wind aus N bis ONO in Vingelz kommt aus der Taubenlochschlucht, nicht immer.
- **H-B4 Nordlage:** Einen Taubenlöchler ohne Joran hat Simon nie beobachtet. Was er als Taubenloch-Wind kennt, ist eher
  eine Nordlage.
- **H-B5 (folgt aus H-B4):** Die Taubenlöchler-Regel (Courtelary talabwärts aus WSW) misst eher den Westwind über dem
  Jura als einen eigenen Taubenlöchler.
- **H-B6 Seewind:** An heissen Sommertagen strömt Luft vom See gegen die Stadt. Das reicht allein nicht zum Foilen,
  kann aber eine Westlage verstärken und eine Bise abschwächen.
- **H-B7 Landwind am Abend:** Umgekehrt ist an Sommerabenden ein Landwind auf den See möglich (Ostlage). Er könnte den
  Taubenlöchler verstärken und erklären, warum der Wind im Bieler Becken so stark dreht.

**Stand der Daten** (`node eval/bucht.cjs`, Entwicklungstage bis 5.11.; ein Blick bis 12.11. ändert das Bild nicht)

| | Befund | Urteil |
|---|---|---|
| H-B1 | Kein Abend-Joran im Archiv. | offen |
| H-B2 | Eine Episode (25.10., Typ dyn, Sturm-Westlage): Ipsach 13–18 kn W–WNW, Vingelz meist SW 7–12 kn, Ipsach im Mittel 6 kn über Vingelz. Ein Ast, Vingelz nicht abgedeckt. | passt, 1 Episode |
| H-B3 | Vingelz aus N bis ONO ohne Bise: an den Nordlagen (17. und 28.10.), kurz beim Joran (25.10., 18:30, NO 5 kn), an zwei Morgen in Sturm-Südwestlage (23.10., Courtelary 7–15 kn talabwärts, Vingelz 3–4 kn NNO–ONO, Ipsach still) und in ruhigen Nächten mit 3–5 kn. Die Richtungen passen zur Lage des Schluchtausgangs (von Vingelz aus rund 50°). Ein Wirbel im Lee des Hangs ist nicht ausgeschlossen. | passt teilweise |
| H-B4 | 17.10., 16–18 Uhr: Chasseral 23–28 kn N, Grenchen 2–6 kn, Cressier 1–3 kn, Ipsach 11–15 kn NNO (Böen bis 24 kn), Vingelz 4–7 kn NO/ONO. Am 28.10. dasselbe Bild schwächer. Courtelary dabei O bis OSO, also talaufwärts. | passt, 2 Tage |
| H-B5 | Die Regel schlug an 7 von 21 Entwicklungstagen an (81 Zehnminutenwerte). 79 davon fielen auf Wind aus S bis NNW auf dem Chasseral, keiner auf den Nordlage-Abend vom 17.10. | passt |
| H-B6 | Keine Seemessung im Sommer (Archiv ab 15.10.). Landstationen an 31 ruhigen, heissen Sommertagen 2026: Neuchâtel tagsüber SO bis SSO vom See her, nachts N; Cressier und Grenchen tagsüber O bis OSO, im Mittel 4–5 kn. 2026 fiel kein Bise-Tag auf einen heissen Sommertag. | plausibel, offen |
| H-B7 | Dieselben 31 Sommertage, 19–21 Uhr: Neuchâtel, Cressier und Grenchen drehen auf N bis NNO, im Mittel 4–5 kn. Am See nur zwei ruhige Abende (18.10., 5.11.; 19–23 Uhr, Chasseral unter 10 kn): Vingelz und Ipsach 3–4 kn, 87 % bzw. 79 % der Werte ab 2 kn aus N bis O. | passt in der Richtung, schwach |

Zu H-B3 und H-B5: Weht es in Courtelary kräftig talabwärts, bekommt Vingelz manchmal schwachen Wind aus NO, Ipsach
nicht. Die Regel misst also den Ausfluss aus dem Tal; bis Vingelz kommt er bei Westlage nur selten und schwach.

Zu H-B7: Die Stadt bleibt nachts als Wärmeinsel länger warm. Treiber ist darum eher die kühle Luft von den Jurahängen
und aus dem Taubenloch als die Stadt selbst. Beides weht in der Bucht aus N bis O, in dieselbe Richtung wie der
Taubenlöchler. Tagsüber Seewind aus SW, abends Landwind aus N bis O: Das ist eine Drehung um rund 180° im Tageslauf.

**Literatur:** Rickli, R. und Wanner, H. (1988): Projekt «Klima und Lufthygiene der Region Biel», ausbreitungs-
klimatologische Grundlagen. Geographica Helvetica 43(2), 92–98. Messnetz der Uni Bern 1980–82 mit fünf Windstationen in
3 m Höhe (Vogelsang, Taubenloch, Strandbad, Bözingenmoos, Dietschimatt). Der thermische Taubenlochwind setzt meist
zwischen 17 und 18 Uhr ein, weht am Schluchtausgang aus NW bis NNW mit 0.8–1.5 m/s und wird im Bözingenmoos gestaut
oder nach Süden umgelenkt; ein Vordringen bis zum See beschreiben die Autoren nicht. Am Strandbad herrscht tagsüber
Südwestwind vor, der über den offenen See auf die Stadt trifft; nachts ist es dort oft windstill. Die Hangabwinde sind
zwischen 18 und 20 Uhr am stärksten. Der thermische Taubenlöchler allein ist also zu schwach
zum Foilen (passt zu H-B4); der Südwest am Strandbad stützt H-B6, trennt aber Seewind und grossräumigen Wind nicht.

**Messstationen am Ostende der Bucht (Suche 12.11.2026):** In Nidau, Port, Biel und Brügg gibt es keine öffentliche
Station mit Wind. Nächste SwissMetNet-Station ist Courtelary (12.6 km). Windfinder führte 2012–2014 eine Station «Biel»,
heute ausser Betrieb; live misst nur «La Neuveville/Bielersee» am Westende. Von meteoBase sind nur Vingelz und Ipsach
bekannt. Für Ast b) (Richtung Nidau) bräuchte es eine eigene Station am Ostende, etwa beim Strandbad Biel oder in Nidau.
Das kostet Geld und braucht Simons Entscheid.

**Prüffragen, sobald mehr Daten vorliegen**

1. H-B1/H-B2 (ab rund 10 Episoden je Typ, Sommer 2027): Je Typ Ipsach minus Vingelz, Richtung in Ipsach (NW beim
   Abend-Joran?), Anteil der Zeit mit Vingelz unter 6 kn, während Ipsach die Schwelle erreicht.
2. H-B3: Taubenloch oder Lee-Wirbel? Wind aus dem Taubenloch sollte auch in Ipsach aus NNO bis NO ankommen und mit
   Courtelary oder dem Chasseral zusammenhängen. Ein Wirbel zeigt sich nur in Vingelz und nur bei W bis NW am See.
3. H-B4/H-B5: Nordlage-Abende sammeln. Bestätigt sich das Bild, den Taubenlöchler als eigenes Windsystem streichen und
   in «Nord» aufgehen lassen; die Courtelary-Regel überdenken. Das ist eine Modelländerung: Build-Review-Loop mit Reviewer.
4. H-B6/H-B7 (ab Juni 2027): Tagesgang am See an ruhigen, heissen Tagen, mit dem Zeitpunkt der Drehung am Abend. Bei West: Verhältnis Ipsach zu Cressier an
   Sommernachmittagen gegenüber Herbst (heute 1.7). Bei Bise: Seewind am Nachmittag gegenüber dem Morgen, Sommer gegen
   Winter. Am Abend: Drehen Vingelz und Ipsach auf N bis O, wie stark, und kommt das mit dem Taubenloch-Ast zusammen?

Visualisiert in der Karte «Wind in der Bieler Bucht» (Artefakt in Claude), Joran mit Varianten Abend- und Front-Joran,
Nordlage mit Weg durchs Taubenloch, Thermik mit Seewind am Tag und Landwind am Abend (geschätzt).
