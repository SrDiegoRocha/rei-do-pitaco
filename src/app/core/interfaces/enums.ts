export type Role = 'USER' | 'ADMIN';

export type TournamentPrivacy = 'PUBLIC' | 'PRIVATE';
export type TournamentStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'FINISHED';
export type TournamentMemberRole = 'OWNER' | 'PARTICIPANT';
export type TournamentMemberStatus = 'ACTIVE' | 'LEFT' | 'BANNED';

export type TournamentPhaseType = 'ROUND_ROBIN' | 'KNOCKOUT' | 'GROUPS';
export type MatchLegMode = 'SINGLE' | 'TWO_LEGGED';
export type MatchGenerationMode = 'AUTOMATIC' | 'MANUAL';

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
