import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiException } from '@core/errors/api-error';
import { IPredictionResponse } from '@core/interfaces/prediction.interface';
import { IUserMatchResponse } from '@core/interfaces/user-match.interface';
import { PredictionsService } from '@core/services/predictions.service';
import { UserMatchesService } from '@core/services/user-matches.service';
import { listStagger } from '@shared/animations/animations';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { MatchRowComponent } from '@shared/components/match-row/match-row.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  IPredictionPayload,
  PredictionDialogComponent,
} from '@shared/components/prediction-dialog/prediction-dialog.component';
import { ToastService } from '@shared/services/toast.service';
import {
  CalendarClock,
  CalendarDays,
  LucideAngularModule,
  Sparkles,
  Trophy,
} from 'lucide-angular';

/**
 * Bloco de partidas de um mesmo torneio dentro de um dia — vira um único card,
 * economizando espaço quando há vários jogos da mesma competição no mesmo dia.
 */
interface ITournamentDayBlock {
  tournamentId: string;
  tournament: IUserMatchResponse['tournament'];
  items: IUserMatchResponse[];
}

/** Um dia da timeline, com as partidas daquele dia agrupadas por torneio. */
interface IDayGroup {
  /** Chave estável YYYY-MM-DD no fuso local. */
  key: string;
  /** Início do dia (00:00 local) — usado para ordenar e rotular. */
  date: Date;
  /** Rótulo amigável: "Hoje", "Amanhã", "Ontem" ou data por extenso. */
  label: string;
  isToday: boolean;
  /** Total de partidas no dia (para o contador do separador). */
  total: number;
  /** Partidas agrupadas por torneio, na ordem do primeiro jogo de cada um. */
  blocks: ITournamentDayBlock[];
}

const DAY_MS = 86_400_000;

// Paginação de rede. O futuro (jogos a palpitar) usa cursor com limite — exato
// e sem buracos. O passado (histórico) recua por janelas de data. A 1ª carga
// começa um pouco antes de hoje, pra cair no "hoje" com passado recente acima.
const INITIAL_BACK_DAYS = 3;
const PAGE_SIZE = 40;
const PAST_STEP_DAYS = 30;

