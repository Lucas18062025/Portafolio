# TOOLS.md — Portafolio

| Herramienta | Uso permitido | Prohibido |
|---|---|---|
| `deploy.ps1` | Único camino a prod | deploy manual `wrangler deploy` salvo fix documentado (como 23/09) |
| `git`, `gh` | `status/diff/log`, rama + PR en cambios grandes | push directo a `main` en cambios grandes (sin enforcement de GitHub: ver `AGENTS.md`) |
| `npx wrangler` | `--dry-run`, `deploy` vía script | `--force`, cambiar `name` sin alinear dashboard |
| `curl.exe` | health-checks post-deploy | — |
| `scripts/media/optimize_flow_media.py` (Pillow + ffmpeg) | regenerar el kit visual (`--src/--out`, `--no-video`, `--crf`, `--force`) | correrlo sin `--src/--out` |
| `gh api` (read-only) | auditorías: `branches/main`, `rulesets`, `check-runs`, `codeowners/errors` | `POST/PATCH/DELETE` sin pedido explícito |
| Edge headless | verificación de render y medidas post-deploy | instalar Chrome u otro navegador |
| `cloudflare-auditor` (subagente) | auditoría read-only Workers/KV/wrangler | modificar código o infra |
| `git-flow` (subagente) | flujo PR estricto | `edit` directo |
| Browser: Rich Results + Search Console | T6–T7 | `Solicitar indexación` >10/día (cuota) |

## Límites
- No instalar dependencias sin aprobación. No tocar `node_modules/wrangler/config-schema.json`.
- No salir de `Portafolio/` salvo preview `portafolio-preview` y el repo local de gobernanza `Proyectos\_gobernanza` (excepción 17/10: historial de los `AGENTS.md` globales).
