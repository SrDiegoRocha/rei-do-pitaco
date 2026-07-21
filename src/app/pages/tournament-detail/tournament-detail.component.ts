import {ViewportScroller} from '@angular/common';
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
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {catchError, forkJoin, map, of} from 'rxjs';
import {AuthState} from '@core/auth/auth-state';
import {ApiException} from '@core/errors/api-error';
import {TiebreakCriteria, TournamentStatus,} from '@core/interfaces/enums';
import {IMatchResponse} from '@core/interfaces/match.interface';
import {IPhaseResponse} from '@core/interfaces/phase.interface';
import {IPredictionResponse} from '@core/interfaces/prediction.interface';
import {
  IRankingFilterParams,
  IRankingRowResponse,
} from '@core/interfaces/ranking.interface';
import {IStandingsResponse} from '@core/interfaces/standings.interface';
import {IBracketResponse} from '@core/interfaces/bracket.interface';
import {
  IPhasePredictionResponse,
  IPhasePredictionTemplateResponse,
} from '@core/interfaces/pickem.interface';
import {ITournamentResponse} from '@core/interfaces/tournament.interface';
import {BracketService} from '@core/services/bracket.service';
import {PickemService} from '@core/services/pickem.service';
import {MatchesService} from '@core/services/matches.service';
import {PhasesService} from '@core/services/phases.service';
import {PredictionsService} from '@core/services/predictions.service';
import {RankingService} from '@core/services/ranking.service';
import {StandingsService} from '@core/services/standings.service';
import {TournamentMembersService} from '@core/services/tournament-members.service';
import {TournamentReturnService} from '@core/services/tournament-return.service';
import {TournamentsService} from '@core/services/tournaments.service';
import {knockoutMatchBucketLabel} from '@core/utils/round-label';
import {AvatarComponent} from '@shared/components/avatar/avatar.component';
import {ButtonComponent} from '@shared/components/button/button.component';
import {ConfirmDialogComponent} from '@shared/components/confirm-dialog/confirm-dialog.component';
import {EmptyStateComponent} from '@shared/components/empty-state/empty-state.component';
import {ErrorStateComponent} from '@shared/components/error-state/error-state.component';
import {BracketViewComponent, BracketViewMode} from '@shared/components/bracket-view/bracket-view.component';
import {MatchRowComponent} from '@shared/components/match-row/match-row.component';
import {PredictionCardComponent} from '@shared/components/prediction-card/prediction-card.component';
import {
  IPredictionPayload,
  PredictionDialogComponent,
} from '@shared/components/prediction-dialog/prediction-dialog.component';
import {StandingsTableComponent} from '@shared/components/standings-table/standings-table.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {CenterActiveTabDirective} from '@shared/directives/center-active-tab.directive';
import {SwipeNavRegistry} from '@shared/services/swipe-nav-registry.service';
import {tabSlide} from '@shared/animations/animations';
import {ToastService} from '@shared/services/toast.service';
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
      'Ao iniciar, a privacidade não poderá mais ser alterada e os pitacos começam a contar pontos.',
    confirmLabel: 'Iniciar',
    variant: 'default',
    buttonLabel: 'Iniciar torneio',
    buttonIcon: 'play',
  },
  IN_PROGRESS: {
    title: 'Encerrar torneio?',
    description:
      'Após encerrar, nada mais pode ser modificado: resultados, pitacos e configurações ficam congelados.',
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
const TAB_PICKEM = 'pickem';
const TAB_MY_PREDICTIONS = 'predictions';

const PHASE_TYPE_SHORT_LABEL: Record<string, string> = {
  ROUND_ROBIN: 'Pontos corridos',
  GROUPS: 'Fase de grupos',
  KNOCKOUT: 'Mata-mata',
};

/** Estado do Palpitão de uma fase, para os cards da aba e o banner. */
interface IPickemPhaseOverview {
  template: IPhasePredictionTemplateResponse | null;
  mine: IPhasePredictionResponse | null;
}

const MATCHES_PHASE_KEY = 'reidopitaco.tMatches.phase';
const MATCHES_BUCKET_KEY = 'reidopitaco.tMatches.bucket';
const MATCHES_GROUP_KEY = 'reidopitaco.tMatches.group';
const RANKING_PHASE_KEY = 'reidopitaco.tRanking.phase';
const RANKING_GROUP_KEY = 'reidopitaco.tRanking.group';
const RANKING_BUCKET_KEY = 'reidopitaco.tRanking.bucket';
const BRACKET_MODE_KEY = 'reidopitaco.bracketViewMode';

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage indisponível — só não persiste.
  }
}

