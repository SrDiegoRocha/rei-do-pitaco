import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { TeamType } from '@core/interfaces/enums';

@Component({
  selector: 'app-team-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-badge.component.html',
  styleUrl: './team-badge.component.scss',
})
export class TeamBadgeComponent {
  public readonly name = input<string | null | undefined>('');
  public readonly shortName = input<string | null | undefined>(null);
  public readonly badgeUrl = input<string | null | undefined>(null);
  public readonly primaryColor = input<string>('#10B981');
  public readonly secondaryColor = input<string>('#0F172A');
  public readonly size = input<number>(72);
  public readonly teamType = input<TeamType | null | undefined>(null);
  public readonly countryCode = input<string | null | undefined>(null);

  /** Seleções renderizam a bandeira (flag-icons) em vez de escudo. */
  protected readonly useFlag = computed(
    () =>
      this.teamType() === 'NATIONAL_TEAM' &&
      !!this.countryCode()?.trim(),
  );

  /** URL do SVG da bandeira (copiado de flag-icons para assets/flags). */
  protected readonly flagUrl = computed(() => {
    const code = (this.countryCode() ?? '').trim().toLowerCase();
    return code ? `url("/assets/flags/${code}.svg")` : '';
  });

  protected readonly sizePx = computed(() => `${this.size()}px`);
  protected readonly fontPx = computed(
    () => `${Math.max(12, Math.round(this.size() * 0.32))}px`,
  );

  protected readonly initials = computed(() => {
    const short = (this.shortName() ?? '').trim();
    if (short) return short.slice(0, 3).toUpperCase();
    const name = (this.name() ?? '').trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter((p) => p.length > 0);
    const first = parts[0]?.charAt(0) ?? '';
    const last =
      parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
    return ((first + last) || '?').toUpperCase();
  });

  protected readonly resolvedBadgeUrl = computed(() => {
    const url = this.badgeUrl();
    return url && url.trim().length > 0 ? url : null;
  });
}
