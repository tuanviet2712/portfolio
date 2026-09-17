<#
  Máy chủ localhost cho Portfolio (không cần Python/Node).
  - Phục vụ file tĩnh với đúng MIME type, tắt cache (sửa là thấy ngay)
  - Live reload: tự tải lại trình duyệt khi bạn lưu file .html/.css/.js/ảnh
  Chạy:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 5500] [-NoOpen]
  Dừng:  Ctrl + C (hoặc đóng cửa sổ)
#>
param([int]$Port = 5500, [switch]$NoOpen)

$root = Split-Path -Parent $PSScriptRoot
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
  '.webp' = 'image/webp'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.png' = 'image/png'; '.gif' = 'image/gif'
  '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.pdf' = 'application/pdf'; '.mp4' = 'video/mp4'; '.webm' = 'video/webm'
  '.woff' = 'font/woff'; '.woff2' = 'font/woff2'
}
$reloadJs = @"
<script>/* live reload (chỉ có khi chạy localhost) */
(function(){var v=null;setInterval(function(){fetch('/__livereload',{cache:'no-store'}).then(function(r){return r.text()}).then(function(t){if(v===null)v=t;else if(t!==v)location.reload()}).catch(function(){})},900)})();
</script>
"@

# Dau thoi gian cho live reload: chi doc thu muc chua ma nguon (goc, css, js).
# KHONG duyet de quy ca du an: assets\hero co hang tram khung hinh, moi lan quet lam may chu dung ~0,5 s.
function Get-Stamp {
  $max = 0
  foreach ($d in @($root, (Join-Path $root "css"), (Join-Path $root "js"))) {
    Get-ChildItem -LiteralPath $d -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Extension -in '.html', '.css', '.js' } |
      ForEach-Object { $t = $_.LastWriteTimeUtc.Ticks; if ($t -gt $max) { $max = $t } }
  }
  return "$max"
}

# tìm cổng trống
$listener = $null
for ($p = $Port; $p -lt $Port + 20; $p++) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    $l.Start(); $listener = $l; $Port = $p; break
  } catch { }
}
if (-not $listener) { Write-Host "Không mở được cổng $Port..$($Port+19)"; exit 1 }

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  Portfolio đang chạy tại:  $url" -ForegroundColor Green
Write-Host "  Bỏ qua màn chào:          ${url}index.html?skip"
Write-Host "  Trang dự án mẫu:          ${url}project.html?id=a1"
Write-Host "  Sửa file & lưu => trình duyệt tự tải lại.  Dừng: Ctrl + C"
Write-Host ""
if (-not $NoOpen) { Start-Process $url }

$stamp = Get-Stamp; $stampAt = [DateTime]::UtcNow
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    try {
      $res.Headers.Add('Cache-Control', 'no-store, must-revalidate')
      $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
      if ($path -eq '/__livereload') {
        if (([DateTime]::UtcNow - $stampAt).TotalMilliseconds -gt 700) { $stamp = Get-Stamp; $stampAt = [DateTime]::UtcNow }
        $b = [Text.Encoding]::UTF8.GetBytes($stamp); $res.ContentType = 'text/plain'
        $res.OutputStream.Write($b, 0, $b.Length); continue
      }
      if ($path.EndsWith('/')) { $path += 'index.html' }
      $rel = $path.TrimStart('/').Replace('/', '\')
      $file = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $rel))
      if (-not $file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($file)) {
        $res.StatusCode = 404
        $b = [Text.Encoding]::UTF8.GetBytes("404 — Không tìm thấy: $path"); $res.ContentType = 'text/plain; charset=utf-8'
        $res.OutputStream.Write($b, 0, $b.Length)
        Write-Host ("404  " + $path) -ForegroundColor DarkYellow
        continue
      }
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' })
      if ($ext -eq '.html') {
        $html = [IO.File]::ReadAllText($file, [Text.Encoding]::UTF8)
        $html = $html -replace '</body>', ($reloadJs + '</body>')
        $b = [Text.Encoding]::UTF8.GetBytes($html)
      } else {
        $b = [IO.File]::ReadAllBytes($file)
      }
      $res.ContentLength64 = $b.Length
      $res.OutputStream.Write($b, 0, $b.Length)
    } catch {
      try { $res.StatusCode = 500 } catch { }
    } finally {
      try { $res.OutputStream.Close() } catch { }
    }
  }
} finally {
  $listener.Stop(); $listener.Close()
}
