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
