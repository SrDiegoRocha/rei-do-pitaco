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
import { ApiException } from '@core/errors/api-error';
import { ITournamentResponse } from '@core/interfaces/tournament.interface';
import { TournamentsService } from '@core/services/tournaments.service';
import { listStagger, tabSlide } from '@shared/animations/animations';
import { SwipeNavDirective } from '@shared/directives/swipe-nav.directive';
import { SectionPagerService } from '@shared/services/section-pager.service';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';
import { FabComponent } from '@shared/components/fab/fab.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { TournamentCardComponent } from '@shared/components/tournament-card/tournament-card.component';
import { Plus, Ticket, Trophy, Users } from 'lucide-angular';

type Tab = 'mine' | 'joined';

const PAGE_SIZE = 12;
const SORT = 'createdAt,desc';
const TAB_STORAGE_KEY = 'reidopitaco.tournamentsTab';

function readStoredTab(): Tab {
  try {
    return localStorage.getItem(TAB_STORAGE_KEY) === 'joined'
      ? 'joined'
      : 'mine';
  } catch {
    return 'mine';
  }
}

@Component({
  selector: 'app-my-tournaments',
  standalone: true,
  imports: [
    TournamentCardComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    FabComponent,
    PaginationComponent,
    RouterLink,
    SwipeNavDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-tournaments.component.html',
  styleUrl: './my-tournaments.component.scss',
  animations: [listStagger, tabSlide],
})
export class MyTournamentsComponent implements OnInit {
  private readonly _service = inject(TournamentsService);
  private readonly _sectionPager = inject(SectionPagerService);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly trophyIcon = Trophy;
  protected readonly usersIcon = Users;
  protected readonly plusIcon = Plus;
  protected readonly ticketIcon = Ticket;

  // Inicia no último filtro escolhido pelo usuário (persistido).
  protected readonly tab = signal<Tab>(readStoredTab());
  protected readonly loading = signal(true);
  protected readonly items = signal<ITournamentResponse[]>([]);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly currentPage = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly totalElements = signal(0);

  protected readonly isEmpty = computed(
    () =>
      !this.loading() &&
      this.items().length === 0 &&
      this.errorMessage() === null,
  );

  protected readonly showJoined = computed(() => this.tab() === 'joined');

  public ngOnInit(): void {
    this._load();
  }

  protected setTab(next: Tab): void {
    if (this.tab() === next) return;
    this.tab.set(next);
    this._persistTab(next);
    this.items.set([]);
    this.currentPage.set(0);
    this._load();
  }

  private readonly _tabOrder: Tab[] = ['mine', 'joined'];

  /** Índice da aba ativa (alimenta a animação direcional do swipe). */
  protected readonly tabIndex = computed(() =>
    Math.max(0, this._tabOrder.indexOf(this.tab())),
  );

  /**
   * Swipe: percorre as abas internas; ao passar da borda, atravessa para a
   * seção vizinha (pager aninhado: ... ↔ Criados ↔ Participo ↔ Públicos ↔ ...).
   */
  protected swipeTab(delta: 1 | -1): void {
    const next = this.tabIndex() + delta;
    if (next < 0 || next >= this._tabOrder.length) {
      this._sectionPager.navigate('/tournaments', delta);
      return;
    }
    this.setTab(this._tabOrder[next]);
  }

  private _persistTab(tab: Tab): void {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      // Storage indisponível — só não persiste.
    }
  }

  protected retry(): void {
    this._load();
  }

  protected goToPage(page: number): void {
    if (this.loading()) return;
    this.currentPage.set(page);
    this._load();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private _load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const params = {
      page: this.currentPage(),
      size: PAGE_SIZE,
      sort: SORT,
    };
    const source$ =
      this.tab() === 'mine'
        ? this._service.listMine(params)
        : this._service.listJoined(params);

    source$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.content);
          this.totalPages.set(Math.max(1, page.totalPages));
          this.totalElements.set(page.totalElements);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.errorMessage.set(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível carregar os torneios.',
          );
          this.loading.set(false);
        },
      });
  }
}
