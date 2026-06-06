import { HttpClient } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { AuthState } from '@core/auth/auth-state';
import { API_BASE_URL } from '@core/services/api-config';
import { environment } from '@environments';

type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

const DISMISS_KEY = 'reidopitaco.notifPromptDismissedAt';
const DISMISS_COUNT_KEY = 'reidopitaco.notifPromptDismissCount';

/** Delays progressivos por número de vezes que o usuário clicou em "Agora não".
 *  Após o 4º clique (índice 3), o 5º dispensa permanentemente. */
const DISMISS_DELAYS_MS = [
  30 * 60 * 1000,            // 1ª vez: 30 min
  2 * 60 * 60 * 1000,        // 2ª vez: 2h
  24 * 60 * 60 * 1000,       // 3ª vez: 24h
  3 * 24 * 60 * 60 * 1000,   // 4ª vez: 3 dias
] as const;

interface IPushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Orquestra as notificações push (Web Push) do PWA:
 * - pré-prompt suave antes do prompt nativo (reduz bloqueios definitivos);
 * - inscreve no service worker e sincroniza com o backend;
 * - se o usuário bloquear, mostra um banner de "como reativar";
 * - reexibe o convite/banner a cada 1h enquanto não aceitar.
 *
 * Deve ser instanciado no bootstrap (injetado no componente raiz).
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly _swPush = inject(SwPush);
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(API_BASE_URL);
  private readonly _auth = inject(AuthState);

  /** Push só funciona com service worker ativo (prod) e APIs presentes. */
  private readonly _supported =
    this._swPush.isEnabled &&
    typeof Notification !== 'undefined' &&
    'PushManager' in window;

  private readonly _permission = signal<NotifPermission>(
    this._readPermission(),
  );
  private readonly _dismissed = signal(false);
  private _rearmTimer: ReturnType<typeof setTimeout> | undefined;
  private _ensured = false;

  /** Estado atual da permissão do navegador. */
  public readonly permission = this._permission.asReadonly();

  /** Convite suave: ainda não decidiu (permite abrir o prompt nativo). */
  public readonly showPrePrompt = computed(
    () =>
      this._supported &&
      this._auth.isAuthenticated() &&
      this._permission() === 'default' &&
      !this._dismissed(),
  );

  /** Banner de "reative nas configurações": o usuário bloqueou de vez. */
  public readonly showDeniedBanner = computed(
    () =>
      this._supported &&
      this._auth.isAuthenticated() &&
      this._permission() === 'denied' &&
      !this._dismissed(),
  );

  constructor() {
    // Já permitido em sessão anterior: garante que o backend tenha a inscrição.
    effect(() => {
      if (
        this._supported &&
        this._auth.isAuthenticated() &&
        this._permission() === 'granted' &&
        !this._ensured
      ) {
        this._ensured = true;
        void this._ensureSubscribed();
      }
    });

    // Restaura estado de dismiss entre sessões.
    const count = this._readDismissCount();
    const dismissedAt = this._readDismissedAt();
    if (dismissedAt !== null) {
      const delay = DISMISS_DELAYS_MS[count - 1] as number | undefined;
      if (delay === undefined) {
        // 5ª vez ou mais: dispensado permanentemente.
        this._dismissed.set(true);
      } else {
        const elapsed = Date.now() - dismissedAt;
        if (elapsed < delay) {
          this._dismissed.set(true);
          this._scheduleRearm(delay - elapsed);
        }
      }
    }
  }

  /** Pré-prompt: usuário tocou em "Ativar" → dispara o prompt nativo e inscreve. */
  public async enable(): Promise<void> {
    if (!this._supported) return;
    try {
      const sub = await this._swPush.requestSubscription({
        serverPublicKey: environment.vapidPublicKey,
      });
      await this._sendSubscription(sub);
      this._permission.set('granted');
      this._ensured = true;
      this._clearDismissal();
    } catch {
      // Negou no prompt nativo (ou falhou). Reflete o estado real e mantém
      // o banner de "como reativar" pelo ciclo de 1h.
      this._permission.set(this._readPermission());
    }
  }

  /** "Agora não" / fechar: esconde e reexibe com delay progressivo; após 4ª vez, não reaparece. */
  public dismiss(): void {
    const count = this._readDismissCount();
    const nextCount = count + 1;

    this._dismissed.set(true);
    try {
      localStorage.setItem(DISMISS_COUNT_KEY, String(nextCount));
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage indisponível — só não persiste entre reloads.
    }

    const delay = DISMISS_DELAYS_MS[nextCount - 1] as number | undefined;
    if (delay !== undefined) {
      this._scheduleRearm(delay);
    }
    // delay === undefined → 5ª vez ou mais: sem rearm, dispensado permanentemente.
  }

  /** Reusa a inscrição existente (permissão já concedida) e sincroniza no backend. */
  private async _ensureSubscribed(): Promise<void> {
    try {
      const sub = await this._swPush.requestSubscription({
        serverPublicKey: environment.vapidPublicKey,
      });
      await this._sendSubscription(sub);
    } catch {
      // Sem permissão ou SW indisponível — silencioso.
    }
  }

  private async _sendSubscription(sub: PushSubscription): Promise<void> {
    const json = sub.toJSON();
    const keys = json.keys;
    const p256dh = keys?.['p256dh'];
    const auth = keys?.['auth'];
    if (!json.endpoint || !p256dh || !auth) return;
    const payload: IPushSubscriptionPayload = {
      endpoint: json.endpoint,
      p256dh,
      auth,
    };
    await new Promise<void>((resolve) => {
      this._http
        .post<void>(`${this._baseUrl}/api/push/subscriptions`, payload)
        .subscribe({ next: () => resolve(), error: () => resolve() });
    });
  }

  private _scheduleRearm(delayMs: number): void {
    clearTimeout(this._rearmTimer);
    this._rearmTimer = setTimeout(() => this._dismissed.set(false), delayMs);
  }

  private _clearDismissal(): void {
    clearTimeout(this._rearmTimer);
    this._dismissed.set(false);
    try {
      localStorage.removeItem(DISMISS_KEY);
      localStorage.removeItem(DISMISS_COUNT_KEY);
    } catch {
      // ignore
    }
  }

  private _readDismissCount(): number {
    try {
      const raw = localStorage.getItem(DISMISS_COUNT_KEY);
      if (!raw) return 0;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
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

  private _readPermission(): NotifPermission {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission as NotifPermission;
  }
}
