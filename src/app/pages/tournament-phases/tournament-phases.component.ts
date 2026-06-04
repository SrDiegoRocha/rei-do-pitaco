import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
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
import {
  MatchGenerationMode,
  MatchLegMode,
  TournamentPhaseType,
} from '@core/interfaces/enums';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { PhasesService } from '@core/services/phases.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { listStagger } from '@shared/animations/animations';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { FabComponent } from '@shared/components/fab/fab.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ToastService } from '@shared/services/toast.service';
import {
  ChevronRight,
  GripVertical,
  LucideAngularModule,
  Plus,
  Workflow,
} from 'lucide-angular';

const PHASE_TYPE_LABEL: Record<TournamentPhaseType, string> = {
  ROUND_ROBIN: 'Pontos corridos',
  KNOCKOUT: 'Mata-mata',
  GROUPS: 'Grupos',
};

const LEG_LABEL: Record<MatchLegMode, string> = {
  SINGLE: 'Jogo único',
  TWO_LEGGED: 'Ida e volta',
};

const GEN_LABEL: Record<MatchGenerationMode, string> = {
  AUTOMATIC: 'Geração automática',
  MANUAL: 'Manual',
};

@Component({
  selector: 'app-tournament-phases',
  standalone: true,
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    RouterLink,
    LucideAngularModule,
    PageHeaderComponent,
    EmptyStateComponent,
    FabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tournament-phases.component.html',
  styleUrl: './tournament-phases.component.scss',
  animations: [listStagger],
})
export class TournamentPhasesComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly plusIcon = Plus;
  protected readonly workflowIcon = Workflow;
  protected readonly gripIcon = GripVertical;
  protected readonly chevronRightIcon = ChevronRight;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phases = signal<IPhaseResponse[]>([]);
  protected readonly reordering = signal(false);

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  protected readonly isStructureLocked = computed(() => {
    const status = this.tournament()?.status;
    return status === 'IN_PROGRESS' || status === 'FINISHED';
  });

  protected readonly canEdit = computed(
    () => this.isOwner() && !this.isStructureLocked(),
  );

  protected readonly statusBanner = computed<string | null>(() => {
    const status = this.tournament()?.status;
    if (status === 'IN_PROGRESS') {
      return 'Torneio em andamento — fases não podem ser alteradas.';
    }
    if (status === 'FINISHED') {
      return 'Torneio finalizado — somente leitura.';
    }
    return null;
  });

  protected readonly newPhaseHref = computed(() => {
    const t = this.tournament();
    return t ? `/tournaments/${t.id}/phases/new` : null;
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

  protected phaseTypeLabel(type: TournamentPhaseType): string {
    return PHASE_TYPE_LABEL[type];
  }

  protected legLabel(mode: MatchLegMode): string {
    return LEG_LABEL[mode];
  }

  protected genLabel(mode: MatchGenerationMode): string {
    return GEN_LABEL[mode];
  }

  protected onDrop(event: CdkDragDrop<IPhaseResponse[]>): void {
    if (!this.canEdit()) return;
    if (event.previousIndex === event.currentIndex) return;

    const before = this.phases();
    const moved = before[event.previousIndex];
    const tid = this.tournament()?.id;
    if (!moved || !tid) return;

    const after = [...before];
    moveItemInArray(after, event.previousIndex, event.currentIndex);
    this.phases.set(after);
    this.reordering.set(true);

    this._phasesService
      .move(tid, moved.id, { position: event.currentIndex })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.reordering.set(false);
          this._toast.success('Ordem das fases atualizada.');
        },
        error: (err: unknown) => {
          this.reordering.set(false);
          this.phases.set(before);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível reordenar as fases.',
          );
        },
      });
  }

  private _load(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(id),
      phases: this._phasesService.list(id),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phases }) => {
          this.tournament.set(tournament);
          this.phases.set(phases);
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
                : 'Não foi possível carregar as fases.',
            );
          }
        },
      });
  }
}
