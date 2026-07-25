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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import { IPhaseTeamResponse } from '@core/interfaces/phase-team.interface';
import { ITournamentTeamResponse } from '@core/interfaces/tournament-team.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { PhaseTeamsService } from '@core/services/phase-teams.service';
import { PhasesService } from '@core/services/phases.service';
import { TournamentTeamsService } from '@core/services/tournament-teams.service';
import { TournamentsService } from '@core/services/tournaments.service';
import {
  backdropFade,
  listStagger,
  sheetSlideUp,
} from '@shared/animations/animations';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { FabComponent } from '@shared/components/fab/fab.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { ToastService } from '@shared/services/toast.service';
import { LucideAngularModule, Plus, Shield, Trash2, X } from 'lucide-angular';

@Component({
  selector: 'app-phase-teams',
  standalone: true,
  imports: [
    LucideAngularModule,
    RouterLink,
    PageHeaderComponent,
    TeamBadgeComponent,
    EmptyStateComponent,
    FabComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phase-teams.component.html',
  styleUrl: './phase-teams.component.scss',
  animations: [listStagger, sheetSlideUp, backdropFade],
})
export class PhaseTeamsComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _phaseTeamsService = inject(PhaseTeamsService);
  private readonly _tournamentTeamsService = inject(TournamentTeamsService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly plusIcon = Plus;
  protected readonly shieldIcon = Shield;
  protected readonly trashIcon = Trash2;
  protected readonly xIcon = X;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly phaseTeams = signal<IPhaseTeamResponse[]>([]);

  protected readonly addSheetOpen = signal(false);
  protected readonly loadingAvailable = signal(false);
  protected readonly availableTeams = signal<ITournamentTeamResponse[]>([]);
  protected readonly attachingTeamId = signal<string | null>(null);

  protected readonly confirmRemove = signal<IPhaseTeamResponse | null>(null);
  protected readonly removing = signal(false);

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  // Os times da fase são editáveis em DRAFT/OPEN/IN_PROGRESS — só travam em
  // FINISHED (ver FLUXO_FASES.md §3). É o que permite popular as fases
  // seguintes com o torneio já em andamento.
  protected readonly canEdit = computed(() => {
    if (!this.isOwner()) return false;
    return this.tournament()?.status !== 'FINISHED';
  });

  protected readonly statusBanner = computed<string | null>(() => {
    const status = this.tournament()?.status;
    if (status === 'IN_PROGRESS') {
      return 'Torneio em andamento — você ainda pode ajustar os times desta fase (a estrutura de fases e grupos, essa sim, fica travada).';
    }
    if (status === 'FINISHED') {
      return 'Torneio finalizado — somente leitura.';
    }
    return null;
  });

  protected readonly removeDescription = computed(() => {
    const target = this.confirmRemove();
    if (!target) return '';
    return `${target.teamName} será removido desta fase. Se houver partidas envolvendo o time, a remoção será bloqueada.`;
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

  protected openAddSheet(): void {
    if (!this.canEdit()) return;
    this.addSheetOpen.set(true);
    this._loadAvailable();
  }

  protected closeAddSheet(): void {
    this.addSheetOpen.set(false);
  }

  protected attach(team: ITournamentTeamResponse): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid || this.attachingTeamId() !== null) return;

    this.attachingTeamId.set(team.teamId);
    this._phaseTeamsService
      .add(tid, pid, team.teamId)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (added) => {
          this.attachingTeamId.set(null);
          this.phaseTeams.update((list) => [added, ...list]);
          this.availableTeams.update((list) =>
            list.filter((t) => t.teamId !== team.teamId),
          );
          this._toast.success(`"${team.name}" adicionado à fase.`);
          if (this.availableTeams().length === 0) {
            this.addSheetOpen.set(false);
          }
        },
        error: (err: unknown) => {
          this.attachingTeamId.set(null);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível adicionar o time.',
          );
        },
      });
  }

  protected requestRemove(team: IPhaseTeamResponse): void {
    this.confirmRemove.set(team);
  }

  protected confirmRemoveAction(): void {
    const target = this.confirmRemove();
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!target || !tid || !pid || this.removing()) return;

    this.removing.set(true);
    this._phaseTeamsService
      .remove(tid, pid, target.teamId)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.removing.set(false);
          this.confirmRemove.set(null);
          this.phaseTeams.update((list) =>
            list.filter((t) => t.teamId !== target.teamId),
          );
          this._toast.success(`"${target.teamName}" removido da fase.`);
        },
        error: (err: unknown) => {
          this.removing.set(false);
          this.confirmRemove.set(null);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível remover o time.',
          );
        },
      });
  }

  protected cancelRemove(): void {
    this.confirmRemove.set(null);
  }

  private _load(tid: string, pid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      teams: this._phaseTeamsService.list(tid, pid),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, teams }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.phaseTeams.set(teams);
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
                : 'Não foi possível carregar os times da fase.',
            );
          }
        },
      });
  }

  private _loadAvailable(): void {
    const tid = this.tournament()?.id;
    if (!tid) return;

    this.loadingAvailable.set(true);
    this._tournamentTeamsService
      .list(tid, { page: 0, size: 100, sort: 'name,asc' })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => {
          this.loadingAvailable.set(false);
          const inPhase = new Set(
            this.phaseTeams().map((t) => t.teamId),
          );
          this.availableTeams.set(
            page.content.filter((t) => !inPhase.has(t.teamId)),
          );
        },
        error: () => {
          this.loadingAvailable.set(false);
          this._toast.error('Não foi possível carregar os times do torneio.');
        },
      });
  }
}
