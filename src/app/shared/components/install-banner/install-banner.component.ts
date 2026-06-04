import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@shared/components/button/button.component';
import { InstallPromptService } from '@shared/services/install-prompt.service';
import { Download, LucideAngularModule } from 'lucide-angular';

/**
 * Convite de instalação do PWA, exibido na área logada enquanto o app não
 * estiver instalado. Chromium: botão dispara o prompt nativo. iOS: mostra o
 * passo a passo manual (Safari não tem instalação programática).
 */
@Component({
  selector: 'app-install-banner',
  standalone: true,
  imports: [ButtonComponent, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './install-banner.component.html',
  styleUrl: './install-banner.component.scss',
})
export class InstallBannerComponent {
  protected readonly install = inject(InstallPromptService);
  protected readonly downloadIcon = Download;

  protected onInstall(): void {
    void this.install.promptInstall();
  }

  protected onDismiss(): void {
    this.install.dismiss();
  }
}
