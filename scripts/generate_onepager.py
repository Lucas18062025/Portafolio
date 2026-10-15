#!/usr/bin/env python3
"""Genera el one-pager del portafolio: template HTML -> PDF (Edge) -> metadata (pypdf).

Pipeline reproducible sin Chromium/Playwright:
  1. Lee la plantilla ``docs/media-kit/one-pager.template.html``.
  2. Inyecta las certificaciones desde ``data/certificates.json`` (fuente única).
  3. Genera el QR del portafolio (reportlab SVG -> raster vía pymupdf).
  4. Imprime a PDF con Edge headless (motor autorizado en este host).
  5. Post-procesa con pypdf: metadata XMP-ish (title/author/subject/keywords)
     y verifica enlaces activos.

Uso:
    python scripts/generate_onepager.py [--check-only]

Salida:
    assets/cv/PORTFOLIO_ONE_PAGER.pdf
"""
from __future__ import annotations

import argparse
import base64
import json
import subprocess
import sys
import tempfile
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "docs" / "media-kit" / "one-pager.template.html"
CERTS_JSON = ROOT / "data" / "certificates.json"
OUT_PDF = ROOT / "assets" / "cv" / "PORTFOLIO_ONE_PAGER.pdf"
EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")

SITE_URL = "https://portafolio.lucaslean1806.workers.dev/"
PDF_TITLE = "Lucas Villagra - One-Pager de Portafolio"
PDF_AUTHOR = "Lucas Villagra"
PDF_SUBJECT = "Ciberseguridad: Red Team, Blue Team, pentest, SIEM y automatizacion defensiva"
PDF_KEYWORDS = "ciberseguridad, red team, blue team, pentest, phishing, siem, lucas villagra, portafolio"


def load_certificates(path: Path) -> list[dict]:
    """Devuelve las credenciales del JSON (lista de dicts con issuer/title/dateLabel)."""
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError(f"{path} debe contener una lista")
    return data


def render_certs(certs: list[dict]) -> str:
    """Convierte certificados en <li> del template (fila: issuer · title ... fecha)."""
    items = []
    for c in certs:
        issuer = escape(str(c.get("issuer", "")).strip())
        title = escape(str(c.get("title", "")).strip())
        date = escape(str(c.get("dateLabel", "")).strip())
        items.append(
            f'<li><span><b>{issuer}</b> · {title}</span>'
            f'<span class="date">{date}</span></li>'
        )
    return "\n          ".join(items)


def make_qr_data_uri(url: str) -> str:
    """QR PNG como data URI (reportlab genera SVG; pymupdf lo rasteriza)."""
    from reportlab.graphics import renderSVG
    from reportlab.graphics.barcode import qr as rl_qr
    from reportlab.graphics.shapes import Drawing, Group

    widget = rl_qr.QrCodeWidget(url)
    x0, y0, x1, y1 = widget.getBounds()
    size = 160
    scale = size / (x1 - x0)
    group = Group(widget)
    group.transform = [scale, 0, 0, scale, -x0 * scale, -y0 * scale]
    drawing = Drawing(size, size)
    drawing.add(group)

    with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as tmp:
        svg_path = Path(tmp.name)
    try:
        renderSVG.drawToFile(drawing, str(svg_path))
        import pymupdf

        svg_doc = pymupdf.open(svg_path)
        pix = svg_doc[0].get_pixmap(alpha=False)
        png_bytes = pix.tobytes("png")
        svg_doc.close()
    finally:
        svg_path.unlink(missing_ok=True)
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")


def build_html() -> str:
    """Renderiza el template con certificados y QR inyectados."""
    html = TEMPLATE.read_text(encoding="utf-8")
    if "$CERTS" not in html or "$QR_DATA_URI" not in html:
        raise ValueError("El template no contiene los placeholders $CERTS / $QR_DATA_URI")
    html = html.replace("$CERTS", render_certs(load_certificates(CERTS_JSON)))
    html = html.replace("$QR_DATA_URI", make_qr_data_uri(SITE_URL))
    return html


def print_pdf(html_path: Path, pdf_path: Path) -> None:
    """Imprime HTML a PDF con Edge headless (motor autorizado en el host)."""
    if not EDGE.exists():
        raise FileNotFoundError(f"Edge no encontrado: {EDGE}")
    cmd = [
        str(EDGE),
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        f"--print-to-pdf={pdf_path}",
        "--no-pdf-header-footer",
        html_path.as_uri(),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if not pdf_path.exists():
        raise RuntimeError(
            f"Edge no genero el PDF (rc={result.returncode}): {result.stderr[-400:]}"
        )


def postprocess_pdf(pdf_path: Path) -> dict:
    """Setea metadata, incrusta resume.jsonld como embedded file y verifica paginas + enlaces. Devuelve metricas."""
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(str(pdf_path))
    writer = PdfWriter(clone_from=str(pdf_path))
    writer.add_metadata(
        {
            "/Title": PDF_TITLE,
            "/Author": PDF_AUTHOR,
            "/Subject": PDF_SUBJECT,
            "/Keywords": PDF_KEYWORDS,
            "/Creator": "scripts/generate_onepager.py",
        }
    )
    # Incrustar resume.jsonld como attachment del PDF (API estable pypdf)
    resume_path = ROOT / "data" / "resume.jsonld"
    if resume_path.exists():
        writer.add_attachment(resume_path.name, resume_path.read_bytes())
    with pdf_path.open("wb") as fh:
        writer.write(fh)

    check = PdfReader(str(pdf_path))
    links = 0
    for page in check.pages:
        annots = page.get("/Annots")
        if annots:
            links += len(annots)
    return {"pages": len(check.pages), "links": links, "bytes": pdf_path.stat().st_size}


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera PORTFOLIO_ONE_PAGER.pdf")
    parser.add_argument("--check-only", action="store_true", help="Solo valida inputs")
    args = parser.parse_args()

    for required in (TEMPLATE, CERTS_JSON):
        if not required.exists():
            print(f"FAIL: falta {required}", file=sys.stderr)
            return 1
    certs = load_certificates(CERTS_JSON)
    print(f"[1/4] template OK · {len(certs)} certificados")
    if args.check_only:
        return 0

    html_path = TEMPLATE.with_name("portafolio-one-pager.html")
    html_path.write_text(build_html(), encoding="utf-8")
    print(f"[2/4] HTML renderizado -> {html_path.name}")

    print_pdf(html_path, OUT_PDF)
    print(f"[3/4] PDF Edge -> {OUT_PDF.name}")

    metrics = postprocess_pdf(OUT_PDF)
    print(f"[4/4] metadata OK -> paginas={metrics['pages']} enlaces={metrics['links']} "
          f"tamano={metrics['bytes'] // 1024}KB")

    if metrics["pages"] != 1:
        print("FAIL: debe quedar en 1 pagina", file=sys.stderr)
        return 1
    if metrics["links"] < 3:
        print("FAIL: faltan enlaces activos en el PDF", file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
