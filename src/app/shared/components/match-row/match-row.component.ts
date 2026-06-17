import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { IPredictionResponse } from '@core/interfaces/prediction.interface';
import {
  classifyPredictionOutcome,
  IPredictionScoring,
} from '@core/utils/prediction-outcome';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { ScoreDisplayPipe } from '@shared/pipes/score-display.pipe';
import { LucideAngularModule, Sparkles } from 'lucide-angular';

@Component({
  selector: 'app-match-row',
  standalone: true,
  imports: [TeamBadgeComponent, LucideAngularModule, ScoreDisplayPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './match-row.component.html',
  styleUrl: './match-row.component.scss',
})
export class MatchRowComponent {
  public readonly match = input.required<IMatchResponse>();
  public readonly myPrediction = input<IPredictionResponse | null>(null);
  public readonly isActiveMember = input<boolean>(false);
  public readonly tournamentInProgress = input<boolean>(false);
  /** Oculta a data, deixando só o horário — útil quando a lista já é agrupada por dia. */
  public readonly hideDate = input<boolean>(false);
  /** Pontuação vigente do torneio; colore o chip de pontos (exato/vencedor/erro). */
  public readonly scoring = input<IPredictionScoring | null>(null);

  /** Emitido ao clicar no chip "Palpitar" (sem navegar para a partida). */
  public readonly predictClick = output<IMatchResponse>();

  protected readonly sparklesIcon = Sparkles;

  protected onPredictClick(event: Event): void {
    // Impede que o clique borbulhe para o link da row (navegação).
    event.stopPropagation();
    event.preventDefault();
    this.predictClick.emit(this.match());
  }

  protected readonly dateLabel = computed<string | null>(() => {
    const iso = this.match().scheduledAt;
    if (!iso) return null;
    try {
      const d = new Date(iso);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day}.${month}.${year}.`;
    } catch {
      return iso;
    }
  });

  protected readonly statusBadge = computed(() => {
    const m = this.match();
    if (m.status === 'COMPLETED') return 'FT';
    if (m.status === 'CANCELLED') return 'CANC';
    if (!m.scheduledAt) return '—';
    try {
      const d = new Date(m.scheduledAt);
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${min}`;
    } catch {
      return '—';
    }
  });

  protected readonly statusKind = computed(() => {
    const m = this.match();
    if (m.status === 'COMPLETED') return 'done';
    if (m.status === 'CANCELLED') return 'cancelled';
    return 'scheduled';
  });

  protected readonly hasScore = computed(() => {
    const m = this.match();
    return (
      m.status !== 'CANCELLED' &&
      m.homeScore !== null &&
      m.awayScore !== null
    );
  });

  protected readonly winnerSide = computed<'home' | 'away' | 'draw' | null>(
    () => {
      const m = this.match();
      if (m.status !== 'COMPLETED') return null;
      if (m.homeScore === null || m.awayScore === null) return null;
      if (m.homeScore > m.awayScore) return 'home';
      if (m.awayScore > m.homeScore) return 'away';
      if (m.homePenalties !== null && m.awayPenalties !== null) {
        if (m.homePenalties > m.awayPenalties) return 'home';
        if (m.awayPenalties > m.homePenalties) return 'away';
      }
      return 'draw';
    },
  );

  protected readonly hasPenalties = computed(() => {
    const m = this.match();
    return m.homePenalties !== null && m.awayPenalties !== null;
  });

  protected readonly chip = computed<{
    label: string;
    kind:
      | 'pending'
      | 'done'
      | 'pts'
      | 'pts-zero'
      | 'pts-winner'
      | 'pts-wrong'
      | 'locked'
      | 'idle';
  } | null>(() => {
    if (!this.isActiveMember()) return null;
    const m = this.match();
    if (m.status === 'CANCELLED') return null;

    const mine = this.myPrediction();
    if (mine && m.status === 'COMPLETED') {
      const outcome = classifyPredictionOutcome(mine.points, this.scoring());
      // Sem `scoring`: cai no comportamento antigo (verde p/ pontos > 0, cinza p/ 0).
      let kind: 'pts' | 'pts-zero' | 'pts-winner' | 'pts-wrong' =
        mine.points > 0 ? 'pts' : 'pts-zero';
      if (outcome === 'winner') kind = 'pts-winner';
      else if (outcome === 'wrong') kind = 'pts-wrong';
      else if (outcome === 'exact') kind = 'pts';
      return { label: `+${mine.points}`, kind };
    }
    if (mine) {
      return { label: `${mine.homeScore}×${mine.awayScore}`, kind: 'done' };
    }

    if (!this.tournamentInProgress()) return null;
    if (m.status !== 'SCHEDULED') return null;
    if (m.scheduledAt) {
      const t = new Date(m.scheduledAt).getTime();
      if (Number.isNaN(t)) return null;
      if (t <= Date.now()) return { label: 'Sem pitaco', kind: 'locked' };
      return { label: 'Palpitar', kind: 'pending' };
    }
    return { label: 'Palpitar', kind: 'pending' };
  });
}
