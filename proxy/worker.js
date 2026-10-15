/* Joran — Cloudflare Worker mit zwei Aufgaben:
   1. CORS-Proxy für die Seestationen Vingelz und Ipsach. Leitet ausschliesslich die beiden meteoBase-Seiten weiter.
      Aufruf: https://<worker>/?url=<Seiten-URL>
   2. Zeitgeber für den Push: stösst alle 10 Minuten die GitHub Action «Joran Push» an (workflow_dispatch, test=false).
      Braucht das Secret GITHUB_TOKEN (fine-grained, nur Repo Joran, Berechtigung «Actions: Read and write»). */
const ERLAUBT = ["vingelz.meteobase.ch", "wsa-ipsach.meteobase.ch"];
const REPO = "v9vb46dd29-eng/Joran";

async function tick(env){
  if(!env.GITHUB_TOKEN){ console.log("GITHUB_TOKEN fehlt"); return; }
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/joran-push.yml/dispatches`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "joran-worker", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { test: "false", user: "" } })
  });
  console.log(r.status === 204 ? "Push-Prüfung gestartet" : `GitHub antwortet ${r.status}: ${await r.text()}`);
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(tick(env)); },
  async fetch(req) {
    const cors = { "Access-Control-Allow-Origin": "*" };
    const target = new URL(req.url).searchParams.get("url") || "";
    let host = "";
    try { host = new URL(target).hostname; } catch (e) {}
    if (!ERLAUBT.includes(host)) return new Response("nicht erlaubt", { status: 403, headers: cors });
    const r = await fetch(target, { headers: { "User-Agent": "Joran-Wingfoil" }, cf: { cacheTtl: 0 } });
    return new Response(await r.text(), {
      status: r.status,
      headers: { ...cors, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
};
