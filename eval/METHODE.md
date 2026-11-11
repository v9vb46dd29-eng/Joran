# Methode im Detail

Ausführliche Fassung des Methodentexts (Stand v16, 10.11.2026). Die App zeigt seit v17 eine kurze Fassung.
Zu Modell v2, Kopplung der Luftschichten und Höhenwind siehe auch `eval/ITERATIONEN.md`.


## Prognose.

 Vier hochauflösende Modelle über Open-Meteo: ICON-CH1 (MeteoSchweiz, 1 km, 33 h), ICON-CH2 (MeteoSchweiz, 2 km, 5 Tage), ICON-D2 (DWD, 2 km, 2 Tage), AROME HD (Météo-France, 1.3 km, ca. 2 Tage). Abgefragt wird die nächste Wasserzelle. Pro Stunde zählt der stärkste aktive Spot in einer gewählten Richtung.


## Ob.

 Ein Modell trifft, wenn es die Schwelle im Zeitfenster so lange hält wie die Mindestdauer. Sehr wahrscheinlich: drei Viertel der Modelle (mindestens zwei). Wahrscheinlich: die Hälfte. Möglich: eines. Knapp: bestes Modell höchstens 3 kn darunter. Ab Übermorgen rechnet nur noch ICON-CH2.


## Wann.

 Das Zeitfenster umfasst die Stunden, in denen mindestens die Hälfte der Modelle die Schwelle erreicht. Gibt es solche Stunden nicht, zählen Stunden mit mindestens einem Modell (Anzeige «einzelne Modelle»).


## Am See jetzt.

 Vingelz und Ipsach (meteoBase.ch, 10-Minuten-Mittel und -Spitze). Die Seiten erlauben keinen direkten Abruf aus dem Browser (CORS). Die App holt sie darum über einen öffentlichen CORS-Proxy (allorigins, codetabs, corsproxy — der erste, der antwortet) oder über einen eigenen Proxy, und ergänzt die Verlaufskurve aus dem Branch `live`, den die GitHub Action füllt. Werte, die die App selbst holt, merkt sie sich bis 18 Stunden in diesem Browser. Die Kachel ist blau, wenn die letzten zwei Werte deine Schwelle in einer aktiven Richtung erreichen. Dann gibt es auch einen Mess-Push «Am See». Im Tagesdiagramm erscheinen die Seewerte als Punkte — so siehst du direkt, wie gut die Modelle heute liegen.


## Joran-Zutaten.

 Thermischer Joran entsteht, wenn auf Jurahöhe Luft aus Nordwest anliegt und am Abend die Luft auf der Jura-Hochfläche relativ zum See schwerer wird. Joran zeigt dazu aus ICON-CH2: Wind auf dem Chasseral-Kamm aus 270–360° ab 12 kn und den Anstieg des Druckgefälles La Chaux-de-Fonds → See seit Mittag um mindestens 0.5 hPa. Das sind Erfahrungswerte, nicht kalibriert; sie ändern die Stufe nicht, sondern sagen dir, wann sich der Blick auf die Messung lohnt.


## Upwind-Messung.

 SwissMetNet, 10-Minuten-Werte. Eine Station meldet ein Signal, wenn der Wind 30 Minuten lang aus ihrem Windsystem kommt, im Mittel ihre Schwelle erreicht und nicht abnimmt. Die Schwelle je Station kalibriert der Rückblick; ohne Kalibrierung gilt ein Startwert (Anzeige «ungeprüft»). Zusätzlich gilt Regel E für Joran in Cressier (an 1030 Abenden geprüft).


## Kalibrierung der Stationen.

 Ziel: kein foilbarer Abend soll verpasst werden; ein Fehlalarm wiegt weniger. Neue Regel: Je Station gilt die höchste Schwelle, die mindestens 85 % der Windtage ihres Windsystems erkennt (Recall ≥ 0.85). Unter gleichwertigen Schwellen zählt die mit der tieferen Fehlalarmrate. Erreicht keine Schwelle 85 %, gilt die Station als nicht verlässlich und löst keinen Push aus. Joran, Taubenlöchler (nur Courtelary) und die übrigen Windsysteme werden getrennt gezählt. *Stand: vorbereitet, noch nicht aktiv.* Bis je Station und Windsystem mindestens zehn Windtage vorliegen, gilt weiter die bisherige Regel: beste Schwelle nach Peirce-Score, Stationen unter 0.25 lösen keinen Push aus.


## Wahrheit für die Kalibrierung.

 Die GitHub Action legt die Seemessung Vingelz/Ipsach zusätzlich als eine Datei pro Tag ab (Branch `live`, Ordner `archive`). meteoBase bietet keine älteren Werte an; das Archiv beginnt darum mit dieser Version. Ein Tag gilt als foilbar, wenn im Zeitfenster deiner Einstellungen an einer Seestation jeder 10-Minuten-Mittelwert während deiner Mindestdauer (gerundet) deine Schwelle erreichte. Deine Markierungen «Ja»/«Nein» gehen vor. Das Skript `eval/measure.cjs` spielt das Live-Signal der App in 10-Minuten-Schritten nach und misst für jede Schwelle Recall, Fehlalarmrate, Precision und Vorlaufzeit: für das Gesamtmodell je Seestation und für jede Upwind-Station je Windsystem. Die letzten rund 20 % der Tage bleiben als Holdout bis zur Schlussmessung unberührt.


