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
import { RouterLink } from '@angular/router';
import { TeamScope, TeamType } from '@core/interfaces/enums';
import {
  ICountryFilter,
  ITeamResponse,
} from '@core/interfaces/team.interface';
import { ITeamListParams, TeamsService } from '@core/services/teams.service';
import { matchesSearchTerm } from '@core/utils/search-text';
import { listStagger, tabSlide } from '@shared/animations/animations';
import { ScrollContainerService } from '@shared/services/scroll-container.service';
import { SectionPagerService } from '@shared/services/section-pager.service';
import { SwipeNavRegistry } from '@shared/services/swipe-nav-registry.service';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { FabComponent } from '@shared/components/fab/fab.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { TeamCardComponent } from '@shared/components/team-card/team-card.component';
import {
  ITeamFilterSelection,
  TeamFiltersComponent,
} from '@shared/components/team-filters/team-filters.component';
import { Plus, SearchX, Shield } from 'lucide-angular';

const PAGE_SIZE = 24;
const SORT = 'name,asc';

/* A API não busca por nome; o filtro é local sobre o grupo inteiro.
   Clubes do sistema passam de 200 — uma página de 300 cobre tudo. */
const SEARCH_POOL_SIZE = 300;

type TeamGroup = 'mine' | 'national' | 'clubs';

interface IGroupQuery {
  scope: TeamScope;
  type?: TeamType;
}

const GROUP_QUERY: Record<TeamGroup, IGroupQuery> = {
  mine: { scope: 'mine' },
  national: { scope: 'system', type: 'NATIONAL_TEAM' },
  clubs: { scope: 'system', type: 'CLUB' },
};

