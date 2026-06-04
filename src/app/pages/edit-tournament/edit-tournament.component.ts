import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiException } from '@core/errors/api-error';
import {
  ICreateTournamentRequest,
  ITournamentResponse,
} from '@core/interfaces/tournament.interface';
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
