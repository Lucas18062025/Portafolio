# TEST_PLAN.md — Portafolio

## Puerta de deploy (automática en `deploy.ps1`)
| # | Check | Esperado |
|---|-------|----------|
| T1 | `google*.html` existe | aborta si falta |
| T2 | `wrangler.jsonc` tiene `"binding": "ASSETS"` | aborta si falta |
| T3 | `.assetsignore` contiene `^worker\.js$` | aborta si falta |
| T3b | `.assetsignore` contiene `AGENTS.md`, `SECURITY.md`, `TEST_PLAN.md`, `TOOLS.md`, `specs` + `specs/**` | aborta si falta |
| T4 | `dry-run` contiene `env.ASSETS` | aborta si falta |
| T5 | `GET /` → 200, `/manifest.json` → 200, `/worker.js` → 404, `/no-existo` → 404 (nunca 500) · `/blog/visual-field-notes/` → 200 + 2 assets del kit (1 WebP y 1 MP4) → 200 | aborta si falla |

## Gates del CI (GitHub Actions, no están en `deploy.ps1`)
- `ci.yml` (en PR y push a `main`) → `node scripts/verify-csp.js`: valida la CSP del `_headers`.
- `deploy.yml` (push a `main`) → T5 (7 checks) después del deploy.

## Validación SEO (manual, post-deploy)
- T6 Rich Results: `/` → ProfilePage · `/blog/` → Blog + BreadcrumbList · `/blog/visual-field-notes/` → BlogPosting + BreadcrumbList. 0 errores.
- T7 Search Console: `URL está en Google` + indexada + HTTPS OK.
- T8 `curl` prod: `/` devuelve `@graph` (ProfilePage + Person + WebSite); cada página de blog devuelve su propio `@type`.

## No-objetivos verificados
- `Range`/`206`: Workers Assets no lo soporta (probado 17/10: siempre 200 con el cuerpo completo, sin `Accept-Ranges`). No esperar respuestas parciales en MP4/WebP.

## Criterio de finalización
- T1–T5 en verde en output de `deploy.ps1` (**T5 = 7 checks**) + T8 + cero `scriptThrewException` en 5 min.