## Modell v2 (vorläufig, nicht aktiv).

 Jede Upwind-Station erhält je Windsystem einen eigenen Faktor; ihre Schwelle ist deine Seeschwelle mal dieser Faktor und passt damit zu jeder Einstellung. Der Faktor stammt aus dem Vergleich mit der Seemessung: der höchste Wert, mit dem die Station über die Schwellen 8, 10, 12 und 14 kn mindestens 85 % der foilbaren Abende rechtzeitig meldet, abzüglich 10 % Sicherheit. Dafür braucht es mindestens vier Windtage. Eine Erweiterungsstation löst erst Push aus, wenn sie so einen Faktor mit höchstens 30 % Fehlalarmen erreicht. Eine Station, die heute Push auslöst, wird nie stummgeschaltet: Findet sich kein brauchbarer Faktor, behält sie ihren Startwert. Regel E für Joran in Cressier und der Taubenlöchler in Courtelary bleiben eigene Regeln und werden getrennt gezählt. Dazu kommt die Kopplung der Luftschichten: Ein Signal vom Chasseral zählt nur, wenn die Temperatur von Cressier bis zum Kamm um mindestens 4 K je Kilometer abnimmt. Bei stabiler Schichtung bleibt der Höhenwind oben; an den Entwicklungstagen mass Ipsach bei Westwind auf dem Kamm dann 2 kn statt 18 kn. Fehlt eine Temperatur, zählt das Signal. Stand 10.11.2026: 26 Archivtage, davon 5 foilbar bei 12 kn (4 West, 1 Bise), alle an Ipsach. Das reicht für Faktoren bei Westwind (Cressier und Neuchâtel 0.81, La Brévine 0.86, La Chaux-de-Fonds 0.72, Chaumont 0.63), nicht für Bise, Joran und Taubenlöchler. Weil je Station und Windsystem noch keine zehn Windtage vorliegen, rechnet die App weiter mit den Startwerten. Verlauf und Reviewer-Entscheide stehen in `eval/ITERATIONEN.md`.


## Zwei Arten Joran.

 Der *Joran dynamique* kommt mit einer Kaltfront: Westlich des Juras staut sich kalte Luft und fällt über den Kamm. Er tritt ganzjährig auf, oft schon tagsüber, und zieht mit der Front von West nach Ost. Joran zeigt dafür den Druckunterschied Besançon − Neuchâtel aus ICON-CH2 (wie MeteoSchweiz; Hinweis ab +2 hPa) und misst ihn früh an den westlichen Stationen Bullet/La Frétaz, La Brévine und Neuchâtel. Der *Joran statique* entsteht abends nach ruhigen, warmen Tagen (Mai–August) oder als Gewitter-Fallwind lokal an den Jurahöhen; ihn zeigen die beiden Zutaten oben sowie Chasseral und Chaumont. Die neuen Stationen und Joran in Neuchâtel lösen erst Push aus, wenn der Rückblick sie als verlässlich ausweist. Die Messung (`eval/measure.cjs`) ordnet jeden Joran-Tag einem Typ zu, um später zu prüfen, ob sich getrennte Schwellen lohnen. Grenzwerte sind Erfahrungswerte, nicht kalibriert.


## Joran am See.

 Die Fallböen teilen sich oft zwischen Vingelz und Alfermée: Ein Ast zieht in die Bucht Richtung Nidau, einer Richtung Sutz. Am See misst man dann Südwest oder Nordost statt Nordwest, und Vingelz liegt oft im Windschatten, während Ipsach mehr Wind hat. Darum bestimmen die Upwind-Stationen das Windsystem: Melden Regel E oder eine verlässliche Joran-Station Joran, zählt am See jede Richtung als Joran, und Joran zeigt einen Hinweis zur Joran-Lage. Die Modelle lösen diese Teilung nicht auf (Gitter 1–2 km).


## Taubenlöchler.

 Abends fliesst kühle Luft das Vallon de St-Imier hinunter und durch die Taubenlochschlucht in die Bielerbucht (dort aus Nord/Nordost). Die Station Courtelary misst diesen Talwind entlang der Talachse (220–280°), Signal nur ab 15 Uhr und nicht bei Westwind auf dem Chasseral (ab 15 kn aus 200–290°), weil dann grossräumiger Westwind im Tal ebenfalls talabwärts weht. Courtelary zählt erst, wenn der Rückblick an Tagen mit Markierung «TL» einen Peirce-Score ab 0.25 ergibt (nach der neuen Regel: wenn eine Schwelle mindestens 85 % dieser Tage erkennt). Grenzwerte sind Erfahrungswerte, nicht kalibriert.


## Sturm

 überschreibt jede positive Bewertung — aber nur dann: Mittelwind oder Böen über deiner Sturmgrenze (Standard 30 kn Mittel, 39 kn Böen) am See oder an einer Upwind-Station auf Seehöhe, oder eine echte Böenfront, bei der alle drei Merkmale gleichzeitig auftreten: Temperatursturz ≥ 3 °C, Mittelwind +8 kn und Böen ≥ 30 kn innert 20 Minuten. Der frühere Böenfaktor-Test (Böe doppelt so stark wie Mittel) entfällt: An Landstationen ist das bei mässigem, böigem Wind alltäglich.


## Push.

 Der Cloudflare Worker (Ordner `proxy`) stösst alle 10 Minuten zwischen 6 und 21 Uhr eine GitHub Action an; sie prüft dieselben Regeln (Datei `core.js`) für jeden Nutzer mit dessen eigenen Einstellungen (`users/<name>.json`) und sendet über ntfy.sh an dessen eigenes Thema. GitHubs eigener Zeitplan läuft nur noch als Rückfall, weil er in der Praxis oft nur alle paar Stunden startet.


Einstellungen und Markierungen liegen in diesem Browser; nur was du für Push speicherst, steht öffentlich lesbar in `users/<name>.json` — ohne ntfy-Thema. Wetterdaten: [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0), MeteoSchweiz (OGD).

