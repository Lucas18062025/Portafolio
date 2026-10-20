# Fuentes de medios

Assets **maestros** (no optimizados para web) de los que derivan los archivos que
sí se sirven en producción. Están versionados en git para que el pipeline sea
reproducible, pero **no se deployan**: `docs/**` está en `.assetsignore`.

Este directorio guarda dos fuentes:

1. **Los medios del robot del hero** (abajo).
2. **La fuente de FontAwesome** (`fontawesome/`), que antes vivía en
   `assets/vendor/fontawesome/` y ocupaba **1,02 MB del bucket** sin que nadie la pidiera.

## Contenido del robot

| Archivo | Bytes | Qué es |
|---|---|---|
| `robot-blink-source.mp4` | 1.198.516 | MP4 1280×720, 24 fps, 8 s. Robot con fondo gris. **Contiene el blink real**: el LED del visor cae de luminancia 92 a 6 en los frames 22–29, 82–87 y 163–168. Pose fija (sin giro de cabeza). |
| `robot-transparent-master.png` | 1.157.036 | PNG RGBA 1333×935, robot con alpha real. **Es la fuente de `assets/hero-robot-v2-720.webp`** (error 3,30/255 entre ambos al reducir a 720×505). |

Nombres en ASCII a propósito: el `ñ` en el nombre original rompe rutas en shells
y herramientas (bug encontrado el 20/10).

## De dónde sale el asset del hero

```
robot-transparent-master.png (1333×935, alpha real)
        │
        ├─ reduce 720×505 ──► hero-robot-v2-720.webp   (base del hero, 34,6 KB)
        │                   └► hero-robot-v2-360.webp   (variante srcset)
        │                   └► .avif                    (variante <source>)
        │
robot-blink-source.mp4 (1280×720, fondo gris)
        │
        ├─ registra contra el base (crop x0=127, 1026×720) usando los 2 LEDs
        │  como puntos de control → error 4,24/255, desvío 0,5 px
        ├─ toma el frame 84 (LED apagado real)
        ├─ recorta la caja del visor (207×72) con alfa feather radial
        └─ embebe en canvas 720×505 ──► hero-robot-blink-720.webp (parche, 2,6 KB)
```

## Regenerar

```powershell
python scripts/media/robot_blink_patch.py
```

Sin argumentos usa las rutas de este directorio. El encoder WebP no es
determinista byte a byte: el archivo regenerado difiere del commiteado en ~6 bytes
y en 9 píxeles de 363.600 (delta máximo 13/255, alfa idéntico).

## Fuente de FontAwesome (`fontawesome/`)

| Archivo | Bytes | Qué es |
|---|---|---|
| `fontawesome/css/all.min.css` | 102.025 | CSS del paquete completo. De acá se leen los codepoints de los iconos. |
| `fontawesome/webfonts/fa-solid-900.woff2` | 150.124 | Fuente original de la familia solid (900). |
| `fontawesome/webfonts/fa-brands-400.woff2` | 108.020 | Fuente original de la familia brands (400). |

**El sitio carga 8.494 B** de esta familia: `assets/vendor/fontawesome/css/fa-subset-33.css`
(2.222 B) + `fa-brands-subset-33.woff2` (3.468 B) + `fa-solid-subset-33.woff2` (2.804 B).
El subset tiene 33 glifos, los que el sitio usa de verdad (37 clases `fas` + 33 `fab`,
0 `far` → la familia regular no se usa).

### Regenerar

```powershell
python scripts/media/fontawesome-subset.py            # regenera (escribe en assets/)
python scripts/media/fontawesome-subset.py --check    # solo valida, no escribe
```

El script **lee** de `docs/media-source/fontawesome/` y **escribe** en
`assets/vendor/fontawesome/`. El número de versión es la cantidad de glifos usados:
mismo conjunto de iconos → mismo nombre (`fa-subset-33.css`) → no hay que cambiar
el `<link>` ni bumpear nada. Para agregar un ícono, el nombre cambia (`-34`) y ahí
sí hay que actualizar el `<link>` de `index.html`, porque `/assets/vendor/*` se sirve
con `Cache-Control: immutable` y el CDN ignora el query string.

**Requiere `fonttools` + `brotli`** (`pip install fonttools brotli`): sin eso solo
funciona el modo `--check` (lee el CSS y valida los codepoints, sin escribir).

## Por qué el parche y no un WebP animado del robot entero

El robot **base no se achicó** (sigue 34,6 KB, sin tocar). Lo que se achicó fue **cómo se
entrega el blink**: el MP4 se usa como fuente de píxeles (el frame con los LEDs apagados),
no como archivo web.

| Opción | Peso | Descartada porque |
|---|---|---|
| WebP animado, 192 frames | 5.937 KB | ×30 visitas = 174 MB |
| WebP animado, 16 frames | 502 KB | 14× el peso del base, sin AVIF |
| **Parche estático + `opacity` CSS** | **2,6 KB** | — |

Un WebP animado no comprime entre frames: guarda cada frame como una imagen completa,
por eso el peso crece linealmente con la cantidad de frames.

## El peso real que descarga el navegador

El `sizes` del hero pide 340 px, así que el navegador elige el **AVIF de 360 px**, no el
de 720. Medido con Playwright escuchando las respuestas de red (idéntico en
1920 / 1440 / 768 / 390 px):

| Archivo | Peso | ¿Se descarga? |
|---|---|---|
| `hero-robot-v2-360.avif` | 12,1 KB | ✅ **este** |
| `hero-robot-v2-720.avif` | 26,7 KB | ❌ |
| `hero-robot-v2-720.webp` | 34,6 KB | ❌ (solo sin soporte AVIF) |
| `hero-robot-blink-720.webp` | 2,6 KB | ✅ (el parche no tiene `srcset`) |

**Peso real del hero = 12,1 + 2,6 = 14,7 KB.**

> **Corrección (20/10)**: la cifra de "37,2 KB" que circulaba en el spec y en la nota de
> sesión sumaba los archivos "grandes" del repo sin mirar qué elige el navegador. El
> número real es **14,7 KB**. Regla: el peso que importa se mide con el navegador.

## Otros candidatos evaluados (no usados)

| Archivo | Por qué no |
|---|---|
| `Glossy_yellow_humanoid_robot_bli._*.mp4` | Fondo con checkerboard **horneado** (no es alpha: `pix_fmt=yuv420p`, alpha = 255 en el 100% de los píxeles) y **rota la cabeza** (el centroide del visor se mueve 31 px) → no se puede registrar con un overlay estático. |
| `Yellow_robot_blinking_eyes_*.mp4` | El LED queda azul siempre encendido: no hay blink. |
| `robot_transparent.2.png` | Duplicado byte a byte de `robot-transparent-master.png`. |
