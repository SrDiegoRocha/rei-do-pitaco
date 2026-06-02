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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { MatchStatus } from '@core/interfaces/enums';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import {
  IPredictionResponse,
  IPredictionStatsResponse,
} from '@core/interfaces/prediction.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { MatchesService } from '@core/services/matches.service';
import { PhasesService } from '@core/services/phases.service';
import { PredictionsService } from '@core/services/predictions.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import {
  IMatchResultPayload,
  MatchResultDialogComponent,
} from '@shared/components/match-result-dialog/match-result-dialog.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  IPredictionPayload,
  PredictionDialogComponent,
} from '@shared/components/prediction-dialog/prediction-dialog.component';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { ThemeService } from '@shared/services/theme.service';
import { ToastService } from '@shared/services/toast.service';
import { readableAccent } from '@core/utils/color-contrast';
import {
  ArrowLeftRight,
  Ban,
  CalendarDays,
  ChevronRight,
  Hash,
  LucideAngularModule,
  Pencil,
  Sparkles,
  Trash2,
  Trophy,
  Users,
} from 'lucide-angular';

const STATUS_TEXT: Record<MatchStatus, string> = {
  SCHEDULED: 'Agendada',
  COMPLETED: 'Encerrada',
  CANCELLED: 'Cancelada',
};

type MatchTab = 'predictions' | 'info';

