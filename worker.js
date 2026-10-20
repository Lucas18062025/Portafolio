// Colector de reportes CSP (report-uri / report-to).
// Recibe POST en /api/csp-report, responde 204 y deja el reporte
// en el log del Worker (visible con observability + `wrangler tail`).
// Todo lo demás se sirve desde los Static Assets.

// Content-types que mandan los navegadores reales:
//   application/csp-report   -> report-uri (Firefox, Safari) shape {"csp-report": {...}}
//   application/reports+json -> report-to / Reporting API v1 (Chrome 96+, Edge) shape [ {...} ]
//   application/json         -> genérico (curl, pruebas)
// Antes solo se aceptaba "application/json", que NINGÚN navegador manda: por eso
// todo reporte real caía en 415 y el colector era un sensor apagado.
const CSP_CONTENT_TYPES = [
  "application/csp-report",
  "application/reports+json",
  "application/json"
];

// Tope del cuerpo del reporte (anti log-spam). Se aplica sobre el stream, no
// sobre content-length: un POST chunked o con content-length mentiroso lo esquiva.
const MAX_REPORT_BYTES = 8192;

/**
 * Lee el body como texto cortando en maxBytes.
 * @param {Request} request
 * @param {number} maxBytes
 * @returns {Promise<{text: string, tooLarge: boolean}>}
 */
async function readCappedBody(request, maxBytes) {
  if (!request.body) {
    return { text: "", tooLarge: false };
  }
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { text: "", tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return { text: "", tooLarge: false };
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(merged), tooLarge: false };
}

/**
 * Valida el shape del reporte segun el content-type.
 *   L2 (report-uri):  {"csp-report": { ... }}
 *   v1 (Reporting API): [ { "type": "...", "body": { ... } } ]
 *   application/json:  cualquiera de los dos
 * @param {unknown} parsed
 * @param {string} contentType
 * @returns {boolean}
 */
function isValidCspReport(parsed, contentType) {
  const isL2 = () =>
    !!parsed && typeof parsed === "object" && !Array.isArray(parsed) &&
    !!parsed["csp-report"] && typeof parsed["csp-report"] === "object" &&
    !Array.isArray(parsed["csp-report"]);

  const isV1 = () =>
    Array.isArray(parsed) && parsed.every((item) =>
      !!item && typeof item === "object" && !Array.isArray(item) &&
      typeof item.type === "string" &&
      !!item.body && typeof item.body === "object" && !Array.isArray(item.body)
    );

  if (contentType === "application/csp-report") return isL2();
  if (contentType === "application/reports+json") return isV1();
  return isL2() || isV1();
}

/**
 * Resume el reporte a campos planos para el log.
 * NO se loguea el referrer ni el user_agent: el log del Worker es un
 * registro persistente (3 dias en plan Free) y no necesita mas datos.
 * @param {unknown} report
 * @returns {Array<object>}
 */
function summarizeCspReport(report) {
  const items = Array.isArray(report)
    ? report
    : (report && report["csp-report"] ? [report["csp-report"]] : []);

  return items.map((item) => {
    const body = item && typeof item === "object" && item.body && typeof item.body === "object"
      ? item.body
      : item;
    if (!body || typeof body !== "object") {
      return { raw: String(item).slice(0, 200) };
    }
    return {
      type: typeof item.type === "string" ? item.type : "csp-violation",
      document: body["document-uri"] || body.documentURL || null,
      directive: body["violated-directive"] || body.effectiveDirective || null,
      blocked: body["blocked-uri"] || body.blockedURL || null,
      status: body["status-code"] ?? body.statusCode ?? null,
      disposition: body.disposition || null
    };
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/csp-report") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" }
        });
      }

      const contentType = (request.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!CSP_CONTENT_TYPES.includes(contentType)) {
        return new Response("Unsupported Media Type", {
          status: 415,
          headers: { Accept: CSP_CONTENT_TYPES.join(", ") }
        });
      }

      const body = await readCappedBody(request, MAX_REPORT_BYTES);
      if (body.tooLarge) {
        return new Response("Payload Too Large", { status: 413 });
      }

      let parsed;
      try {
        parsed = JSON.parse(body.text);
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
      if (!isValidCspReport(parsed, contentType)) {
        return new Response("Bad Request", { status: 400 });
      }

      console.log("[csp-report]", JSON.stringify(summarizeCspReport(parsed)));
      return new Response(null, { status: 204 });
    }

    try {
      if (!env.ASSETS) {
        console.error("[worker] env.ASSETS is undefined — falta \"binding\": \"ASSETS\" en wrangler.jsonc");
        return new Response("Internal Server Error: ASSETS binding missing", { status: 500 });
      }
      const res = await env.ASSETS.fetch(request);
      // 404 brandeado: sirve /404.html manteniendo el estado 404 (SEO correcto)
      // y propagando las cabeceras de seguridad de la página original.
      if (res.status === 404 && url.pathname !== "/404.html") {
        const page = await env.ASSETS.fetch(new Request(new URL("/404.html", url)));
        if (page.status === 200) {
          const headers = new Headers(page.headers);
          headers.set("content-type", "text/html;charset=UTF-8");
          return new Response(await page.text(), {
            status: 404,
            headers
          });
        }
      }
      return res;
    } catch (e) {
      console.error("[worker] ASSETS.fetch failed:", e?.message ?? e);
      return new Response("Not Found", { status: 404 });
    }
  }
};
