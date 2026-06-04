import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Ordem das seções principais (mesma do menu inferior), para navegação por
 * swipe entre elas: Meus torneios → Públicos → Times.
 */
const SECTIONS = ['/tournaments', '/tournaments/public', '/teams'] as const;

@Injectable({ providedIn: 'root' })
export class SectionPagerService {
  private readonly _router = inject(Router);

  /**
   * Navega para a seção vizinha (delta +1 = direita, -1 = esquerda).
   * Retorna `true` se navegou, `false` se já está na ponta.
   */
  public navigate(current: string, delta: 1 | -1): boolean {
    const index = SECTIONS.indexOf(current as (typeof SECTIONS)[number]);
    if (index === -1) return false;
    const next = index + delta;
    if (next < 0 || next >= SECTIONS.length) return false;
    void this._router.navigateByUrl(SECTIONS[next]);
    return true;
  }
}
