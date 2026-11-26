# SPEC — robot-hero-izquierda — 2026-11-25

> Vive en `specs/2026-11-25-robot-hero-izquierda.md` (ignorado en deploy por `.assetsignore`).

## Objetivo
Mover el robot del hero (`.hero-robot-wrapper`) al **lado izquierdo** del header,
alineado con el borde del contenido, en la banda libre entre los CTAs y la franja
de credenciales. No debe quedar pegado a la esquina ni pisar textos, botones,
badges, el panel System Status ni el widget de chat.

## Decisiones (medidas en navegador, no estimadas)
- **Anclaje**: `bottom: 60px` (16-18 px sobre la franja de credenciales, que mide
  45 px) y `left: max(20px, calc(50% - 590px))` para alinear con el borde
  izquierdo de `.hero-container` (1180 px) en cualquier ancho.
- **Escala**: `clamp(110px, 12vh, 190px)`. En pantallas altas
  (`min-height: 1050px`) sube a `clamp(135px, 14vh, 200px)` porque sobra banda
  (medido: 154 px de alto a 1098 px de viewport).
- **Hero**: padding `96px 20px 180px` (antes `120px 20px 118px`). El padding
  inferior extra crea la banda para el robot; el superior compensa para que el
  contenido no quede tan abajo. A 1440x900 el robot entra completo (1 px de
  margen) sin empujar la franja de credenciales fuera de su posición histórica.
- **Franja de credenciales en 2 filas** (<=1099 px de ancho, 84 px de alto):
  el robot sube a `bottom: 100px` y baja a 70 px para no pisarla.
- **<=900 px**: se mantiene el comportamiento previo (derecha, `bottom: 0`).
  El hero apilado no tiene banda libre a la izquierda. `<=600 px`: robot
  estático centrado, como ya estaba.
- **Parpadeo**: el parche `.hero-robot-blink` pasa a `object-position: bottom left`
  (mismas reglas que el asset base) para no desregistrarse.

## Alcance
- `css/hero.css`: posicionamiento, escala, media queries y comentarios.
- `index.html`: `hero.css?v=13` -> `?v=14` (T9) y `sizes` del robot (280 px).
- `VERSION` 1.1.0 -> 1.1.1 + `scripts/stamp-version.mjs` (T11, 7 páginas).

## No-objetivos
- No se toca el asset, el parpadeo, el flotado ni el HTML del robot.
- No se toca la paleta, el copy, los CTAs ni el panel System Status.
- No se rediseña el hero ni se reordena el contenido.

## Verificación
- Medido sin solapamientos contra CTAs, credenciales, card y copy en
  1376x1098, 1920x1080, 1440x900, 1100x800, 1024x768, 901x800, 800x1000 y
  390x844 (scrollWidth = clientWidth en todos).
- `.\deploy.ps1 -Check` (T1-T3b, T4, T9, T11, T12) + T5/T10 del CI.

## Rollback
- `git revert <sha>` del merge y dejar que el CI despliegue. No hay migración de
  datos ni cambio de infraestructura.
