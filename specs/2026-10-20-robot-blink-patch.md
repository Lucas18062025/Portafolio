# SPEC — robot-blink-patch — 2026-10-20

> Regla: ningún cambio visual entra sin este spec.
> Vive en `specs/2026-10-20-robot-blink-patch.md` (ignorado en deploy por `.assetsignore`).
> Flujo: SPEC → prototipo en preview → demo al usuario → port a real → `.\deploy.ps1`.

## Objetivo
Que el robot del hero parpadee de verdad, tomando el blink del MP4 original
(`robot-pestañeando.mp4`), sin engordar el asset del hero.

## Diagnóstico previo (medido, no supuesto)
- `assets/hero-robot-v2-720.webp` (720×505) y su `.avif` son el robot **estático** de hoy:
  no parpadea. En `HEAD` (`ecafeca`) no existe ninguna regla de parpadeo en `css/hero.css`
  ni ninguna capa extra en `index.html`. El parche de ojos apagados que se Removes en
  `583d78e` (revertido) fue **nunca comiteado** y por eso hoy no hay blink en producción.
- La herramienta anterior comprimió el MP4 completo a WebP de 1,1 MB y lo puso como
  `<img>` dentro de una caja de 240×96: relación de aspecto rota, fondo gris horneado
  y 30× el peso del asset actual. De ahí el resultado incorrecto.
- El robot del MP4 y el del sitio son **el mismo render**: registering el MP4 contra
  `hero-robot-v2-720.webp` da error de color 7,4/255 y **desvío de los LEDs de 0,7 px**
  tras refinar. El PNG maestro `robot_transparent.png` (1333×935) es la fuente de
  `hero-robot-v2-720.webp` (error 3,3/255).
- El blink real: el LED cae de luminancia 72 a 7 en frames **22–29**, **82–87** y
  **163–168** del MP4 gris. Duración 250–333 ms.

## Decisión: parche, no video
Medido sobre los 3 candidatos:

| Opción | Peso | Nota |
|---|---|---|
| Video completo, 192 frames | **5.937 KB** | x30 visitas = 174 MB |
| Video completo, 16 frames | **502 KB** | sin AVIF, rompe el peso del hero |
| **Parche de ojos apagados (WebP)** | **2,4 KB** | + base 34,6 KB = 37 KB |

Elegido: **parche estático de 2,4 KB** superpuesto sobre el asset actual.

## Alcance
- `assets/hero-robot-blink-720.webp`: canvas **720×505** (mismo aspecto que el asset base)
  con la zona del visor y los **ojos apagados**, tomado del frame 84 del MP4
  (LED apagado real, luminancia 6,3), con alfa feather radial. WebP q80 → **2,6 KB**.
- `scripts/media/robot_blink_patch.py`: generador reproducible (registro + parche).
- `index.html`: una capa `<img class="hero-robot-blink">` dentro de `.hero-robot-wrapper`,
  sobre el `<picture>` del robot.
- `css/hero.css`: `.hero-robot-blink` absoluto con las **mismas** reglas de `object-fit`
  que el asset base, y `@keyframes robotBlink` animando solo `opacity`.

## No-objetivos
- No tocar `hero-robot-v2-*.webp` / `.avif` (el asset base, su peso y su LCP).
- No cambiar paleta `#020408` + `#0066FF`/`#00D4FF`, ni KPIs, botones, System Status,
  `@graph`, ni `worker.js`. No `position: fixed`. No librerías externas.
- No tocar el resto del sitio.

## Por qué canvas completo y no un parche posicionado con %
El asset base se renderiza con `object-fit: contain` + `object-position: bottom right`
+ `max-width`. Cuando el `max-width` recorta, el contenido se **letraboxea** y se desplaza
dentro de la caja del elemento: un parche posicionado con porcentajes sobre la caja del
elemento se desregistra en esos viewports.
Con un canvas del **mismo aspecto** (720×505) y las **mismas** reglas de `object-fit`,
el contenido se renderiza en el mismo lugar **automáticamente** en cualquier viewport.
Verificado: cajas idénticas (base == parche) en 1920 / 1440 / 1200 / 1024 / 900 / 768 px.

