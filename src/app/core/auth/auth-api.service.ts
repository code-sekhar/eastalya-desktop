import { PrivateApiFailure } from './private-api-error';
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthFailure } from './auth.contracts';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  // Empty existing configuration means same-origin /api/v1 via the dev proxy.
  private readonly base = environment.apiUrl ? environment.apiUrl.replace(/\/$/, '') : '/api/v1';
  async privateRequest(method:'GET'|'POST'|'PATCH',path:string,body:unknown,access:string):Promise<unknown> {
    try {return await firstValueFrom(this.http.request<unknown>(method,`${this.base}/${path}`,{body,headers:new HttpHeaders({Authorization:`Bearer ${access}`})}).pipe(timeout(15000)));}
    catch(error){throw PrivateApiFailure.from(error);}
  }
  request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, access?: string, binary?: false): Promise<T>;
  request(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body: unknown, access: string | undefined, binary: true): Promise<Blob>;
  async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, access?: string, binary = false): Promise<T | Blob> {
    try {
      const headers = access ? new HttpHeaders({ Authorization: `Bearer ${access}` }) : undefined;
      return binary
        ? await firstValueFrom(this.http.request(method, `${this.base}/${path}`, {body, headers, responseType:'blob'}).pipe(timeout(15000)))
        : await firstValueFrom(this.http.request<T>(method, `${this.base}/${path}`, {body, headers}).pipe(timeout(15000)));
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        throw new AuthFailure(error.status === 403 ? 'permission' : error.status === 409 ? 'conflict' : error.status === 401 ? 'credentials' : error.status === 429 ? 'rate' : error.status === 503 || error.status >= 500 ? 'unavailable' : error.status === 0 ? 'network' : 'validation');
      }
      throw new AuthFailure(error instanceof TimeoutError ? 'network' : 'protocol');
    }
  }
}
