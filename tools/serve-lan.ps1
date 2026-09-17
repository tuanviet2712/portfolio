<#
  May chu localhost cho Portfolio - mo duoc cho ca MAY TINH va DIEN THOAI trong cung Wi-Fi.

  Khac tools\serve.ps1 (chi localhost): ban nay dung socket thuong (TcpListener) nen nghe duoc
  tren moi dia chi mang ma KHONG can quyen Administrator, chay da luong, va ho tro tai theo doan
  (HTTP Range) de Safari tren iPhone phat duoc video.

  Chay:  powershell -ExecutionPolicy Bypass -File tools\serve-lan.ps1 [-Port 5500] [-NoOpen]
  Dung:  Ctrl + C (hoac dong cua so)

  Luu y: file nay chi dung ky tu ASCII. PowerShell 5.1 doc file .ps1 khong co BOM theo bang ma ANSI,
  nen chu co dau trong file se bi hong.
#>
param([int]$Port = 5500, [switch]$NoOpen)

$root = Split-Path -Parent $PSScriptRoot

$cs = @'
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

public class LtvServer
{
    private string root;
    private int port;
    private TcpListener listener;
    private static readonly Dictionary<string, string> Mime = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    private string stamp = "0";
    private DateTime stampAt = DateTime.MinValue;
    private object stampLock = new object();
    private const string ReloadJs = "<script>(function(){var v=null;setInterval(function(){fetch('/__livereload',{cache:'no-store'}).then(function(r){return r.text()}).then(function(t){if(v===null)v=t;else if(t!==v)location.reload()}).catch(function(){})},900)})();</script>";

    static LtvServer()
    {
        Mime[".html"] = "text/html; charset=utf-8";
        Mime[".htm"] = "text/html; charset=utf-8";
        Mime[".css"] = "text/css; charset=utf-8";
        Mime[".js"] = "application/javascript; charset=utf-8";
        Mime[".mjs"] = "application/javascript; charset=utf-8";
        Mime[".json"] = "application/json; charset=utf-8";
        Mime[".md"] = "text/plain; charset=utf-8";
        Mime[".txt"] = "text/plain; charset=utf-8";
        Mime[".webp"] = "image/webp";
        Mime[".jpg"] = "image/jpeg";
        Mime[".jpeg"] = "image/jpeg";
        Mime[".png"] = "image/png";
        Mime[".gif"] = "image/gif";
        Mime[".svg"] = "image/svg+xml";
        Mime[".ico"] = "image/x-icon";
        Mime[".pdf"] = "application/pdf";
        Mime[".mp4"] = "video/mp4";
        Mime[".webm"] = "video/webm";
        Mime[".mov"] = "video/quicktime";
        Mime[".mp3"] = "audio/mpeg";
        Mime[".woff"] = "font/woff";
        Mime[".woff2"] = "font/woff2";
        Mime[".ttf"] = "font/ttf";
    }

    public LtvServer(string root, int port)
    {
        this.root = Path.GetFullPath(root);
        this.port = port;
    }

    // Nghe ca IPv6 va IPv4 tren cung mot socket (dual-mode). Neu chi nghe IPv4 thi trinh duyet go
    // "localhost" se thu ::1 truoc va cho het thoi gian (~2 giay) moi chuyen sang 127.0.0.1.
    public void Start()
    {
        bool dual = false;
        try
        {
            listener = new TcpListener(IPAddress.IPv6Any, port);
            listener.Server.SetSocketOption(SocketOptionLevel.IPv6, (SocketOptionName)27, false); // IPV6_V6ONLY = 27
            listener.Start(128);
            dual = true;
        }
        catch
        {
            if (listener != null) { try { listener.Stop(); } catch { } }
            listener = null;
        }
        if (!dual)
        {
            listener = new TcpListener(IPAddress.Any, port);
            listener.Start(128);
        }
        Thread t = new Thread(new ThreadStart(AcceptLoop));
        t.IsBackground = true;
        t.Start();
    }

    private void AcceptLoop()
    {
        while (true)
        {
            try
            {
                TcpClient c = listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(new WaitCallback(Handle), c);
            }
            catch { Thread.Sleep(20); }
        }
    }

    // Dau thoi gian cho live reload: chi quet thu muc goc, css, js (khong de quy: assets\hero co hang tram khung hinh)
    private string GetStamp()
    {
        lock (stampLock)
        {
            if ((DateTime.UtcNow - stampAt).TotalMilliseconds < 700) return stamp;
            long max = 0;
            string[] dirs = new string[] { root, Path.Combine(root, "css"), Path.Combine(root, "js") };
            foreach (string d in dirs)
            {
                try
                {
                    foreach (string f in Directory.GetFiles(d))
                    {
                        string e = Path.GetExtension(f).ToLowerInvariant();
                        if (e == ".html" || e == ".css" || e == ".js")
                        {
                            long tk = File.GetLastWriteTimeUtc(f).Ticks;
                            if (tk > max) max = tk;
                        }
                    }
                }
                catch { }
            }
            stamp = max.ToString(CultureInfo.InvariantCulture);
            stampAt = DateTime.UtcNow;
            return stamp;
        }
    }

