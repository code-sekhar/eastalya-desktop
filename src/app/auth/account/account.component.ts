import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session.service';
import { AuthFailure } from '../../core/auth/auth.contracts';
import { copy } from '../../core/auth/auth-copy';
@Component({ selector: 'app-account', imports: [RouterLink], template: `
<main class="account"><a routerLink="/account" class="brand">EASTALYA</a>
@if (session.account(); as account) {
<h1>Your account</h1><nav><a routerLink="/feed">Home feed</a> · <a routerLink="/privacy">Privacy lifecycle</a> · <a routerLink="/profile/settings">Edit profile &amp; privacy</a> · <a routerLink="/astrology/settings">Optional astrology</a></nav><p>{{ account.profile?.displayName || account.username }}</p><p>{{ account.email }}</p><p>&#64;{{ account.username }}</p>
<p>Birth details are optional. Your private account is visible here only to you.</p>
<button (click)="load()" [disabled]="busy()">Reload profile</button>
<button (click)="logout(false)" [disabled]="busy()">Sign out</button><button (click)="logout(true)" [disabled]="busy()">Sign out from all devices</button>
} @else { <h1>Session ended</h1><a routerLink="/signin">Sign in again</a> }
@if (error()) { <p role="alert">{{ error() }}</p> } @if(busy()) { <p role="status">Please wait…</p> }
</main>`, styles: [`:host{display:block;background:#faf7ff;min-height:100dvh;font-family:system-ui;color:#171029;overflow-wrap:anywhere}.account{max-width:640px;margin:auto;padding:48px 24px}.brand{color:#6d28d9;font-weight:bold;letter-spacing:3px}button{margin:12px 8px 0 0;border:1px solid #9272b2;border-radius:10px;padding:12px;background:white;color:#4f1b8a;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #7c3aed;outline-offset:3px}`] })
export class AccountComponent {
  readonly session = inject(AuthSession); private readonly router = inject(Router);
  readonly busy = signal(false); readonly error = signal('');
  constructor() { void this.load(); }
  async load() { this.busy.set(true); this.error.set(''); try { await this.session.profile(); } catch(error) { this.error.set(copy('en', error instanceof AuthFailure ? error.kind : 'protocol')); } finally { this.busy.set(false); } }
  async logout(all: boolean) { if(this.busy()) return; this.busy.set(true); try { await this.session.logout(all); } catch { /* Session records the unconfirmed server revocation for the sign-in screen. */ } finally { this.busy.set(false); await this.router.navigateByUrl('/signin'); } }
}
