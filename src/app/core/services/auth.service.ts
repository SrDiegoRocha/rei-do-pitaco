import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of, tap } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import {
  IAuthResponse,
  IRefreshTokenRequest,
  ISignInRequest,
  ISignUpRequest,
} from '@core/interfaces/auth.interface';
import { API_BASE_URL } from '@core/services/api-config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _http = inject(HttpClient);
  private readonly _bareHttp = new HttpClient(inject(HttpBackend));
  private readonly _baseUrl = inject(API_BASE_URL);
  private readonly _state = inject(AuthState);

  public signUp(payload: ISignUpRequest): Observable<IAuthResponse> {
    return this._http
      .post<IAuthResponse>(`${this._baseUrl}/api/auth/signup`, payload)
      .pipe(tap((auth) => this._state.applyAuthResponse(auth)));
  }

  public signIn(payload: ISignInRequest): Observable<IAuthResponse> {
    return this._http
      .post<IAuthResponse>(`${this._baseUrl}/api/auth/signin`, payload)
      .pipe(tap((auth) => this._state.applyAuthResponse(auth)));
  }

  public signOut(): void {
    const refreshToken = this._state.refreshToken();
    if (refreshToken) {
      const body: IRefreshTokenRequest = { refreshToken };
      // Fire and forget — tolerant of network/server errors.
      // Uses bare HttpClient to skip the auth interceptor (no 401 → refresh loop).
      this._bareHttp
        .post<void>(`${this._baseUrl}/api/auth/logout`, body)
        .pipe(catchError(() => of(void 0)))
        .subscribe();
    }
    this._state.clear();
  }
}
