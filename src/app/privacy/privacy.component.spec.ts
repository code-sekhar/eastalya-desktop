import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {AuthSession} from '../core/auth/auth-session.service';
import {copy} from '../core/auth/auth-copy';
import {LanguageState} from '../core/i18n/language.service';
describe('privacy authorization and localization',()=>{
 let session:AuthSession,http:HttpTestingController;const user={id:'synthetic',email:'synthetic@example.invalid',username:'synthetic'};
 beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([])]});session=TestBed.inject(AuthSession);http=TestBed.inject(HttpTestingController);});afterEach(()=>http.verify());
 async function login(){const p=session.login(user.email,'synthetic secure passphrase');http.expectOne('/api/v1/auth/login').flush({user,accessToken:'access',refreshToken:'a'.repeat(128)});await p;}
 it('requires authorization and fresh password for owner export',async()=>{await login();const p=session.privacy('export','synthetic secure passphrase');http.expectOne('/api/v1/users/me').flush(user);await new Promise(r=>setTimeout(r,0));const req=http.expectOne('/api/v1/privacy/export');expect(req.request.headers.get('Authorization')).toBe('Bearer access');expect(req.request.body).toEqual({password:'synthetic secure passphrase'});req.flush({schemaVersion:1,account:user});expect(await p).toEqual({schemaVersion:1,account:user});});
 it('clears credentials after successful held request without refreshing revoked sessions',async()=>{await login();const p=session.privacy('deletion-request','synthetic secure passphrase');http.expectOne('/api/v1/users/me').flush(user);await new Promise(r=>setTimeout(r,0));const req=http.expectOne('/api/v1/privacy/deletion-request');expect(req.request.body.confirmation).toBe('REQUEST_DELETION');req.flush({status:'PENDING_POLICY',erasureEnabled:false});await p;expect(session.authenticated).toBeFalse();http.expectNone('/api/v1/auth/refresh');});
 it('provides Bengali/Hindi action and recovery copy with a shared memory language',()=>{const state=TestBed.inject(LanguageState);state.value.set('bn');expect(copy(state.value(),'currentPassword')).not.toBe(copy('en','currentPassword'));state.value.set('hi');expect(copy(state.value(),'cancelDeletion')).not.toBe(copy('en','cancelDeletion'));});
});
