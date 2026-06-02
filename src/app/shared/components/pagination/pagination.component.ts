import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ChevronLeft, ChevronRight, LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent {
  /** Current page (0-indexed, matches Spring page response). */
  public readonly currentPage = input<number>(0);
  /** Total number of pages. */
  public readonly totalPages = input<number>(1);
  /** Total number of elements across all pages. */
  public readonly totalElements = input<number | null>(null);
  /** Disable all controls (e.g. during loading). */
  public readonly disabled = input<boolean>(false);

  public readonly pageChange = output<number>();

  protected readonly chevronLeft = ChevronLeft;
  protected readonly chevronRight = ChevronRight;

  protected readonly isFirst = computed(() => this.currentPage() <= 0);
  protected readonly isLast = computed(
    () => this.currentPage() >= this.totalPages() - 1,
  );

  protected readonly isHidden = computed(() => this.totalPages() <= 1);

  /** Window of page numbers to show as numeric chips (up to 5, centered on current). */
  protected readonly visiblePages = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 1) return [];

    const MAX = 5;
    if (total <= MAX) {
      return Array.from({ length: total }, (_, i) => i);
    }

    let start = current - Math.floor(MAX / 2);
    let end = start + MAX;
    if (start < 0) {
      start = 0;
      end = MAX;
    }
    if (end > total) {
      end = total;
      start = total - MAX;
    }
    return Array.from({ length: end - start }, (_, i) => start + i);
  });

  protected readonly showFirstEllipsis = computed(() => {
    const pages = this.visiblePages();
    return pages.length > 0 && pages[0]! > 0;
  });

  protected readonly showLastEllipsis = computed(() => {
    const pages = this.visiblePages();
    return pages.length > 0 && pages[pages.length - 1]! < this.totalPages() - 1;
  });

  protected goTo(page: number): void {
    if (this.disabled()) return;
    if (page < 0 || page >= this.totalPages()) return;
    if (page === this.currentPage()) return;
    this.pageChange.emit(page);
  }

  protected goPrev(): void {
    this.goTo(this.currentPage() - 1);
  }

  protected goNext(): void {
    this.goTo(this.currentPage() + 1);
  }

  protected goFirst(): void {
    this.goTo(0);
  }

  protected goLast(): void {
    this.goTo(this.totalPages() - 1);
  }
}
