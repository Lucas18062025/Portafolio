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

// Configuracion del asistente virtual (/api/chat).
const MAX_CHAT_BYTES = 4096;
const MAX_CHAT_MESSAGE_CHARS = 500;
const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1/interactions";
const GEMINI_MODELS = [
  "gemini-4-hydrogen",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
];
const ASSISTANT_SYSTEM_INSTRUCTION =
  "Sos el asistente virtual del portafolio de Lucas Villagra, analista de ciberseguridad " +
  "(Red Team, pentesting, SIEM, automatizacion con Python, n8n e IA; Tucuman, Argentina). " +
  "Responde en espanol (es-AR), de forma breve, clara y profesional (maximo 3 a 4 oraciones). " +
  "No inventes datos, clientes ni proyectos que no existan; si piden contacto directo, " +
  "indica lucaslean1806@gmail.com o la seccion ./ Conectar (#contacto).";

/**
 * Helper de respuesta JSON sin cache para endpoints /api/*.
 * @param {object} payload
 * @param {number} [status=200]
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Response}
 */
function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

/**
 * Normaliza texto a minusculas sin tildes para matching determinista.
 * @param {string} text
 * @returns {string}
 */
function normalizeChatText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Flujos guiados deterministas (respuesta instantanea sin consumir cuota de IA).
 * @param {string} rawMessage
 * @returns {string | null}
 */
function matchDeterministicReply(rawMessage) {
  const msg = normalizeChatText(rawMessage);

  if (/\b(hola|buenas|buen dia|buenas tardes|buenas noches|ayuda|menu|inicio)\b/.test(msg)) {
    return (
      "¡Hola! Soy el asistente de Lucas Villagra. Puedo ayudarte con:\n" +
      "1. Proyectos y labs de ciberseguridad\n" +
      "2. Certificaciones y CV\n" +
      "3. Contacto directo\n" +
      "¿Qué necesitás?"
    );
  }

  if (/\b(contacto|contactar|email|correo|mail|whatsapp|linkedin|hablar)\b/.test(msg)) {
    return (
      "Podés contactar a Lucas directamente por correo a lucaslean1806@gmail.com, " +
      "o desde LinkedIn y WhatsApp en la sección ./ Conectar (#contacto) al pie de la página."
    );
  }

  if (/\b(proyecto|proyectos|labs|laboratorios|github|herramientas|repos)\b/.test(msg)) {
    return (
      "En la sección ./ Proyectos (#projects) encontrás labs y herramientas reales de Lucas " +
      "(auditoría de seguridad, SIEM, automatización con Python, n8n e IA), junto con sus repositorios en GitHub."
    );
  }

  if (/\b(cv|curriculum|certificacion|certificaciones|certificados|credenciales)\b/.test(msg)) {
    return (
      "Podés descargar el CV de Lucas desde el encabezado o revisar sus credenciales " +
      "(Cisco Ethical Hacker, Google Cybersecurity y Google AI Essentials) en la sección ./ Certificaciones."
    );
  }

  return null;
}

/**
 * Extrae el texto final de una respuesta de Gemini Interactions API (steps -> model_output).
 * @param {unknown} data
 * @returns {string | null}
 */
function extractGeminiText(data) {
  if (!data || typeof data !== "object") return null;
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const parts = [];
  for (const step of steps) {
    if (step && step.type === "model_output" && Array.isArray(step.content)) {
      for (const block of step.content) {
        if (block && block.type === "text" && typeof block.text === "string") {
          parts.push(block.text);
        }
      }
    }
  }
  const text = parts.join("").trim();
  return text || null;
}

/**
 * Consulta a Gemini usando Interactions API v1 (sin retencion en servidor: store=false).
 * La API key se envia en header x-goog-api-key, nunca en query string.
 * Si el modelo primario responde 503/429/5xx, cae automaticamente al siguiente modelo.
 * @param {string} prompt
 * @param {string} apiKey
 * @returns {Promise<string | null>}
 */
async function callGemini(prompt, apiKey) {
  for (const model of GEMINI_MODELS) {
    const response = await fetch(GEMINI_INTERACTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model,
        store: false,
        system_instruction: ASSISTANT_SYSTEM_INSTRUCTION,
        input: prompt,
        generation_config: {
          max_output_tokens: 300
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = extractGeminiText(data);
      if (text) return text;
    }

    console.error("[api/chat] Gemini upstream error:", model, response.status);
    // Solo reintenta con otro modelo ante saturacion/error transitorio (429/5xx) o 404 de modelo
    if (response.status !== 429 && response.status !== 404 && response.status < 500) {
      return null;
    }
  }

  return null;
}

/**
 * Manejador del endpoint POST /api/chat.
 * @param {Request} request
 * @param {Record<string, any>} env
 * @returns {Promise<Response>}
 */
async function handleChatRequest(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405, { Allow: "POST" });
  }

  const contentType = (request.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return jsonResponse({ error: "Unsupported Media Type" }, 415, { Accept: "application/json" });
  }

  const body = await readCappedBody(request, MAX_CHAT_BYTES);
  if (body.tooLarge) {
    return jsonResponse({ error: "Payload Too Large" }, 413);
  }

  let parsed;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const rawMessage = parsed && typeof parsed.message === "string" ? parsed.message.trim() : "";
  if (!rawMessage || rawMessage.length > MAX_CHAT_MESSAGE_CHARS) {
    return jsonResponse(
      { error: `El mensaje debe tener entre 1 y ${MAX_CHAT_MESSAGE_CHARS} caracteres.` },
      400
    );
  }

  // 1. Clasificacion determinista (flujos guiados)
  const deterministicReply = matchDeterministicReply(rawMessage);
  if (deterministicReply) {
    return jsonResponse({ reply: deterministicReply, source: "guided" });
  }

  // 2. Fallback a Gemini (intenciones no deterministas)
  if (typeof env?.GEMINI_API_KEY === "string" && env.GEMINI_API_KEY.trim().length > 0) {
    try {
      const geminiReply = await callGemini(rawMessage, env.GEMINI_API_KEY.trim());
      if (geminiReply) {
        return jsonResponse({ reply: geminiReply, source: "ai" });
      }
      return jsonResponse(
        {
          reply:
            "No pude consultar al motor de IA en este momento. Probá nuevamente en unos segundos o escribile a Lucas desde ./ Conectar (#contacto)."
        },
        502
      );
    } catch (err) {
      console.error("[api/chat] Gemini fetch failed:", err?.message ?? err);
      return jsonResponse(
        {
          reply:
            "Hubo un error temporal con el motor de IA. Podés escribirle directamente a Lucas desde ./ Conectar (#contacto)."
        },
        502
      );
    }
  }

  return jsonResponse({
    reply:
      "No encontré una respuesta rápida para esa consulta y el motor de IA no está activo todavía. Podés contactar a Lucas en ./ Conectar (#contacto).",
    source: "fallback"
  });
}

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

    if (url.pathname === "/api/chat") {
      return handleChatRequest(request, env);
    }

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
