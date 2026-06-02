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
import { ITeamResponse } from '@core/interfaces/team.interface';
import { TeamsService } from '@core/services/teams.service';
import { listStagger } from '@shared/animations/animations';
import { ButtonComponent } from '@shared/components/button/button.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { FabComponent } from '@shared/components/fab/fab.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { TeamCardComponent } from '@shared/components/team-card/team-card.component';
import { Plus, Shield } from 'lucide-angular';

const PAGE_SIZE = 24;
const SORT = 'name,asc';

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
  animations: [listStagger],
})
export class MyTeamsComponent implements OnInit {
  private readonly _service = inject(TeamsService);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly shieldIcon = Shield;
  protected readonly plusIcon = Plus;

  protected readonly loading = signal(true);
  protected readonly items = signal<ITeamResponse[]>([]);
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
      .list({
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
              : 'Não foi possível carregar seus times.',
          );
          this.loading.set(false);
        },
      });
  }
}
