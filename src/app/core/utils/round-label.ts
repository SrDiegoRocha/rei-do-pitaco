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

import { MatchLegMode, MatchType } from '@core/interfaces/enums';

/**
 * Posição de uma partida dentro do mata-mata: em qual ETAPA (oitavas, quartas,
 * ...) e em qual PERNA (ida/volta) ela está.
 */
export interface IKnockoutStageInfo {
  /** Ordinal da etapa (1 = primeira etapa do mata-mata, ex.: oitavas). */
  stageOrdinal: number;
  /** Índice 0-based da perna dentro do confronto (0 = ida). */
  legIndex: number;
  /** Total de pernas da etapa (1 = jogo único; 2 = ida e volta). */
  legTotal: number;
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
 * Nome amigável de uma rodada a partir do nº de confrontos (ties) que ela tem,
 * em vez do total de times da fase. Robusto para mata-mata SEM chaveamento
 * (`REDRAW_EACH_ROUND`), onde a 1ª rodada não precisa ser potência de 2 e cada
 * rodada é um novo sorteio: 1 confronto → "Final", 2 → "Semifinais", etc.
 * Retorna `null` quando a contagem não mapeia numa etapa nomeada (ex.: 3 ties =
 * 6 times) — o chamador cai no rótulo "Rodada N".
 */
export function knockoutRoundLabelByTieCount(tieCount: number): string | null {
  if (tieCount <= 0) return null;
  return KO_LABEL_BY_TEAMS_ENTERING[tieCount * 2] ?? null;
}

/** Opção de etapa+perna para o formulário de criação/edição de partida. */
export interface IKnockoutStageOption {
  /** Round CRU a submitir para o backend. */
  round: number;
  matchType: MatchType;
  stageOrdinal: number;
  legIndex: number;
  legTotal: number;
  /** Rótulo amigável: "Oitavas de final · Ida", "Final", "Disputa de 3º lugar". */
  label: string;
}

/**
 * Enumera todas as etapas × pernas de uma fase de mata-mata, já com o `round`
 * CRU que cada uma deve ter (consistente com {@link knockoutStageForRound}) e o
 * rótulo pronto. Em ida-e-volta cada etapa vira duas opções (Ida/Volta); a
 * disputa de 3º lugar acompanha o modo da final. Retorna `[]` se a estrutura
 * não é potência de 2.
 */
export function knockoutStageOptions(
  teamCount: number,
  legMode: MatchLegMode,
  finalLegMode: MatchLegMode | null,
  hasThirdPlace = false,
): IKnockoutStageOption[] {
  const totalStages = totalKnockoutRounds(teamCount);
  if (totalStages === 0) return [];

  const legsPerStage = legMode === 'TWO_LEGGED' ? 2 : 1;
  const finalLegs = (finalLegMode ?? legMode) === 'TWO_LEGGED' ? 2 : 1;
  const preFinalRounds = (totalStages - 1) * legsPerStage;

  const out: IKnockoutStageOption[] = [];
  for (let stage = 1; stage <= totalStages; stage++) {
    const isFinal = stage === totalStages;
    const legTotal = isFinal ? finalLegs : legsPerStage;
    const baseRound = isFinal ? preFinalRounds : (stage - 1) * legsPerStage;
    const stageName = knockoutRoundLabel(stage, teamCount);
    for (let leg = 0; leg < legTotal; leg++) {
      out.push({
        round: baseRound + leg + 1,
        matchType: 'REGULAR',
        stageOrdinal: stage,
        legIndex: leg,
        legTotal,
        label:
          legTotal > 1
            ? `${stageName} · ${knockoutLegLabel(leg, legTotal)}`
            : stageName,
      });
    }
  }

  if (hasThirdPlace) {
    for (let leg = 0; leg < finalLegs; leg++) {
      out.push({
        round: preFinalRounds + leg + 1,
        matchType: 'THIRD_PLACE',
        stageOrdinal: totalStages,
        legIndex: leg,
        legTotal: finalLegs,
        label:
          finalLegs > 1
            ? `Disputa de 3º lugar · ${knockoutLegLabel(leg, finalLegs)}`
            : 'Disputa de 3º lugar',
      });
    }
  }

  return out;
}

/** Rótulo da perna de um confronto ida-e-volta a partir do índice. */
export function knockoutLegLabel(index: number, total: number): string {
  if (total <= 1) return 'Jogo único';
  if (index === 0) return 'Ida';
  if (index === total - 1) return 'Volta';
  return `Jogo ${index + 1}`;
}

/**
 * Descobre a ETAPA e a PERNA de uma partida de mata-mata a partir do `round`
 * CRU da partida.
 *
 * Por que isto existe: em ida-e-volta o backend numera cada perna com um
 * `round` próprio e sequencial (oitavas ida=1, oitavas volta=2, quartas ida=3,
 * quartas volta=4...). Nomear a etapa jogando o `round` cru direto em
 * {@link knockoutRoundLabel} trataria a **volta das oitavas** (round 2) como
 * **quartas**. Aqui reconstruímos o ordinal real da etapa considerando quantas
 * pernas cada etapa tem — o mesmo critério sequencial do endpoint `/bracket`.
 *
 * É uma função PURA de `(round, teamCount, legMode, finalLegMode)` — não
 * precisa da lista completa de partidas, então funciona mesmo com um conjunto
 * parcial (ex.: só os jogos que um participante palpitou).
 *
 * Retorna `null` quando a estrutura não é potência de 2 (aí o chamador cai no
 * rótulo "Rodada N" de {@link knockoutRoundLabel}).
 */
export function knockoutStageForRound(
  round: number,
  teamCount: number,
  legMode: MatchLegMode,
  finalLegMode: MatchLegMode | null,
): IKnockoutStageInfo | null {
  const totalStages = totalKnockoutRounds(teamCount);
  if (totalStages === 0 || round <= 0) return null;

  const legsPerStage = legMode === 'TWO_LEGGED' ? 2 : 1;
  // A rodada final (final + 3º lugar) pode ter modo próprio (finalLegMode).
  const finalLegs = (finalLegMode ?? legMode) === 'TWO_LEGGED' ? 2 : 1;

  // Rounds consumidos por todas as etapas ANTES da final.
  const preFinalRounds = (totalStages - 1) * legsPerStage;

  if (round <= preFinalRounds) {
    return {
      stageOrdinal: Math.floor((round - 1) / legsPerStage) + 1,
      legIndex: (round - 1) % legsPerStage,
      legTotal: legsPerStage,
    };
  }

  // Etapa final.
  const legIndex = round - preFinalRounds - 1;
  if (legIndex < 0 || legIndex >= finalLegs) return null; // fora do esperado
  return { stageOrdinal: totalStages, legIndex, legTotal: finalLegs };
}

/**
 * Rótulo completo de uma partida de mata-mata para filtros/agrupamento:
 * etapa (oitavas, quartas...) + perna (· Ida / · Volta) quando ida-e-volta, ou
 * "Disputa de 3º lugar" (também com a perna) para o 3º lugar.
 *
 * Corrige o bug de rotular a volta de uma etapa como a etapa seguinte — ver
 * {@link knockoutStageForRound}.
 */
export function knockoutMatchBucketLabel(
  round: number,
  isThirdPlace: boolean,
  teamCount: number,
  legMode: MatchLegMode,
  finalLegMode: MatchLegMode | null,
): string {
  const info = knockoutStageForRound(round, teamCount, legMode, finalLegMode);
  const legSuffix =
    info && info.legTotal > 1
      ? ` · ${knockoutLegLabel(info.legIndex, info.legTotal)}`
      : '';
  const base = isThirdPlace
    ? 'Disputa de 3º lugar'
    : info
      ? knockoutRoundLabel(info.stageOrdinal, teamCount)
      : knockoutRoundLabel(round, teamCount);
  return `${base}${legSuffix}`;
}
