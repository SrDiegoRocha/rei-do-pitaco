import { computed, Injectable, inject, signal } from '@angular/core';
import {
  IAuthResponse,
  IUserSummary,
} from '@core/interfaces/auth.interface';
import { TokenStorage } from '@core/auth/token-storage';

@Injectable({ providedIn: 'root' })
export class AuthState {
  private readonly _storage = inject(TokenStorage);

  private readonly _accessTokenSig = signal<string | null>(
    this._storage.readAccessToken(),
  );
  private readonly _refreshTokenSig = signal<string | null>(
    this._storage.readRefreshToken(),
  );
  private readonly _userSig = signal<IUserSummary | null>(
    this._storage.readUser(),
  );

  public readonly accessToken = this._accessTokenSig.asReadonly();
  public readonly refreshToken = this._refreshTokenSig.asReadonly();
  public readonly user = this._userSig.asReadonly();
  public readonly isAuthenticated = computed(
    () => this._accessTokenSig() !== null,
  );

  public applyAuthResponse(auth: IAuthResponse): void {
    this._storage.saveSession(auth);
    this._accessTokenSig.set(auth.accessToken);
    this._refreshTokenSig.set(auth.refreshToken);
    this._userSig.set(auth.user);
  }

  public applyRefreshedTokens(
    accessToken: string,
    refreshToken: string,
  ): void {
    this._storage.updateTokens(accessToken, refreshToken);
    this._accessTokenSig.set(accessToken);
    this._refreshTokenSig.set(refreshToken);
  }

  public applyUserUpdate(user: IUserSummary): void {
    this._storage.updateUser(user);
    this._userSig.set(user);
  }

  public clear(): void {
    this._storage.clear();
    this._accessTokenSig.set(null);
    this._refreshTokenSig.set(null);
    this._userSig.set(null);
  }
}
