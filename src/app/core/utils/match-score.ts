import { IMatchResponse } from '@core/interfaces/match.interface';

/** Só os campos de placar de que a regra de exibição precisa. */
type MatchScoreLike = Pick<
  IMatchResponse,
  | 'homeScore'
  | 'awayScore'
  | 'homeExtraTimeScore'
  | 'awayExtraTimeScore'
  | 'homePenalties'
  | 'awayPenalties'
>;

export interface IMatchDisplayScore {
  home: number | null;
  away: number | null;
  /** `true` quando o placar exibido é o da prorrogação (não o dos 90'). */
  isExtraTime: boolean;
}

/**
 * Placar "de exibição" de uma partida, seguindo a regra do produto: se houve
 * prorrogação, mostra o placar dela (que é cumulativo — já inclui os 90'); caso
 * contrário, o placar do tempo normal. Use em qualquer lugar que liste o placar
 * **real** da partida (não o palpite, onde o 90' é o placar principal).
 */
export function matchDisplayScore(m: MatchScoreLike): IMatchDisplayScore {
  if (m.homeExtraTimeScore !== null && m.awayExtraTimeScore !== null) {
    return {
      home: m.homeExtraTimeScore,
      away: m.awayExtraTimeScore,
      isExtraTime: true,
    };
  }
  return { home: m.homeScore, away: m.awayScore, isExtraTime: false };
}

/**
 * Lado vencedor pelo placar decisivo (prorrogação se houve, senão 90') e, em
 * empate, pelos pênaltis. Retorna `'draw'` quando nem os pênaltis desempatam e
 * `null` quando o placar decisivo ainda não existe.
 */
export function matchWinnerSide(
  m: MatchScoreLike,
): 'home' | 'away' | 'draw' | null {
  const { home, away } = matchDisplayScore(m);
  if (home === null || away === null) return null;
  if (home > away) return 'home';
  if (away > home) return 'away';
  if (m.homePenalties !== null && m.awayPenalties !== null) {
    if (m.homePenalties > m.awayPenalties) return 'home';
    if (m.awayPenalties > m.homePenalties) return 'away';
  }
  return 'draw';
}
