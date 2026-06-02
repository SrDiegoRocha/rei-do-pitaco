import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
  public readonly title = input.required<string>();
  public readonly subtitle = input<string>('');
  public readonly backTo = input<string | null>(null);
  public readonly backQueryParams = input<Params | null>(null);
  public readonly backFragment = input<string | null>(null);
  public readonly backLabel = input<string>('Voltar');

  protected readonly arrowLeftIcon = ArrowLeft;
}
