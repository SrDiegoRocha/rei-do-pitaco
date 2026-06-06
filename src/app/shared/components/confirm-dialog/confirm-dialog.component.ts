import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  backdropFade,
  dialogFade,
  modalScale,
} from '@shared/animations/animations';
import { ButtonComponent } from '@shared/components/button/button.component';
import { DraggableSheetDirective } from '@shared/directives/draggable-sheet.directive';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ButtonComponent, NgTemplateOutlet, DraggableSheetDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  animations: [modalScale, backdropFade, dialogFade],
})
export class ConfirmDialogComponent {
  public readonly open = input<boolean>(false);
  public readonly title = input<string>('');
  public readonly description = input<string>('');
  public readonly confirmLabel = input<string>('Confirmar');
  public readonly cancelLabel = input<string>('Cancelar');
  public readonly variant = input<'default' | 'destructive'>('default');
  public readonly loading = input<boolean>(false);
  /** Quando true, o modal vira bottom-sheet arrastável (respeita posição salva). */
  public readonly draggable = input<boolean>(false);
  /** Controla visibilidade do botão de cancelar. */
  public readonly showCancelButton = input<boolean>(true);

  public readonly confirmed = output<void>();
  public readonly cancelled = output<void>();

  protected onBackdropClick(): void {
    if (!this.loading()) {
      this.cancelled.emit();
    }
  }

  protected onCancel(): void {
    if (!this.loading()) {
      this.cancelled.emit();
    }
  }

  protected onConfirm(): void {
    this.confirmed.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open() && !this.loading()) {
      this.cancelled.emit();
    }
  }
}
