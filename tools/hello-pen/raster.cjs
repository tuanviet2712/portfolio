// Step 1 — rasterise the exact greeting outlines, as Chrome draws them, for the pen pipeline.
// Needs a Chrome started with --remote-debugging-port=9223 (see README).
// Usage: node tools/hello-pen/raster.cjs [vi] [en]
const fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const WORK = process.env.HELLO_WORK || path.join(os.tmpdir(), 'ltv-hello-pen');
const SCALE = 10;                       // px per viewBox unit
const toUrl = p => 'file:///' + p.split(path.sep).join('/');

// The greeting markup currently on the site (VI inline in index.html, EN in js/hello-en.js).
function greeting(lang) {
  if (lang === 'vi') return fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<svg class="hello"[\s\S]*?<\/svg>/)[0];
  const js = fs.readFileSync(path.join(ROOT, 'js/hello-en.js'), 'utf8');
  return JSON.parse(js.match(/window\.LTV_HELLO_EN = (".*");/)[1]);
}

// Every outline inside .hello__ink (the i-dot included), without masks.
function inkOnly(svg) {
  const g = svg.match(/<g class="hello__ink"([^>]*)>([\s\S]*?)<\/g>\s*<\/svg>/);
  const tf = (g[1].match(/transform="([^"]*)"/) || [])[1] || '';
  const ds = [...g[2].matchAll(/<path\b[^>]*?\sd="([^"]+)"/g)].map(m => m[1]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -20 640 220" width="640" height="220">` +
    `<rect x="0" y="-20" width="640" height="220" fill="#000"/>` +
    `<g fill="#fff" transform="${tf}">${ds.map(d => `<path d="${d}"/>`).join('')}</g></svg>`;
}

async function tab() {
  const t = await (await fetch('http://localhost:9223/json/new?about:blank', { method: 'PUT' })).json();
  const s = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => s.addEventListener('open', r, { once: true }));
  let id = 0; const p = new Map();
  s.addEventListener('message', e => { const m = JSON.parse(e.data); p.get(m.id)?.(m); });
  const send = (m, params = {}) => new Promise(r => { p.set(++id, r); s.send(JSON.stringify({ id, method: m, params })); });
  return { send, close: () => { s.close(); return fetch('http://localhost:9223/json/close/' + t.id); } };
}

module.exports = { ROOT, WORK, greeting, tab, toUrl };

if (require.main === module) (async () => {
  fs.mkdirSync(WORK, { recursive: true });
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['en'];
  for (const lang of langs) {
    const svgFile = path.join(WORK, `ink-${lang}.svg`);
    fs.writeFileSync(svgFile, inkOnly(greeting(lang)));
    const t = await tab();
    await t.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 220, deviceScaleFactor: SCALE, mobile: false });
    await t.send('Page.navigate', { url: toUrl(svgFile) });
    await new Promise(r => setTimeout(r, 800));
    const shot = await t.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 640, height: 220, scale: 1 } });
    fs.writeFileSync(path.join(WORK, `ink-${lang}.png`), Buffer.from(shot.result.data, 'base64'));
    await t.close();
    console.log(`${lang}: ${path.join(WORK, `ink-${lang}.png`)}`);
  }
})();
