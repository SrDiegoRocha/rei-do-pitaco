import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { IPredictionResponse } from '@core/interfaces/prediction.interface';
import { IRankingRowResponse } from '@core/interfaces/ranking.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { MatchesService } from '@core/services/matches.service';
import { PredictionsService } from '@core/services/predictions.service';
import { RankingService } from '@core/services/ranking.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
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
  private readonly _predictionsService = inject(PredictionsService);
  private readonly _authState = inject(AuthState);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _swipeReg = inject(SwipeNavRegistry);

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
  protected readonly matches = signal<IMatchResponse[]>([]);
  protected readonly predictions = signal<IPredictionResponse[]>([]);
  protected readonly predictionsError = signal(false);

  protected readonly userId = signal<string>('');
  protected readonly activeTab = signal<ParticipantTab>('info');
  protected readonly compareId = signal<string | null>(null);


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

  public ngOnInit(): void {
    const swipe = (delta: 1 | -1) => this.swipeToTab(delta);
    this._swipeReg.set(swipe);
    this._destroyRef.onDestroy(() => this._swipeReg.clear(swipe));

    const tid = this._route.snapshot.paramMap.get('id');
    const uid = this._route.snapshot.paramMap.get('userId');
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
      predictions: this._predictionsService
        .listForUserInTournament(tid, uid)
        .pipe(
          catchError(() => {
            this.predictionsError.set(true);
            return of<IPredictionResponse[]>([]);
          }),
        ),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, ranking, matches, predictions }) => {
          this.tournament.set(tournament);
          this.ranking.set(ranking);
          this.matches.set(matches);
          this.predictions.set(predictions);
          this.loading.set(false);
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
