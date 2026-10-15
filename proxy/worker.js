/* Joran — CORS-Proxy für die Seestationen Vingelz und Ipsach (Cloudflare Worker).
   Leitet ausschliesslich die beiden meteoBase-Seiten weiter. Aufruf: https://<worker>/?url=<Seiten-URL> */
const ERLAUBT = ["vingelz.meteobase.ch", "wsa-ipsach.meteobase.ch"];

export default {
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
