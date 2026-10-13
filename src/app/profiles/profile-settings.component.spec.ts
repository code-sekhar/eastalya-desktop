import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {provideRouter,ActivatedRoute} from '@angular/router';
import {AuthFailure} from '../core/auth/auth.contracts';
import {AuthSession} from '../core/auth/auth-session.service';
import {ProfileSettingsComponent} from './profile-settings.component';
describe('Profile and astrology settings contracts',()=>{
 let http:HttpTestingController,session:AuthSession;
 const user={id:'synthetic',email:'synthetic@example.invalid',username:'synthetic',profile:{displayName:'Synthetic',bio:null,avatarUrl:null,revision:0,visibility:'PRIVATE' as const},astrologyProfile:null,completeness:{completed:1,total:3}};
 beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{data:{astrology:true}}}}]});http=TestBed.inject(HttpTestingController);session=TestBed.inject(AuthSession);});
 afterEach(()=>http.verify());
 async function login(){const p=session.login(user.email,'synthetic secure passphrase');http.expectOne('/api/v1/auth/login').flush({user,accessToken:'access',refreshToken:'a'.repeat(128)});await p;}
 it('loads private profile into protected consent form without pre-checking consent',async()=>{await login();const f=TestBed.createComponent(ProfileSettingsComponent);http.expectOne('/api/v1/users/me').flush(user);await f.whenStable();f.detectChanges();expect(f.componentInstance.form.controls.consent.value).toBeFalse();expect(f.nativeElement.querySelector('#birthDate')).toBeTruthy();expect(f.nativeElement.querySelector('#consent')).toBeTruthy();});
 it('rejects astrology save without explicit consent and adult confirmation',async()=>{await login();const f=TestBed.createComponent(ProfileSettingsComponent);http.expectOne('/api/v1/users/me').flush(user);await f.whenStable();f.componentInstance.form.controls.birthDate.setValue('2000-01-01');await f.componentInstance.save();http.expectNone('/api/v1/users/me/astrology');expect(f.componentInstance.message()).toContain('consent');});
 it('sends actor-only profile updates with revision and no username/birth data',async()=>{await login();const p=session.change('users/me/profile',{displayName:'Updated',expectedRevision:0});http.expectOne('/api/v1/users/me').flush(user);await new Promise(r=>setTimeout(r,0));const patch=http.expectOne('/api/v1/users/me/profile');expect(patch.request.method).toBe('PATCH');expect(patch.request.headers.get('Authorization')).toBe('Bearer access');expect(patch.request.body).toEqual({displayName:'Updated',expectedRevision:0});patch.flush({message:'Saved'});await new Promise(r=>setTimeout(r,0));http.expectOne('/api/v1/users/me').flush({...user,profile:{...user.profile,displayName:'Updated',revision:1}});await p;expect(session.account()?.profile?.displayName).toBe('Updated');});
 it('surfaces stale-write conflicts without replaying the mutation',async()=>{await login();const p=session.change('users/me/profile',{bio:'changed',expectedRevision:0}).catch(e=>e);http.expectOne('/api/v1/users/me').flush(user);await new Promise(r=>setTimeout(r,0));http.expectOne('/api/v1/users/me/profile').flush({}, {status:409,statusText:'Conflict'});const error=await p;expect(error instanceof AuthFailure).toBeTrue();if(error instanceof AuthFailure)expect(error.kind).toBe('conflict');http.expectNone('/api/v1/users/me/profile');});
});
