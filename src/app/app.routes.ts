import { authenticatedGuard, resetGuard } from './core/auth/auth.guard';
import { Routes } from '@angular/router';
import {RequestMapperService} from './mappers/request-mapper.service';

export const routes: Routes = [
  {
    path: RequestMapperService.BASE_RELATIVE_URL,
    redirectTo:RequestMapperService.SIGNIN_URL,
    pathMatch: 'full',
  },
  {
    path: RequestMapperService.SIGNIN_URL,
    loadComponent:()=> import("./auth/signin/signin.component").then((m)=>m.SigninComponent),
    data:{ mode: 'signin' }
  },
  ...[
    ['signup', 'signup'], ['verify-email', 'verify'], ['forgot-password', 'forgot'],
    ['verify-reset-otp', 'code'], ['reset-password', 'reset'],
  ].map(([path, mode]) => ({ path, loadComponent: () => import('./auth/signin/signin.component').then(m => m.SigninComponent), data: { mode }, ...(mode === 'reset' ? { canActivate: [resetGuard] } : {}) })),
  { path:'feed',canActivate:[authenticatedGuard],loadComponent:()=>import('./feed/feed.component').then(m=>m.FeedComponent) },
  { path: 'account', canActivate: [authenticatedGuard], loadComponent: () => import('./auth/account/account.component').then(m => m.AccountComponent) },
  { path: 'profile/settings', canActivate: [authenticatedGuard], loadComponent: () => import('./profiles/profile-settings.component').then(m=>m.ProfileSettingsComponent), data:{astrology:false} },
  { path: 'astrology/settings', canActivate: [authenticatedGuard], loadComponent: () => import('./profiles/profile-settings.component').then(m=>m.ProfileSettingsComponent), data:{astrology:true} },
  { path: 'privacy',canActivate:[authenticatedGuard],loadComponent:()=>import('./privacy/privacy.component').then(m=>m.PrivacyComponent) },
  { path: '**', redirectTo: RequestMapperService.SIGNIN_URL },
];
