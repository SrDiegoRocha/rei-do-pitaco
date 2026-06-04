import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { MatchesService } from '@core/services/matches.service';
import { PhasesService } from '@core/services/phases.service';
import { TournamentsService } from '@core/services/tournaments.service';
import {
  currentKnockoutRound,
  expectedKnockoutRounds,
  isCurrentKnockoutRoundDone,
  isKnockoutFinalDone,
} from '@core/utils/knockout-state';
import { knockoutRoundLabel } from '@core/utils/round-label';
import { listStagger } from '@shared/animations/animations';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { FabComponent } from '@shared/components/fab/fab.component';
import { MatchRowComponent } from '@shared/components/match-row/match-row.component';
import { ToastService } from '@shared/services/toast.service';
import { ScrollReturnService } from '@shared/services/scroll-return.service';
import { BracketService } from '@core/services/bracket.service';
import { IBracketResponse } from '@core/interfaces/bracket.interface';
import {
  CalendarDays,
  CheckCircle2,
  Flag,
  LucideAngularModule,
  Plus,
  Sparkles,
} from 'lucide-angular';

interface IGroupOption {
  id: string;
  name: string;
}

const ROUND_KEY = 'reidopitaco.phaseMatches.round';
const GROUP_KEY = 'reidopitaco.phaseMatches.group';

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage indisponível — só não persiste.
  }
}

