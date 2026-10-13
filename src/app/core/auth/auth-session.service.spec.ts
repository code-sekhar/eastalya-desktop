import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { AuthSession } from './auth-session.service';
import { AuthApi } from './auth-api.service';
import { AuthFailure } from './auth.contracts';
import { authenticatedGuard, resetGuard } from './auth.guard';
import { passwordValidator, emailValidator } from './auth.validators';

describe('Real HTTP authentication client contracts', () => {
  let session: AuthSession; let http: HttpTestingController; let api: AuthApi;
  const user = {id: 'synthetic', email: 'test@example.invalid', username: 'synthetic'};
  const pair = {accessToken: 'access-one', refreshToken: 'a'.repeat(128)};
  beforeEach(() => { TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]}); session = TestBed.inject(AuthSession); http = TestBed.inject(HttpTestingController); api = TestBed.inject(AuthApi); });
  afterEach(() => http.verify());
  async function login() { const result = session.login(user.email, 'synthetic password'); http.expectOne('/api/v1/auth/login').flush({...pair, user}); await result; }
  it('clears a social session on confirmed 401 and never replays a mutation',async()=>{
    await login();const result=session.social('POST','posts',{content:'Text'}).catch((e:unknown)=>e);
    http.expectOne('/api/v1/users/me').flush(user);await new Promise(resolve=>setTimeout(resolve,0));
    http.expectOne('/api/v1/posts').flush({}, {status:401,statusText:'Unauthorized'});
    const error=await result;expect(error instanceof AuthFailure).toBeTrue();
    if(!(error instanceof AuthFailure))throw new Error('Expected an authentication failure');
    expect(error.kind).toBe('expired');expect(session.authenticated).toBeFalse();
    http.expectNone('/api/v1/auth/refresh');http.expectNone('/api/v1/posts');
  });
  it('logs in and retrieves the authenticated account with bearer access', async () => { await login(); const result = session.profile(); const req = http.expectOne('/api/v1/users/me'); expect(req.request.headers.get('Authorization')).toBe('Bearer access-one'); req.flush(user); expect(await result).toEqual(user); expect(session.authenticated).toBeTrue(); });
  it('rejects invalid credentials without authenticating', async () => { const result = session.login(user.email, 'incorrect password').catch(e => e); http.expectOne('/api/v1/auth/login').flush({}, {status: 401, statusText: 'Unauthorized'}); expect((await result).kind).toBe('credentials'); expect(session.authenticated).toBeFalse(); });
  it('accepts generic registration without registration.user or birth data', async () => { const body = {email:user.email,username:user.username,displayName:'Synthetic',password:'synthetic password'}; const result = session.register(body); const req=http.expectOne('/api/v1/auth/register'); expect(req.request.body).toEqual(body); req.flush({message:'Generic'}); await result; expect(session.authenticated).toBeFalse(); expect(session.flowEmail()).toBe(user.email); });
  it('integrates verification and resend', async () => { let p=session.verify(user.email,'123456'); http.expectOne('/api/v1/auth/verify-email').flush({message:'Verified'}); await p; p=session.resend(user.email); http.expectOne('/api/v1/auth/resend-verification').flush({message:'Generic'}); await p; });
  it('integrates password recovery with an opaque memory-only grant', async () => { let p=session.forgot(user.email); http.expectOne('/api/v1/auth/forgot-password').flush({message:'Generic'}); await p; const verify=session.verifyReset(user.email,'123456'); http.expectOne('/api/v1/auth/verify-reset-otp').flush({resetToken:'b'.repeat(64)}); await verify; expect(session.canReset).toBeTrue(); p=session.reset('replacement passphrase'); const request=http.expectOne('/api/v1/auth/reset-password'); expect(request.request.body.resetToken).toBe('b'.repeat(64)); request.flush({message:'Reset'}); await p; expect(session.canReset).toBeFalse();
  });
  it('coordinates simultaneous unauthorized requests with one rotation', async () => { await login(); const first=session.profile(),second=session.profile(); const old=http.match('/api/v1/users/me'); expect(old.length).toBe(2); old.forEach(r=>r.flush({}, {status:401,statusText:'Unauthorized'})); await Promise.resolve(); await Promise.resolve(); const refresh=http.expectOne('/api/v1/auth/refresh'); refresh.flush({accessToken:'access-two',refreshToken:'b'.repeat(128)}); await new Promise(resolve=>setTimeout(resolve,0)); const retries=http.match('/api/v1/users/me'); expect(retries.length).toBe(2); retries.forEach(r=>{expect(r.request.headers.get('Authorization')).toBe('Bearer access-two');r.flush(user);}); await Promise.all([first,second]); });
  it('does not retry an uncertain refresh and clears credentials', async () => { await login(); const result=session.rotate().catch(e=>e); http.expectOne('/api/v1/auth/refresh').error(new ProgressEvent('error')); expect((await result).kind).toBe('network'); expect(session.authenticated).toBeFalse(); http.expectNone('/api/v1/auth/refresh'); });
  it('clears the session on confirmed refresh revocation', async () => { await login(); const p=session.rotate().catch(e=>e); http.expectOne('/api/v1/auth/refresh').flush({}, {status:401,statusText:'Unauthorized'}); await p; expect(session.authenticated).toBeFalse(); });
  it('keeps confirmed rate limiting distinct without automatic retry', async () => { await login(); const p=session.rotate().catch(e=>e); http.expectOne('/api/v1/auth/refresh').flush({}, {status:429,statusText:'Rate limited'}); expect((await p).kind).toBe('rate'); expect(session.authenticated).toBeTrue(); });
  it('does not restore credentials when logout races a rotation', async () => { await login(); const rotation=session.rotate().catch(e=>e); const pending=http.expectOne('/api/v1/auth/refresh'); const out=session.logout(); http.expectOne('/api/v1/auth/logout').flush({message:'Revoked'}); pending.flush({accessToken:'late-access',refreshToken:'b'.repeat(128)}); await Promise.all([rotation,out]); expect(session.authenticated).toBeFalse(); });
  it('logout-all authenticates revocation then clears locally', async () => { await login(); const p=session.logout(true); http.expectOne('/api/v1/users/me').flush(user); await new Promise(resolve=>setTimeout(resolve,0)); const req=http.expectOne('/api/v1/auth/logout-all'); expect(req.request.headers.has('Authorization')).toBeTrue(); req.flush({message:'Revoked'}); await p; expect(session.authenticated).toBeFalse(); });
  it('clears locally and reports unconfirmed logout on outage', async () => { await login(); const p=session.logout().catch(e=>e); http.expectOne('/api/v1/auth/logout').flush({}, {status:503,statusText:'Unavailable'}); expect((await p).kind).toBe('unavailable'); expect(session.authenticated).toBeFalse(); expect(session.notice()).toBe('logoutUnconfirmed'); });
  it('blocks protected routes and reset without a grant', () => { const router=TestBed.inject(Router); const result=TestBed.runInInjectionContext(()=>authenticatedGuard({} as never,{} as never)); expect(router.serializeUrl(result as never)).toBe('/signin'); expect(router.serializeUrl(TestBed.runInInjectionContext(()=>resetGuard({} as never,{} as never)) as never)).toBe('/verify-reset-otp'); });
  it('accepts international email and enforces Unicode character and UTF-8 byte limits', () => { expect(emailValidator(new FormControl('পরীক্ষা@example.invalid'))).toBeNull(); expect(passwordValidator()(new FormControl('😀'.repeat(15)))).toBeNull(); expect(passwordValidator()(new FormControl('😀'.repeat(19)))).toBeTruthy(); expect(passwordValidator()(new FormControl('a'.repeat(14)))).toBeTruthy(); });
  it('times out without exposing transport details', fakeAsync(() => { let error:AuthFailure|undefined; void api.request('GET','users/me').catch(e=>error=e); const request=http.expectOne('/api/v1/users/me'); tick(15001); expect(error?.kind).toBe('network'); expect(request.cancelled).toBeTrue(); }));
});
