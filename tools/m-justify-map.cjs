// Đo số dòng của từng đoạn văn trên bản MÁY TÍNH (VI + EN) và ghi bảng DESK vào js/m-justify.js,
// để bản điện thoại ngắt dòng đúng bằng số dòng đó khi có thể.
// Cần: máy chủ xem thử (CHAY-LOCALHOST.bat, cổng 5500) + Chrome mở cổng gỡ lỗi:
//   chrome --headless=new --remote-debugging-port=9223 --user-data-dir=<thư mục tạm>
// Chạy:  node tools/m-justify-map.cjs [rộng=1440] [cao=900]      env: CDP_PORT=9223  BASE=http://localhost:5500/
// Chạy lại mỗi khi sửa chữ của các đoạn mô tả trên trang chủ.
const fs = require('fs');
const path = require('path');
const PORT = process.env.CDP_PORT || 9223;
const BASE = process.env.BASE || 'http://localhost:5500/';
const [W, H] = [+(process.argv[2] || 1440), +(process.argv[3] || 900)];
const FILE = path.join(__dirname, '..', 'js', 'm-justify.js');

async function openTab() {
  const target = await (await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { socket.addEventListener('open', res, { once: true }); socket.addEventListener('error', rej, { once: true }); });
  let next = 0; const pending = new Map();
  socket.addEventListener('message', e => { const m = JSON.parse(e.data); const w = pending.get(m.id); if (!w) return; pending.delete(m.id); m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evalJs = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
  return { send, evalJs, close: () => { socket.close(); return fetch(`http://localhost:${PORT}/json/close/${target.id}`); } };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PROBE = `(() => {
  const SEL = '.sec-head__foot .desc, .about__block .desc, .strength .desc, .tl .desc, .vcard__desc, .vcard__proof-txt, .vrow__content .desc, .vrow__proof p, .vpanel .desc, .skx-panel__desc, .skill .desc, .pstep .desc, .pfx-card__desc, .pw__desc, .quote__text, .cta__main .desc, .footer__brand .desc';
  const out = {};
  for (const el of document.querySelectorAll(SEL)) {
    if (el.closest('#trang-chu')) continue;
    if (!el.getBoundingClientRect().width) continue;
    const t = el.textContent;
    if (!t.trim()) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const tops = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.width > 0 && !tops.some(y => Math.abs(y - q.top) < fs * 0.5)) tops.push(q.top);
    }
    const k = LTV.mjHash(t);
    if (!out[k]) out[k] = tops.length;
  }
  return out;
})()`;

(async () => {
  const res = {};
  for (const lg of ['vi', 'en']) {
    const tab = await openTab();
    await tab.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await tab.send('Page.enable');
    await tab.send('Page.navigate', { url: BASE + '?nohello' + (lg === 'en' ? '&lang=en' : '') });
    await sleep(5000);
    const SH = await tab.evalJs('document.documentElement.scrollHeight');
    for (let y = 0; y < SH; y += 700) { await tab.evalJs(`window.scrollTo(0, ${y})`); await sleep(40); }
    await sleep(1200);
    res[lg] = await tab.evalJs(PROBE);
    await tab.close();
    console.log(lg, Object.keys(res[lg]).length, 'đoạn');
  }
  const src = fs.readFileSync(FILE, 'utf8');
  const next = src.replace(/\/\*DESK\*\/[\s\S]*?\/\*\/DESK\*\//, '/*DESK*/const DESK = ' + JSON.stringify(res) + ';/*/DESK*/');
  if (next === src) console.log('Bảng không đổi');
  else { fs.writeFileSync(FILE, next); console.log('Đã ghi bảng vào', path.relative(process.cwd(), FILE)); }
})().catch(e => { console.error(e); process.exit(1); });
