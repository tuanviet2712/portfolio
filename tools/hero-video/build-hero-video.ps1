<#
  Dựng dữ liệu hero "video tua theo cuộn" từ một clip AI (mp4) -> assets\hero\seq\

  Quy trình (build_seq.py):
    1. ffmpeg tách khung hình (BT.709, chroma đầy đủ)      2. đo chuyển động -> bảng map cuộn đều
    3. ước lượng khuôn mặt (rembg BiRefNet) -> đường focus   4. nén WebP bộ full + bộ tall (điện thoại)
    5. poster.jpg + scene.js (manifest cho js\hero.js)

  Cách chạy (PowerShell, trong thư mục Portfolio):
    .\tools\hero-video\build-hero-video.ps1                       # dùng tools\hero-video\source.mp4
    .\tools\hero-video\build-hero-video.ps1 -Src "C:\clip.mp4" -Ffmpeg "C:\ffmpeg\bin\ffmpeg.exe"
  Tuỳ chọn:
    -Q 82 / -QTall 80   : chất lượng WebP (bộ full / bộ tall)
    -Mix 0.65           : 0 = cuộn đều theo thời gian clip, 1 = đều hoàn toàn theo chuyển động
    -Clean              : xoá work\ (đo lại chuyển động + khuôn mặt)
  Yêu cầu: ffmpeg + ffprobe (cùng thư mục), Python 3.10+ (dùng chung .venv với tools\hero3d — tạo tự động nếu chưa có).
  Clip nên: 16:9, 1080p, 24–30 fps, 8–10 giây, MỘT cú máy liên tục, không cắt cảnh, không chữ/watermark.
#>
param(
  [string]$Src = "",
  [string]$Out = "",
  [string]$Ffmpeg = "ffmpeg",
  [int]$Q = 82,
  [int]$QTall = 80,
  [double]$Mix = 0.65,
  [switch]$Clean
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here "..\..")
$work = Join-Path $here "work"
$venv = Join-Path $here "..\hero3d\.venv"
$py = Join-Path $venv "Scripts\python.exe"
if (-not $Src) { $Src = Join-Path $here "source.mp4" }
if (-not $Out) { $Out = Join-Path $root "assets\hero\seq" }
if (-not (Test-Path $Src)) { throw "Không thấy clip: $Src" }
if ($Clean -and (Test-Path $work)) { Remove-Item -Recurse -Force $work }

if (-not (Test-Path $py)) {
  Write-Host "Tạo môi trường Python (tools\hero3d\.venv) ..."
  $uv = Get-Command uv -ErrorAction SilentlyContinue
  if ($uv) { & uv venv $venv --python 3.12 } else { & python -m venv $venv }
  $pip = if ($uv) { @("uv", "pip", "install", "--python", $py) } else { @($py, "-m", "pip", "install") }
  & $pip[0] $pip[1..($pip.Length - 1)] torch torchvision --index-url https://download.pytorch.org/whl/cpu
  & $pip[0] $pip[1..($pip.Length - 1)] -r (Join-Path $here "..\hero3d\requirements.txt")
}
$env:PYTHONIOENCODING = "utf-8"
$env:NUMBA_CACHE_DIR = Join-Path $env:TEMP "nbc"

Write-Host "== Dựng chuỗi khung hero từ $Src ==" -ForegroundColor Cyan
Push-Location $here
try {
  $argv = @("build_seq.py", "--src", "`"$Src`"", "--out", "`"$Out`"", "--work", "`"$work`"", "--ffmpeg", "`"$Ffmpeg`"", "--q", "$Q", "--qtall", "$QTall", "--mix", "$Mix")
  $p = Start-Process -FilePath $py -ArgumentList $argv -NoNewWindow -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "build_seq.py lỗi (mã $($p.ExitCode))" }
} finally { Pop-Location }
Write-Host ""
Write-Host "Xong: $Out — mở index.html?skip&herodebug rồi gõ  LTV.heroDebug.state()  trong Console để kiểm tra." -ForegroundColor Green
