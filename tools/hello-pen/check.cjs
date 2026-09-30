// Step 5 - check a generated greeting preview (needs Chrome on :9223, see README):
//  * the last animated frame must equal the exact font outlines (mask removed);
//  * a filmstrip of the writing is saved to the work folder.
// Usage: node tools/hello-pen/check.cjs [vi] [en]
const fs = require('fs'), path = require('path');
const { WORK, tab, toUrl } = require('./raster.cjs');

async function check(lang) {
  const t = await tab();
  const ev = async x => {
    const r = await t.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result.result.value;
  };
  await t.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 300, deviceScaleFactor: 3, mobile: false });
  await t.send('Page.navigate', { url: toUrl(path.join(WORK, `preview-${lang}.html`)) });
  await new Promise(r => setTimeout(r, 900));
  const total = await ev(`(() => { document.querySelector('.stage').classList.add('is-writing');
    document.getAnimations().forEach(a => a.pause()); return +document.querySelector('.hello').dataset.duration; })()`);
  const shot = async () => (await t.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 700, height: 260, scale: 1 } })).result.data;
  const seek = async ms => { await ev(`document.getAnimations().forEach(a => { a.currentTime = ${ms}; })`); await new Promise(r => setTimeout(r, 60)); };
  const frames = [];
  for (let ms = 0; ms <= total; ms += 150) { await seek(ms); frames.push([ms, await shot()]); }
  await seek(total + 200);
  const anim = await shot();
  await ev(`document.querySelector('.stage').classList.add('is-written')`);
  await new Promise(r => setTimeout(r, 60));
  const ink = await shot();
  // compare the two screenshots inside the page
  const diff = await ev(`(async () => {
    const load = b => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b; });
    const px = async b => { const i = await load(b); const c = new OffscreenCanvas(i.width, i.height); const x = c.getContext('2d');
      x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const a = await px(${JSON.stringify(anim)}), b = await px(${JSON.stringify(ink)});
    let n8 = 0, n32 = 0, max = 0, inkPx = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      if (b[i] > 128) inkPx++;
      if (d > 24) n8++; if (d > 96) n32++; if (d > max) max = d;
    }
    return { n8, n32, max, inkPx };
  })()`);
  await t.close();
  frames.forEach(([ms, b64]) => fs.writeFileSync(path.join(WORK, `film-${lang}-${String(ms).padStart(4, '0')}.png`), Buffer.from(b64, 'base64')));
  console.log(`${lang}: ${total} ms, ${frames.length} frames in ${WORK}; last frame vs exact outlines: ` +
    `${diff.n32} px clearly different, ${diff.n8} slightly (of ${diff.inkPx} ink px)`);
  return diff.n32 < 20;
}

(async () => {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['en'];
  let ok = true;
  for (const lang of langs) ok = (await check(lang)) && ok;
  process.exitCode = ok ? 0 : 1;
})();
