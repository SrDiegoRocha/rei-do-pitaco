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
  // ── Pick'em de fase (Palpitão, §20) — defaults 1 ──────────────────────
  /** Time previsto na zona que terminou classificado (independe da posição). */
  pickemQualifierPoints: number;
  /** Time cravado na posição final exata da tabela/grupo. */
  pickemExactPositionPoints: number;
  /** Acertou o 1º da tabela/grupo. */
  pickemFirstPlacePoints: number;
  /** Cravou os dois times de um confronto do mata-mata. */
  pickemKoMatchupExactPoints: number;
  /** Pelo menos 1 time do confronto (exclusivo com o exato). */
  pickemKoMatchupPartialPoints: number;
  /** Acertou o campeão. */
  pickemChampionPoints: number;
  /** Acertou o vice. */
  pickemRunnerUpPoints: number;
  /** Acertou o 3º lugar (só quando a fase tem disputa de 3º). */
  pickemThirdPlacePoints: number;
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
  // Pick'em de fase (Palpitão). Ausentes: create assume default 1; update preserva.
  pickemQualifierPoints: number;
  pickemExactPositionPoints: number;
  pickemFirstPlacePoints: number;
  pickemKoMatchupExactPoints: number;
  pickemKoMatchupPartialPoints: number;
  pickemChampionPoints: number;
  pickemRunnerUpPoints: number;
  pickemThirdPlacePoints: number;
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
