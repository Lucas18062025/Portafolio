# SPEC — one-pager-pro-v2 — 2026-10-14

> Regla: ningún cambio grande entra a preview sin este spec de 15 líneas.
> Flujo: SPEC → prototipo en preview → demo al usuario → port a real → `.\deploy.ps1`.

## Objetivo
Convertir `PORTFOLIO_ONE_PAGER.pdf` en un descargable profesional, accesible, liviano y **reproducible** (web/print), en lugar de arte final editado a mano.

## Alcance
- `scripts/generate_onepager.py` (nuevo): pipeline HTML → PDF → metadata.
- `docs/media-kit/portafolio-one-pager.html` (generado, gitignorado).
- `assets/cv/PORTFOLIO_ONE_PAGER.pdf` (único artefacto commiteado/desplegado).
- Fase posterior: `data/resume.jsonld` + adjunto embebido en el PDF.

## No-objetivos
- `index.html`, `worker.js`, paleta `#020408`/`#0066FF`/`#00D4FF`, guards T1–T5.
- Instalar Chromium/Playwright/Ghostscript/Puppeteer (prohibido por el usuario).
- CMYK real (sin Ghostscript en el host) → queda documentado como pendiente.

## Decisiones de pipeline (entorno verificado 2026-10-14)
- Motor PDF: **Edge headless** (`--print-to-pdf`), ya usado y estable.
- QR: **reportlab** (QR SVG) → **pymupdf** raster → PNG data-URI (ambos ya instalados).
- Metadata/links/post-proceso: **pypdf 6.18** (title/author/subject/keywords + attachment).
- Accesibilidad (tagged PDF): **Microsoft Word 16.0 vía COM** (Office instalado, COM verificado OK).
- Datos: certificados inyectados desde `data/certificates.json`; proyectos/skills fuentes `index.html`.

## Prototipo
`python scripts/generate_onepager.py` → `docs/media-kit/portafolio-one-pager.html` →
`assets/cv/PORTFOLIO_ONE_PAGER.pdf`. Verificar: 1 página A4, fondo a sangre sin bordes,
métricas en una línea, 6 certificados, enlaces activos (pypdf `get_links > 0`).

## Checks
T1–T5 + `/assets/cv/PORTFOLIO_ONE_PAGER.pdf` → 200 y viejo nombre → 404.
T6: PDF 1 página · enlaces > 0 · metadata autor/keywords · certs == 6 · tamaño < 300 KB.

## Rollback
`git revert <sha>` + `.\deploy.ps1 -Message "revert: one-pager pro v2"` (el PDF anterior
queda en el historial de git).
