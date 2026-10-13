import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RequestMapperService {

  constructor() { }

  public static readonly BASE_RELATIVE_URL:string = '';
  public static readonly BASE_DEFAULT_URL:string = '/';
  public static readonly ACCESS_DENIED_URL:string = 'ad';
  public static readonly SIGNIN_URL:string = 'signin';
  public static readonly SIGNUP_URL:string = 'signup';
  public static readonly SIGNOUTS_URL:string = 'signout';
  public static readonly PORTAL_URL:string = 'portal';
  public static readonly DASHBOARD_URL:string = 'dashboard';
}
