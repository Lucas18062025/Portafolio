# deploy.ps1 - pre-flight (guards) + commit/push a la RAMA. NO despliega.
#
# Uso:
#   .\deploy.ps1                        -> pre-flight: guards + dry-run. Sin git, sin deploy.
#   .\deploy.ps1 -Message "fix: ..."    -> pre-flight + commit + push a la RAMA actual
#   .\deploy.ps1 -Check                 -> alias explicito del pre-flight
#
# POR QUE NO DESPLIEGA:
#   El deploy a produccion lo hace el CI (.github/workflows/deploy.yml) cuando
#   se mergea el PR a `main`. Antes habia TRES paths de deploy (este script, el
#   CI y Workers Builds) y cada push a `main` desplegaba 3 veces: medido el
#   20/10, 3 versiones en Cloudflare por push, separadas ~15 s. El de Workers
#   Builds usaba `npx wrangler deploy` sin pinear.
#
# POR QUE NO PUSHEA A `main`:
#   El ruleset `protect-main` (activo desde 20/07/2026) exige PR. El owner tiene
#   `bypass_mode: always`, asi que un push directo se acepta, pero queda
#   registrado como "Bypassed rule violations". Este script aborta en `main`
#   para no depender del bypass: el flujo es rama + PR + merge.
#   `required_signatures` NO se saltea: el commit tiene que ir firmado.
#
# FLUJO (ver AGENTS.md):
#   1. git status / git diff / git branch
#   2. git switch -c feat/...
#   3. modificar + probar   -> .\deploy.ps1 -Check
#   4. .\deploy.ps1 -Message "..."   (commit + push de la rama)
#   5. PR + merge a main
#   6. el CI despliega + verifica; despues se revisa en produccion
param(
  [string]$Message = "",
  [switch]$Check
)

$ErrorActionPreference = "Stop"

# 0. Nada de push directo a `main`: el ruleset exige PR. Se verifica PRIMERO
#    (fallar en 1 s, no despues de un dry-run de 20 s).
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($Message -and $branch -eq "main") {
  Write-Error "ABORTADO: estas en `main`. El ruleset `protect-main` exige PR y este script no pushea a main (ni depende del bypass del owner).`n  Crea una rama: git switch -c feat/... (o fix/...), volve a correr y despues abrí el PR."
  exit 1
}

# 0. El deploy lo hace el CI, no este script. Si alguien lo invoca esperando
#    un deploy, que lo sepa antes de que haga cualquier cosa.
if ($Check -or -not $Message) {
  Write-Host "PRE-FLIGHT: guards (T1-T3b, T4, T9) + dry-run. Sin commit, sin push, sin deploy." -ForegroundColor Cyan
  Write-Host "            El deploy a produccion lo hace el CI al mergear el PR en main." -ForegroundColor Cyan
}
else {
  Write-Host "PRE-FLIGHT + COMMIT/PUSH a la rama actual. El deploy lo hace el CI al mergear." -ForegroundColor Cyan
}

# 1. Guards + dry-run. Implementacion unica en scripts/guards.mjs: la usan
#    este script, el gate del PR (ci.yml) y el pre-deploy de deploy.yml.
#    Asi no hay drift entre lo que se valida localmente y lo que valida el CI.
#    El dry-run (T4) va siempre: es el check que confirma que el Worker ve
#    env.ASSETS antes de que nada salga a produccion.
& node "scripts/guards.mjs" --dry-run
if ($LASTEXITCODE -ne 0) {
  Write-Error "ABORTADO: los guards fallaron (ver arriba). No se commitea ni se pushea."
  exit 1
}

# 2. Sin -Message no hay nada mas que hacer: el pre-flight ya termino.
if ($Check -or -not $Message) {
  Write-Host ""
  Write-Host "PRE-FLIGHT OK. Siguiente paso: .\deploy.ps1 -Message `"<descripcion>`" (commit + push de la rama)."
  exit 0
}

# 3. Commit + push de la rama.
#    `git add -A` respeta .gitignore. Se lista lo staged antes de commitear para
#    que quede a la vista: en una rama un commit con basura se corrige facil,
#    en main ya estaria en produccion.
#
#    Ojo: git.exe escribe avisos por stderr aun con exit 0 (p. ej. "LF will be
#    replaced by CRLF"). Con $ErrorActionPreference="Stop" eso abortaba el
#    script: se aisla a "Continue" y se decide por $LASTEXITCODE.
$oldEAPGit = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$changes = git status --porcelain
if (-not $changes) {
  $ErrorActionPreference = $oldEAPGit
  Write-Host "Sin cambios para commitear."
  exit 0
}
Write-Host ""
Write-Host "Archivos a commitear:"
git status --short
git add -A
$addExit = $LASTEXITCODE
if ($addExit -ne 0) {
  $ErrorActionPreference = $oldEAPGit
  Write-Error "ABORTADO: git add fallo (exit $addExit)."
  exit 1
}
git commit -m $Message
$commitExit = $LASTEXITCODE
$ErrorActionPreference = $oldEAPGit
if ($commitExit -ne 0) {
  Write-Error "ABORTADO: git commit fallo (exit $commitExit)."
  exit 1
}

Write-Host ""
Write-Host "Commit firmado. Verificacion de la firma:"
git log -1 --show-signature --format="%h %G? %GS" 2>&1 | Select-Object -First 3

$oldEAPPush = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$pushOut = git push -u origin $branch 2>&1 | Out-String
$pushExit = $LASTEXITCODE
$ErrorActionPreference = $oldEAPPush
if ($pushExit -ne 0) {
  Write-Error "ABORTADO: git push fallo (exit $pushExit).`n$pushOut"
  exit 1
}
Write-Host $pushOut.Trim()

Write-Host ""
Write-Host "Rama `$branch` pusheada. Ahora:"
Write-Host "  1. gh pr create --base main --title `"<titulo>`" --body `"<descripcion>`""
Write-Host "  2. gh pr merge --squash --delete-branch   (o merge desde la UI)"
Write-Host "  3. el CI despliega a produccion al mergear; despues se verifica."
