import { MatchStatus, MatchType, TeamType } from '@core/interfaces/enums';

export interface ITeamRef {
  id: string;
  name: string;
  shortName: string | null;
  badgeUrl: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  teamType?: TeamType | null;
  countryCode?: string | null;
}

export interface IMatchResponse {
  id: string;
  phaseId: string;
  groupId: string | null;
  groupName: string | null;
  round: number;
  tieId: string;
  matchType: MatchType;
  homeTeam: ITeamRef;
  awayTeam: ITeamRef;
  scheduledAt: string | null;
  homeScore: number | null;
  awayScore: number | null;
  /** Placar da prorrogação (cumulativo); null se não houve prorrogação. */
  homeExtraTimeScore: number | null;
  awayExtraTimeScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  status: MatchStatus;
  createdAt: string;
  updatedAt: string;

  // ── Apoio ao palpite de pênaltis ─────────────────────────────────────
  /** true em jogo único de KO ou na perna de volta de um ida-e-volta. */
  penaltyShootoutEligible: boolean;
  /** Gols do mandante DESTA partida nas pernas anteriores do confronto
   *  (orientado ao mandante/visitante desta partida). 0/0 em jogo único. */
  aggregateBeforeHome: number;
  aggregateBeforeAway: number;
}

export interface ICreateMatchRequest {
  homeTeamId: string;
  awayTeamId: string;
  round: number;
  groupId?: string | null;
  tieId?: string | null;
  scheduledAt?: string | null;
  matchType?: MatchType | null;
}

export interface IUpdateMatchRequest {
  homeTeamId: string;
  awayTeamId: string;
  round: number;
  groupId?: string | null;
  scheduledAt?: string | null;
  matchType?: MatchType | null;
}

export interface ISetMatchResultRequest {
  homeScore: number;
  awayScore: number;
  /** Placar da prorrogação (cumulativo). Só KO jogo único com 90' empatado. */
  homeExtraTimeScore?: number | null;
  awayExtraTimeScore?: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
}

export interface IMatchListParams {
  round?: number;
  groupId?: string;
}

export interface IMatchLocationResponse {
  tournamentId: string;
  phaseId: string;
  matchId: string;
}
