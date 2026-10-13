import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
export const emailValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(String(control.value).trim()) ? null : { email: true };
export function passwordValidator(minimum = 15): ValidatorFn {
  return (control: AbstractControl) => typeof control.value === 'string' && [...control.value].length >= minimum && new TextEncoder().encode(control.value).length <= 72 ? null : { passwordPolicy: true };
}
