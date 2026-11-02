// Dựng màn "xin chào" / "Hello" thành ảnh động WebP (nền trong suốt) từ chính SVG đang dùng.
// Vì sao: ảnh động do compositor của trình duyệt chạy, nên nét chữ vẫn mượt khi luồng chính bận khởi tạo trang
// (hoạt ảnh stroke-dashoffset của SVG thì đứng hình theo luồng chính). Xem js/hello.js.
// Nguồn: svg.hello--ldt trong index.html (VI) và window.LTV_HELLO_EN trong js/hello-en.js (EN), cùng CSS bút trong css/style.css.
// Cách làm: Chrome headless mở SVG với lớp is-writing, dừng mọi animation, tua tới từng mốc 1/60 s, chụp PNG trong suốt,
// rồi ffmpeg (libwebp_anim, lossless, phát 1 lần) ghép thành assets/hello/<tên>.webp.
// Chạy:  node tools/hello-anim/build.cjs [tỉ lệ=0.8]      env: KEEP=1 giữ ảnh từng khung.  Cần: Chrome, ffmpeg trong PATH.
// Chạy lại mỗi khi sửa nét chữ hoặc thời gian trong SVG; nhớ cập nhật thời lượng (ms) ghi trong js/hello.js nếu đổi.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SCALE = +(process.argv[2] || 0.8);
const FPS = 60;
// Khoảng trống đầu ảnh (ms): nhịp ảnh động chạy từ lần đầu ảnh vào khung hình, màn hình có thể hiện nó trễ một nhịp vẽ;
// có khoảng trống nhỏ thì người xem luôn thấy chữ viết từ nét đầu. js/hello.js dùng cùng số này.
const LEAD = 100;
const INK = '#F5F8FF'; // --ivory: màu chữ của .preloader
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const vi = html.match(/<svg class="hello hello--ldt"[\s\S]*?<\/svg>/)[0].replace(/<!--[\s\S]*?-->/g, '');
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'js', 'hello-en.js'), 'utf8').match(/window\.LTV_HELLO_EN\s*=\s*("(?:[^"\\]|\\.)*")/)[1]);
const style = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
const penCss = style.split('\n').filter(l => /^\.(hello__pen|hello__dot) \{|^\.preloader\.is-writing \.hello__pen/.test(l)).join('\n');

const JOBS = [
  { name: 'xin-chao', svg: vi },
  { name: 'hello-en', svg: en }
];

(async () => {
  const port = 9500 + Math.floor(Math.random() * 300);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'hello-anim-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--hide-scrollbars', '--no-first-run', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 50 && !ws; i++) {
    try { const pg = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch (_) {}
    await sleep(200);
  }
  if (ws.readyState !== 1) await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result.result.value; };

  const W = Math.round(1009 * SCALE), H = Math.round(200 * SCALE), PAD = 40;
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W + PAD * 2, height: H + PAD * 2, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

  for (const job of JOBS) {
    const dur = +job.svg.match(/data-duration="(\d+)"/)[1];
    const page = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}
      .preloader{color:${INK};padding:${PAD}px}
      ${penCss}
      svg.hello{display:block;overflow:visible;width:${W}px!important;height:${H}px!important}</style>
      <div class="preloader is-writing">${job.svg}</div>`;
    const { frameTree } = (await send('Page.getFrameTree')).result;
    await send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: page });
    await sleep(300);
    const n = await ev(`(() => { const a = document.getAnimations(); a.forEach(x => x.pause()); return a.length; })()`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hello-frames-'));
    const frames = Math.ceil((LEAD + dur) * FPS / 1000);
    for (let k = 0; k <= frames; k++) {
      const t = Math.min(dur, Math.max(0, k * 1000 / FPS - LEAD));
      await ev(`new Promise(r => { document.getAnimations().forEach(x => { x.currentTime = ${t}; }); requestAnimationFrame(() => requestAnimationFrame(r)); })`);
      const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: PAD, y: PAD, width: W, height: H, scale: 1 } });
      fs.writeFileSync(path.join(dir, `f${String(k).padStart(4, '0')}.png`), Buffer.from(shot.result.data, 'base64'));
    }
    // Khung cuối chụp kèm lề (wide.png) để soát bằng mắt rằng nét không tràn khỏi khung viewBox; KEEP=1 để giữ thư mục khung
    const wide = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W + PAD * 2, height: H + PAD * 2, scale: 1 } });
    fs.writeFileSync(path.join(dir, 'wide.png'), Buffer.from(wide.result.data, 'base64'));
    const outDir = path.join(ROOT, 'assets', 'hello');
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, job.name + '.webp');
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'),
      '-c:v', 'libwebp_anim', '-lossless', '1', '-loop', '1', out]);
    console.log(`${job.name}: ${n} animation, ${frames + 1} khung, ${LEAD} + ${dur} ms, ${W}x${H} -> ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)${process.env.KEEP ? '; khung: ' + dir : ''}`);
    if (!process.env.KEEP) fs.rmSync(dir, { recursive: true, force: true });
  }
  ws.close(); chrome.kill();
  setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (_) {} process.exit(0); }, 500);
})().catch(e => { console.error(e); process.exit(1); });
