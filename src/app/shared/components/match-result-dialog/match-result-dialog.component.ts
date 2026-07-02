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
import { NgTemplateOutlet } from '@angular/common';
import { TournamentPhaseType } from '@core/interfaces/enums';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { backdropFade, dialogFade } from '@shared/animations/animations';
import { ButtonComponent } from '@shared/components/button/button.component';
import { DraggableSheetDirective } from '@shared/directives/draggable-sheet.directive';
import { MarqueeDirective } from '@shared/directives/marquee.directive';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { LucideAngularModule, Minus, Plus } from 'lucide-angular';

export interface IMatchResultPayload {
  homeScore: number;
  awayScore: number;
  homeExtraTimeScore?: number | null;
  awayExtraTimeScore?: number | null;
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
    MarqueeDirective,
    NgTemplateOutlet,
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
  /** Ida-e-volta: sem prorrogação; o desempate vai direto aos pênaltis do agregado. */
  public readonly twoLegged = input<boolean>(false);
  public readonly submitting = input<boolean>(false);
  public readonly serverError = input<string | null>(null);

  public readonly confirmed = output<IMatchResultPayload>();
  public readonly cancelled = output<void>();

  protected readonly minusIcon = Minus;
  protected readonly plusIcon = Plus;

  protected readonly homeScore = signal(0);
  protected readonly awayScore = signal(0);
  protected readonly homeExtra = signal(0);
  protected readonly awayExtra = signal(0);
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

  /** Prorrogação: KO de jogo único cujo tempo normal terminou empatado. */
  protected readonly showExtraTime = computed(
    () => this.isKnockout() && !this.twoLegged() && this.aggregateTied(),
  );

  protected readonly extraTimeTied = computed(
    () => this.homeExtra() === this.awayExtra(),
  );

  /** Jogo único: os pênaltis são obrigatórios quando a prorrogação empata. */
  protected readonly showSingleLegPenalties = computed(
    () => this.showExtraTime() && this.extraTimeTied(),
  );

  /** Ida-e-volta: o organizador liga os pênaltis manualmente (agregado empatado). */
  protected readonly showTwoLeggedToggle = computed(
    () => this.isKnockout() && this.twoLegged(),
  );

  /** Há disputa de pênaltis a informar (jogo único auto, ou ida-e-volta ligada). */
  protected readonly penaltiesActive = computed(
    () =>
      this.showSingleLegPenalties() ||
      (this.showTwoLeggedToggle() && this.hasPenalties()),
  );

  protected readonly penaltyError = computed<string | null>(() => {
    if (!this.penaltiesActive()) return null;
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
        const home = m.homeScore ?? 0;
        const away = m.awayScore ?? 0;
        this.homeScore.set(home);
        this.awayScore.set(away);
        this.homeExtra.set(Math.max(home, m.homeExtraTimeScore ?? home));
        this.awayExtra.set(Math.max(away, m.awayExtraTimeScore ?? away));
        const hasPen =
          m.homePenalties !== null && m.awayPenalties !== null;
        this.hasPenalties.set(hasPen);
        this.homePen.set(m.homePenalties ?? 0);
        this.awayPen.set(m.awayPenalties ?? 0);
      }
    });
  }

  /** Prorrogação nunca abaixo do placar do 90' (placar cumulativo). */
  private _syncExtraTimeFloor(): void {
    this.homeExtra.update((v) => Math.max(v, this.homeScore()));
    this.awayExtra.update((v) => Math.max(v, this.awayScore()));
  }

  protected incExtraHome(): void {
    if (this.submitting()) return;
    this.homeExtra.update((v) => Math.min(MAX_SCORE, v + 1));
  }

  protected decExtraHome(): void {
    if (this.submitting()) return;
    this.homeExtra.update((v) => Math.max(this.homeScore(), v - 1));
  }

  protected incExtraAway(): void {
    if (this.submitting()) return;
    this.awayExtra.update((v) => Math.min(MAX_SCORE, v + 1));
  }

  protected decExtraAway(): void {
    if (this.submitting()) return;
    this.awayExtra.update((v) => Math.max(this.awayScore(), v - 1));
  }

  protected onExtraHomeInput(event: Event): void {
    const raw = this._parseScore((event.target as HTMLInputElement).value);
    this.homeExtra.set(Math.max(this.homeScore(), raw));
  }

  protected onExtraAwayInput(event: Event): void {
    const raw = this._parseScore((event.target as HTMLInputElement).value);
    this.awayExtra.set(Math.max(this.awayScore(), raw));
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
    const value = this._parseScore((event.target as HTMLInputElement).value);
    this.homeScore.set(value);
    this._syncExtraTimeFloor();
  }

  protected onAwayInput(event: Event): void {
    const value = this._parseScore((event.target as HTMLInputElement).value);
    this.awayScore.set(value);
    this._syncExtraTimeFloor();
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
    if (this.showExtraTime()) {
      payload.homeExtraTimeScore = this.homeExtra();
      payload.awayExtraTimeScore = this.awayExtra();
    } else {
      payload.homeExtraTimeScore = null;
      payload.awayExtraTimeScore = null;
    }
    if (this.penaltiesActive()) {
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
