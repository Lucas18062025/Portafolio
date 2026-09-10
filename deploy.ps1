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

# 5. Deploy Cloudflare
npx wrangler deploy
