import { ViewportScroller } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import {
  TiebreakCriteria,
  TournamentStatus,
} from '@core/interfaces/enums';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import { IPredictionResponse } from '@core/interfaces/prediction.interface';
import { IRankingRowResponse } from '@core/interfaces/ranking.interface';
import { IStandingsResponse } from '@core/interfaces/standings.interface';
import { IBracketResponse } from '@core/interfaces/bracket.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { BracketService } from '@core/services/bracket.service';
import { MatchesService } from '@core/services/matches.service';
import { PhasesService } from '@core/services/phases.service';
import { PredictionsService } from '@core/services/predictions.service';
import { RankingService } from '@core/services/ranking.service';
import { StandingsService } from '@core/services/standings.service';
import { TournamentMembersService } from '@core/services/tournament-members.service';
import { TournamentReturnService } from '@core/services/tournament-return.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { knockoutRoundLabel } from '@core/utils/round-label';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { BracketViewComponent, BracketViewMode } from '@shared/components/bracket-view/bracket-view.component';
import { MatchRowComponent } from '@shared/components/match-row/match-row.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PredictionCardComponent } from '@shared/components/prediction-card/prediction-card.component';
import {
  IPredictionPayload,
  PredictionDialogComponent,
} from '@shared/components/prediction-dialog/prediction-dialog.component';
import { StandingsTableComponent } from '@shared/components/standings-table/standings-table.component';
import { ToastService } from '@shared/services/toast.service';
import {
  CalendarDays,
  ChevronRight,
  Copy,
  Crown,
  Flag,
  Globe,
  Grid3x3,
  Lock,
  LogIn,
  LogOut,
  LucideAngularModule,
  Medal,
  Pencil,
  Play,
  RefreshCw,
  Repeat,
  Shield,
  Sparkles,
  Trophy,
  Users,
  Workflow,
} from 'lucide-angular';

const STATUS_FLOW: Record<TournamentStatus, TournamentStatus | null> = {
  DRAFT: 'OPEN',
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'FINISHED',
  FINISHED: null,
};

const STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  FINISHED: 'Finalizado',
};

const TIEBREAK_LABEL: Record<TiebreakCriteria, string> = {
  POINTS: 'Pontos',
  WINS: 'Vitórias',
  GOAL_DIFFERENCE: 'Saldo de gols',
  GOALS_FOR: 'Gols pró',
  HEAD_TO_HEAD: 'Confronto direto',
  FEWEST_LOSSES: 'Menos derrotas',
};

interface IStatusActionContext {
  title: string;
  description: string;
  confirmLabel: string;
  variant: 'default' | 'destructive';
  buttonLabel: string;
  buttonIcon: 'play' | 'flag';
}

const STATUS_ACTION_CONTEXT: Record<
  Exclude<TournamentStatus, 'FINISHED'>,
  IStatusActionContext
> = {
  DRAFT: {
    title: 'Abrir torneio?',
    description:
      'O torneio fica disponível para receber participantes pelo código de convite.',
    confirmLabel: 'Abrir torneio',
    variant: 'default',
    buttonLabel: 'Abrir torneio',
    buttonIcon: 'play',
  },
  OPEN: {
    title: 'Iniciar torneio?',
    description:
      'Ao iniciar, a privacidade não poderá mais ser alterada e os palpites começam a contar pontos.',
    confirmLabel: 'Iniciar',
    variant: 'default',
    buttonLabel: 'Iniciar torneio',
    buttonIcon: 'play',
  },
  IN_PROGRESS: {
    title: 'Encerrar torneio?',
    description:
      'Após encerrar, nada mais pode ser modificado: resultados, palpites e configurações ficam congelados.',
    confirmLabel: 'Encerrar',
    variant: 'destructive',
    buttonLabel: 'Encerrar torneio',
    buttonIcon: 'flag',
  },
};

interface ITab {
  id: string;
  label: string;
}

type MatchBucketKind = 'REGULAR' | 'THIRD_PLACE';

interface IMatchGroup {
  key: string;
  phaseId: string;
  phaseName: string;
  round: number;
  kind: MatchBucketKind;
  label: string;
  matches: IMatchResponse[];
}

