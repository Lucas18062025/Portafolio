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

# 0d. Guardia: docs internos .md no deben exponerse como assets públicos.
#     AGENTS.md/SECURITY.md/TEST_PLAN.md/TOOLS.md/specs revelan pipeline y secretos
#     (hallazgo oct-2026: respondían 200 en producción).
foreach ($doc in @("AGENTS.md", "SECURITY.md", "TEST_PLAN.md", "TOOLS.md")) {
  $esc = [regex]::Escape($doc)
  if (-not (Select-String -Path ./.assetsignore -Pattern "^$esc$" -Quiet)) {
    Write-Error "ABORTADO: falta `$doc` en .assetsignore. Los docs internos quedarían descargables en /$doc."
    exit 1
  }
}
foreach ($pat in @("^specs$", "^specs/\*\*$")) {
  if (-not (Select-String -Path ./.assetsignore -Pattern $pat -Quiet)) {
    Write-Error "ABORTADO: falta `specs/` en .assetsignore. Los specs quedarían descargables."
    exit 1
  }
}

# 0e. Guardia T9: cache-bust de CSS/JS.
#     El CDN de Cloudflare ignora el query string en la clave de cache, asi que
#     cambiar el contenido de css/*.css sin bumpear su ?v=N en el HTML que lo
#     referencia NO llega a produccion: el deploy sube el archivo nuevo pero el
#     edge y el navegador siguen con la version vieja. Sin error visible (T5 pasa).
#     Caso real 20/10: la cadencia del blink del robot cambio de 5,2 s a 2,2 s,
#     el deploy fue verde y el navegador seguia midiendo 5,2 s.
$oldEAPT9 = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$cssChanged = @(git diff --name-only HEAD -- "*.css" "*.js" 2>$null)
$ErrorActionPreference = $oldEAPT9
if ($cssChanged.Count -gt 0) {
  # Para cada CSS/JS cambiado: se busca el HTML que lo referencia y se compara
  # el ?v=N de ESA referencia entre HEAD y el working tree.
  $t9Bad = @()
  foreach ($f in $cssChanged) {
    $base = [System.IO.Path]::GetFileName($f)
    $htmls = Get-ChildItem -Path . -Filter "*.html" -Recurse -File |
      Where-Object { $_.FullName -notmatch '\\(node_modules|docs|specs|\.git)\\' }
    foreach ($h in $htmls) {
      $newLine = (Get-Content $h.FullName | Select-String -SimpleMatch $base | Select-Object -First 1)
      if (-not $newLine) { continue }
      $newV = [regex]::Match($newLine.Line, '\?v=(\d+)').Groups[1].Value
      $hRel = $h.FullName.Substring((Get-Location).Path.Length + 1) -replace '\\', '/'
      $oldHtml = @(git show "HEAD:$hRel" 2>$null)
      $oldLine = ($oldHtml | Select-String -SimpleMatch $base | Select-Object -First 1)
      $oldV = if ($oldLine) { [regex]::Match($oldLine.Line, '\?v=(\d+)').Groups[1].Value } else { "" }
      if ($oldV -ne $newV) {
        Write-Host "T9 OK: $f cambio el ?v=N en $hRel ($oldV -> $newV). Cache invalidada."
      } else {
        $t9Bad += "$f referenciado en $hRel sin cambiar el ?v=N (sigue en $newV)"
      }
    }
  }
  if ($t9Bad.Count -gt 0) {
    Write-Error "ABORTADO (T9): cambio de contenido sin bumpear el ?v=N en el HTML:`n  $($t9Bad -join "`n  ")`nEl CDN ignora el query string en la clave de cache: el cambio no llegaria a produccion. Bump el ?v=N del <link> y volve a correr."
    exit 1
  }
}

# 1. Ver qué cambió
#    Nota: los comandos nativos (git.exe) escriben avisos por stderr aun con exit 0
#    (p. ej. "warning: LF will be replaced by CRLF" al tocar un .yml). Con
#    $ErrorActionPreference="Stop" eso abortaba el script. Se aisla a "Continue" y
#    se decide por $LASTEXITCODE, igual que en el push (4), el dry-run (4b) y el
#    deploy (5).
$oldEAPGit = $ErrorActionPreference
$ErrorActionPreference = "Continue"
git status --short
git diff --stat

# 2-3. Staging + commit (si hay cambios)
$changes = git status --porcelain
if ($changes) {
  git add .
  if ($LASTEXITCODE -ne 0) { $ErrorActionPreference = $oldEAPGit; Write-Error "ABORTADO: git add falló (exit $LASTEXITCODE)."; exit 1 }
  git commit -m $Message
  if ($LASTEXITCODE -ne 0) { $ErrorActionPreference = $oldEAPGit; Write-Error "ABORTADO: git commit falló (exit $LASTEXITCODE)."; exit 1 }
} else {
  Write-Host "Sin cambios para commitear."
}

