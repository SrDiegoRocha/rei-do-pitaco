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
