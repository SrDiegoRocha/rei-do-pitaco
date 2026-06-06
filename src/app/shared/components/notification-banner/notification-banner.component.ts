import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@shared/components/button/button.component';
import { PushNotificationsService } from '@shared/services/push-notifications.service';
import { Bell, BellOff, LucideAngularModule } from 'lucide-angular';

/**
 * Convite para ativar as notificações push. Mostra um pré-prompt suave antes do
 * prompt nativo; se o usuário bloquear de vez, vira um aviso de como reativar.
 */
@Component({
  selector: 'app-notification-banner',
  standalone: true,
  imports: [ButtonComponent, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-banner.component.html',
  styleUrl: './notification-banner.component.scss',
})
export class NotificationBannerComponent {
  protected readonly push = inject(PushNotificationsService);
  protected readonly bellIcon = Bell;
  protected readonly bellOffIcon = BellOff;

  protected onEnable(): void {
    void this.push.enable();
  }

  protected onDismiss(): void {
    this.push.dismiss();
  }
}
