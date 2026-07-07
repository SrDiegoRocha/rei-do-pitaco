import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import {
  FormOutcome,
  IFormStreak,
  IHeadToHeadMatch,
  IMatchAnalysisResponse,
  ITeamFormMatch,
  ITeamFormSummary,
  ITeamPredictorStats,
  ITeamStandingContext,
} from '@core/interfaces/match-analysis.interface';
import { ITeamRef } from '@core/interfaces/match.interface';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { ScoreDisplayPipe } from '@shared/pipes/score-display.pipe';
import {
  ArrowLeftRight,
  Flame,
  Goal,
  History,
  LucideAngularModule,
  Scale,
  Swords,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-angular';

/** Ordinal posicional 1-indexed → "3º". */
function ordinal(position: number): string {
  return `${position}º`;
}

/** Número com uma casa decimal, pt-BR ("1,8"). */
function fmt1(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** Uma linha do comparativo "quem chega melhor". */
export interface ICompareMetric {
  key: string;
  label: string;
  homeLabel: string;
  awayLabel: string;
  /** Largura 0–100 da barra do mandante (proporcional à "vantagem"). */
  homePct: number;
  homeLead: boolean;
  awayLead: boolean;
}

@Component({
  selector: 'app-match-analysis',
  standalone: true,
  imports: [
    TeamBadgeComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ScoreDisplayPipe,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './match-analysis.component.html',
  styleUrl: './match-analysis.component.scss',
})
export class MatchAnalysisComponent {
  /** Dados do retrospecto; `null` enquanto carrega ou em erro. */
  public readonly analysis = input<IMatchAnalysisResponse | null>(null);
  public readonly loading = input<boolean>(false);
  public readonly error = input<unknown>(null);
  /** Times da partida — usados no cabeçalho enquanto o retrospecto carrega. */
  public readonly homeTeam = input<ITeamRef | null>(null);
  public readonly awayTeam = input<ITeamRef | null>(null);

  /** Pedido de recarregar o retrospecto (botão de erro). */
  public readonly retry = output<void>();

  protected readonly historyIcon = History;
  protected readonly swordsIcon = Swords;
  protected readonly trendingIcon = TrendingUp;
  protected readonly flameIcon = Flame;
  protected readonly vsIcon = ArrowLeftRight;
  protected readonly scaleIcon = Scale;
  protected readonly goalIcon = Goal;
  protected readonly timerIcon = Timer;
  protected readonly targetIcon = Target;

  protected readonly home = computed(() => this.analysis()?.home ?? null);
  protected readonly away = computed(() => this.analysis()?.away ?? null);
  protected readonly h2h = computed(() => this.analysis()?.headToHead ?? null);

  /** Gols esperados na partida (projeção pela forma); `null` quando indisponível. */
  protected readonly expectedGoals = computed(
    () => this.analysis()?.expectedGoals ?? null,
  );

  /** Rótulo do placar esperado, ex.: "1,8". */
  protected xgLabel(value: number): string {
    return fmt1(value);
  }

  protected readonly recentWindow = computed(
    () => this.analysis()?.recentWindow ?? 10,
  );

  /** Há algum contexto posicional a mostrar (pelo menos um dos times). */
  protected readonly hasStandingContext = computed(() => {
    const a = this.analysis();
    return !!a && (a.home.standing !== null || a.away.standing !== null);
  });

  /** Título da seção de contexto, conforme o tipo de contexto exibido. */
  protected readonly standingSectionTitle = computed(() => {
    const ctx = this.home()?.standing ?? this.away()?.standing;
    if (!ctx) return 'Situação na competição';
    switch (ctx.kind) {
      case 'ROUND_ROBIN':
        return 'Posição na tabela';
      case 'GROUP':
        return 'Posição nos grupos';
      case 'PREVIOUS_PHASE':
        return `Como chegaram (${ctx.phaseName})`;
      default:
        return 'Situação na competição';
    }
  });

  protected readonly h2hEmpty = computed(() => {
    const h = this.h2h();
    return !h || h.totalMeetings <= 0;
  });

  /** Média de gols por confronto direto (vem do backend). */
  protected readonly h2hAvgGoals = computed<string | null>(() => {
    const avg = this.h2h()?.averageGoals;
    return avg === null || avg === undefined ? null : fmt1(avg);
  });

  /** Mostra o card de palpiteiros quando ao menos um time tem jogos avaliados. */
  protected readonly showPredictors = computed(() => {
    const h = this.home();
    const a = this.away();
    return (
      (!!h && h.predictors.ratedMatches > 0) ||
      (!!a && a.predictors.ratedMatches > 0)
    );
  });

  /** Só mostra o comparativo quando os dois times têm jogos na janela. */
  protected readonly showCompare = computed(() => {
    const h = this.home();
    const a = this.away();
    return !!h && !!a && h.stats.played > 0 && a.stats.played > 0;
  });

  /** Linhas do comparativo "quem chega melhor" (tudo derivado das stats). */
  protected readonly compareMetrics = computed<ICompareMetric[]>(() => {
    const h = this.home();
    const a = this.away();
    if (!h || !a) return [];
    return [
      this._metric(
        'perf',
        'Aproveitamento',
        h.stats.performancePct ?? 0,
        a.stats.performancePct ?? 0,
        false,
        (v) => `${Math.round(v)}%`,
      ),
      this._metric(
        'gf',
        'Gols marcados/jogo',
        this._avg(h.stats.goalsFor, h.stats.played),
        this._avg(a.stats.goalsFor, a.stats.played),
        false,
        fmt1,
      ),
      this._metric(
        'ga',
        'Gols sofridos/jogo',
        this._avg(h.stats.goalsAgainst, h.stats.played),
        this._avg(a.stats.goalsAgainst, a.stats.played),
        true,
        fmt1,
      ),
    ];
  });

  private _avg(total: number, played: number): number {
    return played > 0 ? total / played : 0;
  }

  /**
   * Monta uma linha do comparativo. A barra representa "vantagem": para
   * métricas onde menor é melhor (gols sofridos), invertemos os pesos para que
   * a barra maior seja sempre a do time que chega melhor.
   */
  private _metric(
    key: string,
    label: string,
    homeVal: number,
    awayVal: number,
    lowerIsBetter: boolean,
    fmt: (v: number) => string,
  ): ICompareMetric {
    const goodHome = lowerIsBetter ? awayVal : homeVal;
    const goodAway = lowerIsBetter ? homeVal : awayVal;
    const total = goodHome + goodAway;
    const homePct = total > 0 ? Math.round((goodHome / total) * 100) : 50;
    return {
      key,
      label,
      homeLabel: fmt(homeVal),
      awayLabel: fmt(awayVal),
      homePct,
      homeLead: total > 0 && goodHome > goodAway,
      awayLead: total > 0 && goodAway > goodHome,
    };
  }

  /** "60%" a partir de uma taxa 0–100; "—" quando `null`. */
  protected ratePct(value: number | null): string {
    return value === null || value === undefined ? '—' : `${Math.round(value)}%`;
  }

  /** Média de pontos por pitaco formatada; "—" quando `null`. */
  protected avgPointsLabel(value: number | null): string {
    return value === null || value === undefined ? '—' : fmt1(value);
  }

  /** Texto do "fator surpresa" conforme a taxa de zebra. */
  protected upsetLabel(p: ITeamPredictorStats): string {
    if (p.upsetRate === null) return '—';
    return `${Math.round(p.upsetRate)}%`;
  }

  // ── Rótulos e helpers de exibição ────────────────────────────────────

  protected teamColor(team: ITeamRef | null | undefined): string {
    return team?.primaryColor || '#10B981';
  }

  protected positionLabel(ctx: ITeamStandingContext): string {
    return ordinal(ctx.position);
  }

  /** Legenda abaixo da posição: grupo, "de N times" ou nome da fase. */
  protected positionCaption(ctx: ITeamStandingContext): string {
    if (ctx.kind === 'GROUP' && ctx.groupName) {
      return `Grupo ${ctx.groupName} · de ${ctx.totalTeams}`;
    }
    if (ctx.kind === 'PREVIOUS_PHASE') {
      return `Classificação final · de ${ctx.totalTeams}`;
    }
    return `de ${ctx.totalTeams} times`;
  }

  /** Letra pt-BR para o resultado (V/E/D). */
  protected outcomeLetter(outcome: FormOutcome): string {
    if (outcome === 'W') return 'V';
    if (outcome === 'L') return 'D';
    return 'E';
  }

  protected outcomeClass(outcome: FormOutcome): string {
    if (outcome === 'W') return 'dot--win';
    if (outcome === 'L') return 'dot--loss';
    return 'dot--draw';
  }

  protected outcomeTitle(m: ITeamFormMatch): string {
    const place = m.playedHome ? 'em casa' : 'fora';
    const opp = m.opponent.shortName ?? m.opponent.name;
    const base = `${m.goalsFor}×${m.goalsAgainst} vs ${opp} (${place})`;
    if (m.advanced !== null) {
      return `${base} · ${m.advanced ? 'avançou' : 'eliminado'} nos pênaltis`;
    }
    return base;
  }

  /** Média com uma casa decimal (ex.: "1.8"), pt-BR. */
  protected average(total: number, played: number): string {
    if (played <= 0) return '—';
    return (total / played).toFixed(1).replace('.', ',');
  }

  protected streakLabel(streak: IFormStreak | null): string | null {
    if (!streak || streak.count <= 0) return null;
    const n = streak.count;
    const plural = n > 1;
    switch (streak.type) {
      case 'WIN':
        return `${n} ${plural ? 'vitórias seguidas' : 'vitória'}`;
      case 'LOSS':
        return `${n} ${plural ? 'derrotas seguidas' : 'derrota'}`;
      case 'DRAW':
        return `${n} ${plural ? 'empates seguidos' : 'empate'}`;
      case 'UNBEATEN':
        return `${n} ${plural ? 'jogos invicto' : 'jogo invicto'}`;
      case 'WINLESS':
        return `${n} ${plural ? 'jogos sem vencer' : 'jogo sem vencer'}`;
      default:
        return null;
    }
  }

  protected streakClass(streak: IFormStreak | null): string {
    if (!streak) return '';
    if (streak.type === 'WIN' || streak.type === 'UNBEATEN')
      return 'streak--good';
    if (streak.type === 'LOSS' || streak.type === 'WINLESS')
      return 'streak--bad';
    return 'streak--neutral';
  }

  protected performanceLabel(summary: ITeamFormSummary | null): string {
    const pct = summary?.stats.performancePct;
    return pct === null || pct === undefined ? '—' : `${pct}%`;
  }

  /** Data curta (dd/MM) de um jogo do histórico. */
  protected shortDate(iso: string | null): string {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  }

  /** Placar de um confronto direto, com dica de pênaltis quando houver. */
  protected h2hPenaltyLabel(m: IHeadToHeadMatch): string | null {
    if (m.penaltyHomeGoals === null || m.penaltyAwayGoals === null) return null;
    return `pên. ${m.penaltyHomeGoals}×${m.penaltyAwayGoals}`;
  }

  /** Porcentagem de uma parcela sobre o total de confrontos (para a barra). */
  protected h2hPct(part: number): number {
    const h = this.h2h();
    if (!h || h.totalMeetings <= 0) return 0;
    return Math.round((part / h.totalMeetings) * 100);
  }

  protected onRetry(): void {
    this.retry.emit();
  }
}
