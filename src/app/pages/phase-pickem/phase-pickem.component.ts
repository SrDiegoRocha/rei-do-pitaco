import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthState } from '@core/auth/auth-state';
import { ApiException } from '@core/errors/api-error';
import { IPage } from '@core/interfaces/api.interface';
import { ITeamRef } from '@core/interfaces/match.interface';
import { IPhaseResponse } from '@core/interfaces/phase.interface';
import {
  IGroupBlock,
  IPhasePredictionResponse,
  IPhasePredictionStatsResponse,
  IPhasePredictionTemplateResponse,
  IPlacePhasePredictionRequest,
  IPositionPick,
  ITiePick,
  PickemStateReason,
} from '@core/interfaces/pickem.interface';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { PhasesService } from '@core/services/phases.service';
import { PickemService } from '@core/services/pickem.service';
import { TournamentsService } from '@core/services/tournaments.service';
import { backdropFade, dialogFade } from '@shared/animations/animations';
import { AvatarComponent } from '@shared/components/avatar/avatar.component';
import {
  BracketTreeComponent,
  IBracketTreePick,
} from '@shared/components/bracket-tree/bracket-tree.component';
import {
  IBracketTreeData,
  IBracketTreeRound,
  IBracketTreeSlot,
} from '@shared/components/bracket-tree/bracket-tree.model';
import { ButtonComponent } from '@shared/components/button/button.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PickemViewComponent } from '@shared/components/pickem-view/pickem-view.component';
import { TeamBadgeComponent } from '@shared/components/team-badge/team-badge.component';
import { ToastService } from '@shared/services/toast.service';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDashed,
  Clock,
  Lock,
  LucideAngularModule,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-angular';

type PickemSection = 'mine' | 'all' | 'stats';

/** Chave do bloco único de ROUND_ROBIN no estado do editor de tabela. */
const RR_KEY = '__rr__';

const NOT_READY_MESSAGE: Record<PickemStateReason, string> = {
  TOURNAMENT_NOT_IN_PROGRESS:
    'O torneio ainda não está em andamento — o Palpitão abre quando ele começar.',
  NO_TEAMS: 'Os times desta fase ainda não foram definidos.',
  NO_GROUPS: 'Os grupos desta fase ainda não foram criados.',
  TEAMS_NOT_ASSIGNED_TO_GROUPS:
    'Os times ainda não foram distribuídos nos grupos.',
  NO_QUALIFICATION_ZONES:
    'A fase ainda não tem zona de classificação configurada — sem ela não há o que prever.',
  BRACKET_NOT_GENERATED:
    'O chaveamento ainda não foi sorteado — o Palpitão abre quando a 1ª rodada for gerada.',
};

interface IScoringChip {
  label: string;
  value: number;
}

interface IKoDerived {
  tree: IBracketTreeData;
  ties: ITiePick[];
  decided: number;
  total: number;
}

