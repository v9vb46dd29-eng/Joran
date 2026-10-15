# Joran-Proxy (Cloudflare Worker)

Holt die Seiten der Seestationen Vingelz und Ipsach (meteoBase), die der Browser wegen CORS nicht direkt laden darf.

Einrichten: Cloudflare → Workers & Pages → Create → **Import a repository** → dieses Repo → Root directory `proxy` → Deploy.
Danach die Worker-Adresse in Joran unter Menü → Seestationen-Abruf eintragen.

## Push-Zeitgeber

Der Worker stösst alle 10 Minuten die GitHub Action «Joran Push» an (GitHubs eigener Zeitplan läuft oft nur alle paar Stunden).
Dafür braucht er das Secret `GITHUB_TOKEN`:

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
   Repository access: nur `Joran`. Permissions → Actions: **Read and write**. Ablaufdatum wählen (max. 1 Jahr).
2. Cloudflare → Worker `joran` → Settings → Variables and Secrets → Add → Type **Secret**, Name `GITHUB_TOKEN`, Wert = Token → Deploy.

Kontrolle: GitHub → Actions → «Joran Push» zeigt alle 10 Minuten einen Lauf mit Ereignis `workflow_dispatch`.
