<#
  (Bản hero cũ — trang hiện dùng video tua theo cuộn: xem tools\hero-video\build-hero-video.ps1. Dữ liệu ở đây chỉ dùng cho ?hero=3d.)
  Dựng dữ liệu hero 3D từ MỘT ảnh gốc (mặc định) — hoặc chuỗi khung hình theo quy trình cũ (-Sequence).

  Quy trình mặc định (mỗi bước bỏ qua nếu đã có kết quả trong work\):
    1. prep.py      : tách người (BiRefNet) · vẽ lại nền sau lưng người (LaMa) · độ sâu (MoGe-2)
    2. ext.py       : vẽ mở rộng ảnh ra ngoài khung (LaMa) · ext_alpha.py : alpha người ở phần mở rộng
    3. layers.py    : lớp độ sâu nền / người, mặt nạ trời · sky.py : lớp trời ở vô cực
    4. export_web.py: xuất texture + độ sâu 16-bit + scene.js/bundle.js -> assets\hero\a0N\  (js\hero.js dựng thời gian thực)

  Cách chạy (PowerShell, trong thư mục Portfolio):
    .\tools\hero3d\build-hero3d.ps1 -Anchor 8 -EyeX 538 -EyeY 364
  Tuỳ chọn:
    -Anchor 8          : ảnh gốc dùng cho hero (tools\source-frames\anchor-08.png)
    -EyeX / -EyeY      : tâm hai mắt (px, trên ảnh gốc) để camera nhìn đúng mặt; bỏ trống = tự ước lượng
    -Out <thư mục>     : nơi ghi dữ liệu (mặc định assets\hero\a0N). Đổi DEFAULT_SRC trong js\hero.js nếu dùng tên khác
    -Clean             : xoá work\ để tính lại từ đầu (khi thay ảnh gốc)
    -Sequence          : chạy thêm quy trình cũ (poses → render → RIFE → 253 khung WebP vào assets\seq), cần -Ffmpeg
    -Per 36 / -Quality 80 : tham số của quy trình cũ

  Yêu cầu: Python 3.10+ (khuyên dùng uv), ~4 GB dung lượng cho model (tải tự động lần đầu), GPU hỗ trợ OpenGL 3.3 (chỉ cho -Sequence).
  Thời gian: ~15 phút lần đầu trên CPU (tách người + MoGe + LaMa cho 8 ảnh); các lần sau chỉ vài chục giây.
#>
param(
  [int]$Anchor = 8,
  [double]$EyeX = -1,
  [double]$EyeY = -1,
  [string]$Out = "",
  [switch]$Clean,
  [switch]$Sequence,
  [string]$Ffmpeg = "ffmpeg",
  [int]$Per = 36,
  [int]$Quality = 80
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here "..\..")
$work = Join-Path $here "work"
$venv = Join-Path $here ".venv"
$py = Join-Path $venv "Scripts\python.exe"
if (-not $Out) { $Out = Join-Path $root ("assets\hero\a{0:d2}" -f $Anchor) }
# Toạ độ mắt đã đo cho bộ ảnh hiện tại (px trên ảnh gốc 1672x941); ảnh khác thì truyền -EyeX/-EyeY
$knownEyes = @{ 7 = @(618, 268); 8 = @(538, 364) }
if ($EyeX -lt 0 -and $knownEyes.ContainsKey($Anchor)) { $EyeX = $knownEyes[$Anchor][0]; $EyeY = $knownEyes[$Anchor][1] }

if ($Clean -and (Test-Path $work)) { Remove-Item -Recurse -Force $work }
New-Item -ItemType Directory -Force (Join-Path $work "prep") | Out-Null

# ---------- môi trường Python ----------
if (-not (Test-Path $py)) {
  Write-Host "Tạo môi trường Python (.venv) ..."
  $uv = Get-Command uv -ErrorAction SilentlyContinue
  if ($uv) { & uv venv $venv --python 3.12 } else { & python -m venv $venv }
  $pip = if ($uv) { @("uv", "pip", "install", "--python", $py) } else { @($py, "-m", "pip", "install") }
  & $pip[0] $pip[1..($pip.Length - 1)] torch torchvision --index-url https://download.pytorch.org/whl/cpu
  & $pip[0] $pip[1..($pip.Length - 1)] -r (Join-Path $here "requirements.txt")
  & $pip[0] $pip[1..($pip.Length - 1)] --no-deps simple-lama-inpainting
}
$env:PYTHONIOENCODING = "utf-8"
$env:NUMBA_CACHE_DIR = Join-Path $env:TEMP "nbc"

