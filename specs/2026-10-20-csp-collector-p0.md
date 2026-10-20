# SPEC — Colector CSP P0 (content-types + Reporting-Endpoints + sampling)

## Objetivo
Que `/api/csp-report` acepte los content-types que **realmente** manda el navegador
y que los reportes **queden registrados** en Workers Logs.

Hoy el endpoint responde **415** a `application/csp-report` (Firefox/Safari, `report-uri`)
y a `application/reports+json` (Chrome 96+, Reporting API v1). Solo acepta
`application/json`, que **ningún navegador manda**: es decir, el colector es un
sensor apagado. Además `observability.head_sampling_rate = 0.1` descartaba el 90%
de las invocaciones, así que aunque llegaran, no se veían.

## Alcance
- `worker.js`: content-types, `Allow: POST`, validación de shape (L2 y v1),
  tope de tamaño real sobre el stream (no solo `content-length`).
- `_headers`: `Reporting-Endpoints` con URL **absoluta** + `Report-To` con URL
  absoluta (hoy es relativa e inválida para `Report-To`).
- `wrangler.jsonc`: `head_sampling_rate` 0.1 → 1.
- `scripts/verify-csp.js`: exigir `Reporting-Endpoints` con URL absoluta y que el
  nombre del grupo coincida con la directiva `report-to`.
- `TEST_PLAN.md` + `deploy.ps1`: gate **T10** (6 checks del colector).

## No-objetivos
- **No** se agrega el binding de rate-limit en este paso (va en el Paso 2, con
  probe previo en un Worker scratch).
- No se cambia la paleta, ni el layout, ni `index.html`, ni `blog/`.
- No se toca la política de privacidad (Lote A) — pero **este paso genera un dato
  nuevo**: el log del Worker guardará la URL visitada y, en Reporting API v1,
  potencialmente el `user_agent` del visitante. Queda anotado para el Lote A.

## Prototipo
No aplica: no hay cambio visual. Se verifica con `curl` contra producción
después del deploy (evidencia en la nota de sesión).

## Checks
- T1–T5 (existing) + **T10** (nuevo): 
  1. `POST` `application/csp-report` con shape L2 → 204
  2. `POST` `application/reports+json` con shape v1 (array) → 204
  3. `POST` `application/json` con shape L2 → 204
  4. `POST` `text/plain` → 415 (+ `Accept`)
  5. `POST` `application/json` con shape inválido → 400
  6. `GET` → 405 + `Allow: POST`
  7. `POST` body > 8 KB → 413
  8. `GET /` trae `Reporting-Endpoints` con URL absoluta
- T8 + cero `scriptThrewException` a los 5 min.
- CI: `node scripts/verify-csp.js` (ya corre en `ci.yml`).

## Rollback
`git revert <sha>` + redeploy, o `wrangler rollback` al deployment anterior.
Los cambios son de una sola function (`/api/csp-report`) y de dos cabeceras:
el revert no toca el resto del sitio.
