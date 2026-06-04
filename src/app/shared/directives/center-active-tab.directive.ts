import {
  Directive,
  effect,
  ElementRef,
  inject,
  input,
} from '@angular/core';

/**
 * Mantém a aba ativa visível e o mais centralizada possível dentro de uma faixa
 * de abas com scroll horizontal. Sempre que o valor de entrada muda (ex.: o
 * índice da aba ativa), rola a faixa para centralizar o item com
 * `aria-selected="true"` — limitado às bordas, então quando não há scroll
 * suficiente a aba apenas fica totalmente visível.
 *
 * Uso: `<div class="tabs__scroll" [appCenterActiveTab]="activeTabIndex()">`.
 */
@Directive({
  selector: '[appCenterActiveTab]',
  standalone: true,
})
export class CenterActiveTabDirective {
  /** Muda quando a aba ativa muda, disparando o recentramento. */
  public readonly activeKey = input<unknown>(undefined, {
    alias: 'appCenterActiveTab',
  });

  private readonly _el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _reduceMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    effect(() => {
      this.activeKey(); // dependência reativa
      if (typeof requestAnimationFrame === 'undefined') return;
      // Espera o DOM refletir a aba ativa antes de medir.
      requestAnimationFrame(() => this._center());
    });
  }

  private _center(): void {
    const host = this._el.nativeElement;
    const active = host.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!active) return;

    const maxScroll = host.scrollWidth - host.clientWidth;
    if (maxScroll <= 0) return; // sem scroll → nada a centralizar

    const hostRect = host.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    // Deslocamento para o centro do item coincidir com o centro da faixa.
    const delta =
      activeRect.left -
      hostRect.left -
      (host.clientWidth - activeRect.width) / 2;
    const target = Math.max(0, Math.min(host.scrollLeft + delta, maxScroll));

    host.scrollTo({
      left: target,
      behavior: this._reduceMotion ? 'auto' : 'smooth',
    });
  }
}
