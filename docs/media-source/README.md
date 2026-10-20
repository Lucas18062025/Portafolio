# Fuentes de medios del robot del hero

Assets **maestros** (no optimizados para web) de los que derivan los archivos que
sí se sirven en producción. Están versionados en git para que el pipeline sea
reproducible, pero **no se deployan**: `docs/**` está en `.assetsignore`.

## Contenido

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

## Por qué el parche y no un WebP animado del robot entero

| Opción | Peso | Descartada porque |
|---|---|---|
| WebP animado, 192 frames | 5.937 KB | ×30 visitas = 174 MB |
| WebP animado, 16 frames | 502 KB | 14× el peso del base, sin AVIF |
| **Parche estático + `opacity` CSS** | **2,6 KB** | — |

## Otros candidatos evaluados (no usados)

| Archivo | Por qué no |
|---|---|
| `Glossy_yellow_humanoid_robot_bli._*.mp4` | Fondo con checkerboard **horneado** (no es alpha: `pix_fmt=yuv420p`, alpha = 255 en el 100% de los píxeles) y **rota la cabeza** (el centroide del visor se mueve 31 px) → no se puede registrar con un overlay estático. |
| `Yellow_robot_blinking_eyes_*.mp4` | El LED queda azul siempre encendido: no hay blink. |
| `robot_transparent.2.png` | Duplicado byte a byte de `robot-transparent-master.png`. |
