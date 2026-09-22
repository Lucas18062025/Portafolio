// Colector mínimo de reportes CSP (report-uri / report-to).
// Recibe POST en /api/csp-report, responde 204 y deja el reporte
// en el log del Worker (visible con observability + `wrangler tail`).
// Todo lo demás se sirve desde los Static Assets.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/csp-report") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      try {
        const report = await request.json();
        console.log("[csp-report]", JSON.stringify(report).slice(0, 2000));
      } catch {
        // cuerpo vacío o inválido: igual se responde 204
      }
      return new Response(null, { status: 204 });
    }

    try {
      if (!env.ASSETS) {
        console.error("[worker] env.ASSETS is undefined — falta \"binding\": \"ASSETS\" en wrangler.jsonc");
        return new Response("Internal Server Error: ASSETS binding missing", { status: 500 });
      }
      return await env.ASSETS.fetch(request);
    } catch (e) {
      console.error("[worker] ASSETS.fetch failed:", e?.message ?? e);
      return new Response("Not Found", { status: 404 });
    }
  }
};
