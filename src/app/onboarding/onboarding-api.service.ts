import { inject, Injectable } from '@angular/core';
import { AuthSession } from '../core/auth/auth-session.service';
import { AuthFailure } from '../core/auth/auth.contracts';
import { PrivateApiFailure } from '../core/auth/private-api-error';
import * as C from './onboarding.contracts';
@Injectable({providedIn:'root'})
export class OnboardingApi {
 private readonly session=inject(AuthSession);
 private async request<T>(method:'GET'|'POST'|'PATCH',path:string,decode:(x:unknown)=>T,input?:unknown):Promise<T> {
  try{return decode(await this.session.privateRequest(method,'users/me/'+path,input));}
  catch(error){if(error instanceof AuthFailure){throw new PrivateApiFailure(error.kind==='expired'||error.kind==='credentials'?401:error.kind==='rate'?429:error.kind==='unavailable'?503:0,error.kind==='rate'?'RATE_LIMITED':error.kind==='expired'||error.kind==='credentials'?'SESSION_UNAVAILABLE':error.kind==='unavailable'?'DEPENDENCY_UNAVAILABLE':error.kind==='protocol'?'PROTOCOL':'NETWORK_UNCERTAIN');}throw PrivateApiFailure.from(error);}
 }
 notice(p:C.Purpose){return this.request('GET','consent/notices/'+p,x=>C.decodeNotice(x,p));}
 consent(p:C.Purpose){return this.request('GET','consent/'+p,x=>C.decodeConsent(x,p));}
 receipt(id:string,p:C.Purpose){if(!/^[a-f0-9-]{36}$/i.test(id))return Promise.reject(new PrivateApiFailure(400,'INVALID_INPUT'));return this.request('GET','consent/receipts/'+id,x=>C.decodeReceipt(x,p));}
 decide(input:C.ConsentDecision){return this.request('POST','consent',x=>C.decodeReceipt(x,input.purpose),input);}
 withdraw(input:C.ConsentWithdrawal){return this.request('POST','consent/withdraw',x=>C.decodeReceipt(x,input.purpose),input);}
 draft(){return this.request('GET','astrology/onboarding',C.decodeDraft);}
 save(input:C.BirthInput){return this.request('PATCH','astrology/onboarding',C.decodeSaved,input);}
 search(input:C.SearchInput){return this.request('POST','astrology/places/search',C.decodeSearch,input);}
 resolve(input:C.ResolveInput){return this.request('POST','astrology/resolve',C.decodeResolution,input);}
 confirm(input:C.ConfirmInput){return this.request('POST','astrology/confirm',C.decodeConfirmation,input);}
 eligibility(){return this.request('GET','social-eligibility',C.decodeEligibility);}
}
