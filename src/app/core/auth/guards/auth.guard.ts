import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthState } from '@core/auth/auth-state';

export const authGuard: CanActivateFn = (_route, routerState) => {
  const state = inject(AuthState);
  const router = inject(Router);

  if (state.isAuthenticated()) {
    return true;
  }
  // Guarda a URL pretendida para voltar a ela após o login (ex.: link de partida).
  return router.createUrlTree(['/auth/signin'], {
    queryParams: { returnUrl: routerState.url },
  });
};
