# SPEC — performance-assets-p0-p1-p2 — 2026-10-17

> Regla: ningún cambio grande entra a preview sin este spec de 15 líneas.
> Vive en `specs/YYYY-MM-DD-slug.md` (ignorado en deploy) o como Acta Obsidian si es solo decisión.
> Flujo: SPEC → prototipo en preview → demo al usuario → port a real → `.\deploy.ps1`.
> **Excepción 17/10:** el usuario pidió aplicar directo en el real (preview desincronizado),
> con medición antes/después en producción como verificación sustituta del prototipo.

## Objetivo

Bajar el primer load de `/` de **1.230.844 B (1,2 MB, 31 pedidos)** a ~0,6 MB sin pérdida
visual medible (SSIM/PSNR), priorizando el LCP y sacando revalidaciones innecesarias.

## Medición base (netlog real de Edge, 1440×900, virtual time 2,5 s y 10 s = mismo set)

| Bloque | Peso | Problema |
|---|---:|---|
| FontAwesome (`all.min.css` + `fa-solid` + `fa-brands`) | 281.287 B (23 %) | 258 KB de fuente para **33 glifos** |
| Logos de certificados (6 webp) | 338.968 B (28 %) | 1320×1020 servidos para render de **160 px de alto** |
| `hero-robot.webp` | 106.060 B | 1333×935 servidos para **≤340 px CSS** |
| Fuentes Google (3 woff2 latin + CSS) | 103.066 B | 3 orígenes externos + CSS bloqueante |
| Portadas de proyectos (9 @640) | ~218 KB | ya versionadas y razonables |

Hallazgos no-weight:

- `_headers` **no** tiene regla para `/assets/hero-robot.webp` → sale `max-age=0, must-revalidate`
  y **se revalida en cada visita** (es el recurso del LCP).
- `Foto_Perfil` está `loading="eager" fetchpriority="high"` **estando bajo el pliegue** →
  compite con el LCP. El hero no tiene `fetchpriority` ni preload.
- Los logos de certificados tienen `loading="lazy"`, pero Chrome los baja igual
  (umbral de lazy generoso en conexión rápida) → hay que achicar el archivo.

## Alcance

- **P0a** `assets/hero-robot-v2-{360,720}.{webp,avif}` nuevos (AVIF q60 + WebP q80) +
  `<picture>` con `srcset`/`sizes` + `fetchpriority="high"` + `decoding="async"` en `index.html#hero`.
- **P0b** `_headers`: reglas `immutable` para `/assets/hero-robot-v2-*.{webp,avif}`.
- **P0c** `Foto_Perfil*` a `loading="lazy"` (sacar `eager` + `fetchpriority`).
- **P1** FontAwesome: subset de los **33 glifos** usados (`fa-solid` + `fa-brands`) + CSS
  recortado a esas 33 reglas. Mismo markup, mismas clases → cero cambios de HTML.
- **P2** Logos de certificados a **640 px de ancho** (`*-640.webp`): `index.html` (6 `<img>`) +
  `data/certificates.json` (6 `preview`).

## No-objetivos

- No se toca paleta, `worker.js`, `binding ASSETS`, CSP ni `deploy.ps1`.
- No se cambia el formato de las portadas de proyectos ni de los clips del blog (van en otra pasada).
- No se auto-hospedan las fuentes de Google en esta pasada.
- No se borra el bloque `/assets/*` genérico ausente en `_headers` (es a propósito).

## Verificación (reemplaza al prototipo, por pedido del usuario)

1. Local: render con Edge headless 1440 y 375; screenshot del hero y de una card de certificado.
2. SSIM/PSNR de cada derivado contra su fuente (Pillow + numpy, ya medido en el sweep).
3. Pre-deploy: `git status --short` + `git diff --stat` + `npx wrangler deploy --dry-run`.
4. Deploy: `.\deploy.ps1 -Message "..."` → T1–T5 + T8.
5. Post-deploy: **netlog de Edge otra vez** (bytes reales del primer load) + health-checks + logs 5 min.
6. Rollback: `git revert <sha>` + `.\deploy.ps1`.

## Rollback

`git revert <sha>` del commit de assets/HTML + `.\deploy.ps1 -Message "revert: ..."`.
Los archivos viejos viven en git, no hace falta regenerar nada.

---

## Resultado medido (17/10, producción)

Mismo método antes y después: netlog de Edge headless (`--window-size=1440,900`,
`--virtual-time-budget=6000`, DPR 1) + peso real de cada pedido con `Accept-Encoding: br`.

| | antes | después | Δ |
|---|---:|---:|---:|
| **Primer load de `/`** | **1.230.844 B (1.202 KB)** | **649.127 B (634 KB)** | **−47,2 %** |
| FontAwesome | 281.287 B | 6.981 B | −274.306 B |
| Hero robot | 106.060 B | 12.342 B | −93.718 B |
| Logos de certificados | 338.968 B | 127.576 B | −211.392 B |

P0a: `assets/hero-robot-v2-{360,720}.{webp,avif}` (RGBA, AVIF q60 + WebP q80),
`<picture>` con `srcset`/`sizes` y `fetchpriority="high"`. SSIM 0,98 sobre la zona
visible (alfa > 0), error de alfa 0,07/255.
**Ojo:** el original es RGBA con fondo transparente; convertir a RGB mete una caja
clara en el hero. El `<img>` de Foto_Perfil pasó a `loading="lazy"` (estaba bajo el
pliegue con `fetchpriority="high"`, compitiendo con el LCP).
Sin `<link rel="preload">` a propósito: el wrapper es `display:none` ≤600 px y un
preload dispararía la descarga en móvil igual.

P0b: `_headers` no tenía regla para el hero → `max-age=0, must-revalidate`
(el LCP se revalidaba en cada visita). Ahora los 4 archivos v2 son `immutable`.

P1: `scripts/media/fontawesome-subset.py` detecta los 33 glifos usados (18 solid +
15 brands), recorta las dos fuentes con `fontTools.subset` y genera
`assets/vendor/fontawesome/css/fa-subset-33.css` (2.222 B) + `fa-{solid,brands}-subset-33.woff2`
(2.800 + 3.448 B). **360.169 B → 8.494 B.** El paquete original queda en el repo como
fuente, pero el sitio ya no lo carga.
Verificación: render A/B de los 33 íconos servido por HTTP, CSS+fuente original contra
CSS+fuente recortada → **0 píxeles de diferencia** (486.400 comparados). Cada par
(familia, ícono) se chequeó contra la cmap del subset: 0 glifos perdidos.
Trampa: un probe por `file://` no carga las fuentes y da cajas vacías en ambas
versiones (falso positivo de "diferencias"); servir siempre por HTTP.
El nombre lleva la cantidad de glifos como versión (`-33`): `/assets/vendor/*` es
`immutable` y el CDN ignora el query string, así que agregar un ícono exige
regenerar (nombre nuevo) y actualizar el `<link>`.

P2: `assets/certificates/*-640.webp` (eran 1320×1020 servidos a 160 px de alto),
referenciados desde `index.html` (6 `<img>`) y `data/certificates.json` (6 `preview`).

Pendiente (no ejecutado): fuentes de Google self-host/subset (~103 KB), `icon-192.png`
PNG → WebP (~58 KB), `og-portfolio.webp` (~57 KB), portadas de proyectos con AVIF,
clips del blog a 960 (5,8 MB → ~3,5 MB), y los 14 íconos externos de
skillicons/simpleicons (terceros).