@Component({
  selector: 'app-phase-pickem',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    LucideAngularModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    PaginationComponent,
    AvatarComponent,
    TeamBadgeComponent,
    BracketTreeComponent,
    PickemViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phase-pickem.component.html',
  styleUrl: './phase-pickem.component.scss',
  animations: [backdropFade, dialogFade],
})
export class PhasePickemComponent implements OnInit {
  private readonly _tournamentsService = inject(TournamentsService);
  private readonly _phasesService = inject(PhasesService);
  private readonly _pickemService = inject(PickemService);
  private readonly _authState = inject(AuthState);
  private readonly _toast = inject(ToastService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly clockIcon = Clock;
  protected readonly lockIcon = Lock;
  protected readonly circleDashedIcon = CircleDashed;
  protected readonly checkIcon = Check;
  protected readonly chevronUpIcon = ChevronUp;
  protected readonly chevronDownIcon = ChevronDown;
  protected readonly chevronRightIcon = ChevronRight;
  protected readonly xIcon = X;
  protected readonly alertIcon = AlertTriangle;
  protected readonly refreshIcon = RefreshCw;
  protected readonly trashIcon = Trash2;
  protected readonly usersIcon = Users;
  protected readonly chartIcon = BarChart3;
  protected readonly sparklesIcon = Sparkles;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tournament = signal<ITournamentResponse | null>(null);
  protected readonly phase = signal<IPhaseResponse | null>(null);
  protected readonly template =
    signal<IPhasePredictionTemplateResponse | null>(null);
  protected readonly mine = signal<IPhasePredictionResponse | null>(null);
  /** Requester não é member ACTIVE (vê tudo, mas não palpita). */
  protected readonly notMember = signal(false);

  protected readonly section = signal<PickemSection>('mine');

  // ── Galera (listagem paginada) ─────────────────────────────────────────
  protected readonly listPage =
    signal<IPage<IPhasePredictionResponse> | null>(null);
  protected readonly listLoading = signal(false);

  // ── Previsão da galera (stats) ─────────────────────────────────────────
  protected readonly stats = signal<IPhasePredictionStatsResponse | null>(null);
  protected readonly statsLoading = signal(false);

  // ── Diálogos / ações ───────────────────────────────────────────────────
  protected readonly viewing = signal<IPhasePredictionResponse | null>(null);
  protected readonly saving = signal(false);
  protected readonly confirmPartialOpen = signal(false);
  protected readonly confirmDeleteOpen = signal(false);
  protected readonly deleting = signal(false);
  protected readonly confirmRecalcOpen = signal(false);
  protected readonly recalculating = signal(false);

  // ── Editores ───────────────────────────────────────────────────────────
  /** Tabela: slots da zona por bloco (groupId ?? RR_KEY) → teamId|null por posição. */
  protected readonly tableSlots = signal<Record<string, (string | null)[]>>({});
  /** Bracket: vencedor escolhido por slot ("round:slot:matchType" → teamId). */
  protected readonly bracketPicks = signal<Record<string, string>>({});

  /** Relógio para o countdown da trava (atualiza a cada 15s). */
  private readonly _now = signal(Date.now());
  private _autoRefreshed = false;

  constructor() {
    const timer = setInterval(() => {
      this._now.set(Date.now());
      this._maybeAutoLock();
    }, 15_000);
    this._destroyRef.onDestroy(() => clearInterval(timer));
  }

  protected readonly myUserId = computed(
    () => this._authState.user()?.id ?? null,
  );

  protected readonly isOwner = computed(() => {
    const t = this.tournament();
    const user = this._authState.user();
    return !!(t && user && t.owner.id === user.id);
  });

  protected readonly backHref = computed(() => {
    const t = this.tournament();
    return t ? `/tournaments/${t.id}` : '/tournaments';
  });

  protected readonly state = computed(() => this.template()?.state ?? null);
  protected readonly isOpen = computed(() => this.state() === 'OPEN');
  protected readonly isLocked = computed(() => this.state() === 'LOCKED');
  protected readonly isNotReady = computed(() => this.state() === 'NOT_READY');

  protected readonly isTable = computed(
    () => this.template()?.phaseType !== 'KNOCKOUT',
  );

  /**
   * Bracket sem chaveamento fixo: os cruzamentos das próximas rodadas serão
   * sorteados, então o palpite de confronto é uma aposta no sorteio.
   */
  protected readonly isRedrawBracket = computed(
    () => this.template()?.bracket?.bracketMode === 'REDRAW_EACH_ROUND',
  );

  protected readonly notReadyMessage = computed(() => {
    const reason = this.template()?.stateReason;
    return reason
      ? NOT_READY_MESSAGE[reason]
      : 'O Palpitão desta fase ainda não está disponível.';
  });

  /** Countdown/regra da trava enquanto aberto. */
  protected readonly lockLabel = computed<string | null>(() => {
    const t = this.template();
    if (!t || t.state !== 'OPEN') return null;
    if (!t.lockAt) return 'Trava quando o primeiro resultado for lançado.';
    const diff = new Date(t.lockAt).getTime() - this._now();
    if (diff <= 0) return 'Travando…';
    const minutes = Math.floor(diff / 60_000);
    const days = Math.floor(minutes / (60 * 24));
    const hours = Math.floor((minutes % (60 * 24)) / 60);
    const mins = minutes % 60;
    if (days > 0) return `Trava em ${days}d ${hours}h`;
    if (hours > 0) return `Trava em ${hours}h ${mins}min`;
    return `Trava em ${Math.max(mins, 1)}min`;
  });

  protected readonly lockAtLabel = computed<string | null>(() => {
    const iso = this.template()?.lockAt;
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return null;
    }
  });

