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
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import {
  IPickemRecalculationResponse,
  IRecalculationResponse,
} from '@core/interfaces';
import {
  ICreateTournamentRequest,
  ITournamentResponse,
} from '@core/interfaces/tournament.interface';
import { PhasesService } from '@core/services/phases.service';
import { PickemService } from '@core/services/pickem.service';
import { PredictionsService } from '@core/services/predictions.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TournamentFormComponent } from '@shared/components/tournament-form/tournament-form.component';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-edit-tournament',
  standalone: true,
  imports: [
    PageHeaderComponent,
    TournamentFormComponent,
    ButtonComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './edit-tournament.component.html',
  styleUrl: './edit-tournament.component.scss',
})
export class EditTournamentComponent implements OnInit {
  private readonly _service = inject(TournamentsService);
  private readonly _predictions = inject(PredictionsService);
  private readonly _phases = inject(PhasesService);
  private readonly _pickem = inject(PickemService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);

  protected readonly submitting = signal(false);
  protected readonly deleting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly confirmDeleteOpen = signal(false);

  protected readonly recalculating = signal(false);
  protected readonly confirmRecalcOpen = signal(false);

  /** Pós-save em IN_PROGRESS: oferece reaplicar a pontuação ao que já foi lançado. */
  protected readonly postSaveRecalcOpen = signal(false);

  /**
   * O recálculo só faz sentido quando o owner pode ter mudado a pontuação com
   * partidas já lançadas — ou seja, torneio em andamento. Antes de começar não
   * há jogos concluídos; finalizado tem tudo congelado.
   */
  protected readonly canRecalculate = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(
      t &&
      user &&
      t.owner.id === user.id &&
      t.status === 'IN_PROGRESS'
    );
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

  protected save(payload: ICreateTournamentRequest): void {
    const current = this.tournament();
    if (!current) return;

    this.submitting.set(true);
    this.serverError.set(null);

    this._service
      .update(current.id, payload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (tournament) => {
          this.submitting.set(false);
          this.tournament.set(tournament);
          this._toast.success(`Torneio "${tournament.name}" atualizado.`);
          // Em andamento, a nova pontuação só vale para os próximos
          // resultados — oferece reaplicar ao que já foi lançado
          // (pitacos de partida + Palpitões, fase a fase).
          if (this.canRecalculate()) {
            this.postSaveRecalcOpen.set(true);
            return;
          }
          void this._router.navigate(['/tournaments', tournament.id]);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível atualizar o torneio.';
          this.serverError.set(message);
          this._toast.error(message);
        },
      });
  }

  protected requestDelete(): void {
    this.confirmDeleteOpen.set(true);
  }

  protected confirmDelete(): void {
    const current = this.tournament();
    if (!current) return;

    this.deleting.set(true);

    this._service
      .remove(current.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirmDeleteOpen.set(false);
          this._toast.success(`Torneio "${current.name}" excluído.`);
          void this._router.navigate(['/tournaments']);
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          this.confirmDeleteOpen.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível excluir o torneio.';
          this._toast.error(message);
        },
      });
  }

  protected cancelDelete(): void {
    this.confirmDeleteOpen.set(false);
  }

  protected requestRecalculate(): void {
    this.confirmRecalcOpen.set(true);
  }

  protected confirmRecalculate(): void {
    this._runFullRecalculation(() => this.confirmRecalcOpen.set(false));
  }

  protected cancelRecalculate(): void {
    this.confirmRecalcOpen.set(false);
  }

  protected confirmPostSaveRecalculate(): void {
    this._runFullRecalculation(() => {
      this.postSaveRecalcOpen.set(false);
      const t = this.tournament();
      void this._router.navigate(t ? ['/tournaments', t.id] : ['/tournaments']);
    });
  }

  protected skipPostSaveRecalculate(): void {
    if (this.recalculating()) return;
    this.postSaveRecalcOpen.set(false);
    const t = this.tournament();
    void this._router.navigate(t ? ['/tournaments', t.id] : ['/tournaments']);
  }

  /**
   * Reaplica a pontuação vigente a tudo que já foi lançado: pitacos de partida
   * (recálculo do torneio) e Palpitões (recálculo por fase). Falhas parciais
   * não abortam o restante.
   */
  private _runFullRecalculation(onDone: () => void): void {
    const current = this.tournament();
    if (!current || this.recalculating()) return;

    this.recalculating.set(true);

    this._phases
      .list(current.id)
      .pipe(
        catchError(() => of<IPhaseResponse[]>([])),
        switchMap((phases) =>
          forkJoin({
            predictions: this._predictions.recalculatePoints(current.id).pipe(
              catchError(() => of<IRecalculationResponse | null>(null)),
            ),
            pickems:
              phases.length > 0
                ? forkJoin(
                    phases.map((p) =>
                      this._pickem.recalculate(current.id, p.id).pipe(
                        catchError(() =>
                          of<IPickemRecalculationResponse | null>(null),
                        ),
                      ),
                    ),
                  )
                : of<(IPickemRecalculationResponse | null)[]>([]),
          }),
        ),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: ({ predictions, pickems }) => {
          this.recalculating.set(false);
          const preds = predictions?.predictionsUpdated ?? 0;
          const picks = pickems.reduce(
            (sum, r) => sum + (r?.pickemsRecalculated ?? 0),
            0,
          );
          this._toast.success(
            `Pontos recalculados: ${preds} ${
              preds === 1 ? 'pitaco atualizado' : 'pitacos atualizados'
            } e ${picks} ${
              picks === 1 ? 'palpitão repontuado' : 'palpitões repontuados'
            }.`,
          );
          onDone();
        },
        error: () => {
          this.recalculating.set(false);
          this._toast.error('Não foi possível recalcular os pontos.');
          onDone();
        },
      });
  }

  protected cancel(): void {
    const t = this.tournament();
    void this._router.navigate(t ? ['/tournaments', t.id] : ['/tournaments']);
  }

  protected backToList(): void {
    void this._router.navigate(['/tournaments']);
  }

  private _load(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);

    this._service
      .getById(id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (tournament) => {
          this.tournament.set(tournament);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (err instanceof ApiException && err.isNotFound) {
            this.loadError.set('Torneio não encontrado.');
          } else {
            this.loadError.set(
              err instanceof ApiException
                ? err.message
                : 'Não foi possível carregar o torneio.',
            );
          }
        },
      });
  }
}
