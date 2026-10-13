// Usage: node scripts/verify-browser-preservation.cjs <built-browser-dir> <evidence-dir> <label>
// Runs only a loopback static server and an isolated headless Chrome profile.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

async function main() {
  const [root, output, label] = process.argv.slice(2);
  assert.ok(root && output && label);
  await fs.mkdir(output, { recursive: true });
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon' };
  const server = http.createServer(async (req, res) => {
    try {
      let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(path.resolve(root) + path.sep)) file = path.join(root, 'index.html');
      try { if (!(await fs.stat(file)).isFile()) file = path.join(root, 'index.html'); }
      catch { file = path.join(root, 'index.html'); }
      const data = await fs.readFile(file);
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.end(data);
    } catch { res.statusCode = 500; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'eastalya-chrome-'));
  const chrome = spawn(process.env.CHROME_BIN || '/usr/bin/google-chrome', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userData}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let ws;
  const pending = new Map();
  const errors = [];
  try {
    let port;
    for (let i = 0; i < 100 && !port; i++) {
      try { port = Number((await fs.readFile(path.join(userData, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { await delay(50); }
    }
    assert.ok(port, 'Chrome did not initialize');
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    let id = 0;
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const waiter = pending.get(message.id); pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push('console error');
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
    await send('Page.enable'); await send('Runtime.enable');
    const results = [];
    for (const [width, height] of [[320, 800], [768, 1024], [1440, 900]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      for (const route of ['/', '/signin']) {
        await send('Page.navigate', { url: url + route });
        let ready = false;
        for (let i = 0; i < 100; i++) {
          const state = await send('Runtime.evaluate', { expression: "document.querySelector('app-signin p')?.textContent === 'signin works!'", returnByValue: true });
          if (state.result.value) { ready = true; break; } await delay(50);
        }
        assert.ok(ready, 'Existing sign-in did not render');
        const state = await send('Runtime.evaluate', { expression: "JSON.stringify({path:location.pathname,text:document.body.innerText.trim(),title:document.title,lang:document.documentElement.lang,viewport:!!document.querySelector('meta[name=viewport]'),overflow:document.documentElement.scrollWidth>innerWidth,forms:document.querySelectorAll('form').length})", returnByValue: true });
        const value = JSON.parse(state.result.value);
        assert.equal(value.path, '/signin'); assert.equal(value.text, 'signin works!');
        assert.equal(value.title, 'EastalyaAdmin'); assert.equal(value.lang, 'en'); assert.equal(value.viewport, true); assert.equal(value.overflow, false);
        results.push({ width, height, route, ...value });
      }
      await send('Runtime.evaluate', { expression: 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))', awaitPromise: true });
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      await fs.writeFile(path.join(output, `${label}-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, `${label}.json`), JSON.stringify({ checks: results, runtimeErrors: errors }, null, 2));
    console.log(`Browser preservation: ${results.length} route/viewport cases passed; no runtime errors`);
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
    await new Promise(resolve => chrome.once('exit', resolve));
    await new Promise(resolve => server.close(resolve));
    await fs.rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
