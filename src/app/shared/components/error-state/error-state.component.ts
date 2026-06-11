import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '@core/auth/auth-state';
import { isSessionExpiredError } from '@core/errors/api-error';
import {
  AlertTriangle,
  LogIn,
  LucideAngularModule,
  RefreshCw,
} from 'lucide-angular';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-state.component.html',
  styleUrl: './error-state.component.scss',
})
export class ErrorStateComponent {
  private readonly _router = inject(Router);
  private readonly _authState = inject(AuthState);

  public readonly title = input<string>('Algo deu errado');
  /**
   * Erro original (ApiException ou outro). Define a mensagem exibida e detecta
   * sessão expirada (401/403) para oferecer o botão de login.
   */
  public readonly error = input<unknown>(null);
  /**
   * Mensagem custom. Quando vazia, é derivada de `error` — nunca expõe a URL
   * da API. Sessão expirada sempre tem prioridade sobre a mensagem custom.
   */
  public readonly message = input<string>('');
  public readonly canRetry = input<boolean>(false);
  public readonly retrying = input<boolean>(false);
  public readonly retryLabel = input<string>('Tentar novamente');

  public readonly retry = output<void>();

  protected readonly alertIcon = AlertTriangle;
  protected readonly refreshIcon = RefreshCw;
  protected readonly loginIcon = LogIn;

  /** Sessão expirada / sem autenticação: tentar novamente não resolve, só relogar. */
  protected readonly sessionExpired = computed(() =>
    isSessionExpiredError(this.error()),
  );

  protected readonly displayMessage = computed(() => {
    if (this.sessionExpired()) {
      return 'Sua sessão expirou. Entre novamente para continuar.';
    }
    return this.message().trim();
  });

  protected onRetry(): void {
    if (!this.retrying()) this.retry.emit();
  }

  protected onLogin(): void {
    // Limpa o token expirado para a tela de login começar do zero.
    this._authState.clear();
    void this._router.navigate(['/auth/signin']);
  }
}
