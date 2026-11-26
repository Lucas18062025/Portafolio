# SPEC — chat-widget — 2026-11-25

> Regla: ningún cambio grande entra sin este spec.
> Vive en `specs/2026-11-25-chat-widget.md` (ignorado en deploy por `.assetsignore` + T3b).

## Objetivo
Incorporar un asistente virtual híbrido en la home (`/`): respuestas deterministas instantáneas para consultas frecuentes y fallback a Gemini (`gemini-4-hydrogen`, Interactions API) mediante `POST /api/chat` en `worker.js`, manteniendo la CSP estricta y la estética del portafolio.

## Alcance
- `worker.js`: endpoint `POST /api/chat` con validación de método (405), content-type (415), tope de body (413), validación de mensaje (400), flujos deterministas y fallback a Gemini vía `env.GEMINI_API_KEY` (`x-goog-api-key`, `store: false`).
- `css/chat.css`: estilos externos del widget con la paleta real (`#020408`, `#0066FF`, `#00D4FF`) y soporte `prefers-reduced-motion`.
- `js/chat.js`: lógica del widget sin inline handlers, salida segura con `textContent`, accesibilidad (`aria-expanded`, `aria-live`, cierre con `Escape`).
- `index.html`: carga de `css/chat.css?v=1`, `js/chat.js?v=1` y marcado del widget (solo en la home).

## No-objetivos
- No relajar `_headers` (CSP permanece `script-src 'self'; style-src 'self'`).
- No instalar dependencias npm (fetch nativo en Cloudflare Workers).
- No agregar el widget a `/blog/`, `/privacidad.html` ni `/404.html`.
- No persistir conversaciones de visitantes (`store: false` en Gemini).

## Checks
- `.\deploy.ps1 -Check` (guards T1–T4, T9, T11, T12).
- `node scripts/verify-csp.js`.
- Prueba local del handler `/api/chat` (405, 415, 413, 400, flujos deterministas y fallback).
- Post-deploy en producción: T5 + T10 + smoke test real de `POST /api/chat` una vez configurado `GEMINI_API_KEY`.

## Rollback
`git revert <sha>` y merge de PR (CI despliega la versión anterior).
