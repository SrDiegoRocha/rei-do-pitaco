import { Injectable } from '@angular/core';
import {
  IAuthResponse,
  IUserSummary,
} from '@core/interfaces/auth.interface';

const ACCESS_TOKEN_KEY = 'futbet.accessToken';
const REFRESH_TOKEN_KEY = 'futbet.refreshToken';
const USER_KEY = 'futbet.user';

@Injectable({ providedIn: 'root' })
export class TokenStorage {
  public readAccessToken(): string | null {
    return this._read(ACCESS_TOKEN_KEY);
  }

  public readRefreshToken(): string | null {
    return this._read(REFRESH_TOKEN_KEY);
  }

  public readUser(): IUserSummary | null {
    const raw = this._read(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as IUserSummary;
    } catch {
      return null;
    }
  }

  public saveSession(auth: IAuthResponse): void {
    this._write(ACCESS_TOKEN_KEY, auth.accessToken);
    this._write(REFRESH_TOKEN_KEY, auth.refreshToken);
    this._write(USER_KEY, JSON.stringify(auth.user));
  }

  public updateTokens(accessToken: string, refreshToken: string): void {
    this._write(ACCESS_TOKEN_KEY, accessToken);
    this._write(REFRESH_TOKEN_KEY, refreshToken);
  }

  public updateUser(user: IUserSummary): void {
    this._write(USER_KEY, JSON.stringify(user));
  }

  public clear(): void {
    this._remove(ACCESS_TOKEN_KEY);
    this._remove(REFRESH_TOKEN_KEY);
    this._remove(USER_KEY);
  }

  private _read(key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }

  private _write(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  }

  private _remove(key: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  }
}
