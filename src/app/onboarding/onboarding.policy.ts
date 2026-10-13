import { AbstractControl, ValidationErrors } from '@angular/forms';
import { dateLiteral, Eligibility } from './onboarding.contracts';
export function adultCutoff(now=new Date()):string {const cutoff=new Date(now);cutoff.setUTCFullYear(cutoff.getUTCFullYear()-18);return cutoff.toISOString().slice(0,10);}
export function birthFormValid(control:AbstractControl):ValidationErrors|null {
 const date:unknown=control.get('date')?.value,knowledge:unknown=control.get('knowledge')?.value,time:unknown=control.get('time')?.value;
 if(typeof date!=='string'||!dateLiteral(date))return {birthDate:true};
 if(date>adultCutoff())return {adultDate:true};
 if(knowledge!=='known'&&knowledge!=='unknown')return {knowledge:true};
 if(knowledge==='known'&&(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))return {birthTime:true};
 return null;
}
// Not attached to existing routes. Approved rollout must separately authorize activation.
export function eligibilityDestination(e:Eligibility,enforcementApproved=false):string|null {return enforcementApproved&&e.enforcementMode==='ENFORCE'&&!e.socialAccessAllowed?'/astrology/onboarding':null;}
export function formatOffset(seconds:number):string {const sign=seconds<0?'−':'+';const n=Math.abs(seconds);return 'UTC'+sign+String(Math.floor(n/3600)).padStart(2,'0')+':'+String(Math.floor(n%3600/60)).padStart(2,'0')+(n%60?':'+String(n%60).padStart(2,'0'):'');}
