import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IBracketResponse,
  IBracketRound,
  IBracketTie,
} from '@core/interfaces/bracket.interface';
import { ITeamRef } from '@core/interfaces/match.interface';
import { knockoutRoundLabel } from '@core/utils/round-label';
import { BracketTreeComponent } from '@shared/components/bracket-tree/bracket-tree.component';
import {
  bracketResponseToTree,
  IBracketTreeData,
} from '@shared/components/bracket-tree/bracket-tree.model';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import {
  formatScoreDisplay,
  ScoreDisplayPipe,
} from '@shared/pipes/score-display.pipe';
import {
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
  imports: [
    RouterLink,
    LucideAngularModule,
    TeamBadgeComponent,
    ScoreDisplayPipe,
    BracketTreeComponent,
  ],
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

  /** Emite o id da partida ao clicar num confronto (para o pai lembrar o retorno). */
  public readonly matchOpen = output<string>();

  protected readonly trophyIcon = Trophy;
  protected readonly crownIcon = Crown;
  protected readonly medalIcon = Medal;
  protected readonly calendarIcon = Calendar;

  protected readonly rounds = computed(() => this.bracket()?.rounds ?? []);

  /**
   * Árvore espelhada (modo "tree"). `null` quando o bracket não tem formato
   * de árvore (manual/antigo) — aí o fallback é a listagem em cards.
   */
  protected readonly treeData = computed<IBracketTreeData | null>(() => {
    const b = this.bracket();
    return b ? bracketResponseToTree(b) : null;
  });

  protected onTreeOpen(matchId: string): void {
    this.matchOpen.emit(matchId);
  }

  /** Total de times da fase = confrontos da maior rodada × 2 (potência de 2). */
  protected readonly teamCount = computed(() => {
    const rs = this.rounds();
    if (rs.length === 0) return 0;
    const maxTies = Math.max(...rs.map((r) => this.mainTies(r).length));
    return maxTies * 2;
  });

  /** Nome amigável da etapa (Oitavas, Quartas, Semifinais, Final...). */
  protected roundName(round: IBracketRound): string {
    const tc = this.teamCount();
    return tc > 0 ? knockoutRoundLabel(round.round, tc) : round.name;
  }

  protected mainTies(round: IBracketRound): IBracketTie[] {
    return round.ties.filter((t) => !t.thirdPlace);
  }

  /** Houve resultado lançado? (pelo menos uma perna concluída) */
  protected hasResult(tie: IBracketTie): boolean {
    return tie.legs.some((l) => l.status === 'COMPLETED');
  }

  /** Placar agregado ou "-" quando ainda não jogou. */
  protected scoreText(tie: IBracketTie, side: 'home' | 'away'): string {
    if (!this.hasResult(tie)) return '-';
    return formatScoreDisplay(
      side === 'home' ? tie.homeAggregate : tie.awayAggregate,
    );
  }

  /** O time desse lado perdeu o confronto? (para apagar levemente) */
  protected isLoser(tie: IBracketTie, team: ITeamRef | null): boolean {
    return !!tie.winner && !!team && tie.winner.id !== team.id;
  }

  /** Partida a abrir ao clicar no card (primeira perna). */
  protected tieMatchId(tie: IBracketTie): string | null {
    return tie.legs[0]?.id ?? null;
  }

  protected tieLink(tie: IBracketTie): string | null {
    const id = this.tieMatchId(tie);
    return id ? this.matchHref(id) : null;
  }

  protected tieAnchorId(tie: IBracketTie): string | null {
    const id = this.tieMatchId(tie);
    return id ? `match-${id}` : null;
  }

  protected onTieOpen(tie: IBracketTie): void {
    const id = this.tieMatchId(tie);
    if (id) this.matchOpen.emit(id);
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