const TAB_INFO = 'info';
const PHASE_TAB_PREFIX = 'phase-';

@Component({
  selector: 'app-tournament-detail',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
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
    CenterActiveTabDirective,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tournament-detail.component.html',
  styleUrl: './tournament-detail.component.scss',
  animations: [tabSlide],
})
export class TournamentDetailComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _matchesService = inject(MatchesService);
  private readonly _rankingService = inject(RankingService);
  private readonly _predictionsService = inject(PredictionsService);
  private readonly _standingsService = inject(StandingsService);
  private readonly _bracketService = inject(BracketService);
  private readonly _pickemService = inject(PickemService);
  private readonly _membersService = inject(TournamentMembersService);
  private readonly _returnService = inject(TournamentReturnService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _scroller = inject(ViewportScroller);
  private readonly _injector = inject(Injector);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _swipeReg = inject(SwipeNavRegistry);
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
  // Guarda o erro bruto (ApiException, string custom ou outro) para o
  // error-state derivar a mensagem amigável e detectar sessão expirada.
  protected readonly loadError = signal<unknown>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);

  /** Mensagem específica do recurso; sessão expirada (401/403) é tratada pelo error-state. */
  protected readonly loadErrorMessage = computed(() => {
    const err = this.loadError();
    if (typeof err === 'string') return err;
    if (err instanceof ApiException && err.isNotFound) {
      return 'Torneio não encontrado.';
    }
    return '';
  });

  protected readonly pageTitle = computed(() => this.tournament()?.name ?? '');
  protected readonly phases = signal<IPhaseResponse[]>([]);
  protected readonly matches = signal<IMatchResponse[]>([]);
  protected readonly ranking = signal<IRankingRowResponse[]>([]);
  protected readonly myPredictions = signal<IPredictionResponse[] | null>(null);

  protected readonly activeTab = signal<string>(TAB_RANKING);

  protected readonly standingsCache = signal<
    Record<string, IStandingsResponse>
  >({});
  protected readonly standingsLoading = signal<Record<string, boolean>>({});
  protected readonly standingsError = signal<Record<string, unknown>>({});

  protected readonly bracketCache = signal<Record<string, IBracketResponse>>({});
  protected readonly bracketLoading = signal<Record<string, boolean>>({});
  protected readonly bracketError = signal<Record<string, unknown>>({});

  protected readonly bracketViewMode = signal<BracketViewMode>(
    readStored(BRACKET_MODE_KEY) === 'cards' ? 'cards' : 'tree',
  );

  // ── Palpitão (Pick'em de fase) ─────────────────────────────────────────
  protected readonly pickemOverview = signal<
    Record<string, IPickemPhaseOverview>
  >({});
  protected readonly pickemLoading = signal(false);
  protected readonly pickemLoaded = signal(false);

  // Filtros da aba de partidas persistidos; validados após a carga em
  // _validateMatchesFilters (IDs de fase/grupo são específicos do torneio).
  protected readonly selectedMatchesPhaseId = signal<string | null>(
    readStored(MATCHES_PHASE_KEY),
  );
  protected readonly selectedMatchesBucketKey = signal<string | null>(
    readStored(MATCHES_BUCKET_KEY),
  );
  protected readonly selectedMatchesGroupId = signal<string | null>(
    readStored(MATCHES_GROUP_KEY),
  );

  // Filtros da aba de ranking — mesma ideia da aba de partidas, mas o recorte
  // é feito no servidor (re-fetch), pois o ranking é agregado. Validados após
  // a carga em _validateRankingFilters.
  protected readonly selectedRankingPhaseId = signal<string | null>(
    readStored(RANKING_PHASE_KEY),
  );
  protected readonly selectedRankingGroupId = signal<string | null>(
    readStored(RANKING_GROUP_KEY),
  );
  protected readonly selectedRankingBucketKey = signal<string | null>(
    readStored(RANKING_BUCKET_KEY),
  );
  protected readonly rankingLoading = signal(false);

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
    const t = this.tournament();
    const list: ITab[] = [
      {id: TAB_RANKING, label: 'Ranking'},
      {id: TAB_MATCHES, label: 'Partidas'},
    ];
    // O Palpitão só faz sentido com o torneio rolando (ou para revisitar
    // depois de terminado) — antes disso a aba seria só um aviso vazio.
    if (t && (t.status === 'IN_PROGRESS' || t.status === 'FINISHED')) {
      list.push({id: TAB_PICKEM, label: 'Palpitão'});
    }
    list.push(
      ...phases.map((p) => ({
        id: `${PHASE_TAB_PREFIX}${p.id}`,
        label: p.name,
      })),
    );
    if (this.isActiveMember()) {
      list.push({id: TAB_MY_PREDICTIONS, label: 'Meus pitacos'});
    }
    list.push({id: TAB_INFO, label: 'Detalhes'});
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
        .map(({key, label}) => ({key, label}));
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
        seen.set(m.groupId, {id: m.groupId, name: m.groupName});
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
    writeStored(MATCHES_PHASE_KEY, phaseId);
    // Trocar de fase zera os sub-filtros.
    this.selectedMatchesBucketKey.set(null);
    this.selectedMatchesGroupId.set(null);
    writeStored(MATCHES_BUCKET_KEY, null);
    writeStored(MATCHES_GROUP_KEY, null);
  }

  protected selectMatchesBucket(key: string | null): void {
    this.selectedMatchesBucketKey.set(key);
    writeStored(MATCHES_BUCKET_KEY, key);
  }

  protected selectMatchesGroup(groupId: string | null): void {
    this.selectedMatchesGroupId.set(groupId);
    writeStored(MATCHES_GROUP_KEY, groupId);
  }

  /**
   * Descarta filtros persistidos que não existem no torneio/fase atual (os IDs
   * de fase e grupo são específicos do torneio) — evita filtro vazio. Valida na
   * ordem fase → bucket → grupo, pois os sub-filtros dependem da fase efetiva.
   */
  private _validateMatchesFilters(): void {
    const phase = this.selectedMatchesPhaseId();
    if (phase !== null && !this.matchesPhaseOptions().some((p) => p.id === phase)) {
      this.selectedMatchesPhaseId.set(null);
    }
    const bucket = this.selectedMatchesBucketKey();
    if (
      bucket !== null &&
      !this.matchesBucketOptions().some((b) => b.key === bucket)
    ) {
      this.selectedMatchesBucketKey.set(null);
    }
    const group = this.selectedMatchesGroupId();
    if (
      group !== null &&
      !this.matchesGroupOptions().some((g) => g.id === group)
    ) {
      this.selectedMatchesGroupId.set(null);
    }
  }

  // ── Filtros do ranking ─────────────────────────────────────────────
  // As opções de fase são as mesmas da aba de partidas (fases com partidas).

  /** Fase usada pelos sub-filtros do ranking (selecionada ou fase única). */
  protected readonly effectiveRankingPhaseId = computed<string | null>(() => {
    const selected = this.selectedRankingPhaseId();
    if (selected !== null) return selected;
    const opts = this.matchesPhaseOptions();
    return opts.length === 1 ? opts[0]!.id : null;
  });

  protected readonly selectedRankingPhase = computed<IPhaseResponse | null>(
    () => {
      const pid = this.effectiveRankingPhaseId();
      if (!pid) return null;
      return this.phases().find((p) => p.id === pid) ?? null;
    },
  );

  protected readonly rankingPhaseIsGroups = computed(
    () => this.selectedRankingPhase()?.phaseType === 'GROUPS',
  );

  /**
   * Rodadas/etapas da fase efetiva, como "baldes" round+tipo. Em mata-mata a
   * Final e a Disputa de 3º lugar (mesma rodada) viram baldes separados — igual
   * à aba de partidas. O recorte de tipo é enviado via `matchType` (ver
   * _rankingFilterParams / FILTER_CHANGES.md).
   */
  protected readonly rankingBucketOptions = computed<IBucketFilterOption[]>(
    () => {
      const pid = this.effectiveRankingPhaseId();
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
        .map(({key, label}) => ({key, label}));
    },
  );

  /** Grupos da fase efetiva — só em fase de grupos. */
  protected readonly rankingGroupOptions = computed<IGroupFilterOption[]>(
    () => {
      const pid = this.effectiveRankingPhaseId();
      if (!pid || !this.rankingPhaseIsGroups()) return [];
      const seen = new Map<string, IGroupFilterOption>();
      for (const m of this.matches()) {
        if (m.phaseId !== pid) continue;
        if (!m.groupId || !m.groupName) continue;
        if (!seen.has(m.groupId)) {
          seen.set(m.groupId, {id: m.groupId, name: m.groupName});
        }
      }
      return Array.from(seen.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    },
  );

  protected readonly rankingHasActiveFilter = computed(
    () =>
      this.selectedRankingPhaseId() !== null ||
      this.selectedRankingGroupId() !== null ||
      this.selectedRankingBucketKey() !== null,
  );

  protected selectRankingPhase(phaseId: string | null): void {
    this.selectedRankingPhaseId.set(phaseId);
    writeStored(RANKING_PHASE_KEY, phaseId);
    // Trocar de fase zera os sub-filtros (grupo/rodada pertencem à fase).
    this.selectedRankingGroupId.set(null);
    this.selectedRankingBucketKey.set(null);
    writeStored(RANKING_GROUP_KEY, null);
    writeStored(RANKING_BUCKET_KEY, null);
    this._loadRanking();
  }

  protected selectRankingGroup(groupId: string | null): void {
    this.selectedRankingGroupId.set(groupId);
    writeStored(RANKING_GROUP_KEY, groupId);
    this._loadRanking();
  }

  protected selectRankingBucket(key: string | null): void {
    this.selectedRankingBucketKey.set(key);
    writeStored(RANKING_BUCKET_KEY, key);
    this._loadRanking();
  }

  private _rankingFilterParams(): IRankingFilterParams {
    // A aba de ranking lista apenas membros ativos — esconde quem saiu/foi banido.
    const params: IRankingFilterParams = { memberStatus: 'ACTIVE' };
    const pid = this.effectiveRankingPhaseId();
    if (pid) params.phaseId = pid;
    const gid = this.selectedRankingGroupId();
    if (gid) params.groupId = gid;
    const bucket = this.selectedRankingBucketKey();
    if (bucket !== null) {
      const [roundStr, kind] = bucket.split(':');
      const round = Number(roundStr);
      if (Number.isFinite(round)) params.round = round;
      // matchType só quando a rodada tem Final + Disputa de 3º (rodada
      // "dividida"); aí é preciso distinguir os dois recortes. Em rodadas
      // normais o `round` já basta. Ver FILTER_CHANGES.md.
      const sameRound = this.rankingBucketOptions().filter((o) =>
        o.key.startsWith(`${round}:`),
      );
      if (sameRound.length > 1 && (kind === 'REGULAR' || kind === 'THIRD_PLACE')) {
        params.matchType = kind;
      }
    }
    return params;
  }

  /** Re-busca o ranking no servidor com os filtros atuais. */
  private _loadRanking(): void {
    const t = this.tournament();
    if (!t) return;
    this.rankingLoading.set(true);
    this._rankingService
      .list(t.id, this._rankingFilterParams())
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (rows) => {
          this.ranking.set(rows);
          this.rankingLoading.set(false);
        },
        error: () => {
          this.ranking.set([]);
          this.rankingLoading.set(false);
        },
      });
  }

  /** Descarta filtros de ranking persistidos que não existem mais. */
  private _validateRankingFilters(): void {
    const phase = this.selectedRankingPhaseId();
    if (
      phase !== null &&
      !this.matchesPhaseOptions().some((p) => p.id === phase)
    ) {
      this.selectedRankingPhaseId.set(null);
      writeStored(RANKING_PHASE_KEY, null);
    }
    const group = this.selectedRankingGroupId();
    if (
      group !== null &&
      !this.rankingGroupOptions().some((g) => g.id === group)
    ) {
      this.selectedRankingGroupId.set(null);
      writeStored(RANKING_GROUP_KEY, null);
    }
    const bucket = this.selectedRankingBucketKey();
    if (
      bucket !== null &&
      !this.rankingBucketOptions().some((b) => b.key === bucket)
    ) {
      this.selectedRankingBucketKey.set(null);
      writeStored(RANKING_BUCKET_KEY, null);
    }
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
        bucket = {id: m.groupId, name: m.groupName, matches: []};
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
    if (phase?.phaseType === 'KNOCKOUT') {
      return knockoutMatchBucketLabel(
        round,
        kind === 'THIRD_PLACE',
        phase.teamCount,
        phase.matchLegMode,
        phase.finalLegMode,
      );
    }
    if (kind === 'THIRD_PLACE') return 'Disputa de 3º lugar';
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

  protected readonly activeStandingsError = computed<unknown>(() => {
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

  protected readonly activeBracketError = computed<unknown>(() => {
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

    // Aba Palpitão: carrega o estado por fase na primeira visita.
    effect(() => {
      if (this.activeTab() !== TAB_PICKEM) return;
      if (this.pickemLoaded() || this.pickemLoading()) return;
      if (!this.tournament()) return;
      this._loadPickemOverview();
    });
  }

  protected setBracketViewMode(mode: BracketViewMode): void {
    this.bracketViewMode.set(mode);
    writeStored(BRACKET_MODE_KEY, mode);
  }

  /** Lembra o confronto clicado no chaveamento para voltar à fase e rolar até ele. */
  protected rememberBracketReturn(matchId: string, phaseId: string): void {
    this.rememberReturn(`match-${matchId}`, `${PHASE_TAB_PREFIX}${phaseId}`);
  }

  public ngOnInit(): void {
    const swipe = (delta: 1 | -1) => this.swipeToTab(delta);
    this._swipeReg.set(swipe);
    this._destroyRef.onDestroy(() => this._swipeReg.clear(swipe));

    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.loadError.set('Torneio não encontrado.');
      return;
    }
    // Abas sempre existentes (independem de dados carregados). As de fase são
    // dinâmicas e validadas contra tabs().
    const staticTabs = [
      TAB_RANKING,
      TAB_MATCHES,
      TAB_PICKEM,
      TAB_MY_PREDICTIONS,
      TAB_INFO,
    ];
    this._route.queryParamMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const requested = params.get('tab');
        if (!requested) {
          this.activeTab.set(TAB_RANKING);
          return;
        }
        // Aceita aba estática mesmo antes do load (ex.: "Meus pitacos" só entra
        // em tabs() após isActiveMember) — evita cair em Ranking na corrida.
        const valid =
          staticTabs.includes(requested) ||
          this.tabs().some((t) => t.id === requested);
        this.activeTab.set(valid ? requested : TAB_RANKING);
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
        queryParams: {tab: returnTarget.tab},
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

  /** Lembra a partida clicada para rolar até ela ao voltar. */
  protected rememberMatchReturn(match: IMatchResponse): void {
    this.rememberReturn(`match-${match.id}`, TAB_MATCHES);
  }

  /** Lembra o pitaco clicado (aba Meus pitacos) para rolar até ele ao voltar. */
  protected rememberMyPredReturn(predictionId: string): void {
    this.rememberReturn(`pred-${predictionId}`, TAB_MY_PREDICTIONS);
  }

  protected selectTab(id: string): void {
    this.activeTab.set(id);
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: {tab: id},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected isTabActive(id: string): boolean {
    return this.activeTab() === id;
  }

  /** Índice da aba ativa na ordem visível (alimenta a animação direcional). */
  protected readonly activeTabIndex = computed(() => {
    const idx = this.tabs().findIndex((t) => t.id === this.activeTab());
    return idx < 0 ? 0 : idx;
  });

  /** Swipe: vai para a aba vizinha (delta +1 = direita, -1 = esquerda). */
  protected swipeToTab(delta: 1 | -1): void {
    const tabs = this.tabs();
    const next = this.activeTabIndex() + delta;
    if (next < 0 || next >= tabs.length) return;
    this.selectTab(tabs[next].id);
  }

  protected tiebreakLabel(criterion: TiebreakCriteria): string {
    return TIEBREAK_LABEL[criterion];
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

  // Apoio ao palpite de pênaltis no modal aberto direto na listagem.
  protected readonly predictionPenaltyEligible = computed(
    () => this.predictionMatch()?.penaltyShootoutEligible === true,
  );
  protected readonly predictionAggregateBeforeHome = computed(
    () => this.predictionMatch()?.aggregateBeforeHome ?? 0,
  );
  protected readonly predictionAggregateBeforeAway = computed(
    () => this.predictionMatch()?.aggregateBeforeAway ?? 0,
  );
  protected readonly predictionTwoLegged = computed(
    // Modo EFETIVO da partida — a rodada final pode ter modo próprio
    // (`finalLegMode` da fase), então não se usa o matchLegMode da fase.
    () => this.predictionMatch()?.matchLegMode === 'TWO_LEGGED',
  );

  /** Abre o modal de pitaco direto na listagem (sem navegar). */
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
      .upsertMine(t.id, m.id, payload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (prediction) => {
          this.predictionSubmitting.set(false);
          this.predictionMatch.set(null);
          // Atualiza a lista local de pitacos pra refletir o chip na hora.
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
              : 'Não foi possível salvar o pitaco.';
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
      .join({inviteCode: t.inviteCode})
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
      .changeStatus(t.id, {targetStatus: next})
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
        .list(id, { memberStatus: 'ACTIVE' })
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
        next: ({tournament, phases, matches, ranking, myPredictions}) => {
          this.tournament.set(tournament);
          this.phases.set(
            [...phases].sort((a, b) => a.position - b.position),
          );
          this.matches.set(matches);
          this.ranking.set(ranking);
          this.myPredictions.set(myPredictions);
          this._validateMatchesFilters();
          this._validateRankingFilters();
          this.loading.set(false);
          this._scheduleAnchorScroll();
          // O forkJoin trouxe o ranking sem filtro; se há filtro persistido
          // válido, re-busca o recorte correspondente.
          if (this.rankingHasActiveFilter()) {
            this._loadRanking();
          }
          // Palpitão: em torneio rolando o estado é carregado já na entrada
          // (alimenta o banner de CTA além da aba).
          this.pickemLoaded.set(false);
          this.pickemOverview.set({});
          if (tournament.status === 'IN_PROGRESS') {
            this._loadPickemOverview();
          }
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.loadError.set(err);
        },
      });
  }

  private _scheduleAnchorScroll(): void {
    const anchor = this._pendingScrollAnchor;
    if (!anchor) return;
    this._pendingScrollAnchor = null;
    afterNextRender(
      () => this._tryScrollToAnchor(anchor, 15),
      {injector: this._injector},
    );
  }

  /**
   * Rola até a âncora; se o elemento ainda não renderizou (a aba/lista pode
   * montar um frame depois), tenta de novo por alguns frames antes de desistir.
   */
  private _tryScrollToAnchor(anchor: string, attempts: number): void {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({behavior: 'auto', block: 'center'});
      return;
    }
    if (attempts <= 0) {
      this._scroller.scrollToAnchor(anchor);
      return;
    }
    requestAnimationFrame(() => this._tryScrollToAnchor(anchor, attempts - 1));
  }

  private _loadStandings(phaseId: string): void {
    const t = this.tournament();
    if (!t) return;
    this.standingsLoading.update((s) => ({...s, [phaseId]: true}));
    this.standingsError.update((s) => ({...s, [phaseId]: null}));
    this._standingsService
      .get(t.id, phaseId)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (standings) => {
          this.standingsCache.update((s) => ({...s, [phaseId]: standings}));
          this.standingsLoading.update((s) => ({...s, [phaseId]: false}));
        },
        error: (err: unknown) => {
          this.standingsLoading.update((s) => ({...s, [phaseId]: false}));
          this.standingsError.update((s) => ({...s, [phaseId]: err}));
        },
      });
  }

  // ── Palpitão (Pick'em de fase) ─────────────────────────────────────────

  /** CTA para a primeira fase com Palpitão aberto que o usuário não preencheu. */
  protected readonly pickemBanner = computed<{
    phaseId: string;
    phaseName: string;
  } | null>(() => {
    if (!this.isActiveMember()) return null;
    if (this.tournament()?.status !== 'IN_PROGRESS') return null;
    if (this.activeTab() === TAB_PICKEM) return null;
    const overview = this.pickemOverview();
    for (const phase of this.phases()) {
      const ov = overview[phase.id];
      if (ov?.template?.state === 'OPEN' && !ov.mine) {
        return {phaseId: phase.id, phaseName: phase.name};
      }
    }
    return null;
  });

  protected pickemHref(phaseId: string): unknown[] {
    const t = this.tournament();
    return t
      ? ['/tournaments', t.id, 'phases', phaseId, 'pickem']
      : ['/tournaments'];
  }

  protected pickemOverviewFor(phaseId: string): IPickemPhaseOverview | null {
    return this.pickemOverview()[phaseId] ?? null;
  }

  protected phaseTypeShortLabel(phase: IPhaseResponse): string {
    return PHASE_TYPE_SHORT_LABEL[phase.phaseType] ?? phase.phaseType;
  }

  protected pickemLockAtLabel(
    template: IPhasePredictionTemplateResponse | null,
  ): string | null {
    const iso = template?.lockAt;
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
  }

  private _loadPickemOverview(): void {
    const t = this.tournament();
    if (!t || this.pickemLoading()) return;
    const phases = this.phases();
    if (phases.length === 0) {
      this.pickemOverview.set({});
      this.pickemLoaded.set(true);
      return;
    }
    this.pickemLoading.set(true);
    forkJoin(
      phases.map((p) =>
        forkJoin({
          template: this._pickemService.template(t.id, p.id).pipe(
            catchError(() =>
              of<IPhasePredictionTemplateResponse | null>(null),
            ),
          ),
          mine: this._pickemService.getMine(t.id, p.id).pipe(
            catchError(() => of<IPhasePredictionResponse | null>(null)),
          ),
        }).pipe(map((ov) => [p.id, ov] as const)),
      ),
    )
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (entries) => {
          this.pickemOverview.set(Object.fromEntries(entries));
          this.pickemLoading.set(false);
          this.pickemLoaded.set(true);
        },
        error: () => {
          this.pickemLoading.set(false);
          this.pickemLoaded.set(true);
        },
      });
  }

  private _loadBracket(phaseId: string): void {
    const t = this.tournament();
    if (!t) return;
    this.bracketLoading.update((s) => ({...s, [phaseId]: true}));
    this.bracketError.update((s) => ({...s, [phaseId]: null}));
    this._bracketService
      .get(t.id, phaseId)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (bracket) => {
          this.bracketCache.update((s) => ({...s, [phaseId]: bracket}));
          this.bracketLoading.update((s) => ({...s, [phaseId]: false}));
        },
        error: (err: unknown) => {
          this.bracketLoading.update((s) => ({...s, [phaseId]: false}));
          this.bracketError.update((s) => ({...s, [phaseId]: err}));
        },
      });
  }
}
