import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';

@Component({
  selector: 'app-code-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './code-input.component.html',
  styleUrl: './code-input.component.scss',
})
export class CodeInputComponent implements AfterViewInit {
  public readonly length = input<number>(6);
  public readonly autoFocus = input<boolean>(false);
  public readonly disabled = input<boolean>(false);
  public readonly errorState = input<boolean>(false);

  public readonly valueChange = output<string>();
  public readonly complete = output<string>();

  private readonly _cells = viewChildren<ElementRef<HTMLInputElement>>('cell');

  protected readonly chars = signal<string[]>(
    Array(6).fill('') as string[],
  );

  protected readonly indices = computed(() =>
    Array.from({ length: this.length() }, (_, i) => i),
  );

  public ngAfterViewInit(): void {
    if (this.length() !== this.chars().length) {
      this.chars.set(Array(this.length()).fill('') as string[]);
    }
    if (this.autoFocus()) {
      queueMicrotask(() => this._focus(0));
    }
  }

  public reset(): void {
    this.chars.set(Array(this.length()).fill('') as string[]);
    this._focus(0);
    this._emit();
  }

  protected handleInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = (input.value || '').toUpperCase();
    const cleaned = raw.replace(/[^A-Z0-9]/g, '');

    if (cleaned.length > 1) {
      this._distribute(cleaned, index);
      return;
    }

    this.chars.update((arr) => {
      const copy = [...arr];
      copy[index] = cleaned;
      return copy;
    });
    input.value = cleaned;

    if (cleaned && index < this.length() - 1) {
      this._focus(index + 1);
    }

    this._emit();
  }

  protected handleKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      if (this.chars()[index] === '' && index > 0) {
        event.preventDefault();
        this.chars.update((arr) => {
          const copy = [...arr];
          copy[index - 1] = '';
          return copy;
        });
        this._focus(index - 1);
        this._emit();
      }
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this._focus(index - 1);
    } else if (event.key === 'ArrowRight' && index < this.length() - 1) {
      event.preventDefault();
      this._focus(index + 1);
    }
  }

  protected handlePaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!text) return;
    event.preventDefault();
    this._distribute(text, 0);
  }

  protected handleFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    queueMicrotask(() => input.select());
  }

  private _distribute(text: string, startIndex: number): void {
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleaned) return;

    const len = this.length();
    this.chars.update((arr) => {
      const copy = [...arr];
      for (let i = 0; i < cleaned.length && startIndex + i < len; i++) {
        copy[startIndex + i] = cleaned.charAt(i);
      }
      return copy;
    });

    const filledTo = Math.min(startIndex + cleaned.length, len - 1);
    queueMicrotask(() => this._focus(filledTo));
    this._emit();
  }

  private _emit(): void {
    const value = this.chars().join('');
    this.valueChange.emit(value);
    if (value.length === this.length() && !value.includes('')) {
      this.complete.emit(value);
    }
  }

  private _focus(index: number): void {
    const cells = this._cells();
    const el = cells[index]?.nativeElement;
    if (el) {
      el.focus();
      el.select();
    }
  }
}
