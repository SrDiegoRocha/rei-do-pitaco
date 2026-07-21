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
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { forkJoin } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import {
  BracketMode,
  MatchGenerationMode,
  MatchLegMode,
  TournamentPhaseType,
} from '@core/interfaces/enums';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { PhasesService } from '@core/services/phases.service';
import { TournamentsService } from '@core/services/tournaments.service';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Crown,
  Grid3x3,
  LucideAngularModule,
  Pencil,
  Repeat,
  Shield,
  Trophy,
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
  AUTOMATIC: 'Automática',
  MANUAL: 'Manual',
};

const BRACKET_MODE_LABEL: Record<BracketMode, string> = {
  FIXED_BRACKET: 'Fixo',
  REDRAW_EACH_ROUND: 'Sorteio a cada rodada',
};

@Component({
  selector: 'app-phase-detail',
  standalone: true,
  imports: [LucideAngularModule, RouterLink, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phase-detail.component.html',
  styleUrl: './phase-detail.component.scss',
})
export class PhaseDetailComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _authState = inject(AuthState);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly shieldIcon = Shield;
  protected readonly chevronRightIcon = ChevronRight;
  protected readonly pencilIcon = Pencil;
  protected readonly repeatIcon = Repeat;
  protected readonly crownIcon = Crown;
  protected readonly gridIcon = Grid3x3;
  protected readonly workflowIcon = Workflow;
  protected readonly calendarIcon = CalendarDays;
  protected readonly trophyIcon = Trophy;
  protected readonly checkIcon = CheckCircle2;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);

  protected readonly backHref = computed(() => {
    const t = this.tournament();
    return t ? `/tournaments/${t.id}/phases` : '/tournaments';
  });
  protected readonly pageTitle = computed(() => this.phase()?.name ?? '');

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

  protected readonly typeLabel = computed(() => {
    const p = this.phase();
    return p ? PHASE_TYPE_LABEL[p.phaseType] : '';
  });

  protected readonly legLabel = computed(() => {
    const p = this.phase();
    return p ? LEG_LABEL[p.matchLegMode] : '';
  });

  protected readonly genLabel = computed(() => {
    const p = this.phase();
    return p ? GEN_LABEL[p.matchGenerationMode] : '';
  });

  /** Formato próprio da rodada final (final + 3º); null = herda o da fase. */
  protected readonly finalLegLabel = computed<string | null>(() => {
    const p = this.phase();
    if (!p || p.phaseType !== 'KNOCKOUT' || !p.finalLegMode) return null;
    return LEG_LABEL[p.finalLegMode];
  });

  /** Chaveamento fixo x sorteio a cada rodada (só KNOCKOUT). */
  protected readonly bracketModeLabel = computed<string | null>(() => {
    const p = this.phase();
    if (!p || p.phaseType !== 'KNOCKOUT' || !p.bracketMode) return null;
    return BRACKET_MODE_LABEL[p.bracketMode];
  });

  protected readonly typeClass = computed(() => {
    const p = this.phase();
    if (!p) return '';
    return `phase-detail__type phase-detail__type--${p.phaseType.toLowerCase().replace('_', '-')}`;
  });

  protected readonly isKnockout = computed(
    () => this.phase()?.phaseType === 'KNOCKOUT',
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

  protected readonly standingsRouterLink = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    if (!t || !p) return null;
    const leaf = p.phaseType === 'KNOCKOUT' ? 'bracket' : 'standings';
    return ['/tournaments', t.id, 'phases', p.id, leaf];
  });

  protected readonly standingsTitle = computed(() =>
    this.isKnockout() ? 'Chaveamento' : 'Classificação',
  );

  protected readonly standingsSubtitle = computed(() =>
    this.isKnockout()
      ? 'Confrontos, vencedores e disputa de 3º'
      : 'Tabela e finalização da fase',
  );

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

  protected typeIconFor(type: TournamentPhaseType) {
    switch (type) {
      case 'ROUND_ROBIN':
        return this.repeatIcon;
      case 'KNOCKOUT':
        return this.crownIcon;
      case 'GROUPS':
        return this.gridIcon;
    }
  }

  private _load(tid: string, pid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
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
