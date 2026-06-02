import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiException } from '@core/errors/api-error';
import { TournamentsService } from '@core/services/tournaments.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { CodeInputComponent } from '@shared/components/code-input/code-input.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ToastService } from '@shared/services/toast.service';

const CODE_LENGTH = 6;

@Component({
  selector: 'app-join-tournament',
  standalone: true,
  imports: [PageHeaderComponent, ButtonComponent, CodeInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './join-tournament.component.html',
  styleUrl: './join-tournament.component.scss',
})
export class JoinTournamentComponent {
  private readonly _service = inject(TournamentsService);
  private readonly _toast = inject(ToastService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly codeLength = CODE_LENGTH;
  protected readonly code = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly _codeInput = viewChild<CodeInputComponent>('codeInput');

  protected readonly canSubmit = computed(
    () => this.code().length === CODE_LENGTH && !this.submitting(),
  );

  protected readonly hasError = computed(() => this.errorMessage() !== null);

  protected onCodeChange(value: string): void {
    this.code.set(value);
    if (this.errorMessage() !== null) {
      this.errorMessage.set(null);
    }
  }

  protected onCodeComplete(value: string): void {
    this.code.set(value);
    this.submit();
  }

  protected submit(): void {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    this._service
      .join({ inviteCode: this.code() })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (tournament) => {
          this.submitting.set(false);
          this._toast.success(`Você entrou em "${tournament.name}"!`);
          void this._router.navigate(['/tournaments', tournament.id]);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this._extractError(err));
          this._codeInput()?.reset();
        },
      });
  }

  private _extractError(err: unknown): string {
    if (!(err instanceof ApiException)) {
      return 'Não foi possível entrar no torneio.';
    }
    if (err.isNotFound) {
      return 'Código inválido ou torneio não existe.';
    }
    if (err.isForbidden) {
      return err.message || 'Você não pode entrar neste torneio.';
    }
    if (err.isConflict) {
      const m = err.message ?? '';
      if (m.includes('already a member')) {
        return 'Você já está neste torneio.';
      }
      if (m.includes('full')) {
        return 'O torneio atingiu o limite de participantes.';
      }
      if (m.includes('not accepting members')) {
        return 'Este torneio não está aceitando participantes no momento.';
      }
      return err.message;
    }
    return err.message;
  }
}
