# AGENTS.md — Portafolio (única fuente)

## Proyecto
Estático HTML/CSS/JS vanilla + `worker.js` (Workers + `binding ASSETS`).
Contenido: proyectos, blog, `data/certificates.json`, SEO JSON-LD.

## Orden
`AGENTS.md > SECURITY.md > TEST_PLAN.md > deploy.ps1 > código`.
`.agents/rules/workflow.md` es puntero a este archivo, no duplica.
Detalle: `TOOLS.md` (herramientas), `SECURITY.md` (dominios), `TEST_PLAN.md` (puerta T1-T10).

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
- Deploy: `.\deploy.ps1 -Message "feat: ..."` (pre-flight: guards T1–T3b + T4 + T9 + dry-run, **sin efectos** + commit firmado + push **de la rama**). **No despliega**: el deploy lo hace el CI al mergear el PR.
- Diagnóstico: `npx --yes wrangler@4.136.3 deploy --dry-run`
- Prohibido: `wrangler deploy` manual (salvo fix documentado), `--force`, instalar deps sin aprobación.

## Git — flujo (único path a producción)
1. `git status` · `git diff` · `git branch`
2. `git switch -c feat/...` (o `fix/...`)
3. Modificar y probar → `.\deploy.ps1 -Check` (guards T1–T3b + T4 + T9 + dry-run; sin efectos)
4. `.\deploy.ps1 -Message "..."` → commit firmado + push **de la rama** (aborta si estás en `main`)
5. `gh pr create` + `gh pr merge --squash` — el ruleset `protect-main` exige PR
6. El CI (`.github/workflows/deploy.yml`) despliega al mergear y valida T5 + T10; después se revisa en producción

- **El deploy a producción lo hace solo el CI.** `deploy.ps1` no despliega y no puede pushear a `main`: es pre-flight + push de rama. Antes había 3 paths (deploy.ps1, CI y Workers Builds) y cada push a `main` desplegaba **3 veces** (medido 20/10: 3 versiones en Cloudflare por push, separadas ~15 s).
- **22/10: `auto_build` de Workers Builds APAGADO y verificado por API** (`auto_build_enabled: false`) → **1 deploy por merge** (solo el CI). Se apagó desde el dashboard (toggle **"Disable builds"**, en Configuración → Compilaciones) porque ni el MCP de Cloudflare (`requires user authorization`) ni el token OAuth de wrangler (`403 code 10000`) tienen escritura de Builds. **Reversible**: volver el toggle a gris. Ojo: el endpoint `GET /accounts/{id}/builds/workers/{script_tag}` exige el **tag id** (`5b39e736…`), no el nombre del Worker — con el nombre devuelve un 404 engañoso.
- Pre-commit: `git status --short` + `git diff --stat` (+ `git check-ignore <archivo>` ante duda).
- Nunca `git add .` en manual; solo archivos intencionales. (`deploy.ps1` hace staging propio y lista lo staged antes de commitear.)
- `main` **sí** está protegida: ruleset `protect-main` (activo desde 20/07/2026) → exige PR, commits firmados, y bloquea borrado y force-push. El owner tiene `bypass_mode: always`, así que un push directo **se acepta** y GitHub lo registra como *"Bypassed rule violations"*: el flujo de arriba evita depender de ese bypass. La firma **no** se saltea (sigue aplicando; `deploy.ps1` hereda `commit.gpgsign=true`).
  - Evidencia 20/10: `gh api repos/Lucas18062025/Portafolio/rulesets/19284894` → `enforcement: active`, `bypass_actors[].bypass_mode: always`. Ojo: `gh api .../branches/main` → `protected: true` (el campo **no** distingue ruleset de branch protection clásico; para eso está `/rulesets`).
  - El 17/10 se documentó lo contrario ("sin branch protection ni rulesets, repo privado"): fue un error de lectura. La API de `/rulesets` daba **403** *"Upgrade to GitHub Pro or make this repository public to enable this feature"* porque el repo estaba **privado** en plan Free (los rulesets son gratis solo en repos públicos). El repo es **público** desde su creación (12/02/2026). No volver a concluir "no existe" a partir de un 403: leer el mensaje.
- Firmados `gpg.format=ssh`. Si `Unverified` → revisar signing key primero.

## Guards (una sola implementación: `scripts/guards.mjs`)
La usan los tres: `deploy.ps1 -Check` (local), `ci.yml` (gate del PR) y `deploy.yml` (pre-deploy). Así no hay drift entre lo que se valida localmente y lo que valida el CI.
T1 `google*.html` existe / T2 `binding ASSETS` / T3 `worker.js` en `.assetsignore`
+ T3b docs internos + `specs/` ignorados / T4 dry-run con `env.ASSETS` / T9 cache-bust `?v=N` de CSS/JS
/ T5 health-checks `/` 200, `/manifest.json` **404** (el sitio no es una PWA), `/worker.js` 404, `/no-existo` 404 (nunca 500), `/blog/visual-field-notes/` 200 + 2 assets del kit Flow (1 WebP y 1 MP4) 200 (7 checks)
+ T10 colector CSP: 3 content-types aceptados (204), `text/plain` 415, shape inválido 400, body > 8 KB 413, `GET` 405 con `Allow: POST`, `Reporting-Endpoints` con URL absoluta (8 checks).

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
