# SPEC — robot-eyes-v1 — 2026-10-16

> Regla: ningún cambio visual entra sin este spec.
> Vive en `specs/2026-10-16-robot-eyes-v1.md` (ignorado en deploy por `.assetsignore`).
> Flujo: SPEC → prototipo en preview → demo al usuario → port a real → `.\deploy.ps1`.

## Objetivo
Darle mirada viva al robot del hero (parpadeo + micro-giro de cabeza al hover) manteniendo cuello/hombros quietos.

## Alcance
- `assets/hero-robot.webp` (1333×935, plano, ~106 KB): NO se recorta (decisión 16/10: visor negro con reflejos, corte no sale limpio). Parpadeo con **párpados**: tapas color visor (`#04070d`) sobre los ojos horneados, `scaleY 0→1→0` cada ~4.5 s (decisión demo v2: el overlay de brillo no reemplaza los ojos originales, solo suma luz). Sin mirada-follow (los ojos horneados no se pueden mover; descartado).
- `index.html:290` (`.hero-robot-wrapper`, `aria-hidden="true"`): apilar capas con `position: absolute`.
- `css/hero.css:561-602` (wrapper + `heroRobotFloat`): animar solo la capa móvil con `transform` + `@keyframes` (parpadeo cada 4–6 s, micro-giro al hover), bajo `prefers-reduced-motion`, con `pointer-events: none`.
- Revisar regla de oculto `hero.css:747-751` (`≤700px` / `hover: none`): se mantiene salvo que el preview demuestre 60 fps + cero superposición en 375 px.

## No-objetivos
- No mover cuello/hombros. No GSAP/Three.js. No tocar KPIs, botones, badges, System Status, `@graph`, paleta `#020408` + `#0066FF`/`#00D4FF`, ni `worker.js`. No `position: fixed`.

## Prototipo
- Solo en `C:\Users\HP Ryzen 5\OpenCode\portafolio-preview` (`npx serve .`); verificar 1920/1280/768/375 px: sin superposición sobre textos/botones, sin jank, con `prefers-reduced-motion` respetado.

## Checks
- T1 `google*.html` existe. T2 `binding ASSETS`. T3 `worker.js` en `.assetsignore`. T4 dry-run con `env.ASSETS`. T5 health-checks `/` 200, `/manifest.json` 200, `/worker.js` 404, `/no-existo` 404.

## Rollback
- `git revert <sha>` del port + `.\deploy.ps1`; ante duda visual, restaurar `hero-robot.webp` plano y regla de oculto `hero.css:747-751`.
