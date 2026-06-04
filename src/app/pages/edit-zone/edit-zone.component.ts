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
import { forkJoin } from 'rxjs';
import { ApiException } from '@core/errors/api-error';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import {
  ICreateZoneRequest,
  IZoneResponse,
} from '@core/interfaces/zone.interface';
import { PhasesService } from '@core/services/phases.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { ZonesService } from '@core/services/zones.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { ZoneFormComponent } from '@shared/components/zone-form/zone-form.component';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-edit-zone',
  standalone: true,
  imports: [
    ZoneFormComponent,
    ButtonComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './edit-zone.component.html',
  styleUrl: './edit-zone.component.scss',
})
export class EditZoneComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _zonesService = inject(ZonesService);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly allPhases = signal<IPhaseResponse[]>([]);
  protected readonly zone = signal<IZoneResponse | null>(null);

  protected readonly submitting = signal(false);
  protected readonly deleting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly confirmDeleteOpen = signal(false);

  protected readonly futurePhases = computed<IPhaseResponse[]>(() => {
    const current = this.phase();
    if (!current) return [];
    return this.allPhases().filter((p) => p.position > current.position);
  });

  protected readonly tournamentStatus = computed(
    () => this.tournament()?.status ?? null,
  );

  protected readonly phaseType = computed(
    () => this.phase()?.phaseType ?? null,
  );

  protected readonly groupCount = computed(() => this.phase()?.groupCount ?? 0);

  public ngOnInit(): void {
    const tid = this._route.snapshot.paramMap.get('id');
    const pid = this._route.snapshot.paramMap.get('pid');
    const zid = this._route.snapshot.paramMap.get('zid');
    if (!tid || !pid || !zid) {
      this.loading.set(false);
      this.loadError.set('Zona não encontrada.');
      return;
    }
    this._load(tid, pid, zid);
  }

  protected save(payload: ICreateZoneRequest): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    const zid = this.zone()?.id;
    if (!tid || !pid || !zid) return;

    this.submitting.set(true);
    this.serverError.set(null);

    this._zonesService
      .update(tid, pid, zid, payload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.zone.set(updated);
          this._toast.success(`Zona "${updated.name}" atualizada.`);
          void this._router.navigate([
            '/tournaments',
            tid,
            'phases',
            pid,
            'zones',
          ]);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível atualizar a zona.';
          this.serverError.set(message);
          this._toast.error(message);
        },
      });
  }

  protected requestDelete(): void {
    this.confirmDeleteOpen.set(true);
  }

  protected confirmDelete(): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    const zone = this.zone();
    if (!tid || !pid || !zone) return;

    this.deleting.set(true);
    this._zonesService
      .remove(tid, pid, zone.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirmDeleteOpen.set(false);
          this._toast.success(`Zona "${zone.name}" excluída.`);
          void this._router.navigate([
            '/tournaments',
            tid,
            'phases',
            pid,
            'zones',
          ]);
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          this.confirmDeleteOpen.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível excluir a zona.',
          );
        },
      });
  }

  protected cancelDelete(): void {
    this.confirmDeleteOpen.set(false);
  }

  protected cancel(): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    void this._router.navigate(
      tid && pid
        ? ['/tournaments', tid, 'phases', pid, 'zones']
        : ['/tournaments'],
    );
  }

  private _load(tid: string, pid: string, zid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      phases: this._phasesService.list(tid),
      zones: this._zonesService.list(tid, pid),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, phases, zones }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.allPhases.set(phases);
          const found = zones.find((z) => z.id === zid);
          if (!found) {
            this.loadError.set('Zona não encontrada.');
          } else {
            this.zone.set(found);
          }
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (err instanceof ApiException && err.isNotFound) {
            this.loadError.set('Zona não encontrada.');
          } else if (err instanceof ApiException && err.isForbidden) {
            this.loadError.set('Você não tem acesso a esta zona.');
          } else {
            this.loadError.set(
              err instanceof ApiException
                ? err.message
                : 'Não foi possível carregar a zona.',
            );
          }
        },
      });
  }
}