    private void Handle(object state)
    {
        TcpClient client = (TcpClient)state;
        try
        {
            client.NoDelay = true;
            client.ReceiveTimeout = 20000;
            client.SendTimeout = 60000;
            NetworkStream ns = client.GetStream();
            BufferedStream rs = new BufferedStream(ns, 8192);
            while (true)
            {
                string head = ReadHead(rs);
                if (head == null || head.Length == 0) break;
                if (!HandleOne(ns, head)) break;
            }
        }
        catch { }
        finally { try { client.Close(); } catch { } }
    }

    private string ReadHead(Stream s)
    {
        List<byte> buf = new List<byte>(1024);
        byte[] one = new byte[1];
        while (buf.Count < 32768)
        {
            int n;
            try { n = s.Read(one, 0, 1); } catch { return null; }
            if (n <= 0) return null;
            buf.Add(one[0]);
            int c = buf.Count;
            if (c >= 4 && buf[c - 4] == 13 && buf[c - 3] == 10 && buf[c - 2] == 13 && buf[c - 1] == 10) break;
            if (c >= 2 && buf[c - 2] == 10 && buf[c - 1] == 10) break;
        }
        return Encoding.ASCII.GetString(buf.ToArray());
    }

    private bool HandleOne(NetworkStream ws, string head)
    {
        string[] lines = head.Replace("\r\n", "\n").Split('\n');
        string[] parts = lines[0].Split(' ');
        if (parts.Length < 2) return false;
        string method = parts[0].ToUpperInvariant();
        string target = parts[1];
        string ver = parts.Length > 2 ? parts[2] : "HTTP/1.0";
        bool keep = !ver.EndsWith("1.0");
        string range = null;
        for (int i = 1; i < lines.Length; i++)
        {
            int ix = lines[i].IndexOf(':');
            if (ix <= 0) continue;
            string k = lines[i].Substring(0, ix).Trim().ToLowerInvariant();
            string v = lines[i].Substring(ix + 1).Trim();
            if (k == "range") range = v;
            else if (k == "connection" && v.ToLowerInvariant().Contains("close")) keep = false;
        }
        bool headOnly = (method == "HEAD");
        if (method != "GET" && method != "HEAD")
        {
            WriteSimple(ws, 405, "text/plain; charset=utf-8", Encoding.ASCII.GetBytes("405"), keep, false);
            return keep;
        }
        int q = target.IndexOf('?');
        string pathOnly = (q >= 0) ? target.Substring(0, q) : target;
        string path;
        try { path = Uri.UnescapeDataString(pathOnly); } catch { path = pathOnly; }
        if (path == "/__livereload")
        {
            WriteSimple(ws, 200, "text/plain; charset=utf-8", Encoding.ASCII.GetBytes(GetStamp()), keep, false);
            return keep;
        }
        if (path.EndsWith("/")) path = path + "index.html";
        string rel = path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        string file = null;
        try { file = Path.GetFullPath(Path.Combine(root, rel)); } catch { file = null; }
        if (file == null || !file.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(file))
        {
            WriteSimple(ws, 404, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("404 - " + path), keep, headOnly);
            return keep;
        }
        string ext = Path.GetExtension(file).ToLowerInvariant();
        string ctype = Mime.ContainsKey(ext) ? Mime[ext] : "application/octet-stream";
        if (ext == ".html" || ext == ".htm")
        {
            string html;
            try { html = File.ReadAllText(file, Encoding.UTF8); }
            catch { WriteSimple(ws, 500, "text/plain", Encoding.ASCII.GetBytes("500"), keep, headOnly); return keep; }
            int bi = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            html = (bi >= 0) ? html.Substring(0, bi) + ReloadJs + html.Substring(bi) : html + ReloadJs;
            WriteSimple(ws, 200, ctype, Encoding.UTF8.GetBytes(html), keep, headOnly);
            return keep;
        }
        FileStream fs = null;
        try
        {
            fs = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            long len = fs.Length;
            long start = 0, end = len - 1;
            bool partial = false;
            if (range != null && range.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase))
            {
                string spec = range.Substring(6).Split(',')[0].Trim();
                int dash = spec.IndexOf('-');
                if (dash >= 0)
                {
                    string a = spec.Substring(0, dash).Trim();
                    string b2 = spec.Substring(dash + 1).Trim();
                    if (a.Length == 0)
                    {
                        long suffix;
                        if (long.TryParse(b2, out suffix) && suffix > 0) { start = Math.Max(0, len - suffix); end = len - 1; partial = true; }
                    }
                    else
                    {
                        long sv;
                        if (long.TryParse(a, out sv))
                        {
                            start = sv;
                            long ev;
                            end = (b2.Length > 0 && long.TryParse(b2, out ev)) ? Math.Min(ev, len - 1) : len - 1;
                            partial = true;
                        }
                    }
                }
                if (partial && (start >= len || start > end))
                {
                    StringBuilder h4 = new StringBuilder();
                    h4.Append("HTTP/1.1 416 Range Not Satisfiable\r\n");
                    h4.Append("Content-Range: bytes */" + len.ToString(CultureInfo.InvariantCulture) + "\r\n");
                    h4.Append("Content-Length: 0\r\n");
                    h4.Append(keep ? "Connection: keep-alive\r\n" : "Connection: close\r\n");
                    h4.Append("\r\n");
                    byte[] b4 = Encoding.ASCII.GetBytes(h4.ToString());
                    ws.Write(b4, 0, b4.Length);
                    ws.Flush();
                    return keep;
                }
            }
            long count = end - start + 1;
            StringBuilder h = new StringBuilder();
            h.Append(partial ? "HTTP/1.1 206 Partial Content\r\n" : "HTTP/1.1 200 OK\r\n");
            h.Append("Content-Type: " + ctype + "\r\n");
            h.Append("Content-Length: " + count.ToString(CultureInfo.InvariantCulture) + "\r\n");
            h.Append("Accept-Ranges: bytes\r\n");
            h.Append("Cache-Control: no-store, must-revalidate\r\n");
            if (partial) h.Append("Content-Range: bytes " + start.ToString(CultureInfo.InvariantCulture) + "-" + end.ToString(CultureInfo.InvariantCulture) + "/" + len.ToString(CultureInfo.InvariantCulture) + "\r\n");
            h.Append(keep ? "Connection: keep-alive\r\n" : "Connection: close\r\n");
            h.Append("\r\n");
            byte[] hdr = Encoding.ASCII.GetBytes(h.ToString());
            ws.Write(hdr, 0, hdr.Length);
            if (!headOnly)
            {
                fs.Seek(start, SeekOrigin.Begin);
                byte[] buf = new byte[65536];
                long left = count;
                while (left > 0)
                {
                    int want = (int)Math.Min((long)buf.Length, left);
                    int got = fs.Read(buf, 0, want);
                    if (got <= 0) break;
                    ws.Write(buf, 0, got);
                    left -= got;
                }
            }
            ws.Flush();
        }
        catch { keep = false; }
        finally { if (fs != null) fs.Close(); }
        return keep;
    }

    private void WriteSimple(NetworkStream ws, int code, string ctype, byte[] body, bool keep, bool headOnly)
    {
        string reason = "OK";
        if (code == 404) reason = "Not Found";
        else if (code == 405) reason = "Method Not Allowed";
        else if (code == 500) reason = "Internal Server Error";
        StringBuilder h = new StringBuilder();
        h.Append("HTTP/1.1 " + code.ToString(CultureInfo.InvariantCulture) + " " + reason + "\r\n");
        h.Append("Content-Type: " + ctype + "\r\n");
        h.Append("Content-Length: " + body.Length.ToString(CultureInfo.InvariantCulture) + "\r\n");
        h.Append("Accept-Ranges: bytes\r\n");
        h.Append("Cache-Control: no-store, must-revalidate\r\n");
        h.Append(keep ? "Connection: keep-alive\r\n" : "Connection: close\r\n");
        h.Append("\r\n");
        byte[] hb = Encoding.ASCII.GetBytes(h.ToString());
        ws.Write(hb, 0, hb.Length);
        if (!headOnly && body.Length > 0) ws.Write(body, 0, body.Length);
        ws.Flush();
    }
}
'@

if (-not ("LtvServer" -as [type])) { Add-Type -TypeDefinition $cs -Language CSharp }

$srv = $null
for ($p = $Port; $p -lt $Port + 20; $p++) {
  try { $s = New-Object LtvServer($root, $p); $s.Start(); $srv = $s; $Port = $p; break } catch { }
}
if (-not $srv) { Write-Host "Khong mo duoc cong $Port..$($Port+19)" -ForegroundColor Red; exit 1 }

$ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -ExpandProperty IPAddress)

Write-Host ""
Write-Host "  Portfolio dang chay:" -ForegroundColor Green
Write-Host "    May tinh:   http://localhost:$Port/"
foreach ($ip in $ips) { Write-Host "    Dien thoai: http://${ip}:$Port/   (cung Wi-Fi)" }
Write-Host ""
Write-Host "  Sua file & luu => trinh duyet tu tai lai.  Dung: Ctrl + C"
Write-Host ""
if (-not $NoOpen) { Start-Process "http://localhost:$Port/" }

while ($true) { Start-Sleep -Seconds 3600 }
