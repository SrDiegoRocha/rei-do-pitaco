import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { LucideAngularModule, Search, X } from 'lucide-angular';

/**
 * Campo de busca compacto (ícone + limpar), controlado por `[(value)]`.
 * O filtro em si é responsabilidade do consumidor — aqui só entrada de texto.
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-input.component.html',
  styleUrl: './search-input.component.scss',
})
export class SearchInputComponent {
  public readonly value = model<string>('');
  public readonly placeholder = input<string>('Buscar...');
  public readonly ariaLabel = input<string>('Buscar');

  protected readonly searchIcon = Search;
  protected readonly clearIcon = X;

  protected handleInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  /** Limpa mantendo o foco no campo — encadeia buscas sem reabrir o teclado. */
  protected clear(inputEl: HTMLInputElement): void {
    this.value.set('');
    inputEl.focus();
  }
}
