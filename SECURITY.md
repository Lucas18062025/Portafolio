# SECURITY.md — por dominios

## 1. Secrets (nunca al repo)
- `Cloudflare.md` del vault (API token + password + recovery) JAMÁS se stagea.
- `TELEGRAM_BOT_TOKEN` / `CHAT_ID` solo en `Worker → Settings → Secrets`, nunca en `worker.js` ni `.env` commiteado.
- Pre-commit: `git status --short` + `git diff --stat`. Ante duda, `git check-ignore <archivo>`.

## 2. App + Headers
- `_headers` con CSP sin CDNs externos; Font Awesome es local (`assets/vendor/`). No re-agregar `cdnjs` sin actualizar CSP.

## 3. Assets / Superficie
- `worker.js` no público: `.assetsignore` contiene `worker.js`, health-check `/worker.js → 404`.
- Docs internos (`AGENTS.md`, `SECURITY.md`, `TEST_PLAN.md`, `TOOLS.md`, `specs/`) ignorados en `.assetsignore` (hallazgo oct-2026: respondían 200).
- `google*.html` en raíz siempre. Sin él se pierde Search Console.
- Todo doc interno o carpeta de trabajo nueva se agrega a `.assetsignore` Y a T3b de `TEST_PLAN.md`: las dos listas se mantienen sincronizadas.

## 4. Supply-chain
- No instalar dependencias sin aprobación. No tocar `node_modules/wrangler/config-schema.json`.

## 5. Observabilidad
- Post-deploy 5 min: cero `scriptThrewException` = sano.
- **Camino estándar (17/10): MCP `cloudflare-observability`** (read-only). `query_worker_observability` con `view:calculations`, filtro `$metadata.service eq portafolio`, `groupBys: $workers.outcome` y timeframe relativo `{reference: <ahora>, offset: "-6h"}` → debe devolver **solo `ok`**. Complemento: `view:events` + filtro `$metadata.error: exists` → debe volver **`[]`** (bucket vacío).
- Antes de filtrar por un campo nuevo: `observability_keys` / `observability_values` para confirmar que el campo y el valor existen (evita filtros inventados).
- Alternativa por API cruda (misma data): `POST /accounts/5443029ed4498003db9d0748999a326e/workers/observability/telemetry/query` con el `body` como **string JSON** y `queryId:"adhoc"` **obligatorio** (sin él → `ZodError`). Clave del resultado: `$workers.outcome`.

## 6. Publicación
- **Único path a producción: el CI.** `.github/workflows/deploy.yml` corre en `push: [main]` (o sea, al mergear el PR), ejecuta `wrangler deploy` y valida T5 + T10 (`scripts/health-checks.mjs`). Si el gate falla, el job queda rojo.
- Antes había 3 paths de deploy (`deploy.ps1`, el CI y Workers Builds) y cada push a `main` desplegaba **3 veces** (medido 20/10: 3 versiones en Cloudflare por push, separadas ~15 s). `deploy.ps1` ya no despliega: es pre-flight + push de rama. Workers Builds queda pendiente de apagar (dashboard), y su deploy command (`npx wrangler deploy`) no está pineado.
- Barreras antes del deploy: los guards (`scripts/guards.mjs`: T1–T3b, T4, T9) corren **en el CI** y no solo en la máquina del owner. El mismo script corre en el gate del PR (`ci.yml`), así que un PR roto ni siquiera llega al merge.
- `main` está protegida por el ruleset `protect-main` (exige PR, commits firmados, sin borrado ni force-push). El owner tiene bypass permanente, así que un push directo se aceptaría y quedaría asentado como *"Bypassed rule violations"*: el flujo (rama → PR → merge) evita depender de ese bypass. La firma de los commits **no** se saltea.

## 7. Historia de git
- Escaneo de secretos sobre toda la historia (393 commits, 17/10/2026): 4 coincidencias, todas `${{ secrets.* }}` (referencias, no valores). Nunca se commiteó `.env`/`.dev.vars`/`.pem`. Repetir ante duda con los patrones de tokens (Cloudflare/GitHub/Google/JWT/Stripe/DigitalOcean/Anthropic/xAI), claves privadas y hex-37.

## Lecciones registradas
- Ofuscación de email con entidades HTML → redirect loop Gmail en Edge. Revertido a texto plano. No reintentar sin pedido explícito.
