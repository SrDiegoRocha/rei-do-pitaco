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
import {
  backdropFade,
  collapseSection,
  dialogFade,
  scorePulse,
} from '@shared/animations/animations';
import { ButtonComponent } from '@shared/components/button/button.component';
import { DraggableSheetDirective } from '@shared/directives/draggable-sheet.directive';
import { MarqueeDirective } from '@shared/directives/marquee.directive';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { LucideAngularModule, Minus, Plus } from 'lucide-angular';

export interface IPredictionPayload {
  homeScore: number;
  awayScore: number;
  /** Placar da prorrogação (cumulativo); enviado só em empate no 90' de KO jogo único. */
  homeExtraTimeScore?: number | null;
  awayExtraTimeScore?: number | null;
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
  animations: [dialogFade, backdropFade, collapseSection, scorePulse],
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
  protected readonly homeExtraTimeScore = signal(0);
  protected readonly awayExtraTimeScore = signal(0);
  protected readonly penaltyWinner = signal<PenaltyWinner | null>(null);

  /**
   * KO de jogo único: elegível a pênaltis mas fora do modo ida-e-volta. Só
   * nesse caso existe prorrogação (no ida-e-volta o desempate vai direto aos
   * pênaltis do agregado).
   */
  protected readonly extraTimeEligible = computed(
    () => this.penaltyEligible() && !this.penaltyTwoLegged(),
  );

  /** Empate no tempo normal (jogo único) — abre o palpite de prorrogação. */
  protected readonly regularDraw = computed(
    () => this.homeScore() === this.awayScore(),
  );

  /** Mostra os campos de prorrogação: KO jogo único com 90' empatado. */
  protected readonly showExtraTime = computed(
    () => this.extraTimeEligible() && this.regularDraw(),
  );

  /** Empate palpitado na prorrogação — leva aos pênaltis. */
  protected readonly extraTimeDraw = computed(
    () => this.homeExtraTimeScore() === this.awayExtraTimeScore(),
  );

  /**
   * Empate que vai aos pênaltis. Em KO jogo único é preciso empatar no 90' e na
   * prorrogação; em ida-e-volta basta o agregado (pernas anteriores + palpite)
   * empatar. Comanda a exibição do seletor "quem avança".
   */
  protected readonly showPenalty = computed(() => {
    if (this.extraTimeEligible()) {
      return this.showExtraTime() && this.extraTimeDraw();
    }
    return (
      this.penaltyEligible() &&
      this.aggregateBeforeHome() + this.homeScore() ===
        this.aggregateBeforeAway() + this.awayScore()
    );
  });

  /** Texto do bloco de pênaltis conforme a origem do empate. */
  protected readonly penaltyPromptLabel = computed(() => {
    if (this.extraTimeEligible()) return 'Empate na prorrogação';
    return this.penaltyTwoLegged()
      ? 'Empate no agregado'
      : 'Empate no tempo normal';
  });

  /** Bloqueia o envio enquanto o empate em pênaltis não tiver um escolhido. */
  protected readonly canConfirm = computed(
    () => !(this.showPenalty() && this.penaltyWinner() === null),
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
      const home = c?.homeScore ?? 0;
      const away = c?.awayScore ?? 0;
      this.homeScore.set(home);
      this.awayScore.set(away);
      // Prorrogação é cumulativa: nunca menor que o placar do 90'. Reaproveita o
      // palpite salvo quando houver; senão parte do próprio placar do 90'.
      this.homeExtraTimeScore.set(Math.max(home, c?.homeExtraTimeScore ?? home));
      this.awayExtraTimeScore.set(Math.max(away, c?.awayExtraTimeScore ?? away));
      this.penaltyWinner.set(c?.penaltyWinner ?? null);
    });
  }

  /** Prorrogação nunca abaixo do placar do 90' (placar cumulativo). */
  private _syncExtraTimeFloor(): void {
    this.homeExtraTimeScore.update((v) => Math.max(v, this.homeScore()));
    this.awayExtraTimeScore.update((v) => Math.max(v, this.awayScore()));
  }

  protected selectPenaltyWinner(side: PenaltyWinner): void {
    if (this.submitting()) return;
    this.penaltyWinner.set(side);
  }

  protected incHome(): void {
    if (this.submitting()) return;
    this.homeScore.update((v) => Math.min(MAX_SCORE, v + 1));
    this._syncExtraTimeFloor();
  }

  protected decHome(): void {
    if (this.submitting()) return;
    this.homeScore.update((v) => Math.max(0, v - 1));
  }

  protected incAway(): void {
    if (this.submitting()) return;
    this.awayScore.update((v) => Math.min(MAX_SCORE, v + 1));
    this._syncExtraTimeFloor();
  }

  protected decAway(): void {
    if (this.submitting()) return;
    this.awayScore.update((v) => Math.max(0, v - 1));
  }

  protected onHomeInput(event: Event): void {
    this.homeScore.set(this._parseScore((event.target as HTMLInputElement).value));
    this._syncExtraTimeFloor();
  }

  protected onAwayInput(event: Event): void {
    this.awayScore.set(this._parseScore((event.target as HTMLInputElement).value));
    this._syncExtraTimeFloor();
  }

  protected incExtraHome(): void {
    if (this.submitting()) return;
    this.homeExtraTimeScore.update((v) => Math.min(MAX_SCORE, v + 1));
  }

  protected decExtraHome(): void {
    if (this.submitting()) return;
    this.homeExtraTimeScore.update((v) => Math.max(this.homeScore(), v - 1));
  }

  protected incExtraAway(): void {
    if (this.submitting()) return;
    this.awayExtraTimeScore.update((v) => Math.min(MAX_SCORE, v + 1));
  }

  protected decExtraAway(): void {
    if (this.submitting()) return;
    this.awayExtraTimeScore.update((v) => Math.max(this.awayScore(), v - 1));
  }

  protected onExtraHomeInput(event: Event): void {
    const raw = this._parseScore((event.target as HTMLInputElement).value);
    this.homeExtraTimeScore.set(Math.max(this.homeScore(), raw));
  }

  protected onExtraAwayInput(event: Event): void {
    const raw = this._parseScore((event.target as HTMLInputElement).value);
    this.awayExtraTimeScore.set(Math.max(this.awayScore(), raw));
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
    // Prorrogação só quando o 90' empatou em KO jogo único (a API rejeita fora disso).
    if (this.showExtraTime()) {
      payload.homeExtraTimeScore = this.homeExtraTimeScore();
      payload.awayExtraTimeScore = this.awayExtraTimeScore();
    }
    // Só envia penaltyWinner num empate elegível (a API rejeita fora disso).
    if (this.showPenalty() && this.penaltyWinner() !== null) {
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
