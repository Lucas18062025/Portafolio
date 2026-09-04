# Workflow de Finalización y Despliegue

Al completar y verificar cualquier tarea, fix o modificación en este proyecto, siempre ejecutar la secuencia completa de cierre sin esperar confirmación intermedia:

1. **Git Staging**: `git add .`
2. **Git Commit**: `git commit -m "..."` con un mensaje claro y descriptivo.
3. **Git Push**: `git push origin main`
4. **Despliegue**: `npx wrangler deploy` para publicar la versión actualizada en Cloudflare Workers.

# Pipeline de cambios al portafolio (obligatorio)

Nunca editar el portafolio real directamente. Todo cambio visual o de contenido sigue este orden:

1. **Prototipar en la copia**: `C:\Users\HP Ryzen 5\OpenCode\portafolio-preview`
2. **Revisar y verificar** con el usuario en la copia (abrir el HTML, comparar opciones si aplica).
3. **Solo si está ok**, portar al real (`C:\Users\HP Ryzen 5\Proyectos\Portafolio`) respetando su paleta: fondo `#020408`, acentos azul `#0066FF` / cyan `#00D4FF`. Los tonos del preview (bordó/dorado) NO se copian.
4. Cierre con la secuencia de Finalización y Despliegue de arriba.

# Convención git (opción 3)

- **Fixes chicos**: push directo a `main` (el owner bypassea la protección, igual GitHub lo advierte).
- **Cambios grandes**: rama `feat/...` o `fix/...` + PR + merge en GitHub.
- **Commits firmados**: `gpg.format=ssh`, clave `~/.ssh/id_ed25519_signing.pub`, `commit.gpgsign=true` (config global). La clave pública debe estar registrada en GitHub como *Signing Key*; si un commit sale `Unverified`, revisar eso primero.