  protected readonly scoringChips = computed<IScoringChip[]>(() => {
    const t = this.template();
    if (!t) return [];
    const s = t.scoring;
    if (t.phaseType === 'KNOCKOUT') {
      const chips: IScoringChip[] = [
        { label: 'Confronto cravado', value: s.koMatchupExactPoints },
        { label: '1 time do confronto', value: s.koMatchupPartialPoints },
        { label: 'Campeão', value: s.championPoints },
        { label: 'Vice', value: s.runnerUpPoints },
      ];
      const hasThird =
        t.bracket?.hasThirdPlace ?? this.phase()?.hasThirdPlace ?? false;
      if (hasThird) chips.push({ label: '3º lugar', value: s.thirdPlacePoints });
      return chips;
    }
    return [
      { label: 'Classificado', value: s.qualifierPoints },
      { label: 'Posição exata', value: s.exactPositionPoints },
      { label: '1º lugar', value: s.firstPlacePoints },
    ];
  });

  // ── Editor de tabela ───────────────────────────────────────────────────

  protected readonly editorBlocks = computed<IGroupBlock[]>(
    () => this.template()?.table?.groups ?? [],
  );

  protected blockKey(block: IGroupBlock): string {
    return block.groupId ?? RR_KEY;
  }

  protected slotsOf(block: IGroupBlock): (string | null)[] {
    return this.tableSlots()[this.blockKey(block)] ?? [];
  }

  protected teamOf(block: IGroupBlock, teamId: string | null): ITeamRef | null {
    if (!teamId) return null;
    return block.teams.find((t) => t.id === teamId) ?? null;
  }

  /** Times do bloco ainda sem vaga (pool abaixo dos slots). */
  protected poolOf(block: IGroupBlock): ITeamRef[] {
    const assigned = new Set(this.slotsOf(block).filter((id) => id !== null));
    return block.teams.filter((t) => !assigned.has(t.id));
  }

  protected hasEmptySlot(block: IGroupBlock): boolean {
    return this.slotsOf(block).some((id) => id === null);
  }

  protected pickPoolTeam(block: IGroupBlock, teamId: string): void {
    const key = this.blockKey(block);
    this.tableSlots.update((all) => {
      const arr = [...(all[key] ?? [])];
      const empty = arr.indexOf(null);
      if (empty < 0) return all;
      arr[empty] = teamId;
      return { ...all, [key]: arr };
    });
  }

  protected removeSlot(block: IGroupBlock, index: number): void {
    const key = this.blockKey(block);
    this.tableSlots.update((all) => {
      const arr = [...(all[key] ?? [])];
      if (index < 0 || index >= arr.length) return all;
      arr[index] = null;
      return { ...all, [key]: arr };
    });
  }

  protected moveSlot(block: IGroupBlock, index: number, delta: -1 | 1): void {
    const key = this.blockKey(block);
    this.tableSlots.update((all) => {
      const arr = [...(all[key] ?? [])];
      const target = index + delta;
      if (index < 0 || target < 0 || index >= arr.length || target >= arr.length) {
        return all;
      }
      [arr[index], arr[target]] = [arr[target]!, arr[index]!];
      return { ...all, [key]: arr };
    });
  }

  // ── Editor de bracket ──────────────────────────────────────────────────

