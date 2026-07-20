import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { MatchStatus } from '@core/interfaces/enums';
import { IMatchResponse, ITeamRef } from '@core/interfaces/match.interface';
import { IMatchAnalysisResponse } from '@core/interfaces/match-analysis.interface';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import {
  IPredictionResponse,
  IPredictionStatsResponse,
} from '@core/interfaces/prediction.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { MatchesService } from '@core/services/matches.service';
import { MatchAnalysisService } from '@core/services/match-analysis.service';
import { PhasesService } from '@core/services/phases.service';
import { PredictionsService } from '@core/services/predictions.service';
import { TournamentMembersService } from '@core/services/tournament-members.service';
import { TournamentReturnService } from '@core/services/tournament-return.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { ITournamentMemberResponse } from '@core/interfaces/tournament-member.interface';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import {
  IMatchResultPayload,
  MatchResultDialogComponent,
} from '@shared/components/match-result-dialog/match-result-dialog.component';
import {
  IPredictionPayload,
  PredictionDialogComponent,
} from '@shared/components/prediction-dialog/prediction-dialog.component';
import { MarqueeDirective } from '@shared/directives/marquee.directive';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { MatchAnalysisComponent } from './match-analysis/match-analysis.component';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { ScoreDisplayPipe } from '@shared/pipes/score-display.pipe';
import { SwipeNavRegistry } from '@shared/services/swipe-nav-registry.service';
import { tabSlide } from '@shared/animations/animations';
import { ThemeService } from '@shared/services/theme.service';
import { ToastService } from '@shared/services/toast.service';
import { readableAccent } from '@core/utils/color-contrast';
import {
  buildPointsBreakdown,
  classifyScorePair,
  PredictionOutcome,
} from '@core/utils/prediction-outcome';
import { knockoutRoundLabel } from '@core/utils/round-label';
import { matchDisplayScore, matchWinnerSide } from '@core/utils/match-score';
import {
  ArrowLeftRight,
  Ban,
  CalendarDays,
  ChevronRight,
  Hash,
  History,
  LucideAngularModule,
  Pencil,
  Share2,
  Sparkles,
  Trash2,
  Trophy,
  Users,
} from 'lucide-angular';

const STATUS_TEXT: Record<MatchStatus, string> = {
  SCHEDULED: 'Agendada',
  COMPLETED: 'Encerrada',
  CANCELLED: 'Cancelada',
};

type MatchTab = 'predictions' | 'analysis' | 'info';

