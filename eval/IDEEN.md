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
