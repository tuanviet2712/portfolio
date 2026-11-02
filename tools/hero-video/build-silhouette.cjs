#!/usr/bin/env node
/* ==========================================================================
   HERO — dáng nhân vật theo từng khung hình (để chữ trên hero không đè lên người)

   Chạy:   node tools/hero-video/build-silhouette.cjs [--debug <thư-mục>]
   Đọc:    assets/hero/seq/full/NNN.webp   (khung 1920×1080 do build_seq.py tạo)
   Ghi:    assets/hero/seq/silhouette.js   window.HERO_SIL, js/hero.js đọc khi xếp chữ

   Cách làm: mở Chrome headless (không cần cài thêm thư viện), vẽ từng khung (mỗi STEP khung
   và khung cuối) xuống 480×270, tách người bằng màu: tóc/áo tối và ấm, da người; nền là trời
   xanh và bê tông xám/be. Lấy mảng liền lớn nhất, lấp kín theo hàng, rồi ghi với mỗi dải ngang
   (ROWS dải) mép trái/phải của người theo phần nghìn bề ngang khung (-1 = không có người).
   --debug lưu ảnh kiểm tra (vùng người tô đỏ) cho từng khung đã đo.
   ========================================================================== */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SEQ = path.join(ROOT, 'assets', 'hero', 'seq');
const OUT = path.join(SEQ, 'silhouette.js');
const STEP = 4;          // đo mỗi 4 khung (hero.js gộp hai mẫu kề nhau nên không hụt chuyển động)
const ROWS = 27;         // 27 dải ngang = 40 px nguồn mỗi dải
const GW = 480, GH = 270;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const dbgIdx = process.argv.indexOf('--debug');
const DEBUG = dbgIdx > 0 ? path.resolve(process.argv[dbgIdx + 1]) : '';

const scene = (() => {
  const src = fs.readFileSync(path.join(SEQ, 'scene.js'), 'utf8');
  return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
})();
const frames = [];
for (let i = 0; i < scene.n; i += STEP) frames.push(i);
if (frames[frames.length - 1] !== scene.n - 1) frames.push(scene.n - 1);

/* Hàm chạy trong trang: trả về [l0, r0, l1, r1, …] cho một khung */
const PAGE_FN = `async (url, GW, GH, ROWS, debug) => {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(url + ' → HTTP ' + resp.status);
  const img = await createImageBitmap(await resp.blob());
  const c = document.createElement('canvas'); c.width = GW; c.height = GH;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, GW, GH);
  const px = x.getImageData(0, 0, GW, GH).data, N = GW * GH, m = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const R = px[i * 4], G = px[i * 4 + 1], B = px[i * 4 + 2];
    const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B, mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = mx ? (mx - mn) / mx : 0;
    const dark = lum < 78 && R >= B - 4;                                     // tóc, áo len, áo khoác trong bóng
    const coat = R - G > 18 && G >= B - 2 && lum > 30 && lum < 140;           // áo khoác nâu chỗ có nắng (bóng bê tông: R-G nhỏ)
    const skin = R > G && G > B && R - B > 38 && sat > 0.2 && lum > 55 && lum < 235;
    m[i] = dark || coat || skin ? 1 : 0;
  }
  // co 2 px (lọc min theo hàng rồi theo cột) để cắt các cầu nối mảnh giữa tóc và mép dầm bê tông
  const R2 = 2, mh = new Uint8Array(N), me = new Uint8Array(N);
  for (let b = 0; b < GH; b++) for (let a = 0; a < GW; a++) { let ok = 1; for (let d = -R2; d <= R2 && ok; d++) { const k = a + d; if (k < 0 || k >= GW || !m[b * GW + k]) ok = 0; } mh[b * GW + a] = ok; }
  for (let b = 0; b < GH; b++) for (let a = 0; a < GW; a++) { let ok = 1; for (let d = -R2; d <= R2 && ok; d++) { const k = b + d; if (k < 0 || k >= GH || !mh[k * GW + a]) ok = 0; } me[b * GW + a] = ok; }
  m.set(me);
  const lab = new Int32Array(N), q = new Int32Array(N); let best = 0, bestN = 0, cur = 0;
  for (let i = 0; i < N; i++) {
    if (!m[i] || lab[i]) continue; cur++; let h = 0, t = 0, n = 0; q[t++] = i; lab[i] = cur;
    while (h < t) { const k = q[h++]; n++; const a = k % GW, b = (k / GW) | 0;
      if (a > 0 && m[k - 1] && !lab[k - 1]) { lab[k - 1] = cur; q[t++] = k - 1; }
      if (a < GW - 1 && m[k + 1] && !lab[k + 1]) { lab[k + 1] = cur; q[t++] = k + 1; }
      if (b > 0 && m[k - GW] && !lab[k - GW]) { lab[k - GW] = cur; q[t++] = k - GW; }
      if (b < GH - 1 && m[k + GW] && !lab[k + GW]) { lab[k + GW] = cur; q[t++] = k + GW; } }
    if (n > bestN) { bestN = n; best = cur; }
  }
  // nở lại 2 px cho mảng người (trả lại đúng kích thước sau bước co)
  const keep = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (lab[i] === best) {
    const a = i % GW, b = (i / GW) | 0;
    for (let dy = -R2; dy <= R2; dy++) for (let dx = -R2; dx <= R2; dx++) { const x2 = a + dx, y2 = b + dy; if (x2 >= 0 && x2 < GW && y2 >= 0 && y2 < GH) keep[y2 * GW + x2] = 1; }
  }
  for (let i = 0; i < N; i++) lab[i] = keep[i] ? best : 0;
  // mép trái/phải mỗi dải: chỉ tính cột có người phủ ≥ 40% chiều cao dải, để đường bóng mảnh
  // dính vào tóc (cạnh dầm bê tông ở các khung cận mặt) không kéo rộng vùng người
  const out = [], bh = GH / ROWS;
  for (let r = 0; r < ROWS; r++) {
    const y0 = Math.floor(r * bh), y1 = Math.min(GH, Math.ceil((r + 1) * bh));
    let l = GW, rr = -1;
    for (let a = 0; a < GW; a++) {
      let n = 0;
      for (let y = y0; y < y1; y++) if (lab[y * GW + a] === best) n++;
      if (n >= (y1 - y0) * 0.4) { if (a < l) l = a; rr = a; }
    }
    out.push(rr < 0 ? -1 : Math.round(l / GW * 1000), rr < 0 ? -1 : Math.round((rr + 1) / GW * 1000));
  }
  let png = null;
  if (debug) {
    const id = x.getImageData(0, 0, GW, GH);
    for (let i = 0; i < N; i++) if (lab[i] === best) { id.data[i * 4] = id.data[i * 4] * .4 + 153; id.data[i * 4 + 1] *= .4; id.data[i * 4 + 2] *= .4; }
    x.putImageData(id, 0, 0); x.strokeStyle = '#00ff66';
    for (let r = 0; r < ROWS; r++) if (out[r * 2] >= 0) x.strokeRect(out[r * 2] / 1000 * GW, r * bh, (out[r * 2 + 1] - out[r * 2]) / 1000 * GW, bh);
    png = c.toDataURL('image/png');
  }
  return { rows: out, png };
}`;

