<#
  Trien khai Portfolio len Cloudflare Pages (du an "portfolio", ten mien letuanviet.digital).

  VI SAO CAN SCRIPT NAY:
  `wrangler pages deploy .` tai len TAT CA moi thu trong thu muc goc, ke ca tools\ (38 MB gom
  video nguon, RIFE, anh goc), README, package.json, file .bat. Cloudflare Pages KHONG doc
  .gitignore va cung KHONG doc .assetsignore, nen cach duy nhat chac chan la dung mot thu muc
  rieng chi chua dung nhung gi duoc phep cong khai, roi trien khai thu muc do.

  Script dung dist\ lai tu dau moi lan chay, nen khong bao gio con file cu sot lai.

  Chay:  powershell -ExecutionPolicy Bypass -File tools\deploy.ps1
  Chi dung thu (khong day len):  ... -WhatIf

  Luu y: file nay chi dung ky tu ASCII vi PowerShell 5.1 doc .ps1 khong BOM theo bang ma ANSI.
#>
param([switch]$WhatIf, [string]$Message = "")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"

# Chi nhung muc duoi day moi duoc len web. Them gi moi thi them vao day.
$folders = @("assets", "css", "js")
$files = @("index.html", "404.html", "google49ce971bbd8cd1d5.html",
           "_headers", "robots.txt", "sitemap.xml", "manifest.json")

Write-Host ""
Write-Host "  Dung lai thu muc dist ..." -ForegroundColor Cyan
if (Test-Path -LiteralPath $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
New-Item -ItemType Directory -Path $dist | Out-Null

foreach ($f in $folders) {
  $src = Join-Path $root $f
  if (-not (Test-Path -LiteralPath $src)) { Write-Host "    thieu thu muc: $f" -ForegroundColor Yellow; continue }
  Copy-Item -LiteralPath $src -Destination $dist -Recurse -Force
}
foreach ($f in $files) {
  $src = Join-Path $root $f
  if (-not (Test-Path -LiteralPath $src)) { Write-Host "    thieu file: $f" -ForegroundColor Yellow; continue }
  Copy-Item -LiteralPath $src -Destination $dist -Force
}

$count = (Get-ChildItem -LiteralPath $dist -Recurse -File).Count
$size = [math]::Round(((Get-ChildItem -LiteralPath $dist -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "    $count file, $size MB" -ForegroundColor Green

# Canh bao neu co thu bi lot vao ngoai y muon
$leak = Get-ChildItem -LiteralPath $dist -Recurse -File |
  Where-Object { $_.Extension -in ".ps1", ".bat", ".md", ".py", ".exe" -or $_.Name -in "package.json", "package-lock.json" }
if ($leak) {
  Write-Host "    CANH BAO: co file khong nen cong khai trong dist:" -ForegroundColor Red
  $leak | ForEach-Object { "      " + $_.FullName.Substring($dist.Length + 1) }
}

if ($WhatIf) { Write-Host ""; Write-Host "  -WhatIf: dung o day, chua day len." -ForegroundColor Yellow; Write-Host ""; exit 0 }

if (-not $Message) {
  $sha = (& git -C $root rev-parse --short HEAD 2>$null)
  $Message = if ($sha) { "Trien khai $sha" } else { "Trien khai thu cong" }
}

Write-Host ""
Write-Host "  Day len Cloudflare Pages ..." -ForegroundColor Cyan
Push-Location $root
try {
  $env:CI = "1"
  & npx -y wrangler@4 pages deploy dist --project-name=portfolio --branch=main --commit-dirty=true --commit-message=$Message
} finally { Pop-Location }

Write-Host ""
Write-Host "  Xong. Kiem tra: https://letuanviet.digital/" -ForegroundColor Green
Write-Host ""
