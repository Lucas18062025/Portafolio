# AGENTS.md — Portafolio

## Proyecto
Sitio estático (HTML/CSS/JS vanilla) + `worker.js` Cloudflare Workers con
`binding ASSETS`. Contenido: proyectos, blog, certificados (`data/certificates.json`), SEO JSON-LD.

## Estructura
- `index.html`, `css/`, `js/`, `assets/`, `blog/`, `data/certificates.json`
- `worker.js`, `wrangler.jsonc`, `deploy.ps1`, `_headers`, `sitemap.xml`, `google*.html`
- `.agents/rules/workflow.md`: pipeline y convención git (fuente de verdad, no duplicar aquí).

## Mapa de rutas (absolutas, nunca relativas)
- Real: `C:\Users\HP Ryzen 5\Proyectos\Portafolio`
- Preview: `C:\Users\HP Ryzen 5\OpenCode\portafolio-preview` (carpeta separada, NO subcarpeta del real)
- Notas Obsidian: `C:\Users\HP Ryzen 5\Documents\Obsidian Vault\Vault\Portafolio\Actas\`
- Prohibido crear `OpenCode/` o `Vault/` dentro del repo real.

## Comandos (usar solo estos)
- Preview: `npx serve .`
- Deploy: `.\deploy.ps1 -Message "feat: ..."` (guards + push + dry-run + deploy + health-checks)
- Diagnóstico: `npx --yes wrangler@4.136.3 deploy --dry-run`

## Estilo
- Paleta real: fondo `#020408`, acentos `#0066FF` / `#00D4FF`. Tonos preview (bordó/dorado) NO se copian.
- Mensajes y contenido en español (`es-AR`). Identificadores código en inglés.

## Reglas
- Orden: este AGENTS.md > `.agents/rules/workflow.md` > `deploy.ps1` > código.
- Nunca editar el real directo: prototipar en preview (ver Mapa de rutas) → verificar con usuario → portar.
- Pre-acción fuera del cwd: resolver ruta absoluta + verificar en disco antes de crear/leer. Nunca asumir subcarpetas.
- Guardias que abortan deploy: falta `google*.html`, falta `"binding": "ASSETS"`, falta `worker.js` en `.assetsignore`, dry-run sin `env.ASSETS`.
- Git: fixes chicos push directo ok; cambios grandes rama `feat/...` + PR + merge (respeta protección `main`).
- Commits firmados `gpg.format=ssh`. Si sale `Unverified`, revisar signing key primero.
- No exponer `worker.js` (`404` esperado). No ofuscar email sin pedido explícito (rompió Gmail en Edge, sep-2026).

## Al terminar
- Correr `.\deploy.ps1`, pegar health-checks (`/` 200, `/manifest.json` 200, `/worker.js` 404, `/no-existo` 404).
- Revisar `Observability → Logs → Error` a los 5 min: cero `scriptThrewException` = sano.
