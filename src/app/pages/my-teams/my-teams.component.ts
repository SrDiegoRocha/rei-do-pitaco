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
import { TeamScope, TeamType } from '@core/interfaces/enums';
import { ITeamResponse } from '@core/interfaces/team.interface';
import { ITeamListParams, TeamsService } from '@core/services/teams.service';
import { listStagger, tabSlide } from '@shared/animations/animations';
import { SectionPagerService } from '@shared/services/section-pager.service';
import { SwipeNavRegistry } from '@shared/services/swipe-nav-registry.service';
import { ButtonComponent } from '@shared/components/button/button.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { FabComponent } from '@shared/components/fab/fab.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { TeamCardComponent } from '@shared/components/team-card/team-card.component';
import { Plus, Shield } from 'lucide-angular';

const PAGE_SIZE = 24;
const SORT = 'name,asc';

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
    ButtonComponent,
    FabComponent,
    PaginationComponent,
    RouterLink,
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

  protected readonly shieldIcon = Shield;
  protected readonly plusIcon = Plus;

  protected readonly group = signal<TeamGroup>('mine');
  protected readonly loading = signal(true);
  protected readonly items = signal<ITeamResponse[]>([]);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly currentPage = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly totalElements = signal(0);

  protected readonly isMineGroup = computed(() => this.group() === 'mine');

  protected readonly isEmpty = computed(
    () =>
      !this.loading() &&
      this.items().length === 0 &&
      this.errorMessage() === null,
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
    this.items.set([]);
    this.currentPage.set(0);
    this._load();
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
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private _load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    const query = GROUP_QUERY[this.group()];
    const params: ITeamListParams = {
      page: this.currentPage(),
      size: PAGE_SIZE,
      sort: SORT,
      scope: query.scope,
      type: query.type,
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
          this.errorMessage.set(
            err instanceof ApiException
              ? err.message
              : 'Não foi possível carregar seus times.',
          );
          this.loading.set(false);
        },
      });
  }
}
