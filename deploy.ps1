# Automatiza: git add + commit + push + wrangler deploy
# Uso: .\deploy.ps1 -Message "feat: actualizo portfolio"
param([string]$Message = "update: deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')")

$ErrorActionPreference = "Stop"

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