@Component({
  selector: 'app-match-detail',
  standalone: true,
  imports: [
    RouterLink,
    NgTemplateOutlet,
    LucideAngularModule,
    TeamBadgeComponent,
    AvatarComponent,
    ButtonComponent,
    MatchResultDialogComponent,
    PredictionDialogComponent,
    ConfirmDialogComponent,
    MarqueeDirective,
    PageHeaderComponent,
    MatchAnalysisComponent,
    ScoreDisplayPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './match-detail.component.html',
  styleUrl: './match-detail.component.scss',
  animations: [tabSlide],
})
export class MatchDetailComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _matchesService = inject(MatchesService);
  private readonly _analysisService = inject(MatchAnalysisService);
  private readonly _predictionsService = inject(PredictionsService);
  private readonly _membersService = inject(TournamentMembersService);
  private readonly _returnService = inject(TournamentReturnService);
  private readonly _authState = inject(AuthState);
  private readonly _theme = inject(ThemeService);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _swipeReg = inject(SwipeNavRegistry);

  protected readonly calendarIcon = CalendarDays;
  protected readonly arrowLeftRightIcon = ArrowLeftRight;
  protected readonly shareIcon = Share2;
  protected readonly hashIcon = Hash;
  protected readonly usersIcon = Users;
  protected readonly pencilIcon = Pencil;
  protected readonly trophyIcon = Trophy;
  protected readonly banIcon = Ban;
  protected readonly trashIcon = Trash2;
  protected readonly sparklesIcon = Sparkles;
  protected readonly chevronRightIcon = ChevronRight;
  protected readonly historyIcon = History;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly match = signal<IMatchResponse | null>(null);

  protected readonly pageTitle = computed(() => {
    const m = this.match();
    if (!m) return '';
    const home = m.homeTeam.shortName ?? m.homeTeam.name;
    const away = m.awayTeam.shortName ?? m.awayTeam.name;
    return `${home} × ${away}`;
  });

  protected readonly activeTab = signal<MatchTab>('predictions');

  protected readonly resultDialogOpen = signal(false);
  protected readonly resultSubmitting = signal(false);
  protected readonly resultError = signal<string | null>(null);

  protected readonly cancelDialogOpen = signal(false);
  protected readonly cancelSubmitting = signal(false);

  protected readonly deleteDialogOpen = signal(false);
  protected readonly deleteSubmitting = signal(false);

  protected readonly isActiveMember = signal(false);
  protected readonly myPrediction = signal<IPredictionResponse | null>(null);

  protected readonly allPredictions = signal<IPredictionResponse[]>([]);
  protected readonly allPredictionsLoading = signal(false);
  protected readonly allPredictionsLocked = signal(false);

  /** Membros do torneio — usados para resolver o avatar de cada pitaco. */
  private readonly _members = signal<ITournamentMemberResponse[]>([]);

  private readonly _avatarByUserId = computed<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const member of this._members()) {
      map.set(member.userId, member.avatarUrl);
    }
    return map;
  });

  protected readonly predictionDialogOpen = signal(false);
  protected readonly predictionSubmitting = signal(false);
  protected readonly predictionError = signal<string | null>(null);

  protected readonly removePredictionDialogOpen = signal(false);
  protected readonly removePredictionSubmitting = signal(false);

  protected readonly statusText = computed(() => {
    const m = this.match();
    return m ? STATUS_TEXT[m.status] : '';
  });

  protected readonly statusClass = computed(() => {
    const m = this.match();
    if (!m) return '';
    return `hero__status hero__status--${m.status.toLowerCase()}`;
  });

  protected readonly hasScore = computed(() => {
    const m = this.match();
    return m !== null && m.homeScore !== null && m.awayScore !== null;
  });

  protected readonly dateLabel = computed(() => {
    const m = this.match();
    if (!m || !m.scheduledAt) return 'Sem horário';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(m.scheduledAt));
    } catch {
      return m.scheduledAt;
    }
  });

  protected readonly timeLabel = computed(() => {
    const m = this.match();
    if (!m || !m.scheduledAt) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(m.scheduledAt));
    } catch {
      return '';
    }
  });

  protected readonly subMeta = computed(() => {
    const m = this.match();
    const p = this.phase();
    if (!m || !p) return '';
    let roundLabel: string;
    if (p.phaseType === 'KNOCKOUT') {
      roundLabel =
        m.matchType === 'THIRD_PLACE'
          ? 'Disputa de 3º lugar'
          : knockoutRoundLabel(m.round, p.teamCount);
    } else {
      roundLabel = `Rodada ${m.round}`;
    }
    const parts: string[] = [p.name, roundLabel];
    if (m.groupName) parts.push(`Grupo ${m.groupName}`);
    // Modo efetivo da partida (a final pode ter modo próprio via finalLegMode).
    if (m.matchLegMode === 'TWO_LEGGED') parts.push('Ida e volta');
    return parts.join(' · ');
  });

  protected readonly winnerSide = computed<'home' | 'away' | 'draw' | null>(
    () => {
      const m = this.match();
      if (!m || m.status !== 'COMPLETED') return null;
      return matchWinnerSide(m);
    },
  );

  /** Placar principal exibido: prorrogação quando houve, senão o do tempo normal. */
  protected readonly displayScore = computed(() => {
    const m = this.match();
    return m ? matchDisplayScore(m) : null;
  });

  protected readonly hasPenalties = computed(() => {
    const m = this.match();
    return (
      m !== null &&
      m.homePenalties !== null &&
      m.awayPenalties !== null
    );
  });

  protected readonly cancelledNote = computed(() =>
    this.match()?.status === 'CANCELLED'
      ? 'Esta partida foi cancelada. Pitacos associados não pontuam.'
      : null,
  );

  /**
   * Ida-e-volta de mata-mata (muda o texto do palpite de pênaltis e o form de
   * prorrogação). Usa o modo EFETIVO da partida — a rodada final pode ter modo
   * próprio via `finalLegMode` da fase.
   */
  protected readonly isTwoLegged = computed(
    () => this.match()?.matchLegMode === 'TWO_LEGGED',
  );

  /**
   * O palpite deste confronto pode ir aos pênaltis? Fonte única: o backend
   * sinaliza no `MatchResponse` (jogo único de KO ou perna de volta).
   */
  protected readonly penaltyEligible = computed(
    () => this.match()?.penaltyShootoutEligible === true,
  );

  /** Gols já marcados nas pernas anteriores (ida-e-volta); 0 em jogo único. */
  protected readonly aggregateBeforeHome = computed(
    () => this.match()?.aggregateBeforeHome ?? 0,
  );
  protected readonly aggregateBeforeAway = computed(
    () => this.match()?.aggregateBeforeAway ?? 0,
  );

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  /** Aba "Detalhes": visível para todos (traz compartilhar + ações do dono). */
  protected readonly showInfoTab = computed(() => this.match() !== null);

  /** Aba "Retrospecto": histórico dos times + confronto direto. */
  protected readonly showAnalysisTab = computed(() => this.match() !== null);

  // Retrospecto — carregado sob demanda ao abrir a aba (economiza 1 request).
  protected readonly analysis = signal<IMatchAnalysisResponse | null>(null);
  protected readonly analysisLoading = signal(false);
  protected readonly analysisError = signal<unknown>(null);
  /** Já carregou (ou tentou) — evita refetch a cada troca de aba. */
  private _analysisLoaded = false;

  /**
   * Faixa do palpite (exato/vencedor/erro) p/ colorir o badge de pontos. Com o
   * `points` agora sendo uma SOMA (90' + prorrogação + pênaltis), a cor reflete
   * o placar do tempo normal — comparado direto ao resultado, não ao total.
   */
  protected predictionOutcome(p: IPredictionResponse): PredictionOutcome | null {
    const m = this.match();
    if (!m) return null;
    return classifyScorePair(p.homeScore, p.awayScore, m.homeScore, m.awayScore);
  }

  /**
   * Detalhamento dos pontos do palpite (ex.: "Placar 90′ +5 · Prorrogação +2 ·
   * Pênaltis +2"), exposto como tooltip do chip. `null` quando não há blocos
   * extras a mostrar (jogo decidido no tempo normal).
   */
  protected pointsBreakdownLabel(p: IPredictionResponse): string | null {
    const m = this.match();
    const scoring = this.tournament()?.settings;
    if (!m || !scoring) return null;
    const parts = buildPointsBreakdown(p, m, scoring);
    if (parts.length <= 1) return null;
    return parts.map((c) => `${c.label} +${c.points}`).join(' · ');
  }

  /** Houve prorrogação nesta partida (resultado lançado). */
  protected readonly hasExtraTime = computed(() => {
    const m = this.match();
    return (
      m !== null &&
      m.homeExtraTimeScore !== null &&
      m.awayExtraTimeScore !== null
    );
  });

  // "Previsão da Galera" — agregado dos pitacos antes do jogo começar.
  protected readonly predictionStats =
    signal<IPredictionStatsResponse | null>(null);

  /** Mostra o card enquanto o resultado não saiu e a partida não começou. */
  protected readonly showCrowdCard = computed(() => {
    const m = this.match();
    const stats = this.predictionStats();
    if (!m || !stats) return false;
    if (!this.isActiveMember()) return false;
    if (stats.totalVotes <= 0) return false;
    if (m.status !== 'SCHEDULED') return false;
    if (m.scheduledAt) {
      return new Date(m.scheduledAt).getTime() > Date.now();
    }
    return true;
  });

  protected readonly homeTeamColor = computed(
    () => this.match()?.homeTeam.primaryColor || '#10B981',
  );

  protected readonly awayTeamColor = computed(
    () => this.match()?.awayTeam.primaryColor || '#6366F1',
  );

  // Versão da cor com contraste garantido para o texto da %, conforme o tema.
  protected readonly homePctColor = computed(() =>
    readableAccent(this.homeTeamColor(), this._theme.resolvedTheme() === 'dark'),
  );

  protected readonly awayPctColor = computed(() =>
    readableAccent(this.awayTeamColor(), this._theme.resolvedTheme() === 'dark'),
  );

  protected readonly canEditScheduling = computed(() => {
    if (!this.isOwner()) return false;
    if (this.tournament()?.status === 'FINISHED') return false;
    if (this.match()?.status === 'COMPLETED') return false;
    return true;
  });

  protected readonly editMatchHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    const m = this.match();
    return t && p && m
      ? `/tournaments/${t.id}/phases/${p.id}/matches/${m.id}/edit`
      : null;
  });

  protected readonly canSetResult = computed(() => {
    if (!this.isOwner()) return false;
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return false;
    if (t.status !== 'IN_PROGRESS') return false;
    if (m.status === 'CANCELLED') return false;
    if (m.scheduledAt) {
      return new Date(m.scheduledAt).getTime() <= Date.now();
    }
    return true;
  });

  protected readonly setResultBlockReason = computed(() => {
    if (!this.isOwner()) return null;
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return null;
    if (m.status === 'CANCELLED') return null;
    if (t.status === 'DRAFT' || t.status === 'OPEN') {
      return 'Resultados só podem ser lançados após o torneio começar.';
    }
    if (t.status === 'FINISHED') return 'Torneio encerrado.';
    if (m.scheduledAt && new Date(m.scheduledAt).getTime() > Date.now()) {
      return 'Aguardando o horário agendado.';
    }
    return null;
  });

  protected readonly resultActionLabel = computed(() =>
    this.match()?.status === 'COMPLETED' ? 'Editar resultado' : 'Lançar resultado',
  );

  protected readonly resultActionDescription = computed(() =>
    this.match()?.status === 'COMPLETED'
      ? 'Refaz o placar e recalcula pontos.'
      : 'Define o placar final e libera pontos.',
  );

  protected readonly canCancel = computed(() => {
    if (!this.isOwner()) return false;
    if (this.tournament()?.status === 'FINISHED') return false;
    return this.match()?.status !== 'CANCELLED';
  });

  protected readonly canDelete = computed(() => {
    if (!this.isOwner()) return false;
    return this.tournament()?.status !== 'FINISHED';
  });

  protected readonly cancelDescription = computed(() => {
    const m = this.match();
    const teams = m ? `${m.homeTeam.name} × ${m.awayTeam.name}` : 'esta partida';
    return `Cancelar ${teams} zera os placares e remove os pontos dos pitacos associados. Os pitacos são mantidos para histórico.`;
  });

  protected readonly deleteDescription = computed(() => {
    const m = this.match();
    const teams = m ? `${m.homeTeam.name} × ${m.awayTeam.name}` : 'esta partida';
    return `Excluir ${teams} é permanente e remove a partida junto com pitacos associados.`;
  });

  protected readonly canPredict = computed(() => {
    if (!this.isActiveMember()) return false;
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return false;
    if (t.status !== 'IN_PROGRESS') return false;
    if (m.status === 'CANCELLED') return false;
    if (m.scheduledAt) {
      return new Date(m.scheduledAt).getTime() > Date.now();
    }
    return m.status !== 'COMPLETED';
  });

  protected readonly predictionBlockReason = computed(() => {
    if (!this.isActiveMember()) return null;
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return null;
    if (t.status === 'DRAFT' || t.status === 'OPEN') {
      return 'Pitacos abrem quando o torneio começa.';
    }
    if (t.status === 'FINISHED') {
      return 'Torneio encerrado — pitacos estão congelados.';
    }
    if (m.status === 'CANCELLED') {
      return 'Partida cancelada não aceita pitacos.';
    }
    if (m.scheduledAt) {
      if (new Date(m.scheduledAt).getTime() <= Date.now()) {
        return 'Pitacos encerrados (a partida começou).';
      }
      return null;
    }
    if (m.status === 'COMPLETED') {
      return 'Pitacos encerrados (resultado lançado).';
    }
    return null;
  });

  protected readonly canRevealScores = computed(() => {
    const m = this.match();
    if (!m) return false;
    if (m.status === 'COMPLETED' || m.status === 'CANCELLED') return true;
    if (m.scheduledAt) {
      return new Date(m.scheduledAt).getTime() <= Date.now();
    }
    return false;
  });

  protected readonly revealLockReason = computed(() => {
    const m = this.match();
    if (!m) return null;
    if (m.status === 'COMPLETED' || m.status === 'CANCELLED') return null;
    if (m.scheduledAt) {
      return 'Os placares serão revelados após o início da partida.';
    }
    return 'Os placares serão revelados quando o resultado for lançado.';
  });

  protected readonly sortedPredictions = computed<IPredictionResponse[]>(() => {
    const me = this._authState.user();
    return [...this.allPredictions()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (me) {
        if (a.userId === me.id) return -1;
        if (b.userId === me.id) return 1;
      }
      return a.userName.localeCompare(b.userName);
    });
  });

  protected participantLink(userId: string): unknown[] | null {
    const t = this.tournament();
    return t ? ['/tournaments', t.id, 'participants', userId] : null;
  }

  protected setTab(tab: MatchTab): void {
    this.activeTab.set(tab);
    if (tab === 'analysis') this._ensureAnalysisLoaded();
  }

  /** Carrega o retrospecto na primeira vez que a aba é aberta. */
  private _ensureAnalysisLoaded(): void {
    if (this._analysisLoaded) return;
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return;
    this._analysisLoaded = true;
    this._loadAnalysis(t.id, m.id);
  }

  /** Recarrega o retrospecto (botão "tentar novamente" no estado de erro). */
  protected reloadAnalysis(): void {
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return;
    this._loadAnalysis(t.id, m.id);
  }

  private _loadAnalysis(tid: string, mid: string): void {
    this.analysisLoading.set(true);
    this.analysisError.set(null);
    this._analysisService
      .get(tid, mid)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (data) => {
          this.analysis.set(data);
          this.analysisLoading.set(false);
        },
        error: (err: unknown) => {
          this.analysisLoading.set(false);
          this.analysisError.set(err);
        },
      });
  }

  /**
   * Clique no hero → volta ao torneio, na aba de partidas, rolando até esta
   * partida. Usa o mesmo mecanismo de retorno das demais sub-páginas do
   * torneio (TournamentReturnService + âncora `match-<id>`).
   */
  protected goToTournamentMatches(): void {
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return;
    this._returnService.set(t.id, `match-${m.id}`, 'matches');
    void this._router.navigate(['/tournaments', t.id], {
      queryParams: { tab: 'matches' },
    });
  }

  /** Compartilha o link desta partida (Web Share API, com fallback de cópia). */
  protected async shareMatch(): Promise<void> {
    const m = this.match();
    if (!m) return;
    // Link curto resolvido pelo backend (/m/:matchId) → rota completa da partida.
    const url = `${window.location.origin}/m/${m.id}`;
    const lines = [
      'Dê seu pitaco nessa partida!',
      '',
      `⚽ ${m.homeTeam.name} vs ${m.awayTeam.name}`,
    ];
    const subMeta = this.subMeta();
    if (subMeta) lines.push(subMeta);
    const dateTime = this._shareDateTime();
    if (dateTime) lines.push(`📅 ${dateTime}`);
    lines.push('', url);
    const text = lines.join('\n');
    // O link já faz parte da mensagem (última linha), então não passamos `url`
    // separado para evitar que apps de share o dupliquem.
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${m.homeTeam.name} × ${m.awayTeam.name}`,
          text,
        });
      } catch {
        // Usuário cancelou ou o share falhou — silencioso.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      this._toast.success('Link da partida copiado!');
    } catch {
      this._toast.error('Não foi possível copiar o link.');
    }
  }

  /** Data/hora da partida para a mensagem de compartilhamento (dd/MM/yy HH:mmh). */
  private _shareDateTime(): string {
    const m = this.match();
    if (!m || !m.scheduledAt) return '';
    try {
      const d = new Date(m.scheduledAt);
      const date = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      }).format(d);
      const time = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
      return `${date} ${time}h`;
    } catch {
      return '';
    }
  }

  /** Abas visíveis na ordem exibida. */
  protected readonly visibleTabs = computed<MatchTab[]>(() => {
    const tabs: MatchTab[] = ['predictions'];
    if (this.showAnalysisTab()) tabs.push('analysis');
    if (this.showInfoTab()) tabs.push('info');
    return tabs;
  });

  /** Índice da aba ativa (alimenta a animação direcional do swipe). */
  protected readonly activeTabIndex = computed(() =>
    Math.max(0, this.visibleTabs().indexOf(this.activeTab())),
  );

  /** Swipe: vai para a aba vizinha (delta +1 = direita, -1 = esquerda). */
  protected swipeToTab(delta: 1 | -1): void {
    const tabs = this.visibleTabs();
    const next = this.activeTabIndex() + delta;
    if (next < 0 || next >= tabs.length) return;
    this.setTab(tabs[next]);
  }

  protected openResultDialog(): void {
    if (!this.canSetResult()) return;
    this.resultError.set(null);
    this.resultDialogOpen.set(true);
  }

  protected closeResultDialog(): void {
    this.resultDialogOpen.set(false);
    this.resultError.set(null);
  }

  protected openCancelDialog(): void {
    if (!this.canCancel()) return;
    this.cancelDialogOpen.set(true);
  }

  protected closeCancelDialog(): void {
    if (this.cancelSubmitting()) return;
    this.cancelDialogOpen.set(false);
  }

  protected confirmCancel(): void {
    const t = this.tournament();
    const p = this.phase();
    const m = this.match();
    if (!t || !p || !m) return;

    this.cancelSubmitting.set(true);
    this._matchesService
      .cancel(t.id, p.id, m.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (updated) => {
          this.cancelSubmitting.set(false);
          this.cancelDialogOpen.set(false);
          this.match.set(updated);
          this._toast.success('Partida cancelada.');
        },
        error: (err: unknown) => {
          this.cancelSubmitting.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível cancelar a partida.',
          );
        },
      });
  }

  protected openDeleteDialog(): void {
    if (!this.canDelete()) return;
    this.deleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    if (this.deleteSubmitting()) return;
    this.deleteDialogOpen.set(false);
  }

  protected confirmDelete(): void {
    const t = this.tournament();
    const p = this.phase();
    const m = this.match();
    if (!t || !p || !m) return;

    this.deleteSubmitting.set(true);
    this._matchesService
      .remove(t.id, p.id, m.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.deleteSubmitting.set(false);
          this.deleteDialogOpen.set(false);
          this._toast.success('Partida excluída.');
          void this._router.navigate(['/tournaments', t.id], {
            queryParams: { tab: 'matches' },
          });
        },
        error: (err: unknown) => {
          this.deleteSubmitting.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível excluir a partida.',
          );
        },
      });
  }

  protected openPredictionDialog(): void {
    if (!this.canPredict()) return;
    this.predictionError.set(null);
    this.predictionDialogOpen.set(true);
  }

  /** Avatar (DiceBear) do autor de um pitaco, resolvido via membros. */
  protected avatarUrlFor(userId: string): string | null {
    return this._avatarByUserId().get(userId) ?? null;
  }

  /** A row é do próprio usuário e pode virar edição de pitaco? */
  protected isEditableMyRow(p: IPredictionResponse): boolean {
    return p.id === this.myPrediction()?.id && this.canPredict();
  }

  /**
   * Palpite a exibir na linha: o próprio quando os placares já foram revelados;
   * senão, apenas o do próprio usuário (sempre visível pra ele); `null` quando
   * está oculto (palpite alheio antes da revelação).
   */
  protected rowPrediction(p: IPredictionResponse): IPredictionResponse | null {
    if (this.canRevealScores()) return p;
    if (p.id === this.myPrediction()?.id) return this.myPrediction();
    return null;
  }

  /**
   * O palpite tem prorrogação ou pênaltis? Só então a linha vira duas linhas
   * (essas informações descem pra segunda). Sem isso, mantém tudo inline.
   */
  protected predictionHasExtras(p: IPredictionResponse): boolean {
    return (
      (p.homeExtraTimeScore !== null && p.awayExtraTimeScore !== null) ||
      p.penaltyWinner !== null
    );
  }

  /**
   * Time que o palpiteiro escolheu para avançar nos pênaltis (só existe em
   * palpite de empate elegível a pênaltis); `null` quando o pitaco não envolve
   * pênaltis. Usado para estampar o escudo do escolhido no placar do pitaco.
   */
  protected penaltyPickTeam(p: IPredictionResponse | null): ITeamRef | null {
    const m = this.match();
    if (!m || !p || !p.penaltyWinner) return null;
    return p.penaltyWinner === 'HOME' ? m.homeTeam : m.awayTeam;
  }

  /** "Remover pitaco" acionado de dentro do dialog de edição. */
  protected onPredictionDialogRemove(): void {
    if (this.predictionSubmitting()) return;
    this.predictionDialogOpen.set(false);
    this.openRemovePredictionDialog();
  }

  protected closePredictionDialog(): void {
    if (this.predictionSubmitting()) return;
    this.predictionDialogOpen.set(false);
    this.predictionError.set(null);
  }

  protected submitPrediction(payload: IPredictionPayload): void {
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return;

    this.predictionSubmitting.set(true);
    this.predictionError.set(null);

    this._predictionsService
      .upsertMine(t.id, m.id, payload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (prediction) => {
          this.predictionSubmitting.set(false);
          this.predictionDialogOpen.set(false);
          this.myPrediction.set(prediction);
          this.allPredictions.update((list) => {
            const idx = list.findIndex((p) => p.id === prediction.id);
            if (idx >= 0) {
              const next = [...list];
              next[idx] = prediction;
              return next;
            }
            return [...list, prediction];
          });
          this._loadPredictionStats(t.id, m.id);
        },
        error: (err: unknown) => {
          this.predictionSubmitting.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível salvar o pitaco.';
          this.predictionError.set(message);
          this._toast.error(message);
        },
      });
  }

  protected openRemovePredictionDialog(): void {
    if (!this.canPredict() || !this.myPrediction()) return;
    this.removePredictionDialogOpen.set(true);
  }

  protected closeRemovePredictionDialog(): void {
    if (this.removePredictionSubmitting()) return;
    this.removePredictionDialogOpen.set(false);
  }

  protected confirmRemovePrediction(): void {
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return;

    this.removePredictionSubmitting.set(true);
    this._predictionsService
      .removeMine(t.id, m.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.removePredictionSubmitting.set(false);
          this.removePredictionDialogOpen.set(false);
          const removedId = this.myPrediction()?.id;
          this.myPrediction.set(null);
          if (removedId) {
            this.allPredictions.update((list) =>
              list.filter((p) => p.id !== removedId),
            );
          }
          this._loadPredictionStats(t.id, m.id);
          this._toast.success('Pitaco removido.');
        },
        error: (err: unknown) => {
          this.removePredictionSubmitting.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível remover o pitaco.',
          );
        },
      });
  }

  protected submitResult(payload: IMatchResultPayload): void {
    const t = this.tournament();
    const p = this.phase();
    const m = this.match();
    if (!t || !p || !m) return;

    this.resultSubmitting.set(true);
    this.resultError.set(null);

    this._matchesService
      .setResult(t.id, p.id, m.id, payload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (updated) => {
          this.resultSubmitting.set(false);
          this.match.set(updated);
          this.resultDialogOpen.set(false);
          this._toast.success('Resultado salvo.');
        },
        error: (err: unknown) => {
          this.resultSubmitting.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível salvar o resultado.';
          this.resultError.set(message);
          this._toast.error(message);
        },
      });
  }

  public ngOnInit(): void {
    const swipe = (delta: 1 | -1) => this.swipeToTab(delta);
    this._swipeReg.set(swipe);
    this._destroyRef.onDestroy(() => this._swipeReg.clear(swipe));

    const tid = this._route.snapshot.paramMap.get('id');
    const pid = this._route.snapshot.paramMap.get('pid');
    const mid = this._route.snapshot.paramMap.get('mid');
    if (!tid || !pid || !mid) {
      this.loading.set(false);
      this.loadError.set('Partida não encontrada.');
      return;
    }

    this._load(tid, pid, mid);
  }

  private _loadAllPredictions(tid: string, mid: string): void {
    if (!this.isOwner() && !this.isActiveMember()) return;
    this.allPredictionsLoading.set(true);
    this.allPredictionsLocked.set(false);
    this._predictionsService
      .listForMatch(tid, mid)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (predictions) => {
          this.allPredictions.set(predictions);
          this.allPredictionsLoading.set(false);
        },
        error: (err: unknown) => {
          this.allPredictionsLoading.set(false);
          if (err instanceof ApiException && err.isConflict) {
            this.allPredictionsLocked.set(true);
            return;
          }
          this.allPredictions.set([]);
        },
      });
  }

  private _loadPredictionStats(tid: string, mid: string): void {
    if (!this.isOwner() && !this.isActiveMember()) return;
    this._predictionsService
      .stats(tid, mid)
      .pipe(
        takeUntilDestroyed(this._destroyRef),
        catchError(() => of<IPredictionStatsResponse | null>(null)),
      )
      .subscribe((stats) => this.predictionStats.set(stats));
  }

  private _load(tid: string, pid: string, mid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      match: this._matchesService.getById(tid, pid, mid),
      myPredictions: this._predictionsService.listMineInTournament(tid).pipe(
        catchError((err: unknown) => {
          if (err instanceof ApiException && err.isForbidden) {
            return of<IPredictionResponse[] | null>(null);
          }
          return of<IPredictionResponse[] | null>([]);
        }),
      ),
      // Membros: só para resolver avatares na lista de pitacos — falha não
      // pode derrubar a tela.
      membersPage: this._membersService.list(tid, { size: 100 }).pipe(
        catchError(() => of(null)),
      ),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, match, myPredictions, membersPage }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.match.set(match);
          this._members.set(membersPage?.content ?? []);
          this.isActiveMember.set(myPredictions !== null);
          // Quem não participa (e não é o dono) chegou via link compartilhado:
          // manda para o ranking do torneio, onde há o botão de entrar.
          if (myPredictions === null && !this.isOwner()) {
            this.loading.set(false);
            void this._router.navigate(['/tournaments', tid], {
              queryParams: { tab: 'ranking' },
              replaceUrl: true,
            });
            return;
          }
          this.myPrediction.set(
            myPredictions?.find((p) => p.matchId === match.id) ?? null,
          );
          this.loading.set(false);
          this._loadAllPredictions(tid, mid);
          this._loadPredictionStats(tid, mid);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (err instanceof ApiException && err.isNotFound) {
            this.loadError.set('Partida não encontrada.');
          } else if (err instanceof ApiException && err.isForbidden) {
            // Não-membro via link: redireciona para entrar no torneio.
            void this._router.navigate(['/tournaments', tid], {
              queryParams: { tab: 'ranking' },
              replaceUrl: true,
            });
          } else {
            this.loadError.set(
              err instanceof ApiException
                ? err.message
                : 'Não foi possível carregar a partida.',
            );
          }
        },
      });
  }
}
