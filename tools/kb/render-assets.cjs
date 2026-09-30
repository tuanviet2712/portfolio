#!/usr/bin/env node
/* ==========================================================================
   GÓC KIẾN THỨC — tạo ảnh bìa, ảnh chia sẻ (Open Graph) và ảnh đại diện tác giả
   Chạy:  node tools/kb/render-assets.cjs            (cần Google Chrome trên máy)
   Ghi:   assets/kb/<bài>.webp (1200) · <bài>-320.webp · <bài>-640.webp · <bài>-1600.webp · <bài>.jpg (Open Graph)
          assets/kb/goc-kien-thuc.jpg / .webp       ảnh chia sẻ trang tổng và trang chủ đề
          assets/kb/le-tuan-viet.webp                ảnh đại diện 320×320
   Ảnh được dựng bằng HTML/CSS (font Be Vietnam Pro, màu Sky Luxury) rồi chụp bằng Chrome headless.
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets', 'kb');
const WORK = path.join(os.tmpdir(), `ltv-kb-render-${process.pid}`);
const CHROME = process.env.CHROME_PATH || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome'
].find(p => p && fs.existsSync(p));

const url = rel => pathToFileURL(path.join(ROOT, rel)).href;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- Mẫu HTML ---------------- */
const FONT_FILES = {
  400: ['QdVPSTAyLFyeg_IDWvOJmVES_Hw3BXo', 'QdVPSTAyLFyeg_IDWvOJmVES_Hw4BXoKZA'],
  600: ['QdVMSTAyLFyeg_IDWvOJmVES_HToIW81Rb0', 'QdVMSTAyLFyeg_IDWvOJmVES_HToIW86Rb0bcw'],
  700: ['QdVMSTAyLFyeg_IDWvOJmVES_HSMIG81Rb0', 'QdVMSTAyLFyeg_IDWvOJmVES_HSMIG86Rb0bcw'],
  800: ['QdVMSTAyLFyeg_IDWvOJmVES_HSQI281Rb0', 'QdVMSTAyLFyeg_IDWvOJmVES_HSQI286Rb0bcw']
};
const fonts = Object.entries(FONT_FILES).map(([w, [latin, vi]]) => `
@font-face{font-family:BVP;font-weight:${w};src:url("${url(`assets/fonts/be-vietnam-pro/${latin}.woff2`)}") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:BVP;font-weight:${w};src:url("${url(`assets/fonts/be-vietnam-pro/${vi}.woff2`)}") format("woff2");unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB}`).join('');

const BASE_CSS = `${fonts}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden;background:#0A0D1C;font-family:BVP,sans-serif;-webkit-font-smoothing:antialiased}
.c{position:relative;width:1200px;height:630px;overflow:hidden;isolation:isolate;color:#fff}
.bg{position:absolute;inset:0;z-index:-3}
.ov{position:absolute;inset:0;z-index:-2}
.glow{position:absolute;z-index:-1;border-radius:50%;filter:blur(2px)}
.brand{position:absolute;top:44px;right:100px;display:flex;align-items:center;gap:12px;font-weight:700;font-size:21px;letter-spacing:-.02em}
.brand i{width:46px;height:46px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 10px 30px -8px rgba(27,92,242,.8)}
.brand img{width:30px;height:30px}
.txt{position:absolute;top:0;bottom:0;right:100px;display:flex;flex-direction:column;justify-content:center}
.k{font-size:20px;font-weight:600;color:#A2C4FE;letter-spacing:.01em}
.t{margin-top:14px;font-size:78px;font-weight:800;letter-spacing:-.045em;line-height:1.02}
.l{margin-top:10px;font-size:42px;font-weight:800;letter-spacing:-.035em;line-height:1.12;white-space:nowrap;background:linear-gradient(100deg,#F5F8FF 0%,#BCD5FF 45%,#7CB4FF 100%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:4px}
.t{white-space:nowrap}
.steps{margin-top:34px;display:flex;align-items:center;gap:0}
.steps span{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:15px;font-weight:700;color:#0C1633;background:#F5F8FF;box-shadow:0 0 0 6px rgba(245,248,255,.1)}
.steps span:nth-child(odd){background:linear-gradient(120deg,#14E0E0,#1AA6FF 40%,#1B5CF2);color:#fff}
.steps b{width:26px;height:2px;background:linear-gradient(90deg,rgba(245,248,255,.25),rgba(245,248,255,.6))}
.chips{margin-top:34px;display:flex;flex-wrap:wrap;gap:10px}
.chips span{padding:9px 16px;border-radius:999px;font-size:17px;font-weight:600;color:#fff;background:rgba(245,248,255,.1);border:1px solid rgba(245,248,255,.22)}
.by{position:absolute;left:100px;bottom:44px;display:flex;align-items:center;gap:14px}
.by img{width:54px;height:54px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px rgba(255,255,255,.85)}
.by b{display:block;font-size:20px;font-weight:700;letter-spacing:-.01em}
.by small{display:block;font-size:15px;color:rgba(245,248,255,.72)}
.url{position:absolute;right:100px;bottom:50px;font-size:17px;font-weight:600;color:rgba(245,248,255,.7)}
`;

