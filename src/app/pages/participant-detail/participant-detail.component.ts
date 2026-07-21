import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  OnInit,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { IPredictionResponse } from '@core/interfaces/prediction.interface';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import {
  IParticipantSummaryResponse,
  IPickemPhaseBreakdown,
} from '@core/interfaces/pickem.interface';
import { IRankingRowResponse } from '@core/interfaces/ranking.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { MatchesService } from '@core/services/matches.service';
import { PhasesService } from '@core/services/phases.service';
import { PickemService } from '@core/services/pickem.service';
import { PredictionsService } from '@core/services/predictions.service';
import { RankingService } from '@core/services/ranking.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { knockoutMatchBucketLabel } from '@core/utils/round-label';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PredictionCardComponent } from '@shared/components/prediction-card/prediction-card.component';
import { SwipeNavRegistry } from '@shared/services/swipe-nav-registry.service';
import { tabSlide } from '@shared/animations/animations';
import {
  ArrowLeftRight,
  Crown,
  LucideAngularModule,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-angular';

type ParticipantTab = 'info' | 'predictions';

interface IPredictionRow {
  prediction: IPredictionResponse;
  match: IMatchResponse;
  whenMs: number;
}

type MatchBucketKind = 'REGULAR' | 'THIRD_PLACE';
interface IBucketOption {
  key: string;
  label: string;
}
interface IGroupOption {
  id: string;
  name: string;
}

const PICKEM_COMPONENT_LABEL: Record<
  keyof IPickemPhaseBreakdown['components'],
  string
> = {
  qualifier: 'Classificados',
  exactPosition: 'Posições exatas',
  firstPlace: '1º lugar',
  koMatchupExact: 'Confrontos cravados',
  koMatchupPartial: 'Confrontos (1 time)',
  champion: 'Campeão',
  runnerUp: 'Vice',
  thirdPlace: '3º lugar',
};

interface IPickemComponentRow {
  label: string;
  value: number;
}

interface ICompareMetric {
  label: string;
  a: number;
  b: number;
  suffix?: string;
  /** maior é melhor (default true); para "erros" é false. */
  higherIsBetter?: boolean;
}

@Component({
  selector: 'app-participant-detail',
  standalone: true,
  imports: [
    LucideAngularModule,
    AvatarComponent,
    PredictionCardComponent,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participant-detail.component.html',
  styleUrl: './participant-detail.component.scss',
  animations: [tabSlide],
})
export class ParticipantDetailComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _rankingService = inject(RankingService);
  private readonly _matchesService = inject(MatchesService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _predictionsService = inject(PredictionsService);
  private readonly _pickemService = inject(PickemService);
  private readonly _authState = inject(AuthState);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _swipeReg = inject(SwipeNavRegistry);
  private readonly _injector = inject(Injector);

  private _pendingScrollAnchor: string | null = null;

  protected readonly trophyIcon = Trophy;
  protected readonly targetIcon = Target;
  protected readonly crownIcon = Crown;
  protected readonly xIcon = X;
  protected readonly sparklesIcon = Sparkles;
  protected readonly compareIcon = ArrowLeftRight;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly ranking = signal<IRankingRowResponse[]>([]);

  protected readonly backHref = computed(() => {
    const tid = this._route.snapshot.paramMap.get('id');
    return tid ? `/tournaments/${tid}` : '/tournaments';
  });
  protected readonly pageTitle = computed(() => this.participant()?.name ?? '');
  protected readonly matches = signal<IMatchResponse[]>([]);
  protected readonly phases = signal<IPhaseResponse[]>([]);
  protected readonly predictions = signal<IPredictionResponse[]>([]);
  protected readonly predictionsError = signal(false);

  /** Perfil do palpiteiro (breakdown partidas × Palpitão); null se indisponível. */
  protected readonly summary = signal<IParticipantSummaryResponse | null>(null);

  /** Mostra o card do Palpitão quando há pontos ou palpitões registrados. */
  protected readonly showPickemSummary = computed(() => {
    const s = this.summary();
    return !!s && (s.pickemPoints > 0 || s.pickemByPhase.length > 0);
  });

  protected pickemComponentRows(
    phase: IPickemPhaseBreakdown,
  ): IPickemComponentRow[] {
    const rows: IPickemComponentRow[] = [];
    for (const key of Object.keys(
      PICKEM_COMPONENT_LABEL,
    ) as (keyof IPickemPhaseBreakdown['components'])[]) {
      const value = phase.components[key];
      if (value > 0) {
        rows.push({ label: PICKEM_COMPONENT_LABEL[key], value });
      }
    }
    return rows;
  }

  protected readonly userId = signal<string>('');
  protected readonly activeTab = signal<ParticipantTab>('info');
  protected readonly compareId = signal<string | null>(null);

  // Filtros dos pitacos (mesma lógica da aba de partidas do torneio).
  protected readonly selectedPredPhaseId = signal<string | null>(null);
  protected readonly selectedPredBucketKey = signal<string | null>(null);
  protected readonly selectedPredGroupId = signal<string | null>(null);


  protected readonly participant = computed<IRankingRowResponse | null>(() => {
    const id = this.userId();
    return this.ranking().find((r) => r.userId === id) ?? null;
  });

  protected readonly isMe = computed(
    () => this.userId() === this._authState.user()?.id,
  );

  /** Aproveitamento: % de acertos sobre os pitacos já resolvidos. */
  protected readonly accuracy = computed(() => this._accuracyOf(this.participant()));

  protected readonly resolvedCount = computed(() => {
    const p = this.participant();
    if (!p) return 0;
    return p.exactScoreHits + p.winnerHits + p.wrongs;
  });

  protected readonly pointsPerPrediction = computed(() => {
    const p = this.participant();
    if (!p || p.totalPredictions === 0) return 0;
    return Math.round((p.totalPoints / p.totalPredictions) * 10) / 10;
  });

  protected readonly compareOptions = computed<IRankingRowResponse[]>(() =>
    this.ranking().filter((r) => r.userId !== this.userId()),
  );

  protected readonly compareRow = computed<IRankingRowResponse | null>(() => {
    const id = this.compareId();
    if (!id) return null;
    return this.ranking().find((r) => r.userId === id) ?? null;
  });

  protected readonly compareMetrics = computed<ICompareMetric[]>(() => {
    const a = this.participant();
    const b = this.compareRow();
    if (!a || !b) return [];
    return [
      { label: 'Pontos', a: a.totalPoints, b: b.totalPoints },
      { label: 'Placar exato', a: a.exactScoreHits, b: b.exactScoreHits },
      { label: 'Acertou vencedor', a: a.winnerHits, b: b.winnerHits },
      {
        label: 'Erros',
        a: a.wrongs,
        b: b.wrongs,
        higherIsBetter: false,
      },
      {
        label: 'Aproveitamento',
        a: this._accuracyOf(a),
        b: this._accuracyOf(b),
        suffix: '%',
      },
      {
        label: 'Pitacos',
        a: a.totalPredictions,
        b: b.totalPredictions,
      },
    ];
  });

  protected readonly predictionRows = computed<IPredictionRow[]>(() => {
    const matchById = new Map(this.matches().map((m) => [m.id, m]));
    const rows: IPredictionRow[] = [];
    for (const p of this.predictions()) {
      const match = matchById.get(p.matchId);
      if (!match) continue;
      const whenMs = match.scheduledAt
        ? new Date(match.scheduledAt).getTime()
        : 0;
      rows.push({ prediction: p, match, whenMs });
    }
    // Mais recentes primeiro; sem data por último.
    return rows.sort((x, y) => {
      if (x.whenMs === 0 && y.whenMs === 0) return 0;
      if (x.whenMs === 0) return 1;
      if (y.whenMs === 0) return -1;
      return y.whenMs - x.whenMs;
    });
  });

  // ===== Filtros dos pitacos (fase → rodada/etapa → grupo) =====

  private _phaseById(id: string): IPhaseResponse | undefined {
    return this.phases().find((p) => p.id === id);
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

  /** Fases presentes entre os pitacos do participante. */
  protected readonly predPhaseOptions = computed<IPhaseResponse[]>(() => {
    const ids = new Set(this.predictionRows().map((r) => r.match.phaseId));
    return this.phases().filter((p) => ids.has(p.id));
  });

  /** Fase usada pelos sub-filtros: a selecionada ou a única com pitacos. */
  protected readonly effectivePredPhaseId = computed<string | null>(() => {
    const sel = this.selectedPredPhaseId();
    if (sel !== null) return sel;
    const opts = this.predPhaseOptions();
    return opts.length === 1 ? opts[0]!.id : null;
  });

  protected readonly predIsGroupsPhase = computed(() => {
    const pid = this.effectivePredPhaseId();
    return !!pid && this._phaseById(pid)?.phaseType === 'GROUPS';
  });

  protected readonly predBucketOptions = computed<IBucketOption[]>(() => {
    const pid = this.effectivePredPhaseId();
    if (!pid) return [];
    const phase = this._phaseById(pid);
    const seen = new Map<
      string,
      IBucketOption & { round: number; kind: MatchBucketKind }
    >();
    for (const r of this.predictionRows()) {
      if (r.match.phaseId !== pid) continue;
      const kind = this._bucketKind(r.match, phase);
      const key = `${r.match.round}:${kind}`;
      if (seen.has(key)) continue;
      seen.set(key, {
        key,
        label: this._bucketLabel(phase, r.match.round, kind),
        round: r.match.round,
        kind,
      });
    }
    return Array.from(seen.values())
      .sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        return a.kind === b.kind ? 0 : a.kind === 'REGULAR' ? -1 : 1;
      })
      .map(({ key, label }) => ({ key, label }));
  });

  protected readonly predGroupOptions = computed<IGroupOption[]>(() => {
    const pid = this.effectivePredPhaseId();
    if (!pid || !this.predIsGroupsPhase()) return [];
    const seen = new Map<string, IGroupOption>();
    for (const r of this.predictionRows()) {
      if (r.match.phaseId !== pid) continue;
      if (!r.match.groupId || !r.match.groupName) continue;
      if (!seen.has(r.match.groupId)) {
        seen.set(r.match.groupId, {
          id: r.match.groupId,
          name: r.match.groupName,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  });

  protected readonly filteredPredictionRows = computed<IPredictionRow[]>(() => {
    let rows = this.predictionRows();
    const phaseId = this.selectedPredPhaseId();
    const bucket = this.selectedPredBucketKey();
    const group = this.selectedPredGroupId();
    if (phaseId) rows = rows.filter((r) => r.match.phaseId === phaseId);
    if (bucket) {
      rows = rows.filter((r) => {
        const kind = this._bucketKind(r.match, this._phaseById(r.match.phaseId));
        return `${r.match.round}:${kind}` === bucket;
      });
    }
    if (group) rows = rows.filter((r) => r.match.groupId === group);
    return rows;
  });

  protected selectPredPhase(id: string | null): void {
    this.selectedPredPhaseId.set(id);
    this.selectedPredBucketKey.set(null);
    this.selectedPredGroupId.set(null);
  }

  protected selectPredBucket(key: string | null): void {
    this.selectedPredBucketKey.set(key);
  }

  protected selectPredGroup(id: string | null): void {
    this.selectedPredGroupId.set(id);
  }

  public ngOnInit(): void {
    const swipe = (delta: 1 | -1) => this.swipeToTab(delta);
    this._swipeReg.set(swipe);
    this._destroyRef.onDestroy(() => this._swipeReg.clear(swipe));

    const tid = this._route.snapshot.paramMap.get('id');
    const uid = this._route.snapshot.paramMap.get('userId');

    // Voltando de um pitaco: a aba e a âncora vêm da URL (query + fragment),
    // que o navegador restaura no "voltar" — confiável em qualquer iteração.
    if (this._route.snapshot.queryParamMap.get('ptab') === 'predictions') {
      this.activeTab.set('predictions');
    }
    const fragment = this._route.snapshot.fragment;
    if (fragment) this._pendingScrollAnchor = fragment;

    if (!tid || !uid) {
      this.loading.set(false);
      this.loadError.set('Participante não encontrado.');
      return;
    }
    this.userId.set(uid);
    this._load(tid, uid);
  }

  protected setTab(tab: ParticipantTab): void {
    this.activeTab.set(tab);
  }

  private readonly _tabOrder: ParticipantTab[] = ['info', 'predictions'];

  /** Índice da aba ativa (alimenta a animação direcional do swipe). */
  protected readonly activeTabIndex = computed(() =>
    Math.max(0, this._tabOrder.indexOf(this.activeTab())),
  );

  /** Swipe: vai para a aba vizinha (delta +1 = direita, -1 = esquerda). */
  protected swipeToTab(delta: 1 | -1): void {
    const next = this.activeTabIndex() + delta;
    if (next < 0 || next >= this._tabOrder.length) return;
    this.setTab(this._tabOrder[next]);
  }

  /**
   * Carimba a entrada atual do histórico (aba + âncora) ANTES de navegar para a
   * partida. Como é gravado na URL via replaceState, o "voltar" do navegador
   * restaura tudo — funciona em todas as iterações, sem estado compartilhado.
   */
  protected rememberReturn(predictionId: string): void {
    const tid = this._route.snapshot.paramMap.get('id');
    const uid = this._route.snapshot.paramMap.get('userId');
    if (!tid || !uid) return;
    // URL absoluta (sem relativeTo) para evitar ambiguidade na entrada
    // restaurada — o "voltar" recria esta entrada com aba + âncora.
    const url = this._router.serializeUrl(
      this._router.createUrlTree(
        ['/tournaments', tid, 'participants', uid],
        { queryParams: { ptab: 'predictions' }, fragment: `pred-${predictionId}` },
      ),
    );
    this._location.replaceState(url);
  }

  /** Rola até o pitaco de origem assim que a lista renderiza. */
  private _scheduleScroll(): void {
    const anchor = this._pendingScrollAnchor;
    if (!anchor) return;
    this._pendingScrollAnchor = null;
    afterNextRender(() => this._tryScroll(anchor, 15), {
      injector: this._injector,
    });
  }

  private _tryScroll(anchor: string, attempts: number): void {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
      return;
    }
    if (attempts <= 0) return;
    requestAnimationFrame(() => this._tryScroll(anchor, attempts - 1));
  }

  protected onCompareChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.compareId.set(value || null);
  }

  protected isBetter(metric: ICompareMetric, side: 'a' | 'b'): boolean {
    const higherIsBetter = metric.higherIsBetter ?? true;
    if (metric.a === metric.b) return false;
    const aWins = higherIsBetter ? metric.a > metric.b : metric.a < metric.b;
    return side === 'a' ? aWins : !aWins;
  }

  private _accuracyOf(row: IRankingRowResponse | null): number {
    if (!row) return 0;
    const resolved = row.exactScoreHits + row.winnerHits + row.wrongs;
    if (resolved === 0) return 0;
    return Math.round(((row.exactScoreHits + row.winnerHits) / resolved) * 100);
  }

  private _load(tid: string, uid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.predictionsError.set(false);

    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      ranking: this._rankingService.list(tid),
      matches: this._matchesService
        .listForTournament(tid)
        .pipe(catchError(() => of<IMatchResponse[]>([]))),
      phases: this._phasesService.list(tid).pipe(catchError(() => of([]))),
      predictions: this._predictionsService
        .listForUserInTournament(tid, uid)
        .pipe(
          catchError(() => {
            this.predictionsError.set(true);
            return of<IPredictionResponse[]>([]);
          }),
        ),
      summary: this._pickemService
        .participantSummary(tid, uid)
        .pipe(
          catchError(() => of<IParticipantSummaryResponse | null>(null)),
        ),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, ranking, matches, phases, predictions, summary }) => {
          this.tournament.set(tournament);
          this.ranking.set(ranking);
          this.matches.set(matches);
          this.phases.set([...phases].sort((a, b) => a.position - b.position));
          this.predictions.set(predictions);
          this.summary.set(summary);
          this.loading.set(false);
          this._scheduleScroll();
          if (!ranking.some((r) => r.userId === uid)) {
            this.loadError.set(
              'Este participante ainda não aparece no ranking do torneio.',
            );
          }
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
                : 'Não foi possível carregar o participante.',
            );
          }
        },
      });
  }
}
