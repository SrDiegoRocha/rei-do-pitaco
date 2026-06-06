import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { Params, RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [LucideAngularModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  private readonly _location = inject(Location);

  public readonly title = input.required<string>();
  public readonly subtitle = input<string>('');
  public readonly backTo = input<string | null>(null);
  public readonly backQueryParams = input<Params | null>(null);
  public readonly backFragment = input<string | null>(null);
  public readonly backLabel = input<string>('Voltar');
  /** Quando true, ignora backTo e usa o histórico do navegador (igual ao gesto de voltar). */
  public readonly historyBack = input<boolean>(false);

  protected readonly arrowLeftIcon = ArrowLeft;

  protected onHistoryBack(): void {
    this._location.back();
  }
}