@Component({
  selector: 'app-my-teams',
  standalone: true,
  imports: [
    TeamCardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    FabComponent,
    PaginationComponent,
    RouterLink,
    SearchInputComponent,
    TeamFiltersComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-teams.component.html',
  styleUrl: './my-teams.component.scss',
  animations: [listStagger, tabSlide],
})
export class MyTeamsComponent implements OnInit {
  private readonly _service = inject(TeamsService);
  private readonly _sectionPager = inject(SectionPagerService);
  private readonly _swipeReg = inject(SwipeNavRegistry);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _scrollContainer = inject(ScrollContainerService);

  protected readonly shieldIcon = Shield;
  protected readonly plusIcon = Plus;
  protected readonly searchOffIcon = SearchX;

  protected readonly group = signal<TeamGroup>('mine');
  protected readonly loading = signal(true);
  protected readonly items = signal<ITeamResponse[]>([]);
  protected readonly loadError = signal<unknown>(null);
  protected readonly currentPage = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly totalElements = signal(0);

  protected readonly isMineGroup = computed(() => this.group() === 'mine');
  protected readonly isClubsGroup = computed(() => this.group() === 'clubs');

  /* ── Filtro de país/liga (só clubes do sistema) ──────────────────────
     Opções vêm de GET /api/teams/system/filters — nada hardcodado aqui. */

  protected readonly countries = signal<ICountryFilter[]>([]);
  protected readonly country = signal<string | null>(null);
  protected readonly league = signal<string | null>(null);

  protected readonly hasFilter = computed(
    () => this.country() !== null || this.league() !== null,
  );

  protected readonly isEmpty = computed(
    () =>
      !this.loading() &&
      this.items().length === 0 &&
      this.loadError() === null,
  );

  /* ── Busca por nome ──────────────────────────────────────────────────
     Sem busca na API e com paginação server-side, filtrar só a página
     atual esconderia resultados. Com termo ativo, o grupo inteiro é
     carregado uma vez (cache por grupo) e filtrado localmente. */

  protected readonly searchTerm = signal('');
  protected readonly searchLoading = signal(false);
  protected readonly searchError = signal<unknown>(null);

  protected readonly searching = computed(
    () => this.searchTerm().trim().length > 0,
  );

  /** Grupo inteiro carregado para busca (null = ainda não carregado). */
  private readonly _searchPool = signal<ITeamResponse[] | null>(null);
  /* O pool depende do filtro ativo, então a chave é grupo + país + liga. */
  private readonly _searchCache = new Map<string, ITeamResponse[]>();
  private _poolFetchKey: string | null = null;

  protected readonly searchResults = computed(() => {
    const pool = this._searchPool();
    if (!pool) return [];
    const term = this.searchTerm();
    return pool.filter((t) => matchesSearchTerm(term, t.name, t.shortName));
  });

  protected readonly searchCountLabel = computed(() => {
    const n = this.searchResults().length;
    return n === 1 ? '1 time encontrado' : `${n} times encontrados`;
  });

  /** O grid exibe a página normal ou o resultado da busca. */
  protected readonly visibleTeams = computed(() =>
    this.searching() ? this.searchResults() : this.items(),
  );

  public ngOnInit(): void {
    const swipe = (delta: 1 | -1) => this.swipeGroup(delta);
    this._swipeReg.set(swipe);
    this._destroyRef.onDestroy(() => this._swipeReg.clear(swipe));
    this._load();
  }

  protected setGroup(next: TeamGroup): void {
    if (this.group() === next) return;
    this.group.set(next);
    if (next === 'clubs') this._loadFilters();
    this.items.set([]);
    this.currentPage.set(0);
    this._syncSearchPool();
    this._load();
    if (this.searching()) this._ensureSearchPool();
  }

  /** País/liga escolhidos: volta pra primeira página e recarrega. */
  protected onFiltersChange(selection: ITeamFilterSelection): void {
    if (
      selection.country === this.country() &&
      selection.league === this.league()
    ) {
      return;
    }
    this.country.set(selection.country);
    this.league.set(selection.league);
    this.items.set([]);
    this.currentPage.set(0);
    this._syncSearchPool();
    this._load();
    if (this.searching()) this._ensureSearchPool();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    if (term.trim()) this._ensureSearchPool();
  }

  protected retrySearch(): void {
    this._ensureSearchPool();
  }

  private readonly _groupOrder: TeamGroup[] = ['mine', 'national', 'clubs'];

  /** Índice do grupo ativo (alimenta a animação direcional do swipe). */
  protected readonly groupIndex = computed(() =>
    Math.max(0, this._groupOrder.indexOf(this.group())),
  );

  /**
   * Swipe: percorre os grupos internos; ao passar da borda, atravessa para a
   * seção vizinha (pager aninhado: ... ↔ Públicos ↔ Meus ↔ Seleções ↔ Clubes).
   */
  protected swipeGroup(delta: 1 | -1): void {
    const next = this.groupIndex() + delta;
    if (next < 0 || next >= this._groupOrder.length) {
      this._sectionPager.navigate('/teams', delta);
      return;
    }
    this.setGroup(this._groupOrder[next]);
  }

  protected retry(): void {
    this._load();
  }

  protected goToPage(page: number): void {
    if (this.loading()) return;
    this.currentPage.set(page);
    this._load();
    this._scrollContainer.scrollToTop();
  }

  /** Filtros do grupo ativo — país/liga só valem para clubes do sistema. */
  private _groupParams(): ITeamListParams {
    const query = GROUP_QUERY[this.group()];
    const clubs = this.isClubsGroup();
    return {
      scope: query.scope,
      type: query.type,
      country: clubs ? (this.country() ?? undefined) : undefined,
      league: clubs ? (this.league() ?? undefined) : undefined,
    };
  }

  /** Chave do cache de busca: o pool muda com o filtro, não só com o grupo. */
  private _poolKey(): string {
    const p = this._groupParams();
    return `${this.group()}|${p.country ?? ''}|${p.league ?? ''}`;
  }

  /** Aponta o pool exibido para o cache da combinação atual (ou nada). */
  private _syncSearchPool(): void {
    this._searchPool.set(this._searchCache.get(this._poolKey()) ?? null);
  }

  /** Garante o pool de busca da combinação atual (uma chamada por chave). */
  private _ensureSearchPool(): void {
    const key = this._poolKey();
    const cached = this._searchCache.get(key);
    if (cached) {
      this._searchPool.set(cached);
      this.searchLoading.set(false);
      this.searchError.set(null);
      return;
    }
    if (this._poolFetchKey === key) return; // fetch já em andamento

    this._poolFetchKey = key;
    this.searchLoading.set(true);
    this.searchError.set(null);
    this._service
      .list({
        page: 0,
        size: SEARCH_POOL_SIZE,
        sort: SORT,
        ...this._groupParams(),
      })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => {
          if (this._poolFetchKey === key) this._poolFetchKey = null;
          this._searchCache.set(key, page.content);
          // Se o usuário trocou de grupo/filtro durante o fetch, não sobrescreve.
          if (this._poolKey() === key) {
            this._searchPool.set(page.content);
            this.searchLoading.set(false);
          }
        },
        error: (err: unknown) => {
          if (this._poolFetchKey === key) this._poolFetchKey = null;
          if (this._poolKey() === key) {
            this.searchLoading.set(false);
            this.searchError.set(err);
          }
        },
      });
  }

  /** Opções dos selects, na primeira vez que a aba de clubes abre.
      Falha silenciosa: sem filtro a lista segue inteira. */
  private _loadFilters(): void {
    if (this.countries().length > 0) return;
    this._service
      .systemFilters()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (filters) => this.countries.set(filters.countries),
        error: () => this.countries.set([]),
      });
  }

  private _load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const params: ITeamListParams = {
      page: this.currentPage(),
      size: PAGE_SIZE,
      sort: SORT,
      ...this._groupParams(),
    };
    this._service
      .list(params)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.content);
          this.totalPages.set(Math.max(1, page.totalPages));
          this.totalElements.set(page.totalElements);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loadError.set(err);
          this.loading.set(false);
        },
      });
  }
}
