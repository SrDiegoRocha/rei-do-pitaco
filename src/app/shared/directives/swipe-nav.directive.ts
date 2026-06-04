import {
  Directive,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  output,
} from '@angular/core';

const SWIPE_THRESHOLD = 55; // px mínimos no eixo X para contar como swipe
const DECISION_THRESHOLD = 8; // px para decidir se o gesto é horizontal

/**
 * Navegação por swipe horizontal entre abas (estilo pager nativo), funcionando
 * em qualquer ponto da área — não só no topo.
 *
 * - `next`: dedo para a ESQUERDA (próxima aba, à direita).
 * - `prev`: dedo para a DIREITA (aba anterior, à esquerda).
 *
 * Usa touch events e chama `preventDefault()` no `touchmove` assim que o gesto
 * é reconhecido como horizontal — impedindo o navegador de "roubar" o toque
 * para o scroll vertical (a causa de só funcionar perto do topo). Gestos
 * verticais são deixados em paz (a página rola normal), e o swipe é ignorado
 * quando começa dentro de uma área com scroll horizontal próprio (chips de
 * filtro, chaveamento, tabelas).
 */
@Directive({
  selector: '[appSwipeNav]',
  standalone: true,
})
export class SwipeNavDirective implements OnDestroy {
  public readonly next = output<void>();
  public readonly prev = output<void>();

  private readonly _el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _zone = inject(NgZone);

  private _startX = 0;
  private _startY = 0;
  private _tracking = false;
  private _decided = false;
  private _horizontal = false;
  private readonly _cleanups: (() => void)[] = [];

  constructor() {
    const host = this._el.nativeElement;
    this._zone.runOutsideAngular(() => {
      const onStart = (e: TouchEvent) => this._onStart(e);
      const onMove = (e: TouchEvent) => this._onMove(e);
      const onEnd = (e: TouchEvent) => this._onEnd(e);
      // touchmove precisa ser não-passivo para podermos dar preventDefault.
      host.addEventListener('touchstart', onStart, { passive: true });
      host.addEventListener('touchmove', onMove, { passive: false });
      host.addEventListener('touchend', onEnd);
      host.addEventListener('touchcancel', onEnd);
      this._cleanups.push(() => {
        host.removeEventListener('touchstart', onStart);
        host.removeEventListener('touchmove', onMove);
        host.removeEventListener('touchend', onEnd);
        host.removeEventListener('touchcancel', onEnd);
      });
    });
  }

  public ngOnDestroy(): void {
    this._cleanups.forEach((fn) => fn());
  }

  private _onStart(e: TouchEvent): void {
    if (e.touches.length !== 1) {
      this._tracking = false;
      return;
    }
    if (this._startsInHorizontalScroller(e.target as HTMLElement | null)) {
      this._tracking = false;
      return;
    }
    const touch = e.touches[0];
    this._tracking = true;
    this._decided = false;
    this._horizontal = false;
    this._startX = touch.clientX;
    this._startY = touch.clientY;
  }

  private _onMove(e: TouchEvent): void {
    if (!this._tracking) return;
    const touch = e.touches[0];
    const dx = touch.clientX - this._startX;
    const dy = touch.clientY - this._startY;

    if (!this._decided) {
      if (
        Math.abs(dx) < DECISION_THRESHOLD &&
        Math.abs(dy) < DECISION_THRESHOLD
      ) {
        return;
      }
      this._decided = true;
      this._horizontal = Math.abs(dx) > Math.abs(dy);
      // Vertical → é scroll da página; solta o gesto para o navegador.
      if (!this._horizontal) {
        this._tracking = false;
        return;
      }
    }

    // Horizontal: bloqueia o scroll para o swipe valer em qualquer ponto.
    if (this._horizontal && e.cancelable) {
      e.preventDefault();
    }
  }

  private _onEnd(e: TouchEvent): void {
    const tracking = this._tracking && this._horizontal;
    this._tracking = false;
    if (!tracking) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - this._startX;
    const dy = touch.clientY - this._startY;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
    this._zone.run(() => (dx < 0 ? this.next.emit() : this.prev.emit()));
  }

  /** O gesto começou dentro de um elemento com scroll horizontal próprio? */
  private _startsInHorizontalScroller(target: HTMLElement | null): boolean {
    const host = this._el.nativeElement;
    let el: HTMLElement | null = target;
    while (el && el !== host) {
      if (el.scrollWidth > el.clientWidth + 2) {
        const overflowX = getComputedStyle(el).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
      }
      el = el.parentElement;
    }
    return false;
  }
}
