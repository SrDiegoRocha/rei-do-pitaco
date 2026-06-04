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
import { forkJoin } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import { IStandingsResponse } from '@core/interfaces/standings.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { MatchesService } from '@core/services/matches.service';
import { PhasesService } from '@core/services/phases.service';
import { StandingsService } from '@core/services/standings.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { listStagger } from '@shared/animations/animations';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { StandingsTableComponent } from '@shared/components/standings-table/standings-table.component';
import { ToastService } from '@shared/services/toast.service';
import {
  CheckCircle2,
  Flag,
  LucideAngularModule,
  Trophy,
} from 'lucide-angular';

@Component({
  selector: 'app-phase-standings',
  standalone: true,
  imports: [
    LucideAngularModule,
    StandingsTableComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phase-standings.component.html',
  styleUrl: './phase-standings.component.scss',
  animations: [listStagger],
})
export class PhaseStandingsComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _matchesService = inject(MatchesService);
  private readonly _standingsService = inject(StandingsService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly trophyIcon = Trophy;
  protected readonly flagIcon = Flag;
  protected readonly checkIcon = CheckCircle2;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly standings = signal<IStandingsResponse | null>(null);
  protected readonly matches = signal<IMatchResponse[]>([]);

  protected readonly finalizeDialogOpen = signal(false);
  protected readonly finalizing = signal(false);

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  protected readonly totalMatches = computed(() => this.matches().length);

  protected readonly unfinishedMatches = computed(
    () => this.matches().filter((m) => m.status === 'SCHEDULED').length,
  );

  protected readonly hasGroups = computed(() => {
    const s = this.standings();
    if (!s) return false;
    return s.groups.length > 1 || (s.groups[0]?.groupId ?? null) !== null;
  });

  protected readonly isEmpty = computed(() => {
    const s = this.standings();
    if (!s) return true;
    return s.groups.every((g) => g.rows.length === 0);
  });

  protected readonly isFinalized = computed(
    () => this.phase()?.finalizedAt != null,
  );

  protected readonly finalizedAtLabel = computed<string | null>(() => {
    const iso = this.phase()?.finalizedAt;
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  });

  protected readonly canFinalize = computed(() => {
    if (!this.isOwner()) return false;
    if (this.isFinalized()) return false;
    if (this.tournament()?.status !== 'IN_PROGRESS') return false;
    const total = this.totalMatches();
    if (total === 0) return false;
    return this.unfinishedMatches() === 0;
  });

  protected readonly finalizeBlockReason = computed(() => {
    if (!this.isOwner()) return null;
    const status = this.tournament()?.status;
    if (status === 'DRAFT' || status === 'OPEN') {
      return 'Finalize só fica disponível com o torneio em andamento.';
    }
    if (status === 'FINISHED') return null;
    if (this.totalMatches() === 0) {
      return 'Nenhuma partida nesta fase. Gere ou crie partidas antes de finalizar.';
    }
    const pending = this.unfinishedMatches();
    if (pending > 0) {
      return `Ainda há ${pending} partida${pending === 1 ? '' : 's'} sem resultado. Lance ou cancele antes de finalizar.`;
    }
    return null;
  });

  public ngOnInit(): void {
    const tid = this._route.snapshot.paramMap.get('id');
    const pid = this._route.snapshot.paramMap.get('pid');
    if (!tid || !pid) {
      this.loading.set(false);
      this.loadError.set('Fase não encontrada.');
      return;
    }
    this._load(tid, pid);
  }

  protected openFinalizeDialog(): void {
    if (!this.canFinalize()) return;
    this.finalizeDialogOpen.set(true);
  }

  protected closeFinalizeDialog(): void {
    if (this.finalizing()) return;
    this.finalizeDialogOpen.set(false);
  }

  protected confirmFinalize(): void {
    const t = this.tournament();
    const p = this.phase();
    if (!t || !p) return;

    this.finalizing.set(true);
    this._standingsService
      .finalize(t.id, p.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.finalizing.set(false);
          this.finalizeDialogOpen.set(false);
          this.standings.set(result);
          this._toast.success('Fase finalizada. Próxima fase populada.');
          this._phasesService
            .getById(t.id, p.id)
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe({
              next: (fresh) => this.phase.set(fresh),
            });
        },
        error: (err: unknown) => {
          this.finalizing.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível finalizar a fase.';
          this._toast.error(message);
        },
      });
  }

  private _load(tid: string, pid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      standings: this._standingsService.get(tid, pid),
      matches: this._matchesService.list(tid, pid),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, standings, matches }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.standings.set(standings);
          this.matches.set(matches);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (err instanceof ApiException && err.isNotFound) {
            this.loadError.set('Fase não encontrada.');
          } else if (err instanceof ApiException && err.isForbidden) {
            this.loadError.set('Você não tem acesso a esta fase.');
          } else if (err instanceof ApiException && err.isConflict) {
            this.loadError.set(
              'Esta fase é mata-mata. Use o chaveamento.',
            );
          } else {
            this.loadError.set(
              err instanceof ApiException
                ? err.message
                : 'Não foi possível carregar a classificação.',
            );
          }
        },
      });
  }
}