function coverHtml({ kicker, title, line, extra, photo = 'assets/img/skills/strategy.jpg', pos = '18% 32%', left = 580 }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
.bg{background:#0F1A3A url("${url(photo)}") ${pos}/cover no-repeat}
.ov{background:linear-gradient(90deg,rgba(10,20,58,.02) 0%,rgba(10,20,58,.18) 28%,rgba(10,13,28,.82) 47%,rgba(10,13,28,.97) 62%,#0A0D1C 100%),linear-gradient(0deg,rgba(10,13,28,.75) 0%,rgba(10,13,28,0) 32%)}
.glow{right:-160px;bottom:-240px;width:620px;height:620px;background:radial-gradient(circle,rgba(20,216,230,.28),transparent 62%)}
.txt{left:${left}px}
</style></head><body><div class="c">
<div class="bg"></div><div class="ov"></div><div class="glow"></div>
<div class="brand"><i><img src="${url('assets/img/logo.svg')}" alt=""></i>Lê Tuấn Việt</div>
<div class="txt"><p class="k">${esc(kicker)}</p><p class="t">${esc(title)}</p><p class="l">${esc(line)}</p>${extra || ''}</div>
<div class="by"><img src="${url('assets/img/contact.jpg')}" alt=""><span><b>Lê Tuấn Việt</b><small>Marketing Leader tại TAKI Group</small></span></div>
<div class="url">letuanviet.com</div>
</div></body></html>`;
}

/* Ảnh tác giả của Góc kiến thức: nguồn là tools/kb/author-photo.png (1000×1000, không nằm trong thư mục triển khai).
   Trang portfolio dùng ảnh riêng ở assets/img/, không đụng tới. */
const AUTHOR_SRC = 'tools/kb/author-photo.png';
const AUTHOR_W = 1000;

/* Ảnh bìa do chính bài viết cung cấp: tools/kb/covers/<slug>.png|jpg|jpeg|webp
   (hoặc đường dẫn khác khai báo ở "cover.src" trong metadata của bài).
   Đây là cách ưu tiên: mỗi bài một ảnh bìa riêng. Bài nào KHÔNG có file ảnh mới
   rơi về mẫu bìa dựng bằng chữ ở coverHtml(). Thư mục tools/ không được triển khai,
   nên ảnh gốc không nằm trong bản public. */
const COVER_DIR = path.join(__dirname, 'covers');
const COVER_EXT = ['.png', '.jpg', '.jpeg', '.webp'];

function coverFile(meta) {
  if (meta.cover && meta.cover.src) {
    const p = path.join(ROOT, meta.cover.src);
    if (!fs.existsSync(p)) throw new Error(`${meta.slug}: không thấy ảnh bìa "${meta.cover.src}"`);
    return p;
  }
  for (const ext of COVER_EXT) {
    const p = path.join(COVER_DIR, meta.slug + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/* Ảnh bìa từ file: phủ kín khung, cắt cân giữa, thu nhỏ bằng Lanczos-3.
   Trước đây mỗi cỡ được dựng bằng CSS background-size: cover rồi chụp màn hình. Bộ thu nhỏ
   của trình duyệt làm nhoè chữ: đo trên ảnh bìa "Micro conversion" thì độ nét biên của bản
   1600 chỉ bằng 0,90 lần bản Lanczos (2,69 so với 2,97), bản 1200 là 3,53 so với 3,84.
   createImageBitmap kèm resizeQuality "high" gần như không khá hơn (2,73). Nên phần thu nhỏ
   tự viết ngay dưới đây, chạy trong chính Chrome headless, không thêm thư viện nào. */
const LANCZOS = `
function ltvLanczos(src, sw, sh, dw, dh, a) {
  a = a || 3;
  const pass = (inp, iw, ih, ow) => {
    const out = new Float32Array(ow * ih * 4);
    const scale = ow / iw, inv = 1 / Math.min(scale, 1), half = a * inv;
    for (let o = 0; o < ow; o++) {
      const centre = (o + .5) / scale - .5;
      const from = Math.max(0, Math.ceil(centre - half)), to = Math.min(iw - 1, Math.floor(centre + half));
      const ws = []; let sum = 0;
      for (let i = from; i <= to; i++) {
        const x = (i - centre) / inv;
        const w = x === 0 ? 1 : Math.abs(x) < a ? (a * Math.sin(Math.PI * x) * Math.sin(Math.PI * x / a)) / (Math.PI * Math.PI * x * x) : 0;
        ws.push(w); sum += w;
      }
      for (let r = 0; r < ih; r++) {
        let R = 0, G = 0, B = 0, A = 0;
        for (let i = from, k = 0; i <= to; i++, k++) {
          const w = ws[k] / sum, p = (r * iw + i) * 4;
          R += inp[p] * w; G += inp[p + 1] * w; B += inp[p + 2] * w; A += inp[p + 3] * w;
        }
        const q = (r * ow + o) * 4;
        out[q] = R; out[q + 1] = G; out[q + 2] = B; out[q + 3] = A;
      }
    }
    return out;
  };
  const flip = (buf, w, h) => {
    const out = new Float32Array(buf.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = (x * h + y) * 4;
      out[d] = buf[s]; out[d + 1] = buf[s + 1]; out[d + 2] = buf[s + 2]; out[d + 3] = buf[s + 3];
    }
    return out;
  };
  let buf = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) buf[i] = src[i];
  buf = flip(pass(buf, sw, sh, dw), dw, sh);
  buf = flip(pass(buf, sh, dw, dh), dh, dw);
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(buf[i]);
  return new ImageData(out, dw, dh);
}`;

/* Chất lượng để cao hơn ảnh chụp: chữ và mảng màu phẳng lộ artefact rất rõ. */
const PHOTO_COVER_SIZES = [
  { suffix: '-1600.webp', type: 'image/webp', quality: .95, w: 1600, h: 840 },
  { suffix: '.webp', type: 'image/webp', quality: .95, w: 1200, h: 630 },
  { suffix: '-640.webp', type: 'image/webp', quality: .92, w: 640, h: 336 },
  { suffix: '-320.webp', type: 'image/webp', quality: .9, w: 320, h: 168 },
  { suffix: '.jpg', type: 'image/jpeg', quality: .94, w: 1200, h: 630 }
];

async function renderPhotoCover(cdp, file, base) {
  const page = path.join(WORK, `${base}-resize.html`);
  fs.writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><script>${LANCZOS}</script></head>`
    + `<body><img id="s" src="${pathToFileURL(file).href}"></body></html>`, 'utf8');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 300, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: pathToFileURL(page).href });
  for (let i = 0; i < 80; i++) {
    await sleep(100);
    const r = await cdp.send('Runtime.evaluate', { expression: 'document.readyState === "complete" && document.getElementById("s").naturalWidth > 0', returnByValue: true });
    if (r.result.value) break;
  }
  for (const s of PHOTO_COVER_SIZES) {
    const r = await cdp.send('Runtime.evaluate', {
      awaitPromise: true, returnByValue: true, expression: `(async () => {
        const img = document.getElementById('s');
        const full = await createImageBitmap(img);
        const k = Math.max(${s.w} / full.width, ${s.h} / full.height);          // phủ kín khung
        const bw = Math.round(${s.w} / k), bh = Math.round(${s.h} / k);
        const cut = new OffscreenCanvas(bw, bh), cx = cut.getContext('2d');
        cx.drawImage(full, Math.round((full.width - bw) / 2), Math.round((full.height - bh) / 2), bw, bh, 0, 0, bw, bh);
        const small = ltvLanczos(cx.getImageData(0, 0, bw, bh).data, bw, bh, ${s.w}, ${s.h});
        const c = new OffscreenCanvas(${s.w}, ${s.h});
        c.getContext('2d').putImageData(small, 0, 0);
        const blob = await c.convertToBlob({ type: '${s.type}', quality: ${s.quality} });
        const b = new Uint8Array(await blob.arrayBuffer());
        let out = ''; for (let i = 0; i < b.length; i++) out += String.fromCharCode(b[i]);
        return btoa(out);
      })()` });
    if (!r.result || typeof r.result.value !== 'string') throw new Error(`${base}${s.suffix}: thu nhỏ ảnh bìa thất bại`);
    const out = path.join(OUT, `${base}${s.suffix}`);
    fs.writeFileSync(out, Buffer.from(r.result.value, 'base64'));
    console.log(`  + assets/kb/${base}${s.suffix}  ${s.w}×${s.h}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }
}

// Ảnh chân dung cho ô liên hệ ở cột phải (CSS tự cắt theo khung 4:3)
function authorPhotoHtml() {
  const S = 760;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0}html,body{width:${S}px;height:${S}px;overflow:hidden;background:#1B3C8C}
div{width:${S}px;height:${S}px;background:url("${url(AUTHOR_SRC)}") center/cover no-repeat}
</style></head><body><div></div></body></html>`;
}

// Ảnh đại diện: khung vuông quanh khuôn mặt (mặt ở khoảng x 540, y 155 của ảnh 1000×1000)
function avatarHtml() {
  const S = 320, box = 430, cx = 540, cy = 215, k = S / box;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0}html,body{width:${S}px;height:${S}px;overflow:hidden;background:#1B3C8C}
div{width:${S}px;height:${S}px;background:url("${url(AUTHOR_SRC)}") ${(-(cx - box / 2) * k).toFixed(1)}px ${(-(cy - box / 2) * k).toFixed(1)}px/${(AUTHOR_W * k).toFixed(1)}px auto no-repeat}
</style></head><body><div></div></body></html>`;
}

/* ---------------- Chrome DevTools ---------------- */
async function launch() {
  if (!CHROME) throw new Error('Không tìm thấy Google Chrome. Đặt biến môi trường CHROME_PATH.');
  fs.mkdirSync(WORK, { recursive: true });
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(WORK, 'profile')}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--allow-file-access-from-files', '--force-color-profile=srgb', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  const port = await new Promise((res, rej) => {
    let buf = '';
    const t = setTimeout(() => rej(new Error('Chrome không mở cổng DevTools')), 20000);
    proc.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//); if (m) { clearTimeout(t); res(+m[1]); } });
    proc.on('exit', c => rej(new Error('Chrome thoát sớm, mã ' + c)));
  });
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); });
  const send = (method, params = {}) => new Promise((res, rej) => { const k = ++id; pending.set(k, { res, rej }); ws.send(JSON.stringify({ id: k, method, params })); });
  await send('Page.enable');
  const close = async () => { try { ws.close(); } catch (_) {} proc.kill(); await sleep(400); try { fs.rmSync(WORK, { recursive: true, force: true }); } catch (_) {} };
  return { send, close };
}

// Co cỡ chữ tiêu đề/dòng phụ cho vừa một hàng (không để rớt một chữ xuống dòng)
const FIT = `<script>document.fonts.ready.then(()=>{document.querySelectorAll('.t,.l').forEach(el=>{let s=parseFloat(getComputedStyle(el).fontSize);while(el.scrollWidth>el.clientWidth+1&&s>20){s-=1;el.style.fontSize=s+'px';}});document.body.dataset.fit='1';});</script>`;

async function render(cdp, html, name, w, h, shots) {
  const file = path.join(WORK, name + '.html');
  fs.writeFileSync(file, html.replace('</body>', FIT + '</body>'), 'utf8');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: pathToFileURL(file).href });
  for (let i = 0; i < 80; i++) {
    await sleep(100);
    const r = await cdp.send('Runtime.evaluate', { expression: 'document.readyState === "complete" && [...document.images].every(i => i.complete)', returnByValue: true });
    if (r.result.value) break;
  }
  await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise(r => setTimeout(r, 120)))', awaitPromise: true });
  await sleep(250);
  for (const s of shots) {
    const scale = s.width / w;
    const r = await cdp.send('Page.captureScreenshot', { format: s.format, quality: s.quality, clip: { x: 0, y: 0, width: w, height: h, scale }, captureBeyondViewport: false });
    const out = path.join(OUT, s.file);
    fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
    console.log(`  + assets/kb/${s.file}  ${s.width}×${Math.round(h * scale)}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }
}

