import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import { IPhaseGroupResponse } from '@core/interfaces/phase-group.interface';
import { IPhaseTeamResponse } from '@core/interfaces/phase-team.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { PhaseGroupsService } from '@core/services/phase-groups.service';
import { PhaseTeamsService } from '@core/services/phase-teams.service';
import { PhasesService } from '@core/services/phases.service';
import { TournamentsService } from '@core/services/tournaments.service';
import {
  backdropFade,
  modalScale,
} from '@shared/animations/animations';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { FabComponent } from '@shared/components/fab/fab.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { ToastService } from '@shared/services/toast.service';
import {
  ArrowRightLeft,
  Grid3x3,
  LucideAngularModule,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
  X,
} from 'lucide-angular';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-phase-groups',
  standalone: true,
  imports: [
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    RouterLink,
    LucideAngularModule,
    PageHeaderComponent,
    TeamBadgeComponent,
    EmptyStateComponent,
    FabComponent,
    ConfirmDialogComponent,
    ButtonComponent,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phase-groups.component.html',
  styleUrl: './phase-groups.component.scss',
  animations: [modalScale, backdropFade],
})
export class PhaseGroupsComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _groupsService = inject(PhaseGroupsService);
  private readonly _phaseTeamsService = inject(PhaseTeamsService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly plusIcon = Plus;
  protected readonly pencilIcon = Pencil;
  protected readonly trashIcon = Trash2;
  protected readonly shuffleIcon = Shuffle;
  protected readonly gridIcon = Grid3x3;
  protected readonly xIcon = X;
  protected readonly moveIcon = ArrowRightLeft;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly groups = signal<IPhaseGroupResponse[]>([]);
  protected readonly phaseTeams = signal<IPhaseTeamResponse[]>([]);

  protected readonly movingTeamId = signal<string | null>(null);

  protected readonly groupModalOpen = signal(false);
  protected readonly editingGroup = signal<IPhaseGroupResponse | null>(null);
  protected readonly groupNameInput = signal('');
  protected readonly savingGroup = signal(false);
  protected readonly groupNameError = signal<string | null>(null);
  private readonly _groupNameInputRef =
    viewChild<ElementRef<HTMLInputElement>>('groupNameField');

  protected readonly confirmDeleteGroup = signal<IPhaseGroupResponse | null>(
    null,
  );
  protected readonly deletingGroup = signal(false);

  protected readonly confirmDrawOpen = signal(false);
  protected readonly drawing = signal(false);

  protected readonly moveTeamTarget = signal<IPhaseTeamResponse | null>(null);

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

  protected readonly statusBanner = computed<string | null>(() => {
    const status = this.tournament()?.status;
    if (status === 'IN_PROGRESS') {
      return 'Torneio em andamento — grupos não podem ser alterados.';
    }
    if (status === 'FINISHED') {
      return 'Torneio finalizado — somente leitura.';
    }
    return null;
  });

  protected readonly isGroupsPhase = computed(() => {
    return this.phase()?.phaseType === 'GROUPS';
  });

  protected readonly editPhaseHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    return t && p ? `/tournaments/${t.id}/phases/${p.id}/edit` : '/tournaments';
  });

  protected readonly teamsByGroupId = computed(() => {
    const teams = this.phaseTeams();
    const map = new Map<string | null, IPhaseTeamResponse[]>();
    for (const team of teams) {
      const key: string | null = team.groupId;
      if (!map.has(key)) {
        map.set(key, []);
      }
      const arr = map.get(key);
      if (arr) arr.push(team);
    }
    return map;
  });

  protected readonly teamsWithoutGroup = computed<IPhaseTeamResponse[]>(
    () => this.teamsByGroupId().get(null) ?? [],
  );

  protected readonly canDraw = computed(() => {
    if (!this.canEdit()) return false;
    if (this.groups().length === 0) return false;
    return this.teamsWithoutGroup().length > 0;
  });

  protected readonly modalTitle = computed(() =>
    this.editingGroup() ? 'Editar grupo' : 'Novo grupo',
  );

  protected readonly modalSubmitLabel = computed(() =>
    this.editingGroup() ? 'Salvar' : 'Criar grupo',
  );

  protected readonly deleteGroupDescription = computed(() => {
    const g = this.confirmDeleteGroup();
    if (!g) return '';
    if (g.teamCount > 0) {
      return `O grupo "${g.name}" tem ${g.teamCount} time(s). Ao excluir, os times voltam para "Sem grupo". A exclusão será bloqueada se houver partidas no grupo.`;
    }
    return `O grupo "${g.name}" será excluído. Esta ação não pode ser desfeita.`;
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

  protected teamsInGroup(groupId: string): IPhaseTeamResponse[] {
    return this.teamsByGroupId().get(groupId) ?? [];
  }

  protected openCreateGroup(): void {
    if (!this.canEdit()) return;
    this.editingGroup.set(null);
    this.groupNameInput.set('');
    this.groupNameError.set(null);
    this.groupModalOpen.set(true);
    queueMicrotask(() =>
      this._groupNameInputRef()?.nativeElement.focus(),
    );
  }

  protected openEditGroup(group: IPhaseGroupResponse): void {
    if (!this.canEdit()) return;
    this.editingGroup.set(group);
    this.groupNameInput.set(group.name);
    this.groupNameError.set(null);
    this.groupModalOpen.set(true);
    queueMicrotask(() => {
      const el = this._groupNameInputRef()?.nativeElement;
      el?.focus();
      el?.select();
    });
  }

  protected closeGroupModal(): void {
    if (this.savingGroup()) return;
    this.groupModalOpen.set(false);
    this.editingGroup.set(null);
    this.groupNameInput.set('');
    this.groupNameError.set(null);
  }

  protected onGroupNameInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.groupNameInput.set(value);
    if (this.groupNameError() !== null) {
      this.groupNameError.set(null);
    }
  }

  protected submitGroupForm(): void {
    if (this.savingGroup()) return;
    const name = this.groupNameInput().trim();
    if (name.length === 0) {
      this.groupNameError.set('Nome é obrigatório.');
      return;
    }
    if (name.length > 40) {
      this.groupNameError.set('Máximo de 40 caracteres.');
      return;
    }

    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid) return;

    this.savingGroup.set(true);
    const editing = this.editingGroup();

    const request$ = editing
      ? this._groupsService.update(tid, pid, editing.id, { name })
      : this._groupsService.create(tid, pid, { name });

    request$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (group) => {
          this.savingGroup.set(false);
          this.groupModalOpen.set(false);
          if (editing) {
            this.groups.update((list) =>
              list.map((g) => (g.id === group.id ? group : g)),
            );
            this._toast.success(`Grupo "${group.name}" atualizado.`);
          } else {
            this.groups.update((list) => [...list, group]);
            this._toast.success(`Grupo "${group.name}" criado.`);
          }
          this.editingGroup.set(null);
          this.groupNameInput.set('');
        },
        error: (err: unknown) => {
          this.savingGroup.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível salvar o grupo.';
          this.groupNameError.set(message);
        },
      });
  }

  protected requestDeleteGroup(group: IPhaseGroupResponse): void {
    if (!this.canEdit()) return;
    this.confirmDeleteGroup.set(group);
  }

  protected confirmDeleteGroupAction(): void {
    const group = this.confirmDeleteGroup();
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!group || !tid || !pid || this.deletingGroup()) return;

    this.deletingGroup.set(true);
    this._groupsService
      .remove(tid, pid, group.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.deletingGroup.set(false);
          this.confirmDeleteGroup.set(null);
          this.groups.update((list) =>
            list.filter((g) => g.id !== group.id),
          );
          this.phaseTeams.update((list) =>
            list.map((t) =>
              t.groupId === group.id
                ? { ...t, groupId: null, groupName: null }
                : t,
            ),
          );
          this._toast.success(`Grupo "${group.name}" excluído.`);
        },
        error: (err: unknown) => {
          this.deletingGroup.set(false);
          this.confirmDeleteGroup.set(null);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível excluir o grupo.',
          );
        },
      });
  }

  protected cancelDeleteGroup(): void {
    this.confirmDeleteGroup.set(null);
  }

  protected requestDraw(): void {
    if (!this.canDraw()) return;
    this.confirmDrawOpen.set(true);
  }

  protected confirmDrawAction(): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid || this.drawing()) return;

    this.drawing.set(true);
    this._phaseTeamsService
      .draw(tid, pid)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (teams) => {
          this.drawing.set(false);
          this.confirmDrawOpen.set(false);
          this.phaseTeams.set(teams);
          this._toast.success('Distribuição sorteada!');
        },
        error: (err: unknown) => {
          this.drawing.set(false);
          this.confirmDrawOpen.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível sortear.',
          );
        },
      });
  }

  protected cancelDraw(): void {
    this.confirmDrawOpen.set(false);
  }

  protected onDrop(
    event: CdkDragDrop<IPhaseTeamResponse[]>,
    targetGroupId: string | null,
    targetGroupName: string | null,
  ): void {
    if (!this.canEdit()) return;

    const team = event.previousContainer.data[event.previousIndex];
    if (!team) return;

    if (team.groupId === targetGroupId) return;

    this._performMove(team, targetGroupId, targetGroupName, false);
  }

  protected canMoveTeam(team: IPhaseTeamResponse): boolean {
    if (!this.canEdit()) return false;
    if (team.groupId !== null) return true;
    return this.groups().length > 0;
  }

  protected openMoveTeam(team: IPhaseTeamResponse): void {
    if (!this.canMoveTeam(team)) return;
    if (this.movingTeamId() !== null) return;
    this.moveTeamTarget.set(team);
  }

  protected closeMoveTeam(): void {
    if (this.movingTeamId() !== null) return;
    this.moveTeamTarget.set(null);
  }

  protected selectMoveDestination(
    team: IPhaseTeamResponse,
    targetGroupId: string | null,
    targetGroupName: string | null,
  ): void {
    if (team.groupId === targetGroupId) return;
    if (this.movingTeamId() !== null) return;
    this._performMove(team, targetGroupId, targetGroupName, true);
  }

  private _performMove(
    team: IPhaseTeamResponse,
    targetGroupId: string | null,
    targetGroupName: string | null,
    announce: boolean,
  ): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid) return;

    const previousState = this.phaseTeams();
    this.phaseTeams.update((list) =>
      list.map((t) =>
        t.teamId === team.teamId
          ? { ...t, groupId: targetGroupId, groupName: targetGroupName }
          : t,
      ),
    );
    this.movingTeamId.set(team.teamId);

    this._phaseTeamsService
      .moveToGroup(tid, pid, team.teamId, { groupId: targetGroupId })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (updated) => {
          this.movingTeamId.set(null);
          this.moveTeamTarget.set(null);
          this.phaseTeams.update((list) =>
            list.map((t) => (t.teamId === updated.teamId ? updated : t)),
          );
          if (announce) {
            const dest = targetGroupName ?? 'Sem grupo';
            this._toast.success(`${updated.teamName} → ${dest}.`);
          }
        },
        error: (err: unknown) => {
          this.movingTeamId.set(null);
          this.moveTeamTarget.set(null);
          this.phaseTeams.set(previousState);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível mover o time.',
          );
        },
      });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.groupModalOpen() && !this.savingGroup()) {
      this.closeGroupModal();
      return;
    }
    if (this.moveTeamTarget() !== null && this.movingTeamId() === null) {
      this.closeMoveTeam();
    }
  }

  private _load(tid: string, pid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      groups: this._groupsService.list(tid, pid),
      teams: this._phaseTeamsService.list(tid, pid),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, groups, teams }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.groups.set(groups);
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
                : 'Não foi possível carregar os grupos.',
            );
          }
        },
      });
  }
}
