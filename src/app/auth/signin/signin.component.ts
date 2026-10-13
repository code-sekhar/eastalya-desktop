import {LanguageState} from '../../core/i18n/language.service';
import { Component, inject, signal, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthSession } from '../../core/auth/auth-session.service';
import { AuthFailure } from '../../core/auth/auth.contracts';
import { copy, CopyKey, Language } from '../../core/auth/auth-copy';
import { emailValidator, passwordValidator } from '../../core/auth/auth.validators';
type Mode = 'signin' | 'signup' | 'verify' | 'forgot' | 'code' | 'reset';
@Component({ selector: 'app-signin', imports: [ReactiveFormsModule, RouterLink], templateUrl: './signin.component.html', styleUrl: './signin.component.scss' })
export class SigninComponent implements OnDestroy {
  ngOnDestroy() { this.form.controls.otp.reset(); }

  readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  readonly mode: Mode = inject(ActivatedRoute).snapshot.data['mode'] as Mode ?? 'signin';
  readonly busy = signal(false); readonly message = signal<CopyKey | null>(null); readonly failed = signal(false);
  readonly visible = signal(false); readonly language = inject(LanguageState).value;
  readonly form = new FormGroup({
    email: new FormControl(this.session.flowEmail(), { nonNullable: true, validators: [Validators.required, emailValidator] }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[a-zA-Z0-9_]{3,30}$/)] }),
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)] }),
    password: new FormControl('', { nonNullable: true, validators: [passwordValidator(this.mode === 'signin' ? 8 : 15)] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    otp: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^[0-9]{6}$/), Validators.required] }),
  });
  constructor() {
    for (const [key, control] of Object.entries(this.form.controls)) {
      const enabled = key === 'email' ? this.mode !== 'reset' : key === 'username' || key === 'displayName' ? this.mode === 'signup' : key === 'password' ? ['signin', 'signup', 'reset'].includes(this.mode) : key === 'confirm' ? ['signup', 'reset'].includes(this.mode) : ['verify', 'code'].includes(this.mode);
      if (!enabled) control.disable();
    }
  }
  t(key: CopyKey) { return copy(this.language(), key); }
  changeLanguage(event: Event) { const value = (event.target as HTMLSelectElement).value; if (value === 'en' || value === 'bn' || value === 'hi') this.language.set(value); }
  invalid(name: keyof typeof this.form.controls) { const field = this.form.controls[name]; return field.touched && field.invalid; }
  async submit() {
    if (this.busy()) return;
    this.form.markAllAsTouched(); const values = this.form.getRawValue();
    if (this.form.invalid || (this.form.controls.confirm.enabled && values.password !== values.confirm)) { this.failed.set(true); this.message.set('invalid'); return; }
    this.busy.set(true); this.failed.set(false); this.message.set(null);
    try {
      const email = values.email.trim().toLowerCase();
      if (this.mode === 'signin') { await this.session.login(email, values.password); this.form.controls.password.reset(); await this.router.navigateByUrl('/account'); }
      else if (this.mode === 'signup') { await this.session.register({ email, username: values.username, displayName: values.displayName, password: values.password }); this.form.controls.password.reset(); this.form.controls.confirm.reset(); this.session.notice.set('neutral'); await this.router.navigateByUrl('/verify-email'); }
      else if (this.mode === 'verify') { await this.session.verify(email, values.otp); this.form.controls.otp.reset(); this.session.notice.set('verified'); await this.router.navigateByUrl('/signin'); }
      else if (this.mode === 'forgot') { await this.session.forgot(email); this.session.notice.set('neutral'); await this.router.navigateByUrl('/verify-reset-otp'); }
      else if (this.mode === 'code') { await this.session.verifyReset(email, values.otp); this.form.controls.otp.reset(); await this.router.navigateByUrl('/reset-password'); }
      else { await this.session.reset(values.password); this.form.reset(); this.session.notice.set('resetDone'); await this.router.navigateByUrl('/signin'); }
    } catch (error) { this.failed.set(true); this.message.set(error instanceof AuthFailure ? error.kind : 'protocol'); }
    finally { this.busy.set(false); }
  }
  async resend() {
    if (this.busy()) return; const email = this.form.controls.email;
    email.markAsTouched(); if (email.invalid) { this.message.set('invalid'); return; }
    this.busy.set(true);
    try { if (this.mode === 'code') await this.session.forgot(email.value); else await this.session.resend(email.value); this.failed.set(false); this.message.set('neutral'); }
    catch (error) { this.failed.set(true); this.message.set(error instanceof AuthFailure ? error.kind : 'protocol'); }
    finally { this.busy.set(false); }
  }
  notice(): string { const value = this.session.notice() as CopyKey; return value ? this.t(value) : ''; }
}
