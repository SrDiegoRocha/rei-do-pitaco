import {
  BracketMode,
  MatchType,
  TournamentPhaseType,
} from '@core/interfaces/enums';
import { ITeamRef } from '@core/interfaces/match.interface';

/**
 * Pick'em de fase ("Palpitão") — palpite de alto nível sobre a fase inteira,
 * feito antes de ela começar. Contrato da §20 do API.md.
 */

export type PickemState = 'NOT_READY' | 'OPEN' | 'LOCKED';

/** Motivo de NOT_READY (§20.1). */
export type PickemStateReason =
  | 'TOURNAMENT_NOT_IN_PROGRESS'
  | 'NO_TEAMS'
  | 'NO_GROUPS'
  | 'TEAMS_NOT_ASSIGNED_TO_GROUPS'
  | 'NO_QUALIFICATION_ZONES'
  | 'BRACKET_NOT_GENERATED';

/** Eco dos campos pickem* do TournamentSettings. */
export interface IPickemScoring {
  qualifierPoints: number;
  exactPositionPoints: number;
  firstPlacePoints: number;
  koMatchupExactPoints: number;
  koMatchupPartialPoints: number;
  championPoints: number;
  runnerUpPoints: number;
  thirdPlacePoints: number;
}

// ── Template (GET /pickem/template) ─────────────────────────────────────

export interface IGroupBlock {
  groupId: string | null;
  groupName: string | null;
  /** Slots a renderizar neste bloco (min entre a profundidade global e o nº de times). */
  qualifyingDepth: number;
  teams: ITeamRef[];
}

export interface ITableTemplate {
  qualifyingDepth: number;
  /** RR: 1 bloco com groupId/groupName null. */
  groups: IGroupBlock[];
}

export interface ITemplateSlot {
  slotIndex: number;
  /** null nas rodadas > 1 (o front preenche com os vencedores escolhidos). */
  homeTeam: ITeamRef | null;
  awayTeam: ITeamRef | null;
}

export interface ITemplateRound {
  /** 1-based; ida+volta contam como uma rodada. */
  roundNumber: number;
  name: string;
  slots: ITemplateSlot[];
}

export interface IBracketTemplate {
  hasThirdPlace: boolean;
  /** REDRAW_EACH_ROUND: os cruzamentos das próximas rodadas serão sorteados. */
  bracketMode: BracketMode;
  totalRounds: number;
  /** Rodada 1 com os confrontos reais; seguintes com slots vazios. */
  rounds: ITemplateRound[];
}

export interface IPhasePredictionTemplateResponse {
  phaseId: string;
  phaseName: string;
  phaseType: TournamentPhaseType;
  state: PickemState;
  /** Só em NOT_READY. */
  stateReason: PickemStateReason | null;
  /** min(scheduledAt) das partidas da fase; null = trava pelo 1º resultado. */
  lockAt: string | null;
  scoring: IPickemScoring;
  /** Preenchido em ROUND_ROBIN/GROUPS (quando pronto). */
  table: ITableTemplate | null;
  /** Preenchido em KNOCKOUT (quando pronto). */
  bracket: IBracketTemplate | null;
}

// ── Upsert (PUT /pickem/me) ─────────────────────────────────────────────

export interface IPositionPick {
  /** Obrigatório em GROUPS; proibido em RR. */
  groupId?: string | null;
  teamId: string;
  /** 1..qualifyingDepth do bloco. */
  position: number;
}

export interface ITiePick {
  roundNumber: number;
  slotIndex: number;
  /** Default REGULAR. */
  matchType?: MatchType;
  homeTeamId: string;
  awayTeamId: string;
  /** Um dos dois acima. */
  winnerTeamId: string;
}

export interface IPlacePhasePredictionRequest {
  /** RR/GROUPS. */
  positions?: IPositionPick[];
  /** KNOCKOUT. */
  ties?: ITiePick[];
}

// ── Leitura (GET /pickem/me, /pickem, /pickem/{userId}) ─────────────────

export interface IPositionOutcome {
  qualifiedHit: boolean | null;
  exactPositionHit: boolean | null;
  firstPlaceHit: boolean | null;
  /** Soma dos componentes deste slot. */
  pointsAwarded: number | null;
}

export interface IPositionRow {
  groupId: string | null;
  groupName: string | null;
  team: ITeamRef;
  predictedPosition: number;
  /** null enquanto não há resultados na fase. */
  outcome: IPositionOutcome | null;
}

export type TieMatchupOutcome = 'EXACT' | 'PARTIAL' | 'MISS';

