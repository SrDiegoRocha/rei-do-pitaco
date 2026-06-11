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
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { IPredictionResponse } from '@core/interfaces/prediction.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { MatchesService } from '@core/services/matches.service';
import { PhasesService } from '@core/services/phases.service';
import { PredictionsService } from '@core/services/predictions.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { listStagger } from '@shared/animations/animations';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { ChevronRight, LucideAngularModule, Sparkles } from 'lucide-angular';

interface IUpcomingMatch {
  tournament: ITournamentResponse;
  phaseId: string;
  match: IMatchResponse;
  hasPrediction: boolean;
  hoursUntil: number;
}

@Component({
  selector: 'app-upcoming-predictions',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeaderComponent,
    TeamBadgeComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './upcoming-predictions.component.html',
  styleUrl: './upcoming-predictions.component.scss',
  animations: [listStagger],
})
export class UpcomingPredictionsComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _matchesService = inject(MatchesService);
  private readonly _predictionsService = inject(PredictionsService);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly sparklesIcon = Sparkles;
  protected readonly chevronRightIcon = ChevronRight;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<unknown>(null);
  protected readonly upcoming = signal<IUpcomingMatch[]>([]);

  protected readonly pendingCount = computed(
    () => this.upcoming().filter((u) => !u.hasPrediction).length,
  );

  public ngOnInit(): void {
    this._load();
  }

  protected retry(): void {
    this._load();
  }

  protected matchLink(item: IUpcomingMatch): unknown[] {
    return [
      '/tournaments',
      item.tournament.id,
      'phases',
      item.phaseId,
      'matches',
      item.match.id,
    ];
  }

  protected countdownLabel(hoursUntil: number): string {
    if (hoursUntil < 1) {
      const minutes = Math.max(1, Math.round(hoursUntil * 60));
      return `em ${minutes} min`;
    }
    if (hoursUntil < 24) {
      const h = Math.round(hoursUntil);
      return `em ${h}h`;
    }
    const days = Math.round(hoursUntil / 24);
    return `em ${days} dia${days === 1 ? '' : 's'}`;
  }

  protected scheduledLabel(iso: string | null): string {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  private _load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      mine: this._tournamentsService.listMine({ page: 0, size: 100 }).pipe(
        catchError(() => of({ content: [] as ITournamentResponse[] })),
        map((r) => r.content),
      ),
      joined: this._tournamentsService.listJoined({ page: 0, size: 100 }).pipe(
        catchError(() => of({ content: [] as ITournamentResponse[] })),
        map((r) => r.content),
      ),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ mine, joined }) => {
          const dedup = new Map<string, ITournamentResponse>();
          for (const t of [...mine, ...joined]) dedup.set(t.id, t);
          const active = Array.from(dedup.values()).filter(
            (t) => t.status === 'IN_PROGRESS',
          );
          if (active.length === 0) {
            this.upcoming.set([]);
            this.loading.set(false);
            return;
          }
          this._loadMatchesForTournaments(active);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.loadError.set(err);
        },
      });
  }

  private _loadMatchesForTournaments(
    tournaments: ITournamentResponse[],
  ): void {
    const calls = tournaments.map((tournament) =>
      forkJoin({
        phases: this._phasesService.list(tournament.id).pipe(
          catchError(() => of([])),
        ),
        predictions: this._predictionsService
          .listMineInTournament(tournament.id)
          .pipe(catchError(() => of<IPredictionResponse[]>([]))),
      }).pipe(
        map((res) => ({
          tournament,
          phases: res.phases,
          predictions: res.predictions,
        })),
      ),
    );

    forkJoin(calls)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (results) => {
          const allCalls = results.flatMap((entry) =>
            entry.phases.map((phase) =>
              this._matchesService.list(entry.tournament.id, phase.id).pipe(
                catchError(() => of<IMatchResponse[]>([])),
                map((matches) => ({
                  tournament: entry.tournament,
                  phaseId: phase.id,
                  predictions: entry.predictions,
                  matches,
                })),
              ),
            ),
          );
          if (allCalls.length === 0) {
            this.upcoming.set([]);
            this.loading.set(false);
            return;
          }
          forkJoin(allCalls)
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe({
              next: (matchBatches) => {
                const now = Date.now();
                const items: IUpcomingMatch[] = [];
                for (const batch of matchBatches) {
                  const predIds = new Set(
                    batch.predictions.map((p) => p.matchId),
                  );
                  for (const match of batch.matches) {
                    if (match.status !== 'SCHEDULED') continue;
                    if (!match.scheduledAt) continue;
                    const t = new Date(match.scheduledAt).getTime();
                    if (Number.isNaN(t)) continue;
                    if (t <= now) continue;
                    const hoursUntil = (t - now) / (1000 * 60 * 60);
                    if (hoursUntil > 168) continue;
                    items.push({
                      tournament: batch.tournament,
                      phaseId: batch.phaseId,
                      match,
                      hasPrediction: predIds.has(match.id),
                      hoursUntil,
                    });
                  }
                }
                items.sort((a, b) => a.hoursUntil - b.hoursUntil);
                this.upcoming.set(items);
                this.loading.set(false);
              },
              error: () => {
                this.upcoming.set([]);
                this.loading.set(false);
              },
            });
        },
        error: () => {
          this.upcoming.set([]);
          this.loading.set(false);
        },
      });
  }
}