/* Máy chủ tĩnh nhỏ: ảnh đọc qua file:// làm "bẩn" canvas nên phải phục vụ qua http */
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rs) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') { rs.writeHead(200, { 'Content-Type': 'text/html' }); return rs.end('<!doctype html><title>sil</title>'); }
      const f = path.join(SEQ, path.normalize(p).replace(/^[\\/]+/, ''));
      if (!f.startsWith(SEQ) || !fs.existsSync(f)) { rs.writeHead(404); return rs.end(); }
      rs.writeHead(200, { 'Content-Type': 'image/webp', 'Access-Control-Allow-Origin': '*' }); fs.createReadStream(f).pipe(rs);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function main() {
  const srv = await serve();
  const port = srv.address().port;
  const dbgPort = 9400 + Math.floor(Math.random() * 400);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-sil-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${dbgPort}`, `--user-data-dir=${prof}`, '--no-first-run', '--disable-extensions', `http://127.0.0.1:${port}/`], { stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let wsUrl = '';
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${dbgPort}/json/list`)).json(); const pg = l.find(t => t.type === 'page' && t.url.includes(String(port))); if (pg) wsUrl = pg.webSocketDebuggerUrl; } catch (_) {}
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) throw new Error('Không mở được Chrome headless (' + CHROME + ')');
  const ws = new WebSocket(wsUrl); await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const call = (method, params) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  // đợi trang thật sự ở origin của máy chủ (lúc mới mở Chrome vẫn còn about:blank)
  const origin = `http://127.0.0.1:${port}`;
  await call('Page.navigate', { url: origin + '/' });
  for (let i = 0; i < 80; i++) {
    const r = await call('Runtime.evaluate', { expression: 'location.origin + "|" + document.readyState', returnByValue: true });
    if (r.result && r.result.result && r.result.result.value === origin + '|complete') break;
    await sleep(100);
  }

  const data = [];
  if (DEBUG) fs.mkdirSync(DEBUG, { recursive: true });
  for (const f of frames) {
    const name = String(f).padStart(3, '0') + '.webp';
    const r = await call('Runtime.evaluate', { expression: `(${PAGE_FN})('/full/${name}', ${GW}, ${GH}, ${ROWS}, ${!!DEBUG})`, awaitPromise: true, returnByValue: true });
    const ex = r.result && r.result.exceptionDetails;
    if (r.error || ex) throw new Error('Khung ' + name + ': ' + JSON.stringify(r.error || (ex.exception && ex.exception.description) || ex.text));
    const v = r.result.result.value;
    data.push(v.rows);
    if (DEBUG && v.png) fs.writeFileSync(path.join(DEBUG, name.replace('.webp', '.png')), Buffer.from(v.png.split(',')[1], 'base64'));
  }
  ws.close(); chrome.kill(); srv.close();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (_) {}

  const body = JSON.stringify({ step: STEP, rows: ROWS, frames, f: data });
  fs.writeFileSync(OUT, `/* Sinh bởi tools/hero-video/build-silhouette.cjs — KHÔNG sửa tay. Dáng nhân vật theo khung: f[k] = [trái, phải] của ${ROWS} dải ngang (phần nghìn bề ngang khung, -1 = trống) tại khung frames[k]. */\nwindow.HERO_SIL = ${body};\n`, 'utf8');
  console.log(`✓ ${path.relative(ROOT, OUT)}: ${frames.length} khung × ${ROWS} dải, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
}
main().catch(e => { console.error('✗', e.message); process.exit(1); });
