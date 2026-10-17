#!/usr/bin/env python3
"""Optimiza el kit de medios de Google Flow para la seccion Security Research.

Convierte imagenes 2K a WebP en dos anchos (+ variante og 1200x630) y recomprime
los clips MP4 720p para web. La salida esta pensada para `assets/blog/flow/`.

Uso:
    python scripts/media/optimize_flow_media.py --src "<dir OneDrive>" --out "<assets/blog/flow>"
    python scripts/media/optimize_flow_media.py --src "<dir>" --out "<dir>" --no-video
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageOps

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
VIDEO_SUFFIXES = {".mp4"}
WIDTHS: tuple[int, ...] = (1280, 640)
OG_SIZE: tuple[int, int] = (1200, 630)
VIDEO_WIDTH = 1280
POSTER_SECONDS = "1"

_TIMESTAMP = re.compile(r"[-_]\d{14}$")
_TWO_K = re.compile(r"[-_ ]2k\b", re.IGNORECASE)


@dataclass
class Result:
    """Resultado de un archivo procesado."""

    source: Path
    slug: str
    kind: str
    before: int
    after: int = 0
    outputs: list[Path] = field(default_factory=list)


def slugify(stem: str) -> str:
    """Normaliza un nombre de archivo de Flow a un slug ASCII estable.

    Args:
        stem: Nombre sin extension (puede traer timestamp, sufijo 2K y no-ASCII).

    Returns:
        Slug en minusculas con guiones, sin timestamp ni sufijo 2K.
    """
    value = _TIMESTAMP.sub("", stem)
    value = _TWO_K.sub("", value)
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).lower().strip("-")
    return value[:52].strip("-")


def _save_webp(image: Image.Image, target: Path, quality: int) -> int:
    """Guarda una imagen como WebP y devuelve su peso en bytes."""
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=quality, method=6)
    return target.stat().st_size


def _fit_width(image: Image.Image, width: int) -> Image.Image:
    """Escala la imagen a un ancho dado conservando el aspecto."""
    if image.width <= width:
        return image.copy()
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.LANCZOS)


def _center_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Recorta al centro con el aspecto pedido (para og:image)."""
    target_ratio = size[0] / size[1]
    ratio = image.width / image.height
    if ratio > target_ratio:
        new_width = round(image.height * target_ratio)
        left = (image.width - new_width) // 2
        box = (left, 0, left + new_width, image.height)
    else:
        new_height = round(image.width / target_ratio)
        top = (image.height - new_height) // 2
        box = (0, top, image.width, top + new_height)
    return image.crop(box).resize(size, Image.LANCZOS)


def optimize_image(source: Path, out_dir: Path, quality: int, force: bool) -> Result:
    """Genera las variantes WebP (1280 / 640 / og) de una imagen.

    Args:
        source: JPG/PNG de origen.
        out_dir: Carpeta destino.
        quality: Calidad WebP (1-100).
        force: Rehacer aunque la salida sea mas nueva.

    Returns:
        Resultado con el peso antes y despues.
    """
    slug = slugify(source.stem)
    result = Result(source=source, slug=slug, kind="image", before=source.stat().st_size)

    main_target = out_dir / f"{slug}-{WIDTHS[0]}.webp"
    if main_target.exists() and not force and main_target.stat().st_mtime >= source.stat().st_mtime:
        result.after = sum(
            path.stat().st_size for path in out_dir.glob(f"{slug}-*.webp") if path.is_file()
        )
        result.outputs = sorted(out_dir.glob(f"{slug}-*.webp"))
        return result

    with Image.open(source) as raw:
        image = ImageOps.exif_transpose(raw).convert("RGB")
        for width in WIDTHS:
            target = out_dir / f"{slug}-{width}.webp"
            result.after += _save_webp(_fit_width(image, width), target, quality)
            result.outputs.append(target)
        og_target = out_dir / f"{slug}-og.webp"
        result.after += _save_webp(_center_crop(image, OG_SIZE), og_target, quality)
        result.outputs.append(og_target)
    return result


def _run(cmd: list[str]) -> None:
    """Ejecuta un comando y aborta si falla."""
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"fallo: {' '.join(cmd[:3])}...\n{proc.stderr[-600:]}")