@Component({
  selector: 'app-match-detail',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeaderComponent,
    TeamBadgeComponent,
    AvatarComponent,
    ButtonComponent,
    MatchResultDialogComponent,
    PredictionDialogComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './match-detail.component.html',
  styleUrl: './match-detail.component.scss',
})
export class MatchDetailComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _matchesService = inject(MatchesService);
  private readonly _predictionsService = inject(PredictionsService);
  private readonly _authState = inject(AuthState);
  private readonly _theme = inject(ThemeService);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly calendarIcon = CalendarDays;
  protected readonly arrowLeftRightIcon = ArrowLeftRight;
  protected readonly hashIcon = Hash;
  protected readonly usersIcon = Users;
  protected readonly pencilIcon = Pencil;
  protected readonly trophyIcon = Trophy;
  protected readonly banIcon = Ban;
  protected readonly trashIcon = Trash2;
  protected readonly sparklesIcon = Sparkles;
  protected readonly chevronRightIcon = ChevronRight;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly match = signal<IMatchResponse | null>(null);

  protected readonly activeTab = signal<MatchTab>('predictions');

  protected readonly resultDialogOpen = signal(false);
  protected readonly resultSubmitting = signal(false);
  protected readonly resultError = signal<string | null>(null);

  protected readonly cancelDialogOpen = signal(false);
  protected readonly cancelSubmitting = signal(false);

  protected readonly deleteDialogOpen = signal(false);
  protected readonly deleteSubmitting = signal(false);

  protected readonly isActiveMember = signal(false);
  protected readonly myPrediction = signal<IPredictionResponse | null>(null);

  protected readonly allPredictions = signal<IPredictionResponse[]>([]);
  protected readonly allPredictionsLoading = signal(false);
  protected readonly allPredictionsLocked = signal(false);

  protected readonly predictionDialogOpen = signal(false);
  protected readonly predictionSubmitting = signal(false);
  protected readonly predictionError = signal<string | null>(null);

  protected readonly removePredictionDialogOpen = signal(false);
  protected readonly removePredictionSubmitting = signal(false);

  protected readonly backToHref = computed(() => {
    const t = this.tournament();
    return t ? `/tournaments/${t.id}` : '/tournaments';
  });

  protected readonly backQueryParams = computed(() => ({ tab: 'matches' }));

  protected readonly backFragment = computed(() => {
    const m = this.match();
    return m ? `match-${m.id}` : null;
  });

  protected readonly statusText = computed(() => {
    const m = this.match();
    return m ? STATUS_TEXT[m.status] : '';
  });

  protected readonly statusClass = computed(() => {
    const m = this.match();
    if (!m) return '';
    return `hero__status hero__status--${m.status.toLowerCase()}`;
  });

  protected readonly hasScore = computed(() => {
    const m = this.match();
    return m !== null && m.homeScore !== null && m.awayScore !== null;
  });

  protected readonly dateLabel = computed(() => {
    const m = this.match();
    if (!m || !m.scheduledAt) return 'Sem horário';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(m.scheduledAt));
    } catch {
      return m.scheduledAt;
    }
  });

  protected readonly timeLabel = computed(() => {
    const m = this.match();
    if (!m || !m.scheduledAt) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(m.scheduledAt));
    } catch {
      return '';
    }
  });

  protected readonly subMeta = computed(() => {
    const m = this.match();
    const p = this.phase();
    if (!m || !p) return '';
    const parts: string[] = [p.name, `Rodada ${m.round}`];
    if (m.groupName) parts.push(`Grupo ${m.groupName}`);
    if (p.matchLegMode === 'TWO_LEGGED') parts.push('Ida e volta');
    return parts.join(' · ');
  });

  protected readonly winnerSide = computed<'home' | 'away' | 'draw' | null>(
    () => {
      const m = this.match();
      if (!m || m.status !== 'COMPLETED') return null;
      if (m.homeScore === null || m.awayScore === null) return null;
      if (m.homeScore > m.awayScore) return 'home';
      if (m.awayScore > m.homeScore) return 'away';
      if (m.homePenalties !== null && m.awayPenalties !== null) {
        if (m.homePenalties > m.awayPenalties) return 'away';
        if (m.awayPenalties > m.homePenalties) return 'home';
      }
      return 'draw';
    },
  );

  protected readonly hasPenalties = computed(() => {
    const m = this.match();
    return (
      m !== null &&
      m.homePenalties !== null &&
      m.awayPenalties !== null
    );
  });

  protected readonly cancelledNote = computed(() =>
    this.match()?.status === 'CANCELLED'
      ? 'Esta partida foi cancelada. Palpites associados não pontuam.'
      : null,
  );

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  /** Aba "Detalhes" só para o organizador, e só quando há ações disponíveis. */
  protected readonly showInfoTab = computed(
    () => this.isOwner() && this.tournament()?.status !== 'FINISHED',
  );

  // "Previsão da Galera" — agregado dos palpites antes do jogo começar.
  protected readonly predictionStats =
    signal<IPredictionStatsResponse | null>(null);

  /** Mostra o card enquanto o resultado não saiu e a partida não começou. */
  protected readonly showCrowdCard = computed(() => {
    const m = this.match();
    const stats = this.predictionStats();
    if (!m || !stats) return false;
    if (!this.isActiveMember()) return false;
    if (stats.totalVotes <= 0) return false;
    if (m.status !== 'SCHEDULED') return false;
    if (m.scheduledAt) {
      return new Date(m.scheduledAt).getTime() > Date.now();
    }
    return true;
  });

  protected readonly homeTeamColor = computed(
    () => this.match()?.homeTeam.primaryColor || '#10B981',
  );

  protected readonly awayTeamColor = computed(
    () => this.match()?.awayTeam.primaryColor || '#6366F1',
  );

  // Versão da cor com contraste garantido para o texto da %, conforme o tema.
  protected readonly homePctColor = computed(() =>
    readableAccent(this.homeTeamColor(), this._theme.resolvedTheme() === 'dark'),
  );

  protected readonly awayPctColor = computed(() =>
    readableAccent(this.awayTeamColor(), this._theme.resolvedTheme() === 'dark'),
  );

  protected readonly canEditScheduling = computed(() => {
    if (!this.isOwner()) return false;
    if (this.tournament()?.status === 'FINISHED') return false;
    if (this.match()?.status === 'COMPLETED') return false;
    return true;
  });

  protected readonly editMatchHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    const m = this.match();
    return t && p && m
      ? `/tournaments/${t.id}/phases/${p.id}/matches/${m.id}/edit`
      : null;
  });

  protected readonly canSetResult = computed(() => {
    if (!this.isOwner()) return false;
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return false;
    if (t.status !== 'IN_PROGRESS') return false;
    if (m.status === 'CANCELLED') return false;
    if (m.scheduledAt) {
      return new Date(m.scheduledAt).getTime() <= Date.now();
    }
    return true;
  });

  protected readonly setResultBlockReason = computed(() => {
    if (!this.isOwner()) return null;
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return null;
    if (m.status === 'CANCELLED') return null;
    if (t.status === 'DRAFT' || t.status === 'OPEN') {
      return 'Resultados só podem ser lançados após o torneio começar.';
    }
    if (t.status === 'FINISHED') return 'Torneio encerrado.';
    if (m.scheduledAt && new Date(m.scheduledAt).getTime() > Date.now()) {
      return 'Aguardando o horário agendado.';
    }
    return null;
  });

  protected readonly resultActionLabel = computed(() =>
    this.match()?.status === 'COMPLETED' ? 'Editar resultado' : 'Lançar resultado',
  );

  protected readonly resultActionDescription = computed(() =>
    this.match()?.status === 'COMPLETED'
      ? 'Refaz o placar e recalcula pontos.'
      : 'Define o placar final e libera pontos.',
  );

  protected readonly canCancel = computed(() => {
    if (!this.isOwner()) return false;
    if (this.tournament()?.status === 'FINISHED') return false;
    return this.match()?.status !== 'CANCELLED';
  });

  protected readonly canDelete = computed(() => {
    if (!this.isOwner()) return false;
    return this.tournament()?.status !== 'FINISHED';
  });

  protected readonly cancelDescription = computed(() => {
    const m = this.match();
    const teams = m ? `${m.homeTeam.name} × ${m.awayTeam.name}` : 'esta partida';
    return `Cancelar ${teams} zera os placares e remove os pontos dos palpites associados. Os palpites são mantidos para histórico.`;
  });

  protected readonly deleteDescription = computed(() => {
    const m = this.match();
    const teams = m ? `${m.homeTeam.name} × ${m.awayTeam.name}` : 'esta partida';
    return `Excluir ${teams} é permanente e remove a partida junto com palpites associados.`;
  });

  protected readonly canPredict = computed(() => {
    if (!this.isActiveMember()) return false;
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return false;
    if (t.status !== 'IN_PROGRESS') return false;
    if (m.status === 'CANCELLED') return false;
    if (m.scheduledAt) {
      return new Date(m.scheduledAt).getTime() > Date.now();
    }
    return m.status !== 'COMPLETED';
  });

  protected readonly predictionBlockReason = computed(() => {
    if (!this.isActiveMember()) return null;
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return null;
    if (t.status === 'DRAFT' || t.status === 'OPEN') {
      return 'Palpites abrem quando o torneio começa.';
    }
    if (t.status === 'FINISHED') {
      return 'Torneio encerrado — palpites estão congelados.';
    }
    if (m.status === 'CANCELLED') {
      return 'Partida cancelada não aceita palpites.';
    }
    if (m.scheduledAt) {
      if (new Date(m.scheduledAt).getTime() <= Date.now()) {
        return 'Palpites encerrados (a partida começou).';
      }
      return null;
    }
    if (m.status === 'COMPLETED') {
      return 'Palpites encerrados (resultado lançado).';
    }
    return null;
  });

  protected readonly predictionActionLabel = computed(() =>
    this.myPrediction() ? 'Editar palpite' : 'Lançar palpite',
  );

  protected readonly canRevealScores = computed(() => {
    const m = this.match();
    if (!m) return false;
    if (m.status === 'COMPLETED' || m.status === 'CANCELLED') return true;
    if (m.scheduledAt) {
      return new Date(m.scheduledAt).getTime() <= Date.now();
    }
    return false;
  });

  protected readonly revealLockReason = computed(() => {
    const m = this.match();
    if (!m) return null;
    if (m.status === 'COMPLETED' || m.status === 'CANCELLED') return null;
    if (m.scheduledAt) {
      return 'Os placares serão revelados após o início da partida.';
    }
    return 'Os placares serão revelados quando o resultado for lançado.';
  });

  protected readonly sortedPredictions = computed<IPredictionResponse[]>(() => {
    const me = this._authState.user();
    return [...this.allPredictions()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (me) {
        if (a.userId === me.id) return -1;
        if (b.userId === me.id) return 1;
      }
      return a.userName.localeCompare(b.userName);
    });
  });

  protected setTab(tab: MatchTab): void {
    this.activeTab.set(tab);
  }

  protected openResultDialog(): void {
    if (!this.canSetResult()) return;
    this.resultError.set(null);
    this.resultDialogOpen.set(true);
  }

  protected closeResultDialog(): void {
    this.resultDialogOpen.set(false);
    this.resultError.set(null);
  }

  protected openCancelDialog(): void {
    if (!this.canCancel()) return;
    this.cancelDialogOpen.set(true);
  }

  protected closeCancelDialog(): void {
    if (this.cancelSubmitting()) return;
    this.cancelDialogOpen.set(false);
  }

  protected confirmCancel(): void {
    const t = this.tournament();
    const p = this.phase();
    const m = this.match();
    if (!t || !p || !m) return;

    this.cancelSubmitting.set(true);
    this._matchesService
      .cancel(t.id, p.id, m.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (updated) => {
          this.cancelSubmitting.set(false);
          this.cancelDialogOpen.set(false);
          this.match.set(updated);
          this._toast.success('Partida cancelada.');
        },
        error: (err: unknown) => {
          this.cancelSubmitting.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível cancelar a partida.',
          );
        },
      });
  }

  protected openDeleteDialog(): void {
    if (!this.canDelete()) return;
    this.deleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    if (this.deleteSubmitting()) return;
    this.deleteDialogOpen.set(false);
  }

  protected confirmDelete(): void {
    const t = this.tournament();
    const p = this.phase();
    const m = this.match();
    if (!t || !p || !m) return;

    this.deleteSubmitting.set(true);
    this._matchesService
      .remove(t.id, p.id, m.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.deleteSubmitting.set(false);
          this.deleteDialogOpen.set(false);
          this._toast.success('Partida excluída.');
          void this._router.navigate(['/tournaments', t.id], {
            queryParams: { tab: 'matches' },
          });
        },
        error: (err: unknown) => {
          this.deleteSubmitting.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível excluir a partida.',
          );
        },
      });
  }

  protected openPredictionDialog(): void {
    if (!this.canPredict()) return;
    this.predictionError.set(null);
    this.predictionDialogOpen.set(true);
  }

  protected closePredictionDialog(): void {
    if (this.predictionSubmitting()) return;
    this.predictionDialogOpen.set(false);
    this.predictionError.set(null);
  }

  protected submitPrediction(payload: IPredictionPayload): void {
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return;

    this.predictionSubmitting.set(true);
    this.predictionError.set(null);

    this._predictionsService
      .upsertMine(t.id, m.id, payload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (prediction) => {
          this.predictionSubmitting.set(false);
          this.predictionDialogOpen.set(false);
          this.myPrediction.set(prediction);
          this.allPredictions.update((list) => {
            const idx = list.findIndex((p) => p.id === prediction.id);
            if (idx >= 0) {
              const next = [...list];
              next[idx] = prediction;
              return next;
            }
            return [...list, prediction];
          });
        },
        error: (err: unknown) => {
          this.predictionSubmitting.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível salvar o palpite.';
          this.predictionError.set(message);
          this._toast.error(message);
        },
      });
  }

  protected openRemovePredictionDialog(): void {
    if (!this.canPredict() || !this.myPrediction()) return;
    this.removePredictionDialogOpen.set(true);
  }

  protected closeRemovePredictionDialog(): void {
    if (this.removePredictionSubmitting()) return;
    this.removePredictionDialogOpen.set(false);
  }

  protected confirmRemovePrediction(): void {
    const t = this.tournament();
    const m = this.match();
    if (!t || !m) return;

    this.removePredictionSubmitting.set(true);
    this._predictionsService
      .removeMine(t.id, m.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.removePredictionSubmitting.set(false);
          this.removePredictionDialogOpen.set(false);
          const removedId = this.myPrediction()?.id;
          this.myPrediction.set(null);
          if (removedId) {
            this.allPredictions.update((list) =>
              list.filter((p) => p.id !== removedId),
            );
          }
          this._toast.success('Palpite removido.');
        },
        error: (err: unknown) => {
          this.removePredictionSubmitting.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível remover o palpite.',
          );
        },
      });
  }

  protected submitResult(payload: IMatchResultPayload): void {
    const t = this.tournament();
    const p = this.phase();
    const m = this.match();
    if (!t || !p || !m) return;

    this.resultSubmitting.set(true);
    this.resultError.set(null);

    this._matchesService
      .setResult(t.id, p.id, m.id, payload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (updated) => {
          this.resultSubmitting.set(false);
          this.match.set(updated);
          this.resultDialogOpen.set(false);
          this._toast.success('Resultado salvo.');
        },
        error: (err: unknown) => {
          this.resultSubmitting.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível salvar o resultado.';
          this.resultError.set(message);
          this._toast.error(message);
        },
      });
  }

  public ngOnInit(): void {
    const tid = this._route.snapshot.paramMap.get('id');
    const pid = this._route.snapshot.paramMap.get('pid');
    const mid = this._route.snapshot.paramMap.get('mid');
    if (!tid || !pid || !mid) {
      this.loading.set(false);
      this.loadError.set('Partida não encontrada.');
      return;
    }
    this._load(tid, pid, mid);
  }

  private _loadAllPredictions(tid: string, mid: string): void {
    if (!this.isOwner() && !this.isActiveMember()) return;
    this.allPredictionsLoading.set(true);
    this.allPredictionsLocked.set(false);
    this._predictionsService
      .listForMatch(tid, mid)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (predictions) => {
          this.allPredictions.set(predictions);
          this.allPredictionsLoading.set(false);
        },
        error: (err: unknown) => {
          this.allPredictionsLoading.set(false);
          if (err instanceof ApiException && err.isConflict) {
            this.allPredictionsLocked.set(true);
            return;
          }
          this.allPredictions.set([]);
        },
      });
  }

  private _loadPredictionStats(tid: string, mid: string): void {
    if (!this.isOwner() && !this.isActiveMember()) return;
    this._predictionsService
      .stats(tid, mid)
      .pipe(
        takeUntilDestroyed(this._destroyRef),
        catchError(() => of<IPredictionStatsResponse | null>(null)),
      )
      .subscribe((stats) => this.predictionStats.set(stats));
  }

  private _load(tid: string, pid: string, mid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      match: this._matchesService.getById(tid, pid, mid),
      myPredictions: this._predictionsService.listMineInTournament(tid).pipe(
        catchError((err: unknown) => {
          if (err instanceof ApiException && err.isForbidden) {
            return of<IPredictionResponse[] | null>(null);
          }
          return of<IPredictionResponse[] | null>([]);
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, match, myPredictions }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.match.set(match);
          this.isActiveMember.set(myPredictions !== null);
          this.myPrediction.set(
            myPredictions?.find((p) => p.matchId === match.id) ?? null,
          );
          this.loading.set(false);
          this._loadAllPredictions(tid, mid);
          this._loadPredictionStats(tid, mid);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (err instanceof ApiException && err.isNotFound) {
            this.loadError.set('Partida não encontrada.');
          } else if (err instanceof ApiException && err.isForbidden) {
            this.loadError.set('Você não tem acesso a esta partida.');
          } else {
            this.loadError.set(
              err instanceof ApiException
                ? err.message
                : 'Não foi possível carregar a partida.',
            );
          }
        },
      });
  }
}
