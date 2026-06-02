import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import {
  IChangePasswordRequest,
  IUpdateProfileRequest,
  IUserSummary,
} from '@core/interfaces/auth.interface';
import { API_BASE_URL } from '@core/services/api-config';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);
  private readonly _state = inject(AuthState);

  public getMe(): Observable<IUserSummary> {
    return this._http
      .get<IUserSummary>(`${this._baseUrl}/api/users/me`)
      .pipe(tap((user) => this._state.applyUserUpdate(user)));
  }

  public updateMe(payload: IUpdateProfileRequest): Observable<IUserSummary> {
    return this._http
      .put<IUserSummary>(`${this._baseUrl}/api/users/me`, payload)
      .pipe(tap((user) => this._state.applyUserUpdate(user)));
  }

  public changePassword(payload: IChangePasswordRequest): Observable<void> {
    return this._http.put<void>(
      `${this._baseUrl}/api/users/me/password`,
      payload,
    );
  }
}
