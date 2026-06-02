import { Injectable } from '@angular/core';

interface IReturnTarget {
  anchorId: string;
  /** Aba a reabrir ao voltar (ex.: 'info', 'ranking'). */
  tab: string;
}

/**
 * Lembra de onde o usuário saiu na tela de detalhes do torneio (qual aba e
 * qual card/linha) antes de entrar numa sub-página. Quando ele volta — por
 * qualquer caminho (voltar do header, voltar do navegador, gesto) — a tela de
 * detalhes consome esse alvo para reabrir na aba certa e rolar até a origem.
 */
@Injectable({ providedIn: 'root' })
export class TournamentReturnService {
  private _tournamentId: string | null = null;
  private _target: IReturnTarget | null = null;

  public set(tournamentId: string, anchorId: string, tab = 'info'): void {
    this._tournamentId = tournamentId;
    this._target = { anchorId, tab };
  }

  /** Retorna e limpa o alvo, se for do torneio informado. */
  public consume(tournamentId: string): IReturnTarget | null {
    if (this._tournamentId !== tournamentId) return null;
    const target = this._target;
    this._tournamentId = null;
    this._target = null;
    return target;
  }
}
