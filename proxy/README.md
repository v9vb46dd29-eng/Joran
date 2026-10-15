# Joran-Proxy (Cloudflare Worker)

Holt die Seiten der Seestationen Vingelz und Ipsach (meteoBase), die der Browser wegen CORS nicht direkt laden darf.

Einrichten: Cloudflare → Workers & Pages → Create → **Import a repository** → dieses Repo → Root directory `proxy` → Deploy.
Danach die Worker-Adresse in Joran unter Menü → Seestationen-Abruf eintragen.
