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
- Chico: push directo ok. Grande: rama `feat/...` + PR + merge.
- `main` **sí** está protegida: ruleset `protect-main` (activo desde 20/07/2026) → exige PR, commits firmados, y bloquea borrado y force-push. El owner tiene `bypass_mode: always`, así que un push directo **se acepta** y GitHub lo registra como *"Bypassed rule violations"*. Convención: chico → push directo (bypass del owner); grande → rama + PR + merge. La firma **no** se saltea (sigue aplicando; `deploy.ps1` hereda `commit.gpgsign=true`). Todo push a `main` va a producción y el CI corre después (informa, no gatea).
  - Evidencia 20/10: `gh api repos/Lucas18062025/Portafolio/rulesets/19284894` → `enforcement: active`, `bypass_actors[].bypass_mode: always`. Ojo: `gh api .../branches/main` → `protected: true` (el campo **no** distingue ruleset de branch protection clásico; para eso está `/rulesets`).
  - El 17/10 se documente lo contrario ("sin branch protection ni rulesets, repo privado"): fue un error de lectura. La API de `/rulesets` daba **403** *"Upgrade to GitHub Pro or make this repository public to enable this feature"* porque el repo estaba **privado** en plan Free (los rulesets son gratis solo en repos públicos). El repo es **público** desde su creación (12/02/2026). No volver a concluir "no existe" a partir de un 403: leer el mensaje.
- Firmados `gpg.format=ssh`. Si `Unverified` → revisar signing key primero.

## Guards (abortan deploy, ver `TEST_PLAN.md`)
T1 `google*.html` existe / T2 `binding ASSETS` / T3 `worker.js` en `.assetsignore`
+ T3b docs internos + `specs/` ignorados / T4 dry-run con `env.ASSETS`
/ T5 health-checks `/` 200, `/manifest.json` 200, `/worker.js` 404, `/no-existo` 404 (nunca 500).

## Reglas que no se repiten (ver detalle)
- No exponer `worker.js` (`404` esperado). No ofuscar email sin pedido explícito (rompió Gmail en Edge, sep-2026).
- Pre-acción fuera del cwd: resolver ruta absoluta + verificar en disco. Nunca asumir subcarpetas.
- Mensajes y contenido en español (`es-AR`). Identificadores de código en inglés.

## Ritual inicio (obligatorio, antes de responder)
1. Leer `Sesiones/Indice Sesiones.md` (última fila = última sesión).
2. Leer la nota de esa última sesión + su sección `## Pendientes`.
3. Si hay pendientes sin tildar, traerlos a la respuesta actual. No afirmar "sin pendientes" sin haber leído.

## Ritual cierre (nota + pendientes en disco, DURANTE la sesión)
- Pegar T1–T5 + T8 (`@graph` en prod) + cero `scriptThrewException` a los 5 min.
- Nota de sesión en disco + `tasklist` sin `opencode` residual. Excepción: `bun serve --http --port 3131` (gbrain compartido) DEBE quedar vivo; si no está, levantarlo con `gbrain serve --http --port 3131`.
