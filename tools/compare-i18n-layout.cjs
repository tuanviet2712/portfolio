// Compare rendered Vietnamese and English line counts at the same viewport.
// Usage: node tools/compare-i18n-layout.cjs [width ...]
const widths = process.argv.slice(2).map(Number).filter(Boolean);
if (!widths.length) widths.push(1440, 1024, 768, 390);
const tuneIndex = Number(process.env.LTV_TUNE_INDEX);
const tuneCandidates = (process.env.LTV_TUNE_CANDIDATES || '').split('|').filter(Boolean);

async function openTab() {
  const target = await (await fetch('http://localhost:9223/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let next = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    const waiter = pending.get(msg.id);
    if (!waiter) return;
    pending.delete(msg.id);
    msg.error ? waiter.reject(new Error(msg.error.message)) : waiter.resolve(msg.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { send, close: () => { socket.close(); return fetch(`http://localhost:9223/json/close/${target.id}`); } };
}

const snapshot = `(() => {
  const selectors = '.desc, .ch-stat > span, .vrow__proof, .strength__text, .tl__text, .skill__sub, .checks li, .hero-pos';
  function lines(el) {
    const ys = new Set();
    const bottom = el.getBoundingClientRect().bottom;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim() || node.parentElement.closest('.vrow__proof > span')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) if (rect.width && rect.height && rect.top < bottom - 1) ys.add(Math.round(rect.top * 2) / 2);
    }
    return ys.size;
  }
  function lastLine(el) {
    if (el.childNodes.length !== 1 || el.firstChild.nodeType !== Node.TEXT_NODE) return null;
    const node = el.firstChild;
    const rows = new Map();
    for (const match of node.textContent.matchAll(/\\S+/g)) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const y = Math.round(range.getBoundingClientRect().top);
      rows.set(y, (rows.get(y) || []).concat(match[0]));
    }
    return [...rows.values()].at(-1)?.join(' ') || '';
  }
  return [...document.querySelectorAll(selectors)].map((el, i) => ({
    i, kind: el.className, text: el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 140),
    lines: lines(el), height: Math.round(el.getBoundingClientRect().height),
    font: getComputedStyle(el).fontSize, width: Math.round(el.getBoundingClientRect().width),
    parentWidth: Math.round(el.parentElement.getBoundingClientRect().width),
    grandWidth: Math.round(el.parentElement.parentElement.getBoundingClientRect().width),
    parentClass: el.parentElement.className,
    parentPadding: getComputedStyle(el.parentElement).padding,
    position: el.getBoundingClientRect().left,
    lastLine: lastLine(el)
  }));
})()`;

async function capture(tab, width, lang) {
  await tab.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 761 });
  await tab.send('Page.navigate', { url: `http://localhost:5500/?skip&lang=${lang}` });
  for (let attempt = 0; attempt < 50; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const response = await tab.send('Runtime.evaluate', { expression: `document.readyState === "complete" && document.documentElement.dataset.lang === "${lang}" && innerWidth === ${width} && !!document.querySelector(".footer__brand")`, returnByValue: true });
    if (response.result.value) break;
  }
  await tab.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await tab.send('Runtime.evaluate', { expression: '!!document.querySelector("#showcase-css")?.sheet', returnByValue: true });
    if (response.result.value) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (lang === 'en' && process.env.LTV_PRETTY === '1') {
    await tab.send('Runtime.evaluate', { expression: `(() => { const style = document.createElement('style'); style.textContent = 'html[data-lang="en"] .desc, html[data-lang="en"] .ch-stat > span, html[data-lang="en"] .vrow__proof, html[data-lang="en"] .pw__desc { text-wrap: pretty; }'; document.head.append(style); })()` });
  }
  if (lang === 'en' && process.env.LTV_BALANCE === '1') {
    await tab.send('Runtime.evaluate', { expression: `(() => { const style = document.createElement('style'); style.textContent = 'html[data-lang="en"] .desc, html[data-lang="en"] .ch-stat > span, html[data-lang="en"] .vrow__proof, html[data-lang="en"] .pw__desc { text-wrap: balance; }'; document.head.append(style); })()` });
  }
  await new Promise(resolve => setTimeout(resolve, 200));
  const response = await tab.send('Runtime.evaluate', { expression: snapshot, returnByValue: true });
  return response.result.value;
}

(async () => {
  const tab = await openTab();
  try {
    for (const width of widths) {
      const vi = await capture(tab, width, 'vi');
      const en = await capture(tab, width, 'en');
      const diffs = vi.flatMap((v, i) => en[i] && v.lines !== en[i].lines ? [{ i, vi: v.lines, en: en[i].lines, width: v.width, enWidth: en[i].width, viFont: v.font, enFont: en[i].font, viText: v.text, enText: en[i].text }] : []);
      console.log(`\nWIDTH ${width}: ${vi.length} blocks, ${diffs.length} line differences`);
      console.log(`ORPHAN COUNT ${width}: ${en.filter(item => item.lines > 1 && item.lastLine && item.lastLine.split(/\s+/).length <= 2).length}`);
      for (const d of diffs) console.log(`${String(d.i).padStart(3)}  ${d.vi}>${d.en}  ${d.width}/${d.enWidth}px ${d.viFont}/${d.enFont}  ${d.viText.slice(0, 72)}  =>  ${d.enText.slice(0, 72)}`);
      if (process.env.LTV_ORPHANS === '1') {
        for (const e of en.filter(item => item.lines > 1 && item.lastLine && item.lastLine.split(/\s+/).length <= 2)) console.log('ORPHAN', width, e.i, e.lines, JSON.stringify(e.lastLine), e.text.slice(0, 100));
      }
      if (tuneCandidates.length) {
        for (const candidate of tuneCandidates) {
          await tab.send('Runtime.evaluate', { expression: `(() => { const el=document.querySelectorAll('.desc, .ch-stat > span, .vrow__proof, .strength__text, .tl__text, .skill__sub, .checks li, .hero-pos')[${tuneIndex}]; if (el.classList.contains('vrow__proof')) el.lastChild.textContent=${JSON.stringify(candidate)}; else el.textContent=${JSON.stringify(candidate)}; })()` });
          const response = await tab.send('Runtime.evaluate', { expression: snapshot, returnByValue: true });
          const wrapped = await tab.send('Runtime.evaluate', { expression: `(() => { const el=document.querySelectorAll('.desc, .ch-stat > span, .vrow__proof, .strength__text, .tl__text, .skill__sub, .checks li, .hero-pos')[${tuneIndex}]; const node=el.classList.contains('vrow__proof') ? el.lastChild : el.firstChild; const rows=new Map(); for(const match of node.textContent.matchAll(/\\S+/g)){ const r=document.createRange(); r.setStart(node,match.index); r.setEnd(node,match.index+match[0].length); const y=Math.round(r.getBoundingClientRect().top); rows.set(y,(rows.get(y)||[]).concat(match[0])); } return [...rows.values()].map(x=>x.join(' ')); })()`, returnByValue:true });
          console.log('TUNE', width, tuneIndex, vi[tuneIndex].lines, response.result.value[tuneIndex].lines, JSON.stringify(candidate), JSON.stringify(wrapped.result.value));
        }
      }
    }
  } finally { await tab.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
