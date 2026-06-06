import {
  afterNextRender,
  Directive,
  ElementRef,
  inject,
  Injector,
  NgZone,
  OnDestroy,
} from '@angular/core';

/**
 * Detecta overflow horizontal de texto e aplica uma animação de marquee (scroll)
 * quando o conteúdo não cabe no container pai. O texto desliza para revelar o final,
 * aguarda 2 s e volta ao início.
 *
 * Uso: aplicar no elemento de texto. O elemento pai deve ter `overflow: hidden`.
 * A classe `is-marquee` e a variável `--marquee-shift` são adicionadas ao host
 * quando há overflow. A animação CSS é definida no componente que usa a diretiva.
 */
@Directive({
  selector: '[appMarquee]',
  standalone: true,
})
export class MarqueeDirective implements OnDestroy {
  private readonly _el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _zone = inject(NgZone);
  private _observer: ResizeObserver | undefined;

  constructor() {
    const injector = inject(Injector);
    afterNextRender(() => this._setup(), { injector });
  }

  public ngOnDestroy(): void {
    this._observer?.disconnect();
  }

  private _setup(): void {
    const el = this._el.nativeElement;
    this._zone.runOutsideAngular(() => {
      this._check(el);
      this._observer = new ResizeObserver(() => this._check(el));
      if (el.parentElement) {
        this._observer.observe(el.parentElement);
      }
    });
  }

  private _check(el: HTMLElement): void {
    const containerWidth = el.parentElement?.clientWidth ?? 0;
    const overflow = el.scrollWidth - containerWidth;
    if (overflow > 1) {
      el.style.setProperty('--marquee-shift', `-${overflow}px`);
      el.classList.add('is-marquee');
    } else {
      el.style.removeProperty('--marquee-shift');
      el.classList.remove('is-marquee');
    }
  }
}
