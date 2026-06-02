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
import { IBracketResponse } from '@core/interfaces/bracket.interface';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { BracketService } from '@core/services/bracket.service';
import { PhasesService } from '@core/services/phases.service';
import { StandingsService } from '@core/services/standings.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { isKnockoutFinalDone } from '@core/utils/knockout-state';
import { listStagger } from '@shared/animations/animations';
import {
  BracketViewComponent,
  BracketViewMode,
} from '@shared/components/bracket-view/bracket-view.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ToastService } from '@shared/services/toast.service';
import {
  CheckCircle2,
  CircleDashed,
  Flag,
  LucideAngularModule,
  Trophy,
} from 'lucide-angular';

@Component({
  selector: 'app-phase-bracket',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
    BracketViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phase-bracket.component.html',
  styleUrl: './phase-bracket.component.scss',
  animations: [listStagger],
})
export class PhaseBracketComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _bracketService = inject(BracketService);
  private readonly _standingsService = inject(StandingsService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly trophyIcon = Trophy;
  protected readonly circleDashedIcon = CircleDashed;
  protected readonly checkIcon = CheckCircle2;
  protected readonly flagIcon = Flag;

  protected readonly viewMode = signal<BracketViewMode>('cards');

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly bracket = signal<IBracketResponse | null>(null);

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  protected readonly backToHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    return t && p ? `/tournaments/${t.id}/phases/${p.id}` : '/tournaments';
  });

  protected readonly matchesHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    return t && p
      ? `/tournaments/${t.id}/phases/${p.id}/matches`
      : null;
  });

  protected readonly isEmpty = computed(() => {
    const b = this.bracket();
    return !b || b.rounds.length === 0;
  });

  protected readonly notKnockout = computed(
    () => this.phase()?.phaseType !== 'KNOCKOUT',
  );

  protected readonly isFinalized = computed(
    () => this.phase()?.finalizedAt != null,
  );

  protected readonly finalizedAtLabel = computed<string | null>(() => {
    const iso = this.phase()?.finalizedAt;
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  });

  /** Fase de mata-mata terminou de verdade (chegou na final e decidiu, incluindo 3º lugar se houver). */
  protected readonly bracketComplete = computed(() => {
    const p = this.phase();
    if (!p) return false;
    return isKnockoutFinalDone(this.bracket(), p.teamCount, p.hasThirdPlace);
  });

  protected readonly canFinalize = computed(() => {
    if (!this.isOwner()) return false;
    if (this.isFinalized()) return false;
    if (this.tournament()?.status !== 'IN_PROGRESS') return false;
    return this.bracketComplete();
  });

  protected readonly finalizeBlockReason = computed<string | null>(() => {
    if (!this.isOwner()) return null;
    if (this.isFinalized()) return null;
    const status = this.tournament()?.status;
    if (status === 'DRAFT' || status === 'OPEN') {
      return 'Finalize só fica disponível com o torneio em andamento.';
    }
    if (status === 'FINISHED') return null;
    if (!this.bracketComplete()) {
      return 'A final do mata-mata ainda não foi disputada. Gere as próximas rodadas e lance os resultados antes de finalizar.';
    }
    return null;
  });

  protected readonly confirmFinalizeOpen = signal(false);
  protected readonly finalizing = signal(false);

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

  protected openFinalize(): void {
    if (!this.canFinalize()) return;
    this.confirmFinalizeOpen.set(true);
  }

  protected cancelFinalize(): void {
    if (this.finalizing()) return;
    this.confirmFinalizeOpen.set(false);
  }

  protected confirmFinalize(): void {
    const t = this.tournament();
    const p = this.phase();
    if (!t || !p || this.finalizing()) return;

    this.finalizing.set(true);
    this._standingsService
      .finalize(t.id, p.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.finalizing.set(false);
          this.confirmFinalizeOpen.set(false);
          this._toast.success('Fase finalizada.');
          this._phasesService
            .getById(t.id, p.id)
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe({
              next: (fresh) => this.phase.set(fresh),
            });
        },
        error: (err: unknown) => {
          this.finalizing.set(false);
          this.confirmFinalizeOpen.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível finalizar a fase.',
          );
        },
      });
  }

  protected setViewMode(mode: BracketViewMode): void {
    this.viewMode.set(mode);
  }

  private _load(tid: string, pid: string): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      bracket: this._bracketService.get(tid, pid),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, bracket }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.bracket.set(bracket);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (err instanceof ApiException) {
            if (err.isNotFound) {
              this.loadError.set('Fase não encontrada.');
            } else if (err.isForbidden) {
              this.loadError.set('Você não tem acesso a esta fase.');
            } else if (err.isConflict) {
              this.loadError.set(
                'Esta fase não é mata-mata — use Classificação.',
              );
            } else {
              this.loadError.set(err.message);
            }
          } else {
            this.loadError.set('Não foi possível carregar o chaveamento.');
          }
        },
      });
  }
}
