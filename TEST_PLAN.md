# TEST_PLAN.md — Portafolio

## Gates (una sola implementación: `scripts/guards.mjs` + `scripts/health-checks.mjs`)
| # | Check | Dónde corre | Esperado |
|---|-------|-------------|----------|
| T1 | `google*.html` existe | guards | aborta si falta |
| T2 | `wrangler.jsonc` tiene `"binding": "ASSETS"` | guards | aborta si falta |
| T3 | `.assetsignore` contiene `^worker\.js$` | guards | aborta si falta |
| T3b | `.assetsignore` contiene `AGENTS.md`, `SECURITY.md`, `TEST_PLAN.md`, `TOOLS.md`, `specs` + `specs/**` | guards | aborta si falta |
| T4 | `dry-run` contiene `env.ASSETS` | guards (local + pre-deploy del CI) | aborta si falta |
| T5 | `GET /` → 200, `/manifest.json` → 200, `/worker.js` → 404, `/no-existo` → 404 (nunca 500) · `/blog/visual-field-notes/` → 200 + 2 assets del kit (1 WebP y 1 MP4) → 200 | health-checks (post-deploy) | aborta si falla |
| T9 | **Cache-bust de CSS/JS**: si `css/*.css` o `js/*.js` cambiaron, el `?v=N` de su referencia en el HTML debe haber cambiado también | guards | aborta si falla |
| T10 | **Colector CSP**: `POST /api/csp-report` acepta `application/csp-report` (204), `application/reports+json` (204), `application/json` (204); rechaza `text/plain` (415), shape inválido (400), body > 8 KB (413); `GET` → 405 con `Allow: POST`; `/` trae `Reporting-Endpoints` con URL absoluta | health-checks (post-deploy) | aborta si falla |

**Quién corre qué** (20/10: la implementación es una sola, para que no haya drift):
- `scripts/guards.mjs` → T1, T2, T3, T3b, T9 (+ T4 con `--dry-run`).
  Consumidores: `deploy.ps1 -Check` (local, antes del PR) · `ci.yml` (gate del PR, sin T4) · `deploy.yml` (pre-deploy, con T4).
- `scripts/health-checks.mjs` → T5 + T10. Consumidor: `deploy.yml` (post-deploy). `deploy.ps1` ya no despliega, así que no los corre.
- `scripts/verify-csp.js` → valida la CSP del `_headers`. Consumidor: `ci.yml`.

## Flujo del deploy (único path a producción)
Rama → `deploy.ps1 -Check` → `deploy.ps1 -Message` (commit + push de la rama) → PR → merge → **el CI despliega y valida T5 + T10**.
Antes había 3 paths de deploy (deploy.ps1, CI y Workers Builds) y cada push a `main` desplegaba 3 veces.

### T10 — Por qué existe (bug real del 19-20/10)
El endpoint `/api/csp-report` aceptaba **solo** `application/json`, que **ningún
navegador manda**: Firefox/Safari envían `application/csp-report` (`report-uri`) y
Chrome 96+/Edge envían `application/reports+json` (Reporting API v1). Todos esos
POSTs caían en **415** → el colector era un sensor apagado y "no había violaciones"
era una conclusión falsa.

Además `_headers` usaba solo `Report-To` (v0, deprecado en MDN) con URL **relativa**,
y Chrome moderno lee `Reporting-Endpoints` (v1) que exige URL **absoluta**.

Los dos shapes son distintos y ambos válidos:
- **L2** (`report-uri`): objeto → `{"csp-report": { ... }}`
- **v1** (`Reporting-Endpoints`): **array** → `[{ "type": "...", "body": { ... } }]`

Por eso la validación acepta `application/json` con cualquiera de los dos shapes.
`node scripts/verify-csp.js` (gate del CI) exige que `Reporting-Endpoints` exista,
que su URL sea absoluta y que el nombre coincida con el grupo de `report-to`.

### T9 — Por qué existe (bug real del 20/10)
El CDN de Cloudflare **ignora el query string en la clave de caché**. Los CSS se sirven
con `Cache-Control: public, max-age=3600` y `index.html` los pide como `hero.css?v=12`.
Si se cambia el contenido de `hero.css` **sin bumpear el `?v=N`**, el deploy sube el
archivo nuevo pero el edge y el navegador siguen sirviendo la versión vieja: **el
cambio no llega a producción** y no hay ningún error visible (los health-checks dan 200).