@Component({
  selector: 'app-matches-feed',
  standalone: true,
  imports: [
    RouterLink,
    LucideAngularModule,
    PageHeaderComponent,
    MatchRowComponent,
    PredictionDialogComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matches-feed.component.html',
  styleUrl: './matches-feed.component.scss',
  animations: [listStagger],
})
export class MatchesFeedComponent implements OnInit {
  private readonly _userMatches = inject(UserMatchesService);
  private readonly _predictions = inject(PredictionsService);
  private readonly _toast = inject(ToastService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _injector = inject(Injector);
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly calendarIcon = CalendarDays;
  protected readonly todayIcon = CalendarClock;
  protected readonly trophyIcon = Trophy;
  protected readonly sparklesIcon = Sparkles;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<unknown>(null);

  /** Partidas acumuladas (deduplicadas por id, ordenadas por data). */
  protected readonly items = signal<IUserMatchResponse[]>([]);

  protected readonly loadingPast = signal(false);
  protected readonly loadingFuture = signal(false);
  protected readonly pastComplete = signal(false);
  protected readonly futureComplete = signal(false);

  /** Jogos esperando pitaco (badge do topo). */
  protected readonly pendingCount = signal(0);

  /** Botão flutuante "voltar para hoje" — visível quando o hoje sai da tela. */
  protected readonly showJumpToToday = signal(false);

  // Cursores de paginação (em ms).
  private _forwardFromMs = 0; // próximo `from` da paginação de futuro
  private _pastToMs = 0; // próximo `to` (exclusivo) da janela de passado

  private readonly _topSentinel =
    viewChild<ElementRef<HTMLElement>>('topSentinel');
  private readonly _bottomSentinel =
    viewChild<ElementRef<HTMLElement>>('bottomSentinel');

  private _scrollContainer: HTMLElement | null = null;
  private _observersReady = false;
  private _pastObserver: IntersectionObserver | null = null;
  private _futureObserver: IntersectionObserver | null = null;
  private _todayObserver: IntersectionObserver | null = null;

  /** Início do dia de hoje (local), em ms — referência para ancorar a timeline. */
  private readonly _todayMs = computed(() =>
    this._startOfDay(new Date()).getTime(),
  );

  /** Todas as partidas agrupadas por dia (local), em ordem cronológica. */
  protected readonly dayGroups = computed<IDayGroup[]>(() => {
    const todayStart = new Date(this._todayMs());
    const map = new Map<
      string,
      { meta: Omit<IDayGroup, 'blocks' | 'total'>; items: IUserMatchResponse[] }
    >();
    for (const item of this.items()) {
      const iso = item.match.scheduledAt;
      if (!iso) continue;
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) continue;
      const dayStart = this._startOfDay(date);
      const key = this._dayKey(dayStart);
      let group = map.get(key);
      if (!group) {
        group = {
          meta: {
            key,
            date: dayStart,
            label: this._dayLabel(dayStart, todayStart),
            isToday: dayStart.getTime() === todayStart.getTime(),
          },
          items: [],
        };
        map.set(key, group);
      }
      group.items.push(item);
    }
    return Array.from(map.values())
      .sort((a, b) => a.meta.date.getTime() - b.meta.date.getTime())
      .map((g) => ({
        ...g.meta,
        total: g.items.length,
        blocks: this._groupByTournament(g.items),
      }));
  });

  /** Dia âncora: o primeiro com data >= hoje (ou o último, se tudo é passado). */
  protected readonly anchorKey = computed<string | null>(() => {
    const groups = this.dayGroups();
    if (groups.length === 0) return null;
    const todayMs = this._todayMs();
    const future = groups.find((g) => g.date.getTime() >= todayMs);
    return (future ?? groups[groups.length - 1]).key;
  });

  // ── Modal de pitaco (aberto direto na timeline, sem navegar) ───────────
  protected readonly predictionItem = signal<IUserMatchResponse | null>(null);
  protected readonly predictionSubmitting = signal(false);
  protected readonly predictionError = signal<string | null>(null);

  protected readonly predictionMatch = computed(
    () => this.predictionItem()?.match ?? null,
  );
  protected readonly predictionCurrent = computed<IPredictionResponse | null>(
    () => {
      const item = this.predictionItem();
      return item ? this._toPrediction(item) : null;
    },
  );
  protected readonly predictionPenaltyEligible = computed(
    () => this.predictionItem()?.match.penaltyShootoutEligible === true,
  );
  protected readonly predictionAggregateBeforeHome = computed(
    () => this.predictionItem()?.match.aggregateBeforeHome ?? 0,
  );
  protected readonly predictionAggregateBeforeAway = computed(
    () => this.predictionItem()?.match.aggregateBeforeAway ?? 0,
  );
  protected readonly predictionTwoLegged = computed(
    () => this.predictionItem()?.phase.matchLegMode === 'TWO_LEGGED',
  );

  public ngOnInit(): void {
    this._destroyRef.onDestroy(() => this._disconnectObservers());
    this._load();
  }

  protected retry(): void {
    this._load();
  }

  /** Link para o detalhe da partida dentro da fase do seu torneio. */
  protected matchLink(item: IUserMatchResponse): unknown[] {
    return [
      '/tournaments',
      item.tournament.id,
      'phases',
      item.phase.id,
      'matches',
      item.match.id,
    ];
  }

  /** Cabeçalho de contexto do card: "Fase de Grupos · Grupo A · Rodada 2". */
  protected contextLabel(item: IUserMatchResponse): string {
    const parts: string[] = [item.phase.name];
    if (item.group) parts.push(item.group.name);
    if (item.phase.phaseType === 'KNOCKOUT') {
      if (item.match.matchType === 'THIRD_PLACE') parts.push('Disputa de 3º');
    } else {
      parts.push(`Rodada ${item.match.round}`);
    }
    return parts.join(' · ');
  }

  protected predictionFor(item: IUserMatchResponse): IPredictionResponse | null {
    return this._toPrediction(item);
  }

  protected tournamentInProgress(item: IUserMatchResponse): boolean {
    return item.tournament.status === 'IN_PROGRESS';
  }

  // ── Pitaco ─────────────────────────────────────────────────────────────
  protected openPredictionFor(match: { id: string }): void {
    const item = this.items().find((i) => i.match.id === match.id);
    if (!item) return;
    this.predictionError.set(null);
    this.predictionItem.set(item);
  }

  protected closePrediction(): void {
    if (this.predictionSubmitting()) return;
    this.predictionItem.set(null);
    this.predictionError.set(null);
  }

  protected submitPrediction(payload: IPredictionPayload): void {
    const item = this.predictionItem();
    if (!item) return;

    const hadPrediction = item.myPrediction !== null;
    this.predictionSubmitting.set(true);
    this.predictionError.set(null);

    this._predictions
      .upsertMine(item.tournament.id, item.match.id, payload)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (prediction) => {
          this.predictionSubmitting.set(false);
          this.predictionItem.set(null);
          this._applyPrediction(item.match.id, {
            id: prediction.id,
            homeScore: prediction.homeScore,
            awayScore: prediction.awayScore,
            penaltyWinner: prediction.penaltyWinner,
            points: prediction.points,
          });
          // Um pitaco novo (não edição) reduz a contagem de pendentes.
          if (!hadPrediction) {
            this.pendingCount.update((c) => Math.max(0, c - 1));
          }
        },
        error: (err: unknown) => {
          this.predictionSubmitting.set(false);
          const message =
            err instanceof ApiException
              ? err.message
              : 'Não foi possível salvar o pitaco.';
          this.predictionError.set(message);
          this._toast.error(message);
        },
      });
  }

  /** Rola de volta até o dia âncora ("hoje"). */
  protected jumpToToday(): void {
    const key = this.anchorKey();
    if (key) this._scrollToDay(key, 'smooth');
  }

  private _applyPrediction(
    matchId: string,
    myPrediction: IUserMatchResponse['myPrediction'],
  ): void {
    this.items.update((list) =>
      list.map((i) => (i.match.id === matchId ? { ...i, myPrediction } : i)),
    );
  }

  /** Adapta o palpite enxuto do feed ao shape esperado por row/dialog. */
  private _toPrediction(
    item: IUserMatchResponse,
  ): IPredictionResponse | null {
    const p = item.myPrediction;
    if (!p) return null;
    return {
      id: p.id,
      matchId: item.match.id,
      userId: '',
      userName: '',
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      penaltyWinner: p.penaltyWinner,
      points: p.points,
      createdAt: '',
      updatedAt: '',
    };
  }

  // ── Carga / paginação ──────────────────────────────────────────────────
  private _load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this._observersReady = false;
    this._disconnectObservers();
    this.items.set([]);
    this.pastComplete.set(false);
    this.futureComplete.set(false);

    const todayMs = this._todayMs();
    this._forwardFromMs = todayMs - INITIAL_BACK_DAYS * DAY_MS;
    this._pastToMs = this._forwardFromMs;

    this._userMatches
      .pendingCount()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (res) => this.pendingCount.set(res.count),
        error: () => this.pendingCount.set(0),
      });

    this._userMatches
      .list({ from: this._iso(this._forwardFromMs), limit: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => {
          this._mergeItems(page);
          this._advanceFutureCursor(page);
          this.loading.set(false);
          // Nada do dia de hoje pra frente: pode haver só histórico — busca-o.
          if (page.length === 0) this._loadMorePast();
          afterNextRender(
            () => {
              const key = this.anchorKey();
              if (key) this._scrollToDay(key, 'auto');
              this._initObservers();
            },
            { injector: this._injector },
          );
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.loadError.set(err);
        },
      });
  }

  private _loadMoreFuture(): void {
    if (this.loadingFuture() || this.futureComplete()) return;
    this.loadingFuture.set(true);
    this._userMatches
      .list({ from: this._iso(this._forwardFromMs), limit: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => {
          const before = this.items().length;
          this._mergeItems(page);
          const added = this.items().length - before;
          this._advanceFutureCursor(page);
          // Página só com duplicatas (mesmo timestamp na borda): evita loop.
          if (page.length > 0 && added === 0) this.futureComplete.set(true);
          this.loadingFuture.set(false);
        },
        error: () => this.loadingFuture.set(false),
      });
  }

  /**
   * Carrega a próxima janela de passado `[from, to)` recuando `PAST_STEP_DAYS`.
   * Preserva a posição visível compensando o `scrollTop` (o conteúdo novo entra
   * acima). Janela vazia → não há mais passado (tolera lacunas até o passo).
   */
  private _loadMorePast(): void {
    if (this.loadingPast() || this.pastComplete()) return;
    this.loadingPast.set(true);
    const fromMs = this._pastToMs - PAST_STEP_DAYS * DAY_MS;
    const toMs = this._pastToMs;

    this._userMatches
      .list({ from: this._iso(fromMs), to: this._iso(toMs) })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => {
          this._pastToMs = fromMs;
          if (page.length === 0) {
            this.pastComplete.set(true);
            this.loadingPast.set(false);
            return;
          }
          const container = this._scrollContainer;
          const prevTop = container?.scrollTop ?? 0;
          const prevHeight = container?.scrollHeight ?? 0;
          this._mergeItems(page);
          afterNextRender(
            () => {
              if (container) {
                const delta = container.scrollHeight - prevHeight;
                container.scrollTop = prevTop + delta;
              }
              this.loadingPast.set(false);
            },
            { injector: this._injector },
          );
        },
        error: () => this.loadingPast.set(false),
      });
  }

  /** Define o cursor de futuro e detecta o fim (página incompleta). */
  private _advanceFutureCursor(page: IUserMatchResponse[]): void {
    if (page.length < PAGE_SIZE) {
      this.futureComplete.set(true);
    }
    const last = page[page.length - 1];
    if (last?.match.scheduledAt) {
      const ms = Date.parse(last.match.scheduledAt);
      // `from` é inclusivo (>=): a próxima página repete a borda, mas o
      // _mergeItems deduplica por id.
      if (!Number.isNaN(ms)) this._forwardFromMs = ms;
    }
  }

  /** Une `incoming` aos itens atuais, deduplicando por id e reordenando. */
  private _mergeItems(incoming: IUserMatchResponse[]): void {
    if (incoming.length === 0) return;
    this.items.update((current) => {
      const byId = new Map(current.map((i) => [i.match.id, i]));
      for (const it of incoming) byId.set(it.match.id, it);
      return Array.from(byId.values()).sort((a, b) => {
        const ta = Date.parse(a.match.scheduledAt ?? '');
        const tb = Date.parse(b.match.scheduledAt ?? '');
        if (ta !== tb) return ta - tb;
        return (
          Date.parse(a.match.createdAt) - Date.parse(b.match.createdAt)
        );
      });
    });
  }

  private _scrollToDay(key: string, behavior: ScrollBehavior): void {
    document
      .getElementById(`feed-day-${key}`)
      ?.scrollIntoView({ behavior, block: 'start' });
  }

  // ── Infinite scroll ────────────────────────────────────────────────────
  private _initObservers(): void {
    if (this._observersReady) return;
    const container =
      this._host.nativeElement.closest<HTMLElement>('.layout__main');
    this._scrollContainer = container;
    const root = container ?? null;

    const top = this._topSentinel()?.nativeElement;
    const bottom = this._bottomSentinel()?.nativeElement;
    if (!top || !bottom) return;

    this._futureObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) this._loadMoreFuture();
      },
      { root, rootMargin: '600px 0px' },
    );
    this._futureObserver.observe(bottom);

    this._pastObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) this._loadMorePast();
      },
      { root, rootMargin: '400px 0px' },
    );
    this._pastObserver.observe(top);

    const anchorEl = this.anchorKey()
      ? document.getElementById(`feed-day-${this.anchorKey()}`)
      : null;
    if (anchorEl) {
      this._todayObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) this.showJumpToToday.set(!entry.isIntersecting);
        },
        { root },
      );
      this._todayObserver.observe(anchorEl);
    }

    this._observersReady = true;
  }

  private _disconnectObservers(): void {
    this._pastObserver?.disconnect();
    this._futureObserver?.disconnect();
    this._todayObserver?.disconnect();
    this._pastObserver = null;
    this._futureObserver = null;
    this._todayObserver = null;
  }

  /**
   * Agrupa as partidas de um dia por torneio, preservando a ordem do primeiro
   * jogo de cada torneio (a lista já vem por horário).
   */
  private _groupByTournament(
    items: IUserMatchResponse[],
  ): ITournamentDayBlock[] {
    const map = new Map<string, ITournamentDayBlock>();
    const order: string[] = [];
    for (const item of items) {
      const id = item.tournament.id;
      let block = map.get(id);
      if (!block) {
        block = { tournamentId: id, tournament: item.tournament, items: [] };
        map.set(id, block);
        order.push(id);
      }
      block.items.push(item);
    }
    return order.map((id) => map.get(id)!);
  }

  // ── Datas ────────────────────────────────────────────────────────────
  private _iso(ms: number): string {
    return new Date(ms).toISOString();
  }

  private _startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private _dayKey(dayStart: Date): string {
    const y = dayStart.getFullYear();
    const m = String(dayStart.getMonth() + 1).padStart(2, '0');
    const d = String(dayStart.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private _dayLabel(dayStart: Date, todayStart: Date): string {
    const diff = Math.round(
      (dayStart.getTime() - todayStart.getTime()) / DAY_MS,
    );
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    if (diff === -1) return 'Ontem';
    const sameYear = dayStart.getFullYear() === todayStart.getFullYear();
    try {
      const label = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        ...(sameYear ? {} : { year: 'numeric' }),
      }).format(dayStart);
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
      return this._dayKey(dayStart);
    }
  }
}
