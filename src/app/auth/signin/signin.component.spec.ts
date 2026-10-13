import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { SigninComponent } from './signin.component';

describe('SigninComponent', () => {
  let component: SigninComponent;
  let fixture: ComponentFixture<SigninComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SigninComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), {provide: ActivatedRoute, useValue: {snapshot: {data: {mode: 'signin'}}}}]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SigninComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('rejects incomplete credentials', async () => {
    await component.submit();
    expect(component.failed()).toBeTrue();
    expect(component.message()).toBe('invalid');
  });

  it('has accessible controls and a password visibility button', () => {
    expect(fixture.nativeElement.querySelector('label[for=email]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[autocomplete=current-password]')).toBeTruthy();
    component.visible.set(true); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#password').type).toBe('text');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