  /**
   * Deriva a árvore do bracket a partir do template + escolhas: rodada 1 vem
   * fixa, rodadas seguintes recebem os vencedores escolhidos, e escolhas que
   * ficaram inválidas (o time escolhido não está mais no par) são podadas em
   * cascata automaticamente.
   */
  protected readonly koDerived = computed<IKoDerived | null>(() => {
    const tmpl = this.template()?.bracket ?? null;
    if (!tmpl) return null;
    const picks = this.bracketPicks();
    const total = tmpl.totalRounds;
    const r1 = tmpl.rounds.find((r) => r.roundNumber === 1) ?? null;

    const rounds: IBracketTreeRound[] = [];
    const winners: (ITeamRef | null)[][] = [];
    const losers: (ITeamRef | null)[][] = [];
    const ties: ITiePick[] = [];
    let decided = 0;

    for (let r = 1; r <= total; r++) {
      const count = Math.pow(2, total - r);
      const slots: IBracketTreeSlot[] = [];
      winners.push(new Array<ITeamRef | null>(count).fill(null));
      losers.push(new Array<ITeamRef | null>(count).fill(null));
      for (let s = 0; s < count; s++) {
        let home: ITeamRef | null;
        let away: ITeamRef | null;
        if (r === 1) {
          const slot = r1?.slots.find((x) => x.slotIndex === s) ?? null;
          home = slot?.homeTeam ?? null;
          away = slot?.awayTeam ?? null;
        } else {
          home = winners[r - 2]?.[s * 2] ?? null;
          away = winners[r - 2]?.[s * 2 + 1] ?? null;
        }
        const pickable = !!home && !!away;
        const raw = picks[`${r}:${s}:REGULAR`] ?? null;
        let winner: ITeamRef | null = null;
        if (pickable && raw) {
          if (home!.id === raw) winner = home;
          else if (away!.id === raw) winner = away;
        }
        if (winner && home && away) {
          winners[r - 1]![s] = winner;
          losers[r - 1]![s] = home.id === winner.id ? away : home;
          decided++;
          ties.push({
            roundNumber: r,
            slotIndex: s,
            matchType: 'REGULAR',
            homeTeamId: home.id,
            awayTeamId: away.id,
            winnerTeamId: winner.id,
          });
        }
        slots.push({
          roundNumber: r,
          slotIndex: s,
          matchType: 'REGULAR',
          homeTeam: home,
          awayTeam: away,
          winnerTeamId: winner?.id ?? null,
          pickable,
        });
      }
      rounds.push({ roundNumber: r, name: '', slots });
    }

    const hasThird = tmpl.hasThirdPlace && total >= 2;
    let thirdSlot: IBracketTreeSlot | null = null;
    let thirdWinner: ITeamRef | null = null;
    if (hasThird) {
      const home = losers[total - 2]?.[0] ?? null;
      const away = losers[total - 2]?.[1] ?? null;
      const pickable = !!home && !!away;
      const raw = picks[`${total}:0:THIRD_PLACE`] ?? null;
      if (pickable && raw) {
        if (home!.id === raw) thirdWinner = home;
        else if (away!.id === raw) thirdWinner = away;
      }
      if (thirdWinner && home && away) {
        decided++;
        ties.push({
          roundNumber: total,
          slotIndex: 0,
          matchType: 'THIRD_PLACE',
          homeTeamId: home.id,
          awayTeamId: away.id,
          winnerTeamId: thirdWinner.id,
        });
      }
      thirdSlot = {
        roundNumber: total,
        slotIndex: 0,
        matchType: 'THIRD_PLACE',
        homeTeam: home,
        awayTeam: away,
        winnerTeamId: thirdWinner?.id ?? null,
        pickable,
      };
    }

    const champion = winners[total - 1]?.[0] ?? null;
    const runnerUp = losers[total - 1]?.[0] ?? null;

    return {
      tree: {
        totalRounds: total,
        rounds,
        thirdPlace: thirdSlot,
        champion,
        runnerUp,
        thirdPlaceWinner: thirdWinner,
      },
      ties,
      decided,
      total: Math.pow(2, total) - 1 + (hasThird ? 1 : 0),
    };
  });

  protected onTreePick(pick: IBracketTreePick): void {
    const key = `${pick.slot.roundNumber}:${pick.slot.slotIndex}:${pick.slot.matchType}`;
    this.bracketPicks.update((all) => {
      // Tocar no vencedor atual desfaz a escolha.
      if (all[key] === pick.teamId) {
        const next = { ...all };
        delete next[key];
        return next;
      }
      return { ...all, [key]: pick.teamId };
    });
  }

  // ── Progresso / palpite parcial ────────────────────────────────────────

  protected readonly missingCount = computed(() => {
    if (!this.isTable()) {
      const ko = this.koDerived();
      return ko ? ko.total - ko.decided : 0;
    }
    let missing = 0;
    for (const block of this.editorBlocks()) {
      missing += this.slotsOf(block).filter((id) => id === null).length;
    }
    return missing;
  });

