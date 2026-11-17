# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Simon und ein kleiner Kreis von Wingfoil-Kolleg/-innen am Bielersee. Simon schaltet sie für Push frei
(ntfy-Thema im Secret `NTFY_TOPICS`, Einstellungen in `users/<name>.json`). Die App ist öffentlich erreichbar, die
Zielgruppe ist aber dieser Kreis, nicht die ganze Szene.

Sie öffnen Joran am Handy, meist in zwei Momenten:

- **Tagsüber, oft bei der Arbeit:** Lohnt sich der Abend am See? Wann kommt der Wind, und wie stark?
- **Am Vorabend oder Morgen:** Welcher der nächsten Tage wird foilbar?

Dazwischen kommt die Push-Nachricht (Vortag ab «wahrscheinlich», am Tag selbst bei Messung oder Upwind-Signal).

Simon nutzt Joran zudem, um aus den Messdaten in `eval/` zu lernen, wie Joran und die anderen Winde in der Bucht
funktionieren. Seine Hypothesen will er dafür grafisch sehen, getrennt von dem, was schon gemessen ist.

## Product Purpose

Joran sagt voraus, ob es am Bielersee (Vingelz, Ipsach, Seemitte) genug Wind zum Wingfoilen gibt: heute, morgen und
an den nächsten Tagen, nach der Schwelle, den Windrichtungen, den Spots und dem Zeitfenster jeder Person.

Joran verbindet drei Quellen:

- die Messung am See,
- Upwind-Stationen, die den Wind 30 bis 90 Minuten früher zeigen,
- vier hochauflösende Wettermodelle.

Erfolg heisst: Kein foilbarer Abend wird verpasst. Ein Fehlalarm wiegt weniger als ein verpasster Abend.

## Positioning

Allgemeine Windapps zeigen ein Modell für einen Punkt. Joran ist auf eine Bucht zugeschnitten:

- Es misst seine eigenen Regeln am Archiv der Seemessung.
- Es kennt die Windsysteme des Bielersees: Joran, Bise, Nordlage/Taubenlöchler, West, Süd und Südost.
- Es führt die Kette Messung → Regeln → Prognose so, dass die Messung kurzfristig die Prognose schlägt.

Jede Regel ist belegt oder als vorläufig markiert (`eval/METHODE.md`, `eval/ITERATIONEN.md`).

## Operating Context

- **Am Handy, kurz:** Die App wird meist kurz am Handy geöffnet, die Antwort muss im ersten Bildschirm stehen. Die
  Startseite zeigt der Reihe nach «Am See jetzt», «Wind kommt?», das Windbild und die nächsten 4 Tage. Begründungen und
  Methode stehen im Blatt «Erklärungen».
- **Push:** Eine GitHub Action prüft zwischen 6 und 21 Uhr alle 10 Minuten dieselben Regeln mit den Einstellungen
  jeder Person und schickt die Nachricht über ntfy.
- **Datenquellen:** Open-Meteo (ICON-CH1, ICON-CH2, ICON-D2, AROME; CC BY 4.0), MeteoSchweiz SwissMetNet (OGD) und
  meteoBase.ch (Vingelz, Ipsach). Die Seestationen gehen über einen eigenen Cloudflare Worker (`proxy/`).
- **Rückblick:** Simon markiert foilbare Tage im Rückblick. Joran kalibriert daraus Modellfaktor und Stationsschwellen.

## Capabilities and Constraints

**Was Joran heute kann**

- Live-Messung am See mit dem Verlauf der letzten 3 Stunden.
- Urteil in Stufen: sehr wahrscheinlich, wahrscheinlich, möglich, knapp.
- Upwind-Signale und Regel E in Cressier.
- Sturmwarnung ab 35 kn Mittelwind oder 45 kn Böen und bei einer Böenfront.
- Joran-Zutaten und Höhenwind als Hinweise.
- Windbild der Bucht und der Region mit einem Regler über 24 Stunden und Zoom mit zwei Fingern.
- Musterkarte jeder Lage im Blatt «Erklärungen», ohne Live-Werte. Sie zeigt nur die Messstationen (lesbar, neue
  kommen mit der Auswertung von selbst dazu) und die Messtage je Lage. Varianten ohne Messung sind als Hypothese markiert. Quelle: `data/windbild.json` aus
  `eval/windbild.cjs`.
- Simons Hypothesen zur Bucht (H-B1 bis H-B8) als Pfeile und Kreise auf der Musterkarte, gefärbt nach Urteil (passt,
  teilweise, offen), mit Aussage und Befund. Quelle: `data/hypothesen.json`, gepflegt aus `eval/IDEEN.md`.
- Vorschau auf 4 Tage, Rückblick mit Kalibrierung, Push für mehrere Personen.

**Technische Grenzen** (Details in `ARCHITEKTUR.md`)

- Kein Build, keine Abhängigkeiten. GitHub Pages liefert die Dateien, wie sie im Repo liegen.
- Rechenkern in Silos unter `core/` mit der Fassade `core.js`. Action und Auswertung laden denselben Kern.
- Bei jeder Änderung die Version an allen Dateien und in der Kopfzeile gleich hochzählen. `node eval/aufbau.cjs` prüft
  das.
