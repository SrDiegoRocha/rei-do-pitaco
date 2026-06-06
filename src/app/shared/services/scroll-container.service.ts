import { Injectable } from '@angular/core';

/**
 * O scroll do app acontece num container interno (.layout__main), não na
 * janela. Telas que precisam reposicionar o scroll (ex.: trocar de página numa
 * lista paginada) devem usar este serviço em vez de `window.scrollTo`, que não
 * afeta o container e por isso não tem efeito.
 */
@Injectable({ providedIn: 'root' })
export class ScrollContainerService {
  private get _container(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    return document.querySelector<HTMLElement>('.layout__main');
  }

  public scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
    this._container?.scrollTo({ top: 0, behavior });
  }
}
