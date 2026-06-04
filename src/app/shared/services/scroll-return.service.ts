import { Injectable } from '@angular/core';

/**
 * Lembra qual item de uma lista o usuário tocou antes de navegar para uma
 * sub-página, para rolar de volta até ele ao retornar (inclusive pelo "voltar"
 * do navegador/gesto). Chaveado por uma string da lista (ex.: torneio/fase),
 * para não restaurar a posição na lista errada.
 */
@Injectable({ providedIn: 'root' })
export class ScrollReturnService {
  private _key: string | null = null;
  private _anchorId: string | null = null;

  public set(key: string, anchorId: string): void {
    this._key = key;
    this._anchorId = anchorId;
  }

  /** Retorna e limpa a âncora, se for da lista informada. */
  public consume(key: string): string | null {
    if (this._key !== key) return null;
    const anchor = this._anchorId;
    this._key = null;
    this._anchorId = null;
    return anchor;
  }
}
