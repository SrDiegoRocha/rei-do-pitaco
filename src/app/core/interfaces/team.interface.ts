import { TeamType } from '@core/interfaces/enums';

export interface ITeamResponse {
  id: string;
  name: string;
  shortName: string | null;
  badgeUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  system: boolean;
  teamType: TeamType;
  countryCode: string | null;
  /** Só clubes do sistema (ex. "brasileirao-serie-a"); null nos demais. */
  leagueSlug: string | null;
  /** Nome de exibição da liga (ex. "Brasileirão Série A"). */
  leagueName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateTeamRequest {
  name: string;
  shortName?: string | null;
  badgeUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
}

export interface IUpdateTeamRequest extends ICreateTeamRequest {}

/* ── Filtros dos times do sistema ───────────────────────────────────────
   Fonte de verdade dos selects de país/liga (GET /api/teams/system/filters).
   Nada de lista hardcodada: liga nova no seed aparece sozinha no filtro. */

export interface ILeagueFilter {
  /** Valor a mandar em `?league=`. */
  slug: string;
  /** Nome de exibição (ex. "Brasileirão Série A"). */
  name: string;
  clubCount: number;
}

export interface ICountryFilter {
  /** Valor a mandar em `?country=` — também é o código do flag-icons. */
  code: string;
  /** Nome em pt-BR, já ordenado pela API com collator pt-BR. */
  name: string;
  clubCount: number;
  /** Ligas do país (só o Brasil tem mais de uma hoje). */
  leagues: ILeagueFilter[];
}

export interface ITeamFiltersResponse {
  /** Só países com ao menos um clube do sistema. */
  countries: ICountryFilter[];
  /** Total de seleções (o grupo "Seleções" não filtra por país). */
  nationalTeamCount: number;
  clubCount: number;
}