const coverShots = base => [
  { file: `${base}.webp`, format: 'webp', quality: 84, width: 1200 },
  { file: `${base}-640.webp`, format: 'webp', quality: 80, width: 640 },
  { file: `${base}-320.webp`, format: 'webp', quality: 78, width: 320 },     // ảnh nhỏ: danh sách bài, kết quả tìm kiếm
  { file: `${base}-1600.webp`, format: 'webp', quality: 82, width: 1600 },
  { file: `${base}.jpg`, format: 'jpeg', quality: 86, width: 1200 }
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const cdp = await launch();
  try {
    // Ảnh bìa của từng bài: lấy từ metadata trong tools/kb/articles/*.html
    const dir = path.join(__dirname, 'articles');
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html') && !x.startsWith('_'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      const meta = JSON.parse(src.match(/<script type="application\/json" data-meta>([\s\S]*?)<\/script>/)[1]);
      if (meta.draft) continue;                 // bài mẫu / bài nháp: dùng lại ảnh bìa sẵn có, không tạo ảnh mới
      const c = meta.cover;
      const own = coverFile(meta);
      if (own) {
        console.log(`Ảnh bìa: ${meta.slug}  (ảnh riêng của bài: ${path.relative(ROOT, own).replace(/\\/g, '/')})`);
        await renderPhotoCover(cdp, own, c.base);
        continue;
      }
      const steps = /^\d+ bước/.test(c.line) ? `<div class="steps">${Array.from({ length: +c.line.match(/^\d+/)[0] }, (_, i) => `${i ? '<b></b>' : ''}<span>${String(i + 1).padStart(2, '0')}</span>`).join('')}</div>` : '';
      console.log(`Ảnh bìa: ${meta.slug}  (chưa có ảnh riêng, dựng từ mẫu chữ)`);
      await render(cdp, coverHtml({ kicker: c.kicker2 || 'Góc kiến thức', title: c.kicker, line: c.line, extra: steps, photo: c.photo, pos: c.pos }), meta.slug, 1200, 630, coverShots(c.base));
    }
    console.log('Ảnh chia sẻ trang tổng');
    const chips = `<div class="chips"><span>Marketing</span><span>AI Marketing</span><span>Quản trị Marketing</span><span>Dự án và Bài học</span></div>`;
    await render(cdp, coverHtml({ kicker: 'Chia sẻ từ Lê Tuấn Việt', title: 'Góc kiến thức', line: 'Marketing cho doanh nghiệp SME', extra: chips }), 'hub', 1200, 630, [
      { file: 'goc-kien-thuc.jpg', format: 'jpeg', quality: 86, width: 1200 },
      { file: 'goc-kien-thuc.webp', format: 'webp', quality: 84, width: 1200 }
    ]);
    console.log('Ảnh chân dung tác giả');
    await render(cdp, authorPhotoHtml(), 'author-photo', 760, 760, [
      { file: 'le-tuan-viet-photo.webp', format: 'webp', quality: 84, width: 760 },
      { file: 'le-tuan-viet-photo.jpg', format: 'jpeg', quality: 86, width: 760 }
    ]);
    console.log('Ảnh đại diện');
    await render(cdp, avatarHtml(), 'avatar', 320, 320, [{ file: 'le-tuan-viet.webp', format: 'webp', quality: 86, width: 320 }]);
  } finally {
    await cdp.close();
  }
}

main().catch(e => { console.error(e.message || e); process.exitCode = 1; });
