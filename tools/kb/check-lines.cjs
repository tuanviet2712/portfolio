/* ==========================================================================
   GÓC KIẾN THỨC — kiểm tra hai quy tắc trình bày chữ của bài viết

   1. Không để dòng cuối của đoạn chỉ còn 1–2 chữ.
   2. Căn đều hai bên nhưng không để khe giữa các chữ giãn quá rộng.
   Cách sửa khi báo lỗi: viết thêm 1–2 chữ vào chính câu đó, không đổi sang căn trái.

   Cần máy chủ localhost đang chạy (tools\serve.ps1) và Google Chrome.
   Chạy:  node tools/kb/check-lines.cjs <url> [bề ngang]
   Nên đo ở nhiều bề ngang: 1280, 1440, 1600, 1920. Sửa ở cỡ này có thể làm
   lệch cỡ khác, nên đo lại tất cả sau mỗi lần sửa câu chữ.
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const URL_ = process.argv[2] || 'http://localhost:5500/goc-kien-thuc/marketing/micro-conversion-la-gi/';
const WIDTH = +(process.argv[3] || 1440);
const WORK = path.join(os.tmpdir(), `ltv-measure-${process.pid}`);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch() {
  fs.mkdirSync(WORK, { recursive: true });
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(WORK, 'profile')}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const port = await new Promise((res, rej) => {
    let buf = '';
    const t = setTimeout(() => rej(new Error('Chrome không mở cổng DevTools')), 20000);
    proc.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//); if (m) { clearTimeout(t); res(+m[1]); } });
  });
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(URL_)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); });
  const send = (method, params = {}) => new Promise((res, rej) => { const k = ++id; pending.set(k, { res, rej }); ws.send(JSON.stringify({ id: k, method, params })); });
  await send('Page.enable');
  return { send, close: async () => { try { ws.close(); } catch (_) {} proc.kill(); await sleep(300); try { fs.rmSync(WORK, { recursive: true, force: true }); } catch (_) {} } };
}

const PROBE = `(() => {
  const out = [];
  const sel = '.kb-art__sapo, .kb-sum li, .kb-prose p,'
    + ' .kb-prose ul:not([class]) > li, .kb-prose ol:not([class]) > li,'
    + ' .kb-list-cards > li, .kb-steps li > span:last-child,'
    + ' .kb-table td, .kb-case__m dd, .kb-stats dd,'
    // mô tả trên thẻ bài viết của trang tổng, trang chủ đề và trang chủ
    + ' .kb-post__x, .kbh-post__excerpt, .kbdd__desc';
  const where = el => el.closest('.kb-table') ? 'bảng'
    : el.closest('.kb-list-cards') ? 'thẻ danh sách'
    : el.closest('.kb-steps') ? 'ô sơ đồ'
    : el.closest('.kb-case__m') ? 'số dự án'
    : el.closest('.kb-stats') ? 'số nổi bật'
    : el.closest('.kb-sum') ? 'tóm tắt'
    : el.matches('.kb-post__x, .kbh-post__excerpt, .kbdd__desc') ? 'thẻ bài viết'
    : el.classList.contains('kb-art__sapo') ? 'sapo' : 'thân bài';
  document.querySelectorAll(sel).forEach((el, idx) => {
    if (el.closest('.kb-cta')) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const words = []; let n;
    while ((n = walker.nextNode())) {
      const s = n.nodeValue, re = /\\S+/g; let m;
      while ((m = re.exec(s))) {
        const r = document.createRange();
        r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const b = r.getBoundingClientRect();
        if (!b.width && !b.height) continue;
        words.push({ w: m[0], top: Math.round(b.top), left: b.left, right: b.right });
      }
    }
    if (!words.length) return;
    const rows = []; let cur = null;
    for (const w of words) {
      if (!cur || Math.abs(w.top - cur.top) > 3) { cur = { top: w.top, items: [] }; rows.push(cur); }
      cur.items.push(w);
    }
    const cs = getComputedStyle(el);
    const fs_ = parseFloat(cs.fontSize);
    // chữ bị cắt sau N dòng: dòng cuối không phải kết câu nên bỏ qua quy tắc 1-2 chữ
    const isClamped = !!(cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
    let maxGap = 0, gapLine = -1, gapText = '';
    rows.forEach((r, i) => {
      if (i === rows.length - 1) return;
      for (let k = 1; k < r.items.length; k++) {
        const g = r.items[k].left - r.items[k - 1].right;
        if (g > maxGap) { maxGap = g; gapLine = i + 1; gapText = r.items.map(x => x.w).join(' '); }
      }
    });
    const last = rows[rows.length - 1];
    out.push({
      lines: rows.length,
      lastWords: last.items.length,
      lastText: last.items.map(x => x.w).join(' '),
      gapEm: +(maxGap / fs_).toFixed(2),
      gapLine, gapText: gapText.slice(0, 90),
      zone: where(el), clamped: isClamped,
      head: el.textContent.trim().slice(0, 64)
    });
  });
  return JSON.stringify(out);
})()`;

(async () => {
  const cdp = await launch();
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 1000, deviceScaleFactor: 1, mobile: false });
    let ok = false;
    for (let i = 0; i < 150; i++) {
      await sleep(100);
      const r = await cdp.send('Runtime.evaluate', {
        expression: 'document.readyState === "complete" && document.querySelectorAll(".kb-prose p, .kb-post__x, .kbh-post__excerpt").length > 0',
        returnByValue: true
      }).catch(() => ({ result: { value: false } }));
      if (r.result.value) { ok = true; break; }
    }
    if (!ok) {
      const dbg = await cdp.send('Runtime.evaluate', {
        expression: 'JSON.stringify({href: location.href, state: document.readyState, prose: document.querySelectorAll(".kb-prose").length, p: document.querySelectorAll("p").length, body: document.body ? document.body.innerHTML.length : -1})',
        returnByValue: true
      }).catch(e => ({ result: { value: 'loi: ' + e.message } }));
      throw new Error('Trang không tải xong. ' + dbg.result.value);
    }
    await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise(r => setTimeout(r, 300)))', awaitPromise: true });
    const r = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
    const data = JSON.parse(r.result.value);

    const orphan = data.filter(o => !o.clamped && o.lines > 1 && o.lastWords <= 2);
    const wide = data.filter(o => o.gapEm >= 0.62).sort((a, b) => b.gapEm - a.gapEm);
    console.log(`Đã đo ${data.length} đoạn ở bề ngang ${WIDTH}px\n`);
    console.log(`DÒNG CUỐI CHỈ 1–2 CHỮ: ${orphan.length}`);
    orphan.forEach(o => console.log(`  · [${o.zone}] "${o.lastText}"   <-- ${o.lines} dòng | ${o.head}…`));
    console.log(`\nKHE CHỮ GIÃN RỘNG (>= 0.62em, khe thường ~0.26em): ${wide.length}`);
    wide.slice(0, 14).forEach(o => console.log(`  · [${o.zone}] ${o.gapEm}em  dòng ${o.gapLine}: ${o.gapText}`));
  } finally {
    await cdp.close();
  }
})().catch(e => { console.error(e.message || e); process.exitCode = 1; });
