#!/usr/bin/env python3
"""Genera un subset de FontAwesome con solo los glifos que usa el sitio.

Motivo: el paquete completo pesa ~1 MB y el sitio usa 33 iconos. El subset baja
`all.min.css` (99,6 KB) + `fa-solid-900.woff2` (150 KB) + `fa-brands-400.woff2` (108 KB)
a ~2 KB + ~3 KB + ~3 KB, sin tocar una sola clase del HTML.

Uso:
    python scripts/media/fontawesome-subset.py            # regenera (version = cantidad de glifos)
    python scripts/media/fontawesome-subset.py --check    # solo reporta, no escribe

Requiere `fonttools` + `brotli` (`pip install fonttools brotli`) para escribir WOFF2.

Agregar un icono nuevo:
    1. Usar la clase en el HTML/JSON (ej. `fas fa-terminal`).
    2. Re-ejecutar este script: sube la cantidad de glifos y por lo tanto la VERSION
       del nombre de archivo (`fa-subset-34.css`, `fa-solid-subset-34.woff2`).
    3. Actualizar el `<link>` de `index.html` al nombre nuevo.

El nombre lleva la version a proposito: `/assets/vendor/*` se sirve con
`Cache-Control: immutable` y el CDN ignora el query string, asi que reemplazar un
archivo con el mismo nombre dejaria la version vieja cacheada (ver TEST_PLAN.md).

El paquete original (`css/all.min.css` + `webfonts/*.{woff2,ttf}`) queda en el repo
como fuente de verdad para regenerar: el sitio no lo carga, no se descarga nunca.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

FA_FAMILIES = {"fas": "solid", "fab": "brands"}
ICON_UTILITY = {"fa-solid", "fa-brands", "fa-regular"}
FAMILY_PAIR = re.compile(r"\b(?:fas|fab|far|fa-solid|fa-brands|fa-regular)\s+(fa-[a-z0-9-]+)")
MINIFIED = re.compile(r"/\*.*?\*/", re.S)
CONTENT = re.compile(r'content:"\\([0-9a-fA-F]{4})"')
ICON_SELECTOR = re.compile(r"\.((?:fa|fas|fab|far)-[a-z0-9-]+):before")

# Reglas base que hay que conservar (fuente de las familias, tamano, animaciones basicas).
BASE_SELECTORS = frozenset({
    ".fa",
    ".fa,.fa-brands,.fa-classic,.fa-regular,.fa-sharp,.fa-solid,.fab,.far,.fas",
    ".fa-classic,.fa-regular,.fa-solid,.far,.fas",
    ".fa-brands,.fab",
})


def split_rules(css: str) -> list[str]:
    """Parte un CSS minificado en reglas de nivel 0 (respeta llaves anidadas)."""
    body = MINIFIED.sub("", css)
    rules: list[str] = []
    depth, start = 0, 0
    for index, char in enumerate(body):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                rules.append(body[start : index + 1].strip())
                start = index + 1
    return [rule for rule in rules if rule]


def read_codepoints(css: str) -> dict[str, str]:
    """Mapea clase de icono -> codepoint. Cubre reglas con varios selectores (alias)."""
    mapping: dict[str, str] = {}
    for match in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        selector, body = match.group(1), match.group(2)
        found = CONTENT.search(body)
        if not found:
            continue
        for name in ICON_SELECTOR.findall(selector):
            mapping.setdefault(name, found.group(1))
    return mapping


def icons_in(text: str, suffix: str) -> set[str]:
    """Extrae las clases `fa-*` realmente usadas por el sitio.

    En HTML solo mira atributos `class` (un `fa-subset-33.css` en un comentario o en un
    `<link>` no es un icono). En JS/JSON exige el par `familia + icono`
    (`fas fa-file-pdf`, `fab fa-aws`), que es como se declaran los iconos.
    """
    if suffix == ".html":
        tokens: set[str] = set()
        for match in re.finditer(r'class="([^"]*)"', text):
            tokens |= {token for token in match.group(1).split()
                       if token.startswith("fa-") and token not in ICON_UTILITY}
        return tokens
    return {match.group(1) for match in FAMILY_PAIR.finditer(text)}


SCAN_PATTERNS = ("**/*.html", "**/*.js", "**/*.json")
SKIP_DIRS = {".git", ".wrangler", ".gstack", ".gbrain", "node_modules", "specs", "assets", "scripts"}


def used_icons(repo: Path) -> set[str]:
    """Iconos usados en las paginas (incluye blog/), el JS y los datos del sitio."""
    icons: set[str] = set()
    for pattern in SCAN_PATTERNS:
        for path in repo.glob(pattern):
            if any(part.startswith(".") or part in SKIP_DIRS for part in path.parts):
                continue
            icons |= icons_in(path.read_text(encoding="utf-8", errors="replace"), path.suffix)
    return icons


def subset_font(python: str, source: Path, target: Path, codepoints: list[str], weight: int, family: str) -> None:
    """Corre fontTools.subset sobre una fuente y devuelve el WOFF2 recortado."""
    result = subprocess.run(
        [python, "-m", "fontTools.subset", str(source), f"--unicodes={','.join(codepoints)}",
         "--flavor=woff2", "--hinting", "--layout-features=*",
         f"--output-file={target}"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        sys.exit(f"fontTools.subset fallo en {source.name}:\n{result.stdout}\n{result.stderr}")
    print(f"  {family:<22} {source.name} {source.stat().st_size:>8,} B -> {target.name} {target.stat().st_size:>7,} B (peso {weight})")


def build_css(css: str, version: int, families: dict[str, str], weights: dict[str, int],
              wanted: set[str]) -> str:
    """Conserva solo las reglas base, los @font-face usados y los iconos del subset."""
    kept: list[str] = []
    for rule in split_rules(css):
        selector = rule.split("{", 1)[0].strip()
        if rule.startswith("@font-face"):
            family = re.search(r'font-family:"?([^;"]+)"?', rule)
            weight = re.search(r"font-weight:(\d+)", rule)
            if not family or family.group(1) not in families:
                continue
            if weight and int(weight.group(1)) != weights[family.group(1)]:
                continue
            subset = f"fa-{families[family.group(1)]}-subset-{version}.woff2"
            kept.append(f'@font-face{{font-family:"{family.group(1)}";font-style:normal;'
                        f'font-weight:{weight.group(1)};font-display:block;'
                        f'src:url(../webfonts/{subset}) format("woff2")}}')
            continue
        if selector in BASE_SELECTORS:
            kept.append(rule)
            continue
        if any(name in wanted for name in ICON_SELECTOR.findall(selector)):
            kept.append(rule)
    return "\n".join(kept) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Subset de FontAwesome para el portafolio.")
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--check", action="store_true", help="solo reporta, no escribe archivos")
    args = parser.parse_args()

    fa = args.repo / "assets" / "vendor" / "fontawesome"
    source_css = fa / "css" / "all.min.css"
    css = source_css.read_text(encoding="utf-8")
    codepoints = read_codepoints(css)

    wanted = sorted(used_icons(args.repo))
    missing = [name for name in wanted if name not in codepoints]
    if missing:
        sys.exit(f"ABORTADO: sin codepoint en el CSS: {missing}")

    chars = sorted({codepoints[name] for name in wanted})
    version = len(wanted)
    families = {"Font Awesome 6 Free": "solid", "Font Awesome 6 Brands": "brands"}
    weights = {"Font Awesome 6 Free": 900, "Font Awesome 6 Brands": 400}
    originals = {"solid": "fa-solid-900.woff2", "brands": "fa-brands-400.woff2"}

    print(f"iconos usados en el sitio: {version}")
    print(f"codepoints: {','.join('U+' + code for code in chars)}\n")
    if args.check:
        print("modo --check: no se escribio nada.")
        return 0

    print("=== fuentes ===")
    for family, kind in families.items():
        subset_font(sys.executable, fa / "webfonts" / originals[kind],
                    fa / "webfonts" / f"fa-{kind}-subset-{version}.woff2",
                    ["U+" + code for code in chars], weights[family], family)

    print("\n=== css ===")
    target_css = fa / "css" / f"fa-subset-{version}.css"
    target_css.write_text(build_css(css, version, families, weights, set(wanted)), encoding="utf-8")
    print(f"  {source_css.name} {source_css.stat().st_size:>8,} B -> {target_css.name} "
          f"{target_css.stat().st_size:>7,} B ({target_css.stat().st_size / source_css.stat().st_size:.1%})")
    total = target_css.stat().st_size + sum(
        (fa / "webfonts" / f"fa-{kind}-subset-{version}.woff2").stat().st_size for kind in originals)
    print(f"\n  total a descargar: {total:,} B (era {source_css.stat().st_size + sum((fa / 'webfonts' / name).stat().st_size for name in originals.values()):,} B)")
    print(f"\n  actualizar el <link> de index.html a: ./assets/vendor/fontawesome/css/{target_css.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
