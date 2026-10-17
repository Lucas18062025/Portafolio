# SPEC — flow-media-security-research — 2026-10-17

> Regla: ningún cambio grande entra a preview sin este spec de 15 líneas.
> Vive en `specs/YYYY-MM-DD-slug.md` (ignorado en deploy).
> Flujo: SPEC → prototipo en preview → demo al usuario → port a real → `.\deploy.ps1`.

## Objetivo
Incorporar a la sección de investigación (`/blog/`) el kit visual generado con Google Flow
(5 clips de 8 s + 9 imágenes 2K), como pieza nueva con captions analíticos y como portadas,
sin romper performance, accesibilidad ni SEO.

## Alcance
- Nuevo: `blog/visual-field-notes/index.html`, `css/blog-media.css`,
  `assets/blog/flow/*` (WebP 1280/640/og + MP4 recomp rimido + posters), `scripts/media/optimize_flow_media.py`.
- Edita: `blog/index.html` (card nueva + portada local del card "Herramientas de Análisis de Malware",
  hoy hotlink a `raw.githubusercontent.com`), `sitemap.xml` (alta de la URL nueva).
- Fuente (NO versionada): `C:\Users\HP Ryzen 5\OneDrive\Pictures\Redes Sociales Videos` (14 crudos, 48,7 MB).

## No-objetivos
- Paleta, `worker.js`, CSP/`_headers`, `wrangler.jsonc`, deploy manual `wrangler deploy`.
- No se versionan los crudos. No se toca el WIP de preview `blog/investigacion-hacking-ofensivo/`.
- No se tocan los 4 artículos existentes en esta pasada (figuras inline quedan para v2).

## Prototipo
`C:\Users\HP Ryzen 5\OpenCode\portafolio-preview` → `npx serve .` → `/blog/` y `/blog/visual-field-notes/`.
Verificar en 360 y 1440. Los clips NO autoplay con `prefers-reduced-motion` ni `saveData`.

## Checks
- T1–T5 (automáticos en `deploy.ps1`) + T8 (`@graph` en producción).
- T9 Range/206: `curl.exe -r 0-1023 -I https://.../assets/blog/flow/<slug>.mp4`.
- T10 presupuesto de pesos (medido 17/10): imagen 1280 ≤ 186 KB · 640 ≤ 65 KB ·
  og 1200×630 ≤ 165 KB · poster ≤ 136 KB · clip ≤ 1,41 MB · total 9,01 MB en 42 archivos
  (crudos: 48,7 MB → −81 %). Los clips se descargan recién al entrar en viewport.
- T11 LCP móvil ≤ 2,5 s + cero `scriptThrewException` a los 5 min.
- T12 Rich Results de la página nueva sin errores (`BlogPosting` + `ImageObject`/`VideoObject`).
- T13 geometría: `document.scrollWidth == innerWidth` en 1440 y en móvil (sin desborde).

## Rollback
`git revert <sha>` + re-deploy del commit anterior; borrar `assets/blog/flow/*` si hiciera falta.
Los crudos quedan intactos en OneDrive. `ffmpeg`: `winget uninstall Gyan.FFmpeg`.
