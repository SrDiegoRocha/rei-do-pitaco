/**
 * Classificação visual de um palpite já pontuado, para colorir o badge de pontos.
 *
 * O backend é a fonte da verdade da pontuação: ele resolve toda a complexidade
 * (placar exato, vencedor, agregado de ida-e-volta, pênaltis de mata-mata) e
 * entrega apenas o `points` final em cada palpite. Em vez de tentar rededuzir
 * "quem ganhou" no cliente — o que divergiria do backend em confrontos com
 * agregado/pênaltis — comparamos o `points` atribuído contra a pontuação
 * vigente do torneio para descobrir em qual faixa o palpite caiu.
 *
 *   - `exact`  → acertou o placar exato      (verde / --brand)
 *   - `winner` → acertou só o vencedor        (azul  / --info)
 *   - `wrong`  → errou                        (vermelho / --danger)
 *
 * Pressupõe a configuração usual `exactScorePoints > winnerPoints > wrongPoints`.
 * Se dois desses valores forem iguais, a desambiguação por pontos é impossível
 * e a prioridade exato > vencedor é aplicada.
 */
export type PredictionOutcome = 'exact' | 'winner' | 'wrong';

export interface IPredictionScoring {
  exactScorePoints: number;
  winnerPoints: number;
  wrongPoints: number;
  /**
   * Componentes de mata-mata (prorrogação/pênaltis). Opcionais porque nem toda
   * origem de `scoring` os carrega — quando ausentes, valem 0 no breakdown.
   */
  extraTimeExactScorePoints?: number;
  extraTimeWinnerPoints?: number;
  penaltyWinnerPoints?: number;
}

/**
 * Retorna a faixa do palpite ou `null` quando não dá para classificar
 * (sem pontos atribuídos ou sem a pontuação do torneio à mão).
 */
export function classifyPredictionOutcome(
  points: number | null | undefined,
  scoring: IPredictionScoring | null | undefined,
): PredictionOutcome | null {
  if (points == null || !scoring) return null;
  if (points === scoring.exactScorePoints) return 'exact';
  if (points === scoring.winnerPoints) return 'winner';
  return 'wrong';
}

/**
 * Classifica um palpite comparando dois placares diretamente (exato > vencedor
 * > erro), via `Math.sign` do saldo — igual ao "componente 1" do backend.
 *
 * Preferível ao {@link classifyPredictionOutcome} baseado em `points` agora que
 * o total é uma **soma** de blocos (90' + prorrogação + pênaltis): a igualdade
 * `points === winnerPoints` deixou de identificar a faixa em jogos de mata-mata
 * que passaram por prorrogação/pênaltis. Aqui a cor reflete o placar do tempo
 * normal (ou o placar da perna, em ida-e-volta), que é a "faixa base".
 *
 * Retorna `null` enquanto algum placar não estiver disponível (ex.: resultado
 * ainda não lançado, ou palpite alheio redigido antes da revelação).
 */
export function classifyScorePair(
  predHome: number | null | undefined,
  predAway: number | null | undefined,
  realHome: number | null | undefined,
  realAway: number | null | undefined,
): PredictionOutcome | null {
  if (predHome == null || predAway == null || realHome == null || realAway == null) {
    return null;
  }
  if (predHome === realHome && predAway === realAway) return 'exact';
  return Math.sign(predHome - predAway) === Math.sign(realHome - realAway)
    ? 'winner'
    : 'wrong';
}

/** Entrada mínima do palpite para montar o breakdown de pontos. */
export interface IPredictionScores {
  homeScore: number | null;
  awayScore: number | null;
  homeExtraTimeScore: number | null;
  awayExtraTimeScore: number | null;
  penaltyWinner: 'HOME' | 'AWAY' | null;
}

/** Entrada mínima do resultado real para montar o breakdown de pontos. */
export interface IMatchScores {
  homeScore: number | null;
  awayScore: number | null;
  homeExtraTimeScore: number | null;
  awayExtraTimeScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
}

export interface IPointsComponent {
  label: string;
  points: number;
}

/**
 * Decompõe os pontos de um palpite nos blocos que somam o total (espelha a
 * regra do backend, §19 do API.md): tempo normal, prorrogação (só se o jogo foi
 * à prorrogação e o palpiteiro informou o placar) e pênaltis (só se o confronto
 * foi decidido nos pênaltis e o palpiteiro cravou quem passa).
 *
 * Retorna `[]` quando não dá pra classificar (placar real ausente). A soma dos
 * `points` corresponde ao `points` do palpite para uma partida individual.
 */
export function buildPointsBreakdown(
  prediction: IPredictionScores,
  result: IMatchScores,
  scoring: IPredictionScoring,
): IPointsComponent[] {
  const components: IPointsComponent[] = [];

  const regular = classifyScorePair(
    prediction.homeScore,
    prediction.awayScore,
    result.homeScore,
    result.awayScore,
  );
  if (regular === null) return components;
  if (regular === 'exact') {
    components.push({ label: 'Placar 90′', points: scoring.exactScorePoints });
  } else if (regular === 'winner') {
    components.push({ label: 'Vencedor 90′', points: scoring.winnerPoints });
  } else {
    components.push({ label: 'Placar 90′', points: scoring.wrongPoints });
  }

  const wentToExtraTime =
    result.homeExtraTimeScore !== null && result.awayExtraTimeScore !== null;
  const predictedExtraTime =
    prediction.homeExtraTimeScore !== null &&
    prediction.awayExtraTimeScore !== null;
  if (wentToExtraTime && predictedExtraTime) {
    const et = classifyScorePair(
      prediction.homeExtraTimeScore,
      prediction.awayExtraTimeScore,
      result.homeExtraTimeScore,
      result.awayExtraTimeScore,
    );
    if (et === 'exact') {
      components.push({
        label: 'Prorrogação',
        points: scoring.extraTimeExactScorePoints ?? 0,
      });
    } else if (et === 'winner') {
      components.push({
        label: 'Prorrogação',
        points: scoring.extraTimeWinnerPoints ?? 0,
      });
    }
  }

  const decidedOnPenalties =
    result.homePenalties !== null && result.awayPenalties !== null;
  if (decidedOnPenalties && prediction.penaltyWinner !== null) {
    const realWinner =
      result.homePenalties! > result.awayPenalties! ? 'HOME' : 'AWAY';
    if (prediction.penaltyWinner === realWinner) {
      components.push({
        label: 'Pênaltis',
        points: scoring.penaltyWinnerPoints ?? 0,
      });
    }
  }

  return components;
}
