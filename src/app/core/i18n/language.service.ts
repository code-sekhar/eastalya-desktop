import {inject,Injectable,signal,effect} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import type {Language} from '../auth/auth-copy';
@Injectable({providedIn:'root'})export class LanguageState {readonly value=signal<Language>('en');private readonly document=inject(DOCUMENT);constructor(){effect(()=>{this.document.documentElement.lang=this.value();});}}
