/** Quem o palpiteiro acha que avança nos pênaltis (lado do jogo palpitado). */
export type PenaltyWinner = 'HOME' | 'AWAY';

export interface IPredictionResponse {
  id: string;
  matchId: string;
  userId: string;
  userName: string;
  homeScore: number;
  awayScore: number;
  /** Quem passa nos pênaltis; null quando o palpite não envolve pênaltis. */
  penaltyWinner: PenaltyWinner | null;
  points: number;
  createdAt: string;
  updatedAt: string;
}

export interface IPlacePredictionRequest {
  homeScore: number;
  awayScore: number;
  /** Só em mata-mata elegível + palpite de empate (no agregado, em ida-e-volta). */
  penaltyWinner?: PenaltyWinner;
}

/**
 * Resultado do recálculo de pontos de todos os palpites do torneio,
 * reaplicando a pontuação vigente às partidas já lançadas.
 */
export interface IRecalculationResponse {
  /** Total de partidas no torneio. */
  totalMatches: number;
  /** Partidas que tinham ao menos um palpite e foram reavaliadas. */
  matchesProcessed: number;
  /** Palpites cujo `points` efetivamente mudou no recálculo. */
  predictionsUpdated: number;
}

/**
 * Agregado dos pitacos de uma partida (sem revelar pitacos individuais).
 * Usado na "Previsão da Galera".
 */
export interface IPredictionStatsResponse {
  totalVotes: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
}
