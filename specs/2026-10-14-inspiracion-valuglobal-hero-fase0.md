# SPEC — inspiracion-valuglobal-hero-fase0 — 2026-10-14

## Objetivo
Adaptar a nuestro portafolio elementos de inspiración de valuglobal.consulting: hero pantalla completa, propuesta de valor orientada a resultado, jerarquía de CTAs, sellos de confianza en primer pliegue y email directo + privacidad en footer.

## Alcance
- `css/hero.css`: `.hero` min-height 100vh + centrado; ajuste padding/canvas.
- `index.html`: hero copy (`.hero-roles`, `.hero-description`), CTAs con clases primario/secundario, barra trust & credentials, footer email + link privacidad/cookies.
- No se agregan rutas nuevas ni se toca `worker.js`.

## No-objetivos
- No cambiar paleta (`#020408` + `#0066FF`/`#00D4FF`).
- No hacer bilingüe completo, ni testimonios, ni lead magnet PDF en esta fase.
- No refactor de `worker.js`, no nuevas dependencias.

## Prototipo
- Aplicar en preview `C:\Users\HP Ryzen 5\OpenCode\portafolio-preview` y verificar con `npx serve .` en 360/768/1440.
- Portar al repo real una vez validado.

## Checks
- T1 `google*.html` existe; T2 `binding ASSETS`; T3 `worker.js` en `.assetsignore`.
- T4 dry-run `wrangler@4.136.3 deploy --dry-run` sin errores.
- T5 health-checks en preview/prod: `/` 200, `/manifest.json` 200, `/worker.js` 404, `/no-existo` 404 (nunca 500).
- T8 `@graph` intacto en prod tras deploy.

## Rollback
- `git revert <sha>` del commit y re-deploy anterior.