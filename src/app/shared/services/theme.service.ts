import { DOCUMENT } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'futbet.theme';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _document = inject(DOCUMENT);
  private readonly _modeSig = signal<ThemeMode>(this._readStoredMode());
  private readonly _systemPrefersDarkSig = signal<boolean>(
    this._readSystemPrefersDark(),
  );

  public readonly mode = this._modeSig.asReadonly();

  /** Tema efetivo (resolve 'system' → 'light'/'dark'), reativo. */
  public readonly resolvedTheme = computed<ResolvedTheme>(() =>
    this._resolveTheme(this._modeSig(), this._systemPrefersDarkSig()),
  );

  constructor() {
    this._watchSystemPreference();
    effect(() => {
      const mode = this._modeSig();
      const resolved = this._resolveTheme(mode, this._systemPrefersDarkSig());
      this._applyTheme(resolved);
    });
  }

  public setMode(mode: ThemeMode): void {
    this._modeSig.set(mode);
    this._writeStoredMode(mode);
  }

  public toggle(): void {
    const next: ThemeMode = this._isDark() ? 'light' : 'dark';
    this.setMode(next);
  }

  public resolved(): ResolvedTheme {
    return this._resolveTheme(this._modeSig(), this._systemPrefersDarkSig());
  }

  private _isDark(): boolean {
    return this.resolved() === 'dark';
  }

  private _resolveTheme(
    mode: ThemeMode,
    systemDark: boolean,
  ): ResolvedTheme {
    if (mode === 'system') return systemDark ? 'dark' : 'light';
    return mode;
  }

  private _applyTheme(theme: ResolvedTheme): void {
    const html = this._document.documentElement;
    html.setAttribute('data-theme', theme);
  }

  private _readStoredMode(): ThemeMode {
    if (typeof localStorage === 'undefined') return 'system';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }

  private _writeStoredMode(mode: ThemeMode): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, mode);
  }

  private _readSystemPrefersDark(): boolean {
    const win = this._document.defaultView;
    if (!win?.matchMedia) return false;
    return win.matchMedia(DARK_MEDIA_QUERY).matches;
  }

  private _watchSystemPreference(): void {
    const win = this._document.defaultView;
    if (!win?.matchMedia) return;
    const media = win.matchMedia(DARK_MEDIA_QUERY);
    media.addEventListener('change', (event) => {
      this._systemPrefersDarkSig.set(event.matches);
    });
  }
}
