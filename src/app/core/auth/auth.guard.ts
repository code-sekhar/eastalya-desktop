import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSession } from './auth-session.service';
export const authenticatedGuard: CanActivateFn = () => inject(AuthSession).authenticated || inject(Router).createUrlTree(['/signin']);
export const resetGuard: CanActivateFn = () => inject(AuthSession).canReset || inject(Router).createUrlTree(['/verify-reset-otp']);
