export type Role = 'USER' | 'ADMIN';

export type TournamentPrivacy = 'PUBLIC' | 'PRIVATE';
export type TournamentStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'FINISHED';
export type TournamentMemberRole = 'OWNER' | 'PARTICIPANT';
export type TournamentMemberStatus = 'ACTIVE' | 'LEFT' | 'BANNED';

export type TournamentPhaseType = 'ROUND_ROBIN' | 'KNOCKOUT' | 'GROUPS';
export type MatchLegMode = 'SINGLE' | 'TWO_LEGGED';
export type MatchGenerationMode = 'AUTOMATIC' | 'MANUAL';

/**
 * Modo de chaveamento de uma fase KNOCKOUT (ver CHAVEAMENTO.md):
 * - FIXED_BRACKET: o sorteio da 1ª rodada define a árvore inteira (vencedor do
 *   confronto 2j enfrenta o do 2j+1); montagem manual é validada contra ela.
 * - REDRAW_EACH_ROUND: sem chaveamento — a cada rodada os vencedores são
 *   sorteados de novo (estilo fases iniciais da Copa do Brasil).
 */
export type BracketMode = 'FIXED_BRACKET' | 'REDRAW_EACH_ROUND';

export type TiebreakCriteria =
  | 'POINTS'
  | 'WINS'
  | 'GOAL_DIFFERENCE'
  | 'GOALS_FOR'
  | 'HEAD_TO_HEAD'
  | 'FEWEST_LOSSES';

export type MatchStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type MatchType = 'REGULAR' | 'THIRD_PLACE';
export type ZoneSelectionMode = 'ALL' | 'BEST_RANKED';

export type TeamType = 'CLUB' | 'NATIONAL_TEAM';
export type TeamScope = 'mine' | 'system' | 'all';
