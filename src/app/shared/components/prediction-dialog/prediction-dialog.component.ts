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
import {
  IPredictionResponse,
  PenaltyWinner,
} from '@core/interfaces/prediction.interface';
import { backdropFade, dialogFade } from '@shared/animations/animations';
import { ButtonComponent } from '@shared/components/button/button.component';
import { DraggableSheetDirective } from '@shared/directives/draggable-sheet.directive';
import { MarqueeDirective } from '@shared/directives/marquee.directive';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { LucideAngularModule, Minus, Plus } from 'lucide-angular';

export interface IPredictionPayload {
  homeScore: number;
  awayScore: number;
  penaltyWinner?: PenaltyWinner;
}

const MAX_SCORE = 99;

@Component({
  selector: 'app-prediction-dialog',
  standalone: true,
  imports: [
    ButtonComponent,
    TeamBadgeComponent,
    LucideAngularModule,
    DraggableSheetDirective,
    MarqueeDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prediction-dialog.component.html',
  styleUrl: './prediction-dialog.component.scss',
  animations: [dialogFade, backdropFade],
})
export class PredictionDialogComponent {
  public readonly open = input<boolean>(false);
  public readonly match = input<IMatchResponse | null>(null);
  public readonly current = input<IPredictionResponse | null>(null);
  public readonly submitting = input<boolean>(false);
  public readonly serverError = input<string | null>(null);
  /** Mostra a ação "Remover pitaco" (só faz sentido com `current` setado). */
  public readonly canRemove = input<boolean>(false);
  /** Confronto pode ir aos pênaltis (jogo único KO ou perna de volta). */
  public readonly penaltyEligible = input<boolean>(false);
  /** Gols já marcados nas pernas anteriores (ida-e-volta); 0 em jogo único. */
  public readonly aggregateBeforeHome = input<number>(0);
  public readonly aggregateBeforeAway = input<number>(0);
  /** Ida-e-volta: muda o texto para "no agregado" em vez de "no tempo normal". */
  public readonly penaltyTwoLegged = input<boolean>(false);

  public readonly confirmed = output<IPredictionPayload>();
  public readonly cancelled = output<void>();
  public readonly removeRequested = output<void>();

  protected readonly minusIcon = Minus;
  protected readonly plusIcon = Plus;

  protected readonly homeScore = signal(0);
  protected readonly awayScore = signal(0);
  protected readonly penaltyWinner = signal<PenaltyWinner | null>(null);

  /**
   * Empate que vai aos pênaltis: jogo elegível + placar agregado empatado.
   * Em jogo único o agregado é 0/0, então reduz a "placar palpitado empatado".
   */
  protected readonly isPenaltyDraw = computed(
    () =>
      this.penaltyEligible() &&
      this.aggregateBeforeHome() + this.homeScore() ===
        this.aggregateBeforeAway() + this.awayScore(),
  );

  /** Bloqueia o envio enquanto o empate em pênaltis não tiver um escolhido. */
  protected readonly canConfirm = computed(
    () => !(this.isPenaltyDraw() && this.penaltyWinner() === null),
  );

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
      this.penaltyWinner.set(c?.penaltyWinner ?? null);
    });
  }

  protected selectPenaltyWinner(side: PenaltyWinner): void {
    if (this.submitting()) return;
    this.penaltyWinner.set(side);
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
    if (!this.canConfirm()) return;
    const payload: IPredictionPayload = {
      homeScore: this.homeScore(),
      awayScore: this.awayScore(),
    };
    // Só envia penaltyWinner num empate elegível (a API rejeita fora disso).
    if (this.isPenaltyDraw() && this.penaltyWinner() !== null) {
      payload.penaltyWinner = this.penaltyWinner()!;
    }
    this.confirmed.emit(payload);
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