export interface ITieOutcome {
  /** null na rodada 1 (pares dados — não pontuam confronto). */
  matchup: TieMatchupOutcome | null;
  winnerAdvanced: boolean | null;
  pointsAwarded: number | null;
}

export interface ITieRow {
  roundNumber: number;
  slotIndex: number;
  matchType: MatchType;
  homeTeam: ITeamRef;
  awayTeam: ITeamRef;
  winnerTeam: ITeamRef;
  /** null enquanto o confronto real não existe. */
  outcome: ITieOutcome | null;
}

export interface ITerminalOutcome {
  championHit: boolean | null;
  runnerUpHit: boolean | null;
  thirdPlaceHit: boolean | null;
  pointsAwarded: number | null;
}

export interface IPhasePredictionResponse {
  id: string;
  phaseId: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  phaseType: TournamentPhaseType;
  /** Total do Pick'em (provisório até a fase finalizar). */
  points: number;
  /** true enquanto a fase não foi finalizada. */
  provisional: boolean;
  /** Última repontuação; null = ainda não pontuado. */
  scoredAt: string | null;
  /** Vazio em KNOCKOUT. */
  positions: IPositionRow[];
  /** Vazio em RR/GROUPS. */
  ties: ITieRow[];
  /** Só KNOCKOUT (campeão/vice/3º); null sem base. */
  terminals: ITerminalOutcome | null;
  createdAt: string;
  updatedAt: string;
}

// ── Stats (GET /pickem/stats) ───────────────────────────────────────────

export interface ITeamShare {
  team: ITeamRef;
  count: number;
  /** 0–100 inteiro. */
  pct: number;
}

export interface IGroupStats {
  groupId: string | null;
  groupName: string | null;
  /** Pick'ems com ≥1 palpite neste bloco (base do pct de qualifiers). */
  pickems: number;
  /** Distribuição de "quem fica em 1º" — pcts somam 100. */
  firstPlace: ITeamShare[];
  /** % dos Pick'ems que colocaram o time na zona — NÃO soma 100. */
  qualifiers: ITeamShare[];
}

export interface ITableStats {
  groups: IGroupStats[];
}

export interface IBracketStats {
  champion: ITeamShare[];
  runnerUp: ITeamShare[];
  /** Vazio se a fase não tem 3º lugar. */
  thirdPlace: ITeamShare[];
}

export interface IPhasePredictionStatsResponse {
  phaseId: string;
  phaseType: TournamentPhaseType;
  totalPickems: number;
  table: ITableStats | null;
  bracket: IBracketStats | null;
}

// ── Recalculate (POST /pickem/recalculate) ──────────────────────────────

export interface IPickemRecalculationResponse {
  pickemsRecalculated: number;
}

// ── Perfil do palpiteiro (GET /participants/{userId}/summary) ───────────

export interface IPickemComponentsBreakdown {
  qualifier: number;
  exactPosition: number;
  firstPlace: number;
  koMatchupExact: number;
  koMatchupPartial: number;
  champion: number;
  runnerUp: number;
  thirdPlace: number;
}

export interface IPickemPhaseBreakdown {
  phaseId: string;
  phaseName: string;
  phaseType: TournamentPhaseType;
  /** true enquanto a fase não foi finalizada. */
  provisional: boolean;
  points: number;
  /** Decomposição (soma = points). */
  components: IPickemComponentsBreakdown;
}

export interface IMatchBreakdown {
  totalPredictions: number;
  exactScoreHits: number;
  winnerHits: number;
  wrongs: number;
}

export interface IParticipantSummaryResponse {
  userId: string;
  userName: string;
  avatarUrl: string;
  /** null se não aparece no ranking (nenhum palpite/pick'em). */
  rankingPosition: number | null;
  /** == ranking (partidas + pick'em). */
  totalPoints: number;
  matchPoints: number;
  pickemPoints: number;
  matchBreakdown: IMatchBreakdown;
  /** Ordenado pela posição da fase. */
  pickemByPhase: IPickemPhaseBreakdown[];
}

// ── Pendências na home (GET /api/users/me/pickems/pending) ─────────────
// Endpoint ainda a implementar no backend — contrato em PICKEM_FRONT_API.md.

export interface IPendingPickemResponse {
  tournamentId: string;
  tournamentName: string;
  phaseId: string;
  phaseName: string;
  phaseType: TournamentPhaseType;
  /** min(scheduledAt) da fase; null = trava pelo 1º resultado. */
  lockAt: string | null;
}
