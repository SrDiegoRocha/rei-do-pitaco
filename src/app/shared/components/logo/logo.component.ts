import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type LogoVariant = 'lockup' | 'icon' | 'wordmark';

@Component({
  selector: 'app-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logo.component.html',
  styleUrl: './logo.component.scss',
})
export class LogoComponent {
  public readonly size = input<number>(40);
  public readonly variant = input<LogoVariant>('lockup');
  public readonly ariaLabel = input<string>('Rei do Pitaco');

  protected readonly showIcon = computed(
    () => this.variant() === 'icon' || this.variant() === 'lockup',
  );
  protected readonly showWordmark = computed(
    () => this.variant() === 'wordmark' || this.variant() === 'lockup',
  );

  protected readonly symbolPx = computed(() => `${this.size()}px`);
  protected readonly wordmarkPx = computed(
    () => `${Math.round(this.size() * 0.65)}px`,
  );
  protected readonly gapPx = computed(
    () => `${Math.max(8, Math.round(this.size() * 0.25))}px`,
  );
}
