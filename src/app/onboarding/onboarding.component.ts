import { Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthSession } from '../core/auth/auth-session.service';
import { PrivateApiFailure, PrivateCode } from '../core/auth/private-api-error';
import type { Language } from '../core/auth/auth-copy';
import { OnboardingApi } from './onboarding-api.service';
import { onboardingCopy, OnboardingCopyKey } from './onboarding-copy';
import { adultCutoff, birthFormValid, formatOffset } from './onboarding.policy';
import * as C from './onboarding.contracts';
@Component({selector:'app-onboarding',imports:[ReactiveFormsModule,RouterLink],templateUrl:'./onboarding.component.html',styleUrl:'./onboarding.component.scss'})
export class OnboardingComponent implements OnDestroy {
 readonly session=inject(AuthSession);private readonly api=inject(OnboardingApi);private readonly fb=inject(FormBuilder);
 readonly busy=signal(false);readonly searchBusy=signal(false);readonly language=signal<Language>('en');
 readonly failure=signal<PrivateCode|null>(null);readonly message=signal<OnboardingCopyKey|null>(null);
 readonly disabled=signal(false);readonly needsReconcile=signal(false);
 readonly consentForm=this.fb.nonNullable.group({terms:false,astrology:false,adult:false});
 readonly birthForm=this.fb.nonNullable.group({date:'',knowledge:'',time:''},{validators:birthFormValid});
 readonly searchForm=this.fb.nonNullable.group({query:'',country:'',language:'en'});
 readonly offsetControl=new FormControl<number|null>(null);
 readonly reviewControl=new FormControl(false,{nonNullable:true});
 readonly steps=['consent','details','place','review'] as const;
 readonly purposes:C.Purpose[]=['GENERAL_TERMS','ASTROLOGY'];
 readonly cutoff=adultCutoff();readonly offsetLabel=formatOffset;
 notices:Partial<Record<C.Purpose,C.Notice>>={};consents:Partial<Record<C.Purpose,C.ConsentState>>={};
 draft:C.Draft|null=null;eligibility:C.Eligibility|null=null;searchResult:C.SearchResult|null=null;selected:C.Candidate|null=null;resolution:C.Resolution|null=null;
 searchAttempted=false;searchFailure:PrivateCode|null=null;
 pendingConsent:C.ConsentDecision|C.ConsentWithdrawal|null=null;
 private pendingKind:'decision'|'withdrawal'|null=null;
 private alive=true;private owner=this.session.account()?.id??null;private epoch=this.session.identityEpoch;private searchVersion=0;private timer:ReturnType<typeof setTimeout>|undefined;private subscriptions=new Subscription();
 constructor(){
  effect(()=>{const owner=this.session.account()?.id??null;if(owner!==this.owner||this.session.identityEpoch!==this.epoch){this.clearSensitive();this.owner=owner;this.epoch=this.session.identityEpoch;this.failure.set('SESSION_CHANGED');}});
  this.subscriptions.add(this.birthForm.controls.knowledge.valueChanges.subscribe(v=>{if(v==='unknown')this.birthForm.controls.time.setValue('',{emitEvent:false});this.reviewControl.setValue(false);}));
  this.subscriptions.add(this.birthForm.valueChanges.subscribe(()=>this.reviewControl.setValue(false)));
  this.subscriptions.add(this.searchForm.valueChanges.subscribe(()=>{this.invalidateSearch();if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>void this.search(),500);}));
  void this.load();
 }
 t(key:OnboardingCopyKey){return onboardingCopy(this.language(),key);}
 changeLanguage(event:Event){const value=(event.target as HTMLSelectElement).value;if(value==='en'||value==='bn'||value==='hi')this.language.set(value);}
 get granted(){const r=this.consents.ASTROLOGY?.receipt,n=this.notices.ASTROLOGY;return !!r&&r.action==='GRANTED'&&r.adultAttestation==='SELF_DECLARED_ADULT'&&r.noticeVersion===n?.version&&r.noticeDigest===n?.digest;}
 get actionable(){return this.session.authenticated&&!this.busy()&&!this.disabled()&&!this.needsReconcile();}
 get exactSaved(){const d=this.draft?.draft,v=this.birthForm.getRawValue();return !!d&&d.birthTimeKnown&&d.birthTime!==null&&!this.birthForm.invalid&&v.date===d.birthDate&&v.knowledge==='known'&&v.time===d.birthTime;}
 get canResolve(){return this.actionable&&this.granted&&this.exactSaved&&!!this.selected&&(!this.resolution||this.resolution.status!=='FOLD'||this.offsetControl.value!==null);}
 get canConfirm(){return this.actionable&&this.granted&&this.exactSaved&&this.draft?.evidence?.validationStatus==='RESOLVED'&&this.reviewControl.value;}
 get consentRetryAllowed(){return this.actionable&&!!this.pendingConsent&&(this.pendingKind==='withdrawal'||(this.pendingConsent as C.ConsentDecision).noticeVersion===this.notices[this.pendingConsent.purpose]?.version&&(this.pendingConsent as C.ConsentDecision).noticeDigest===this.notices[this.pendingConsent.purpose]?.digest);}
 requirementLabel(code:string):string {const keys:Record<string,OnboardingCopyKey>={ASTROLOGY_CONSENT:'consentRequired',BIRTH_DATE:'birthDate',EXACT_BIRTH_TIME:'birthTime',ADULT_ELIGIBILITY:'adultHelp',LOCATION_EVIDENCE:'place',HISTORICAL_TIME_REVIEW:'historical',DST_FOLD_SELECTION:'fold',SOURCE_APPROVAL:'pending',NOTICE_APPROVAL:'noticeWarning',REVIEW_CONFIRMATION:'review'};return this.t(keys[code]??'reviewRequired');}
 get activeStep(){const next=this.eligibility?.nextAction;return next==='PROVIDE_BIRTH_DETAILS'?'details':next==='SELECT_BIRTHPLACE'?'place':next==='REVIEW_ONBOARDING'||next==='SOCIAL_ACCESS'?'review':'consent';}
 statusLabel(){return this.t(({CONSENT_REQUIRED:'consentRequired',DETAILS_REQUIRED:'detailsRequired',LOCATION_UNRESOLVED:'locationUnresolved',REVIEW_REQUIRED:'reviewRequired',READY:'ready',CONSENT_WITHDRAWN:'withdrawn'} as const)[this.eligibility?.state??'CONSENT_REQUIRED']);}
 consentLabel(p:C.Purpose){const action=this.consents[p]?.receipt?.action;return this.t(action==='GRANTED'?'granted':action==='REFUSED'?'refused':action==='WITHDRAWN'?'inactive':'notGranted');}
 get errorCopy():OnboardingCopyKey {const e=this.failure();return e==='SESSION_UNAVAILABLE'||e==='SESSION_CHANGED'?'session':e==='RATE_LIMITED'?'rate':e==='GAP'?'gap':e==='INVALID_DISAMBIGUATION'?'invalidOffset':e==='NETWORK_UNCERTAIN'||e==='TIMEOUT_UNCERTAIN'?'uncertain':e==='PROTOCOL'?'protocol':e?.includes('UNAVAILABLE')?'unavailable':e==='SOURCE_APPROVAL_REQUIRED'||e==='ASTROLOGY_CONSENT_REQUIRED'||e==='ADULT_ATTESTATION_REQUIRED'||e==='ADULT_ELIGIBILITY_REQUIRED'||e==='FORBIDDEN'?'permission':'invalid';}
 resolutionLabel(){const s=this.resolution?.status;return this.t(s==='RESOLVED'?'resolved':s==='FOLD'?'fold':s==='LOCALITY_REQUIRED'?'locality':s==='REVIEW_REQUIRED'?'sourceBlocked':s==='UNSUPPORTED_DATE'||s==='UNSUPPORTED_ZONE'?'historical':'unresolved');}
 private current(epoch:number){return this.alive&&epoch===this.session.identityEpoch;}
 private invalidateSearch(){this.searchVersion++;this.searchBusy.set(false);this.searchResult=null;this.selected=null;this.resolution=null;this.offsetControl.setValue(null);this.searchFailure=null;this.reviewControl.setValue(false);}
 private clearSensitive(){if(this.timer)clearTimeout(this.timer);this.timer=undefined;this.invalidateSearch();this.notices={};this.consents={};this.draft=null;this.eligibility=null;this.pendingConsent=null;this.pendingKind=null;this.birthForm.reset({date:'',knowledge:'',time:''},{emitEvent:false});this.consentForm.reset({terms:false,astrology:false,adult:false},{emitEvent:false});this.searchForm.reset({query:'',country:'',language:'en'},{emitEvent:false});this.reviewControl.setValue(false);this.searchAttempted=false;this.busy.set(false);this.searchBusy.set(false);this.needsReconcile.set(false);this.disabled.set(false);this.message.set(null);}
 private async fetchState(resetSelection=true,epoch=this.session.identityEpoch){
  if(!this.current(epoch))throw new PrivateApiFailure(401,'SESSION_CHANGED');
  const [terms,astro,ct,ca,e]=await Promise.all([this.api.notice('GENERAL_TERMS'),this.api.notice('ASTROLOGY'),this.api.consent('GENERAL_TERMS'),this.api.consent('ASTROLOGY'),this.api.eligibility()]);
  const valid=ca.receipt?.action==='GRANTED'&&ca.receipt.noticeVersion===astro.version&&ca.receipt.noticeDigest===astro.digest&&ca.receipt.adultAttestation==='SELF_DECLARED_ADULT';
  if(!this.current(epoch))throw new PrivateApiFailure(401,'SESSION_CHANGED');
  const d=valid?await this.api.draft():null;if(!this.current(epoch))return;
  if(d&&d.consentReceiptId!==ca.receipt?.receiptId)throw new PrivateApiFailure(409,'CONSENT_REVISION_CONFLICT');
  if(d&&d.inputRevision!==e.inputRevision)throw new PrivateApiFailure(409,'INPUT_REVISION_CONFLICT');
  this.notices={GENERAL_TERMS:terms,ASTROLOGY:astro};this.consents={GENERAL_TERMS:ct,ASTROLOGY:ca};this.eligibility=e;this.draft=d;
  const v=d?.draft;this.birthForm.reset({date:v?.birthDate??'',knowledge:v?(v.birthTimeKnown?'known':'unknown'):'',time:v?.birthTime??''},{emitEvent:false});
  this.reviewControl.setValue(false);if(resetSelection||!valid)this.invalidateSearch();if(!valid)this.searchForm.reset({query:'',country:'',language:'en'},{emitEvent:false});
  this.disabled.set(false);this.needsReconcile.set(false);
 }
 async load(){if(this.busy())return;const epoch=this.session.identityEpoch;this.busy.set(true);this.failure.set(null);try{await this.fetchState();}catch(error){if(this.current(epoch))this.handle(error);}finally{if(this.current(epoch))this.busy.set(false);}}
 private handle(error:unknown){const e=PrivateApiFailure.from(error);this.failure.set(e.code);if(e.code==='API_DISABLED'){this.clearSensitive();this.disabled.set(true);}if(e.status===401){this.clearSensitive();this.failure.set(e.code);}return e;}
 private async mutate(work:(epoch:number)=>Promise<void>){if(!this.actionable)return;const epoch=this.session.identityEpoch;this.busy.set(true);this.failure.set(null);this.message.set(null);
  try{await work(epoch);if(this.current(epoch))this.message.set('saved');}
  catch(error){if(!this.current(epoch))return;const e=this.handle(error);if(e.uncertain){this.needsReconcile.set(true);this.message.set('uncertain');}else if(e.status===409||e.code==='ASTROLOGY_CONSENT_REQUIRED'){try{await this.fetchState();if(this.current(epoch))this.message.set('conflict');}catch(refresh){this.handle(refresh);this.needsReconcile.set(true);}}}
  finally{if(this.current(epoch))this.busy.set(false);}
 }
 async consent(p:C.Purpose,action:'GRANTED'|'REFUSED'){
  if(action==='GRANTED'&&(!(p==='GENERAL_TERMS'?this.consentForm.controls.terms.value:this.consentForm.controls.astrology.value)||(p==='ASTROLOGY'&&!this.consentForm.controls.adult.value)))return;
  const n=this.notices[p],state=this.consents[p];if(!n||!state)return;
  const request:C.ConsentDecision={purpose:p,action,noticeVersion:n.version,noticeDigest:n.digest,expectedConsentRevision:state.consentRevision,idempotencyKey:crypto.randomUUID(),...(p==='ASTROLOGY'&&action==='GRANTED'?{adultConfirmed:true}:{})};
  await this.mutate(async(epoch)=>{this.pendingConsent=Object.freeze(request);this.pendingKind='decision';await this.api.decide(request);if(!this.current(epoch))return;this.pendingConsent=null;this.pendingKind=null;this.consentForm.reset({terms:false,astrology:false,adult:false});await this.fetchState(true,epoch);});
 }
 async withdraw(p:C.Purpose){const state=this.consents[p];if(!state)return;const request:C.ConsentWithdrawal={purpose:p,expectedConsentRevision:state.consentRevision,idempotencyKey:crypto.randomUUID()};await this.mutate(async(epoch)=>{this.pendingConsent=Object.freeze(request);this.pendingKind='withdrawal';await this.api.withdraw(request);if(!this.current(epoch))return;this.pendingConsent=null;this.pendingKind=null;this.consentForm.reset({terms:false,astrology:false,adult:false});await this.fetchState(true,epoch);});}
 async retryConsent(){if(!this.consentRetryAllowed||!this.pendingConsent)return;const request=this.pendingConsent,kind=this.pendingKind;await this.mutate(async(epoch)=>{if(kind==='withdrawal')await this.api.withdraw(request);else await this.api.decide(request as C.ConsentDecision);if(!this.current(epoch))return;this.pendingConsent=null;this.pendingKind=null;await this.fetchState(true,epoch);});}
 async saveBirth(){this.birthForm.markAllAsTouched();if(!this.granted||this.birthForm.invalid||!this.consents.ASTROLOGY?.receipt)return;const v=this.birthForm.getRawValue();const request:C.BirthInput={expectedRevision:this.draft?.inputRevision??0,consentReceiptId:this.consents.ASTROLOGY.receipt.receiptId,birthDate:v.date,birthTimeKnown:v.knowledge==='known',...(v.knowledge==='known'?{birthTime:v.time}:{})};await this.mutate(async(epoch)=>{await this.api.save(request);await this.fetchState(true,epoch);});}
 async search(manual=false){if(this.timer)clearTimeout(this.timer);this.timer=undefined;if(!this.granted||!this.actionable)return;const v=this.searchForm.getRawValue(),q=v.query.normalize('NFKC').trim();if(Array.from(q).length<2||Array.from(q).length>80||(v.country!==''&&!/^[A-Z]{2}$/.test(v.country))){if(manual){this.searchFailure='INVALID_INPUT';this.searchAttempted=true;}return;}
  const version=++this.searchVersion,epoch=this.session.identityEpoch;this.searchBusy.set(true);this.searchFailure=null;this.searchAttempted=true;this.searchResult=null;this.selected=null;
  try{const result=await this.api.search({query:q,...(v.country?{countryCode:v.country}:{}),language:v.language==='bn'?'bn':v.language==='hi'?'hi':'en',limit:10});if(this.current(epoch)&&version===this.searchVersion)this.searchResult=result;}
  catch(error){if(this.current(epoch)&&version===this.searchVersion){const e=PrivateApiFailure.from(error);this.searchFailure=e.code;if(e.status===401||e.code==='ASTROLOGY_CONSENT_REQUIRED')this.handle(e);}}
  finally{if(this.current(epoch)&&version===this.searchVersion)this.searchBusy.set(false);}
 }
 select(candidate:C.Candidate){if(!this.actionable||!this.searchResult?.items.some(p=>p.canonicalId===candidate.canonicalId))return;this.selected=candidate;this.resolution=null;this.offsetControl.setValue(null);this.reviewControl.setValue(false);}
 async resolve(){if(!this.canResolve||!this.draft||!this.selected||!this.searchResult||!this.consents.ASTROLOGY?.receipt)return;const request:C.ResolveInput={expectedRevision:this.draft.inputRevision,consentReceiptId:this.consents.ASTROLOGY.receipt.receiptId,catalogueReleaseId:this.searchResult.releaseId,canonicalPlaceId:this.selected.canonicalId,...(this.offsetControl.value!==null?{offsetSeconds:this.offsetControl.value}:{})};const epoch=this.session.identityEpoch;await this.mutate(async(epoch)=>{const r=await this.api.resolve(request);await this.fetchState(false,epoch);if(this.current(epoch)){this.resolution=r;this.offsetControl.setValue(null);}});}
 async confirm(){const d=this.draft;if(!this.canConfirm||!d?.evidence||!this.consents.ASTROLOGY?.receipt)return;const request:C.ConfirmInput={expectedRevision:d.inputRevision,consentReceiptId:this.consents.ASTROLOGY.receipt.receiptId,evidenceId:d.evidence.evidenceId,policyVersion:d.policyVersion,reviewConfirmed:true};await this.mutate(async(epoch)=>{await this.api.confirm(request);await this.fetchState(false,epoch);});}
 focusStage(id:string){document.getElementById(id)?.focus();}
 ngOnDestroy(){this.alive=false;this.subscriptions.unsubscribe();this.clearSensitive();}
}