def transcode_video(
    source: Path, out_dir: Path, crf: int, quality: int, force: bool, with_poster: bool = True
) -> Result:
    """Recomprime un MP4 a H.264 web (sin audio) y extrae su poster WebP.

    Args:
        source: MP4 de origen (720p de Google Flow).
        out_dir: Carpeta destino.
        crf: Factor de calidad x264 (mayor = mas compresion).
        quality: Calidad del poster WebP.
        force: Rehacer aunque la salida sea mas nueva.
        with_poster: Extraer el frame de portada.

    Returns:
        Resultado con el peso antes y despues.
    """
    slug = slugify(source.stem)
    result = Result(source=source, slug=slug, kind="video", before=source.stat().st_size)
    target = out_dir / f"{slug}.mp4"

    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg no esta en PATH: instalar con 'winget install Gyan.FFmpeg'")

    if not (target.exists() and not force and target.stat().st_mtime >= source.stat().st_mtime):
        _run(
            [
                "ffmpeg", "-y", "-loglevel", "error", "-i", str(source),
                "-c:v", "libx264", "-crf", str(crf), "-preset", "slow",
                "-vf", f"scale={VIDEO_WIDTH}:-2", "-an",
                "-movflags", "+faststart", "-pix_fmt", "yuv420p",
                str(target),
            ]
        )
    result.after += target.stat().st_size
    result.outputs.append(target)

    if with_poster:
        # Se extrae a PNG temporal (ffmpeg a stdout no es fiable en Windows).
        tmp_png = out_dir / f".{slug}-poster.tmp.png"
        _run(
            [
                "ffmpeg", "-y", "-loglevel", "error", "-ss", POSTER_SECONDS,
                "-i", str(target), "-frames:v", "1", str(tmp_png),
            ]
        )
        with Image.open(tmp_png) as raw:
            image = raw.convert("RGB")
            for width in WIDTHS:
                poster_target = out_dir / f"{slug}-poster-{width}.webp"
                result.after += _save_webp(_fit_width(image, width), poster_target, quality)
                result.outputs.append(poster_target)
        tmp_png.unlink(missing_ok=True)
    return result


def process(source_dir: Path, out_dir: Path, args: argparse.Namespace) -> list[Result]:
    """Recorre la carpeta de origen e itera (nunca hardcodea nombres)."""
    results: list[Result] = []
    entries = sorted(path for path in source_dir.iterdir() if path.is_file())
    for path in entries:
        suffix = path.suffix.lower()
        try:
            if suffix in IMAGE_SUFFIXES:
                results.append(optimize_image(path, out_dir, args.quality, args.force))
            elif suffix in VIDEO_SUFFIXES and not args.no_video:
                results.append(
                    transcode_video(path, out_dir, args.crf, args.quality, args.force)
                )
            elif suffix in VIDEO_SUFFIXES:
                print(f"[skip] video omitido por --no-video: {path.name}")
        except Exception as error:  # noqa: BLE001 - reportar y seguir con el resto
            print(f"[error] {path.name}: {error}")
    return results


def report(results: list[Result]) -> None:
    """Imprime el informe antes/despues y valida el presupuesto de pesos."""
    header = f"{'slug':<46} {'tipo':<6} {'antes':>10} {'despues':>10} {'ahorro':>8}"
    print("\n" + header)
    print("-" * len(header))
    before_total = after_total = 0
    for item in results:
        before_total += item.before
        after_total += item.after
        saving = 1 - (item.after / item.before) if item.before else 0
        print(
            f"{item.slug:<46} {item.kind:<6} "
            f"{item.before / 1024:>9.0f}K {item.after / 1024:>9.0f}K {saving:>7.0%}"
        )
    print("-" * len(header))
    total_saving = 1 - (after_total / before_total) if before_total else 0
    print(
        f"{'TOTAL':<46} {'':<6} "
        f"{before_total / 1024 / 1024:>8.1f}M {after_total / 1024 / 1024:>8.1f}M {total_saving:>7.0%}"
    )

    over_budget = [
        path
        for item in results
        for path in item.outputs
        if path.stat().st_size > (1_200_000 if path.suffix == ".mp4" else 250_000)
    ]
    if over_budget:
        print("\n[aviso] sobre presupuesto:")
        for path in over_budget:
            print(f"  - {path.name}: {path.stat().st_size / 1024:.0f}K")
    else:
        print("\n[ok] todos los archivos dentro del presupuesto (T10)")


def main(argv: list[str] | None = None) -> int:
    """Punto de entrada del script."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--src", required=True, type=Path, help="carpeta de crudos de Flow")
    parser.add_argument("--out", required=True, type=Path, help="carpeta destino de assets")
    parser.add_argument("--quality", type=int, default=80, help="calidad WebP (default 80)")
    parser.add_argument("--crf", type=int, default=28, help="calidad x264 (default 28)")
    parser.add_argument("--no-video", action="store_true", help="procesar solo imagenes")
    parser.add_argument("--force", action="store_true", help="rehacer todo")
    args = parser.parse_args(argv)

    if not args.src.is_dir():
        print(f"no existe la carpeta de origen: {args.src}", file=sys.stderr)
        return 2
    args.out.mkdir(parents=True, exist_ok=True)

    results = process(args.src, args.out, args)
    if not results:
        print("no se procesó ningún archivo", file=sys.stderr)
        return 1
    report(results)
    print(f"\nsalida: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
