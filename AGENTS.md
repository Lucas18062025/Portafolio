# AGENTS.md — Portafolio (única fuente)

## Proyecto
Estático HTML/CSS/JS vanilla + `worker.js` (Workers + `binding ASSETS`).
Contenido: proyectos, blog, `data/certificates.json`, SEO JSON-LD.

## Orden
`AGENTS.md > SECURITY.md > TEST_PLAN.md > deploy.ps1 > código`.
`.agents/rules/workflow.md` es puntero a este archivo, no duplica.
Detalle: `TOOLS.md` (herramientas), `SECURITY.md` (dominios), `TEST_PLAN.md` (puerta T1-T8).

## Rutas (absolutas, verificar en disco antes de usar)
- Real: `C:\Users\HP Ryzen 5\Proyectos\Portafolio`
- Preview: `C:\Users\HP Ryzen 5\OpenCode\portafolio-preview` (separada, NO subcarpeta del real)
- Actas: `C:\Users\HP Ryzen 5\Documents\Obsidian Vault\Vault\Portafolio\Actas\`
- Sesiones (escribir DURANTE la sesión): `C:\Users\HP Ryzen 5\Documents\Obsidian Vault\Sesiones\` — nota `YYYY-MM-DD.md` + fila en `Indice Sesiones.md`
- Prohibido crear `OpenCode/` o `Vault/` dentro del real.

## Pipeline obligatorio
1. Cambio grande → `specs/YYYY-MM-DD-slug.md` (ver `specs/_template.md`).
2. Prototipar en preview → verificar con usuario.
3. Portar al real con paleta `#020408` + `#0066FF`/`#00D4FF` (bordó/dorado del preview NO se copian).
4. Docs/gobernanza (`AGENTS/SECURITY/TEST_PLAN/TOOLS/specs`) se editan directo en real, sin preview.

## Comandos (únicos)
- Preview: `npx serve .` (solo en preview)
- Deploy: `.\deploy.ps1 -Message "feat: ..."` (guards + push + dry-run + deploy + health-checks)
- Diagnóstico: `npx --yes wrangler@4.136.3 deploy --dry-run`
- Prohibido: `wrangler deploy` manual (salvo fix documentado), `--force`, instalar deps sin aprobación.

## Git
- Pre-commit: `git status --short` + `git diff --stat` (+ `git check-ignore <archivo>` ante duda).
- Nunca `git add .` en manual; solo archivos intencionales. (`deploy.ps1` hace staging propio.)
- Chico: push directo ok. Grande: rama `feat/...` + PR + merge (respeta protección `main`).
- Firmados `gpg.format=ssh`. Si `Unverified` → revisar signing key primero.

## Guards (abortan deploy, ver `TEST_PLAN.md`)
T1 `google*.html` existe / T2 `binding ASSETS` / T3 `worker.js` en `.assetsignore`
+ T3b docs internos + `specs/` ignorados / T4 dry-run con `env.ASSETS`
/ T5 health-checks `/` 200, `/manifest.json` 200, `/worker.js` 404, `/no-existo` 404 (nunca 500).

## Reglas que no se repiten (ver detalle)
- No exponer `worker.js` (`404` esperado). No ofuscar email sin pedido explícito (rompió Gmail en Edge, sep-2026).
- Pre-acción fuera del cwd: resolver ruta absoluta + verificar en disco. Nunca asumir subcarpetas.
- Mensajes y contenido en español (`es-AR`). Identificadores de código en inglés.

## Cierre
- Pegar T1–T5 + T8 (`@graph` en prod) + cero `scriptThrewException` a los 5 min.
- Nota de sesión en disco + `tasklist` sin `gbrain`/`opencode` residual. Nada en background.