Caso real (20/10): se ajustó la cadencia del parpadeo del robot de 5,2 s a 2,2 s,
el deploy fue "verde" y T5 pasó, pero el navegador seguía midiendo 5,2 s. El fix fue
bump de `hero.css?v=11` → `?v=12`.

**Regla**: todo cambio de contenido en `css/*.css` o `js/*.js` → bumpear el `?v=N`
correspondiente en el HTML que lo referencia.
Los assets binarios son otro caso: para cambiar uno hay que **cambiar el nombre**
(el CDN no revalida con el mismo nombre bajo `immutable`, ver "No-objetivos verificados").

## Gates del CI (GitHub Actions, no están en `deploy.ps1`)
- `ci.yml` (en PR y push a `main`) → `node scripts/verify-csp.js`: valida la CSP del `_headers`.
- `deploy.yml` (push a `main`) → T5 (7 checks) después del deploy.

## Validación SEO (manual, post-deploy)
- T6 Rich Results: `/` → ProfilePage · `/blog/` → Blog + BreadcrumbList · `/blog/visual-field-notes/` → BlogPosting + BreadcrumbList. 0 errores.
- T7 Search Console: `URL está en Google` + indexada + HTTPS OK.
- T8 `curl` prod: `/` devuelve `@graph` (ProfilePage + Person + WebSite); cada página de blog devuelve su propio `@type`.

## No-objetivos verificados
- `Range`/`206`: Workers Assets no lo soporta (probado 17/10: siempre 200 con el cuerpo completo, sin `Accept-Ranges`). No esperar respuestas parciales en MP4/WebP.
- **Reemplazar un asset con el mismo nombre no se refleja** (probado 17/10): los assets se sirven con `Cache-Control: public, max-age=31536000, immutable` y el CDN **ignora el query string** en la clave de caché (`...webp?v=2` → `CF-Cache-Status: HIT`, mismo cuerpo). Cambiar el contenido de un archivo existente deja la versión vieja cacheada en el edge y en el navegador. Para cambiar una imagen: **nombre nuevo** + borrar el viejo (`v2`, ver `index.html` de la card Security Audit Checker).
- **FontAwesome se sirve recortado, no completo** (17/10): el sitio usa 33 glifos, así que carga `assets/vendor/fontawesome/css/fa-subset-33.css` (2,2 KB) + `fa-{solid,brands}-subset-33.woff2` (2,8 + 3,4 KB) en lugar del paquete completo (360 KB). Se regenera con `python scripts/media/fontawesome-subset.py` (requiere `fonttools` + `brotli`). **Al agregar un ícono**: usar la clase en el HTML/JS/JSON, correr el script (sube el número de glifos → el nombre cambia: `-34`, o sea caché limpia por ser nombre nuevo) y actualizar el `<link>` de `index.html`. Nunca reemplazar el CSS/fuente con el mismo nombre (caché `immutable`).
- **`_headers` matchea por ruta exacta, no hay bloque `/assets/*` genérico** (probado 17/10 y 17/10bis): un archivo nuevo bajo `assets/` **sin regla propia** sale con `Cache-Control: public, max-age=0, must-revalidate` y se **revalida en cada visita**. Le pasó a `/assets/hero-robot.webp` (el recurso más pesado del hero) durante semanas sin que nada lo delatara: los health-checks dan 200 igual. Al agregar un asset nuevo, **agregar su regla** (`immutable` si el nombre es versionado, `86400` si se reescribe) y verificarla con `curl -sI`.

- **La prioridad de una imagen se mide, no se supone** (medido 17/10 sobre `/`, prioridad real de `net::` en el netlog de Chrome, escritorio y celular): `loading="lazy"` y `loading="eager"` **sin** `fetchpriority` dan **`LOW`**; `loading="eager"` + `fetchpriority="high"` da **`MEDIUM`** (Chrome techa en `MEDIUM` las imágenes fuera del viewport). Ese `MEDIUM` es la **misma** prioridad que el robot del hero, que no se mueve: el hint de la foto **no le quita el LCP**. Regla: la foto de perfil (`#about`) va `loading="eager" fetchpriority="high"`; para bajar peso del camino crítico se recorta el **archivo** (nombre nuevo), nunca la prioridad de una imagen que el usuario ve al llegar a la sección.

## Criterio de finalización
- T1–T5 en verde en output de `deploy.ps1` (**T5 = 7 checks**) + T8 + cero `scriptThrewException` en 5 min.
