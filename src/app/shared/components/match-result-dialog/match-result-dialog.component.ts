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
import { TournamentPhaseType } from '@core/interfaces/enums';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { backdropFade, dialogFade } from '@shared/animations/animations';
import { ButtonComponent } from '@shared/components/button/button.component';
import { DraggableSheetDirective } from '@shared/directives/draggable-sheet.directive';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { LucideAngularModule, Minus, Plus } from 'lucide-angular';

export interface IMatchResultPayload {
  homeScore: number;
  awayScore: number;
  homePenalties?: number | null;
  awayPenalties?: number | null;
}

const MAX_SCORE = 99;
const MAX_PEN = 30;

@Component({
  selector: 'app-match-result-dialog',
  standalone: true,
  imports: [
    ButtonComponent,
    TeamBadgeComponent,
    LucideAngularModule,
    DraggableSheetDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './match-result-dialog.component.html',
  styleUrl: './match-result-dialog.component.scss',
  animations: [dialogFade, backdropFade],
})
export class MatchResultDialogComponent {
  public readonly open = input<boolean>(false);
  public readonly match = input<IMatchResponse | null>(null);
  public readonly phaseType = input<TournamentPhaseType | null>(null);
  public readonly submitting = input<boolean>(false);
  public readonly serverError = input<string | null>(null);

  public readonly confirmed = output<IMatchResultPayload>();
  public readonly cancelled = output<void>();

  protected readonly minusIcon = Minus;
  protected readonly plusIcon = Plus;

  protected readonly homeScore = signal(0);
  protected readonly awayScore = signal(0);
  protected readonly hasPenalties = signal(false);
  protected readonly homePen = signal(0);
  protected readonly awayPen = signal(0);

  protected readonly title = computed(() =>
    this.match()?.status === 'COMPLETED' ? 'Editar resultado' : 'Lançar resultado',
  );

  protected readonly confirmLabel = computed(() =>
    this.match()?.status === 'COMPLETED' ? 'Salvar resultado' : 'Lançar resultado',
  );

  protected readonly isKnockout = computed(
    () => this.phaseType() === 'KNOCKOUT',
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

  protected readonly aggregateTied = computed(
    () => this.homeScore() === this.awayScore(),
  );

  protected readonly penaltyError = computed<string | null>(() => {
    if (!this.hasPenalties()) return null;
    if (this.homePen() === this.awayPen()) {
      return 'Pênaltis não podem terminar empatados.';
    }
    return null;
  });

  protected readonly canSubmit = computed(
    () => !this.submitting() && this.penaltyError() === null,
  );

  constructor() {
    effect(() => {
      const m = this.match();
      const isOpen = this.open();
      if (isOpen && m) {
        this.homeScore.set(m.homeScore ?? 0);
        this.awayScore.set(m.awayScore ?? 0);
        const hasPen =
          m.homePenalties !== null && m.awayPenalties !== null;
        this.hasPenalties.set(hasPen);
        this.homePen.set(m.homePenalties ?? 0);
        this.awayPen.set(m.awayPenalties ?? 0);
      }
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
    const value = this._parseScore((event.target as HTMLInputElement).value);
    this.homeScore.set(value);
  }

  protected onAwayInput(event: Event): void {
    const value = this._parseScore((event.target as HTMLInputElement).value);
    this.awayScore.set(value);
  }

  protected togglePenalties(): void {
    if (this.submitting()) return;
    this.hasPenalties.update((v) => !v);
    if (!this.hasPenalties()) {
      this.homePen.set(0);
      this.awayPen.set(0);
    }
  }

  protected incHomePen(): void {
    if (this.submitting()) return;
    this.homePen.update((v) => Math.min(MAX_PEN, v + 1));
  }

  protected decHomePen(): void {
    if (this.submitting()) return;
    this.homePen.update((v) => Math.max(0, v - 1));
  }

  protected incAwayPen(): void {
    if (this.submitting()) return;
    this.awayPen.update((v) => Math.min(MAX_PEN, v + 1));
  }

  protected decAwayPen(): void {
    if (this.submitting()) return;
    this.awayPen.update((v) => Math.max(0, v - 1));
  }

  protected onHomePenInput(event: Event): void {
    const value = this._parsePen((event.target as HTMLInputElement).value);
    this.homePen.set(value);
  }

  protected onAwayPenInput(event: Event): void {
    const value = this._parsePen((event.target as HTMLInputElement).value);
    this.awayPen.set(value);
  }

  protected onBackdropClick(): void {
    if (!this.submitting()) {
      this.cancelled.emit();
    }
  }

  protected onConfirm(): void {
    if (!this.canSubmit()) return;
    const payload: IMatchResultPayload = {
      homeScore: this.homeScore(),
      awayScore: this.awayScore(),
    };
    if (this.isKnockout() && this.hasPenalties()) {
      payload.homePenalties = this.homePen();
      payload.awayPenalties = this.awayPen();
    } else {
      payload.homePenalties = null;
      payload.awayPenalties = null;
    }
    this.confirmed.emit(payload);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open() && !this.submitting()) {
      this.cancelled.emit();
    }
  }

  private _parseScore(raw: string): number {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) return 0;
    return Math.min(MAX_SCORE, n);
  }

  private _parsePen(raw: string): number {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) return 0;
    return Math.min(MAX_PEN, n);
  }
}
