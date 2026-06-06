import {
  animate,
  animateChild,
  AnimationMetadata,
  group,
  query,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ChildrenOutletContexts, RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from '@shared/components/toast-container/toast-container.component';
import { InstallPromptService } from '@shared/services/install-prompt.service';
import { PushNotificationsService } from '@shared/services/push-notifications.service';

const SLIDE_DURATION = '300ms cubic-bezier(0.4, 0, 0.2, 1)';
const FADE_DURATION_IN = '220ms cubic-bezier(0.4, 0, 0.2, 1)';
const FADE_DURATION_OUT = '160ms cubic-bezier(0.4, 0, 0.2, 1)';

function authSlide(enterFromX: string, leaveToX: string): AnimationMetadata[] {
  return [
    style({ position: 'relative' }),
    query(
      ':enter, :leave',
      [
        style({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
        }),
      ],
      { optional: true },
    ),
    query(
      ':enter',
      [style({ transform: `translateX(${enterFromX})`, opacity: 0 })],
      { optional: true },
    ),
    group([
      query(
        ':leave',
        [
          animate(
            SLIDE_DURATION,
            style({ transform: `translateX(${leaveToX})`, opacity: 0 }),
          ),
        ],
        { optional: true },
      ),
      query(
        ':enter',
        [
          animate(
            SLIDE_DURATION,
            style({ transform: 'translateX(0)', opacity: 1 }),
          ),
        ],
        { optional: true },
      ),
    ]),
  ];
}

const genericFade: AnimationMetadata[] = [
  style({ position: 'relative' }),
  query(
    ':enter, :leave',
    [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
      }),
    ],
    { optional: true },
  ),
  query(':enter', [style({ opacity: 0 })], { optional: true }),
  query(':leave', animateChild(), { optional: true }),
  group([
    query(
      ':leave',
      [animate(FADE_DURATION_OUT, style({ opacity: 0 }))],
      { optional: true },
    ),
    query(
      ':enter',
      [animate(FADE_DURATION_IN, style({ opacity: 1 }))],
      { optional: true },
    ),
  ]),
  query(':enter', animateChild(), { optional: true }),
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  animations: [
    trigger('routeAnimations', [
      transition('signIn => signUp', authSlide('100%', '-30%')),
      transition('signUp => signIn', authSlide('-100%', '30%')),
      transition('* <=> *', genericFade),
    ]),
  ],
})
export class App {
  private readonly _contexts = inject(ChildrenOutletContexts);
  // Instanciado no bootstrap para capturar o `beforeinstallprompt`, que
  // dispara cedo (antes do login). O banner pós-login lê deste serviço.
  private readonly _installPrompt = inject(InstallPromptService);
  // Instanciado cedo para resolver o estado de permissão de push e religar a
  // inscrição de quem já aceitou; o banner pós-login lê deste serviço.
  private readonly _pushNotifications = inject(PushNotificationsService);

  protected getRouteAnimationData(): string | null {
    const data = this._contexts.getContext('primary')?.route?.snapshot?.data;
    const animation = data?.['animation'];
    return typeof animation === 'string' ? animation : null;
  }
}
