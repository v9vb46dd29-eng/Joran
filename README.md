# Joran

Wingfoil-Prognose für den Bielersee (Vingelz, Ipsach, Seemitte): Live-Messung am See, Modellprognosen, Upwind-Messungen und Push-Benachrichtigung.

Die Seemessung (Vingelz, Ipsach, meteoBase.ch) holt die GitHub Action «Joran Push» bei jedem Lauf und legt sie im Branch `live` ab (`lake.json`, ein einzelner, jeweils ersetzter Commit).

**App:** https://v9vb46dd29-eng.github.io/Joran/

## Push erhalten
1. App **ntfy** installieren und ein zufälliges Thema abonnieren.
2. Dem Repo-Besitzer privat deinen Namen (bei GitHub-Konto: GitHub-Namen) und dein Thema schicken.
3. Nach der Freischaltung in der App unter «Push-Benachrichtigung» Namen und Schwelle einstellen und speichern.

Deine Einstellungen stehen öffentlich lesbar in `users/<name>.json`, dein ntfy-Thema nicht.

Wetterdaten: Open-Meteo.com (CC BY 4.0), MeteoSchweiz (OGD), meteoBase.ch (Seestationen).
