# Pull Request template

## Descripción
<!-- Explica brevemente el objetivo del PR -->

## Cambios realizados
- <!-- Lista los cambios -->

## Checklist de Seguridad
- [ ] ¿Se ha actualizado la documentación (README, AGENTS.md, etc.)?
- [ ] ¿Se ejecutaron pruebas unitarias / funcionales y pasaron?
- [ ] ¿Se ejecutó `npm run lint` (si aplica) sin errores?
- [ ] ¿Se ejecutó `scripts/verify-csp.js` y no encontró problemas?
- [ ] ¿No se han añadido secretos al repositorio? (`detect-secrets` pre‑commit)
- [ ] ¿Se revisó el CSP y los headers de seguridad en `_headers`?
- [ ] ¿Se ha validado la compresión Brotli (`curl -I -H "Accept-Encoding: br"`)?
- [ ] ¿Se ha añadido/actualizado `Rate-Limit` en `_headers` para rutas `/api/*`?
- [ ] ¿Se ha actualizado el registro de despliegues en KV (`DEPLOY_LOG`)?
- [ ] ¿Se ha obtenido la aprobación de al menos un revisor, o de un revisor de seguridad si el PR tiene label `security-impact`?

## Referencias
- Issue: #[Número]
