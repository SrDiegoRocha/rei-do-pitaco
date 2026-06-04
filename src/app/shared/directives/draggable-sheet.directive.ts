import {
  afterNextRender,
  Directive,
  ElementRef,
  inject,
  Injector,
  NgZone,
  OnDestroy,
} from '@angular/core';

type SheetPosition = 'bottom' | 'center';

const STORAGE_KEY = 'reidopitaco.sheetPosition';
const SNAP_TRANSITION =
  'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 200ms ease';

/**
 * Transforma um modal (bottom-sheet) em arrastável: o usuário puxa pelo
 * "grabber" para alternar entre ancorado embaixo e centralizado. A escolha é
 * persistida e reaplicada na próxima abertura.
 *
 * Uso: aplicar em `.dialog__content` e adicionar um elemento com
 * `data-sheet-handle` dentro (o puxador). A diretiva controla o `transform`,
 * então a animação de abertura do modal deve usar só opacidade (sem transform).
 */
@Directive({
  selector: '[appDraggableSheet]',
  standalone: true,
})
export class DraggableSheetDirective implements OnDestroy {
  private readonly _el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _zone = inject(NgZone);

  private _position: SheetPosition = this._read();
  private _centerOffset = 0; // translateY (px, ≤ 0) que centraliza o conteúdo
  private _current = 0; // translateY aplicado no momento
  private _dragging = false;
  private _startY = 0;
  private _startTranslate = 0;
  private readonly _cleanups: (() => void)[] = [];
  private readonly _reduceMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    const injector = inject(Injector);
    afterNextRender(() => this._enter(), { injector });
  }

  public ngOnDestroy(): void {
    this._cleanups.forEach((fn) => fn());
  }

  private get _host(): HTMLElement {
    return this._el.nativeElement;
  }

  private _enter(): void {
    this._host.style.willChange = 'transform';
    // Mede o ponto de centralização com o conteúdo em repouso (transform 0).
    this._current = 0;
    this._centerOffset = this._computeCenterOffset();

    // Posição inicial fora da tela (embaixo) para deslizar para dentro.
    this._host.style.transition = 'none';
    this._current = window.innerHeight;
    this._apply();
    void this._host.offsetHeight; // força reflow para a transição valer

    requestAnimationFrame(() => {
      this._setSnapTransition();
      this._snapTo(this._position, false);
    });

    this._bindDrag();
  }

  /** Quanto subir (px, negativo) para o conteúdo ficar centralizado na tela. */
  private _computeCenterOffset(): number {
    const rect = this._host.getBoundingClientRect();
    const topAtZero = rect.top - this._current;
    const centeredTop = (window.innerHeight - rect.height) / 2;
    return Math.min(0, centeredTop - topAtZero);
  }

  private _apply(): void {
    this._host.style.transform = `translateY(${this._current}px)`;
  }

  private _setSnapTransition(): void {
    this._host.style.transition = this._reduceMotion ? 'none' : SNAP_TRANSITION;
  }

  private _snapTo(position: SheetPosition, persist: boolean): void {
    this._position = position;
    this._current = position === 'center' ? this._centerOffset : 0;
    this._apply();
    this._host.classList.toggle('is-centered', position === 'center');
    if (persist) this._write(position);
  }

  private _bindDrag(): void {
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-sheet-handle]')) return;
      this._dragging = true;
      this._startY = event.clientY;
      this._startTranslate = this._current;
      this._centerOffset = this._computeCenterOffset(); // reavalia (rotação/teclado)
      this._host.style.transition = 'none';
      event.preventDefault();
    };

    const onMove = (event: PointerEvent) => {
      if (!this._dragging) return;
      const dy = event.clientY - this._startY;
      // Faixa permitida: do topo centralizado (centerOffset) até embaixo (0).
      this._current = Math.max(
        this._centerOffset,
        Math.min(0, this._startTranslate + dy),
      );
      this._apply();
      event.preventDefault();
    };

    const onUp = () => {
      if (!this._dragging) return;
      this._dragging = false;
      this._setSnapTransition();
      // Passou da metade do caminho para cima → centro; senão volta pra baixo.
      const target: SheetPosition =
        this._current <= this._centerOffset / 2 ? 'center' : 'bottom';
      this._snapTo(target, true);
    };

    this._zone.runOutsideAngular(() => {
      const host = this._host;
      host.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      this._cleanups.push(() => {
        host.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      });
    });
  }

  private _read(): SheetPosition {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'center'
        ? 'center'
        : 'bottom';
    } catch {
      return 'bottom';
    }
  }

  private _write(position: SheetPosition): void {
    try {
      localStorage.setItem(STORAGE_KEY, position);
    } catch {
      // Storage indisponível — só não persiste.
    }
  }
}
