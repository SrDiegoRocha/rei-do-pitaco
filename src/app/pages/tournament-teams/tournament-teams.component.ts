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
import { TeamScope, TeamType } from '@core/interfaces/enums';
import { ITeamResponse } from '@core/interfaces/team.interface';
import { ITournamentTeamResponse } from '@core/interfaces/tournament-team.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { ITeamListParams, TeamsService } from '@core/services/teams.service';
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
import { LucideAngularModule, Plus, Trash2, Trophy, X } from 'lucide-angular';

type TeamGroup = 'mine' | 'national' | 'clubs';

const GROUP_QUERY: Record<TeamGroup, { scope: TeamScope; type?: TeamType }> = {
  mine: { scope: 'mine' },
  national: { scope: 'system', type: 'NATIONAL_TEAM' },
  clubs: { scope: 'system', type: 'CLUB' },
};

@Component({
  selector: 'app-tournament-teams',
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
  templateUrl: './tournament-teams.component.html',
  styleUrl: './tournament-teams.component.scss',
  animations: [listStagger, sheetSlideUp, backdropFade],
})
export class TournamentTeamsComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _tournamentTeamsService = inject(TournamentTeamsService);
  private readonly _teamsService = inject(TeamsService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly plusIcon = Plus;
  protected readonly trophyIcon = Trophy;
  protected readonly trashIcon = Trash2;
  protected readonly xIcon = X;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly linkedTeams = signal<ITournamentTeamResponse[]>([]);

  protected readonly addSheetOpen = signal(false);
  protected readonly loadingAvailable = signal(false);
  protected readonly availableTeams = signal<ITeamResponse[]>([]);
  protected readonly attachingTeamId = signal<string | null>(null);
  protected readonly availableGroup = signal<TeamGroup>('mine');

  protected readonly confirmDetach = signal<ITournamentTeamResponse | null>(
    null,
  );
  protected readonly detaching = signal(false);

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  protected readonly canEdit = computed(() => {
    if (!this.isOwner()) return false;
    const status = this.tournament()?.status;
    return status === 'DRAFT' || status === 'OPEN';
  });

  protected readonly detachDescription = computed(() => {
    const target = this.confirmDetach();
    if (!target) return '';
    return `${target.name} será removido do torneio. Você pode vinculá-lo novamente depois.`;
  });

  public ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.loadError.set('Torneio não encontrado.');
      return;
    }
    this._load(id);
  }

  protected openAddSheet(): void {
    if (!this.canEdit()) return;
    this.addSheetOpen.set(true);
    this._loadAvailable();
  }

  protected closeAddSheet(): void {
    this.addSheetOpen.set(false);
  }

  protected setAvailableGroup(group: TeamGroup): void {
    if (this.availableGroup() === group) return;
    this.availableGroup.set(group);
    this.availableTeams.set([]);
    this._loadAvailable();
  }

  protected attach(team: ITeamResponse): void {
    const tid = this.tournament()?.id;
    if (!tid || this.attachingTeamId() !== null) return;

    this.attachingTeamId.set(team.id);
    this._tournamentTeamsService
      .attach(tid, team.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (linked) => {
          this.attachingTeamId.set(null);
          this.linkedTeams.update((list) => [linked, ...list]);
          this.availableTeams.update((list) =>
            list.filter((t) => t.id !== team.id),
          );
          if (this.availableTeams().length === 0) {
            this.addSheetOpen.set(false);
          }
        },
        error: (err: unknown) => {
          this.attachingTeamId.set(null);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível vincular o time.',
          );
        },
      });
  }

  protected requestDetach(team: ITournamentTeamResponse): void {
    this.confirmDetach.set(team);
  }

  protected confirmDetachAction(): void {
    const target = this.confirmDetach();
    const tid = this.tournament()?.id;
    if (!target || !tid || this.detaching()) return;

    this.detaching.set(true);
    this._tournamentTeamsService
      .detach(tid, target.teamId)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.detaching.set(false);
          this.confirmDetach.set(null);
          this.linkedTeams.update((list) =>
            list.filter((t) => t.teamId !== target.teamId),
          );
          this._toast.success(`"${target.name}" desvinculado.`);
        },
        error: (err: unknown) => {
          this.detaching.set(false);
          this.confirmDetach.set(null);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível desvincular o time.',
          );
        },
      });
  }

  protected cancelDetach(): void {
    this.confirmDetach.set(null);
  }

  private _load(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(id),
      page: this._tournamentTeamsService.list(id, {
        page: 0,
        size: 100,
        sort: 'addedAt,desc',
      }),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, page }) => {
          this.tournament.set(tournament);
          this.linkedTeams.set(page.content);
          this.loading.set(false);
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
                : 'Não foi possível carregar os times.',
            );
          }
        },
      });
  }

  private _loadAvailable(): void {
    this.loadingAvailable.set(true);
    const query = GROUP_QUERY[this.availableGroup()];
    const params: ITeamListParams = {
      page: 0,
      size: 100,
      sort: 'name,asc',
      scope: query.scope,
      type: query.type,
    };
    this._teamsService
      .list(params)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => {
          this.loadingAvailable.set(false);
          const linkedIds = new Set(this.linkedTeams().map((t) => t.teamId));
          this.availableTeams.set(
            page.content.filter((t) => !linkedIds.has(t.id)),
          );
        },
        error: () => {
          this.loadingAvailable.set(false);
          this._toast.error('Não foi possível carregar os times.');
        },
      });
  }
}
