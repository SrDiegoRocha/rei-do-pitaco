import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import {
  ICountryFilter,
  ILeagueFilter,
} from '@core/interfaces/team.interface';
import { ChevronDown, LucideAngularModule } from 'lucide-angular';

/** Seleção atual dos filtros; `null` = sem filtro (não vai na query). */
export interface ITeamFilterSelection {
  country: string | null;
  league: string | null;
}

/**
 * Selects de país e liga para os clubes do sistema. Não guarda estado: recebe
 * as opções de `GET /api/teams/system/filters` e devolve a seleção inteira num
 * evento só — o consumidor recarrega a lista uma vez, mesmo quando trocar de
 * país também limpa a liga.
 */
@Component({
  selector: 'app-team-filters',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-filters.component.html',
  styleUrl: './team-filters.component.scss',
})
export class TeamFiltersComponent {
  public readonly countries = input<ICountryFilter[]>([]);
  public readonly country = input<string | null>(null);
  public readonly league = input<string | null>(null);
  public readonly disabled = input<boolean>(false);

  public readonly filtersChange = output<ITeamFilterSelection>();

  protected readonly chevronIcon = ChevronDown;

  protected readonly selectedCountry = computed(() =>
    this.countries().find((c) => c.code === this.country()) ?? null,
  );

  /** Bandeira do país escolhido — o `<option>` nativo não aceita imagem. */
  protected readonly flagUrl = computed(() => {
    const code = this.selectedCountry()?.code.toLowerCase();
    return code ? `url("/assets/flags/${code}.svg")` : '';
  });

  /** Ligas do país escolhido; sem país, todas as ligas achatadas. */
  protected readonly leagueOptions = computed<ILeagueFilter[]>(() => {
    const selected = this.selectedCountry();
    if (selected) return selected.leagues;
    return this.countries()
      .flatMap((c) => c.leagues)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  });

  /** Com uma liga só o select seria redundante — o país já filtrou tudo. */
  protected readonly showLeague = computed(
    () => this.leagueOptions().length > 1,
  );

  protected changeCountry(value: string): void {
    const country = value || null;
    // Liga de outro país deixaria a lista vazia; some junto com a troca.
    const league = this.league();
    const stillValid =
      league !== null &&
      this.countries()
        .find((c) => c.code === country)
        ?.leagues.some((l) => l.slug === league) === true;
    this.filtersChange.emit({
      country,
      league: country && stillValid ? league : null,
    });
  }

  protected changeLeague(value: string): void {
    this.filtersChange.emit({
      country: this.country(),
      league: value || null,
    });
  }

}
