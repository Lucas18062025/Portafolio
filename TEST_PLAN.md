# TEST_PLAN.md — Portafolio

## Puerta de deploy (automática en `deploy.ps1`)
| # | Check | Esperado |
|---|-------|----------|
| T1 | `google*.html` existe | aborta si falta |
| T2 | `wrangler.jsonc` tiene `"binding": "ASSETS"` | aborta si falta |
| T3 | `.assetsignore` contiene `^worker\.js$` | aborta si falta |
| T4 | `dry-run` contiene `env.ASSETS` | aborta si falta |
| T5 | `GET /` → 200, `/manifest.json` → 200, `/worker.js` → 404, `/no-existo` → 404 (nunca 500) | aborta si falla |

## Validación SEO (manual, post-deploy)
- T6 Rich Results Test: `1 valid item ProfilePage`, 0 errores.
- T7 Search Console: `URL está en Google` + indexada + HTTPS OK.
- T8 `curl` producción devuelve `@graph ProfilePage + Person + WebSite`.

## Criterio de finalización
- T1–T5 en verde en output de `deploy.ps1` + T8 + cero `scriptThrewException` en 5 min.
