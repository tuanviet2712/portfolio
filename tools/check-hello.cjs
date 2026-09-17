// Visual regression for original-font handwriting, speed, and the c-h join.
// Requires Playwright + pngjs. CHROME_PATH optionally selects an installed browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/<svg class="hello"[\s\S]*?<\/svg>/)[0];
const font = fs.readFileSync(path.join(root, 'assets/lettering/playwrite-vn-300-subset.ttf')).toString('base64');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');

function components(png, region) {
  const scale = png.width / 640;
  const [left, top, right, bottom] = region.map(v => Math.round(v * scale));
  const ink = new Set();
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const i = y * png.width + x;
    if (Math.min(...png.data.subarray(i * 4, i * 4 + 3)) > 150) ink.add(i);
  }
  const sizes = [];
  while (ink.size) {
    const first = ink.values().next().value;
    ink.delete(first);
    const stack = [first];
    let size = 0;
    while (stack.length) {
      const i = stack.pop();
      size++;
      for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
        const next = i + dy * png.width + dx;
        if (ink.delete(next)) stack.push(next);
      }
    }
    if (size > 2) sizes.push(size);
  }
  return sizes;
}

function junctionCorner(png) {
  // Measure the inner edge through the reported c/h junction at 4x resolution.
  // A terminal sticking out of the ribbon produces a sudden change of slope,
  // even though the ink remains connected. The old drawing measured 0.697.
  const scale = png.width / 640;
  const edges = [];
  for (let y = Math.round(125 * scale); y <= Math.round(155 * scale); y++) {
    const value = x => png.data[(y * png.width + x) * 4];
    let x = Math.round(410 * scale);
    while (x > 330 * scale && value(x) <= 132) x--;
    assert.ok(x > 330 * scale, 'Missing rising stroke at the junction');
    while (value(x - 1) > 132) x--;
    const low = value(x - 1), high = value(x);
    edges.push(x - 1 + (132 - low) / (high - low));
  }
  const slopes = [];
  for (let i = 4; i < edges.length - 4; i++) slopes.push((edges[i + 4] - edges[i - 4]) / 8);
  let corner = 0;
  for (let i = 4; i < slopes.length - 4; i++) corner = Math.max(corner, Math.abs(slopes[i + 4] - slopes[i - 4]));
  return corner;
}

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
      await page.setContent(`<style>@font-face{font-family:OriginalHello;src:url(data:font/ttf;base64,${font});font-weight:300}${css}.preloader{background:#122039}.preloader::before{display:none}</style><div class="preloader is-writing">${svg}</div>`);
      assert.ok(Number(await page.locator('.hello').getAttribute('data-duration')) <= 2050, 'Writing must finish in about two seconds');
      await page.evaluate(() => document.getAnimations().forEach(a => a.pause()));
      const capture = async time => {
        await page.evaluate(t => document.getAnimations().forEach(a => { a.currentTime = t; }), time);
        return PNG.sync.read(await page.locator('.hello').screenshot());
      };
      assert.equal(components(await capture(0), [0, 0, 639, 219]).length, 0, 'No dots before writing');
      const info = await page.locator('[data-stroke="c-h"]').first().evaluate(p => ({ delay:parseFloat(p.style.getPropertyValue('--delay')), duration:parseFloat(p.style.getPropertyValue('--duration')) }));
      for (let frame = 1; frame <= 60; frame++) {
        const png = await capture(info.delay + info.duration * frame / 60);
        assert.equal(components(png, [290, 20, 410, 190]).length, 1,
          `Broken c-h ink at frame ${frame}, viewport ${width}`);
      }
      if (width === 1280) {
        await page.setViewportSize({ width: 1280, height: 440 });
        await page.locator('.hello').evaluate(el => { el.style.width = '1280px'; });
        const detail = await capture(info.delay + info.duration * .7);
        const corner = junctionCorner(detail);
        assert.ok(corner < .3, `Raised edge at c/h junction: ${corner.toFixed(3)}`);
        console.log(`PASS junction edge: ${corner.toFixed(3)} (old drawing: 0.697)`);
        await page.locator('.hello').evaluate(el => { el.style.width = ''; });
        await page.setViewportSize({ width, height: 844 });
      }
      await page.locator('.preloader').evaluate(el => el.classList.add('is-written'));
      const finished = PNG.sync.read(await page.locator('.hello').screenshot());
      await page.evaluate(async () => {
        await document.fonts.load('300 118px OriginalHello', 'xin chào');
        document.querySelector('.hello__ink').innerHTML = '<text x="40" y="160" font-family="OriginalHello" font-size="118" font-weight="300">xin chào</text>';
      });
      const solid = PNG.sync.read(await page.locator('.hello').screenshot());
      const tmp = require('node:os').tmpdir();
      fs.writeFileSync(path.join(tmp, 'hello-font-outlines.png'), PNG.sync.write(finished));
      fs.writeFileSync(path.join(tmp, 'hello-font-text.png'), PNG.sync.write(solid));
      // Compare against actual font rendering. Two device pixels accommodate
      // font hinting and text/path rasterization at the tested 2x pixel density.
      for (const [actual, expected] of [[finished, solid], [solid, finished]]) {
        for (let y = 1; y < actual.height-1; y++) for (let x = 1; x < actual.width-1; x++) {
          if (actual.data[(y*actual.width+x)*4] <= 132) continue;
          let covered = false;
          for (const dy of [-2, -1, 0, 1, 2]) for (const dx of [-2, -1, 0, 1, 2]) {
            covered ||= expected.data[((y+dy)*expected.width+x+dx)*4] > 132;
          }
          assert.ok(covered, `Final drawing has missing/extra ink at ${x},${y}`);
        }
      }
      await page.emulateMedia({ reducedMotion:'reduce' });
      await page.locator('.preloader').evaluate(el => el.classList.remove('is-written'));
      assert.equal(await page.locator('.hello').evaluate(el => el.getAnimations({subtree:true}).length), 0);
      console.log(`PASS ${width}px: under 2.05s, 60 continuous frames, matches original Playwrite VN font`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
