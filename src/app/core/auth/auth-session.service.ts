import { PrivateApiFailure } from './private-api-error';
import { inject, Injectable, signal } from '@angular/core';
import { AuthApi } from './auth-api.service';
import { Account, AuthFailure, LoginResponse, MessageResponse, Registration, TokenPair } from './auth.contracts';

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly api = inject(AuthApi);
  private access?: string;
  private refreshValue?: string;
  private flight?: Promise<void>;
  private epoch = 0;
  private resetGrant?: string;
  readonly account = signal<Account | null>(null);
  readonly flowEmail = signal('');
  readonly notice = signal('');
  get authenticated() { return !!this.access && !!this.account(); }
  get identityEpoch() { return this.epoch; }
  get canReset() { return !!this.resetGrant; }
  private accept(pair: TokenPair) {
    if (typeof pair.accessToken !== 'string' || !pair.accessToken || typeof pair.refreshToken !== 'string' || !/^[a-f0-9]{128}$/.test(pair.refreshToken)) throw new AuthFailure('protocol');
    this.access = pair.accessToken; this.refreshValue = pair.refreshToken;
  }
  clear() { this.flight = undefined; ++this.epoch; this.access = undefined; this.refreshValue = undefined; this.resetGrant = undefined; this.account.set(null); }
  async login(email: string, password: string) {
    this.clear(); const epoch = this.epoch;
    const result = await this.api.request<LoginResponse>('POST', 'auth/login', { email, password });
    if (epoch !== this.epoch) throw new AuthFailure('expired');
    try { this.accept(result); if (!result.user?.id) throw new AuthFailure('protocol'); this.account.set(result.user); }
    catch (error) { this.clear(); throw error; }
  }
  async register(body: Registration) { const result = await this.api.request<MessageResponse>('POST', 'auth/register', body); this.flowEmail.set(body.email); return result; }
  async verify(email: string, otp: string) { return this.api.request<MessageResponse>('POST', 'auth/verify-email', { email, otp }); }
  async resend(email: string) { return this.api.request<MessageResponse>('POST', 'auth/resend-verification', { email }); }
  async forgot(email: string) { const result = await this.api.request<MessageResponse>('POST', 'auth/forgot-password', { email }); this.resetGrant = undefined; this.flowEmail.set(email); return result; }
  async verifyReset(email: string, otp: string) {
    const result = await this.api.request<MessageResponse & { resetToken: string }>('POST', 'auth/verify-reset-otp', { email, otp });
    if (!/^[a-f0-9]{64}$/.test(result.resetToken)) throw new AuthFailure('protocol');
    this.resetGrant = result.resetToken;
  }
  async reset(newPassword: string) {
    if (!this.resetGrant) throw new AuthFailure('expired');
    const result = await this.api.request<MessageResponse>('POST', 'auth/reset-password', { resetToken: this.resetGrant, newPassword });
    this.clear(); return result;
  }
  rotate(): Promise<void> {
    if (this.flight) return this.flight;
    if (!this.refreshValue) return Promise.reject(new AuthFailure('expired'));
    const refreshToken = this.refreshValue; const epoch = this.epoch;
    const work = this.api.request<TokenPair>('POST', 'auth/refresh', { refreshToken }).then(pair => {
      if (epoch !== this.epoch) throw new AuthFailure('expired'); this.accept(pair);
    }).catch(error => {
      // No automatic refresh retry, including a lost/uncertain server response.
      if (epoch === this.epoch && (!(error instanceof AuthFailure) || error.kind !== 'rate')) this.clear();
      throw error;
    }).finally(() => { if (this.flight === work) this.flight = undefined; });
    this.flight = work; return work;
  }
  async profile(): Promise<Account> {
    const epoch = this.epoch; const access = this.access;
    if (!access) throw new AuthFailure('expired');
    let result: Account;
    try { result = await this.api.request<Account>('GET', 'users/me', undefined, access); }
    catch (error) {
      if (!(error instanceof AuthFailure) || error.kind !== 'credentials') throw error;
      if (epoch !== this.epoch) throw new AuthFailure('expired');
      if (access === this.access) await this.rotate();
      try { result = await this.api.request<Account>('GET', 'users/me', undefined, this.access); }
      catch (retry) { if (retry instanceof AuthFailure && retry.kind === 'credentials') this.clear(); throw retry; }
    }
    if (epoch !== this.epoch) throw new AuthFailure('expired');
    if (!result.id || !result.email || !result.username) throw new AuthFailure('protocol');
    this.account.set(result); return result;
  }
  async privateRequest(method:'GET'|'POST'|'PATCH',path:string,body?:unknown):Promise<unknown> {
    await this.profile();const epoch=this.epoch;const access=this.access;
    if(!access)throw new PrivateApiFailure(401,'SESSION_UNAVAILABLE');
    try {
      const result=await this.api.privateRequest(method,path,body,access);
      if(epoch!==this.epoch)throw new PrivateApiFailure(401,'SESSION_CHANGED');return result;
    }catch(error){
      if(epoch!==this.epoch)throw new PrivateApiFailure(401,'SESSION_CHANGED');
      if(error instanceof PrivateApiFailure && error.status===401){
        // Safe reads only; a protected mutation is never replayed.
        if(method==='GET'){
          try {if(access===this.access)await this.rotate();if(epoch!==this.epoch||!this.access)throw new PrivateApiFailure(401,'SESSION_CHANGED');const result=await this.api.privateRequest(method,path,body,this.access);if(epoch!==this.epoch)throw new PrivateApiFailure(401,'SESSION_CHANGED');return result;}
          catch(retry){if(epoch===this.epoch && retry instanceof PrivateApiFailure && retry.status===401)this.clear();throw retry;}
        }
        this.clear();
      }
      throw error;
    }
  }
  async social<T>(method:'GET'|'POST'|'PATCH'|'DELETE',path:string,body?:unknown):Promise<T> {
    await this.profile(); const epoch=this.epoch;
    try {
      const result=await this.api.request<T>(method,path,body,this.access);
      if(epoch!==this.epoch)throw new AuthFailure('expired');return result;
    }catch(error){
      if(error instanceof AuthFailure && error.kind==='credentials'){
        if(epoch===this.epoch)this.clear();throw new AuthFailure('expired');
      }
      throw error;
    }
  }
  async privacy(action: 'status' | 'export' | 'deletion-request' | 'deletion-request/cancel', password?:string) {
    await this.profile();const epoch=this.epoch;
    const result=await this.api.request<unknown>(action==='status'?'GET':'POST','privacy/'+action,action==='status'?undefined:{password,...(action==='deletion-request'?{confirmation:'REQUEST_DELETION'}:{})},this.access);
    if(epoch!==this.epoch)throw new AuthFailure('expired');
    if(action==='deletion-request')this.clear();return result;
  }
  async change(path: string, body: unknown, method: 'POST' | 'PATCH' | 'DELETE' = 'PATCH') {
    await this.profile(); const epoch = this.epoch;
    const result = await this.api.request<unknown>(method, path, body, this.access);
    if(epoch !== this.epoch) throw new AuthFailure('expired');
    await this.profile(); return result;
  }
  async avatar(): Promise<Blob | null> {
    const url=this.account()?.profile?.avatarUrl; if(!url)return null;
    if(!/^\/(api\/v1\/users\/avatar|uploads\/avatars)\/[a-f0-9-]{36}\.(webp|png|jpg|jpeg)$/.test(url)) return null;
    await this.profile(); const epoch=this.epoch; const blob=await this.api.request('GET',url.startsWith('/uploads/') ? 'users/avatar/legacy/'+url.split('/').pop() : url.slice('/api/v1/'.length),undefined,this.access,true); if(epoch!==this.epoch)throw new AuthFailure('expired');return blob;
  }
  async logout(all = false) {
    if (all) {
      try { await this.profile(); await this.api.request<MessageResponse>('POST', 'auth/logout-all', {}, this.access); }
      catch (error) { this.clear(); this.notice.set('logoutUnconfirmed'); throw error; }
      this.clear(); return;
    }
    const refreshToken = this.refreshValue;
    this.clear();
    if (refreshToken) {
      try { await this.api.request<MessageResponse>('POST', 'auth/logout', { refreshToken }); }
      catch (error) { this.notice.set('logoutUnconfirmed'); throw error; }
    }
  }
}
