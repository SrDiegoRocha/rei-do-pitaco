import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { IPredictionResponse } from '@core/interfaces/prediction.interface';
import {
  classifyScorePair,
  IPredictionScoring,
  PredictionOutcome,
} from '@core/utils/prediction-outcome';
import { matchDisplayScore, matchWinnerSide } from '@core/utils/match-score';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { ScoreDisplayPipe } from '@shared/pipes/score-display.pipe';

type CardStatus = 'done' | 'cancelled' | 'scheduled';

@Component({
  selector: 'app-prediction-card',
  standalone: true,
  imports: [RouterLink, TeamBadgeComponent, ScoreDisplayPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prediction-card.component.html',
  styleUrl: './prediction-card.component.scss',
})
export class PredictionCardComponent {
  public readonly match = input.required<IMatchResponse>();
  public readonly prediction = input<IPredictionResponse | null>(null);
  public readonly tournamentId = input<string | null>(null);
  /** Rótulo de contexto (ex.: nome da fase). Se ausente, deriva grupo/rodada. */
  public readonly context = input<string | null>(null);
  /** Pontuação vigente do torneio; colore o badge (exato/vencedor/erro). */
  public readonly scoring = input<IPredictionScoring | null>(null);

  protected readonly link = computed<unknown[] | null>(() => {
    const tid = this.tournamentId();
    const m = this.match();
    if (!tid) return null;
    return ['/tournaments', tid, 'phases', m.phaseId, 'matches', m.id];
  });

  protected readonly contextLabel = computed(() => {
    const explicit = this.context();
    if (explicit) return explicit;
    const m = this.match();
    if (m.groupName) return `Grupo ${m.groupName}`;
    return `Rodada ${m.round}`;
  });

  protected readonly hasGuess = computed(() => {
    const p = this.prediction();
    return !!p && p.homeScore !== null && p.awayScore !== null;
  });

  /** Quem o palpiteiro acha que avança nos pênaltis (nome do time), ou null. */
  protected readonly penaltyPickName = computed<string | null>(() => {
    const p = this.prediction();
    if (!p || !p.penaltyWinner) return null;
    const m = this.match();
    const team = p.penaltyWinner === 'HOME' ? m.homeTeam : m.awayTeam;
    return team.shortName ?? team.name;
  });

  /** Placar palpitado da prorrogação (ex.: "2 × 2"), ou null se não palpitou. */
  protected readonly extraTimeGuess = computed<string | null>(() => {
    const p = this.prediction();
    if (!p || p.homeExtraTimeScore === null || p.awayExtraTimeScore === null) {
      return null;
    }
    return `${p.homeExtraTimeScore} × ${p.awayExtraTimeScore}`;
  });

  protected readonly resultRevealed = computed(() => {
    const m = this.match();
    return (
      m.status === 'COMPLETED' &&
      m.homeScore !== null &&
      m.awayScore !== null
    );
  });

  protected readonly statusKind = computed<CardStatus>(() => {
    const m = this.match();
    if (m.status === 'COMPLETED') return 'done';
    if (m.status === 'CANCELLED') return 'cancelled';
    return 'scheduled';
  });

  protected readonly points = computed<number | null>(() => {
    const p = this.prediction();
    if (!this.resultRevealed() || !p || p.points === null) return null;
    return p.points;
  });

  /**
   * Faixa do palpite (exato/vencedor/erro) para colorir o badge, pelo placar do
   * tempo normal — o `points` virou soma de blocos e não identifica mais a faixa.
   */
  protected readonly outcome = computed<PredictionOutcome | null>(() => {
    if (!this.resultRevealed()) return null;
    const p = this.prediction();
    if (!p) return null;
    const m = this.match();
    return classifyScorePair(p.homeScore, p.awayScore, m.homeScore, m.awayScore);
  });

  protected readonly dateLabel = computed(() => {
    const iso = this.match().scheduledAt;
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

  /** Lado perdedor pelo resultado real (para apagar levemente). */
  protected readonly loserSide = computed<'home' | 'away' | null>(() => {
    if (!this.resultRevealed()) return null;
    const winner = matchWinnerSide(this.match());
    if (winner === 'home') return 'away';
    if (winner === 'away') return 'home';
    return null;
  });

  /** Placar real exibido: prorrogação quando houve, senão o do tempo normal. */
  protected readonly displayScore = computed(() =>
    matchDisplayScore(this.match()),
  );
}
