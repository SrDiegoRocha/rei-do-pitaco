import { Injectable } from '@angular/core';

type SwipeHandler = (delta: 1 | -1) => void;

/**
 * Ponte entre o gesto de swipe global (capturado no container de scroll do
 * layout, que sempre preenche a viewport — inclusive o espaço vazio) e a tela
 * ativa, que registra o que fazer ao deslizar (trocar de aba / seção).
 *
 * Cada página registra seu handler ao entrar e o remove ao sair. A remoção só
 * zera se o handler atual ainda for o dela, então a ordem create/destroy
 * durante a transição de rota não apaga o handler da página nova.
 */
@Injectable({ providedIn: 'root' })
export class SwipeNavRegistry {
  private _handler: SwipeHandler | null = null;

  public set(handler: SwipeHandler): void {
    this._handler = handler;
  }

  public clear(handler: SwipeHandler): void {
    if (this._handler === handler) this._handler = null;
  }

  public handle(delta: 1 | -1): void {
    this._handler?.(delta);
  }
}
