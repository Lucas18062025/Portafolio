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
- Post-deploy 5 min: `Observability → Logs → Error`, cero `scriptThrewException` = sano.
- Verificable por API (read-only): issues de `workers/observability` para el Worker `portafolio` → deben aparecer solo los issues conocidos.

## 6. Publicación
- Todo push a `main` va a producción: `deploy.yml` corre en `push: branches: [main]` y ejecuta `wrangler deploy`. No hay branch protection ni rulesets (repo privado + plan Free): la única barrera previa es `deploy.ps1` (T1–T3b + dry-run). El CI informa después del deploy; no gatea.

## 7. Historia de git
- Escaneo de secretos sobre toda la historia (393 commits, 17/10/2026): 4 coincidencias, todas `${{ secrets.* }}` (referencias, no valores). Nunca se commiteó `.env`/`.dev.vars`/`.pem`. Repetir ante duda con los patrones de tokens (Cloudflare/GitHub/Google/JWT/Stripe/DigitalOcean/Anthropic/xAI), claves privadas y hex-37.

## Lecciones registradas
- Ofuscación de email con entidades HTML → redirect loop Gmail en Edge. Revertido a texto plano. No reintentar sin pedido explícito.
