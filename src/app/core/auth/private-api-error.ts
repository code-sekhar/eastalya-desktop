import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
export const privateCodes = ['INVALID_INPUT','SESSION_UNAVAILABLE','FORBIDDEN','API_DISABLED','RESOURCE_UNAVAILABLE','NOTICE_CHANGED','ADULT_ATTESTATION_REQUIRED','ADULT_ELIGIBILITY_REQUIRED','ASTROLOGY_CONSENT_REQUIRED','IDEMPOTENCY_CONFLICT','CONSENT_REVISION_CONFLICT','INPUT_REVISION_CONFLICT','BIRTH_DETAILS_REQUIRED','CATALOGUE_CHANGED','POLICY_CHANGED','EVIDENCE_STALE','RATE_LIMITED','CATALOGUE_UNAVAILABLE','RESOLVER_UNAVAILABLE','ONBOARDING_UNAVAILABLE','DEPENDENCY_UNAVAILABLE','INTERNAL_ERROR','SOURCE_APPROVAL_REQUIRED','GAP','INVALID_DISAMBIGUATION','CONFLICT'] as const;
export type PrivateCode = typeof privateCodes[number] | 'NETWORK_UNCERTAIN'|'TIMEOUT_UNCERTAIN'|'PROTOCOL'|'SESSION_CHANGED';
export class PrivateApiFailure extends Error {
 constructor(readonly status:number,readonly code:PrivateCode) {super('Private request could not be confirmed');}
 get uncertain(){return this.status===0||this.status>=500;}
 static from(error:unknown) {
  if(error instanceof PrivateApiFailure)return error;
  if(error instanceof TimeoutError)return new PrivateApiFailure(0,'TIMEOUT_UNCERTAIN');
  if(error instanceof HttpErrorResponse){
   if(error.status===0)return new PrivateApiFailure(0,'NETWORK_UNCERTAIN');
   const raw:unknown=error.error;
   if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    const envelope=raw as Record<string,unknown>;
    if(envelope['statusCode']===error.status&&typeof envelope['code']==='string'&&(privateCodes as readonly string[]).includes(envelope['code']))return new PrivateApiFailure(error.status,envelope['code'] as PrivateCode);
   }
   return new PrivateApiFailure(error.status,error.status===401?'SESSION_UNAVAILABLE':'PROTOCOL');
  }
  return new PrivateApiFailure(0,'PROTOCOL');
 }
}
