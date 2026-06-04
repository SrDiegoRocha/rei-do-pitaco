import { computed, Injectable, signal } from '@angular/core';

const DISMISS_KEY = 'reidopitaco.installPromptDismissedAt';
/** Após "Agora não", reexibe o convite passado este tempo (30 min). */
const DISMISS_DURATION_MS = 30 * 60 * 1000;

/**
 * Evento `beforeinstallprompt` (Chromium) — não tipado pelo TypeScript.
 * Só dispara quando o app é instalável E ainda não está instalado, o que o
 * torna o sinal prático de "usuário não tem o app".
 */
interface IBeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Controla o convite de instalação do PWA.
 *
 * Deve ser instanciado no bootstrap (injetado no componente raiz) para
 * capturar o `beforeinstallprompt`, que costuma disparar logo no load —
 * antes de o usuário logar.
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly _deferred = signal<IBeforeInstallPromptEvent | null>(null);
  private readonly _dismissed = signal<boolean>(false);
  private readonly _installedNow = signal(false);
  private _rearmTimer: ReturnType<typeof setTimeout> | undefined;

  /** Já está rodando como app instalado (janela standalone)? */
  public readonly isStandalone: boolean = this._readStandalone();

  /** iOS/iPadOS: sem `beforeinstallprompt`; instalação é manual no Safari. */
  public readonly isIos: boolean = this._readIos();

  /** O navegador ofereceu instalação nativa (Chromium, app não instalado). */
  public readonly canPromptInstall = computed(() => this._deferred() !== null);

  /** Deve exibir o convite de instalação? */
  public readonly showInstallBanner = computed(
    () =>
      !this.isStandalone &&
      !this._dismissed() &&
      !this._installedNow() &&
      (this._deferred() !== null || this.isIos),
  );

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Suprime o mini-infobar nativo; o app mostra o próprio convite.
      event.preventDefault();
      this._deferred.set(event as IBeforeInstallPromptEvent);
    });
    window.addEventListener('appinstalled', () => {
      this._installedNow.set(true);
      this._deferred.set(null);
      this._clearDismissal();
    });

    // Ao abrir: se foi dispensado há menos de 30 min, mantém escondido e
    // agenda a reexibição para o tempo restante; senão, mostra normalmente.
    const dismissedAt = this._readDismissedAt();
    if (dismissedAt !== null) {
      const elapsed = Date.now() - dismissedAt;
      if (elapsed < DISMISS_DURATION_MS) {
        this._dismissed.set(true);
        this._scheduleRearm(DISMISS_DURATION_MS - elapsed);
      }
    }
  }

  /** Dispara o prompt nativo de instalação (Chromium). */
  public async promptInstall(): Promise<void> {
    const deferred = this._deferred();
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    // O evento só pode ser usado uma vez por page load.
    this._deferred.set(null);
    if (choice.outcome === 'dismissed') {
      this.dismiss();
    }
  }

  /** "Agora não": esconde e reexibe automaticamente após 30 min. */
  public dismiss(): void {
    this._dismissed.set(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage indisponível (modo privado etc.) — só não persiste.
    }
    this._scheduleRearm(DISMISS_DURATION_MS);
  }

  /** Agenda a reexibição do convite (volta a aparecer se ainda não instalou). */
  private _scheduleRearm(delayMs: number): void {
    clearTimeout(this._rearmTimer);
    this._rearmTimer = setTimeout(() => this._dismissed.set(false), delayMs);
  }

  private _clearDismissal(): void {
    clearTimeout(this._rearmTimer);
    this._dismissed.set(false);
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      // ignore
    }
  }

  private _readDismissedAt(): number | null {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return null;
      const ts = Number(raw);
      return Number.isFinite(ts) ? ts : null;
    } catch {
      return null;
    }
  }

  private _readStandalone(): boolean {
    try {
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      // Safari iOS expõe `navigator.standalone` fora do padrão.
      return (
        'standalone' in navigator &&
        (navigator as unknown as { standalone?: boolean }).standalone === true
      );
    } catch {
      return false;
    }
  }

  private _readIos(): boolean {
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) return true;
    // iPadOS 13+ se identifica como Mac; o touch entrega.
    return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  }
}
