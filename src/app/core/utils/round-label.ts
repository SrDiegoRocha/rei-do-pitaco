/**
 * Helpers para nomear rodadas de mata-mata em pt-BR.
 *
 * A nomenclatura é derivada do número de times que ENTRAM em cada rodada,
 * que por sua vez vem do número total de times da fase (precisa ser potência
 * de 2). Em rounds 0-indexed iniciando em 1:
 *   - Round 1 (primeira): teamCount times entram
 *   - Round 2: teamCount / 2 times entram
 *   - ...
 *   - Round N (final): 2 times entram
 */

import { MatchType } from '@core/interfaces/enums';

export interface IRoundOption {
  round: number;
  label: string;
  matchType: MatchType;
}

const KO_LABEL_BY_TEAMS_ENTERING: Record<number, string> = {
  2: 'Final',
  4: 'Semifinais',
  8: 'Quartas de final',
  16: 'Oitavas de final',
  32: '16-avos de final',
  64: '32-avos de final',
  128: '64-avos de final',
};

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function totalKnockoutRounds(teamCount: number): number {
  if (!isPowerOfTwo(teamCount) || teamCount < 2) return 0;
  return Math.log2(teamCount);
}

/**
 * Nome amigável da rodada de mata-mata. Cai para "Rodada N" se a estrutura
 * não é uma potência de 2 ou o round está fora do range esperado.
 */
export function knockoutRoundLabel(round: number, teamCount: number): string {
  if (round <= 0) return `Rodada ${round}`;
  if (!isPowerOfTwo(teamCount)) return `Rodada ${round}`;
  const total = totalKnockoutRounds(teamCount);
  if (round > total) return `Rodada ${round}`;
  const teamsEntering = teamCount / Math.pow(2, round - 1);
  return KO_LABEL_BY_TEAMS_ENTERING[teamsEntering] ?? `Rodada ${round}`;
}

/**
 * Lista de opções de rodada para um select de criação/edição de partida
 * em fase de mata-mata. Retorna [] se a estrutura não permite (não potência
 * de 2 ou menos de 2 times). Se `hasThirdPlace`, anexa uma opção extra
 * para a disputa de 3º lugar (mesma rodada da final, matchType THIRD_PLACE).
 */
export function knockoutRoundOptions(
  teamCount: number,
  hasThirdPlace = false,
): IRoundOption[] {
  const total = totalKnockoutRounds(teamCount);
  if (total === 0) return [];
  const out: IRoundOption[] = [];
  for (let r = 1; r <= total; r++) {
    out.push({
      round: r,
      label: knockoutRoundLabel(r, teamCount),
      matchType: 'REGULAR',
    });
  }
  if (hasThirdPlace) {
    out.push({
      round: total,
      label: 'Disputa de 3º lugar',
      matchType: 'THIRD_PLACE',
    });
  }
  return out;
}
