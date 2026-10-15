# SPEC — valuglobal-fase1-kpis-servicios-tabs — 2026-10-14

## Objetivo
Aplicar la segunda ola de adaptaciones de Valuglobal: cintillo de métricas verificables en el hero, servicios con outcomes y entregables, arquitectura de servicios por ámbitos reutilizando el patrón de tabs sin duplicar JS, y lead magnet one-pager.

## Alcance
- `index.html`: `.hero-kpis`, tabs/panels de servicios, listas de entregables.
- `css/hero.css`, `css/main.css`: estilos para KPIs y tabs de servicios (reuso de stack-tabs).
- `js/main.js`: refactoring del initializer de tabs a una función por grupo (`stack`, `svc`).
- `docs/media-kit/*` + `*.pdf`: one-pager técnico.
- `specs/*`.

## No-objetivos
- No bilingüe completo en esta fase.
- No cambiar paleta ni worker.
- No tocar SEO JSON-LD salvo si el PDF se menciona como oferta.

## Prototipo
- Verificar con `npx serve .` en 360/768/1440 y `Tab`/teclado en tabs de servicios.

## Checks
- T4 dry-run OK.
- T5 health 200/404.
- Accesibilidad: tabs con `role=tab`, `aria-selected`, teclado flechas.

## Rollback
- `git revert <sha>` de cada commit incremental.