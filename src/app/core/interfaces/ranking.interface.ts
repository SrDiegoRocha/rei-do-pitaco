export interface IRankingRowResponse {
  position: number;
  userId: string;
  name: string;
  avatarUrl: string;
  totalPoints: number;
  exactScoreHits: number;
  winnerHits: number;
  wrongs: number;
  totalPredictions: number;
}
