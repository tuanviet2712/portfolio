// Save a cropped screenshot of the English project category header for QA.
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const target = await (await fetch('http://localhost:9223/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  try {
    for (const width of [1440, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 761 });
      await send('Page.navigate', { url: 'http://localhost:5500/?skip&lang=en' });
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const ready = await send('Runtime.evaluate', { expression: 'document.readyState === "complete" && document.documentElement.dataset.lang === "en" && !!document.querySelector(".pw__head")', returnByValue: true });
        if (ready.result.value) break;
      }
      await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
      await send('Runtime.evaluate', { expression: 'document.querySelector(".pw__head").scrollIntoView({block:"center",behavior:"instant"})' });
      await new Promise(resolve => setTimeout(resolve, 1100));
      const result = await send('Runtime.evaluate', { expression: `(() => { const el=document.querySelector('.pw__head'); const desc=el.querySelector('.pw__desc'); const r=el.getBoundingClientRect(); const d=desc.getBoundingClientRect(); return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,description:desc.textContent,align:getComputedStyle(desc).textAlign,lastAlign:getComputedStyle(desc).textAlignLast,descX:d.left,descW:d.width}; })()`, returnByValue: true });
      const box = result.result.value;
      const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height, scale: 1 } });
      const output = path.join(process.env.TEMP, `ltv-plan-en-${width}.png`);
      fs.writeFileSync(output, Buffer.from(png.data, 'base64'));
      console.log(JSON.stringify({ width, output, box }));
    }
  } finally {
    socket.close();
    await fetch(`http://localhost:9223/json/close/${target.id}`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
