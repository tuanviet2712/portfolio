<#
  Trien khai Portfolio len Cloudflare Pages (du an "portfolio", ten mien letuanviet.com).

  VI SAO CAN SCRIPT NAY:
  `wrangler pages deploy .` tai len TAT CA moi thu trong thu muc goc, ke ca tools\ (38 MB gom
  video nguon, RIFE, anh goc), README, package.json, file .bat. Cloudflare Pages KHONG doc
  .gitignore va cung KHONG doc .assetsignore, nen cach duy nhat chac chan la dung mot thu muc
  rieng chi chua dung nhung gi duoc phep cong khai, roi trien khai thu muc do.

  Script dung dist\ lai tu dau moi lan chay, nen khong bao gio con file cu sot lai.

  Chay:  powershell -ExecutionPolicy Bypass -File tools\deploy.ps1
  Chi dung thu (khong day len):  ... -WhatIf
  Bao cho Bing/Yandex/Naver... (IndexNow) moi URL trong sitemap sau khi day len:  ... -IndexNow
    (chi dung khi co bai moi hoac noi dung doi dang ke; gui lai URL khong doi nhieu lan bi ha uu tien)

  Luu y: file nay chi dung ky tu ASCII vi PowerShell 5.1 doc .ps1 khong BOM theo bang ma ANSI.
#>
param([switch]$WhatIf, [switch]$IndexNow, [string]$Message = "")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"

# Khoa IndexNow: tep <khoa>.txt o goc web chua dung chuoi nay, de cong cu tim kiem xac minh chu so huu
$indexNowKey = "99b63334b27518ca1fd2d0022cdfce46"

# Node khong nam trong PATH tren may nay: tim npx.cmd o mot thu muc cap 1 cua o D: (giong TAO-GOC-KIEN-THUC.bat)
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  $nodeDir = Get-ChildItem -LiteralPath "D:\" -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "npx.cmd") } | Select-Object -First 1
  if ($nodeDir) { $env:Path = $nodeDir.FullName + ";" + $env:Path }
}

# Chi nhung muc duoi day moi duoc len web. Them gi moi thi them vao day.
$folders = @("assets", "css", "js", "goc-kien-thuc", ".well-known")
$files = @("index.html", "404.html", "google49ce971bbd8cd1d5.html",
           "_headers", "robots.txt", "sitemap.xml", "manifest.json", "llms.txt",
           "favicon.ico", "$indexNowKey.txt")

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

# Gan ma phien ban (?v=ma bam noi dung) vao moi tham chieu css/js trong cac trang HTML cua dist.
# VI SAO: Cloudflare Pages cho trinh duyet giu css/js 4 gio, con HTML thi luon tai moi. Khach vua xem
# trang truoc khi trien khai se nhan HTML moi chay voi css/js CU (loi 30/09/2026: chu "xin chao" khong
# duoc ve vi HTML moi can quy tac CSS moi). Doi dia chi theo noi dung thi HTML moi luon keo dung tep moi,
# tep nao khong doi thi giu nguyen ma nen van dung lai duoc bo nho dem. Tep nguon khong bi sua.
# Bo qua assets/ (scene.js cua hero duoc hero.js tu nap theo dia chi khong co ma, phai khop voi preload).
$utf8 = New-Object System.Text.UTF8Encoding($false)
$sha1 = [System.Security.Cryptography.SHA1]::Create()
$verCache = @{}
$verStat = @{ refs = 0; pages = 0 }
$verRx = [regex]'(?<=\b(?:href|src)=")(?!https?:|//|data:)[^"?#]+\.(?:css|js)(?=")'
foreach ($page in Get-ChildItem -LiteralPath $dist -Recurse -File -Filter *.html) {
  $html = [IO.File]::ReadAllText($page.FullName, $utf8)
  $pageDir = $page.DirectoryName
  $stamped = $verRx.Replace($html, [System.Text.RegularExpressions.MatchEvaluator]{
    param($m)
    $url = $m.Value
    if ($url -match '(^|/)assets/') { return $url }
    $base = if ($url.StartsWith('/')) { $dist } else { $pageDir }
    $file = [IO.Path]::GetFullPath((Join-Path $base $url.TrimStart('/')))
    if (-not [IO.File]::Exists($file)) { return $url }
    if (-not $verCache.ContainsKey($file)) {
      $bytes = $sha1.ComputeHash([IO.File]::ReadAllBytes($file))
      $verCache[$file] = -join ($bytes[0..3] | ForEach-Object { $_.ToString('x2') })
    }
    $verStat.refs++
    return $url + '?v=' + $verCache[$file]
  })
  if ($stamped -ne $html) { [IO.File]::WriteAllText($page.FullName, $stamped, $utf8); $verStat.pages++ }
}
Write-Host "    gan ma phien ban: $($verStat.refs) tham chieu css/js trong $($verStat.pages) trang" -ForegroundColor Green

$count = (Get-ChildItem -LiteralPath $dist -Recurse -File).Count
$size = [math]::Round(((Get-ChildItem -LiteralPath $dist -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "    $count file, $size MB" -ForegroundColor Green

# Canh bao neu co thu bi lot vao ngoai y muon
$leak = Get-ChildItem -LiteralPath $dist -Recurse -File |
  Where-Object { $_.Extension -in ".ps1", ".bat", ".md", ".py", ".exe", ".cjs", ".map", ".pem", ".key", ".sql", ".zip" -or $_.Name -in "package.json", "package-lock.json" -or $_.Name -like ".env*" }
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
  if ($LASTEXITCODE -ne 0) { throw "wrangler pages deploy that bai (ma $LASTEXITCODE)" }
} finally { Pop-Location }

if ($IndexNow) {
  $urls = @([regex]::Matches([IO.File]::ReadAllText((Join-Path $root "sitemap.xml"), $utf8), '<url>\s*<loc>([^<]+)</loc>') | ForEach-Object { $_.Groups[1].Value })
  $body = @{ host = "letuanviet.com"; key = $indexNowKey; keyLocation = "https://letuanviet.com/$indexNowKey.txt"; urlList = $urls } | ConvertTo-Json -Compress
  Write-Host ""
  Write-Host "  Gui $($urls.Count) URL toi IndexNow ..." -ForegroundColor Cyan
  try {
    $r = Invoke-WebRequest -Uri "https://api.indexnow.org/indexnow" -Method Post -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body)) -UseBasicParsing
    Write-Host "    IndexNow tra ve $($r.StatusCode) (200/202 la da nhan)" -ForegroundColor Green
  } catch { Write-Host "    IndexNow loi: $($_.Exception.Message)" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "  Xong. Kiem tra: https://letuanviet.com/" -ForegroundColor Green
Write-Host ""
