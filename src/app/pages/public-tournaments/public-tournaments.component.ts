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
import { listStagger } from '@shared/animations/animations';
import { ButtonComponent } from '@shared/components/button/button.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { TournamentCardComponent } from '@shared/components/tournament-card/tournament-card.component';
import { SectionPagerService } from '@shared/services/section-pager.service';
import { SwipeNavRegistry } from '@shared/services/swipe-nav-registry.service';
import { Globe } from 'lucide-angular';

const PAGE_SIZE = 12;
const SORT = 'createdAt,desc';

@Component({
  selector: 'app-public-tournaments',
  standalone: true,
  imports: [
    TournamentCardComponent,
    EmptyStateComponent,
    ButtonComponent,
    PaginationComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-tournaments.component.html',
  styleUrl: './public-tournaments.component.scss',
  animations: [listStagger],
})
export class PublicTournamentsComponent implements OnInit {
  private readonly _service = inject(TournamentsService);
  private readonly _sectionPager = inject(SectionPagerService);
  private readonly _swipeReg = inject(SwipeNavRegistry);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly globeIcon = Globe;

  /** Swipe entre seções (sem abas internas aqui). */
  protected swipeSection(delta: 1 | -1): void {
    this._sectionPager.navigate('/tournaments/public', delta);
  }

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

  public ngOnInit(): void {
    const swipe = (delta: 1 | -1) => this.swipeSection(delta);
    this._swipeReg.set(swipe);
    this._destroyRef.onDestroy(() => this._swipeReg.clear(swipe));
    this._load();
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
    this._service
      .listPublic({
        page: this.currentPage(),
        size: PAGE_SIZE,
        sort: SORT,
      })
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
