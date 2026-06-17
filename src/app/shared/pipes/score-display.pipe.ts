import { Pipe, PipeTransform } from '@angular/core';

/** Placar "mágico": 99 gols vira o símbolo do infinito na interface. */
const INFINITY_GOALS = 99;
const INFINITY_SYMBOL = '∞';

/**
 * Formata um placar de gols para exibição. Quando o valor é 99, retorna o
 * símbolo do infinito (∞) em vez do número. Use em código (.ts); nos templates
 * prefira o pipe {@link ScoreDisplayPipe}.
 */
export function formatScoreDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value === INFINITY_GOALS ? INFINITY_SYMBOL : String(value);
}

/**
 * Formata um placar de gols para exibição. Quando o valor é 99, mostra o
 * símbolo do infinito (∞) em vez do número. Vale tanto para resultados de
 * partidas quanto para palpites.
 */
@Pipe({
  name: 'scoreDisplay',
  standalone: true,
})
export class ScoreDisplayPipe implements PipeTransform {
  public transform(value: number | null | undefined): string {
    return formatScoreDisplay(value);
  }
}
