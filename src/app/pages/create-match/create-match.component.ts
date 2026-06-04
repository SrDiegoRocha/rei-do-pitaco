import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiException } from '@core/errors/api-error';
import { IBracketResponse } from '@core/interfaces/bracket.interface';
import {
  ICreateMatchRequest,
  IMatchResponse,
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
  selector: 'app-create-match',
  standalone: true,
  imports: [PageHeaderComponent, MatchFormComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-match.component.html',
  styleUrl: './create-match.component.scss',
})
export class CreateMatchComponent implements OnInit {
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
  protected readonly existingMatches = signal<IMatchResponse[]>([]);
  protected readonly bracket = signal<IBracketResponse | null>(null);

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  private readonly _form = viewChild(MatchFormComponent);

  protected readonly backToHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    return t && p
      ? `/tournaments/${t.id}/phases/${p.id}/matches`
      : '/tournaments';
  });

  protected readonly tournamentStatus = computed(
    () => this.tournament()?.status ?? null,
  );

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

  /** "Criar e sair": cria e volta para a listagem de partidas da fase. */
  protected save(payload: MatchFormPayload): void {
    this._create(payload, false);
  }

  /** "Salvar e criar outra": cria e permanece na tela para o próximo cadastro. */
  protected saveAndNew(payload: MatchFormPayload): void {
    this._create(payload, true);
  }

  private _create(payload: MatchFormPayload, stay: boolean): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid) return;

    this.submitting.set(true);
    this.serverError.set(null);

    this._matchesService
      .create(tid, pid, payload as ICreateMatchRequest)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (match) => {
          this.submitting.set(false);
          if (stay) {
            // Inclui a nova partida para os filtros do form (times já
            // escalados na rodada) refletirem na próxima de imediato.
            this.existingMatches.update((list) => [...list, match]);
            this._toast.success('Partida criada. Monte a próxima.');
            this._form()?.resetForNext();
          } else {
            this._toast.success('Partida criada.');
            void this._router.navigate([
              '/tournaments',
              tid,
              'phases',
              pid,
              'matches',
            ]);
          }
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível criar a partida.';
          this.serverError.set(message);
          this._toast.error(message);
        },
      });
  }

  protected cancel(): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    void this._router.navigate(
      tid && pid
        ? ['/tournaments', tid, 'phases', pid, 'matches']
        : ['/tournaments'],
    );
  }

  private _load(tid: string, pid: string): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      teams: this._phaseTeamsService.list(tid, pid),
      matches: this._matchesService.list(tid, pid),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, teams, matches }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.phaseTeams.set(teams);
          this.existingMatches.set(matches);

          if (phase.phaseType === 'GROUPS') {
            this._phaseGroupsService
              .list(tid, pid)
              .pipe(takeUntilDestroyed(this._destroyRef))
              .subscribe({
                next: (groups) => {
                  this.groups.set(groups);
                  this.loading.set(false);
                },
                error: () => {
                  this.loading.set(false);
                },
              });
            return;
          }

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
            this.loadError.set('Fase não encontrada.');
          } else if (err instanceof ApiException && err.isForbidden) {
            this.loadError.set('Você não tem acesso a esta fase.');
          } else {
            this.loadError.set(
              err instanceof ApiException
                ? err.message
                : 'Não foi possível carregar a fase.',
            );
          }
        },
      });
  }
}
