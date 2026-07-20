import { IBracketResponse, IBracketTie } from '@core/interfaces/bracket.interface';
import { MatchType } from '@core/interfaces/enums';
import { ITeamRef } from '@core/interfaces/match.interface';
import { TieMatchupOutcome } from '@core/interfaces/pickem.interface';
import { knockoutRoundLabel } from '@core/utils/round-label';
import { formatScoreDisplay } from '@shared/pipes/score-display.pipe';

/**
 * View-model da árvore espelhada de mata-mata (bracket-tree).
 * Alimentada tanto pelo chaveamento real (`bracketResponseToTree`) quanto
 * pelo Pick'em (template + escolhas do palpiteiro, montado na página).
 */

export interface IBracketTreeSlot {
  roundNumber: number;
  slotIndex: number;
  matchType: MatchType;
  homeTeam: ITeamRef | null;
  awayTeam: ITeamRef | null;
  /** Vencedor (real ou escolhido); null indefinido. */
  winnerTeamId: string | null;

  // ── Modo leitura do chaveamento real ──────────────────────────────────
  /** Texto do agregado (ex. "2"); null sem resultado. */
  homeScore?: string | null;
  awayScore?: string | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  /** Partida (1ª perna) para navegação. */
  matchId?: string | null;

  // ── Feedback de acerto do Pick'em (leitura pós-resultado) ─────────────
  outcome?: TieMatchupOutcome | null;
  winnerAdvanced?: boolean | null;
  pointsAwarded?: number | null;

  /** Modo interativo: aceita escolha de vencedor (par completo). */
  pickable?: boolean;
}

export interface IBracketTreeRound {
  roundNumber: number;
  name: string;
  slots: IBracketTreeSlot[];
}

export interface IBracketTreeData {
  totalRounds: number;
  /** Rodadas 1..totalRounds (só confrontos REGULAR, ordem canônica). */
  rounds: IBracketTreeRound[];
  thirdPlace: IBracketTreeSlot | null;
  /** Campeão (real ou previsto) para o card do topo. */
  champion: ITeamRef | null;
  runnerUp: ITeamRef | null;
  thirdPlaceWinner: ITeamRef | null;
  /** Pick'em: acertou o campeão? (null sem base) */
  championHit?: boolean | null;
}

export function emptyTreeSlot(
  roundNumber: number,
  slotIndex: number,
  matchType: MatchType = 'REGULAR',
): IBracketTreeSlot {
  return {
    roundNumber,
    slotIndex,
    matchType,
    homeTeam: null,
    awayTeam: null,
    winnerTeamId: null,
  };
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function tieToSlot(
  tie: IBracketTie,
  roundNumber: number,
  slotIndex: number,
  matchType: MatchType,
): IBracketTreeSlot {
  const hasResult = tie.legs.some((l) => l.status === 'COMPLETED');
  return {
    roundNumber,
    slotIndex,
    matchType,
    homeTeam: tie.homeTeam,
    awayTeam: tie.awayTeam,
    winnerTeamId: tie.winner?.id ?? null,
    homeScore: hasResult ? formatScoreDisplay(tie.homeAggregate) : null,
    awayScore: hasResult ? formatScoreDisplay(tie.awayAggregate) : null,
    homePenalties: hasResult ? tie.homePenalties : null,
    awayPenalties: hasResult ? tie.awayPenalties : null,
    matchId: tie.legs[0]?.id ?? null,
  };
}

/**
 * Converte o chaveamento real em árvore espelhada. Retorna `null` quando a
 * estrutura não é "tree-shaped" (nº de confrontos não é potência de 2, rodadas
 * não sequenciais ou contagens que não caem pela metade) — brackets manuais
 * antigos caem no fallback de cards.
 */
export function bracketResponseToTree(
  bracket: IBracketResponse,
): IBracketTreeData | null {
  const rounds = [...bracket.rounds].sort((a, b) => a.round - b.round);
  if (rounds.length === 0) return null;

  const mains = rounds.map((r) => r.ties.filter((t) => !t.thirdPlace));
  const n1 = mains[0]?.length ?? 0;
  if (!isPowerOfTwo(n1)) return null;

  const totalRounds = Math.log2(n1) + 1;
  if (rounds.length > totalRounds) return null;
  for (let i = 0; i < rounds.length; i++) {
    if (mains[i]!.length !== n1 / Math.pow(2, i)) return null;
    if (rounds[i]!.round !== rounds[0]!.round + i) return null;
  }

  const teamCount = n1 * 2;
  const treeRounds: IBracketTreeRound[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const ties = mains[r - 1] ?? [];
    const expected = n1 / Math.pow(2, r - 1);
    const slots: IBracketTreeSlot[] = [];
    for (let s = 0; s < expected; s++) {
      const tie = ties[s];
      slots.push(tie ? tieToSlot(tie, r, s, 'REGULAR') : emptyTreeSlot(r, s));
    }
    treeRounds.push({
      roundNumber: r,
      name: knockoutRoundLabel(r, teamCount),
      slots,
    });
  }

  const finalTie = mains[totalRounds - 1]?.[0] ?? null;
  const champion = finalTie?.winner ?? null;
  const runnerUp =
    champion && finalTie
      ? (finalTie.homeTeam?.id === champion.id
          ? finalTie.awayTeam
          : finalTie.homeTeam)
      : null;

  const thirdTie =
    rounds.flatMap((r) => r.ties).find((t) => t.thirdPlace) ?? null;

  return {
    totalRounds,
    rounds: treeRounds,
    thirdPlace: thirdTie
      ? tieToSlot(thirdTie, totalRounds, 0, 'THIRD_PLACE')
      : null,
    champion,
    runnerUp,
    thirdPlaceWinner: thirdTie?.winner ?? null,
  };
}
