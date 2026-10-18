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
