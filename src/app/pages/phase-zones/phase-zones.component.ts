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
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { IZoneResponse } from '@core/interfaces/zone.interface';
import { PhasesService } from '@core/services/phases.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { ZonesService } from '@core/services/zones.service';
import { listStagger } from '@shared/animations/animations';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { FabComponent } from '@shared/components/fab/fab.component';
import { ToastService } from '@shared/services/toast.service';
import {
  ArrowRight,
  Award,
  LucideAngularModule,
  Pencil,
  Plus,
  Target,
  Trash2,
  Workflow,
} from 'lucide-angular';

@Component({
  selector: 'app-phase-zones',
  standalone: true,
  imports: [
    LucideAngularModule,
    RouterLink,
    EmptyStateComponent,
    FabComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phase-zones.component.html',
  styleUrl: './phase-zones.component.scss',
  animations: [listStagger],
})
export class PhaseZonesComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _zonesService = inject(ZonesService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly plusIcon = Plus;
  protected readonly pencilIcon = Pencil;
  protected readonly trashIcon = Trash2;
  protected readonly arrowRightIcon = ArrowRight;
  protected readonly awardIcon = Award;
  protected readonly targetIcon = Target;
  protected readonly workflowIcon = Workflow;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly zones = signal<IZoneResponse[]>([]);

  protected readonly confirmDelete = signal<IZoneResponse | null>(null);
  protected readonly deleting = signal(false);

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  protected readonly canEdit = computed(() => {
    if (!this.isOwner()) return false;
    return this.tournament()?.status !== 'FINISHED';
  });

  protected readonly statusBanner = computed<string | null>(() => {
    if (this.tournament()?.status === 'FINISHED') {
      return 'Torneio finalizado — zonas em modo somente leitura.';
    }
    return null;
  });

  protected readonly newZoneHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    return t && p
      ? `/tournaments/${t.id}/phases/${p.id}/zones/new`
      : null;
  });

  protected readonly deleteDescription = computed(() => {
    const z = this.confirmDelete();
    if (!z) return '';
    return `A zona "${z.name}" será excluída permanentemente. Os times nas posições afetadas deixarão de ter regra de avanço definida.`;
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

  protected zoneRangeLabel(zone: IZoneResponse): string {
    if (zone.fromPosition === zone.toPosition) {
      return `Posição ${zone.fromPosition}`;
    }
    return `Posições ${zone.fromPosition} – ${zone.toPosition}`;
  }

  protected zoneEditHref(zone: IZoneResponse): string | null {
    const t = this.tournament();
    const p = this.phase();
    return t && p
      ? `/tournaments/${t.id}/phases/${p.id}/zones/${zone.id}/edit`
      : null;
  }

  protected requestDelete(zone: IZoneResponse): void {
    if (!this.canEdit()) return;
    this.confirmDelete.set(zone);
  }

  protected confirmDeleteAction(): void {
    const zone = this.confirmDelete();
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!zone || !tid || !pid || this.deleting()) return;

    this.deleting.set(true);
    this._zonesService
      .remove(tid, pid, zone.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirmDelete.set(null);
          this.zones.update((list) =>
            list.filter((z) => z.id !== zone.id),
          );
          this._toast.success(`Zona "${zone.name}" excluída.`);
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          this.confirmDelete.set(null);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível excluir a zona.',
          );
        },
      });
  }

  protected cancelDelete(): void {
    this.confirmDelete.set(null);
  }

  private _load(tid: string, pid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      zones: this._zonesService.list(tid, pid),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, zones }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.zones.set(zones);
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
                : 'Não foi possível carregar as zonas.',
            );
          }
        },
      });
  }
}