interface IBucketFilterOption {
  key: string;
  label: string;
}

interface IGroupFilterOption {
  id: string;
  name: string;
}

interface IMyPredictionRow {
  prediction: IPredictionResponse;
  match: IMatchResponse;
  phaseName: string;
}

const TAB_RANKING = 'ranking';
const TAB_MATCHES = 'matches';
const TAB_MY_PREDICTIONS = 'predictions';
const TAB_INFO = 'info';
const PHASE_TAB_PREFIX = 'phase-';

@Component({
  selector: 'app-tournament-detail',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeaderComponent,
    AvatarComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    MatchRowComponent,
    StandingsTableComponent,
    BracketViewComponent,
    PredictionDialogComponent,
    PredictionCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tournament-detail.component.html',
  styleUrl: './tournament-detail.component.scss',
})
export class TournamentDetailComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _matchesService = inject(MatchesService);
  private readonly _rankingService = inject(RankingService);
  private readonly _predictionsService = inject(PredictionsService);
  private readonly _standingsService = inject(StandingsService);
  private readonly _bracketService = inject(BracketService);
  private readonly _membersService = inject(TournamentMembersService);
  private readonly _returnService = inject(TournamentReturnService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _scroller = inject(ViewportScroller);
  private readonly _injector = inject(Injector);
  private readonly _destroyRef = inject(DestroyRef);
  private _pendingScrollAnchor: string | null = null;

  protected readonly trophyIcon = Trophy;
  protected readonly medalIcon = Medal;
  protected readonly sparklesIcon = Sparkles;
  protected readonly usersIcon = Users;
  protected readonly shieldIcon = Shield;
  protected readonly workflowIcon = Workflow;
  protected readonly calendarIcon = CalendarDays;
  protected readonly chevronRightIcon = ChevronRight;
  protected readonly copyIcon = Copy;
  protected readonly refreshIcon = RefreshCw;
  protected readonly pencilIcon = Pencil;
  protected readonly logOutIcon = LogOut;
  protected readonly logInIcon = LogIn;
  protected readonly playIcon = Play;
  protected readonly flagIcon = Flag;
  protected readonly globeIcon = Globe;
  protected readonly lockIcon = Lock;
  protected readonly crownIcon = Crown;
  protected readonly repeatIcon = Repeat;
  protected readonly gridIcon = Grid3x3;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phases = signal<IPhaseResponse[]>([]);
  protected readonly matches = signal<IMatchResponse[]>([]);
  protected readonly ranking = signal<IRankingRowResponse[]>([]);
  protected readonly myPredictions = signal<IPredictionResponse[] | null>(null);

  protected readonly activeTab = signal<string>(TAB_RANKING);

  protected readonly standingsCache = signal<
    Record<string, IStandingsResponse>
  >({});
  protected readonly standingsLoading = signal<Record<string, boolean>>({});
  protected readonly standingsError = signal<Record<string, string | null>>({});

  protected readonly bracketCache = signal<Record<string, IBracketResponse>>({});
  protected readonly bracketLoading = signal<Record<string, boolean>>({});
  protected readonly bracketError = signal<Record<string, string | null>>({});

  protected readonly bracketViewMode = signal<BracketViewMode>('cards');

  protected readonly selectedMatchesPhaseId = signal<string | null>(null);
  protected readonly selectedMatchesBucketKey = signal<string | null>(null);
  protected readonly selectedMatchesGroupId = signal<string | null>(null);

  protected readonly changingStatus = signal(false);
  protected readonly regenerating = signal(false);
  protected readonly statusDialogOpen = signal(false);
  protected readonly regenerateDialogOpen = signal(false);

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  protected readonly isActiveMember = computed(
    () => this.myPredictions() !== null,
  );

  /** Participante (não-dono) pode sair do torneio. */
  protected readonly canLeave = computed(
    () => !this.isOwner() && this.isActiveMember(),
  );

  protected readonly leaveDialogOpen = signal(false);
  protected readonly leaving = signal(false);

  /** Usuário que ainda não é membro pode entrar direto (sem digitar código). */
  protected readonly canJoin = computed(() => {
    const t = this.tournament();
    if (!t) return false;
    if (this.isOwner()) return false;
    if (this.isActiveMember()) return false;
    if (t.status !== 'OPEN' && t.status !== 'IN_PROGRESS') return false;
    return !!t.inviteCode;
  });

  protected readonly joining = signal(false);

  protected readonly tournamentInProgress = computed(
    () => this.tournament()?.status === 'IN_PROGRESS',
  );

  protected readonly nextStatus = computed<TournamentStatus | null>(() => {
    const t = this.tournament();
    return t ? STATUS_FLOW[t.status] : null;
  });

  protected readonly statusContext = computed<IStatusActionContext | null>(
    () => {
      const t = this.tournament();
      if (!t || t.status === 'FINISHED') return null;
      return STATUS_ACTION_CONTEXT[t.status];
    },
  );

  protected readonly statusLabel = computed(() => {
    const t = this.tournament();
    return t ? STATUS_LABEL[t.status] : '';
  });

  protected readonly statusClass = computed(() => {
    const t = this.tournament();
    if (!t) return '';
    return `hero__status hero__status--${t.status.toLowerCase()}`;
  });

  protected readonly privacyLabel = computed(() => {
    const t = this.tournament();
    return t?.privacy === 'PRIVATE' ? 'Privado' : 'Público';
  });

  protected readonly memberCountLabel = computed(() => {
    const t = this.tournament();
    if (!t) return '';
    return t.maxParticipants !== null
      ? `${t.memberCount} / ${t.maxParticipants}`
      : String(t.memberCount);
  });

  protected readonly teamCountLabel = computed(() => {
    const t = this.tournament();
    if (!t) return '';
    return t.maxTeams !== null
      ? `${t.teamCount} / ${t.maxTeams}`
      : String(t.teamCount);
  });

  protected readonly createdAtLabel = computed(() => {
    const t = this.tournament();
    if (!t) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(t.createdAt));
    } catch {
      return '';
    }
  });

  protected readonly tabs = computed<ITab[]>(() => {
    const phases = this.phases();
    const list: ITab[] = [
      { id: TAB_RANKING, label: 'Ranking' },
      { id: TAB_MATCHES, label: 'Partidas' },
      ...phases.map((p) => ({
        id: `${PHASE_TAB_PREFIX}${p.id}`,
        label: p.name,
      })),
    ];
    if (this.isActiveMember()) {
      list.push({ id: TAB_MY_PREDICTIONS, label: 'Meus palpites' });
    }
    list.push({ id: TAB_INFO, label: 'Detalhes' });
    return list;
  });

  protected readonly podium = computed(() => this.ranking().slice(0, 3));
  protected readonly rankingTail = computed(() => this.ranking().slice(3));
  protected readonly myUserId = computed(
    () => this._authState.user()?.id ?? null,
  );

  protected readonly matchGroups = computed<IMatchGroup[]>(() => {
    const phaseById = new Map(this.phases().map((p) => [p.id, p]));
    const phaseIndex = new Map(this.phases().map((p, i) => [p.id, i]));
    const groups = new Map<string, IMatchGroup>();
    for (const match of this.matches()) {
      const phase = phaseById.get(match.phaseId);
      const kind = this._bucketKind(match, phase);
      const key = `${match.phaseId}__${match.round}__${kind}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          phaseId: match.phaseId,
          phaseName: phase?.name ?? 'Fase',
          round: match.round,
          kind,
          label: this._bucketLabel(phase, match.round, kind),
          matches: [],
        });
      }
      groups.get(key)?.matches.push(match);
    }
    // Ordena por fase, depois rodada, com a Final antes da Disputa de 3º.
    return Array.from(groups.values()).sort((a, b) => {
      const pa = phaseIndex.get(a.phaseId) ?? 0;
      const pb = phaseIndex.get(b.phaseId) ?? 0;
      if (pa !== pb) return pa - pb;
      if (a.round !== b.round) return a.round - b.round;
      return a.kind === b.kind ? 0 : a.kind === 'REGULAR' ? -1 : 1;
    });
  });

  protected readonly matchesPhaseOptions = computed<IPhaseResponse[]>(() => {
    const matchedPhaseIds = new Set(this.matches().map((m) => m.phaseId));
    return this.phases().filter((p) => matchedPhaseIds.has(p.id));
  });

  /**
   * Fase usada pelos sub-filtros: a selecionada explicitamente ou, quando o
   * torneio só tem uma fase com partidas (sem chip de fase), essa fase única.
   */
  protected readonly effectiveMatchesPhaseId = computed<string | null>(() => {
    const selected = this.selectedMatchesPhaseId();
    if (selected !== null) return selected;
    const opts = this.matchesPhaseOptions();
    return opts.length === 1 ? opts[0]!.id : null;
  });

  protected readonly selectedMatchesPhase = computed<IPhaseResponse | null>(
    () => {
      const pid = this.effectiveMatchesPhaseId();
      if (!pid) return null;
      return this.phases().find((p) => p.id === pid) ?? null;
    },
  );

  protected readonly selectedPhaseIsGroups = computed(
    () => this.selectedMatchesPhase()?.phaseType === 'GROUPS',
  );

  /**
   * Sub-filtro de rodada/etapa — só quando uma fase específica está
   * selecionada. Em mata-mata, a Final e a Disputa de 3º lugar viram opções
   * separadas.
   */
  protected readonly matchesBucketOptions = computed<IBucketFilterOption[]>(
    () => {
      const pid = this.effectiveMatchesPhaseId();
      if (!pid) return [];
      const phase = this.phases().find((p) => p.id === pid);
      const seen = new Map<
        string,
        IBucketFilterOption & { round: number; kind: MatchBucketKind }
      >();
      for (const m of this.matches()) {
        if (m.phaseId !== pid) continue;
        const kind = this._bucketKind(m, phase);
        const key = `${m.round}:${kind}`;
        if (seen.has(key)) continue;
        seen.set(key, {
          key,
          label: this._bucketLabel(phase, m.round, kind),
          round: m.round,
          kind,
        });
      }
      return Array.from(seen.values())
        .sort((a, b) => {
          if (a.round !== b.round) return a.round - b.round;
          return a.kind === b.kind ? 0 : a.kind === 'REGULAR' ? -1 : 1;
        })
        .map(({ key, label }) => ({ key, label }));
    },
  );

  /** Sub-filtro de grupo — só em fase de grupos. */
  protected readonly matchesGroupOptions = computed<IGroupFilterOption[]>(() => {
    const pid = this.effectiveMatchesPhaseId();
    if (!pid || !this.selectedPhaseIsGroups()) return [];
    const seen = new Map<string, IGroupFilterOption>();
    for (const m of this.matches()) {
      if (m.phaseId !== pid) continue;
      if (!m.groupId || !m.groupName) continue;
      if (!seen.has(m.groupId)) {
        seen.set(m.groupId, { id: m.groupId, name: m.groupName });
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  });

  protected readonly filteredMatchGroups = computed<IMatchGroup[]>(() => {
    const selectedPhase = this.selectedMatchesPhaseId();
    const selectedBucket = this.selectedMatchesBucketKey();
    const selectedGroup = this.selectedMatchesGroupId();
    let groups = this.matchGroups();

    if (selectedPhase !== null) {
      groups = groups.filter((g) => g.phaseId === selectedPhase);
    }
    if (selectedBucket !== null) {
      groups = groups.filter(
        (g) => `${g.round}:${g.kind}` === selectedBucket,
      );
    }
    if (selectedGroup !== null) {
      // Filtra partidas dentro de cada card e descarta cards vazios.
      groups = groups
        .map((g) => ({
          ...g,
          matches: g.matches.filter((m) => m.groupId === selectedGroup),
        }))
        .filter((g) => g.matches.length > 0);
    }
    return groups;
  });

  protected selectMatchesPhase(phaseId: string | null): void {
    this.selectedMatchesPhaseId.set(phaseId);
    // Trocar de fase zera os sub-filtros.
    this.selectedMatchesBucketKey.set(null);
    this.selectedMatchesGroupId.set(null);
  }

  protected selectMatchesBucket(key: string | null): void {
    this.selectedMatchesBucketKey.set(key);
  }

  protected selectMatchesGroup(groupId: string | null): void {
    this.selectedMatchesGroupId.set(groupId);
  }

  /**
   * Subdivide as partidas de um card de rodada por grupo (fase de grupos).
   * Retorna `null` quando não há subdivisão útil (fora de grupos, ou só um
   * grupo presente) — aí o card renderiza a lista achatada.
   */
  protected roundSubgroups(
    group: IMatchGroup,
  ): { id: string; name: string; matches: IMatchResponse[] }[] | null {
    const buckets = new Map<
      string,
      { id: string; name: string; matches: IMatchResponse[] }
    >();
    for (const m of group.matches) {
      if (!m.groupId || !m.groupName) return null;
      let bucket = buckets.get(m.groupId);
      if (!bucket) {
        bucket = { id: m.groupId, name: m.groupName, matches: [] };
        buckets.set(m.groupId, bucket);
      }
      bucket.matches.push(m);
    }
    if (buckets.size <= 1) return null;
    return Array.from(buckets.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  private _bucketKind(
    match: IMatchResponse,
    phase: IPhaseResponse | undefined,
  ): MatchBucketKind {
    if (phase?.phaseType === 'KNOCKOUT' && match.matchType === 'THIRD_PLACE') {
      return 'THIRD_PLACE';
    }
    return 'REGULAR';
  }

  private _bucketLabel(
    phase: IPhaseResponse | undefined,
    round: number,
    kind: MatchBucketKind,
  ): string {
    if (kind === 'THIRD_PLACE') return 'Disputa de 3º lugar';
    if (phase?.phaseType === 'KNOCKOUT') {
      return knockoutRoundLabel(round, phase.teamCount);
    }
    return `Rodada ${round}`;
  }

  protected readonly myPredictionsRows = computed<IMyPredictionRow[]>(() => {
    const mine = this.myPredictions();
    if (!mine || mine.length === 0) return [];
    const matchById = new Map(this.matches().map((m) => [m.id, m]));
    const phaseNameById = new Map(this.phases().map((p) => [p.id, p.name]));
    const rows: IMyPredictionRow[] = [];
    for (const p of mine) {
      const match = matchById.get(p.matchId);
      if (!match) continue;
      rows.push({
        prediction: p,
        match,
        phaseName: phaseNameById.get(match.phaseId) ?? '',
      });
    }
    rows.sort((a, b) => {
      const ta = a.match.scheduledAt
        ? new Date(a.match.scheduledAt).getTime()
        : 0;
      const tb = b.match.scheduledAt
        ? new Date(b.match.scheduledAt).getTime()
        : 0;
      return ta - tb;
    });
    return rows;
  });

  protected readonly activePhase = computed<IPhaseResponse | null>(() => {
    const tab = this.activeTab();
    if (!tab.startsWith(PHASE_TAB_PREFIX)) return null;
    const pid = tab.slice(PHASE_TAB_PREFIX.length);
    return this.phases().find((p) => p.id === pid) ?? null;
  });

  protected readonly activeStandings = computed<IStandingsResponse | null>(
    () => {
      const phase = this.activePhase();
      if (!phase) return null;
      return this.standingsCache()[phase.id] ?? null;
    },
  );

  protected readonly activeStandingsLoading = computed(() => {
    const phase = this.activePhase();
    if (!phase) return false;
    return this.standingsLoading()[phase.id] === true;
  });

  protected readonly activeStandingsError = computed<string | null>(() => {
    const phase = this.activePhase();
    if (!phase) return null;
    return this.standingsError()[phase.id] ?? null;
  });

  protected readonly activeBracket = computed<IBracketResponse | null>(() => {
    const phase = this.activePhase();
    if (!phase || phase.phaseType !== 'KNOCKOUT') return null;
    return this.bracketCache()[phase.id] ?? null;
  });

  protected readonly activeBracketLoading = computed(() => {
    const phase = this.activePhase();
    if (!phase) return false;
    return this.bracketLoading()[phase.id] === true;
  });

  protected readonly activeBracketError = computed<string | null>(() => {
    const phase = this.activePhase();
    if (!phase) return null;
    return this.bracketError()[phase.id] ?? null;
  });

  constructor() {
    effect(() => {
      const tab = this.activeTab();
      if (!tab.startsWith(PHASE_TAB_PREFIX)) return;
      const phaseId = tab.slice(PHASE_TAB_PREFIX.length);
      const phase = this.phases().find((p) => p.id === phaseId);
      if (!phase) return;
      if (phase.phaseType === 'KNOCKOUT') {
        const bCache = this.bracketCache();
        const bLoading = this.bracketLoading();
        if (bCache[phaseId] || bLoading[phaseId]) return;
        this._loadBracket(phaseId);
        return;
      }
      const cache = this.standingsCache();
      const loading = this.standingsLoading();
      if (cache[phaseId] || loading[phaseId]) return;
      this._loadStandings(phaseId);
    });
  }

  protected setBracketViewMode(mode: BracketViewMode): void {
    this.bracketViewMode.set(mode);
  }

  public ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.loadError.set('Torneio não encontrado.');
      return;
    }
    this._route.queryParamMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const requested = params.get('tab');
        const valid = this.tabs().some((t) => t.id === requested);
        this.activeTab.set(valid && requested ? requested : TAB_RANKING);
      });
    this._route.fragment
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((fragment) => {
        if (fragment) this._pendingScrollAnchor = fragment;
      });

    // Voltando de uma sub-página (Membros/Times/Fases/Participante): reabre na
    // aba certa e rola até o card/linha de origem.
    const returnTarget = this._returnService.consume(id);
    if (returnTarget) {
      this.activeTab.set(returnTarget.tab);
      this._pendingScrollAnchor = returnTarget.anchorId;
      void this._router.navigate([], {
        relativeTo: this._route,
        queryParams: { tab: returnTarget.tab },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    this._load(id);
  }

  protected rememberReturn(anchorId: string, tab = TAB_INFO): void {
    const id = this.tournament()?.id;
    if (id) this._returnService.set(id, anchorId, tab);
  }

  protected participantLink(userId: string): unknown[] {
    const t = this.tournament();
    return t
      ? ['/tournaments', t.id, 'participants', userId]
      : ['/tournaments'];
  }

  protected rememberRankReturn(userId: string): void {
    this.rememberReturn(`rank-${userId}`, TAB_RANKING);
  }

  protected selectTab(id: string): void {
    this.activeTab.set(id);
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { tab: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected isTabActive(id: string): boolean {
    return this.activeTab() === id;
  }

  protected tiebreakLabel(criterion: TiebreakCriteria): string {
    return TIEBREAK_LABEL[criterion];
  }

  protected accuracyLabel(row: IRankingRowResponse): string {
    if (row.totalPredictions === 0) return 'sem palpites';
    const evaluated = row.exactScoreHits + row.winnerHits + row.wrongs;
    if (evaluated === 0) return 'aguardando resultados';
    return `${row.exactScoreHits} exato${row.exactScoreHits === 1 ? '' : 's'}`;
  }

  protected podiumIcon(position: number) {
    return position === 1 ? this.crownIcon : this.medalIcon;
  }

  protected matchLink(match: IMatchResponse): unknown[] {
    const t = this.tournament();
    if (!t) return [];
    return ['/tournaments', t.id, 'phases', match.phaseId, 'matches', match.id];
  }

  protected scheduledLabel(iso: string | null): string {
    if (!iso) return 'Sem horário';
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

  protected myPredictionFor(matchId: string): IPredictionResponse | null {
    return this.myPredictions()?.find((p) => p.matchId === matchId) ?? null;
  }

  protected readonly predictionMatch = signal<IMatchResponse | null>(null);
  protected readonly predictionSubmitting = signal(false);
  protected readonly predictionError = signal<string | null>(null);

  protected readonly predictionCurrent = computed<IPredictionResponse | null>(
    () => {
      const m = this.predictionMatch();
      return m ? this.myPredictionFor(m.id) : null;
    },
  );

  /** Abre o modal de palpite direto na listagem (sem navegar). */
  protected openPredictionFor(match: IMatchResponse): void {
    this.predictionError.set(null);
    this.predictionMatch.set(match);
  }

  protected closePrediction(): void {
    if (this.predictionSubmitting()) return;
    this.predictionMatch.set(null);
    this.predictionError.set(null);
  }

  protected submitPrediction(payload: IPredictionPayload): void {
    const t = this.tournament();
    const m = this.predictionMatch();
    if (!t || !m) return;

    this.predictionSubmitting.set(true);
    this.predictionError.set(null);

    this._predictionsService
      .upsertMine(t.id, m.id, {
        homeScore: payload.homeScore,
        awayScore: payload.awayScore,
      })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (prediction) => {
          this.predictionSubmitting.set(false);
          this.predictionMatch.set(null);
          // Atualiza a lista local de palpites pra refletir o chip na hora.
          this.myPredictions.update((list) => {
            const next = list ? [...list] : [];
            const idx = next.findIndex((p) => p.id === prediction.id);
            if (idx >= 0) next[idx] = prediction;
            else next.push(prediction);
            return next;
          });
        },
        error: (err: unknown) => {
          this.predictionSubmitting.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível salvar o palpite.';
          this.predictionError.set(message);
          this._toast.error(message);
        },
      });
  }

  protected joinTournament(): void {
    const t = this.tournament();
    if (!t || this.joining() || !this.canJoin()) return;

    this.joining.set(true);
    this._tournamentsService
      .join({ inviteCode: t.inviteCode })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.joining.set(false);
          this._toast.success('Você entrou no torneio!');
          this._load(t.id);
        },
        error: (err: unknown) => {
          this.joining.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível entrar no torneio.',
          );
        },
      });
  }

  protected requestLeave(): void {
    if (!this.canLeave()) return;
    this.leaveDialogOpen.set(true);
  }

  protected cancelLeave(): void {
    if (this.leaving()) return;
    this.leaveDialogOpen.set(false);
  }

  protected confirmLeave(): void {
    const tid = this.tournament()?.id;
    if (!tid || this.leaving()) return;

    this.leaving.set(true);
    this._membersService
      .leave(tid)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.leaving.set(false);
          this.leaveDialogOpen.set(false);
          this._toast.success('Você saiu do torneio.');
          void this._router.navigate(['/tournaments']);
        },
        error: (err: unknown) => {
          this.leaving.set(false);
          this.leaveDialogOpen.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível sair do torneio.',
          );
        },
      });
  }

  protected async copyCode(): Promise<void> {
    const code = this.tournament()?.inviteCode;
    if (!code) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        this._toast.success('Código copiado!');
      } else {
        this._toast.error('Seu navegador não suporta copiar automaticamente.');
      }
    } catch {
      this._toast.error('Não foi possível copiar o código.');
    }
  }

  protected requestRegenerate(): void {
    this.regenerateDialogOpen.set(true);
  }

  protected confirmRegenerate(): void {
    const t = this.tournament();
    if (!t || this.regenerating()) return;
    this.regenerating.set(true);
    this._tournamentsService
      .regenerateInviteCode(t.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (updated) => {
          this.regenerating.set(false);
          this.regenerateDialogOpen.set(false);
          this.tournament.set(updated);
          this._toast.success('Novo código gerado.');
        },
        error: (err: unknown) => {
          this.regenerating.set(false);
          this.regenerateDialogOpen.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível regenerar o código.',
          );
        },
      });
  }

  protected cancelRegenerate(): void {
    this.regenerateDialogOpen.set(false);
  }

  protected requestStatusChange(): void {
    if (this.nextStatus() === null) return;
    this.statusDialogOpen.set(true);
  }

  protected confirmStatusChange(): void {
    const t = this.tournament();
    const next = this.nextStatus();
    if (!t || !next || this.changingStatus()) return;
    this.changingStatus.set(true);
    this._tournamentsService
      .changeStatus(t.id, { targetStatus: next })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (updated) => {
          this.changingStatus.set(false);
          this.statusDialogOpen.set(false);
          this.tournament.set(updated);
          this._toast.success(`Status atualizado para ${STATUS_LABEL[next]}.`);
        },
        error: (err: unknown) => {
          this.changingStatus.set(false);
          this.statusDialogOpen.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível mudar o status.',
          );
        },
      });
  }

  protected cancelStatusChange(): void {
    this.statusDialogOpen.set(false);
  }

  protected retry(): void {
    const t = this.tournament();
    if (t) {
      this._load(t.id);
    } else {
      const id = this._route.snapshot.paramMap.get('id');
      if (id) this._load(id);
    }
  }

  private _load(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(id),
      phases: this._phasesService.list(id).pipe(catchError(() => of([]))),
      matches: this._matchesService
        .listForTournament(id)
        .pipe(catchError(() => of<IMatchResponse[]>([]))),
      ranking: this._rankingService
        .list(id)
        .pipe(catchError(() => of<IRankingRowResponse[]>([]))),
      myPredictions: this._predictionsService.listMineInTournament(id).pipe(
        catchError((err: unknown) => {
          if (err instanceof ApiException && err.isForbidden) {
            return of<IPredictionResponse[] | null>(null);
          }
          return of<IPredictionResponse[] | null>([]);
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phases, matches, ranking, myPredictions }) => {
          this.tournament.set(tournament);
          this.phases.set(
            [...phases].sort((a, b) => a.position - b.position),
          );
          this.matches.set(matches);
          this.ranking.set(ranking);
          this.myPredictions.set(myPredictions);
          this.loading.set(false);
          this._scheduleAnchorScroll();
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (err instanceof ApiException && err.isNotFound) {
            this.loadError.set('Torneio não encontrado.');
          } else if (err instanceof ApiException && err.isForbidden) {
            this.loadError.set('Você não tem acesso a este torneio.');
          } else {
            this.loadError.set(
              err instanceof ApiException
                ? err.message
                : 'Não foi possível carregar o torneio.',
            );
          }
        },
      });
  }

  private _scheduleAnchorScroll(): void {
    const anchor = this._pendingScrollAnchor;
    if (!anchor) return;
    this._pendingScrollAnchor = null;
    afterNextRender(
      () => {
        const el = document.getElementById(anchor);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          this._scroller.scrollToAnchor(anchor);
        }
      },
      { injector: this._injector },
    );
  }

  private _loadStandings(phaseId: string): void {
    const t = this.tournament();
    if (!t) return;
    this.standingsLoading.update((s) => ({ ...s, [phaseId]: true }));
    this.standingsError.update((s) => ({ ...s, [phaseId]: null }));
    this._standingsService
      .get(t.id, phaseId)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (standings) => {
          this.standingsCache.update((s) => ({ ...s, [phaseId]: standings }));
          this.standingsLoading.update((s) => ({ ...s, [phaseId]: false }));
        },
        error: (err: unknown) => {
          this.standingsLoading.update((s) => ({ ...s, [phaseId]: false }));
          this.standingsError.update((s) => ({
            ...s,
            [phaseId]:
              err instanceof ApiException
                ? err.message
                : 'Não foi possível carregar a classificação desta fase.',
          }));
        },
      });
  }

  private _loadBracket(phaseId: string): void {
    const t = this.tournament();
    if (!t) return;
    this.bracketLoading.update((s) => ({ ...s, [phaseId]: true }));
    this.bracketError.update((s) => ({ ...s, [phaseId]: null }));
    this._bracketService
      .get(t.id, phaseId)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (bracket) => {
          this.bracketCache.update((s) => ({ ...s, [phaseId]: bracket }));
          this.bracketLoading.update((s) => ({ ...s, [phaseId]: false }));
        },
        error: (err: unknown) => {
          this.bracketLoading.update((s) => ({ ...s, [phaseId]: false }));
          this.bracketError.update((s) => ({
            ...s,
            [phaseId]:
              err instanceof ApiException
                ? err.message
                : 'Não foi possível carregar o chaveamento.',
          }));
        },
      });
  }
}
