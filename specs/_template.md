# SPEC — <slug> — YYYY-MM-DD

> Regla: ningún cambio grande entra a preview sin este spec de 15 líneas.
> Vive en `specs/YYYY-MM-DD-slug.md` (ignorado en deploy) o como Acta Obsidian si es solo decisión.
> Flujo: SPEC → prototipo en preview → demo al usuario → port a real → `.\deploy.ps1`.

## Objetivo
<1 línea: qué problema resuelve>

## Alcance
<qué archivos toca, ej: `index.html#hero`, `css/hero.css`>

## No-objetivos
<qué NO se toca, ej: paleta, `worker.js`, CDNs>

## Prototipo
<ruta en `portafolio-preview` + cómo verificar, ej: `npx serve .` + screenshot 360/1440>

## Checks
<T1–T5 siempre; + T6/T7/T8 si toca SEO>

## Rollback
<`git revert <sha>` + re-deploy anterior>
