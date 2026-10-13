// Contract-mocked browser checks only: loopback static app, synthetic wire fixtures, no DB/backend changes.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');const {setTimeout:delay}=require('node:timers/promises');
async function main(){
 const [root,output]=process.argv.slice(2);assert(root&&output);await fs.mkdir(output,{recursive:true});
 const ts=require('typescript'),fixtures={};const source=await fs.readFile(path.join(__dirname,'../src/app/onboarding/onboarding.fixtures.spec-support.ts'),'utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;assert(!compiled.includes('require('));new Function('exports',compiled)(fixtures);const F=fixtures;
 let enabled=false,rev=0,profileDraft=null,evidence=null,states={},searchCount=0,mutations=0;const receipts=new Map();
 const user={id:'synthetic-owner',email:'owner@example.invalid',username:'synthetic_owner',profile:{displayName:'Synthetic browser fixture',bio:null,avatarUrl:null,revision:0,visibility:'PRIVATE'}};
 function reset(){enabled=false;rev=0;profileDraft=null;evidence=null;states={};receipts.clear();searchCount=0;mutations=0;}
 function eligibility(){const s=states.ASTROLOGY?.receipt?.action;return F.eligibility(s==='WITHDRAWN'?'CONSENT_WITHDRAWN':s!=='GRANTED'?'CONSENT_REQUIRED':!profileDraft||!profileDraft.birthTimeKnown?'DETAILS_REQUIRED':!evidence?'LOCATION_UNRESOLVED':'REVIEW_REQUIRED',rev);}
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1'),p=url.pathname;
  const send=(value,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));};
  const fail=(status,code)=>send({statusCode:status,code,message:'Synthetic contract fixture failure',error:'Fixture'},status);
  if(p.startsWith('/api/')){
   let chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
   if(p==='/api/v1/auth/login')return send({user,accessToken:'synthetic-access',refreshToken:'a'.repeat(128)},201);
   if(p==='/api/v1/auth/logout'||p==='/api/v1/auth/logout-all')return send({message:'Synthetic revocation'},201);
   if(p==='/api/v1/users/me')return send(user);
   if(p==='/api/v1/feed/home')return send({items:[],nextCursor:null});
   if(!enabled)return fail(404,'API_DISABLED');
   if(p.includes('/consent/notices/'))return send(F.notice(p.split('/').pop()));
   if(p==='/api/v1/users/me/social-eligibility')return send(eligibility());
   const purpose=p.split('/').pop();if(req.method==='GET'&&p.includes('/consent/'))return send(states[purpose]??F.consent(purpose));
   if(p==='/api/v1/users/me/consent'||p==='/api/v1/users/me/consent/withdraw'){
    const existing=receipts.get(body.idempotencyKey);if(existing)return send(existing,201);
    const previous=states[body.purpose]?.consentRevision??0;if(body.expectedConsentRevision!==previous)return fail(409,'CONSENT_REVISION_CONFLICT');
    const action=p.endsWith('/withdraw')?'WITHDRAWN':body.action,r=F.receipt(body.purpose,action,previous+1);states[body.purpose]={purpose:body.purpose,consentRevision:previous+1,receipt:r};receipts.set(body.idempotencyKey,r);mutations++;if(body.purpose==='ASTROLOGY'&&action!=='GRANTED'){rev++;evidence=null;}return send(r,201);
   }
   if(p==='/api/v1/users/me/astrology/onboarding'){
    if(states.ASTROLOGY?.receipt?.action!=='GRANTED')return fail(403,'ASTROLOGY_CONSENT_REQUIRED');
    if(req.method==='PATCH'){if(body.expectedRevision!==rev)return fail(409,'INPUT_REVISION_CONFLICT');rev++;profileDraft={birthDate:body.birthDate,birthTimeKnown:body.birthTimeKnown,birthTime:body.birthTime??null,birthPlace:null,birthCountry:null,birthState:null};evidence=null;mutations++;return send({message:'Synthetic private draft saved',inputRevision:rev,complete:false});}
    return send({inputRevision:rev,consentReceiptId:F.receiptId,policyVersion:'development-onboarding-v1',draft:profileDraft,evidence});
   }
   if(p==='/api/v1/users/me/astrology/places/search'){searchCount++;return send(F.search,201);}
   if(p==='/api/v1/users/me/astrology/resolve'){
    if(body.expectedRevision!==rev)return fail(409,'INPUT_REVISION_CONFLICT');rev++;profileDraft={...profileDraft,birthPlace:'Kolkata',birthCountry:'IN',birthState:'West Bengal'};evidence={evidenceId:F.evidenceId,inputRevision:rev,canonicalPlaceId:F.search.items[0].canonicalId,catalogueReleaseId:F.search.releaseId,validationStatus:'RESOLVED',reasonCode:'BENCHMARK_ONLY',timezoneId:'Asia/Kolkata',offsetSeconds:19800,resolvedInstant:'2000-01-01T07:00:00.000Z',confirmedAt:null,benchmarkOnly:true};mutations++;return send({...F.resolved,inputRevision:rev},201);
   }
   if(p==='/api/v1/users/me/astrology/confirm'){if(!evidence||body.expectedRevision!==rev)return fail(409,'EVIDENCE_STALE');evidence.confirmedAt??='2026-10-14T00:00:00.000Z';mutations++;return send({evidenceId:F.evidenceId,inputRevision:rev,confirmedAt:evidence.confirmedAt,benchmarkOnly:true,productionApproved:false,requirementsSatisfied:false},201);}
   return fail(404,'RESOURCE_UNAVAILABLE');
  }
  let file=path.resolve(root,'.'+p);if(!file.startsWith(path.resolve(root)+path.sep))file=path.join(root,'index.html');try{if(!(await fs.stat(file)).isFile())file=path.join(root,'index.html');}catch{file=path.join(root,'index.html');}const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.statusCode=500;res.end('Synthetic fixture failure');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'eastalya-c1-chrome-'));
 const chrome=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${directory}`,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});let ws;const errors=[],pending=new Map();
 try{
  let port;for(let i=0;i<100&&!port;i++){try{port=Number((await fs.readFile(path.join(directory,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{await delay(50);}}assert(port,'Chrome startup failed');
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});let id=0;
  ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(new Error('Browser protocol failed'));else p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push('runtime exception');});
  const send=(method,params={})=>new Promise((r,j)=>{const n=++id;pending.set(n,{resolve:r,reject:j});ws.send(JSON.stringify({id:n,method,params}));});await send('Page.enable');await send('Runtime.enable');
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,'Browser evaluation failed');return r.result.value;};
  let checkpoint=0;
  const wait=async expression=>{const point=++checkpoint;for(let i=0;i<120;i++){if(await evaluate(expression))return;await delay(50);}throw new Error('Browser checkpoint '+point+' did not settle');};
  const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await delay(60);};
  const fill=async(id,value)=>{await evaluate(`(()=>{const x=document.getElementById(${JSON.stringify(id)});x.value=${JSON.stringify(value)};x.dispatchEvent(new Event('input',{bubbles:true}));x.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
  const link=async route=>{await click(`a[href="${route}"]`);await wait(`location.pathname===${JSON.stringify(route)}`);};
  const audit=async label=>{
   const state=await evaluate(`(()=>{const root=document.querySelector('app-onboarding');return {overflow:document.documentElement.scrollWidth>innerWidth,unnamed:[...root.querySelectorAll('input,select')].filter(x=>!x.labels?.length&&!x.getAttribute('aria-label')).length,duplicateIds:[...root.querySelectorAll('[id]')].map(x=>x.id).filter((x,i,a)=>a.indexOf(x)!==i).length,unsafeHtml:!!root.querySelector('.notice-text b'),browserStorage:localStorage.length+sessionStorage.length};})()`);assert.equal(state.overflow,false,label+' overflow');assert.equal(state.unnamed,0,label+' control labels');assert.equal(state.duplicateIds,0,label+' duplicate ids');assert.equal(state.unsafeHtml,false);assert.equal(state.browserStorage,0);return {label,...state};
  };
  const results=[];
  for(const [width,height]of [[320,800],[768,1024],[1440,900]]){
   reset();await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:url+'/astrology/onboarding'});await wait("location.pathname==='/signin'&&!!document.getElementById('email')");
   await fill('email','owner@example.invalid');await fill('password','synthetic browser passphrase');await evaluate("document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");await wait("location.pathname==='/account'&&!!document.querySelector('a[href=\"/astrology/onboarding\"]')");
   await link('/astrology/onboarding');await wait("!!document.querySelector('[data-testid=api-disabled]')");results.push({width,...await audit('disabled')});assert.equal(mutations,0);
   enabled=true;await click('[data-testid=api-disabled] button');await wait("!!document.querySelector('#accept-ASTROLOGY')&&!document.querySelector('.skeleton')");assert.equal(await evaluate("document.getElementById('accept-ASTROLOGY').checked"),false);assert.equal(await evaluate("!!document.getElementById('birth-date')"),false);results.push({width,...await audit('consent')});
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert(await evaluate("['A','BUTTON','INPUT','SELECT'].includes(document.activeElement.tagName)"));
   await click('#accept-GENERAL_TERMS');await click('.notice:first-child .primary');await wait("document.querySelector('.notice:first-child .consent-state').innerText.includes('Granted')&&!document.querySelector('.skeleton')");await click('#accept-ASTROLOGY');await click('#adult-attestation');await click('.notice:last-child .primary');await wait("!!document.getElementById('birth-date')&&!document.querySelector('.skeleton')");
   await fill('birth-date','2000-01-01');await click('input[value=known]');await wait("!!document.getElementById('birth-time')");await fill('birth-time','12:30');await evaluate("document.getElementById('birth-date').closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");await wait("!document.querySelector('.skeleton')&&document.getElementById('birth-time')?.value==='12:30'");results.push({width,...await audit('details')});
   await fill('place-query','Kolkata');await wait("!!document.querySelector('.candidate')");assert.equal(await evaluate("document.querySelector('.candidate').getAttribute('aria-pressed')"),'false');assert.equal(searchCount,1);await click('.candidate');await click('section[aria-labelledby="stage-place"] > button.primary');await wait("!!document.querySelector('#stage-review')&&document.body.innerText.includes('Asia/Kolkata')&&!document.querySelector('.skeleton')");results.push({width,...await audit('review')});
   await click('#review-confirmation');await click('section[aria-labelledby="stage-review"] > button.primary');await wait("!!document.querySelector('.status')&&document.body.innerText.includes('Confirmed benchmark evidence')&&!document.querySelector('.skeleton')");assert(await evaluate("document.body.innerText.includes('Requirements are not yet satisfied.')"));
   for(const language of ['bn','hi','en']){await fill('onboarding-language',language);await wait(`document.querySelector('app-onboarding main').getAttribute('lang')===${JSON.stringify(language)}`);results.push({width,...await audit('language-'+language)});}
   await send('Runtime.evaluate',{expression:'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',awaitPromise:true});await fs.writeFile(path.join(output,`c1-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await click('.notice:last-child .quiet');await wait("!document.getElementById('birth-date')&&!document.querySelector('.skeleton')");results.push({width,...await audit('withdrawal')});await link('/feed');await wait("!!document.querySelector('app-feed')");assert.equal(await evaluate("!!document.querySelector('app-onboarding')"),false);results.push({width,label:'feed-remains-accessible',pass:true});
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'browser-results.json'),JSON.stringify({mode:'CONTRACT_MOCKS_ONLY',checks:results,runtimeExceptions:errors,nativeCertification:false},null,2));console.log(`C1 contract-mocked browser: ${results.length} checks passed; no runtime exceptions`);
 }finally{ws?.close();chrome.kill('SIGTERM');await new Promise(r=>chrome.once('exit',r));await new Promise(r=>server.close(r));await fs.rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
main().catch(error=>{console.error('C1 contract-fixture browser check failed:',error.message);process.exitCode=1});
