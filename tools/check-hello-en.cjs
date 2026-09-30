// SUPERSEDED (2026-09-28): checks the retired guide animation; use tools/hello-pen/check.cjs.
// Capture the English greeting at fixed times using the live localhost CSS.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const target = await (await fetch('http://localhost:9223/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: 640, height: 220, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:5500/?lang=en&skip' });
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const status = await send('Runtime.evaluate', { expression: 'document.readyState === "complete" && !!window.LTV_HELLO_EN', returnByValue: true });
      if (status.result.value) break;
    }
    await send('Runtime.evaluate', { expression: `document.body.innerHTML = '<div class="preloader is-writing">' + window.LTV_HELLO_EN + '</div>'; document.getAnimations().forEach(a => a.pause())`, returnByValue: true });
    await new Promise(resolve => setTimeout(resolve, 100));
    for (const time of [0, 300, 650, 1000, 1300]) {
      await send('Runtime.evaluate', { expression: `document.getAnimations().forEach(a => { a.pause(); a.currentTime = ${time}; })` });
      const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const file = path.join(os.tmpdir(), `ltv-hello-en-${time}.png`);
      fs.writeFileSync(file, Buffer.from(image.data, 'base64'));
      console.log(file);
    }
    await send('Runtime.evaluate', { expression: 'document.querySelectorAll(".hello__ink [mask]").forEach(el => el.removeAttribute("mask"))' });
    const reference = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const referenceFile = path.join(os.tmpdir(), 'ltv-hello-en-reference.png');
    fs.writeFileSync(referenceFile, Buffer.from(reference.data, 'base64'));
    console.log(referenceFile);
  } finally {
    socket.close();
    await fetch(`http://localhost:9223/json/close/${target.id}`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
