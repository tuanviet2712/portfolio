// Audit justified text on the EN page vs VI: per-line word gaps (em), line counts, orphans, overflow.
// Needs the local server on :5500 and a headless Chrome with --remote-debugging-port=9223.
// Usage: node tools/audit-en-justify.cjs [widths...]   env: VI=1 (print VI lines)  SHOWALL=1  QUIET=1
const fs = require('fs');
const widths = process.argv.slice(2).map(Number).filter(Boolean);
if (!widths.length) widths.push(1440, 1280, 1024, 820, 390);
const extraCss = process.env.CSS ? fs.readFileSync(process.env.CSS, 'utf8') : '';
const OVR = process.env.OVR ? JSON.parse(fs.readFileSync(process.env.OVR, 'utf8')) : null;

async function openTab() {
  const target = await (await fetch('http://localhost:9223/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { socket.addEventListener('open', res, { once: true }); socket.addEventListener('error', rej, { once: true }); });
  let next = 0; const pending = new Map();
  socket.addEventListener('message', e => { const m = JSON.parse(e.data); const w = pending.get(m.id); if (!w) return; pending.delete(m.id); m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  return { send, close: () => { socket.close(); return fetch(`http://localhost:9223/json/close/${target.id}`); } };
}

const snapshot = (ROOT, TAG) => `(() => {
  const SEL = '.desc, .ch__text, .hero-pos, .ch-stat > span, .vrow__proof, .quote__text, .skill__sub, .pw__desc, .tl__text, .strength__text, p';
  const out = [];
  const seen = new Set();
  const cv = document.createElement('canvas').getContext('2d');
  const ALL = [...document.querySelector(${JSON.stringify(ROOT)}).querySelectorAll(SEL)];
  for (const el of ALL) {
    if (seen.has(el)) continue; seen.add(el);
    if (el.closest('script,noscript,#preloader,.menu,.hero-3d')) continue;
    const cs = getComputedStyle(el);
    if (cs.textAlign !== 'justify') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // words with positions
    const words = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('.vrow__proof > span') ) continue;
      if (getComputedStyle(node.parentElement).display === 'none') continue;
      for (const m of node.textContent.matchAll(/\\S+/g)) {
        const rg = document.createRange(); rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
        const rects = [...rg.getClientRects()].filter(x => x.width);
        if (!rects.length) continue;
        const a = rects[0], b = rects[rects.length - 1];
        words.push({ w: m[0], top: Math.round(b.top), left: a.left, right: b.right, bottom: b.bottom });
      }
    }
    if (!words.length) continue;
    // clip: words below element bottom (line-clamp)
    const clipped = words.filter(w => w.bottom > r.bottom + 2).length;
    const lines = [];
    for (const w of words) {
      const L = lines[lines.length - 1];
      if (L && Math.abs(L.top - w.top) < 4) L.words.push(w); else lines.push({ top: w.top, words: [w] });
    }
    cv.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const fs = parseFloat(cs.fontSize);
    const space = cv.measureText(' ').width + (parseFloat(cs.wordSpacing) || 0);
    const info = lines.map((L, i) => {
      let max = 0;
      for (let k = 1; k < L.words.length; k++) max = Math.max(max, L.words[k].left - L.words[k - 1].right);
      return { n: L.words.length, gap: +(max / fs).toFixed(2), text: L.words.map(w => w.w).join(' ') };
    });
    const body = info.slice(0, -1);
    const worst = body.length ? Math.max(...body.map(x => x.gap)) : 0;
    const idx = ${JSON.stringify(TAG)} + ALL.indexOf(el);
    out.push({ ovf: [...el.querySelectorAll('.jl')].filter(s => s.scrollWidth > s.clientWidth + 0.5).length, idx, cls: el.className.toString().slice(0, 40), sec: (el.closest('section,[id]')||{}).id || '', lines: lines.length, clipped, worst, space: +(space/fs).toFixed(2), last: info[info.length-1].n, info, width: Math.round(r.width), key: el.textContent.trim().replace(/\\s+/g,' ').slice(0, 60) });
  }
  return out;
})()`;

async function capture(tab, width, lang) {
  await tab.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 761 });
  await tab.send('Page.navigate', { url: `http://localhost:5500/?skip${lang === 'en' ? '&lang=en' : ''}&cb=${Date.now()}` });
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 100));
    const res = await tab.send('Runtime.evaluate', { expression: `document.readyState === "complete" && innerWidth === ${width} && !!document.querySelector(".pw__desc")`, returnByValue: true });
    if (res.result.value) break;
  }
  await tab.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
  if (lang === 'en' && OVR) {
    await tab.send('Runtime.evaluate', { expression: `(() => { const o = ${JSON.stringify(OVR)}; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (o[t]) n.nodeValue = n.nodeValue.replace(t, o[t]); } })()` });
  }
  if (lang === 'en' && extraCss) {
    await tab.send('Runtime.evaluate', { expression: `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(extraCss)}; document.head.append(s); })()` });
  }
  // open all accordions/panels so everything has layout? keep default
  await new Promise(r => setTimeout(r, 400));
  const ev = async x => (await tab.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result.value;
  if (width < 1025) await ev(`document.querySelectorAll('.vrow').forEach(r => r.classList.add('is-open'))`);
  await new Promise(r => setTimeout(r, 300));
  let all = await ev(snapshot('body', ''));
  if (width >= 1025) {
    const n = await ev(`document.querySelectorAll('.vrow').length`);
    for (let k = 0; k < n; k++) {
      await ev(`document.querySelectorAll('.vrow__head')[${k}].click()`);
      await new Promise(r => setTimeout(r, 650));
      all = all.concat(await ev(snapshot('[data-vpanel]', 'P' + k + '.')));
    }
  }
  return all;
}

(async () => {
  const tab = await openTab();
  try {
    for (const width of widths) {
      const vi = process.env.ONLY === 'en' ? [] : await capture(tab, width, 'vi');
      const en = await capture(tab, width, 'en');
      console.log(`\n==== WIDTH ${width}  (vi ${vi.length} / en ${en.length} blocks)`);
      const keys = new Set();
      let bad = 0;
      for (let i = 0; i < en.length; i++) {
        const e = en[i], v = vi.find(x => x.idx === e.idx);
        if (keys.has(e.key)) continue; keys.add(e.key);
        const flags = [];
        if (v && v.lines !== e.lines) flags.push(`LINES vi${v.lines}/en${e.lines}`);
        if (e.worst > Math.max(0.55, v ? v.worst + 0.05 : 0)) flags.push(`GAP ${e.worst}em`);
        if (e.lines > 1 && e.last <= 2) flags.push(`ORPHAN ${e.last}`);
        if (e.clipped > (v ? v.clipped : 0)) flags.push(`CLIPPED ${e.clipped}w`);
        if (e.ovf) flags.push(`OVERFLOW ${e.ovf}`);
        if (flags.length) bad++;
        if (!flags.length && !process.env.SHOWALL) continue;
        if (process.env.QUIET) continue;
        console.log(`#${e.idx} [${e.sec}] .${e.cls} w${e.width} sp${e.space}  ${flags.join(' | ')}`);
        for (const l of e.info) console.log(`     ${String(l.gap).padEnd(5)} ${l.text}`);
        if (v && process.env.VI) for (const l of v.info) console.log(`  vi ${String(l.gap).padEnd(5)} ${l.text}`);
      }
      console.log(`---- ${width}: ${bad} flagged`);
    }
  } finally { await tab.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