@Component({
  selector: 'app-phase-matches',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    MatchRowComponent,
    EmptyStateComponent,
    FabComponent,
    ButtonComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phase-matches.component.html',
  styleUrl: './phase-matches.component.scss',
  animations: [listStagger],
})
export class PhaseMatchesComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _matchesService = inject(MatchesService);
  private readonly _bracketService = inject(BracketService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _scrollReturn = inject(ScrollReturnService);
  private readonly _injector = inject(Injector);

  private _pendingScrollAnchor: string | null = null;

  protected readonly calendarIcon = CalendarDays;
  protected readonly plusIcon = Plus;
  protected readonly sparklesIcon = Sparkles;
  protected readonly checkIcon = CheckCircle2;
  protected readonly flagIcon = Flag;

  protected readonly bracket = signal<IBracketResponse | null>(null);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly matches = signal<IMatchResponse[]>([]);

  // Filtros iniciam no último valor escolhido pelo usuário (persistido).
  // São validados contra os dados após a carga (ver _applyStoredFilters).
  protected readonly selectedRound = signal<number | null>(
    PhaseMatchesComponent._readStoredRound(),
  );
  protected readonly selectedGroupId = signal<string | null>(
    readStored(GROUP_KEY),
  );

  private static _readStoredRound(): number | null {
    const raw = readStored(ROUND_KEY);
    if (raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) ? n : null;
  }

  protected readonly generateDialogOpen = signal(false);
  protected readonly generating = signal(false);

  protected readonly newMatchHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    return t && p
      ? `/tournaments/${t.id}/phases/${p.id}/matches/new`
      : null;
  });

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  protected readonly isGroupsPhase = computed(
    () => this.phase()?.phaseType === 'GROUPS',
  );

  protected readonly isKnockoutPhase = computed(
    () => this.phase()?.phaseType === 'KNOCKOUT',
  );

  protected readonly isFinalized = computed(
    () => this.phase()?.finalizedAt != null,
  );

  /** Fase de mata-mata realmente terminada — chegou na rodada final e está decidida. */
  protected readonly isFinalDone = computed(() => {
    if (!this.isKnockoutPhase()) return false;
    const p = this.phase();
    if (!p) return false;
    return isKnockoutFinalDone(this.bracket(), p.teamCount, p.hasThirdPlace);
  });

  /** A rodada atual do KO está toda decidida (pronta pra gerar a próxima). */
  protected readonly isCurrentRoundDone = computed(() => {
    if (!this.isKnockoutPhase()) return false;
    return isCurrentKnockoutRoundDone(this.bracket());
  });

  /** Pronto para gerar a próxima rodada (KO + rodada atual decidida + não é a final). */
  protected readonly canGenerateNextRound = computed(() => {
    if (!this.isKnockoutPhase()) return false;
    if (this.isFinalDone()) return false;
    if (!this.isCurrentRoundDone()) return false;
    return true;
  });

  protected readonly currentRoundNumber = computed(() =>
    currentKnockoutRound(this.bracket()),
  );

  protected readonly currentRoundFriendlyLabel = computed(() => {
    const r = this.currentRoundNumber();
    const p = this.phase();
    if (r === null || !p) return null;
    return knockoutRoundLabel(r, p.teamCount);
  });

  protected readonly nextRoundFriendlyLabel = computed(() => {
    const r = this.currentRoundNumber();
    const p = this.phase();
    if (r === null || !p) return null;
    const expected = expectedKnockoutRounds(p.teamCount);
    if (expected === 0 || r >= expected) return null;
    const base = knockoutRoundLabel(r + 1, p.teamCount);
    // Quando a próxima rodada é a final E a fase tem disputa de 3º lugar,
    // a geração automática cria os 2 confrontos juntos.
    if (r + 1 === expected && p.hasThirdPlace) {
      return `${base} + Disputa de 3º lugar`;
    }
    return base;
  });

  protected readonly canCreateMatch = computed(() => {
    if (!this.isOwner()) return false;
    if (this.tournament()?.status === 'FINISHED') return false;
    if (this.isFinalized()) return false;
    if (this.isKnockoutPhase() && this.isFinalDone()) return false;
    return true;
  });

  protected readonly canGenerate = computed(() => {
    if (!this.isOwner()) return false;
    const t = this.tournament();
    const p = this.phase();
    if (!t || !p) return false;
    if (t.status === 'FINISHED') return false;
    if (this.isFinalized()) return false;
    if (p.matchGenerationMode !== 'AUTOMATIC') return false;
    if (this.isKnockoutPhase()) {
      if (this.isFinalDone()) return false;
      // Pode gerar quando não há matches (primeira rodada) ou
      // quando a rodada atual está decidida (próxima rodada).
      if (this.matches().length === 0) return true;
      return this.isCurrentRoundDone();
    }
    return this.matches().length === 0;
  });

  protected readonly bracketHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    return t && p ? `/tournaments/${t.id}/phases/${p.id}/bracket` : null;
  });

  protected readonly standingsHref = computed(() => {
    const t = this.tournament();
    const p = this.phase();
    return t && p ? `/tournaments/${t.id}/phases/${p.id}/standings` : null;
  });

  protected readonly finalizeHref = computed(() => {
    return this.isKnockoutPhase()
      ? this.bracketHref()
      : this.standingsHref();
  });

  protected readonly generateLabel = computed(() => {
    if (this.isKnockoutPhase() && this.matches().length > 0) {
      return 'Gerar próxima rodada';
    }
    return 'Gerar partidas';
  });

  protected readonly generateDescription = computed(() => {
    const p = this.phase();
    if (!p) return '';
    if (this.isKnockoutPhase() && this.matches().length > 0) {
      return 'Gera a próxima rodada a partir dos vencedores da rodada anterior. Só conclua quando todos os resultados da rodada atual estiverem lançados.';
    }
    if (p.phaseType === 'KNOCKOUT') {
      return 'Gera o chaveamento inicial. Requer um número de times que seja potência de 2.';
    }
    if (p.phaseType === 'GROUPS') {
      return 'Gera todas as rodadas de cada grupo usando o algoritmo de Berger. Esta fase precisa estar sem partidas.';
    }
    return 'Gera todas as rodadas usando o algoritmo de Berger. Esta fase precisa estar sem partidas.';
  });

  protected readonly rounds = computed<number[]>(() => {
    const set = new Set<number>();
    for (const m of this.matches()) set.add(m.round);
    return Array.from(set).sort((a, b) => a - b);
  });

  protected readonly groups = computed<IGroupOption[]>(() => {
    if (!this.isGroupsPhase()) return [];
    const map = new Map<string, string>();
    for (const m of this.matches()) {
      if (m.groupId && m.groupName) {
        map.set(m.groupId, m.groupName);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly filteredMatches = computed<IMatchResponse[]>(() => {
    let list = this.matches();
    const round = this.selectedRound();
    const groupId = this.selectedGroupId();
    if (round !== null) list = list.filter((m) => m.round === round);
    if (groupId !== null) list = list.filter((m) => m.groupId === groupId);
    return list;
  });

  protected readonly matchesByRound = computed<
    { round: number; matches: IMatchResponse[] }[]
  >(() => {
    const filtered = this.filteredMatches();
    const map = new Map<number, IMatchResponse[]>();
    for (const m of filtered) {
      if (!map.has(m.round)) map.set(m.round, []);
      const arr = map.get(m.round);
      if (arr) arr.push(m);
    }
    return Array.from(map.entries())
      .map(([round, matches]) => ({ round, matches }))
      .sort((a, b) => a.round - b.round);
  });

  public ngOnInit(): void {
    const tid = this._route.snapshot.paramMap.get('id');
    const pid = this._route.snapshot.paramMap.get('pid');
    if (!tid || !pid) {
      this.loading.set(false);
      this.loadError.set('Fase não encontrada.');
      return;
    }
    // Se está voltando de uma partida, rola de volta até ela após carregar.
    this._pendingScrollAnchor = this._scrollReturn.consume(`${tid}/${pid}`);
    this._load(tid, pid);
  }

  private _listKey(): string {
    return `${this.tournament()?.id ?? ''}/${this.phase()?.id ?? ''}`;
  }

  /** Lembra a partida clicada para rolar até ela ao voltar. */
  protected rememberReturn(match: IMatchResponse): void {
    this._scrollReturn.set(this._listKey(), `match-${match.id}`);
  }

  /** Rola até a partida de origem assim que a lista renderiza. */
  private _scheduleScroll(): void {
    const anchor = this._pendingScrollAnchor;
    if (!anchor) return;
    this._pendingScrollAnchor = null;
    afterNextRender(
      () => {
        document
          .getElementById(anchor)
          ?.scrollIntoView({ behavior: 'auto', block: 'center' });
      },
      { injector: this._injector },
    );
  }

  protected openGenerateDialog(): void {
    if (!this.canGenerate()) return;
    this.generateDialogOpen.set(true);
  }

  protected closeGenerateDialog(): void {
    if (this.generating()) return;
    this.generateDialogOpen.set(false);
  }

  protected confirmGenerate(): void {
    const t = this.tournament();
    const p = this.phase();
    if (!t || !p) return;

    this.generating.set(true);
    this._matchesService
      .generate(t.id, p.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (created) => {
          this.generating.set(false);
          this.generateDialogOpen.set(false);
          this._toast.success(
            created.length === 1
              ? '1 partida gerada.'
              : `${created.length} partidas geradas.`,
          );
          const tid = t.id;
          const pid = p.id;
          this._matchesService
            .list(tid, pid)
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe({
              next: (all) => this.matches.set(all),
            });
        },
        error: (err: unknown) => {
          this.generating.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível gerar as partidas.';
          this._toast.error(message);
        },
      });
  }

  protected selectRound(round: number | null): void {
    this.selectedRound.set(round);
    writeStored(ROUND_KEY, round === null ? null : String(round));
  }

  protected selectGroup(groupId: string | null): void {
    this.selectedGroupId.set(groupId);
    writeStored(GROUP_KEY, groupId);
  }

  /**
   * Descarta filtros persistidos que não existem nos dados atuais (ex.: rodada
   * de outra fase, grupo inexistente) — evita cair num filtro vazio.
   */
  private _applyStoredFilters(): void {
    const round = this.selectedRound();
    if (round !== null && !this.rounds().includes(round)) {
      this.selectedRound.set(null);
    }
    const groupId = this.selectedGroupId();
    if (groupId !== null && !this.groups().some((g) => g.id === groupId)) {
      this.selectedGroupId.set(null);
    }
  }

  /** Rótulo amigável da rodada: usa "Oitavas/Quartas/..." em mata-mata. */
  protected roundLabel(round: number): string {
    const p = this.phase();
    if (p?.phaseType === 'KNOCKOUT') {
      return knockoutRoundLabel(round, p.teamCount);
    }
    return `Rodada ${round}`;
  }

  protected matchDetailLink(match: IMatchResponse): unknown[] {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid) return [];
    return ['/tournaments', tid, 'phases', pid, 'matches', match.id];
  }

  /**
   * Subdivide as partidas de uma rodada por grupo (fase de grupos).
   * Retorna `null` quando não há subdivisão útil (sem grupos em alguma
   * partida, ou um único grupo presente) — aí a lista é renderizada flat.
   */
  protected roundSubgroups(
    matches: IMatchResponse[],
  ): { id: string; name: string; matches: IMatchResponse[] }[] | null {
    const buckets = new Map<
      string,
      { id: string; name: string; matches: IMatchResponse[] }
    >();
    for (const m of matches) {
      if (!m.groupId || !m.groupName) return null;
      let bucket = buckets.get(m.groupId);
      if (!bucket) {
        bucket = { id: m.groupId, name: m.groupName, matches: [] };
        buckets.set(m.groupId, bucket);
      }
      bucket.matches.push(m);
    }
    if (buckets.size <= 1) return null;
    return Array.from(buckets.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  private _load(tid: string, pid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      matches: this._matchesService.list(tid, pid),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, matches }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.matches.set(matches);
          this._applyStoredFilters();
          this.loading.set(false);
          this._scheduleScroll();
          if (phase.phaseType === 'KNOCKOUT' && matches.length > 0) {
            this._bracketService
              .get(tid, pid)
              .pipe(takeUntilDestroyed(this._destroyRef))
              .subscribe({
                next: (b) => this.bracket.set(b),
                error: () => this.bracket.set(null),
              });
          }
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
                : 'Não foi possível carregar as partidas.',
            );
          }
        },
      });
  }
}
