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
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { ApiException } from '@core/errors/api-error';
import { IBracketResponse } from '@core/interfaces/bracket.interface';
import {
  IMatchResponse,
  IUpdateMatchRequest,
} from '@core/interfaces/match.interface';
import { IPhaseGroupResponse } from '@core/interfaces/phase-group.interface';
import { IPhaseTeamResponse } from '@core/interfaces/phase-team.interface';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { BracketService } from '@core/services/bracket.service';
import { MatchesService } from '@core/services/matches.service';
import { PhaseGroupsService } from '@core/services/phase-groups.service';
import { PhaseTeamsService } from '@core/services/phase-teams.service';
import { PhasesService } from '@core/services/phases.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import {
  MatchFormComponent,
  MatchFormPayload,
} from '@shared/components/match-form/match-form.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-edit-match',
  standalone: true,
  imports: [PageHeaderComponent, MatchFormComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './edit-match.component.html',
  styleUrl: './edit-match.component.scss',
})
export class EditMatchComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _phaseTeamsService = inject(PhaseTeamsService);
  private readonly _phaseGroupsService = inject(PhaseGroupsService);
  private readonly _matchesService = inject(MatchesService);
  private readonly _bracketService = inject(BracketService);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly phaseTeams = signal<IPhaseTeamResponse[]>([]);
  protected readonly groups = signal<IPhaseGroupResponse[]>([]);
  protected readonly match = signal<IMatchResponse | null>(null);
  protected readonly existingMatches = signal<IMatchResponse[]>([]);
  protected readonly bracket = signal<IBracketResponse | null>(null);

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly backToHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    const m = this.match();
    if (t && p && m) {
      return `/tournaments/${t.id}/phases/${p.id}/matches/${m.id}`;
    }
    if (t && p) {
      return `/tournaments/${t.id}/phases/${p.id}/matches`;
    }
    return '/tournaments';
  });

  protected readonly tournamentStatus = computed(
    () => this.tournament()?.status ?? null,
  );

  public ngOnInit(): void {
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

  protected save(payload: MatchFormPayload): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    const mid = this.match()?.id;
    if (!tid || !pid || !mid) return;

    this.submitting.set(true);
    this.serverError.set(null);

    const updatePayload: IUpdateMatchRequest = {
      homeTeamId: payload.homeTeamId,
      awayTeamId: payload.awayTeamId,
      round: payload.round,
      groupId: payload.groupId,
      scheduledAt: payload.scheduledAt,
      matchType: payload.matchType,
    };

    this._matchesService
      .update(tid, pid, mid, updatePayload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.match.set(updated);
          this._toast.success('Partida atualizada.');
          void this._router.navigate([
            '/tournaments',
            tid,
            'phases',
            pid,
            'matches',
            mid,
          ]);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível atualizar a partida.';
          this.serverError.set(message);
          this._toast.error(message);
        },
      });
  }

  protected cancel(): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    const mid = this.match()?.id;
    if (tid && pid && mid) {
      void this._router.navigate([
        '/tournaments',
        tid,
        'phases',
        pid,
        'matches',
        mid,
      ]);
      return;
    }
    void this._router.navigate(['/tournaments']);
  }

  private _load(tid: string, pid: string, mid: string): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      teams: this._phaseTeamsService.list(tid, pid),
      match: this._matchesService.getById(tid, pid, mid),
      matches: this._matchesService.list(tid, pid),
    })
      .pipe(
        switchMap((base) => {
          if (base.phase.phaseType === 'GROUPS') {
            return this._phaseGroupsService.list(tid, pid).pipe(
              switchMap((groups) => of({ ...base, groups })),
            );
          }
          return of({ ...base, groups: [] as IPhaseGroupResponse[] });
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: ({ tournament, phase, teams, match, matches, groups }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.phaseTeams.set(teams);
          this.match.set(match);
          this.existingMatches.set(matches);
          this.groups.set(groups);

          if (phase.phaseType === 'KNOCKOUT' && matches.length > 0) {
            this._bracketService
              .get(tid, pid)
              .pipe(takeUntilDestroyed(this._destroyRef))
              .subscribe({
                next: (b) => {
                  this.bracket.set(b);
                  this.loading.set(false);
                },
                error: () => {
                  this.loading.set(false);
                },
              });
            return;
          }

          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (err instanceof ApiException && err.isNotFound) {
            this.loadError.set('Partida não encontrada.');
          } else if (err instanceof ApiException && err.isForbidden) {
            this.loadError.set('Você não tem acesso a esta partida.');
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
