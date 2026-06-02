import { MatchStatus, MatchType } from '@core/interfaces/enums';

export interface ITeamRef {
  id: string;
  name: string;
  shortName: string | null;
  badgeUrl: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
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
  homePenalties: number | null;
  awayPenalties: number | null;
  status: MatchStatus;
  createdAt: string;
  updatedAt: string;
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
  homePenalties?: number | null;
  awayPenalties?: number | null;
}

export interface IMatchListParams {
  round?: number;
  groupId?: string;
}
