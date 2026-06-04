import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  input,
  output,
  signal,
} from '@angular/core';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { IPredictionResponse } from '@core/interfaces/prediction.interface';
import { backdropFade, modalScale } from '@shared/animations/animations';
import { ButtonComponent } from '@shared/components/button/button.component';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { LucideAngularModule, Minus, Plus } from 'lucide-angular';

export interface IPredictionPayload {
  homeScore: number;
  awayScore: number;
}

const MAX_SCORE = 99;

@Component({
  selector: 'app-prediction-dialog',
  standalone: true,
  imports: [ButtonComponent, TeamBadgeComponent, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prediction-dialog.component.html',
  styleUrl: './prediction-dialog.component.scss',
  animations: [modalScale, backdropFade],
})
export class PredictionDialogComponent {
  public readonly open = input<boolean>(false);
  public readonly match = input<IMatchResponse | null>(null);
  public readonly current = input<IPredictionResponse | null>(null);
  public readonly submitting = input<boolean>(false);
  public readonly serverError = input<string | null>(null);
  /** Mostra a ação "Remover pitaco" (só faz sentido com `current` setado). */
  public readonly canRemove = input<boolean>(false);

  public readonly confirmed = output<IPredictionPayload>();
  public readonly cancelled = output<void>();
  public readonly removeRequested = output<void>();

  protected readonly minusIcon = Minus;
  protected readonly plusIcon = Plus;

  protected readonly homeScore = signal(0);
  protected readonly awayScore = signal(0);

  protected readonly title = computed(() =>
    this.current() ? 'Editar pitaco' : 'Novo pitaco',
  );

  protected readonly confirmLabel = computed(() =>
    this.current() ? 'Salvar pitaco' : 'Lançar pitaco',
  );

  /** Data/hora da partida formatada (null quando sem agenda). */
  protected readonly dateLabel = computed(() => {
    const iso = this.match()?.scheduledAt;
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return null;
    }
  });

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (!isOpen) return;
      const c = this.current();
      this.homeScore.set(c?.homeScore ?? 0);
      this.awayScore.set(c?.awayScore ?? 0);
    });
  }

  protected incHome(): void {
    if (this.submitting()) return;
    this.homeScore.update((v) => Math.min(MAX_SCORE, v + 1));
  }

  protected decHome(): void {
    if (this.submitting()) return;
    this.homeScore.update((v) => Math.max(0, v - 1));
  }

  protected incAway(): void {
    if (this.submitting()) return;
    this.awayScore.update((v) => Math.min(MAX_SCORE, v + 1));
  }

  protected decAway(): void {
    if (this.submitting()) return;
    this.awayScore.update((v) => Math.max(0, v - 1));
  }

  protected onHomeInput(event: Event): void {
    this.homeScore.set(this._parseScore((event.target as HTMLInputElement).value));
  }

  protected onAwayInput(event: Event): void {
    this.awayScore.set(this._parseScore((event.target as HTMLInputElement).value));
  }

  protected onBackdropClick(): void {
    if (!this.submitting()) this.cancelled.emit();
  }

  protected onConfirm(): void {
    this.confirmed.emit({
      homeScore: this.homeScore(),
      awayScore: this.awayScore(),
    });
  }

  protected onRemove(): void {
    if (!this.submitting()) this.removeRequested.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open() && !this.submitting()) this.cancelled.emit();
  }

  private _parseScore(raw: string): number {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) return 0;
    return Math.min(MAX_SCORE, n);
  }
}
