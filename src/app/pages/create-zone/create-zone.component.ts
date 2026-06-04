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
import { ICreateZoneRequest } from '@core/interfaces/zone.interface';
import { PhasesService } from '@core/services/phases.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { ZonesService } from '@core/services/zones.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ZoneFormComponent } from '@shared/components/zone-form/zone-form.component';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-create-zone',
  standalone: true,
  imports: [ZoneFormComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-zone.component.html',
  styleUrl: './create-zone.component.scss',
})
export class CreateZoneComponent implements OnInit {
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

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

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
    if (!tid || !pid) {
      this.loading.set(false);
      this.loadError.set('Fase não encontrada.');
      return;
    }
    this._load(tid, pid);
  }

  protected save(payload: ICreateZoneRequest): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid) return;

    this.submitting.set(true);
    this.serverError.set(null);

    this._zonesService
      .create(tid, pid, payload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (zone) => {
          this.submitting.set(false);
          this._toast.success(`Zona "${zone.name}" criada.`);
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
              : 'Não foi possível criar a zona.';
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
        ? ['/tournaments', tid, 'phases', pid, 'zones']
        : ['/tournaments'],
    );
  }

  private _load(tid: string, pid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      phases: this._phasesService.list(tid),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, phases }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.allPhases.set(phases);
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