# 4. Push
#     Nota: `git push` escribe a stderr aun con exit 0 (p. ej. "Everything up-to-date"
#     cuando el arbol esta limpio y la rama al dia). Se aisla igual que arriba.
#
#     Push DIRECTO a `main` = bypass intencional del ruleset `protect-main`
#     (creado 20/07/2026, enforcement: active, reglas: pull_request,
#     required_signatures, creation, deletion, non_fast_forward).
#     El owner tiene `bypass_mode: always`, asi que GitHub ACEPTA el push y
#     devuelve "Bypassed rule violations for refs/heads/main". No es un error
#     del push: el push sale con exit 0 y el deploy sigue.
#     Lo que el bypass NO cubre es `required_signatures`: el commit tiene que
#     ir firmado o GitHub lo rechaza. Por eso este script no toca la signing
#     key y hereda `commit.gpgsign=true` de la config del repo.
#     Convencion (ver AGENTS.md): cambios CHICOS van por este script (push
#     directo, bypass del owner); cambios GRANDES van por rama `feat/...` + PR
#     + merge, para no depender del bypass.
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$ErrorActionPreference = $oldEAPGit
$oldEAPPush = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$pushOut = git push origin $branch 2>&1 | Out-String
$pushExit = $LASTEXITCODE
$ErrorActionPreference = $oldEAPPush
if ($pushExit -ne 0) {
  Write-Error "ABORTADO: git push fallo (exit $pushExit).`n$pushOut"
  exit 1
}
Write-Host $pushOut.Trim()

# 4b. Dry-run: el Worker debe ver el binding ASSETS. Si sale vacío, no deployar.
#     Nota: npx escribe avisos por stderr aun con exit 0; con $ErrorActionPreference="Stop"
#     eso abortaría como falso fallo. Se aísla a "Continue" y se decide por $LASTEXITCODE.
#     Wrangler pineado a 4.136.3 (fix M1 16/10: `npx wrangler` solo trae la última
#     versión y cambia el comportamiento según el día; el crash 0xC0000409 del
#     4.151.1 tumbó un deploy).
$oldEAPDry = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$dryRun = npx --yes wrangler@4.136.3 deploy --dry-run 2>&1 | Out-String
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

# 5. Deploy Cloudflare (wrangler pineado, ver nota M1 en 4b).
$oldEAPDeploy = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npx --yes wrangler@4.136.3 deploy
$deployExit = $LASTEXITCODE
$ErrorActionPreference = $oldEAPDeploy
if ($deployExit -ne 0) {
  Write-Error "ABORTADO: wrangler deploy falló (exit $deployExit)."
  exit 1
}

