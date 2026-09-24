# Automatiza: git add + commit + push + wrangler deploy
# Uso: .\deploy.ps1 -Message "feat: actualizo portfolio"
param([string]$Message = "update: deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')")

$ErrorActionPreference = "Stop"

# 0. Guardia: nunca deployar sin el archivo de verificación de Search Console.
#    Si falta google*.html se pierde la propiedad verificada en Google. NO BORRAR.
$verifyFile = Get-ChildItem -Path . -Filter "google*.html" -File | Select-Object -First 1
if (-not $verifyFile) {
  Write-Error "ABORTADO: falta el archivo google*.html de verificación de Google Search Console en la raíz. Restauralo antes de deployar."
  exit 1
}

# 0b. Guardia: binding ASSETS declarado (causa del incidente sep-2026).
#     Sin esto env.ASSETS es undefined y el Worker crashea con
#     "Cannot read properties of undefined (reading 'fetch')".
if (-not (Select-String -Path ./wrangler.jsonc -Pattern '"binding"\s*:\s*"ASSETS"' -Quiet)) {
  Write-Error "ABORTADO: falta `"binding`": `"ASSETS`" en wrangler.jsonc (assets). Agregalo antes de deployar."
  exit 1
}

# 0c. Guardia: worker.js no debe exponerse como asset público.
if (-not (Select-String -Path ./.assetsignore -Pattern '^worker\.js$' -Quiet)) {
  Write-Error "ABORTADO: falta `worker.js` en .assetsignore. El código quedaría descargable en /worker.js."
  exit 1
}

# 1. Ver qué cambió
git status --short
git diff --stat

# 2-3. Staging + commit (si hay cambios)
$changes = git status --porcelain
if ($changes) {
  git add .
  git commit -m $Message
} else {
  Write-Host "Sin cambios para commitear."
}

# 4. Push
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
git push origin $branch

# 4b. Dry-run: el Worker debe ver el binding ASSETS. Si sale vacío, no deployar.
#     Nota: npx escribe avisos por stderr aun con exit 0; con $ErrorActionPreference="Stop"
#     eso abortaría como falso fallo. Se aísla a "Continue" y se decide por $LASTEXITCODE.
$oldEAPDry = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$dryRun = npx wrangler deploy --dry-run 2>&1 | Out-String
$dryExit = $LASTEXITCODE
$ErrorActionPreference = $oldEAPDry
if ($dryExit -ne 0) {
  Write-Error "ABORTADO: dry-run falló (exit $dryExit). Revisa wrangler.jsonc antes de deployar.`n$dryRun"
  exit 1
}
if ($dryRun -notmatch 'env\.ASSETS') {
  Write-Error "ABORTADO: dry-run sin binding env.ASSETS. Revisa wrangler.jsonc antes de deployar.`n$dryRun"
  exit 1
}
Write-Host "Dry-run OK: binding env.ASSETS presente."

# 5. Deploy Cloudflare
$oldEAPDeploy = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npx wrangler deploy
$deployExit = $LASTEXITCODE
$ErrorActionPreference = $oldEAPDeploy
if ($deployExit -ne 0) {
  Write-Error "ABORTADO: wrangler deploy falló (exit $deployExit)."
  exit 1
}

# 6. Health-check post-deploy: sano = 200 en /, 200 en /manifest.json,
#    404 en /worker.js (no exponer código) y 404 (nunca 500) en URL inexistente.
$base = "https://portafolio.lucaslean1806.workers.dev"
$checks = @(
  @{ Path = "/"; Want = 200 },
  @{ Path = "/manifest.json?v=health"; Want = 200 },
  @{ Path = "/worker.js"; Want = 404 },
  @{ Path = "/no-existo-healthcheck"; Want = 404 }
)
$fail = $false
foreach ($c in $checks) {
  $code = [int](curl.exe -s -o NUL -w "%{http_code}" "$base$($c.Path)")
  $ok = ($code -eq $c.Want)
  if (-not $ok) { $fail = $true }
  Write-Host ("{0} -> {1} (esperado {2}) {3}" -f $c.Path, $code, $c.Want, ($(if ($ok) { "OK" } else { "FALLO" })))
}
if ($fail) {
  Write-Error "Health-check con fallos. Revisa Observability -> Logs -> Error (cero scriptThrewException = sano)."
  exit 1
}
Write-Host "Deploy sano: sin scriptThrewException esperado. Verifica en Observability -> Logs -> Error en 5 min."
