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

## 4. Supply-chain
- No instalar dependencias sin aprobación. No tocar `node_modules/wrangler/config-schema.json`.

## 5. Observabilidad
- Post-deploy 5 min: `Observability → Logs → Error`, cero `scriptThrewException` = sano.

## Lecciones registradas
- Ofuscación de email con entidades HTML → redirect loop Gmail en Edge. Revertido a texto plano. No reintentar sin pedido explícito.