function Step($name, $argv) {
  Write-Host ""
  Write-Host "== $name ==" -ForegroundColor Cyan
  Push-Location $here
  try {
    $p = Start-Process -FilePath $py -ArgumentList $argv -NoNewWindow -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "$name lỗi (mã $($p.ExitCode))" }
  } finally { Pop-Location }
}
Step "1/4 Tách người · vẽ nền · độ sâu" @("prep.py", "all")
Step "2/4 Mở rộng khung ảnh" @("ext.py")
Step "2/4 Mở rộng khung ảnh (alpha)" @("ext_alpha.py")
Step "3/4 Lớp độ sâu + mặt nạ trời" @("layers.py")
Step "3/4 Lớp bầu trời" @("sky.py")

# ---------- xuất dữ liệu cho hero WebGL ----------
$argv = @("export_web.py", "--anchor", "$Anchor", "--out", "`"$Out`"")
if ($EyeX -ge 0) { $argv += @("--eyex", "$EyeX") }
if ($EyeY -ge 0) { $argv += @("--eyey", "$EyeY") }
Step "4/4 Xuất dữ liệu hero (assets\hero)" $argv
Write-Host ""
Write-Host "Xong: dữ liệu hero trong $Out" -ForegroundColor Green
Write-Host "Kiểm tra: mở index.html?skip&herodebug rồi gõ  await LTV.heroDebug.sweep()  trong Console (max nên = 0)."
if (-not $Sequence) { exit 0 }

# ======================================================================================
#  QUY TRÌNH CŨ (-Sequence): 8 ảnh -> đường camera qua 8 vị trí -> 253 khung WebP (trang không còn dùng)
# ======================================================================================
$seq = Join-Path $root "assets\seq"
Step "Vị trí camera 8 ảnh" @("poses.py")
$frames = Join-Path $work "frames"
if (Test-Path $frames) { Remove-Item -Recurse -Force $frames }
Step "Dựng hình 3D" @("render.py", "--per", "$Per", "--noflow", "--pairs", "--blend", "0.2,0.8", "--out", "`"$frames`"")

# đoạn chuyển giữa 2 ảnh gốc: RIFE nội suy trên cặp ảnh ĐÃ CĂN (cùng camera)
Write-Host ""
Write-Host "== Nội suy đoạn chuyển (RIFE) ==" -ForegroundColor Cyan
$rife = Join-Path $root "tools\rife\rife-ncnn-vulkan.exe"
$model = Join-Path $root "tools\rife\rife-v4.6"
$sep = $null
Get-ChildItem $frames -Filter "p*.w" | Sort-Object Name | ForEach-Object {
  $f = $_.BaseName.Substring(1)
  $w = [double]::Parse((Get-Content $_.FullName), [Globalization.CultureInfo]::InvariantCulture)
  $a = Join-Path $frames "p${f}_a.png"; $b = Join-Path $frames "p${f}_b.png"; $o = Join-Path $frames "f$f.png"
  # RIFE đọc số thập phân theo ngôn ngữ máy (vi-VN dùng dấu phẩy) => thử cả hai
  $cands = if ($sep) { @($sep) } else { @(",", ".") }
  $ok = $false
  foreach ($s in $cands) {
    $ws = $w.ToString("0.#####", [Globalization.CultureInfo]::InvariantCulture).Replace(".", $s)
    $p = Start-Process -FilePath $rife -ArgumentList @("-0", "`"$a`"", "-1", "`"$b`"", "-o", "`"$o`"", "-s", $ws, "-m", "`"$model`"") -NoNewWindow -Wait -PassThru -RedirectStandardError (Join-Path $work "rife_err.txt")
    if ($p.ExitCode -eq 0) { $sep = $s; $ok = $true; break }
  }
  if (-not $ok) { throw "RIFE lỗi ở khung $f (xem work\rife_err.txt)" }
}

# nén WebP
Write-Host ""
Write-Host "== Nén WebP (q=$Quality) ==" -ForegroundColor Cyan
New-Item -ItemType Directory -Force $seq | Out-Null
Get-ChildItem $seq -Filter "f*.webp" | ForEach-Object { [IO.File]::Delete($_.FullName) }
$p = Start-Process -FilePath $Ffmpeg -ArgumentList @("-hide_banner", "-loglevel", "error", "-y", "-i", "`"$frames\f%03d.png`"",
  "-c:v", "libwebp", "-q:v", "$Quality", "-compression_level", "6", "-preset", "photo", "-start_number", "0", "`"$seq\f%03d.webp`"") -NoNewWindow -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "ffmpeg lỗi (cần bản có libwebp)" }
$n = (Get-ChildItem $seq -Filter "f*.webp").Count
$mb = [math]::Round(((Get-ChildItem $seq -Filter "f*.webp" | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host ""
Write-Host "Xong: $n khung ($mb MB) trong assets\seq (chỉ để tham khảo; js\hero.js hiện dùng assets\hero)." -ForegroundColor Green
