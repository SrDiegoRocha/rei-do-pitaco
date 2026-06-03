export interface IPredictionResponse {
  id: string;
  matchId: string;
  userId: string;
  userName: string;
  homeScore: number;
  awayScore: number;
  points: number;
  createdAt: string;
  updatedAt: string;
}

export interface IPlacePredictionRequest {
  homeScore: number;
  awayScore: number;
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
