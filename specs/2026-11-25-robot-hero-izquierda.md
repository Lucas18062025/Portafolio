# SPEC — robot-hero-izquierda — 2026-11-25

> Vive en `specs/2026-11-25-robot-hero-izquierda.md` (ignorado en deploy por `.assetsignore`).
>
> Iteracion 2. La 1 (PR #71) dejaba al robot flotando 60px sobre el borde, con
> 154px de alto. El pedido real es **la misma linea que antes** (pies apoyados
> en el borde inferior del hero) pero **del lado izquierdo**.

## Objetivo
Mover el robot del hero (`.hero-robot-wrapper`) al **lado izquierdo**, alineado
con el borde del contenido, apoyando los pies en el borde inferior del hero
—igual que estaba cuando vivia abajo a la derecha— sin pisar CTAs, copy, KPIs,
panel System Status ni la franja de credenciales.

## Decisiones (medidas en navegador, no estimadas)
- **Anclaje**: `bottom: 0` (misma linea de base que antes) y
  `left: max(20px, calc(50% - 590px))`, que alinea con `.hero-container`
  (1180px) en cualquier ancho.
- **Escala**: `--robot-h: clamp(100px, calc(60vh - 445px), 250px)`. La banda
  libre entre los CTAs y el borde inferior mide ~110px a 768px de viewport y
  ~253px a 1098px; la formula deja 10-40px de aire bajo los botones en todo el
  rango (100px abajo, 214px a 1376x1098, 203px a 1920x1080).
- **Hero**: `padding: 96px 20px clamp(110px, calc(100vh - 800px), 180px)`. El
  padding inferior crea la banda del robot y se achica en viewports bajos: con
  180px fijos el hero medía 961px a 900px de alto y el robot quedaba cortado
  por el pliegue.
- **Franja de credenciales**: su contenido arranca despues del robot con
  `padding-left: calc(var(--robot-h) * 1.426 + 24px)` (1.426 = aspecto del
  asset 720x505). Consecuencia medida: en desktop la franja pasa de 1 a 2
  filas (45px -> 84px) porque su contenido mide 1020px y la franja 1180px;
  solo un robot de <=136px de ancho (95px de alto) la dejaria en una fila.
- **<=900px**: el robot vuelve abajo a la derecha y la franja recupera
  `padding-left: 0`; el hero apilado no tiene banda libre a la izquierda.
  **<=600px**: robot estatico centrado, como ya estaba.
- **Parpadeo**: el parche `.hero-robot-blink` pasa a `object-position: bottom left`
  (mismas reglas que el asset base) para no desregistrarse.

## Alcance
- `css/hero.css`: padding del hero, `--robot-h`, anclaje, franja y responsive.
- `index.html`: `hero.css?v=14` -> `?v=15` (T9) y `sizes` del robot (340px).
- `VERSION` 1.1.1 -> 1.1.2 + `scripts/stamp-version.mjs` (T11, 7 paginas).

## No-objetivos
- No se toca el asset, el parpadeo, el flotado ni el HTML del robot.
- No se toca la paleta, el copy, los CTAs ni el panel System Status.
- No se rediseña el hero ni se reordena el contenido.

## Verificacion
- Medido sin solapamientos contra CTAs y contra cada item de la franja en
  1376x1098, 1920x1080, 1600x900, 1440x900, 1366x768, 1280x800, 1100x800,
  901x800, 1024x768 y 390x844; `scrollWidth == clientWidth` en todos.
- `.\deploy.ps1 -Check` (T1-T3b, T4, T9, T11, T12) + T5/T10 del CI.

## Rollback
- `git revert <sha>` del merge y dejar que el CI despliegue. No hay migracion de
  datos ni cambio de infraestructura.
