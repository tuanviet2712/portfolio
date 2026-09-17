<#
  Dựng chuỗi khung hình cho Hero: 8 khung gốc -> 169 khung WebP mượt (AI nội suy RIFE, chạy trên GPU/Vulkan).

  Yêu cầu:
    - tools\rife\rife-ncnn-vulkan.exe (kèm thư mục model rife-v4.6) — đã có sẵn trong dự án
    - ffmpeg có libwebp (bản "full" hoặc "lgpl") -> tham số -Ffmpeg

  Cách chạy (PowerShell, trong thư mục Portfolio):
    .\tools\build-sequence.ps1 -Ffmpeg "C:\...\ffmpeg.exe"

  Tuỳ chọn:
    -Steps 24       : số bước giữa 2 khung gốc (24 => 169 khung). 32 => 225 khung, mượt hơn nhưng nặng hơn.
    -Quality 80     : chất lượng WebP (0-100). 80 ~ 60-75KB/khung.
    -EncodeOnly     : bỏ qua bước nội suy, chỉ nén lại WebP từ kết quả lần trước.
    -Uhd            : bật chế độ UHD của RIFE (chuyển động rất lớn). Mặc định tắt.

  Cách hoạt động: với mỗi cặp khung gốc (A, B), gọi RIFE ở từng thời điểm t = k/Steps để tạo khung trung gian
  trực tiếp từ 2 ảnh thật (không nội suy chồng lên khung đã nội suy). Khung gốc được sao chép nguyên bản,
  nên f000, f024, f048... trùng đúng anchor-01..08.

  Sau khi đổi -Steps, cập nhật SEQ.count / SEQ.perAnchor trong js\hero.js (count = 7 * Steps + 1).
#>
param(
  [Parameter(Mandatory = $true)][string]$Ffmpeg,
  [string]$Rife = "",
  [int]$Steps = 24,
  [int]$Quality = 80,
  [switch]$EncodeOnly,
  [switch]$Uhd
)
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $PSScriptRoot "source-frames"
$work = Join-Path $env:TEMP "ltv-hero-rife"
$outDir = Join-Path $work "frames"
$seqDir = Join-Path $root "assets\seq"
if (-not $Rife) { $Rife = Join-Path $PSScriptRoot "rife\rife-ncnn-vulkan.exe" }
New-Item -ItemType Directory -Force $outDir, $seqDir | Out-Null

$anchors = @(Get-ChildItem $src -Filter "anchor-*.png" | Sort-Object Name)
if ($anchors.Count -lt 2) { throw "Không tìm thấy anchor-01.png ... trong $src" }
$total = ($anchors.Count - 1) * $Steps + 1

# RIFE đọc số lẻ theo ngôn ngữ hệ thống (máy tiếng Việt dùng dấu phẩy). Thử "." trước, lỗi thì dùng ",".
function Format-T([double]$t, [string]$sep) { return ([string]::Format([Globalization.CultureInfo]::InvariantCulture, "{0:0.######}", $t)).Replace(".", $sep) }
# Gọi RIFE qua Start-Process để thông báo lỗi của nó không làm dừng script; trả về mã thoát.
$rifeLog = Join-Path $work "rife.log"
function Invoke-Rife([string]$a, [string]$b, [string]$dst, [string]$t, [string[]]$extra) {
  $argv = @("-0", "`"$a`"", "-1", "`"$b`"", "-o", "`"$dst`"", "-s", $t, "-m", "rife-v4.6", "-j", "2:2:2") + $extra
  $pr = Start-Process -FilePath $Rife -ArgumentList $argv -Wait -PassThru -NoNewWindow -RedirectStandardError $rifeLog
  return $pr.ExitCode
}

if (-not $EncodeOnly) {
  if (-not (Test-Path $Rife)) { throw "Không tìm thấy RIFE: $Rife" }
  Get-ChildItem $outDir -File | ForEach-Object { [IO.File]::Delete($_.FullName) }
  $extra = @(); if ($Uhd) { $extra += "-u" }

  # dò dấu thập phân
  $probe = Join-Path $work "probe.png"
  if (Test-Path $probe) { [IO.File]::Delete($probe) }
  $sep = "."
  $code = Invoke-Rife $anchors[0].FullName $anchors[1].FullName $probe (Format-T 0.5 ".") $extra
  if ($code -ne 0 -or -not (Test-Path $probe)) {
    $sep = ","
    $code = Invoke-Rife $anchors[0].FullName $anchors[1].FullName $probe (Format-T 0.5 ",") $extra
    if ($code -ne 0 -or -not (Test-Path $probe)) { throw "RIFE không chạy được (mã $code). Kiểm tra GPU/Vulkan: `"$Rife`" -h" }
  }
  Write-Host "1/2  Nội suy AI (RIFE): $($anchors.Count) khung gốc -> $total khung, dấu thập phân '$sep' ... (~10 phút)"

  $sw = [Diagnostics.Stopwatch]::StartNew()
  for ($p = 0; $p -lt $anchors.Count - 1; $p++) {
    $a = $anchors[$p].FullName; $b = $anchors[$p + 1].FullName
    Copy-Item $a (Join-Path $outDir ("f{0:D3}.png" -f ($p * $Steps))) -Force
    for ($k = 1; $k -lt $Steps; $k++) {
      $dst = Join-Path $outDir ("f{0:D3}.png" -f ($p * $Steps + $k))
      $t = Format-T ($k / $Steps) $sep
      $code = Invoke-Rife $a $b $dst $t $extra
      if ($code -ne 0 -or -not (Test-Path $dst)) { throw "RIFE lỗi ở cặp $($p+1)->$($p+2), t=$t (mã $code). Xem $rifeLog" }
    }
    Write-Host ("     cặp {0}->{1} xong  ({2:n0}s)" -f ($p + 1), ($p + 2), $sw.Elapsed.TotalSeconds)
  }
  Copy-Item $anchors[-1].FullName (Join-Path $outDir ("f{0:D3}.png" -f ($total - 1))) -Force
}

Write-Host "2/2  Nén WebP (q=$Quality)..."
Get-ChildItem $seqDir -Filter "f*.webp" | ForEach-Object { [IO.File]::Delete($_.FullName) }
Get-ChildItem $outDir -Filter "f*.png" | Sort-Object Name | ForEach-Object {
  $dst = Join-Path $seqDir ($_.BaseName + ".webp")
  & $Ffmpeg -hide_banner -loglevel error -y -i $_.FullName -c:v libwebp -q:v $Quality -compression_level 6 -preset photo $dst
}
$n = (Get-ChildItem $seqDir -Filter "f*.webp").Count
$mb = [math]::Round(((Get-ChildItem $seqDir -Filter "f*.webp" | Measure-Object Length -Sum).Sum / 1MB), 2)
Write-Host "Xong: $n khung, tổng $mb MB -> $seqDir"
Write-Host "js\hero.js cần: SEQ.count = $n, SEQ.perAnchor = $Steps"
