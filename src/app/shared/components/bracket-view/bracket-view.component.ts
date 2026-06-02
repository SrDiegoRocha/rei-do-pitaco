import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IBracketResponse,
  IBracketRound,
  IBracketTie,
} from '@core/interfaces/bracket.interface';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import {
  Award,
  Calendar,
  Crown,
  LucideAngularModule,
  Medal,
  Trophy,
} from 'lucide-angular';

export type BracketViewMode = 'tree' | 'cards';

@Component({
  selector: 'app-bracket-view',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bracket-view.component.html',
  styleUrl: './bracket-view.component.scss',
})
export class BracketViewComponent {
  public readonly bracket = input<IBracketResponse | null>(null);
  public readonly mode = input<BracketViewMode>('cards');
  public readonly tournamentId = input<string | null>(null);
  public readonly phaseId = input<string | null>(null);
  public readonly showLegs = input<boolean>(true);

  protected readonly trophyIcon = Trophy;
  protected readonly crownIcon = Crown;
  protected readonly medalIcon = Medal;
  protected readonly awardIcon = Award;
  protected readonly calendarIcon = Calendar;

  protected readonly rounds = computed(() => this.bracket()?.rounds ?? []);

  protected mainTies(round: IBracketRound): IBracketTie[] {
    return round.ties.filter((t) => !t.thirdPlace);
  }

  protected thirdPlaceTie(round: IBracketRound): IBracketTie | null {
    return round.ties.find((t) => t.thirdPlace) ?? null;
  }

  protected matchHref(matchId: string): string | null {
    const tid = this.tournamentId();
    const pid = this.phaseId();
    return tid && pid
      ? `/tournaments/${tid}/phases/${pid}/matches/${matchId}`
      : null;
  }

  protected legLabel(index: number, total: number): string {
    if (total <= 1) return 'Jogo único';
    if (index === 0) return 'Ida';
    if (index === total - 1) return 'Volta';
    return `Jogo ${index + 1}`;
  }

  protected formatDate(iso: string | null): string | null {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }
}
