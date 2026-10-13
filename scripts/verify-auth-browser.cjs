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
  const root = path.resolve('dist/eastalya-admin/browser');
  const output = process.env.PHASE2A_CLIENTS === 'true' ? '/tmp/eastalya-phase2a-browser-evidence' : process.env.PHASE1G_CLIENTS === 'true' ? '/tmp/eastalya-phase1g-browser-evidence' : process.env.PHASE1F_CLIENTS === 'true' ? '/tmp/eastalya-phase1f-browser-evidence' : '/tmp/eastalya-phase1e-browser-evidence'; const label = process.env.PHASE2A_CLIENTS === 'true' ? 'phase2a' : process.env.PHASE1G_CLIENTS === 'true' ? 'phase1g' : process.env.PHASE1F_CLIENTS === 'true' ? 'phase1f' : 'phase1e';
  const backend = new URL(process.env.AUTH_TEST_API || '');
  assert.equal(backend.hostname, '127.0.0.1');
  assert.ok(root && output && label);
  await fs.mkdir(output, { recursive: true });
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.ico': 'image/x-icon' };
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/v1/')) {
      const upstream = http.request(new URL(req.url, backend), {method:req.method,headers:req.headers}, reply => {res.writeHead(reply.statusCode, reply.headers);reply.pipe(res);});
      upstream.on('error',()=>{res.statusCode=503;res.end();}); req.pipe(upstream); return;
    }
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
    const evaluate = async expression => {const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails)throw new Error('Browser evaluation failed');return r.result.value;};
    const wait = async expression => {for(let i=0;i<200;i++){if(await evaluate(expression))return;await delay(50);}throw new Error('Browser condition timed out: '+expression);};
    const navigate = async route => {await send('Page.navigate',{url:url+route});await wait("!!document.querySelector('app-signin,app-account')");};
    const fill = async (id,value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('blur',{bubbles:true}));})()`);
    const submit = async () => {await evaluate("document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");};
    const code = async (email,subject) => {for(let i=0;i<200;i++){const list=await(await fetch(process.env.MAILPIT_URL+'/api/v1/messages')).json();for(const m of list.messages.filter(m=>m.To.some(t=>t.Address===email)&&(!subject||m.Subject.includes(subject)))){const detail=await(await fetch(process.env.MAILPIT_URL+'/api/v1/message/'+m.ID)).json();const match=detail.HTML.match(/>([0-9]{6})<\//);if(match)return match[1];}await delay(100);}throw new Error('Synthetic mail timed out');};
    const results=[];
    const sessionViews = async name => {
      for(const [width,height] of [[320,800],[768,1024],[1440,900]]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
        assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,`${name} overflows at ${width}`);
        const shot=await send('Page.captureScreenshot',{format:'png'});
        await fs.writeFile(path.join(output,`${label}-${width}-${name}.png`),Buffer.from(shot.data,'base64'));
        results.push({width,height,route:name,overflow:false});
      }
    };
    for(const [width,height] of [[320,800],[768,1024],[1440,900]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      for(const route of ['/signin','/signup','/verify-email','/forgot-password','/verify-reset-otp']){
        await navigate(route);
        const value=await evaluate("({route:location.pathname,overflow:document.documentElement.scrollWidth>innerWidth,labels:[...document.querySelectorAll('input')].every(e=>!!document.querySelector('label[for='+e.id+']')),viewport:!!document.querySelector('meta[name=viewport]')})");
        assert.equal(value.route,route);assert.equal(value.overflow,false);assert.equal(value.labels,true);assert.equal(value.viewport,true);
        results.push({width,height,...value});
        const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,`${label}-${width}-${route.slice(1)}.png`),Buffer.from(shot.data,'base64'));
      }
    }
    await navigate('/account');await wait("location.pathname==='/signin'");
    await navigate('/reset-password');await wait("location.pathname==='/verify-reset-otp'");
    const nonce=Date.now();const email=`angular_${nonce}@example.invalid`,password='synthetic secure passphrase';
    await navigate('/signup');await fill('email',email);await fill('username',`angular_${nonce}`);await fill('displayName','Synthetic Angular');await fill('password',password);await fill('confirm',password);await submit();await wait("location.pathname==='/verify-email'");
    await fill('otp',await code(email));await submit();await wait("location.pathname==='/signin'");
    const login=async pwd=>{await fill('email',email);await fill('password',pwd);await submit();};
    await login('incorrect passphrase');await wait("!!document.querySelector('[role=alert]')");assert.equal(await evaluate('location.pathname'),'/signin');
    await login(password);await wait("location.pathname==='/account' && document.body.innerText.includes('Synthetic Angular')");
    await sessionViews('account');

    if(process.env.PHASE1F_CLIENTS === 'true') {
    const settingsLink=async path=>{await evaluate(`[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')===${JSON.stringify(path)}).click()`);await wait("!!document.querySelector('app-profile-settings form')");await wait("!document.querySelector('button[type=submit]').disabled");};
    await settingsLink('/profile/settings');await fill('displayName','Updated Angular Profile');await fill('bio','Synthetic profile bio');await submit();await wait("document.body.innerText.includes('Saved.')");
    await send('DOM.enable');const dom=await send('DOM.getDocument');const fileInput=await send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#avatar'});
    assert.ok(process.env.PROFILE_TEST_AVATAR,'Synthetic avatar fixture required');await send('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[process.env.PROFILE_TEST_AVATAR]});
    await wait("!!document.querySelector('img[alt=\"Your saved avatar\"]') && document.querySelector('img').naturalWidth>0 && !document.querySelector('button[type=submit]').disabled");
    await sessionViews('profile-settings');
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Remove avatar').click()");await wait("!document.querySelector('img') && document.body.innerText.includes('Avatar removed.')");
    await evaluate("document.querySelector('a[href=\"/account\"]').click()");await wait("!!document.querySelector('app-account')");await settingsLink('/astrology/settings');await fill('birthDate','2000-01-01');await fill('place','Synthetic birthplace');await evaluate("document.getElementById('adult').click();document.getElementById('consent').click()");await submit();await wait("document.body.innerText.includes('Saved.')");await sessionViews('astrology-settings');
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Withdraw astrology consent').click()");await wait("document.body.innerText.includes('Consent withdrawn.')");
    await evaluate("document.querySelector('a[href=\"/account\"]').click()");await wait("!!document.querySelector('app-account')");
    }
    if(process.env.PHASE1G_CLIENTS === 'true') {
      const privacy=async()=>{await evaluate("document.querySelector('a[href=\"/privacy\"]').click()");await wait("!!document.querySelector('app-privacy') && document.body.innerText.includes('PENDING_APPROVAL')");};
      await privacy();await sessionViews('privacy');
      await fill('current-password',password);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Download personal data').click()");await wait("document.body.innerText.includes('Export downloaded.')");
      await fill('current-password',password);await evaluate("document.querySelector('input[type=checkbox]').click()");await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Submit deletion request & sign out' && !b.disabled)");await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Submit deletion request & sign out').click()");await wait("document.body.innerText.includes('PENDING_POLICY') && !document.querySelector('#current-password')");
      await navigate('/signin');await login(password);await wait("location.pathname==='/account'");await privacy();await fill('current-password',password);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Cancel pending request').click()");await wait("document.body.innerText.includes('Previously revoked sessions remain revoked.')");
      await evaluate("document.querySelector('a[href=\"/account\"]').click()");await wait("!!document.querySelector('app-account')");
    }
    if(process.env.PHASE2A_CLIENTS === 'true') {
      await evaluate("document.querySelector('a[href=\"/feed\"]').click()");await wait("!!document.querySelector('app-feed textarea') && !document.body.innerText.includes('Loading posts…')");
      const text='Synthetic browser post <script>inert</script>';
      await fill('post-content',text);await evaluate("const select=document.getElementById('post-visibility');select.value='PUBLIC';select.dispatchEvent(new Event('change',{bubbles:true}))");await submit();await wait("document.body.innerText.includes('Post saved.') && [...document.querySelectorAll('article .content')].some(e=>e.textContent=== 'Synthetic browser post <script>inert</script>')");
      assert.equal(await evaluate("!!document.querySelector('article script')"),false);await sessionViews('feed');
      await evaluate("[...document.querySelectorAll('article')].find(a=>a.querySelector('.content').textContent==='Synthetic browser post <script>inert</script>').querySelector('button').click()");await fill('post-content','Edited browser text');await submit();await wait("[...document.querySelectorAll('article .content')].some(e=>e.textContent==='Edited browser text')");
      await evaluate("[...document.querySelectorAll('article')].find(a=>a.querySelector('.content').textContent==='Edited browser text').querySelectorAll('button')[1].click()");await wait("!!document.querySelector('[role=dialog]')");await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Confirm removal').click()");await wait("document.body.innerText.includes('Post hidden.') && ![...document.querySelectorAll('article .content')].some(e=>e.textContent==='Edited browser text')");
      await evaluate("document.querySelector('a[href=\"/account\"]').click()");await wait("!!document.querySelector('app-account')");
    }
    assert.equal(await evaluate("localStorage.length+sessionStorage.length"),0);assert.equal(await evaluate("document.cookie"),'');
    await wait("[...document.querySelectorAll('app-account button')].length>0 && [...document.querySelectorAll('app-account button')].every(b=>!b.disabled)");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Sign out').click()");await wait("location.pathname==='/signin'");
    await navigate('/forgot-password');await fill('email',email);await submit();await wait("location.pathname==='/verify-reset-otp'");await fill('otp',await code(email,'Password'));await submit();await wait("location.pathname==='/reset-password'");await sessionViews('reset-password');await fill('password','replacement secure passphrase');await fill('confirm','replacement secure passphrase');await submit();await wait("location.pathname==='/signin'");await login('replacement secure passphrase');await wait("location.pathname==='/account'");
    await wait("[...document.querySelectorAll('app-account button')].length>0 && [...document.querySelectorAll('app-account button')].every(b=>!b.disabled)");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Sign out from all devices').click()");await wait("location.pathname==='/signin'");
    await login('replacement secure passphrase');await wait("location.pathname==='/account'");await send('Page.reload');await wait("location.pathname==='/signin'");
    await evaluate("document.querySelector('#email').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert.equal(await evaluate('document.activeElement.id'),'password');
    results.push({liveFlow:'registration, verification, invalid credentials, login, profile, logout, recovery, reset, logout-all, reload guard, keyboard',passed:true});
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, `${label}.json`), JSON.stringify({ checks: results, runtimeErrors: errors }, null, 2));
    console.log(`Eastalya browser: ${results.length} route/viewport cases passed; no runtime errors`);
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
    await new Promise(resolve => chrome.once('exit', resolve));
    await new Promise(resolve => server.close(resolve));
    await fs.rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
