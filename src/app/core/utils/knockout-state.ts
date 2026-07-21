import { IBracketResponse } from '@core/interfaces/bracket.interface';

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Número total de rodadas esperadas em uma fase de mata-mata com `teamCount`
 * times. Ex.: 16 → 4 (Oitavas, Quartas, Semifinais, Final). Retorna 0 se a
 * estrutura não é potência de 2.
 */
export function expectedKnockoutRounds(teamCount: number): number {
  if (!isPowerOfTwo(teamCount) || teamCount < 2) return 0;
  return Math.log2(teamCount);
}

/**
 * A rodada mais recente do bracket tem todos os confrontos resolvidos (winner
 * decidido)?
 */
export function isCurrentKnockoutRoundDone(
  bracket: IBracketResponse | null,
): boolean {
  if (!bracket || bracket.rounds.length === 0) return false;
  const lastRound = bracket.rounds[bracket.rounds.length - 1]!;
  for (const tie of lastRound.ties) {
    if (!tie.complete) return false;
    if (tie.winner == null) return false;
  }
  return true;
}

/**
 * A fase chegou à rodada FINAL esperada e essa final está resolvida?
 * Quando `hasThirdPlace`, exige também que a disputa de 3º lugar exista e
 * tenha sido decidida.
 */
export function isKnockoutFinalDone(
  bracket: IBracketResponse | null,
  teamCount: number,
  hasThirdPlace = false,
): boolean {
  if (!bracket || bracket.rounds.length === 0) return false;
  const expected = expectedKnockoutRounds(teamCount);
  // Fallback: se não é potência de 2, assume "concluído" quando a última
  // rodada existente está toda decidida.
  if (expected === 0) return isCurrentKnockoutRoundDone(bracket);
  const lastRound = bracket.rounds[bracket.rounds.length - 1]!;
  if (lastRound.round !== expected) return false;

  const finalTie = lastRound.ties.find((t) => !t.thirdPlace);
  if (!finalTie || !finalTie.complete || finalTie.winner == null) return false;

  if (hasThirdPlace) {
    const third = lastRound.ties.find((t) => t.thirdPlace);
    if (!third || !third.complete || third.winner == null) return false;
  }
  return true;
}

/**
 * Número da rodada atual (a mais recente renderizada no bracket). `null` se
 * não há rodadas ainda.
 */
export function currentKnockoutRound(
  bracket: IBracketResponse | null,
): number | null {
  if (!bracket || bracket.rounds.length === 0) return null;
  return bracket.rounds[bracket.rounds.length - 1]!.round;
}

/**
 * Nº de vencedores decididos na rodada mais recente (confrontos que não são de
 * 3º lugar e já têm `winner`). Base para saber se dá para sortear a próxima
 * rodada em `REDRAW_EACH_ROUND` (ver {@link canRedrawGenerateNextRound}).
 */
export function lastRoundWinnerCount(
  bracket: IBracketResponse | null,
): number {
  if (!bracket || bracket.rounds.length === 0) return 0;
  const lastRound = bracket.rounds[bracket.rounds.length - 1]!;
  return lastRound.ties.filter((t) => !t.thirdPlace && t.winner != null).length;
}

/**
 * Em `REDRAW_EACH_ROUND`, dá para gerar (sortear) a próxima rodada? Só quando a
 * rodada atual está toda decidida e sobra um nº PAR de vencedores ≥ 2 para
 * emparelhar. Com 1 vencedor a fase acabou (campeão); com nº ímpar o backend
 * recusa (o admin finaliza a fase levando os sobreviventes adiante).
 */
export function canRedrawGenerateNextRound(
  bracket: IBracketResponse | null,
): boolean {
  if (!isCurrentKnockoutRoundDone(bracket)) return false;
  const winners = lastRoundWinnerCount(bracket);
  return winners >= 2 && winners % 2 === 0;
}

/**
 * Em `REDRAW_EACH_ROUND`, a fase chegou a um ponto em que NÃO há próxima rodada
 * a sortear: rodada atual decidida e ou saiu um campeão (1 vencedor) ou o nº de
 * vencedores é ímpar (dead-end). Em ambos os casos o caminho adiante é o
 * `finalize`.
 */
export function isRedrawPhaseExhausted(
  bracket: IBracketResponse | null,
): boolean {
  if (!isCurrentKnockoutRoundDone(bracket)) return false;
  return !canRedrawGenerateNextRound(bracket);
}