  protected readonly filledCount = computed(() => {
    if (!this.isTable()) return this.koDerived()?.decided ?? 0;
    let filled = 0;
    for (const block of this.editorBlocks()) {
      filled += this.slotsOf(block).filter((id) => id !== null).length;
    }
    return filled;
  });

  // ── Ciclo de vida ──────────────────────────────────────────────────────

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

  private _load(tid: string, pid: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      tournament: this._tournamentsService.getById(tid),
      phase: this._phasesService.getById(tid, pid),
      template: this._pickemService.template(tid, pid),
      mine: this._pickemService.getMine(tid, pid).pipe(
        catchError((err: unknown) => {
          if (err instanceof ApiException && err.isForbidden) {
            this.notMember.set(true);
          }
          return of<IPhasePredictionResponse | null>(null);
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ tournament, phase, template, mine }) => {
          this.tournament.set(tournament);
          this.phase.set(phase);
          this.template.set(template);
          this.mine.set(mine);
          this._initEditors();
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          if (err instanceof ApiException) {
            this.loadError.set(
              err.isNotFound ? 'Fase não encontrada.' : err.message,
            );
          } else {
            this.loadError.set('Não foi possível carregar o Palpitão.');
          }
        },
      });
  }

  /** Preenche os editores com o template (e o meu Pick'em, se existir). */
  private _initEditors(): void {
    const tmpl = this.template();
    if (!tmpl) return;
    const mine = this.mine();

    if (tmpl.table) {
      const slots: Record<string, (string | null)[]> = {};
      for (const block of tmpl.table.groups) {
        slots[block.groupId ?? RR_KEY] = new Array<string | null>(
          block.qualifyingDepth,
        ).fill(null);
      }
      if (mine) {
        for (const row of mine.positions) {
          const arr = slots[row.groupId ?? RR_KEY];
          if (
            arr &&
            row.predictedPosition >= 1 &&
            row.predictedPosition <= arr.length
          ) {
            arr[row.predictedPosition - 1] = row.team.id;
          }
        }
      }
      this.tableSlots.set(slots);
    }

    if (tmpl.bracket) {
      const picks: Record<string, string> = {};
      if (mine) {
        for (const tie of mine.ties) {
          picks[`${tie.roundNumber}:${tie.slotIndex}:${tie.matchType}`] =
            tie.winnerTeam.id;
        }
      }
      this.bracketPicks.set(picks);
    }
  }

  /** Passou do lockAt com a página aberta: recarrega o template (vira LOCKED). */
  private _maybeAutoLock(): void {
    if (this._autoRefreshed) return;
    const t = this.template();
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!t || !tid || !pid || t.state !== 'OPEN' || !t.lockAt) return;
    if (Date.now() < new Date(t.lockAt).getTime()) return;
    this._autoRefreshed = true;
    this._pickemService
      .template(tid, pid)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (fresh) => this.template.set(fresh),
        error: () => {
          // Silencioso — o backend continua sendo a fonte da trava.
        },
      });
  }

  // ── Seções ─────────────────────────────────────────────────────────────

  protected selectSection(section: PickemSection): void {
    this.section.set(section);
    if (section === 'all' && !this.listPage() && !this.listLoading()) {
      this.loadList(0);
    }
    if (section === 'stats' && !this.stats() && !this.statsLoading()) {
      this._loadStats();
    }
  }

  protected loadList(page: number): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid) return;
    this.listLoading.set(true);
    this._pickemService
      .list(tid, pid, page, 20)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.listPage.set(result);
          this.listLoading.set(false);
        },
        error: () => {
          this.listLoading.set(false);
          this._toast.error('Não foi possível carregar os palpitões.');
        },
      });
  }

  private _loadStats(): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid) return;
    this.statsLoading.set(true);
    this._pickemService
      .stats(tid, pid)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.stats.set(result);
          this.statsLoading.set(false);
        },
        error: () => {
          this.statsLoading.set(false);
          this._toast.error('Não foi possível carregar a previsão da galera.');
        },
      });
  }

  protected listRank(index: number): number {
    const page = this.listPage();
    if (!page) return index + 1;
    return page.number * page.size + index + 1;
  }

  // ── Ver palpitão de um participante ────────────────────────────────────

  protected openView(pickem: IPhasePredictionResponse): void {
    this.viewing.set(pickem);
  }

  protected closeView(): void {
    this.viewing.set(null);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.viewing()) this.closeView();
  }

  // ── Salvar / remover ───────────────────────────────────────────────────

  private _buildPayload(): IPlacePhasePredictionRequest | null {
    const tmpl = this.template();
    if (!tmpl) return null;
    if (tmpl.phaseType === 'KNOCKOUT') {
      const ko = this.koDerived();
      return ko ? { ties: ko.ties } : null;
    }
    const isGroups = tmpl.phaseType === 'GROUPS';
    const positions: IPositionPick[] = [];
    for (const block of this.editorBlocks()) {
      const arr = this.slotsOf(block);
      arr.forEach((teamId, idx) => {
        if (!teamId) return;
        const pick: IPositionPick = { teamId, position: idx + 1 };
        if (isGroups) pick.groupId = block.groupId;
        positions.push(pick);
      });
    }
    return { positions };
  }

  protected save(): void {
    if (this.saving()) return;
    if (this.filledCount() === 0) {
      this._toast.error('Preencha pelo menos um palpite antes de salvar.');
      return;
    }
    if (this.missingCount() > 0) {
      this.confirmPartialOpen.set(true);
      return;
    }
    this._doSave();
  }

  protected confirmPartialSave(): void {
    this._doSave();
  }

  protected cancelPartialSave(): void {
    if (this.saving()) return;
    this.confirmPartialOpen.set(false);
  }

  private _doSave(): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    const payload = this._buildPayload();
    if (!tid || !pid || !payload) return;

    this.saving.set(true);
    this._pickemService
      .upsertMine(tid, pid, payload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.confirmPartialOpen.set(false);
          this.mine.set(saved);
          this.listPage.set(null);
          this.stats.set(null);
          this._toast.success('Palpitão salvo!');
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.confirmPartialOpen.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível salvar o Palpitão.',
          );
        },
      });
  }

  protected requestDelete(): void {
    if (!this.mine()) return;
    this.confirmDeleteOpen.set(true);
  }

  protected cancelDelete(): void {
    if (this.deleting()) return;
    this.confirmDeleteOpen.set(false);
  }

  protected confirmDelete(): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid || this.deleting()) return;
    this.deleting.set(true);
    this._pickemService
      .removeMine(tid, pid)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.confirmDeleteOpen.set(false);
          this.mine.set(null);
          this.listPage.set(null);
          this.stats.set(null);
          this._initEditors();
          this._toast.success('Palpitão removido.');
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          this.confirmDeleteOpen.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível remover o Palpitão.',
          );
        },
      });
  }

  // ── Recalcular (owner) ─────────────────────────────────────────────────

  protected requestRecalculate(): void {
    if (!this.isOwner()) return;
    this.confirmRecalcOpen.set(true);
  }

  protected cancelRecalculate(): void {
    if (this.recalculating()) return;
    this.confirmRecalcOpen.set(false);
  }

  protected confirmRecalculate(): void {
    const tid = this.tournament()?.id;
    const pid = this.phase()?.id;
    if (!tid || !pid || this.recalculating()) return;
    this.recalculating.set(true);
    this._pickemService
      .recalculate(tid, pid)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.recalculating.set(false);
          this.confirmRecalcOpen.set(false);
          this._toast.success(
            `${result.pickemsRecalculated} ${
              result.pickemsRecalculated === 1
                ? 'palpitão repontuado'
                : 'palpitões repontuados'
            }.`,
          );
          // Recarrega o que estiver em tela.
          const mineNow = this.mine();
          if (mineNow) {
            this._pickemService
              .getMine(tid, pid)
              .pipe(takeUntilDestroyed(this._destroyRef))
              .subscribe({ next: (fresh) => this.mine.set(fresh) });
          }
          this.listPage.set(null);
          if (this.section() === 'all') this.loadList(0);
        },
        error: (err: unknown) => {
          this.recalculating.set(false);
          this.confirmRecalcOpen.set(false);
          this._toast.error(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível recalcular.',
          );
        },
      });
  }

  protected scoredAtLabel(iso: string | null): string | null {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return null;
    }
  }
}
