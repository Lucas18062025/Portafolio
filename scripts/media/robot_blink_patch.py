#!/usr/bin/env python3
"""Genera el parche de parpadeo del robot del hero desde el MP4 original.

El asset base del hero (`assets/hero-robot-v2-720.webp`) es un render estatico del
mismo robot que el MP4 `robot-pestañeando.mp4`. Este script:

1. Registra el MP4 contra el asset base (crop + resize) usando los LEDs del visor
   como puntos de control, refinado hasta desviar < 1 px.
2. Localiza el frame con los LEDs apagados (el blink real).
3. Recorta la caja del visor con los ojos apagados y le aplica alfa feather radial
   para que se funda con el asset base sin halo.
4. Escribe un WebP de un solo frame: la capa que se superpone durante el blink.

La salida es un parche de ~2 KB frente a los ~500 KB de un WebP animado completo.

Uso:
    python scripts/media/robot_blink_patch.py \
        --mp4 "C:\\Users\\HP Ryzen 5\\Downloads\\oct 15 - 15_03\\robot-pestañeando.mp4" \
        --base assets/hero-robot-v2-720.webp \
        --out assets/hero-robot-blink-360.webp
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# LEDs del visor en el espacio 720x505 del asset base (medidos sobre el asset real).
LED_GUESS = ((298, 156), (433, 155))
LED_RADIUS = 6          # radio de la ventana para el centroide del núcleo saturado
LED_SEARCH = 14         # radio de busqueda del pico alrededor de la posicion estimada
BLINK_RADIUS = 30       # radio del disco feather del parche
FEATHER = 2.0           # dureza del degradado radial (2.0 = solido en el 50% central)
SIGMA = 1.5             # blur del alfa, en px
MIN_LED_DELTA = 0.30    # luminancia mínima para considerar el LED apagado


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    """Ejecuta un comando y aborta si falla.

    Args:
        cmd: Lista de argumentos del proceso.

    Returns:
        El CompletedProcess con stdout y stderr.

    Raises:
        SystemExit: Si el codigo de retorno es distinto de cero.
    """
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr.decode("utf-8", "replace"))
        raise SystemExit(f"comando fallo: {' '.join(cmd[:3])}...")
    return proc


def read_mp4(path: Path, width: int, height: int) -> np.ndarray:
    """Lee todos los frames del MP4 como array RGB.

    Args:
        path: Ruta del MP4 de origen.
        width: Ancho del video.
        height: Alto del video.

    Returns:
        Array de forma (n_frames, height, width, 3) en uint8.
    """
    proc = run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "rawvideo",
                "-pix_fmt", "rgb24", "-"])
    n = len(proc.stdout) // (width * height * 3)
    if n == 0:
        raise SystemExit(f"no se pudieron leer frames de {path}")
    return np.frombuffer(proc.stdout, dtype=np.uint8)[:n * width * height * 3] \
        .reshape(n, height, width, 3)


def led_center(lum: np.ndarray, guess: tuple[int, int]) -> tuple[float, float] | None:
    """Localiza un LED y devuelve el centroide de su nucleo saturado.

    Primero busca el pico mas brillante en una ventana alrededor de la posicion
    estimada (asi el detector no se engancha a un reflejo del visor) y despues
    promedia el nucleo que supera el 93% de ese pico.

    Args:
        lum: Imagen de luminancia.
        guess: Posicion aproximada del LED.

    Returns:
        Tupla (x, y) del centroide, o None si no hay nucleo detectable.
    """
    gx, gy = guess
    x0, x1 = max(0, gx - LED_SEARCH), min(lum.shape[1], gx + LED_SEARCH + 1)
    y0, y1 = max(0, gy - LED_SEARCH), min(lum.shape[0], gy + LED_SEARCH + 1)
    sub = lum[y0:y1, x0:x1]
    if sub.size == 0:
        return None
    iy, ix = np.unravel_index(int(np.argmax(sub)), sub.shape)
    cx, cy = x0 + int(ix), y0 + int(iy)
    win = lum[cy - LED_RADIUS:cy + LED_RADIUS + 1, cx - LED_RADIUS:cx + LED_RADIUS + 1]
    if win.size == 0:
        return None
    ys, xs = np.where(win >= win.max() * 0.93)
    if len(xs) < 3:
        return (float(cx), float(cy))
    return (cx + float(xs.mean()), cy + float(ys.mean()))


def find_registration(frames: np.ndarray, base_rgb: np.ndarray, base_alpha: np.ndarray,
                      tw: int, th: int, vw: int, vh: int) -> tuple[int, int, int, int]:
    """Busca el crop del MP4 que alinea el video con el asset base.

    Usa el error de color sobre los pixeles opacos y el desvio de los LEDs como
    penalizacion, de modo que la posicion de los ojos manda sobre el promedio.

    Args:
        frames: Frames del MP4.
        base_rgb: RGB del asset base.
        base_alpha: Alfa del asset base.
        tw: Ancho destino.
        th: Alto destino.
        vw: Ancho del video.
        vh: Alto del video.

    Returns:
        Tupla (x0, crop_w, y0, crop_h) del mejor registro.
    """
    base_lum = base_rgb.mean(axis=2)
    site_pts = [led_center(base_lum, g) for g in LED_GUESS]
    if any(p is None for p in site_pts):
        raise SystemExit("no se detectaron los LEDs en el asset base")
    mask = base_alpha > 200

    def score_for(x0: int, cw: int, y0: int) -> tuple[float, float]:
        """Devuelve (score, error_color) para un crop candidato."""
        ch = int(round(cw * th / tw))
        if ch <= 0 or ch > vh or y0 < 0 or y0 + ch > vh or x0 < 0 or x0 + cw > vw:
            return (float("inf"), float("inf"))
        reg = np.asarray(Image.fromarray(frames[0][y0:y0 + ch, x0:x0 + cw])
                         .resize((tw, th), Image.LANCZOS)).astype(np.float32)
        err = float(np.abs(reg[..., :3][mask] - base_rgb[mask]).mean())
        dev = 0.0
        reg_lum = reg[..., :3].mean(axis=2)
        for guess, site in zip(LED_GUESS, site_pts):
            c = led_center(reg_lum, guess)
            if c is not None:
                dev += abs(c[0] - site[0]) + abs(c[1] - site[1])
        return (err + dev * 0.6, err)

    best = None
    for x0 in range(120, 136):
        for cw in range(1018, 1038):
            for y0 in range(0, 12):
                s, e = score_for(x0, cw, y0)
                if s == float("inf"):
                    continue
                if best is None or s < best[0]:
                    best = (s, e, x0, cw, y0)
    _, _, x0, cw, y0 = best
    return (x0, cw, y0, int(round(cw * th / tw)))


def build_patch(mp4: Path, base_path: Path, out_path: Path, quality: int) -> None:
    """Construye el parche de parpadeo y lo escribe como WebP.

    Args:
        mp4: Ruta del MP4 de origen.
        base_path: Ruta del asset base del hero.
        out_path: Ruta del WebP de salida.
        quality: Calidad WebP (0-100).
    """
    base = Image.open(base_path).convert("RGBA")
    tw, th = base.size
    base_arr = np.asarray(base).astype(np.float32)
    base_rgb, base_alpha = base_arr[..., :3], base_arr[..., 3]

    probe = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                 "stream=width,height", "-of", "csv=p=0", str(mp4)]).stdout.decode()
    vw, vh = (int(v) for v in probe.strip().split(",")[:2])
    frames = read_mp4(mp4, vw, vh)

    x0, cw, y0, ch = find_registration(frames, base_rgb, base_alpha, tw, th, vw, vh)
    print(f"registro: x0={x0} crop={cw}x{ch} y0={y0}")

    reg = np.stack([
        np.asarray(Image.fromarray(frames[i][y0:y0 + ch, x0:x0 + cw])
                   .resize((tw, th), Image.LANCZOS)).astype(np.float32)
        for i in range(len(frames))])

    reg_lum = reg[..., :3].mean(axis=3)
    mp4_pts = [led_center(reg_lum[0], g) for g in LED_GUESS]
    if any(p is None for p in mp4_pts):
        raise SystemExit("no se detectaron los LEDs en el MP4 registrado")

    def led_lum(i: int) -> float:
        """Luminancia media del nucleo mas oscuro de los dos LEDs."""
        vals = [reg[i][int(cy) - 3:int(cy) + 4, int(cx) - 3:int(cx) + 4].mean(axis=2).mean()
                for (cx, cy) in mp4_pts]
        return min(vals)

    lums = np.array([led_lum(i) for i in range(len(frames))])
    i_off = int(np.argmin(lums))
    print(f"LED on={lums.max():.1f} off={lums[i_off]:.1f} (frame {i_off})")

    crop = (int(min(p[0] for p in mp4_pts) - BLINK_RADIUS - 6),
            int(min(p[1] for p in mp4_pts) - BLINK_RADIUS - 6),
            int(max(p[0] for p in mp4_pts) + BLINK_RADIUS + 6),
            int(max(p[1] for p in mp4_pts) + BLINK_RADIUS + 6))
    cw2, ch2 = crop[2] - crop[0], crop[3] - crop[1]

    off_rgb = reg[i_off][crop[1]:crop[3], crop[0]:crop[2]].copy()
    mask = np.zeros((ch2, cw2), np.float32)
    for (cx, cy) in mp4_pts:
        yy, xx = np.mgrid[0:ch2, 0:cw2]
        d = np.sqrt((xx - (cx - crop[0])) ** 2 + (yy - (cy - crop[1])) ** 2) / BLINK_RADIUS
        mask = np.maximum(mask, np.clip((1.0 - d) * FEATHER, 0, 1))
    mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8), "L")
                      .filter(ImageFilter.GaussianBlur(SIGMA))).astype(np.float32) / 255.0

    rgba = np.dstack([off_rgb.clip(0, 255).astype(np.uint8), (mask * 255).astype(np.uint8)])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(out_path, "WEBP", quality=quality, method=6)
    print(f"escrito {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")
    print(f"caja en 720x505: x {crop[0]}..{crop[2]}  y {crop[1]}..{crop[3]}  ({cw2}x{ch2})")
    print(f"CSS: left:{100 * crop[0] / tw:.4f}%  top:{100 * crop[1] / th:.4f}%  "
          f"width:{100 * cw2 / tw:.4f}%")


def main() -> None:
    """Punto de entrada."""
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--mp4", type=Path, required=True, help="MP4 de origen")
    ap.add_argument("--base", type=Path, required=True, help="asset base del hero")
    ap.add_argument("--out", type=Path, required=True, help="WebP de salida")
    ap.add_argument("--quality", type=int, default=80, help="calidad WebP")
    args = ap.parse_args()
    build_patch(args.mp4, args.base, args.out, args.quality)


if __name__ == "__main__":
    main()