## Geometría (medida, no estimada)
Registro del MP4 contra el asset base: crop `x0=127`, `1026×720`, resize a 720×505.
- Error de color: **4,24/255** (pixeles opacos).
- Desvío de los LEDs: **0,5 px** (los 2 LEDs usados como puntos de control).
- LEDs: izq (300,3 / 158,3), der (434,9 / 157,7) en espacio 720×505.
- Caja del parche: x 262→469, y 121→193 (207×72) → embedded en el canvas 720×505.

## Animación
- Ciclo de **2,2 s** (`--blink-cycle`, `robotBlink`, `linear`, `infinite`).
  Medido en producción con el ciclo anterior de 5,2 s: gap real entre parpadeos
  **5.179 ms** (no 3 s), ventana visible 249 ms. 2,2 s es más natural (el ojo
  humano parpadea cada 2–5 s) y más perceptible.
- Rampa: apagado 110 ms → sostenido 44 ms → encendido 110 ms. El parche tiene el
  LED apagado, así que `opacity: 1` = ojos apagados.
- La ventana visible es ~12% del ciclo: a 2,2 s son ~264 ms (la duración real del
  blink en el MP4 es 250–333 ms). Si se cambia `--blink-cycle`, la ventana escala
  con él (a 1,5 s → ~180 ms; a 3 s → ~360 ms).
- Solo `opacity` (compositor): no toca layout, ni el flotado, ni el LCP.
- Bajo `prefers-reduced-motion: no-preference` únicamente. Con `reduce`:
  `animation-name: none` y `opacity: 0` → ojos siempre encendidos, sin animación.
  **Verificado en navegador**: `reduce` → `animationName: "none"`, `opacity: "0"`.

## Fuente de medios
- `docs/media-source/robot-blink-source.mp4` (1.198.516 B) y
  `docs/media-source/robot-transparent-master.png` (1.157.036 B) versionados en git.
- `docs/**` está en `.assetsignore` → **no se deploya**, pero queda en el repo.
- `scripts/media/robot_blink_patch.py` corre sin argumentos y regenera el parche
  desde esas fuentes. Reproducibilidad verificada: el archivo regenerado tiene las
  mismas dimensiones (720×505 RGBA) y difiere en 9 píxeles de 363.600
  (delta máx 13/255, alfa idéntico) — el encoder WebP no es determinista byte a byte.

## Verificación (navegador real, Playwright + msedge, preview en :8899)
| Check | Resultado |
|---|---|
| Cajas base == parche | 6/6 viewports (1920/1440/1200/1024/900/768) ✅ |
| Parche cargado | `naturalWidth 720x505`, `complete: true` ✅ |
| Captura parche OFF vs ON | 382 px cambian, delta medio 57,9/255, solo en la zona de los ojos ✅ |
| Ventana visible por ciclo | 229 ms medidos (3564→3771 ms) ✅ |
| `prefers-reduced-motion: reduce` | `animationName: none`, `opacity: 0` ✅ |
| 390 px | oculto (regla preexistente del sitio, sin cambio) ✅ |
| Peso | base 34,6 KB + parche 2,6 KB = **37,2 KB** (antes 34,6 KB) |

## Checks
- T1 `google*.html` existe. T2 `binding ASSETS`. T3 `worker.js` en `.assetsignore`.
  T4 dry-run con `env.ASSETS`. T5 health-checks `/` 200, `/manifest.json` 200,
  `/worker.js` 404, `/no-existo` 404.
- Verificación visual: captura del hero con ojos encendidos y con ojos apagados,
  y el parche alineado sin halo ni desregistro.

## Rollback
- `git revert <sha>` del port + `.\deploy.ps1`.
- El asset base nunca se toca, así que el rollback es limpio: solo desaparece la
  capa del parche.
