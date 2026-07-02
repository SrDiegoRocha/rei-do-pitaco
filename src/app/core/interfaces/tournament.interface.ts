import {
  TiebreakCriteria,
  TournamentPrivacy,
  TournamentStatus,
} from '@core/interfaces/enums';

export interface ITournamentOwnerRef {
  id: string;
  name: string;
}

export interface ITournamentSettingsResponse {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  exactScorePoints: number;
  winnerPoints: number;
  wrongPoints: number;
  /** Placar exato da prorrogação (KO jogo único). */
  extraTimeExactScorePoints: number;
  /** Só o vencedor da prorrogação. */
  extraTimeWinnerPoints: number;
  /** Acertar quem passa nos pênaltis. */
  penaltyWinnerPoints: number;
  tiebreakCriteria: TiebreakCriteria[];
}

export interface ITournamentResponse {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  privacy: TournamentPrivacy;
  status: TournamentStatus;
  maxParticipants: number | null;
  maxTeams: number | null;
  owner: ITournamentOwnerRef;
  settings: ITournamentSettingsResponse;
  memberCount: number;
  teamCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ITournamentSettingsPayload {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  exactScorePoints: number;
  winnerPoints: number;
  wrongPoints: number;
  extraTimeExactScorePoints: number;
  extraTimeWinnerPoints: number;
  penaltyWinnerPoints: number;
  tiebreakCriteria: TiebreakCriteria[];
}

export interface ICreateTournamentRequest {
  name: string;
  description?: string | null;
  privacy: TournamentPrivacy;
  maxParticipants?: number | null;
  maxTeams?: number | null;
  settings: ITournamentSettingsPayload;
}

export interface IUpdateTournamentRequest extends ICreateTournamentRequest {}

export interface IChangeStatusRequest {
  targetStatus: TournamentStatus;
}

export interface IJoinTournamentRequest {
  inviteCode: string;
}
