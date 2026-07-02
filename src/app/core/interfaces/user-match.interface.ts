import {
  MatchLegMode,
  TournamentPhaseType,
  TournamentPrivacy,
  TournamentStatus,
} from '@core/interfaces/enums';
import { IMatchResponse } from '@core/interfaces/match.interface';
import { PenaltyWinner } from '@core/interfaces/prediction.interface';

/**
 * Item do feed pessoal de partidas (`GET /api/users/me/matches`).
 *
 * Reaproveita o `IMatchResponse` dos demais endpoints e anexa o contexto que o
 * `MatchResponse` não carrega (nome do torneio/fase/grupo) para montar o
 * cabeçalho do card sem chamadas extras, além do palpite do próprio usuário.
 */
export interface IUserMatchResponse {
  match: IMatchResponse;
  tournament: IUserMatchTournamentRef;
  phase: IUserMatchPhaseRef;
  /** Preenchido apenas em fase de grupos; null nos demais tipos. */
  group: IUserMatchGroupRef | null;
  /** Palpite do próprio usuário nesta partida; null se ainda não palpitou. */
  myPrediction: IUserMatchPrediction | null;
}

export interface IUserMatchTournamentRef {
  id: string;
  name: string;
  privacy: TournamentPrivacy;
  status: TournamentStatus;
  /** Pontuação de palpite do torneio — colore o chip de pontos por faixa. */
  scoring: IUserMatchScoringRef;
}

/** Pontuação vigente do torneio (mesma forma do `IPredictionScoring`). */
export interface IUserMatchScoringRef {
  exactScorePoints: number;
  winnerPoints: number;
  wrongPoints: number;
  /** Componentes de mata-mata (prorrogação e pênaltis). */
  extraTimeExactScorePoints: number;
  extraTimeWinnerPoints: number;
  penaltyWinnerPoints: number;
}

export interface IUserMatchPhaseRef {
  id: string;
  name: string;
  position: number;
  phaseType: TournamentPhaseType;
  matchLegMode: MatchLegMode;
}

export interface IUserMatchGroupRef {
  id: string;
  name: string;
  position: number;
}

export interface IUserMatchPrediction {
  id: string;
  homeScore: number;
  awayScore: number;
  /** Placar palpitado da prorrogação (cumulativo); null se não palpitou. */
  homeExtraTimeScore: number | null;
  awayExtraTimeScore: number | null;
  /** Quem passa nos pênaltis; null quando o palpite não envolve pênaltis. */
  penaltyWinner: PenaltyWinner | null;
  /** Pontos já apurados (0 enquanto a partida não fecha). */
  points: number;
}

/**
 * Filtros opcionais de paginação por janela de data do feed. Sem eles, o
 * endpoint devolve a lista inteira. Janela semiaberta `[from, to)`.
 */
export interface IUserMatchListParams {
  /** ISO instant — recorta `scheduledAt >= from`. */
  from?: string;
  /** ISO instant — recorta `scheduledAt < to` (exclusivo). */
  to?: string;
  /** Teto de itens; omitido (ou <= 0) = sem teto. */
  limit?: number;
}

/** Contador de partidas esperando pitaco do usuário (badge da tela inicial). */
export interface IPendingPredictionsCountResponse {
  count: number;
}
