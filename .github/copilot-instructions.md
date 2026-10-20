# Instrucciones para Copilot / agentes IA — Portafolio

Respondé siempre en español argentino (es-AR), con voseo y tono técnico claro.
Identificadores de código en inglés, mensajes y contenido en español.

## Proyecto
Sitio estático (HTML/CSS/JS vanilla) + `worker.js` en Cloudflare Workers con
binding `ASSETS`. Contenido: proyectos, blog, certificados
(`data/certificates.json`), SEO JSON-LD.

## Estructura
`index.html`, `css/`, `js/`, `assets/`, `blog/`, `data/certificates.json`,
`worker.js`, `wrangler.jsonc`, `deploy.ps1`, `_headers`, `sitemap.xml`.

## Comandos (usar solo estos)
- Preview: `npx serve .`
- Deploy: `.\deploy.ps1 -Message "feat: ..."` (hace guards + push + dry-run + deploy + health-checks)
- Diagnóstico: `npx --yes wrangler@4.136.3 deploy --dry-run`

## Estilo
Paleta real: fondo `#020408`, acentos `#0066FF` / `#00D4FF`.
Los tonos del preview (bordó/dorado) NO se copian.

## Reglas (respetar siempre)
- No editar el real directo: prototipar en `OpenCode/portafolio-preview`, verificar
  con el usuario, recién después portar.
- Guards que abortan deploy: falta `google*.html`, falta `"binding": "ASSETS"`,
  falta `worker.js` en `.assetsignore`, dry-run sin `env.ASSETS`.
- Nunca exponer `worker.js` (`/worker.js` debe dar 404).
- No ofuscar el email sin pedido explícito (rompió Gmail en Edge, sep-2026).
- Fixes chicos: push directo a `main` ok. Cambios grandes: rama `feat/...` + PR.
- Commits firmados (`gpg.format=ssh`); si sale `Unverified`, revisar la signing key.
- Health-check sano: `/` 200, `/manifest.json` 404 (el sitio no es una PWA), `/worker.js` 404, `/no-existo` 404.
