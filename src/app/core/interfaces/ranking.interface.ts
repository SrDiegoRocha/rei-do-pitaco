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

/**
 * Filtros opcionais do ranking (recorta a agregação no servidor).
 * `groupId` exige `phaseId`; `round` isola uma rodada/etapa da fase.
 * `matchType` distingue a Final da Disputa de 3º lugar numa mesma rodada de
 * mata-mata (ver FILTER_CHANGES.md — pendente no backend).
 */
export interface IRankingFilterParams {
  phaseId?: string;
  groupId?: string;
  round?: number;
  matchType?: 'REGULAR' | 'THIRD_PLACE';
  /**
   * Restringe o ranking aos membros cujo vínculo está nesse status.
   * Omitido = todos que palpitaram, independente do status atual.
   */
  memberStatus?: 'ACTIVE' | 'LEFT' | 'BANNED';
}