# 6. Health-check post-deploy: sano = 200 en /, 200 en /manifest.json,
#    404 en /worker.js (no exponer código) y 404 (nunca 500) en URL inexistente.
#    Además: la página del set visual Flow 200 + 1 WebP y 1 MP4 del kit 200.
#    Sus 32 assets no los referencia ninguna otra página: si se rompen, nada
#    más lo delata.
$base = "https://portafolio.lucaslean1806.workers.dev"
$checks = @(
  @{ Path = "/"; Want = 200 },
  @{ Path = "/manifest.json?v=health"; Want = 200 },
  @{ Path = "/worker.js"; Want = 404 },
  @{ Path = "/no-existo-healthcheck"; Want = 404 },
  @{ Path = "/blog/visual-field-notes/"; Want = 200 },
  @{ Path = "/assets/blog/flow/cybersecurity-analyst-viewing-mo-640.webp"; Want = 200 },
  @{ Path = "/assets/blog/flow/holographic-world-map-pulses-red.mp4"; Want = 200 }
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

# 7. T10: colector CSP. El endpoint aceptaba solo application/json (que ningun
#    navegador manda) -> todo reporte real caia en 415 y el colector era un
#    sensor apagado. Se verifican los 3 content-types validos, los rechazos y
#    la cabecera Reporting-Endpoints (que Chrome 96+ exige con URL absoluta).
Write-Host ""
Write-Host "T10 - colector CSP:"
$cspUrl = "$base/api/csp-report"
# Los bodies JSON van por archivo temporal: PowerShell al pasar un string con
# comillas dobles a un ejecutable nativo (curl.exe) se las come y el body llega
# como {csp-report:{...}}, que no es JSON valido -> 400 falso. Con
# --data-binary @archivo el body llega integro.
$cspTmp = Join-Path $env:TEMP "csp-gate"
New-Item -ItemType Directory -Force -Path $cspTmp | Out-Null
# Sin BOM: Windows PowerShell 5.1 escribe BOM con -Encoding UTF8, y JSON.parse
# rechaza un body que empieza con BOM (verificado: 400 con BOM, 204 sin BOM).
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$l2Body = '{"csp-report":{"document-uri":"https://portafolio.lucaslean1806.workers.dev/","violated-directive":"script-src","blocked-uri":"inline","status-code":200}}'
$v1Body = '[{"type":"csp-violation","body":{"documentURL":"https://portafolio.lucaslean1806.workers.dev/","effectiveDirective":"script-src","blockedURL":"inline","statusCode":200}}]'
$badBody = '{"foo":1}'
$bigBody = '{"csp-report":{"document-uri":"' + ('x' * 9000) + '"}}'
[System.IO.File]::WriteAllText("$cspTmp\l2.json", $l2Body, $utf8NoBom)
[System.IO.File]::WriteAllText("$cspTmp\v1.json", $v1Body, $utf8NoBom)
[System.IO.File]::WriteAllText("$cspTmp\bad.json", $badBody, $utf8NoBom)
[System.IO.File]::WriteAllText("$cspTmp\big.json", $bigBody, $utf8NoBom)
$cspChecks = @(
  @{ Name = "POST application/csp-report (L2)"; Code = [int](curl.exe -s -o NUL -w "%{http_code}" -X POST -H "Content-Type: application/csp-report" --data-binary "@$cspTmp\l2.json" $cspUrl); Want = 204 },
  @{ Name = "POST application/reports+json (v1)"; Code = [int](curl.exe -s -o NUL -w "%{http_code}" -X POST -H "Content-Type: application/reports+json" --data-binary "@$cspTmp\v1.json" $cspUrl); Want = 204 },
  @{ Name = "POST application/json (L2)"; Code = [int](curl.exe -s -o NUL -w "%{http_code}" -X POST -H "Content-Type: application/json" --data-binary "@$cspTmp\l2.json" $cspUrl); Want = 204 },
  @{ Name = "POST text/plain (rechazado)"; Code = [int](curl.exe -s -o NUL -w "%{http_code}" -X POST -H "Content-Type: text/plain" --data-binary "@$cspTmp\l2.json" $cspUrl); Want = 415 },
  @{ Name = "POST shape invalido"; Code = [int](curl.exe -s -o NUL -w "%{http_code}" -X POST -H "Content-Type: application/json" --data-binary "@$cspTmp\bad.json" $cspUrl); Want = 400 },
  @{ Name = "POST body > 8KB"; Code = [int](curl.exe -s -o NUL -w "%{http_code}" -X POST -H "Content-Type: application/json" --data-binary "@$cspTmp\big.json" $cspUrl); Want = 413 },
  @{ Name = "GET (405 + Allow: POST)"; Code = [int](curl.exe -s -o NUL -w "%{http_code}" $cspUrl); Want = 405 }
)
$cspFail = $false
foreach ($c in $cspChecks) {
  $ok = ($c.Code -eq $c.Want)
  if (-not $ok) { $cspFail = $true }
  Write-Host ("  {0} -> {1} (esperado {2}) {3}" -f $c.Name, $c.Code, $c.Want, ($(if ($ok) { "OK" } else { "FALLO" })))
}
# Allow: POST tiene que estar en el 405 (RFC 9110) y Reporting-Endpoints con
# URL absoluta en / (Chrome ignora el endpoint si la URL es relativa).
$allowHeader = curl.exe -s -D - -o NUL -X GET $cspUrl | Select-String -Pattern "^allow:" -CaseSensitive:$false
if ($allowHeader -and $allowHeader -match "POST") {
  Write-Host "  405 incluye 'Allow: POST' OK"
} else {
  Write-Host "  405 NO incluye 'Allow: POST' FALLO"
  $cspFail = $true
}
$reporting = curl.exe -s -D - -o NUL "$base/" | Select-String -Pattern "^reporting-endpoints:" -CaseSensitive:$false
if ($reporting -and $reporting -match 'https://') {
  Write-Host "  Reporting-Endpoints con URL absoluta OK"
} else {
  Write-Host "  Reporting-Endpoints ausente o con URL relativa FALLO"
  $cspFail = $true
}
if ($cspFail) {
  Write-Error "T10 FALLO: el colector CSP no responde como debe. Revisar worker.js y _headers."
  exit 1
}
Write-Host "T10 OK: colector CSP sano."

Write-Host "Deploy sano: sin scriptThrewException esperado. Verifica en Observability -> Logs -> Error en 5 min."