- `MODEL.active` und `LAGE.active` bleiben `false`, bis Simon eine Aktivierung mergt. Regeln ändern sich nur mit
  Messung, Holdout und Reviewer (Methode in `eval/README.md`).
- Die Einstellungen bleiben im Browser. Nur Push-Einstellungen stehen öffentlich im Repo, ohne ntfy-Thema.

**Geplant** (aus `eval/NAECHSTE-SCHRITTE.md` und `eval/IDEEN.md`)

- Überprüfung Ende Dezember 2026 (geplant auf den 28.12.2026):
  - neuer Holdout, Parameter neu bestimmen,
  - Modell v2 nur für West vorschlagen, sobald 10 West-Abende vorliegen; dafür braucht es einen Schalter je Windsystem,
  - Windbild, Lage-Vorlauf und Kette nachmessen; die Abendlage neben der Lage vom See entfernen, wenn sie den
    Vorsprung verliert.
- Windbild, offen seit v35:
  - Soll die Karte bei «jetzt» ohne gemessene Lage die laufende Stunde zeigen statt der Abendlage?
  - Führungszeit der Messung je Lage statt pauschal 2 h, bestimmt aus der Chasseral-Reihe seit 2010.
- Wartet auf mehr Daten:
  - Bise und Nordlage mit eigenem Faktor (Sommer 2027),
  - Lage-Faktor aktivieren (Recall in jeder Einstellung unverändert),
  - Joran-Faktoren und die Drehung Vingelz/Ipsach (10 Joran-Episoden, Juni/Juli 2027),
  - Taubenlöchler, die Hypothesen H-B1 bis H-B8 zur Bieler Bucht, Joran in der Prognose, Südost-Werte am See, H4 je
    Windrichtung.
- Langfristiges Ziel: eine Aussage je Spot, z. B. «Joran kommt, Ipsach fahrbar, Vingelz im Windschatten».

**Begriffe**

- **Spot:** Vingelz, Ipsach, Seemitte. Dazu, nur auf der Karte und geschätzt, weil dort niemand misst: La Neuveville,
  Wingreis und St-Blaise (Neuenburgersee).
- **Schwelle:** die Windstärke in kn, ab der jemand rausgeht.
- **Zeitfenster:** Abend 16–21, Nachmittag 12–21, Tag 9–21 Uhr.
- **Lage:** das Windsystem.
- **Upwind-Station, Signal, Regel E.**
- **«Noch kein Wind».**

## Brand Commitments

- Name «Joran», nach dem Fallwind vom Jura. Wird nicht umbenannt.
- Sprache nur Deutsch, Schweizer Schreibweise (ss statt ß), Uhrzeiten «16–21 Uhr», Einheit kn.
- Stimme: sachlich, knapp, ohne Werbesprache. Unsicherheit wird benannt («vorläufig», «geschätzt», «Modell»), nicht
  versteckt.
- Zahlen stehen nur dort, wo gemessen wird. Modellwerte und Schätzungen sind immer als solche gekennzeichnet
  (z. B. La Neuveville «Modell»).

## Evidence on Hand

- Archiv der Seemessung (Branch `live`, Ordner `archive/`) seit Mitte Oktober 2026.
- Messprotokolle und Entscheide: `eval/ITERATIONEN.md`, `eval/HOLDOUT.txt`, `eval/REVIEW.md`, `data/windbild.json`
  (Muster je Lage, gerechnet aus der Seemessung).
- Noch wenige Ereignistage (z. B. 4 West-Abende, 1 Joran-Episode). Treffer- oder Genauigkeitszahlen nur aus diesen
  Dateien zitieren, nie erfinden. Es gibt keine Nutzerstimmen und keine Nutzerzahlen.

## Product Principles

1. **Lieber ein Fehlalarm als ein verpasster Abend.** Keine Änderung darf den Recall senken, auch nicht bei den
   Einstellungen einzelner Personen.
2. **Die Antwort zuerst.** Am See jetzt, kommt Wind, wann und wie stark: im ersten Bildschirm. Die Begründung folgt
   auf Wunsch.
3. **Gemessen schlägt gerechnet, solange es nachweislich besser ist.** Die Messung führt kurzfristig, danach die
   Prognose. Jede Regel ist gemessen oder als vorläufig markiert.
4. **Ehrlich über Unsicherheit.** Herkunft (Messung, Modell, geschätzt) und Stufe sind immer sichtbar.
5. **Einfach zu betreiben.** Kein Build, keine Abhängigkeiten, eine Fassade. Was der Push rechnet, rechnet auch die App.

## Accessibility & Inclusion

- Draussen und bei wechselndem Licht lesbar: Text mindestens WCAG AA (4.5:1). Hell, dunkel und automatisch.
- Bedienbar mit einer Hand: Trefferflächen von mindestens 44 px.
- Bewegung reduzierbar: Die Strömungslinien im Windbild weichen statischen Pfeilen, wenn das System weniger Bewegung
  wünscht.
