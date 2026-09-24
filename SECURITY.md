# SECURITY.md — Portafolio

## Secretos (nunca al repo)
- `Cloudflare.md` del vault (API token + password + recovery) JAMÁS se stagea. Verificado excluido en commit `6ce3422`.
- Tokens Telegram / `TELEGRAM_BOT_TOKEN`, `CHAT_ID` van en `Worker → Settings → Secrets`, nunca en `worker.js` ni `.env` commiteado.
- Verificación pre-commit: `git status --short` + `git diff --stat`. Ante duda, `git check-ignore <archivo>`.

## Superficie
- `worker.js` no público: `.assetsignore` contiene `worker.js`, health-check `/worker.js → 404`.
- Headers en `_headers` (CSP sin CDNs externos; Font Awesome es local `assets/vendor/`). No re-agregar `cdnjs` sin actualizar CSP.
- `google*.html` en raíz siempre. Sin él se pierde Search Console.

## Lección registrada
- Ofuscación email con entidades HTML → redirect loop Gmail en Edge. Revertido a texto plano. No reintentar sin pedido explícito.
