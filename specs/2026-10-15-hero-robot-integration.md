# SPEC — hero-robot-integration — 2026-10-15

> Regla: ningún cambio visual entra sin este spec.
> Vive en `specs/2026-10-15-hero-robot-integration.md` (ignorado en deploy por `.assetsignore`).

## Objetivo
Integrar el robot de IA / centinela de seguridad en la esquina inferior izquierda de la Hero Section, respetando la estética HUD de ciberseguridad, paleta cian/azul/negro, sin competir con el contenido ni bloquear elementos interactivos.

## Alcance
- `assets/hero-robot.webp`: recurso optimizado con fondo transparente (WebP ~106 KB).
- `index.html`: contenedor semántico `.hero-robot-wrapper` dentro de `<header class="hero">` con `aria-hidden="true"`.
- `css/hero.css`: estilos aislados, posicionamiento absoluto respecto a `.hero`, resplandor cian sutil (`rgba(0, 212, 255, 0.18)`), `pointer-events: none` y reglas responsive (desktop / tablet / mobile).

## No-objetivos
- No modificar el contenido, botones, métricas (KPIs), credenciales ni panel System Status.
- No alterar paleta `#020408` + `#0066FF` / `#00D4FF`.
- No usar `position: fixed`.
- No agregar librerías externas ni scripts JS.
- No realizar deploys automáticos sin autorización.

## Prototipo y verificación
- Validar visualmente en navegador en resoluciones 1920px (desktop amplio), 1280px (laptop), 768px (tablet) y 375px (móvil).
- Verificar ausencia de superposición sobre textos, botones o badges.

## Checks
- T1 `google*.html` existe.
- T2 `binding ASSETS` en `wrangler.jsonc`.
- T3 `worker.js` en `.assetsignore`.
- T4 dry-run con Wrangler.
- T5 health-checks 200/404 sin errores.

## Rollback
- Revertir cambios en `index.html` y `css/hero.css`, y eliminar `assets/hero-robot.webp`.
