/* ==========================================================================
   Ảnh minh họa trong thân bài: PNG gốc → WebP 1600 + WebP 800 (srcset)
   Chạy:  node tools/kb/render-figures.cjs <slug-thư-mục> [tên-đuôi]
   Ví dụ: node tools/kb/render-figures.cjs ao-giac-ai ao-giac-ai

   Vào : tools/kb/figures/<slug-thư-mục>/NN.png        (ảnh gốc 16:9, tên là số thứ tự 01, 02, …; KHÔNG được triển khai)
   Ra  : assets/kb/<slug-thư-mục>/NN-<tên-đuôi>.webp        1600 px (q 82)
         assets/kb/<slug-thư-mục>/NN-<tên-đuôi>-800.webp    800 px  (q 80)
   Trong bài dùng:
     <figure class="kb-fig"><img src="/assets/kb/<slug>/NN-<đuôi>.webp"
       srcset="/assets/kb/<slug>/NN-<đuôi>-800.webp 800w, /assets/kb/<slug>/NN-<đuôi>.webp 1600w"
       sizes="(min-width: 840px) 760px, 100vw" alt="…" width="1600" height="900"><figcaption>…</figcaption></figure>
   Giữ PNG gốc trong tools/ (không nằm trong assets/) để thư mục triển khai không phình thêm hàng chục MB.
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const [dirName, suffix = dirName] = process.argv.slice(2);
if (!dirName) { console.error('Cách dùng: node tools/kb/render-figures.cjs <slug-thư-mục> [tên-đuôi]'); process.exit(1); }
const SRC = path.join(__dirname, 'figures', dirName);
const OUT = path.join(ROOT, 'assets', 'kb', dirName);
const WORK = path.join(os.tmpdir(), `ltv-figures-${process.pid}`);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')].find(p => p && fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch() {
  if (!CHROME) throw new Error('Không thấy Chrome');
  fs.mkdirSync(WORK, { recursive: true });
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(WORK, 'profile')}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--allow-file-access-from-files', '--force-color-profile=srgb', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const port = await new Promise((res, rej) => {
    let buf = ''; const t = setTimeout(() => rej(new Error('Chrome không mở được cổng gỡ lỗi')), 20000);
    proc.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//); if (m) { clearTimeout(t); res(+m[1]); } });
    proc.on('exit', c => rej(new Error('Chrome thoát mã ' + c)));
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

async function convert(cdp, png, outFile, width, quality) {
  const page = path.join(WORK, `c-${path.basename(outFile)}.html`);
  fs.writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"></head><body><img id="s" src="${pathToFileURL(png).href}"></body></html>`, 'utf8');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 300, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: pathToFileURL(page).href });
  for (let i = 0; i < 80; i++) {
    await sleep(100);
    const r = await cdp.send('Runtime.evaluate', { expression: 'document.readyState==="complete"&&document.getElementById("s").naturalWidth>0', returnByValue: true });
    if (r.result.value) break;
  }
  const r = await cdp.send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `(async()=>{const img=document.getElementById('s');const full=await createImageBitmap(img);const k=${width}/full.width;const dw=${width},dh=Math.round(full.height*k);const c=new OffscreenCanvas(dw,dh);c.getContext('2d').drawImage(full,0,0,dw,dh);const blob=await c.convertToBlob({type:'image/webp',quality:${quality}});const b=new Uint8Array(await blob.arrayBuffer());let out='';for(let i=0;i<b.length;i++)out+=String.fromCharCode(b[i]);return btoa(out)+'|'+dw+'|'+dh})()`
  });
  if (!r.result || typeof r.result.value !== 'string') throw new Error('Không chuyển được ' + png);
  const [b64, w, h] = r.result.value.split('|');
  fs.writeFileSync(outFile, Buffer.from(b64, 'base64'));
  console.log(`  + ${path.relative(ROOT, outFile)}  ${w}×${h}  ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`);
}

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Không thấy thư mục ảnh gốc ${path.relative(ROOT, SRC)}`);
  const pngs = fs.readdirSync(SRC).filter(f => /\.png$/i.test(f)).sort();
  if (!pngs.length) throw new Error('Thư mục ảnh gốc không có file .png');
  fs.mkdirSync(OUT, { recursive: true });
  const cdp = await launch();
  try {
    for (const f of pngs) {
      const n = f.replace(/\.png$/i, '');
      console.log(f);
      await convert(cdp, path.join(SRC, f), path.join(OUT, `${n}-${suffix}.webp`), 1600, 0.82);
      await convert(cdp, path.join(SRC, f), path.join(OUT, `${n}-${suffix}-800.webp`), 800, 0.80);
    }
  } finally { await cdp.close(); }
}
main().catch(e => { console.error(e.message || e); process.exitCode = 1; });
